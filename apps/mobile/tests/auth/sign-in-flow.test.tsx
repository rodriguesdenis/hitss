import { SignInScreen } from '@/features/auth';

import { fireEvent, getToken, renderApp, screen } from '../app-harness';
import { marina, MARINA_PASSWORD, MARINA_TOKEN } from '../handlers/auth';

it('AC-04.1.2 signs in with valid credentials and lands on the tasks list', async () => {
  await renderApp({ initialUrl: '/', signInScreen: SignInScreen });
  await fireEvent.changeText(
    await screen.findByLabelText('E-mail'),
    marina.email,
  );
  await fireEvent.changeText(screen.getByLabelText('Senha'), MARINA_PASSWORD);
  await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));
  expect(await screen.findByText('tasks screen')).toBeOnTheScreen();
  await expect(getToken()).resolves.toBe(MARINA_TOKEN);
});
