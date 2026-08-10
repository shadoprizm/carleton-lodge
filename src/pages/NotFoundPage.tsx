import { CircleHelp, Home, Search } from 'lucide-react';
import { Link } from 'react-router';

export const NotFoundPage = () => (
  <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 pb-16 pt-28">
    <div className="max-w-xl text-center">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-700">Page not found</p>
      <h1 className="mt-3 text-4xl font-serif text-slate-900 sm:text-5xl">We could not find that page</h1>
      <p className="mt-4 text-lg leading-relaxed text-slate-600">The address may be old or mistyped. Choose a reliable starting point below.</p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link to="/" className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-slate-900 px-6 font-semibold text-amber-300"><Home size={18} />Home</Link>
        <Link to="/search" className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-slate-300 bg-white px-6 font-semibold text-slate-800"><Search size={18} />Search</Link>
        <Link to="/help" className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-slate-300 bg-white px-6 font-semibold text-slate-800"><CircleHelp size={18} />Help</Link>
      </div>
    </div>
  </div>
);
