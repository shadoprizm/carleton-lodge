import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { ExternalLinkUnavailablePage } from './ExternalLinkUnavailablePage';

afterEach(() => cleanup());

describe('ExternalLinkUnavailablePage', () => {
  it('explains the first failure and the one-time notification rule', () => {
    render(
      <MemoryRouter initialEntries={['/links/external-unavailable?resource=royal-arch-ontario&notice=queued']}>
        <ExternalLinkUnavailablePage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /That external link does not appear to be working/i })).toBeInTheDocument();
    expect(screen.getByText(/Royal Arch Masons — Ontario is not available right now/i)).toBeInTheDocument();
    expect(screen.getByText(/does not own or maintain this external website/i)).toBeInTheDocument();
    expect(screen.getByText(/One automatic notification has been queued/i)).toHaveTextContent(/will not generate another email/i);
    expect(screen.getByRole('link', { name: /Return to Masonic Links/i })).toHaveAttribute('href', '/links');
    expect(screen.getByRole('link', { name: /Return Home/i })).toHaveAttribute('href', '/');
  });

  it('does not promise another email for a previously reported failure', () => {
    render(
      <MemoryRouter initialEntries={['/links/external-unavailable?resource=royal-arch-ontario&notice=existing']}>
        <ExternalLinkUnavailablePage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/has already been notified/i)).toHaveTextContent(/did not generate another email/i);
  });
});
