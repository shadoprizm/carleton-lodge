import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, ChevronDown, RefreshCw, Send } from 'lucide-react';
import { NotificationOutboxItem, supabase } from '../../lib/supabase';
import { AnnouncementsManager } from '../../components/admin/AnnouncementsManager';
import { LodgeMailroom } from '../../components/admin/LodgeMailroom';
import { useAuth } from '../../contexts/AuthContext';

const statusClass: Record<NotificationOutboxItem['status'], string> = {
  queued: 'bg-amber-100 text-amber-800',
  processing: 'bg-blue-100 text-blue-800',
  sent: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-slate-100 text-slate-700',
};

export const AdminCommunicationsPage = () => {
  const { hasAdminPermission } = useAuth();
  const canWrite = hasAdminPermission('communications', 'write');
  const [outbound, setOutbound] = useState<NotificationOutboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processResult, setProcessResult] = useState('');
  const [outboundExpanded, setOutboundExpanded] = useState(false);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    setError(null);

    const outboundResult = await supabase
      .from('notification_outbox')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (outboundResult.error) {
      setError(outboundResult.error.message ?? 'Could not load communications.');
    }

    setOutbound((outboundResult.data as NotificationOutboxItem[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchMessages();
  }, [fetchMessages]);

  const processQueue = async () => {
    if (!canWrite) return;
    setProcessing(true);
    setError(null);
    setProcessResult('');
    const { data, error: processError } = await supabase.functions.invoke('cl-process-notifications', {
      body: { batchSize: 100 },
    });
    setProcessing(false);
    if (processError) {
      setError('Queued messages could not be sent. Check the email service configuration and try again.');
      return;
    }
    const result = data as { claimed?: number; sent?: number; failed?: number } | null;
    setProcessResult(`${result?.sent ?? 0} sent, ${result?.failed ?? 0} failed, ${result?.claimed ?? 0} processed.`);
    await fetchMessages();
  };

  const queuedCount = outbound.filter((item) => item.status === 'queued').length;
  const failedCount = outbound.filter((item) => item.status === 'failed').length;
  const sentCount = outbound.filter((item) => item.status === 'sent').length;

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-serif text-slate-900">Communications</h2>
          <p className="text-sm text-slate-500 mt-1">
            Delivery audit and inbound email captured by the configured provider
          </p>
          {error && <p className="text-sm text-red-700 mt-2">{error}</p>}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {canWrite && (
            <button type="button" onClick={processQueue} disabled={processing || queuedCount === 0} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-amber-300 disabled:opacity-50">
              <Send size={15} /> {processing ? 'Sending…' : `Send Queued (${queuedCount})`}
            </button>
          )}
          <button
            type="button"
            onClick={fetchMessages}
            disabled={loading}
            className="inline-flex min-h-11 items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {processResult && <p className="mb-5 rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-900" role="status">{processResult}</p>}

      <div className="mb-7 grid grid-cols-3 gap-3" aria-label="Recent email delivery summary">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3"><p className="text-2xl font-semibold text-amber-900">{queuedCount}</p><p className="text-xs font-medium text-amber-800">Queued</p></div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3"><p className="text-2xl font-semibold text-emerald-900">{sentCount}</p><p className="text-xs font-medium text-emerald-800">Sent</p></div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-3"><p className="text-2xl font-semibold text-red-900">{failedCount}</p><p className="text-xs font-medium text-red-800">Failed</p></div>
      </div>

      <AnnouncementsManager />

      <LodgeMailroom />

      <div>
        <section className="max-w-4xl overflow-hidden rounded-xl border border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => setOutboundExpanded((expanded) => !expanded)}
            aria-expanded={outboundExpanded}
            aria-controls="outbound-notification-history"
            aria-label={`${outboundExpanded ? 'Collapse' : 'Expand'} outbound notifications`}
            className="flex min-h-16 w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-slate-50"
          >
            <span className="flex min-w-0 items-center gap-3">
              <ArrowUpRight size={17} className="shrink-0 text-slate-500" />
              <span>
                <span className="block font-semibold text-slate-900">Outbound Notifications</span>
                <span className="block text-xs text-slate-500">{outbound.length} recent notification{outbound.length === 1 ? '' : 's'}</span>
              </span>
            </span>
            <ChevronDown size={18} className={`shrink-0 text-slate-500 transition-transform ${outboundExpanded ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
          {outboundExpanded && (
            <div id="outbound-notification-history" className="space-y-2 border-t border-slate-200 p-4">
              {outbound.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {item.notification_type.split('_').join(' ')}
                      </p>
                      <p className="mt-1 truncate text-xs text-slate-500">{item.recipient_email}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClass[item.status]}`}>
                      {item.status}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                    <span>{new Date(item.created_at).toLocaleString('en-CA')}</span>
                    <span>Attempt {item.attempt_count}/{item.max_attempts}</span>
                  </div>
                  {item.last_error && (
                    <p className="mt-2 line-clamp-2 text-xs text-red-600">{item.last_error}</p>
                  )}
                </div>
              ))}
              {!loading && outbound.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500">
                  No outbound notifications yet.
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
