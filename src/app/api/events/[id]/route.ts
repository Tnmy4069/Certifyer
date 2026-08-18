import { NextRequest } from "next/server";
import { requireAdmin } from "@/auth";
import { AppError, jsonError, jsonOk, parseJson } from "@/lib/api";
import { connectDb } from "@/lib/db";
import { getOwnedEvent, serializeEvent } from "@/lib/events/helpers";
import { updateEventSchema } from "@/lib/validators/event";
import { CertificateTemplate, Event } from "@/models";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    await connectDb();
    const event = await getOwnedEvent(id, session.user.id, session.user.role);
    const template = await CertificateTemplate.findOne({ eventId: event._id }).lean();
    return jsonOk({
      event: serializeEvent(event),
      template: template
        ? {
            id: String(template._id),
            backgroundKey: template.backgroundKey,
            width: template.width,
            height: template.height,
            mimeType: template.mimeType,
            configuration: template.configuration,
          }
        : null,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const body = await parseJson<unknown>(request);
    const data = updateEventSchema.parse(body);
    await connectDb();
    const event = await getOwnedEvent(id, session.user.id, session.user.role);

    if (data.name !== undefined) event.name = data.name;
    if (data.description !== undefined) event.description = data.description;
    if (data.organizerName !== undefined) event.organizerName = data.organizerName;
    if (data.location !== undefined) event.location = data.location;
    if (data.eventDate !== undefined) {
      const eventDate = new Date(data.eventDate);
      if (Number.isNaN(eventDate.getTime())) throw new AppError("Invalid event date", 400);
      event.eventDate = eventDate;
    }
    if (data.slug !== undefined) {
      const exists = await Event.exists({ slug: data.slug, _id: { $ne: event._id } });
      if (exists) throw new AppError("Slug already in use", 409, "SLUG_TAKEN");
      event.slug = data.slug;
    }
    if (data.status !== undefined) {
      if (data.status === "PUBLISHED") {
        const template = await CertificateTemplate.findOne({ eventId: event._id });
        if (!template) throw new AppError("Upload and design a certificate template before publishing.", 400);
        if (!template.configuration?.fields?.length) {
          throw new AppError("Add at least one template field before publishing.", 400);
        }
      }
      event.status = data.status;
    }
    if (data.linkedinOrganizationId !== undefined) event.linkedinOrganizationId = data.linkedinOrganizationId;
    if (data.linkedinCertificationName !== undefined) event.linkedinCertificationName = data.linkedinCertificationName;

    await event.save();
    return jsonOk({ event: serializeEvent(event) });
  } catch (error) {
    return jsonError(error);
  }
}
