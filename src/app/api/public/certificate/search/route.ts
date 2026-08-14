import { NextRequest } from "next/server";
import { z } from "zod";
import { AppError, jsonError, jsonOk, parseJson } from "@/lib/api";
import { connectDb } from "@/lib/db";
import { getCandidateAccessProvider } from "@/lib/candidate-access";
import { ensureCertificateRecord } from "@/lib/certificates/ensure-cert";
import { generateCertificateNow } from "@/lib/generation/generate";
import { getClientIp, rateLimit } from "@/lib/security/rate-limit";
import { getStorage } from "@/lib/storage";
import { getRequestOrigin } from "@/lib/utils";
import { AuditEvent, Candidate, Certificate, Event } from "@/models";

const searchSchema = z.object({
  eventSlug: z.string().min(1),
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const limited = rateLimit(`public-search:${ip}`, 10, 60_000);
    if (!limited.ok) throw new AppError("Too many requests. Please try again shortly.", 429, "RATE_LIMITED");

    const body = searchSchema.parse(await parseJson(request));
    await connectDb();

    const event = await Event.findOne({ slug: body.eventSlug, status: "PUBLISHED" });
    // Generic response to reduce enumeration
    if (!event) {
      throw new AppError("No certificate found for this email.", 404, "NOT_FOUND");
    }

    const emailLimited = rateLimit(`public-search-email:${body.email.toLowerCase()}`, 8, 60_000);
    if (!emailLimited.ok) throw new AppError("Too many requests. Please try again shortly.", 429, "RATE_LIMITED");

    const candidate = await Candidate.findOne({ eventId: event._id, email: body.email.toLowerCase() });
    if (!candidate) {
      throw new AppError("No certificate found for this email.", 404, "NOT_FOUND");
    }

    // Ensure a certificate record exists (creates with NOT_GENERATED if missing)
    let certificate = await ensureCertificateRecord(event._id, candidate._id);

    if (certificate.status === "REVOKED") {
      throw new AppError("Your certificate has been revoked. Please contact the organiser.", 403, "REVOKED");
    }

    if (certificate.status === "GENERATING") {
      // Another request is already generating — tell the client to retry
      return jsonOk(
        {
          status: "GENERATING",
          message: "Your certificate is being generated. Please try again in a few seconds.",
          retryAfterMs: 5000,
        },
        { status: 202 }
      );
    }

    // Generate on-demand if not yet produced (or previously failed)
    if (certificate.status !== "GENERATED") {
      const origin = getRequestOrigin(request);
      const result = await generateCertificateNow(String(certificate._id), {
        actorType: "CANDIDATE",
        actorId: candidate.email,
        baseUrl: origin,
      });

      if (!result.ok) {
        if (result.reason === "already_generating") {
          return jsonOk(
            {
              status: "GENERATING",
              message: "Your certificate is being generated. Please try again in a few seconds.",
              retryAfterMs: result.retryAfterMs,
            },
            { status: 202 }
          );
        }
        throw new AppError(
          "We could not generate your certificate right now. Please try again later.",
          500,
          "GENERATION_FAILED"
        );
      }

      // Re-fetch fresh state after generation
      certificate = await Certificate.findById(certificate._id) ?? certificate;
    }

    if (certificate.status !== "GENERATED" || !certificate.pngKey) {
      throw new AppError("No certificate found for this email.", 404, "NOT_FOUND");
    }

    const access = await getCandidateAccessProvider().requestAccess({
      eventId: String(event._id),
      email: candidate.email,
    });

    const storage = getStorage();

    await AuditEvent.create({
      eventId: event._id,
      certificateId: certificate._id,
      actorType: "CANDIDATE",
      actorId: candidate.email,
      action: "certificate.lookup",
    });

    return jsonOk({
      accessToken: access.token,
      certificate: {
        certificateNumber: certificate.certificateNumber,
        candidateName: candidate.name,
        eventName: event.name,
        organizerName: event.organizerName,
        issuedAt: certificate.issuedAt,
        pngUrl: storage.createSignedUrl(certificate.pngKey, 15 * 60),
        pdfUrl: certificate.pdfKey ? storage.createSignedUrl(certificate.pdfKey, 15 * 60) : null,
      },
      event: {
        name: event.name,
        organizerName: event.organizerName,
        linkedinOrganizationId: event.linkedinOrganizationId ?? "",
        linkedinCertificationName: event.linkedinCertificationName ?? "",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
