import { useTeamsList, type TeamsListParams } from '@hitss/api-client';
import { screen } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { Text } from 'react-native';

import { qk } from '@/lib/query-keys';

import { API_URL } from './fixtures';
import { renderWithProviders } from './renderWithProviders';
import { server } from './server';

const params: TeamsListParams = { limit: 20, sort: 'name' };

function TeamNames() {
  const { data, error } = useTeamsList(params, {
    query: { queryKey: qk.teams.list(params) },
  });
  if (error) {
    return <Text>{`error ${error.status}`}</Text>;
  }
  return (
    <Text>{data ? data.data.map((t) => t.name).join(', ') : 'loading'}</Text>
  );
}

describe('generated hooks through the mutator', () => {
  it('fetches a list from the API into the qk cache entry', async () => {
    const { queryClient } = await renderWithProviders(<TeamNames />);
    expect(
      await screen.findByText('Backend, Design, Mobile'),
    ).toBeOnTheScreen();
    expect(queryClient.getQueryData(qk.teams.list(params))).toMatchObject({
      meta: { total: 3, hasNextPage: false },
    });
  });

  it('surfaces ApiError status to the component', async () => {
    server.use(
      http.get(`${API_URL}/api/v1/teams`, () =>
        HttpResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: 'x', traceId: 't' } },
          { status: 500 },
        ),
      ),
    );
    await renderWithProviders(<TeamNames />);
    expect(await screen.findByText('error 500')).toBeOnTheScreen();
  });
});
