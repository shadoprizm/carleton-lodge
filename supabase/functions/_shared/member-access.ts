export const MEMBER_ACCESS_GENERIC_MESSAGE =
  "If that email belongs to a Carleton Lodge member account, a six-digit code is on its way.";

// A single code covers both sign-in and first-time activation. Keeping this
// shared across both intents prevents a member from receiving a second,
// superseding code while the first one is still arriving.
export const MEMBER_ACCESS_CODE_EMAIL_MAX_REQUESTS = 1;
export const MEMBER_ACCESS_CODE_EMAIL_WINDOW_SECONDS = 10 * 60;

export function normalizeMemberEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isPlausibleMemberEmail(value: string) {
  return value.length > 3 &&
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function createUnknownPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const random = btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");

  return `Aa1!${random}`;
}
