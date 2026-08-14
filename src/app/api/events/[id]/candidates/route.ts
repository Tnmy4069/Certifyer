import { NextRequest } from "next/server";
import { requireAdmin } from "@/auth";
import { AppError, jsonError, jsonOk, parseJson } from "@/lib/api";
import { validateCandidateRows } from "@/lib/csv";
import { connectDb } from "@/lib/db";
import { getOwnedEvent } from "@/lib/events/helpers";
import { candidateImportSchema } from "@/lib/validators/event";
import { Candidate, Event } from "@/models";

type Params = { params: Promise<{ id: string }> };

function serializeCandidate(candidate: {
  _id: unknown;
  name: string;
  email: string;
  phone?: string;
  role?: string;
  organization?: string;
  department?: string;
  metadata?: unknown;
  createdAt?: Date;
}) {
  return {
    id: String(candidate._id),
    name: candidate.name,
    email: candidate.email,
    phone: candidate.phone ?? "",
    role: candidate.role ?? "",
    organization: candidate.organization ?? "",
    department: candidate.department ?? "",
    metadata: candidate.metadata ?? {},
    createdAt: candidate.createdAt,
  };
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    await connectDb();
    const event = await getOwnedEvent(id, session.user.id);
    const candidates = await Candidate.find({ eventId: event._id }).sort({ createdAt: -1 }).lean();

    return jsonOk({
      candidates: candidates.map(serializeCandidate),
      count: candidates.length,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const body = candidateImportSchema.parse(await parseJson<unknown>(request));
    const db = await connectDb();
    const event = await getOwnedEvent(id, session.user.id);

    const existingCandidates = await Candidate.find({ eventId: event._id }).select("email role name").lean();
    const existingKeys = existingCandidates.map(
      (c) => `${c.email.toLowerCase()}:::${(c.role || "").toLowerCase()}:::${c.name.toLowerCase()}`
    );
    const validation = validateCandidateRows(body.rows, body.mapping, existingKeys);
    const documents = validation.rows
      .filter((row) => row.status === "valid" && row.candidate)
      .map((row) => ({ ...row.candidate!, eventId: event._id }));

    if (documents.length === 0) {
      return jsonOk({ imported: 0, validation, candidateCount: existingCandidates.length });
    }

    const mongoSession = await db.startSession();
    try {
      await mongoSession.withTransaction(async () => {
        await Candidate.insertMany(documents, { session: mongoSession });
        const candidateCount = await Candidate.countDocuments({ eventId: event._id }).session(mongoSession);
        await Event.updateOne(
          { _id: event._id },
          { $set: { candidateCount } },
          { session: mongoSession }
        );
      });
    } catch (error) {
      if (!isTransactionUnsupported(error)) throw error;
      await Candidate.insertMany(documents);
      const candidateCount = await Candidate.countDocuments({ eventId: event._id });
      await Event.updateOne({ _id: event._id }, { $set: { candidateCount } });
    } finally {
      await mongoSession.endSession();
    }

    const candidateCount = await Candidate.countDocuments({ eventId: event._id });
    return jsonOk({
      imported: documents.length,
      validation,
      candidateCount,
    });
  } catch (error) {
    if (isDuplicateKey(error)) {
      return jsonError(new AppError("One or more emails were imported by another request. Validate the file again.", 409, "DUPLICATE_EMAIL"));
    }
    return jsonError(error);
  }
}

function isTransactionUnsupported(error: unknown) {
  if (!(error instanceof Error)) return false;
  return /Transaction numbers are only allowed|replica set member|mongos/i.test(error.message);
}

function isDuplicateKey(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: number }).code === 11000
  );
}
