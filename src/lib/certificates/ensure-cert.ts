import type { Types } from "mongoose";
import { generateCertificateNumber } from "@/lib/certificates/ids";
import { Candidate, Certificate, Event } from "@/models";

/**
 * Finds or creates a Certificate record for a candidate.
 * Does NOT generate PNG / PDF — just ensures the DB record exists with
 * status NOT_GENERATED so that generation can happen on demand later.
 */
export async function ensureCertificateRecord(
  eventId: string | Types.ObjectId,
  candidateId: string | Types.ObjectId
) {
  const existing = await Certificate.findOne({ eventId, candidateId });
  if (existing) return existing;

  const event = await Event.findById(eventId);
  if (!event) throw new Error("Event not found");

  const candidate = await Candidate.findById(candidateId);
  if (!candidate) throw new Error("Candidate not found");

  const certificate = await Certificate.create({
    eventId: event._id,
    candidateId: candidate._id,
    certificateNumber: generateCertificateNumber(new Date(event.eventDate).getFullYear()),
    status: "NOT_GENERATED",
  });

  return certificate;
}
