import { FlaskConical, LockKeyhole } from 'lucide-react';
import { ReactNode } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../contexts/AuthContext';

export const LodgeGuidePilotGate = ({ children }: { children: ReactNode }) => {
  const { isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 pb-16 pt-32 text-center">
        <p className="text-base text-slate-600" role="status">Checking pilot access…</p>
      </div>
    );
  }

  if (isAdmin) return children;

  return (
    <div className="min-h-screen bg-slate-50 px-4 pb-16 pt-32">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-10">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-800">
          <LockKeyhole size={30} />
        </div>
        <p className="flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-[0.16em] text-amber-800">
          <FlaskConical size={17} /> Administrator pilot
        </p>
        <h1 className="mt-3 text-3xl font-serif text-slate-900">Lodge Guide is being tested</h1>
        <p className="mx-auto mt-3 max-w-md text-lg leading-relaxed text-slate-600">
          The Lodge Guide is currently available only to the website administrator. It will appear here for members after its accuracy and privacy checks are complete.
        </p>
        <Link
          to="/my-lodge"
          className="mt-7 inline-flex min-h-12 items-center justify-center rounded-lg bg-slate-900 px-7 py-3 text-base font-semibold text-amber-300"
        >
          Return to My Lodge
        </Link>
      </div>
    </div>
  );
};

