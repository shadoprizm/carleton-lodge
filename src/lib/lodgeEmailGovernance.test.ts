import { describe, expect, it } from 'vitest';
import {
  currentAgreementIsSatisfied,
  deterministicMailboxCandidates,
  validateMailboxSetup,
} from './lodgeEmailGovernance';

const validSetup = {
  needsAgreement: true,
  agreementAccepted: true,
  requiresPassword: true,
  password: 'Secure123',
  confirmation: 'Secure123',
  requiresSecureToken: false,
  hasSecureToken: false,
};

describe('Lodge email governance', () => {
  it('blocks activation when the mandatory agreement is unchecked', () => {
    expect(validateMailboxSetup({ ...validSetup, agreementAccepted: false })).toMatch(/accept the agreement/i);
  });

  it('allows an existing active mailbox to accept terms without rotating its password', () => {
    expect(validateMailboxSetup({ ...validSetup, requiresPassword: false })).toBe('');
  });

  it('requires a secure token for officer activation and password reset', () => {
    expect(validateMailboxSetup({ ...validSetup, requiresSecureToken: true })).toMatch(/secure activation/i);
  });

  it('enforces the eight-character mixed-case mailbox password policy', () => {
    expect(validateMailboxSetup({ ...validSetup, password: 'Short1', confirmation: 'Short1' })).toMatch(/at least 8/i);
    expect(validateMailboxSetup({ ...validSetup, password: 'lowercase1', confirmation: 'lowercase1' })).toMatch(/uppercase/i);
  });

  it('generates deterministic duplicate-name candidates', () => {
    expect(deterministicMailboxCandidates('john.smith', 4)).toEqual([
      'john.smith',
      'john.smith2',
      'john.smith3',
      'john.smith4',
    ]);
  });

  it('honours policy reacceptance and preserves earlier receipts when reacceptance is disabled', () => {
    expect(currentAgreementIsSatisfied({ currentPolicyId: 'v2', currentPolicyRequiresReacceptance: true, acceptedPolicyIds: ['v1'] })).toBe(false);
    expect(currentAgreementIsSatisfied({ currentPolicyId: 'v2', currentPolicyRequiresReacceptance: false, acceptedPolicyIds: ['v1'] })).toBe(true);
  });
});
