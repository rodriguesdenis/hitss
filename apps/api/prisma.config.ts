import { join } from 'node:path';
import { defineConfig } from 'prisma/config';
import { envFilePaths, ignoreEnvFiles } from './src/config/env-files';

// Prisma CLI configuration (generate, migrate). The API itself reads DATABASE_URL only through
// AppConfig. The CLI reads the same .env files as the config module; they never override the
// real environment and are ignored with APP_ENV=production.
if (!ignoreEnvFiles(process.env.APP_ENV)) {
  for (const file of envFilePaths(join(__dirname, 'src/config'))) {
    try {
      process.loadEnvFile(file);
    } catch {
      // Missing file: nothing to load.
    }
  }
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // process.env instead of env(): `prisma generate` must work without a database (CI install).
  datasource: { url: process.env.DATABASE_URL },
});
