import AsyncStorage from '@react-native-async-storage/async-storage';
import { onlineManager } from '@tanstack/react-query';

import { setupApiClient } from '@/lib/api';

import { resetDb } from './db';
import { resetNetwork } from './mocks/netinfo';
import { resetSecureStore } from './mocks/secure-store';
import { server } from './server';

jest.mock('expo-linking', () => ({
  ...jest.requireActual<object>('expo-linking'),
  createURL: (path: string) => `teamstasks://${path.replace(/^\//, '')}`,
}));

server.listen({ onUnhandledRequest: 'error' });

beforeEach(async () => {
  resetSecureStore();
  resetDb();
  await AsyncStorage.clear();
  setupApiClient(async () => null);
});

afterEach(() => {
  resetNetwork();
  onlineManager.setOnline(true);
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
