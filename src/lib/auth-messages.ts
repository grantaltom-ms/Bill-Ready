/** Turn Supabase auth errors into something a contractor can act on. */
export function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("rate limit") || m.includes("for security purposes")) {
    return "Too many sign-in emails were sent recently. Wait a few minutes, then try again — or use the most recent link already in your inbox.";
  }
  if (m.includes("invalid") && m.includes("email")) return "That email address doesn't look right.";
  return message;
}

/** Messages for /login?error=… after a failed magic-link click. */
export function loginErrorMessage(code: string | undefined): string | null {
  if (!code) return null;
  if (code === "link") {
    return "That sign-in link didn't work. It may have expired, been used already, or been opened in a different browser than the one you requested it from. Request a new link and open it on this same device.";
  }
  return "Sign-in didn't complete. Request a new link and try again.";
}
