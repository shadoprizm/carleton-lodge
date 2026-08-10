import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, BellRing, CheckCircle2, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { Announcement, supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { RichTextEditor } from '../RichTextEditor';
import { prepareRichTextForStorage, richTextToPlainText } from '../../utils/richText';

const emptyForm = {
  title: '',
  body: '',
  priority: 'normal' as Announcement['priority'],
  visibility: 'members' as Announcement['visibility'],
  expiresAt: '',
  publishNow: true,
};

export const AnnouncementsManager = () => {
  const { user, hasAdminPermission } = useAuth();
  const canWrite = hasAdminPermission('communications', 'write');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadAnnouncements = useCallback(async () => {
    setLoading(true);
    const { data, error: loadError } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });
    if (loadError) setError(loadError.message);
    setAnnouncements((data as Announcement[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAnnouncements();
  }, [loadAnnouncements]);

  const createAnnouncement = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !canWrite) return;
    const body = prepareRichTextForStorage(form.body);
    if (!body) {
      setError('Enter the announcement message.');
      return;
    }

    setSaving(true);
    setError('');
    const now = new Date().toISOString();
    const { error: createError } = await supabase.from('announcements').insert({
      title: form.title.trim(),
      body,
      priority: form.priority,
      visibility: form.visibility,
      is_published: form.publishNow,
      published_at: form.publishNow ? now : null,
      expires_at: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      created_by: user.id,
    });
    setSaving(false);

    if (createError) {
      setError(createError.message);
      return;
    }

    setForm(emptyForm);
    setShowForm(false);
    await loadAnnouncements();
  };

  const setPublished = async (announcement: Announcement, published: boolean) => {
    if (!canWrite) return;
    setError('');
    const { error: updateError } = await supabase
      .from('announcements')
      .update({
        is_published: published,
        published_at: published ? new Date().toISOString() : null,
      })
      .eq('id', announcement.id);
    if (updateError) setError(updateError.message);
    await loadAnnouncements();
  };

  const removeAnnouncement = async (announcement: Announcement) => {
    if (!canWrite || !window.confirm(`Delete “${announcement.title}”? This cannot be undone.`)) return;
    const { error: deleteError } = await supabase.from('announcements').delete().eq('id', announcement.id);
    if (deleteError) setError(deleteError.message);
    await loadAnnouncements();
  };

  const inputClass = 'min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900';

  return (
    <section aria-labelledby="announcements-admin-heading" className="mb-8 border-b border-slate-200 pb-8">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 id="announcements-admin-heading" className="text-lg font-semibold text-slate-900">Lodge Announcements</h3>
          <p className="mt-1 text-sm text-slate-500">Publish once on the website; opted-in members receive an email linking them back to the source.</p>
        </div>
        {canWrite && (
          <button type="button" onClick={() => setShowForm((value) => !value)} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-amber-300">
            <Plus size={16} /> New Announcement
          </button>
        )}
      </div>

      {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}

      {showForm && (
        <form onSubmit={createAnnouncement} className="mb-5 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-5">
          <div>
            <label htmlFor="announcement-title" className="mb-1 block text-sm font-medium text-slate-700">Title</label>
            <input id="announcement-title" required maxLength={200} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Message</label>
            <RichTextEditor value={form.body} onChange={(body) => setForm({ ...form, body })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="announcement-priority" className="mb-1 block text-sm font-medium text-slate-700">Priority</label>
              <select id="announcement-priority" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as Announcement['priority'] })} className={inputClass}>
                <option value="normal">Normal</option>
                <option value="important">Important</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label htmlFor="announcement-audience" className="mb-1 block text-sm font-medium text-slate-700">Audience</label>
              <select id="announcement-audience" value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value as Announcement['visibility'] })} className={inputClass}>
                <option value="members">Lodge members</option>
                <option value="public">Public website</option>
              </select>
            </div>
            <div>
              <label htmlFor="announcement-expiry" className="mb-1 block text-sm font-medium text-slate-700">Remove after (optional)</label>
              <input id="announcement-expiry" type="datetime-local" value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} className={inputClass} />
            </div>
          </div>
          <label className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
            <input type="checkbox" checked={form.publishNow} onChange={(event) => setForm({ ...form, publishNow: event.target.checked })} className="h-5 w-5 rounded border-slate-300 text-slate-900 focus:ring-slate-900" />
            <span><span className="block text-sm font-semibold text-slate-900">Publish now</span><span className="block text-xs text-slate-500">If unchecked, this is saved as a draft and no email is queued.</span></span>
          </label>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700">Cancel</button>
            <button type="submit" disabled={saving} className="min-h-11 rounded-lg bg-slate-900 px-5 text-sm font-semibold text-amber-300 disabled:opacity-60">{saving ? 'Saving…' : form.publishNow ? 'Publish Announcement' : 'Save Draft'}</button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="py-6 text-center text-sm text-slate-500" role="status">Loading announcements…</p>
      ) : announcements.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">No announcements have been created.</p>
      ) : (
        <div className="space-y-2">
          {announcements.map((announcement) => (
            <article key={announcement.id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {announcement.priority === 'urgent' ? <AlertTriangle size={17} className="text-red-600" /> : announcement.priority === 'important' ? <BellRing size={17} className="text-amber-700" /> : <CheckCircle2 size={17} className="text-slate-400" />}
                    <h4 className="font-semibold text-slate-900">{announcement.title}</h4>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${announcement.is_published ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{announcement.is_published ? 'Published' : 'Draft'}</span>
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-800">{announcement.visibility}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-600">{richTextToPlainText(announcement.body)}</p>
                  {announcement.expires_at && <p className="mt-2 text-xs text-slate-500">Expires {new Date(announcement.expires_at).toLocaleString('en-CA')}</p>}
                </div>
                {canWrite && (
                  <div className="flex shrink-0 items-center gap-2">
                    <button type="button" onClick={() => setPublished(announcement, !announcement.is_published)} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700" aria-label={`${announcement.is_published ? 'Unpublish' : 'Publish'} ${announcement.title}`}>
                      {announcement.is_published ? <EyeOff size={15} /> : <Eye size={15} />}{announcement.is_published ? 'Unpublish' : 'Publish'}
                    </button>
                    <button type="button" onClick={() => removeAnnouncement(announcement)} className="flex min-h-10 min-w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-700" aria-label={`Delete ${announcement.title}`}><Trash2 size={16} /></button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};
