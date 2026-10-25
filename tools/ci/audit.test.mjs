import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { evaluateAudit } from './audit.mjs';

const TODAY = new Date('2026-10-20T12:00:00Z');

/** Minimal `pnpm audit --json` report with one advisory. */
const report = (severity, id = 'GHSA-aaaa-bbbb-cccc') => ({
  advisories: {
    1: {
      github_advisory_id: id,
      severity,
      module_name: 'left-pad',
      title: 'bad',
    },
  },
});
const entry = (overrides = {}) => ({
  id: 'GHSA-aaaa-bbbb-cccc',
  owner: 'devops-ci',
  reason: 'not reachable: dev-only tooling',
  expires: '2026-12-31',
  ...overrides,
});

describe('dependency audit gate', () => {
  it('AC-07.9.1 critical advisory without allowlist entry fails', () => {
    const result = evaluateAudit(report('critical'), [], TODAY);
    assert.equal(result.ok, false);
    assert.match(result.failures[0], /GHSA-aaaa-bbbb-cccc.*left-pad.*critical/);
  });

  it('AC-07.9.1 high advisory without allowlist entry fails', () => {
    assert.equal(evaluateAudit(report('high'), [], TODAY).ok, false);
  });

  it('AC-07.9.1 moderate advisory without allowlist entry passes and is reported', () => {
    const result = evaluateAudit(report('moderate'), [], TODAY);
    assert.equal(result.ok, true);
    assert.equal(result.warnings.length, 1);
  });

  it('AC-07.9.1 high advisory with a justified, unexpired entry passes', () => {
    assert.equal(evaluateAudit(report('high'), [entry()], TODAY).ok, true);
  });

  it('AC-07.9.1 high advisory whose entry has expired fails naming the expiry', () => {
    const result = evaluateAudit(
      report('high'),
      [entry({ expires: '2026-10-19' })],
      TODAY,
    );
    assert.equal(result.ok, false);
    assert.match(result.failures[0], /expired on 2026-10-19/);
  });

  it('AC-07.9.1 an entry is valid through its expiry day', () => {
    assert.equal(
      evaluateAudit(report('high'), [entry({ expires: '2026-10-20' })], TODAY)
        .ok,
      true,
    );
  });

  it('AC-07.9.1 an entry without a justification is rejected', () => {
    const result = evaluateAudit(
      report('high'),
      [entry({ reason: ' ' })],
      TODAY,
    );
    assert.equal(result.ok, false);
    assert.match(result.failures.join('\n'), /reason/);
  });

  it('AC-07.9.1 an entry without a valid expiry date is rejected', () => {
    for (const expires of [undefined, 'next week', '2026-13-40']) {
      const result = evaluateAudit(
        report('moderate'),
        [entry({ expires })],
        TODAY,
      );
      assert.equal(result.ok, false, `expires=${String(expires)}`);
    }
  });

  it('AC-07.9.1 an entry for another advisory does not allow this one', () => {
    assert.equal(
      evaluateAudit(
        report('high'),
        [entry({ id: 'GHSA-zzzz-zzzz-zzzz' })],
        TODAY,
      ).ok,
      false,
    );
  });

  it('AC-07.9.1 a stale expired entry with no matching advisory only warns', () => {
    const result = evaluateAudit(
      { advisories: {} },
      [entry({ expires: '2026-01-01' })],
      TODAY,
    );
    assert.equal(result.ok, true);
    assert.equal(result.warnings.length, 1);
  });

  it('AC-07.9.1 a clean report passes', () => {
    assert.deepEqual(evaluateAudit({ advisories: {} }, [], TODAY), {
      ok: true,
      failures: [],
      warnings: [],
    });
  });

  it('AC-07.9.1 an audit error report fails closed instead of passing as empty', () => {
    const error = {
      error: {
        code: 'ERR_PNPM_AUDIT_BAD_RESPONSE',
        message: 'registry said no',
      },
    };
    const result = evaluateAudit(error, [], TODAY);
    assert.equal(result.ok, false);
    assert.match(
      result.failures[0],
      /ERR_PNPM_AUDIT_BAD_RESPONSE.*registry said no/,
    );
  });

  it('AC-07.9.1 a report without an advisories object fails closed', () => {
    for (const bad of [{}, { advisories: null }, { advisories: 'x' }, null]) {
      assert.equal(
        evaluateAudit(bad, [], TODAY).ok,
        false,
        JSON.stringify(bad),
      );
    }
  });

  it('AC-07.9.1 an entry without an owner is rejected', () => {
    const result = evaluateAudit(report('high'), [entry({ owner: '' })], TODAY);
    assert.equal(result.ok, false);
    assert.match(result.failures.join('\n'), /owner/);
  });

  it('AC-07.9.1 an entry expiring more than 90 days from today is rejected', () => {
    const tooFar = evaluateAudit(
      report('high'),
      [entry({ expires: '2027-01-19' })],
      TODAY,
    );
    assert.equal(tooFar.ok, false);
    assert.match(tooFar.failures.join('\n'), /90 days/);
    assert.equal(
      evaluateAudit(report('high'), [entry({ expires: '2027-01-18' })], TODAY)
        .ok,
      true,
    );
  });
  describe('path-scoped entries', () => {
    const reached = (...paths) => ({
      advisories: {
        1: {
          github_advisory_id: 'GHSA-aaaa-bbbb-cccc',
          severity: 'high',
          module_name: 'left-pad',
          title: 'bad',
          findings: [{ version: '1.0.0', paths }],
        },
      },
    });
    const scoped = entry({ paths: ['apps__mobile>expo>@expo/cli>'] });

    it('AC-07.9.1 passes when every path to the advisory is under an allowlisted prefix', () => {
      const result = evaluateAudit(
        reached('apps__mobile>expo>@expo/cli>left-pad'),
        [scoped],
        TODAY,
      );
      assert.equal(result.ok, true);
    });

    it('AC-07.9.1 fails naming the path when the advisory is also reached elsewhere', () => {
      const result = evaluateAudit(
        reached(
          'apps__mobile>expo>@expo/cli>left-pad',
          'apps__mobile>left-pad',
        ),
        [scoped],
        TODAY,
      );
      assert.equal(result.ok, false);
      assert.match(
        result.failures[0],
        /not allowlisted for apps__mobile>left-pad/,
      );
    });

    it('AC-07.9.1 fails when the advisory report carries no paths to check', () => {
      const result = evaluateAudit(report('high'), [scoped], TODAY);
      assert.equal(result.ok, false);
    });

    it('AC-07.9.1 rejects an entry whose paths is not a list of prefixes', () => {
      const result = evaluateAudit(
        reached('apps__mobile>expo>@expo/cli>left-pad'),
        [entry({ paths: 'apps__mobile>expo>@expo/cli>' })],
        TODAY,
      );
      assert.equal(result.ok, false);
      assert.match(
        result.failures.join('\n'),
        /paths must be a non-empty list/,
      );
    });
  });
});
