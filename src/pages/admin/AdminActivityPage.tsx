import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Clock3, LogIn, RefreshCw, Search, UserX } from 'lucide-react';
import {
  MEMBER_ACTIVITY_ACTIVE_WINDOW_DAYS,
  activityOccurredWithinDays,
  matchesMemberActivityFilter,
  type MemberActivityFilter,
} from '../../lib/memberActivity';
import { supabase, type MemberActivitySummary } from '../../lib/supabase';

const dateTimeFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Toronto',
  dateStyle: 'medium',
  timeStyle: 'short',
});

const formatDateTime = (value: string | null, fallback: string) => {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : dateTimeFormatter.format(date);
};

export const AdminActivityPage = () => {
  const [members, setMembers] = useState<MemberActivitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<MemberActivityFilter>('all');
  const [now, setNow] = useState(() => Date.now());

  const loadActivity = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: activityError } = await supabase.functions.invoke(
      'member-activity',
      { body: { action: 'list' } },
    );

    if (activityError) {
      setError('Member activity could not be loaded. Check your access and try again.');
      setMembers([]);
    } else {
      const response = data as { members?: MemberActivitySummary[] } | null;
      setMembers(response?.members ?? []);
      setNow(Date.now());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  const summary = useMemo(() => ({
    total: members.length,
    signedIn: members.filter((member) => member.last_login_at !== null).length,
    recentlyActive: members.filter((member) =>
      activityOccurredWithinDays(
        member.last_seen_at,
        MEMBER_ACTIVITY_ACTIVE_WINDOW_DAYS,
        now,
      )
    ).length,
    neverSignedIn: members.filter((member) => member.last_login_at === null).length,
  }), [members, now]);

  const normalizedQuery = query.trim().toLocaleLowerCase('en-CA');
  const visibleMembers = useMemo(() => members.filter((member) => {
    if (!matchesMemberActivityFilter(member, filter, now)) return false;
    if (!normalizedQuery) return true;
    return `${member.full_name ?? ''} ${member.email}`
      .toLocaleLowerCase('en-CA')
      .includes(normalizedQuery);
  }), [filter, members, normalizedQuery, now]);

  const metrics = [
    { label: 'Member accounts', value: summary.total, icon: Activity, tone: 'text-slate-700 bg-slate-100' },
    { label: 'Have signed in', value: summary.signedIn, icon: LogIn, tone: 'text-blue-800 bg-blue-100' },
    { label: 'Active in 30 days', value: summary.recentlyActive, icon: Clock3, tone: 'text-emerald-800 bg-emerald-100' },
    { label: 'Never signed in', value: summary.neverSignedIn, icon: UserX, tone: 'text-amber-800 bg-amber-100' },
  ] as const;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-serif text-slate-900">Member Activity</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            Last login comes from Supabase authentication. Last active is a best-effort authenticated website heartbeat that normally updates within 15 minutes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadActivity()}
          disabled={loading}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
          Refresh
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          {error}
        </p>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Member activity summary">
        {metrics.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <span className={`inline-flex rounded-lg p-2 ${tone}`}>
              <Icon size={18} aria-hidden="true" />
            </span>
            <p className="mt-3 text-2xl font-bold text-slate-950">{value}</p>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Search member activity</span>
          <Search size={17} className="pointer-events-none absolute left-3 top-3.5 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or email"
            className="min-h-11 w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
          />
        </label>
        <label>
          <span className="sr-only">Filter member activity</span>
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as MemberActivityFilter)}
            className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200 sm:w-auto"
          >
            <option value="all">All accounts</option>
            <option value="never-login">Never signed in</option>
            <option value="inactive-90">Inactive 90+ days</option>
          </select>
        </label>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200">
              <th scope="col" className="px-4 py-3 text-left font-semibold text-slate-600">Member</th>
              <th scope="col" className="px-4 py-3 text-left font-semibold text-slate-600">Joined</th>
              <th scope="col" className="px-4 py-3 text-left font-semibold text-slate-600">Last Login</th>
              <th scope="col" className="px-4 py-3 text-left font-semibold text-slate-600">Last Active</th>
            </tr>
          </thead>
          <tbody>
            {visibleMembers.map((member) => (
              <tr key={member.profile_id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{member.full_name ?? member.email}</p>
                  {member.full_name
                    ? <p className="mt-0.5 text-xs text-slate-500">{member.email}</p>
                    : null}
                </td>
                <td className="px-4 py-3 text-slate-600">{formatDateTime(member.joined_at, 'Unknown')}</td>
                <td className="px-4 py-3 text-slate-600">{formatDateTime(member.last_login_at, 'Never signed in')}</td>
                <td className="px-4 py-3 text-slate-600">{formatDateTime(member.last_seen_at, 'No recorded visit')}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && visibleMembers.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-slate-500">
            No member accounts match this view.
          </div>
        )}
        {loading && members.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-slate-500" role="status">
            Loading member activity…
          </div>
        )}
      </div>

      <p className="mt-4 text-xs leading-5 text-slate-500">
        This view stores only the latest authenticated visit. It does not record browsing history, visited pages, device details, or IP addresses.
      </p>
    </div>
  );
};
