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
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-xl flex-col justify-center px-4 py-8 sm:py-12 relative z-10 text-slate-100">
      <div className="mb-10 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-yellow-500 shadow-[0_0_30px_rgba(239,68,68,0.4)] text-white">
          <Award className="h-7 w-7 drop-shadow-md" />
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-yellow-500 drop-shadow-[0_0_10px_rgba(234,179,8,0.8)] mb-3">
          Certify Portal
        </p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl text-white drop-shadow-lg">
          {title}
        </h1>
        <p className="mt-4 text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
          {displaySubtitle}
        </p>
      </div>

      <Card className="shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-red-500/20 bg-black/60 backdrop-blur-xl relative overflow-hidden group">
        {/* Subtle hover glow effect behind the card content */}
        <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-yellow-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
        
        <CardHeader className="pb-5 relative z-10">
          <CardTitle className="text-xl font-bold flex items-center gap-2 text-white">
            <Search className="h-5 w-5 text-red-500" />
            Find your certificate
          </CardTitle>
          <CardDescription className="text-slate-400">
            Enter the email address you used during event registration.
          </CardDescription>
        </CardHeader>
        <CardContent className="relative z-10">
          <form className="space-y-5" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold text-slate-300">Email address</Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-12 pl-4 pr-4 text-base sm:text-sm bg-black/50 border-red-900/40 text-white placeholder:text-slate-600 focus-visible:ring-red-500 focus-visible:border-red-500 transition-all rounded-xl"
                  autoComplete="email"
                />
              </div>
            </div>
            <Button 
              className="w-full h-12 text-sm font-bold shadow-[0_0_20px_rgba(239,68,68,0.3)] bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-yellow-500 text-white transition-all duration-300 rounded-xl uppercase tracking-wider" 
              type="submit" 
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/80 border-t-transparent" />
                  Searching...
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
        <Card className="mt-8 shadow-[0_0_50px_rgba(239,68,68,0.15)] border-red-500/30 bg-black/70 backdrop-blur-2xl animate-in fade-in slide-in-from-bottom-5 duration-500 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-yellow-500 to-red-600" />
          
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                  <Check className="h-5 w-5 text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.8)]" />
                  {certificates.length > 1
                    ? `Certificates Found (${certificates.length})`
                    : "Certificate Found"}
                </CardTitle>
                <CardDescription className="text-sm text-slate-400 mt-1">
                  {certificates.length > 1
                    ? "Multiple certificates are registered with your email. Select one below:"
                    : "Your certificate is ready to download and share."}
                </CardDescription>
              </div>
              {certificates.length > 1 && (
                <Badge variant="outline" className="flex items-center gap-1.5 border-yellow-500/50 text-yellow-400 bg-yellow-500/10 px-3 py-1">
                  <Layers className="h-3.5 w-3.5" />
                  {certificates.length} Total
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Multi-certificate selector tabs if more than 1 certificate exists */}
            {certificates.length > 1 && (
              <div className="space-y-3">
                <Label className="text-xs font-bold tracking-widest uppercase text-slate-500">Select Certificate:</Label>
                <div className="grid gap-2.5">
                  {certificates.map((cert, index) => {
                    const isSelected = index === selectedIndex;
                    return (
                      <button
                        key={cert.certificateNumber}
                        type="button"
                        onClick={() => setSelectedIndex(index)}
                        className={`flex items-center justify-between rounded-xl border p-3.5 text-left transition-all duration-300 ${
                          isSelected
                            ? "border-yellow-500/50 bg-yellow-500/10 shadow-[0_0_15px_rgba(234,179,8,0.15)]"
                            : "border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/10"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${
                              isSelected ? "bg-gradient-to-br from-yellow-400 to-yellow-600 text-black shadow-inner" : "bg-white/10 text-slate-400"
                            }`}
                          >
                            <Award className="h-4.5 w-4.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`font-bold text-sm truncate ${isSelected ? "text-yellow-400" : "text-slate-200"}`}>
                              {cert.eventName}
                            </p>
                            <p className="mt-1 text-xs text-slate-400 flex items-center gap-1.5 truncate font-medium">
                              {cert.role && <span className="text-red-400">{cert.role} •</span>}
                              <span className="font-mono text-[10px] uppercase opacity-80">{cert.certificateNumber}</span>
                            </p>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse shrink-0 ml-3 shadow-[0_0_8px_rgba(234,179,8,1)]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Certificate metadata details */}
            <div className="rounded-xl border border-red-900/30 bg-black/40 p-4 space-y-2 text-sm backdrop-blur-md">
              <div className="grid grid-cols-3 gap-2">
                <span className="text-slate-500 font-medium">Candidate</span>
                <span className="font-bold text-slate-200 col-span-2">{activeCertificate.candidateName}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-slate-500 font-medium">Event</span>
                <span className="font-bold text-slate-200 col-span-2">{activeCertificate.eventName}</span>
              </div>
              {activeCertificate.role && (
                <div className="grid grid-cols-3 gap-2 items-center">
                  <span className="text-slate-500 font-medium">Role</span>
                  <div className="col-span-2">
                    <Badge className="bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30">
                      {activeCertificate.role}
                    </Badge>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                <span className="text-slate-500 font-medium">ID</span>
                <code className="text-xs font-mono font-bold text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 rounded col-span-2 w-fit border border-yellow-500/20">
                  {activeCertificate.certificateNumber}
                </code>
              </div>
            </div>

            {/* Certificate preview */}
            <div className="relative overflow-hidden rounded-xl border border-red-500/20 shadow-[0_0_30px_rgba(0,0,0,0.8)] group">
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 flex items-end justify-center pb-4">
                <p className="text-xs font-bold tracking-widest text-white/80 uppercase">Certificate Preview</p>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activeCertificate.pngUrl}
                alt={`Certificate ${activeCertificate.certificateNumber}`}
                className="h-auto w-full relative z-0 transform group-hover:scale-[1.02] transition-transform duration-700 ease-out"
              />
            </div>

            {/* Download buttons */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <Button asChild variant="outline" className="h-12 border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300 hover:border-red-400 transition-all rounded-xl shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                <a href={downloadUrl(activeCertificate, "png")}>
                  <Download className="mr-2 h-4.5 w-4.5" /> Download PNG
                </a>
              </Button>
              <Button asChild className="h-12 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black font-bold border-none transition-all rounded-xl shadow-[0_0_20px_rgba(234,179,8,0.3)]">
                <a href={downloadUrl(activeCertificate, "pdf")}>
                  <Download className="mr-2 h-4.5 w-4.5" /> Download PDF
                </a>
              </Button>
            </div>

            {/* LinkedIn sharing section */}
            <div className="rounded-2xl border border-blue-500/20 bg-blue-950/20 p-5 space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl" />
              
              <div className="flex items-center gap-3 relative z-10">
                <div className="bg-[#0A66C2] p-2 rounded-lg shadow-[0_0_15px_rgba(10,102,194,0.4)]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                </div>
                <div>
                  <p className="text-base font-bold text-blue-400">LinkedIn Integration</p>
                </div>
              </div>

              <p className="text-sm text-slate-400 leading-relaxed relative z-10">
                Add this credential to your LinkedIn{" "}
                <strong className="text-slate-200">Licenses &amp; Certifications</strong> profile section, or share a post with your network.
              </p>

              <div className="flex flex-col gap-3 sm:flex-row relative z-10">
                <Button asChild className="flex-1 bg-[#0A66C2] text-white hover:bg-[#084e96] h-11 shadow-[0_0_15px_rgba(10,102,194,0.3)] transition-all">
                  <a href={linkedinAddUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Add to Profile
                  </a>
                </Button>

                <Button
                  asChild
                  variant="outline"
                  className="border-[#0A66C2]/40 text-[#0A66C2] hover:bg-[#0A66C2]/20 hover:text-blue-400 h-11 bg-transparent transition-all"
                >
                  <a href={linkedinShareUrl} target="_blank" rel="noreferrer">
                    <Share2 className="mr-2 h-4 w-4" />
                    Share Post
                  </a>
                </Button>
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-blue-900/40 pt-3 relative z-10 mt-2">
                <span className="text-[11px] text-slate-500 font-medium tracking-wide">WANT TO WRITE A CUSTOM POST?</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs font-bold text-[#0A66C2] hover:bg-[#0A66C2]/20 hover:text-blue-400 px-3 rounded-md transition-colors"
                  onClick={() => void copyShareText()}
                >
                  {copiedText ? (
                    <>
                      <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
                      COPIED!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1.5 h-3 w-3" />
                      COPY CAPTION
                    </>
                  )}
                </Button>
              </div>

              {isLocalhost && (
                <p className="text-[11px] text-amber-500/80 bg-amber-950/30 rounded-lg p-3 border border-amber-900/50 mt-4">
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
