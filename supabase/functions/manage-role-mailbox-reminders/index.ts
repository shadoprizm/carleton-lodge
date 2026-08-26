import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.8";
import {
  hashRoleMailboxReminderOptOutToken,
  isValidRoleMailboxReminderOptOutToken,
} from "../_shared/role-mailbox-reminder-opt-out.ts";

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const htmlResponse = (
  title: string,
  heading: string,
  message: string,
  body: string,
  status = 200,
) =>
  new Response(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex,nofollow">
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      body { margin: 0; background: #f1f5f9; color: #334155; }
      main { max-width: 38rem; margin: 4rem auto; padding: 2rem; }
      article { border: 1px solid #e2e8f0; border-top: 4px solid #d97706; border-radius: .8rem; background: white; padding: 2rem; box-shadow: 0 10px 30px rgb(15 23 42 / 8%); }
      h1 { margin: 0 0 1rem; color: #0f172a; font-family: Georgia, serif; font-size: 2rem; line-height: 1.2; }
      p { font-size: 1rem; line-height: 1.65; }
      button { min-height: 3rem; margin-top: .75rem; border: 0; border-radius: .4rem; background: #b45309; color: white; cursor: pointer; padding: .75rem 1.2rem; font: inherit; font-weight: 700; }
      a { color: #334155; }
    </style>
  </head>
  <body>
    <main>
      <article>
        <h1>${escapeHtml(heading)}</h1>
        <p>${escapeHtml(message)}</p>
        ${body}
      </article>
    </main>
  </body>
</html>`,
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
        "Content-Type": "text/html; charset=utf-8",
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Resource-Policy": "same-origin",
        "Permissions-Policy":
          "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
      },
    },
  );

const confirmationPage = (token: string) =>
  htmlResponse(
    "Stop mailbox reminders",
    "Stop mailbox activation reminders?",
    "This stops future automated activation reminders for this officer or functional mailbox assignment. It does not remove the mailbox, change your Lodge website access, or decline the assignment.",
    `<form method="post" action="?token=${escapeHtml(token)}">
      <button type="submit">Stop these reminders</button>
    </form>`,
  );

const resultPage = () =>
  htmlResponse(
    "Mailbox reminders stopped",
    "You will not receive more reminders",
    "Automated activation reminders for this mailbox assignment have been stopped. You may close this page.",
    '<p><a href="https://www.carpmasons.ca">Return to the Carleton Lodge website</a></p>',
  );

const invalidPage = () =>
  htmlResponse(
    "Link unavailable",
    "This reminder link is unavailable",
    "The link is invalid or is no longer connected to a mailbox assignment. No settings were changed.",
    '<p><a href="https://www.carpmasons.ca/contact">Contact Lodge support</a></p>',
    404,
  );

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "content-type",
        "Access-Control-Max-Age": "600",
      },
    });
  }

  if (!["GET", "POST"].includes(req.method)) {
    return htmlResponse(
      "Method not allowed",
      "Method not allowed",
      "Open the reminder link from your email to manage this preference.",
      "",
      405,
    );
  }

  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!isValidRoleMailboxReminderOptOutToken(token)) return invalidPage();
  if (req.method === "GET") return confirmationPage(token);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return htmlResponse(
      "Service unavailable",
      "Please try again later",
      "The reminder preference service is temporarily unavailable. No settings were changed.",
      "",
      503,
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const tokenHash = await hashRoleMailboxReminderOptOutToken(token);
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
    return htmlResponse(
      "Service unavailable",
      "Please try again later",
      "The reminder preference service is temporarily unavailable. No settings were changed.",
      "",
      503,
    );
  }
  if (!optOutToken) return invalidPage();
  if (optOutToken.consumed_at) return resultPage();

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
    return htmlResponse(
      "Service unavailable",
      "Please try again later",
      "The reminder preference service is temporarily unavailable. No settings were changed.",
      "",
      503,
    );
  }
  if (!assignment) return invalidPage();

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
      return htmlResponse(
        "Service unavailable",
        "Please try again later",
        "The reminder preference service is temporarily unavailable. No settings were changed.",
        "",
        503,
      );
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

  return resultPage();
});
