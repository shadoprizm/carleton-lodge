const compactMasonicHonorifics = new Set([
  "wbro",
  "vwbro",
  "rwbro",
  "mwbro",
  "vw",
  "rw",
  "mw",
  "wm",
]);

/**
 * Returns the local-part base used for a member's lodge mailbox.
 *
 * Masonic styles are often written as separate initials, for example
 * "V. W. Bro. Blake Farmer". When "Bro." or "Brother" is present, every
 * leading token through that title belongs to the style—not the member's
 * given name. A genuine name such as "J. Smith" remains "j.smith".
 */
export function mailboxBaseName(fullName: string) {
  const tokens = fullName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) ?? [];

  const brotherTitleIndex = tokens.findIndex(
    (token) => token === "bro" || token === "brother",
  );
  const titledNameTokens = brotherTitleIndex >= 0
    ? tokens.slice(brotherTitleIndex + 1)
    : tokens.filter((token) => !compactMasonicHonorifics.has(token));
  const firstFullNameIndex = titledNameTokens.findIndex(
    (token) => token.length > 1,
  );
  const nameTokens = brotherTitleIndex >= 0 &&
      firstFullNameIndex > 0 &&
      titledNameTokens.length - firstFullNameIndex >= 2
    ? titledNameTokens.slice(firstFullNameIndex)
    : titledNameTokens;

  if (nameTokens.length >= 2) {
    return `${nameTokens[0]}.${nameTokens[nameTokens.length - 1]}`;
  }
  if (nameTokens.length === 1) return nameTokens[0];
  return "member";
}

export function proposedLodgeEmail(
  fullName: string,
  domain = "carpmasons.ca",
) {
  return `${mailboxBaseName(fullName)}@${domain}`;
}
