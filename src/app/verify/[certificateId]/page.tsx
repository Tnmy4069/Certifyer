import type { Metadata } from "next";
import { headers } from "next/headers";
import { connectDb } from "@/lib/db";
import { absoluteUrl, formatDate } from "@/lib/utils";
import { AuditEvent, Candidate, Certificate, Event } from "@/models";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

type Params = { params: Promise<{ certificateId: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { certificateId } = await params;
  await connectDb();

  const certificate = await Certificate.findOne({
    certificateNumber: certificateId.toUpperCase(),
  });

  if (!certificate || certificate.status !== "GENERATED") {
    return {
      title: "Certificate Verification | Certify",
      description: "Verify authentic certificates.",
    };
  }

  const [event, candidate] = await Promise.all([
    Event.findById(certificate.eventId),
    Candidate.findById(certificate.candidateId),
  ]);

  const candidateName = candidate?.name || "Candidate";
  const eventName = event?.name || "Event";
  const organizerName = event?.organizerName || "Certify";

  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") || headersList.get("host");
  const proto = headersList.get("x-forwarded-proto") || (host?.includes("localhost") || host?.includes("127.0.0.1") ? "http" : "https");
  const origin = host ? `${proto}://${host}` : undefined;

  const previewUrl = absoluteUrl(`/api/public/certificate/${certificate.certificateNumber}/preview`, origin);
  const verifyUrl = absoluteUrl(`/verify/${certificate.certificateNumber}`, origin);

  return {
    title: `Certificate of Completion - ${candidateName} | ${eventName}`,
    description: `Verified certificate issued to ${candidateName} for ${eventName} by ${organizerName}. Certificate ID: ${certificate.certificateNumber}`,
    openGraph: {
      title: `Certificate of Completion - ${candidateName}`,
      description: `Verified certificate issued for ${eventName} by ${organizerName}. Certificate ID: ${certificate.certificateNumber}`,
      url: verifyUrl,
      siteName: "Certify",
      images: [
        {
          url: previewUrl,
          width: 1200,
          height: 630,
          alt: `Certificate for ${candidateName}`,
        },
      ],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: `Certificate of Completion - ${candidateName}`,
      description: `Verified certificate issued for ${eventName} by ${organizerName}.`,
      images: [previewUrl],
    },
  };
}

function buildLinkedinAddUrl({
  certificationName,
  organizationId,
  organizationName,
  issueDate,
  certUrl,
  certId,
}: {
  certificationName: string;
  organizationId?: string;
  organizationName?: string;
  issueDate?: Date | null;
  certUrl: string;
  certId: string;
}): string {
  const params = new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: certificationName,
    certUrl,
    certId,
  });

  const cleanOrgId = organizationId?.trim().replace(/^.*\/company\//, "").replace(/[^0-9]/g, "");
  if (cleanOrgId) {
    params.set("organizationId", cleanOrgId);
  } else if (organizationName?.trim()) {
    params.set("organizationName", organizationName.trim());
  }

  if (issueDate) {
    const d = new Date(issueDate);
    if (!Number.isNaN(d.getTime())) {
      params.set("issueYear", String(d.getFullYear()));
      params.set("issueMonth", String(d.getMonth() + 1));
    }
  }
  return `https://www.linkedin.com/profile/add?${params.toString()}`;
}

export default async function VerifyPage({ params }: Params) {
  const { certificateId } = await params;
  await connectDb();

  const certificate = await Certificate.findOne({
    certificateNumber: certificateId.toUpperCase(),
  });

  if (!certificate || (certificate.status !== "GENERATED" && certificate.status !== "REVOKED")) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg items-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Certificate not found</CardTitle>
            <CardDescription>We could not verify this certificate ID.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const [event, candidate] = await Promise.all([
    Event.findById(certificate.eventId),
    Candidate.findById(certificate.candidateId),
  ]);

  certificate.verificationCount += 1;
  await certificate.save();
  if (event) {
    await Event.findByIdAndUpdate(event._id, { $inc: { verificationCount: 1 } });
  }
  await AuditEvent.create({
    eventId: certificate.eventId,
    certificateId: certificate._id,
    actorType: "PUBLIC",
    action: "certificate.verified.page",
  });

  const revoked = certificate.status === "REVOKED";

  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") || headersList.get("host");
  const proto = headersList.get("x-forwarded-proto") || (host?.includes("localhost") || host?.includes("127.0.0.1") ? "http" : "https");
  const origin = host ? `${proto}://${host}` : undefined;

  const verifyUrl = absoluteUrl(`/verify/${certificate.certificateNumber}`, origin);
  const previewUrl = `/api/public/certificate/${certificate.certificateNumber}/preview`;

  const linkedinAddUrl = !revoked
    ? buildLinkedinAddUrl({
        certificationName:
          event?.linkedinCertificationName || (event?.name ? `${event.name} Certificate` : "Certificate of Completion"),
        organizationId: event?.linkedinOrganizationId || undefined,
        organizationName: event?.organizerName || undefined,
        issueDate: certificate.issuedAt,
        certUrl: verifyUrl,
        certId: certificate.certificateNumber,
      })
    : null;

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Certify Verification</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Official Credential Verification</h1>
      </div>

      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>{revoked ? "Certificate Revoked" : "Certificate Verified"}</CardTitle>
            <Badge variant={revoked ? "warning" : "success"}>{revoked ? "REVOKED" : "VERIFIED"}</Badge>
          </div>
          <CardDescription>
            {revoked
              ? "This certificate has been revoked by the organizer."
              : "This certificate is authentic and registered in the system."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {!revoked && (
            <div className="overflow-hidden rounded-lg border bg-muted/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt={`Certificate ${certificate.certificateNumber}`}
                className="h-auto w-full"
              />
            </div>
          )}

          <div className="space-y-2 text-sm">
            <Row label="Candidate" value={candidate?.name || "—"} />
            <Row label="Event" value={event?.name || "—"} />
            <Row label="Certificate ID" value={certificate.certificateNumber} />
            <Row label="Issued Date" value={formatDate(certificate.issuedAt)} />
            <Row label="Organizer" value={event?.organizerName || "—"} />
            {revoked ? <Row label="Revoked Date" value={formatDate(certificate.revokedAt)} /> : null}
          </div>

          {!revoked && (
            <div className="border-t pt-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button asChild variant="outline" className="w-full h-11 rounded-xl font-medium gap-2 border-slate-300 hover:bg-slate-100 transition-all shadow-sm">
                  <a href={`/api/public/certificate/${certificate.certificateNumber}/download?format=png`} download>
                    <Download className="h-4 w-4 text-indigo-600" />
                    Download PNG
                  </a>
                </Button>
                <Button asChild className="w-full h-11 rounded-xl font-medium gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all">
                  <a href={`/api/public/certificate/${certificate.certificateNumber}/download?format=pdf`} download>
                    <Download className="h-4 w-4" />
                    Download PDF
                  </a>
                </Button>
              </div>

              {linkedinAddUrl && (
                <Button asChild className="w-full h-11 rounded-xl bg-[#0A66C2] text-white hover:bg-[#004182] font-medium shadow-sm transition-all">
                  <a href={linkedinAddUrl} target="_blank" rel="noreferrer">
                    <svg className="mr-2 h-4 w-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                    Add to LinkedIn Profile
                  </a>
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/70 py-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
