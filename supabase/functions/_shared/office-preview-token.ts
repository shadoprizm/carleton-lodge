const TOKEN_VERSION = 1;
const UUID_BYTES = 16;
const EXPIRY_BYTES = 4;
const SIGNATURE_BYTES = 16;
const PAYLOAD_BYTES = 1 + UUID_BYTES + EXPIRY_BYTES;
const TOKEN_BYTES = PAYLOAD_BYTES + SIGNATURE_BYTES;
const MAX_TOKEN_LIFETIME_SECONDS = 20 * 60;

export type OfficePreviewTokenPayload = {
  documentId: string;
  expiresAtSeconds: number;
};

function encodeBase64Url(bytes: Uint8Array) {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function uuidToBytes(uuid: string) {
  const compact = uuid.replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(compact)) {
    throw new Error("Invalid document id");
  }

  const bytes = new Uint8Array(UUID_BYTES);
  for (let index = 0; index < UUID_BYTES; index += 1) {
    bytes[index] = Number.parseInt(compact.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function bytesToUuid(bytes: Uint8Array) {
  const compact = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return [
    compact.slice(0, 8),
    compact.slice(8, 12),
    compact.slice(12, 16),
    compact.slice(16, 20),
    compact.slice(20),
  ].join("-");
}

async function createSignature(payload: Uint8Array, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`carleton-office-preview:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signablePayload = new Uint8Array(payload.length);
  signablePayload.set(payload);
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, signablePayload.buffer),
  );
  return signature.slice(0, SIGNATURE_BYTES);
}

function signaturesMatch(actual: Uint8Array, expected: Uint8Array) {
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) {
    difference |= actual[index] ^ expected[index];
  }
  return difference === 0;
}

export async function createOfficePreviewToken(
  documentId: string,
  expiresAtSeconds: number,
  secret: string,
) {
  const payload = new Uint8Array(PAYLOAD_BYTES);
  payload[0] = TOKEN_VERSION;
  payload.set(uuidToBytes(documentId), 1);
  new DataView(payload.buffer).setUint32(
    1 + UUID_BYTES,
    expiresAtSeconds,
    false,
  );

  const signature = await createSignature(payload, secret);
  const token = new Uint8Array(TOKEN_BYTES);
  token.set(payload);
  token.set(signature, PAYLOAD_BYTES);
  return encodeBase64Url(token);
}

export async function verifyOfficePreviewToken(
  token: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<OfficePreviewTokenPayload | null> {
  try {
    const tokenBytes = decodeBase64Url(token);
    if (tokenBytes.length !== TOKEN_BYTES || tokenBytes[0] !== TOKEN_VERSION) {
      return null;
    }

    const payload = tokenBytes.slice(0, PAYLOAD_BYTES);
    const signature = tokenBytes.slice(PAYLOAD_BYTES);
    const expectedSignature = await createSignature(payload, secret);
    if (!signaturesMatch(signature, expectedSignature)) return null;

    const expiresAtSeconds = new DataView(
      payload.buffer,
      payload.byteOffset,
      payload.byteLength,
    ).getUint32(1 + UUID_BYTES, false);
    if (
      expiresAtSeconds <= nowSeconds
      || expiresAtSeconds > nowSeconds + MAX_TOKEN_LIFETIME_SECONDS
    ) {
      return null;
    }

    return {
      documentId: bytesToUuid(payload.slice(1, 1 + UUID_BYTES)),
      expiresAtSeconds,
    };
  } catch {
    return null;
  }
}
