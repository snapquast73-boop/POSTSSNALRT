#!/usr/bin/env node
/* ============================================================================
 * game-page-test.mjs — behavioural tests for the Game page's Challenges &
 * Reviews enrichment (assets/js/game.js).
 *
 * No network, no DOM: game.js exports its readers as pure functions
 * (window.Game / module.exports) and every assertion below runs them against
 * VERBATIM official MLB captures committed in tools/fixtures/ with their
 * source URLs and fetch dates:
 *
 *   tools/fixtures/game-status.json
 *     https://statsapi.mlb.com/api/v1/gameStatus  (official status registry)
 *   tools/fixtures/game-849799-abs.json
 *     https://statsapi.mlb.com/api/v1.1/game/849799/feed/live
 *     https://statsapi.mlb.com/api/v1/game/849799/playByPlay
 *     (2026 World Series, MIL @ TB, 2026-10-28 — two ABS pitch challenges)
 *   tools/fixtures/game-824474-manager-challenge.json
 *     https://statsapi.mlb.com/api/v1.1/game/824474/feed/live
 *     https://statsapi.mlb.com/api/v1/game/824474/playByPlay
 *     (2026-08-20, STL @ CIN — one manager challenge, code MI)
 *
 * Each check states the official fact it is protecting, so a failure points at
 * a payload-contract regression rather than at a rewritten expectation.
 *
 * Run: node tools/game-page-test.mjs
 * ==========================================================================*/
import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(import.meta.url);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra === undefined ? '' : '  → ' + JSON.stringify(extra))); }
}
function section(title) { console.log('\ngame-page-test: ' + title); }

const Game = require('../assets/js/game.js');
const Reviews = require('../assets/js/reviews.js');
// game.js resolves the Reviews module defensively; make it available in Node
// exactly as the browser script order does (reviews.js loads before game.js).
globalThis.Reviews = Reviews;

const registry = require('./fixtures/game-status.json');
const abs = require('./fixtures/game-849799-abs.json');
const mgr = require('./fixtures/game-824474-manager-challenge.json');
const css = fs.readFileSync(new URL('../assets/css/style.css', import.meta.url), 'utf8');
const gameHtml = fs.readFileSync(new URL('../game.html', import.meta.url), 'utf8');

/* Assemble feeds the way the official live feed nests them. The two captures
 * per game are kept separate in the fixture; joining them here mirrors
 * GET /api/v1.1/game/{gamePk}/feed/live, which carries gameData and
 * liveData.plays.allPlays in one document. */
function feed849799() {
  return {
    gamePk: 849799,
    gameData: abs.gameData.gameData,
    liveData: { plays: { allPlays: abs.reviewPlays.allPlays } },
  };
}
function feed824474() {
  return {
    gamePk: 824474,
    gameData: mgr.gameData.gameData,
    liveData: { plays: { allPlays: [mgr.reviewPlayWithProgress] } },
  };
}

/* ---------------------------------------------------------- fixtures themselves */
section('fixture provenance (no invented data)');
[registry, abs, mgr].forEach((f, i) => {
  check('fixture ' + i + ' records its source URL(s)',
    !!f._provenance && /https:\/\/statsapi\.mlb\.com/.test(JSON.stringify(f._provenance)));
  check('fixture ' + i + ' records a fetch date', !!f._provenance && /^\d{4}-\d{2}-\d{2}$/.test(f._provenance.fetchedOn));
});

/* ------------------------------------------------------------------- registry */
section('official game-status registry (GET /api/v1/gameStatus)');
const map = Game.buildReviewStatusMap(registry.statuses);
Game._setReviewStatusMap(map, 'live');
check('registry fixture is a non-empty array', Array.isArray(registry.statuses) && registry.statuses.length > 0);
check('every fixture entry has a statusCode + detailedState',
  registry.statuses.every(s => s.statusCode && s.detailedState));
