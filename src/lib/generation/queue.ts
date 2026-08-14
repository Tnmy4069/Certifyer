import { connectDb } from "@/lib/db";
import { generateCertificateNumber } from "@/lib/certificates/ids";
import { getStorage } from "@/lib/storage";
import { templateConfigSchema } from "@/lib/types";
import {
  AuditEvent,
  Candidate,
  Certificate,
  CertificateTemplate,
  Event,
  GenerationBatch,
  GenerationJob,
} from "@/models";
import { renderCertificatePdf, renderCertificatePng, type RenderContext } from "@/lib/generation/render";
import type { Types } from "mongoose";

export async function enqueueCertificateGeneration(options: {
  eventId: string | Types.ObjectId;
  userId: string;
  certificateIds?: string[];
  onlyFailed?: boolean;
}) {
  await connectDb();
  const event = await Event.findById(options.eventId);
  if (!event) throw new Error("Event not found");

  const template = await CertificateTemplate.findOne({ eventId: event._id });
  if (!template) throw new Error("Certificate template is required");
  templateConfigSchema.parse(template.configuration);

  const filter: Record<string, unknown> = { eventId: event._id };
  if (options.certificateIds?.length) {
    filter._id = { $in: options.certificateIds };
  } else if (options.onlyFailed) {
    filter.status = "FAILED";
  }

  let certificates = await Certificate.find(filter);
  if (!options.certificateIds?.length && !options.onlyFailed) {
    const candidates = await Candidate.find({ eventId: event._id });
    const existingByCandidate = new Map(certificates.map((c) => [String(c.candidateId), c]));
    for (const candidate of candidates) {
      if (!existingByCandidate.has(String(candidate._id))) {
        const created = await Certificate.create({
          eventId: event._id,
          candidateId: candidate._id,
          certificateNumber: generateCertificateNumber(new Date(event.eventDate).getFullYear()),
          status: "PENDING",
        });
        certificates.push(created);
      }
    }
    certificates = await Certificate.find({
      eventId: event._id,
      status: { $in: ["PENDING", "FAILED"] },
    });
  }

  if (certificates.length === 0) {
    throw new Error("No certificates to generate");
  }

  const batch = await GenerationBatch.create({
    eventId: event._id,
    createdBy: options.userId,
    status: "QUEUED",
    total: certificates.length,
    completed: 0,
    failed: 0,
  });

  await GenerationJob.insertMany(
    certificates.map((cert) => ({
      batchId: batch._id,
      eventId: event._id,
      certificateId: cert._id,
      status: "QUEUED",
      attempts: 0,
      maxAttempts: 3,
    }))
  );

  await Certificate.updateMany(
    { _id: { $in: certificates.map((c) => c._id) } },
    { $set: { status: "PENDING", failureReason: null } }
  );

  await AuditEvent.create({
    eventId: event._id,
    actorType: "ADMIN",
    actorId: options.userId,
    action: "generation.enqueued",
    metadata: { batchId: String(batch._id), total: certificates.length },
  });

  return batch;
}

