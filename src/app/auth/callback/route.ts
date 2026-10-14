import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/** Supabase magic-link landing: exchange the code for a session cookie, then go to the app. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  if (code) {
    const sb = await supabaseServer();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${safeNext}`);
    console.error("[auth/callback] code exchange failed:", error.message);
  } else {
    console.error("[auth/callback] no code:", searchParams.get("error_description") ?? "missing code");
  }
  return NextResponse.redirect(`${origin}/login?error=link`);
}
