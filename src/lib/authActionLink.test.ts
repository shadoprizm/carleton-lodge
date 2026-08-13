import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_SETUP_REDIRECT_URL,
  validateAccountSetupActionLink,
} from '../../supabase/functions/_shared/auth-action-link';

const actionLink = (redirectTo: string, overrides = '') =>
  `https://isnxsygngysxgzeuhmjm.supabase.co/auth/v1/verify?token=secret&type=recovery&redirect_to=${encodeURIComponent(redirectTo)}${overrides}`;

describe('account setup action-link validation', () => {
  it('accepts the exact production reset destination', () => {
    const link = actionLink(ACCOUNT_SETUP_REDIRECT_URL);

    expect(validateAccountSetupActionLink(link)).toBe(link);
  });

  it.each([
    'http://localhost:3000',
    'https://www.carpmasons.ca',
    'https://www.carpmasons.ca/my-lodge',
    'https://carpmasons.ca/reset-password',
  ])('rejects the unexpected redirect %s', (redirectTo) => {
    expect(() => validateAccountSetupActionLink(actionLink(redirectTo))).toThrow(
      'did not preserve the production account setup redirect',
    );
  });

  it('rejects an insecure action URL', () => {
    const link = actionLink(ACCOUNT_SETUP_REDIRECT_URL).replace(
      'https://isnxsygngysxgzeuhmjm.supabase.co',
      'http://isnxsygngysxgzeuhmjm.supabase.co',
    );

    expect(() => validateAccountSetupActionLink(link)).toThrow(
      'insecure account setup URL',
    );
  });

  it('rejects malformed and incomplete action URLs', () => {
    expect(() => validateAccountSetupActionLink('not-a-url')).toThrow(
      'invalid account setup URL',
    );
    expect(() =>
      validateAccountSetupActionLink(
        'https://isnxsygngysxgzeuhmjm.supabase.co/auth/v1/verify?token=secret&type=recovery',
      ),
    ).toThrow('did not preserve the production account setup redirect');
  });
});
