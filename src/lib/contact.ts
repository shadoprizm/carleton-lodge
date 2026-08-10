export const SUPPORT_EMAIL = 'support@carpmasons.ca';

export const supportMailto = (subject?: string) =>
  `mailto:${SUPPORT_EMAIL}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;
