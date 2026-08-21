import type { SupabaseClient } from "npm:@supabase/supabase-js@2.110.8";
import { mailboxBaseName } from "./mailbox-address.ts";
import {
  createMxrouteProvider,
  createProviderLockPassword,
  LODGE_EMAIL_DOMAIN,
  type LodgeEmailProvider,
  mailboxProviderStatusJson,
  normalizeLodgeEmailAddress,
} from "./lodge-email-provider.ts";

// The project does not yet generate Edge Function database types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LodgeSupabaseClient = SupabaseClient<any, any, any, any, any>;

export type PersonalMailboxMember = {
  id: string;
  full_name: string;
  email: string | null;
  linked_profile_id: string | null;
  lodge_email: string | null;
  mailbox_status: string;
  mailbox_quota_mb: number;
  mailbox_send_limit: number;
  mailbox_provisioned_at: string | null;
  mailbox_activated_at: string | null;
};

type PersonalMailboxAccount = {
  id: string;
  address: string;
  status: string;
  credential_status: string;
  provisioned_at: string | null;
  activated_at: string | null;
};

export type PersonalMailboxProvisioningResult = {
  memberId: string;
  accountId: string;
  address: string;
  providerMailboxCreated: boolean;
  governanceRecordCreated: boolean;
  status: "active" | "pending_activation";
};

export const PERSONAL_MAILBOX_MEMBER_SELECT =
  "id, full_name, email, linked_profile_id, lodge_email, mailbox_status, mailbox_quota_mb, mailbox_send_limit, mailbox_provisioned_at, mailbox_activated_at";

export function personalMailboxCandidates(fullName: string, maximum = 100) {
  const baseName = mailboxBaseName(fullName).slice(0, 48);
  return Array.from({ length: maximum }, (_, index) => {
    const suffix = index === 0 ? "" : String(index + 1);
    return `${baseName.slice(0, 48 - suffix.length)}${suffix}@${LODGE_EMAIL_DOMAIN}`;
  });
}

