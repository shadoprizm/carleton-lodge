import { useState } from 'react';
import { CheckCircle2, KeyRound } from 'lucide-react';
import { Link } from 'react-router';
import { useAuth } from '../contexts/AuthContext';

export const ResetPasswordPage = () => {
  const { user, loading: authLoading, completeRequiredPasswordChange } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [complete, setComplete] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    if (password !== confirmation) {
      setError('The two passwords do not match.');
      return;
    }

    setSaving(true);
    const { error: updateError } = await completeRequiredPasswordChange(password);
    setSaving(false);
    if (updateError) {
      setError('We could not update your password. The link may have expired. Request a new link or contact the Secretary.');
      return;
    }

    setPassword('');
    setConfirmation('');
    setComplete(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 pb-16 pt-32">
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
        {authLoading ? (
          <p className="text-center text-base text-slate-600">Checking your secure link…</p>
        ) : !user ? (
          <div className="text-center">
            <KeyRound className="mx-auto mb-4 text-amber-600" size={40} />
            <h1 className="text-3xl font-serif text-slate-900">This link is no longer active</h1>
            <p className="mt-3 text-base leading-relaxed text-slate-600">
              Password-reset links are temporary and can only be used once. Return to the home page and request a new link from Member Sign In.
            </p>
            <Link
              to="/"
              className="mt-6 inline-flex min-h-12 items-center justify-center rounded-lg bg-slate-900 px-6 py-3 font-semibold text-amber-300"
            >
              Return Home
            </Link>
          </div>
        ) : complete ? (
          <div className="text-center" aria-live="polite">
            <CheckCircle2 className="mx-auto mb-4 text-emerald-600" size={44} />
            <h1 className="text-3xl font-serif text-slate-900">Your password has been updated</h1>
            <p className="mt-3 text-base text-slate-600">Your website account is ready. Next, we’ll help you finish setting up your lodge email.</p>
            <Link
              to="/my-lodge/email"
              className="mt-6 inline-flex min-h-12 items-center justify-center rounded-lg bg-slate-900 px-6 py-3 font-semibold text-amber-300"
            >
              Continue to Lodge Email Setup
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-start gap-4">
              <div className="rounded-xl bg-slate-900 p-3 text-amber-300">
                <KeyRound size={25} />
              </div>
              <div>
                <h1 className="text-3xl font-serif text-slate-900">Choose a New Password</h1>
                <p className="mt-1 text-base leading-relaxed text-slate-600">Use a password you do not use on another website.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="reset-new-password" className="mb-1 block text-base font-medium text-slate-800">
                  New password
                </label>
                <input
                  id="reset-new-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  className="min-h-12 w-full rounded-lg border border-slate-400 px-4 text-base outline-none focus:ring-2 focus:ring-slate-900"
                  required
                />
                <p className="mt-1 text-sm text-slate-600">At least 8 characters.</p>
              </div>
              <div>
                <label htmlFor="reset-confirm-password" className="mb-1 block text-base font-medium text-slate-800">
                  Confirm new password
                </label>
                <input
                  id="reset-confirm-password"
                  type="password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  className="min-h-12 w-full rounded-lg border border-slate-400 px-4 text-base outline-none focus:ring-2 focus:ring-slate-900"
                  required
                />
              </div>

              {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}

              <button
                type="submit"
                disabled={saving}
                className="min-h-12 w-full rounded-lg bg-slate-900 px-5 py-3 text-base font-semibold text-amber-300 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save New Password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
