import { Link } from 'react-router';
import { Mail, MapPin } from 'lucide-react';
import { SUPPORT_EMAIL, supportMailto } from '../lib/contact';

const FacebookIcon = ({ size = 20 }: { size?: number }) => (
  <svg
    aria-hidden="true"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.49-3.91 3.77-3.91 1.09 0 2.23.2 2.23.2v2.46h-1.25c-1.24 0-1.62.77-1.62 1.56v1.9h2.76l-.44 2.91h-2.32V22C18.34 21.24 22 17.08 22 12.06Z" />
  </svg>
);

const exploreLinks = [
  { label: 'Our History', path: '/history' },
  { label: 'Photo Gallery', path: '/gallery' },
  { label: 'Calendar', path: '/calendar' },
  { label: 'Masonic Links', path: '/links' },
  { label: 'Contact', path: '/contact' },
  { label: 'Help', path: '/help' },
];

const mapsUrl =
  'https://www.google.com/maps/search/?api=1&query=3704+Carp+Road,+Carp,+ON+K0A+1L0';

const linkClass =
  'text-amber-50/70 hover:text-amber-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/80 rounded';

export const Footer = () => {
  return (
    <footer className="border-t border-amber-500/25 bg-slate-950 text-amber-50">
      <div className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-3">
              <img
                src="/logo-mark.webp"
                alt=""
                decoding="async"
                className="h-12 w-12 flex-shrink-0 object-contain"
              />
              <span className="block leading-tight">
                <span className="block whitespace-nowrap font-serif text-[1.05rem] text-amber-100">
                  Carleton Lodge
                </span>
                <span className="mt-0.5 block whitespace-nowrap text-[0.6rem] font-semibold uppercase tracking-[0.24em] text-amber-400/75">
                  No. 465 · Carp, Ontario
                </span>
              </span>
            </div>
            <p className="mt-5 max-w-xs text-sm leading-6 text-amber-50/60 font-light">
              A.F. &amp; A.M., Grand Lodge of Canada in the Province of Ontario.
              Warranted 1904.
            </p>
            <a
              href="https://ontariomasons.ca/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-block rounded-lg bg-white/90 px-3 py-2 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/80"
            >
              <img
                src="/ontario-masons-logo.png"
                alt="Ontario Masons — Grand Lodge of Canada in the Province of Ontario"
                className="h-8 object-contain"
              />
            </a>
          </div>

          <nav aria-label="Footer">
            <h2 className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-amber-400/70">
              Explore
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm font-light">
              {exploreLinks.map((item) => (
                <li key={item.path}>
                  <Link to={item.path} className={linkClass}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-amber-400/70">
              Visit &amp; Contact
            </h2>
            <ul className="mt-4 space-y-4 text-sm font-light">
              <li>
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-3"
                >
                  <MapPin size={18} className="mt-0.5 flex-shrink-0 text-amber-400" aria-hidden="true" />
                  <span className="text-amber-50/70 group-hover:text-amber-100 transition-colors">
                    3704 Carp Road<br />
                    Carp, Ontario
                    <span className="mt-1 block text-xs text-amber-400/70 group-hover:text-amber-300 transition-colors">
                      Get directions
                    </span>
                  </span>
                </a>
              </li>
              <li>
                <a href={supportMailto()} className="group flex items-start gap-3">
                  <Mail size={18} className="mt-0.5 flex-shrink-0 text-amber-400" aria-hidden="true" />
                  <span className="text-amber-50/70 group-hover:text-amber-100 transition-colors">
                    {SUPPORT_EMAIL}
                  </span>
                </a>
              </li>
              <li>
                <a
                  href="https://www.facebook.com/CarletonLodge465"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-amber-400/35 bg-amber-400/5 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-amber-100/90 transition-colors hover:border-amber-400/55 hover:bg-amber-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/80"
                >
                  <FacebookIcon size={16} />
                  <span>Follow us on Facebook</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center gap-4 border-t border-white/10 pt-6 text-xs font-light text-amber-50/50 md:flex-row md:justify-between">
          <div className="text-center md:text-left">
            <p>
              &copy; {new Date().getFullYear()} Carleton Lodge No. 465. All
              rights reserved.
            </p>
            <p className="mt-1 text-amber-50/40">
              Ancient Free and Accepted Masons of Canada
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/privacy-policy" className={linkClass}>
              Privacy Policy
            </Link>
            <span className="text-white/20" aria-hidden="true">|</span>
            <Link to="/terms-and-conditions" className={linkClass}>
              Terms and Conditions
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
