import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { HistoryLayout } from '../../components/history/HistoryLayout';
import { PersonCard } from '../../components/history/PersonCard';
import { HistoryFigure } from '../../components/history/HistoryFigure';
import { SourceNotes } from '../../components/history/SourceNotes';
import {
  imageById,
  keyFigures,
  knownCharterMembers,
  type HistoryImage,
  type HistoryPerson,
} from '../../lib/history';

const matches = (person: HistoryPerson, query: string) => {
  const haystack = `${person.name} ${person.role} ${person.bio}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
};

export const PeoplePage = () => {
  const [query, setQuery] = useState('');
  const trimmedQuery = query.trim();

  const visibleKeyFigures = useMemo(
    () => keyFigures.filter((person) => !trimmedQuery || matches(person, trimmedQuery)),
    [trimmedQuery],
  );
  const visibleCharterMembers = useMemo(
    () => knownCharterMembers.filter((person) => !trimmedQuery || matches(person, trimmedQuery)),
    [trimmedQuery],
  );
  const portraits = useMemo(
    () =>
      ['LEG13', 'LEG14']
        .map((id) => imageById(id))
        .filter((img): img is HistoryImage => Boolean(img?.localPath)),
    [],
  );

  return (
    <HistoryLayout
      activeSlug="people"
      eyebrow="The archive"
      title="People of the Lodge"
      intro="The founders, charter members, and key figures documented in the Lodge's history."
    >
      <div className="space-y-12">
        <div className="relative max-w-md">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search names, roles, and notes…"
            aria-label="Search people"
            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
          />
        </div>

        <section aria-labelledby="key-figures">
          <h2 id="key-figures" className="font-serif text-3xl text-slate-900">
            Founders &amp; key figures
          </h2>
          {visibleKeyFigures.length > 0 ? (
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {visibleKeyFigures.map((person) => (
                <PersonCard key={person.id} person={person} />
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">No key figures match “{trimmedQuery}”.</p>
          )}
        </section>

        <section aria-labelledby="known-charter-members">
          <h2 id="known-charter-members" className="font-serif text-3xl text-slate-900">
            Known charter members
          </h2>
          <p className="mt-3 max-w-3xl leading-relaxed text-slate-700">
            Carleton Lodge was instituted on 12 January 1904 with twenty-three charter members. The
            full list of twenty-three names has not survived in the sources consulted; the District
            history identifies the twelve below.
          </p>
          {visibleCharterMembers.length > 0 ? (
            <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleCharterMembers.map((member) => (
                <li
                  key={member.id}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm"
                >
                  {member.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-slate-500">No charter members match “{trimmedQuery}”.</p>
          )}
        </section>

        {portraits.length > 0 && (
          <section aria-labelledby="past-masters">
            <h2 id="past-masters" className="font-serif text-3xl text-slate-900">
              Past Masters
            </h2>
            <p className="mt-3 max-w-3xl leading-relaxed text-slate-700">
              The Lodge has been led by an unbroken line of Worshipful Masters since 1904.
              Portraits from the Lodge's own archive:
            </p>
            <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:max-w-3xl">
              {portraits.map((image) => (
                <HistoryFigure key={image.id} image={image} />
              ))}
            </div>
          </section>
        )}

        <SourceNotes sourceIds={['S01', 'S10']} />
      </div>
    </HistoryLayout>
  );
};
