import { randomBytes } from "node:crypto";

/** URL-safe, unguessable share slug (12 characters). */
export function generateShareSlug(): string {
  return randomBytes(9).toString("base64url");
}

export function appBaseUrl(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return new URL(request.url).origin.replace(/\/+$/, "");
}
