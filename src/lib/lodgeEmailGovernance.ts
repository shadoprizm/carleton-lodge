import { MIN_MAILBOX_PASSWORD_LENGTH } from './mailboxPassword';

export type MailboxSetupValidation = {
  needsAgreement: boolean;
  agreementAccepted: boolean;
  requiresPassword: boolean;
  password: string;
  confirmation: string;
  requiresSecureToken: boolean;
  hasSecureToken: boolean;
};

export function validateMailboxSetup(input: MailboxSetupValidation) {
  if (input.needsAgreement && !input.agreementAccepted) {
    return 'Please read and accept the agreement before continuing.';
  }
  if (input.requiresSecureToken && !input.hasSecureToken) {
    return 'Open the current secure activation or password-reset link sent to your personal email.';
  }
  if (!input.requiresPassword) return '';
  if (input.password.length < MIN_MAILBOX_PASSWORD_LENGTH) {
    return `Use at least ${MIN_MAILBOX_PASSWORD_LENGTH} characters for your lodge email password.`;
  }
  if (!/[a-z]/.test(input.password) || !/[A-Z]/.test(input.password) || !/[0-9]/.test(input.password)) {
    return 'Include at least one uppercase letter, one lowercase letter, and one number.';
  }
  if (input.password !== input.confirmation) return 'The two passwords do not match.';
  return '';
}

export function deterministicMailboxCandidates(baseName: string, maximum = 100) {
  return Array.from({ length: maximum }, (_, index) =>
    index === 0 ? baseName : `${baseName}${index + 1}`
  );
}

export function currentAgreementIsSatisfied(input: {
  currentPolicyId: string;
  currentPolicyRequiresReacceptance: boolean;
  acceptedPolicyIds: string[];
}) {
  return input.currentPolicyRequiresReacceptance
    ? input.acceptedPolicyIds.includes(input.currentPolicyId)
    : input.acceptedPolicyIds.length > 0;
}
