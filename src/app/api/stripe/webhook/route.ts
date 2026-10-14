import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { parseWebhookEvent } from "@/lib/stripe";
import { handleStripeEvent } from "@/lib/webhook";

export const runtime = "nodejs";

/** Stripe calls this when a customer pays or a connected account's status changes. */
export async function POST(request: Request) {
  const raw = await request.text();
  let event;
  try {
    event = parseWebhookEvent(raw, request.headers.get("stripe-signature"));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
  const result = await handleStripeEvent(event, getStore());
  return NextResponse.json({ received: true, ...result });
}
