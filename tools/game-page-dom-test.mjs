#!/usr/bin/env node
/* ============================================================================
 * game-page-dom-test.mjs — boots the REAL game.html in a DOM and asserts what
 * a visitor actually sees on the Challenges & Reviews tab.
 *
 * This is the companion to tools/game-page-test.mjs (pure readers, no DOM).
 * Together they cover both halves: the model and the rendered page.
 *
 * Prerequisite: jsdom. It is NOT vendored and NOT a runtime dependency of the
 * site — install it once in a scratch prefix and point JSDOM_MODULE at it:
 *
 *   npm install --prefix /tmp/qa --no-audit --no-fund jsdom
 *   JSDOM_MODULE=/tmp/qa/node_modules/jsdom node tools/game-page-dom-test.mjs
 *
 * Missing jsdom is a loud failure (exit 1 with the command above), never a
 * silent skip: an unrun check is not a passed check.
 *
 * Data: no network. window.fetch is stubbed with VERBATIM official MLB
 * captures committed in tools/fixtures/ (each records its own source URL and
 * fetch date). The stub only ever returns those bytes, so a rendered value can
 * be traced to an official response:
 *   https://statsapi.mlb.com/api/v1/gameStatus
 *   https://statsapi.mlb.com/api/v1.1/game/849799/feed/live
 *   https://statsapi.mlb.com/api/v1/game/849799/playByPlay
 *   https://statsapi.mlb.com/api/v1.1/game/824474/feed/live
 *   https://statsapi.mlb.com/api/v1/game/824474/playByPlay
 *
 * The three scenarios are: the 2026 World Series game (two official ABS pitch
 * challenges), a regular-season game (one manager challenge, code MI, on a
 * hit_by_pitch play), and a registry outage (the page must degrade loudly and
 * invent nothing).
 * ==========================================================================*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let JSDOM, VirtualConsole;
/* ESM will not import a bare directory, so JSDOM_MODULE may point either at the
 * package (".../node_modules/jsdom") or at its entry (".../jsdom/lib/api.js"). */
const candidates = [process.env.JSDOM_MODULE || 'jsdom', path.join(process.env.JSDOM_MODULE || 'jsdom', 'lib/api.js')];
let err = null;
for (const candidate of candidates) {
  try {
    ({ JSDOM, VirtualConsole } = await import(candidate));
    err = null;
    break;
  } catch (e) { err = e; }
}
if (err) {
  console.error(`game-page-dom-test: cannot run — jsdom is not installed.

This check needs jsdom and refuses to pass silently. Install it in a scratch
prefix and re-run:

  npm install --prefix /tmp/qa --no-audit --no-fund jsdom
  JSDOM_MODULE=/tmp/qa/node_modules/jsdom node tools/game-page-dom-test.mjs

(${err.code || err.message})`);
  process.exit(1);
}

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra === undefined ? '' : '  → ' + JSON.stringify(extra))); }
}
function section(title) { console.log('\ngame-page-dom-test: ' + title); }

const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/fixtures/game-status.json'), 'utf8')).statuses;
const absFixture = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/fixtures/game-849799-abs.json'), 'utf8'));
const mgrFixture = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/fixtures/game-824474-manager-challenge.json'), 'utf8'));

/* Feed documents assembled from the verbatim captures. Only the surrounding
 * structure an MLB live feed always carries (inning/halfInning, the play
 * description, the matchup, the linescore) is added so the page has something
 * to render around the review records; every review, counter, team id,
 * pitchNumber and ruling value is the official captured one. */
function feed849799() {
  return {
    gamePk: 849799,
    gameData: absFixture.gameData.gameData,
    liveData: {
      plays: {
        allPlays: absFixture.reviewPlays.allPlays.map((p) => {
          const isTop = p.about.atBatIndex === 36;
          return {
            about: { ...p.about, isComplete: true, inning: isTop ? 7 : 5, isTopInning: isTop, halfInning: isTop ? 'top' : 'bottom' },
            result: {
              eventType: 'field_out',
              description: isTop
                ? 'Christian Yelich lines out to center fielder Jonny DeLuca.'
                : 'Ryan Vilade grounds out, second baseman Richie Palacios to first baseman Jake Bauers.',
            },
            matchup: {
              batter: { fullName: isTop ? 'Christian Yelich' : 'Ryan Vilade' },
              pitcher: { fullName: 'Steven Matz' },
            },
            playEvents: p.playEvents,
          };
        }),
      },
      linescore: {
        innings: [{ num: 1, away: { runs: 0 }, home: { runs: 0 } }],
        teams: { away: { runs: 4, hits: 8, errors: 2 }, home: { runs: 1, hits: 4, errors: 0 } },
        offense: {},
      },
    },
  };
}

function feed824474() {
  return {
    gamePk: 824474,
    gameData: mgrFixture.gameData.gameData,
    liveData: {
      plays: {
        allPlays: [{
          about: { atBatIndex: 65, isComplete: true, inning: 7, isTopInning: false, halfInning: 'bottom' },
          // The capture was filtered to result.eventType, so no official
          // description text exists for this play: it is left absent (rendered
          // blank) rather than filled in with wording MLB never returned.
          result: { eventType: mgrFixture.reviewPlayWithResult.result.eventType },
          reviewDetails: mgrFixture.reviewPlayWithProgress.reviewDetails,
        }],
      },
    },
  };
}

const SCRIPTS = ['api.js', 'ui.js', 'reviews.js', 'feed-log.js', 'props.js', 'game.js'];

