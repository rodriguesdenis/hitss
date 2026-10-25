import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { delay, http, HttpResponse } from 'msw';

import { renderWithProviders } from '../../../../tests/renderWithProviders';
import { API_URL } from '../../../../tests/fixtures';
import {
  marina,
  MARINA_PASSWORD,
  MARINA_TOKEN,
} from '../../../../tests/handlers/auth';
import { setNetwork } from '../../../../tests/mocks/netinfo';
import { server } from '../../../../tests/server';
import { startNetwork } from '@/offline/network';
import { useSessionStore } from '../session.store';
import { getToken } from '../token';
import { SignInScreen } from './SignInScreen';

const signInUrl = `${API_URL}/api/auth/sign-in/email`;

async function fillAndSubmit(email: string, password: string) {
  await fireEvent.changeText(screen.getByLabelText('E-mail'), email);
  await fireEvent.changeText(screen.getByLabelText('Senha'), password);
  await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));
}

describe('SignInScreen', () => {
  beforeEach(() => {
    useSessionStore.setState({ expired: false, signingOut: false });
  });

  it('validates the fields before calling the API', async () => {
    const calls = jest.fn();
    server.events.on('request:start', calls);
    await renderWithProviders(<SignInScreen />);
    await fireEvent.changeText(screen.getByLabelText('E-mail'), 'marina');
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));
    expect(
      await screen.findByLabelText('E-mail, Informe um e-mail válido'),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Senha, Este campo é obrigatório'),
    ).toBeOnTheScreen();
    expect(calls).not.toHaveBeenCalled();
    server.events.removeAllListeners();
  });

  it('AC-04.1.3 rejects wrong credentials without saying which one is wrong', async () => {
    await renderWithProviders(<SignInScreen />);
    await fillAndSubmit(marina.email, 'wrong-password');
    expect(
      await screen.findByText('E-mail ou senha incorretos'),
    ).toBeOnTheScreen();
    await expect(getToken()).resolves.toBeNull();
  });

  it.each([
    ['12', '12'],
    ['600', '60'],
    ['0', '1'],
    ['nope', '60'],
  ])(
    'shows the rate-limit wait from X-Retry-After %s as %s s',
    async (header, seconds) => {
      server.use(
        http.post(signInUrl, () =>
          HttpResponse.json(
            { code: 'RATE_LIMITED', message: 'Too many requests' },
            { status: 429, headers: { 'X-Retry-After': header } },
          ),
        ),
      );
      await renderWithProviders(<SignInScreen />);
      await fillAndSubmit(marina.email, MARINA_PASSWORD);
      expect(
        await screen.findByText(
          `Muitas requisições. Tente novamente em ${seconds} s.`,
        ),
      ).toBeOnTheScreen();
    },
  );

  it('explains a network failure', async () => {
    server.use(http.post(signInUrl, () => HttpResponse.error()));
    await renderWithProviders(<SignInScreen />);
    await fillAndSubmit(marina.email, MARINA_PASSWORD);
    expect(
      await screen.findByText(
        'Não foi possível conectar ao servidor. Verifique sua conexão.',
      ),
    ).toBeOnTheScreen();
  });

  it('disables the form while submitting', async () => {
    server.use(
      http.post(signInUrl, async () => {
        await delay('infinite');
        return HttpResponse.json({});
      }),
    );
    await renderWithProviders(<SignInScreen />);
    await fillAndSubmit(marina.email, MARINA_PASSWORD);
    const button = await screen.findByRole('button', { name: 'Entrando…' });
    expect(button).toBeDisabled();
    expect(screen.getByLabelText('E-mail')).toHaveProp('editable', false);
    expect(screen.getByLabelText('Senha')).toHaveProp('editable', false);
  });

  it('labels the show/hide password toggle', async () => {
    await renderWithProviders(<SignInScreen />);
    expect(screen.getByLabelText('Senha')).toHaveProp('secureTextEntry', true);
    await fireEvent.press(
      screen.getByRole('button', { name: 'Mostrar senha' }),
    );
    expect(screen.getByLabelText('Senha')).toHaveProp('secureTextEntry', false);
    expect(
      screen.getByRole('button', { name: 'Ocultar senha' }),
    ).toBeOnTheScreen();
  });

  it('AC-04.1.6 shows the session-expired message after a redirect', async () => {
    useSessionStore.setState({ expired: true });
    await renderWithProviders(<SignInScreen />);
    expect(
      screen.getByText('Sua sessão expirou. Entre novamente.'),
    ).toBeOnTheScreen();
  });

  it('stores the token on success', async () => {
    await renderWithProviders(<SignInScreen />);
    await fillAndSubmit(marina.email, MARINA_PASSWORD);
    await waitFor(async () => expect(await getToken()).toBe(MARINA_TOKEN));
  });
});

describe('SignInScreen offline', () => {
  it('needs a connection to sign in', async () => {
    const stop = startNetwork();
    setNetwork({ isConnected: false });
    await renderWithProviders(<SignInScreen />);
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeDisabled();
    expect(
      screen.getByText('Você precisa de conexão para entrar'),
    ).toBeOnTheScreen();
    await act(() => setNetwork({ isConnected: true }));
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled();
    expect(
      screen.queryByText('Você precisa de conexão para entrar'),
    ).toBeNull();
    stop();
  });
});
