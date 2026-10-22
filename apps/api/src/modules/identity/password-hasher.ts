import { hashPassword, verifyPassword } from 'better-auth/crypto';

export abstract class PasswordHasher {
  abstract hash(password: string): Promise<string>;
  abstract verify(data: { hash: string; password: string }): Promise<boolean>;
}

export class BetterAuthPasswordHasher extends PasswordHasher {
  hash(password: string): Promise<string> {
    return hashPassword(password);
  }

  verify(data: { hash: string; password: string }): Promise<boolean> {
    return verifyPassword(data);
  }
}
