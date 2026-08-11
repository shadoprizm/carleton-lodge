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
import { createMxrouteProvider } from "../_shared/lodge-email-provider.ts";
import {
  isAuthUserMissingError,
  mailboxDeletionConfirmationError,
  memberDeletionBlocker,
  resolveDeletionProfileId,
} from "../_shared/member-deletion.ts";
import { consumeRateLimit } from "../_shared/rate-limit.ts";

// The project has no generated Edge Function database type yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LodgeSupabaseClient = SupabaseClient<any, any, any, any, any>;

type RequestBody = {
  memberId?: unknown;
  confirmed?: unknown;
  deleteMailboxContents?: unknown;
};

type RosterMember = {
  id: string;
  full_name: string;
  linked_profile_id: string | null;
  lodge_email: string | null;
  mailbox_status: string;
};

type GovernedAccount = {
  id: string;
  address: string;
  status: string;
  account_type: string;
};

type MemberDeletionJob = {
  auth_user_id: string | null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function exactCount(
  query: PromiseLike<
    { count: number | null; error: { message: string } | null }
  >,
) {
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

async function deleteProfileDependents(
  adminClient: LodgeSupabaseClient,
  profileId: string,
) {
  const results = await Promise.all([
    adminClient.from("notification_preferences").delete().eq("id", profileId),
    adminClient.from("member_profiles").delete().eq("id", profileId),
    adminClient
      .from("notification_outbox")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("recipient_profile_id", profileId)
      .in("status", ["queued", "processing"]),
  ]);

  const failure = results.find((result) => result.error)?.error;
  if (failure) throw failure;
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
    console.error("delete-member is missing required Supabase secrets");
    return jsonResponse(req, { error: "Service unavailable" }, 503);
  }

  let body: RequestBody;
  try {
    body = await req.json() as RequestBody;
  } catch {
    return jsonResponse(req, { error: "Invalid JSON body" }, 400);
  }

  const memberId = typeof body.memberId === "string"
    ? body.memberId.trim()
    : "";
  if (!UUID_PATTERN.test(memberId)) {
    return jsonResponse(req, { error: "A valid memberId is required" }, 400);
  }
  if (body.confirmed !== true) {
    return jsonResponse(
      req,
      { error: "Explicit confirmation is required" },
      400,
    );
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

  const { data: canManage, error: permissionError } = await userClient.rpc(
    "has_admin_section_permission",
    { target_section: "members", access_level: "write" },
  );
  if (permissionError) {
    console.error("delete-member permission check failed:", permissionError);
    return jsonResponse(
      req,
      { error: "Member access could not be verified" },
      503,
    );
  }
  if (canManage !== true) {
    return jsonResponse(req, { error: "Forbidden" }, 403);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const limit = await consumeRateLimit(
      adminClient,
      "delete-member:user",
      user.id,
      20,
      60 * 60,
    );
    if (!limit.allowed) {
      return jsonResponse(
        req,
        { error: "Too many member deletion requests" },
        429,
        {
          "Retry-After": String(Math.max(limit.retry_after_seconds, 1)),
        },
      );
    }

    const { data: memberData, error: memberError } = await adminClient
      .from("lodge_members")
      .select("id, full_name, linked_profile_id, lodge_email, mailbox_status")
      .eq("id", memberId)
      .maybeSingle();
    if (memberError) throw memberError;
    if (!memberData) {
      return jsonResponse(req, { error: "Member not found" }, 404);
    }
    const member = memberData as RosterMember;

    const { data: deletionJobData, error: deletionJobLookupError } =
      await adminClient
        .from("member_deletion_jobs")
        .select("auth_user_id")
        .eq("member_id", member.id)
        .maybeSingle();
    if (deletionJobLookupError) throw deletionJobLookupError;

    const deletionJob = deletionJobData as MemberDeletionJob | null;
    const profileResolution = resolveDeletionProfileId(
      member.linked_profile_id,
      deletionJob?.auth_user_id ?? null,
    );
    if (profileResolution.conflict) {
      return jsonResponse(req, {
        error:
          "This member was linked to a different website account during deletion and requires manual review.",
      }, 409);
    }
    const profileId = profileResolution.profileId;

    const { data: accountsData, error: accountsError } = await adminClient
      .from("lodge_email_accounts")
      .select("id, address, status, account_type")
      .eq("associated_member_id", member.id);
    if (accountsError) throw accountsError;
    const accounts = (accountsData ?? []) as GovernedAccount[];
    if (
      accounts.length > 1 ||
      accounts.some((account) => account.account_type !== "MEMBER")
    ) {
      return jsonResponse(req, {
        error:
          "This member has an unexpected Lodge email configuration and requires manual review.",
      }, 409);
    }
    const account = accounts[0] ?? null;

    const [
      memberAssignments,
      accountAssignments,
      profileResult,
      linkedElsewhereResult,
    ] = await Promise.all([
      exactCount(
        adminClient.from("officer_mailbox_assignments").select("id", {
          count: "exact",
          head: true,
        }).eq("member_id", member.id).in("status", ["PENDING", "ACTIVE"]),
      ),
      account
        ? exactCount(
          adminClient.from("officer_mailbox_assignments").select("id", {
            count: "exact",
            head: true,
          }).eq("email_account_id", account.id).in("status", [
            "PENDING",
            "ACTIVE",
          ]),
        )
        : Promise.resolve(0),
      profileId
        ? adminClient.from("profiles").select("is_admin").eq("id", profileId)
          .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      profileId
        ? adminClient.from("lodge_members").select("id").eq(
          "linked_profile_id",
          profileId,
        ).neq("id", member.id).limit(1).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (profileResult.error) throw profileResult.error;
    if (linkedElsewhereResult.error) throw linkedElsewhereResult.error;

    const basePreflight = {
      actorIsTarget: profileId === user.id,
      targetIsAdmin: profileResult.data?.is_admin === true,
      linkedElsewhere: linkedElsewhereResult.data !== null,
      assignmentCount: memberAssignments + accountAssignments,
    };
    const initialBlocker = memberDeletionBlocker(basePreflight);
    if (initialBlocker) {
      return jsonResponse(req, { error: initialBlocker }, 409);
    }

    const mailboxAddress = account?.address ?? member.lodge_email;
    const mailboxConfirmationError = mailboxDeletionConfirmationError(
      mailboxAddress,
      body.deleteMailboxContents === true,
    );
    if (mailboxConfirmationError) {
      return jsonResponse(req, { error: mailboxConfirmationError }, 400);
    }

    let providerMailbox = null;
    if (mailboxAddress) {
      const provider = createMxrouteProvider();
      try {
        providerMailbox = await provider.getMailbox(mailboxAddress);
      } catch (error) {
        console.error("delete-member mailbox check failed:", error);
        return jsonResponse(req, {
          error:
            "The Lodge mailbox could not be checked, so no member records were deleted.",
        }, 502);
      }

      // Remove the governed database account first. Its RESTRICT constraints
      // remain the final concurrency guard against deleting a personal
      // account while an active officer assignment is being created.
      if (account) {
        const { error: accountDeleteError } = await adminClient
          .from("lodge_email_accounts")
          .delete()
          .eq("id", account.id);
        if (accountDeleteError) throw accountDeleteError;
      }

      const { error: mailboxStateError } = await adminClient
        .from("lodge_members")
        .update({
          mailbox_status: "provisioning",
          updated_at: new Date().toISOString(),
        })
        .eq("id", member.id);
      if (mailboxStateError) throw mailboxStateError;

      try {
        await provider.deleteMailbox(mailboxAddress);
      } catch (error) {
        console.error("delete-member mailbox removal failed:", error);
        return jsonResponse(req, {
          error:
            "The Lodge mailbox could not be removed. The member remains on the roster; retry deletion.",
        }, 502);
      }
    } else if (account) {
      const { error: accountDeleteError } = await adminClient
        .from("lodge_email_accounts")
        .delete()
        .eq("id", account.id);
      if (accountDeleteError) throw accountDeleteError;
    }

    const { error: auditError } = await adminClient
      .from("lodge_email_audit_events")
      .insert({
        event_type: "MEMBER_HARD_DELETED",
        email_account_id: null,
        member_id: member.id,
        actor_profile_id: user.id,
        outcome: "WARNING",
        details: {
          member_name: member.full_name,
          linked_profile_id: profileId,
          former_email_account_id: account?.id ?? null,
          mailbox_address: mailboxAddress,
          mailbox_removed: Boolean(mailboxAddress),
          provider_mailbox_found: providerMailbox !== null,
          provider_usage_mb: providerMailbox?.usageMb ?? null,
          provider_sent_today: providerMailbox?.sentToday ?? null,
        },
      });
    if (auditError) throw auditError;

    if (profileId) {
      const deletionStartedAt = new Date().toISOString();
      const { error: deletionJobError } = await adminClient
        .from("member_deletion_jobs")
        .upsert({
          member_id: member.id,
          auth_user_id: profileId,
          requested_by: user.id,
          state: "pending",
          last_error: null,
          updated_at: deletionStartedAt,
        }, { onConflict: "member_id" });
      if (deletionJobError) throw deletionJobError;

      const { data: authUserData, error: authLookupError } = await adminClient
        .auth.admin.getUserById(profileId);
      const authUserExists = authUserData?.user !== null &&
        authUserData?.user !== undefined;
      if (authLookupError && !isAuthUserMissingError(authLookupError)) {
        await adminClient
          .from("member_deletion_jobs")
          .update({
            state: "auth_delete_failed",
            last_error: authLookupError.message,
            updated_at: new Date().toISOString(),
          })
          .eq("member_id", member.id);
        return jsonResponse(req, {
          error:
            "The website login could not be checked. No member records were deleted; retry deletion.",
        }, 502);
      }

      if (authUserExists) {
        const { error: banError } = await adminClient.auth.admin.updateUserById(
          profileId,
          { ban_duration: "876000h" },
        );
        if (banError) {
          await adminClient
            .from("member_deletion_jobs")
            .update({
              state: "auth_delete_failed",
              last_error: banError.message,
              updated_at: new Date().toISOString(),
            })
            .eq("member_id", member.id);
          return jsonResponse(req, {
            error:
              "The website login could not be secured. No member records were deleted; retry deletion.",
          }, 502);
        }

        const { error: revokeError } = await adminClient.rpc(
          "revoke_member_sessions",
          { target_user_id: profileId },
        );
        if (revokeError) {
          await adminClient
            .from("member_deletion_jobs")
            .update({
              state: "auth_delete_failed",
              last_error: revokeError.message,
              updated_at: new Date().toISOString(),
            })
            .eq("member_id", member.id);
          return jsonResponse(req, {
            error:
              "The website login could not be signed out. No member records were deleted; retry deletion.",
          }, 502);
        }
      }

      const { error: unlinkError } = await adminClient
        .from("lodge_members")
        .update({
          linked_profile_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", member.id);
      if (unlinkError) throw unlinkError;

      await deleteProfileDependents(adminClient, profileId);

      if (authUserExists) {
        const { error: authDeleteError } = await adminClient.auth.admin
          .deleteUser(profileId);
        if (authDeleteError) {
          await adminClient
            .from("member_deletion_jobs")
            .update({
              state: "auth_delete_failed",
              last_error: authDeleteError.message,
              updated_at: new Date().toISOString(),
            })
            .eq("member_id", member.id);
          console.error("delete-member auth removal failed:", authDeleteError);
          return jsonResponse(req, {
            error:
              "The website login could not be removed. Its sessions were revoked and the roster entry was unlinked; retry deletion.",
          }, 502);
        }
      }

      await adminClient
        .from("member_deletion_jobs")
        .update({
          state: "auth_deleted",
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("member_id", member.id);
    }

    const { error: memberDeleteError } = await adminClient
      .from("lodge_members")
      .delete()
      .eq("id", member.id);
    if (memberDeleteError) throw memberDeleteError;

    return jsonResponse(req, {
      deleted: true,
      memberId: member.id,
      websiteLoginDeleted: Boolean(profileId),
      lodgeMailboxDeleted: Boolean(mailboxAddress),
    });
  } catch (error) {
    console.error("delete-member failed:", error);
    return jsonResponse(req, {
      error:
        "The member could not be deleted. No success was reported; review the server log and retry.",
    }, 500);
  }
});
