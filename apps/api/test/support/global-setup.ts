import { startTestServer, StartedTestServer } from './postgres';

declare global {
  var __TEST_POSTGRES__: StartedTestServer | undefined;
}

export default async function globalSetup(): Promise<void> {
  globalThis.__TEST_POSTGRES__ = await startTestServer();
}