check('MI → "Manager challenge: Hit by pitch"', map.MI && map.MI.detailedState === 'Manager challenge: Hit by pitch', map.MI);
check('MJ → "Player challenge: Pitch Result"', map.MJ && map.MJ.detailedState === 'Player challenge: Pitch Result', map.MJ);
check('NJ → "Umpire Challenge: Pitch Result"', map.NJ && map.NJ.detailedState === 'Umpire Challenge: Pitch Result', map.NJ);
check('MS → "Manager challenge: Stadium boundary call"', map.MS && map.MS.detailedState === 'Manager challenge: Stadium boundary call');
check('NS → "Umpire review: Stadium boundary call"', map.NS && map.NS.detailedState === 'Umpire review: Stadium boundary call');
check('IH → "Instant Replay"', map.IH && map.IH.detailedState === 'Instant Replay');
check('every codedGameState M entry is a manager challenge',
  registry.statuses.filter(s => s.codedGameState === 'M' && s.statusCode !== 'MJ')
    .every(s => /^Manager challenge/.test(s.detailedState)));
check('every codedGameState N entry is an umpire review',
  registry.statuses.filter(s => s.codedGameState === 'N' && s.statusCode !== 'NJ')
    .every(s => /^Umpire review/.test(s.detailedState)));
check('registryLabelFor is case-insensitive on the code', Game.registryLabelFor('mi') === 'Manager challenge: Hit by pitch');
check('unknown code → null (never guessed)', Game.registryLabelFor('ZZ') === null);
check('empty map → null', (function () {
  Game._setReviewStatusMap(null, 'unavailable');
  const out = Game.registryLabelFor('MI');
  Game._setReviewStatusMap(map, 'live');
  return out === null;
})());

/* ------------------------------------------------- 849799: ABS pitch challenges */
section('game 849799 — ABS pitch challenges (official MJ records)');
const f1 = feed849799();
const rows1 = Reviews.extractReviewsFromFeed(f1).reviews.map(r => Game.reviewRowModel(f1, r));
check('exactly two review records in the game', rows1.length === 2, rows1.length);
check('both are classified ABS (README: code MJ)', rows1.every(r => r.typeKey === 'abs'));
check('both carry the official registry wording',
  rows1.every(r => r.officialLabel === 'Player challenge: Pitch Result'));
check('both rulings read Overturned from isOverturned:true',
  rows1.every(r => r.ruling && r.ruling.key === 'overturned'), rows1.map(r => r.ruling));

const at36 = rows1.find(r => r.atBatIndex === 36);
const at51 = rows1.find(r => r.atBatIndex === 51);
check('atBatIndex 36 official pitchNumber is 2', at36 && at36.pitchNumber === 2, at36 && at36.pitchNumber);
check('atBatIndex 36 playEvent index is 1 — NOT the pitch number', at36 && at36.eventIndex === 1, at36 && at36.eventIndex);
check('pitch number is not taken from the array position (RR-02 class of bug)',
  at36 && at36.pitchNumber !== at36.eventIndex);
check('atBatIndex 51 official pitchNumber is 1', at51 && at51.pitchNumber === 1, at51 && at51.pitchNumber);
check('atBatIndex 36 challenged by team 158 = MIL (away)',
  at36 && at36.challengingTeam && at36.challengingTeam.id === 158 &&
  at36.challengingTeam.abbreviation === 'MIL' && at36.challengingTeam.side === 'away', at36 && at36.challengingTeam);
check('atBatIndex 51 challenged by team 139 = TB (home)',
  at51 && at51.challengingTeam && at51.challengingTeam.id === 139 &&
  at51.challengingTeam.abbreviation === 'TB' && at51.challengingTeam.side === 'home', at51 && at51.challengingTeam);
check('challengeTeamId that matches neither club is left blank',
  Game.challengingTeamOf(f1, { challengeTeamId: 999 }) === null);
check('absent challengeTeamId is left blank', Game.challengingTeamOf(f1, { reviewType: 'MJ' }) === null);

section('game 849799 — official counters vs the records (consistency, not derivation)');
const c1 = Game.counterRows(f1);
check('five counter rows (2 manager + 3 ABS)', c1.length === 5, c1.length);
check('manager used 0/0 exactly as the payload states',
  JSON.stringify(c1[0]) === JSON.stringify(['Manager challenges used', 0, 0]), c1[0]);
