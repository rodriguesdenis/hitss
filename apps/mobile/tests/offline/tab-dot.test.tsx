import TabsLayout from '../../app/(tabs)/_layout';

import { act, queryClient, renderApp, screen } from '../app-harness';
import { MARINA_TOKEN } from '../handlers/auth';

it('AC-05.2.2 shows a pending indicator on the Tasks tab', async () => {
  await renderApp({
    token: MARINA_TOKEN,
    initialUrl: '/tasks',
    routes: { '(tabs)/_layout': TabsLayout },
  });
  await screen.findByText('tasks screen');
  expect(
    screen.queryByLabelText('Tarefas, alterações aguardando sincronização'),
  ).toBeNull();
  await act(async () => {
    void queryClient()
      .getMutationCache()
      .build(queryClient(), {
        mutationKey: ['tasks', 'probe'],
        mutationFn: () => new Promise(() => undefined),
      })
      .execute(undefined);
  });
  expect(
    await screen.findByLabelText(
      'Tarefas, alterações aguardando sincronização',
    ),
  ).toBeOnTheScreen();
});
