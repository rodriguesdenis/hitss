import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = join(__dirname, '../../..');
const HANDLER =
  /@(?:CommandHandler|QueryHandler)\(\s*\w+\s*\)\s*(?:export\s+)?class\s+(\w+)([\s\S]*?)(?=@(?:CommandHandler|QueryHandler|EventsHandler)\(|$)/g;

/** Names of command/query handler classes whose body has no `@Traced()` method. */
export function untracedHandlers(source: string): string[] {
  return [...source.matchAll(HANDLER)]
    .filter(([, , body]) => !/@Traced\(\)/.test(body ?? ''))
    .map(([, name]) => name ?? '');
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.ts$/.test(name) && !/\.spec\.ts$/.test(name) ? [path] : [];
  });
}

describe('use-case spans', () => {
  it('AC-06.2.1 every command and query handler has a @Traced() method', () => {
    const missing = sourceFiles(SRC).flatMap((file) =>
      untracedHandlers(readFileSync(file, 'utf8')).map(
        (name) => `${relative(SRC, file)}: ${name}`,
      ),
    );
    expect(missing).toEqual([]);
  });

  it('AC-06.2.1 the check finds an untraced handler and accepts a traced one', () => {
    const untraced = `@QueryHandler(ListTasks)
export class ListTasksHandler { async execute() {} }`;
    const traced = `@CommandHandler(CreateTask)
export class CreateTaskHandler {
  @Traced()
  async execute() {}
}`;
    expect(untracedHandlers(untraced)).toEqual(['ListTasksHandler']);
    expect(untracedHandlers(traced)).toEqual([]);
    expect(untracedHandlers(`${untraced}\n${traced}`)).toEqual([
      'ListTasksHandler',
    ]);
  });
});
