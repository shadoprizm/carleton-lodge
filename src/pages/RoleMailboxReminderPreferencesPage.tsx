import { FormEvent, useEffect, useState } from 'react';
import { BellOff, CheckCircle2, LoaderCircle, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Link } from 'react-router';
import { supportMailto } from '../lib/contact';
import { roleMailboxReminderOptOutTokenFromHash } from '../lib/roleMailboxReminderPreferences';
import { supabase } from '../lib/supabase';

type PreferenceState = 'ready' | 'submitting' | 'complete' | 'error' | 'invalid';

const readPrivateToken = () => roleMailboxReminderOptOutTokenFromHash(window.location.hash);

export const RoleMailboxReminderPreferencesPage = () => {
  const [token] = useState(readPrivateToken);
  const [state, setState] = useState<PreferenceState>(token ? 'ready' : 'invalid');

  useEffect(() => {
    if (!window.location.hash) return;
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  }, []);

  const stopReminders = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || state === 'submitting') return;

    setState('submitting');
    const { data, error } = await supabase.functions.invoke(
      'manage-role-mailbox-reminders',
      { body: { token } },
    );

    if (error || data?.success !== true) {
      setState('error');
      return;
    }
    setState('complete');
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 pb-16 pt-28 sm:pt-32">
      <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b-4 border-amber-600 bg-slate-950 px-6 py-8 text-white sm:px-10">
          <div className="flex items-center gap-3 text-amber-300">
            <ShieldCheck size={27} aria-hidden="true" />
            <span className="text-sm font-bold uppercase tracking-[0.16em]">Private email preference</span>
          </div>
          <h1 className="mt-4 text-4xl font-serif sm:text-5xl">Mailbox Activation Reminders</h1>
        </div>

        <div className="px-6 py-8 sm:px-10 sm:py-10">
          {state === 'complete' ? (
            <section aria-live="polite">
              <CheckCircle2 className="text-emerald-700" size={40} aria-hidden="true" />
              <h2 className="mt-4 text-3xl font-serif text-slate-900">Reminders stopped</h2>
              <p className="mt-3 text-base leading-relaxed text-slate-700">
                You will not receive more automated activation reminders for this officer or functional mailbox assignment.
              </p>
              <p className="mt-3 text-base leading-relaxed text-slate-700">
                The mailbox, assignment, and your Lodge website access have not been changed.
              </p>
              <Link to="/" className="mt-7 inline-flex min-h-12 items-center rounded-lg bg-slate-900 px-6 font-semibold text-amber-300">
                Return to the Lodge website
              </Link>
            </section>
          ) : state === 'invalid' ? (
            <section aria-live="polite">
              <TriangleAlert className="text-amber-700" size={40} aria-hidden="true" />
              <h2 className="mt-4 text-3xl font-serif text-slate-900">This reminder link is unavailable</h2>
              <p className="mt-3 text-base leading-relaxed text-slate-700">
                The private preference token is missing or invalid. No settings were changed.
              </p>
              <a href={supportMailto('Mailbox reminder preference')} className="mt-7 inline-flex min-h-12 items-center rounded-lg border border-slate-300 px-6 font-semibold text-slate-900">
                Contact Lodge support
              </a>
            </section>
          ) : (
            <form onSubmit={stopReminders}>
              <BellOff className="text-blue-900" size={40} aria-hidden="true" />
              <h2 className="mt-4 text-3xl font-serif text-slate-900">Stop future reminders?</h2>
              <p className="mt-3 text-base leading-relaxed text-slate-700">
                Confirming stops future automated activation reminders for this officer or functional mailbox assignment.
              </p>
              <p className="mt-3 text-base leading-relaxed text-slate-700">
                It does not remove the mailbox, decline the assignment, or change your Lodge website access. An administrator can still send a new invitation manually if needed.
              </p>

              {state === 'error' && (
                <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-900" role="alert">
                  We could not save this preference. Please try again or contact Lodge support.
                </div>
              )}

              <div className="mt-7 flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={state === 'submitting'}
                  className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-slate-900 px-6 font-semibold text-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {state === 'submitting' && <LoaderCircle className="animate-spin" size={18} aria-hidden="true" />}
                  {state === 'submitting' ? 'Saving…' : 'Stop these reminders'}
                </button>
                <Link to="/" className="inline-flex min-h-12 items-center rounded-lg border border-slate-300 px-6 font-semibold text-slate-900">
                  Keep reminders
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
