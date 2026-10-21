import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const BLOCKING = new Set(['high', 'critical']);
const ALLOWLIST_PATH = new URL(
  '../../security/audit-allowlist.json',
  import.meta.url,
);

/** True for a real calendar date written YYYY-MM-DD. */
function isIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/**
 * Pure gate: fails on any high/critical advisory that has no valid, unexpired allowlist entry.
 * Entries need an id, a justification and an expiry date (valid through that day, UTC).
 * Lower severities and stale entries are reported, never failing.
 */
export function evaluateAudit(report, allowlist, today = new Date()) {
  const failures = [];
  const warnings = [];
  const todayIso = today.toISOString().slice(0, 10);

  const usable = new Map();
  for (const entry of allowlist) {
    const label = `allowlist entry ${entry?.id ?? '(no id)'}`;
    if (!entry?.id) failures.push(`${label}: missing id`);
    else if (typeof entry.reason !== 'string' || entry.reason.trim() === '')
      failures.push(`${label}: missing reason`);
    else if (!isIsoDate(entry.expires))
      failures.push(`${label}: expires must be a YYYY-MM-DD date`);
    else usable.set(entry.id, entry);
  }

  const seen = new Set();
  for (const advisory of Object.values(report.advisories ?? {})) {
    const id = advisory.github_advisory_id ?? String(advisory.id);
    seen.add(id);
    const summary = `${id} (${advisory.module_name}, ${advisory.severity}): ${advisory.title}`;
    if (!BLOCKING.has(advisory.severity)) {
      warnings.push(summary);
      continue;
    }
    const entry = usable.get(id);
    if (!entry) failures.push(`${summary} — not allowlisted`);
    else if (entry.expires < todayIso)
      failures.push(`${summary} — allowlist entry expired on ${entry.expires}`);
  }

  for (const entry of usable.values()) {
    if (!seen.has(entry.id))
      warnings.push(
        `allowlist entry ${entry.id} matches no advisory; remove it`,
      );
  }

  return { ok: failures.length === 0, failures, warnings };
}

function main() {
  const allowlist = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8'));
  // pnpm audit exits non-zero when it finds advisories; the report on stdout is what matters.
  const run = spawnSync('pnpm', ['audit', '--json'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  let report;
  try {
    report = JSON.parse(run.stdout);
  } catch {
    console.error(
      `pnpm audit produced no usable report (registry unreachable?):\n${run.stderr || run.stdout}`,
    );
    process.exit(1);
  }
  const { ok, failures, warnings } = evaluateAudit(report, allowlist);
  for (const warning of warnings) console.warn(`warning: ${warning}`);
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  if (!ok) process.exit(1);
  console.log(
    'Dependency audit passed (no unallowlisted high/critical advisories).',
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
