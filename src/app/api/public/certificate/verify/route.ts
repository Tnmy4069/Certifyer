import { NextRequest } from "next/server";
import { z } from "zod";
import { AppError, jsonError, jsonOk, parseJson } from "@/lib/api";
import { connectDb } from "@/lib/db";
import { getClientIp, rateLimit } from "@/lib/security/rate-limit";
import { formatDate } from "@/lib/utils";
import { AuditEvent, Candidate, Certificate, Event } from "@/models";

const verifySchema = z.object({
  certificateNumber: z.string().min(3).optional(),
  certificateId: z.string().min(3).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const limited = rateLimit(`public-verify:${ip}`, 30, 60_000);
    if (!limited.ok) throw new AppError("Too many requests", 429, "RATE_LIMITED");

    const body = verifySchema.parse(await parseJson(request));
    const certificateNumber = body.certificateNumber || body.certificateId;
    if (!certificateNumber) throw new AppError("Certificate ID is required", 400);

    await connectDb();
    const certificate = await Certificate.findOne({ certificateNumber: certificateNumber.toUpperCase() });
    if (!certificate) throw new AppError("Certificate not found", 404, "NOT_FOUND");

    const [event, candidate] = await Promise.all([
      Event.findById(certificate.eventId),
      Candidate.findById(certificate.candidateId),
    ]);

    if (!event) throw new AppError("Certificate not found", 404, "NOT_FOUND");

    certificate.verificationCount += 1;
    await certificate.save();
    await Event.findByIdAndUpdate(event._id, { $inc: { verificationCount: 1 } });
    await AuditEvent.create({
      eventId: event._id,
      certificateId: certificate._id,
      actorType: "PUBLIC",
      action: "certificate.verified",
    });

    if (certificate.status === "REVOKED") {
      return jsonOk({
        status: "REVOKED",
        message: "Certificate Revoked",
        certificate: {
          certificateNumber: certificate.certificateNumber,
          candidateName: candidate?.name || "—",
          eventName: event.name,
          organizerName: event.organizerName,
          issuedAt: certificate.issuedAt ? formatDate(certificate.issuedAt) : null,
          revokedAt: certificate.revokedAt ? formatDate(certificate.revokedAt) : null,
        },
      });
    }

    if (certificate.status !== "GENERATED") {
      throw new AppError("Certificate not found", 404, "NOT_FOUND");
    }

    return jsonOk({
      status: "VERIFIED",
      message: "Certificate Verified",
      certificate: {
        certificateNumber: certificate.certificateNumber,
        candidateName: candidate?.name || "—",
        eventName: event.name,
        organizerName: event.organizerName,
        issuedAt: certificate.issuedAt ? formatDate(certificate.issuedAt) : null,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
