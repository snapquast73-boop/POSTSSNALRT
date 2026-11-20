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

---

## Post-release pass — 2026-11-20 (session a35ded9a)

`main` was already deployed (PR #4) when this pass started. It asked a different
question: **does the deployed site work for a visitor today?** Every finding
below was reproduced against official MLB data before it was changed.

| Finding | Evidence (official) | Fix | Verified by |
| --- | --- | --- | --- |
| Scoreboard cards showed no team abbreviation | [`GET /api/v1/schedule`](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-06-01) returns team objects with `id`/`name`/`link` only — no `abbreviation`, even when requested in `fields`; [`GET /api/v1/teams?sportId=1`](https://statsapi.mlb.com/api/v1/teams?sportId=1) does carry it | `assets/js/api.js` `getTeamMap()` (memoized) + `assets/js/scoreboard.js` `abbrOf()`; unknown ids stay blank | `tools/live-data-check.mjs` (every schedule team id exists in the registry) and the browser check (each card's code equals the registry value) |
| Replay-feed labels used full club names | [`GET /api/v1.1/game/822974/feed/live`](https://statsapi.mlb.com/api/v1.1/game/822974/feed/live) carries `gameData.teams.{away,home}.abbreviation` | `assets/js/reviews-feed.js` `feedLabel()` prefers the feed's own abbreviations | browser check asserts every `.feed-matchup` matches `AAA @ BBB` |
| Runs at Risk never populated | `runners[].details.isScoringEvent` / `playIndex` exist in the official feed; the old code evaluated only brand-new rows on the current play | re-evaluated for every tracked review on every poll | `tools/live-data-check.mjs` compares the function with the payload attribution for every review in four games per date |
| Object-shaped `reviewDetails` missed by the legacy no-review path | payload delivers `reviewDetails` as an object, not an array | `Reviews.hasReviewDetails()` accepts either shape | `tools/front-end-logic-test.mjs` |
| Every page empty today | [`date=2026-11-20` → `{"dates":[]}`](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-11-20); last slate [2026-10-28](https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=2026-10-20&endDate=2026-11-20) | one-time empty-slate fallback + banner (flagged F-09) | `tools/live-data-check.mjs` (fallback vs an independent range query) and the browser check |
| Nested 404 lost styling/links | GitHub serves `404.html` at the missing path | adopted [PR #5](https://github.com/snapquast73-boop/POSTSSNALRT/pull/5)'s `<base>` repair instead of a duplicate rewrite | browser check asserts the stylesheet and back-link resolve to the project root |
| Post-deploy acceptance never ran | runs 44828791518 / 44828796450 skipped; no run for the `success` status; `workflow_dispatch` had no default URL | `workflow_run` on `pages build and deployment` + defaulted dispatch (flagged F-10) | run list on `main` after merge |

### Checks in this pass

| Check | Result |
| --- | --- |
| `node tools/front-end-logic-test.mjs` (new) | 27 passed, 0 failed |
| Fixture suite (`review`, `reviews-feed`, `replay-feed-render`, `scoring-change`, `official-scoring`, `render-alert-sound`, `alert-sound-independent`) | 120 passed, 0 failed |
| `node tools/live-data-check.mjs` (new, live) | passed in CI against the official registries and game feeds |
| `python3 qa/check-links.py` | 0 unresolved local references |
| `node server.mjs` smoke | all pages/assets 200, unknown + nested paths 404 with the custom page |
| Browser acceptance (`qa/pages-acceptance.mjs`) | run on the PR (local build) and, after merge, on the public URL |

### Limits that are still limits

- The build sandbox cannot reach `statsapi.mlb.com`; every live assertion above
  ran in CI, and the run IDs are recorded in `COORDINATION.md`.
- Exact upstream parity is still unverifiable (upstream repo 404 — F-07).
- The empty-slate fallback is an addition (F-09), not recovered upstream code.
- Alert-sound measurements are unchanged from the previous pass (F-05).
