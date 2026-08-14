import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function formatDate(value?: Date | string | null): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatShortDate(value?: Date | string | null): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

/**
 * Resolves the base URL dynamically.
 * Works across multiple domains, localhost, custom domains, Vercel preview URLs, etc.
 */
export function getBaseUrl(fallbackHost?: string): string {
  // If in browser, use current window origin automatically
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  // If an explicit host/origin override was supplied
  if (fallbackHost?.trim()) {
    const trimmed = fallbackHost.trim();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed.replace(/\/$/, "");
    }
    const proto = trimmed.includes("localhost") || trimmed.includes("127.0.0.1") ? "http" : "https";
    return `${proto}://${trimmed}`.replace(/\/$/, "");
  }

  // Check common deployment environments if no host is passed
  if (process.env.APP_URL?.trim()) return process.env.APP_URL.trim().replace(/\/$/, "");
  if (process.env.NEXTAUTH_URL?.trim()) return process.env.NEXTAUTH_URL.trim().replace(/\/$/, "");
  if (process.env.NEXT_PUBLIC_APP_URL?.trim()) return process.env.NEXT_PUBLIC_APP_URL.trim().replace(/\/$/, "");
  if (process.env.VERCEL_URL?.trim()) return `https://${process.env.VERCEL_URL.trim()}`.replace(/\/$/, "");

  return "http://localhost:3000";
}

/**
 * Extracts the incoming request's actual host & origin dynamically from headers or URL.
 */
export function getRequestOrigin(request?: Request | { headers: Headers; url?: string } | null): string {
  if (!request) return getBaseUrl();

  try {
    const headers = "headers" in request ? request.headers : null;
    const forwardedHost = headers?.get("x-forwarded-host")?.split(",")[0]?.trim();
    const host = forwardedHost || headers?.get("host")?.trim();

    if (host) {
      const forwardedProto = headers?.get("x-forwarded-proto")?.split(",")[0]?.trim();
      const proto =
        forwardedProto || (host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https");
      return `${proto}://${host}`;
    }

    if ("url" in request && request.url) {
      return new URL(request.url).origin;
    }
  } catch {
    // fallback
  }

  return getBaseUrl();
}

/**
 * Constructs an absolute URL relative to the active domain.
 */
export function absoluteUrl(path = "/", hostOverride?: string): string {
  const base = getBaseUrl(hostOverride);
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}
