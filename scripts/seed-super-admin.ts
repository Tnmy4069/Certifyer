import { config } from "dotenv";
config({ path: ".env.local" });

import { hashPassword } from "../src/auth";
import { connectDb } from "../src/lib/db";
import { getEnv } from "../src/lib/env";
import { User } from "../src/models";

async function main() {
  const env = getEnv();
  await connectDb();

  await User.findOneAndUpdate(
    { email: env.SUPER_ADMIN_EMAIL.toLowerCase() },
    {
      $set: {
        name: env.SUPER_ADMIN_NAME,
        email: env.SUPER_ADMIN_EMAIL.toLowerCase(),
        passwordHash: await hashPassword(env.SUPER_ADMIN_PASSWORD),
        role: "SUPER_ADMIN",
      },
    },
    { upsert: true, returnDocument: "after" }
  );

  console.log(`Super admin synced: ${env.SUPER_ADMIN_EMAIL}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
