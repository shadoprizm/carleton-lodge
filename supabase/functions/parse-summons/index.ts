import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.8";
import {
  contentLengthExceeds,
  handlePreflight,
  jsonResponse,
  rejectDisallowedOrigin,
} from "../_shared/http-security.ts";
import { consumeRateLimit } from "../_shared/rate-limit.ts";

const MAXIMUM_PDF_BYTES = 10 * 1024 * 1024;
const MAXIMUM_TEXT_BYTES = 1024 * 1024;

interface ParsedSummons {
  title: string;
  month: string;
  content: string;
}

function extractTextFromPDF(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder("latin1");
  const raw = decoder.decode(bytes);

  const textChunks: string[] = [];

  // Extract text from BT...ET blocks (standard PDF text objects)
  const btEtRegex = /BT([\s\S]*?)ET/g;
  let btMatch;
  while ((btMatch = btEtRegex.exec(raw)) !== null) {
    const block = btMatch[1];

    // Match Tj, TJ, ' and " operators
    // Tj: (text)Tj
    const tjRegex = /\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*Tj/g;
    let m;
    while ((m = tjRegex.exec(block)) !== null) {
      textChunks.push(decodePDFString(m[1]));
    }

    // TJ: [(text) num (text)]TJ
    const tjArrayRegex = /\[([\s\S]*?)\]\s*TJ/g;
    while ((m = tjArrayRegex.exec(block)) !== null) {
      const inner = m[1];
      const strRegex = /\(([^)\\]*(?:\\.[^)\\]*)*)\)/g;
      let sm;
      while ((sm = strRegex.exec(inner)) !== null) {
        textChunks.push(decodePDFString(sm[1]));
      }
    }

    // ' operator: (text)'
    const apostropheRegex = /\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*'/g;
    while ((m = apostropheRegex.exec(block)) !== null) {
      textChunks.push(decodePDFString(m[1]));
    }
  }

  // Also try to extract from stream objects for compressed content
  // Look for plain text strings outside BT/ET that might be in uncompressed streams
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let streamMatch;
  while ((streamMatch = streamRegex.exec(raw)) !== null) {
    const streamContent = streamMatch[1];
    // Only process if it looks like it contains text operators
    if (streamContent.includes("Tj") || streamContent.includes("TJ")) {
      const tjR = /\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*Tj/g;
      let sm;
      while ((sm = tjR.exec(streamContent)) !== null) {
        textChunks.push(decodePDFString(sm[1]));
      }
    }
  }

  const joined = textChunks
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();

  return joined;
}

function decodePDFString(s: string): string {
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(
      /\\([0-7]{1,3})/g,
      (_m, oct) => String.fromCharCode(parseInt(oct, 8)),
    )
    .replace(/\\(.)/g, "$1");
}

