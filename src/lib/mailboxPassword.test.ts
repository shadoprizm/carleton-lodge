import { describe, expect, it } from 'vitest';
import { MIN_MAILBOX_PASSWORD_LENGTH } from './mailboxPassword';

describe('mailbox password requirements', () => {
  it('uses an eight-character minimum', () => {
    expect(MIN_MAILBOX_PASSWORD_LENGTH).toBe(8);
  });
});

