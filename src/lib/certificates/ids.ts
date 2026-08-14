import { createHash, randomBytes } from "crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateCertificateNumber(year = new Date().getFullYear()): string {
  const bytes = randomBytes(6);
  let suffix = "";
  for (let i = 0; i < bytes.length; i += 1) {
    suffix += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return `CERT-${year}-${suffix}`;
}

export function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
