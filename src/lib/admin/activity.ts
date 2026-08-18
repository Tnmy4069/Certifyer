export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "certificate.generated": "Certificate generated",
  "certificate.revoked": "Certificate revoked",
  "certificate.restored": "Certificate restored",
  "certificate.download.png": "PNG downloaded",
  "certificate.download.pdf": "PDF downloaded",
  "certificate.lookup": "Certificate lookup",
  "certificate.verified": "Certificate verified",
  "certificate.verified.page": "Verification page viewed",
  "candidate.feedback_submitted": "Feedback submitted",
  "generation.enqueued": "Generation queued",
};

export function auditActionLabel(action: string) {
  return AUDIT_ACTION_LABELS[action] ?? action.replace(/\./g, " ");
}

export const AUDIT_ACTION_FILTERS = [
  { value: "", label: "All activity" },
  { value: "certificate.generated", label: "Generated" },
  { value: "certificate.download.png", label: "PNG downloads" },
  { value: "certificate.download.pdf", label: "PDF downloads" },
  { value: "certificate.verified", label: "Verifications" },
  { value: "certificate.lookup", label: "Lookups" },
  { value: "candidate.feedback_submitted", label: "Feedback" },
  { value: "certificate.revoked", label: "Revoked" },
  { value: "generation.enqueued", label: "Generation queued" },
] as const;
