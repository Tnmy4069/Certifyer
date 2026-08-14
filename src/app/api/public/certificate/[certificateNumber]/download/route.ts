import { NextRequest } from "next/server";
import { z } from "zod";
import { AppError, jsonError } from "@/lib/api";
import { connectDb } from "@/lib/db";
import { getCandidateAccessProvider } from "@/lib/candidate-access";
import { getClientIp, rateLimit } from "@/lib/security/rate-limit";
import { getStorage } from "@/lib/storage";
import { AuditEvent, Candidate, Certificate, Event } from "@/models";

type Params = { params: Promise<{ certificateNumber: string }> };

const querySchema = z.object({
  eventSlug: z.string().min(1),
  email: z.string().email(),
  token: z.string().min(10),
  format: z.enum(["png", "pdf"]),
});

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const ip = getClientIp(request);
    const limited = rateLimit(`public-download:${ip}`, 30, 60_000);
    if (!limited.ok) throw new AppError("Too many requests", 429, "RATE_LIMITED");

    const { certificateNumber } = await params;
    const { searchParams } = new URL(request.url);
    const query = querySchema.parse({
      eventSlug: searchParams.get("eventSlug"),
      email: searchParams.get("email"),
      token: searchParams.get("token"),
      format: searchParams.get("format"),
    });

    await connectDb();
    const event = await Event.findOne({ slug: query.eventSlug, status: "PUBLISHED" });
    if (!event) throw new AppError("Not found", 404);

    const access = await getCandidateAccessProvider().verifyAccess({
      eventId: String(event._id),
      email: query.email,
      token: query.token,
    });
    if (!access.granted) throw new AppError("Access denied", 403);

    const candidate = await Candidate.findOne({ eventId: event._id, email: query.email.toLowerCase() });
    if (!candidate) throw new AppError("Not found", 404);

    const certificate = await Certificate.findOne({
      eventId: event._id,
      candidateId: candidate._id,
      certificateNumber: certificateNumber.toUpperCase(),
      status: "GENERATED",
    });
    if (!certificate) throw new AppError("Not found", 404);

    const key = query.format === "png" ? certificate.pngKey : certificate.pdfKey;
    if (!key) throw new AppError("File not available", 404);

    const storage = getStorage();
    const data = await storage.get(key);

    certificate.downloadCount += 1;
    await certificate.save();
    await Event.findByIdAndUpdate(event._id, { $inc: { downloadCount: 1 } });
    await AuditEvent.create({
      eventId: event._id,
      certificateId: certificate._id,
      actorType: "CANDIDATE",
      actorId: candidate.email,
      action: `certificate.download.${query.format}`,
    });

    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": query.format === "png" ? "image/png" : "application/pdf",
        "Content-Disposition": `attachment; filename="${certificate.certificateNumber}.${query.format}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
