import { NextRequest } from "next/server";
import { requireAdmin } from "@/auth";
import { AppError, jsonError, jsonOk, parseJson } from "@/lib/api";
import { connectDb } from "@/lib/db";
import { generateCertificateNow } from "@/lib/generation/generate";
import { getStorage } from "@/lib/storage";
import { getRequestOrigin } from "@/lib/utils";
import { AuditEvent, Candidate, Certificate, Event } from "@/models";
import mongoose from "mongoose";

type Params = { params: Promise<{ id: string }> };

import { ensureCertificateRecord } from "@/lib/certificates/ensure-cert";

async function getAdminCertificate(id: string, userId: string, role?: string) {
  let certificate;
  const eventFilter = (eventId: mongoose.Types.ObjectId) =>
    (role === "SUPER_ADMIN" ? { _id: eventId } : { _id: eventId, createdBy: userId }) as {
      _id: mongoose.Types.ObjectId;
      createdBy?: string;
    };

  if (id.startsWith("candidate:")) {
    const candidateId = id.replace("candidate:", "");
    if (!mongoose.isValidObjectId(candidateId)) throw new AppError("Candidate not found", 404);
    const candidate = await Candidate.findById(candidateId);
    if (!candidate) throw new AppError("Candidate not found", 404);

    const event = await Event.findOne(eventFilter(candidate.eventId));
    if (!event) throw new AppError("Candidate not found", 404);

    certificate = await ensureCertificateRecord(event._id, candidate._id);
  } else {
    if (!mongoose.isValidObjectId(id)) throw new AppError("Certificate not found", 404);
    certificate = await Certificate.findById(id);
    if (!certificate) throw new AppError("Certificate not found", 404);
  }

  const event = await Event.findOne(eventFilter(certificate.eventId));
  if (!event) throw new AppError("Certificate not found", 404);
  return { certificate, event };
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    await connectDb();
    const { certificate, event } = await getAdminCertificate(id, session.user.id, session.user.role);

    const storage = getStorage();
    return jsonOk({
      certificate: {
        id: String(certificate._id),
        certificateNumber: certificate.certificateNumber,
        status: certificate.status,
        issuedAt: certificate.issuedAt,
        lastGeneratedAt: certificate.lastGeneratedAt,
        failureReason: certificate.failureReason,
        pngUrl: certificate.pngKey ? storage.createSignedUrl(certificate.pngKey) : null,
        pdfUrl: certificate.pdfKey ? storage.createSignedUrl(certificate.pdfKey) : null,
        event: { id: String(event._id), name: event.name },
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    await connectDb();
    const { certificate, event } = await getAdminCertificate(id, session.user.id, session.user.role);
    const body = await parseJson<{ action: "generate" | "regenerate" | "revoke" | "restore" }>(request);

    if (body.action === "revoke") {
      certificate.status = "REVOKED";
      certificate.revokedAt = new Date();
      await certificate.save();
      await AuditEvent.create({
        eventId: event._id,
        certificateId: certificate._id,
        actorType: "ADMIN",
        actorId: session.user.id,
        action: "certificate.revoked",
      });
      return jsonOk({ certificate: { id: String(certificate._id), status: certificate.status } });
    }

    if (body.action === "restore") {
      if (certificate.status !== "REVOKED") throw new AppError("Only revoked certificates can be restored", 400);
      certificate.status = certificate.pngKey ? "GENERATED" : "NOT_GENERATED";
      certificate.revokedAt = null;
      await certificate.save();
      await AuditEvent.create({
        eventId: event._id,
        certificateId: certificate._id,
        actorType: "ADMIN",
        actorId: session.user.id,
        action: "certificate.restored",
      });
      return jsonOk({ certificate: { id: String(certificate._id), status: certificate.status } });
    }

    // "generate" (for NOT_GENERATED certs) and "regenerate" (for GENERATED certs) both
    // call generateCertificateNow with force=true so admin can always trigger it.
    if (body.action === "generate" || body.action === "regenerate") {
      const origin = getRequestOrigin(request);
      const result = await generateCertificateNow(String(certificate._id), {
        force: true,
        actorType: "ADMIN",
        actorId: session.user.id,
        baseUrl: origin,
      });

      if (!result.ok) {
        if (result.reason === "already_generating") {
          return jsonOk(
            {
              status: "GENERATING",
              message: "Certificate is already being generated. Please refresh in a few seconds.",
              retryAfterMs: result.retryAfterMs,
            },
            { status: 202 }
          );
        }
        throw new AppError(result.error || "Generation failed", 500, "GENERATION_FAILED");
      }

      const storage = getStorage();
      const updated = result.certificate;
      return jsonOk({
        certificate: {
          id: String(certificate._id),
          status: updated?.status ?? "GENERATED",
          pngUrl: updated?.pngKey ? storage.createSignedUrl(updated.pngKey) : null,
          pdfUrl: updated?.pdfKey ? storage.createSignedUrl(updated.pdfKey) : null,
        },
        message: body.action === "regenerate" ? "Certificate regenerated" : "Certificate generated",
      });
    }

    throw new AppError("Unknown action", 400);
  } catch (error) {
    return jsonError(error);
  }
}
