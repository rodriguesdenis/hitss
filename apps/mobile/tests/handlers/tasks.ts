import { http, HttpResponse } from 'msw';

import { API_URL, page, tasks } from '../fixtures';

export const tasksHandlers = [
  http.get(`${API_URL}/api/v1/tasks`, ({ request }) => {
    const url = new URL(request.url);
    const teamId = url.searchParams.get('teamId');
    const statuses = url.searchParams.getAll('status');
    const items = tasks.filter(
      (t) =>
        (!teamId || t.teams.some((chip) => chip.id === teamId)) &&
        (statuses.length === 0 || statuses.includes(t.status)),
    );
    return HttpResponse.json(page(items, url));
  }),
  http.get(`${API_URL}/api/v1/tasks/:id`, ({ params }) => {
    const found = tasks.find((t) => t.id === params.id);
    return found
      ? HttpResponse.json({ data: found })
      : HttpResponse.json(
          {
            error: {
              code: 'TASK_NOT_FOUND',
              message: 'Task not found',
              traceId: 'trace-test',
            },
          },
          { status: 404 },
        );
  }),
];
