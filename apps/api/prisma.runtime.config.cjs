// Prisma CLI configuration for the runtime image (`prisma migrate deploy`). The development
// prisma.config.ts imports TypeScript sources and .env loading, neither of which the image ships;
// here the connection URL comes from the container environment only.
const { defineConfig } = require('prisma/config');

module.exports = defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL },
});
