import { LockKeyhole, Mail } from 'lucide-react';
import { ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supportMailto } from '../lib/contact';

interface MemberGateProps {
  children: ReactNode;
  onSignIn: () => void;
  title?: string;
}

export const MemberGate = ({ children, onSignIn, title = 'Member information' }: MemberGateProps) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 pb-16 pt-32 text-center">
        <p className="text-base text-slate-600" role="status">Checking your lodge account…</p>
      </div>
    );
  }

  if (user) return children;

  return (
    <div className="min-h-screen bg-slate-50 px-4 pb-16 pt-32">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-10">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-800">
          <LockKeyhole size={30} />
        </div>
        <h1 className="text-3xl font-serif text-slate-900">{title} is for lodge members</h1>
        <p className="mx-auto mt-3 max-w-md text-lg leading-relaxed text-slate-600">
          Sign in with your lodge account to continue. You can use your password or ask us to email you a one-time sign-in link.
        </p>
        <button
          type="button"
          onClick={onSignIn}
          className="mt-7 min-h-12 rounded-lg bg-slate-900 px-7 py-3 text-base font-semibold text-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
        >
          Sign In to Continue
        </button>
        <div className="mt-7 border-t border-slate-200 pt-6">
          <p className="text-base text-slate-600">Need an account or help signing in?</p>
          <a
            href={supportMailto('Help with my lodge account')}
            className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-md px-3 font-semibold text-blue-900 underline underline-offset-4"
          >
            <Mail size={18} />
            Email us for help
          </a>
        </div>
      </div>
    </div>
  );
};