check('manager remaining 2/2 exactly as the payload states',
  JSON.stringify(c1[1]) === JSON.stringify(['Manager challenges remaining', 2, 2]), c1[1]);
check('ABS retained 1/1 exactly as the payload states',
  JSON.stringify(c1[2]) === JSON.stringify(['ABS challenges retained (successful)', 1, 1]), c1[2]);
check('ABS lost 0/0 exactly as the payload states',
  JSON.stringify(c1[3]) === JSON.stringify(['ABS challenges lost (failed)', 0, 0]), c1[3]);
check('ABS remaining 2/2 exactly as the payload states',
  JSON.stringify(c1[4]) === JSON.stringify(['ABS challenges remaining', 2, 2]), c1[4]);
check('cross-check: the two overturned MJ records equal away+home usedSuccessful (1+1)',
  rows1.filter(r => r.ruling && r.ruling.key === 'overturned' && r.typeKey === 'abs').length ===
  f1.gameData.absChallenges.away.usedSuccessful + f1.gameData.absChallenges.home.usedSuccessful);

/* --------------------------------------------- 824474: manager challenge (MI) */
section('game 824474 — manager challenge MI on a hit_by_pitch play');
const f2 = feed824474();
const rows2 = Reviews.extractReviewsFromFeed(f2).reviews.map(r => Game.reviewRowModel(f2, r));
check('exactly one review record', rows2.length === 1, rows2.length);
const mi = rows2[0];
check('classified as a manager challenge', mi.typeKey === 'challenge');
check('official wording MI → "Manager challenge: Hit by pitch"',
  mi.officialLabel === 'Manager challenge: Hit by pitch', mi.officialLabel);
check('the play it sits on is eventType hit_by_pitch — the code mapping is confirmed by the payload itself',
  mgr.reviewPlayWithResult.result.eventType === 'hit_by_pitch');
check('reviewDetails is an OBJECT in the official payload (not an array)',
  !Array.isArray(mgr.reviewPlayWithProgress.reviewDetails) &&
  typeof mgr.reviewPlayWithProgress.reviewDetails === 'object');
check('firstReviewDetail reads the object shape',
  Game.firstReviewDetail(mgr.reviewPlayWithProgress.reviewDetails) === mgr.reviewPlayWithProgress.reviewDetails);
check('firstReviewDetail still reads a legacy array shape',
  Game.firstReviewDetail([{ reviewType: 'MA' }]).reviewType === 'MA');
check('firstReviewDetail is null-safe', Game.firstReviewDetail(null) === null &&
  Game.firstReviewDetail([]) === null && Game.firstReviewDetail(undefined) === null);
check('ruling is "Call stands (not overturned)" from isOverturned:false + inProgress:false',
  mi.ruling && mi.ruling.key === 'stands', mi.ruling);
check('challenged by team 113 = CIN (home)',
  mi.challengingTeam && mi.challengingTeam.abbreviation === 'CIN' && mi.challengingTeam.side === 'home', mi.challengingTeam);
check('no pitch number on a play-level review (nothing invented)', mi.pitchNumber === null);
check('per-row official source link points at this game\'s live feed',
  mi.sourceUrl === 'https://statsapi.mlb.com/api/v1.1/game/824474/feed/live', mi.sourceUrl);

section('game 824474 — official counters read verbatim');
const c2 = Game.counterRows(f2);
check('manager used 0 (away) / 1 (home)', JSON.stringify(c2[0]) === JSON.stringify(['Manager challenges used', 0, 1]), c2[0]);
check('manager remaining 1 (away) / 0 (home)', JSON.stringify(c2[1]) === JSON.stringify(['Manager challenges remaining', 1, 0]), c2[1]);
check('ABS retained 0 (away) / 2 (home)',
  JSON.stringify(c2[2]) === JSON.stringify(['ABS challenges retained (successful)', 0, 2]), c2[2]);
check('ABS lost 2 (away) / 1 (home)',
  JSON.stringify(c2[3]) === JSON.stringify(['ABS challenges lost (failed)', 2, 1]), c2[3]);
check('ABS remaining 0 (away) / 1 (home)',
  JSON.stringify(c2[4]) === JSON.stringify(['ABS challenges remaining', 0, 1]), c2[4]);