async function addressIsGovernedElsewhere(
  supabase: LodgeSupabaseClient,
  address: string,
  memberId: string,
) {
  const [{ data: member, error: memberError }, {
    data: accounts,
    error: accountError,
  }] = await Promise.all([
    supabase
      .from("lodge_members")
      .select("id")
      .ilike("lodge_email", address)
      .neq("id", memberId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("lodge_email_accounts")
      .select("associated_member_id")
      .ilike("address", address)
      .limit(2),
  ]);
  if (memberError) throw memberError;
  if (accountError) throw accountError;
  return Boolean(
    member || (accounts ?? []).some((account: { associated_member_id: string | null }) =>
      account.associated_member_id !== memberId
    ),
  );
}

async function chooseAddress(
  supabase: LodgeSupabaseClient,
  provider: LodgeEmailProvider,
  member: PersonalMailboxMember,
  governedAccount: PersonalMailboxAccount | null,
) {
  const recordedAddress = member.lodge_email
    ? normalizeLodgeEmailAddress(member.lodge_email)
    : null;
  const governedAddress = governedAccount
    ? normalizeLodgeEmailAddress(governedAccount.address)
    : null;

  if (
    recordedAddress && governedAddress && recordedAddress !== governedAddress
  ) {
    throw new Error(
      "The member and governed mailbox records disagree about the Lodge address",
    );
  }

  const existingAddress = recordedAddress ?? governedAddress;
  if (existingAddress) {
    if (
      await addressIsGovernedElsewhere(supabase, existingAddress, member.id)
    ) {
      throw new Error("The recorded Lodge address belongs to another account");
    }
    return existingAddress;
  }

  for (const candidate of personalMailboxCandidates(member.full_name)) {
    if (await addressIsGovernedElsewhere(supabase, candidate, member.id)) {
      continue;
    }
    // Never claim an untracked provider mailbox. A numeric suffix is safer than
    // rotating credentials on an address that may contain real correspondence.
    if (await provider.getMailbox(candidate)) continue;
    return candidate;
  }

  throw new Error("Could not reserve a unique personal Lodge email address");
}

async function recordAudit(
  supabase: LodgeSupabaseClient,
  input: {
    eventType: string;
    accountId: string | null;
    memberId: string;
    actorProfileId?: string | null;
    outcome?: "SUCCESS" | "FAILURE" | "WARNING";
    details?: Record<string, unknown>;
  },
) {
  const { error } = await supabase.from("lodge_email_audit_events").insert({
    event_type: input.eventType,
    email_account_id: input.accountId,
    member_id: input.memberId,
    actor_profile_id: input.actorProfileId ?? null,
    outcome: input.outcome ?? "SUCCESS",
    details: input.details ?? {},
  });
  if (error) throw error;
}

export async function provisionPersonalMailbox(
  supabase: LodgeSupabaseClient,
  member: PersonalMailboxMember,
  options: {
    actorProfileId?: string | null;
    provider?: LodgeEmailProvider;
  } = {},
): Promise<PersonalMailboxProvisioningResult> {
  const provider = options.provider ?? createMxrouteProvider();
  const { data: existingAccountData, error: accountReadError } = await supabase
    .from("lodge_email_accounts")
    .select(
      "id, address, status, credential_status, provisioned_at, activated_at",
    )
    .eq("account_type", "MEMBER")
    .eq("associated_member_id", member.id)
    .maybeSingle();
  if (accountReadError) throw accountReadError;

  let account = existingAccountData as PersonalMailboxAccount | null;
  const address = await chooseAddress(supabase, provider, member, account);
  const hasRecordedMailbox = Boolean(member.lodge_email || account?.address);
  const wasActive = hasRecordedMailbox && (member.mailbox_status === "active" ||
    account?.status === "ACTIVE");
  const now = new Date().toISOString();
  let governanceRecordCreated = false;

  if (!account) {
    const { data, error } = await supabase
      .from("lodge_email_accounts")
      .insert({
        address,
        account_type: "MEMBER",
        status: "PROVISIONING",
        provider: "mxroute",
        provider_mailbox_identifier: address,
        associated_member_id: member.id,
        position_id: null,
        current_authorized_member_id: null,
        display_name: member.full_name,
        enabled: true,
        agreement_required: true,
        credential_status: wasActive ? "USER_SET" : "UNKNOWN",
      })
      .select(
        "id, address, status, credential_status, provisioned_at, activated_at",
      )
      .single();
    if (error) throw error;
    account = data as PersonalMailboxAccount;
    governanceRecordCreated = true;
  } else if (!wasActive) {
    const { error } = await supabase
      .from("lodge_email_accounts")
      .update({
        status: "PROVISIONING",
        provider_mailbox_identifier: address,
        display_name: member.full_name,
        enabled: true,
        updated_at: now,
      })
      .eq("id", account.id);
    if (error) throw error;
  }

  if (!account) throw new Error("The personal mailbox record was not created");

  if (!wasActive) {
    const { error } = await supabase
      .from("lodge_members")
      .update({
        lodge_email: address,
        mailbox_status: "provisioning",
        updated_at: now,
      })
      .eq("id", member.id);
    if (error) throw error;
  }

  let providerMailboxCreated = false;
  let providerAccount;
  try {
    providerAccount = await provider.getMailbox(address);
    if (!providerAccount) {
      if (wasActive) {
        throw new Error("The active personal mailbox is missing at MXroute");
      }
      providerAccount = await provider.createMailbox({
        address,
        password: createProviderLockPassword(),
        quotaMb: member.mailbox_quota_mb,
        dailySendLimit: member.mailbox_send_limit,
      });
      providerMailboxCreated = true;
    } else if (
      !wasActive && governanceRecordCreated &&
      account.credential_status !== "PROVISIONED_LOCKED"
    ) {
      // This path is limited to an address already recorded for this member.
      // Secure it until the member chooses their own mailbox password.
      await provider.updateMailbox(address, {
        password: createProviderLockPassword(),
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!wasActive) {
      await Promise.all([
        supabase
          .from("lodge_email_accounts")
          .update({
            status: "ERROR",
            credential_status: "ERROR",
            updated_at: new Date().toISOString(),
          })
          .eq("id", account.id),
        supabase
          .from("lodge_members")
          .update({ mailbox_status: "error", updated_at: new Date().toISOString() })
          .eq("id", member.id),
      ]);
    }
    await recordAudit(supabase, {
      eventType: "MEMBER_MAILBOX_PROVISIONING_FAILED",
      accountId: account.id,
      memberId: member.id,
      actorProfileId: options.actorProfileId,
      outcome: "FAILURE",
      details: { provider: "mxroute", error: message },
    }).catch(() => undefined);
    throw error;
  }

  const finalAccountStatus = wasActive ? "ACTIVE" : "TERMS_PENDING";
  const finalMemberStatus = wasActive ? "active" : "pending_activation";
  const credentialStatus = wasActive || account.credential_status === "USER_SET"
    ? "USER_SET"
    : "PROVISIONED_LOCKED";

  const [{ error: accountUpdateError }, { error: memberUpdateError }] =
    await Promise.all([
      supabase
        .from("lodge_email_accounts")
        .update({
          address,
          status: finalAccountStatus,
          provider_mailbox_identifier: address,
          credential_status: credentialStatus,
          provider_status: mailboxProviderStatusJson(providerAccount),
          provisioned_at: account.provisioned_at ??
            member.mailbox_provisioned_at ?? now,
          activated_at: account.activated_at ??
            member.mailbox_activated_at ?? null,
          updated_at: now,
        })
        .eq("id", account.id),
      supabase
        .from("lodge_members")
        .update({
          lodge_email: address,
          mailbox_status: finalMemberStatus,
          mailbox_provisioned_at: member.mailbox_provisioned_at ?? now,
          updated_at: now,
        })
        .eq("id", member.id),
    ]);
  if (accountUpdateError) throw accountUpdateError;
  if (memberUpdateError) throw memberUpdateError;

  await recordAudit(supabase, {
    eventType: providerMailboxCreated
      ? "MEMBER_MAILBOX_PROVISIONED"
      : "MEMBER_MAILBOX_VERIFIED",
    accountId: account.id,
    memberId: member.id,
    actorProfileId: options.actorProfileId,
    details: {
      provider: "mxroute",
      address,
      provider_mailbox_created: providerMailboxCreated,
      existing_mailbox_preserved: !providerMailboxCreated,
    },
  });

  return {
    memberId: member.id,
    accountId: account.id,
    address,
    providerMailboxCreated,
    governanceRecordCreated,
    status: finalMemberStatus,
  };
}
