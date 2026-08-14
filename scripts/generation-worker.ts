import { getEnv } from "@/lib/env";
import { processGenerationQueue } from "@/lib/generation/queue";

async function main() {
  getEnv();
  console.log("[worker] Certificate generation worker started");

  const tick = async () => {
    try {
      const result = await processGenerationQueue({ limit: 5 });
      if (result.processed > 0) {
        console.log(`[worker] processed=${result.processed} workerId=${result.workerId}`);
      }
    } catch (error) {
      console.error("[worker] error", error instanceof Error ? error.message : error);
    }
  };

  await tick();
  setInterval(tick, 2000);
}

main();
