import { DATABASE_TEST_TIMEOUT } from './timeouts';
import { dropTestDatabases } from './postgres';

// Jest 30 ignores a per-project `testTimeout`; setting it here (a setupFilesAfterEnv file of the
// integration and e2e projects) is what makes it effective. Unit tests keep the 5 s default.
jest.setTimeout(DATABASE_TEST_TIMEOUT);

// Root-level hook: runs after every hook of the test file's describe blocks, so apps and clients
// are closed before their databases are dropped (DROP ... WITH (FORCE) ends open connections).
afterAll(async () => {
  await dropTestDatabases();
});
