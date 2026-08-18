import mongoose from "mongoose";
import { AppError } from "@/lib/api";
import { Event } from "@/models";

export function canAccessAllEvents(role?: string) {
  return role === "SUPER_ADMIN";
}

export function eventAccessFilter(userId: string, role?: string) {
  return canAccessAllEvents(role) ? {} : { createdBy: userId };
}

export async function getOwnedEvent(eventId: string, userId: string, role?: string) {
  if (!mongoose.isValidObjectId(eventId)) {
    throw new AppError("Event not found", 404, "NOT_FOUND");
  }

  const event = await Event.findOne({
    _id: eventId,
    ...eventAccessFilter(userId, role),
  }).populate("createdBy", "name email");
  if (!event) {
    throw new AppError("Event not found", 404, "NOT_FOUND");
  }
  return event;
}

type PopulatedOwner = {
  _id?: unknown;
  id?: unknown;
  name?: string;
  email?: string;
};

function serializeOwner(createdBy: unknown) {
  if (!createdBy) return undefined;
  if (typeof createdBy === "object" && createdBy !== null && "name" in createdBy) {
    const owner = createdBy as PopulatedOwner;
    return {
      id: String(owner._id ?? owner.id ?? ""),
      name: owner.name ?? "",
      email: owner.email ?? "",
    };
  }
  return { id: String(createdBy), name: "", email: "" };
}

export function eventOwnerLabel(createdBy: unknown) {
  const owner = serializeOwner(createdBy);
  if (!owner?.name) return null;
  return owner.email ? `${owner.name} · ${owner.email}` : owner.name;
}

export function serializeEvent(event: InstanceType<typeof Event>) {
  const owner = serializeOwner(event.createdBy);
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
    createdBy: owner,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  };
}
