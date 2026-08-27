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
  createUnknownPassword,
  isPlausibleMemberEmail,
  MEMBER_ACCESS_CODE_EMAIL_MAX_REQUESTS,
  MEMBER_ACCESS_CODE_EMAIL_WINDOW_SECONDS,
  MEMBER_ACCESS_GENERIC_MESSAGE,
  normalizeMemberEmail,
} from "../_shared/member-access.ts";
import { clientAddress, consumeRateLimit } from "../_shared/rate-limit.ts";

// The project does not yet generate Edge Function database types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LodgeSupabaseClient = SupabaseClient<any, any, any, any, any>;

type RequestIntent = "activation" | "sign_in";

type RosterMember = {
  id: string;
  full_name: string;
  email: string | null;
  linked_profile_id: string | null;
};

type AuthUserSummary = {
  id: string;
  email?: string;
};

const genericResponse = (req: Request) =>
  jsonResponse(req, { message: MEMBER_ACCESS_GENERIC_MESSAGE }, 202);

async function findAuthUserByEmail(
  supabaseAdmin: LodgeSupabaseClient,
  email: string,
) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 100,
    });
    if (error) throw error;

    const users = (data?.users ?? []) as AuthUserSummary[];
    const match = users.find((user) =>
      normalizeMemberEmail(user.email) === email
    );
    if (match) return match;
    if (users.length < 100) return null;
  }

  throw new Error("Auth user lookup exceeded the supported page limit");
}

async function processNotificationQueue(
  supabaseUrl: string,
  serviceRoleKey: string,
) {
  const response = await fetch(
    `${supabaseUrl.replace(/\/$/, "")}/functions/v1/cl-process-notifications`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "apikey": serviceRoleKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ batchSize: 10 }),
    },
  );

  if (!response.ok) {
    throw new Error(`Notification processor returned HTTP ${response.status}`);
  }
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
  if (contentLengthExceeds(req, 2048)) {
    return jsonResponse(req, { error: "Request body is too large" }, 413);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(req, { error: "Account service unavailable" }, 503);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as LodgeSupabaseClient;

  const body = await req.json().catch(() => ({})) as {
    email?: unknown;
    intent?: unknown;
  };
  const email = normalizeMemberEmail(body.email);
  const intent: RequestIntent = body.intent === "sign_in"
    ? "sign_in"
    : "activation";

  try {
    const [ipLimit, emailLimit] = await Promise.all([
      consumeRateLimit(
        supabaseAdmin,
        "member-access-code-ip",
        clientAddress(req),
        12,
        15 * 60,
      ),
      consumeRateLimit(
        supabaseAdmin,
        "member-access-code-email",
        email || "invalid",
        MEMBER_ACCESS_CODE_EMAIL_MAX_REQUESTS,
        MEMBER_ACCESS_CODE_EMAIL_WINDOW_SECONDS,
      ),
    ]);

    if (!ipLimit.allowed || !emailLimit.allowed) {
      return jsonResponse(
        req,
        {
          error:
            "A code was sent recently. Please wait up to 10 minutes before requesting another.",
        },
        429,
        {
          "Retry-After": String(
            Math.max(
              ipLimit.retry_after_seconds,
              emailLimit.retry_after_seconds,
            ),
          ),
        },
      );
    }

    if (!isPlausibleMemberEmail(email)) return genericResponse(req);

    const { data: rosterRows, error: rosterError } = await supabaseAdmin
      .from("lodge_members")
      .select("id, full_name, email, linked_profile_id")
      .not("email", "is", null);
    if (rosterError) throw rosterError;

    const matchingMembers = ((rosterRows ?? []) as RosterMember[]).filter(
      (member) => normalizeMemberEmail(member.email) === email,
    );
    if (matchingMembers.length !== 1) return genericResponse(req);

    const member = matchingMembers[0];
    let authUser: AuthUserSummary | null = null;

    if (member.linked_profile_id) {
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(
        member.linked_profile_id,
      );
      if (error) throw error;
      authUser = data.user as AuthUserSummary | null;
    } else if (intent === "activation") {
      authUser = await findAuthUserByEmail(supabaseAdmin, email);
    }

    if (intent === "sign_in" && !authUser) return genericResponse(req);

    if (!authUser) {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: createUnknownPassword(),
        email_confirm: true,
        user_metadata: { membership_activation: true },
      });
      if (error) throw error;
      authUser = data.user as AuthUserSummary | null;
    }
    if (!authUser?.id) throw new Error("Could not establish an auth account");

    const { data: linkedElsewhere, error: linkedElsewhereError } =
      await supabaseAdmin
        .from("lodge_members")
        .select("id")
        .eq("linked_profile_id", authUser.id)
        .neq("id", member.id)
        .limit(1)
        .maybeSingle();
    if (linkedElsewhereError) throw linkedElsewhereError;
    if (linkedElsewhere) return genericResponse(req);

    if (normalizeMemberEmail(authUser.email) !== email) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(
        authUser.id,
        { email, email_confirm: true },
      );
      if (error) throw error;
    }

    const now = new Date().toISOString();
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
      {
        id: authUser.id,
        email,
        force_password_change: false,
        updated_at: now,
      },
    );
    if (profileError) throw profileError;

    const { error: memberError } = await supabaseAdmin
      .from("lodge_members")
      .update({
        linked_profile_id: authUser.id,
        ...(intent === "activation"
          ? { website_activation_requested_at: now }
          : {}),
        updated_at: now,
      })
      .eq("id", member.id);
    if (memberError) throw memberError;

    const { error: notificationError } = await supabaseAdmin
      .from("notification_outbox")
      .insert({
        notification_type: "member_access_code",
        recipient_profile_id: authUser.id,
        recipient_email: email,
        payload: {
          member_id: member.id,
          member_name: member.full_name,
          intent,
        },
        idempotency_key:
          `member-access-code:${authUser.id}:${crypto.randomUUID()}`,
        max_attempts: 3,
      });
    if (notificationError) throw notificationError;

    try {
      await processNotificationQueue(supabaseUrl, serviceRoleKey);
    } catch (processorError) {
      console.error(
        "Member access code remains queued:",
        processorError instanceof Error
          ? processorError.message
          : String(processorError),
      );
    }

    return genericResponse(req);
  } catch (error) {
    // Keep the public response account-neutral. Full details remain in the
    // function log for administrators.
    console.error(
      "request-member-access-code error:",
      error instanceof Error ? error.message : String(error),
    );
    return genericResponse(req);
  }
});
