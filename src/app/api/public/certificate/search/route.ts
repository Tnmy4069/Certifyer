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
  eventSlug: z.string().min(1).optional(),
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const limited = rateLimit(`public-search:${ip}`, 10, 60_000);
    if (!limited.ok) throw new AppError("Too many requests. Please try again shortly.", 429, "RATE_LIMITED");

    const body = searchSchema.parse(await parseJson(request));
    await connectDb();

    const emailLimited = rateLimit(`public-search-email:${body.email.toLowerCase()}`, 8, 60_000);
    if (!emailLimited.ok) throw new AppError("Too many requests. Please try again shortly.", 429, "RATE_LIMITED");

    const eventsMap = new Map<string, any>();
    const candidateList: any[] = [];

    if (body.eventSlug) {
      const event = await Event.findOne({ slug: body.eventSlug, status: "PUBLISHED" });
      if (!event) {
        throw new AppError("No certificate found for this email.", 404, "NOT_FOUND");
      }
      eventsMap.set(String(event._id), event);
      const found = await Candidate.find({ eventId: event._id, email: body.email.toLowerCase() });
      candidateList.push(...found);
    } else {
      // Global search across all published events
      const publishedEvents = await Event.find({ status: "PUBLISHED" });
      if (!publishedEvents.length) {
        throw new AppError("No certificates found for this email.", 404, "NOT_FOUND");
      }
      for (const ev of publishedEvents) {
        eventsMap.set(String(ev._id), ev);
      }
      const eventIds = publishedEvents.map((e) => e._id);
      const found = await Candidate.find({ eventId: { $in: eventIds }, email: body.email.toLowerCase() });
      candidateList.push(...found);
    }

    if (!candidateList || candidateList.length === 0) {
      throw new AppError("No certificate found for this email.", 404, "NOT_FOUND");
    }

    const origin = getRequestOrigin(request);
    const storage = getStorage();
    const certificatesList: Array<{
      certificateNumber: string;
      candidateName: string;
      role: string;
      organization: string;
      department: string;
      eventName: string;
      eventSlug: string;
      organizerName: string;
      issuedAt?: Date | null;
      pngUrl: string;
      pdfUrl?: string | null;
      linkedinOrganizationId?: string;
      linkedinCertificationName?: string;
    }> = [];

    let anyGenerating = false;
    let maxRetryAfterMs = 5000;
    let primaryEventId = "";

    for (const candidate of candidateList) {
      const event = eventsMap.get(String(candidate.eventId));
      if (!event) continue;
      primaryEventId = String(event._id);

      let certificate = await ensureCertificateRecord(event._id, candidate._id);

      if (certificate.status === "REVOKED") {
        continue;
      }

      if (certificate.status === "GENERATING") {
        anyGenerating = true;
        continue;
      }

      // Generate on-demand if not yet generated or previously failed
      if (certificate.status !== "GENERATED") {
        const result = await generateCertificateNow(String(certificate._id), {
          actorType: "CANDIDATE",
          actorId: candidate.email,
          baseUrl: origin,
        });

        if (!result.ok) {
          if (result.reason === "already_generating") {
            anyGenerating = true;
            maxRetryAfterMs = Math.max(maxRetryAfterMs, result.retryAfterMs);
            continue;
          }
          console.error(`Generation failed for candidate ${candidate._id}:`, result.error);
          continue;
        }

        certificate = (await Certificate.findById(certificate._id)) ?? certificate;
      }

      if (certificate.status === "GENERATED" && certificate.pngKey) {
        certificatesList.push({
          certificateNumber: certificate.certificateNumber,
          candidateName: candidate.name,
          role: candidate.role || "",
          organization: candidate.organization || "",
          department: candidate.department || "",
          eventName: event.name,
          eventSlug: event.slug,
          organizerName: event.organizerName,
          issuedAt: certificate.issuedAt,
          pngUrl: storage.createSignedUrl(certificate.pngKey, 15 * 60),
          pdfUrl: certificate.pdfKey ? storage.createSignedUrl(certificate.pdfKey, 15 * 60) : null,
          linkedinOrganizationId: event.linkedinOrganizationId ?? "",
          linkedinCertificationName: event.linkedinCertificationName ?? "",
        });

        await AuditEvent.create({
          eventId: event._id,
          certificateId: certificate._id,
          actorType: "CANDIDATE",
          actorId: candidate.email,
          action: "certificate.lookup",
        });
      }
    }

    if (certificatesList.length === 0 && anyGenerating) {
      return jsonOk(
        {
          status: "GENERATING",
          message: "Your certificate is being generated. Please try again in a few seconds.",
          retryAfterMs: maxRetryAfterMs,
        },
        { status: 202 }
      );
    }

    if (certificatesList.length === 0) {
      throw new AppError("No certificate found for this email.", 404, "NOT_FOUND");
    }

    const access = await getCandidateAccessProvider().requestAccess({
      eventId: primaryEventId,
      email: body.email.toLowerCase(),
    });

    const firstEvent = eventsMap.get(primaryEventId);

    return jsonOk({
      accessToken: access.token,
      certificates: certificatesList,
      certificate: certificatesList[0],
      event: firstEvent
        ? {
            name: firstEvent.name,
            organizerName: firstEvent.organizerName,
            linkedinOrganizationId: firstEvent.linkedinOrganizationId ?? "",
            linkedinCertificationName: firstEvent.linkedinCertificationName ?? "",
          }
        : undefined,
    });
  } catch (error) {
    return jsonError(error);
  }
}
