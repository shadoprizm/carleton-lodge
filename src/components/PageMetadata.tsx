import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { LODGE_GUIDE_ENABLED } from '../lib/lodgeGuide';

const defaultDescription = 'Carleton Lodge No. 465 in Carp, West Ottawa. Find current lodge events, history, contact information, and secure member resources.';
const pages = [
  { match: (path: string) => path === '/', title: 'Carleton Lodge No. 465 | Carp, Ontario', description: defaultDescription },
  { match: (path: string) => path === '/calendar', title: 'Lodge Calendar | Carleton Lodge No. 465', description: 'Current Carleton Lodge meetings and events, including status updates, times, locations, directions, and calendar downloads.' },
  { match: (path: string) => path === '/history/founding', title: 'The Founding Years 1903–1920 | Carleton Lodge No. 465', description: 'The dispensation, institution, warrant and consecration of Carleton Lodge No. 465, and its first Lodge room above the Carp Drug Store in the Kidd Block.' },
  { match: (path: string) => path === '/history/fire-and-displacement', title: 'Fire and Displacement 1920–1926 | Carleton Lodge No. 465', description: 'The 20 July 1920 Kidd Block fire and Carleton Lodge\'s years in temporary accommodation: the Orange Hall, the memorial hall effort, and F. C. Russell\'s store.' },
  { match: (path: string) => path === '/history/temple', title: 'From Church to Temple 1925–1930 | Carleton Lodge No. 465', description: 'How the former St. Andrew\'s Presbyterian Church in Carp became the Carleton Lodge Masonic Temple: the $250 transfer, raising the building, and the 1930 dedication.' },
  { match: (path: string) => path === '/history/le-havre', title: 'The Le Havre Connection 1916–1926 | Carleton Lodge No. 465', description: 'La Loge Le Havre de Grâce No. 4, the wartime military Lodge whose furniture and records travelled from France to Carleton Lodge in Carp.' },
  { match: (path: string) => path === '/history/war-and-remembrance', title: 'War and Remembrance | Carleton Lodge No. 465', description: 'Carleton Lodge\'s First World War service, the 1919 memorial tablet unveiled by Sir Sam Hughes, Lt. Calvin Potters Wilson, and the 2016 West Carleton War Memorial.' },
  { match: (path: string) => path === '/history/people', title: 'People of the Lodge | Carleton Lodge No. 465', description: 'Founders, the twelve known charter members, and key figures of Carleton Lodge No. 465 in Carp, Ontario.' },
  { match: (path: string) => path === '/history/gallery', title: 'History Gallery | Carleton Lodge No. 465', description: 'Historical photographs, documents, buildings and artifacts of Carleton Lodge No. 465, presented with clear labels and source credits.' },
  { match: (path: string) => path === '/history/sources', title: 'History Sources & Research | Carleton Lodge No. 465', description: 'The source register and evidence methodology behind the Carleton Lodge history archive, with citations and archival references.' },
  { match: (path: string) => path.startsWith('/history'), title: 'Our History | Carleton Lodge No. 465', description: 'Explore the history of Carleton Lodge No. 465, founded in Carp, Ontario in 1904 — a source-grounded digital archive.' },
  { match: (path: string) => path === '/gallery', title: 'Photo Gallery | Carleton Lodge No. 465', description: 'Public photographs from Carleton Lodge No. 465 and its community.' },
  { match: (path: string) => path === '/links', title: 'Trusted Masonic Links | Carleton Lodge No. 465', description: 'Official Grand Lodge, Ottawa district, educational, charitable, and Masonic body resources.' },
  { match: (path: string) => path === '/links/external-unavailable', title: 'External Link Unavailable | Carleton Lodge No. 465', description: 'Information about a temporarily unavailable external Masonic resource.' },
  { match: (path: string) => path === '/contact', title: 'Contact Carleton Lodge | Carleton Lodge No. 465', description: 'Contact Carleton Lodge No. 465 in Carp, Ontario — questions about Freemasonry, visiting the Lodge, events, or lodge history.' },
  { match: (path: string) => path === '/freemasonry', title: 'What is Freemasonry? | Carleton Lodge No. 465', description: 'An introduction to Freemasonry for the curious — its principles of Brotherly Love, Relief, and Truth, and what Freemasonry is and is not.' },
  { match: (path: string) => path === '/becoming-a-mason', title: 'Becoming a Mason | Carleton Lodge No. 465', description: 'Interested in Freemasonry? Learn who can become a Mason in Ontario and how to start a conversation with Carleton Lodge No. 465 in Carp.' },
  { match: (path: string) => path === '/help', title: 'Website Help | Carleton Lodge No. 465', description: 'Clear instructions for finding lodge events, signing in, notifications, summons, documents, and member information.' },
  { match: (path: string) => path === '/search', title: 'Search Lodge Information | Carleton Lodge No. 465', description: 'Search approved public and member information from Carleton Lodge No. 465.' },
  { match: (path: string) => path === '/my-lodge', title: 'My Lodge | Carleton Lodge No. 465', description: 'The secure member home for current Carleton Lodge information.' },
  { match: (path: string) => path === '/my-lodge/profile', title: 'My Profile | Carleton Lodge No. 465', description: 'View and update your secure Carleton Lodge member profile.' },
  ...(LODGE_GUIDE_ENABLED ? [{ match: (path: string) => path === '/lodge-guide', title: 'Lodge Guide | Carleton Lodge No. 465', description: 'Ask questions using approved, permission-aware Carleton Lodge sources.' }] : []),
  { match: (path: string) => path === '/summons', title: 'Lodge Summons | Carleton Lodge No. 465', description: 'Secure access to current and past Carleton Lodge summons.' },
  { match: (path: string) => path === '/district', title: 'Ottawa Districts 1 and 2 | Carleton Lodge No. 465', description: 'Member access to Ottawa District 1 and 2 lodge meetings, degree work, contacts, and summons.' },
  { match: (path: string) => path === '/members', title: 'Officers and Members | Carleton Lodge No. 465', description: 'The secure Carleton Lodge officer and member directory.' },
  { match: (path: string) => path === '/library', title: 'Lodge Library | Carleton Lodge No. 465', description: 'Secure access to approved Carleton Lodge documents and forms.' },
  { match: (path: string) => path === '/reset-password', title: 'Reset Password | Carleton Lodge No. 465', description: 'Choose a new password for your Carleton Lodge account.' },
  { match: (path: string) => path === '/activate', title: 'Activate Membership | Carleton Lodge No. 465', description: 'Activate secure access to the Carleton Lodge members website.' },
  { match: (path: string) => path === '/email-reminders', title: 'Mailbox Reminder Preferences | Carleton Lodge No. 465', description: 'Manage private officer and functional mailbox activation reminder preferences.' },
  { match: (path: string) => path === '/privacy-policy', title: 'Privacy Policy | Carleton Lodge No. 465', description: 'How the Carleton Lodge website handles personal information and website data.' },
  { match: (path: string) => path === '/terms-and-conditions', title: 'Terms and Conditions | Carleton Lodge No. 465', description: 'Terms and conditions for using the Carleton Lodge website.' },
  { match: (path: string) => path.startsWith('/admin'), title: 'Website Administration | Carleton Lodge No. 465', description: 'Secure Carleton Lodge website administration.' },
];

