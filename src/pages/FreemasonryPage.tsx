import { Link } from 'react-router';
import { ArrowRight, ExternalLink } from 'lucide-react';
import {
  freemasonryFacts,
  freemasonryIntro,
  freemasonryTagline,
  GRAND_LODGE_URL,
  tenets,
} from '../lib/freemasonry';

export const FreemasonryPage = () => (
  <div className="min-h-screen bg-slate-50 pb-16 pt-20">
    <section className="bg-slate-950 px-4 py-12 text-center text-white">
      <h1 className="text-4xl font-serif sm:text-5xl">What is Freemasonry?</h1>
      <p className="mx-auto mt-3 max-w-2xl text-lg leading-relaxed text-slate-200">
        {freemasonryTagline} — an introduction for the curious.
      </p>
    </section>

    <div className="mx-auto max-w-3xl space-y-12 px-4 py-12 sm:px-6">
      <section aria-labelledby="freemasonry-intro">
        <h2 id="freemasonry-intro" className="text-3xl font-serif text-slate-900 mb-4">
          The oldest fraternity in the world
        </h2>
        <p className="text-lg leading-relaxed text-slate-700 font-light">
          {freemasonryIntro}
        </p>
      </section>

      <section aria-labelledby="freemasonry-tenets">
        <h2 id="freemasonry-tenets" className="text-3xl font-serif text-slate-900 mb-6">
          Three guiding principles
        </h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {tenets.map((tenet) => (
            <div key={tenet.name} className="border-t-2 border-amber-600/70 pt-4">
              <h3 className="text-xl font-serif text-slate-900 mb-2">{tenet.name}</h3>
              <p className="text-sm leading-relaxed text-slate-600">{tenet.plainLanguage}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="freemasonry-facts">
        <h2 id="freemasonry-facts" className="text-3xl font-serif text-slate-900 mb-6">
          What Freemasonry is — and is not
        </h2>
        <div className="space-y-6">
          {freemasonryFacts.map((fact) => (
            <div key={fact.heading}>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">{fact.heading}</h3>
              <p className="leading-relaxed text-slate-600 font-light">{fact.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="freemasonry-next"
        className="rounded-xl border border-amber-500/30 bg-white p-8 text-center shadow-sm"
      >
        <h2 id="freemasonry-next" className="text-2xl font-serif text-slate-900 mb-3">
          Curious to learn more?
        </h2>
        <p className="mx-auto mb-6 max-w-xl leading-relaxed text-slate-600 font-light">
          If what you have read resonates with you, find out how a conversation with
          Carleton Lodge begins — no obligation, no pressure.
        </p>
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            to="/becoming-a-mason"
            className="inline-flex items-center space-x-2 rounded-md bg-amber-600 px-8 py-3 font-semibold text-white shadow-lg transition-all hover:bg-amber-700"
          >
            <span>Becoming a Mason</span>
            <ArrowRight size={18} />
          </Link>
          <a
            href={GRAND_LODGE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-2 rounded-md border-2 border-slate-300 px-8 py-3 font-medium text-slate-700 transition-colors hover:border-amber-600 hover:text-amber-800"
          >
            <span>Ontario Masons</span>
            <ExternalLink size={16} aria-hidden="true" />
          </a>
        </div>
        <p className="mt-6 text-sm text-slate-500">
          More verified resources on our <Link to="/links" className="text-amber-700 underline hover:text-amber-800">Masonic links</Link> page.
        </p>
      </section>
    </div>
  </div>
);
