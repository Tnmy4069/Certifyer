"use client";

import { FormEvent, useState } from "react";
import { Award, Check, Copy, Download, ExternalLink, Layers, Search, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FoundCertificate = {
  certificateNumber: string;
  candidateName: string;
  role?: string;
  organization?: string;
  department?: string;
  eventName: string;
  eventSlug?: string;
  organizerName?: string;
  issuedAt?: string;
  pngUrl: string;
  pdfUrl?: string | null;
  linkedinOrganizationId?: string;
  linkedinCertificationName?: string;
};

type EventDetails = {
  name: string;
  organizerName: string;
  linkedinOrganizationId: string;
  linkedinCertificationName: string;
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

/** Build a generic LinkedIn share URL (posts the verify page link) */
function buildLinkedinShareUrl(verifyUrl: string): string {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(verifyUrl)}`;
}

export function PublicPortalClient({
  eventSlug,
  eventName = "Official Certificate Portal",
  title = "Download your certificate",
  subtitle,
  organizerName = "",
  linkedinOrganizationId = "",
  linkedinCertificationName = "",
}: {
  eventSlug?: string;
  eventName?: string;
  title?: string;
  subtitle?: string;
  organizerName?: string;
  linkedinOrganizationId?: string;
  linkedinCertificationName?: string;
}) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [certificates, setCertificates] = useState<FoundCertificate[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [eventData, setEventData] = useState<EventDetails>({
    name: eventName,
    organizerName,
    linkedinOrganizationId,
    linkedinCertificationName,
  });
  const [copiedText, setCopiedText] = useState(false);

  const activeCertificate = certificates[selectedIndex] ?? certificates[0] ?? null;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setCertificates([]);
    setSelectedIndex(0);
    try {
      const response = await fetch("/api/public/certificate/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(eventSlug ? { eventSlug } : {}),
          email: email.trim(),
        }),
      });
      const data = await response.json();

      if (response.status === 202) {
        toast.info(data.message || "Your certificates are being generated. Please wait a moment.");
        return;
      }

      if (!response.ok) throw new Error(data.error || "No certificate found for this email.");

      const list: FoundCertificate[] = Array.isArray(data.certificates)
        ? data.certificates
        : data.certificate
        ? [data.certificate]
        : [];

      if (list.length === 0) {
        throw new Error("No certificate found for this email.");
      }

      setAccessToken(data.accessToken);
      setCertificates(list);
      setSelectedIndex(0);

      if (data.event) {
        setEventData({
          name: data.event.name || eventName,
          organizerName: data.event.organizerName || organizerName,
          linkedinOrganizationId: data.event.linkedinOrganizationId ?? linkedinOrganizationId,
          linkedinCertificationName: data.event.linkedinCertificationName ?? linkedinCertificationName,
        });
      }

      if (list.length > 1) {
        toast.success(`Found ${list.length} certificates for your email!`);
      } else {
        toast.success("Certificate found!");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  }

  function downloadUrl(cert: FoundCertificate, format: "png" | "pdf") {
    if (!cert || !accessToken) return "#";
    const params = new URLSearchParams({
      email: email.trim(),
      token: accessToken,
      format,
    });
    const slug = cert.eventSlug || eventSlug;
    if (slug) params.set("eventSlug", slug);
    return `/api/public/certificate/${cert.certificateNumber}/download?${params.toString()}`;
  }

  const verifyPageUrl = activeCertificate
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/verify/${activeCertificate.certificateNumber}`
    : "";

  const certificationTitle =
    activeCertificate?.linkedinCertificationName?.trim() ||
    eventData.linkedinCertificationName?.trim() ||
    (activeCertificate
      ? activeCertificate.role
        ? `${activeCertificate.eventName} - ${activeCertificate.role}`
        : `${activeCertificate.eventName} Certificate`
      : `${eventName} Certificate`);

  const activeOrgId =
    activeCertificate?.linkedinOrganizationId || eventData.linkedinOrganizationId;
  const activeOrgName =
    activeCertificate?.organizerName || eventData.organizerName || organizerName;

  const linkedinAddUrl = activeCertificate
    ? buildLinkedinAddUrl({
        certificationName: certificationTitle,
        organizationId: activeOrgId,
        organizationName: activeOrgName,
        issueDate: activeCertificate.issuedAt,
        certUrl: verifyPageUrl,
        certId: activeCertificate.certificateNumber,
      })
    : "";

  const linkedinShareUrl = activeCertificate ? buildLinkedinShareUrl(verifyPageUrl) : "";

  const shareCaption = activeCertificate
    ? `🎓 Excited to share that I have received my certificate for ${activeCertificate.eventName}${
        activeCertificate.role ? ` (${activeCertificate.role})` : ""
      }!\n\nVerify credential: ${verifyPageUrl}\n\n#certification #achievement #learning`
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

  const displaySubtitle =
    subtitle ??
    (eventSlug
      ? eventName
      : "Enter your registration email to find, download, and verify your credentials.");

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-xl flex-col justify-center px-4 py-8 sm:py-12">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary shadow-md shadow-primary/20 text-lg font-bold text-primary-foreground">
          <Award className="h-6 w-6" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary/80">Certify Portal</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">{displaySubtitle}</p>
      </div>

      <Card className="shadow-lg border-border/80 bg-card/90 backdrop-blur">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            Find your certificate
          </CardTitle>
          <CardDescription>
            Enter the email address you used during event registration.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-medium">Email address</Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-11 pl-3.5 pr-4 text-base sm:text-sm"
                  autoComplete="email"
                />
              </div>
            </div>
            <Button className="w-full h-11 text-sm font-medium shadow" type="submit" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Searching &amp; Generating...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Find Certificate
                </span>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {certificates.length > 0 && activeCertificate && (
        <Card className="mt-6 shadow-xl border-primary/20 animate-in fade-in slide-in-from-bottom-3 duration-300">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg font-semibold">
                  {certificates.length > 1
                    ? `Certificates Found (${certificates.length})`
                    : "Certificate Found"}
                </CardTitle>
                <CardDescription className="text-xs">
                  {certificates.length > 1
                    ? "Multiple certificates are registered with your email. Select one below:"
                    : "Your certificate is ready to download and share."}
                </CardDescription>
              </div>
              {certificates.length > 1 && (
                <Badge variant="muted" className="flex items-center gap-1">
                  <Layers className="h-3 w-3" />
                  {certificates.length} Total
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Multi-certificate selector tabs if more than 1 certificate exists */}
            {certificates.length > 1 && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground">Select Certificate:</Label>
                <div className="grid gap-2">
                  {certificates.map((cert, index) => {
                    const isSelected = index === selectedIndex;
                    return (
                      <button
                        key={cert.certificateNumber}
                        type="button"
                        onClick={() => setSelectedIndex(index)}
                        className={`flex items-center justify-between rounded-lg border p-3 text-left text-sm transition-all ${
                          isSelected
                            ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm"
                            : "border-border bg-card hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                              isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                            }`}
                          >
                            <Award className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-xs sm:text-sm truncate">
                              {cert.eventName}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1.5 truncate">
                              {cert.role && <span className="font-medium text-primary">{cert.role} ·</span>}
                              <span className="font-mono text-[11px]">{cert.certificateNumber}</span>
                            </p>
                          </div>
                        </div>
                        {isSelected && (
                          <Badge variant="default" className="text-[10px] shrink-0 ml-2">
                            Selected
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Certificate metadata details */}
            <div className="rounded-lg border bg-muted/20 p-3.5 space-y-1.5 text-sm">
              <div>
                <span className="text-muted-foreground">Candidate:</span>{" "}
                <span className="font-medium">{activeCertificate.candidateName}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Event:</span>{" "}
                <span className="font-medium">{activeCertificate.eventName}</span>
              </div>
              {activeCertificate.role && (
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Role / Category:</span>
                  <Badge variant="outline" className="text-xs font-normal">
                    {activeCertificate.role}
                  </Badge>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Certificate ID:</span>{" "}
                <code className="text-xs font-mono font-semibold">{activeCertificate.certificateNumber}</code>
              </div>
            </div>

            {/* Certificate preview */}
            <div className="overflow-hidden rounded-lg border bg-muted/30 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activeCertificate.pngUrl}
                alt={`Certificate ${activeCertificate.certificateNumber}`}
                className="h-auto w-full"
              />
            </div>

            {/* Download buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button asChild variant="outline" className="h-10">
                <a href={downloadUrl(activeCertificate, "png")}>
                  <Download className="mr-2 h-4 w-4" /> Download PNG
                </a>
              </Button>
              <Button asChild className="h-10">
                <a href={downloadUrl(activeCertificate, "pdf")}>
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
                Add this credential ({activeCertificate.role || activeCertificate.eventName}) to your LinkedIn{" "}
                <strong>Licenses &amp; Certifications</strong> profile section, or share a post with your network.
              </p>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button asChild className="flex-1 bg-[#0A66C2] text-white hover:bg-[#004182] h-9">
                  <a href={linkedinAddUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Add to Profile
                  </a>
                </Button>

                <Button
                  asChild
                  variant="outline"
                  className="border-[#0A66C2]/30 text-[#0A66C2] hover:bg-[#0A66C2]/10 h-9"
                >
                  <a href={linkedinShareUrl} target="_blank" rel="noreferrer">
                    <Share2 className="mr-2 h-4 w-4" />
                    Share Post
                  </a>
                </Button>
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-blue-200/60 pt-2.5">
                <span className="text-[11px] text-muted-foreground">Want to write a custom post?</span>
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
                  📌 <strong>Note for localhost:</strong> LinkedIn web crawlers cannot fetch images/previews from{" "}
                  <code>localhost:3000</code>. On a live domain (production or ngrok), LinkedIn will automatically display
                  the certificate card. <strong>&ldquo;Add to Profile&rdquo;</strong> works immediately!
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
