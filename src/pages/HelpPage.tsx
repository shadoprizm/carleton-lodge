import { useEffect, useState } from 'react';
import { ArrowRight, CircleHelp, Mail } from 'lucide-react';
import { Link } from 'react-router';
import { HelpTopic, supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { supportMailto } from '../lib/contact';

export const HelpPage = () => {
  const { user } = useAuth();
  const [topics, setTopics] = useState<HelpTopic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase.from('help_topics').select('*').order('display_order');
      if (active) {
        setTopics((data as HelpTopic[] | null) ?? []);
        setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [user?.id]);

  const categories = Array.from(new Set(topics.map((topic) => topic.category)));

  return (
    <div className="min-h-screen bg-slate-50 pb-16 pt-20">
      <section className="bg-slate-950 px-4 py-12 text-center text-white">
        <CircleHelp className="mx-auto text-amber-300" size={42} />
        <h1 className="mt-4 text-4xl font-serif sm:text-5xl">Help & Information</h1>
        <p className="mx-auto mt-3 max-w-2xl text-lg leading-relaxed text-slate-200">Clear instructions for the questions members ask most often.</p>
        <Link to="/search" className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-lg bg-amber-500 px-6 font-bold text-slate-950">Search all lodge information <ArrowRight size={18} /></Link>
      </section>
      <div className="mx-auto max-w-4xl px-4 py-9 sm:px-6">
        {loading ? <p className="py-10 text-center text-slate-600" role="status">Loading help…</p> : categories.map((category) => (
          <section key={category} className="mb-9" aria-labelledby={`help-${category.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`}>
            <h2 id={`help-${category.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`} className="mb-4 text-2xl font-serif text-slate-900">{category}</h2>
            <div className="space-y-3">
              {topics.filter((topic) => topic.category === category).map((topic) => (
                <details key={topic.id} className="group rounded-xl border border-slate-200 bg-white">
                  <summary className="min-h-14 cursor-pointer list-none px-5 py-4 text-lg font-semibold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900">{topic.title}</summary>
                  <div className="border-t border-slate-100 px-5 py-5">
                    <p className="text-base leading-relaxed text-slate-700">{topic.body}</p>
                    <Link to={topic.url} className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold text-blue-900 underline underline-offset-4">Go to this information <ArrowRight size={17} /></Link>
                  </div>
                </details>
              ))}
            </div>
          </section>
        ))}
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
          <Mail className="mx-auto text-amber-800" size={28} />
          <h2 className="mt-3 text-2xl font-serif text-slate-900">Would you prefer help from a person?</h2>
          <p className="mt-2 text-base text-slate-700">Email us and someone from the lodge will help you.</p>
          <a href={supportMailto('Website help')} className="mt-5 inline-flex min-h-12 items-center rounded-lg bg-slate-900 px-6 font-semibold text-amber-300">Email for Help</a>
        </section>
      </div>
    </div>
  );
};
