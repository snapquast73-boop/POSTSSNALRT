// Black-box browser acceptance for the deployed site. Run with Node 22+,
// Playwright and its Chromium installed:
//   npm install --no-save --package-lock=false playwright && npx playwright install chromium
//   node qa/pages-acceptance.mjs [project-root-URL]
// Default target is the live GitHub Pages site. Uses real MLB responses and
// real official registries; never mocks, and only skips a check where the
// static preview genuinely cannot exhibit a Pages-only feature (logged).
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = new URL(process.argv[2] || 'https://snapquast73-boop.github.io/POSTSSNALRT/');
if (!base.pathname.endsWith('/')) base.pathname += '/';
const isDeployed = base.hostname.endsWith('github.io');

const stats = 'https://statsapi.mlb.com';
const GAME_DATE = '2026-06-01';   // full slate, includes ABS reference game 822974
const REF_PK = 822974;            // multiple MJ pitch challenges in one game
const WS_DATE = '2024-10-30';     // 2024 World Series G5, gamePk 775296
const WS_PK = 775296;

async function official(path) {
  const res = await fetch(stats + path, { signal: AbortSignal.timeout(20000) });
  assert(res.ok, `${stats}${path}: HTTP ${res.status}`);
  return res.json();
}

/* ------------------------------------------------------------- official data */
const slate = await official(`/api/v1/schedule?sportId=1&date=${GAME_DATE}`);
const games = slate.dates.find((d) => d.date === GAME_DATE)?.games || [];
assert(games.length > 1, `not enough games on ${GAME_DATE} in the official schedule`);
const game = games.find((g) => g.gamePk === REF_PK) || games[0];
const feedUrl = new URL(game.link, stats);
assert.equal(feedUrl.origin, stats);

const feed = await official(new URL(game.link, stats).pathname);
const plays = feed.liveData.plays.allPlays;
const absCount = plays.flatMap((p) => [p, ...p.playEvents]).filter((p) => p.reviewDetails?.reviewType === 'MJ').length;
assert(absCount > 1, 'reference game no longer contains multiple MJ records');

const teamReg = await official('/api/v1/teams?sportId=1');
const abbrById = new Map(teamReg.teams.map((t) => [t.id, t.abbreviation]));

