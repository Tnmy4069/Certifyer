import { NextRequest } from "next/server";
import { connectDb } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import { Certificate } from "@/models";

type Params = { params: Promise<{ certificateNumber: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { certificateNumber } = await params;
    await connectDb();

    const certificate = await Certificate.findOne({
      certificateNumber: certificateNumber.toUpperCase(),
      status: "GENERATED",
    });

    if (!certificate || !certificate.pngKey) {
      return new Response("Certificate image not found", { status: 404 });
    }

    const storage = getStorage();
    const data = await storage.get(certificate.pngKey);

    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch (error) {
    console.error("Failed to serve certificate preview:", error);
    return new Response("Error loading image", { status: 500 });
  }
}
