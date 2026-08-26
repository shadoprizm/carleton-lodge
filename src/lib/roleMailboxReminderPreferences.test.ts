import { describe, expect, it } from 'vitest';
import { roleMailboxReminderOptOutTokenFromHash } from './roleMailboxReminderPreferences';

const validToken = 'a'.repeat(43);

describe('roleMailboxReminderOptOutTokenFromHash', () => {
  it('reads a valid private token from the URL fragment', () => {
    expect(roleMailboxReminderOptOutTokenFromHash(`#token=${validToken}`)).toBe(validToken);
  });

  it('ignores missing, short, or non-URL-safe tokens', () => {
    expect(roleMailboxReminderOptOutTokenFromHash('')).toBe('');
    expect(roleMailboxReminderOptOutTokenFromHash('#token=short')).toBe('');
    expect(roleMailboxReminderOptOutTokenFromHash(`#token=${'a'.repeat(42)}%2B`)).toBe('');
  });
});
