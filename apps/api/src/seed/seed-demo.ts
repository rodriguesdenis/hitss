import type { AppConfig } from '../config/app-config';
import type { AuthInstance } from '../modules/identity/auth.factory';
import type { PrismaService } from '../shared/infrastructure/prisma/prisma.service';
import { demoSeedSkipReason } from './gate';
import { seedDemoUser } from './identity.seed';
import { seedTasks } from './tasks.seed';
import { seedTeams } from './teams.seed';

export interface SeedDemoResult {
  seeded: boolean;
  /** Why nothing was written; set when `seeded` is false. */
  skippedBecause?: string;
  user?: 'created' | 'existing';
  teams?: number;
  /** Seeded teams left as they are because the evaluator owns a team with that name. */
  teamsSkipped?: number;
  tasks?: number;
}

/**
 * Seeds the demo account, its 3 teams and its 10 tasks, in dependency order. Writes nothing and
 * succeeds when the gate says so (SEED_DEMO=false or APP_ENV=production). Safe to run any number of
 * times (AC-07.2.3).
 */
export async function seedDemo(deps: {
  config: Pick<AppConfig, 'seedDemo' | 'appEnv'>;
  prisma: Pick<
    PrismaService,
    'user' | 'team' | 'task' | 'taskTeam' | '$transaction'
  >;
  /** Created lazily: only a run that seeds needs the auth instance. */
  auth: () => Pick<AuthInstance, 'api'>;
  now?: Date;
}): Promise<SeedDemoResult> {
  const skippedBecause = demoSeedSkipReason(deps.config);
  if (skippedBecause) return { seeded: false, skippedBecause };

  const user = await seedDemoUser(deps.prisma, deps.auth());
  const { restored: teams, skipped: teamsSkipped } = await seedTeams(
    deps.prisma,
  );
  const tasks = await seedTasks(deps.prisma, deps.now ?? new Date());
  return { seeded: true, user, teams, teamsSkipped, tasks };
}
