import type { AppConfig } from '../config/app-config';
import type { AuthInstance } from '../modules/identity/auth.factory';
import type { PrismaService } from '../shared/infrastructure/prisma/prisma.service';
import { demoSeedSkipReason } from './gate';
import { seedDemoUser } from './identity.seed';
import { seedTasks } from './tasks.seed';
import { seedTeams } from './teams.seed';

export interface SeedDemoResult {
  seeded: boolean;
  skippedBecause?: string;
  user?: 'created' | 'existing';
  teams?: number;
  teamsSkipped?: number;
  tasks?: number;
}

export async function seedDemo(deps: {
  config: Pick<AppConfig, 'seedDemo' | 'appEnv'>;
  prisma: Pick<
    PrismaService,
    'user' | 'team' | 'task' | 'taskTeam' | '$transaction'
  >;
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
