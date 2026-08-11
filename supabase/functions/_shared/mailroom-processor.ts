import type { SupabaseClient } from "npm:@supabase/supabase-js@2.110.8";
import {
  asObject,
  extractEmailAddress,
  type JsonObject,
  messageAuthenticationPassed,
  sha256Hex,
} from "./mailroom-security.ts";
import {
  buildMailroomInstructions,
  type DirectoryLodge,
  legacyClassification,
  MAILROOM_PROMPT_VERSION,
  mailroomExtractionSchema,
  normalizeMailroomProposal,
} from "./mailroom-proposal.ts";

const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const MAX_COMBINED_BYTES = 45 * 1024 * 1024;
const SUPPORTED_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);
const SUPPORTED_EXTENSIONS = new Set([
  "pdf",
  "txt",
  "doc",
  "docx",
  "ppt",
  "pptx",
]);

export class MailroomProcessingError extends Error {
  transient: boolean;
  constructor(message: string, transient = false) {
    super(message);
    this.name = "MailroomProcessingError";
    this.transient = transient;
  }
}

const attachmentValue = (attachment: JsonObject, ...keys: string[]) => {
  for (const key of keys) {
    const value = attachment[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const attachmentName = (attachment: JsonObject) =>
  attachmentValue(attachment, "filename", "file_name", "name") || "attachment";

const attachmentType = (attachment: JsonObject) =>
  attachmentValue(attachment, "content_type", "contentType", "mime_type") ||
  "application/octet-stream";

const isSupportedAttachment = (attachment: JsonObject) => {
  const name = attachmentName(attachment).toLowerCase();
  const extension = name.includes(".") ? name.split(".").pop() ?? "" : "";
  return SUPPORTED_TYPES.has(attachmentType(attachment).toLowerCase()) ||
    SUPPORTED_EXTENSIONS.has(extension);
};

const safeFilename = (value: string, fallback = "mailroom-source") => {
  const normalized = value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-180);
  return normalized || fallback;
};

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32 * 1024) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, Math.min(offset + 32 * 1024, bytes.length)),
    );
  }
  return btoa(binary);
};

const readOutputText = (response: JsonObject) => {
  if (typeof response.output_text === "string") return response.output_text;
  if (!Array.isArray(response.output)) return "";
  for (const item of response.output) {
    const content = asObject(item).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      const candidate = asObject(part);
      if (
        candidate.type === "output_text" && typeof candidate.text === "string"
      ) return candidate.text;
    }
  }
  return "";
};

