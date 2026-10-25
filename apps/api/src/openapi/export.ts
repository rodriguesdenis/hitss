import './offline-env';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildOfflineOpenApiDocument } from './offline-document';

async function main(target: string | undefined): Promise<void> {
  if (!target) {
    throw new Error('usage: export <output.json>');
  }
  const output = resolve(target);
  const document = await buildOfflineOpenApiDocument();
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(document, null, 2)}\n`);
  console.log(`openapi: wrote ${output}`);
}

main(process.argv[2]).catch((error: unknown) => {
  console.error(
    `openapi export failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
