"use client";

import { FormEvent, useState } from "react";
import { Check, Copy, Download, ExternalLink, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FoundCertificate = {
  certificateNumber: string;
  candidateName: string;
  eventName: string;
  issuedAt?: string;
  pngUrl: string;
  pdfUrl?: string | null;
};

/** Build the LinkedIn "Add to Profile" deep-link URL */
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
  issueDate?: string;
  certUrl: string;
  certId: string;
}): string {
  const params = new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: certificationName,
    certUrl,
    certId,
  });

  if (organizationId?.trim()) {
    params.set("organizationId", organizationId.trim());
  }
  if (organizationName?.trim()) {
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

/** Build a generic LinkedIn share URL (posts the verify page link) */
function buildLinkedinShareUrl(verifyUrl: string): string {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(verifyUrl)}`;
}

export function PublicPortalClient({
  eventSlug,
  eventName,
  organizerName = "",
  linkedinOrganizationId = "",
  linkedinCertificationName = "",
}: {
  eventSlug: string;
  eventName: string;
  organizerName?: string;
  linkedinOrganizationId?: string;
  linkedinCertificationName?: string;
}) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [certificate, setCertificate] = useState<FoundCertificate | null>(null);
  const [copiedText, setCopiedText] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setCertificate(null);
    try {
      const response = await fetch("/api/public/certificate/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventSlug, email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No certificate found for this email.");
      setAccessToken(data.accessToken);
      setCertificate(data.certificate);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  }

  function downloadUrl(format: "png" | "pdf") {
    if (!certificate || !accessToken) return "#";
    const params = new URLSearchParams({
      eventSlug,
      email,
      token: accessToken,
      format,
    });
    return `/api/public/certificate/${certificate.certificateNumber}/download?${params.toString()}`;
  }

  // LinkedIn URLs
  const verifyPageUrl = certificate
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/verify/${certificate.certificateNumber}`
    : "";

  const certificationTitle =
    linkedinCertificationName.trim() ||
    (certificate ? `${certificate.eventName} Certificate` : `${eventName} Certificate`);

  const linkedinAddUrl = certificate
    ? buildLinkedinAddUrl({
        certificationName: certificationTitle,
        organizationId: linkedinOrganizationId,
        organizationName: organizerName,
        issueDate: certificate.issuedAt,
        certUrl: verifyPageUrl,
        certId: certificate.certificateNumber,
      })
    : "";

  const linkedinShareUrl = certificate ? buildLinkedinShareUrl(verifyPageUrl) : "";

  const shareCaption = certificate
    ? `🎓 Excited to share that I have received my certificate for ${certificate.eventName}!\n\nVerify credential: ${verifyPageUrl}\n\n#certification #achievement #learning`
    : "";

  async function copyShareText() {
    if (!shareCaption) return;
    try {
      await navigator.clipboard.writeText(shareCaption);
      setCopiedText(true);
      toast.success("LinkedIn post caption copied to clipboard!");
      setTimeout(() => setCopiedText(false), 2500);
    } catch {
      toast.error("Failed to copy caption");
    }
  }

  const isLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Certify</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Download your certificate</h1>
        <p className="mt-2 text-sm text-muted-foreground">{eventName}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Find certificate</CardTitle>
          <CardDescription>Enter the email address used during registration.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? "Searching..." : "Find Certificate"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {certificate ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Certificate Found</CardTitle>
            <CardDescription>Your certificate is ready to download.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1 text-sm">
              <p>
                <span className="text-muted-foreground">Candidate:</span> {certificate.candidateName}
              </p>
              <p>
                <span className="text-muted-foreground">Event:</span> {certificate.eventName}
              </p>
              <p>
                <span className="text-muted-foreground">Certificate ID:</span> {certificate.certificateNumber}
              </p>
            </div>

            {/* Certificate preview */}
            <div className="overflow-hidden rounded-lg border bg-muted/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={certificate.pngUrl} alt="Certificate preview" className="h-auto w-full" />
            </div>

            {/* Download buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button asChild variant="outline">
                <a href={downloadUrl("png")}>
                  <Download className="mr-2 h-4 w-4" /> Download PNG
                </a>
              </Button>
              <Button asChild>
                <a href={downloadUrl("pdf")}>
                  <Download className="mr-2 h-4 w-4" /> Download PDF
                </a>
              </Button>
            </div>

            {/* LinkedIn sharing section */}
            <div className="rounded-xl border border-blue-100 bg-[#f4f8fe] p-4 space-y-3.5">
              <div className="flex items-center gap-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#0A66C2" aria-hidden="true">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-[#0A66C2]">LinkedIn Integration</p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Add this credential to your LinkedIn <strong>Licenses &amp; Certifications</strong> profile section, or share a post with your network.
              </p>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  asChild
                  className="flex-1 bg-[#0A66C2] text-white hover:bg-[#004182]"
                >
                  <a href={linkedinAddUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Add to Profile
                  </a>
                </Button>

                <Button
                  asChild
                  variant="outline"
                  className="border-[#0A66C2]/30 text-[#0A66C2] hover:bg-[#0A66C2]/10"
                >
                  <a href={linkedinShareUrl} target="_blank" rel="noreferrer">
                    <Share2 className="mr-2 h-4 w-4" />
                    Share Post
                  </a>
                </Button>
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-blue-200/60 pt-2.5">
                <span className="text-[11px] text-muted-foreground">
                  Want to write a custom post?
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-[#0A66C2] hover:bg-[#0A66C2]/10 px-2"
                  onClick={() => void copyShareText()}
                >
                  {copiedText ? (
                    <>
                      <Check className="mr-1 h-3 w-3 text-emerald-600" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1 h-3 w-3" />
                      Copy Post Caption
                    </>
                  )}
                </Button>
              </div>

              {isLocalhost && (
                <p className="text-[11px] text-amber-700 bg-amber-50 rounded p-2 border border-amber-200">
                  📌 <strong>Note for localhost:</strong> LinkedIn web crawlers cannot fetch images/previews from <code>localhost:3000</code>. On a live domain (production or ngrok), LinkedIn will automatically display the certificate card. <strong>&ldquo;Add to Profile&rdquo;</strong> works immediately!
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
