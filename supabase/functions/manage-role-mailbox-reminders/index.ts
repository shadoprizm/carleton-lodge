import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.8";
import {
  hashRoleMailboxReminderOptOutToken,
  isValidRoleMailboxReminderOptOutToken,
} from "../_shared/role-mailbox-reminder-opt-out.ts";
import {
  contentLengthExceeds,
  handlePreflight,
  jsonResponse,
  rejectDisallowedOrigin,
} from "../_shared/http-security.ts";

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

  const requestBody = await req.json().catch(() => ({})) as {
    token?: unknown;
  };
  if (!isValidRoleMailboxReminderOptOutToken(requestBody.token)) {
    return jsonResponse(req, { error: "This reminder link is invalid" }, 404);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(req, { error: "Service unavailable" }, 503);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const tokenHash = await hashRoleMailboxReminderOptOutToken(
    requestBody.token,
  );
  const { data: optOutToken, error: tokenError } = await supabase
    .from("role_mailbox_reminder_opt_out_tokens")
    .select("id, assignment_id, consumed_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (tokenError) {
    console.error(
      "Could not read role-mailbox opt-out token:",
      tokenError.code,
    );
    return jsonResponse(req, { error: "Service unavailable" }, 503);
  }
  if (!optOutToken) {
    return jsonResponse(req, { error: "This reminder link is invalid" }, 404);
  }
  if (optOutToken.consumed_at) {
    return jsonResponse(req, { success: true, alreadyStopped: true });
  }

  const { data: assignment, error: assignmentError } = await supabase
    .from("officer_mailbox_assignments")
    .select(
      "id, email_account_id, member_id, position_id, handover_id, status, activation_reminders_opted_out_at",
    )
    .eq("id", optOutToken.assignment_id)
    .maybeSingle();
  if (assignmentError) {
    console.error(
      "Could not read role-mailbox assignment:",
      assignmentError.code,
    );
    return jsonResponse(req, { error: "Service unavailable" }, 503);
  }
  if (!assignment) {
    return jsonResponse(req, { error: "This reminder link is invalid" }, 404);
  }

  const now = new Date().toISOString();
  let newlyOptedOut = false;
  if (
    assignment.status === "PENDING" &&
    !assignment.activation_reminders_opted_out_at
  ) {
    const { data: updatedAssignments, error: updateError } = await supabase
      .from("officer_mailbox_assignments")
      .update({
        activation_reminders_opted_out_at: now,
        updated_at: now,
      })
      .eq("id", assignment.id)
      .eq("status", "PENDING")
      .is("activation_reminders_opted_out_at", null)
      .select("id");
    if (updateError) {
      console.error("Could not stop role-mailbox reminders:", updateError.code);
      return jsonResponse(req, { error: "Service unavailable" }, 503);
    }
    newlyOptedOut = (updatedAssignments?.length ?? 0) > 0;
  }

  const { error: consumeError } = await supabase
    .from("role_mailbox_reminder_opt_out_tokens")
    .update({ consumed_at: now })
    .eq("assignment_id", assignment.id)
    .is("consumed_at", null);
  if (consumeError) {
    console.error(
      "Could not consume role-mailbox opt-out tokens:",
      consumeError.code,
    );
  }

  if (newlyOptedOut) {
    const { error: auditError } = await supabase
      .from("lodge_email_audit_events")
      .insert({
        event_type: "ROLE_MAILBOX_ACTIVATION_REMINDERS_OPTED_OUT",
        email_account_id: assignment.email_account_id,
        member_id: assignment.member_id,
        position_id: assignment.position_id,
        handover_id: assignment.handover_id,
        outcome: "SUCCESS",
        details: { assignment_id: assignment.id },
      });
    if (auditError) {
      console.error(
        "Could not record role-mailbox opt-out audit:",
        auditError.code,
      );
    }
  }

  return jsonResponse(req, { success: true, alreadyStopped: !newlyOptedOut });
});
