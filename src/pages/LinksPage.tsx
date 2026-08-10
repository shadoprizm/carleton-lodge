import { BookOpen, ExternalLink, Landmark, Users } from 'lucide-react';

const resourceGroups = [
  {
    title: 'Grand Lodge & Ontario Resources',
    icon: Landmark,
    links: [
      { name: 'Grand Lodge of Canada in the Province of Ontario', description: 'Official Ontario Grand Lodge information, membership information, and lodge finder.', url: 'https://ontariomasons.ca/' },
      { name: 'Grand Lodge Library', description: 'Library, archives, and research resources.', url: 'https://grandlodgelibrary.ca/' },
      { name: 'Masonic Foundation of Ontario', description: 'Provincial charitable programs and community support.', url: 'https://themasonicfoundationofontario.ca/' },
    ],
  },
  {
    title: 'Ottawa-Area Masonry',
    icon: Users,
    links: [
      { name: 'Ottawa District 1', description: 'District news, lodges, officers, resources, and events. Carleton Lodge is part of Ottawa District 1.', url: 'https://www.ottawadistrict1masons.ca/' },
      { name: 'Ottawa District 2', description: 'Neighbouring district information, lodge directory, and regional events.', url: 'https://www.ottawamasons.ca/' },
      { name: 'Ottawa Masonic Association', description: 'Information and coordination across Ottawa-area Freemasonry.', url: 'https://www.ottawamasonicassociation.com/' },
    ],
  },
  {
    title: 'Concordant & Appendant Bodies',
    icon: BookOpen,
    links: [
      { name: 'Royal Arch Masonry — District 13', description: 'Royal Arch chapters and information in Eastern Ontario.', url: 'https://www.ramdistrict13.ca/' },
      { name: 'Scottish Rite — Valley of Ottawa', description: 'Ottawa Valley Scottish Rite information and activities.', url: 'https://ottawavalleyscottishrite.com/' },
      { name: 'Tunis Shriners', description: 'Ottawa-area Shriners information, philanthropy, and contact details.', url: 'https://tunisshriners.ca/' },
    ],
  },
];

export const LinksPage = () => (
  <div className="min-h-screen bg-slate-50 pb-16 pt-20">
    <section className="bg-slate-950 px-4 py-12 text-center text-white">
      <h1 className="text-4xl font-serif sm:text-5xl">Trusted Masonic Links</h1>
      <p className="mx-auto mt-3 max-w-2xl text-lg leading-relaxed text-slate-200">Verified starting points for Grand Lodge, Ottawa districts, education, charity, and related Masonic bodies.</p>
    </section>
    <div className="mx-auto max-w-5xl space-y-9 px-4 py-10 sm:px-6">
      {resourceGroups.map(({ title, icon: Icon, links }) => (
        <section key={title} aria-labelledby={`links-${title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`}>
          <div className="mb-4 flex items-center gap-3"><span className="rounded-lg bg-amber-100 p-2 text-amber-800"><Icon size={22} /></span><h2 id={`links-${title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`} className="text-2xl font-serif text-slate-900">{title}</h2></div>
          <div className="grid gap-4 md:grid-cols-2">
            {links.map((link) => (
              <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="group flex min-h-32 items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900">
                <span><span className="block text-lg font-semibold text-slate-900 group-hover:text-amber-800">{link.name}</span><span className="mt-2 block text-sm leading-relaxed text-slate-600">{link.description}</span></span>
                <ExternalLink className="mt-1 shrink-0 text-slate-400" size={19} aria-hidden="true" />
              </a>
            ))}
          </div>
        </section>
      ))}
      <p className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm leading-relaxed text-blue-950"><strong>External website note:</strong> These organizations maintain their own content and privacy practices. If a link stops working, please tell the Lodge Secretary so this directory can be corrected.</p>
    </div>
  </div>
);
