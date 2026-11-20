#!/usr/bin/env node
/* reviews-feed-test.mjs — feed-log merge + ReplayFeed sound-contract tests.
 * No network, no DOM (sound contract checked structurally).
 * Run: node tools/reviews-feed-test.mjs
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const FeedLog = require('../assets/js/feed-log.js');

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}

console.log('reviews-feed-test: feed-log merge');
const a = FeedLog.emptyLog('2026-11-20');
a.entries = [{ gamePk: 1, review: { id: 'r1', label: 'A' }, firstSeen: 100, lastSeen: 100 }];
a.order = ['1:r1'];
const b = FeedLog.emptyLog('2026-11-20');
b.entries = [
  { gamePk: 1, review: { id: 'r1', label: 'A2' }, firstSeen: 90, lastSeen: 200 },
  { gamePk: 2, review: { id: 'r9', label: 'B' }, firstSeen: 150, lastSeen: 150 },
];
b.order = ['1:r1', '2:r9'];
const merged = FeedLog.mergeLogs(a, b);
check('merge unions entries', merged.entries.length === 2);
check('merge keeps earliest firstSeen', merged.entries.find(e => e.gamePk === 1).firstSeen === 90);
check('merge keeps latest lastSeen', merged.entries.find(e => e.gamePk === 1).lastSeen === 200);
check('merge null-safe', FeedLog.mergeLogs(null, b) === b && FeedLog.mergeLogs(a, null) === a);
check('emptyLog shape', FeedLog.emptyLog('2026-01-01').v === 1 && Array.isArray(FeedLog.emptyLog('2026-01-01').entries));

console.log('reviews-feed-test: ReplayFeed sound contract (static)');
const src = fs.readFileSync(new URL('../assets/js/reviews-feed.js', import.meta.url), 'utf8');
['alertSoundSpec', 'bellStrikes', 'setSoundEnabled', 'getSoundEnabled', 'playAlertSound',
 'playSynthAlertNow', 'playAlertSampleNow', 'clearAlertSample', 'primeAlertSound',
 'getAlertSample', 'setAlertSampleFromBytes', 'prevDay', 'nextDay', 'pickDate', 'today',
].forEach((name) => check('exposes ' + name, src.includes(name)));
check('bell strike at 0.5s', /bellStrikes:\s*\[\s*\{\s*at:\s*0\.5/.test(src));
check('cooldown 2500ms', src.includes('2500'));
check('audio candidates in probe order',
  src.indexOf('cha-ching.mp3') < src.indexOf('cha-ching.wav') &&
  src.indexOf('cha-ching.wav') < src.indexOf('cha-ching.ogg') &&
  src.indexOf('cha-ching.ogg') < src.indexOf('cha-ching.m4a'));
check('skips bootstrap without #feed-list', src.includes("!UI.$('feed-list')"));
check('normalizes to -2.0 dBFS', src.includes('-2.0'));

console.log(`\nreviews-feed-test: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
