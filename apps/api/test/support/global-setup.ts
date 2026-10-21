import { startTestServer, StartedTestServer } from './postgres';

declare global {
  var __TEST_POSTGRES__: StartedTestServer | undefined;
}

/** One PostgreSQL container per Jest run, shared by every test file through template clones. */
export default async function globalSetup(): Promise<void> {
  globalThis.__TEST_POSTGRES__ = await startTestServer();
}
