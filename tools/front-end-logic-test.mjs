/* ============================================================================
 * front-end-logic-test.mjs — offline checks for the page-level logic added in
 * the post-release repair (no network).
 *
 * Covers, with payload shapes copied from the official fields verified on
 * 2026-11-20 (see tools/live-data-check.mjs for the same assertions run against
 * live MLB data):
 *   - date arithmetic used by the empty-slate fallback
 *   - Reviews.runsAtRisk() pitch-level vs play-level attribution
 *   - review classification of the registry codes we rely on
 *
 * Run: node tools/front-end-logic-test.mjs
 * ==========================================================================*/
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Api = require('../assets/js/api.js');
const UI = require('../assets/js/ui.js');
const Reviews = require('../assets/js/reviews.js');

let pass = 0, fail = 0;
const check = (name, cond) => {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
};

console.log('front-end-logic-test');

/* ------------------------------------------------------------ dates */
check('shiftDate back 14 days', Api._shiftDate('2026-11-20', -14) === '2026-11-06');
check('shiftDate across month end', Api._shiftDate('2026-11-01', -1) === '2026-10-31');
check('shiftDate across year end', Api._shiftDate('2027-01-01', -1) === '2026-12-31');
check('shiftDate leap day', Api._shiftDate('2024-03-01', -1) === '2024-02-29');
check('shiftDate forward 400 days', Api._shiftDate('2026-01-01', 400) === '2027-02-05');
check('UI.addDays agrees with shiftDate', UI.addDays('2026-11-20', -14) === Api._shiftDate('2026-11-20', -14));

/* ------------------------------------------- runs at risk (pitch level) */
// Shape verified on the official feed: runners[].details.{isScoringEvent,playIndex}
const pitchPlay = {
  about: { atBatIndex: 22, inning: 3, isTopInning: true },
  playEvents: [
    { index: 0, playId: 'x', reviewDetails: { isOverturned: true, reviewType: 'MJ', challengeTeamId: 116 } },
    { index: 1, playId: 'y' },
  ],
  runners: [
    { details: { isScoringEvent: false, playIndex: 0 } },
    { details: { isScoringEvent: true, playIndex: 1 } },
  ],
  result: { rbi: 1, eventType: 'field_out', description: 'x' },
};
const absReview = Reviews.extractReviewsFromPlay(pitchPlay, 0)[0];
check('pitch challenge extracted once', Reviews.extractReviewsFromPlay(pitchPlay, 0).length === 1);
check('pitch challenge carries its playEvent index', absReview.eventIndex === 0);
check('pitch challenge with no run on that pitch is not at risk', Reviews.runsAtRisk(pitchPlay, absReview) === false);
const sameIndex = { ...pitchPlay, runners: [{ details: { isScoringEvent: true, playIndex: 0 } }] };
check('pitch challenge with a run credited to that pitch is at risk', Reviews.runsAtRisk(sameIndex, absReview) === true);

/* -------------------------------------------- runs at risk (play level) */
const playLevel = {
  about: { atBatIndex: 30, inning: 5, isTopInning: false },
  reviewDetails: { isOverturned: false, reviewType: 'MF' },
  runners: [{ details: { isScoringEvent: true, playIndex: 2 } }],
  result: { rbi: 1, eventType: 'fielders_choice', description: 'y' },
};
const mgrReview = Reviews.extractReviewsFromPlay(playLevel, 0)[0];
check('play-level manager challenge gets a null event index', mgrReview.eventIndex === null);
check('play-level review with a scoring runner is at risk', Reviews.runsAtRisk(playLevel, mgrReview) === true);
check('play-level review with no scoring runner is not at risk',
  Reviews.runsAtRisk({ ...playLevel, runners: [{ details: { isScoringEvent: false, playIndex: 1 } }] }, mgrReview) === false);
check('pending/scoring rows are never flagged at risk',
  Reviews.runsAtRisk(playLevel, { typeKey: 'pending', eventIndex: null }) === false &&
  Reviews.runsAtRisk(playLevel, { typeKey: 'scoring', eventIndex: null }) === false);
check('legacy no-review argument still uses the rbi fallback', Reviews.runsAtRisk(playLevel) === true);

/* -------------------------------------------------- classification */
const cases = [
  ['MJ', 'abs'],            // "Player challenge: Pitch Result" (the ABS challenge)
  ['NJ', 'review'],         // "Umpire Challenge: Pitch Result" — an umpire-initiated review
  ['MS', 'boundary'], ['NS', 'boundary'],
  ['MF', 'challenge'], ['MA', 'challenge'], ['MV', 'challenge'],
  ['NF', 'review'], ['NA', 'review'], ['NX', 'review'],
];
for (const [code, expected] of cases) {
  const r = Reviews.classifyReview({ reviewType: code });
  check(`${code} classifies as ${expected}`, r.typeKey === expected);
}
check('unknown code still tracked as a review with payload wording',
  Reviews.classifyReview({ reviewType: 'ZZ', description: 'Something new' }).typeKey === 'review');
check('ABS is visible in All and alertable (the intentional difference)',
  Reviews.visibleInAllFeed({ typeKey: 'abs' }) === true && Reviews.shouldAlertForReview({ typeKey: 'abs' }) === true);

console.log(`\nfront-end-logic-test: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
