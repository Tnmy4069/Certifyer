import { NextRequest } from "next/server";
import { z } from "zod";
import { AppError, jsonError, jsonOk, parseJson } from "@/lib/api";
import { connectDb } from "@/lib/db";
import { getCandidateAccessProvider } from "@/lib/candidate-access";
import { ensureCertificateRecord } from "@/lib/certificates/ensure-cert";
import { getClientIp, rateLimit } from "@/lib/security/rate-limit";
import { AuditEvent, Candidate, Certificate, Event, Feedback } from "@/models";

const searchSchema = z.object({
  eventSlug: z.string().min(1).optional(),
  email: z.string().min(1).optional(),
  query: z.string().min(1).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const limited = rateLimit(`public-search:${ip}`, 20, 60_000);
    if (!limited.ok) throw new AppError("Too many requests. Please try again shortly.", 429, "RATE_LIMITED");

    const body = searchSchema.parse(await parseJson(request));
    const searchTerm = (body.query || body.email || "").trim();
    if (!searchTerm) {
      throw new AppError("Please provide an email or phone number to search.", 400, "VALIDATION_ERROR");
    }

    await connectDb();

    const termLimited = rateLimit(`public-search-term:${searchTerm.toLowerCase()}`, 15, 60_000);
    if (!termLimited.ok) throw new AppError("Too many requests. Please try again shortly.", 429, "RATE_LIMITED");

    const eventsMap = new Map<string, any>();
    const candidateList: any[] = [];

    const searchFilter = searchTerm.includes("@")
      ? { email: searchTerm.toLowerCase() }
      : {
          $or: [
            { email: searchTerm.toLowerCase() },
            { phone: searchTerm },
          ],
        };

    if (body.eventSlug) {
      const event = await Event.findOne({ slug: body.eventSlug, status: "PUBLISHED" });
      if (!event) {
        throw new AppError("Event not found or not published.", 404, "NOT_FOUND");
      }
      eventsMap.set(String(event._id), event);
      const found = await Candidate.find({ eventId: event._id, ...searchFilter });
      candidateList.push(...found);
    } else {
      // Global search across all published events
      const publishedEvents = await Event.find({ status: "PUBLISHED" });
      if (!publishedEvents.length) {
        throw new AppError("No published events found.", 404, "NOT_FOUND");
      }
      for (const ev of publishedEvents) {
        eventsMap.set(String(ev._id), ev);
      }
      const eventIds = publishedEvents.map((e) => e._id);
      const found = await Candidate.find({ eventId: { $in: eventIds }, ...searchFilter });
      candidateList.push(...found);
    }

    if (!candidateList || candidateList.length === 0) {
      throw new AppError("No registration records found for this identifying detail.", 404, "NOT_FOUND");
    }

    const candidateIds = candidateList.map((c) => c._id);
    const existingFeedbacks = await Feedback.find({ candidateId: { $in: candidateIds } }).lean();
    const feedbackMap = new Map(existingFeedbacks.map((f) => [String(f.candidateId), f]));

    const certificatesList: Array<{
      candidateId: string;
      eventId: string;
      certificateId: string;
      certificateNumber: string;
      candidateName: string;
      candidateEmail: string;
      candidatePhone?: string;
      role: string;
      organization: string;
      department: string;
      eventName: string;
      eventSlug: string;
      organizerName: string;
      eventDate?: Date;
      issuedAt?: Date | null;
      pngUrl: string;
      pdfUrl?: string | null;
      linkedinOrganizationId?: string;
      linkedinCertificationName?: string;
      status: string;
      failureReason?: string | null;
      hasFeedback: boolean;
      feedback?: { rating: number; remark?: string } | null;
    }> = [];

    let primaryEventId = "";

    for (const candidate of candidateList) {
      // Check if candidate is marked absent
      const metadata = candidate.metadata || {};
      let isAbsent = (candidate.role || "").toLowerCase().trim() === "absent";
      for (const [k, v] of Object.entries(metadata)) {
        const key = k.toLowerCase().trim();
        const val = typeof v === "string" ? v.toLowerCase().trim() : v;
        if (["attendance", "present", "attended", "status", "attendance_status", "is_present"].includes(key)) {
          if (val === "absent" || val === "a" || val === "no" || val === false || val === "false" || val === "0") {
            isAbsent = true;
            break;
          }
        }
      }

      if (isAbsent) {
        continue;
      }

      const event = eventsMap.get(String(candidate.eventId));
      if (!event) continue;
      if (!primaryEventId) primaryEventId = String(event._id);

      // Ensure certificate record exists with status (default NOT_GENERATED)
      const certificate = await ensureCertificateRecord(event._id, candidate._id);

      if (certificate.status === "REVOKED") {
        continue;
      }

      if (certificate.status === "GENERATED") {
        await AuditEvent.create({
          eventId: event._id,
          certificateId: certificate._id,
          actorType: "CANDIDATE",
          actorId: candidate.email,
          action: "certificate.lookup",
        });
      }

      const fb = feedbackMap.get(String(candidate._id));

      certificatesList.push({
        candidateId: String(candidate._id),
        eventId: String(event._id),
        certificateId: String(certificate._id),
        certificateNumber: certificate.certificateNumber,
        candidateName: candidate.name,
        candidateEmail: candidate.email,
        candidatePhone: candidate.phone || "",
        role: candidate.role || "",
        organization: candidate.organization || "",
        department: candidate.department || "",
        eventName: event.name,
        eventSlug: event.slug,
        organizerName: event.organizerName,
        eventDate: event.eventDate,
        issuedAt: certificate.issuedAt,
        pngUrl: certificate.status === "GENERATED" ? `/api/public/certificate/${certificate.certificateNumber}/preview` : "",
        pdfUrl: certificate.status === "GENERATED" ? `/api/public/certificate/${certificate.certificateNumber}/download?format=pdf` : null,
        linkedinOrganizationId: event.linkedinOrganizationId ?? "",
        linkedinCertificationName: event.linkedinCertificationName ?? "",
        status: certificate.status,
        failureReason: certificate.failureReason || null,
        hasFeedback: Boolean(fb),
        feedback: fb ? { rating: fb.rating, remark: fb.remark } : null,
      });
    }

    if (certificatesList.length === 0) {
      throw new AppError("No available certificates or events found.", 404, "NOT_FOUND");
    }

    const candidatePrimary = candidateList[0];
    const access = await getCandidateAccessProvider().requestAccess({
      eventId: primaryEventId,
      email: candidatePrimary.email.toLowerCase(),
    });

    const firstEvent = eventsMap.get(primaryEventId);

    return jsonOk({
      accessToken: access.token,
      candidate: {
        name: candidatePrimary.name,
        email: candidatePrimary.email,
      },
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

