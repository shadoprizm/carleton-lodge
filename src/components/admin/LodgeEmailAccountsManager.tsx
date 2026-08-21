import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, History, KeyRound, Mail, Plus, RefreshCw, Search, Send, Settings, ShieldOff, UserRoundCog, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  EmailAgreementReceipt,
  EmailPolicyVersion,
  LodgeEmailAccount,
  LodgeEmailAuditEvent,
  LodgeMember,
  LodgePosition,
  OfficerEmailHandover,
  OfficerMailboxAssignment,
  supabase,
} from '../../lib/supabase';

type AdminEmailAccount = LodgeEmailAccount & {
  position_name: string;
};

type ConfirmationAction = 'suspend' | 'vacate';

function functionErrorMessage(error: unknown, fallback: string) {
  const context = (error as { context?: unknown } | null)?.context;
  if (context instanceof Response) {
    return context.clone().json().then((body: { error?: unknown } | null) =>
      typeof body?.error === 'string' ? body.error : fallback
    ).catch(() => fallback);
  }
  return Promise.resolve(error instanceof Error && error.message ? error.message : fallback);
}

const statusLabel = (status: LodgeEmailAccount['status']) => status.split('_').map(word => `${word.slice(0, 1)}${word.slice(1).toLowerCase()}`).join(' ');

const statusClass = (status: LodgeEmailAccount['status']) => {
  if (status === 'ACTIVE') return 'bg-emerald-100 text-emerald-800';
  if (status === 'ERROR' || status === 'SUSPENDED' || status === 'DISABLED') return 'bg-red-100 text-red-800';
  if (status === 'NOT_PROVISIONED' || status === 'PROVISIONING') return 'bg-slate-100 text-slate-700';
  return 'bg-amber-100 text-amber-800';
};

const credentialLabel = (status: LodgeEmailAccount['credential_status']) =>
  status.split('_').map(word => `${word.slice(0, 1)}${word.slice(1).toLowerCase()}`).join(' ');

const formatAccountDate = (date: string | null) =>
  date ? new Date(date).toLocaleString('en-CA') : 'Not recorded';

