import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ExpoConfig } from 'expo/config';

const apiContractHash = createHash('sha256')
  .update(
    readFileSync(join(__dirname, '../../packages/api-client/openapi.json')),
  )
  .digest('hex')
  .slice(0, 16);

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
  extra: { apiContractHash },
};

export default config;
