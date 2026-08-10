import type { HistoryPerson } from './types';

const charterMemberNote =
  'Identified in the Ottawa District history as a charter member of Carleton Lodge No. 465.';

/**
 * The twelve charter members named in the District history (S01). Carleton
 * Lodge was instituted with twenty-three charter members; eleven names remain
 * unidentified. Do not add names without a source.
 */
export const knownCharterMembers: HistoryPerson[] = [
  { id: 'charter-g-n-kidd', name: 'G. N. Kidd', role: 'Charter member', bio: charterMemberNote, confidence: 'high', sources: ['S01'], category: 'charter_member' },
  { id: 'charter-g-h-groves', name: 'G. H. Groves', role: 'Charter member', bio: charterMemberNote, confidence: 'high', sources: ['S01'], category: 'charter_member' },
  { id: 'charter-john-argue', name: 'John Argue', role: 'Charter member', bio: charterMemberNote, confidence: 'high', sources: ['S01'], category: 'charter_member' },
  { id: 'charter-t-a-brown', name: 'T. A. Brown', role: 'Charter member', bio: charterMemberNote, confidence: 'high', sources: ['S01'], category: 'charter_member' },
  { id: 'charter-robert-richardson', name: 'Robert Richardson', role: 'Charter member', bio: charterMemberNote, confidence: 'high', sources: ['S01'], category: 'charter_member' },
  { id: 'charter-r-j-gordon', name: 'R. J. Gordon', role: 'Charter member', bio: charterMemberNote, confidence: 'high', sources: ['S01'], category: 'charter_member' },
  { id: 'charter-r-h-mcelroy', name: 'R. H. McElroy', role: 'Charter member', bio: charterMemberNote, confidence: 'high', sources: ['S01'], category: 'charter_member' },
  { id: 'charter-henry-f-johnston', name: 'Henry F. Johnston', role: 'Charter member', bio: charterMemberNote, confidence: 'high', sources: ['S01'], category: 'charter_member' },
  { id: 'charter-adam-green', name: 'Adam Green', role: 'Charter member', bio: charterMemberNote, confidence: 'high', sources: ['S01'], category: 'charter_member' },
  { id: 'charter-james-argue', name: 'James Argue', role: 'Charter member', bio: charterMemberNote, confidence: 'high', sources: ['S01'], category: 'charter_member' },
  { id: 'charter-revillow-elliot', name: 'Revillow Elliot', role: 'Charter member', bio: charterMemberNote, confidence: 'high', sources: ['S01'], category: 'charter_member' },
  { id: 'charter-g-m-mckay', name: 'G. M. McKay', role: 'Charter member', bio: charterMemberNote, confidence: 'high', sources: ['S01'], category: 'charter_member' },
];

/**
 * Key figures. Every statement below is taken from the handoff source
 * material; nothing has been added beyond it.
 */
export const keyFigures: HistoryPerson[] = [
  {
    id: 'george-n-kidd',
    name: 'George N. Kidd',
    role: 'Charter member',
    dateLabel: '1904',
    bio: 'Identified in the District history as a charter member of Carleton Lodge. The Lodge\'s first Lodge room was upstairs in the Kidd Block, the commercial block at the heart of Carp\'s business district.',
    confidence: 'high',
    sources: ['S01'],
    category: 'founder',
  },
  {
    id: 'sidney-albert-luke',
    name: 'R.W. Bro. Sidney Albert Luke',
    role: 'Consecrating officer',
    dateLabel: '1904',
    bio: 'Consecrated Carleton Lodge on 4 October 1904. He later served as Grand Master.',
    confidence: 'high',
    sources: ['S01'],
    category: 'key_figure',
  },
  {
    id: 'william-stuart',
    name: 'Bro. William Stuart',
    role: 'Treasurer, La Loge Le Havre de Grâce No. 4',
    dateLabel: '1916–1926',
    bio: 'Treasurer of the wartime Le Havre Lodge and one of only two members reported to remain in France after it closed — both Canadians from Montreal. He arranged for the Lodge furniture and documents to be packed into sixteen crates and shipped to London aboard the Perseverence. By 1926 he had affiliated with Carleton Lodge, and on 26 February 1926 he offered to pay the expenses of bringing the historic furniture to Carp.',
    confidence: 'high',
    sources: ['S01'],
    category: 'key_figure',
  },
  {
    id: 'captain-firebrace',
    name: 'Captain Firebrace',
    role: 'First Master, La Loge Le Havre de Grâce No. 4',
    dateLabel: '1916',
    bio: 'First Master of the wartime Lodge at Le Havre. The District history records that he presented the wooden setting maul now held by Carleton Lodge — its timber said to have first formed part of a warship\'s rib and later to have spent more than a century in the frame of a Masonic Hall.',
    confidence: 'high',
    sources: ['S01'],
    category: 'key_figure',
  },
  {
    id: 'sam-hughes',
    name: 'Lt.-Gen. Sir Sam Hughes',
    role: 'Former Minister of Militia and Defence',
    dateLabel: '1919',
    bio: 'Unveiled the First World War memorial tablet in Carleton Lodge on 19 May 1919.',
    confidence: 'high',
    sources: ['S01'],
    category: 'key_figure',
  },
  {
    id: 'calvin-potters-wilson',
    name: 'Lt. Calvin Potters Wilson',
    role: 'Carleton Lodge Mason, Canadian Expeditionary Force',
    dateLabel: 'd. October 1918',
    bio: 'A Carleton Lodge Mason who died from influenza while on military duty in Halifax in October 1918. Veterans Affairs Canada documents a memorial connected with Carleton Lodge in his memory.',
    confidence: 'high',
    sources: ['S01'],
    category: 'key_figure',
  },
  {
    id: 'f-c-russell',
    name: 'Bro. F. C. Russell',
    role: 'Carp merchant',
    dateLabel: '1923',
    bio: 'By May 1923, Carleton Lodge was meeting temporarily in the upper portion of Bro. Russell\'s store, one of the Lodge\'s several homes between the 1920 fire and the present Temple.',
    confidence: 'high',
    sources: ['S01'],
    category: 'key_figure',
  },
];

export const allHistoryPeople: HistoryPerson[] = [...keyFigures, ...knownCharterMembers];
