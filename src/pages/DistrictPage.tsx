import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Landmark,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Search,
  UserRound,
} from 'lucide-react';
import {
  DistrictEvent,
  DistrictEventDegree,
  DistrictLodge,
  DistrictSummons,
  supabase,
} from '../lib/supabase';

const degreeLabel: Record<DistrictEventDegree, string> = {
  unspecified: 'Degree not stated',
  none: 'No degree',
  first: 'First degree',
  second: 'Second degree',
  third: 'Third degree',
  installation: 'Installation',
  other: 'Other work',
};

const formatDate = (value: string) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Toronto',
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
}).format(new Date(`${value}T12:00:00`));

const formatTime = (value: string | null) => {
  if (!value) return 'Time not stated';
  const [hours, minutes] = value.split(':').map(Number);
  return new Intl.DateTimeFormat('en-CA', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(2000, 0, 1, hours, minutes));
};

export const DistrictPage = () => {
  const [lodges, setLodges] = useState<DistrictLodge[]>([]);
  const [summons, setSummons] = useState<DistrictSummons[]>([]);
  const [events, setEvents] = useState<DistrictEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [degree, setDegree] = useState<DistrictEventDegree | 'all'>('all');
  const [district, setDistrict] = useState<'all' | 'Ottawa District 1' | 'Ottawa District 2'>('all');
  const [lodgeId, setLodgeId] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedSummons, setExpandedSummons] = useState<string | null>(null);
  const [openingPdf, setOpeningPdf] = useState<string | null>(null);
  const blobUrl = useRef<string | null>(null);

  useEffect(() => () => {
    if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
  }, []);

  useEffect(() => {
    const loadDistrict = async () => {
      setLoading(true);
      setError('');
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Toronto',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
      const [lodgesResult, summonsResult, eventsResult] = await Promise.all([
        supabase.from('district_lodges').select('*').order('name'),
        supabase
          .from('district_summons')
          .select('*, district_lodges(*)')
          .order('published_at', { ascending: false }),
        supabase
          .from('district_events')
          .select('*, district_lodges(*), district_summons(id, title, pdf_url)')
          .gte('event_date', today)
          .order('event_date', { ascending: true })
          .order('event_time', { ascending: true }),
      ]);
      const firstError = lodgesResult.error ?? summonsResult.error ?? eventsResult.error;
      if (firstError) {
        setError('District information could not be loaded right now.');
      } else {
        setLodges((lodgesResult.data as DistrictLodge[] | null) ?? []);
        setSummons((summonsResult.data as unknown as DistrictSummons[] | null) ?? []);
        setEvents((eventsResult.data as unknown as DistrictEvent[] | null) ?? []);
      }
      setLoading(false);
    };
    void loadDistrict();
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredEvents = useMemo(() => events.filter((event) => {
    const matchesDegree = degree === 'all' || event.degree === degree;
    const eventDistrict = event.district_lodges?.district_name ?? event.district_name;
    const matchesDistrict = district === 'all' || eventDistrict === district;
    const matchesLodge = lodgeId === 'all' || event.lodge_id === lodgeId;
    const matchesDate = (!dateFrom || event.event_date >= dateFrom) && (!dateTo || event.event_date <= dateTo);
    const haystack = [
      event.title,
      event.description,
      event.location,
      event.district_lodges?.name,
      event.district_lodges?.lodge_number,
    ].filter(Boolean).join(' ').toLowerCase();
    return matchesDegree && matchesDistrict && matchesLodge && matchesDate && (!normalizedQuery || haystack.includes(normalizedQuery));
  }), [dateFrom, dateTo, degree, district, events, lodgeId, normalizedQuery]);

  const filteredSummons = useMemo(() => summons.filter((item) => {
    const matchesDistrict = district === 'all' || item.district_lodges?.district_name === district;
    const matchesLodge = lodgeId === 'all' || item.lodge_id === lodgeId;
    if (!matchesDistrict || !matchesLodge) return false;
    if (!normalizedQuery) return true;
    return [item.title, item.issue_label, item.content, item.district_lodges?.name, item.district_lodges?.district_name]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery);
  }), [district, lodgeId, normalizedQuery, summons]);

  const filteredLodges = useMemo(() => lodges.filter((lodge) => {
    if (district !== 'all' && lodge.district_name !== district) return false;
    if (lodgeId !== 'all' && lodge.id !== lodgeId) return false;
    if (!normalizedQuery) return true;
    return [lodge.name, lodge.lodge_number, lodge.location, lodge.district_name, ...(lodge.aliases ?? [])]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery);
  }), [district, lodgeId, lodges, normalizedQuery]);

  const lodgeOptions = useMemo(
    () => lodges.filter((lodge) => district === 'all' || lodge.district_name === district),
    [district, lodges],
  );

  const openPdf = useCallback(async (path: string) => {
    setOpeningPdf(path);
    try {
      const { data, error: signedError } = await supabase.storage
        .from('summons-uploads')
        .createSignedUrl(path, 60);
      if (signedError || !data?.signedUrl) throw signedError ?? new Error('No signed URL');
      const response = await fetch(data.signedUrl);
      if (!response.ok) throw new Error('PDF could not be opened');
      const file = await response.blob();
      if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
      blobUrl.current = URL.createObjectURL(file);
      window.open(blobUrl.current, '_blank', 'noopener,noreferrer');
    } catch {
      setError('That summons PDF could not be opened. Please try again.');
    } finally {
      setOpeningPdf(null);
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 pt-20">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-900 p-3 text-white"><Landmark size={24} aria-hidden="true" /></div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-800">Member information</p>
              <h1 className="font-serif text-3xl text-slate-950 sm:text-4xl">Ottawa Districts 1 and 2</h1>
            </div>
          </div>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
            Upcoming meetings, degree work, lodge contacts, and summons from both Ottawa Masonic districts.
          </p>
          <div className="mt-5 flex max-w-4xl items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            <AlertTriangle className="mt-0.5 flex-shrink-0" size={20} aria-hidden="true" />
            <p><strong>Check the original summons before travelling.</strong> Visiting-lodge details can change, and extracted information may be incomplete or out of date.</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <section aria-labelledby="district-search-title" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 id="district-search-title" className="font-serif text-2xl text-slate-950">Find a meeting or summons</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <label className="text-sm font-semibold text-slate-700">
              Lodge, event, or location
              <span className="relative mt-1 block">
                <Search className="pointer-events-none absolute left-3 top-3.5 text-slate-400" size={18} aria-hidden="true" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-h-12 w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-base focus:outline-none focus:ring-2 focus:ring-amber-500" placeholder="For example: Russell Lodge" />
              </span>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              District
              <select value={district} onChange={(event) => { setDistrict(event.target.value as typeof district); setLodgeId('all'); }} className="mt-1 min-h-12 w-full rounded-lg border border-slate-300 px-3 text-base focus:outline-none focus:ring-2 focus:ring-amber-500">
                <option value="all">Both districts</option>
                <option value="Ottawa District 1">Ottawa District 1</option>
                <option value="Ottawa District 2">Ottawa District 2</option>
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">Lodge<select value={lodgeId} onChange={(event) => setLodgeId(event.target.value)} className="mt-1 min-h-12 w-full rounded-lg border border-slate-300 px-3 text-base focus:outline-none focus:ring-2 focus:ring-amber-500"><option value="all">All lodges</option>{lodgeOptions.map((lodge) => <option key={lodge.id} value={lodge.id}>{lodge.name}{lodge.lodge_number ? ` No. ${lodge.lodge_number}` : ''}</option>)}</select></label>
            <label className="text-sm font-semibold text-slate-700">
              Degree work
              <select value={degree} onChange={(event) => setDegree(event.target.value as DistrictEventDegree | 'all')} className="mt-1 min-h-12 w-full rounded-lg border border-slate-300 px-3 text-base focus:outline-none focus:ring-2 focus:ring-amber-500">
                <option value="all">All meetings</option>
                <option value="first">First degree</option>
                <option value="second">Second degree</option>
                <option value="third">Third degree</option>
                <option value="installation">Installations</option>
                <option value="none">No degree</option>
                <option value="unspecified">Degree not stated</option>
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">From<input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="mt-1 min-h-12 w-full rounded-lg border border-slate-300 px-3 text-base focus:outline-none focus:ring-2 focus:ring-amber-500" /></label>
            <label className="text-sm font-semibold text-slate-700">To<input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} className="mt-1 min-h-12 w-full rounded-lg border border-slate-300 px-3 text-base focus:outline-none focus:ring-2 focus:ring-amber-500" /></label>
          </div>
        </section>

        {error && <p className="mt-6 rounded-lg bg-red-50 p-4 font-medium text-red-800" role="alert">{error}</p>}
        {loading ? (
          <div className="flex min-h-64 items-center justify-center text-slate-500" role="status"><Loader2 className="mr-2 animate-spin" /> Loading district information…</div>
        ) : (
          <div className="mt-10 space-y-12">
            <section aria-labelledby="upcoming-district-events">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-800">Dates and degree work</p>
                  <h2 id="upcoming-district-events" className="font-serif text-3xl text-slate-950">Upcoming district events</h2>
                </div>
                <p className="text-sm text-slate-500">{filteredEvents.length} matching event{filteredEvents.length === 1 ? '' : 's'}</p>
              </div>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {filteredEvents.map((event) => (
                  <article id={`event-${event.id}`} key={event.id} className="scroll-mt-28 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">{event.district_lodges?.district_name ?? event.district_name}</p>
                        <p className="mt-1 text-sm font-bold uppercase tracking-[0.1em] text-blue-800">{event.district_lodges?.name ?? 'District event'}</p>
                        <h3 className="mt-1 font-serif text-xl text-slate-950">{event.title}</h3>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${event.degree === 'third' ? 'bg-amber-200 text-amber-950' : 'bg-blue-50 text-blue-900'}`}>{degreeLabel[event.degree]}</span>
                    </div>
                    <dl className="mt-4 space-y-3 text-sm text-slate-700">
                      <div className="flex gap-3"><CalendarDays className="mt-0.5 flex-shrink-0 text-blue-800" size={18} /><div><dt className="sr-only">Date and time</dt><dd><strong>{formatDate(event.event_date)}</strong><br />{formatTime(event.event_time)}{event.event_end_time ? ` to ${formatTime(event.event_end_time)}` : ''}</dd></div></div>
                      <div className="flex gap-3"><MapPin className="mt-0.5 flex-shrink-0 text-blue-800" size={18} /><div><dt className="sr-only">Location</dt><dd><strong>{event.location}</strong>{event.location_address && <><br />{event.location_address}</>}</dd></div></div>
                    </dl>
                    {event.description && <p className="mt-4 border-t border-slate-100 pt-4 text-sm leading-6 text-slate-600">{event.description}</p>}
                    {(event.contact_name || event.contact_details) && <p className="mt-3 text-sm text-slate-600"><strong>Contact:</strong> {[event.contact_name, event.contact_details].filter(Boolean).join(' · ')}</p>}
                    {event.summons_id && <a href={`#summons-${event.summons_id}`} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-900 hover:bg-blue-100"><FileText size={16} /> Read the source summons</a>}
                    {!event.summons_id && event.source_url && <a href={event.source_url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-900 hover:bg-blue-100"><ExternalLink size={16} /> View the official calendar source</a>}
                  </article>
                ))}
              </div>
              {filteredEvents.length === 0 && <p className="mt-5 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">No upcoming events match those filters.</p>}
            </section>

            <section aria-labelledby="district-lodges-title">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-800">Directory</p>
              <h2 id="district-lodges-title" className="font-serif text-3xl text-slate-950">District lodges</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredLodges.map((lodge) => (
                  <article id={`lodge-${lodge.id}`} key={lodge.id} className="scroll-mt-28 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">{lodge.district_name}</p>
                    <h3 className="font-serif text-xl text-slate-950">{lodge.name}{lodge.lodge_number ? ` No. ${lodge.lodge_number}` : ''}</h3>
                    {lodge.location && <p className="mt-2 flex gap-2 text-sm text-slate-600"><MapPin size={16} className="mt-0.5 flex-shrink-0" /> {lodge.location}</p>}
                    <dl className="mt-4 space-y-2 text-sm text-slate-700">
                      {lodge.worshipful_master_name && <div><dt className="font-semibold">Worshipful Master</dt><dd>{lodge.worshipful_master_name}</dd></div>}
                      {lodge.secretary_name && <div><dt className="font-semibold">Secretary</dt><dd>{lodge.secretary_name}</dd></div>}
                    </dl>
                    <div className="mt-4 space-y-2 text-sm">
                      {lodge.contact_email && <a className="flex min-h-10 items-center gap-2 text-blue-800 hover:underline" href={`mailto:${lodge.contact_email}`}><Mail size={16} /> {lodge.contact_email}</a>}
                      {lodge.contact_phone && <a className="flex min-h-10 items-center gap-2 text-blue-800 hover:underline" href={`tel:${lodge.contact_phone.replace(/[^+\d]/g, '')}`}><Phone size={16} /> {lodge.contact_phone}</a>}
                      {lodge.website_url && <a className="flex min-h-10 items-center gap-2 text-blue-800 hover:underline" href={lodge.website_url} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} /> Visit lodge website</a>}
                    </div>
                    {lodge.details_as_of && <p className="mt-4 text-xs text-slate-400">Details taken from a summons current as of {lodge.details_as_of}.</p>}
                  </article>
                ))}
              </div>
              {filteredLodges.length === 0 && <p className="mt-5 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500"><UserRound className="mx-auto mb-2" /> No district lodges match those filters.</p>}
            </section>

            <section aria-labelledby="district-summons-title">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-800">Original notices</p>
              <h2 id="district-summons-title" className="font-serif text-3xl text-slate-950">District summons</h2>
              <div className="mt-5 space-y-4">
                {filteredSummons.map((item) => {
                  const expanded = expandedSummons === item.id;
                  return (
                    <article id={`summons-${item.id}`} key={item.id} className="scroll-mt-28 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                      <button type="button" onClick={() => setExpandedSummons(expanded ? null : item.id)} className="flex min-h-20 w-full items-center justify-between gap-4 px-5 py-4 text-left">
                        <span><span className="block text-xs font-bold uppercase tracking-[0.1em] text-slate-500">{item.district_lodges?.district_name ?? 'Ottawa district'}</span><span className="mt-1 block text-sm font-bold uppercase tracking-[0.1em] text-blue-800">{item.district_lodges?.name ?? 'District lodge'}</span><span className="mt-1 block font-serif text-xl text-slate-950">{item.title}</span><span className="mt-1 block text-sm text-slate-500">{item.issue_label}</span></span>
                        {expanded ? <ChevronUp className="flex-shrink-0" /> : <ChevronDown className="flex-shrink-0" />}
                      </button>
                      {expanded && (
                        <div className="border-t border-slate-100 px-5 py-5">
                          <p className="max-h-80 overflow-auto whitespace-pre-wrap text-sm leading-7 text-slate-700">{item.content}</p>
                          {item.pdf_url && <button type="button" onClick={() => void openPdf(item.pdf_url!)} disabled={openingPdf === item.pdf_url} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{openingPdf === item.pdf_url ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />} Open original PDF</button>}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
              {filteredSummons.length === 0 && <p className="mt-5 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">No district summons match that search.</p>}
            </section>
          </div>
        )}
      </main>
    </div>
  );
};
