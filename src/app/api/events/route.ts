import { NextRequest } from "next/server";
import { requireAdmin } from "@/auth";
import { AppError, jsonCreated, jsonError, jsonOk, parseJson } from "@/lib/api";
import { connectDb } from "@/lib/db";
import { serializeEvent } from "@/lib/events/helpers";
import { slugify } from "@/lib/utils";
import { createEventSchema } from "@/lib/validators/event";
import { Event } from "@/models";

export async function GET() {
  try {
    const session = await requireAdmin();
    await connectDb();
    const events = await Event.find({ createdBy: session.user.id }).sort({ createdAt: -1 });
    return jsonOk({ events: events.map(serializeEvent) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = await parseJson<unknown>(request);
    const data = createEventSchema.parse(body);
    await connectDb();

    const baseSlug = data.slug || slugify(data.name);
    if (!baseSlug) throw new AppError("Unable to generate a valid slug", 400);

    let slug = baseSlug;
    let attempt = 1;
    while (await Event.exists({ slug })) {
      attempt += 1;
      slug = `${baseSlug}-${attempt}`;
    }

    const eventDate = new Date(data.eventDate);
    if (Number.isNaN(eventDate.getTime())) {
      throw new AppError("Invalid event date", 400);
    }

    const event = await Event.create({
      name: data.name,
      slug,
      description: data.description || "",
      organizerName: data.organizerName,
      eventDate,
      location: data.location || "",
      createdBy: session.user.id,
      status: "DRAFT",
    });

    return jsonCreated({ event: serializeEvent(event) });
  } catch (error) {
    return jsonError(error);
  }
}
