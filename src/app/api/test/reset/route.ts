export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { isTestMode } from "@/lib/db";
import { resetMemoryStore } from "@/lib/db/memory";
import { sentEmails } from "@/lib/email";

/** Test-mode only: wipe the in-memory store so each e2e run starts clean. 404 in production. */
export async function POST() {
  if (!isTestMode) return NextResponse.json({ error: "Not found" }, { status: 404 });
  resetMemoryStore();
  sentEmails().length = 0;
  return NextResponse.json({ ok: true });
}

/** Test-mode only: what emails "went out". */
export async function GET() {
  if (!isTestMode) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ emails: sentEmails().map((e) => ({ to: e.to, subject: e.subject })) });
}
