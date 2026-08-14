import { createHmac, timingSafeEqual } from "crypto";
import { getEnv } from "@/lib/env";

export type CandidateAccessResult = {
  granted: boolean;
  reason?: string;
  token?: string;
};

/**
 * Candidate access provider abstraction.
 * Current MVP strategy: email-only (as requested).
 * Swap implementation later for OTP / magic-link without changing portal UI.
 */
export interface CandidateAccessProvider {
  requestAccess(input: { eventId: string; email: string }): Promise<CandidateAccessResult>;
  verifyAccess(input: { eventId: string; email: string; token?: string }): Promise<CandidateAccessResult>;
}

function sign(payload: string): string {
  return createHmac("sha256", getEnv().AUTH_SECRET).update(payload).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export class EmailOnlyAccessProvider implements CandidateAccessProvider {
  async requestAccess(input: { eventId: string; email: string }): Promise<CandidateAccessResult> {
    const expires = Math.floor(Date.now() / 1000) + 15 * 60;
    const payload = `${input.eventId}:${input.email.toLowerCase()}:${expires}`;
    const token = `${expires}.${sign(payload)}`;
    return { granted: true, token };
  }

  async verifyAccess(input: { eventId: string; email: string; token?: string }): Promise<CandidateAccessResult> {
    if (!input.token) return { granted: false, reason: "Missing access token" };
    const [expiresRaw, signature] = input.token.split(".");
    const expires = Number(expiresRaw);
    if (!expires || !signature || expires * 1000 < Date.now()) {
      return { granted: false, reason: "Access expired" };
    }
    const payload = `${input.eventId}:${input.email.toLowerCase()}:${expires}`;
    if (!safeEqual(sign(payload), signature)) {
      return { granted: false, reason: "Invalid access token" };
    }
    return { granted: true, token: input.token };
  }
}

let provider: CandidateAccessProvider | null = null;

export function getCandidateAccessProvider(): CandidateAccessProvider {
  if (!provider) provider = new EmailOnlyAccessProvider();
  return provider;
}
