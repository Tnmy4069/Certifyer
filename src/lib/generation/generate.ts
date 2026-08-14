import { connectDb } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import { templateConfigSchema } from "@/lib/types";
import { AuditEvent, Candidate, Certificate, CertificateTemplate, Event } from "@/models";
import type { CertificateDocument } from "@/models/Certificate";
import { renderCertificatePdf, renderCertificatePng, type RenderContext } from "@/lib/generation/render";

/** How long a GENERATING lock is considered stale before another request can steal it */
const LOCK_TTL_MS = 5 * 60 * 1000; // 5 minutes

export type GenerateResult =
  | { ok: true; certificate: (CertificateDocument & { _id: unknown }) | null }
  | { ok: false; reason: "already_generating"; retryAfterMs: number }
  | { ok: false; reason: "failed"; error: string };

/**
 * Generates the PNG + PDF for a single certificate on demand.
 *
 * Uses an optimistic DB lock (status = GENERATING + generatingAt timestamp) to
 * prevent duplicate concurrent generation for the same certificate.
 *
 * @param certificateId - The certificate _id to generate
 * @param options.force - If true, steal the lock even if GENERATING (admin regenerate)
 * @param options.actorType - Who triggered the generation (for audit log)
 * @param options.actorId  - Actor identifier string
 */
export async function generateCertificateNow(
  certificateId: string,
  options: {
    force?: boolean;
    actorType?: "ADMIN" | "CANDIDATE" | "SYSTEM";
    actorId?: string;
    baseUrl?: string;
  } = {}
): Promise<GenerateResult> {
  await connectDb();

  const { force = false, actorType = "SYSTEM", actorId = "system", baseUrl } = options;

  // Atomically acquire the lock.
  // Conditions to allow generation:
  //   1. Status is NOT_GENERATED, PENDING, or FAILED (never generated / previously failed)
  //   2. Status is GENERATING but the lock is stale (> LOCK_TTL_MS old) — recovery path
  //   3. Status is GENERATED and force=true — admin re-generate
  //   4. Any status when force=true — admin override
  const lockTime = new Date();
  const staleAt = new Date(Date.now() - LOCK_TTL_MS);

  const allowedStatuses = force
    ? ["NOT_GENERATED", "GENERATING", "PENDING", "FAILED", "GENERATED"]
    : ["NOT_GENERATED", "PENDING", "FAILED"];

  const query: Record<string, unknown> = {
    _id: certificateId,
    $or: [
      { status: { $in: allowedStatuses } },
      // Stale lock recovery (applies even without force)
      { status: "GENERATING", generatingAt: { $lt: staleAt } },
    ],
  };

  const locked = await Certificate.findOneAndUpdate(
    query,
    { $set: { status: "GENERATING", generatingAt: lockTime, failureReason: null } },
    { returnDocument: "after" }
  );

  if (!locked) {
    // Either not found, or currently GENERATING by another request
    const current = await Certificate.findById(certificateId);
    if (current?.status === "GENERATING" && current.generatingAt) {
      const elapsed = Date.now() - current.generatingAt.getTime();
      return {
        ok: false,
        reason: "already_generating",
        retryAfterMs: Math.max(0, LOCK_TTL_MS - elapsed),
      };
    }
    return { ok: false, reason: "failed", error: "Certificate not found or not eligible for generation" };
  }

  try {
    const [event, template] = await Promise.all([
      Event.findById(locked.eventId),
      CertificateTemplate.findOne({ eventId: locked.eventId }),
    ]);

    if (!event) throw new Error("Event not found");
    if (!template) throw new Error("Certificate template not found — upload and configure a template first");
    templateConfigSchema.parse(template.configuration);

    const candidate = await Candidate.findById(locked.candidateId);
    if (!candidate) throw new Error("Candidate not found");

    const storage = getStorage();
    const background = await storage.get(template.backgroundKey);
    const configuration = templateConfigSchema.parse(template.configuration);

    const context: RenderContext = {
      candidate: {
        name: candidate.name,
        email: candidate.email,
        phone: candidate.phone || "",
        role: candidate.role || "",
        organization: candidate.organization || "",
        department: candidate.department || "",
        metadata: (candidate.metadata as Record<string, unknown>) || {},
      },
      event: {
        name: event.name,
        organizerName: event.organizerName,
        eventDate: event.eventDate,
      },
      certificateNumber: locked.certificateNumber,
      baseUrl,
    };

    const png = await renderCertificatePng({
      background,
      width: template.width,
      height: template.height,
      configuration,
      context,
    });
    const pdf = await renderCertificatePdf(png, template.width, template.height);

    const pngKey = `events/${event._id}/certificates/${locked.certificateNumber}.png`;
    const pdfKey = `events/${event._id}/certificates/${locked.certificateNumber}.pdf`;
    await storage.put(pngKey, png, "image/png");
    await storage.put(pdfKey, pdf, "application/pdf");

    const now = new Date();
    const updated = await Certificate.findByIdAndUpdate(
      certificateId,
      {
        $set: {
          pngKey,
          pdfKey,
          status: "GENERATED",
          issuedAt: locked.issuedAt || now,
          lastGeneratedAt: now,
          failureReason: null,
          revokedAt: null,
          generatingAt: null,
        },
      },
      { returnDocument: "after" }
    );

    // Recompute generated count on the event
    const generatedCount = await Certificate.countDocuments({ eventId: event._id, status: "GENERATED" });
    await Event.findByIdAndUpdate(event._id, { $set: { generatedCount } });

    await AuditEvent.create({
      eventId: event._id,
      certificateId: locked._id,
      actorType,
      actorId,
      action: "certificate.generated",
      metadata: { force },
    });

    return { ok: true as const, certificate: updated as (CertificateDocument & { _id: unknown }) | null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";

    await Certificate.findByIdAndUpdate(certificateId, {
      $set: {
        status: "FAILED",
        failureReason: message,
        generatingAt: null,
      },
    });

    return { ok: false, reason: "failed", error: message };
  }
}
