import { NextRequest } from "next/server";
import { requireAdmin } from "@/auth";
import { AppError, jsonError, jsonOk, parseJson } from "@/lib/api";
import { connectDb } from "@/lib/db";
import { getOwnedEvent } from "@/lib/events/helpers";
import {
  enqueueCertificateGeneration,
  getBatchProgress,
  processGenerationQueue,
} from "@/lib/generation/queue";
import { GenerationBatch } from "@/models";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    await connectDb();
    const event = await getOwnedEvent(id, session.user.id, session.user.role);
    const batch = await GenerationBatch.findOne({ eventId: event._id }).sort({ createdAt: -1 });
    return jsonOk({ batch: batch ? await getBatchProgress(String(batch._id)) : null });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    await connectDb();
    const event = await getOwnedEvent(id, session.user.id, session.user.role);
    const body = await parseJson<{ onlyFailed?: boolean }>(request).catch(() => ({ onlyFailed: false }));

    try {
      const batch = await enqueueCertificateGeneration({
        eventId: event._id,
        userId: session.user.id,
        onlyFailed: Boolean(body.onlyFailed),
      });
      await processGenerationQueue({ limit: 2, workerId: `admin-${session.user.id}` });
      return jsonOk({ batch: await getBatchProgress(String(batch._id)) });
    } catch (error) {
      throw new AppError(error instanceof Error ? error.message : "Could not start generation", 400);
    }
  } catch (error) {
    return jsonError(error);
  }
}
