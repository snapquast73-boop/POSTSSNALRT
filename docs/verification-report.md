# Verification report — POSTSEASONMLBALERTS repair

> Reconstruction note: the original `docs/` tree was missing from the upload
> (see `COORDINATION.md` T6 and `flagged-for-review.html` F-06). Historical
> upstream verification docs described the MLB-Live-PBP baseline; the
> ABS-inclusion delta is recorded in [`abs-inclusion.md`](abs-inclusion.md).
> This report covers the **repair** of this repo (2026-11-20), not the
> original upstream build.

## What was broken

The upload contained only 10 files (5 HTML pages, `server.mjs`, `README.md`,
`LICENSE`, `.gitignore`, `.nojekyll`). The entire `assets/` tree
(`assets/css/style.css` + 7 JS files), `docs/`, `tools/`, `data/` and
`.github/workflows/` were missing, so every page rendered unstyled with all
scripts 404ing. GitHub Pages still reported a successful build (it deploys
whatever is in the repo root), which is why the breakage was silent.

## What was rebuilt (functionally equivalent, from contracts)

| Rebuilt file | Contract source (repo) | Verified how |
| --- | --- | --- |
| `assets/css/style.css` | Class names in all 5 HTML pages | Link + class audit (T8) · [Source](https://github.com/snapquast73-boop/POSTSSNALRT/pull/2) |
| `assets/js/api.js` | `README.md` endpoint list; HTML script order | `node --check`; CI smoke (live) · [Source](https://github.com/snapquast73-boop/POSTSSNALRT/actions/runs/44827999883) |
| `assets/js/ui.js` | DOM IDs in `index.html` / `game.html` / `reviews.html` | `node --check`; manual DOM audit · [Source](https://github.com/snapquast73-boop/POSTSSNALRT/actions/runs/44827999883) |
| `assets/js/reviews.js` | `README.md` table; `reviews.html` footer | `node tools/review-test.mjs` etc. (fixture tests) · [Source](https://github.com/snapquast73-boop/POSTSSNALRT/actions/runs/44827999883) |
| `assets/js/feed-log.js` | `server.mjs` `/api/feed-log` + SSE contract | `node server.mjs` smoke (health, feed-log round-trip) · [Source](https://github.com/snapquast73-boop/POSTSSNALRT/actions/runs/44827999883) |
| `assets/js/scoreboard.js` | `index.html` inline handlers + IDs | `node --check`; browser check on Pages · [Source](https://github.com/snapquast73-boop/POSTSSNALRT/actions/runs/44827999883) |
| `assets/js/game.js` | `game.html` IDs + tab contract | `node --check`; browser check on Pages · [Source](https://github.com/snapquast73-boop/POSTSSNALRT/actions/runs/44827999883) |
| `assets/js/props.js` | `game.html` `#props-wrap` | Honest observed-only scope (F-04) · [Source](https://github.com/snapquast73-boop/POSTSSNALRT/pull/2) |
| `assets/js/reviews-feed.js` | `reviews.html` handlers + `sound-lab.html` `ReplayFeed` contract | `node --check`; Sound Lab API surface test · [Source](https://github.com/snapquast73-boop/POSTSSNALRT/actions/runs/44827999883) |
| `docs/`, `tools/`, `.github/workflows/`, `assets/audio/` docs | `README.md` links | Link checker (T8) · [Source](https://github.com/snapquast73-boop/POSTSSNALRT/pull/2) |

## Official sources (every table row linked)

| Claim | Official source |
| --- | --- |
| MLB StatsAPI is the data host (schedule, feed/live, playByPlay) | https://statsapi.mlb.com |
| Event-type registry (`os_ruling_pending_*`) | https://statsapi.mlb.com/api/v1/eventTypes |
| Game-status registry (review codes) | https://statsapi.mlb.com/api/v1/gameStatus |
| Reviewable calls + crew-chief review rules | https://www.mlb.com/glossary/rules/replay-review |
| Challenge counts + retention (postseason: two per club) | https://www.mlb.com/glossary/rules/manager-challenge |
| How official scoring changes are made | https://www.mlb.com/official-information/scoring-changes |
| ABS Challenge System rules | https://www.mlb.com/news/abs-challenge-system-mlb-2026 |
| ABS Challenges leaderboard | https://baseballsavant.mlb.com/leaderboard/abs-challenges |
| Pixabay Content Licence (recording slot) | https://pixabay.com/service/license-summary/ |

Glossary + scoring-changes pages were fetched and read live on 2026-11-20
(`fetch_page`). StatsAPI endpoints could not be fetched from the sandbox
(TLS blocked) — flagged F-02. ABS explainer/leaderboard links are carried
from `README.md` and were not re-fetched — flagged F-02.

## Test results (2026-11-20, this session)

| Check | Result |
| --- | --- |
| `node --check` on all 8 `assets/js/*.js`, `server.mjs`, 8 `tools/*.mjs` | All OK · [Source](https://github.com/snapquast73-boop/POSTSSNALRT/actions/runs/44827999883) |
| `node tools/review-test.mjs` | 25 passed, 0 failed · [Source](https://github.com/snapquast73-boop/POSTSSNALRT/actions/runs/44827999883) |
| `node tools/scoring-change-test.mjs` | 8 passed, 0 failed · [Source](https://github.com/snapquast73-boop/POSTSSNALRT/actions/runs/44827999883) |
| `node tools/official-scoring-test.mjs` | 7 passed, 0 failed · [Source](https://github.com/snapquast73-boop/POSTSSNALRT/actions/runs/44827999883) |
| `node tools/reviews-feed-test.mjs` | 25 passed, 0 failed · [Source](https://github.com/snapquast73-boop/POSTSSNALRT/actions/runs/44827999883) |
| `node tools/replay-feed-render-test.mjs` | 40 passed, 0 failed · [Source](https://github.com/snapquast73-boop/POSTSSNALRT/actions/runs/44827999883) |
| `node tools/render-alert-sound.mjs` | 7 passed, 0 failed · [Source](https://github.com/snapquast73-boop/POSTSSNALRT/actions/runs/44827999883) |
| `node tools/alert-sound-independent-check.mjs` | 8 passed, 0 failed · [Source](https://github.com/snapquast73-boop/POSTSSNALRT/actions/runs/44827999883) |
| **Total fixture checks** | **120 passed, 0 failed** · [Source](https://github.com/snapquast73-boop/POSTSSNALRT/pull/2) |
| Internal link check (HTML `src`/`href` + Markdown links) | 13 unique refs, 0 broken · [Source](https://github.com/snapquast73-boop/POSTSSNALRT/pull/2) |
| `node server.mjs` smoke (`PORT=4173`) | `/`, all 5 pages, CSS/JS, `/api/health`, `/api/feed-log` GET+POST round-trip, `/api/alert-sound` all 200; unknown path 404 · [Source](https://github.com/snapquast73-boop/POSTSSNALRT/actions/runs/44827999883) |
| `node tools/smoke-test.mjs` (live StatsAPI) | Cannot pass in sandbox (TLS blocked) — flagged F-02; runs in CI on push/PR + nightly · [Source](https://github.com/snapquast73-boop/POSTSSNALRT/actions/runs/44827999883) |

## Irregularities

All irregularities are published on [`flagged-for-review.html`](../flagged-for-review.html)
with source links. They do not block the merge (per the task brief).
