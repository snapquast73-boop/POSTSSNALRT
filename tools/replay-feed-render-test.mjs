#!/usr/bin/env node
/* replay-feed-render-test.mjs — render-contract tests for the feed UI.
 * No network, no DOM: checks that reviews-feed.js renders every tab,
 * stat, badge and irregularity surface the HTML promises.
 * Run: node tools/replay-feed-render-test.mjs
 */
import fs from 'node:fs';

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}

const feedSrc = fs.readFileSync(new URL('../assets/js/reviews-feed.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../assets/css/style.css', import.meta.url), 'utf8');
const reviewsHtml = fs.readFileSync(new URL('../reviews.html', import.meta.url), 'utf8');

console.log('replay-feed-render-test: tabs');
['all', 'challenge', 'review', 'boundary', 'abs', 'under-review', 'runs-at-risk', 'pending', 'scoring']
  .forEach((k) => check('tab key ' + k, feedSrc.includes("key: '" + k + "'")));
check('renders into #feed-tabs', feedSrc.includes("UI.$('feed-tabs')"));
check('renders into #feed-list', feedSrc.includes("UI.$('feed-list')"));
check('renders into #feed-stats', feedSrc.includes("UI.$('feed-stats')"));
check('renders into #active-strip', feedSrc.includes("UI.$('active-strip')"));
check('escapes payload text', feedSrc.includes('UI.esc('));

console.log('replay-feed-render-test: HTML contract');
['date-picker', 'date-label', 'sound-toggle-btn', 'notify-toggle-btn', 'refresh-btn',
 'countdown', 'live-dot', 'banner', 'active-strip', 'feed-stats', 'feed-tabs', 'feed-list', 'status-line']
  .forEach((id) => check('reviews.html has #' + id, reviewsHtml.includes('id="' + id + '"')));
check('reviews.html loads reviews-feed.js', reviewsHtml.includes('assets/js/reviews-feed.js'));

console.log('replay-feed-render-test: CSS coverage');
['feed-item', 'feed-item-head', 'feed-matchup', 'feed-time', 'feed-body', 'feed-meta',
 'stat-chip', 'active-chip', 'badge', 'irregularity', 'live-dot', 'live-pill']
  .forEach((cls) => check('CSS has .' + cls, css.includes('.' + cls)));

console.log(`\nreplay-feed-render-test: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
