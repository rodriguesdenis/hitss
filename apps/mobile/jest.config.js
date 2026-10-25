const transformed = [
  '(jest-)?react-native(-[^/]+)?',
  '@react-native(-community)?/[^/]+',
  'expo(nent)?(-[^/]+)?',
  '@expo(nent)?/[^/]+',
  '@react-navigation/[^/]+',
  'standard-navigation',
  'nativewind',
  '@hitss/[^/]+',
  'rettime',
  'until-async',
  'immer',
  '@open-draft/[^/]+',
  'better-auth',
  '@better-auth/[^/]+',
  '@better-fetch/[^/]+',
  'better-call',
  'nanostores',
].join('|');

module.exports = {
  preset: 'jest-expo',
  clearMocks: true,
  roots: ['<rootDir>/src', '<rootDir>/tests', '<rootDir>/app'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/tests/lint/'],
  setupFiles: ['<rootDir>/tests/env.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  transform: {
    '\\.mjs$': 'babel-jest',
  },
  transformIgnorePatterns: [`node_modules/(?!\\.pnpm/|(${transformed})/)`],
  moduleNameMapper: {
    '^expo-secure-store$': '<rootDir>/tests/mocks/secure-store.ts',
    '^@react-native-community/netinfo$': '<rootDir>/tests/mocks/netinfo.ts',
    '^@expo/vector-icons/(.*)$': '<rootDir>/tests/mocks/vector-icons.tsx',
    '^@react-native-async-storage/async-storage$':
      '@react-native-async-storage/async-storage/jest/async-storage-mock',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
