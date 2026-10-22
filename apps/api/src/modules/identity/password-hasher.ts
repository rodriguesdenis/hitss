import { hashPassword, verifyPassword } from 'better-auth/crypto';

/**
 * Password hashing used by Better Auth. An abstract class, so it is its own DI token like the
 * ports (ADR-0002); e2e tests override it to observe calls (AC-01.2.7).
 */
export abstract class PasswordHasher {
  abstract hash(password: string): Promise<string>;
  abstract verify(data: { hash: string; password: string }): Promise<boolean>;
}

/** Better Auth's own scrypt functions: production behavior is unchanged (plan: no custom hasher). */
export class BetterAuthPasswordHasher extends PasswordHasher {
  hash(password: string): Promise<string> {
    return hashPassword(password);
  }

  verify(data: { hash: string; password: string }): Promise<boolean> {
    return verifyPassword(data);
  }
}
