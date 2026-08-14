import { requireAdmin } from "@/auth";
import { jsonError, jsonOk } from "@/lib/api";
import { processGenerationQueue } from "@/lib/generation/queue";

export async function POST() {
  try {
    await requireAdmin();
    const result = await processGenerationQueue({ limit: 5, workerId: "api-tick" });
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
