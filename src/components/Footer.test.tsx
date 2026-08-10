import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router';
import { Footer } from './Footer';

const renderFooter = () =>
  render(
    <MemoryRouter>
      <Footer />
    </MemoryRouter>,
  );

describe('Footer', () => {
  afterEach(() => cleanup());

  it('renders the lodge identity and jurisdiction', () => {
    renderFooter();
    expect(screen.getByText('Carleton Lodge')).toBeTruthy();
    expect(
      screen.getByText('Ancient Free and Accepted Masons of Canada'),
    ).toBeTruthy();
  });

  it('links to the legal pages', () => {
    renderFooter();
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Terms and Conditions' }),
    ).toBeTruthy();
  });

  it('shows the temple address with a directions link', () => {
    renderFooter();
    const directions = screen.getByRole('link', { name: /3704 Carp Road/i });
    expect(directions.getAttribute('href')).toContain(
      'google.com/maps/search',
    );
  });

  it('shows the support email as a mailto link', () => {
    renderFooter();
    const email = screen.getByRole('link', { name: 'support@carpmasons.ca' });
    expect(email.getAttribute('href')).toBe('mailto:support@carpmasons.ca');
  });

  it('links to the lodge explore pages', () => {
    renderFooter();
    for (const name of [
      'Our History',
      'Photo Gallery',
      'Calendar',
      'Masonic Links',
      'Help',
    ]) {
      expect(screen.getByRole('link', { name })).toBeTruthy();
    }
  });
});
