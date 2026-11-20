#!/usr/bin/env node
/* review-test.mjs — fixture tests for assets/js/reviews.js (no network).
 * Run: node tools/review-test.mjs
 * Rebuilt for the repair (original tools/ missing from upload; see F-06).
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Reviews = require('../assets/js/reviews.js');

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}

console.log('review-test: classification');
check('manager challenge by description',
  Reviews.classifyReview({ type: { code: 'MA', description: 'Manager Challenge' } }).typeKey === 'challenge');
check('ABS by description',
  Reviews.classifyReview({ type: { code: 'MJ', description: 'ABS Challenge' } }).typeKey === 'abs');
check('ABS by code MJ',
  Reviews.classifyReview({ type: { code: 'MJ', description: 'Pitch challenge' } }).typeKey === 'abs');
check('boundary by description',
  Reviews.classifyReview({ type: { code: 'X', description: 'Boundary call review' } }).typeKey === 'boundary');
check('crew chief by description',
  Reviews.classifyReview({ type: { code: 'X', description: 'Crew Chief Review' } }).typeKey === 'review');
check('unknown description stays a review (never dropped)',
  Reviews.classifyReview({ type: { code: 'ZZ', description: 'Something else' } }).typeKey === 'review');
check('empty detail is unknown',
  Reviews.classifyReview({}).typeKey === 'unknown');

console.log('review-test: extraction');
const play = {
  about: { atBatIndex: 5, inning: 3, halfInning: 'top', isTopInning: true },
  matchup: { batter: { fullName: 'Batter One' }, pitcher: { fullName: 'Pitcher One' } },
  result: { description: 'Single', eventType: 'single', rbi: 1 },
  reviewDetails: [{ id: 'r1', type: { code: 'MA', description: 'Manager Challenge' } }],
  playEvents: [{ reviewDetails: [{ id: 'r2', type: { code: 'MJ', description: 'ABS Challenge' } }] }],
  runners: [{ isScoring: true }],
};
const rs = Reviews.extractReviewsFromPlay(play, 0);
check('play + pitch-level reviews both found', rs.length === 2);
check('dedupe by id', Reviews.extractReviewsFromPlay(
  { reviewDetails: [{ id: 'r1', type: { description: 'Manager Challenge' } }],
    playEvents: [{ reviewDetails: [{ id: 'r1', type: { description: 'Manager Challenge' } }] }] }, 0).length === 1);
check('runsAtRisk true when reviewed play scores', Reviews.runsAtRisk(play) === true);
check('runsAtRisk false without review',
  Reviews.runsAtRisk({ result: { rbi: 2 }, runners: [{ isScoring: true }] }) === false);

console.log('review-test: feed + counters + status');
const feed = {
  liveData: { plays: { allPlays: [play,
    { about: { atBatIndex: 6, inning: 4, halfInning: 'bot', isTopInning: false },
      result: { eventType: 'os_ruling_pending_primary', description: 'Pending' },
      matchup: {}, reviewDetails: [] }] } },
  gameData: {
    status: { abstractGameCode: 'IH', detailedState: 'Instant Replay' },
    review: { away: { used: 1, remaining: 1 }, home: { used: 0, remaining: 2 } },
    absChallenges: { away: { usedSuccessful: 1, usedFailed: 0, remaining: 1 } },
  },
};
const ex = Reviews.extractReviewsFromFeed(feed);
check('feed reviews extracted', ex.reviews.length === 2);
check('pending ruling extracted', ex.pending.length === 1 && ex.pending[0].typeKey === 'pending');
check('under-review active on IH', ex.underReview.active === true);
check('manager counters verbatim', ex.counters.manager.away.used === 1 && ex.counters.manager.home.remaining === 2);
check('abs counters verbatim (no zero-fill of missing side)',
  ex.counters.abs.away.remaining === 1 && ex.counters.abs.home === null);
check('absent counters are null, not zero',
  Reviews.extractReviewsFromFeed({ gameData: {} }).counters.manager === null);
check('isUnderReviewStatus M/N/IH',
  Reviews.isUnderReviewStatus('M1') && Reviews.isUnderReviewStatus('N2') && Reviews.isUnderReviewStatus('IH'));
check('isUnderReviewStatus false otherwise',
  !Reviews.isUnderReviewStatus('F') && !Reviews.isUnderReviewStatus('') && !Reviews.isUnderReviewStatus(null));

console.log('review-test: All-feed / alert gates (ABS included)');
check('visibleInAllFeed abs', Reviews.visibleInAllFeed({ typeKey: 'abs' }) === true);
check('shouldAlertForReview abs', Reviews.shouldAlertForReview({ typeKey: 'abs' }) === true);
check('gates reject null', Reviews.visibleInAllFeed(null) === false && Reviews.shouldAlertForReview(null) === false);

console.log('review-test: counter regression');
check('regression flagged', typeof Reviews.flagCounterRegression(2, 1, 'X') === 'string');
check('forward motion not flagged', Reviews.flagCounterRegression(1, 2, 'X') === null);
check('missing values not flagged', Reviews.flagCounterRegression(null, 1, 'X') === null);

console.log(`\nreview-test: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
