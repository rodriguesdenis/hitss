/** The zone this probe process runs in; fails loudly if the parent did not set one. */
export function activeZone(): string {
  const zone = process.env.TZ;
  if (!zone) {
    throw new Error(
      'Run probes through test/support/in-time-zone.ts (TZ must be set)',
    );
  }
  // Proves the zone is in effect for Date and Intl, not just present in the environment.
  expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(zone);
  return zone;
}

export const CALENDAR_EDGES = [
  '2026-12-31',
  '2027-01-01',
  '2026-01-01',
  '2028-02-29',
];
