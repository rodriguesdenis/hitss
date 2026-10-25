const transformed = [
  '(jest-)?react-native',
  '@react-native(-community)?',
  'expo(nent)?',
  '@expo(nent)?/.*',
  'expo-router',
  'nativewind',
  'react-native-css-interop',
  '@hitss/.*',
].join('|');

module.exports = {
  preset: 'jest-expo',
  roots: ['<rootDir>/src', '<rootDir>/tests', '<rootDir>/app'],
  setupFiles: ['<rootDir>/tests/env.ts'],
  transformIgnorePatterns: [`node_modules/(?!(?:\\.pnpm/)?(${transformed}))`],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
