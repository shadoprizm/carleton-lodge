import { describe, expect, it } from 'vitest';
import { externalLinkResources, findExternalWebsiteResource } from './externalLinks';

describe('externalLinkResources', () => {
  it('uses unique stable identifiers and allowlisted HTTPS websites', () => {
    const identifiers = externalLinkResources.map((resource) => resource.id);
    expect(new Set(identifiers).size).toBe(identifiers.length);

    for (const resource of externalLinkResources) {
      if (resource.kind !== 'website') continue;
      expect(resource.url).toMatch(/^https:\/\//);
      expect(resource.allowedDomains).toContain(new URL(resource.url).hostname.replace(/^www\./, ''));
      expect(findExternalWebsiteResource(resource.id)).toEqual(resource);
    }
  });

  it('keeps the Grand Lodge Library on its direct email fallback', () => {
    const library = externalLinkResources.find((resource) => resource.id === 'grand-lodge-library-email');
    expect(library?.kind).toBe('email');
    expect(library?.url).toBe('mailto:library@grandlodge.on.ca?subject=Grand%20Lodge%20Library%20enquiry');
  });
});
