"use client";

import { useEffect, useRef, useState } from "react";
import type { VoiceDraft } from "@/lib/voice/draft";

export interface VoiceResult {
  transcript: string;
  draft: VoiceDraft;
}

const MAX_RECORD_MS = 90_000;
type Phase = "idle" | "recording" | "working";

function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported(m));
}

/** Phone-friendly push-to-talk: tap, speak the invoice, tap again. Hands back a draft to review. */
export function VoiceInvoice({ onDraft }: { onDraft: (result: VoiceResult) => void }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<number | null>(null);

  const releaseMic = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };

  // Don't leave the microphone on if the contractor navigates away mid-recording.
  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      if (recorder.current?.state === "recording") recorder.current.stop();
      releaseMic();
    };
  }, []);

  async function upload(mime: string) {
    const blob = new Blob(chunks.current, { type: mime });
    if (blob.size < 1000) {
      setPhase("idle");
      setError("I didn't catch anything. Tap the mic and try again.");
      return;
    }
    const body = new FormData();
    body.append("audio", blob, "invoice");
    try {
      const res = await fetch("/api/voice/invoice", { method: "POST", body });
      const data = (await res.json()) as { error?: string; transcript?: string; draft?: VoiceDraft };
      if (!res.ok || !data.draft || data.transcript === undefined) throw new Error(data.error ?? "Something went wrong.");
      setPhase("idle");
      onDraft({ transcript: data.transcript, draft: data.draft });
    } catch (err) {
      setPhase("idle");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  async function start() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("This browser can't record audio. Type the invoice below instead.");
      return;
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickMime();
      const rec = new MediaRecorder(stream.current, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };
      rec.onstop = () => {
        releaseMic();
        void upload(rec.mimeType || mime || "audio/webm");
      };
      rec.start();
      recorder.current = rec;
      setPhase("recording");
      timer.current = window.setTimeout(stop, MAX_RECORD_MS);
    } catch {
      releaseMic();
      setError("Bill Ready needs microphone access. Allow it in your browser settings, then try again.");
    }
  }

  function stop() {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    if (recorder.current?.state === "recording") {
      setPhase("working");
      recorder.current.stop();
    }
  }

  const label =
    phase === "recording" ? "Stop recording" : phase === "working" ? "Drafting the invoice…" : "Speak the invoice";

  return (
    <div className="card space-y-2">
      <button
        type="button"
        className={phase === "recording" ? "btn-primary w-full" : "btn-secondary w-full"}
        onClick={phase === "recording" ? stop : start}
        disabled={phase === "working"}
        aria-live="polite"
      >
        {label}
      </button>
      <p className="text-xs text-muted">
        {phase === "recording"
          ? "Speak the customer, then each item with quantity and price. Tap stop when you're done."
          : "Example: “For Henderson. Two hours of labor at 85, and a garbage disposal for 120 plus tax.”"}
      </p>
      {error && (
        <p role="alert" className="callout callout-error">
          {error}
        </p>
      )}
    </div>
  );
}
