import { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Mail, RefreshCw } from 'lucide-react';
import { InboundEmail, NotificationOutboxItem, supabase } from '../../lib/supabase';

const statusClass: Record<NotificationOutboxItem['status'], string> = {
  queued: 'bg-amber-100 text-amber-800',
  processing: 'bg-blue-100 text-blue-800',
  sent: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-slate-100 text-slate-700',
};

export const AdminCommunicationsPage = () => {
  const [outbound, setOutbound] = useState<NotificationOutboxItem[]>([]);
  const [inbound, setInbound] = useState<InboundEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = async () => {
    setLoading(true);
    setError(null);

    const [outboundResult, inboundResult] = await Promise.all([
      supabase
        .from('notification_outbox')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('inbound_emails')
        .select('*')
        .order('received_at', { ascending: false })
        .limit(50),
    ]);

    if (outboundResult.error || inboundResult.error) {
      setError(outboundResult.error?.message ?? inboundResult.error?.message ?? 'Could not load communications.');
    }

    setOutbound((outboundResult.data as NotificationOutboxItem[] | null) ?? []);
    setInbound((inboundResult.data as InboundEmail[] | null) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchMessages();
  }, []);

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
        <button
          type="button"
          onClick={fetchMessages}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="grid xl:grid-cols-2 gap-6">
        <section>
          <div className="flex items-center gap-2 mb-3">
            <ArrowUpRight size={17} className="text-slate-500" />
            <h3 className="font-semibold text-slate-900">Outbound Notifications</h3>
          </div>
          <div className="space-y-2">
            {outbound.map((item) => (
              <div key={item.id} className="border border-slate-200 rounded-lg p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {item.notification_type.split('_').join(' ')}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 truncate">{item.recipient_email}</p>
                  </div>
                  <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${statusClass[item.status]}`}>
                    {item.status}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400">
                  <span>{new Date(item.created_at).toLocaleString('en-CA')}</span>
                  <span>Attempt {item.attempt_count}/{item.max_attempts}</span>
                </div>
                {item.last_error && (
                  <p className="text-xs text-red-600 mt-2 line-clamp-2">{item.last_error}</p>
                )}
              </div>
            ))}
            {!loading && outbound.length === 0 && (
              <div className="border border-dashed border-slate-200 rounded-lg py-10 text-center text-sm text-slate-500">
                No outbound notifications yet.
              </div>
            )}
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-3">
            <ArrowDownLeft size={17} className="text-slate-500" />
            <h3 className="font-semibold text-slate-900">Inbound Email</h3>
          </div>
          <div className="space-y-2">
            {inbound.map((message) => (
              <div key={message.id} className="border border-slate-200 rounded-lg p-3">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded-md bg-slate-100 text-slate-500 mt-0.5">
                    <Mail size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {message.subject || '(no subject)'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 truncate">
                      From {message.from_address || 'unknown sender'}
                    </p>
                    <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400">
                      <span>{new Date(message.received_at).toLocaleString('en-CA')}</span>
                      <span className="capitalize">{message.processing_status}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {!loading && inbound.length === 0 && (
              <div className="border border-dashed border-slate-200 rounded-lg py-10 text-center text-sm text-slate-500">
                No inbound messages yet.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
