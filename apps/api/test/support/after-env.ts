import { dropTestDatabases } from './postgres';

// Root-level hook: runs after every hook of the test file's describe blocks, so apps and clients
// are closed before their databases are dropped (DROP ... WITH (FORCE) ends open connections).
afterAll(async () => {
  await dropTestDatabases();
});
