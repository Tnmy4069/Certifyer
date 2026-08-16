import { NextRequest } from "next/server";
import { z } from "zod";
import { AppError, jsonError } from "@/lib/api";
import { connectDb } from "@/lib/db";
import { getCandidateAccessProvider } from "@/lib/candidate-access";
import { getClientIp, rateLimit } from "@/lib/security/rate-limit";
import { getStorage } from "@/lib/storage";
import { templateConfigSchema } from "@/lib/types";
import { renderCertificatePng, renderCertificatePdf, type RenderContext } from "@/lib/generation/render";
import { getRequestOrigin } from "@/lib/utils";
import { AuditEvent, Candidate, Certificate, CertificateTemplate, Event } from "@/models";

type Params = { params: Promise<{ certificateNumber: string }> };

const querySchema = z.object({
  eventSlug: z.string().min(1).optional(),
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
      eventSlug: searchParams.get("eventSlug") || undefined,
      email: searchParams.get("email"),
      token: searchParams.get("token"),
      format: searchParams.get("format"),
    });

    await connectDb();

    // Find certificate
    const certificate = await Certificate.findOne({
      certificateNumber: certificateNumber.toUpperCase(),
      status: "GENERATED",
    });
    if (!certificate) throw new AppError("Not found", 404);

    const event = await Event.findOne({
      _id: certificate.eventId,
      ...(query.eventSlug ? { slug: query.eventSlug } : {}),
      status: "PUBLISHED",
    });
    if (!event) throw new AppError("Not found", 404);

    const access = await getCandidateAccessProvider().verifyAccess({
      eventId: String(event._id),
      email: query.email,
      token: query.token,
    });
    if (!access.granted) throw new AppError("Access denied", 403);

    const candidate = await Candidate.findOne({ _id: certificate.candidateId });
    if (!candidate || candidate.email !== query.email.toLowerCase()) throw new AppError("Not found", 404);

    const template = await CertificateTemplate.findOne({ eventId: event._id });
    if (!template) throw new AppError("Template not found", 404);

    const storage = getStorage();
    const background = await storage.get(template.backgroundKey);
    const configuration = templateConfigSchema.parse(template.configuration);
    const baseUrl = getRequestOrigin(request);

    const context: RenderContext = {
      candidate: {
        name: candidate.name,
        email: candidate.email,
        phone: candidate.phone || "",
        role: candidate.role || "",
        organization: candidate.organization || "",
        department: candidate.department || "",
        metadata: (candidate.metadata as Record<string, unknown>) || {},
      },
      event: {
        name: event.name,
        organizerName: event.organizerName,
        eventDate: event.eventDate,
      },
      certificateNumber: certificate.certificateNumber,
      baseUrl,
    };

    const pngBuffer = await renderCertificatePng({
      background,
      width: template.width,
      height: template.height,
      configuration,
      context,
    });

    let data: Uint8Array = pngBuffer;
    if (query.format === "pdf") {
      data = await renderCertificatePdf(pngBuffer, template.width, template.height);
    }

    certificate.downloadCount += 1;
    await certificate.save();
    await Event.findByIdAndUpdate(event._id, { $inc: { downloadCount: 1 } });
    await AuditEvent.create({
      eventId: event._id,
      certificateId: certificate._id,
      actorType: "CANDIDATE",
      actorId: query.email,
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
