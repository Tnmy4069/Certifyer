import { NextRequest } from "next/server";
import { AppError, jsonError } from "@/lib/api";
import { getStorage } from "@/lib/storage";
import { rateLimit, getClientIp } from "@/lib/security/rate-limit";

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const limited = rateLimit(`signed-file:${ip}`, 120, 60_000);
    if (!limited.ok) {
      throw new AppError("Too many requests", 429, "RATE_LIMITED");
    }

    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");
    const expires = searchParams.get("expires");
    const signature = searchParams.get("signature");

    if (!key || !expires || !signature) {
      throw new AppError("Invalid signed URL", 400);
    }

    const storage = getStorage();
    if (!storage.verifySignedUrl(key, expires, signature)) {
      throw new AppError("Signed URL expired or invalid", 403, "FORBIDDEN");
    }

    const data = await storage.get(key);
    const ext = key.split(".").pop()?.toLowerCase();
    const mime =
      ext === "png"
        ? "image/png"
        : ext === "jpg" || ext === "jpeg"
          ? "image/jpeg"
          : ext === "webp"
            ? "image/webp"
            : ext === "pdf"
              ? "application/pdf"
              : "application/octet-stream";

    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
