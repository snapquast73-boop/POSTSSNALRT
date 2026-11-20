/* ============================================================================
 * live-data-check.mjs — verify the shipped reader against LIVE official MLB
 * StatsAPI payloads. Needs network access to statsapi.mlb.com (runs in CI and
 * anywhere the network is open; it fails loudly instead of skipping).
 *
 * Every assertion compares the browser modules in assets/js/ with the official
 * payload they will read in production:
 *
 *   1. GET /api/v1/schedule           — slate shape, team ids
 *   2. GET /api/v1/teams?sportId=1    — official abbreviations exist for every
 *                                       team id in the schedule (the schedule
 *                                       itself carries no abbreviation)
 *   3. GET /api/v1.1/game/{pk}/feed/live — reviewDetails count, ABS/pitch
 *                                       challenge records, challenge counters,
 *                                       runs-at-risk attribution
 *   4. GET /api/v1/gameStatus         — every reviewType code our classifier
 *                                       sees is an official registry code, and
 *                                       the under-review prefixes match
 *   5. GET /api/v1/eventTypes         — official-scorer pending types
 *
 * Nothing is mocked. A check that cannot run prints FAIL and exits non-zero.
 *
 * Usage: node tools/live-data-check.mjs [YYYY-MM-DD ...]
 * Default dates: 2026-06-01 (a full slate incl. ABS game 822974) and
 * 2024-10-30 (2024 World Series Game 5, gamePk 775296).
 * ==========================================================================*/
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Api = require('../assets/js/api.js');
const Reviews = require('../assets/js/reviews.js');
const UI = require('../assets/js/ui.js');

const BASE = 'https://statsapi.mlb.com';
const DATES = process.argv.slice(2).length ? process.argv.slice(2) : ['2026-06-01', '2024-10-30'];
const MAX_GAMES_PER_DATE = 4;

let passed = 0;
let failed = 0;

function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { passed++; console.log('  ok  ' + name); })
    .catch((err) => { failed++; console.log('  FAIL ' + name + ' — ' + (err && err.message ? err.message : err)); });
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }

async function getJSON(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { Accept: 'application/json' } });
  assert(res.ok, `HTTP ${res.status} for ${url}`);
  return res.json();
}

/* Coalesce reviewDetails exactly as a raw reader would see them, independent of
 * our extractor: play-level (object or array) plus one per playEvent. */
function rawReviewCount(play) {
  let n = 0;
  const add = (value) => {
    if (!value || typeof value !== 'object') return;
    n += Array.isArray(value) ? value.filter((v) => v && typeof v === 'object').length : 1;
  };
  add(play.reviewDetails);
  for (const ev of play.playEvents || []) if (ev) add(ev.reviewDetails);
  return n;
}

/* Ground-truth runs-at-risk from the official fields, written from the payload
 * definition (runners[].details.isScoringEvent + playIndex), not by calling the
 * function under test. */
function expectedRunsAtRisk(play, review) {
  const runners = play.runners || [];
  return runners.some((r) => {
    const d = (r && r.details) || {};
    if (d.isScoringEvent !== true) return false;
    if (review.eventIndex === null || review.eventIndex === undefined) return review.typeKey !== 'abs';
    return d.playIndex === review.eventIndex;
  });
}

console.log('live-data-check — official sources:');
console.log(`  schedule    ${BASE}/api/v1/schedule?sportId=1&date=YYYY-MM-DD`);
console.log(`  teams       ${BASE}/api/v1/teams?sportId=1`);
console.log(`  feed/live   ${BASE}/api/v1.1/game/{gamePk}/feed/live`);
console.log(`  gameStatus  ${BASE}/api/v1/gameStatus`);
console.log(`  eventTypes  ${BASE}/api/v1/eventTypes`);

/* ---------------------------------------------------------------- registries */
const statusRegistry = await getJSON(`${BASE}/api/v1/gameStatus`);
const eventRegistry = await getJSON(`${BASE}/api/v1/eventTypes`);
const statusCodes = new Set(statusRegistry.map((s) => String(s.statusCode || '')).filter(Boolean));
const eventCodes = new Set(eventRegistry.map((e) => String(e.code || '')).filter(Boolean));