check('cross-check: home used 1 manager challenge == the single MI record by team 113 (home)',
  f2.gameData.review.home.used === 1 && f2.gameData.review.away.used === 0 &&
  rows2.filter(r => r.typeKey === 'challenge').length === 1 &&
  rows2[0].challengingTeam.side === 'home');

/* ------------------------------------------------------------- ruling semantics */
section('ruling semantics — an absent value is never a confirmed ruling');
check('inProgress:true wins over isOverturned', Game.rulingOf({ inProgress: true, isOverturned: false }).key === 'in-progress');
check('isOverturned:true → overturned', Game.rulingOf({ isOverturned: true }).key === 'overturned');
check('isOverturned:false → stands', Game.rulingOf({ isOverturned: false }).key === 'stands');
check('no isOverturned key → null (not reported as a ruling)', Game.rulingOf({ reviewType: 'MA', challengeTeamId: 113 }) === null);
check('null / non-object → null', Game.rulingOf(null) === null && Game.rulingOf('MA') === null);
check('pitchNumberOf returns null when the payload omits pitchNumber',
  Game.pitchNumberOf({ index: 3 }) === null && Game.pitchNumberOf(null) === null);
check('pitchNumberOf returns 0 unchanged (a real pitch number, not "absent")',
  Game.pitchNumberOf({ index: 0, pitchNumber: 0 }) === 0);

/* --------------------------------------------------------- counters, absent data */
section('counters — absent stays blank, never zero-filled');
check('feed with no counters → no rows', Game.counterRows({ gamePk: 1, gameData: {} }).length === 0);
check('feed with manager counters only → 2 rows, no ABS rows invented',
  Game.counterRows({ gamePk: 1, gameData: { review: { away: { used: 1, remaining: 0 }, home: { used: 0, remaining: 1 } } } }).length === 2);
check('a missing counter value renders as an empty string, not 0',
  (function () {
    const rows = Game.counterRows({ gamePk: 1, gameData: { review: { away: { used: 1 }, home: { remaining: 1 } } } });
    return rows[0][2] === '' && rows[1][1] === '';
  })());
check('null feed is safe', Game.counterRows(null).length === 0);

/* ------------------------------------------------------------------- DOM contract */
section('DOM + CSS contract (game.html / style.css)');
['reviews-wrap', 'live-review-banner-wrap', 'reviews-tab-count', 'panel-reviews', 'plays-wrap']
  .forEach(id => check('game.html has #' + id, gameHtml.includes('id="' + id + '"')));
check('game.html loads game.js', gameHtml.includes('assets/js/game.js'));
check('game.html loads reviews.js before game.js',
  gameHtml.indexOf('assets/js/reviews.js') < gameHtml.indexOf('assets/js/game.js'));
check('game.html loads api.js before game.js',
  gameHtml.indexOf('assets/js/api.js') < gameHtml.indexOf('assets/js/game.js'));
['.badge', '.badge.abs', '.badge.review', '.badge.risk', '.badge.under-review',
 '.review-card', '.score-table', '.props-note', '.live-review-banner']
  .forEach(sel => check('style.css defines ' + sel, css.includes(sel)));
check('every ruling badge class emitted by game.js exists in style.css',
  ['abs', 'under-review', 'review', 'risk'].every(c =>
    css.includes('.badge.' + c) && Game.rulingBadgeClass(
      c === 'abs' ? { key: 'overturned' } : c === 'under-review' ? { key: 'in-progress' } :
      c === 'review' ? { key: 'stands' } : null) === c));

section('registry failure path (loud, not silent)');
check('loadReviewStatusRegistry is exported', typeof Game.loadReviewStatusRegistry === 'function');
check('registry state is reported on every row model',
  (function () {
    Game._setReviewStatusMap(null, 'unavailable');
    const r = Game.reviewRowModel(f2, Reviews.extractReviewsFromFeed(f2).reviews[0]);
    const out = r.registryState === 'unavailable' && r.officialLabel === null && r.label === 'Manager challenge';
    Game._setReviewStatusMap(map, 'live');
    return out;
  })());

console.log(`\ngame-page-test: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
