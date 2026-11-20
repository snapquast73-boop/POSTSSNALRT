// Black-box smoke test. Run with Node 22+, Playwright and its Chromium installed:
// npm install --no-save --package-lock=false playwright && npx playwright install chromium
// node qa/pages-acceptance.mjs [project-root-URL]
// Uses real MLB responses, never mocks or silently skips an unavailable service.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = new URL(process.argv[2] || 'https://snapquast73-boop.github.io/POSTSSNALRT/');
if (!base.pathname.endsWith('/')) base.pathname += '/';
const date = '2024-10-30';
const stats = 'https://statsapi.mlb.com';
const scheduleUrl = `${stats}/api/v1/schedule?sportId=1&date=${date}`;
const response = await fetch(scheduleUrl, { signal: AbortSignal.timeout(20000) });
assert(response.ok, `${scheduleUrl}: HTTP ${response.status}`);
const slate = await response.json();
const game = slate.dates.find(day => day.date === date)?.games.find(g => g.gamePk === 775296);
assert(game?.link, `Reference game absent from ${scheduleUrl}`);
const feedUrl = new URL(game.link, stats);
assert.equal(feedUrl.origin, stats);
const browser = await chromium.launch({executablePath: process.env.CHROMIUM_EXECUTABLE || undefined});
try {
  const page = await browser.newPage();
  const failures = [];
  const localResource = req => new URL(req.url()).origin === base.origin &&
    ['document', 'script', 'stylesheet'].includes(req.resourceType());
  page.on('pageerror', e => failures.push(e.message));
  page.on('requestfailed', req => { if (localResource(req)) failures.push(`${req.url()}: ${req.failure()?.errorText}`); });
  page.on('response', res => { if (localResource(res.request()) && res.status() >= 400) failures.push(`${res.status()} ${res.url()}`); });
  const open = async path => {
    const url = new URL(path, base);
    const res = await page.goto(url.href);
    assert(res?.ok(), `Could not load ${url}`);
    assert.equal(new URL(page.url()).origin, base.origin);
    assert.deepEqual(failures, []);
  };
  await open('index.html');
  await page.locator('#date-picker').fill(date);
  const link = page.locator(`#game-list a[href*="gamePk=${game.gamePk}"]`).first();
  await link.waitFor();
  for (const side of ['away', 'home']) assert((await link.innerText()).includes(game.teams[side].team.name));
  const gamePage = new URL(await link.getAttribute('href'), page.url());
  assert.equal(gamePage.pathname, new URL('game.html', base).pathname);
  const [feed] = await Promise.all([
    page.waitForResponse(res => new URL(res.url()).origin === stats && new URL(res.url()).pathname === feedUrl.pathname),
    open(gamePage.href)
  ]);
  assert(feed.ok(), `HTTP ${feed.status()} for ${feed.url()}`);
  assert.equal((await feed.json()).gamePk, game.gamePk);
  await page.locator('#header-away').getByText(game.teams.away.team.name, {exact:false}).first().waitFor();
  await page.locator('#header-home').getByText(game.teams.home.team.name, {exact:false}).first().waitFor();
  await page.locator('[data-tab="boxscore"]').click();
  await page.locator('#panel-boxscore').waitFor();
  for (const row of await page.locator('#boxscore-wrap tbody tr, #linescore-wrap tbody tr, #props-wrap tbody tr').all()) {
    assert.equal(await row.locator('a').getAttribute('href'), feedUrl.href);
  }
  // Check pitch challenges against MLB's real objects, not our fixture schema.
  const absPk = 822974;
  const [absRes] = await Promise.all([
    page.waitForResponse(r => r.ok() && r.url() === `${stats}/api/v1.1/game/${absPk}/feed/live`),
    open(`game.html?gamePk=${absPk}`)
  ]);
  const plays = (await absRes.json()).liveData.plays.allPlays;
  const absCount = plays.flatMap(p => [p, ...p.playEvents]).filter(p => p.reviewDetails?.reviewType === 'MJ').length;
  assert(absCount > 1, 'Reference game no longer contains multiple MJ records');
  await page.locator('[data-tab="reviews"]').click();
  assert.equal(await page.locator('#reviews-wrap .badge.abs').count(), absCount);
  await open('reviews.html');
  await page.locator('#date-picker').fill('2026-06-01');
  const listed = page.locator('.feed-item').filter({has:page.locator(`a[href="${stats}/api/v1.1/game/${absPk}/feed/live"]`)}).filter({has:page.locator('.badge.abs')});
  await listed.first().waitFor({timeout:60000});
  assert.equal(await listed.count(), absCount);
  await page.getByRole('button', {name:'ABS',exact:true}).click();
  assert.equal(await listed.count(), absCount);
  await open('sound-lab.html');
  await page.waitForFunction(() => typeof window.ReplayFeed?.playAlertSound === 'function');
  await open('flagged-for-review.html');
  assert.deepEqual(failures, []);
  console.log(`PASS: ${base} — scoreboard date, game feed, box-score tab, replay fetch, sound hook, review page.`);
  console.log(`Official comparison: ${scheduleUrl} and ${feedUrl}`);
} finally {
  await browser.close();
}
