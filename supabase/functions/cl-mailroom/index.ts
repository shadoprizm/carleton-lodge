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
  MailroomProcessingError,
  prepareMailroomDraft,
} from "../_shared/mailroom-processor.ts";
import { asObject } from "../_shared/mailroom-security.ts";
import { consumeRateLimit } from "../_shared/rate-limit.ts";

type RequestBody = {
  action?: unknown;
  inboundEmailId?: unknown;
  importId?: unknown;
  proposal?: unknown;
  batchSize?: unknown;
};

type QueueJob = {
  id: string;
  inbound_email_id: string;
  processing_mode: "manual" | "shadow" | "active";
  attempt_count: number;
  max_attempts: number;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isServiceRoleJwtForProject = (token: string, supabaseUrl: string) => {
  try {
    const [, encodedPayload] = token.split(".");
    if (!encodedPayload) return false;
    const normalized = encodedPayload.replaceAll("-", "+").replaceAll("_", "/")
      .padEnd(Math.ceil(encodedPayload.length / 4) * 4, "=");
    const payload = JSON.parse(atob(normalized)) as {
      ref?: string;
      role?: string;
    };
    const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
    return payload.role === "service_role" && payload.ref === projectRef;
  } catch {
    return false;
  }
};

const batchSizeFrom = (value: unknown, fallback: number, maximum: number) => {
  const parsed = typeof value === "number" && Number.isFinite(value)
    ? Math.trunc(value)
    : fallback;
  return Math.min(Math.max(parsed, 1), maximum);
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handlePreflight(req);
  const originRejection = rejectDisallowedOrigin(req);
  if (originRejection) return originRejection;
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405, {
      Allow: "POST, OPTIONS",
    });
  }
  if (contentLengthExceeds(req, 256 * 1024)) {
    return jsonResponse(req, { error: "Request body is too large" }, 413);
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!token) return jsonResponse(req, { error: "Sign in is required" }, 401);
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse(
      req,
      { error: "Lodge Mailroom is not configured" },
      503,
    );
  }

  let body: RequestBody;
  try {
    body = await req.json() as RequestBody;
  } catch {
    return jsonResponse(req, { error: "Invalid JSON body" }, 400);
  }
  const action = typeof body.action === "string" ? body.action : "";
  const allowedActions = [
    "process",
    "processQueue",
    "retry",
    "approve",
    "reject",
    "purgeExpired",
  ];
  if (!allowedActions.includes(action)) {
    return jsonResponse(req, { error: "Invalid Mailroom action" }, 400);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const serviceAction = ["processQueue", "purgeExpired"].includes(action);
  const serviceAuthorized = token === serviceRoleKey ||
    isServiceRoleJwtForProject(token, supabaseUrl);
  let userClient: SupabaseClient | null = null;
  let activeInboundEmailId = typeof body.inboundEmailId === "string"
    ? body.inboundEmailId
    : "";
  if (serviceAction) {
    if (!serviceAuthorized) {
      return jsonResponse(req, { error: "Not authorized" }, 403);
    }
  } else {
    userClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth
      .getUser();
    if (userError || !userData.user) {
      return jsonResponse(req, { error: "Your sign-in has expired" }, 401);
    }
    const userId = userData.user.id;
    const { data: canManage } = await userClient.rpc(
      "has_admin_section_permission",
      {
        target_section: "communications",
        access_level: "write",
      },
    );
    if (canManage !== true) {
      return jsonResponse(req, { error: "Forbidden" }, 403);
    }
    const limit = await consumeRateLimit(
      adminClient,
      `mailroom-${action}:user`,
      userId,
      ["process", "retry"].includes(action) ? 12 : 30,
      60 * 60,
    );
    if (!limit.allowed) {
      return jsonResponse(
        req,
        { error: "Mailroom request limit reached. Please try again later." },
        429,
        {
          "Retry-After": String(Math.max(limit.retry_after_seconds, 1)),
        },
      );
    }
  }

  try {
    if (action === "approve" || action === "reject") {
      const importId = typeof body.importId === "string" ? body.importId : "";
      if (!UUID_PATTERN.test(importId)) {
        return jsonResponse(req, { error: "A valid import is required" }, 400);
      }
      if (action === "reject") {
        const { error } = await userClient!.rpc("reject_mailroom_import", {
          target_import_id: importId,
        });
        if (error) throw error;
        return jsonResponse(req, { rejected: true });
      }
      if (
        !body.proposal || typeof body.proposal !== "object" ||
        Array.isArray(body.proposal)
      ) {
        return jsonResponse(req, {
          error: "Review the proposed actions before publishing",
        }, 400);
      }
      const proposal = asObject(body.proposal);
      const { data: importRow, error: importError } = await adminClient.from(
        "mailroom_imports",
      )
        .select("source_scope, processing_mode").eq("id", importId)
        .maybeSingle();
      if (importError) throw importError;
      if (!importRow) {
        return jsonResponse(req, { error: "Mailroom import not found" }, 404);
      }
      if (importRow.processing_mode === "shadow") {
        return jsonResponse(req, {
          error: "Shadow-test drafts cannot be published",
        }, 409);
      }
      if (importRow.source_scope === "outside_scope") {
        const summons = asObject(proposal.summons);
        const districtEvents = Array.isArray(proposal.events)
          ? proposal.events.map(asObject).some((event) =>
            event.destination === "district"
          )
          : false;
        if (summons.destination === "district" || districtEvents) {
          return jsonResponse(req, {
            error:
              "Material outside Ottawa Districts 1 and 2 must remain on hold",
          }, 409);
        }
      }
      const { data, error } = await userClient!.rpc(
        "approve_intelligent_mailroom_import",
        {
          target_import_id: importId,
          reviewed_payload: proposal,
        },
      );
      if (error) throw error;
      return jsonResponse(req, { approved: true, published: data });
    }

    if (action === "purgeExpired") {
      const batchSize = batchSizeFrom(body.batchSize, 50, 100);
      const { data: expired, error } = await adminClient.from("inbound_emails")
        .select("id").lt("retention_until", new Date().toISOString())
        .is("content_purged_at", null).is("purge_claimed_at", null)
        .order("retention_until").limit(batchSize);
      if (error) throw error;
      let purged = 0;
      for (const email of expired ?? []) {
        const { data: importRow } = await adminClient.from("mailroom_imports")
          .select("id, status, extracted_payload").eq(
            "inbound_email_id",
            email.id,
          ).maybeSingle();
        if (importRow?.status === "approved") {
          await adminClient.from("inbound_emails").update({
            retention_until: "infinity",
          }).eq("id", email.id);
          continue;
        }
        const claimTime = new Date().toISOString();
        const { data: claimed } = await adminClient.from("inbound_emails")
          .update({ purge_claimed_at: claimTime }).eq("id", email.id)
          .is("purge_claimed_at", null).select("id").maybeSingle();
        if (!claimed) continue;
        const payload = asObject(importRow?.extracted_payload);
        const files = Array.isArray(payload.source_files)
          ? payload.source_files.map(asObject)
          : [];
        const legacyFile = asObject(payload.source_file);
        const paths = [...files, legacyFile]
          .map((file) => String(file.storage_path ?? ""))
          .filter((path, index, all) =>
            path.startsWith(`mailroom/${importRow?.id ?? ""}/`) &&
            all.indexOf(path) === index
          );
        if (paths.length > 0) {
          const { error: storageError } = await adminClient.storage.from(
            "summons-uploads",
          ).remove(paths);
          if (storageError) {
            await adminClient.from("inbound_emails").update({
              purge_claimed_at: null,
              last_error: storageError.message.slice(0, 2000),
            }).eq("id", email.id);
            continue;
          }
        }
        const now = new Date().toISOString();
        const { error: redactError } = await adminClient.from("inbound_emails")
          .update({
            subject: null,
            text_body: null,
            html_body: null,
            headers: {},
            attachments: [],
            raw_payload: {},
            content_purged_at: now,
            purge_claimed_at: null,
            last_error: null,
          }).eq("id", email.id);
        if (redactError) throw redactError;
        if (importRow) {
          await adminClient.from("mailroom_imports").update({
            extracted_payload: { purged: true },
            approved_payload: null,
            summary: null,
            last_error: null,
          }).eq("id", importRow.id);
        }
        purged += 1;
      }
      return jsonResponse(req, { purged, examined: expired?.length ?? 0 });
    }

    if (action === "processQueue") {
      const batchSize = batchSizeFrom(body.batchSize, 3, 10);
      const { data, error } = await adminClient.rpc("claim_mailroom_imports", {
        batch_size: batchSize,
      });
      if (error) throw error;
      const jobs = (data ?? []) as QueueJob[];
      let prepared = 0;
      let retried = 0;
      let failed = 0;
      for (const job of jobs) {
        try {
          await prepareMailroomDraft(adminClient, job.inbound_email_id, {
            processingMode: job.processing_mode,
            claimed: true,
          });
          prepared += 1;
        } catch (error) {
          const message = error instanceof Error
            ? error.message
            : "Lodge Mailroom failed";
          const transient = error instanceof MailroomProcessingError &&
            error.transient;
          const terminal = !transient || job.attempt_count >= job.max_attempts;
          const retrySeconds = Math.min(
            3600,
            60 * (2 ** Math.max(job.attempt_count - 1, 0)),
          );
          await adminClient.from("mailroom_imports").update({
            status: terminal ? "failed" : "queued",
            locked_at: null,
            available_at: terminal
              ? new Date().toISOString()
              : new Date(Date.now() + retrySeconds * 1000).toISOString(),
            last_error: message.slice(0, 2000),
          }).eq("id", job.id);
          await adminClient.from("inbound_emails").update({
            processing_status: terminal ? "failed" : "received",
            last_error: message.slice(0, 2000),
          }).eq("id", job.inbound_email_id);
          if (terminal) failed += 1;
          else retried += 1;
        }
      }
      return jsonResponse(req, {
        claimed: jobs.length,
        prepared,
        retried,
        failed,
      });
    }

    if (action === "retry") {
      const importId = typeof body.importId === "string" ? body.importId : "";
      if (!UUID_PATTERN.test(importId)) {
        return jsonResponse(req, { error: "A valid import is required" }, 400);
      }
      const { data: importRow, error } = await adminClient.from(
        "mailroom_imports",
      )
        .select("inbound_email_id, status, processing_mode").eq("id", importId)
        .maybeSingle();
      if (error) throw error;
      if (!importRow || importRow.status !== "failed") {
        return jsonResponse(req, {
          error: "Only a failed Mailroom item can be retried",
        }, 409);
      }
      activeInboundEmailId = importRow.inbound_email_id;
      const prepared = await prepareMailroomDraft(
        adminClient,
        activeInboundEmailId,
        {
          processingMode: importRow.processing_mode,
        },
      );
      return jsonResponse(req, {
        import: prepared,
        reused: ["needs_review", "approved", "duplicate"].includes(
          prepared?.status ?? "",
        ),
      });
    }
    if (!UUID_PATTERN.test(activeInboundEmailId)) {
      return jsonResponse(
        req,
        { error: "A valid inbound email is required" },
        400,
      );
    }
    const prepared = await prepareMailroomDraft(
      adminClient,
      activeInboundEmailId,
      {
        processingMode: "manual",
      },
    );
    return jsonResponse(req, {
      import: prepared,
      reused: ["needs_review", "approved", "duplicate"].includes(
        prepared?.status ?? "",
      ),
    });
  } catch (error) {
    console.error("cl-mailroom failed", error);
    const message = error instanceof Error
      ? error.message
      : "Lodge Mailroom failed";
    if (
      ["process", "retry"].includes(action) &&
      UUID_PATTERN.test(activeInboundEmailId)
    ) {
      await adminClient.from("mailroom_imports").update({
        status: "failed",
        locked_at: null,
        last_error: message.slice(0, 2000),
      }).eq("inbound_email_id", activeInboundEmailId);
      await adminClient.from("inbound_emails").update({
        processing_status: "failed",
        last_error: message.slice(0, 2000),
      }).eq("id", activeInboundEmailId);
    }
    return jsonResponse(req, { error: message }, 500);
  }
});
