import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.8";
import {
  contentLengthExceeds,
  handlePreflight,
  jsonResponse,
  rejectDisallowedOrigin,
} from "../_shared/http-security.ts";
import { consumeRateLimit } from "../_shared/rate-limit.ts";

interface RequestBody {
  query?: unknown;
}

interface GooglePrediction {
  description?: unknown;
  place_id?: unknown;
  structured_formatting?: {
    main_text?: unknown;
    secondary_text?: unknown;
  };
}

function hasControlCharacters(value: string) {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
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
  if (contentLengthExceeds(req, 4096)) {
    return jsonResponse(req, { error: "Request body is too large" }, 413);
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return jsonResponse(req, { error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const googleApiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !googleApiKey) {
    console.error("places-autocomplete is missing required secrets");
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

    let body: RequestBody;
    try {
      body = await req.json() as RequestBody;
    } catch {
      return jsonResponse(req, { error: "Invalid JSON body" }, 400);
    }

    const query = typeof body.query === "string" ? body.query.trim() : "";
    if (query.length < 3) {
      return jsonResponse(req, { predictions: [] });
    }
    if (query.length > 200 || hasControlCharacters(query)) {
      return jsonResponse(req, { error: "Invalid search query" }, 400);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const limit = await consumeRateLimit(
      supabaseAdmin,
      "places:user",
      user.id,
      60,
      60,
    );
    if (!limit.allowed) {
      return jsonResponse(
        req,
        { error: "Too many searches. Please wait a moment." },
        429,
        { "Retry-After": String(Math.max(limit.retry_after_seconds, 1)) },
      );
    }

    const googleUrl = new URL(
      "https://maps.googleapis.com/maps/api/place/autocomplete/json",
    );
    googleUrl.searchParams.set("input", query);
    googleUrl.searchParams.set("types", "address");
    googleUrl.searchParams.set("key", googleApiKey);

    const googleResponse = await fetch(googleUrl, {
      method: "GET",
      signal: AbortSignal.timeout(6000),
    });
    if (!googleResponse.ok) {
      return jsonResponse(req, { error: "Address search unavailable" }, 502);
    }

    const googleBody = await googleResponse.json();
    const status = String(googleBody?.status ?? "");
    if (status !== "OK" && status !== "ZERO_RESULTS") {
      console.error("Google Places returned status:", status);
      return jsonResponse(req, { error: "Address search unavailable" }, 502);
    }

    const predictions = Array.isArray(googleBody?.predictions)
      ? (googleBody.predictions as GooglePrediction[])
        .slice(0, 6)
        .filter((prediction) =>
          typeof prediction.description === "string" &&
          typeof prediction.place_id === "string"
        )
        .map((prediction) => ({
          description: String(prediction.description).slice(0, 500),
          place_id: String(prediction.place_id).slice(0, 300),
          main_text:
            typeof prediction.structured_formatting?.main_text === "string"
              ? prediction.structured_formatting.main_text.slice(0, 300)
              : String(prediction.description).slice(0, 300),
          secondary_text:
            typeof prediction.structured_formatting?.secondary_text === "string"
              ? prediction.structured_formatting.secondary_text.slice(0, 300)
              : "",
        }))
      : [];

    return jsonResponse(req, { predictions });
  } catch (error) {
    console.error("places-autocomplete failed:", error);
    return jsonResponse(req, { error: "Internal server error" }, 500);
  }
});
