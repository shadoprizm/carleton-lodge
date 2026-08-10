import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router';
import { PageMetadata } from './PageMetadata';

const historyRoutes = [
  '/history',
  '/history/founding',
  '/history/fire-and-displacement',
  '/history/temple',
  '/history/le-havre',
  '/history/war-and-remembrance',
  '/history/people',
  '/history/gallery',
  '/history/sources',
];

const forbiddenWorkflowLanguage =
  /pending|acquisition|permission|to be confirmed|under research|unresolved|rights|placeholder|reserved|awaiting|open research questions/i;

describe('PageMetadata public history descriptions', () => {
  beforeEach(() => {
    document.head.innerHTML = `
      <meta name="description" content="">
      <meta property="og:description" content="">
      <meta name="twitter:description" content="">
    `;
  });

  afterEach(() => cleanup());

  it.each(historyRoutes)('keeps internal workflow language off %s', (route) => {
    const view = render(
      <MemoryRouter initialEntries={[route]}>
        <PageMetadata />
      </MemoryRouter>,
    );

    const descriptions = [
      document.querySelector('meta[name="description"]')?.getAttribute('content'),
      document.querySelector('meta[property="og:description"]')?.getAttribute('content'),
      document.querySelector('meta[name="twitter:description"]')?.getAttribute('content'),
    ];

    for (const description of descriptions) {
      expect(description).toBeTruthy();
      expect(description).not.toMatch(forbiddenWorkflowLanguage);
    }

    view.unmount();
  });
});
