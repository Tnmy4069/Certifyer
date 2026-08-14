import { NextRequest } from "next/server";
import { requireAdmin } from "@/auth";
import { jsonError, jsonOk } from "@/lib/api";
import { connectDb } from "@/lib/db";
import { getOwnedEvent } from "@/lib/events/helpers";
import { Candidate, Certificate } from "@/models";
import { getStorage } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    await connectDb();
    const event = await getOwnedEvent(id, session.user.id);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const q = searchParams.get("q")?.trim();

    const filter: Record<string, unknown> = { eventId: event._id };
    if (status) filter.status = status;

    let certificates = await Certificate.find(filter).sort({ createdAt: -1 }).lean();

    if (q) {
      const candidates = await Candidate.find({
        eventId: event._id,
        $or: [
          { name: { $regex: q, $options: "i" } },
          { email: { $regex: q, $options: "i" } },
        ],
      }).select("_id");
      const ids = new Set(candidates.map((c) => String(c._id)));
      certificates = certificates.filter(
        (c) => ids.has(String(c.candidateId)) || c.certificateNumber.toLowerCase().includes(q.toLowerCase())
      );
    }

    const candidateIds = certificates.map((c) => c.candidateId);
    const candidates = await Candidate.find({ _id: { $in: candidateIds } }).lean();
    const candidateMap = new Map(candidates.map((c) => [String(c._id), c]));
    const storage = getStorage();

    return jsonOk({
      certificates: certificates.map((cert) => {
        const candidate = candidateMap.get(String(cert.candidateId));
        return {
          id: String(cert._id),
          certificateNumber: cert.certificateNumber,
          status: cert.status,
          issuedAt: cert.issuedAt,
          revokedAt: cert.revokedAt,
          downloadCount: cert.downloadCount,
          failureReason: cert.failureReason,
          candidate: candidate
            ? { id: String(candidate._id), name: candidate.name, email: candidate.email }
            : null,
          pngUrl: cert.pngKey ? storage.createSignedUrl(cert.pngKey) : null,
          pdfUrl: cert.pdfKey ? storage.createSignedUrl(cert.pdfKey) : null,
        };
      }),
    });
  } catch (error) {
    return jsonError(error);
  }
}
