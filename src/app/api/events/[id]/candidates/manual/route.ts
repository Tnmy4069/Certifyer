import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/auth";
import { AppError, jsonError, jsonOk, parseJson } from "@/lib/api";
import { connectDb } from "@/lib/db";
import { getOwnedEvent } from "@/lib/events/helpers";
import { Candidate, Event } from "@/models";

type Params = { params: Promise<{ id: string }> };

const manualCandidateSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email("Valid email is required").toLowerCase(),
  phone: z.string().max(50).optional().default(""),
  role: z.string().max(120).optional().default(""),
  organization: z.string().max(200).optional().default(""),
  department: z.string().max(200).optional().default(""),
});

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    await connectDb();
    const event = await getOwnedEvent(id, session.user.id);

    const body = manualCandidateSchema.parse(await parseJson<unknown>(request));

    // Check for exact identical candidate within this event (same email, role, and name)
    const existing = await Candidate.findOne({
      eventId: event._id,
      email: body.email,
      name: body.name,
      role: body.role,
    });
    if (existing) {
      throw new AppError(
        `A candidate entry for ${body.email} with role "${body.role || "default"}" already exists in this event.`,
        409,
        "DUPLICATE_CANDIDATE"
      );
    }

    const candidate = await Candidate.create({
      eventId: event._id,
      name: body.name,
      email: body.email,
      phone: body.phone,
      role: body.role,
      organization: body.organization,
      department: body.department,
    });

    const candidateCount = await Candidate.countDocuments({ eventId: event._id });
    await Event.updateOne({ _id: event._id }, { $set: { candidateCount } });

    return jsonOk({
      candidate: {
        id: String(candidate._id),
        name: candidate.name,
        email: candidate.email,
        phone: candidate.phone ?? "",
        role: candidate.role ?? "",
        organization: candidate.organization ?? "",
        department: candidate.department ?? "",
        metadata: {},
        createdAt: candidate.createdAt?.toISOString(),
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
