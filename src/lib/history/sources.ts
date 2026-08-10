import type { HistorySource } from './types';

/**
 * Source register S01–S09, transcribed from k3-handoff/source-register.csv.
 */
export const historySources: HistorySource[] = [
  {
    id: 'S01',
    title: 'Ottawa District — Then and Now: Freemasonry in Eastern Ontario 1855–2010',
    publisherAuthor: 'Ottawa District One / Michael Jenkyns',
    url: 'https://www.ottawadistrict1masons.ca/images/documents/District_1_History_1855_2010.pdf',
    locator: 'pp. 356–359 (PDF viewer pages); Carleton Lodge section',
    sourceType: 'Primary-source-derived district history citing Grand Lodge Proceedings and Lodge records',
    confidence: 'high',
    notes:
      'Core source for founding, fire, temporary locations, church transfer, Le Havre, dedication, leadership, membership.',
  },
  {
    id: 'S02',
    title: 'Carp Heritage Walk — About',
    publisherAuthor: 'Carp Heritage Walk',
    url: 'https://www.carpheritagewalk.ca/about',
    locator: 'Source acknowledgements',
    sourceType: 'Local-history project with explicit image provenance',
    confidence: 'high',
    notes:
      'Names LAC photo IDs PA-122498 and C-12167; states HTHS supplied photographs with permission.',
  },
  {
    id: 'S03',
    title: 'Carp Heritage Walk — History of Carp',
    publisherAuthor: 'Carp Heritage Walk',
    url: 'https://www.carpheritagewalk.ca/history-of-carp',
    locator: 'History page',
    sourceType: 'Local-history synthesis',
    confidence: 'medium-high',
    notes:
      "Documents Kidd Street circa 1910 image and credits HTHS; identifies St. Andrew's as 1876.",
  },
  {
    id: 'S04',
    title: 'Carp United Church fonds',
    publisherAuthor: 'Library and Archives Canada',
    url: 'https://recherche-collection-search.bac-lac.gc.ca/eng/home/record?app=FonAndCol&idnumber=102816',
    locator: 'R14519-0-0-E / MG9-D7-20',
    sourceType: 'Archival catalogue',
    confidence: 'high',
    notes:
      "Microfilm M-816 and M-817 includes St. Andrew's trustee minutes, membership and church records through 1929; important for resolving transfer chronology.",
  },
  {
    id: 'S05',
    title: 'Huntley Township Historical Society — Publications',
    publisherAuthor: 'Huntley Township Historical Society',
    url: 'https://huntleyhistory.ca/publications.html',
    locator: 'Publications list',
    sourceType: 'Local historical society',
    confidence: 'high',
    notes:
      'Identifies pictorial history, Fire booklet, Carp Review material, Lest We Forget and other likely image/history sources.',
  },
  {
    id: 'S06',
    title: 'The Origins and Early History of Carp Village',
    publisherAuthor: 'Huntley Township Historical Society / Dr. Bruce Elliott',
    url: 'https://huntleyhistory.ca/books/origins.html',
    locator: 'Book description',
    sourceType: 'Scholarly local history',
    confidence: 'high',
    notes:
      'Useful for village/Kidd context; photographs were scanned/enhanced for HTHS publication.',
  },
  {
    id: 'S07',
    title: 'Les loges militaires anglaises en France durant la Grande Guerre',
    publisherAuthor: 'Yves Hivert-Messeca',
    url: 'https://yveshivertmesseca.wordpress.com/2016/09/04/les-loges-militaires-anglaises-en-france-durant-la-grande-guerre-1914-1918/',
    locator: 'Le Havre section',
    sourceType: 'Secondary French Masonic history',
    confidence: 'medium',
    notes:
      'Independent secondary corroboration that Le Havre de Grâce No. 4 closed in 1919 and its archives/furniture were acquired by Carleton Lodge.',
  },
  {
    id: 'S08',
    title: 'Retired Carleton Lodge website',
    publisherAuthor: 'Carleton Lodge No. 465',
    url: 'https://carletonlodge465.com/',
    locator: 'Home/About legacy content',
    sourceType: 'Lodge secondary source',
    confidence: 'medium',
    notes:
      'Useful for legacy photographs/captions and oral-tradition material; contains internal date inconsistencies, so not authoritative.',
  },
  {
    id: 'S09',
    title: 'Ottawa District One current Lodge listing',
    publisherAuthor: 'Ottawa District One',
    url: 'https://www.ottawadistrict1masons.ca/district/lodges',
    locator: 'Carleton Lodge entry',
    sourceType: 'Current district listing',
    confidence: 'high',
    notes: 'Confirms current Lodge location at 3704 Carp Road.',
  },
  {
    id: 'S10',
    title: 'Carleton Lodge No. 465 legacy website image archive',
    publisherAuthor: 'Carleton Lodge No. 465',
    url: 'https://carletonlodge465.com/',
    locator: 'Recovered from Internet Archive captures of carletonlodge465.com, August 2026',
    sourceType: "Lodge-owned primary photographs from the Lodge's retired website",
    confidence: 'high',
    notes:
      'Lodge-owned images confirmed for reuse. Most items await member identification of names, years and occasions; captions state only what is visibly shown plus EXIF/filename dates.',
  },
];