// Today's slate decides whether the empty-slate fallback must fire.
const todayStr = new Date().toISOString().slice(0, 10);
const today = await official(`/api/v1/schedule?sportId=1&date=${todayStr}`);
const todayGames = today.dates.find((d) => d.date === todayStr)?.games || [];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE || undefined });
try {
  const page = await browser.newPage();
  const failures = [];
  const localResource = (req) => new URL(req.url()).origin === base.origin &&
    ['document', 'script', 'stylesheet'].includes(req.resourceType());
  page.on('pageerror', (e) => failures.push('pageerror: ' + e.message));
  // Console policy: a real script error is always a failure. Chromium's
  // "Failed to load resource" line is a network-level message (its URL lives in
  // m.location(), not in the text) and is already covered for our own
  // documents/scripts/stylesheets by the response + requestfailed handlers
  // below; static hosting also 404s the optional /api/* probes and the
  // uninstalled recording on purpose. Report those, do not fail on them.
  const ignored = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text() || '';
    if (/^Failed to load resource/.test(text)) { ignored.push(text + ' @ ' + (m.location()?.url || '')); return; }
    failures.push('console: ' + text);
  });
  page.on('requestfailed', (req) => { if (localResource(req)) failures.push(`${req.url()}: ${req.failure()?.errorText}`); });
  page.on('response', (res) => { if (localResource(res.request()) && res.status() >= 400) failures.push(`${res.status()} ${res.url()}`); });

  const open = async (path) => {
    const url = new URL(path, base);
    const res = await page.goto(url.href, { waitUntil: 'domcontentloaded' });
    assert(res?.ok(), `Could not load ${url}`);
    assert.equal(new URL(page.url()).origin, base.origin);
    return res;
  };
  const assertClean = (where) => assert.deepEqual(failures, [], `page errors on ${where}: ${failures.join(' | ')}`);

  /* ---------------------------------------------------------- scoreboard */
  console.log('→ scoreboard');
  await open('index.html');
  await page.locator('#date-picker').fill(GAME_DATE);
  const link = page.locator(`#game-list a[href*="gamePk=${game.gamePk}"]`).first();
  await link.waitFor();
  for (const side of ['away', 'home']) assert((await link.innerText()).includes(game.teams[side].team.name));

  // Official abbreviation on every card (schedule payload has none; the page
  // must read /api/v1/teams instead of leaving the cell blank).
  await page.waitForFunction(() => {
    const cards = [...document.querySelectorAll('#game-list .game-card')];
    return cards.length > 0 && cards.every((c) => (c.querySelector('.team-abbr')?.textContent || '').trim().length > 0);
  }, null, { timeout: 20000 });
  for (const card of await page.locator('#game-list .game-card').all()) {
    // The card itself is the <a class="game-card">, so read its own href.
    const ids = (await card.getAttribute('href') || '').match(/gamePk=(\d+)/);
    if (!ids) continue;
    const g = games.find((x) => String(x.gamePk) === ids[1]);
    if (!g) continue;
    const shown = await card.locator('.team-abbr').allInnerTexts();
    for (const side of ['away', 'home']) {
      assert(shown.includes(abbrById.get(g.teams[side].team.id)),
        `${g.gamePk} ${side}: expected official abbreviation ${abbrById.get(g.teams[side].team.id)}, saw ${JSON.stringify(shown)}`);
    }
  }
  assert.equal(await page.locator('#game-list .team-logo').count() > 0, true, 'team logos missing');
  assertClean('scoreboard');

  /* ------------------------------------- empty-slate fallback (offseason) */
  if (!todayGames.length) {
    console.log('→ empty-slate fallback');
    await open('index.html');
    const banner = page.locator('#banner.show');
    await banner.waitFor({ timeout: 30000 });
    const text = await banner.innerText();
    assert(/No MLB games are scheduled/.test(text), `fallback banner missing: ${text}`);
    await page.locator('#game-list .game-card').first().waitFor({ timeout: 30000 });
    const shownDate = await page.locator('#date-picker').inputValue();
    assert(shownDate !== todayStr, `date picker still on the empty date ${todayStr}`);
    assertClean('scoreboard fallback');
    console.log(`      empty-slate fallback: ${todayStr} -> ${shownDate}`);
  } else {
    console.log(`      empty-slate fallback not exercised: official schedule has ${todayGames.length} game(s) today`);
  }

  /* ---------------------------------------------------------------- game */
  console.log('→ game page');
  const gamePage = new URL(await link.getAttribute('href'), page.url());
  assert.equal(gamePage.pathname, new URL('game.html', base).pathname);
  const [feedRes] = await Promise.all([
    page.waitForResponse((res) => new URL(res.url()).origin === stats && new URL(res.url()).pathname === feedUrl.pathname),
    open(gamePage.href),
  ]);
  assert(feedRes.ok(), `HTTP ${feedRes.status()} for ${feedRes.url()}`);
  assert.equal((await feedRes.json()).gamePk, game.gamePk);
  await page.locator('#header-away').getByText(game.teams.away.team.name, { exact: false }).first().waitFor();
  await page.locator('#header-home').getByText(game.teams.home.team.name, { exact: false }).first().waitFor();
  assert(/^\d+ – \d+$/.test((await page.locator('#header-center .header-score').innerText()).trim()),
    'header score not rendered');
  assert((await page.locator('#plays-wrap .play-row').count()) > 10, 'play-by-play rows missing');

  await page.locator('[data-tab="boxscore"]').click();
  await page.locator('#panel-boxscore').waitFor();
  for (const row of await page.locator('#boxscore-wrap tbody tr, #linescore-wrap tbody tr').all()) {
    assert.equal(await row.locator('a').getAttribute('href'), feedUrl.href, 'source link missing on a table row');
  }
  assert((await page.locator('#boxscore-wrap tbody tr').count()) > 8, 'box score rows missing');
  await page.locator('[data-tab="props"]').click();
  await page.locator('#panel-props').waitFor();
  assert((await page.locator('#props-wrap tbody tr').count()) > 3, 'props rows missing');
  await page.locator('[data-tab="reviews"]').click();
  assert.equal(await page.locator('#reviews-wrap .badge.abs').count(), absCount, 'ABS records on the game page');
  assertClean('game page');

  /* --------------------------------------------------------------- feed */
  console.log('→ replay feed');
  await open('reviews.html');
  await page.locator('#date-picker').fill(GAME_DATE);
  const listed = page.locator('.feed-item')
    .filter({ has: page.locator(`a[href="${stats}/api/v1.1/game/${REF_PK}/feed/live"]`) })
    .filter({ has: page.locator('.badge.abs') });
  await listed.first().waitFor({ timeout: 60000 });
  assert.equal(await listed.count(), absCount, 'ABS rows in the All feed');
  // Matchup labels come from the feed's official abbreviations now.
  const labels = await page.locator('.feed-item .feed-matchup').allInnerTexts();
  const bad = labels.filter((t) => !/^[A-Z0-9]{2,4} @ [A-Z0-9]{2,4}$/.test(t.trim()));
  assert.deepEqual(bad, [], `matchup labels not official abbreviations: ${JSON.stringify(bad.slice(0, 3))}`);
  await page.getByRole('button', { name: 'ABS', exact: true }).click();
  assert.equal(await listed.count(), absCount, 'ABS tab count');
  assert((await page.locator('#feed-stats .stat-chip').count()) >= 8, 'feed stats missing');
  assertClean('replay feed');

  /* ---------------------------------------------------------- sound lab */
  console.log('→ sound lab');
  await open('sound-lab.html');
  await page.waitForFunction(() => typeof window.ReplayFeed?.playAlertSound === 'function');
  const spec = await page.evaluate(() => window.ReplayFeed.alertSoundSpec);
  assert(spec && spec.duration > 1.5 && spec.bellStrikes.length === 1, 'alert sound spec missing');
  assert((await page.locator('#lab-state .lab-pill').count()) >= 2, 'sound lab state pills missing');
  assertClean('sound lab');

  /* ------------------------------------------------ flagged + 404 pages */
  console.log('→ flagged page');
  await open('flagged-for-review.html');
  assert((await page.locator('table tbody tr').count()) >= 7, 'flagged table rows missing');
  assertClean('flagged page');

  if (isDeployed) {
    const res = await page.goto(new URL('no-such-directory/no-such-page.html', base).href);
    assert.equal(res?.status(), 404, `deep 404 returned ${res?.status()}`);
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    assert.notEqual(bg, 'rgba(0, 0, 0, 0)', 'custom 404 rendered unstyled at depth');
    // The nested-404 fix (PR #5) resolves assets and links through <base>.
    const sheets = await page.evaluate(() => [...document.styleSheets].map((s) => s.href).filter(Boolean));
    assert(sheets.some((h) => h === base.href + 'assets/css/style.css'),
      `404 stylesheet not resolved to the project root: ${JSON.stringify(sheets)}`);
    const home = await page.locator('a', { hasText: 'Back to scoreboard' }).first().evaluate((el) => el.href);
    assert.equal(home, base.href + 'index.html', `404 home link resolves to ${home}`);
  } else {
    console.log('      404-at-depth check skipped: the static preview server does not serve 404.html (Pages-only behaviour)');
  }

  assert.deepEqual(failures, [], `page errors: ${failures.join(' | ')}`);
  if (ignored.length) console.log(`      ignored network-level console lines (optional endpoints/assets): ${ignored.length}`);
  console.log(`PASS: ${base}`);
  console.log(`Official comparison: ${stats}/api/v1/schedule?sportId=1&date=${GAME_DATE}, ${feedUrl.href}, ${stats}/api/v1/teams?sportId=1`);
} finally {
  await browser.close();
}
