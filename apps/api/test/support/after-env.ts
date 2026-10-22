import { DATABASE_TEST_TIMEOUT } from './timeouts';
import { dropTestDatabases } from './postgres';

jest.setTimeout(DATABASE_TEST_TIMEOUT);

afterAll(async () => {
  await dropTestDatabases();
});