export const LodgeEmailAccountsManager = () => {
  const { hasAdminPermission } = useAuth();
  const canWrite = hasAdminPermission('members', 'write');
  const [accounts, setAccounts] = useState<AdminEmailAccount[]>([]);
  const [personalAccounts, setPersonalAccounts] = useState<AdminEmailAccount[]>([]);
  const [members, setMembers] = useState<LodgeMember[]>([]);
  const [positions, setPositions] = useState<LodgePosition[]>([]);
  const [assignments, setAssignments] = useState<OfficerMailboxAssignment[]>([]);
  const [handovers, setHandovers] = useState<OfficerEmailHandover[]>([]);
  const [auditEvents, setAuditEvents] = useState<LodgeEmailAuditEvent[]>([]);
  const [acceptedAccountIds, setAcceptedAccountIds] = useState<Set<string>>(new Set());
  const [activeMailboxTab, setActiveMailboxTab] = useState<'role' | 'personal'>('role');
  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [bulkProvisioning, setBulkProvisioning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState('');
  const [workingId, setWorkingId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [detailAccount, setDetailAccount] = useState<AdminEmailAccount | null>(null);
  const [configureAccount, setConfigureAccount] = useState<AdminEmailAccount | null>(null);
  const [configurationForm, setConfigurationForm] = useState({ displayName: '', enabled: true, agreementRequired: true });
  const [handoverAccount, setHandoverAccount] = useState<AdminEmailAccount | null>(null);
  const [incomingMemberId, setIncomingMemberId] = useState('');
  const [handoverReason, setHandoverReason] = useState('Officer or functional role change');
  const [handoverConfirmed, setHandoverConfirmed] = useState(false);
  const [confirmationAction, setConfirmationAction] = useState<{ account: AdminEmailAccount; action: ConfirmationAction; personal?: boolean } | null>(null);
  const [confirmationReason, setConfirmationReason] = useState('');
  const [confirmationChecked, setConfirmationChecked] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ positionId: '', address: '', displayName: '', accountType: 'FUNCTIONAL' as 'OFFICER' | 'FUNCTIONAL', memberId: '' });
  const [receipt, setReceipt] = useState<EmailAgreementReceipt | null>(null);
  const [policies, setPolicies] = useState<EmailPolicyVersion[]>([]);
  const [policyDraft, setPolicyDraft] = useState<{
    policyType: EmailPolicyVersion['policy_type'];
    title: string;
    content: string;
    acknowledgement: string;
    effectiveAt: string;
    requiresReacceptance: boolean;
  } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    const [accountsResult, positionsResult, membersResult, assignmentsResult, handoversResult, auditResult, policyResult] = await Promise.all([
      supabase.from('lodge_email_accounts').select('*').order('address'),
      supabase.from('lodge_positions').select('*').order('display_order'),
      supabase.rpc('get_managed_lodge_members'),
      supabase.from('officer_mailbox_assignments').select('*').order('assignment_start', { ascending: false }),
      supabase.from('officer_email_handovers').select('*').order('initiated_at', { ascending: false }),
      supabase.from('lodge_email_audit_events').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('email_policy_versions').select('*').in('policy_type', ['MEMBER_EMAIL_TERMS', 'OFFICER_EMAIL_AGREEMENT']).eq('is_active', true),
    ]);
    const firstError = accountsResult.error || positionsResult.error || membersResult.error || assignmentsResult.error || handoversResult.error || auditResult.error || policyResult.error;
    if (firstError) {
      setError(firstError.message || 'Lodge email administration could not be loaded.');
      setLoading(false);
      return;
    }

    const loadedPositions = (positionsResult.data as LodgePosition[] | null) ?? [];
    const positionMap = new Map(loadedPositions.map(position => [position.id, position.name]));
    const loadedAccounts = ((accountsResult.data as LodgeEmailAccount[] | null) ?? []).map(account => ({
      ...account,
      position_name: account.position_id ? positionMap.get(account.position_id) ?? account.display_name : account.display_name,
    }));

    let accepted = new Set<string>();
    const activePolicies = (policyResult.data as EmailPolicyVersion[] | null) ?? [];
    const activePolicyIds = activePolicies.map(policy => policy.id);
    if (activePolicyIds.length && loadedAccounts.length) {
      const { data: acceptances, error: acceptanceError } = await supabase
        .from('email_agreement_acceptances')
        .select('email_account_id, member_id, policy_version_id')
        .in('email_account_id', loadedAccounts.map(account => account.id));
      if (acceptanceError) {
        setError(acceptanceError.message);
      } else {
        const holderByAccount = new Map(loadedAccounts.map(account => [account.id, account.account_type === 'MEMBER' ? account.associated_member_id : account.current_authorized_member_id]));
        const policyByType = new Map(activePolicies.map(policy => [policy.policy_type, policy]));
        accepted = new Set((acceptances ?? [])
          .filter(item => {
            const account = loadedAccounts.find(candidate => candidate.id === item.email_account_id);
            if (!account || holderByAccount.get(item.email_account_id) !== item.member_id) return false;
            const policy = policyByType.get(account.account_type === 'MEMBER' ? 'MEMBER_EMAIL_TERMS' : 'OFFICER_EMAIL_AGREEMENT');
            return !!policy && (!policy.requires_reacceptance || item.policy_version_id === policy.id);
          })
          .map(item => item.email_account_id));
      }
    }

    setAccounts(loadedAccounts.filter(account => account.account_type !== 'MEMBER'));
    setPersonalAccounts(loadedAccounts.filter(account => account.account_type === 'MEMBER'));
    setPositions(loadedPositions);
    setMembers((membersResult.data as LodgeMember[] | null) ?? []);
    setAssignments((assignmentsResult.data as OfficerMailboxAssignment[] | null) ?? []);
    setHandovers((handoversResult.data as OfficerEmailHandover[] | null) ?? []);
    setAuditEvents((auditResult.data as LodgeEmailAuditEvent[] | null) ?? []);
    setAcceptedAccountIds(accepted);
    setPolicies((policyResult.data as EmailPolicyVersion[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const memberMap = useMemo(() => new Map(members.map(member => [member.id, member])), [members]);
  const latestHandover = (accountId: string) => handovers.find(handover => handover.email_account_id === accountId) ?? null;
  const membersMissingPersonalMailbox = members.filter(member =>
    ['unprovisioned', 'provisioning', 'error'].includes(member.mailbox_status)
  );
  const displayedAccounts = activeMailboxTab === 'role' ? accounts : personalAccounts;
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredAccounts = normalizedSearch
    ? displayedAccounts.filter(account => {
      const memberId = account.account_type === 'MEMBER'
        ? account.associated_member_id
        : account.current_authorized_member_id;
      const holderName = memberId ? memberMap.get(memberId)?.full_name : null;
      return [account.address, account.display_name, account.position_name, holderName]
        .some(value => value?.toLowerCase().includes(normalizedSearch));
    })
    : displayedAccounts;

  const invokeAction = async (account: AdminEmailAccount, action: string, extra: Record<string, unknown> = {}) => {
    setWorkingId(account.id);
    setError('');
    setNotice('');
    const { data, error: actionError } = await supabase.functions.invoke('manage-lodge-email', {
      body: { action, accountId: account.id, ...extra },
    });
    setWorkingId('');
    if (actionError) {
      setError(await functionErrorMessage(actionError, 'The Lodge email action failed.'));
      return null;
    }
    await fetchData();
    return data;
  };

  const provisionMissingPersonalMailboxes = async () => {
    const missingMembers = membersMissingPersonalMailbox;
    if (!missingMembers.length || bulkProvisioning) return;
    const totalQuotaGb = missingMembers.reduce(
      (total, member) => total + member.mailbox_quota_mb,
      0,
    ) / 1024;
    const confirmed = window.confirm(
      `Provision ${missingMembers.length} missing personal Lodge mailboxes at MXroute with up to ${totalQuotaGb.toFixed(1)} GB of configured quota? This creates locked mailboxes but does not send bulk member email.`,
    );
    if (!confirmed) return;

    setBulkProvisioning(true);
    setBulkProgress(`Starting 0 of ${missingMembers.length}…`);
    setError('');
    setNotice('');
    let provisioned = 0;
    const failures: string[] = [];
    let stoppedMessage = '';

    for (let index = 0; index < missingMembers.length; index += 5) {
      const batch = missingMembers.slice(index, index + 5);
      const { data, error: provisioningError } = await supabase.functions.invoke(
        'provision-member-mailboxes',
        {
          body: {
            mode: 'run',
            confirmed: true,
            memberIds: batch.map(member => member.id),
          },
        },
      );
      if (provisioningError) {
        stoppedMessage = await functionErrorMessage(
          provisioningError,
          'Personal mailbox provisioning stopped before every member was processed.',
        );
        break;
      }

      const results = Array.isArray(data?.results) ? data.results as Array<{
        memberName?: unknown;
        ok?: unknown;
      }> : [];
      provisioned += results.filter(result => result.ok === true).length;
      failures.push(...results
        .filter(result => result.ok !== true)
        .map(result => typeof result.memberName === 'string' ? result.memberName : 'Unknown member'));
      setBulkProgress(`Processed ${Math.min(index + batch.length, missingMembers.length)} of ${missingMembers.length}…`);
    }

    await fetchData();
    setBulkProvisioning(false);
    setBulkProgress('');
    if (stoppedMessage) {
      setError(`${provisioned} mailboxes were provisioned before processing stopped. ${stoppedMessage}`);
    } else if (failures.length > 0) {
      setError(`${provisioned} mailboxes were provisioned. ${failures.length} need attention: ${failures.join(', ')}.`);
    } else {
      setNotice(`${provisioned} personal Lodge ${provisioned === 1 ? 'mailbox was' : 'mailboxes were'} provisioned. No member email was sent.`);
    }
  };

  const syncAccount = async (account: AdminEmailAccount) => {
    const data = await invokeAction(account, 'admin_sync_role_account');
    if (data) setNotice(data.existingMailboxPreserved ? `${account.address} was verified at MXroute without recreating it.` : `${account.address} was created at MXroute.`);
  };

  const sendInvitation = async (account: AdminEmailAccount) => {
    const data = await invokeAction(account, 'admin_send_role_invitation', { requestId: crypto.randomUUID() });
    if (data) setNotice(`A secure ${account.position_name} activation invitation was sent to the holder's verified personal email.`);
  };

  const submitHandover = async () => {
    if (!handoverAccount || !incomingMemberId || !handoverConfirmed) return;
    const data = await invokeAction(handoverAccount, 'admin_initiate_handover', {
      incomingMemberId,
      reason: handoverReason,
      confirmed: true,
    });
    if (data) {
      setNotice(`${handoverAccount.address} is waiting for the incoming holder to accept the agreement and choose new credentials.`);
      setHandoverAccount(null);
      setIncomingMemberId('');
      setHandoverConfirmed(false);
    }
  };

  const submitConfirmationAction = async () => {
    if (!confirmationAction || !confirmationChecked || !confirmationReason.trim()) return;
    const action = confirmationAction.personal
      ? 'admin_suspend_personal_account'
      : confirmationAction.action === 'suspend' ? 'admin_suspend_account' : 'admin_vacate_role';
    const data = await invokeAction(confirmationAction.account, action, { confirmed: true, reason: confirmationReason.trim() });
    if (data) {
      setNotice(confirmationAction.personal
        ? 'The personal mailbox credentials were rotated and the account was suspended.'
        : confirmationAction.action === 'suspend'
          ? 'The role mailbox credentials were rotated and the account was suspended.'
          : 'The role was vacated and prior credentials were rotated.');
      setConfirmationAction(null);
      setConfirmationChecked(false);
      setConfirmationReason('');
    }
  };

  const openConfiguration = (account: AdminEmailAccount) => {
    setConfigureAccount(account);
    setConfigurationForm({
      displayName: account.display_name,
      enabled: account.enabled,
      agreementRequired: account.agreement_required,
    });
  };

  const saveConfiguration = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!configureAccount) return;
    const data = await invokeAction(configureAccount, 'admin_update_role_configuration', {
      displayName: configurationForm.displayName,
      enabled: configurationForm.enabled,
      agreementRequired: configurationForm.agreementRequired,
    });
    if (data) {
      setConfigureAccount(null);
      setNotice(`${configureAccount.address} configuration was updated without changing the mailbox or its contents.`);
    }
  };

  const createAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const { error: createError } = await supabase.functions.invoke('manage-lodge-email', {
      body: {
        action: 'admin_create_role_account',
        positionId: createForm.positionId,
        address: createForm.address,
        displayName: createForm.displayName,
        accountType: createForm.accountType,
        incomingMemberId: createForm.memberId || undefined,
        agreementRequired: true,
      },
    });
    if (createError) {
      setError(await functionErrorMessage(createError, 'The role mailbox configuration could not be created.'));
      return;
    }
    setShowCreate(false);
    setCreateForm({ positionId: '', address: '', displayName: '', accountType: 'FUNCTIONAL', memberId: '' });
    setNotice('The role mailbox was configured. Use Provision / Verify to connect it to MXroute.');
    await fetchData();
  };

  const loadReceipt = async (account: AdminEmailAccount) => {
    const { data, error: receiptError } = await supabase.rpc('get_email_agreement_receipt', { target_account_id: account.id });
    if (receiptError) {
      setError(receiptError.message);
      return;
    }
    setReceipt(((data as EmailAgreementReceipt[] | null) ?? [])[0] ?? null);
  };

  const openPolicyVersion = (policy: EmailPolicyVersion) => {
    const effective = new Date(policy.effective_at);
    setPolicyDraft({
      policyType: policy.policy_type,
      title: policy.title,
      content: policy.content,
      acknowledgement: policy.acknowledgement,
      effectiveAt: effective.toISOString().slice(0, 16),
      requiresReacceptance: true,
    });
  };

  const createPolicyVersion = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!policyDraft) return;
    setError('');
    const { error: policyError } = await supabase.functions.invoke('manage-lodge-email', {
      body: {
        action: 'admin_create_policy_version',
        ...policyDraft,
        effectiveAt: new Date(policyDraft.effectiveAt).toISOString(),
      },
    });
    if (policyError) {
      setError(await functionErrorMessage(policyError, 'The new policy version could not be published.'));
      return;
    }
    setPolicyDraft(null);
    setNotice('The new agreement version was published. Historical acceptance receipts remain unchanged.');
    await fetchData();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-serif text-slate-900">Mailbox administration</h3>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">
            Manage Lodge-owned role accounts and individual member mailboxes. Role correspondence remains with Carleton Lodge through every officer handover.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canWrite && policies.map(policy => <button key={policy.id} type="button" onClick={() => openPolicyVersion(policy)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700"><Settings size={16} /> New {policy.policy_type === 'MEMBER_EMAIL_TERMS' ? 'Member' : 'Officer'} Agreement Version</button>)}
          {canWrite && <button type="button" onClick={() => setShowCreate(true)} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-amber-300"><Plus size={16} /> Add Role Mailbox</button>}
          <button type="button" onClick={fetchData} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh</button>
        </div>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm leading-relaxed text-blue-950">
        MXroute supports mailbox creation, status lookup, password rotation, quota changes, and send-limit changes. It does not expose per-mailbox session or app-password revocation. Handovers therefore rotate the mailbox password immediately and record that provider limitation in the audit trail.
      </div>
      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{error}</p>}
      {notice && <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900" role="status">{notice}</p>}

      <div className="flex border-b border-slate-200" role="tablist" aria-label="Mailbox type">
        <button
          type="button"
          role="tab"
          aria-selected={activeMailboxTab === 'role'}
          onClick={() => {
            setActiveMailboxTab('role');
            setExpandedAccountId(null);
          }}
          className={`-mb-px border-b-2 px-5 py-2.5 text-sm font-semibold transition-colors ${activeMailboxTab === 'role' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Role Mailboxes
          <span className={`ml-2 rounded-full px-1.5 py-0.5 text-xs ${activeMailboxTab === 'role' ? 'bg-slate-200 text-slate-800' : 'bg-slate-100 text-slate-500'}`}>{accounts.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeMailboxTab === 'personal'}
          onClick={() => {
            setActiveMailboxTab('personal');
            setExpandedAccountId(null);
          }}
          className={`-mb-px border-b-2 px-5 py-2.5 text-sm font-semibold transition-colors ${activeMailboxTab === 'personal' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Personal Mailboxes
          <span className={`ml-2 rounded-full px-1.5 py-0.5 text-xs ${activeMailboxTab === 'personal' ? 'bg-slate-200 text-slate-800' : 'bg-slate-100 text-slate-500'}`}>{personalAccounts.length}</span>
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <label className="relative block">
          <span className="sr-only">Search Lodge mailboxes</span>
          <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
            placeholder="Search by address, display name, position, or member"
            className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-100"
          />
        </label>
        {!loading && <p className="text-xs text-slate-500" aria-live="polite">Showing {filteredAccounts.length} of {displayedAccounts.length}</p>}
      </div>

      {activeMailboxTab === 'personal' && (
        <div className="space-y-3">
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Personal Lodge email stays with the verified individual and is never handed to a successor.
          </p>
          {!loading && membersMissingPersonalMailbox.length > 0 && (
            <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">
                  {membersMissingPersonalMailbox.length} roster {membersMissingPersonalMailbox.length === 1 ? 'member needs' : 'members need'} a personal Lodge mailbox.
                </p>
                <p className="mt-1 text-amber-900">Provisioning is idempotent, preserves existing mailboxes, and sends no bulk member email.</p>
                {bulkProgress && <p className="mt-2 font-medium" role="status">{bulkProgress}</p>}
              </div>
              {canWrite && (
                <button
                  type="button"
                  onClick={provisionMissingPersonalMailboxes}
                  disabled={bulkProvisioning}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 font-semibold text-amber-300 disabled:opacity-60"
                >
                  <RefreshCw size={17} className={bulkProvisioning ? 'animate-spin' : ''} aria-hidden="true" />
                  {bulkProvisioning
                    ? 'Provisioning…'
                    : `Provision ${membersMissingPersonalMailbox.length} ${membersMissingPersonalMailbox.length === 1 ? 'Mailbox' : 'Mailboxes'}`}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-sm text-slate-500">Loading Lodge mailboxes…</div>
      ) : displayedAccounts.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">
          {activeMailboxTab === 'role' ? 'No Lodge role mailboxes are configured.' : 'No personal Lodge mailboxes have been associated yet.'}
        </p>
      ) : filteredAccounts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">No mailboxes match your search.</p>
      ) : (
        <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {filteredAccounts.map(account => {
            const isPersonal = account.account_type === 'MEMBER';
            const memberId = isPersonal ? account.associated_member_id : account.current_authorized_member_id;
            const holder = memberId ? memberMap.get(memberId) : null;
            const handover = isPersonal ? null : latestHandover(account.id);
            const busy = workingId === account.id;
            const expanded = expandedAccountId === account.id;
            const buttonId = `email-account-button-${account.id}`;
            const panelId = `email-account-panel-${account.id}`;
            const agreementAccepted = acceptedAccountIds.has(account.id);
            const mailboxType = isPersonal ? 'Personal' : account.account_type === 'OFFICER' ? 'Officer' : 'Functional';

            return (
              <article key={account.id}>
                <button
                  id={buttonId}
                  type="button"
                  onClick={() => setExpandedAccountId(current => current === account.id ? null : account.id)}
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  aria-label={`Manage mailbox ${account.address}`}
                  className="grid w-full gap-3 px-4 py-4 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-900 sm:grid-cols-[minmax(0,1.3fr)_auto_auto_auto] sm:items-center sm:gap-5"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700"><Mail size={17} aria-hidden="true" /></span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-900">{account.address}</span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500">{isPersonal ? holder?.full_name ?? 'Unknown member' : account.display_name}</span>
                    </span>
                  </span>
                  <span className="w-fit rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{isPersonal ? 'Personal mailbox' : account.position_name}</span>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass(account.status)}`}>{statusLabel(account.status)}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${agreementAccepted ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {agreementAccepted && <CheckCircle2 size={12} aria-hidden="true" />}
                      {agreementAccepted ? 'Agreement accepted' : 'Agreement outstanding'}
                    </span>
                    {handover?.state === 'FAILED' && <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-semibold text-red-800"><AlertTriangle size={12} aria-hidden="true" /> Action required</span>}
                  </span>
                  <ChevronDown size={18} aria-hidden="true" className={`justify-self-end text-slate-400 transition-transform ${expanded ? 'rotate-180 text-slate-700' : ''}`} />
                </button>

                {expanded && (
                  <div id={panelId} role="region" aria-labelledby={buttonId} className="border-t border-slate-200 bg-slate-50 px-4 py-5 sm:px-6">
                    {handover?.state === 'FAILED' && (
                      <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                        <AlertTriangle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
                        <p><strong>Handover action required.</strong>{handover.failure_message ? ` ${handover.failure_message}` : ' Review the mailbox details or retry the handover.'}</p>
                      </div>
                    )}

                    <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-lg border border-slate-200 bg-white p-4">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ownership</dt>
                        <dd className="mt-3 space-y-2 text-sm text-slate-700">
                          <p><span className="font-medium text-slate-900">Member:</span> {holder?.full_name ?? (isPersonal ? 'Unknown member' : 'Vacant')}</p>
                          <p><span className="font-medium text-slate-900">Type:</span> {mailboxType}</p>
                          {!isPersonal && <p><span className="font-medium text-slate-900">Position:</span> {account.position_name}</p>}
                        </dd>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-4">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Access</dt>
                        <dd className="mt-3 space-y-2 text-sm text-slate-700">
                          <p><span className="font-medium text-slate-900">Agreement:</span> {agreementAccepted ? 'Accepted' : 'Outstanding'}</p>
                          <p><span className="font-medium text-slate-900">Credentials:</span> {credentialLabel(account.credential_status)}</p>
                          <p><span className="font-medium text-slate-900">Configuration:</span> {account.enabled ? 'Enabled' : 'Disabled'}</p>
                        </dd>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-4">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mailbox</dt>
                        <dd className="mt-3 space-y-2 text-sm text-slate-700">
                          <p className="break-all"><span className="font-medium text-slate-900">Address:</span> {account.address}</p>
                          <p><span className="font-medium text-slate-900">Provider:</span> MXroute</p>
                          <p><span className="font-medium text-slate-900">Status:</span> {statusLabel(account.status)}</p>
                        </dd>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-4">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Activity</dt>
                        <dd className="mt-3 space-y-2 text-sm text-slate-700">
                          <p><span className="font-medium text-slate-900">Activated:</span> {formatAccountDate(account.activated_at)}</p>
                          <p><span className="font-medium text-slate-900">Credentials rotated:</span> {formatAccountDate(account.last_credential_rotation_at)}</p>
                          {!isPersonal && <p><span className="font-medium text-slate-900">Last transfer:</span> {formatAccountDate(account.last_handover_at)}</p>}
                        </dd>
                      </div>
                    </dl>

                    {canWrite && (
                      <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-200 pt-4">
                        {!isPersonal && <ActionButton label={account.status === 'NOT_PROVISIONED' ? 'Provision' : 'Verify'} icon={RefreshCw} disabled={busy} onClick={() => syncAccount(account)} />}
                        {!isPersonal && account.current_authorized_member_id && account.status !== 'NOT_PROVISIONED' && account.status !== 'ACTIVE' && <ActionButton label="Send Invite" icon={Send} disabled={busy} onClick={() => sendInvitation(account)} />}
                        {!isPersonal && account.status === 'ACTIVE' && <ActionButton label="Password Reset" icon={KeyRound} disabled={busy} onClick={() => invokeAction(account, 'admin_initiate_password_reset').then(data => data && setNotice('A secure password-reset link was sent to the current holder.'))} />}
                        {isPersonal && account.status === 'ACTIVE' && <ActionButton label="Password Reset" icon={KeyRound} disabled={busy} onClick={() => invokeAction(account, 'admin_initiate_personal_password_reset').then(data => data && setNotice('A secure password-reset link was sent to the member.'))} />}
                        {!isPersonal && handover?.state === 'FAILED' && <ActionButton label="Retry Handover" icon={RefreshCw} disabled={busy} onClick={() => invokeAction(account, 'admin_retry_handover')} />}
                        {!isPersonal && <ActionButton label={account.current_authorized_member_id ? 'Handover' : 'Assign'} icon={UserRoundCog} disabled={busy || account.status === 'NOT_PROVISIONED'} onClick={() => { setHandoverAccount(account); setIncomingMemberId(''); setHandoverConfirmed(false); }} />}
                        {isPersonal && account.status === 'SUSPENDED' && <ActionButton label="Reactivate" icon={Send} disabled={busy} onClick={() => invokeAction(account, 'admin_reactivate_personal_account').then(data => data && setNotice('A secure reactivation link was sent to the member.'))} />}
                        {isPersonal && account.status !== 'SUSPENDED' && <ActionButton label="Suspend" icon={ShieldOff} disabled={busy} onClick={() => { setConfirmationAction({ account, action: 'suspend', personal: true }); setConfirmationReason(''); setConfirmationChecked(false); }} />}
                        {!isPersonal && account.status === 'SUSPENDED' && <ActionButton label="Reactivate" icon={Send} disabled={busy} onClick={() => invokeAction(account, 'admin_reactivate_account')} />}
                        {!isPersonal && account.status !== 'SUSPENDED' && <ActionButton label="Suspend" icon={ShieldOff} disabled={busy || !account.current_authorized_member_id} onClick={() => { setConfirmationAction({ account, action: 'suspend' }); setConfirmationReason(''); setConfirmationChecked(false); }} />}
                        {!isPersonal && account.current_authorized_member_id && <ActionButton label="Vacate" icon={X} disabled={busy} onClick={() => { setConfirmationAction({ account, action: 'vacate' }); setConfirmationReason('Office or functional responsibility is vacant'); setConfirmationChecked(false); }} />}
                        {!isPersonal && <ActionButton label="Configure" icon={Settings} disabled={busy} onClick={() => openConfiguration(account)} />}
                        <ActionButton label="Details & History" icon={History} disabled={busy} onClick={() => { setDetailAccount(account); setReceipt(null); }} />
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {showCreate && (
        <Modal title="Add Role Mailbox" onClose={() => setShowCreate(false)}>
          <form onSubmit={createAccount} className="space-y-4">
            <FieldLabel label="Lodge position"><select required value={createForm.positionId} onChange={event => setCreateForm(current => ({ ...current, positionId: event.target.value }))} className="min-h-11 w-full rounded-md border border-slate-300 px-3"><option value="">Choose a position</option>{positions.filter(position => !accounts.some(account => account.position_id === position.id)).map(position => <option key={position.id} value={position.id}>{position.name}</option>)}</select></FieldLabel>
            <FieldLabel label="Mailbox address"><input required type="email" value={createForm.address} onChange={event => setCreateForm(current => ({ ...current, address: event.target.value.toLowerCase() }))} placeholder="role@carpmasons.ca" className="min-h-11 w-full rounded-md border border-slate-300 px-3" /></FieldLabel>
            <FieldLabel label="Display name"><input required value={createForm.displayName} onChange={event => setCreateForm(current => ({ ...current, displayName: event.target.value }))} className="min-h-11 w-full rounded-md border border-slate-300 px-3" /></FieldLabel>
            <FieldLabel label="Account type"><select value={createForm.accountType} onChange={event => setCreateForm(current => ({ ...current, accountType: event.target.value as 'OFFICER' | 'FUNCTIONAL' }))} className="min-h-11 w-full rounded-md border border-slate-300 px-3"><option value="OFFICER">Officer</option><option value="FUNCTIONAL">Functional</option></select></FieldLabel>
            <FieldLabel label="Initial holder (optional)"><select value={createForm.memberId} onChange={event => setCreateForm(current => ({ ...current, memberId: event.target.value }))} className="min-h-11 w-full rounded-md border border-slate-300 px-3"><option value="">Leave vacant</option>{members.map(member => <option key={member.id} value={member.id}>{member.full_name}</option>)}</select></FieldLabel>
            <div className="flex justify-end gap-3 pt-3"><button type="button" onClick={() => setShowCreate(false)} className="min-h-11 rounded-md border border-slate-300 px-4">Cancel</button><button type="submit" className="min-h-11 rounded-md bg-slate-900 px-5 font-semibold text-amber-300">Save Configuration</button></div>
          </form>
        </Modal>
      )}

      {policyDraft && (
        <Modal title="Publish New Email Agreement Version" onClose={() => setPolicyDraft(null)} wide>
          <form onSubmit={createPolicyVersion} className="space-y-4">
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">Publishing creates a new immutable version. It never alters historical receipts. If reacceptance is required, current users will be asked to accept this exact new version.</p>
            <FieldLabel label="Agreement title"><input required value={policyDraft.title} onChange={event => setPolicyDraft(current => current ? { ...current, title: event.target.value } : current)} className="min-h-11 w-full rounded-md border border-slate-300 px-3" /></FieldLabel>
            <FieldLabel label="Agreement text"><textarea required rows={16} value={policyDraft.content} onChange={event => setPolicyDraft(current => current ? { ...current, content: event.target.value } : current)} className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs leading-relaxed" /></FieldLabel>
            <FieldLabel label="Unchecked acknowledgement text"><textarea required rows={4} value={policyDraft.acknowledgement} onChange={event => setPolicyDraft(current => current ? { ...current, acknowledgement: event.target.value } : current)} className="w-full rounded-md border border-slate-300 px-3 py-2" /></FieldLabel>
            <FieldLabel label="Effective date and time"><input required type="datetime-local" value={policyDraft.effectiveAt} onChange={event => setPolicyDraft(current => current ? { ...current, effectiveAt: event.target.value } : current)} className="min-h-11 w-full rounded-md border border-slate-300 px-3" /></FieldLabel>
            <label className="flex items-start gap-3"><input type="checkbox" checked={policyDraft.requiresReacceptance} onChange={event => setPolicyDraft(current => current ? { ...current, requiresReacceptance: event.target.checked } : current)} className="mt-1 h-4 w-4" /><span className="text-sm text-slate-700">Require members or role holders to accept this new version.</span></label>
            <div className="flex justify-end gap-3 pt-3"><button type="button" onClick={() => setPolicyDraft(null)} className="min-h-11 rounded-md border border-slate-300 px-4">Cancel</button><button type="submit" className="min-h-11 rounded-md bg-slate-900 px-5 font-semibold text-amber-300">Publish New Version</button></div>
          </form>
        </Modal>
      )}

      {configureAccount && (
        <Modal title="Configure Role Mailbox" onClose={() => setConfigureAccount(null)}>
          <form onSubmit={saveConfiguration} className="space-y-4">
            <dl className="rounded-lg bg-slate-50 p-4 text-sm"><dt className="font-semibold text-slate-500">Lodge position and mailbox</dt><dd className="mt-1 font-medium text-slate-900">{configureAccount.position_name} · {configureAccount.address}</dd></dl>
            <FieldLabel label="Display name"><input required value={configurationForm.displayName} onChange={event => setConfigurationForm(current => ({ ...current, displayName: event.target.value }))} className="min-h-11 w-full rounded-md border border-slate-300 px-3" /></FieldLabel>
            <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-4"><input type="checkbox" checked={configurationForm.agreementRequired} onChange={event => setConfigurationForm(current => ({ ...current, agreementRequired: event.target.checked }))} className="mt-1 h-4 w-4" /><span><strong className="block text-slate-900">Require Officer Agreement</strong><span className="mt-1 block text-sm leading-relaxed text-slate-600">The current holder must accept the versioned Officer and Functional Email Account Agreement before activation.</span></span></label>
            <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-4"><input type="checkbox" checked={configurationForm.enabled} onChange={event => setConfigurationForm(current => ({ ...current, enabled: event.target.checked }))} className="mt-1 h-4 w-4" /><span><strong className="block text-slate-900">Enabled</strong><span className="mt-1 block text-sm leading-relaxed text-slate-600">Disabled configurations are archived from member access. A mailbox with a current holder must be vacated before it can be disabled.</span></span></label>
            <p className="rounded-lg bg-blue-50 p-4 text-sm leading-relaxed text-blue-950">Handover behaviour is safely fixed to rotate credentials and preserve the existing MXroute mailbox. The mailbox address and Lodge position cannot be changed after creation.</p>
            <div className="flex justify-end gap-3"><button type="button" onClick={() => setConfigureAccount(null)} className="min-h-11 rounded-md border border-slate-300 px-4">Cancel</button><button type="submit" disabled={workingId === configureAccount.id} className="min-h-11 rounded-md bg-slate-900 px-5 font-semibold text-amber-300 disabled:opacity-50">Save Configuration</button></div>
          </form>
        </Modal>
      )}

      {handoverAccount && (
        <Modal title={handoverAccount.current_authorized_member_id ? 'Confirm Officer Account Handover' : 'Assign Role Mailbox'} onClose={() => setHandoverAccount(null)}>
          <div className="space-y-4 text-sm text-slate-700">
            <dl className="grid gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-2"><div><dt className="font-semibold text-slate-500">Position</dt><dd>{handoverAccount.position_name}</dd></div><div><dt className="font-semibold text-slate-500">Role mailbox</dt><dd className="break-all">{handoverAccount.address}</dd></div><div><dt className="font-semibold text-slate-500">Outgoing member</dt><dd>{handoverAccount.current_authorized_member_id ? memberMap.get(handoverAccount.current_authorized_member_id)?.full_name ?? 'Unknown' : 'Vacant'}</dd></div></dl>
            <FieldLabel label="Incoming verified member"><select required value={incomingMemberId} onChange={event => setIncomingMemberId(event.target.value)} className="min-h-11 w-full rounded-md border border-slate-300 px-3"><option value="">Choose a member</option>{members.filter(member => member.id !== handoverAccount.current_authorized_member_id && member.linked_profile_id && member.email).map(member => <option key={member.id} value={member.id}>{member.full_name}</option>)}</select></FieldLabel>
            <FieldLabel label="Reason"><textarea value={handoverReason} onChange={event => setHandoverReason(event.target.value)} rows={3} className="w-full rounded-md border border-slate-300 px-3 py-2" /></FieldLabel>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 leading-relaxed text-amber-950">Confirmation revokes the outgoing member's website authorization, rotates the MXroute mailbox password, preserves all correspondence, and sends the incoming member a secure invitation requiring the Officer Agreement and new credentials.</div>
            <label className="flex items-start gap-3"><input type="checkbox" checked={handoverConfirmed} onChange={event => setHandoverConfirmed(event.target.checked)} className="mt-1 h-4 w-4" /><span>I confirm this handover and understand that the outgoing mailbox credentials will be rotated.</span></label>
            <div className="flex justify-end gap-3"><button type="button" onClick={() => setHandoverAccount(null)} className="min-h-11 rounded-md border border-slate-300 px-4">Cancel</button><button type="button" onClick={submitHandover} disabled={!incomingMemberId || !handoverConfirmed || workingId === handoverAccount.id} className="min-h-11 rounded-md bg-slate-900 px-5 font-semibold text-amber-300 disabled:opacity-50">Confirm Handover</button></div>
          </div>
        </Modal>
      )}

      {confirmationAction && (
        <Modal title={confirmationAction.personal ? 'Suspend Personal Mailbox' : confirmationAction.action === 'suspend' ? 'Suspend Role Mailbox' : 'Vacate Role Mailbox'} onClose={() => setConfirmationAction(null)}>
          <div className="space-y-4 text-sm text-slate-700"><p>This action rotates the MXroute mailbox password. Mailbox contents are preserved.</p><FieldLabel label="Required reason"><textarea value={confirmationReason} onChange={event => setConfirmationReason(event.target.value)} rows={3} className="w-full rounded-md border border-slate-300 px-3 py-2" /></FieldLabel><label className="flex items-start gap-3"><input type="checkbox" checked={confirmationChecked} onChange={event => setConfirmationChecked(event.target.checked)} className="mt-1 h-4 w-4" /><span>I confirm this administrative action and the credential rotation.</span></label><div className="flex justify-end gap-3"><button type="button" onClick={() => setConfirmationAction(null)} className="min-h-11 rounded-md border border-slate-300 px-4">Cancel</button><button type="button" onClick={submitConfirmationAction} disabled={!confirmationReason.trim() || !confirmationChecked} className="min-h-11 rounded-md bg-red-700 px-5 font-semibold text-white disabled:opacity-50">Confirm</button></div></div>
        </Modal>
      )}

      {detailAccount && (
        <Modal title={`${detailAccount.position_name} Mailbox`} onClose={() => { setDetailAccount(null); setReceipt(null); }} wide>
          <AccountDetails account={detailAccount} members={memberMap} assignments={assignments.filter(item => item.email_account_id === detailAccount.id)} handovers={handovers.filter(item => item.email_account_id === detailAccount.id)} auditEvents={auditEvents.filter(item => item.email_account_id === detailAccount.id)} receipt={receipt} onLoadReceipt={() => loadReceipt(detailAccount)} />
        </Modal>
      )}
    </div>
  );
};

const ActionButton = ({ label, icon: Icon, disabled, onClick }: { label: string; icon: typeof Mail; disabled?: boolean; onClick: () => void }) => <button type="button" onClick={onClick} disabled={disabled} className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"><Icon size={13} aria-hidden="true" /> {label}</button>;

const FieldLabel = ({ label, children }: { label: string; children: React.ReactNode }) => <label className="block"><span className="mb-1 block text-sm font-semibold text-slate-700">{label}</span>{children}</label>;

const Modal = ({ title, onClose, wide = false, children }: { title: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) => <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div role="dialog" aria-modal="true" aria-label={title} className={`max-h-[90vh] w-full overflow-y-auto rounded-xl bg-white shadow-xl ${wide ? 'max-w-4xl' : 'max-w-lg'}`}><div className="flex items-center justify-between border-b border-slate-200 p-5"><h4 className="text-xl font-serif text-slate-900">{title}</h4><button type="button" onClick={onClose} aria-label={`Close ${title}`} className="text-slate-400 hover:text-slate-700"><X size={20} /></button></div><div className="p-5 sm:p-6">{children}</div></div></div>;

const AccountDetails = ({ account, members, assignments, handovers, auditEvents, receipt, onLoadReceipt }: { account: AdminEmailAccount; members: Map<string, LodgeMember>; assignments: OfficerMailboxAssignment[]; handovers: OfficerEmailHandover[]; auditEvents: LodgeEmailAuditEvent[]; receipt: EmailAgreementReceipt | null; onLoadReceipt: () => void }) => (
  <div className="space-y-6 text-sm">
    <dl className="grid gap-4 rounded-lg bg-slate-50 p-4 sm:grid-cols-3"><div><dt className="font-semibold text-slate-500">Account</dt><dd className="break-all text-slate-900">{account.address}</dd></div><div><dt className="font-semibold text-slate-500">Status</dt><dd>{statusLabel(account.status)}</dd></div><div><dt className="font-semibold text-slate-500">Credential status</dt><dd>{account.credential_status.split('_').join(' ')}</dd></div><div><dt className="font-semibold text-slate-500">Provider</dt><dd>MXroute</dd></div><div><dt className="font-semibold text-slate-500">Last credential rotation</dt><dd>{account.last_credential_rotation_at ? new Date(account.last_credential_rotation_at).toLocaleString('en-CA') : '—'}</dd></div><div><dt className="font-semibold text-slate-500">Last handover</dt><dd>{account.last_handover_at ? new Date(account.last_handover_at).toLocaleString('en-CA') : '—'}</dd></div></dl>
    <section><div className="flex items-center justify-between"><h5 className="font-semibold text-slate-900">Agreement receipt</h5><button type="button" onClick={onLoadReceipt} className="font-semibold text-blue-900 underline underline-offset-4">Load receipt</button></div>{receipt ? <div className="agreement-receipt-print mt-3 rounded-lg border border-slate-200 p-4"><p className="font-semibold text-slate-900">{receipt.member_name} · Version {receipt.agreement_version}</p><p className="mt-1 text-slate-600">Accepted {new Date(receipt.accepted_at).toLocaleString('en-CA')}</p><p className="mt-3 rounded bg-slate-50 p-3 leading-relaxed">{receipt.acknowledgement}</p><button type="button" onClick={() => window.print()} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 px-3 font-semibold print:hidden"><Settings size={14} /> Print receipt</button></div> : <p className="mt-2 text-slate-500">No receipt loaded.</p>}</section>
    <section><h5 className="font-semibold text-slate-900">Assignment history</h5><div className="mt-2 space-y-2">{assignments.map(item => <div key={item.id} className="rounded-lg border border-slate-200 p-3"><span className="font-semibold">{members.get(item.member_id)?.full_name ?? item.member_id}</span><span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs">{item.status}</span><p className="mt-1 text-xs text-slate-500">{new Date(item.assignment_start).toLocaleString('en-CA')}{item.assignment_end ? ` — ${new Date(item.assignment_end).toLocaleString('en-CA')}` : ''}</p></div>)}{assignments.length === 0 && <p className="text-slate-500">No assignments yet.</p>}</div></section>
    <section><h5 className="font-semibold text-slate-900">Handover history</h5><div className="mt-2 space-y-2">{handovers.map(item => <div key={item.id} className={`rounded-lg border p-3 ${item.state === 'FAILED' ? 'border-red-200 bg-red-50' : 'border-slate-200'}`}><p className="font-semibold">{item.state.split('_').join(' ')}</p><p className="mt-1 text-xs text-slate-500">{new Date(item.initiated_at).toLocaleString('en-CA')} · retry {item.retry_count}</p>{item.failure_message && <p className="mt-2 text-xs text-red-700">{item.failure_message}</p>}</div>)}{handovers.length === 0 && <p className="text-slate-500">No handovers yet.</p>}</div></section>
    <section><h5 className="font-semibold text-slate-900">Audit history</h5><div className="mt-2 max-h-72 space-y-2 overflow-y-auto">{auditEvents.map(item => <div key={item.id} className="rounded-lg border border-slate-200 p-3"><div className="flex justify-between gap-3"><span className="font-medium">{item.event_type.split('_').join(' ')}</span><span className={`text-xs font-semibold ${item.outcome === 'FAILURE' ? 'text-red-700' : item.outcome === 'WARNING' ? 'text-amber-700' : 'text-emerald-700'}`}>{item.outcome}</span></div><p className="mt-1 text-xs text-slate-500">{new Date(item.created_at).toLocaleString('en-CA')}</p></div>)}{auditEvents.length === 0 && <p className="text-slate-500">No audit events yet.</p>}</div></section>
  </div>
);
