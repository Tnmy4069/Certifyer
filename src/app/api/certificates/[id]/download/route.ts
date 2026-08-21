import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/auth";
import { AppError, jsonError } from "@/lib/api";
import { connectDb } from "@/lib/db";
import { renderCertificatePdf, renderCertificatePng, type RenderContext } from "@/lib/generation/render";
import { getStorage } from "@/lib/storage";
import { templateConfigSchema } from "@/lib/types";
import { getRequestOrigin } from "@/lib/utils";
import { AuditEvent, Candidate, Certificate, CertificateTemplate, Event } from "@/models";
import mongoose from "mongoose";

type Params = { params: Promise<{ id: string }> };

const querySchema = z.object({
  format: z.enum(["png", "pdf"]).default("pdf"),
});

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const query = querySchema.parse({
      format: searchParams.get("format") || "pdf",
    });

    if (!mongoose.isValidObjectId(id)) throw new AppError("Certificate not found", 404);

    await connectDb();

    const certificate = await Certificate.findById(id);
    if (!certificate || certificate.status !== "GENERATED") {
      throw new AppError("Certificate not found or not generated", 404);
    }

    const eventFilter =
      session.user.role === "SUPER_ADMIN"
        ? { _id: certificate.eventId }
        : { _id: certificate.eventId, createdBy: session.user.id };

    const event = await Event.findOne(eventFilter);
    if (!event) throw new AppError("Certificate not found", 404);

    const storage = getStorage();
    const storedKey = query.format === "pdf" ? certificate.pdfKey : certificate.pngKey;

    let data: Buffer | null = null;
    if (storedKey) {
      try {
        data = await storage.get(storedKey);
      } catch {
        data = null;
      }
    }

    if (!data) {
      const [template, candidate] = await Promise.all([
        CertificateTemplate.findOne({ eventId: event._id }),
        Candidate.findById(certificate.candidateId),
      ]);
      if (!template || !candidate) throw new AppError("Certificate data incomplete", 500);

      const background = await storage.get(template.backgroundKey);
      const configuration = templateConfigSchema.parse(template.configuration);
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
        baseUrl: getRequestOrigin(request),
      };

      const pngBuffer = await renderCertificatePng({
        background,
        width: template.width,
        height: template.height,
        configuration,
        context,
      });

      data =
        query.format === "pdf"
          ? await renderCertificatePdf(pngBuffer, template.width, template.height)
          : pngBuffer;
    }

    certificate.downloadCount += 1;
    await certificate.save();
    await Event.findByIdAndUpdate(event._id, { $inc: { downloadCount: 1 } });
    await AuditEvent.create({
      eventId: event._id,
      certificateId: certificate._id,
      actorType: "ADMIN",
      actorId: session.user.id,
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
