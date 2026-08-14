import sharp from "sharp";
import { AppError } from "@/lib/api";

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_BYTES = 8 * 1024 * 1024;
const MIN_DIMENSION = 400;
const MAX_DIMENSION = 8000;

const SIGNATURES: Array<{ mime: string; check: (buf: Buffer) => boolean }> = [
  { mime: "image/png", check: (b) => b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { mime: "image/jpeg", check: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: "image/webp",
    check: (b) =>
      b.length >= 12 &&
      b.toString("ascii", 0, 4) === "RIFF" &&
      b.toString("ascii", 8, 12) === "WEBP",
  },
];

export async function validateAndNormalizeImage(file: File, options?: { maxBytes?: number }) {
  const maxBytes = options?.maxBytes ?? MAX_BYTES;
  if (file.size <= 0 || file.size > maxBytes) {
    throw new AppError(`Image must be between 1 byte and ${Math.floor(maxBytes / (1024 * 1024))}MB`, 400, "IMAGE_SIZE");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = SIGNATURES.find((s) => s.check(buffer))?.mime;
  if (!detected || !ALLOWED_MIME.has(detected)) {
    throw new AppError("Unsupported image format. Use PNG, JPG, JPEG, or WEBP.", 400, "IMAGE_TYPE");
  }

  if (file.type && file.type !== detected && !(file.type === "image/jpg" && detected === "image/jpeg")) {
    // Prefer magic bytes; warn only when claimed type is clearly wrong and non-empty
    if (!ALLOWED_MIME.has(file.type) && file.type !== "image/jpg") {
      throw new AppError("File extension/MIME type does not match image contents.", 400, "IMAGE_MIME_MISMATCH");
    }
  }

  const image = sharp(buffer, { failOn: "error" });
  const meta = await image.metadata();
  const width = meta.width || 0;
  const height = meta.height || 0;

  if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
    throw new AppError(`Image must be at least ${MIN_DIMENSION}px on each side.`, 400, "IMAGE_TOO_SMALL");
  }
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    throw new AppError(`Image dimensions cannot exceed ${MAX_DIMENSION}px.`, 400, "IMAGE_TOO_LARGE");
  }

  const normalized = await image.rotate().toBuffer({ resolveWithObject: true });

  return {
    buffer: normalized.data,
    width: normalized.info.width,
    height: normalized.info.height,
    mimeType: detected,
  };
}
