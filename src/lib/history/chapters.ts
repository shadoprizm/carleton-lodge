import type { HistoryChapter } from './types';

/**
 * The eight history chapters. The first five are the narrative story arc;
 * people, gallery and sources round out the archive.
 */
export const historyChapters: HistoryChapter[] = [
  {
    id: 'founding',
    slug: 'founding',
    title: 'The Founding Years',
    yearLabel: '1903–1920',
    tagline: 'A dispensation, twenty-three charter members, and a Lodge room above the Carp Drug Store.',
    description:
      'Supported by Mississippi Lodge No. 147 in Almonte, Carleton Lodge was instituted at Carp in January 1904, warranted that July, and consecrated in October — meeting upstairs in the Kidd Block in the heart of the village.',
    icon: 'landmark',
  },
  {
    id: 'fire-and-displacement',
    slug: 'fire-and-displacement',
    title: 'Fire and Displacement',
    yearLabel: '1920–1926',
    tagline: 'The Kidd Block burned in July 1920, beginning six years without a permanent home.',
    description:
      "The 1920 fire destroyed the Lodge's original rooms. The Orange Lodge hall, an unfinished memorial-hall plan, and the upper floor of Bro. F. C. Russell's store carried the Lodge through the displacement years.",
    icon: 'flame',
  },
  {
    id: 'temple',
    slug: 'temple',
    title: 'From Church to Temple',
    yearLabel: '1925–1930',
    tagline: "A former Presbyterian church, raised on new foundations, becomes the Lodge's permanent home.",
    description:
      "After Church Union in 1925, the former St. Andrew's Presbyterian Church was transferred to the Freemasons for $250 plus legal fees, raised to add a basement, and dedicated as the Carp Masonic Temple in 1930.",
    icon: 'church',
  },
  {
    id: 'le-havre',
    slug: 'le-havre',
    title: 'The Le Havre Connection',
    yearLabel: '1916–1926',
    tagline: 'A wartime military Lodge in France, sixteen crates, and a rescue from a London auction.',
    description:
      'La Loge Le Havre de Grâce No. 4 worked at Le Havre, France from 1916 to 1919. Its furniture and records crossed the Atlantic years later to become part of Carleton Lodge.',
    icon: 'ship',
  },
  {
    id: 'war-and-remembrance',
    slug: 'war-and-remembrance',
    title: 'War and Remembrance',
    yearLabel: '1918–2016',
    tagline: 'Service in two wars, a memorial tablet, and a setting maul returned to remembrance duty.',
    description:
      'From First World War letters and remitted dues to the 1919 memorial tablet unveiled by Sir Sam Hughes, Lt. Calvin Potters Wilson, and the 2016 West Carleton War Memorial cornerstone ceremony.',
    icon: 'medal',
  },
  {
    id: 'people',
    slug: 'people',
    title: 'People of the Lodge',
    yearLabel: '1904 —',
    tagline: 'Founders, charter members, and the figures who shaped Carleton Lodge.',
    description:
      'The twelve identified charter members, key figures such as George N. Kidd and R.W. Bro. Sidney Albert Luke, and the continuing work of compiling Past Masters and District officers from Lodge records.',
    icon: 'users',
  },
  {
    id: 'gallery',
    slug: 'gallery',
    title: 'Gallery',
    yearLabel: 'Images & artifacts',
    tagline: 'Historical photographs, documents, buildings, and artifacts — with honest labels.',
    description:
      'Authentic photographs and documents appear alongside clearly labelled pending-acquisition slots and plainly marked AI reconstructions. Every image carries its credit and rights status.',
    icon: 'images',
  },
  {
    id: 'sources',
    slug: 'sources',
    title: 'Sources & Research',
    yearLabel: 'Methodology',
    tagline: 'How this history is evidenced — and what is still unresolved.',
    description:
      'The full source register, the evidence hierarchy behind every claim, image rights and acknowledgements, and the open research questions the Lodge is still working to answer.',
    icon: 'book-open',
  },
];

/** The five narrative chapters, in story order. */
export const narrativeChapters = historyChapters.filter((chapter) =>
  ['founding', 'fire-and-displacement', 'temple', 'le-havre', 'war-and-remembrance'].includes(chapter.id),
);
