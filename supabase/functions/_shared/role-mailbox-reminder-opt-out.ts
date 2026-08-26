const TOKEN_CONTEXT = "role-mailbox-reminder-opt-out";

const base64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");

export const isValidRoleMailboxReminderOptOutToken = (
  value: unknown,
): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);

export async function createRoleMailboxReminderOptOutToken(
  secret: string,
  reminderIdempotencyKey: string,
) {
  if (secret.length < 32) {
    throw new Error(
      "The role-mailbox reminder secret is not configured safely",
    );
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(
      `${TOKEN_CONTEXT}:${reminderIdempotencyKey}`,
    ),
  );
  return base64Url(new Uint8Array(signature));
}

export async function hashRoleMailboxReminderOptOutToken(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
