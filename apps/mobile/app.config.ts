import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Teams & Tasks',
  slug: 'teams-tasks',
  scheme: 'teamstasks',
  version: '0.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  ios: { supportsTablet: false },
  plugins: ['expo-router'],
  experiments: { typedRoutes: true },
};

export default config;
