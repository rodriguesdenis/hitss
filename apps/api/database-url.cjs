// Prints a PostgreSQL connection URL built from the POSTGRES_* environment variables, with the
// credentials percent-encoded. Used by the container entrypoint when DATABASE_URL is not provided,
// so docker-compose.yml never has to put a password inside a URL. Prints nothing but the URL and
// never echoes values in errors.
const env = process.env;
const required = [
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'POSTGRES_HOST',
  'POSTGRES_PORT',
  'POSTGRES_DB',
];
const missing = required.filter((name) => !env[name]);
if (missing.length > 0) {
  console.error(
    `Cannot build DATABASE_URL: set DATABASE_URL or ${missing.join(', ')}`,
  );
  process.exit(1);
}
const enc = encodeURIComponent;
process.stdout.write(
  `postgresql://${enc(env.POSTGRES_USER)}:${enc(env.POSTGRES_PASSWORD)}@${env.POSTGRES_HOST}:${env.POSTGRES_PORT}/${enc(env.POSTGRES_DB)}`,
);
