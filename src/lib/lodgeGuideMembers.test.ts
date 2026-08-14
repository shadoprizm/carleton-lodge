import { describe, expect, it } from 'vitest';
import {
  lodgeGuideMemberSourceBody,
  lodgeGuideQuestionNeedsSupportContact,
} from '../../supabase/functions/_shared/lodge-guide-members';

describe('Lodge Guide member directory enrichment', () => {
  it('provides the same safe contact fields shown on a signed-in member profile', () => {
    expect(lodgeGuideMemberSourceBody({
      full_name: 'V. W. Bro. Blake Farmer',
      phone: '613-324-3272',
      lodge_email: 'blake.farmer@carpmasons.ca',
      join_date: '2001-01-01',
      bio: null,
      lodge_positions: { name: 'Secretary' },
    })).toContain([
      'Positions: Secretary',
      'Lodge email: blake.farmer@carpmasons.ca',
      'Phone: 613-324-3272',
      'Member since: 2001-01-01',
    ].join('\n'));
  });

  it('lists every concurrent Lodge responsibility', () => {
    expect(lodgeGuideMemberSourceBody({
      full_name: 'R. W. Bro. Brian Adams',
      phone: null,
      lodge_email: null,
      join_date: null,
      bio: null,
      lodge_positions: { name: 'Lodge Historian' },
      lodge_member_positions: [
        { lodge_positions: { name: 'Lodge Historian' } },
        { lodge_positions: { name: 'Lodge Auditor' } },
      ],
    })).toContain('Positions: Lodge Historian, Lodge Auditor');
  });

  it('states when a lodge mailbox is not currently listed', () => {
    expect(lodgeGuideMemberSourceBody({
      full_name: 'Example Member',
      phone: null,
      lodge_email: null,
      join_date: null,
      bio: null,
      lodge_positions: null,
    })).toContain('Lodge email: Not currently listed or activated');
  });

  it('recognizes individual contact questions', () => {
    expect(lodgeGuideQuestionNeedsSupportContact("What is the Secretary's email address?")).toBe(true);
    expect(lodgeGuideQuestionNeedsSupportContact('When is the next meeting?')).toBe(false);
  });
});
