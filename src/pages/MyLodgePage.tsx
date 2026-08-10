import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, Bot, CalendarDays, Clock, ExternalLink, FileText, Landmark, Mail, MapPin, Search, ScrollText, Users } from 'lucide-react';
import { Link } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { DocumentWithCategory, Event, MemberDirectoryProfile, MyLodgeEmailAccount, Summons, supabase } from '../lib/supabase';
import { formatDateOnly, formatTimeRange, todayDateKey } from '../utils/dateTime';
import { Announcements } from '../components/Announcements';
import { canAccessLodgeGuidePilot, LODGE_GUIDE_ENABLED } from '../lib/lodgeGuide';

type DashboardData = {
  events: Event[];
  summons: Summons | null;
  documents: DocumentWithCategory[];
  member: MemberDirectoryProfile | null;
  emailAccounts: MyLodgeEmailAccount[];
};

const initialData: DashboardData = {
  events: [],
  summons: null,
  documents: [],
  member: null,
  emailAccounts: [],
};

const getMapsUrl = (address: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

export const MyLodgePage = () => {
  const { user, isAdmin } = useAuth();
  const [data, setData] = useState<DashboardData>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    let active = true;

    const loadDashboard = async () => {
      setLoading(true);
      setError('');
      const [eventsResult, summonsResult, documentsResult, memberResult, emailAccountsResult] = await Promise.all([
        supabase
          .from('events')
          .select('id, title, description, event_date, event_time, event_end_time, location, location_address, poc_name, poc_contact, visibility, event_status, status_note, created_by, created_at, updated_at')
          .gte('event_date', todayDateKey())
          .order('event_date', { ascending: true })
          .order('event_time', { ascending: true })
          .limit(4),
        supabase
          .from('summons')
          .select('*')
          .order('published_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('documents')
          .select('*, document_categories(*)')
          .order('created_at', { ascending: false })
          .limit(4),
        supabase
          .from('lodge_members')
          .select('id, full_name, phone, join_date, position_id, bio, visible_to_members, linked_profile_id, lodge_email, mailbox_status, mailbox_provisioned_at, mailbox_activated_at, created_at, updated_at')
          .eq('linked_profile_id', user.id)
          .maybeSingle(),
        supabase.rpc('get_my_lodge_email_accounts'),
      ]);

      if (!active) return;
      const firstError = eventsResult.error || summonsResult.error || documentsResult.error || memberResult.error || emailAccountsResult.error;
      if (firstError) {
        setError('Some lodge information could not be loaded. Please refresh the page or contact us if the problem continues.');
      }

      setData({
        events: (eventsResult.data as Event[] | null) ?? [],
        summons: (summonsResult.data as Summons | null) ?? null,
        documents: (documentsResult.data as DocumentWithCategory[] | null) ?? [],
        member: (memberResult.data as MemberDirectoryProfile | null) ?? null,
        emailAccounts: (emailAccountsResult.data as MyLodgeEmailAccount[] | null) ?? [],
      });
      setLoading(false);
    };

    loadDashboard();
    return () => {
      active = false;
    };
  }, [user]);

  const nextEvent = data.events[0] ?? null;
  const displayName = data.member?.full_name?.split(' ')[0] ?? 'Brother';

  return (
    <div className="min-h-screen bg-slate-50 pb-16 pt-20">
      <section className="bg-slate-950 px-4 py-10 text-white sm:py-14">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-300">Member home</p>
          <h1 className="mt-2 text-4xl font-serif sm:text-5xl">Welcome, {displayName}</h1>
          <p className="mt-3 max-w-2xl text-lg leading-relaxed text-slate-200">
            Your quickest path to current lodge meetings, notices, summons, documents, and contacts.
          </p>
        </div>
      </section>

      <Announcements limit={5} />

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        {error && <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900" role="alert">{error}</p>}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-base text-slate-600" role="status">
            Loading your lodge information…
          </div>
        ) : (
          <>
            <section aria-labelledby="next-meeting-heading">
              <div className="mb-3 flex items-center justify-between gap-4">
                <h2 id="next-meeting-heading" className="text-2xl font-serif text-slate-900">Next Lodge Event</h2>
                <Link to="/calendar" className="inline-flex min-h-11 items-center gap-2 rounded-md px-2 font-semibold text-blue-900 underline underline-offset-4">
                  Full calendar <ArrowRight size={17} />
                </Link>
              </div>
              {nextEvent ? (
                <article className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
                  <div className="grid md:grid-cols-[15rem_1fr]">
                    <div className="flex flex-col justify-center bg-slate-900 p-7 text-white">
                      <CalendarDays className="mb-4 text-amber-300" size={34} />
                      <p className="text-2xl font-serif leading-tight">{formatDateOnly(nextEvent.event_date, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                      <p className="mt-2 text-lg font-semibold text-amber-200">{formatTimeRange(nextEvent.event_time, nextEvent.event_end_time) ?? 'Time to be confirmed'}</p>
                    </div>
                    <div className="p-7 sm:p-8">
                      <h3 className="text-3xl font-serif text-slate-900">{nextEvent.title}</h3>
                      {nextEvent.event_status !== 'scheduled' && (
                        <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-sm font-bold uppercase tracking-wide ${
                          nextEvent.event_status === 'cancelled'
                            ? 'bg-red-100 text-red-900'
                            : 'bg-amber-100 text-amber-900'
                        }`}>
                          {nextEvent.event_status}
                        </span>
                      )}
                      {nextEvent.status_note && (
                        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 font-medium text-slate-800">
                          {nextEvent.status_note}
                        </p>
                      )}
                      <div className="mt-5 space-y-3 text-base text-slate-700">
                        <p className="flex items-start gap-3">
                          <Clock className="mt-0.5 shrink-0 text-amber-700" size={20} />
                          <span>{formatTimeRange(nextEvent.event_time, nextEvent.event_end_time) ?? 'Time to be confirmed'}</span>
                        </p>
                        <p className="flex items-start gap-3">
                          <MapPin className="mt-0.5 shrink-0 text-amber-700" size={20} />
                          <span>
                            {nextEvent.location}
                            {nextEvent.location_address && <span className="block text-slate-600">{nextEvent.location_address}</span>}
                          </span>
                        </p>
                      </div>
                      <div className="mt-6 flex flex-wrap gap-3">
                        <Link to="/calendar" className="inline-flex min-h-12 items-center justify-center rounded-lg bg-slate-900 px-5 py-3 font-semibold text-amber-300">
                          View Event Details
                        </Link>
                        {nextEvent.location_address && (
                          <a
                            href={getMapsUrl(nextEvent.location_address)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-slate-300 px-5 py-3 font-semibold text-slate-800"
                          >
                            <MapPin size={18} /> Get Directions
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
                  <p className="text-lg text-slate-700">No upcoming lodge events are posted.</p>
                  <p className="mt-2 text-base text-slate-500">Please check again soon or contact the Secretary.</p>
                </div>
              )}
            </section>

            {data.emailAccounts.map((emailAccount, accountIndex) => {
              const ready = emailAccount.status === 'ACTIVE' && !emailAccount.needs_agreement;
              const waitingForAdministration = ['NOT_PROVISIONED', 'PROVISIONING'].includes(emailAccount.status);
              const heading = emailAccount.account_type === 'MEMBER'
                ? 'Personal Lodge Email'
                : `Officer Account — ${emailAccount.position_name ?? emailAccount.display_name}`;
              return (
                <section key={emailAccount.id} className={`rounded-2xl border p-6 shadow-sm sm:p-7 ${ready ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`} aria-labelledby={`lodge-email-heading-${accountIndex}`}>
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-amber-300"><Mail size={27} /></span>
                    <div className="min-w-0 flex-1">
                      <h2 id={`lodge-email-heading-${accountIndex}`} className="text-2xl font-serif text-slate-900">{heading}</h2>
                      <p className="mt-1 break-all text-lg font-semibold text-slate-800">{emailAccount.address}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {emailAccount.account_type === 'MEMBER'
                          ? ready
                            ? 'Your personal Lodge mailbox is active and ready to use.'
                            : waitingForAdministration
                              ? 'Lodge administration is preparing this mailbox. You will receive a secure setup invitation when it is ready.'
                              : 'Review the Lodge email agreement to finish or confirm setup.'
                          : ready
                            ? 'This Lodge-owned mailbox is assigned to you while you hold this role.'
                            : waitingForAdministration
                              ? 'Lodge administration is preparing this role mailbox. A secure invitation will be sent to your personal email when it is ready.'
                              : 'Use the secure invitation sent to your personal email to accept the officer agreement and establish credentials.'}
                      </p>
                    </div>
                    {ready ? (
                      <div className="flex shrink-0 flex-col gap-2">
                        <a href="https://webmail.mxroute.com/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-4 text-lg font-bold text-amber-300">
                          Open Webmail <ExternalLink size={19} />
                        </a>
                        <Link to={`/my-lodge/email?account=${emailAccount.id}`} className="inline-flex min-h-11 items-center justify-center rounded-lg px-3 font-semibold text-blue-950 underline underline-offset-4">
                          Email setup & agreement
                        </Link>
                      </div>
                    ) : (
                      <Link to={`/my-lodge/email?account=${emailAccount.id}`} className="inline-flex min-h-14 shrink-0 items-center justify-center rounded-xl bg-slate-900 px-6 py-4 text-lg font-bold text-amber-300">
                        {waitingForAdministration ? 'View Mailbox Status' : emailAccount.needs_agreement ? 'Review Agreement' : 'Finish Setup'}
                      </Link>
                    )}
                  </div>
                </section>
              );
            })}

            <nav aria-label="Member shortcuts" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {canAccessLodgeGuidePilot(LODGE_GUIDE_ENABLED, isAdmin) && <QuickLink to="/lodge-guide" icon={Bot} label="Ask the Lodge Guide" description="Answers from approved sources" />}
              <QuickLink to="/calendar" icon={CalendarDays} label="Calendar" description="Meetings and events" />
              <QuickLink to="/summons" icon={ScrollText} label="Latest Summons" description="Official lodge notice" />
              <QuickLink to="/district" icon={Landmark} label="Ottawa District 1" description="Visiting lodges and degrees" />
              <QuickLink to="/library" icon={BookOpen} label="Lodge Documents" description="Minutes, forms and records" />
              <QuickLink to="/members" icon={Users} label="Officers & Members" description="Find the right person" />
            </nav>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
                <div className="flex items-center gap-3">
                  <ScrollText className="text-amber-700" size={25} />
                  <h2 className="text-2xl font-serif text-slate-900">Latest Summons</h2>
                </div>
                {data.summons ? (
                  <>
                    <h3 className="mt-5 text-xl font-semibold text-slate-900">{data.summons.title}</h3>
                    <p className="mt-1 text-base text-slate-600">{data.summons.month}</p>
                    <Link to="/summons" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-md font-semibold text-blue-900 underline underline-offset-4">
                      Read the summons <ArrowRight size={17} />
                    </Link>
                  </>
                ) : (
                  <p className="mt-5 text-base text-slate-600">No summons has been posted yet.</p>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
                <div className="flex items-center gap-3">
                  <FileText className="text-amber-700" size={25} />
                  <h2 className="text-2xl font-serif text-slate-900">Recently Added Documents</h2>
                </div>
                {data.documents.length > 0 ? (
                  <ul className="mt-4 divide-y divide-slate-100">
                    {data.documents.slice(0, 3).map((document) => (
                      <li key={document.id} className="py-3">
                        <Link to="/library" className="block rounded-md py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900">
                          <span className="block font-semibold text-slate-900">{document.title}</span>
                          <span className="mt-0.5 block text-sm text-slate-600">{document.document_categories?.name ?? 'Lodge document'}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-5 text-base text-slate-600">No documents have been added yet.</p>
                )}
                <Link to="/library" className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-md font-semibold text-blue-900 underline underline-offset-4">
                  Browse lodge documents <ArrowRight size={17} />
                </Link>
              </div>
            </section>

            <section className="rounded-2xl border border-blue-200 bg-blue-50 p-6 sm:p-8" aria-labelledby="find-information-heading">
              <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
                <div className="rounded-xl bg-blue-900 p-3 text-white"><Search size={26} /></div>
                <div className="flex-1">
                  <h2 id="find-information-heading" className="text-2xl font-serif text-slate-900">Can’t find something?</h2>
                  <p className="mt-1 text-base leading-relaxed text-slate-700">Search events, announcements, summons, documents, lodge history, help topics, and directory entries in one place.</p>
                </div>
                <Link to="/search" className="inline-flex min-h-12 items-center justify-center rounded-lg bg-blue-900 px-5 py-3 font-semibold text-white">Search Lodge Information</Link>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
};

const QuickLink = ({
  to,
  icon: Icon,
  label,
  description,
}: {
  to: string;
  icon: typeof CalendarDays;
  label: string;
  description: string;
}) => (
  <Link
    to={to}
    className="group flex min-h-28 items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
  >
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
      <Icon size={24} />
    </span>
    <span>
      <span className="block text-lg font-semibold text-slate-900">{label}</span>
      <span className="mt-0.5 block text-sm text-slate-600">{description}</span>
    </span>
  </Link>
);
