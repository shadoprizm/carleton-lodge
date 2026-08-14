import { LoaderCircle } from 'lucide-react';
import { useEffect } from 'react';
import { Navigate, useParams } from 'react-router';
import { findExternalWebsiteResource } from '../lib/externalLinks';
import { SUPABASE_URL } from '../lib/supabase';

export const ExternalLinkOpenPage = () => {
  const { resourceId = '' } = useParams();
  const resource = findExternalWebsiteResource(resourceId);

  useEffect(() => {
    if (!resource) return;
    window.location.replace(`${SUPABASE_URL}/functions/v1/check-external-link?resource=${encodeURIComponent(resource.id)}`);
  }, [resource]);

  if (!resource) return <Navigate to="/links" replace />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 pb-16 pt-28 text-center">
      <div className="max-w-xl" role="status" aria-live="polite">
        <LoaderCircle className="mx-auto animate-spin text-amber-700" size={38} aria-hidden="true" />
        <p className="mt-5 text-sm font-bold uppercase tracking-[0.2em] text-amber-700">Checking external website</p>
        <h1 className="mt-3 text-4xl font-serif text-slate-900">Opening {resource.name}</h1>
        <p className="mt-4 text-lg leading-relaxed text-slate-600">Please wait while Carleton Lodge confirms that the external website is available.</p>
      </div>
    </div>
  );
};
