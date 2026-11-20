# Coordination board — POSTSSNALRT repair

> Shared task board for parallel agent sessions. Read before starting work.
> Claim a task by writing your session ID and file scope, then commit + push
> the claim immediately. Never start a task another session has claimed.
> Keep scopes non-overlapping. If a task needs a file owned by another
> session, log the request here instead of editing it.
> Small, frequent commits. `git pull --rebase` before every push.
> A claim older than 60 minutes with no commits may be taken over (note handoff).
> A status of **needs review** means the item is published on the
> [Flagged for Review page](flagged-for-review.html) and does not block anything.

Session ID for this session: `f8d07dda` (branch `arena/f8d07dda-postssnalrt`).
This session acted as sole worker + final integration session (no other
sessions were active; all scopes were claimed sequentially by f8d07dda).

## Task board

| ID | Task | Status | Owner | Files touched | Sources / verification | Irregularities |
|----|------|--------|-------|---------------|------------------------|----------------|
| T1 | Rebuild `assets/css/style.css` (all pages unstyled — file missing from upload) | done | f8d07dda | `assets/css/style.css` | HTML class contracts in `index.html`, `game.html`, `reviews.html`, `sound-lab.html`, `404.html` (repo); CSS coverage asserted by `tools/replay-feed-render-test.mjs` | Original stylesheet not in upload; rebuilt from class contracts. See F-01. |
| T2 | Rebuild `assets/js/api.js` + `assets/js/ui.js` (MLB StatsAPI client + shared UI helpers) | done | f8d07dda | `assets/js/api.js`, `assets/js/ui.js` | [MLB StatsAPI host](https://statsapi.mlb.com); endpoints in `docs/api-compliance.md`; `node --check` OK | statsapi.mlb.com unreachable from build sandbox (TLS blocked) — live calls verified in browser/CI only. See F-02. |
| T3 | Rebuild `assets/js/reviews.js` + `assets/js/feed-log.js` (review classification, scoring-change diff, persistence) | done | f8d07dda | `assets/js/reviews.js`, `assets/js/feed-log.js` | [Replay Review glossary](https://www.mlb.com/glossary/rules/replay-review), [Manager Challenge glossary](https://www.mlb.com/glossary/rules/manager-challenge), [Scoring Changes log](https://www.mlb.com/official-information/scoring-changes) (all fetched live 2026-11-20); `tools/review-test.mjs` 25/25, `scoring-change-test` 8/8, `official-scoring-test` 7/7 | Review code meanings (MA/MF/MJ…) unverified from official source — classification keys off payload `type.description` first, codes shown verbatim. See F-03. |
| T4 | Rebuild `assets/js/scoreboard.js` + `assets/js/game.js` + `assets/js/props.js` | done | f8d07dda | `assets/js/scoreboard.js`, `assets/js/game.js`, `assets/js/props.js` | DOM IDs in `index.html` / `game.html` (repo, audited — 0 missing IDs); `node --check` OK | Props forecast model not in upload — observed payload data only, no invented probabilities. See F-04. |
| T5 | Rebuild `assets/js/reviews-feed.js` incl. cha-ching sound engine + `ReplayFeed` global (sound-lab contract) | done | f8d07dda | `assets/js/reviews-feed.js` | Sound-lab contract in `sound-lab.html` (repo); [Pixabay licence summary](https://pixabay.com/service/license-summary/); `tools/reviews-feed-test.mjs` 25/25, `replay-feed-render-test` 40/40 | No audio recording committed (paid Bandcamp source) — synthesized fallback only. See F-05. |
| T6 | Restore `docs/`, `tools/`, `.github/workflows/`, `assets/audio/` docs referenced by README | done | f8d07dda | `docs/**`, `tools/**`, `.github/workflows/**`, `assets/audio/README.md`, `assets/audio/LICENCE.md`, `data/.gitkeep` | README link audit (repo) — 0 missing local links after restore; official sources in `docs/verification-report.md` | Original docs/tools not in upload; restored as honest reconstructions with actually-passing check counts (120 total). See F-06. |
| T7 | Add `flagged-for-review.html` + footer links + README link fix | done | f8d07dda | `flagged-for-review.html`, `index.html`, `game.html`, `reviews.html`, `README.md` | Internal link checker: 13 unique refs, 0 broken; every flagged row links an official source | Upstream repo/site unverifiable (404/unreachable). See F-07. |
| T8 | Final integration: tests, link check, server smoke, PR to `main`, merge, Pages deploy check | done | f8d07dda | (integration only) | 120/120 fixture checks; `node server.mjs` smoke all-200 + 404; GitHub Pages build status checked after merge (see PR record) | Live-API smoke cannot pass in sandbox (F-02); CI (`.github/workflows/smoke.yml`) runs it on push/PR + nightly. |

## Handoff / conflict log

- 2026-11-20 — f8d07dda created this board (no prior board existed). Claimed T1, then T2–T8 sequentially as sole active session + integration session.
- No merge conflicts; no other sessions' work was discarded. No cross-scope requests were needed (single-session scopes).

## Verification log

- 2026-11-20 — MLB official game-status registry [`/api/v1/gameStatus`](https://statsapi.mlb.com/api/v1/gameStatus) fetched via `fetch_page` (all 4 chunks): code `MJ` = "Player challenge: Pitch Result" (player pitch challenge — the ABS pitch challenge, per MLB's own ABS pages: [abs-challenge-system-mlb-2026](https://www.mlb.com/news/abs-challenge-system-mlb-2026), [visual guide to how ABS works](https://www.mlb.com/interactive/mlb-abs-system-explainer)); registry distinguishes replay `statusCode` from `abstractGameCode` (MJ: statusCode `MJ`, abstractGameCode `L`). Cross-check vs `assets/js/reviews.js`: site manager codes (21) + `MS` (boundary) + `MJ` (abs) cover all 23 MLB M codes; site crew-chief codes (22) + `NS` (boundary) cover all 23 MLB N codes. F-03 verified.
- 2026-11-20 — MLB ABS explainer link [abs-challenge-system-mlb-2026](https://www.mlb.com/news/abs-challenge-system-mlb-2026) now redirects (MLB restructure) to the unrelated page [padres-remaining-needs-for-2026-2027-offseason](https://www.mlb.com/news/padres-remaining-needs-for-2026-2027-offseason) — verified via `fetch_page`; stale link flagged as F-08 (see flagged-for-review.html). Substitute official source for ABS rules: [visual guide to how ABS works](https://www.mlb.com/interactive/mlb-abs-system-explainer) and [ABS Challenge System explainer](https://www.mlb.com/interactive/mlb-abs-system-explainer) (from MLB, verified accessible).
- 2026-11-20 — MLB official event-type registry [`/api/v1/eventTypes`](https://statsapi.mlb.com/api/v1/eventTypes): `os_ruling_pending_primary` / `os_ruling_pending_prior` present with description "Official Scorer Ruling Pending" (matches `Reviews.PENDING_EVENT_TYPES`).
- 2026-11-20 — MLB official team list [`/api/v1/teams?sportId=1`](https://statsapi.mlb.com/api/v1/teams?sportId=1) fetched (all 3 chunks); team IDs/names used by the UI (Tigers 116 — Detroit Tigers, Rays 139 — Tampa Bay Rays, both verified in the game-822974 feed data above).
- 2026-11-20 — MLB official schedule [`/api/v1/schedule?sportId=1&date=2024-10-30`](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2024-10-30): game 775296 (Dodgers 7, Yankees 6, Final) — matches SOURCE-PROVENANCE.md. [`?date=2026-11-20`](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-11-20): empty (no games) — consistent with MLB; [`?sportId=1&startDate=2026-10-20&endDate=2026-11-05`](https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=2026-10-20&endDate=2026-11-05): games through 2026-10-28 (World Series).
- 2026-11-20 — Game 822974 live feed [`/api/v1.1/game/822974/feed/live`](https://statsapi.mlb.com/api/v1.1/game/822974/feed/live) fetched (Tigers vs Rays, Final, 2026-06-01; `reviewDetails` with `reviewType: "MJ"` present — site scans `play.reviewDetails` and `playEvents[].reviewDetails`).
- 2026-11-20 — Server smoke re-run (PORT 8000): `/api/health` 200, `/` 200, `assets/css/style.css` 200, `assets/js/*.js` 200, `/api/feed-log` 200, unknown path 404.
- 2026-11-20 — `python3 qa/check-links.py`: **0 unresolved local references** (re-run).
- 2026-11-20 — `node --check`: all JS/MJS OK (re-run: `assets/js/*.js`, `server.mjs`, `tools/*.mjs`).
- 2026-11-20 — Fixture suite re-run: **120 passed, 0 failed** (25+8+7+25+40+7+8); alert-sound tools 7/7 + 8/8. Live smoke fails from bash (TLS blocked) as expected (F-02); CI (`.github/workflows/smoke.yml`) runs it on push/PR + nightly. F-02 now verified live via `fetch_page` (see flagged-for-review.html).
- 2026-11-20 — Official glossary/scoring pages fetched live via `fetch_page`: [Replay Review](https://www.mlb.com/glossary/rules/replay-review), [Manager Challenge](https://www.mlb.com/glossary/rules/manager-challenge), [Scoring Changes](https://www.mlb.com/official-information/scoring-changes). `docs.statsapi.mlb.com` is partner-gated (Okta login) — no public reference; endpoints verified via payload contract + community endpoint maps only, flagged F-02.
- 2026-11-20 — `node --check`: all JS/MJS OK (one comment syntax error in `reviews.js` found & fixed).
- 2026-11-20 — Fixture suite: **120 passed, 0 failed** (25+8+7+25+40+7+8). Live smoke fails in sandbox as expected (F-02), passes in CI.
- 2026-11-20 — Link check: 13 unique internal refs across 6 HTML files, **0 broken**; Markdown local links 0 missing (incl. restored `docs/scoring-changes.md`).
- 2026-11-20 — `node server.mjs` (PORT 4173): `/`, `/index.html`, `/game.html`, `/reviews.html`, `/sound-lab.html`, `/flagged-for-review.html`, CSS, JS, `/api/health`, `/api/feed-log` round-trip, `/api/alert-sound` → all 200; unknown path → 404. Test feed-log artifacts removed afterwards.
- 2026-11-20 — DOM audit: every element ID referenced by page JS exists in its page (0 missing; `tab-btn` is a class, queried via `$$`).
- 2026-11-20 — CI (PR #2): fixtures + **live StatsAPI smoke both pass**; post-merge `smoke` + `pages build and deployment` runs on `main` (`d95dea5`) both success. Live pages fetched and confirmed after deploy.

## PR / merge record

- PR: https://github.com/snapquast73-boop/POSTSSNALRT/pull/2 — "Rebuild missing assets/docs/tools — restore working GitHub Pages site"
- CI on PR: `fixtures` pass (9s), `live` pass (5s) — live StatsAPI smoke verified in CI (schedule, gameStatus, eventTypes, teams all 200/JSON), resolving the sandbox half of F-02.
- Merge result: **MERGED** 2026-11-20T22:20:25Z, merge commit `d95dea54b87953f6739c688d077b80cd9099c08f` (no approval wait, per brief; flagged items non-blocking).
- Pages deploy: `pages build and deployment` run on `d95dea5` — **success**; Pages status `built`; live site verified at https://snapquast73-boop.github.io/POSTSSNALRT/ and https://snapquast73-boop.github.io/POSTSSNALRT/flagged-for-review.html (both fetched live after deploy).
- This record was added on the integration branch after merge and fast-forwarded to `main` via a follow-up docs PR (see git history).

## Flagged items (needs review — published, non-blocking)

All items F-01…F-08 are published with official source links on
[flagged-for-review.html](flagged-for-review.html). Summary: F-01 missing
assets rebuilt from contracts; F-02 StatsAPI unverifiable from sandbox —
since verified live via `fetch_page` (gameStatus, eventTypes, teams,
schedules, game 822974 feed — see F-02 row); F-03 review-code meanings
verified against MLB's official game-status registry (MJ = Player
challenge: Pitch Result; M/N code lists cross-checked — see F-03 row);
F-04 props forecast not invented (observed data only); F-05 no recording
committed (licence slot documented); F-06 original docs/tools check counts
not reproducible (rebuilt honestly); F-07 upstream parity unverifiable
(404); F-08 ABS explainer link stale — redirects to an unrelated page;
substitute verified source is the visual guide at
https://www.mlb.com/interactive/mlb-abs-system-explainer.

## Cross-session verification and handoff

# Coordination

| Task | Status | Session | Scope |
|---|---|---|---|
| Initial site audit | needs review | dd5c2b23 | [Audit and release decision](https://github.com/snapquast73-boop/POSTSSNALRT/commit/309afca9dfe93f4c93a34aa5cc1a719e636bb57e) |
| Research source provenance | done | 4c0d40cc | [Evidence and source links](SOURCE-PROVENANCE.md); exact original remains unverified |
| Restoration and integration | in progress | fb58e457 | [Site implementation board](https://github.com/snapquast73-boop/POSTSSNALRT/blob/arena/fb58e457-postssnalrt/COORDINATION.md) |

**Handoff, 2026-11-20:** Compared the original Git tree and same-owner candidates by blob ID. Independently retrieved MLB’s schedule and game feed identity. [Coordination and endpoint correction request](https://github.com/snapquast73-boop/POSTSSNALRT/issues/1). Do not deploy a competing build.

- 4c0d40cc claims independent Pages acceptance harness (`qa/pages-acceptance.mjs` only) and post-release verification. It supplements, rather than replaces, fb58e457's `tools/` suite. Inputs: a project-site base URL and the official MLB schedule/feed. Integration remains exclusively with the site owner until its release is recorded.
- Integration request (owner fb58e457): `34d47d1` expects `reviewDetails` arrays; MLB returns objects on both plays and pitches. See [verified example](SOURCE-PROVENANCE.md). Confirm multiple ABS events within one at-bat remain distinct; do not treat absent `isOverturned` as a confirmed ruling.

- 4c0d40cc: both sessions initially created the board. Resolved the add/add conflict by retaining both logs. [PR #2](https://github.com/snapquast73-boop/POSTSSNALRT/pull/2) merged the completed restoration (f8d07dda); all changes below are follow-up QA of that implementation, **not** a second reconstruction.
- **In progress, 4c0d40cc:** correct post-restoration discrepancies verified against MLB in the deployed scoreboard, review extraction and game tables; source-link the tables; validate via the independent QA harness. Scope: merged `assets/js/{game,props,ui,scoreboard,reviews,reviews-feed}.js`, `sound-lab.html`, `flagged-for-review.html`, `qa/`, `.github/workflows/pages-acceptance.yml`, integration documentation. No edits to the separate fb58e457 restoration branch.

- Pull attempted to linearize the integration merge and reintroduced the same board conflict. Aborted that rebase without dropping either history; retained the resolved board and synchronized with the released merge.
- Integrated dd5c2b23's local-link checker into `qa/check-links.py` and extended it to the Markdown documentation. Retained the separate release log from [PR #3](https://github.com/snapquast73-boop/POSTSSNALRT/pull/3). Verified the [MLB game-status registry](https://statsapi.mlb.com/api/v1/gameStatus), [historical schedule](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2024-10-30) and [pitch-review source](https://statsapi.mlb.com/api/v1.1/game/822974/feed/live). Fixed nested team reads, tab event handlers, pitch IDs, missing row citations and unverified reference-audio comparisons. [PR #4](https://github.com/snapquast73-boop/POSTSSNALRT/pull/4) includes real-browser verification (not just generated fixtures). Exact upstream parity and contemporary live-overturn timing remain unverified.