function parseContent(text: string): ParsedSummons {
  const lines = text.split(/[\n\r]+/).map((l) => l.trim()).filter(Boolean);
  const monthPattern =
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}\b/i;

  let title = "";
  let month = "";

  // Find month anywhere in first 30 lines
  for (const line of lines.slice(0, 30)) {
    const m = line.match(monthPattern);
    if (m && !month) {
      month = m[0].replace(/\b\w/g, (c) => c.toUpperCase());
    }
  }

  if (!month) {
    const m = text.match(monthPattern);
    if (m) month = m[0].replace(/\b\w/g, (c) => c.toUpperCase());
  }

  if (!month) {
    const now = new Date();
    month = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }

  // Pick a reasonable title from early lines
  for (const line of lines.slice(0, 15)) {
    if (
      line.length > 4 && line.length < 140 &&
      !line.match(/^(dear|to:|from:|\d+$)/i)
    ) {
      title = line;
      break;
    }
  }

  if (!title) title = `Summons — ${month}`;

  const content = lines.join("\n").trim();
  return { title, month, content };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handlePreflight(req);

  const originRejection = rejectDisallowedOrigin(req);
  if (originRejection) return originRejection;

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405, {
      "Allow": "POST, OPTIONS",
    });
  }
  if (contentLengthExceeds(req, MAXIMUM_PDF_BYTES + 64 * 1024)) {
    return jsonResponse(req, { error: "Request body is too large" }, 413);
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return jsonResponse(req, { error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("parse-summons is missing required secrets");
    return jsonResponse(req, { error: "Service unavailable" }, 503);
  }

  try {
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return jsonResponse(req, { error: "Unauthorized" }, 401);
    }

    const { data: canManage, error: permissionError } = await supabaseUser.rpc(
      "has_admin_section_permission",
      { target_section: "summons", access_level: "write" },
    );
    if (permissionError || canManage !== true) {
      return jsonResponse(req, { error: "Forbidden" }, 403);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const limit = await consumeRateLimit(
      supabaseAdmin,
      "parse-summons:user",
      user.id,
      10,
      60,
    );
    if (!limit.allowed) {
      return jsonResponse(
        req,
        { error: "Too many parsing requests. Please wait a moment." },
        429,
        { "Retry-After": String(Math.max(limit.retry_after_seconds, 1)) },
      );
    }

    const contentType = req.headers.get("content-type") ?? "";
    let rawText = "";
    let isPdf = false;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file");
      if (!(file instanceof File)) {
        return jsonResponse(req, { error: "No file provided" }, 400);
      }
      if (
        file.size <= 0 ||
        file.size > MAXIMUM_PDF_BYTES ||
        file.type !== "application/pdf" ||
        !file.name.toLowerCase().endsWith(".pdf")
      ) {
        return jsonResponse(
          req,
          { error: "A PDF up to 10 MB is required" },
          400,
        );
      }

      const buffer = await file.arrayBuffer();
      const magic = new TextDecoder("ascii").decode(
        new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 5)),
      );
      if (magic !== "%PDF-") {
        return jsonResponse(req, {
          error: "The uploaded file is not a valid PDF",
        }, 400);
      }

      isPdf = true;
      rawText = extractTextFromPDF(buffer);
    } else if (contentType.includes("application/json")) {
      let body: { text?: unknown; storagePath?: unknown };
      try {
        body = await req.json();
      } catch {
        return jsonResponse(req, { error: "Invalid JSON body" }, 400);
      }

      if (typeof body.text === "string") {
        if (
          new TextEncoder().encode(body.text).byteLength > MAXIMUM_TEXT_BYTES
        ) {
          return jsonResponse(req, { error: "Text content is too large" }, 413);
        }
        rawText = body.text;
      } else if (typeof body.storagePath === "string") {
        const storagePath = body.storagePath.trim();
        if (
          storagePath.length > 500 ||
          storagePath.includes("..") ||
          storagePath.startsWith("/") ||
          !storagePath.toLowerCase().endsWith(".pdf")
        ) {
          return jsonResponse(req, { error: "Invalid storage path" }, 400);
        }

        const { data, error } = await supabaseUser.storage
          .from("summons-uploads")
          .download(storagePath);
        if (error || !data) {
          return jsonResponse(req, { error: "File not found" }, 404);
        }
        if (data.size <= 0 || data.size > MAXIMUM_PDF_BYTES) {
          return jsonResponse(
            req,
            { error: "A PDF up to 10 MB is required" },
            400,
          );
        }

        const buffer = await data.arrayBuffer();
        const magic = new TextDecoder("ascii").decode(
          new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 5)),
        );
        if (magic !== "%PDF-") {
          return jsonResponse(
            req,
            { error: "Stored file is not a valid PDF" },
            400,
          );
        }
        isPdf = true;
        rawText = extractTextFromPDF(buffer);
      } else {
        return jsonResponse(
          req,
          { error: "Text or storagePath is required" },
          400,
        );
      }
    } else {
      return jsonResponse(req, { error: "Unsupported content type" }, 415);
    }

    if (!rawText.trim()) {
      return jsonResponse(req, {
        error: isPdf
          ? "Could not extract text from this PDF. It may be image-based; please enter the text manually."
          : "No text content found.",
      }, 400);
    }

    return jsonResponse(
      req,
      parseContent(rawText.slice(0, MAXIMUM_TEXT_BYTES)),
    );
  } catch (error) {
    console.error("parse-summons failed:", error);
    return jsonResponse(req, { error: "Internal server error" }, 500);
  }
});
