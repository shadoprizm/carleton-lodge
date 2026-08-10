import { useState } from 'react';
import { Lock, LogOut } from 'lucide-react';
import { useLocation } from 'react-router';
import { useAuth } from '../contexts/AuthContext';

export const ForcePasswordChangeModal = () => {
  const { profile, completeRequiredPasswordChange, signOut } = useAuth();
  const location = useLocation();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!profile?.force_password_change || location.pathname === '/reset-password') return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error } = await completeRequiredPasswordChange(password);
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-7 shadow-2xl">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-lg bg-slate-900 p-2">
            <Lock size={20} className="text-amber-300" />
          </div>
          <div>
            <h2 className="text-xl font-serif text-slate-900">Change Your Password</h2>
            <p className="text-sm text-slate-500">Choose a password for your lodge account before continuing.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="new-password" className="mb-1 block text-sm font-medium text-slate-700">
              New Password
            </label>
            <input
              id="new-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
            />
            <p className="mt-1 text-xs text-slate-500">
              Use at least 8 characters and avoid your name, email, or a common password.
            </p>
          </div>

          <div>
            <label htmlFor="confirm-new-password" className="mb-1 block text-sm font-medium text-slate-700">
              Confirm Password
            </label>
            <input
              id="confirm-new-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => signOut()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              <LogOut size={15} />
              Sign Out
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-amber-300 transition-colors hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? 'Saving...' : 'Save Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
