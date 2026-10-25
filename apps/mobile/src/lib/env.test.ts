import { parseEnv } from './env';

describe('parseEnv', () => {
  it('fails fast with a readable message when the API URL is missing', () => {
    expect(() => parseEnv({}, true)).toThrow(
      /EXPO_PUBLIC_API_URL is not set\. Copy apps\/mobile\/\.env\.example/,
    );
  });

  it('rejects a value that is not a URL', () => {
    expect(() => parseEnv({ EXPO_PUBLIC_API_URL: 'localhost' }, true)).toThrow(
      /must be an http\(s\) URL/,
    );
  });

  it('accepts http in development and drops the trailing slash', () => {
    expect(
      parseEnv({ EXPO_PUBLIC_API_URL: 'http://10.0.2.2:3000/' }, true),
    ).toEqual({ apiUrl: 'http://10.0.2.2:3000' });
  });

  it('rejects http outside development', () => {
    expect(() =>
      parseEnv({ EXPO_PUBLIC_API_URL: 'http://api.example.com' }, false),
    ).toThrow('EXPO_PUBLIC_API_URL must use https outside development.');
  });

  it('accepts https outside development', () => {
    expect(
      parseEnv({ EXPO_PUBLIC_API_URL: 'https://api.example.com' }, false),
    ).toEqual({ apiUrl: 'https://api.example.com' });
  });

  it('rejects other protocols in development', () => {
    expect(() =>
      parseEnv({ EXPO_PUBLIC_API_URL: 'ftp://api.example.com' }, true),
    ).toThrow(/must be an http\(s\) URL/);
  });
});
