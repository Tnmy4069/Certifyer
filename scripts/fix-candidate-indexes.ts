import { config } from "dotenv";
config({ path: ".env.local" });

import mongoose from "mongoose";
import { connectDb } from "../src/lib/db";

const STALE_UNIQUE_INDEX = "eventId_1_email_1";

async function main() {
  await connectDb();
  const db = mongoose.connection.db;
  if (!db) throw new Error("No database handle");

  const candidates = db.collection("candidates");
  const indexes = await candidates.indexes();
  const stale = indexes.find((index) => index.name === STALE_UNIQUE_INDEX && index.unique);

  if (!stale) {
    console.log(`No unique ${STALE_UNIQUE_INDEX} index found; nothing to do.`);
    process.exit(0);
  }

  await candidates.dropIndex(STALE_UNIQUE_INDEX);
  await candidates.createIndex({ eventId: 1, email: 1 });
  console.log(`Recreated ${STALE_UNIQUE_INDEX} without the unique constraint.`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
