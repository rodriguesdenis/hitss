import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { storedKeys } from '../../../tests/mocks/secure-store';
import { chunkKeys, deleteToken, getToken, setToken } from './token';

describe('session token store', () => {
  it('has no token before sign-in', async () => {
    await expect(getToken()).resolves.toBeNull();
  });

  it('keeps the token in SecureStore only', async () => {
    await setToken('tok_123');
    await expect(getToken()).resolves.toBe('tok_123');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'teamstasks.session-token',
      'tok_123',
    );
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('deletes the token', async () => {
    await setToken('tok_123');
    await deleteToken();
    await expect(getToken()).resolves.toBeNull();
  });
});

describe('auth client storage', () => {
  it.each([
    ['ba-chunks:2', ['k.0', 'k.1']],
    ['ba-chunks:2:0', ['k.0.0', 'k.0.1']],
    ['ba-chunks:1:1:3', ['k.1.0', 'k.0.0', 'k.0.1', 'k.0.2']],
    ['{"plain":"cookie"}', []],
    ['ba-chunks:x', []],
  ])('finds the chunk keys of %s', (stored, keys) => {
    expect(chunkKeys('k', stored)).toEqual(keys);
  });

  it('deletes chunked cookie and session-cache keys with the token', async () => {
    await setToken('tok_123');
    await SecureStore.setItemAsync('teamstasks_cookie', 'ba-chunks:2:0:1');
    for (const key of [
      'teamstasks_cookie.0.0',
      'teamstasks_cookie.0.1',
      'teamstasks_cookie.1.0',
    ]) {
      await SecureStore.setItemAsync(key, 'part');
    }
    await SecureStore.setItemAsync('teamstasks_session_data', 'ba-chunks:1');
    await SecureStore.setItemAsync('teamstasks_session_data.0', 'part');

    await deleteToken();

    expect(storedKeys()).toEqual([]);
  });
});
