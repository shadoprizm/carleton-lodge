import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Link, MemoryRouter } from 'react-router';
import { ScrollToTop } from './ScrollToTop';

describe('ScrollToTop', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('instantly resets the window scroll position when the pathname changes', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);

    render(
      <MemoryRouter initialEntries={['/history/founding']}>
        <ScrollToTop />
        <Link to="/history/temple">Next chapter</Link>
      </MemoryRouter>,
    );

    scrollTo.mockClear();
    fireEvent.click(screen.getByRole('link', { name: 'Next chapter' }));

    expect(scrollTo).toHaveBeenCalledOnce();
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' });
  });
});
