export const ROLE_MAILBOX_REMINDER_OPT_OUT_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export const roleMailboxReminderOptOutTokenFromHash = (hash: string) => {
  const parameters = new URLSearchParams(hash.replace(/^#/, ''));
  const token = parameters.get('token') ?? '';
  return ROLE_MAILBOX_REMINDER_OPT_OUT_TOKEN_PATTERN.test(token) ? token : '';
};
