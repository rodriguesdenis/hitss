export default async function globalTeardown(): Promise<void> {
  await globalThis.__TEST_POSTGRES__?.container.stop();
  globalThis.__TEST_POSTGRES__ = undefined;
}
