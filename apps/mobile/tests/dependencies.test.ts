import pkg from '../package.json';

describe('apps/mobile dependencies', () => {
  it('AC-04.15.1 declares no CSS-in-JS library', () => {
    const names = Object.keys({
      ...pkg.dependencies,
      ...pkg.devDependencies,
    });
    expect(
      names.filter((name) => /^(styled-components|@emotion\/)/.test(name)),
    ).toEqual([]);
  });
});