async function boot(gamePk, options = {}) {
  const html = fs.readFileSync(path.join(ROOT, 'game.html'), 'utf8');
  const warnings = [];
  const requested = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => warnings.push('jsdomError: ' + e.message));
  vc.on('error', (...a) => warnings.push('console.error: ' + a.join(' ')));
  vc.on('warn', (...a) => warnings.push('console.warn: ' + a.join(' ')));
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc,
    url: `https://example.test/POSTSSNALRT/game.html?gamePk=${gamePk}`,
  });
  dom.window.fetch = async (url) => {
    const u = String(url);
    requested.push(u);
    if (u.includes('/api/v1/gameStatus')) {
      if (options.registryDown) throw new Error('network down');
      return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => registry };
    }
    if (u.includes('/feed/live')) {
      const body = String(gamePk) === '849799' ? feed849799() : feed824474();
      return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => body };
    }
    // Anything else the page asks for is refused rather than invented.
    return { ok: false, status: 404, headers: { get: () => 'application/json' }, json: async () => ({}) };
  };
  for (const file of SCRIPTS) {
    dom.window.eval(fs.readFileSync(path.join(ROOT, 'assets/js', file), 'utf8'));
  }
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 300));
  return { dom, doc: dom.window.document, warnings, requested };
}

/* ---------------------------------------------------------------- scenario 1 */
section('game 849799 — 2026 World Series, two official ABS pitch challenges');
{
  const { dom, doc, warnings, requested } = await boot('849799');
  const txt = doc.getElementById('reviews-wrap').textContent;
  check('page boots with no jsdom error and no console warning', warnings.length === 0, warnings);
  check('the official status registry was requested',
    requested.some((u) => u.includes('statsapi.mlb.com/api/v1/gameStatus')), requested);
  check('the official live feed was requested',
    requested.some((u) => u.includes('statsapi.mlb.com/api/v1.1/game/849799/feed/live')));
  check('MLB\'s own wording is shown for MJ', txt.includes('Player challenge: Pitch Result'), txt.slice(0, 200));
  check('the ruling "Overturned" is shown from isOverturned:true', txt.includes('Overturned'));
  check('the official pitchNumber 2 is shown (playEvent index is 1)', txt.includes('Pitch: 2'));
  check('the official pitchNumber 1 is shown (playEvent index is 0)', txt.includes('Pitch: 1'));
  check('the challenging club MIL is shown for challengeTeamId 158', txt.includes('Challenged by: MIL'));
  check('the challenging club TB is shown for challengeTeamId 139', txt.includes('Challenged by: TB'));
  check('the official counter table is rendered',
    txt.includes('Official challenge counters') && txt.includes('ABS challenges retained (successful)'));
  check('the tab badge counts both records', doc.getElementById('reviews-tab-count').textContent === '2',
    doc.getElementById('reviews-tab-count').textContent);
  const cards = doc.querySelectorAll('#reviews-wrap .review-card');
  check('two review cards rendered', cards.length === 2, cards.length);
  const cardLinks = [...doc.querySelectorAll('#reviews-wrap .review-card a')].map((a) => a.getAttribute('href'));
  check('every card links its official MLB source',
    cardLinks.length >= 2 && cardLinks.every((h) => h === 'https://statsapi.mlb.com/api/v1.1/game/849799/feed/live'), cardLinks);
  const counterLinks = [...doc.querySelectorAll('#reviews-wrap table.score-table tbody tr td:last-child a')]
    .map((a) => a.getAttribute('href'));
  check('every counter row links its official MLB source',
    counterLinks.length === 5 && counterLinks.every((h) => h.includes('statsapi.mlb.com/api/v1.1/game/849799/feed/live')), counterLinks);
  check('play-by-play rows carry the official wording and ruling',
    doc.getElementById('plays-wrap').textContent.includes('Player challenge: Pitch Result — Overturned'));
  check('the linescore still renders', doc.getElementById('linescore-wrap').textContent.includes('Milwaukee Brewers'));
  doc.querySelector('[data-tab="reviews"]').dispatchEvent(new dom.window.Event('click', { bubbles: true }));
  check('the tab switch still shows the reviews panel',
    doc.getElementById('panel-reviews').style.display === '' && doc.getElementById('panel-plays').style.display === 'none');
  check('the loading overlay is hidden after load', doc.getElementById('loading').hidden === true);
}

/* ---------------------------------------------------------------- scenario 2 */
section('game 824474 — manager challenge MI on a hit_by_pitch play');
{
  const { doc, warnings } = await boot('824474');
  const txt = doc.getElementById('reviews-wrap').textContent;
  check('page boots with no jsdom error and no console warning', warnings.length === 0, warnings);
  check('MLB\'s own wording is shown for MI', txt.includes('Manager challenge: Hit by pitch'), txt.slice(0, 300));
  check('the ruling reads "Call stands (not overturned)"', txt.includes('Call stands (not overturned)'));
  check('the challenging club CIN is shown for challengeTeamId 113', txt.includes('Challenged by: CIN'));
  check('manager counters are shown verbatim',
    txt.includes('Manager challenges used') && txt.includes('Manager challenges remaining'));
  check('ABS counters are shown verbatim', txt.includes('ABS challenges lost (failed)'));
  check('no pitch number is invented for a play-level review', !txt.includes('Pitch:'));
}

/* ---------------------------------------------------------------- scenario 3 */
section('registry outage — degrade loudly, invent nothing');
{
  const { doc, warnings } = await boot('824474', { registryDown: true });
  const txt = doc.getElementById('reviews-wrap').textContent;
  check('the page still renders without the registry', txt.length > 0);
  check('the generic classification label is used, not invented wording',
    txt.includes('Manager challenge') && !txt.includes('Hit by pitch'));
  check('the outage is stated on the page', txt.includes('could not be fetched'), txt.slice(0, 200));
  check('the outage is logged loudly', warnings.some((w) => /game-status registry unavailable/.test(w)), warnings);
}

console.log(`\ngame-page-dom-test: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
