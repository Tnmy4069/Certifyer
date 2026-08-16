import { NextRequest } from "next/server";
import { connectDb } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import { templateConfigSchema } from "@/lib/types";
import { renderCertificatePng, type RenderContext } from "@/lib/generation/render";
import { getRequestOrigin } from "@/lib/utils";
import { Candidate, Certificate, CertificateTemplate, Event } from "@/models";

type Params = { params: Promise<{ certificateNumber: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { certificateNumber } = await params;
    await connectDb();

    const certificate = await Certificate.findOne({
      certificateNumber: certificateNumber.toUpperCase(),
      status: "GENERATED",
    });

    if (!certificate) {
      return new Response("Certificate not found", { status: 404 });
    }

    const [event, template, candidate] = await Promise.all([
      Event.findById(certificate.eventId),
      CertificateTemplate.findOne({ eventId: certificate.eventId }),
      Candidate.findById(certificate.candidateId),
    ]);

    if (!event || !template || !candidate) {
      return new Response("Invalid certificate data", { status: 500 });
    }

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

    return new Response(new Uint8Array(pngBuffer), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Failed to serve certificate preview:", error);
    return new Response("Error generating image", { status: 500 });
  }
}
