import { z } from "zod";

const envSchema = z.object({
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  AUTH_SECRET: z.string().min(16, "AUTH_SECRET must be at least 16 characters"),
  NEXTAUTH_URL: z.string().url().optional(),
  APP_URL: z.string().url().default("http://localhost:3000"),
  STORAGE_ROOT: z.string().default("./storage"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SUPER_ADMIN_EMAIL: z.string().email().default("admin@certify.local"),
  SUPER_ADMIN_PASSWORD: z.string().min(8).default("Admin123!"),
  SUPER_ADMIN_NAME: z.string().default("Certify Super Admin"),
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cached) return cached;
  const parsed = envSchema.safeParse({
    MONGODB_URI: process.env.MONGODB_URI,
    AUTH_SECRET: process.env.AUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    APP_URL: process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000",
    STORAGE_ROOT: process.env.STORAGE_ROOT || "./storage",
    NODE_ENV: process.env.NODE_ENV || "development",
    SUPER_ADMIN_EMAIL: process.env.SUPER_ADMIN_EMAIL,
    SUPER_ADMIN_PASSWORD: process.env.SUPER_ADMIN_PASSWORD,
    SUPER_ADMIN_NAME: process.env.SUPER_ADMIN_NAME,
  });

  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment: ${message}`);
  }

  cached = parsed.data;
  return cached;
}
