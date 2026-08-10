import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.8";
import {
  contentLengthExceeds,
  handlePreflight,
  jsonResponse,
  rejectDisallowedOrigin,
} from "../_shared/http-security.ts";
import { clientAddress, consumeRateLimit } from "../_shared/rate-limit.ts";

const MAXIMUM_BODY_BYTES = 32 * 1024;
const SUBJECTS = new Set([
  "General Enquiry",
  "Interested in Joining",
  "Visiting the Lodge",
  "Lodge History",
  "Events & Meetings",
  "Other",
]);

type RequestBody = {
  name?: unknown;
  email?: unknown;
  subject?: unknown;
  message?: unknown;
  website?: unknown;
};

function cleanString(value: unknown) {
  return typeof value === "string" ? value.replace(/\r\n?/g, "\n").trim() : "";
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

  if (contentLengthExceeds(req, MAXIMUM_BODY_BYTES)) {
    return jsonResponse(req, { error: "Request body is too large" }, 413);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("submit-contact is missing required Supabase secrets");
    return jsonResponse(req, { error: "Service unavailable" }, 503);
  }

  let body: RequestBody;
  try {
    body = await req.json() as RequestBody;
  } catch {
    return jsonResponse(req, { error: "Invalid JSON body" }, 400);
  }

  // Honeypot fields are intentionally acknowledged without storing the payload.
  if (cleanString(body.website)) {
    return jsonResponse(req, { accepted: true }, 202);
  }

  const name = cleanString(body.name);
  const email = cleanString(body.email).toLowerCase();
  const requestedSubject = cleanString(body.subject);
  const subject = SUBJECTS.has(requestedSubject)
    ? requestedSubject
    : "General Enquiry";
  const message = cleanString(body.message);

  if (name.length < 2 || name.length > 120) {
    return jsonResponse(req, { error: "Enter a valid name" }, 400);
  }
  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return jsonResponse(req, { error: "Enter a valid email address" }, 400);
  }
  if (message.length < 10 || message.length > 5000) {
    return jsonResponse(
      req,
      { error: "Message must be between 10 and 5,000 characters" },
      400,
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const [ipLimit, emailLimit] = await Promise.all([
      consumeRateLimit(
        supabaseAdmin,
        "contact:ip",
        clientAddress(req),
        5,
        15 * 60,
      ),
      consumeRateLimit(
        supabaseAdmin,
        "contact:email",
        email,
        3,
        60 * 60,
      ),
    ]);

    if (!ipLimit.allowed || !emailLimit.allowed) {
      const retryAfter = Math.max(
        ipLimit.retry_after_seconds,
        emailLimit.retry_after_seconds,
        1,
      );
      return jsonResponse(
        req,
        { error: "Too many messages. Please try again later." },
        429,
        { "Retry-After": String(retryAfter) },
      );
    }

    const { error } = await supabaseAdmin.from("contact_submissions").insert({
      name,
      email,
      subject,
      message,
    });

    if (error) throw error;
    return jsonResponse(req, { accepted: true }, 202);
  } catch (error) {
    console.error("submit-contact failed:", error);
    return jsonResponse(req, { error: "Unable to submit message" }, 500);
  }
});
