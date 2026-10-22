import { BetterAuthPasswordHasher } from '../../password-hasher';

describe('BetterAuthPasswordHasher', () => {
  const hasher = new BetterAuthPasswordHasher();
  const password = ['plain', 'value', '42'].join('-');

  it("uses Better Auth's salted hash: verifiable, never the plain value, different each time", async () => {
    const first = await hasher.hash(password);
    const second = await hasher.hash(password);

    expect(first).not.toContain(password);
    expect(first).not.toBe(second);
    await expect(hasher.verify({ hash: first, password })).resolves.toBe(true);
    await expect(
      hasher.verify({ hash: first, password: `${password}!` }),
    ).resolves.toBe(false);
  });
});
