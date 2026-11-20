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

All items F-01…F-07 are published with official source links on
[flagged-for-review.html](flagged-for-review.html). Summary: F-01 missing
assets rebuilt from contracts; F-02 StatsAPI unverifiable from sandbox
(verify in browser/CI); F-03 review-code meanings unverified; F-04 props
forecast not invented (observed data only); F-05 no recording committed
(licence slot documented); F-06 original docs/tools check counts not
reproducible (rebuilt honestly); F-07 upstream parity unverifiable (404).

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

- In progress — 3f78f25b: nested Pages 404 asset and return-link repair (`404.html` only), release evidence here. No changes to shared tables or navigation. [GitHub Pages configuration](https://api.github.com/repos/snapquast73-boop/POSTSSNALRT/pages).

- 3f78f25b — nested 404 repair done. Tested both links from missing nested paths at project and origin-root mounts; all seven offline test commands passed; the HTML/Markdown checker found zero unresolved local references. Project mount confirmed via [GitHub Pages API](https://api.github.com/repos/snapquast73-boop/POSTSSNALRT/pages). No MLB values changed; prior parity limits still apply.

## Release follow-up — ee94b2f6

| Task | Status | Owner | File scope | Source |
|---|---|---|---|---|
| Independently verify custom 404 links from nested project and origin-root URLs | done | ee94b2f6 (verification); 3f78f25b (implementation) | `COORDINATION.md` only on this branch; `404.html` shipped in PR #5 | [Handoff and test evidence](https://github.com/snapquast73-boop/POSTSSNALRT/pull/5#issuecomment-7052128540) · [GitHub Pages custom 404 documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-custom-404-page-for-your-github-pages-site) · [HTML base element](https://html.spec.whatwg.org/multipage/semantics.html#the-base-element) |

- 2026-11-20 — Two sessions claimed the same bug before seeing each other's board additions. The earlier claimant, `3f78f25b`, completed [PR #5](https://github.com/snapquast73-boop/POSTSSNALRT/pull/5); `ee94b2f6` withdrew its uncommitted code and independently verified PR #5. The board conflicted when syncing from `main`; both sessions' records and the merged fix were retained. No force push and no competing release PR.
- Verification: the original 404 resolved its stylesheet inside the missing directory. The merged page resolves both links at `/POSTSSNALRT/` with JavaScript on and off, and at an origin-root preview with JavaScript on (DOM URL-resolution test). No live MLB values, tables or layout changed.
- Related release: [PR #4](https://github.com/snapquast73-boop/POSTSSNALRT/pull/4) merged as `a0478fc`; its [Pages deployment](https://github.com/snapquast73-boop/POSTSSNALRT/actions/runs/44828723381) and [deployed-site browser acceptance](https://github.com/snapquast73-boop/POSTSSNALRT/actions/runs/44828864840) both succeeded. PR #5 merged as `434c7a7`; its [Pages run](https://github.com/snapquast73-boop/POSTSSNALRT/actions/runs/44829076766) tracks the rollout.
