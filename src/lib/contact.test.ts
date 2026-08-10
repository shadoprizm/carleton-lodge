import { describe, expect, it } from 'vitest';
import { SUPPORT_EMAIL, supportMailto } from './contact';

describe('public support contact', () => {
  it('uses the lodge support address as the single public destination', () => {
    expect(SUPPORT_EMAIL).toBe('support@carpmasons.ca');
    expect(supportMailto()).toBe('mailto:support@carpmasons.ca');
  });

  it('encodes support email subjects safely', () => {
    expect(supportMailto('Help signing in & mailbox setup')).toBe(
      'mailto:support@carpmasons.ca?subject=Help%20signing%20in%20%26%20mailbox%20setup',
    );
  });
});
