import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type RequestBody = {
  memberId?: string;
  email?: string;
  temporaryPassword?: string;
};

type AuthUserSummary = {
  id: string;
  email?: string;
};

type PostgrestMaybeMissingError = {
  code?: string;
  message?: string;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function findAuthUserByEmail(
  supabaseAdmin: ReturnType<typeof createClient>,
  email: string,
) {
  const normalizedEmail = email.toLowerCase();

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 100,
    });

    if (error) throw error;

    const users = data?.users ?? [];
    const match = users.find((user: AuthUserSummary) => user.email?.toLowerCase() === normalizedEmail);
    if (match) return match;
    if (users.length < 100) return null;
  }

  return null;
}

function isMissingRpc(error: PostgrestMaybeMissingError | null) {
  return error?.code === "PGRST202" || error?.message?.toLowerCase().includes("could not find the function");
}

function isMissingColumn(error: PostgrestMaybeMissingError | null, columnName: string) {
  return error?.code === "42703" || error?.message?.includes(columnName);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
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

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      db: { schema: "carletonlodge" },
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: "carletonlodge" },
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
      { target_section: "members", access_level: "write" },
    );

    let allowed = canManage === true;

    if (permissionError && !isMissingRpc(permissionError)) {
      throw permissionError;
    }

    if (!allowed && permissionError && isMissingRpc(permissionError)) {
      const { data: isAdmin, error: adminError } = await supabaseUser.rpc("is_admin");
      if (adminError) throw adminError;
      allowed = isAdmin === true;
    }

    if (!allowed) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const { error: migrationCheckError } = await supabaseAdmin
      .from("profiles")
      .select("force_password_change")
      .limit(1);

    if (migrationCheckError) {
      if (isMissingColumn(migrationCheckError, "force_password_change")) {
        return jsonResponse(
          { error: "Database migrations are not applied yet. Run the forced password change migration before assigning member logins." },
          409,
        );
      }
      throw migrationCheckError;
    }

    let body: RequestBody;
    try {
      body = (await req.json()) as RequestBody;
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const memberId = body.memberId?.trim();
    const email = body.email?.trim().toLowerCase();
    const temporaryPassword = body.temporaryPassword ?? "";

    if (!memberId) return jsonResponse({ error: "memberId is required" }, 400);
    if (!email) return jsonResponse({ error: "email is required" }, 400);
    if (temporaryPassword.length < 8) {
      return jsonResponse({ error: "Temporary password must be at least 8 characters" }, 400);
    }

    const { data: member, error: memberError } = await supabaseAdmin
      .from("lodge_members")
      .select("id, full_name, linked_profile_id")
      .eq("id", memberId)
      .maybeSingle();

    if (memberError) throw memberError;
    if (!member) return jsonResponse({ error: "Member not found" }, 404);

    let authUserId = member.linked_profile_id as string | null;
    let created = false;

    if (!authUserId) {
      const existingUser = await findAuthUserByEmail(supabaseAdmin, email);
      authUserId = existingUser?.id ?? null;
    }

    if (authUserId) {
      const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: { force_password_change: true },
      });
      if (updateAuthError) throw updateAuthError;
    } else {
      const { data: createdUser, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: { force_password_change: true },
      });
      if (createAuthError) throw createAuthError;
      authUserId = createdUser.user?.id ?? null;
      created = true;
    }

    if (!authUserId) {
      return jsonResponse({ error: "Could not create or update auth user" }, 500);
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: authUserId,
        email,
        force_password_change: true,
        updated_at: new Date().toISOString(),
      });
    if (profileError) throw profileError;

    const { error: memberUpdateError } = await supabaseAdmin
      .from("lodge_members")
      .update({
        email,
        linked_profile_id: authUserId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", memberId);
    if (memberUpdateError) throw memberUpdateError;

    return jsonResponse({
      created,
      profileId: authUserId,
      email,
      memberName: member.full_name,
      forcePasswordChange: true,
    });
  } catch (error) {
    console.error("manage-member-login error:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Internal server error" },
      500,
    );
  }
});