const downloadAttachment = async (
  provider: string,
  providerMessageId: string,
  attachment: JsonObject,
  rawPayload: unknown,
  apiKey: string,
) => {
  const attachmentId = attachmentValue(
    attachment,
    "id",
    "attachment_id",
    "attachmentId",
  );
  if (!attachmentId) {
    throw new MailroomProcessingError(
      "An attachment has no provider identifier",
    );
  }
  let metadataUrl: string;
  if (provider === "resend") {
    metadataUrl = `https://api.resend.com/emails/receiving/${
      encodeURIComponent(providerMessageId)
    }/attachments/${encodeURIComponent(attachmentId)}`;
  } else if (provider === "agentmail") {
    const raw = asObject(rawPayload);
    const message = asObject(raw.message);
    const data = asObject(raw.data);
    const inboxId = String(message.inbox_id ?? data.inbox_id ?? "");
    if (!inboxId) {
      throw new MailroomProcessingError(
        "The AgentMail inbox identifier is missing",
      );
    }
    metadataUrl = `https://api.agentmail.to/v0/inboxes/${
      encodeURIComponent(inboxId)
    }/messages/${encodeURIComponent(providerMessageId)}/attachments/${
      encodeURIComponent(attachmentId)
    }`;
  } else {
    throw new MailroomProcessingError(
      `Unsupported inbound provider: ${provider}`,
    );
  }

  const metadataResponse = await fetch(metadataUrl, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  if (!metadataResponse?.ok) {
    const status = metadataResponse?.status ?? 0;
    throw new MailroomProcessingError(
      `The email provider could not retrieve an attachment (${
        status || "network error"
      })`,
      status === 0 || status === 408 || status === 429 || status >= 500,
    );
  }
  const metadata = asObject(await metadataResponse.json());
  const nested = asObject(metadata.data);
  const downloadUrl = String(
    metadata.download_url ?? metadata.downloadUrl ?? nested.download_url ??
      nested.downloadUrl ?? "",
  );
  if (!downloadUrl.startsWith("https://")) {
    throw new MailroomProcessingError(
      "The email provider did not return a secure attachment URL",
    );
  }
  const fileResponse = await fetch(downloadUrl, {
    signal: AbortSignal.timeout(30_000),
  }).catch(() => null);
  if (!fileResponse?.ok) {
    const status = fileResponse?.status ?? 0;
    throw new MailroomProcessingError(
      `The attachment download failed (${status || "network error"})`,
      status === 0 || status === 408 || status === 429 || status >= 500,
    );
  }
  const declaredLength = Number(
    fileResponse.headers.get("content-length") ?? "0",
  );
  if (declaredLength > MAX_ATTACHMENT_BYTES) {
    throw new MailroomProcessingError("An attachment is larger than 20 MB");
  }
  const bytes = new Uint8Array(await fileResponse.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_ATTACHMENT_BYTES) {
    throw new MailroomProcessingError(
      "An attachment is empty or larger than 20 MB",
    );
  }
  if (
    attachmentType(attachment).toLowerCase() === "application/pdf" ||
    attachmentName(attachment).toLowerCase().endsWith(".pdf")
  ) {
    if (new TextDecoder("ascii").decode(bytes.subarray(0, 5)) !== "%PDF-") {
      throw new MailroomProcessingError(
        "An attachment labelled as PDF is not a valid PDF",
      );
    }
  }
  return bytes;
};

const callExtractor = async (
  openAiKey: string,
  model: string,
  instructions: string,
  content: JsonObject[],
) => {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      store: false,
      max_output_tokens: 9000,
      reasoning: { effort: "low" },
      instructions,
      input: [{ role: "user", content }],
      text: {
        format: {
          type: "json_schema",
          name: "intelligent_lodge_mailroom",
          strict: true,
          schema: mailroomExtractionSchema,
        },
      },
    }),
    signal: AbortSignal.timeout(90_000),
  }).catch(() => null);
  if (!response?.ok) {
    const status = response?.status ?? 0;
    const detail = response
      ? asObject(await response.json().catch(() => ({})))
      : {};
    console.error("Mailroom extraction failed", status, detail);
    throw new MailroomProcessingError(
      "The extraction service could not prepare this draft",
      status === 0 || status === 408 || status === 429 || status >= 500,
    );
  }
  const responseJson = asObject(await response.json());
  const output = readOutputText(responseJson);
  try {
    return asObject(JSON.parse(output));
  } catch {
    throw new MailroomProcessingError(
      "The extraction service returned an invalid structured draft",
      true,
    );
  }
};

const uploadSource = async (
  adminClient: SupabaseClient,
  importId: string,
  filename: string,
  bytes: Uint8Array,
  contentType: string,
  kind: "attachment" | "email_body",
  providerAttachmentId = "",
) => {
  const fileName = safeFilename(filename);
  const providerPrefix = kind === "attachment" && providerAttachmentId
    ? `${safeFilename(providerAttachmentId, "attachment").slice(0, 80)}-`
    : "";
  const storagePath = `mailroom/${importId}/${providerPrefix}${fileName}`;
  const { error } = await adminClient.storage.from("summons-uploads").upload(
    storagePath,
    bytes,
    {
      contentType,
      upsert: true,
    },
  );
  if (error) {
    throw new MailroomProcessingError(
      `The source file could not be retained: ${error.message}`,
      true,
    );
  }
  return {
    kind,
    storage_path: storagePath,
    file_name: fileName,
    file_size: bytes.length,
    content_type: contentType,
    provider_attachment_id: providerAttachmentId,
    sha256: await sha256Hex(bytes),
  };
};

export type PrepareMailroomOptions = {
  processingMode: "manual" | "shadow" | "active";
  claimed?: boolean;
};

