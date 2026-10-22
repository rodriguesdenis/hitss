import type { AuthInstance } from '../modules/identity/auth.factory';
import type { PrismaService } from '../shared/infrastructure/prisma/prisma.service';
import { DEMO_EMAIL, DEMO_NAME, DEMO_PASSWORD, DEMO_USER_ID } from './fixtures';

/**
 * Creates the demo account through Better Auth, so the password hash is the library's own, with the
 * fixed DEMO_USER_ID (the auth instance was built with `fixedUserId`). The account is looked up by
 * that id, never by email alone: when it exists nothing is touched, so the password, the id and
 * `updated_at` stay as they were (AC-01.8.2).
 */
export async function seedDemoUser(
  prisma: Pick<PrismaService, 'user'>,
  auth: Pick<AuthInstance, 'api'>,
): Promise<'created' | 'existing'> {
  const existing = await prisma.user.findUnique({
    where: { id: DEMO_USER_ID },
    select: { id: true },
  });
  if (existing) return 'existing';

  try {
    await auth.api.signUpEmail({
      body: { name: DEMO_NAME, email: DEMO_EMAIL, password: DEMO_PASSWORD },
    });
  } catch (error) {
    throw new Error(
      `Cannot create the demo account ${DEMO_EMAIL}: it may already belong to another account (reset the database or remove it). Cause: ${
        error instanceof Error ? error.name : typeof error
      }`,
    );
  }
  const created = await prisma.user.findUnique({
    where: { id: DEMO_USER_ID },
    select: { id: true },
  });
  if (!created) {
    throw new Error(
      `The demo account was created without the fixed id ${DEMO_USER_ID}`,
    );
  }
  return 'created';
}
