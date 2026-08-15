import { describe, expect, it } from 'vitest';
import vercelConfigRaw from '../../vercel.json?raw';

type VercelRoute = {
  headers?: Record<string, string>;
};

describe('document preview deployment configuration', () => {
  it('allows the Microsoft Office preview frame in the production CSP', () => {
    const config = JSON.parse(vercelConfigRaw) as { routes: VercelRoute[] };
    const contentSecurityPolicy = config.routes
      .map((route) => route.headers?.['Content-Security-Policy'])
      .find(Boolean);

    expect(contentSecurityPolicy).toContain(
      "frame-src 'self' blob: https://*.supabase.co https://*.officeapps.live.com",
    );
  });
});