export const prepareMailroomDraft = async (
  adminClient: SupabaseClient,
  inboundEmailId: string,
  options: PrepareMailroomOptions,
) => {
  const openAiKey = Deno.env.get("OPENAI_API_KEY");
  const emailApiKey = Deno.env.get("EMAIL_API_KEY");
  const model = Deno.env.get("MAILROOM_OPENAI_MODEL") ??
    Deno.env.get("OPENAI_MODEL") ?? "gpt-5.6-sol";
  if (!openAiKey || !emailApiKey) {
    throw new MailroomProcessingError(
      "Mailroom extraction is not configured yet",
    );
  }

  const [
    { data: email, error: emailError },
    { data: directoryData, error: directoryError },
  ] = await Promise.all([
    adminClient.from("inbound_emails").select("*").eq("id", inboundEmailId)
      .maybeSingle(),
    adminClient.from("district_lodges").select(
      "id, district_name, name, lodge_number, aliases, location",
    ).in("district_name", ["Ottawa District 1", "Ottawa District 2"]).order(
      "name",
    ),
  ]);
  if (emailError) throw new MailroomProcessingError(emailError.message, true);
  if (directoryError) {
    throw new MailroomProcessingError(directoryError.message, true);
  }
  if (!email) throw new MailroomProcessingError("Inbound email not found");
  if (email.content_purged_at) {
    throw new MailroomProcessingError(
      "This message has passed its content-retention period",
    );
  }

  const senderEmail = extractEmailAddress(email.from_address);
  const { data: trustedSender } = await adminClient.from(
    "trusted_email_senders",
  )
    .select("id").eq("email", senderEmail).eq("is_active", true).maybeSingle();
  if (!trustedSender) {
    throw new MailroomProcessingError(
      "Add this exact sender to the trusted-sender list before preparing a draft",
    );
  }
  if (!messageAuthenticationPassed(email.headers)) {
    throw new MailroomProcessingError(
      "This message did not pass the required DMARC or DKIM/SPF authentication checks",
    );
  }

  const { data: existingImport } = await adminClient.from("mailroom_imports")
    .select("*").eq("inbound_email_id", inboundEmailId).maybeSingle();
  if (
    ["needs_review", "approved", "duplicate"].includes(
      existingImport?.status ?? "",
    )
  ) return existingImport;
  if (existingImport?.status === "rejected") {
    throw new MailroomProcessingError("This email was already rejected");
  }

  const importId = existingImport?.id ?? crypto.randomUUID();
  if (!options.claimed) {
    const { error } = await adminClient.from("mailroom_imports").upsert({
      id: importId,
      inbound_email_id: inboundEmailId,
      status: "drafting",
      processing_mode: options.processingMode,
      sender_email: senderEmail,
      sender_verified: true,
      extracted_payload: {},
      approved_payload: null,
      reviewed_by: null,
      reviewed_at: null,
      locked_at: new Date().toISOString(),
      attempt_count: (existingImport?.attempt_count ?? 0) + 1,
      last_error: null,
      model,
      prompt_version: MAILROOM_PROMPT_VERSION,
    }, { onConflict: "inbound_email_id" });
    if (error) throw new MailroomProcessingError(error.message, true);
  }
  await adminClient.from("inbound_emails").update({
    processing_status: "processing",
    processed_at: null,
    last_error: null,
  }).eq("id", inboundEmailId);

  const attachments: JsonObject[] =
    (Array.isArray(email.attachments) ? email.attachments : []).map(asObject);
  const supported = attachments.filter(isSupportedAttachment).slice(0, 5);
  const unsupportedNames = attachments.filter((attachment) =>
    !isSupportedAttachment(attachment)
  ).map(attachmentName);
  const subject = String(email.subject ?? "").slice(0, 1000);
  const plainText = String(email.text_body ?? "").slice(0, 150_000);
  const htmlFallback = plainText ? "" : String(email.html_body ?? "")
    .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 150_000);
  const receivedDate = new Date(email.received_at).toLocaleString("en-CA", {
    timeZone: "America/Toronto",
  });
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Toronto",
  });
  const attachmentMetadata = attachments.map((attachment) => ({
    file_name: attachmentName(attachment),
    content_type: attachmentType(attachment),
    declared_size: Number(attachment.size ?? attachment.file_size ?? 0) || null,
    supported: isSupportedAttachment(attachment),
  }));
  const baseText =
    `TODAY (America/Toronto): ${today}\nRECEIVED: ${receivedDate}\nFORWARDED BY: ${senderEmail}\nSUBJECT: ${subject}\nATTACHMENT METADATA: ${
      JSON.stringify(attachmentMetadata)
    }\n\nEMAIL BODY\n${plainText || htmlFallback || "(no message body)"}`;
  const directory = (directoryData ?? []) as DirectoryLodge[];
  const instructions = buildMailroomInstructions(directory);
  let extraction = await callExtractor(openAiKey, model, instructions, [{
    type: "input_text",
    text: baseText,
  }]);

  const proposedTags = Array.isArray(extraction.classification_tags)
    ? extraction.classification_tags
    : [];
  const shouldOpenAttachments = extraction.needs_attachment_content === true ||
    proposedTags.some((tag) =>
      ["carleton_summons", "district_summons", "library_item"].includes(
        String(tag),
      )
    );
  const sourceFiles: JsonObject[] = [];
  const inputFiles: JsonObject[] = [];
  let combinedBytes = 0;
  if (shouldOpenAttachments) {
    for (const attachment of supported) {
      const bytes = await downloadAttachment(
        String(email.provider),
        String(email.provider_message_id),
        attachment,
        email.raw_payload,
        emailApiKey,
      );
      combinedBytes += bytes.length;
      if (combinedBytes > MAX_COMBINED_BYTES) {
        throw new MailroomProcessingError(
          "Supported attachments exceed the 45 MB Mailroom limit",
        );
      }
      const contentType = attachmentType(attachment);
      const retained = await uploadSource(
        adminClient,
        importId,
        attachmentName(attachment),
        bytes,
        contentType,
        "attachment",
        attachmentValue(attachment, "id", "attachment_id", "attachmentId"),
      );
      sourceFiles.push(retained);
      inputFiles.push({
        type: "input_file",
        filename: retained.file_name,
        file_data: `data:${contentType};base64,${toBase64(bytes)}`,
      });
    }
    if (inputFiles.length > 0) {
      extraction = await callExtractor(openAiKey, model, instructions, [
        {
          type: "input_text",
          text:
            `${baseText}\n\nSupported attachment contents are included below.`,
        },
        ...inputFiles,
      ]);
    }
  }

  const finalTags = Array.isArray(extraction.classification_tags)
    ? extraction.classification_tags.map(String)
    : [];
  const hasAction = finalTags.some((tag) =>
    !["sensitive_hold", "no_action"].includes(tag)
  );
  if (hasAction) {
    const bodyBytes = new TextEncoder().encode(
      `From: ${senderEmail}\nReceived: ${receivedDate}\nSubject: ${subject}\n\n${
        plainText || htmlFallback || "(no message body)"
      }`,
    );
    sourceFiles.push(
      await uploadSource(
        adminClient,
        importId,
        "email-source.txt",
        bodyBytes,
        "text/plain",
        "email_body",
      ),
    );
  }

  const proposal = normalizeMailroomProposal(
    extraction,
    directory,
    sourceFiles,
  );
  const normalizedTags = Array.isArray(proposal.classification_tags)
    ? proposal.classification_tags.filter((tag): tag is string =>
      typeof tag === "string"
    )
    : ["no_action"];
  if (unsupportedNames.length > 0) {
    proposal.warnings = [
      ...(Array.isArray(proposal.warnings)
        ? proposal.warnings.filter((warning): warning is string =>
          typeof warning === "string"
        )
        : []),
      `Unsupported attachments were not opened: ${
        unsupportedNames.join(", ")
      }.`,
    ];
  }
  const attachmentHashes = sourceFiles
    .filter((file) =>
      file.kind === "attachment" && typeof file.sha256 === "string"
    )
    .map((file) => String(file.sha256));
  if (
    attachmentHashes.length > 0 &&
    normalizedTags.some((tag) => tag.includes("summons"))
  ) {
    const { data: prior } = await adminClient.from("mailroom_imports")
      .select("id").neq("id", importId)
      .in("status", ["needs_review", "approved", "duplicate"])
      .overlaps("source_attachment_sha256", attachmentHashes)
      .order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (prior) {
      await adminClient.from("mailroom_imports").update({
        status: "duplicate",
        duplicate_of_import_id: prior.id,
        source_attachment_sha256: attachmentHashes,
        summary:
          "Duplicate summons attachment held without preparing another publication.",
        extracted_payload: proposal,
        locked_at: null,
      }).eq("id", importId);
      await adminClient.from("inbound_emails").update({
        processing_status: "ignored",
        processed_at: new Date().toISOString(),
      }).eq("id", inboundEmailId);
      return {
        id: importId,
        status: "duplicate",
        duplicate_of_import_id: prior.id,
      };
    }
  }

  const confidence = typeof proposal.confidence === "number"
    ? Math.max(0, Math.min(1, proposal.confidence))
    : null;
  const summary = typeof proposal.summary === "string"
    ? proposal.summary.slice(0, 4000)
    : "Draft prepared from inbound email.";
  const { data: savedImport, error: saveError } = await adminClient.from(
    "mailroom_imports",
  ).update({
    status: "needs_review",
    classification: legacyClassification(normalizedTags),
    classification_tags: normalizedTags,
    source_scope: proposal.source_scope,
    source_issuer: proposal.source_issuer || null,
    confidence,
    summary,
    extracted_payload: proposal,
    source_file_sha256: attachmentHashes[0] ?? null,
    source_attachment_sha256: attachmentHashes,
    model,
    prompt_version: MAILROOM_PROMPT_VERSION,
    locked_at: null,
    last_error: null,
  }).eq("id", importId).select("*").single();
  if (saveError) throw new MailroomProcessingError(saveError.message, true);
  return savedImport;
};
