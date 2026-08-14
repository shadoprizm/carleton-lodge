export type ExternalLinkGroup = 'grand-lodge' | 'ottawa-area' | 'concordant';

interface ExternalLinkBase {
  id: string;
  group: ExternalLinkGroup;
  name: string;
  description: string;
  url: string;
}

export interface ExternalWebsiteResource extends ExternalLinkBase {
  kind: 'website';
  allowedDomains: readonly string[];
}

export interface ExternalEmailResource extends ExternalLinkBase {
  kind: 'email';
}

export type ExternalLinkResource = ExternalWebsiteResource | ExternalEmailResource;

export const externalLinkResources = [
  {
    id: 'ontario-grand-lodge',
    group: 'grand-lodge',
    kind: 'website',
    name: 'Grand Lodge of Canada in the Province of Ontario',
    description: 'Official Ontario Grand Lodge information, membership information, and lodge finder.',
    url: 'https://ontariomasons.ca/',
    allowedDomains: ['ontariomasons.ca'],
  },
  {
    id: 'grand-lodge-library-email',
    group: 'grand-lodge',
    kind: 'email',
    name: 'Grand Lodge Library, Museum & Archives',
    description: 'The library website is temporarily unavailable. Email the Grand Lodge Library directly.',
    url: 'mailto:library@grandlodge.on.ca?subject=Grand%20Lodge%20Library%20enquiry',
  },
  {
    id: 'masonic-foundation-ontario',
    group: 'grand-lodge',
    kind: 'website',
    name: 'Masonic Foundation of Ontario',
    description: 'Provincial charitable programs and community support.',
    url: 'https://themasonicfoundationofontario.ca/',
    allowedDomains: ['themasonicfoundationofontario.ca'],
  },
  {
    id: 'ottawa-district-1',
    group: 'ottawa-area',
    kind: 'website',
    name: 'Ottawa District 1',
    description: 'District news, lodges, officers, resources, and events. Carleton Lodge is part of Ottawa District 1.',
    url: 'https://www.ottawadistrict1masons.ca/',
    allowedDomains: ['ottawadistrict1masons.ca'],
  },
  {
    id: 'ottawa-district-2',
    group: 'ottawa-area',
    kind: 'website',
    name: 'Ottawa District 2',
    description: 'Neighbouring district lodge information, officers, and public events.',
    url: 'https://www.ottawamasons.ca/',
    allowedDomains: ['ottawamasons.ca'],
  },
  {
    id: 'ottawa-masonic-association',
    group: 'ottawa-area',
    kind: 'website',
    name: 'Ottawa Masonic Association',
    description: 'Information and coordination across Ottawa-area Freemasonry.',
    url: 'https://www.ottawamasonicassociation.com/',
    allowedDomains: ['ottawamasonicassociation.com'],
  },
  {
    id: 'royal-arch-ontario',
    group: 'concordant',
    kind: 'website',
    name: 'Royal Arch Masons — Ontario',
    description: 'Official Grand Chapter information and Royal Arch resources for Ontario.',
    url: 'https://www.royalarchmasons.on.ca/',
    allowedDomains: ['royalarchmasons.on.ca'],
  },
  {
    id: 'ottawa-valley-scottish-rite',
    group: 'concordant',
    kind: 'website',
    name: 'Scottish Rite — Valley of Ottawa',
    description: 'Ottawa Valley Scottish Rite information and activities.',
    url: 'https://ottawavalleyscottishrite.com/',
    allowedDomains: ['ottawavalleyscottishrite.com'],
  },
  {
    id: 'tunis-shriners',
    group: 'concordant',
    kind: 'website',
    name: 'Tunis Shriners',
    description: 'Ottawa-area Shriners information, philanthropy, and contact details.',
    url: 'https://tunisshriners.ca/',
    allowedDomains: ['tunisshriners.ca'],
  },
] as const satisfies readonly ExternalLinkResource[];

export const findExternalLinkResource = (id: string) =>
  externalLinkResources.find((resource) => resource.id === id);

export const findExternalWebsiteResource = (id: string) => {
  const resource = findExternalLinkResource(id);
  return resource?.kind === 'website' ? resource : undefined;
};
