import { describe, expect, it } from 'vitest';
import { canAccessLodgeGuidePilot, cleanLodgeGuideAnswer } from './lodgeGuide';

describe('Lodge Guide pilot access', () => {
  it('is available only to full administrators when enabled', () => {
    expect(canAccessLodgeGuidePilot(true, true)).toBe(true);
    expect(canAccessLodgeGuidePilot(true, false)).toBe(false);
  });

  it('remains unavailable when the feature flag is disabled', () => {
    expect(canAccessLodgeGuidePilot(false, true)).toBe(false);
    expect(canAccessLodgeGuidePilot(false, false)).toBe(false);
  });
});

describe('Lodge Guide answer display', () => {
  it('removes unsupported Markdown emphasis and code marks', () => {
    expect(cleanLodgeGuideAnswer('Choose **My Lodge** or `Summons`.')).toBe(
      'Choose My Lodge or Summons.',
    );
  });
});
