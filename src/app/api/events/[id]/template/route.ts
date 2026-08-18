import { NextRequest } from "next/server";
import { requireAdmin } from "@/auth";
import { AppError, jsonError, jsonOk } from "@/lib/api";
import { connectDb } from "@/lib/db";
import { getOwnedEvent } from "@/lib/events/helpers";
import { validateAndNormalizeImage } from "@/lib/images/validate";
import { getStorage, randomStorageId } from "@/lib/storage";
import { templateConfigSchema } from "@/lib/types";
import { CertificateTemplate } from "@/models";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    await connectDb();
    const event = await getOwnedEvent(id, session.user.id, session.user.role);
    const template = await CertificateTemplate.findOne({ eventId: event._id });
    if (!template) return jsonOk({ template: null });

    const storage = getStorage();
    return jsonOk({
      template: {
        id: String(template._id),
        backgroundKey: template.backgroundKey,
        backgroundUrl: storage.createSignedUrl(template.backgroundKey, 60 * 60),
        width: template.width,
        height: template.height,
        mimeType: template.mimeType,
        configuration: template.configuration,
      },
    });
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

    const form = await request.formData();
    const file = form.get("background");
    if (!(file instanceof File)) {
      throw new AppError("Certificate background image is required", 400);
    }

    const normalized = await validateAndNormalizeImage(file);
    const storage = getStorage();
    const key = `events/${event._id}/backgrounds/${randomStorageId()}.png`;
    // Normalize to PNG for consistent rendering
    const sharp = (await import("sharp")).default;
    const pngBuffer = await sharp(normalized.buffer).png().toBuffer();
    await storage.put(key, pngBuffer, "image/png");

    const existing = await CertificateTemplate.findOne({ eventId: event._id });
    if (existing) {
      existing.backgroundKey = key;
      existing.width = normalized.width;
      existing.height = normalized.height;
      existing.mimeType = "image/png";
      await existing.save();
      return jsonOk({
        template: {
          id: String(existing._id),
          backgroundKey: existing.backgroundKey,
          backgroundUrl: storage.createSignedUrl(existing.backgroundKey),
          width: existing.width,
          height: existing.height,
          mimeType: existing.mimeType,
          configuration: existing.configuration,
        },
      });
    }

    const template = await CertificateTemplate.create({
      eventId: event._id,
      backgroundKey: key,
      width: normalized.width,
      height: normalized.height,
      mimeType: "image/png",
      configuration: templateConfigSchema.parse({}),
    });

    return jsonOk({
      template: {
        id: String(template._id),
        backgroundKey: template.backgroundKey,
        backgroundUrl: storage.createSignedUrl(template.backgroundKey),
        width: template.width,
        height: template.height,
        mimeType: template.mimeType,
        configuration: template.configuration,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    await connectDb();
    const event = await getOwnedEvent(id, session.user.id, session.user.role);
    const body = await request.json();
    const configuration = templateConfigSchema.parse(body.configuration ?? body);

    const template = await CertificateTemplate.findOne({ eventId: event._id });
    if (!template) throw new AppError("Upload a certificate background first", 400);

    template.configuration = configuration;
    await template.save();

    return jsonOk({
      template: {
        id: String(template._id),
        backgroundKey: template.backgroundKey,
        width: template.width,
        height: template.height,
        mimeType: template.mimeType,
        configuration: template.configuration,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
