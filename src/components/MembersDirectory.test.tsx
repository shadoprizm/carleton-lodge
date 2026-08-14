import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import type { LodgePosition } from '../lib/supabase';
import { MembersDirectory } from './MembersDirectory';

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'profile-1' } }),
}));

vi.mock('../lib/supabase', () => ({
  supabase: { from: fromMock },
}));

const positionDefinitions = [
  ['Worshipful Master', 'OFFICER', 1, 1],
  ['Senior Warden', 'OFFICER', 2, 1],
  ['Junior Warden', 'OFFICER', 3, 1],
  ['Treasurer', 'OFFICER', 4, 1],
  ['Secretary', 'OFFICER', 5, 1],
  ['Senior Deacon', 'OFFICER', 6, 1],
  ['Junior Deacon', 'OFFICER', 7, 1],
  ['Inner Guard', 'OFFICER', 8, 1],
  ['Senior Steward', 'OFFICER', 9, 1],
  ['Junior Steward', 'OFFICER', 10, 1],
  ['Tyler', 'OFFICER', 11, 1],
  ['Chaplain', 'OFFICER', 12, 1],
  ['Dir. of Ceremonies', 'OFFICER', 13, 1],
  ['Immed Past Master', 'OFFICER', 14, 1],
  ['Piper', 'OFFICER', 15, 1],
  ['Lodge Historian', 'FUNCTIONAL', 18, 1],
  ['Lodge Auditor', 'FUNCTIONAL', 19, 2],
] as const;

const positions = new Map<string, LodgePosition>(positionDefinitions.map(
  ([name, positionType, displayOrder, maxHolders]) => [name, {
    id: name.toLowerCase().replace(/[^a-z]+/g, '-'),
    name,
    display_order: displayOrder,
    position_type: positionType,
    max_holders: maxHolders,
    created_at: '2026-08-14T00:00:00Z',
  }],
));

function directoryMember(id: string, fullName: string, positionNames: string[]) {
  const memberPositions = positionNames.map(name => positions.get(name)!);
  return {
    id,
    full_name: fullName,
    phone: null,
    join_date: null,
    position_id: memberPositions[0]?.id ?? null,
    bio: null,
    visible_to_members: true,
    linked_profile_id: null,
    lodge_email: null,
    mailbox_status: 'unprovisioned',
    mailbox_provisioned_at: null,
    mailbox_activated_at: null,
    created_at: '2026-08-14T00:00:00Z',
    updated_at: '2026-08-14T00:00:00Z',
    lodge_positions: memberPositions[0] ?? null,
    lodge_member_positions: memberPositions.map(position => ({ lodge_positions: position })),
  };
}

const roster = positionDefinitions
  .map(([positionName], index) => directoryMember(
    `member-${index}`,
    `Bro. ${positionName}`,
    [positionName],
  ))
  .filter(member => !['Lodge Historian', 'Lodge Auditor'].includes(member.lodge_positions?.name ?? ''));

roster.push(directoryMember('brian', 'R. W. Bro. Brian Adams', ['Lodge Historian', 'Lodge Auditor']));

describe('MembersDirectory officer structure', () => {
  beforeEach(() => {
    fromMock.mockReset();
    fromMock.mockImplementation((table: string) => {
      if (table === 'lodge_positions') {
        return {
          select: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({ data: [...positions.values()], error: null }),
          })),
        };
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: roster, error: null }),
        })),
      };
    });
  });

  afterEach(() => cleanup());

  it('separates elected, appointed, and other roles while reserving both Auditor seats', async () => {
    render(
      <MemoryRouter>
        <MembersDirectory />
      </MemoryRouter>,
    );

    const electedHeading = await screen.findByRole('heading', { name: 'Elected Officers' });
    const electedSection = electedHeading.closest('section');
    const appointedSection = screen.getByRole('heading', { name: 'Appointed Officers' }).closest('section');
    const otherRolesSection = screen.getByRole('heading', { name: 'Other Lodge Roles' }).closest('section');

    expect(electedSection).not.toBeNull();
    expect(appointedSection).not.toBeNull();
    expect(otherRolesSection).not.toBeNull();

    [
      'Worshipful Master',
      'Senior Warden',
      'Junior Warden',
      'Chaplain',
      'Treasurer',
      'Secretary',
      'Tyler',
      'Immediate Past Master',
    ].forEach(positionName => {
      expect(within(electedSection!).getByText(positionName)).toBeInTheDocument();
    });
    expect(within(electedSection!).getAllByText('Lodge Auditor')).toHaveLength(2);
    expect(within(electedSection!).getByText('Vacant')).toBeInTheDocument();
    expect(screen.getByTestId('immediate-past-master-slot')).toHaveClass('md:mt-8');

    [
      'Senior Deacon',
      'Junior Deacon',
      'Director of Ceremonies',
      'Inner Guard',
      'Senior Steward',
      'Junior Steward',
      'Piper',
    ].forEach(positionName => {
      expect(within(appointedSection!).getByText(positionName)).toBeInTheDocument();
    });

    expect(within(otherRolesSection!).getByText('Lodge Historian')).toBeInTheDocument();
    expect(within(otherRolesSection!).queryByText('Lodge Auditor')).not.toBeInTheDocument();
  });
});
