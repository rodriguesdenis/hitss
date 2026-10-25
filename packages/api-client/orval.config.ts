import { defineConfig } from 'orval';

const input = { target: './openapi.json' };

export default defineConfig({
  hooks: {
    input,
    output: {
      mode: 'tags-split',
      target: 'src/generated/endpoints',
      schemas: 'src/generated/model',
      client: 'react-query',
      httpClient: 'fetch',
      clean: true,
      override: {
        mutator: { path: 'src/mutator.ts', name: 'apiFetch' },
        fetch: { includeHttpResponseReturnType: false },
      },
    },
  },
  zod: {
    input,
    output: {
      mode: 'single',
      target: 'src/generated/zod/index.ts',
      client: 'zod',
      clean: true,
    },
  },
});