await check('gameStatus registry publishes the review codes we classify on', () => {
  for (const code of ['MJ', 'NJ', 'MS', 'NS', 'MF', 'MA', 'NF', 'NA', 'IH']) {
    assert(statusCodes.has(code), `${code} missing from the official registry`);
  }
});

await check('eventTypes registry publishes both official-scorer pending codes', () => {
  for (const code of Object.keys(Reviews.PENDING_EVENT_TYPES)) {
    assert(eventCodes.has(code), `${code} missing from the official eventTypes registry`);
  }
});

await check('under-review detection matches the official status registry', () => {
  for (const s of statusRegistry) {
    const code = String(s.statusCode || '');
    if (!code) continue;
    const isM = s.codedGameState === 'M';
    const isN = s.codedGameState === 'N';
    const expected = isM || isN || code === 'IH';
    assert(Reviews.isUnderReviewStatus(code) === expected,
      `${code}: classifier said ${Reviews.isUnderReviewStatus(code)}, registry says ${expected}`);
  }
});

/* -------------------------------------------------------------------- teams */
const teams = await getJSON(`${BASE}/api/v1/teams?sportId=1`);
const teamMap = new Map((teams.teams || []).map((t) => [t.id, t]));

await check('teams registry carries an official abbreviation for all 30 clubs', () => {
  assert(teamMap.size >= 30, `only ${teamMap.size} teams returned`);
  for (const [id, t] of teamMap) assert(/^[A-Z0-9]{2,4}$/.test(t.abbreviation || ''), `team ${id} has no abbreviation`);
});

