jest.setTimeout(60_000);

export function activeZone(): string {
  const zone = process.env.TZ;
  if (!zone) {
    throw new Error(
      'Run probes through test/support/in-time-zone.ts (TZ must be set)',
    );
  }
  expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(zone);
  return zone;
}

export const CALENDAR_EDGES = [
  '2026-12-31',
  '2027-01-01',
  '2026-01-01',
  '2028-02-29',
];
