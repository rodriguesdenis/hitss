import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { deleteToken, getToken, setToken } from './token';

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
