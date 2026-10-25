Object.assign(process.env, {
  APP_ENV: 'test',
  OTEL_SDK_DISABLED: 'true',
  DATABASE_URL: 'postgresql://localhost:5432/openapi',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
});
