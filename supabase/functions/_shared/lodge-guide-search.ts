const SEARCH_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "can",
  "could",
  "do",
  "does",
  "every",
  "find",
  "for",
  "from",
  "give",
  "how",
  "i",
  "in",
  "is",
  "lodge",
  "me",
  "my",
  "of",
  "on",
  "please",
  "show",
  "tell",
  "the",
  "to",
  "what",
  "when",
  "where",
  "who",
  "with",
  "would",
  "you",
  "your",
]);

export const lodgeGuideSearchQueries = (question: string) => {
  const terms = question
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter((term) => term.length >= 3 && !SEARCH_STOP_WORDS.has(term)) ?? [];

  return [question, ...Array.from(new Set(terms)).slice(0, 4)];
};
