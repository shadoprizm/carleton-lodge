export type JsonObject = Record<string, unknown>;

export const asObject = (value: unknown): JsonObject =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : {};

export const extractEmailAddress = (value: unknown) => {
  const input = typeof value === "string" ? value.trim().toLowerCase() : "";
  const bracketed = input.match(/<([^<>\s]+@[^<>\s]+)>/);
  return (bracketed?.[1] ?? input).replace(/^mailto:/, "").trim();
};

export const asAddressString = (value: unknown): string => {
  if (typeof value === "string") return value;
  const address = asObject(value);
  const email = typeof address.email === "string"
    ? address.email
    : typeof address.address === "string"
    ? address.address
    : "";
  const name = typeof address.name === "string" ? address.name.trim() : "";
  return name && email ? `${name} <${email}>` : email;
};

export const asStringArray = (value: unknown): string[] => {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];
  return values.map(asAddressString).filter(Boolean);
};

export const readHeader = (headers: unknown, name: string) => {
  const expected = name.toLowerCase();
  if (Array.isArray(headers)) {
    return headers.map(asObject)
      .filter((header) =>
        String(header.name ?? header.key ?? "").toLowerCase() === expected
      )
      .map((header) => String(header.value ?? ""))
      .filter(Boolean)
      .join("; ");
  }
  for (const [key, value] of Object.entries(asObject(headers))) {
    if (key.toLowerCase() !== expected) continue;
    if (typeof value === "string") return value;
    if (Array.isArray(value)) {
      return value.filter((item) => typeof item === "string").join("; ");
    }
  }
  return "";
};

export const messageAuthenticationPassed = (headers: unknown) => {
  const result = readHeader(headers, "authentication-results");
  const dmarc = /\bdmarc\s*=\s*pass\b/i.test(result);
  const dkim = /\bdkim\s*=\s*pass\b/i.test(result);
  const spf = /\bspf\s*=\s*pass\b/i.test(result);
  return dmarc || (dkim && spf);
};

export const messageReachedMailroom = (
  addressValues: unknown[],
  configuredRecipient = "mailroom@inbound.carpmasons.ca",
  publicAlias = "mailroom@carpmasons.ca",
) => {
  const accepted = new Set([
    extractEmailAddress(configuredRecipient),
    extractEmailAddress(publicAlias),
  ].filter(Boolean));
  return addressValues
    .flatMap(asStringArray)
    .map(extractEmailAddress)
    .some((address) => accepted.has(address));
};

export const sha256Hex = async (value: string | Uint8Array) => {
  const input = typeof value === "string"
    ? new TextEncoder().encode(value)
    : value;
  const copy = new Uint8Array(input.byteLength);
  copy.set(input);
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", copy.buffer),
  );
  return Array.from(digest)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

export const canonicalMessageMaterial = (message: JsonObject) =>
  JSON.stringify({
    from: extractEmailAddress(message.from ?? message.from_address),
    to: asStringArray(message.to ?? message.to_addresses).map(
      extractEmailAddress,
    ).sort(),
    cc: asStringArray(message.cc ?? message.cc_addresses).map(
      extractEmailAddress,
    ).sort(),
    subject: String(message.subject ?? "").trim(),
    text: String(message.text ?? message.text_body ?? "").replace(/\r\n/g, "\n")
      .trim(),
    html: String(message.html ?? message.html_body ?? "").replace(/\s+/g, " ")
      .trim(),
    attachments: (Array.isArray(message.attachments) ? message.attachments : [])
      .map(asObject)
      .map((attachment) => ({
        name: String(
          attachment.filename ?? attachment.file_name ?? attachment.name ?? "",
        ),
        type: String(
          attachment.content_type ?? attachment.contentType ??
            attachment.mime_type ?? "",
        ),
        size: Number(attachment.size ?? attachment.file_size ?? 0),
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
  });
