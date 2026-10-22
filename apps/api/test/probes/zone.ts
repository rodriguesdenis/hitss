// The probes run in their own Jest project without setupFilesAfterEnv, so the 5 s default would apply
// to their database work. 60 s stays below the parent's PROBE_TIMEOUT_MS (90 s in
// test/support/in-time-zone.ts), so a slow probe fails inside the child with a Jest message.
jest.setTimeout(60_000);

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
