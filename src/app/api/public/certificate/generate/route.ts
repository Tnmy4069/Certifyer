import { NextRequest } from "next/server";
import { z } from "zod";
import { AppError, jsonError, jsonOk, parseJson } from "@/lib/api";
import { connectDb } from "@/lib/db";
import { getCandidateAccessProvider } from "@/lib/candidate-access";
import { ensureCertificateRecord } from "@/lib/certificates/ensure-cert";
import { generateCertificateNow } from "@/lib/generation/generate";
import { getClientIp, rateLimit } from "@/lib/security/rate-limit";
import { getRequestOrigin } from "@/lib/utils";
import { Candidate, Certificate, Event, Feedback } from "@/models";

const generateSchema = z.object({
  eventId: z.string().min(1),
  candidateId: z.string().min(1),
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const limited = rateLimit(`public-generate:${ip}`, 20, 60_000);
    if (!limited.ok) throw new AppError("Too many requests. Please try again shortly.", 429, "RATE_LIMITED");

    const body = generateSchema.parse(await parseJson(request));
    await connectDb();

    // Verify event
    const event = await Event.findOne({ _id: body.eventId, status: "PUBLISHED" });
    if (!event) throw new AppError("Event not found or not published.", 404, "NOT_FOUND");

    // Verify candidate
    const candidate = await Candidate.findOne({
      _id: body.candidateId,
      eventId: event._id,
      email: body.email.toLowerCase(),
    });
    if (!candidate) throw new AppError("Candidate registration not found for this event.", 404, "NOT_FOUND");

    // Ensure Certificate record exists
    let certificate = await ensureCertificateRecord(event._id, candidate._id);

    // Prevent duplicate generation if already GENERATED
    if (certificate.status === "GENERATED") {
      const [access, existingFb] = await Promise.all([
        getCandidateAccessProvider().requestAccess({
          eventId: String(event._id),
          email: candidate.email.toLowerCase(),
        }),
        Feedback.findOne({ eventId: event._id, candidateId: candidate._id }).lean(),
      ]);

      return jsonOk({
        ok: true,
        alreadyGenerated: true,
        accessToken: access.token,
        certificate: {
          candidateId: String(candidate._id),
          eventId: String(event._id),
          certificateId: String(certificate._id),
          certificateNumber: certificate.certificateNumber,
          candidateName: candidate.name,
          candidateEmail: candidate.email,
          role: candidate.role || "",
          organization: candidate.organization || "",
          department: candidate.department || "",
          eventName: event.name,
          eventSlug: event.slug,
          organizerName: event.organizerName,
          eventDate: event.eventDate,
          issuedAt: certificate.issuedAt,
          pngUrl: `/api/public/certificate/${certificate.certificateNumber}/preview`,
          pdfUrl: `/api/public/certificate/${certificate.certificateNumber}/download?format=pdf`,
          linkedinOrganizationId: event.linkedinOrganizationId ?? "",
          linkedinCertificationName: event.linkedinCertificationName ?? "",
          status: "GENERATED",
          hasFeedback: Boolean(existingFb),
          feedback: existingFb ? { rating: existingFb.rating, remark: existingFb.remark } : null,
        },
      });
    }

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
            message: "Certificate is already being generated. Please check back in a few seconds.",
            retryAfterMs: result.retryAfterMs,
          },
          { status: 202 }
        );
      }
      throw new AppError(result.error || "Failed to generate certificate.", 400, "GENERATION_FAILED");
    }

    const updatedCert = (await Certificate.findById(certificate._id)) ?? certificate;
    const [access, existingFb] = await Promise.all([
      getCandidateAccessProvider().requestAccess({
        eventId: String(event._id),
        email: candidate.email.toLowerCase(),
      }),
      Feedback.findOne({ eventId: event._id, candidateId: candidate._id }).lean(),
    ]);

    return jsonOk({
      ok: true,
      accessToken: access.token,
      certificate: {
        candidateId: String(candidate._id),
        eventId: String(event._id),
        certificateId: String(updatedCert._id),
        certificateNumber: updatedCert.certificateNumber,
        candidateName: candidate.name,
        candidateEmail: candidate.email,
        role: candidate.role || "",
        organization: candidate.organization || "",
        department: candidate.department || "",
        eventName: event.name,
        eventSlug: event.slug,
        organizerName: event.organizerName,
        eventDate: event.eventDate,
        issuedAt: updatedCert.issuedAt,
        pngUrl: `/api/public/certificate/${updatedCert.certificateNumber}/preview`,
        pdfUrl: `/api/public/certificate/${updatedCert.certificateNumber}/download?format=pdf`,
        linkedinOrganizationId: event.linkedinOrganizationId ?? "",
        linkedinCertificationName: event.linkedinCertificationName ?? "",
        status: updatedCert.status,
        hasFeedback: Boolean(existingFb),
        feedback: existingFb ? { rating: existingFb.rating, remark: existingFb.remark } : null,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
