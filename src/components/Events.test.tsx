import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router';
import { EventsEmptyState } from './Events';

const renderEmptyState = (now: Date) =>
  render(
    <MemoryRouter>
      <EventsEmptyState now={now} />
    </MemoryRouter>,
  );

describe('EventsEmptyState', () => {
  afterEach(() => cleanup());

  it('falls back to the regular meeting schedule outside the summer recess', () => {
    renderEmptyState(new Date('2026-03-15T12:00:00'));
    expect(screen.getByText('No upcoming public events right now')).toBeTruthy();
    expect(
      screen.getByText(/fourth Thursday of each month, except July and August/),
    ).toBeTruthy();
    expect(screen.queryByText(/summer recess/)).toBeNull();
  });

  it('explains the summer recess in July', () => {
    renderEmptyState(new Date('2026-07-15T12:00:00'));
    expect(screen.getByText('The Lodge is in summer recess')).toBeTruthy();
    expect(screen.getByText(/resume in September/)).toBeTruthy();
  });

  it('explains the summer recess in August', () => {
    renderEmptyState(new Date('2026-08-20T12:00:00'));
    expect(screen.getByText('The Lodge is in summer recess')).toBeTruthy();
  });

  it('always links to the full calendar', () => {
    renderEmptyState(new Date('2026-07-15T12:00:00'));
    const link = screen.getByRole('link', { name: 'View Full Calendar' });
    expect(link.getAttribute('href')).toBe('/calendar');
  });
});
