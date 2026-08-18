"use client";

import { FormEvent, useState } from "react";
import { 
  ArrowLeft,
  Award, 
  Check, 
  ChevronRight,
  Clock, 
  Copy, 
  Download, 
  ExternalLink, 
  Layers, 
  MessageSquare,
  RefreshCw, 
  Search, 
  Share2, 
  Sparkles, 
  Star,
  User 
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PortalStep = "SEARCH" | "CHOOSE_EVENT" | "FEEDBACK" | "CERTIFICATE";

type FoundCertificate = {
  candidateId: string;
  eventId: string;
  certificateId: string;
  certificateNumber: string;
  candidateName: string;
  candidateEmail?: string;
  candidatePhone?: string;
  role?: string;
  organization?: string;
  department?: string;
  eventName: string;
  eventSlug?: string;
  organizerName?: string;
  eventDate?: string;
  issuedAt?: string;
  pngUrl: string;
  pdfUrl?: string | null;
  linkedinOrganizationId?: string;
  linkedinCertificationName?: string;
  status?: string;
  failureReason?: string | null;
  hasFeedback?: boolean;
  feedback?: { rating: number; remark?: string } | null;
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

export function PortalClient({
  eventSlug,
  eventName = "Certify Portal",
  title,
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
  const [currentStep, setCurrentStep] = useState<PortalStep>("SEARCH");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [candidateInfo, setCandidateInfo] = useState<{ name: string; email: string } | null>(null);
  const [certificates, setCertificates] = useState<FoundCertificate[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [eventData, setEventData] = useState<EventDetails>({
    name: eventName,
    organizerName,
    linkedinOrganizationId,
    linkedinCertificationName,
  });
  const [copiedText, setCopiedText] = useState(false);

  // Feedback Form State
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [remark, setRemark] = useState<string>("");
  const [submittingFeedback, setSubmittingFeedback] = useState<boolean>(false);

  const activeCertificate = certificates[selectedIndex] ?? certificates[0] ?? null;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      toast.error("Please enter your email or phone number.");
      return;
    }

    setLoading(true);
    setCertificates([]);
    setSelectedIndex(0);
    setCandidateInfo(null);

    try {
      const response = await fetch("/api/public/certificate/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(eventSlug ? { eventSlug } : {}),
          query: cleanQuery,
          email: cleanQuery.includes("@") ? cleanQuery : undefined,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No candidate profile found for this identifier.");
      }

      const list: FoundCertificate[] = Array.isArray(data.certificates)
        ? data.certificates
        : data.certificate
        ? [data.certificate]
        : [];

      if (list.length === 0) {
        throw new Error("No certificate records found for this identifying detail.");
      }

      setAccessToken(data.accessToken);
      setCertificates(list);
      setSelectedIndex(0);

      if (data.candidate) {
        setCandidateInfo(data.candidate);
      }

      if (data.event) {
        setEventData({
          name: data.event.name || eventName,
          organizerName: data.event.organizerName || organizerName,
          linkedinOrganizationId: data.event.linkedinOrganizationId ?? linkedinOrganizationId,
          linkedinCertificationName: data.event.linkedinCertificationName ?? linkedinCertificationName,
        });
      }

      // If single event, skip CHOOSE_EVENT step and go straight to feedback/certificate
      if (list.length === 1) {
        const single = list[0];
        setSelectedIndex(0);
        setRating(single.feedback?.rating ?? 5);
        setRemark(single.feedback?.remark ?? "");

        if (single.status === "GENERATED" && single.hasFeedback) {
          setCurrentStep("CERTIFICATE");
        } else {
          setCurrentStep("FEEDBACK");
        }
        toast.success("Registration found!");
      } else {
        // Multiple events -> Show Choose Event screen
        setCurrentStep("CHOOSE_EVENT");
        toast.success(`Found ${list.length} events registered for you!`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  }

  function handleSelectEvent(index: number) {
    setSelectedIndex(index);
    const selectedCert = certificates[index];
    if (!selectedCert) return;

    // Reset feedback form values
    setRating(selectedCert.feedback?.rating ?? 5);
    setRemark(selectedCert.feedback?.remark ?? "");

    // If already has feedback & is generated -> Go directly to Certificate
    if (selectedCert.status === "GENERATED" && selectedCert.hasFeedback) {
      setCurrentStep("CERTIFICATE");
    } else if (selectedCert.status === "GENERATED" && !selectedCert.hasFeedback) {
      // Generated but needs feedback -> Go to Feedback
      setCurrentStep("FEEDBACK");
    } else {
      // Not generated yet -> Stay on choose event / trigger generation, then feedback
      void handleGenerateCertificate(selectedCert, index, true);
    }
  }

  async function handleGenerateCertificate(cert: FoundCertificate, index: number, proceedToFeedback = false) {
    if (!cert || cert.status === "GENERATED" || generatingId) return;

    setGeneratingId(cert.certificateId || cert.candidateId);
    try {
      const response = await fetch("/api/public/certificate/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: cert.eventId,
          candidateId: cert.candidateId,
          email: cert.candidateEmail || query.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to generate certificate");
      }

      if (data.accessToken) {
        setAccessToken(data.accessToken);
      }

      const updated = data.certificate || {};
      setCertificates((prev) => {
        const next = [...prev];
        next[index] = {
          ...next[index],
          ...updated,
          status: "GENERATED",
        };
        return next;
      });
      setSelectedIndex(index);

      toast.success(
        data.alreadyGenerated
          ? "Certificate ready!"
          : "🎉 Certificate successfully generated!"
      );

      if (proceedToFeedback) {
        if (updated.hasFeedback) {
          setCurrentStep("CERTIFICATE");
        } else {
          setCurrentStep("FEEDBACK");
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Generation failed");
    } finally {
      setGeneratingId(null);
    }
  }

  async function handleSubmitFeedback(cert: FoundCertificate, index: number) {
    if (!rating || rating < 1 || rating > 5) {
      toast.error("Please select a rating between 1 and 5 stars.");
      return;
    }
    setSubmittingFeedback(true);
    try {
      const email = cert.candidateEmail || query.trim();
      const res = await fetch("/api/public/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: cert.eventId,
          candidateId: cert.candidateId,
          email,
          rating,
          remark: remark.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit feedback");

      let updatedCert = cert;
      if (cert.status !== "GENERATED") {
        const genRes = await fetch("/api/public/certificate/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId: cert.eventId,
            candidateId: cert.candidateId,
            email,
          }),
        });
        const genData = await genRes.json();
        if (genRes.ok) {
          if (genData.accessToken) setAccessToken(genData.accessToken);
          if (genData.certificate) {
            updatedCert = { ...cert, ...genData.certificate, status: "GENERATED" };
          }
        }
      }

      setCertificates((prev) => {
        const next = [...prev];
        next[index] = {
          ...next[index],
          ...updatedCert,
          status: "GENERATED",
          hasFeedback: true,
          feedback: { rating, remark: remark.trim() },
        };
        return next;
      });

      toast.success("🎉 Thank you for your review! Your certificate is now unlocked.");
      setCurrentStep("CERTIFICATE");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit feedback");
    } finally {
      setSubmittingFeedback(false);
    }
  }

  function downloadUrl(cert: FoundCertificate, format: "png" | "pdf") {
    if (!cert || !accessToken) return "#";
    const params = new URLSearchParams({
      email: cert.candidateEmail || query.trim(),
      token: accessToken,
      format,
    });
    const slug = cert.eventSlug || eventSlug;
    if (slug) params.set("eventSlug", slug);
    return `/api/public/certificate/${cert.certificateNumber}/download?${params.toString()}`;
  }

  const verifyPageUrl = activeCertificate && activeCertificate.status === "GENERATED"
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

  const linkedinAddUrl = activeCertificate && activeCertificate.status === "GENERATED"
    ? buildLinkedinAddUrl({
        certificationName: certificationTitle,
        organizationId: activeOrgId,
        organizationName: activeOrgName,
        issueDate: activeCertificate.issuedAt,
        certUrl: verifyPageUrl,
        certId: activeCertificate.certificateNumber,
      })
    : "";

  const linkedinShareUrl = activeCertificate && activeCertificate.status === "GENERATED"
    ? buildLinkedinShareUrl(verifyPageUrl)
    : "";

  const shareCaption = activeCertificate && activeCertificate.status === "GENERATED"
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
      : "Enter your registration email or phone number to find all your events, check certificate status, and claim your credentials.");

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-2xl flex-col justify-center px-4 py-8 sm:py-12 relative z-10 text-slate-100">
      
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-yellow-500 shadow-[0_0_30px_rgba(239,68,68,0.4)] text-white">
          <Award className="h-7 w-7 drop-shadow-md" />
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-yellow-500 drop-shadow-[0_0_10px_rgba(234,179,8,0.8)] mb-2">
          Candidate Portal
        </p>
        <h1 className="mt-1 text-3xl sm:text-4xl font-extrabold tracking-tight text-white drop-shadow-lg">
          Claim &amp; Verify Certificates
        </h1>
        <p className="mt-2 text-sm text-slate-400 max-w-lg mx-auto">
          {displaySubtitle}
        </p>
      </div>

      {/* Step Process Indicator Pills */}
      {certificates.length > 0 && (
        <div className="mb-6 flex items-center justify-center gap-1.5 sm:gap-2 text-[11px] font-bold">
          <button
            type="button"
            onClick={() => setCurrentStep("SEARCH")}
            className={`px-3 py-1 rounded-full border transition-all flex items-center gap-1.5 ${
              currentStep === "SEARCH"
                ? "border-yellow-500 bg-yellow-500/20 text-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.3)]"
                : "border-white/10 bg-white/5 text-slate-400 hover:text-white"
            }`}
          >
            <Search className="h-3 w-3" />
            1. Search
          </button>
          
          {certificates.length > 1 && (
            <>
              <ChevronRight className="h-3 w-3 text-slate-600" />
              <button
                type="button"
                onClick={() => setCurrentStep("CHOOSE_EVENT")}
                className={`px-3 py-1 rounded-full border transition-all flex items-center gap-1.5 ${
                  currentStep === "CHOOSE_EVENT"
                    ? "border-yellow-500 bg-yellow-500/20 text-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.3)]"
                    : "border-white/10 bg-white/5 text-slate-400 hover:text-white"
                }`}
              >
                <Layers className="h-3 w-3" />
                2. Choose Event
              </button>
            </>
          )}

          <ChevronRight className="h-3 w-3 text-slate-600" />
          <button
            type="button"
            disabled={!activeCertificate}
            onClick={() => activeCertificate && setCurrentStep("FEEDBACK")}
            className={`px-3 py-1 rounded-full border transition-all flex items-center gap-1.5 ${
              currentStep === "FEEDBACK"
                ? "border-yellow-500 bg-yellow-500/20 text-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.3)]"
                : "border-white/10 bg-white/5 text-slate-400 hover:text-white"
            }`}
          >
            <Star className="h-3 w-3" />
            {certificates.length > 1 ? "3. Feedback" : "2. Feedback"}
          </button>

          <ChevronRight className="h-3 w-3 text-slate-600" />
          <button
            type="button"
            disabled={!activeCertificate || !activeCertificate.hasFeedback}
            onClick={() => activeCertificate?.hasFeedback && setCurrentStep("CERTIFICATE")}
            className={`px-3 py-1 rounded-full border transition-all flex items-center gap-1.5 ${
              currentStep === "CERTIFICATE"
                ? "border-yellow-500 bg-yellow-500/20 text-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.3)]"
                : "border-white/10 bg-white/5 text-slate-400 hover:text-white"
            }`}
          >
            <Award className="h-3 w-3" />
            {certificates.length > 1 ? "4. Certificate" : "3. Certificate"}
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 1: SEARCH FORM */}
      {/* ========================================================================= */}
      {currentStep === "SEARCH" && (
        <Card className="shadow-[0_0_50px_rgba(0,0,0,0.8)] border-red-500/20 bg-black/60 backdrop-blur-xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
          <CardHeader className="relative z-10 pb-4">
            <CardTitle className="text-xl font-bold flex items-center gap-2 text-white">
              <Search className="h-5 w-5 text-red-500" />
              Find your profile &amp; certificates
            </CardTitle>
            <CardDescription className="text-slate-400 text-sm">
              Enter the email address or phone number you used during event registration.
            </CardDescription>
          </CardHeader>
          <CardContent className="relative z-10">
            <form className="space-y-5" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="search-query" className="text-sm font-semibold text-slate-300">
                  Registration Email or Phone
                </Label>
                <Input
                  id="search-query"
                  type="text"
                  required
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="you@example.com or phone number"
                  className="h-12 pl-4 pr-4 text-base sm:text-sm bg-black/50 border-red-900/40 text-white placeholder:text-slate-600 focus-visible:ring-red-500 focus-visible:border-red-500 transition-all rounded-xl"
                  autoComplete="email"
                />
              </div>
              <Button 
                className="w-full h-12 text-sm font-bold shadow-[0_0_20px_rgba(239,68,68,0.3)] bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-yellow-500 text-white transition-all duration-300 rounded-xl uppercase tracking-wider" 
                type="submit" 
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/80 border-t-transparent" />
                    Searching Candidate Records...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    Search Across All Events
                  </span>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: CHOOSE EVENT */}
      {/* ========================================================================= */}
      {currentStep === "CHOOSE_EVENT" && certificates.length > 1 && (
        <Card className="shadow-[0_0_50px_rgba(239,68,68,0.15)] border-red-500/30 bg-black/70 backdrop-blur-2xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-yellow-500 to-red-600" />
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                  <Check className="h-5 w-5 text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.8)]" />
                  {candidateInfo?.name ? `Candidate: ${candidateInfo.name}` : "Your Registered Events"}
                </CardTitle>
                <CardDescription className="text-sm text-slate-400 mt-1">
                  Choose an event below to proceed with feedback &amp; certificate claim:
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentStep("SEARCH")}
                className="text-xs text-slate-400 hover:text-white hover:bg-white/10 w-fit"
              >
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                Change Search
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid gap-3">
              {certificates.map((cert, index) => {
                const isGenerated = cert.status === "GENERATED";
                const isGenerating = cert.status === "GENERATING" || generatingId === (cert.certificateId || cert.candidateId);
                const hasFeedback = cert.hasFeedback;

                return (
                  <div
                    key={cert.certificateId || `${cert.eventId}-${cert.candidateId}`}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-yellow-500/40 p-3.5 sm:p-4 transition-all duration-200 gap-3 group overflow-hidden"
                  >
                    <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                      <div
                        className={`flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${
                          isGenerated
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        }`}
                      >
                        <Award className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm sm:text-base text-slate-100 group-hover:text-yellow-400 transition-colors line-clamp-2 leading-snug break-words">
                            {cert.eventName}
                          </h4>
                          {cert.role && (
                            <Badge variant="muted" className="bg-white/10 text-[10px] sm:text-[11px] text-slate-300 shrink-0">
                              {cert.role}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 flex flex-wrap items-center gap-1.5 font-medium">
                          <span className="truncate max-w-[180px]">{cert.organizerName || "Official Organizer"}</span>
                          {cert.eventDate && (
                            <>
                              <span>•</span>
                              <span className="shrink-0">{new Date(cert.eventDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                      {isGenerated ? (
                        hasFeedback ? (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs px-2.5 py-1 hidden sm:inline-flex shrink-0">
                            ✓ Ready
                          </Badge>
                        ) : (
                          <Badge className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 text-xs px-2.5 py-1 hidden sm:inline-flex shrink-0">
                            ⭐ Rating Pending
                          </Badge>
                        )
                      ) : (
                        <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-xs px-2.5 py-1 hidden sm:inline-flex shrink-0">
                          ⚡ Not Generated
                        </Badge>
                      )}

                      <Button
                        size="sm"
                        type="button"
                        disabled={isGenerating}
                        onClick={() => handleSelectEvent(index)}
                        className={`h-9 px-3 sm:px-4 font-bold text-xs transition-all rounded-lg shrink-0 whitespace-nowrap ${
                          !isGenerated
                            ? "bg-gradient-to-r from-red-600 via-yellow-500 to-amber-500 hover:from-red-500 hover:to-amber-400 text-black shadow-[0_0_20px_rgba(234,179,8,0.35)]"
                            : hasFeedback
                            ? "bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                            : "bg-gradient-to-r from-yellow-500 to-amber-400 hover:from-yellow-400 hover:to-amber-300 text-black shadow-[0_0_15px_rgba(234,179,8,0.3)]"
                        }`}
                      >
                        {isGenerating ? (
                          <span className="flex items-center gap-1.5">
                            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black border-t-transparent" />
                            <span>Generating...</span>
                          </span>
                        ) : !isGenerated ? (
                          <span className="flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5" />
                            <span>Generate <span className="hidden sm:inline">Certificate</span></span>
                          </span>
                        ) : !hasFeedback ? (
                          <span className="flex items-center gap-1">
                            <span>Rate &amp; Claim</span> <ChevronRight className="h-3.5 w-3.5" />
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <span>View Certificate</span> <ChevronRight className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* STEP 3: FEEDBACK (5-Star Rating & Remark) */}
      {/* ========================================================================= */}
      {currentStep === "FEEDBACK" && activeCertificate && (
        <Card className="shadow-[0_0_50px_rgba(234,179,8,0.2)] border-yellow-500/40 bg-black/80 backdrop-blur-2xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="absolute top-0 right-0 w-36 h-36 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />

          <CardHeader className="pb-3 border-b border-white/10">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentStep(certificates.length > 1 ? "CHOOSE_EVENT" : "SEARCH")}
                className="text-xs text-slate-400 hover:text-white hover:bg-white/10 -ml-2"
              >
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                {certificates.length > 1 ? "Back to Events" : "Search Again"}
              </Button>
              <Badge className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 text-xs">
                {certificates.length > 1 ? "Step 3 of 4: Event Review" : "Step 2 of 3: Event Review"}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="pt-6 space-y-6 text-center">
            <div className="space-y-2">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-500/30 to-amber-600/20 text-yellow-400 border border-yellow-500/40 shadow-[0_0_20px_rgba(234,179,8,0.25)] mb-2">
                <Star className="h-7 w-7 fill-yellow-400 text-yellow-400 animate-pulse" />
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">
                Rate Your Experience
              </h2>
              <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                Please rate and review <strong className="text-yellow-400">{activeCertificate.eventName}</strong> to unlock and view your certificate.
              </p>
            </div>

            {/* Interactive 5-Star Selector */}
            <div className="space-y-2.5 py-3">
              <div className="flex items-center justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => {
                  const active = (hoverRating ?? rating) >= star;
                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(null)}
                      className="p-1.5 transition-transform hover:scale-125 focus:outline-none"
                      aria-label={`Rate ${star} stars`}
                    >
                      <Star
                        className={`h-11 w-11 transition-all duration-200 ${
                          active
                            ? "fill-yellow-400 text-yellow-400 drop-shadow-[0_0_14px_rgba(250,204,21,0.9)]"
                            : "text-slate-600 hover:text-slate-400"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
              <p className="text-xs font-bold text-yellow-400 tracking-wider uppercase">
                {(hoverRating === 1 || (!hoverRating && rating === 1)) && "1 Star — Needs Improvement"}
                {(hoverRating === 2 || (!hoverRating && rating === 2)) && "2 Stars — Fair Experience"}
                {(hoverRating === 3 || (!hoverRating && rating === 3)) && "3 Stars — Good"}
                {(hoverRating === 4 || (!hoverRating && rating === 4)) && "4 Stars — Very Good"}
                {(hoverRating === 5 || (!hoverRating && rating === 5)) && "5 Stars — Outstanding & Exceptional! ⭐"}
              </p>
            </div>

            {/* Remarks / Review Textarea */}
            <div className="space-y-2 text-left">
              <div className="flex items-center justify-between">
                <Label htmlFor="candidate-remark" className="text-xs font-bold text-slate-200">
                  Remark / Feedback
                </Label>
                <span className="text-[11px] text-slate-500 font-medium">(Optional)</span>
              </div>
              <textarea
                id="candidate-remark"
                rows={3}
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="Share your thoughts about the sessions, speakers, or overall event..."
                className="w-full rounded-xl border border-red-500/30 bg-black/60 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500 transition-colors resize-none"
              />
            </div>

            {/* Submit Button */}
            <Button
              size="lg"
              type="button"
              disabled={submittingFeedback}
              onClick={() => void handleSubmitFeedback(activeCertificate, selectedIndex)}
              className="w-full h-12 bg-gradient-to-r from-red-600 via-yellow-500 to-amber-500 hover:from-red-500 hover:to-amber-400 text-black font-black text-sm shadow-[0_0_25px_rgba(234,179,8,0.4)] transition-all rounded-xl uppercase tracking-wider"
            >
              {submittingFeedback ? (
                <span className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                  Submitting Feedback &amp; Unlocking Certificate...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  {activeCertificate.status !== "GENERATED"
                    ? "Submit Feedback & Generate Certificate"
                    : "Submit Feedback & View Certificate"}
                </span>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* STEP 4: CERTIFICATE (Preview, Download, LinkedIn) */}
      {/* ========================================================================= */}
      {currentStep === "CERTIFICATE" && activeCertificate && (
        <Card className="shadow-[0_0_50px_rgba(239,68,68,0.15)] border-red-500/30 bg-black/70 backdrop-blur-2xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-yellow-500 to-red-600" />
          
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentStep(certificates.length > 1 ? "CHOOSE_EVENT" : "SEARCH")}
                className="text-xs text-slate-400 hover:text-white hover:bg-white/10 -ml-2"
              >
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                {certificates.length > 1
                  ? `Back to All Events (${certificates.length})`
                  : "Search Another Profile"}
              </Button>
              <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs">
                ✓ Certificate Unlocked
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Candidate & Event Metadata Box */}
            <div className="rounded-xl border border-red-900/30 bg-black/40 p-4 space-y-2.5 text-sm backdrop-blur-md">
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
                    <Badge className="bg-red-500/20 text-red-400 border border-red-500/30">
                      {activeCertificate.role}
                    </Badge>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                <span className="text-slate-500 font-medium">Certificate ID</span>
                <code className="text-xs font-mono font-bold text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded col-span-2 w-fit border border-yellow-500/20">
                  {activeCertificate.certificateNumber}
                </code>
              </div>
            </div>

            {/* Rating Summary Pill */}
            <div className="flex items-center justify-between rounded-xl border border-yellow-500/30 bg-yellow-950/20 px-4 py-2.5 text-xs text-yellow-300 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <div className="flex items-center text-yellow-400">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-3.5 w-3.5 ${
                        i < (activeCertificate.feedback?.rating ?? 5)
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-slate-600"
                      }`}
                    />
                  ))}
                </div>
                <span className="font-bold">
                  Your Rating: {activeCertificate.feedback?.rating ?? 5}/5 Stars
                </span>
              </div>
              {activeCertificate.feedback?.remark && (
                <span className="truncate max-w-[200px] text-slate-400 italic">
                  &ldquo;{activeCertificate.feedback.remark}&rdquo;
                </span>
              )}
            </div>

            {/* Certificate Preview Image */}
            <div className="relative overflow-hidden rounded-xl border border-red-500/20 shadow-[0_0_30px_rgba(0,0,0,0.8)] group min-h-[16rem]">
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

            {/* Download PNG & PDF Buttons */}
            <div className="grid grid-cols-2 gap-4 pt-1">
              <Button 
                asChild={!!activeCertificate.pngUrl} 
                variant="outline" 
                className="h-12 border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300 hover:border-red-400 transition-all rounded-xl shadow-[0_0_15px_rgba(239,68,68,0.1)] font-semibold"
              >
                <a href={downloadUrl(activeCertificate, "png")}>
                  <Download className="mr-2 h-4.5 w-4.5" /> Download PNG
                </a>
              </Button>
              <Button 
                asChild={!!activeCertificate.pdfUrl} 
                className="h-12 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black font-bold border-none transition-all rounded-xl shadow-[0_0_20px_rgba(234,179,8,0.3)]"
              >
                <a href={downloadUrl(activeCertificate, "pdf")}>
                  <Download className="mr-2 h-4.5 w-4.5" /> Download PDF
                </a>
              </Button>
            </div>

            {/* LinkedIn Integration Section */}
            <div className="rounded-2xl border border-blue-500/20 bg-blue-950/20 p-5 space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
              
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
                <Button asChild className="flex-1 bg-[#0A66C2] text-white hover:bg-[#084e96] h-11 shadow-[0_0_15px_rgba(10,102,194,0.3)] transition-all font-semibold">
                  <a href={linkedinAddUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Add to Profile
                  </a>
                </Button>

                <Button
                  asChild
                  variant="outline"
                  className="border-[#0A66C2]/40 text-[#0A66C2] hover:bg-[#0A66C2]/20 hover:text-blue-400 h-11 bg-transparent transition-all font-semibold"
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
                  <code>localhost:3000</code>. On a live domain, LinkedIn will automatically display
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

export const PublicPortalClient = PortalClient;