async function processJob(jobId: string, workerId: string) {
  const job = await GenerationJob.findOneAndUpdate(
    {
      _id: jobId,
      status: "QUEUED",
      $or: [{ lockedAt: null }, { lockedAt: { $lt: new Date(Date.now() - 5 * 60_000) } }],
    },
    {
      $set: { status: "PROCESSING", lockedAt: new Date(), lockedBy: workerId },
      $inc: { attempts: 1 },
    },
    { returnDocument: "after" }
  );

  if (!job) return false;

  try {
    const [certificate, event, template] = await Promise.all([
      Certificate.findById(job.certificateId),
      Event.findById(job.eventId),
      CertificateTemplate.findOne({ eventId: job.eventId }),
    ]);

    if (!certificate || !event || !template) {
      throw new Error("Missing certificate, event, or template");
    }

    const candidate = await Candidate.findById(certificate.candidateId);
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
      certificateNumber: certificate.certificateNumber,
    };

    const png = await renderCertificatePng({
      background,
      width: template.width,
      height: template.height,
      configuration,
      context,
    });
    const pdf = await renderCertificatePdf(png, template.width, template.height);

    const pngKey = `events/${event._id}/certificates/${certificate.certificateNumber}.png`;
    const pdfKey = `events/${event._id}/certificates/${certificate.certificateNumber}.pdf`;
    await storage.put(pngKey, png, "image/png");
    await storage.put(pdfKey, pdf, "application/pdf");

    certificate.pngKey = pngKey;
    certificate.pdfKey = pdfKey;
    certificate.status = "GENERATED";
    certificate.issuedAt = certificate.issuedAt || new Date();
    certificate.lastGeneratedAt = new Date();
    certificate.failureReason = null;
    certificate.revokedAt = null;
    await certificate.save();

    job.status = "COMPLETED";
    job.completedAt = new Date();
    job.error = null;
    await job.save();

    await GenerationBatch.findByIdAndUpdate(job.batchId, { $inc: { completed: 1 } });
    await Event.findByIdAndUpdate(event._id, {
      $inc: { generatedCount: 1 },
      $set: { failureCount: await Certificate.countDocuments({ eventId: event._id, status: "FAILED" }) },
    });

    // Recompute generated count accurately
    const generatedCount = await Certificate.countDocuments({ eventId: event._id, status: "GENERATED" });
    await Event.findByIdAndUpdate(event._id, { $set: { generatedCount } });

    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed";
    const failedPermanently = job.attempts >= job.maxAttempts;

    job.status = failedPermanently ? "FAILED" : "QUEUED";
    job.error = message;
    job.lockedAt = null;
    job.lockedBy = null;
    await job.save();

    await Certificate.findByIdAndUpdate(job.certificateId, {
      $set: {
        status: failedPermanently ? "FAILED" : "PENDING",
        failureReason: message,
      },
    });

    if (failedPermanently) {
      await GenerationBatch.findByIdAndUpdate(job.batchId, { $inc: { failed: 1 } });
      const failureCount = await Certificate.countDocuments({ eventId: job.eventId, status: "FAILED" });
      await Event.findByIdAndUpdate(job.eventId, { $set: { failureCount } });
    }

    return false;
  }
}

export async function processGenerationQueue(options?: { limit?: number; workerId?: string }) {
  await connectDb();
  const limit = options?.limit ?? 5;
  const workerId = options?.workerId || `worker-${process.pid}`;

  const jobs = await GenerationJob.find({ status: "QUEUED" }).sort({ createdAt: 1 }).limit(limit);
  let processed = 0;
  for (const job of jobs) {
    const ok = await processJob(String(job._id), workerId);
    if (ok || true) processed += 1;

    const batch = await GenerationBatch.findById(job.batchId);
    if (batch) {
      const remaining = await GenerationJob.countDocuments({
        batchId: batch._id,
        status: { $in: ["QUEUED", "PROCESSING"] },
      });
      if (remaining === 0) {
        batch.status = batch.failed > 0 && batch.completed === 0 ? "FAILED" : "COMPLETED";
        batch.finishedAt = new Date();
        await batch.save();
      } else if (batch.status === "QUEUED") {
        batch.status = "PROCESSING";
        batch.startedAt = batch.startedAt || new Date();
        await batch.save();
      }
    }
  }

  return { processed, workerId };
}

export async function getBatchProgress(batchId: string) {
  await connectDb();
  const batch = await GenerationBatch.findById(batchId);
  if (!batch) return null;
  const percent = batch.total === 0 ? 0 : Math.round(((batch.completed + batch.failed) / batch.total) * 100);
  return {
    id: String(batch._id),
    status: batch.status,
    total: batch.total,
    completed: batch.completed,
    failed: batch.failed,
    percent,
    startedAt: batch.startedAt,
    finishedAt: batch.finishedAt,
  };
}
