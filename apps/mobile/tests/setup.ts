import AsyncStorage from '@react-native-async-storage/async-storage';

import { setupApiClient } from '@/lib/api';

import { resetSecureStore } from './mocks/secure-store';
import { server } from './server';

jest.mock('expo-linking', () => ({
  ...jest.requireActual<object>('expo-linking'),
  createURL: (path: string) => `teamstasks://${path.replace(/^\//, '')}`,
}));

server.listen({ onUnhandledRequest: 'error' });

beforeEach(async () => {
  resetSecureStore();
  await AsyncStorage.clear();
  setupApiClient(async () => null);
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
