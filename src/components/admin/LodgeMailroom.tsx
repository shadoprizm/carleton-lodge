import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  FileSearch,
  Inbox,
  Loader2,
  MailCheck,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  InboundEmail,
  DistrictLodge,
  MailroomAnnouncementDraft,
  MailroomDistrictLodgeDraft,
  MailroomEventDraft,
  MailroomImport,
  MailroomLibraryDraft,
  MailroomProposal,
  MailroomSummonsDraft,
  supabase,
  TrustedEmailSender,
} from '../../lib/supabase';

const inputClass = 'min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500';

const senderAddress = (value: string | null) => {
  const input = (value ?? '').trim().toLowerCase();
  return input.match(/<([^<>\s]+@[^<>\s]+)>/)?.[1] ?? input;
};

const emptyEvent = (): MailroomEventDraft => ({
  destination: 'carleton',
  district_name: null,
  district_lodge_id: null,
  source_issuer: 'Carleton Lodge No. 465',
  title: '',
  description: '',
  event_date: null,
  event_time: null,
  event_end_time: null,
  location: 'Carleton Lodge No. 465',
  location_address: '',
  poc_name: '',
  poc_contact: '',
  event_kind: 'meeting',
  degree: 'unspecified',
  is_memorial_service: false,
  visibility: 'members',
  notify_members: true,
  include_in_lodge_guide: true,
});

const emptyAnnouncement = (): MailroomAnnouncementDraft => ({
  title: '',
  body: '',
  priority: 'normal',
  visibility: 'members',
  notice_type: 'general',
  expires_at: null,
  notify_members: false,
  include_in_lodge_guide: true,
  source_issuer: '',
});

const emptySummons = (): MailroomSummonsDraft => ({
  destination: 'carleton',
  district_lodge_id: null,
  title: '',
  month: '',
  issue_date: null,
  content: '',
  notify_members: true,
  include_in_lodge_guide: true,
});

const emptyDistrictLodge = (): MailroomDistrictLodgeDraft => ({
  id: '',
  district_name: 'Ottawa District 1',
  name: '',
  lodge_number: '',
  location: '',
  website_url: '',
  worshipful_master_name: '',
  secretary_name: '',
  contact_email: '',
  contact_phone: '',
  details_as_of: null,
});

const emptyLibraryItem = (): MailroomLibraryDraft => ({
  title: '',
  summary: '',
  source: '',
  source_url: '',
  source_file_name: '',
  source_storage_path: '',
  file_name: 'email-source.txt',
  tags: [],
  rights_reviewed: false,
  include_in_lodge_guide: false,
});

const copyProposal = (proposal: MailroomProposal): MailroomProposal => ({
  ...proposal,
  publication_target: ['carleton', 'district', 'mixed', 'hold'].includes(proposal.publication_target)
    ? proposal.publication_target
    : 'hold',
  classification: proposal.classification ?? 'other',
  classification_tags: [...(proposal.classification_tags ?? [])],
  source_scope: proposal.source_scope ?? 'unknown',
  source_issuer: proposal.source_issuer ?? '',
  sensitivity: proposal.sensitivity ?? 'normal',
  needs_attachment_content: proposal.needs_attachment_content ?? false,
  summons: proposal.summons
    ? {
      ...proposal.summons,
      destination: proposal.summons.destination ?? (proposal.publication_target === 'district' ? 'district' : 'carleton'),
      district_lodge_id: proposal.summons.district_lodge_id ?? proposal.district_lodge?.id ?? null,
      issue_date: proposal.summons.issue_date ?? null,
      notify_members: proposal.summons.notify_members ?? proposal.summons.destination !== 'district',
      include_in_lodge_guide: proposal.summons.include_in_lodge_guide ?? true,
    }
    : null,
  district_lodge: proposal.district_lodge ? { ...proposal.district_lodge } : null,
  events: (proposal.events ?? []).map((event) => ({
    ...event,
    destination: event.destination ?? (proposal.publication_target === 'district' ? 'district' : 'carleton'),
    district_name: event.district_name ?? null,
    district_lodge_id: event.district_lodge_id ?? null,
    source_issuer: event.source_issuer ?? proposal.source_issuer ?? '',
    event_kind: event.event_kind ?? 'meeting',
    degree: event.degree ?? 'unspecified',
    is_memorial_service: event.is_memorial_service ?? false,
    notify_members: event.notify_members ?? event.destination !== 'district',
    include_in_lodge_guide: event.include_in_lodge_guide ?? true,
  })),
  announcements: (proposal.announcements ?? []).map((announcement) => ({
    ...announcement,
    notice_type: announcement.notice_type ?? 'general',
    expires_at: announcement.expires_at ?? null,
    notify_members: announcement.notify_members ?? false,
    include_in_lodge_guide: announcement.notice_type === 'memorial'
      ? false
      : announcement.include_in_lodge_guide ?? true,
    source_issuer: announcement.source_issuer ?? proposal.source_issuer ?? '',
  })),
  library_items: (proposal.library_items ?? []).map((item) => ({ ...item, tags: [...(item.tags ?? [])] })),
  warnings: [...(proposal.warnings ?? [])],
  source_files: [...(proposal.source_files ?? [])],
});

const statusStyle: Record<MailroomImport['status'], string> = {
  queued: 'bg-violet-100 text-violet-800',
  drafting: 'bg-blue-100 text-blue-800',
  needs_review: 'bg-amber-100 text-amber-900',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-slate-200 text-slate-700',
  failed: 'bg-red-100 text-red-800',
  duplicate: 'bg-slate-200 text-slate-700',
};

