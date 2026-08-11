import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  asAddressString,
  asObject,
  asStringArray,
  canonicalMessageMaterial,
  extractEmailAddress,
  messageAuthenticationPassed,
  messageReachedMailroom,
  sha256Hex,
} from "../_shared/mailroom-security.ts";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Security-Policy":
        "default-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      "Content-Type": "application/json; charset=utf-8",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    },
  });

const decodeWebhookSecret = (secret: string) => {
  const encoded = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const binary = atob(encoded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const timingSafeEqual = (left: string, right: string) => {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
};

const verifySvixWebhook = async (
  rawBody: string,
  headers: Headers,
  secret: string,
) => {
  const messageId = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signatures = headers.get("svix-signature");
  if (!messageId || !timestamp || !signatures) return false;

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;
  if (Math.abs(Date.now() / 1000 - timestampSeconds) > 300) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    decodeWebhookSecret(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = new TextEncoder().encode(
    `${messageId}.${timestamp}.${rawBody}`,
  );
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, signed));
  const expected = toBase64(digest);

  return signatures
    .split(" ")
    .some((candidate) => {
      const [version, signature] = candidate.split(",", 2);
      return version === "v1" && !!signature &&
        timingSafeEqual(signature, expected);
    });
};

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 2 * 1024 * 1024) {
    return jsonResponse({ error: "Request body is too large" }, 413);
  }

  const provider = (Deno.env.get("EMAIL_PROVIDER") ?? "resend").toLowerCase();
  const webhookSecret = Deno.env.get("EMAIL_WEBHOOK_SECRET");
  const apiKey = Deno.env.get("EMAIL_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!webhookSecret || !apiKey || !supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      { error: "Email webhook environment is incomplete" },
      503,
    );
  }
  if (!["resend", "agentmail"].includes(provider)) {
    return jsonResponse(
      { error: `Unsupported EMAIL_PROVIDER: ${provider}` },
      503,
    );
  }

  const rawBody = await req.text();
  if (new TextEncoder().encode(rawBody).byteLength > 2 * 1024 * 1024) {
    return jsonResponse({ error: "Request body is too large" }, 413);
  }
  if (!await verifySvixWebhook(rawBody, req.headers, webhookSecret)) {
    return jsonResponse({ error: "Invalid webhook signature" }, 401);
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const eventType = String(event.type ?? event.event_type ?? "");
  if (
    (provider === "resend" && eventType !== "email.received") ||
    (provider === "agentmail" && eventType !== "message.received")
  ) {
    return jsonResponse({ received: true, stored: false });
  }

  const webhookData = (event.data && typeof event.data === "object")
    ? event.data as Record<string, unknown>
    : {};

  // AgentMail's current message.received payload places the message at the
  // top-level `message` key. Older payloads and Resend use `data`.
  const agentMailMessage = provider === "agentmail" &&
      event.message &&
      typeof event.message === "object"
    ? event.message as Record<string, unknown>
    : null;

  let message = agentMailMessage ?? webhookData;
  let providerMessageId = String(
    message.email_id ??
      message.message_id ??
      message.id ??
      webhookData.email_id ??
      webhookData.message_id ??
      req.headers.get("svix-id") ??
      crypto.randomUUID(),
  );

  if (provider === "resend") {
    const response = await fetch(
      `https://api.resend.com/emails/receiving/${
        encodeURIComponent(providerMessageId)
      }`,
      {
        headers: { "Authorization": `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) {
      return jsonResponse({
        error: `Could not retrieve received email (${response.status})`,
      }, 502);
    }
    const result = await response.json() as Record<string, unknown>;
    message = result.data && typeof result.data === "object"
      ? result.data as Record<string, unknown>
      : result;
  } else {
    const inboxId = String(message.inbox_id ?? webhookData.inbox_id ?? "");
    if (inboxId && providerMessageId) {
      const response = await fetch(
        `https://api.agentmail.to/v0/inboxes/${
          encodeURIComponent(inboxId)
        }/messages/${encodeURIComponent(providerMessageId)}`,
        {
          headers: { "Authorization": `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (response.ok) {
        const result = await response.json() as Record<string, unknown>;
        message = result.message && typeof result.message === "object"
          ? result.message as Record<string, unknown>
          : result;
      }
    }
  }

  const { createClient } = await import("npm:@supabase/supabase-js@2.110.8");
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  providerMessageId = String(
    message.id ??
      message.email_id ??
      message.message_id ??
      providerMessageId,
  );

  const { data: existingEmail } = await supabase
    .from("inbound_emails")
    .select("id")
    .eq("provider", provider)
    .eq("provider_message_id", providerMessageId)
    .maybeSingle();
  if (existingEmail) {
    return jsonResponse({ received: true, stored: true, replay: true });
  }

  const toAddresses = asStringArray(message.to ?? webhookData.to);
  const ccAddresses = asStringArray(message.cc ?? webhookData.cc);
  const receivedForAddresses = asStringArray(
    message.received_for ?? message.receivedFor ?? webhookData.received_for ??
      webhookData.receivedFor,
  );
  const fromAddress = asAddressString(message.from ?? webhookData.from) || null;
  const headers = message.headers && typeof message.headers === "object"
    ? message.headers
    : {};
  const attachments = Array.isArray(message.attachments)
    ? message.attachments.slice(0, 100)
    : Array.isArray(webhookData.attachments)
    ? webhookData.attachments.slice(0, 100)
    : [];
  const normalizedMessage = {
    ...asObject(message),
    from: fromAddress,
    to: toAddresses,
    cc: ccAddresses,
    attachments,
  };
  const messageSha256 = await sha256Hex(
    canonicalMessageMaterial(normalizedMessage),
  );
  const receivedAt = String(
    message.created_at ?? webhookData.created_at ?? event.created_at ??
      new Date().toISOString(),
  );

  const { data: storedEmail, error } = await supabase
    .from("inbound_emails")
    .insert({
      provider,
      provider_message_id: providerMessageId,
      from_address: fromAddress,
      to_addresses: toAddresses,
      cc_addresses: ccAddresses,
      received_for_addresses: receivedForAddresses,
      subject:
        String(message.subject ?? webhookData.subject ?? "").slice(0, 1000) ||
        null,
      text_body: String(message.text ?? "").slice(0, 1_000_000) || null,
      html_body: String(message.html ?? "").slice(0, 1_000_000) || null,
      headers,
      attachments,
      raw_payload: event,
      message_sha256: messageSha256,
      received_at: receivedAt,
      retention_until: new Date(
        new Date(receivedAt).getTime() + 365 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error("Could not store inbound email:", error);
    return jsonResponse({ error: "Could not store inbound email" }, 500);
  }

  const configuredRecipient = Deno.env.get("MAILROOM_RECIPIENT") ??
    "mailroom@inbound.carpmasons.ca";
  const publicAlias = Deno.env.get("MAILROOM_PUBLIC_ADDRESS") ??
    "mailroom@carpmasons.ca";
  const reachedMailroom = messageReachedMailroom(
    [toAddresses, ccAddresses, receivedForAddresses],
    configuredRecipient,
    publicAlias,
  );
  if (!reachedMailroom || !messageAuthenticationPassed(headers)) {
    return jsonResponse({ received: true, stored: true, queued: false });
  }

  const senderEmail = extractEmailAddress(fromAddress);
  const { data: trustedSender } = await supabase
    .from("trusted_email_senders")
    .select("id")
    .eq("email", senderEmail)
    .eq("is_active", true)
    .maybeSingle();
  if (!trustedSender) {
    return jsonResponse({ received: true, stored: true, queued: false });
  }

  const automationMode = (Deno.env.get("MAILROOM_AUTOMATION_MODE") ?? "manual")
    .toLowerCase();
  if (!(["shadow", "active"] as string[]).includes(automationMode)) {
    return jsonResponse({ received: true, stored: true, queued: false });
  }

  const { data: duplicateEmail } = await supabase
    .from("inbound_emails")
    .select("id")
    .eq("message_sha256", messageSha256)
    .neq("id", storedEmail.id)
    .order("received_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  let duplicateImportId: string | null = null;
  if (duplicateEmail) {
    const { data: duplicateImport } = await supabase
      .from("mailroom_imports")
      .select("id")
      .eq("inbound_email_id", duplicateEmail.id)
      .maybeSingle();
    duplicateImportId = duplicateImport?.id ?? null;
  }

  const { error: queueError } = await supabase.from("mailroom_imports").insert({
    inbound_email_id: storedEmail.id,
    status: duplicateEmail ? "duplicate" : "queued",
    processing_mode: automationMode,
    sender_email: senderEmail,
    sender_verified: true,
    classification_tags: duplicateEmail ? ["no_action"] : [],
    summary: duplicateEmail
      ? "Exact duplicate message held without preparing another draft."
      : null,
    duplicate_of_import_id: duplicateImportId,
  });
  if (queueError) {
    console.error("Could not queue Mailroom message:", queueError);
    return jsonResponse({ error: "Could not queue Mailroom message" }, 500);
  }

  if (duplicateEmail) {
    await supabase.from("inbound_emails").update({
      processing_status: "ignored",
      processed_at: new Date().toISOString(),
    }).eq("id", storedEmail.id);
  }
  return jsonResponse({
    received: true,
    stored: true,
    queued: !duplicateEmail,
    duplicate: !!duplicateEmail,
  });
});
