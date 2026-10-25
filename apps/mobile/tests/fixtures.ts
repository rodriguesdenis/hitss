import type {
  TaskResponseDto,
  TeamChipDto,
  TeamResponseDto,
} from '@hitss/api-client';

export const API_URL = 'http://api.test';

const stamp = '2026-10-01T12:00:00.000Z';

function team(id: string, name: string, colorHex: string, taskCount: number) {
  return {
    id,
    name,
    colorHex,
    description: null,
    taskCount,
    createdAt: stamp,
    updatedAt: stamp,
    version: 1,
  } satisfies TeamResponseDto;
}

export const teams = [
  team('team-backend', 'Backend', '#0EA5E9', 1),
  team('team-design', 'Design', '#EC4899', 1),
  team('team-mobile', 'Mobile', '#7C3AED', 2),
];

const chip = (name: string): TeamChipDto => {
  const { id, colorHex } = teams.find((t) => t.name === name)!;
  return { id, name, colorHex };
};

function task(
  id: string,
  title: string,
  status: TaskResponseDto['status'],
  teamNames: string[],
  dueDate: string | null,
  isOverdue = false,
) {
  return {
    id,
    title,
    status,
    description: null,
    dueDate,
    isOverdue,
    teams: teamNames.map(chip),
    completedAt: status === 'DONE' ? stamp : null,
    createdAt: stamp,
    updatedAt: stamp,
    version: 1,
  } satisfies TaskResponseDto;
}

export const tasks = [
  task(
    'task-login',
    'Implement login screen',
    'IN_PROGRESS',
    ['Backend', 'Mobile'],
    '2026-10-31',
  ),
  task(
    'task-crash',
    'Fix crash on Android',
    'PENDING',
    ['Mobile'],
    '2026-10-12',
    true,
  ),
  task('task-palette', 'Define color palette', 'DONE', ['Design'], null),
  task('task-deps', 'Update dependencies', 'PENDING', [], null),
];

export function page<T>(items: T[], url: URL) {
  const limit = Number(url.searchParams.get('limit') ?? 20);
  const offset = Number(url.searchParams.get('offset') ?? 0);
  return {
    data: items.slice(offset, offset + limit),
    meta: {
      total: items.length,
      limit,
      offset,
      hasNextPage: offset + limit < items.length,
    },
  };
}
