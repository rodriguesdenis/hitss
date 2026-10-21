// Jest setup: a valid, clearly fake test environment so modules that validate configuration
// when composed can be imported. Tests that need other values set process.env themselves.
process.env.APP_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://user:pw@localhost:5432/db';
process.env.BETTER_AUTH_SECRET = 'unit-test-secret-0123456789abcdef0123456789';