export const LodgeMailroom = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, hasAdminPermission } = useAuth();
  const canWrite = hasAdminPermission('communications', 'write');
  const [messages, setMessages] = useState<InboundEmail[]>([]);
  const [imports, setImports] = useState<MailroomImport[]>([]);
  const [senders, setSenders] = useState<TrustedEmailSender[]>([]);
  const [districtLodges, setDistrictLodges] = useState<DistrictLodge[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [senderEmail, setSenderEmail] = useState('');
  const [senderLabel, setSenderLabel] = useState('Lodge Secretary');
  const [editingSenderId, setEditingSenderId] = useState<string | null>(null);
  const [editingSenderEmail, setEditingSenderEmail] = useState('');
  const [editingSenderLabel, setEditingSenderLabel] = useState('');
  const [senderBusyId, setSenderBusyId] = useState<string | null>(null);
  const [inboundExpanded, setInboundExpanded] = useState(false);
  const [reviewing, setReviewing] = useState<MailroomImport | null>(null);
  const [proposal, setProposal] = useState<MailroomProposal | null>(null);

  const loadMailroom = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [messagesResult, importsResult, sendersResult, lodgesResult] = await Promise.all([
      supabase.from('inbound_emails').select('*').order('received_at', { ascending: false }).limit(25),
      supabase.from('mailroom_imports').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('trusted_email_senders').select('*').order('label'),
      supabase.from('district_lodges').select('*').order('district_name').order('name'),
    ]);
    const firstError = messagesResult.error ?? importsResult.error ?? sendersResult.error ?? lodgesResult.error;
    if (firstError) setError(firstError.message);
    setMessages((messagesResult.data as InboundEmail[] | null) ?? []);
    setImports((importsResult.data as MailroomImport[] | null) ?? []);
    setSenders((sendersResult.data as TrustedEmailSender[] | null) ?? []);
    setDistrictLodges((lodgesResult.data as DistrictLodge[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadMailroom();
  }, [loadMailroom]);

  useEffect(() => {
    const requestedImport = searchParams.get('mailroom');
    if (!requestedImport || reviewing) return;
    const item = imports.find((candidate) => candidate.id === requestedImport && candidate.status === 'needs_review');
    if (item) {
      setReviewing(item);
      setProposal(copyProposal(item.extracted_payload));
    }
  }, [imports, reviewing, searchParams]);

  const importByMessage = useMemo(
    () => new Map(imports.map((item) => [item.inbound_email_id, item])),
    [imports],
  );
  const activeSenderEmails = useMemo(
    () => new Set(senders.filter((sender) => sender.is_active).map((sender) => sender.email)),
    [senders],
  );

  const addTrustedSender = async (event: FormEvent) => {
    event.preventDefault();
    if (!canWrite || !user) return;
    const email = senderEmail.trim().toLowerCase();
    const label = senderLabel.trim();
    if (!email || !label) return;
    setError(null);
    setNotice(null);
    const { error: insertError } = await supabase.from('trusted_email_senders').insert({
      email,
      label,
      created_by: user.id,
    });
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setSenderEmail('');
    setNotice(`${email} is now trusted for Mailroom processing.`);
    await loadMailroom();
  };

  const toggleSender = async (sender: TrustedEmailSender) => {
    if (!canWrite) return;
    setSenderBusyId(sender.id);
    setError(null);
    setNotice(null);
    const { error: updateError } = await supabase
      .from('trusted_email_senders')
      .update({ is_active: !sender.is_active })
      .eq('id', sender.id);
    setSenderBusyId(null);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setNotice(`${sender.email} is now ${sender.is_active ? 'inactive' : 'active'}.`);
    await loadMailroom();
  };

  const startEditingSender = (sender: TrustedEmailSender) => {
    setEditingSenderId(sender.id);
    setEditingSenderLabel(sender.label);
    setEditingSenderEmail(sender.email);
    setError(null);
    setNotice(null);
  };

  const cancelEditingSender = () => {
    setEditingSenderId(null);
    setEditingSenderLabel('');
    setEditingSenderEmail('');
  };

  const saveTrustedSender = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite || !editingSenderId) return;
    const email = editingSenderEmail.trim().toLowerCase();
    const label = editingSenderLabel.trim();
    if (!email || !label) return;
    setSenderBusyId(editingSenderId);
    setError(null);
    setNotice(null);
    const { error: updateError } = await supabase
      .from('trusted_email_senders')
      .update({ email, label })
      .eq('id', editingSenderId);
    setSenderBusyId(null);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    cancelEditingSender();
    setNotice(`${email} was updated.`);
    await loadMailroom();
  };

  const removeTrustedSender = async (sender: TrustedEmailSender) => {
    if (!canWrite || !window.confirm(`Remove “${sender.label}” (${sender.email}) from trusted senders? Existing Mailroom records will not be deleted.`)) return;
    setSenderBusyId(sender.id);
    setError(null);
    setNotice(null);
    const { error: deleteError } = await supabase
      .from('trusted_email_senders')
      .delete()
      .eq('id', sender.id);
    setSenderBusyId(null);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    if (editingSenderId === sender.id) cancelEditingSender();
    setNotice(`${sender.email} was removed from trusted senders.`);
    await loadMailroom();
  };

  const prepareDraft = async (message: InboundEmail) => {
    if (!canWrite) return;
    setBusyId(message.id);
    setError(null);
    setNotice(null);
    const { data, error: invokeError } = await supabase.functions.invoke('cl-mailroom', {
      body: { action: 'process', inboundEmailId: message.id },
    });
    setBusyId(null);
    if (invokeError) {
      setError('The draft could not be prepared. Confirm the sender is trusted, the message passed email authentication, and Mailroom AI is configured.');
      return;
    }
    const result = data as { import?: MailroomImport } | null;
    setNotice('Draft prepared. Review every field before publishing.');
    await loadMailroom();
    if (result?.import?.status === 'needs_review') {
      setReviewing(result.import);
      setProposal(copyProposal(result.import.extracted_payload));
    }
  };

  const retryDraft = async (item: MailroomImport) => {
    if (!canWrite) return;
    setBusyId(item.id);
    setError(null);
    setNotice(null);
    const { data, error: invokeError } = await supabase.functions.invoke('cl-mailroom', {
      body: { action: 'retry', importId: item.id },
    });
    setBusyId(null);
    if (invokeError) {
      setError('The retry did not complete. The failure detail remains in the Mailroom audit record.');
      return;
    }
    const result = data as { import?: MailroomImport } | null;
    setNotice('Mailroom retried the message and prepared a fresh draft.');
    await loadMailroom();
    if (result?.import?.status === 'needs_review') openReview(result.import);
  };

  const openReview = (item: MailroomImport) => {
    setReviewing(item);
    setProposal(copyProposal(item.extracted_payload));
    setError(null);
    setNotice(null);
  };

  const closeReview = () => {
    if (busyId) return;
    setReviewing(null);
    setProposal(null);
    if (searchParams.has('mailroom')) {
      const next = new URLSearchParams(searchParams);
      next.delete('mailroom');
      setSearchParams(next, { replace: true });
    }
  };

  const updateEvent = <K extends keyof MailroomEventDraft>(
    index: number,
    key: K,
    value: MailroomEventDraft[K],
  ) => {
    if (!proposal) return;
    const events = proposal.events.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [key]: value } : item
    );
    setProposal({ ...proposal, events });
  };

  const updateAnnouncement = <K extends keyof MailroomAnnouncementDraft>(
    index: number,
    key: K,
    value: MailroomAnnouncementDraft[K],
  ) => {
    if (!proposal) return;
    const announcements = proposal.announcements.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [key]: value } : item
    );
    setProposal({ ...proposal, announcements });
  };

  const updateLibraryItem = <K extends keyof MailroomLibraryDraft>(
    index: number,
    key: K,
    value: MailroomLibraryDraft[K],
  ) => {
    if (!proposal) return;
    const libraryItems = proposal.library_items.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [key]: value } : item
    );
    setProposal({ ...proposal, library_items: libraryItems });
  };

  const approveDraft = async () => {
    if (!reviewing || !proposal || !canWrite) return;
    const itemCount = (proposal.summons ? 1 : 0)
      + proposal.events.length
      + proposal.announcements.length
      + proposal.library_items.length;
    if (itemCount === 0) {
      setError('Keep at least one proposed website action before publishing, or reject the draft as no action.');
      return;
    }
    if (reviewing.processing_mode === 'shadow') {
      setError('Shadow-test drafts are classification-only and cannot be published.');
      return;
    }
    if (proposal.summons?.destination === 'district' && !proposal.summons.district_lodge_id) {
      setError('Match the visiting summons to an approved Ottawa District 1 or 2 lodge.');
      return;
    }
    if (proposal.events.some((event) => event.destination === 'district' && !event.district_name)) {
      setError('Choose Ottawa District 1 or 2 for every visiting event.');
      return;
    }
    if (!window.confirm(`Publish ${itemCount} reviewed action${itemCount === 1 ? '' : 's'} to their selected website destinations?`)) return;
    setBusyId(reviewing.id);
    setError(null);
    const { error: invokeError } = await supabase.functions.invoke('cl-mailroom', {
      body: { action: 'approve', importId: reviewing.id, proposal },
    });
    setBusyId(null);
    if (invokeError) {
      setError('The draft was not published. Check that all required fields are complete and that you have Summons and Event approval permissions for the selected items.');
      return;
    }
    setReviewing(null);
    setProposal(null);
    setNotice('The reviewed actions were published. Only actions with their notification switch enabled were queued for email.');
    await loadMailroom();
  };

  const rejectDraft = async () => {
    if (!reviewing || !canWrite) return;
    if (!window.confirm('Reject this Mailroom draft? The original email remains in the audit record.')) return;
    setBusyId(reviewing.id);
    setError(null);
    const { error: invokeError } = await supabase.functions.invoke('cl-mailroom', {
      body: { action: 'reject', importId: reviewing.id },
    });
    setBusyId(null);
    if (invokeError) {
      setError('The draft could not be rejected.');
      return;
    }
    setReviewing(null);
    setProposal(null);
    setNotice('Draft rejected. Nothing was published.');
    await loadMailroom();
  };

  return (
    <section className="mb-8 rounded-xl border border-slate-200 bg-white shadow-sm" aria-labelledby="mailroom-title">
      <div className="border-b border-slate-200 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-slate-900 p-2.5 text-amber-300"><Inbox size={22} /></div>
            <div>
              <h3 id="mailroom-title" className="text-xl font-serif text-slate-900">Lodge Mailroom</h3>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                Authenticated mail sent to <strong>mailroom@carpmasons.ca</strong> can be classified into independent, editable website actions. Nothing is published automatically.
              </p>
            </div>
          </div>
          <button type="button" onClick={loadMailroom} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900"><ShieldCheck className="mb-1" size={18} /><strong>Authenticated intake</strong><br />Designated recipient, trusted sender, signed webhook, and DMARC or DKIM/SPF are required.</div>
          <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950"><FileSearch className="mb-1" size={18} /><strong>Smart routing</strong><br />Summons, events, memorials, notices, education, holds, and no-action mail are separated.</div>
          <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-950"><MailCheck className="mb-1" size={18} /><strong>Human publication</strong><br />Reviewers choose actions, visibility, notifications, and Lodge Guide inclusion.</div>
        </div>
        {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800" role="alert">{error}</p>}
        {notice && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-900" role="status">{notice}</p>}
      </div>

      <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.7fr)]">
        <div>
          <h4 className="font-semibold text-slate-900">Trusted senders</h4>
          <p className="mt-1 text-sm text-slate-600">Only active senders can trigger Mailroom processing. Inactive entries are retained for reference and can be reactivated or removed.</p>
          {canWrite && (
            <form onSubmit={addTrustedSender} className="mt-4 space-y-3">
              <label className="block text-sm font-medium text-slate-700">Role or label
                <input value={senderLabel} onChange={(event) => setSenderLabel(event.target.value)} maxLength={120} className={`${inputClass} mt-1`} required />
              </label>
              <label className="block text-sm font-medium text-slate-700">Email address
                <input type="email" value={senderEmail} onChange={(event) => setSenderEmail(event.target.value)} maxLength={320} placeholder="secretary@example.ca" className={`${inputClass} mt-1`} required />
              </label>
              <button type="submit" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-amber-300"><Plus size={16} /> Add trusted sender</button>
            </form>
          )}
          <div className="mt-4 space-y-2">
            {senders.map((sender) => editingSenderId === sender.id ? (
              <form key={sender.id} onSubmit={saveTrustedSender} className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
                <label className="block text-sm font-medium text-slate-700">Role or label
                  <input value={editingSenderLabel} onChange={(event) => setEditingSenderLabel(event.target.value)} maxLength={120} className={`${inputClass} mt-1 bg-white`} required />
                </label>
                <label className="block text-sm font-medium text-slate-700">Email address
                  <input type="email" value={editingSenderEmail} onChange={(event) => setEditingSenderEmail(event.target.value)} maxLength={320} className={`${inputClass} mt-1 bg-white`} required />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button type="submit" disabled={senderBusyId === sender.id} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-amber-300 disabled:opacity-50"><Save size={15} /> Save changes</button>
                  <button type="button" onClick={cancelEditingSender} disabled={senderBusyId === sender.id} className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 disabled:opacity-50">Cancel</button>
                </div>
              </form>
            ) : (
              <div key={sender.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{sender.label}</p>
                    <p className="truncate text-xs text-slate-500">{sender.email}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${sender.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                    {sender.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {canWrite && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => toggleSender(sender)} disabled={senderBusyId === sender.id} className="min-h-10 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 disabled:opacity-50" aria-label={`${sender.is_active ? 'Deactivate' : 'Activate'} trusted sender ${sender.label}`}>
                      {sender.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button type="button" onClick={() => startEditingSender(sender)} disabled={senderBusyId === sender.id} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 disabled:opacity-50" aria-label={`Edit trusted sender ${sender.label}`}><Pencil size={14} /> Edit</button>
                    <button type="button" onClick={() => removeTrustedSender(sender)} disabled={senderBusyId === sender.id} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-700 disabled:opacity-50" aria-label={`Remove trusted sender ${sender.label}`}><Trash2 size={14} /> Remove</button>
                  </div>
                )}
              </div>
            ))}
            {!loading && senders.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">No sender is trusted yet. Existing messages cannot be processed until one is added.</p>}
          </div>
        </div>

        <div className="self-start overflow-hidden rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setInboundExpanded((expanded) => !expanded)}
            aria-expanded={inboundExpanded}
            aria-controls="inbound-notification-history"
            aria-label={`${inboundExpanded ? 'Collapse' : 'Expand'} inbound notifications`}
            className="flex min-h-16 w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-slate-50"
          >
            <span>
              <span className="block font-semibold text-slate-900">Inbound Notifications</span>
              <span className="block text-xs text-slate-500">{messages.length} recent message{messages.length === 1 ? '' : 's'}</span>
            </span>
            <ChevronDown size={18} className={`shrink-0 text-slate-500 transition-transform ${inboundExpanded ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
          {inboundExpanded && (
            <div id="inbound-notification-history" className="space-y-3 border-t border-slate-200 p-4">
              <p className="text-sm text-slate-600">Eligible messages are prepared automatically when automation is enabled. Manual preparation remains available for captured messages.</p>
              {messages.map((message) => {
                const item = importByMessage.get(message.id);
                const trusted = activeSenderEmails.has(senderAddress(message.from_address));
                return (
                  <article key={message.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900">{message.subject || '(no subject)'}</p>
                        <p className="mt-1 break-all text-sm text-slate-600">From {message.from_address || 'unknown sender'}</p>
                        <p className="mt-1 text-xs text-slate-400">{new Date(message.received_at).toLocaleString('en-CA')} · {message.attachments.length} attachment{message.attachments.length === 1 ? '' : 's'}</p>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${trusted ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                          {trusted ? 'Trusted sender' : 'Not trusted'}
                        </span>
                        {item && <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle[item.status]}`}>{item.status.split('_').join(' ')}</span>}
                      </div>
                    </div>
                    {item?.summary && <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">{item.summary}</p>}
                    {item?.last_error && <p className="mt-3 text-sm text-red-700">{item.last_error}</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {canWrite && trusted && !item && (
                        <button type="button" onClick={() => prepareDraft(message)} disabled={busyId === message.id} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-amber-300 disabled:opacity-50">
                          {busyId === message.id ? <Loader2 size={16} className="animate-spin" /> : <FileSearch size={16} />} Prepare draft
                        </button>
                      )}
                      {canWrite && item?.status === 'failed' && (
                        <button type="button" onClick={() => retryDraft(item)} disabled={busyId === item.id} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-amber-300 disabled:opacity-50">
                          {busyId === item.id ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Retry extraction
                        </button>
                      )}
                      {item?.status === 'needs_review' && (
                        <button type="button" onClick={() => openReview(item)} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950"><CheckCircle2 size={16} /> Review draft</button>
                      )}
                      <details className="w-full text-sm text-slate-600">
                        <summary className="cursor-pointer py-2 font-medium">View original email text</summary>
                        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-sans text-sm leading-6">{message.text_body || 'No plain-text body was captured.'}</pre>
                      </details>
                    </div>
                  </article>
                );
              })}
              {!loading && messages.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No inbound messages yet.</p>}
            </div>
          )}
        </div>
      </div>

      {reviewing && proposal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="review-mailroom-title">
          <div className="mx-auto max-w-5xl rounded-xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 rounded-t-xl border-b border-slate-200 bg-white p-5">
              <div>
                <h3 id="review-mailroom-title" className="text-2xl font-serif text-slate-900">Review Mailroom draft</h3>
                <p className="mt-1 text-sm text-slate-600">Edit or remove anything the extraction did not get exactly right.</p>
              </div>
              <button type="button" onClick={closeReview} className="min-h-11 min-w-11 rounded-lg border border-slate-300 p-2 text-slate-600" aria-label="Close review"><X className="mx-auto" size={20} /></button>
            </div>
            <div className="space-y-7 p-5 sm:p-7">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <div className="rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-700">{proposal.summary}</div>
                <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-900"><strong>Extraction confidence</strong><br />{Math.round((proposal.confidence ?? 0) * 100)}%</div>
              </div>
              {proposal.warnings.length > 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
                  <h4 className="flex items-center gap-2 font-semibold text-amber-950"><AlertTriangle size={18} /> Check these items</h4>
                  <ul className="mt-2 list-disc space-y-1 pl-6 text-sm text-amber-950">{proposal.warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul>
                </div>
              )}

              <section className={`rounded-xl border-2 p-4 sm:p-5 ${proposal.publication_target === 'hold' ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50'}`}>
                <div className="flex flex-wrap gap-2">
                  {proposal.classification_tags.map((tag) => <span key={tag} className="rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-700">{tag.split('_').join(' ')}</span>)}
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-semibold text-slate-800">Issuing lodge or organization<input className={`${inputClass} mt-1 bg-white`} value={proposal.source_issuer} onChange={(event) => setProposal({ ...proposal, source_issuer: event.target.value })} /></label>
                  <label className="text-sm font-semibold text-slate-800">Source scope<select className={`${inputClass} mt-1 bg-white`} value={proposal.source_scope} onChange={(event) => setProposal({ ...proposal, source_scope: event.target.value as MailroomProposal['source_scope'] })}><option value="carleton">Carleton Lodge</option><option value="district_1">Ottawa District 1</option><option value="district_2">Ottawa District 2</option><option value="outside_scope">Outside approved scope</option><option value="unknown">Unknown — hold for review</option></select></label>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-700">The forwarding secretary is recorded separately from this issuer. Each action below has its own destination, notification, and Lodge Guide controls.</p>
                {reviewing.processing_mode === 'shadow' && <p className="mt-3 font-semibold text-red-800">Shadow mode: classification can be reviewed, but publishing is locked.</p>}
              </section>

              <section>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h4 className="text-lg font-semibold text-slate-900">Summons</h4>
                  <button type="button" onClick={() => setProposal({ ...proposal, summons: proposal.summons ? null : emptySummons() })} className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
                    {proposal.summons ? 'Remove summons' : 'Add summons'}
                  </button>
                </div>
                {proposal.summons ? (
                  <div className="mt-3 grid gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-2">
                    <label className="text-sm font-medium text-slate-700">Destination<select className={`${inputClass} mt-1`} value={proposal.summons.destination} onChange={(event) => setProposal({ ...proposal, summons: { ...proposal.summons!, destination: event.target.value as MailroomSummonsDraft['destination'], district_lodge_id: event.target.value === 'district' ? proposal.summons!.district_lodge_id : null, notify_members: event.target.value === 'carleton' } })}><option value="carleton">Carleton summons archive</option><option value="district">Visiting-lodge summons</option></select></label>
                    {proposal.summons.destination === 'district' && <label className="text-sm font-medium text-slate-700">Approved lodge match<select className={`${inputClass} mt-1`} value={proposal.summons.district_lodge_id ?? ''} onChange={(event) => { const lodge = districtLodges.find((item) => item.id === event.target.value); setProposal({ ...proposal, summons: { ...proposal.summons!, district_lodge_id: lodge?.id ?? null }, district_lodge: lodge ? { ...emptyDistrictLodge(), id: lodge.id, district_name: lodge.district_name as MailroomDistrictLodgeDraft['district_name'], name: lodge.name, lodge_number: lodge.lodge_number ?? '', location: lodge.location ?? '' } : null }); }} required><option value="">Select a District 1 or 2 lodge</option>{districtLodges.map((lodge) => <option key={lodge.id} value={lodge.id}>{lodge.district_name} · {lodge.name}{lodge.lodge_number ? ` No. ${lodge.lodge_number}` : ''}</option>)}</select></label>}
                    <label className="text-sm font-medium text-slate-700">Title<input className={`${inputClass} mt-1`} value={proposal.summons.title} onChange={(event) => setProposal({ ...proposal, summons: { ...proposal.summons!, title: event.target.value } })} required /></label>
                    <label className="text-sm font-medium text-slate-700">Month<input className={`${inputClass} mt-1`} value={proposal.summons.month} onChange={(event) => setProposal({ ...proposal, summons: { ...proposal.summons!, month: event.target.value } })} placeholder="September 2026" required /></label>
                    <label className="text-sm font-medium text-slate-700">Issue date, if stated<input type="date" className={`${inputClass} mt-1`} value={proposal.summons.issue_date ?? ''} onChange={(event) => setProposal({ ...proposal, summons: { ...proposal.summons!, issue_date: event.target.value || null } })} /></label>
                    <label className="text-sm font-medium text-slate-700 sm:col-span-2">Summons text<textarea className={`${inputClass} mt-1 min-h-48`} value={proposal.summons.content} onChange={(event) => setProposal({ ...proposal, summons: { ...proposal.summons!, content: event.target.value } })} required /></label>
                    <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={proposal.summons.notify_members} disabled={proposal.summons.destination === 'district'} onChange={(event) => setProposal({ ...proposal, summons: { ...proposal.summons!, notify_members: event.target.checked } })} /> Send website notification email</label>
                    <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={proposal.summons.include_in_lodge_guide} onChange={(event) => setProposal({ ...proposal, summons: { ...proposal.summons!, include_in_lodge_guide: event.target.checked } })} /> Include in Lodge Guide</label>
                    {proposal.source_file && <p className="text-sm text-slate-600 sm:col-span-2">Retained source: <strong>{proposal.source_file.file_name}</strong></p>}
                  </div>
                ) : <p className="mt-3 text-sm text-slate-500">No summons will be published from this email.</p>}
              </section>

              <section>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h4 className="text-lg font-semibold text-slate-900">Calendar events ({proposal.events.length})</h4>
                  <button type="button" onClick={() => setProposal({ ...proposal, events: [...proposal.events, emptyEvent()] })} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"><Plus size={16} /> Add event</button>
                </div>
                <div className="mt-3 space-y-4">
                  {proposal.events.map((event, index) => (
                    <div key={index} className="grid gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-2">
                      <div className="flex items-center justify-between sm:col-span-2"><h5 className="font-semibold text-slate-900">Event {index + 1}</h5><button type="button" onClick={() => setProposal({ ...proposal, events: proposal.events.filter((_, itemIndex) => itemIndex !== index) })} className="inline-flex min-h-10 items-center gap-1 rounded-md px-3 text-sm font-semibold text-red-700"><Trash2 size={15} /> Remove</button></div>
                      <label className="text-sm font-medium text-slate-700 sm:col-span-2">Title<input className={`${inputClass} mt-1`} value={event.title} onChange={(e) => updateEvent(index, 'title', e.target.value)} required /></label>
                      <label className="text-sm font-medium text-slate-700">Calendar<select className={`${inputClass} mt-1`} value={event.destination} onChange={(e) => { const destination = e.target.value as MailroomEventDraft['destination']; const next = { ...event, destination, notify_members: destination === 'carleton', district_name: destination === 'district' ? event.district_name : null, district_lodge_id: destination === 'district' ? event.district_lodge_id : null }; setProposal({ ...proposal, events: proposal.events.map((item, itemIndex) => itemIndex === index ? next : item) }); }}><option value="carleton">Carleton calendar</option><option value="district">Visiting/District calendar</option></select></label>
                      {event.destination === 'district' && <label className="text-sm font-medium text-slate-700">District<select className={`${inputClass} mt-1`} value={event.district_name ?? ''} onChange={(e) => updateEvent(index, 'district_name', (e.target.value || null) as MailroomEventDraft['district_name'])} required><option value="">Choose District 1 or 2</option><option value="Ottawa District 1">Ottawa District 1</option><option value="Ottawa District 2">Ottawa District 2</option></select></label>}
                      {event.destination === 'district' && <label className="text-sm font-medium text-slate-700 sm:col-span-2">Lodge (optional for a District-issued event)<select className={`${inputClass} mt-1`} value={event.district_lodge_id ?? ''} onChange={(e) => updateEvent(index, 'district_lodge_id', e.target.value || null)}><option value="">District-wide event</option>{districtLodges.filter((lodge) => lodge.district_name === event.district_name).map((lodge) => <option key={lodge.id} value={lodge.id}>{lodge.name}{lodge.lodge_number ? ` No. ${lodge.lodge_number}` : ''}</option>)}</select></label>}
                      <label className="text-sm font-medium text-slate-700">Date<input type="date" className={`${inputClass} mt-1`} value={event.event_date ?? ''} onChange={(e) => updateEvent(index, 'event_date', e.target.value || null)} required /></label>
                      <label className="text-sm font-medium text-slate-700">Audience<select className={`${inputClass} mt-1`} value={event.visibility} onChange={(e) => updateEvent(index, 'visibility', e.target.value as MailroomEventDraft['visibility'])}><option value="members">Members</option><option value="public">Public</option><option value="admin">Administrators</option></select></label>
                      <label className="text-sm font-medium text-slate-700">Start time<input type="time" className={`${inputClass} mt-1`} value={event.event_time ?? ''} onChange={(e) => updateEvent(index, 'event_time', e.target.value || null)} /></label>
                      <label className="text-sm font-medium text-slate-700">End time<input type="time" className={`${inputClass} mt-1`} value={event.event_end_time ?? ''} onChange={(e) => updateEvent(index, 'event_end_time', e.target.value || null)} /></label>
                      {event.destination === 'district' && (
                        <>
                          <label className="text-sm font-medium text-slate-700">Event type<select className={`${inputClass} mt-1`} value={event.event_kind} onChange={(e) => updateEvent(index, 'event_kind', e.target.value as MailroomEventDraft['event_kind'])}><option value="meeting">Regular meeting</option><option value="emergent">Emergent meeting</option><option value="installation">Installation</option><option value="social">Social event</option><option value="official_visit">Official visit</option><option value="other">Other</option></select></label>
                          <label className="text-sm font-medium text-slate-700">Degree<select className={`${inputClass} mt-1`} value={event.degree} onChange={(e) => updateEvent(index, 'degree', e.target.value as MailroomEventDraft['degree'])}><option value="unspecified">Not stated</option><option value="none">No degree</option><option value="first">First degree</option><option value="second">Second degree</option><option value="third">Third degree</option><option value="installation">Installation</option><option value="other">Other work</option></select></label>
                        </>
                      )}
                      <label className="text-sm font-medium text-slate-700">Location<input className={`${inputClass} mt-1`} value={event.location} onChange={(e) => updateEvent(index, 'location', e.target.value)} required /></label>
                      <label className="text-sm font-medium text-slate-700">Address<input className={`${inputClass} mt-1`} value={event.location_address} onChange={(e) => updateEvent(index, 'location_address', e.target.value)} /></label>
                      <label className="text-sm font-medium text-slate-700 sm:col-span-2">Description<textarea className={`${inputClass} mt-1 min-h-28`} value={event.description} onChange={(e) => updateEvent(index, 'description', e.target.value)} /></label>
                      <label className="text-sm font-medium text-slate-700">Point of contact<input className={`${inputClass} mt-1`} value={event.poc_name} onChange={(e) => updateEvent(index, 'poc_name', e.target.value)} /></label>
                      <label className="text-sm font-medium text-slate-700">Contact details<input className={`${inputClass} mt-1`} value={event.poc_contact} onChange={(e) => updateEvent(index, 'poc_contact', e.target.value)} /></label>
                      <label className="text-sm font-medium text-slate-700 sm:col-span-2">Issuing organization<input className={`${inputClass} mt-1`} value={event.source_issuer} onChange={(e) => updateEvent(index, 'source_issuer', e.target.value)} /></label>
                      <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-slate-700 sm:col-span-2"><input type="checkbox" checked={event.is_memorial_service} onChange={(e) => { const isMemorial = e.target.checked; setProposal({ ...proposal, events: proposal.events.map((item, itemIndex) => itemIndex === index ? { ...item, is_memorial_service: isMemorial, visibility: isMemorial ? 'members' : item.visibility, include_in_lodge_guide: isMemorial ? false : item.include_in_lodge_guide } : item) }); }} /> Memorial or funeral service event</label>
                      <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={event.notify_members} disabled={event.destination === 'district'} onChange={(e) => updateEvent(index, 'notify_members', e.target.checked)} /> Send website notification email</label>
                      <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={event.include_in_lodge_guide} disabled={event.is_memorial_service} onChange={(e) => updateEvent(index, 'include_in_lodge_guide', e.target.checked)} /> Include in Lodge Guide</label>
                    </div>
                  ))}
                  {proposal.events.length === 0 && <p className="text-sm text-slate-500">No calendar events will be published.</p>}
                </div>
              </section>

              <section>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h4 className="text-lg font-semibold text-slate-900">Announcements ({proposal.announcements.length})</h4>
                  <button type="button" onClick={() => setProposal({ ...proposal, announcements: [...proposal.announcements, emptyAnnouncement()] })} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"><Plus size={16} /> Add announcement</button>
                </div>
                <div className="mt-3 space-y-4">
                  {proposal.announcements.map((announcement, index) => (
                    <div key={index} className="grid gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-2">
                      <div className="flex items-center justify-between sm:col-span-2"><h5 className="font-semibold text-slate-900">Announcement {index + 1}</h5><button type="button" onClick={() => setProposal({ ...proposal, announcements: proposal.announcements.filter((_, itemIndex) => itemIndex !== index) })} className="inline-flex min-h-10 items-center gap-1 rounded-md px-3 text-sm font-semibold text-red-700"><Trash2 size={15} /> Remove</button></div>
                      <label className="text-sm font-medium text-slate-700 sm:col-span-2">Title<input className={`${inputClass} mt-1`} value={announcement.title} onChange={(e) => updateAnnouncement(index, 'title', e.target.value)} required /></label>
                      <label className="text-sm font-medium text-slate-700">Notice type<select className={`${inputClass} mt-1`} value={announcement.notice_type} onChange={(e) => { const noticeType = e.target.value as MailroomAnnouncementDraft['notice_type']; setProposal({ ...proposal, announcements: proposal.announcements.map((item, itemIndex) => itemIndex === index ? { ...item, notice_type: noticeType, visibility: noticeType === 'memorial' ? 'members' : item.visibility, notify_members: noticeType === 'memorial' ? false : item.notify_members, include_in_lodge_guide: noticeType === 'memorial' ? false : item.include_in_lodge_guide } : item) }); }}><option value="general">General lodge notice</option><option value="memorial">Memorial notice</option></select></label>
                      <label className="text-sm font-medium text-slate-700">Priority<select className={`${inputClass} mt-1`} value={announcement.priority} onChange={(e) => updateAnnouncement(index, 'priority', e.target.value as MailroomAnnouncementDraft['priority'])}><option value="normal">Normal</option><option value="important">Important</option><option value="urgent">Urgent</option></select></label>
                      <label className="text-sm font-medium text-slate-700">Audience<select className={`${inputClass} mt-1`} value={announcement.visibility} disabled={announcement.notice_type === 'memorial'} onChange={(e) => updateAnnouncement(index, 'visibility', e.target.value as MailroomAnnouncementDraft['visibility'])}><option value="members">Members</option><option value="public">Public</option></select></label>
                      <label className="text-sm font-medium text-slate-700">Expires<input type="date" className={`${inputClass} mt-1`} value={announcement.expires_at?.slice(0, 10) ?? ''} onChange={(e) => updateAnnouncement(index, 'expires_at', e.target.value ? `${e.target.value}T23:59:59-04:00` : null)} /></label>
                      <label className="text-sm font-medium text-slate-700 sm:col-span-2">Message<textarea className={`${inputClass} mt-1 min-h-28`} value={announcement.body} onChange={(e) => updateAnnouncement(index, 'body', e.target.value)} required /></label>
                      <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={announcement.notify_members} onChange={(e) => updateAnnouncement(index, 'notify_members', e.target.checked)} /> Send website notification email</label>
                      <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={announcement.include_in_lodge_guide} disabled={announcement.notice_type === 'memorial'} onChange={(e) => updateAnnouncement(index, 'include_in_lodge_guide', e.target.checked)} /> Include in Lodge Guide</label>
                    </div>
                  ))}
                  {proposal.announcements.length === 0 && <p className="text-sm text-slate-500">No announcements will be published.</p>}
                </div>
              </section>

              <section>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h4 className="text-lg font-semibold text-slate-900">Library items ({proposal.library_items.length})</h4>
                  <button type="button" onClick={() => setProposal({ ...proposal, library_items: [...proposal.library_items, emptyLibraryItem()] })} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"><Plus size={16} /> Add Library item</button>
                </div>
                <div className="mt-3 space-y-4">
                  {proposal.library_items.map((item, index) => (
                    <div key={index} className="grid gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-2">
                      <div className="flex items-center justify-between sm:col-span-2"><h5 className="font-semibold text-slate-900">Library item {index + 1}</h5><button type="button" onClick={() => setProposal({ ...proposal, library_items: proposal.library_items.filter((_, itemIndex) => itemIndex !== index) })} className="inline-flex min-h-10 items-center gap-1 rounded-md px-3 text-sm font-semibold text-red-700"><Trash2 size={15} /> Remove</button></div>
                      <label className="text-sm font-medium text-slate-700 sm:col-span-2">Title<input className={`${inputClass} mt-1`} value={item.title} onChange={(e) => updateLibraryItem(index, 'title', e.target.value)} required /></label>
                      <label className="text-sm font-medium text-slate-700">Source<input className={`${inputClass} mt-1`} value={item.source} onChange={(e) => updateLibraryItem(index, 'source', e.target.value)} /></label>
                      <label className="text-sm font-medium text-slate-700">Source URL<input type="url" className={`${inputClass} mt-1`} value={item.source_url} onChange={(e) => updateLibraryItem(index, 'source_url', e.target.value)} /></label>
                      <label className="text-sm font-medium text-slate-700 sm:col-span-2">Retained source file<select className={`${inputClass} mt-1`} value={item.source_storage_path} onChange={(e) => { const file = proposal.source_files.find((candidate) => candidate.storage_path === e.target.value); setProposal({ ...proposal, library_items: proposal.library_items.map((candidate, itemIndex) => itemIndex === index ? { ...candidate, source_storage_path: e.target.value, file_name: file?.file_name ?? candidate.file_name } : candidate) }); }} required><option value="">Select a retained source</option>{proposal.source_files.map((file) => <option key={file.storage_path} value={file.storage_path}>{file.file_name}</option>)}</select></label>
                      <label className="text-sm font-medium text-slate-700 sm:col-span-2">Summary<textarea className={`${inputClass} mt-1 min-h-28`} value={item.summary} onChange={(e) => updateLibraryItem(index, 'summary', e.target.value)} /></label>
                      <label className="text-sm font-medium text-slate-700 sm:col-span-2">Tags (comma separated)<input className={`${inputClass} mt-1`} value={item.tags.join(', ')} onChange={(e) => updateLibraryItem(index, 'tags', e.target.value.split(',').map((tag) => tag.trim()).filter(Boolean))} /></label>
                      <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={item.rights_reviewed} onChange={(e) => setProposal({ ...proposal, library_items: proposal.library_items.map((candidate, itemIndex) => itemIndex === index ? { ...candidate, rights_reviewed: e.target.checked, include_in_lodge_guide: e.target.checked ? candidate.include_in_lodge_guide : false } : candidate) })} /> Sharing rights reviewed</label>
                      <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={item.include_in_lodge_guide} disabled={!item.rights_reviewed} onChange={(e) => updateLibraryItem(index, 'include_in_lodge_guide', e.target.checked)} /> Include in Lodge Guide</label>
                    </div>
                  ))}
                  {proposal.library_items.length === 0 && <p className="text-sm text-slate-500">No Library material will be published.</p>}
                </div>
              </section>

              <div className="sticky bottom-0 -mx-5 flex flex-wrap justify-end gap-3 border-t border-slate-200 bg-white p-5 sm:-mx-7 sm:px-7">
                <button type="button" onClick={rejectDraft} disabled={busyId === reviewing.id} className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-red-300 px-5 py-2 font-semibold text-red-700 disabled:opacity-50"><XCircle size={18} /> Reject draft</button>
                <button type="button" onClick={approveDraft} disabled={busyId === reviewing.id || reviewing.processing_mode === 'shadow'} className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2 font-semibold text-white disabled:opacity-50">{busyId === reviewing.id ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />} {reviewing.processing_mode === 'shadow' ? 'Publishing locked in shadow mode' : 'Publish reviewed actions'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