/* -------------------------------------------------------------------- dates */
for (const date of DATES) {
  console.log(`\ndate ${date}`);

  const schedule = await getJSON(`${BASE}/api/v1/schedule?sportId=1&date=${date}`);
  const games = (schedule.dates && schedule.dates[0] && schedule.dates[0].games) || [];

  await check(`${date}: official schedule returns games`, () => {
    assert(games.length > 0, 'no games on this date — pick a date the official schedule has');
  });

  await check(`${date}: every schedule team id exists in the official teams registry (scoreboard abbreviations)`, () => {
    for (const g of games) {
      for (const side of ['away', 'home']) {
        const id = g.teams && g.teams[side] && g.teams[side].team && g.teams[side].team.id;
        assert(teamMap.has(id), `team id ${id} on game ${g.gamePk} missing from /api/v1/teams`);
      }
    }
  });

  const batch = games.slice(0, MAX_GAMES_PER_DATE);
  for (const game of batch) {
    const pk = game.gamePk;
    const feed = await getJSON(`${BASE}/api/v1.1/game/${pk}/feed/live`);
    const plays = (feed.liveData && feed.liveData.plays && feed.liveData.plays.allPlays) || [];
    const extracted = Reviews.extractReviewsFromFeed(feed);

    await check(`${date} game ${pk}: reviewDetails records are all extracted`, () => {
      const raw = plays.reduce((n, p) => n + rawReviewCount(p), 0);
      assert(raw === extracted.reviews.length, `payload has ${raw}, extractor returned ${extracted.reviews.length}`);
    });

    await check(`${date} game ${pk}: every reviewType code is an official registry code`, () => {
      for (const r of extracted.reviews) {
        assert(r.code, `review ${r.id} has no code`);
        assert(statusCodes.has(r.code), `code ${r.code} is not in /api/v1/gameStatus`);
        assert(r.typeKey !== 'unknown', `code ${r.code} classified as unknown`);
      }
    });

    await check(`${date} game ${pk}: pitch challenges (MJ/NJ) classify as ABS and boundary codes (MS/NS) as boundary`, () => {
      for (const r of extracted.reviews) {
        if (r.code === 'MJ' || r.code === 'NJ') assert(r.typeKey === 'abs', `${r.code} classified ${r.typeKey}`);
        if (r.code === 'MS' || r.code === 'NS') assert(r.typeKey === 'boundary', `${r.code} classified ${r.typeKey}`);
        if (String(r.code).charAt(0) === 'M') assert(r.typeKey === 'challenge' || r.typeKey === 'boundary' || r.typeKey === 'abs',
          `manager code ${r.code} classified ${r.typeKey}`);
        if (String(r.code).charAt(0) === 'N') assert(r.typeKey === 'review' || r.typeKey === 'boundary' || r.typeKey === 'abs',
          `umpire code ${r.code} classified ${r.typeKey}`);
      }
    });

    await check(`${date} game ${pk}: official challenge counters are read verbatim`, () => {
      const counters = extracted.counters;
      const review = (feed.gameData && feed.gameData.review) || null;
      const abs = (feed.gameData && feed.gameData.absChallenges) || null;
      for (const side of ['away', 'home']) {
        if (review && review[side]) {
          assert(counters.manager && counters.manager[side], `manager counters missing for ${side}`);
          for (const k of ['used', 'remaining']) {
            if (review[side][k] !== undefined) assert(counters.manager[side][k] === review[side][k], `${side}.${k} mismatch`);
          }
        }
        if (abs && abs[side]) {
          assert(counters.abs && counters.abs[side], `ABS counters missing for ${side}`);
          for (const k of ['usedSuccessful', 'usedFailed', 'remaining']) {
            if (abs[side][k] !== undefined) assert(counters.abs[side][k] === abs[side][k], `${side}.${k} mismatch`);
          }
        }
      }
    });

    await check(`${date} game ${pk}: runs-at-risk matches the official runner attribution`, () => {
      let samples = 0;
      for (const play of plays) {
        const forPlay = extracted.reviews.filter((r) => r.atBatIndex === (play.about && play.about.atBatIndex));
        for (const r of forPlay) {
          const expected = expectedRunsAtRisk(play, r);
          const actual = Reviews.runsAtRisk(play, r);
          assert(actual === expected, `play ${r.atBatIndex} ${r.code}: expected ${expected}, got ${actual}`);
          if (expected) samples++;
        }
      }
      console.log(`       (${samples} review(s) with a run credited to the reviewed event)`);
    });

    await check(`${date} game ${pk}: extractor is deterministic (second pass identical)`, () => {
      const again = Reviews.extractReviewsFromFeed(feed);
      assert(JSON.stringify(again.reviews) === JSON.stringify(extracted.reviews), 'second pass differs');
    });
  }
}

/* ------------------------------------------------- offseason fallback check */
await check('empty-slate fallback finds the last official slate before an offseason date', async () => {
  const probe = '2026-11-20'; // verified empty: /api/v1/schedule?date=2026-11-20 -> {"dates":[]}
  const today = await getJSON(`${BASE}/api/v1/schedule?sportId=1&date=${probe}`);
  assert((today.dates || []).length === 0, `${probe} is no longer empty — adjust this check`);
  const latest = await Api.getLatestSlateDate(probe);
  assert(latest, 'no slate found in any lookback window');
  const independent = await getJSON(`${BASE}/api/v1/schedule?sportId=1&startDate=2026-10-20&endDate=${probe}`);
  const expected = (independent.dates || [])
    .filter((d) => d.games && d.games.length)
    .map((d) => d.date)
    .sort()
    .pop();
  assert(latest === expected, `fallback returned ${latest}, official range says ${expected}`);
  console.log(`       (fallback ${probe} -> ${latest})`);
});

await check('date arithmetic used by the fallback is exact across a month boundary', () => {
  assert(Api._shiftDate('2026-11-20', -14) === '2026-11-06', 'shift -14 failed');
  assert(Api._shiftDate('2026-03-01', -1) === '2026-02-28', 'shift across February failed');
  assert(Api._shiftDate('2024-03-01', -1) === '2024-02-29', 'leap day failed');
  assert(UI.addDays('2026-11-20', 1) === '2026-11-21', 'UI.addDays failed');
});

console.log(`\nlive-data-check: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
