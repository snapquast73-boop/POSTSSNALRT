#!/usr/bin/env node
/* official-scoring-test.mjs — official-scorer pending rulings + scoring
 * attribution fixtures (assets/js/reviews.js). No network.
 * Run: node tools/official-scoring-test.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Reviews = require('../assets/js/reviews.js');

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}

console.log('official-scoring-test');
check('os_ruling_pending_primary is pending',
  Reviews.isPendingRulingPlay({ result: { eventType: 'os_ruling_pending_primary' } }) === true);
check('os_ruling_pending_prior is pending',
  Reviews.isPendingRulingPlay({ result: { eventType: 'os_ruling_pending_prior' } }) === true);
check('ordinary event is not pending',
  Reviews.isPendingRulingPlay({ result: { eventType: 'single' } }) === false);
check('missing result is not pending', Reviews.isPendingRulingPlay({}) === false);

const feed = { liveData: { plays: { allPlays: [
  { about: { atBatIndex: 1, inning: 2, halfInning: 'top', isTopInning: true },
    result: { eventType: 'os_ruling_pending_prior', description: 'Official Scorer Ruling Pending' },
    matchup: { batter: { fullName: 'B' }, pitcher: { fullName: 'P' } }, reviewDetails: [] },
] } }, gameData: {} };
const ex = Reviews.extractReviewsFromFeed(feed);
check('pending row carries official label',
  ex.pending.length === 1 && ex.pending[0].label === 'Official Scorer Ruling Pending');
check('pending row is visible in All + alerts',
  Reviews.visibleInAllFeed(ex.pending[0]) && Reviews.shouldAlertForReview(ex.pending[0]));
check('pending row badge is pending', ex.pending[0].badgeClass === 'pending');

console.log(`\nofficial-scoring-test: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
