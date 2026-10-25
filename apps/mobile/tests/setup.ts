import AsyncStorage from '@react-native-async-storage/async-storage';

import { resetSecureStore } from './mocks/secure-store';

beforeEach(async () => {
  resetSecureStore();
  await AsyncStorage.clear();
});
