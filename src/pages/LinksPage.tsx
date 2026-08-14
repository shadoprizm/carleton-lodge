import { BookOpen, ExternalLink, Landmark, Mail, Users } from 'lucide-react';
import { externalLinkResources, type ExternalLinkGroup } from '../lib/externalLinks';

const resourceGroups = [
  {
    id: 'grand-lodge' as ExternalLinkGroup,
    title: 'Grand Lodge & Ontario Resources',
    icon: Landmark,
  },
  {
    id: 'ottawa-area' as ExternalLinkGroup,
    title: 'Ottawa-Area Masonry',
    icon: Users,
  },
  {
    id: 'concordant' as ExternalLinkGroup,
    title: 'Concordant & Appendant Bodies',
    icon: BookOpen,
  },
];

export const LinksPage = () => (
  <div className="min-h-screen bg-slate-50 pb-16 pt-20">
    <section className="bg-slate-950 px-4 py-12 text-center text-white">
      <h1 className="text-4xl font-serif sm:text-5xl">Trusted Masonic Links</h1>
      <p className="mx-auto mt-3 max-w-2xl text-lg leading-relaxed text-slate-200">Verified starting points for Grand Lodge, Ottawa districts, education, charity, and related Masonic bodies.</p>
    </section>
    <div className="mx-auto max-w-5xl space-y-9 px-4 py-10 sm:px-6">
      {resourceGroups.map(({ id, title, icon: Icon }) => (
        <section key={title} aria-labelledby={`links-${title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`}>
          <div className="mb-4 flex items-center gap-3"><span className="rounded-lg bg-amber-100 p-2 text-amber-800"><Icon size={22} /></span><h2 id={`links-${title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`} className="text-2xl font-serif text-slate-900">{title}</h2></div>
          <div className="grid gap-4 md:grid-cols-2">
            {externalLinkResources.filter((link) => link.group === id).map((link) => {
              const isEmail = link.kind === 'email';
              const LinkIcon = isEmail ? Mail : ExternalLink;
              const href = isEmail ? link.url : `/links/open/${encodeURIComponent(link.id)}`;

              return (
                <a key={link.id} href={href} target={isEmail ? undefined : '_blank'} rel={isEmail ? undefined : 'noopener noreferrer'} className="group flex min-h-32 items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900">
                  <span><span className="block text-lg font-semibold text-slate-900 group-hover:text-amber-800">{link.name}</span><span className="mt-2 block text-sm leading-relaxed text-slate-600">{link.description}</span></span>
                  <LinkIcon className="mt-1 shrink-0 text-slate-400" size={19} aria-hidden="true" />
                </a>
              );
            })}
          </div>
        </section>
      ))}
      <p className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm leading-relaxed text-blue-950"><strong>External website note:</strong> These organizations maintain their own content and privacy practices. The Lodge checks website availability before sending you onward and reports each broken link to the webmaster only once.</p>
    </div>
  </div>
);
