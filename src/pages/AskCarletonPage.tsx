import { FormEvent, useRef, useState } from 'react';
import { ArrowRight, BookOpenCheck, Bot, Mail, Send, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router';
import { supabase } from '../lib/supabase';
import { supportMailto } from '../lib/contact';
import { cleanLodgeGuideAnswer } from '../lib/lodgeGuide';

type Citation = {
  number: number;
  title: string;
  source_type: string;
  url: string;
  updated_at: string;
};

type Answer = {
  question: string;
  answer: string;
  citations: Citation[];
  needs_human: boolean;
  suggested_follow_up: string | null;
};

const starters = [
  'When is the next lodge event?',
  'Where can I find the latest summons?',
  'How do I change my email notifications?',
  'What is the Lodge Secretary’s contact information?',
  'What Ottawa District 1 lodges are doing a third degree next month?',
  'When is the next meeting of Russell Lodge?',
];

export const AskCarletonPage = () => {
  const [question, setQuestion] = useState('');
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const responseHeadingRef = useRef<HTMLHeadingElement>(null);

  const ask = async (submittedQuestion: string) => {
    const cleanQuestion = submittedQuestion.trim();
    if (cleanQuestion.length < 3 || loading) return;
    setLoading(true);
    setError('');
    const { data, error: functionError } = await supabase.functions.invoke('ask-carleton', {
      body: { question: cleanQuestion },
    });
    setLoading(false);

    if (functionError) {
      const response = (functionError as { context?: unknown }).context;
      if (response instanceof Response && response.status === 429) {
        setError('The hourly question limit has been reached. Please try again later or email Lodge Support.');
      } else {
        setError('Lodge Guide is temporarily unavailable. Site search and human help are still available.');
      }
      return;
    }

    const result = data as Omit<Answer, 'question'>;
    setAnswers((current) => [...current, { ...result, question: cleanQuestion }]);
    setQuestion('');
    window.setTimeout(() => responseHeadingRef.current?.focus(), 0);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void ask(question);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-16 pt-20">
      <section className="bg-slate-950 px-4 py-11 text-white">
        <div className="mx-auto max-w-4xl">
          <div className="flex flex-wrap items-center gap-3 text-amber-300"><Bot size={30} /><span className="text-sm font-semibold uppercase tracking-[0.2em]">Member information assistant</span><span className="rounded-full border border-amber-300/50 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em]">Administrator pilot</span></div>
          <h1 className="mt-3 text-4xl font-serif sm:text-5xl">Lodge Guide</h1>
          <p className="mt-3 max-w-3xl text-lg leading-relaxed text-slate-200">Ask a plain-language question about approved lodge information. Every factual answer must link to its source.</p>
          <div className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
            <p className="flex items-start gap-2 rounded-lg bg-white/5 p-3"><BookOpenCheck className="mt-0.5 shrink-0 text-amber-300" size={19} /><span><strong className="text-white">Read-only and source-grounded.</strong> It cannot change events, records, or accounts.</span></p>
            <p className="flex items-start gap-2 rounded-lg bg-white/5 p-3"><ShieldCheck className="mt-0.5 shrink-0 text-amber-300" size={19} /><span><strong className="text-white">Member permissions apply.</strong> It only retrieves information your account can view.</span></p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-relaxed text-blue-950">
          <strong>You are testing the Lodge Guide before member release.</strong> Try ordinary questions, unclear questions, and requests it should decline. Confirm that each factual answer is supported by the source it cites.
        </div>

        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
          <strong>Please do not enter private, financial, medical, ritual, password, or recognition information.</strong> Lodge records can be incomplete or out of date, and AI can interpret them incorrectly. Confirm important details using the cited source.
        </div>

        {answers.length === 0 && (
          <section aria-labelledby="ask-starters-heading" className="mt-7">
            <h2 id="ask-starters-heading" className="text-xl font-serif text-slate-900">Try one of these questions</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {starters.map((starter) => <button key={starter} type="button" onClick={() => void ask(starter)} className="min-h-14 rounded-xl border border-slate-200 bg-white p-4 text-left font-medium text-slate-800 shadow-sm hover:border-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900">{starter}</button>)}
            </div>
          </section>
        )}

        <div className="mt-7 space-y-6" aria-live="polite">
          {answers.map((item, index) => (
            <article key={`${item.question}-${index}`} className="space-y-3">
              <div className="ml-auto max-w-2xl rounded-2xl rounded-br-sm bg-blue-900 p-4 text-base text-white"><p className="text-xs font-semibold uppercase tracking-wide text-blue-200">You asked</p><p className="mt-1">{item.question}</p></div>
              <div className="max-w-3xl rounded-2xl rounded-bl-sm border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 ref={index === answers.length - 1 ? responseHeadingRef : undefined} tabIndex={-1} className="text-sm font-bold uppercase tracking-wide text-amber-800 outline-none">Lodge Guide</h2>
                <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed text-slate-800">{cleanLodgeGuideAnswer(item.answer)}</p>
                {item.citations.length > 0 && (
                  <div className="mt-5 border-t border-slate-200 pt-4">
                    <h3 className="text-sm font-bold text-slate-900">Sources used</h3>
                    <ul className="mt-2 space-y-2">
                      {item.citations.map((citation) => <li key={`${citation.number}-${citation.url}`}><Link to={citation.url} className="inline-flex min-h-11 items-center gap-2 font-semibold text-blue-900 underline underline-offset-4"><span aria-hidden="true">[{citation.number}]</span>{citation.title}<ArrowRight size={16} /></Link></li>)}
                    </ul>
                  </div>
                )}
                <p className="mt-4 border-t border-slate-100 pt-4 text-xs leading-relaxed text-slate-500">Information can be incomplete or out of date. Check the cited source before relying on this answer.</p>
                {item.needs_human && <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4"><p className="font-semibold text-amber-950">A person should confirm this.</p><a href={supportMailto(`Question for the Lodge Secretary: ${item.question}`)} className="mt-2 inline-flex min-h-11 items-center gap-2 font-semibold text-blue-900 underline underline-offset-4"><Mail size={17} />Email Lodge Support</a></div>}
                {item.suggested_follow_up && <button type="button" onClick={() => setQuestion(item.suggested_follow_up ?? '')} className="mt-4 min-h-11 text-left font-medium text-blue-900 underline underline-offset-4">Suggested follow-up: {item.suggested_follow_up}</button>}
              </div>
            </article>
          ))}
        </div>

        {error && <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900"><p>{error}</p><div className="mt-3 flex flex-wrap gap-3"><Link to="/search" className="font-semibold underline">Use site search</Link><a href={supportMailto('Help with a lodge question')} className="font-semibold underline">Email for help</a></div></div>}

        <form onSubmit={submit} className="sticky bottom-3 mt-8 rounded-2xl border border-slate-300 bg-white p-3 shadow-xl" aria-label="Ask Lodge Guide a question">
          <label htmlFor="ask-carleton-question" className="sr-only">Your lodge question</label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <textarea id="ask-carleton-question" rows={2} value={question} onChange={(event) => setQuestion(event.target.value)} minLength={3} maxLength={500} placeholder="Ask a question about lodge information…" className="min-h-14 flex-1 resize-none rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:ring-2 focus:ring-slate-900" required />
            <button type="submit" disabled={loading || question.trim().length < 3} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 font-semibold text-amber-300 disabled:opacity-50"><Send size={19} />{loading ? 'Checking sources…' : 'Ask'}</button>
          </div>
        </form>
        <p className="mt-3 text-center text-xs text-slate-500">Questions and retrieved lodge sources are sent to OpenAI to generate an answer. Answers are not automatically saved to lodge records.</p>
      </div>
    </div>
  );
};
