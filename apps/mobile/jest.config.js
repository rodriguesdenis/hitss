const transformed = [
  '(jest-)?react-native',
  '@react-native(-community)?',
  'expo(nent)?',
  '@expo(nent)?/.*',
  'expo-router',
  '@react-navigation/.*',
  'standard-navigation',
  'nativewind',
  'react-native-css-interop',
  '@hitss/.*',
].join('|');

module.exports = {
  preset: 'jest-expo',
  clearMocks: true,
  roots: ['<rootDir>/src', '<rootDir>/tests', '<rootDir>/app'],
  setupFiles: ['<rootDir>/tests/env.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  transformIgnorePatterns: [`node_modules/(?!(?:\\.pnpm/)?(${transformed}))`],
  moduleNameMapper: {
    '^expo-secure-store$': '<rootDir>/tests/mocks/secure-store.ts',
    '^@react-native-async-storage/async-storage$':
      '@react-native-async-storage/async-storage/jest/async-storage-mock',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
