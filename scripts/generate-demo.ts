import { config } from "dotenv";
config({ path: ".env.local" });

import { connectDb } from "../src/lib/db";
import { enqueueCertificateGeneration, processGenerationQueue } from "../src/lib/generation/queue";
import { Event, User } from "../src/models";

async function main() {
  await connectDb();
  const admin = await User.findOne({ email: "admin@certify.local" });
  const event = await Event.findOne({ slug: "techfest-2026" });
  if (!admin || !event) throw new Error("Seed admin/event missing. Run npm run seed first.");

  const batch = await enqueueCertificateGeneration({
    eventId: event._id,
    userId: String(admin._id),
  });
  console.log(`Queued batch ${batch._id} total=${batch.total}`);

  for (let i = 0; i < 20; i += 1) {
    const result = await processGenerationQueue({ limit: 5, workerId: "seed-gen" });
    console.log(`tick processed=${result.processed}`);
    if (result.processed === 0) break;
  }

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
