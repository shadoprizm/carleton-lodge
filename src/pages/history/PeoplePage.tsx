import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { HistoryLayout } from '../../components/history/HistoryLayout';
import { PersonCard } from '../../components/history/PersonCard';
import { HistoryFigure } from '../../components/history/HistoryFigure';
import { SourceNotes, UnresolvedCallout } from '../../components/history/SourceNotes';
import {
  imageById,
  keyFigures,
  knownCharterMembers,
  openQuestions,
  type HistoryPerson,
} from '../../lib/history';

const matches = (person: HistoryPerson, query: string) => {
  const haystack = `${person.name} ${person.role} ${person.bio}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
};

export const PeoplePage = () => {
  const [query, setQuery] = useState('');
  const trimmedQuery = query.trim();
  const rosterQuestion = openQuestions.find((question) => question.id === 'charter-member-roster');
  const legacyPortraits = ['LEG13', 'LEG14']
    .map((id) => imageById(id))
    .filter((img): img is NonNullable<typeof img> => Boolean(img));

  const visibleKeyFigures = useMemo(
    () => keyFigures.filter((person) => !trimmedQuery || matches(person, trimmedQuery)),
    [trimmedQuery],
  );
  const visibleCharterMembers = useMemo(
    () => knownCharterMembers.filter((person) => !trimmedQuery || matches(person, trimmedQuery)),
    [trimmedQuery],
  );

  return (
    <HistoryLayout
      activeSlug="people"
      eyebrow="The archive"
      title="People of the Lodge"
      intro="The founders, charter members, and key figures documented in the sources — and an honest accounting of what the record has not yet recovered."
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
            Carleton Lodge was instituted on 12 January 1904 with twenty-three charter members. Only
            the twelve names below are identified in the District history — the other eleven names
            remain unidentified, and no complete list of twenty-three is published here.
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

        {rosterQuestion && <UnresolvedCallout question={rosterQuestion} />}

        <section aria-labelledby="past-masters">
          <h2 id="past-masters" className="font-serif text-3xl text-slate-900">
            Past Masters
          </h2>
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm leading-relaxed text-slate-600">
            The roll of Past Masters is being compiled from Lodge records and Grand Lodge sources.
            It will be published here once it can be presented complete and accurately, with its
            sources cited.
          </div>
          <p className="mt-6 max-w-3xl text-sm leading-relaxed text-slate-600">
            Two portraits recovered from the Lodge's retired website show modern Worshipful
            Masters. Their names await member confirmation before they are added to the roll:
          </p>
          <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:max-w-3xl">
            {legacyPortraits.map((image) => (
              <HistoryFigure key={image.id} image={image} />
            ))}
          </div>
        </section>

        <section aria-labelledby="district-officers">
          <h2 id="district-officers" className="font-serif text-3xl text-slate-900">
            District Deputy Grand Masters &amp; Grand Lodge officers
          </h2>
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm leading-relaxed text-slate-600">
            Carleton Lodge members who have served the Ottawa District and Grand Lodge are likewise
            being compiled from Lodge records, and will appear here when the list is verified.
          </div>
        </section>

        <SourceNotes sourceIds={['S01', 'S10']} />
      </div>
    </HistoryLayout>
  );
};
