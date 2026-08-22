import { NextRequest } from "next/server";
import { requireAdmin } from "@/auth";
import { AppError, jsonError, jsonOk } from "@/lib/api";
import { connectDb } from "@/lib/db";
import { getOwnedEvent } from "@/lib/events/helpers";
import { sendEmail, smtpConfigured } from "@/lib/email/mailer";
import { buildCertificateReadyEmail } from "@/lib/email/templates";
import { absoluteUrl } from "@/lib/utils";
import { AuditEvent, Certificate, Candidate, EmailLog } from "@/models";

type Params = { params: Promise<{ id: string }> };

const BATCH_SIZE = 10;
const DELAY_MS = 250;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    await connectDb();
    const event = await getOwnedEvent(id, session.user.id, session.user.role);

    const [total, sent, failed] = await Promise.all([
      Certificate.countDocuments({ eventId: event._id, status: "GENERATED" }),
      EmailLog.countDocuments({ eventId: event._id, status: "sent", type: "certificate_ready" }),
      EmailLog.countDocuments({ eventId: event._id, status: "failed", type: "certificate_ready" }),
    ]);

    return jsonOk({
      smtpConfigured: smtpConfigured(),
      stats: { total, sent, failed, unsent: Math.max(0, total - sent) },
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await requireAdmin();
    const { id } = await params;

    if (!smtpConfigured()) {
      throw new AppError(
        "SMTP is not configured. Add SMTP_HOST, SMTP_USER, SMTP_PASS, and SMTP_FROM to your .env file.",
        400,
        "SMTP_NOT_CONFIGURED"
      );
    }

    await connectDb();
    const event = await getOwnedEvent(id, session.user.id, session.user.role);

    let onlyNew = true;
    let candidateId: string | undefined;
    try {
      const body = (await request.json()) as { onlyNew?: boolean; candidateId?: string };
      onlyNew = body.onlyNew !== false;
      candidateId = body.candidateId;
    } catch {
      // default
    }

    const certFilter: Record<string, unknown> = { eventId: event._id, status: "GENERATED" };
    if (candidateId) certFilter.candidateId = candidateId;

    const certificates = await Certificate.find(certFilter)
      .select("_id candidateId certificateNumber")
      .lean();

    if (certificates.length === 0) {
      throw new AppError(
        candidateId
          ? "Certificate not generated yet for this candidate."
          : "No generated certificates found for this event.",
        400,
        "NO_CERTIFICATES"
      );
    }

    let alreadySentCandidateIds = new Set<string>();
    if (onlyNew) {
      const sentLogs = await EmailLog.find({
        eventId: event._id,
        type: "certificate_ready",
        status: "sent",
      }).select("candidateId").lean();
      alreadySentCandidateIds = new Set(sentLogs.map((l) => String(l.candidateId)));
    }

    const candidateIds = certificates.map((c) => c.candidateId);
    const candidates = await Candidate.find({ _id: { $in: candidateIds } })
      .select("_id name email")
      .lean();
    const candidateMap = new Map(candidates.map((c) => [String(c._id), c]));

    const publicBase = absoluteUrl(`/public/${event.slug}`);

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (let i = 0; i < certificates.length; i += BATCH_SIZE) {
      const batch = certificates.slice(i, i + BATCH_SIZE);

      for (const cert of batch) {
        const candidateId = String(cert.candidateId);
        const candidate = candidateMap.get(candidateId);

        if (!candidate) { skipped++; continue; }
        if (onlyNew && alreadySentCandidateIds.has(candidateId)) { skipped++; continue; }

        try {
          const verifyUrl = absoluteUrl(`/verify/${cert.certificateNumber}`);
          const { subject, html, text } = buildCertificateReadyEmail({
            candidateName: candidate.name,
            eventName: event.name,
            organizerName: event.organizerName,
            certificateNumber: cert.certificateNumber,
            verifyUrl,
            publicUrl: publicBase,
          });

          await sendEmail({ to: candidate.email, subject, html, text });

          await EmailLog.create({
            eventId: event._id,
            candidateId: candidate._id,
            certificateId: cert._id,
            to: candidate.email,
            status: "sent",
            type: "certificate_ready",
            sentAt: new Date(),
          });
          sent++;
        } catch (err) {
          const error = err instanceof Error ? err.message : "Unknown error";
          await EmailLog.create({
            eventId: event._id,
            candidateId: candidate._id,
            certificateId: cert._id,
            to: candidate.email,
            status: "failed",
            type: "certificate_ready",
            error,
            sentAt: new Date(),
          });
          failed++;
        }
      }

      if (i + BATCH_SIZE < certificates.length) {
        await sleep(DELAY_MS);
      }
    }

    try {
      await AuditEvent.create({
        eventId: event._id,
        actorType: "ADMIN",
        actorId: session.user.id,
        action: "email.bulk_notify",
        metadata: { sent, failed, skipped },
      });
    } catch { /* non-critical */ }

    return jsonOk({ sent, failed, skipped });
  } catch (error) {
    return jsonError(error);
  }
}