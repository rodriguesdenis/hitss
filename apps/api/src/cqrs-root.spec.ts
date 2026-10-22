import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.ts$/.test(name) && !/\.spec\.ts$/.test(name) ? [path] : [];
  });
}

describe('CQRS root', () => {
  it('AC-06.4.2 CqrsModule.forRoot() is called once, in AppModule (one EventBus)', () => {
    const roots = sourceFiles(__dirname)
      .filter((file) =>
        /CqrsModule\.forRoot\(/.test(
          readFileSync(file, 'utf8').replace(/\/\/.*$/gm, ''),
        ),
      )
      .map((file) => relative(__dirname, file));
    expect(roots).toEqual(['app.module.ts']);
  });
});
