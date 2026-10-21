import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Tracked files that are env files holding real values (`.env`, `.env.*`, `.envrc`) — `.env.example` is the template. */
export function findTrackedEnvFiles(files) {
  return files.filter((file) => {
    const name = basename(file);
    return (
      (name === '.env' || name === '.envrc' || name.startsWith('.env.')) &&
      name !== '.env.example'
    );
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
  const offenders = findTrackedEnvFiles(tracked);
  if (offenders.length > 0) {
    console.error(
      `Tracked env files must never be committed (secrets live in the gitignored .env):\n${offenders.map((f) => `  ${f}`).join('\n')}`,
    );
    process.exit(1);
  }
  console.log('No tracked .env files.');
}
