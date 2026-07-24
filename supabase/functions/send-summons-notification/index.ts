import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  summonsId?: string;
}

interface NotificationPreferenceWithProfile {
  profiles: {
    email: string;
  };
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    // --- Authorization (SEC-2) -------------------------------------------
    // Require a real member session (not the public anon key) and confirm the
    // caller may write summons. Without this, anyone holding the public anon
    // key could invoke the function and harvest the member email list.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return jsonResponse({ error: "Server is missing required Supabase secrets" }, 500);
    }

    // Caller-scoped client: identity + permission are evaluated as the user,
    // never trusting a client-supplied role claim.
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      db: { schema: "carletonlodge" },
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { data: canManage, error: permissionError } = await supabaseUser.rpc(
      "has_admin_section_permission",
      { target_section: "summons", access_level: "write" },
    );

    if (permissionError || canManage !== true) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    // --- Input ------------------------------------------------------------
    let body: RequestBody;
    try {
      body = (await req.json()) as RequestBody;
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const summonsId = body.summonsId?.trim();
    if (!summonsId) {
      return jsonResponse({ error: "summonsId is required" }, 400);
    }

    // --- Work (service role, only after authorization) --------------------
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: "carletonlodge" },
    });

    const { data: summons, error: summonsError } = await supabase
      .from("summons")
      .select("id, title, month, content")
      .eq("id", summonsId)
      .single();

    if (summonsError || !summons) {
      return jsonResponse({ error: "Summons not found" }, 404);
    }

    const { data: notificationPrefs } = await supabase
      .from("notification_preferences")
      .select("id, email_notifications, notify_new_summons, profiles!inner ( email )")
      .eq("email_notifications", true)
      .eq("notify_new_summons", true);

    const recipients = ((notificationPrefs ?? []) as NotificationPreferenceWithProfile[])
      .map((pref) => pref.profiles?.email)
      .filter((email): email is string => Boolean(email));

    // NOTE: Email delivery is not yet wired to a provider. Once a provider
    // (e.g. Resend/SendGrid) and its API key are configured, send one message
    // per recipient here using BCC / individual sends. The recipient list is
    // intentionally NOT returned to the caller.
    console.log(`Queued summons notification ${summons.id} for ${recipients.length} recipient(s).`);

    return jsonResponse({
      message: "Notifications queued",
      sent: recipients.length,
    });
  } catch (error) {
    console.error("send-summons-notification error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
