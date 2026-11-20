#!/usr/bin/env node
/* scoring-change-test.mjs — fixture tests for scoring-change diffing
 * (assets/js/reviews.js snapshotPlay / detectScoringChange). No network.
 * Run: node tools/scoring-change-test.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Reviews = require('../assets/js/reviews.js');

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}

function play(eventType, isOut, outs, desc, rbi) {
  return { result: { eventType, isOut, description: desc, rbi: rbi || 0 },
           count: { outs }, runners: [] };
}

console.log('scoring-change-test');
const a = Reviews.snapshotPlay(play('single', false, 0, 'Single', 1));
const b = Reviews.snapshotPlay(play('single', false, 0, 'Single', 1));
check('identical snapshots: no change', Reviews.detectScoringChange(a, b) === null);

const c = Reviews.snapshotPlay(play('error', false, 0, 'Error', 0));
check('hit -> error is a scoring change', Reviews.detectScoringChange(a, c) !== null);
check('summary names from/to',
  /single/.test(Reviews.detectScoringChange(a, c).summary) && /error/.test(Reviews.detectScoringChange(a, c).summary));

const d = Reviews.snapshotPlay(play('single', false, 0, 'Single (revised)', 2));
check('description/RBI-only edit is NOT a reclassification',
  Reviews.detectScoringChange(a, d) === null);
check('description/RBI-only edit IS a payload-only edit',
  Reviews.isPayloadOnlyEdit(a, d) === true);

const e = Reviews.snapshotPlay(play('single', true, 1, 'Out', 0));
check('out change detected', Reviews.detectScoringChange(a, e) !== null);
check('null snapshots safe', Reviews.detectScoringChange(null, a) === null && Reviews.detectScoringChange(a, null) === null);
check('snapshotPlay null-safe', Reviews.snapshotPlay(null) === null && Reviews.snapshotPlay({}) === null);

console.log(`\nscoring-change-test: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
