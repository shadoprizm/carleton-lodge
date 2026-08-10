import { FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { ArrowRight, ExternalLink, LockKeyhole, Search } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { LodgeSearchResult, supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { supportMailto } from '../lib/contact';

const sourceLabels: Record<LodgeSearchResult['source_type'], string> = {
  event: 'Calendar event',
  announcement: 'Announcement',
  summons: 'Summons',
  document: 'Lodge document',
  history: 'Lodge history',
  member: 'Officer or member',
  help: 'Help topic',
  district_lodge: 'Ottawa district lodge',
  district_summons: 'District summons',
  district_event: 'District event',
  grand_lodge_page: 'Grand Lodge source',
  district_page: 'Official district source',
  external_lodge_page: 'Official lodge source',
};

const SearchResultTarget = ({ url, children }: { url: string; children: ReactNode }) => {
  const className = 'group block rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 sm:p-6';
  return /^https:\/\//i.test(url)
    ? <a href={url} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>
    : <Link to={url} className={className}>{children}</Link>;
};

const publicSuggestions = ['meeting information', 'lodge history', 'sign in help', 'wrong information'];
const memberSuggestions = ['next lodge meeting', 'latest summons', 'Ottawa district degree', 'Secretary', 'notification settings'];

export const SearchPage = () => {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const query = params.get('q')?.trim() ?? '';
  const [input, setInput] = useState(query);
  const [results, setResults] = useState<LodgeSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const suggestions = user ? memberSuggestions : publicSuggestions;

  useEffect(() => setInput(query), [query]);

  useEffect(() => {
    let active = true;
    if (query.length < 2) {
      setResults([]);
      setError('');
      return;
    }

    const search = async () => {
      setLoading(true);
      setError('');
      const { data, error: searchError } = await supabase.rpc('search_lodge_knowledge', {
        search_query: query,
        result_limit: 30,
      });
      if (!active) return;
      if (searchError) {
        setError('Search is temporarily unavailable. Please try again or use the Help page.');
        setResults([]);
      } else {
        setResults((data as LodgeSearchResult[] | null) ?? []);
      }
      setLoading(false);
      window.setTimeout(() => headingRef.current?.focus(), 0);
    };

    void search();
    return () => {
      active = false;
    };
  }, [query, user?.id]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const nextQuery = input.trim();
    if (nextQuery.length >= 2) setParams({ q: nextQuery });
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-16 pt-20">
      <section className="bg-slate-950 px-4 py-12 text-white">
        <div className="mx-auto max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-300">Carleton Lodge information</p>
          <h1 className="mt-2 text-4xl font-serif sm:text-5xl">Search the Lodge Website</h1>
          <p className="mt-3 max-w-2xl text-lg leading-relaxed text-slate-200">Search announcements, events, history and help. Signed-in members also search summons, Ottawa District 1 and 2 meetings, lodge documents, and the member directory.</p>
          <form onSubmit={submit} role="search" className="mt-7 flex flex-col gap-3 sm:flex-row">
            <label htmlFor="site-search" className="sr-only">Search lodge information</label>
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={22} aria-hidden="true" />
              <input id="site-search" type="search" value={input} onChange={(event) => setInput(event.target.value)} minLength={2} maxLength={200} placeholder="What are you looking for?" className="min-h-14 w-full rounded-xl border-2 border-white bg-white pl-12 pr-4 text-lg text-slate-950 placeholder-slate-500 outline-none focus:border-amber-400" />
            </div>
            <button type="submit" className="min-h-14 rounded-xl bg-amber-500 px-7 text-lg font-bold text-slate-950 hover:bg-amber-400">Search</button>
          </form>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-4 py-9 sm:px-6">
        {!query && (
          <section aria-labelledby="search-suggestions-heading">
            <h2 id="search-suggestions-heading" className="text-2xl font-serif text-slate-900">Popular searches</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              {suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => setParams({ q: suggestion })} className="min-h-11 rounded-full border border-slate-300 bg-white px-4 font-medium text-slate-800 hover:border-amber-500">{suggestion}</button>)}
            </div>
          </section>
        )}

        {query && (
          <section aria-labelledby="search-results-heading">
            <h2 ref={headingRef} tabIndex={-1} id="search-results-heading" className="text-2xl font-serif text-slate-900 outline-none">
              {loading ? 'Searching…' : `${results.length} result${results.length === 1 ? '' : 's'} for “${query}”`}
            </h2>
            {error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">{error}</p>}
            {!loading && !error && results.length > 0 && (
              <ol className="mt-5 space-y-4">
                {results.map((result) => (
                  <li key={result.id}>
                    <SearchResultTarget url={result.source_url}>
                      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-600">
                        <span>{sourceLabels[result.source_type]}</span>
                        {result.visibility !== 'public' && <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs"><LockKeyhole size={12} /> Members</span>}
                      </div>
                      <h3 className="mt-2 text-2xl font-serif text-slate-900 group-hover:text-amber-800">{result.title}</h3>
                      {result.snippet && <p className="mt-2 line-clamp-3 text-base leading-relaxed text-slate-600">{result.snippet}</p>}
                      <span className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold text-blue-900 underline underline-offset-4">Open source {/^https:\/\//i.test(result.source_url) ? <ExternalLink size={17} /> : <ArrowRight size={17} />}</span>
                    </SearchResultTarget>
                  </li>
                ))}
              </ol>
            )}
            {!loading && !error && results.length === 0 && (
              <div className="mt-5 rounded-xl border border-slate-200 bg-white p-7 text-center">
                <h3 className="text-xl font-serif text-slate-900">We could not find that</h3>
                <p className="mt-2 text-base text-slate-600">Try fewer words, open Help, or ask a person for assistance.</p>
                <div className="mt-5 flex flex-wrap justify-center gap-3"><Link to="/help" className="inline-flex min-h-12 items-center rounded-lg bg-slate-900 px-5 font-semibold text-amber-300">Open Help</Link><a href={supportMailto('Help finding lodge information')} className="inline-flex min-h-12 items-center rounded-lg border border-slate-300 px-5 font-semibold text-slate-800">Email for Help</a></div>
              </div>
            )}
            {!user && <p className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-950"><strong>Looking for member information?</strong> Sign in first so search can include summons, lodge documents, and directory entries.</p>}
          </section>
        )}
      </div>
    </div>
  );
};
