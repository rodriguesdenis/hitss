import { sanitizeUrl } from './sanitize-url';

describe('sanitizeUrl', () => {
  it.each([
    ['/api/auth/verify-email?token=abc', '/api/auth/verify-email'],
    ['/api/v1/tasks?search=private#frag', '/api/v1/tasks'],
    ['/api/v1/tasks', '/api/v1/tasks'],
  ])('AC-06.3.7 %s -> %s', (input, expected) => {
    expect(sanitizeUrl(input)).toBe(expected);
  });
});
