import { describe, expect, it } from 'vitest';
import {
  lodgeGuideDistrictEventSourceBody,
  lodgeGuideFilterDistrictEvents,
  lodgeGuideQuestionNeedsDistrict,
  lodgeGuideRequestedDegree,
} from '../../supabase/functions/_shared/lodge-guide-district';

describe('Lodge Guide Ottawa District 1 enrichment', () => {
  const events = [
    { degree: 'first', district_lodges: { name: 'Russell Lodge' } },
    { degree: 'third', district_lodges: { name: 'Russell Lodge' } },
    { degree: 'third', district_lodges: { name: 'Renfrew Lodge' } },
  ];

  it('recognizes named visiting lodges and degree questions', () => {
    expect(lodgeGuideQuestionNeedsDistrict('When is the next meeting of Russell Lodge?')).toBe(true);
    expect(lodgeGuideQuestionNeedsDistrict('What lodges are doing a third degree next month?')).toBe(true);
    expect(lodgeGuideQuestionNeedsDistrict('When is our lodge meeting?')).toBe(false);
  });

  it('filters degree and named-lodge questions before sources reach the model', () => {
    expect(lodgeGuideRequestedDegree('Who is doing a 3rd degree?')).toBe('third');
    expect(lodgeGuideFilterDistrictEvents(events, 'When is Russell Lodge doing a third degree?'))
      .toEqual([{ degree: 'third', district_lodges: { name: 'Russell Lodge' } }]);
  });

  it('labels the degree and source lodge explicitly', () => {
    expect(lodgeGuideDistrictEventSourceBody({
      event_date: '2026-09-14',
      event_time: '19:30:00',
      event_end_time: null,
      location: 'Russell Masonic Hall',
      location_address: null,
      event_kind: 'meeting',
      degree: 'third',
      description: null,
      contact_name: null,
      contact_details: null,
      district_lodges: { name: 'Russell Lodge', lodge_number: '479' },
    })).toContain('Degree: third');
  });
});
