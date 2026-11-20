#!/usr/bin/env node
/* smoke-test.mjs — live-API check (needs network to statsapi.mlb.com).
 * Run: node tools/smoke-test.mjs
 * Wired into CI (.github/workflows/smoke.yml: every push/PR + nightly).
 * Fails loudly on any unreachable endpoint — treat a failure as an
 * irregularity for review (README.md limitation 1/8). In the build sandbox
 * outbound TLS to statsapi.mlb.com is blocked, so this cannot pass there;
 * that limitation is recorded, not skipped silently.
 */
const BASE = 'https://statsapi.mlb.com';
const CHECKS = [
  ['schedule', '/api/v1/schedule?sportId=1&date=2026-11-20'],
  ['gameStatus registry', '/api/v1/gameStatus'],
  ['eventTypes registry', '/api/v1/eventTypes'],
  ['teams', '/api/v1/teams?sportId=1'],
];

let fail = 0;
for (const [name, path] of CHECKS) {
  try {
    const res = await fetch(BASE + path, { headers: { Accept: 'application/json' } });
    const ct = res.headers.get('content-type') || '';
    if (!res.ok) throw new Error('HTTP ' + res.status);
    if (!ct.includes('application/json')) throw new Error('non-JSON: ' + ct);
    await res.json();
    console.log('  ok  ' + name + ' (' + path + ')');
  } catch (err) {
    fail++;
    console.log('  FAIL ' + name + ' (' + path + '): ' + err.message);
  }
}
console.log(`\nsmoke-test: ${CHECKS.length - fail} passed, ${fail} failed`);
if (fail) {
  console.log('smoke-test: live API unreachable — flag as irregularity (see docs/api-compliance.md).');
  process.exit(1);
}
