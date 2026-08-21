import { FormEvent, useState } from 'react';
import { CheckCircle2, KeyRound, Mail, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router';
import { supabase } from '../lib/supabase';
import { SUPPORT_EMAIL, supportMailto } from '../lib/contact';

type ActivationStep = 'email' | 'code' | 'password' | 'complete';

const accessCodeMessage =
  'If that email belongs to a Carleton Lodge member account, a six-digit code is on its way.';

export const ActivateMembershipPage = () => {
  const [step, setStep] = useState<ActivationStep>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const normalizedEmail = email.trim().toLowerCase();

  const requestCode = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!normalizedEmail) {
      setError('Enter the personal email address recorded on the Lodge roster.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    const { error: requestError } = await supabase.functions.invoke(
      'request-member-access-code',
      { body: { email: normalizedEmail, intent: 'activation' } },
    );
    setLoading(false);

    if (requestError) {
      setError('We could not send a code right now. Please wait a few minutes and try again.');
      return;
    }

    setStep('code');
    setMessage(accessCodeMessage);
  };

  const verifyCode = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedCode = code.replace(/\D/g, '').slice(0, 6);
    if (normalizedCode.length !== 6) {
      setError('Enter the complete six-digit code from your email.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    const { error: verificationError } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: normalizedCode,
      type: 'email',
    });

    if (verificationError) {
      setLoading(false);
      setError('That code is incorrect or has expired. Request a new code and try again.');
      return;
    }

    const { data: completionData, error: completionError } = await supabase.functions.invoke(
      'complete-member-activation',
      { body: {} },
    );
    setLoading(false);

    if (completionError) {
      setError('You are signed in, but we could not finish recording the activation. Please contact Lodge support.');
      return;
    }

    setStep('password');
    const mailboxReady = completionData?.mailboxReady === true;
    const lodgeEmail = typeof completionData?.lodgeEmail === 'string' ? completionData.lodgeEmail : '';
    setMessage(mailboxReady
      ? `Your membership is active, and your personal Lodge mailbox${lodgeEmail ? ` (${lodgeEmail})` : ''} is ready for setup in My Lodge. You can choose a website password now or continue using emailed sign-in codes.`
      : 'Your membership is active. Your personal Lodge mailbox is still being prepared, and Lodge administration can safely retry it without repeating this activation. You can choose a website password now or continue using emailed sign-in codes.');
  };

  const savePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 8) {
      setError('Your password must contain at least 8 characters.');
      return;
    }
    if (password !== confirmation) {
      setError('The two passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');
    const { error: passwordError } = await supabase.functions.invoke(
      'change-required-password',
      { body: { password } },
    );
    setLoading(false);

    if (passwordError) {
      setError('We could not save that password. Try another password or continue with emailed codes.');
      return;
    }

    setPassword('');
    setConfirmation('');
    setStep('complete');
    setMessage('Your password has been saved and your Lodge membership is ready to use.');
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 pb-16 pt-28 sm:pt-32">
      <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b-4 border-amber-600 bg-slate-950 px-6 py-8 text-white sm:px-10">
          <div className="flex items-center gap-3 text-amber-300">
            <ShieldCheck size={27} aria-hidden="true" />
            <span className="text-sm font-bold uppercase tracking-[0.16em]">Secure member access</span>
          </div>
          <h1 className="mt-4 text-4xl font-serif sm:text-5xl">Activate Your Membership</h1>
          <p className="mt-3 max-w-xl text-lg leading-relaxed text-slate-200">
            Start whenever you are ready. The website sends a fresh one-time code while you are completing these steps.
          </p>
        </div>

        <div className="px-6 py-8 sm:px-10 sm:py-10">
          <ol className="mb-8 grid grid-cols-3 gap-2 text-center text-xs font-semibold sm:text-sm" aria-label="Activation progress">
            {['Email', 'Verify', 'Sign-in choice'].map((label, index) => {
              const activeIndex = step === 'email' ? 0 : step === 'code' ? 1 : 2;
              return (
                <li
                  key={label}
                  className={`rounded-full px-2 py-2 ${index <= activeIndex ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-500'}`}
                >
                  {index + 1}. {label}
                </li>
              );
            })}
          </ol>

          {step === 'email' && (
            <form onSubmit={requestCode} className="space-y-5">
              <div>
                <h2 className="text-2xl font-serif text-slate-900">Enter your personal email</h2>
                <p className="mt-2 text-base leading-relaxed text-slate-600">
                  Use the address recorded on the Carleton Lodge roster. Lodge email addresses are separate from website access.
                </p>
              </div>
              <div>
                <label htmlFor="activation-email" className="mb-1 block text-base font-semibold text-slate-800">Email address</label>
                <input
                  id="activation-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  maxLength={254}
                  className="min-h-12 w-full rounded-lg border border-slate-400 px-4 text-base outline-none focus:ring-2 focus:ring-slate-900"
                  required
                />
              </div>
              <button type="submit" disabled={loading} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-base font-semibold text-amber-300 disabled:opacity-60">
                <Mail size={19} aria-hidden="true" /> {loading ? 'Sending…' : 'Email My Activation Code'}
              </button>
            </form>
          )}

          {step === 'code' && (
            <form onSubmit={verifyCode} className="space-y-5">
              <div>
                <h2 className="text-2xl font-serif text-slate-900">Check your email</h2>
                <p className="mt-2 text-base leading-relaxed text-slate-600">
                  Enter the six-digit code sent to <strong>{normalizedEmail}</strong>. It can only be used once.
                </p>
              </div>
              <div>
                <label htmlFor="activation-code" className="mb-1 block text-base font-semibold text-slate-800">Six-digit code</label>
                <input
                  id="activation-code"
                  type="text"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  className="min-h-14 w-full rounded-lg border border-slate-400 px-4 text-center text-3xl font-bold tracking-[0.4em] outline-none focus:ring-2 focus:ring-slate-900"
                  required
                />
              </div>
              <button type="submit" disabled={loading} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-base font-semibold text-amber-300 disabled:opacity-60">
                <KeyRound size={19} aria-hidden="true" /> {loading ? 'Verifying…' : 'Verify My Code'}
              </button>
              <div className="grid gap-2 sm:grid-cols-2">
                <button type="button" disabled={loading} onClick={() => void requestCode()} className="min-h-11 rounded-lg border border-slate-300 px-4 font-semibold text-blue-900 disabled:opacity-60">Send another code</button>
                <button type="button" onClick={() => { setStep('email'); setCode(''); setError(''); setMessage(''); }} className="min-h-11 rounded-lg px-4 font-semibold text-blue-900 underline underline-offset-4">Use a different email</button>
              </div>
            </form>
          )}

          {step === 'password' && (
            <form onSubmit={savePassword} className="space-y-5">
              <div>
                <h2 className="text-2xl font-serif text-slate-900">How would you like to sign in?</h2>
                <p className="mt-2 text-base leading-relaxed text-slate-600">
                  You may create a password now, or skip this step and request a six-digit email code whenever you sign in.
                </p>
              </div>
              <div>
                <label htmlFor="activation-password" className="mb-1 block text-base font-semibold text-slate-800">New password</label>
                <input id="activation-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={8} maxLength={128} className="min-h-12 w-full rounded-lg border border-slate-400 px-4 text-base outline-none focus:ring-2 focus:ring-slate-900" />
                <p className="mt-1 text-sm text-slate-500">At least 8 characters. Do not reuse a password from another website.</p>
              </div>
              <div>
                <label htmlFor="activation-password-confirmation" className="mb-1 block text-base font-semibold text-slate-800">Type it again</label>
                <input id="activation-password-confirmation" type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" minLength={8} maxLength={128} className="min-h-12 w-full rounded-lg border border-slate-400 px-4 text-base outline-none focus:ring-2 focus:ring-slate-900" />
              </div>
              <button type="submit" disabled={loading} className="min-h-12 w-full rounded-lg bg-slate-900 px-5 py-3 text-base font-semibold text-amber-300 disabled:opacity-60">{loading ? 'Saving…' : 'Save My Password'}</button>
              <Link to="/my-lodge" className="flex min-h-12 w-full items-center justify-center rounded-lg border border-slate-300 px-5 py-3 text-center text-base font-semibold text-blue-900">Skip Password — Use Email Codes</Link>
            </form>
          )}

          {step === 'complete' && (
            <div className="text-center">
              <CheckCircle2 className="mx-auto text-emerald-600" size={52} aria-hidden="true" />
              <h2 className="mt-4 text-3xl font-serif text-slate-900">Your membership is active</h2>
              <p className="mx-auto mt-3 max-w-lg text-base leading-relaxed text-slate-600">You can now use the members&apos; calendar, summons, directory, documents, and other Lodge resources.</p>
              <Link to="/my-lodge" className="mt-7 inline-flex min-h-12 items-center rounded-lg bg-slate-900 px-7 py-3 font-semibold text-amber-300">Enter My Lodge</Link>
            </div>
          )}

          <div aria-live="polite" aria-atomic="true" className="mt-5">
            {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
            {message && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}
          </div>

          <div className="mt-8 border-t border-slate-200 pt-6 text-center text-sm leading-relaxed text-slate-600">
            <p>Already activated? <Link to="/my-lodge" className="font-semibold text-blue-900 underline">Go to member sign in</Link>.</p>
            <p className="mt-2">Need help? Email <a href={supportMailto('Help activating my Lodge membership')} className="font-semibold text-blue-900 underline">{SUPPORT_EMAIL}</a>.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
