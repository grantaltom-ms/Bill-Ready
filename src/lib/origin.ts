import { headers } from "next/headers";

/**
 * The origin the visitor is actually on (e.g. https://bill-ready.vercel.app or a preview URL).
 * Sign-in links must return to the same origin they were requested from: the browser holds a
 * one-time verifier cookie for that exact domain, and the link can't finish sign-in anywhere else.
 */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
