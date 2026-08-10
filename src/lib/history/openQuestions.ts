import type { OpenQuestion } from './types';

/**
 * The six open research questions from k3-handoff/OPEN_RESEARCH_QUESTIONS.md.
 * These stay flagged in the site data until resolved and must never be
 * presented as settled fact.
 */
export const openQuestions: OpenQuestion[] = [
  {
    id: 'church-deed-date',
    title: 'Exact church deed / transfer date',
    known: [
      'Church Union occurred in 1925.',
      'The Ottawa District history says the former Presbyterian congregation agreed to deed the church and land to the Freemasons for $250 plus legal fees.',
      'Renovation followed.',
      'Carleton Lodge held its first meeting in the present Temple on 15 April 1927.',
    ],
    needed: [
      'The deed',
      'A land registry record',
      'The Presbyterian trustee minute authorizing the transfer',
      'The Lodge minute accepting or completing the transfer',
    ],
    bestLead:
      "Library and Archives Canada, Carp United Church fonds, microfilm M-816/M-817, including St. Andrew's trustee minutes to 1929.",
  },
  {
    id: 'charter-member-roster',
    title: 'Complete 23 charter members',
    known: [
      'The District history prints only a partial list in the main Carleton section.',
      'A separate Goodwood history identifies nine Goodwood members as charter members.',
    ],
    needed: [
      'The 1904 Grand Lodge return',
      'The institution record',
      'Charter/warrant paperwork',
      'The early Lodge register',
    ],
  },
  {
    id: 'fire-newspaper-coverage',
    title: 'July 20, 1920 fire — contemporary newspaper coverage',
    known: [
      "The Masonic District history states the fire apparently began in Joe Rishaur's tin shop.",
    ],
    needed: [
      'The Carp Review, if the issue survives',
      'The Ottawa Citizen',
      'The Ottawa Journal',
      'Regional weeklies',
    ],
    bestLead:
      'Goals: confirm the precise date, confirm the point of origin, quantify buildings and losses, identify eyewitness descriptions, and determine whether an authentic fire or aftermath photograph exists.',
  },
  {
    id: 'st-andrews-chronology',
    title: "St. Andrew's construction chronology",
    known: [
      'Carp Heritage Walk uses 1876.',
      'The previous carpmasons.ca text used 1872–1875.',
    ],
    needed: [
      'Trustee minutes',
      'A church dedication notice',
      'Local newspaper coverage',
      'Denominational records',
    ],
    bestLead: 'Until resolved, the old 1872–1875 sequence is not published as fact.',
  },
  {
    id: 'le-havre-archive-status',
    title: 'Le Havre archive physical status',
    known: [
      "The Ottawa District history's bibliography states that the Minute Book and Register of Members of La Loge Le Havre de Grâce No. 4 were held in the archives of Carleton Lodge.",
    ],
    needed: [
      'Physically locate the records',
      'Assess their condition',
      'Inventory the documents',
      'Conservation-safe digitization',
      'Determine any Masonic privacy or restriction considerations before public release',
    ],
  },
  {
    id: 'authentic-images',
    title: 'Authentic images',
    known: [
      'Authentic photographs of the Kidd Block, Kidd Street and Carp village are known to exist in the Huntley Township Historical Society and Library and Archives Canada collections.',
    ],
    needed: [
      'Kidd Block c. 1910',
      "St. Andrew's church",
      'Orange Hall',
      'Carp streetscape',
      'Fire aftermath, if any exists',
    ],
    bestLead:
      'Contact HTHS for high-resolution scans and reproduction permission instead of copying images from Carp Heritage Walk.',
  },
  {
    id: 'legacy-photo-identification',
    title: 'Identification of the recovered legacy photographs',
    known: [
      'Eighty-nine image files were recovered from Internet Archive captures of the retired carletonlodge465.com website and confirmed as Lodge-owned.',
      'Seventy-two of the eighty-nine recovered files need a member of the Lodge to confirm who and what is pictured.',
      'The brass provenance plates on the Lodge-room column bases are not resolvable in the recovered photographs, so Le Havre attribution of individual furniture pieces remains unconfirmed.',
    ],
    needed: [
      'Member confirmation of installation years and the names of Worshipful Masters pictured',
      'The year of the Santa Claus parade float photographs',
      'The occasions behind banquet and group photographs',
      'Names of officers, members and visiting dignitaries in group photographs',
    ],
    bestLead:
      'A member review session with the curated archive, recording confirmed names and dates against the recovery manifest.',
  },
];
