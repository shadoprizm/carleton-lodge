import { Link } from 'react-router';
import { ArrowRight, ExternalLink } from 'lucide-react';
import {
  conversationSteps,
  eligibilityAttribution,
  eligibilityQuote,
  GRAND_LODGE_BECOMING_URL,
  voluntaryPrinciple,
} from '../lib/freemasonry';

export const BecomingAMasonPage = () => (
  <div className="min-h-screen bg-slate-50 pb-16 pt-20">
    <section className="bg-slate-950 px-4 py-12 text-center text-white">
      <h1 className="text-4xl font-serif sm:text-5xl">Becoming a Mason</h1>
      <p className="mx-auto mt-3 max-w-2xl text-lg leading-relaxed text-slate-200">
        Interested in Freemasonry? It begins with a conversation.
      </p>
    </section>

    <div className="mx-auto max-w-3xl space-y-12 px-4 py-12 sm:px-6">
      <section aria-labelledby="becoming-voluntary">
        <h2 id="becoming-voluntary" className="text-3xl font-serif text-slate-900 mb-4">
          To be one, ask one
        </h2>
        <p className="text-lg leading-relaxed text-slate-700 font-light">
          {voluntaryPrinciple}
        </p>
      </section>

      <section aria-labelledby="becoming-eligibility">
        <h2 id="becoming-eligibility" className="text-3xl font-serif text-slate-900 mb-4">
          Who can become a Mason?
        </h2>
        <blockquote className="border-l-4 border-amber-600/70 bg-white rounded-r-xl p-6 shadow-sm">
          <p className="text-xl leading-relaxed text-slate-800 font-serif">
            &ldquo;{eligibilityQuote}&rdquo;
          </p>
          <footer className="mt-3 text-sm text-slate-500">
            — {eligibilityAttribution}
          </footer>
        </blockquote>
        <p className="mt-4 leading-relaxed text-slate-600 font-light">
          Masons come from every walk of life, and men are welcome regardless of race,
          colour, or creed. What matters is character — and a sincere interest in
          becoming a better man.
        </p>
      </section>

      <section aria-labelledby="becoming-steps">
        <h2 id="becoming-steps" className="text-3xl font-serif text-slate-900 mb-6">
          What to expect
        </h2>
        <ol className="space-y-6">
          {conversationSteps.map((step, index) => (
            <li key={step.title} className="flex gap-4">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-900 font-serif text-lg text-white"
              >
                {index + 1}
              </span>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-1">{step.title}</h3>
                <p className="leading-relaxed text-slate-600 font-light">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section
        aria-labelledby="becoming-contact"
        className="rounded-xl border border-amber-500/30 bg-white p-8 text-center shadow-sm"
      >
        <h2 id="becoming-contact" className="text-2xl font-serif text-slate-900 mb-3">
          Start the conversation
        </h2>
        <p className="mx-auto mb-6 max-w-xl leading-relaxed text-slate-600 font-light">
          Contact Carleton Lodge directly, or use the Grand Lodge of Canada in the
          Province of Ontario&rsquo;s official inquiry form — a local Mason will be in
          touch either way.
        </p>
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            to="/contact"
            className="inline-flex items-center space-x-2 rounded-md bg-amber-600 px-8 py-3 font-semibold text-white shadow-lg transition-all hover:bg-amber-700"
          >
            <span>Contact Carleton Lodge</span>
            <ArrowRight size={18} />
          </Link>
          <a
            href={GRAND_LODGE_BECOMING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-2 rounded-md border-2 border-slate-300 px-8 py-3 font-medium text-slate-700 transition-colors hover:border-amber-600 hover:text-amber-800"
          >
            <span>Grand Lodge inquiry form</span>
            <ExternalLink size={16} aria-hidden="true" />
          </a>
        </div>
        <p className="mt-6 text-sm text-slate-500">
          New to Freemasonry entirely? Read our <Link to="/freemasonry" className="text-amber-700 underline hover:text-amber-800">introduction to Freemasonry</Link> first.
        </p>
      </section>
    </div>
  </div>
);
