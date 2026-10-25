import { http, HttpResponse } from 'msw';

import { API_URL, page, teams } from '../fixtures';

export const teamsHandlers = [
  http.get(`${API_URL}/api/v1/teams`, ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get('search')?.toLowerCase();
    const items = search
      ? teams.filter((t) => t.name.toLowerCase().includes(search))
      : teams;
    return HttpResponse.json(page(items, url));
  }),
  http.get(`${API_URL}/api/v1/teams/:id`, ({ params }) => {
    const found = teams.find((t) => t.id === params.id);
    return found
      ? HttpResponse.json({ data: found })
      : HttpResponse.json(
          {
            error: {
              code: 'TEAM_NOT_FOUND',
              message: 'Team not found',
              traceId: 'trace-test',
            },
          },
          { status: 404 },
        );
  }),
];
