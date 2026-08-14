"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EventNav } from "@/components/admin/event-nav";

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

function statusVariant(status: string): "success" | "destructive" | "warning" | "muted" | "outline" {
  if (status === "GENERATED") return "success";
  if (status === "FAILED") return "destructive";
  if (status === "REVOKED") return "warning";
  if (status === "GENERATING") return "muted";
  return "outline";
}

export function CertificatesManager({ eventId }: { eventId: string }) {
  const [certificates, setCertificates] = useState<CertificateRow[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  // Track which cert IDs are currently being actioned
  const [actioning, setActioning] = useState<Set<string>>(new Set());

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

  const notGeneratedCount = useMemo(
    () => certificates.filter((c) => c.status === "NOT_GENERATED" || c.status === "PENDING").length,
    [certificates]
  );

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
            Review, generate, revoke, and download certificates.
            {notGeneratedCount > 0 ? (
              <span className="ml-2 text-muted-foreground">
                ({notGeneratedCount} pending — will be generated when candidates request them)
              </span>
            ) : null}
          </p>
        </div>
      </div>

      <EventNav eventId={eventId} />

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
