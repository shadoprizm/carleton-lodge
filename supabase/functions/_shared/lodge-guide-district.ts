export type LodgeGuideDistrictEventRow = {
  degree: string;
  district_lodges: { name: string } | null;
};

const DISTRICT_TOPIC_PATTERN = /\b(ottawa district|district 1|district one|visiting|first degree|second degree|third degree|degree work|degrees?)\b/i;
const NAMED_LODGE_PATTERN = /\b([a-z0-9][a-z0-9'’-]*)\s+lodge\b/i;
const CARLETON_REFERENCES = new Set(['carleton', 'our', 'the', 'this']);

export const lodgeGuideQuestionNeedsDistrict = (question: string) => {
  if (DISTRICT_TOPIC_PATTERN.test(question)) return true;
  const namedLodge = question.match(NAMED_LODGE_PATTERN)?.[1]
    ?.toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return Boolean(namedLodge && !CARLETON_REFERENCES.has(namedLodge));
};

export const lodgeGuideRequestedDegree = (question: string) => {
  const normalized = question.toLowerCase();
  if (/\b(first|1st)\s+degree\b/.test(normalized)) return 'first';
  if (/\b(second|2nd)\s+degree\b/.test(normalized)) return 'second';
  if (/\b(third|3rd)\s+degree\b/.test(normalized)) return 'third';
  return null;
};

export const lodgeGuideFilterDistrictEvents = <T extends LodgeGuideDistrictEventRow>(
  events: T[],
  question: string,
) => {
  const requestedDegree = lodgeGuideRequestedDegree(question);
  const degreeMatches = requestedDegree
    ? events.filter((event) => event.degree === requestedDegree)
    : events;
  const questionLower = question.toLowerCase();
  const namedMatches = degreeMatches.filter((event) => {
    const lodgeName = event.district_lodges?.name.trim().toLowerCase();
    return Boolean(lodgeName && questionLower.includes(lodgeName));
  });
  return namedMatches.length > 0 ? namedMatches : degreeMatches;
};

export const lodgeGuideDistrictEventSourceBody = (event: {
  event_date: string;
  event_time: string | null;
  event_end_time: string | null;
  location: string;
  location_address: string | null;
  event_kind: string;
  degree: string;
  description: string | null;
  contact_name: string | null;
  contact_details: string | null;
  district_lodges: { name: string; lodge_number: string | null } | null;
}) => [
  `Visiting lodge: ${event.district_lodges?.name ?? 'Not specified'}`,
  event.district_lodges?.lodge_number ? `Lodge number: ${event.district_lodges.lodge_number}` : null,
  `Date: ${event.event_date}`,
  `Start time: ${event.event_time ?? 'Not specified'}`,
  `End time: ${event.event_end_time ?? 'Not specified'}`,
  'Time zone: America/Toronto',
  `Location: ${event.location}`,
  event.location_address ? `Address: ${event.location_address}` : null,
  `Event type: ${event.event_kind}`,
  `Degree: ${event.degree}`,
  event.description ? `Description: ${event.description}` : null,
  event.contact_name ? `Contact: ${event.contact_name}` : null,
  event.contact_details ? `Contact details: ${event.contact_details}` : null,
].filter((value): value is string => value !== null).join('\n');
