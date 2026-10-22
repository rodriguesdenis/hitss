import { expectProbePassed, runProbeInTimeZone } from '../support/in-time-zone';

/**
 * TaskMapper keeps calendar days whatever the process's zone. A test cannot change its own
 * process's zone, so each zone runs a probe in a child process (seconds each), which is why it
 * lives in the integration project rather than the fast unit run. The repository probe (a real
 * write and read) is in prisma-task.repository.int-spec.ts.
 */
describe('Task due dates across time zones (T-003-04)', () => {
  it.each(['Pacific/Kiritimati', 'America/Los_Angeles'])(
    'TaskMapper keeps year-edge calendar days with the process in %s',
    (zone) => {
      expectProbePassed(runProbeInTimeZone('task-mapper.tz-probe.ts', zone));
    },
    120_000,
  );
});
