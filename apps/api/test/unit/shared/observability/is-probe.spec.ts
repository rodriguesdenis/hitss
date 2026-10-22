import { isProbe } from '../../../../src/shared/observability/is-probe';

describe('isProbe', () => {
  it.each(['/api/v1/health/live', '/api/v1/health/ready?x=1'])(
    'AC-06.1.5 %s is a probe',
    (url) => expect(isProbe({ url })).toBe(true),
  );

  it.each(['/api/v1/tasks', '/api/v1/healthy', undefined])(
    'AC-06.1.5 %s is not a probe',
    (url) => expect(isProbe({ url })).toBe(false),
  );
});
