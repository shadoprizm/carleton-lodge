import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileSearch,
  Inbox,
  Loader2,
  MailCheck,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  InboundEmail,
  MailroomAnnouncementDraft,
  MailroomDistrictLodgeDraft,
  MailroomEventDraft,
  MailroomImport,
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
  visibility: 'members',
});

const emptyAnnouncement = (): MailroomAnnouncementDraft => ({
  title: '',
  body: '',
  priority: 'normal',
  visibility: 'members',
});

const emptySummons = (): MailroomSummonsDraft => ({
  title: '',
  month: '',
  issue_date: null,
  content: '',
});

const emptyDistrictLodge = (): MailroomDistrictLodgeDraft => ({
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

const copyProposal = (proposal: MailroomProposal): MailroomProposal => ({
  ...proposal,
  publication_target: proposal.publication_target === 'district' ? 'district' : 'carleton',
  summons: proposal.summons
    ? { ...proposal.summons, issue_date: proposal.summons.issue_date ?? null }
    : null,
  district_lodge: proposal.district_lodge ? { ...proposal.district_lodge } : null,
  events: (proposal.events ?? []).map((event) => ({
    ...event,
    event_kind: event.event_kind ?? 'meeting',
    degree: event.degree ?? 'unspecified',
  })),
  announcements: (proposal.announcements ?? []).map((announcement) => ({ ...announcement })),
  warnings: [...(proposal.warnings ?? [])],
});

const statusStyle: Record<MailroomImport['status'], string> = {
  drafting: 'bg-blue-100 text-blue-800',
  needs_review: 'bg-amber-100 text-amber-900',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-slate-200 text-slate-700',
  failed: 'bg-red-100 text-red-800',
};

export const LodgeMailroom = () => {
  const { user, hasAdminPermission } = useAuth();
  const canWrite = hasAdminPermission('communications', 'write');
  const [messages, setMessages] = useState<InboundEmail[]>([]);
  const [imports, setImports] = useState<MailroomImport[]>([]);
  const [senders, setSenders] = useState<TrustedEmailSender[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [senderEmail, setSenderEmail] = useState('');
  const [senderLabel, setSenderLabel] = useState('Lodge Secretary');
  const [reviewing, setReviewing] = useState<MailroomImport | null>(null);
  const [proposal, setProposal] = useState<MailroomProposal | null>(null);

  const loadMailroom = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [messagesResult, importsResult, sendersResult] = await Promise.all([
      supabase.from('inbound_emails').select('*').order('received_at', { ascending: false }).limit(25),
      supabase.from('mailroom_imports').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('trusted_email_senders').select('*').order('label'),
    ]);
    const firstError = messagesResult.error ?? importsResult.error ?? sendersResult.error;
    if (firstError) setError(firstError.message);
    setMessages((messagesResult.data as InboundEmail[] | null) ?? []);
    setImports((importsResult.data as MailroomImport[] | null) ?? []);
    setSenders((sendersResult.data as TrustedEmailSender[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadMailroom();
  }, [loadMailroom]);

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
    setError(null);
    const { error: updateError } = await supabase
      .from('trusted_email_senders')
      .update({ is_active: !sender.is_active })
      .eq('id', sender.id);
    if (updateError) setError(updateError.message);
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

  const approveDraft = async () => {
    if (!reviewing || !proposal || !canWrite) return;
    const itemCount = (proposal.summons ? 1 : 0)
      + proposal.events.length
      + (proposal.publication_target === 'carleton' ? proposal.announcements.length : 0);
    if (itemCount === 0) {
      setError('Keep at least one summons, event, or announcement before publishing.');
      return;
    }
    if (proposal.publication_target === 'district' && !proposal.district_lodge?.name.trim()) {
      setError('Enter the visiting lodge name before publishing to Ottawa District 1.');
      return;
    }
    if (proposal.publication_target === 'district' && !proposal.summons) {
      setError('Keep or add the original summons before publishing to Ottawa District 1.');
      return;
    }
    const destination = proposal.publication_target === 'district'
      ? 'the member-only Ottawa District 1 section'
      : 'the Carleton Lodge website';
    if (!window.confirm(`Publish ${itemCount} reviewed item${itemCount === 1 ? '' : 's'} to ${destination}?`)) return;
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
    setNotice(proposal.publication_target === 'district'
      ? 'The visiting-lodge summons and events were published to Ottawa District 1.'
      : 'The reviewed items were published and member notifications were queued.');
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
                Convert authenticated emails and attached summons PDFs into reviewed website updates. Nothing is published automatically.
              </p>
            </div>
          </div>
          <button type="button" onClick={loadMailroom} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900"><ShieldCheck className="mb-1" size={18} /><strong>Verified sender</strong><br />Only allowlisted addresses can be processed.</div>
          <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950"><FileSearch className="mb-1" size={18} /><strong>Draft extraction</strong><br />Email and PDF details are proposed for review.</div>
          <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-950"><MailCheck className="mb-1" size={18} /><strong>One approval</strong><br />Publish records and queue opted-in member email.</div>
        </div>
        {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800" role="alert">{error}</p>}
        {notice && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-900" role="status">{notice}</p>}
      </div>

      <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.7fr)]">
        <div>
          <h4 className="font-semibold text-slate-900">Trusted senders</h4>
          <p className="mt-1 text-sm text-slate-600">Use the Secretary’s exact sending address. A display name is not enough.</p>
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
            {senders.map((sender) => (
              <div key={sender.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{sender.label}</p>
                  <p className="truncate text-xs text-slate-500">{sender.email}</p>
                </div>
                {canWrite && (
                  <button type="button" onClick={() => toggleSender(sender)} className={`min-h-9 rounded-md px-3 text-xs font-semibold ${sender.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                    {sender.is_active ? 'Active' : 'Inactive'}
                  </button>
                )}
              </div>
            ))}
            {!loading && senders.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">No sender is trusted yet. Existing messages cannot be processed until one is added.</p>}
          </div>
        </div>

        <div>
          <h4 className="font-semibold text-slate-900">Recent inbox</h4>
          <p className="mt-1 text-sm text-slate-600">Older captured messages remain untouched. Prepare only the message you intend to publish.</p>
          <div className="mt-4 space-y-3">
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
                    {canWrite && trusted && (!item || item.status === 'failed') && (
                      <button type="button" onClick={() => prepareDraft(message)} disabled={busyId === message.id} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-amber-300 disabled:opacity-50">
                        {busyId === message.id ? <Loader2 size={16} className="animate-spin" /> : <FileSearch size={16} />} Prepare draft
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

              <section className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 sm:p-5">
                <label className="block text-sm font-semibold text-amber-950">
                  Publish this email to
                  <select
                    className={`${inputClass} mt-2 bg-white`}
                    value={proposal.publication_target}
                    onChange={(event) => {
                      const publicationTarget = event.target.value as MailroomProposal['publication_target'];
                      setProposal({
                        ...proposal,
                        publication_target: publicationTarget,
                        district_lodge: publicationTarget === 'district'
                          ? proposal.district_lodge ?? emptyDistrictLodge()
                          : null,
                        announcements: publicationTarget === 'district'
                          ? []
                          : proposal.announcements,
                      });
                    }}
                  >
                    <option value="carleton">Carleton Lodge No. 465</option>
                    <option value="district">Ottawa District 1 — another lodge</option>
                  </select>
                </label>
                <p className="mt-2 text-sm leading-6 text-amber-950">
                  This choice controls where every approved record is stored. District material never appears as a Carleton summons or Carleton calendar event.
                </p>
              </section>

              {proposal.publication_target === 'district' && (
                <section>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h4 className="text-lg font-semibold text-slate-900">Visiting lodge</h4>
                    {!proposal.district_lodge && (
                      <button type="button" onClick={() => setProposal({ ...proposal, district_lodge: emptyDistrictLodge() })} className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
                        Add lodge details
                      </button>
                    )}
                  </div>
                  {proposal.district_lodge ? (
                    <div className="mt-3 grid gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-2">
                      <label className="text-sm font-medium text-slate-700">Lodge name<input className={`${inputClass} mt-1`} value={proposal.district_lodge.name} onChange={(event) => setProposal({ ...proposal, district_lodge: { ...proposal.district_lodge!, name: event.target.value } })} placeholder="Russell Lodge" required /></label>
                      <label className="text-sm font-medium text-slate-700">Lodge number<input className={`${inputClass} mt-1`} value={proposal.district_lodge.lodge_number} onChange={(event) => setProposal({ ...proposal, district_lodge: { ...proposal.district_lodge!, lodge_number: event.target.value } })} /></label>
                      <label className="text-sm font-medium text-slate-700">Town or location<input className={`${inputClass} mt-1`} value={proposal.district_lodge.location} onChange={(event) => setProposal({ ...proposal, district_lodge: { ...proposal.district_lodge!, location: event.target.value } })} /></label>
                      <label className="text-sm font-medium text-slate-700">Details current as of<input type="date" className={`${inputClass} mt-1`} value={proposal.district_lodge.details_as_of ?? ''} onChange={(event) => setProposal({ ...proposal, district_lodge: { ...proposal.district_lodge!, details_as_of: event.target.value || null } })} /></label>
                      <label className="text-sm font-medium text-slate-700">Worshipful Master<input className={`${inputClass} mt-1`} value={proposal.district_lodge.worshipful_master_name} onChange={(event) => setProposal({ ...proposal, district_lodge: { ...proposal.district_lodge!, worshipful_master_name: event.target.value } })} /></label>
                      <label className="text-sm font-medium text-slate-700">Secretary<input className={`${inputClass} mt-1`} value={proposal.district_lodge.secretary_name} onChange={(event) => setProposal({ ...proposal, district_lodge: { ...proposal.district_lodge!, secretary_name: event.target.value } })} /></label>
                      <label className="text-sm font-medium text-slate-700">Contact email<input type="email" className={`${inputClass} mt-1`} value={proposal.district_lodge.contact_email} onChange={(event) => setProposal({ ...proposal, district_lodge: { ...proposal.district_lodge!, contact_email: event.target.value } })} /></label>
                      <label className="text-sm font-medium text-slate-700">Contact phone<input className={`${inputClass} mt-1`} value={proposal.district_lodge.contact_phone} onChange={(event) => setProposal({ ...proposal, district_lodge: { ...proposal.district_lodge!, contact_phone: event.target.value } })} /></label>
                      <label className="text-sm font-medium text-slate-700 sm:col-span-2">Website<input type="url" className={`${inputClass} mt-1`} value={proposal.district_lodge.website_url} onChange={(event) => setProposal({ ...proposal, district_lodge: { ...proposal.district_lodge!, website_url: event.target.value } })} placeholder="https://…" /></label>
                    </div>
                  ) : <p className="mt-3 text-sm text-slate-500">A lodge name is required for District 1 publication.</p>}
                </section>
              )}

              <section>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h4 className="text-lg font-semibold text-slate-900">Summons</h4>
                  <button type="button" onClick={() => setProposal({ ...proposal, summons: proposal.summons ? null : emptySummons() })} className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
                    {proposal.summons ? 'Remove summons' : 'Add summons'}
                  </button>
                </div>
                {proposal.summons ? (
                  <div className="mt-3 grid gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-2">
                    <label className="text-sm font-medium text-slate-700">Title<input className={`${inputClass} mt-1`} value={proposal.summons.title} onChange={(event) => setProposal({ ...proposal, summons: { ...proposal.summons!, title: event.target.value } })} required /></label>
                    <label className="text-sm font-medium text-slate-700">Month<input className={`${inputClass} mt-1`} value={proposal.summons.month} onChange={(event) => setProposal({ ...proposal, summons: { ...proposal.summons!, month: event.target.value } })} placeholder="September 2026" required /></label>
                    <label className="text-sm font-medium text-slate-700">Issue date, if stated<input type="date" className={`${inputClass} mt-1`} value={proposal.summons.issue_date ?? ''} onChange={(event) => setProposal({ ...proposal, summons: { ...proposal.summons!, issue_date: event.target.value || null } })} /></label>
                    <label className="text-sm font-medium text-slate-700 sm:col-span-2">Summons text<textarea className={`${inputClass} mt-1 min-h-48`} value={proposal.summons.content} onChange={(event) => setProposal({ ...proposal, summons: { ...proposal.summons!, content: event.target.value } })} required /></label>
                    {proposal.source_file && <p className="text-sm text-slate-600 sm:col-span-2">Attached PDF: <strong>{proposal.source_file.file_name}</strong></p>}
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
                      <label className="text-sm font-medium text-slate-700">Date<input type="date" className={`${inputClass} mt-1`} value={event.event_date ?? ''} onChange={(e) => updateEvent(index, 'event_date', e.target.value || null)} required /></label>
                      <label className="text-sm font-medium text-slate-700">Audience<select className={`${inputClass} mt-1`} value={event.visibility} onChange={(e) => updateEvent(index, 'visibility', e.target.value as MailroomEventDraft['visibility'])}><option value="members">Members</option><option value="public">Public</option><option value="admin">Administrators</option></select></label>
                      <label className="text-sm font-medium text-slate-700">Start time<input type="time" className={`${inputClass} mt-1`} value={event.event_time ?? ''} onChange={(e) => updateEvent(index, 'event_time', e.target.value || null)} /></label>
                      <label className="text-sm font-medium text-slate-700">End time<input type="time" className={`${inputClass} mt-1`} value={event.event_end_time ?? ''} onChange={(e) => updateEvent(index, 'event_end_time', e.target.value || null)} /></label>
                      {proposal.publication_target === 'district' && (
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
                    </div>
                  ))}
                  {proposal.events.length === 0 && <p className="text-sm text-slate-500">No calendar events will be published.</p>}
                </div>
              </section>

              {proposal.publication_target === 'carleton' && <section>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h4 className="text-lg font-semibold text-slate-900">Announcements ({proposal.announcements.length})</h4>
                  <button type="button" onClick={() => setProposal({ ...proposal, announcements: [...proposal.announcements, emptyAnnouncement()] })} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"><Plus size={16} /> Add announcement</button>
                </div>
                <div className="mt-3 space-y-4">
                  {proposal.announcements.map((announcement, index) => (
                    <div key={index} className="grid gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-2">
                      <div className="flex items-center justify-between sm:col-span-2"><h5 className="font-semibold text-slate-900">Announcement {index + 1}</h5><button type="button" onClick={() => setProposal({ ...proposal, announcements: proposal.announcements.filter((_, itemIndex) => itemIndex !== index) })} className="inline-flex min-h-10 items-center gap-1 rounded-md px-3 text-sm font-semibold text-red-700"><Trash2 size={15} /> Remove</button></div>
                      <label className="text-sm font-medium text-slate-700 sm:col-span-2">Title<input className={`${inputClass} mt-1`} value={announcement.title} onChange={(e) => updateAnnouncement(index, 'title', e.target.value)} required /></label>
                      <label className="text-sm font-medium text-slate-700">Priority<select className={`${inputClass} mt-1`} value={announcement.priority} onChange={(e) => updateAnnouncement(index, 'priority', e.target.value as MailroomAnnouncementDraft['priority'])}><option value="normal">Normal</option><option value="important">Important</option><option value="urgent">Urgent</option></select></label>
                      <label className="text-sm font-medium text-slate-700">Audience<select className={`${inputClass} mt-1`} value={announcement.visibility} onChange={(e) => updateAnnouncement(index, 'visibility', e.target.value as MailroomAnnouncementDraft['visibility'])}><option value="members">Members</option><option value="public">Public</option></select></label>
                      <label className="text-sm font-medium text-slate-700 sm:col-span-2">Message<textarea className={`${inputClass} mt-1 min-h-28`} value={announcement.body} onChange={(e) => updateAnnouncement(index, 'body', e.target.value)} required /></label>
                    </div>
                  ))}
                  {proposal.announcements.length === 0 && <p className="text-sm text-slate-500">No announcements will be published.</p>}
                </div>
              </section>}

              <div className="sticky bottom-0 -mx-5 flex flex-wrap justify-end gap-3 border-t border-slate-200 bg-white p-5 sm:-mx-7 sm:px-7">
                <button type="button" onClick={rejectDraft} disabled={busyId === reviewing.id} className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-red-300 px-5 py-2 font-semibold text-red-700 disabled:opacity-50"><XCircle size={18} /> Reject draft</button>
                <button type="button" onClick={approveDraft} disabled={busyId === reviewing.id} className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2 font-semibold text-white disabled:opacity-50">{busyId === reviewing.id ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />} Publish reviewed items</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
