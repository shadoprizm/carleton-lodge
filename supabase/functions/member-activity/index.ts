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
  type ActivityAuthUser,
  type ActivityProfile,
  type ActivityRosterMember,
  type ActivityTimestamp,
  buildMemberActivitySummaries,
} from "../_shared/member-activity.ts";
import { consumeRateLimit } from "../_shared/rate-limit.ts";

const AUTH_PAGE_SIZE = 1000;
const MAX_AUTH_PAGES = 50;

// The project has no generated Edge Function database type yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LodgeSupabaseClient = SupabaseClient<any, any, any, any, any>;

type RequestBody = {
  action?: unknown;
};

async function listAuthUsers(
  adminClient: LodgeSupabaseClient,
): Promise<ActivityAuthUser[]> {
  const users: ActivityAuthUser[] = [];

  for (let page = 1; page <= MAX_AUTH_PAGES; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: AUTH_PAGE_SIZE,
    });
    if (error) throw error;

    const pageUsers = (data?.users ?? []).map((user) => ({
      id: user.id,
      email: user.email,
      last_sign_in_at: user.last_sign_in_at,
    }));
    users.push(...pageUsers);

    if (pageUsers.length < AUTH_PAGE_SIZE) return users;
  }

  throw new Error("Auth user list exceeded the supported page limit");
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
  if (contentLengthExceeds(req, 1024)) {
    return jsonResponse(req, { error: "Request body is too large" }, 413);
  }

  const authHeader = req.headers.get("authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!authHeader) {
    return jsonResponse(req, { error: "Sign in is required" }, 401);
  }
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("member-activity is missing required Supabase secrets");
    return jsonResponse(req, { error: "Service unavailable" }, 503);
  }

  let body: RequestBody;
  try {
    body = await req.json() as RequestBody;
  } catch {
    return jsonResponse(req, { error: "Invalid JSON body" }, 400);
  }
  const action = typeof body.action === "string" ? body.action : "";
  if (!["heartbeat", "list"].includes(action)) {
    return jsonResponse(req, { error: "Invalid activity action" }, 400);
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

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const limit = await consumeRateLimit(
      adminClient,
      `member-activity-${action}:user`,
      user.id,
      action === "heartbeat" ? 120 : 60,
      60 * 60,
    );
    if (!limit.allowed) {
      return jsonResponse(req, { error: "Too many activity requests" }, 429, {
        "Retry-After": String(Math.max(limit.retry_after_seconds, 1)),
      });
    }

    if (action === "heartbeat") {
      const now = new Date().toISOString();
      const { error } = await adminClient.from("member_activity").upsert({
        profile_id: user.id,
        last_seen_at: now,
        updated_at: now,
      }, { onConflict: "profile_id" });
      if (error) throw error;
      return jsonResponse(req, { recorded: true });
    }

    const { data: canRead, error: permissionError } = await userClient.rpc(
      "has_admin_section_permission",
      { target_section: "activity", access_level: "read" },
    );
    if (permissionError) throw permissionError;
    if (canRead !== true) {
      return jsonResponse(req, { error: "Forbidden" }, 403);
    }

    const [
      authUsers,
      profilesResult,
      rosterResult,
      activityResult,
    ] = await Promise.all([
      listAuthUsers(adminClient),
      adminClient.from("profiles").select("id, email, created_at"),
      adminClient.from("lodge_members").select(
        "linked_profile_id, full_name",
      ),
      adminClient.from("member_activity").select(
        "profile_id, last_seen_at",
      ),
    ]);

    if (profilesResult.error) throw profilesResult.error;
    if (rosterResult.error) throw rosterResult.error;
    if (activityResult.error) throw activityResult.error;

    const members = buildMemberActivitySummaries(
      (profilesResult.data ?? []) as ActivityProfile[],
      authUsers,
      (rosterResult.data ?? []) as ActivityRosterMember[],
      (activityResult.data ?? []) as ActivityTimestamp[],
    );

    return jsonResponse(req, { members });
  } catch (error) {
    console.error("member-activity failed:", error);
    return jsonResponse(req, { error: "Member activity is unavailable" }, 500);
  }
});
