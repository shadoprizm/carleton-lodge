import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LinksPage } from './LinksPage';

afterEach(() => cleanup());

describe('LinksPage', () => {
  it('uses the official Ontario Royal Arch resource', () => {
    render(<LinksPage />);

    const royalArchLink = screen.getByRole('link', { name: /Royal Arch Masons — Ontario/i });
    expect(royalArchLink).toHaveAttribute('href', '/links/open/royal-arch-ontario');
  });

  it('offers the Grand Lodge Library email instead of its unsafe website', () => {
    render(<LinksPage />);

    const libraryLink = screen.getByRole('link', { name: /Grand Lodge Library, Museum & Archives/i });
    expect(libraryLink).toHaveAttribute('href', 'mailto:library@grandlodge.on.ca?subject=Grand%20Lodge%20Library%20enquiry');
  });
});
