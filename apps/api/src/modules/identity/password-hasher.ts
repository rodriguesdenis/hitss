import { hashPassword, verifyPassword } from 'better-auth/crypto';

/** Better Auth's password functions (scrypt, salted), injectable so e2e tests can observe them. */
export interface PasswordHasher {
  hash: (password: string) => Promise<string>;
  verify: (data: { hash: string; password: string }) => Promise<boolean>;
}

export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');

/** Better Auth's own defaults: production behavior is unchanged (plan: no custom hasher). */
export const defaultPasswordHasher: PasswordHasher = {
  hash: hashPassword,
  verify: verifyPassword,
};
