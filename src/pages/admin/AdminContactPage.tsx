import { useEffect, useState } from 'react';
import { Mail, Trash2, MailOpen, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export const AdminContactPage = () => {
  const [submissions, setSubmissions] = useState<ContactSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');

  const fetchSubmissions = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('contact_submissions')
      .select('*')
      .order('created_at', { ascending: false });
    setSubmissions(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const markRead = async (id: string, value: boolean) => {
    await supabase.from('contact_submissions').update({ is_read: value }).eq('id', id);
    setSubmissions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, is_read: value } : s))
    );
  };

  const deleteSubmission = async (id: string) => {
    await supabase.from('contact_submissions').delete().eq('id', id);
    setSubmissions((prev) => prev.filter((s) => s.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const handleExpand = (id: string) => {
    const next = expandedId === id ? null : id;
    setExpandedId(next);
    if (next) {
      const sub = submissions.find((s) => s.id === id);
      if (sub && !sub.is_read) markRead(id, true);
    }
  };

  const filtered = submissions.filter((s) => {
    if (filter === 'unread') return !s.is_read;
    if (filter === 'read') return s.is_read;
    return true;
  });

  const unreadCount = submissions.filter((s) => !s.is_read).length;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-serif text-slate-900">Contact Submissions</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {unreadCount > 0 ? (
              <span className="text-amber-600 font-medium">{unreadCount} unread</span>
            ) : (
              'All messages read'
            )}
            {' '}— {submissions.length} total
          </p>
        </div>
        <button
          onClick={fetchSubmissions}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      <div className="flex gap-2 mb-5">
        {(['all', 'unread', 'read'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
              filter === f
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-slate-400 text-sm py-8 text-center">Loading submissions...</div>
      ) : filtered.length === 0 ? (
        <div className="text-slate-400 text-sm py-12 text-center">
          <Mail size={32} className="mx-auto mb-3 opacity-30" />
          No {filter !== 'all' ? filter + ' ' : ''}submissions yet.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((sub) => (
            <div
              key={sub.id}
              className={`border rounded-xl overflow-hidden transition-all duration-200 ${
                sub.is_read ? 'border-slate-200' : 'border-amber-200 bg-amber-50/30'
              }`}
            >
              <button
                onClick={() => handleExpand(sub.id)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50/60 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      sub.is_read ? 'bg-slate-300' : 'bg-amber-400'
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-900 text-sm">{sub.name}</span>
                      <span className="text-slate-400 text-xs">{sub.email}</span>
                    </div>
                    <p className="text-slate-600 text-sm truncate">{sub.subject}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                  <span className="text-slate-400 text-xs hidden sm:block">
                    {formatDate(sub.created_at)}
                  </span>
                  {expandedId === sub.id ? (
                    <ChevronUp size={16} className="text-slate-400" />
                  ) : (
                    <ChevronDown size={16} className="text-slate-400" />
                  )}
                </div>
              </button>

              {expandedId === sub.id && (
                <div className="px-5 pb-5 border-t border-slate-100">
                  <p className="text-sm text-slate-400 mb-3 pt-4">
                    {formatDate(sub.created_at)}
                  </p>
                  <p className="text-slate-700 text-sm whitespace-pre-wrap leading-relaxed">
                    {sub.message}
                  </p>
                  <div className="flex items-center gap-3 mt-5 pt-4 border-t border-slate-100">
                    <a
                      href={`mailto:${sub.email}?subject=Re: ${encodeURIComponent(sub.subject)}`}
                      className="flex items-center gap-1.5 text-sm text-blue-700 hover:text-blue-900 font-medium transition-colors"
                    >
                      <Mail size={14} />
                      Reply by Email
                    </a>
                    <div className="flex-1" />
                    <button
                      onClick={() => markRead(sub.id, !sub.is_read)}
                      className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
                    >
                      <MailOpen size={14} />
                      {sub.is_read ? 'Mark Unread' : 'Mark Read'}
                    </button>
                    <button
                      onClick={() => deleteSubmission(sub.id)}
                      className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 transition-colors"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
