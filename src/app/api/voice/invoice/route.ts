import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { todayISO } from "@/lib/money";
import { normalizeDraft } from "@/lib/voice/draft";
import { MAX_AUDIO_BYTES, draftFromTranscript, transcribeAudio } from "@/lib/voice/providers";

export const dynamic = "force-dynamic";

/** Recording in, draft invoice out. Nothing is saved here; the contractor reviews first. */
export async function POST(request: Request) {
  const store = getStore();
  const user = await store.currentUser();
  if (!user) return NextResponse.json({ error: "Sign in again to use voice." }, { status: 401 });
  const contractor = await store.contractorForUser(user.id);
  if (!contractor) return NextResponse.json({ error: "Set up your business first." }, { status: 403 });

  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: "No recording received. Try again." }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "That recording is too long. Keep it under two minutes." }, { status: 413 });
  }

  try {
    const ext = audio.type.includes("mp4") ? "m4a" : audio.type.includes("ogg") ? "ogg" : "webm";
    const transcript = await transcribeAudio(audio, `invoice.${ext}`);
    if (!transcript.trim()) {
      return NextResponse.json({ error: "I couldn't make out any words. Hold the phone closer and try again." }, { status: 422 });
    }
    const customers = await store.listCustomers(contractor.id);
    const raw = await draftFromTranscript(transcript, todayISO(), customers.map((c) => c.display_name));
    const draft = normalizeDraft(raw, customers);
    return NextResponse.json({ transcript, draft });
  } catch (err) {
    // Log the reason, never the transcript or customer names.
    console.error("[voice] drafting failed:", err instanceof Error ? err.message : "unknown error");
    return NextResponse.json({ error: "Voice drafting didn't work this time. Try again, or type the invoice." }, { status: 502 });
  }
}
