// Parity between the Bruno collection and the .http files (AC-07.4.3): every Bruno request must
// have a `### <name>` request with the same name in some .http file.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

function walk(dir, extension) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory())
      return entry.name === 'node_modules' ? [] : walk(path, extension);
    return entry.name.endsWith(extension) ? [path] : [];
  });
}

/** Names of the requests (`type: http`) in a Bruno collection; folders and the collection file are skipped. */
export function brunoRequestNames(dir) {
  return walk(dir, '.bru').flatMap((file) => {
    const meta =
      /^meta\s*\{([^}]*)\}/m.exec(readFileSync(file, 'utf8'))?.[1] ?? '';
    if (!/^\s*type:\s*http\s*$/m.test(meta)) return [];
    const name = /^\s*name:\s*(.+?)\s*$/m.exec(meta)?.[1];
    return name ? [name] : [];
  });
}

/** Names of the requests in .http files: the text of each `###` separator line. */
export function httpRequestNames(dir) {
  return walk(dir, '.http').flatMap((file) =>
    [...readFileSync(file, 'utf8').matchAll(/^###\s+(.+?)\s*$/gm)].map(
      (match) => match[1],
    ),
  );
}

/** Bruno request names without a `.http` request of the same name. */
export function checkParity(brunoDir, httpDir) {
  const http = new Set(httpRequestNames(httpDir));
  return [...new Set(brunoRequestNames(brunoDir))].filter(
    (name) => !http.has(name),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const missing = checkParity(
    join(root, 'bruno', 'teams-tasks'),
    join(root, 'http'),
  );
  if (missing.length > 0) {
    console.error(
      `Bruno requests without a .http twin:\n${missing.map((n) => `  - ${n}`).join('\n')}`,
    );
    process.exit(1);
  }
  console.log('Bruno and .http requests are in parity.');
}
