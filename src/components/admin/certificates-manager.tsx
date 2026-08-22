"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Mail, Send, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EventNav } from "@/components/admin/event-nav";
import { EventSetupStepper } from "@/components/admin/event-setup-stepper";
import { Progress } from "@/components/ui/progress";

type CertificateRow = {
  id: string;
  certificateNumber: string;
  status: string;
  issuedAt?: string;
  downloadCount: number;
  failureReason?: string | null;
  candidate: { id: string; name: string; email: string } | null;
  pngUrl?: string | null;
  pdfUrl?: string | null;
};

type BatchProgress = {
  id: string;
  status: string;
  total: number;
  completed: number;
  failed: number;
  percent: number;
};

function statusVariant(status: string): "success" | "destructive" | "warning" | "muted" | "outline" {
  if (status === "GENERATED") return "success";
  if (status === "FAILED") return "destructive";
  if (status === "REVOKED") return "warning";
  if (status === "GENERATING") return "muted";
  return "outline";
}

export function CertificatesManager({ eventId, setup = false }: { eventId: string; setup?: boolean }) {
  const [certificates, setCertificates] = useState<CertificateRow[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  // Track which cert IDs are currently being actioned
  const [actioning, setActioning] = useState<Set<string>>(new Set());
  const [batch, setBatch] = useState<BatchProgress | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [notifyingIds, setNotifyingIds] = useState<Set<string>>(new Set());
  const [notifyResult, setNotifyResult] = useState<{ sent: number; failed: number; skipped: number } | null>(null);
  const [smtpReady, setSmtpReady] = useState<boolean | null>(null); // null = loading

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    const response = await fetch(`/api/events/${eventId}/certificates?${params.toString()}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Failed to load certificates");
    setCertificates(data.certificates);
  }, [eventId, q, status]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await load();
      } catch (error) {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  // Fetch SMTP/notify status on mount
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/events/${eventId}/notify`);
        const data = await res.json();
        if (res.ok) setSmtpReady(data.smtpConfigured ?? false);
      } catch {
        setSmtpReady(false);
      }
    })();
  }, [eventId]);

  const notGeneratedCount = useMemo(
    () => certificates.filter((c) => c.status === "NOT_GENERATED" || c.status === "PENDING").length,
    [certificates]
  );
  const failedCount = useMemo(
    () => certificates.filter((c) => c.status === "FAILED").length,
    [certificates]
  );

  async function refreshBatch() {
    const response = await fetch(`/api/events/${eventId}/generate`);
    const data = await response.json();
    if (response.ok) setBatch(data.batch ?? null);
    return (data.batch ?? null) as BatchProgress | null;
  }

  async function runQueue(initial: BatchProgress | null) {
    let current = initial;
    let idle = 0;
    while (current && current.status !== "COMPLETED" && current.status !== "FAILED") {
      const tickResponse = await fetch("/api/worker/tick", { method: "POST" });
      const tickData = await tickResponse.json();
      current = await refreshBatch();
      if (!tickData.processed) idle += 1;
      else idle = 0;
      if (idle >= 6) break;
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
    await load();
  }

  async function startBulk(onlyFailed: boolean) {
    setBulkBusy(true);
    try {
      const response = await fetch(`/api/events/${eventId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onlyFailed }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not start generation");
      setBatch(data.batch ?? null);
      toast.success(onlyFailed ? "Retrying failed certificates" : "Bulk generation started");
      await runQueue(data.batch ?? null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start generation");
    } finally {
      setBulkBusy(false);
    }
  }

  async function sendNotify(onlyNew: boolean) {
    setNotifyBusy(true);
    setNotifyResult(null);
    try {
      const response = await fetch(`/api/events/${eventId}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onlyNew }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to send emails");
      setNotifyResult({ sent: data.sent, failed: data.failed, skipped: data.skipped });
      if (data.sent > 0) toast.success(`${data.sent} email${data.sent === 1 ? "" : "s"} sent successfully`);
      if (data.failed > 0) toast.error(`${data.failed} email${data.failed === 1 ? "" : "s"} failed to send`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send emails");
    } finally {
      setNotifyBusy(false);
    }
  }

  async function sendNotifyOne(cert: CertificateRow) {
    if (!cert.candidate) return;
    setNotifyingIds((prev) => new Set(prev).add(cert.id));
    try {
      const response = await fetch(`/api/events/${eventId}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId: cert.candidate.id, onlyNew: false }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to send email");
      if (data.sent > 0) toast.success(`Email sent to ${cert.candidate.email}`);
      else if (data.failed > 0) toast.error(`Failed to send email to ${cert.candidate.email}`);
      else toast.info(`No email sent — certificate may not be generated yet`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send email");
    } finally {
      setNotifyingIds((prev) => { const next = new Set(prev); next.delete(cert.id); return next; });
    }
  }

  async function act(id: string, action: "generate" | "regenerate" | "revoke" | "restore") {
    setActioning((prev) => new Set(prev).add(id));
    try {
      const response = await fetch(`/api/certificates/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();

      if (response.status === 202) {
        // Already generating — show info and let user retry
        toast.info(data.message || "Certificate is being generated. Refresh in a moment.");
        await load();
        return;
      }

      if (!response.ok) throw new Error(data.error || "Action failed");

      const label =
        action === "generate"
          ? "Certificate generated"
          : action === "regenerate"
          ? "Certificate regenerated"
          : action === "revoke"
          ? "Certificate revoked"
          : "Certificate restored";
      toast.success(label);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setActioning((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Certificates</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {setup
              ? "Step 4 of 4 — generate certificates for imported candidates."
              : "Review, generate, revoke, and download certificates."}
            {notGeneratedCount > 0 ? (
              <span className="ml-2 text-muted-foreground">
                ({notGeneratedCount} pending)
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="rounded-xl"
            disabled={bulkBusy || failedCount === 0}
            onClick={() => void startBulk(true)}
          >
            {bulkBusy ? "Working…" : `Retry failed (${failedCount})`}
          </Button>
          <Button
            className="rounded-xl"
            disabled={bulkBusy || (notGeneratedCount === 0 && failedCount === 0)}
            onClick={() => void startBulk(false)}
          >
            {bulkBusy ? "Generating…" : "Generate all"}
          </Button>
          {/* Notify Candidates button */}
          {smtpReady === false ? (
            <Button
              variant="outline"
              className="rounded-xl gap-2 opacity-50 cursor-not-allowed"
              disabled
              title="Configure SMTP in .env to enable email notifications"
            >
              <Mail className="h-4 w-4" />
              Notify Candidates
            </Button>
          ) : (
            <div className="relative inline-flex">
              <Button
                variant="outline"
                className="rounded-xl gap-2"
                disabled={notifyBusy || loading}
                onClick={() => void sendNotify(true)}
              >
                {notifyBusy ? (
                  <><RefreshCw className="h-4 w-4 animate-spin" /> Sending…</>
                ) : (
                  <><Send className="h-4 w-4" /> Notify Unsent</>  
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-xl ml-1 text-xs text-muted-foreground"
                disabled={notifyBusy || loading}
                onClick={() => void sendNotify(false)}
                title="Re-send to ALL candidates (including previously notified)"
              >
                Re-send all
              </Button>
            </div>
          )}
        </div>
      </div>

      {setup ? <EventSetupStepper eventId={eventId} current="certificates" /> : <EventNav eventId={eventId} />}

      {setup ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-900">Last step</p>
            <p className="text-xs text-slate-500">Generate certificates, then open the event overview when you are done.</p>
          </div>
          <Button asChild variant="outline" className="rounded-xl">
            <Link href={`/admin/events/${eventId}`}>
              Finish setup
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      ) : null}

      {batch && (bulkBusy || batch.status === "QUEUED" || batch.status === "PROCESSING") ? (
        <Card>
          <CardHeader>
            <CardTitle>Bulk generation</CardTitle>
            <CardDescription>
              {batch.completed} completed · {batch.failed} failed · {batch.total} total
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={batch.percent} />
            <p className="mt-2 text-xs text-muted-foreground">{batch.percent}% · {batch.status}</p>
          </CardContent>
        </Card>
      ) : null}

      {/* Email notify result card */}
      {notifyResult ? (
        <Card className="border-indigo-200 bg-indigo-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4 text-indigo-600" />
              Email notification sent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                <strong>{notifyResult.sent}</strong> sent
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
                <strong>{notifyResult.failed}</strong> failed
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-slate-400" />
                <strong>{notifyResult.skipped}</strong> skipped (already notified)
              </span>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Certificate list</CardTitle>
              <CardDescription>Search and manage individual certificates.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Search candidate or ID"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-56"
              />
              <select
                className="h-10 rounded-lg border border-border bg-card px-3 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">All statuses</option>
                <option value="NOT_GENERATED">Not Generated</option>
                <option value="GENERATING">Generating</option>
                <option value="PENDING">Pending</option>
                <option value="GENERATED">Generated</option>
                <option value="FAILED">Failed</option>
                <option value="REVOKED">Revoked</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : certificates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No certificates yet. Import candidates first — certificates are generated when candidates
              request them or when you click Generate on a row below.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b text-muted-foreground">
                  <tr>
                    <th className="pb-3 font-medium">Certificate ID</th>
                    <th className="pb-3 font-medium">Candidate</th>
                    <th className="pb-3 font-medium">Email</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Downloads</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {certificates.map((cert) => {
                    const busy = actioning.has(cert.id);
                    const canGenerate =
                      cert.status === "NOT_GENERATED" ||
                      cert.status === "PENDING" ||
                      cert.status === "FAILED";
                    const canRegenerate = cert.status === "GENERATED";

                    return (
                      <tr key={cert.id} className="border-b last:border-0">
                        <td className="py-3 font-medium">{cert.certificateNumber}</td>
                        <td className="py-3">{cert.candidate?.name || "—"}</td>
                        <td className="py-3 text-muted-foreground">{cert.candidate?.email || "—"}</td>
                        <td className="py-3">
                          <Badge variant={statusVariant(cert.status)}>{cert.status.replace("_", " ")}</Badge>
                          {cert.failureReason ? (
                            <p className="mt-1 text-xs text-red-600">{cert.failureReason}</p>
                          ) : null}
                        </td>
                        <td className="py-3">{cert.downloadCount}</td>
                        <td className="py-3">
                          <div className="flex flex-wrap gap-2">
                            {cert.pngUrl ? (
                              <Button asChild size="sm" variant="outline">
                                <a href={cert.pngUrl} target="_blank" rel="noreferrer">
                                  PNG
                                </a>
                              </Button>
                            ) : null}
                            {cert.pdfUrl ? (
                              <Button asChild size="sm" variant="outline">
                                <a href={cert.pdfUrl} target="_blank" rel="noreferrer">
                                  PDF
                                </a>
                              </Button>
                            ) : null}

                            {/* Generate — for certs that haven't been generated yet */}
                            {canGenerate ? (
                              <Button
                                size="sm"
                                variant="default"
                                disabled={busy || cert.status === "GENERATING"}
                                onClick={() => act(cert.id, "generate")}
                              >
                                {busy ? "Generating…" : "Generate"}
                              </Button>
                            ) : null}

                            {/* Regenerate — only for already-generated certs */}
                            {canRegenerate ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={busy}
                                onClick={() => act(cert.id, "regenerate")}
                              >
                                {busy ? "Generating…" : "Regenerate"}
                              </Button>
                            ) : null}

                            {cert.status === "REVOKED" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => act(cert.id, "restore")}
                              >
                                Restore
                              </Button>
                            ) : (
                              cert.status !== "NOT_GENERATED" && (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={busy}
                                  onClick={() => act(cert.id, "revoke")}
                                >
                                  Revoke
                                </Button>
                              )
                            )}
                             {/* Notify individual candidate */}
                             {cert.status === "GENERATED" ? (
                               <Button
                                 size="sm"
                                 variant="outline"
                                 className="gap-1.5 text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-40"
                                 disabled={!smtpReady || notifyingIds.has(cert.id)}
                                 onClick={() => void sendNotifyOne(cert)}
                                 title={
                                   !smtpReady
                                     ? "Configure SMTP in .env.local to enable email notifications"
                                     : `Send certificate email to ${cert.candidate?.email}`
                                 }
                               >
                                 {notifyingIds.has(cert.id) ? (
                                   <><RefreshCw className="h-3 w-3 animate-spin" /> Sending…</>
                                 ) : (
                                   <><Send className="h-3 w-3" /> Notify</>
                                 )}
                               </Button>
                             ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
