import mongoose from "mongoose";
import { AppError } from "@/lib/api";
import { Event } from "@/models";

export async function getOwnedEvent(eventId: string, userId: string) {
  if (!mongoose.isValidObjectId(eventId)) {
    throw new AppError("Event not found", 404, "NOT_FOUND");
  }

  const event = await Event.findOne({ _id: eventId, createdBy: userId });
  if (!event) {
    throw new AppError("Event not found", 404, "NOT_FOUND");
  }
  return event;
}

export function serializeEvent(event: InstanceType<typeof Event>) {
  return {
    id: String(event._id),
    name: event.name,
    slug: event.slug,
    description: event.description,
    organizerName: event.organizerName,
    eventDate: event.eventDate,
    location: event.location,
    logoKey: event.logoKey,
    status: event.status,
    candidateCount: event.candidateCount,
    generatedCount: event.generatedCount,
    downloadCount: event.downloadCount,
    verificationCount: event.verificationCount,
    failureCount: event.failureCount,
    linkedinOrganizationId: event.linkedinOrganizationId ?? "",
    linkedinCertificationName: event.linkedinCertificationName ?? "",
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  };
}
