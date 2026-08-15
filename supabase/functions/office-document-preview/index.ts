import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  createClient,
  type SupabaseClient,
} from "npm:@supabase/supabase-js@2.110.8";
import {
  contentLengthExceeds,
  handlePreflight,
  jsonResponse,
  rejectDisallowedOrigin,
} from "../_shared/http-security.ts";
import {
  buildOfficePreviewProxyUrl,
  createOfficePreviewToken,
  getOfficePreviewTokenFromUrl,
  verifyOfficePreviewToken,
} from "../_shared/office-preview-token.ts";
import { consumeRateLimit } from "../_shared/rate-limit.ts";

const PREVIEW_LIFETIME_SECONDS = 15 * 60;
const STORAGE_URL_LIFETIME_SECONDS = 2 * 60;
const ALLOWED_BUCKETS = new Set(["lodge-documents"]);
const OFFICE_FILE_PATTERN = /\.(doc|docx|xls|xlsx|ppt|pptx)$/i;

// The project has no generated Edge Function database type yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LodgeSupabaseClient = SupabaseClient<any, any, any, any, any>;

type DocumentRecord = {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string | null;
  storage_bucket: string | null;
};

type PreviewRequestBody = {
  documentId?: unknown;
};

function isOfficeDocument(document: DocumentRecord) {
  return OFFICE_FILE_PATTERN.test(document.file_name)
    || OFFICE_FILE_PATTERN.test(document.file_url);
}

function fileResponseHeaders(
  document: DocumentRecord,
  sourceHeaders: Headers,
) {
  const headers = new Headers({
    "Cache-Control": "private, no-store, max-age=0",
    "Content-Disposition":
      `inline; filename*=UTF-8''${encodeURIComponent(document.file_name)}`,
    "Content-Type": sourceHeaders.get("content-type")
      ?? document.file_type
      ?? "application/octet-stream",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  });

  for (const name of [
    "accept-ranges",
    "content-length",
    "content-range",
    "etag",
    "last-modified",
  ]) {
    const value = sourceHeaders.get(name);
    if (value) headers.set(name, value);
  }

  return headers;
}

async function findDocument(
  client: LodgeSupabaseClient,
  documentId: string,
) {
  return await client
    .from("documents")
    .select("id, file_url, file_name, file_type, storage_bucket")
    .eq("id", documentId)
    .maybeSingle<DocumentRecord>();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handlePreflight(req);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("office-document-preview is missing required Supabase secrets");
    return jsonResponse(req, { error: "Service unavailable" }, 503);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (req.method === "POST") {
    const originRejection = rejectDisallowedOrigin(req);
    if (originRejection) return originRejection;
    if (contentLengthExceeds(req, 1024)) {
      return jsonResponse(req, { error: "Request body is too large" }, 413);
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return jsonResponse(req, { error: "Sign in is required" }, 401);
    }

    let body: PreviewRequestBody;
    try {
      body = await req.json() as PreviewRequestBody;
    } catch {
      return jsonResponse(req, { error: "Invalid JSON body" }, 400);
    }
    const documentId = typeof body.documentId === "string"
      ? body.documentId.trim()
      : "";
    if (!/^[0-9a-f-]{36}$/i.test(documentId)) {
      return jsonResponse(req, { error: "Invalid document" }, 400);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) {
      return jsonResponse(req, { error: "Your sign-in has expired" }, 401);
    }

    try {
      const limit = await consumeRateLimit(
        adminClient,
        "office-document-preview:user",
        user.id,
        60,
        60 * 60,
      );
      if (!limit.allowed) {
        return jsonResponse(req, { error: "Too many preview requests" }, 429, {
          "Retry-After": String(Math.max(limit.retry_after_seconds, 1)),
        });
      }

      const { data: document, error: documentError } = await findDocument(
        userClient,
        documentId,
      );
      if (documentError) throw documentError;
      if (!document || !isOfficeDocument(document)) {
        return jsonResponse(req, { error: "Document not found" }, 404);
      }

      const bucket = document.storage_bucket || "lodge-documents";
      if (!ALLOWED_BUCKETS.has(bucket)) {
        return jsonResponse(req, { error: "Document cannot be previewed" }, 400);
      }

      const expiresAtSeconds = Math.floor(Date.now() / 1000)
        + PREVIEW_LIFETIME_SECONDS;
      const token = await createOfficePreviewToken(
        document.id,
        expiresAtSeconds,
        serviceRoleKey,
      );

      return jsonResponse(req, {
        previewUrl: buildOfficePreviewProxyUrl(
          supabaseUrl,
          token,
          document.file_name,
        ),
        expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
      });
    } catch (error) {
      console.error("office-document-preview token creation failed:", error);
      return jsonResponse(req, { error: "Preview is unavailable" }, 500);
    }
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    return jsonResponse(req, { error: "Method not allowed" }, 405, {
      "Allow": "GET, HEAD, POST, OPTIONS",
    });
  }

  const token = getOfficePreviewTokenFromUrl(req.url);
  const payload = await verifyOfficePreviewToken(token, serviceRoleKey);
  if (!payload) {
    return new Response("Preview link is invalid or expired", {
      status: 404,
      headers: { "Cache-Control": "no-store", "Content-Type": "text/plain" },
    });
  }

  try {
    const { data: document, error: documentError } = await findDocument(
      adminClient,
      payload.documentId,
    );
    if (documentError) throw documentError;
    if (!document || !isOfficeDocument(document)) {
      return new Response("Document not found", { status: 404 });
    }

    const bucket = document.storage_bucket || "lodge-documents";
    if (!ALLOWED_BUCKETS.has(bucket)) {
      return new Response("Document not found", { status: 404 });
    }

    const { data: signedData, error: signedError } = await adminClient.storage
      .from(bucket)
      .createSignedUrl(document.file_url, STORAGE_URL_LIFETIME_SECONDS);
    if (signedError || !signedData?.signedUrl) throw signedError;

    const sourceHeaders = new Headers();
    const range = req.headers.get("range");
    if (range) sourceHeaders.set("Range", range);
    const sourceResponse = await fetch(signedData.signedUrl, {
      method: req.method,
      headers: sourceHeaders,
    });
    if (!sourceResponse.ok) {
      console.error(
        "office-document-preview storage request failed:",
        sourceResponse.status,
      );
      return new Response("Preview is unavailable", { status: 502 });
    }

    return new Response(req.method === "HEAD" ? null : sourceResponse.body, {
      status: sourceResponse.status,
      headers: fileResponseHeaders(document, sourceResponse.headers),
    });
  } catch (error) {
    console.error("office-document-preview file proxy failed:", error);
    return new Response("Preview is unavailable", {
      status: 500,
      headers: { "Cache-Control": "no-store", "Content-Type": "text/plain" },
    });
  }
});
