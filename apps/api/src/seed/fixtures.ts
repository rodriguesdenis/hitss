// Deterministic demo data (ADR-0004): fixed literals, fixed ids, fixed timestamps, no faker and no
// randomness. Only due dates are computed, relative to the seeding day, so the overdue task is
// always overdue and the upcoming ones always upcoming (data-model → Migrations & seeding).

export const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001';
export const DEMO_EMAIL = 'demo@teams-tasks.dev';
export const DEMO_NAME = 'Demo User';
// A documented, public demo credential (README); the seed never runs in production.
export const DEMO_PASSWORD = 'Demo@1234';

const TEAM_MOBILE = '00000000-0000-4000-8000-0000000000a1';
const TEAM_BACKEND = '00000000-0000-4000-8000-0000000000a2';
const TEAM_DESIGN = '00000000-0000-4000-8000-0000000000a3';

export const DEMO_TEAM_IDS = [TEAM_MOBILE, TEAM_BACKEND, TEAM_DESIGN];

export interface TeamFixture {
  id: string;
  name: string;
  colorHex: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export type SeedTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE';

export interface TaskFixture {
  id: string;
  title: string;
  description: string | null;
  status: SeedTaskStatus;
  /** `YYYY-MM-DD`, relative to the seeding day. */
  dueDate: string | null;
  completedAt: Date | null;
  teamIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

const at = (iso: string) => new Date(iso);

export function demoTeamFixtures(): TeamFixture[] {
  return [
    {
      id: TEAM_MOBILE,
      name: 'Mobile',
      colorHex: '#7C3AED',
      description:
        'The Expo app: screens, offline behavior and release builds.',
      createdAt: at('2026-01-05T09:00:00.000Z'),
      updatedAt: at('2026-01-05T09:00:00.000Z'),
    },
    {
      id: TEAM_BACKEND,
      name: 'Backend',
      colorHex: '#0EA5E9',
      description: 'The REST API, the database and the delivery pipeline.',
      createdAt: at('2026-01-05T09:05:00.000Z'),
      updatedAt: at('2026-01-05T09:05:00.000Z'),
    },
    {
      id: TEAM_DESIGN,
      name: 'Design',
      colorHex: '#F59E0B',
      description: 'Visual language, components and accessibility.',
      createdAt: at('2026-01-05T09:10:00.000Z'),
      updatedAt: at('2026-01-05T09:10:00.000Z'),
    },
  ];
}

/** `YYYY-MM-DD` of the UTC day that is `offsetDays` after the day of `seedDay`. */
function dayOffset(seedDay: Date, offsetDays: number): string {
  const day = new Date(
    Date.UTC(
      seedDay.getUTCFullYear(),
      seedDay.getUTCMonth(),
      seedDay.getUTCDate() + offsetDays,
    ),
  );
  return day.toISOString().slice(0, 10);
}

const taskId = (n: number) =>
  `00000000-0000-4000-8000-00000000b${String(n).padStart(3, '0')}`;

export const DEMO_TASK_IDS = Array.from({ length: 10 }, (_, i) =>
  taskId(i + 1),
);

/**
 * 4 pending, 3 in progress, 3 done. Two tasks are in two teams, one in three, one in none, one is
 * overdue (due 7 days before the seeding day) and the open ones are due between tomorrow and in 21
 * days or have no due date.
 */
export function demoTaskFixtures(seedDay: Date): TaskFixture[] {
  const created = (n: number) =>
    at(`2026-01-10T${String(8 + n).padStart(2, '0')}:00:00.000Z`);
  const task = (
    n: number,
    fields: Pick<
      TaskFixture,
      'title' | 'description' | 'status' | 'teamIds'
    > & {
      dueOffset: number | null;
      completedAt?: string;
    },
  ): TaskFixture => ({
    id: taskId(n),
    title: fields.title,
    description: fields.description,
    status: fields.status,
    dueDate:
      fields.dueOffset === null ? null : dayOffset(seedDay, fields.dueOffset),
    completedAt: fields.completedAt ? at(fields.completedAt) : null,
    teamIds: fields.teamIds,
    createdAt: created(n),
    updatedAt: fields.completedAt ? at(fields.completedAt) : created(n),
  });

  return [
    task(1, {
      title: 'Set up the Expo project structure',
      description: 'Routes, feature folders and shared UI primitives.',
      status: 'DONE',
      teamIds: [TEAM_MOBILE],
      dueOffset: -10,
      completedAt: '2026-02-02T10:00:00.000Z',
    }),
    task(2, {
      title: 'Design the task list screen',
      description:
        'Cards with status and team chips, empty and loading states.',
      status: 'DONE',
      teamIds: [TEAM_DESIGN, TEAM_MOBILE],
      dueOffset: -3,
      completedAt: '2026-02-04T16:30:00.000Z',
    }),
    task(3, {
      title: 'Write the API contract examples',
      description: null,
      status: 'DONE',
      teamIds: [TEAM_BACKEND],
      dueOffset: null,
      completedAt: '2026-02-06T11:15:00.000Z',
    }),
    task(4, {
      title: 'Implement the offline cache',
      description:
        'Persist the query cache and replay queued changes on reconnect.',
      status: 'IN_PROGRESS',
      teamIds: [TEAM_MOBILE, TEAM_BACKEND],
      dueOffset: 7,
    }),
    task(5, {
      title: 'Review the dark mode palette',
      description: 'Check contrast of team colors on dark surfaces.',
      status: 'IN_PROGRESS',
      teamIds: [TEAM_DESIGN],
      dueOffset: 3,
    }),
    task(6, {
      title: 'Add search to the tasks endpoint',
      description: 'Case-insensitive match on title and description.',
      status: 'IN_PROGRESS',
      teamIds: [TEAM_BACKEND],
      dueOffset: 14,
    }),
    task(7, {
      title: 'Fix the login redirect on Android',
      description: 'The deep link opens the app but loses the return path.',
      status: 'PENDING',
      teamIds: [TEAM_MOBILE, TEAM_BACKEND, TEAM_DESIGN],
      dueOffset: 1,
    }),
    task(8, {
      title: 'Plan the release checklist',
      description: null,
      status: 'PENDING',
      teamIds: [],
      dueOffset: 21,
    }),
    task(9, {
      title: 'Migrate the legacy reports to the new schema',
      description: 'Overdue on purpose: it demonstrates the overdue state.',
      status: 'PENDING',
      teamIds: [TEAM_BACKEND],
      dueOffset: -7,
    }),
    task(10, {
      title: 'Refresh the onboarding illustrations',
      description: null,
      status: 'PENDING',
      teamIds: [TEAM_DESIGN],
      dueOffset: null,
    }),
  ];
}
