import { NextRequest } from "next/server";
import { requireAdmin } from "@/auth";
import { jsonError, jsonOk } from "@/lib/api";
import { connectDb } from "@/lib/db";
import { getOwnedEvent } from "@/lib/events/helpers";
import { Candidate, Certificate } from "@/models";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    await connectDb();
    const event = await getOwnedEvent(id, session.user.id, session.user.role);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const q = searchParams.get("q")?.trim()?.toLowerCase();

    // Fetch all candidates and certificates for the event
    const [candidates, certs] = await Promise.all([
      Candidate.find({ eventId: event._id }).lean(),
      Certificate.find({ eventId: event._id }).lean(),
    ]);

    const certMapByCandidateId = new Map(certs.map((c) => [String(c.candidateId), c]));

    let results = candidates.map((candidate) => {
      const cert = certMapByCandidateId.get(String(candidate._id));
      if (cert) {
        const generated = cert.status === "GENERATED";
        const certId = String(cert._id);
        return {
          id: certId,
          certificateNumber: cert.certificateNumber,
          status: cert.status,
          issuedAt: cert.issuedAt,
          revokedAt: cert.revokedAt,
          downloadCount: cert.downloadCount,
          failureReason: cert.failureReason,
          candidate: { id: String(candidate._id), name: candidate.name, email: candidate.email },
          // Admin-auth download route (re-renders when stored files are missing).
          pngUrl: generated ? `/api/certificates/${certId}/download?format=png` : null,
          pdfUrl: generated ? `/api/certificates/${certId}/download?format=pdf` : null,
          createdAt: cert.createdAt || candidate.createdAt,
        };
      }

      return {
        id: `candidate:${candidate._id}`,
        certificateNumber: "—",
        status: "NOT_GENERATED",
        issuedAt: null,
        revokedAt: null,
        downloadCount: 0,
        failureReason: null,
        candidate: { id: String(candidate._id), name: candidate.name, email: candidate.email },
        pngUrl: null,
        pdfUrl: null,
        createdAt: candidate.createdAt,
      };
    });

    if (status) {
      results = results.filter((r) => r.status === status);
    }

    if (q) {
      results = results.filter(
        (r) =>
          r.candidate.name.toLowerCase().includes(q) ||
          r.candidate.email.toLowerCase().includes(q) ||
          r.certificateNumber.toLowerCase().includes(q),
      );
    }

    results.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    return jsonOk({
      certificates: results.map((r) => {
        const { createdAt, ...rest } = r;
        return rest;
      }),
    });
  } catch (error) {
    return jsonError(error);
  }
}
