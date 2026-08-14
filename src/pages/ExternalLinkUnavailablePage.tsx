import { ArrowLeft, Home, Link2Off, ShieldCheck } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { findExternalWebsiteResource } from '../lib/externalLinks';

const fallbackResourceName = 'the external website';

export const ExternalLinkUnavailablePage = () => {
  const [searchParams] = useSearchParams();
  const requestedResource = findExternalWebsiteResource(searchParams.get('resource') ?? '');
  const resourceName = requestedResource?.name || fallbackResourceName;
  const notice = searchParams.get('notice');
  const notificationMessage = notice === 'queued'
    ? 'One automatic notification has been queued for the Lodge webmaster. This broken link will not generate another email.'
    : notice === 'existing'
      ? 'The Lodge webmaster has already been notified about this link. This visit did not generate another email.'
      : notice === 'unavailable'
        ? 'The automatic webmaster notification could not be queued. Please contact the Lodge if the problem continues.'
        : 'When a broken link is first detected, the Lodge webmaster receives one automatic notification. Later visits do not generate more email.';

  return (
    <div className="min-h-screen bg-slate-50 pb-16 pt-20">
      <section className="bg-slate-950 px-4 py-12 text-center text-white">
        <Link2Off className="mx-auto text-amber-300" size={44} aria-hidden="true" />
        <p className="mt-4 text-sm font-bold uppercase tracking-[0.2em] text-amber-300">External website unavailable</p>
        <h1 className="mx-auto mt-3 max-w-3xl text-4xl font-serif sm:text-5xl">That external link does not appear to be working</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-slate-200">
          We are sorry, but {resourceName} is not available right now.
        </p>
      </section>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8" aria-labelledby="what-happens-next">
          <ShieldCheck className="text-blue-900" size={34} aria-hidden="true" />
          <h2 id="what-happens-next" className="mt-4 text-3xl font-serif text-slate-900">What happens next?</h2>
          <div className="mt-4 space-y-4 text-base leading-relaxed text-slate-700">
            <p>Carleton Lodge does not own or maintain this external website, so we cannot repair it directly.</p>
            <p>{notificationMessage}</p>
            <p>You can return to our Masonic Links page or continue browsing the Carleton Lodge website.</p>
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/links" className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-slate-900 px-6 font-semibold text-amber-300">
              <ArrowLeft size={18} aria-hidden="true" />
              Return to Masonic Links
            </Link>
            <Link to="/" className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-slate-300 bg-white px-6 font-semibold text-slate-800">
              <Home size={18} aria-hidden="true" />
              Return Home
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};
