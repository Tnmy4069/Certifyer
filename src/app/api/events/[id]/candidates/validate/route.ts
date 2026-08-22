import { NextRequest } from "next/server";
import { requireAdmin } from "@/auth";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { validateCandidateRows } from "@/lib/csv";
import { connectDb } from "@/lib/db";
import { getOwnedEvent } from "@/lib/events/helpers";
import { candidateImportSchema } from "@/lib/validators/event";
import { Candidate } from "@/models";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const body = candidateImportSchema.parse(await parseJson<unknown>(request));
    await connectDb();
    const event = await getOwnedEvent(id, session.user.id, session.user.role);
    // Projection-only lean query — fetches only 3 fields needed for duplicate detection
    const existingCandidates = await Candidate.find({ eventId: event._id })
      .select("email role name")
      .lean();
    const existingKeys = existingCandidates.map(
      (c) => `${c.email.toLowerCase()}:::${(c.role || "").toLowerCase()}:::${c.name.toLowerCase()}`
    );
    const validation = validateCandidateRows(body.rows, body.mapping, existingKeys);

    return jsonOk({ validation });
  } catch (error) {
    return jsonError(error);
  }
}
