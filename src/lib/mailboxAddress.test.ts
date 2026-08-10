import { describe, expect, it } from 'vitest';
import {
  mailboxBaseName,
  proposedLodgeEmail,
} from '../../supabase/functions/_shared/mailbox-address';

describe('member lodge mailbox addresses', () => {
  it('removes separated Masonic title initials before Bro.', () => {
    expect(mailboxBaseName('V. W. Bro. Blake Farmer')).toBe('blake.farmer');
    expect(mailboxBaseName('R. W. Bro. John Smith')).toBe('john.smith');
    expect(mailboxBaseName('W. Bro. Jane Doe')).toBe('jane.doe');
  });

  it('uses the first complete given name after title and personal initials', () => {
    expect(mailboxBaseName('Bro. C.S. Duff Sullivan')).toBe('duff.sullivan');
    expect(mailboxBaseName('Bro. J. Smith')).toBe('j.smith');
  });

  it('removes compact Masonic titles', () => {
    expect(mailboxBaseName('VWBro Alex Mason')).toBe('alex.mason');
    expect(mailboxBaseName('WM Chris Taylor')).toBe('chris.taylor');
  });

  it('keeps a genuine first-name initial when no Brother title is present', () => {
    expect(mailboxBaseName('J. Smith')).toBe('j.smith');
  });

  it('normalizes accents and builds the complete lodge address', () => {
    expect(proposedLodgeEmail('Bro. Jérémie Lévesque')).toBe(
      'jeremie.levesque@carpmasons.ca',
    );
  });

  it('handles apostrophes, hyphenated names, spaces, and capitalization deterministically', () => {
    expect(proposedLodgeEmail("Bro. Sean O’Connor")).toBe('sean.oconnor@carpmasons.ca');
    expect(proposedLodgeEmail('Bro. Mary-Jane SMITH')).toBe('mary-jane.smith@carpmasons.ca');
    expect(proposedLodgeEmail('  Bro.   Alex   Van Buren  ')).toBe('alex.buren@carpmasons.ca');
  });
});