const privatePrefixes = ['/my-lodge', '/lodge-guide', '/ask-carleton', '/summons', '/district', '/members', '/library', '/admin', '/reset-password', '/activate', '/email-reminders', '/links/open', '/links/external-unavailable'];

const setMeta = (selector: string, attribute: string, value: string) => {
  const element = document.querySelector<HTMLMetaElement>(selector);
  element?.setAttribute(attribute, value);
};

export const PageMetadata = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    const page = pages.find((candidate) => candidate.match(pathname));
    const title = page?.title ?? 'Page Not Found | Carleton Lodge No. 465';
    const description = page?.description ?? defaultDescription;
    const canonicalUrl = `https://www.carpmasons.ca${pathname === '/' ? '/' : pathname}`;
    const isPrivate = privatePrefixes.some((prefix) => pathname.startsWith(prefix));

    document.title = title;
    setMeta('meta[name="description"]', 'content', description);
    setMeta('meta[name="robots"]', 'content', isPrivate ? 'noindex, nofollow, noarchive' : 'index, follow');
    setMeta('meta[property="og:title"]', 'content', title);
    setMeta('meta[property="og:description"]', 'content', description);
    setMeta('meta[property="og:url"]', 'content', canonicalUrl);
    setMeta('meta[name="twitter:title"]', 'content', title);
    setMeta('meta[name="twitter:description"]', 'content', description);
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.setAttribute('href', canonicalUrl);
  }, [pathname]);

  return null;
};
