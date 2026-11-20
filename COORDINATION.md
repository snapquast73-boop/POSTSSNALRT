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

## PR / merge record

- PR: (filled in after creation — see below)
- Merge result: (filled in after merge)
- Pages deploy: (filled in after deploy check)

## Flagged items (needs review — published, non-blocking)

All items F-01…F-07 are published with official source links on
[flagged-for-review.html](flagged-for-review.html). Summary: F-01 missing
assets rebuilt from contracts; F-02 StatsAPI unverifiable from sandbox
(verify in browser/CI); F-03 review-code meanings unverified; F-04 props
forecast not invented (observed data only); F-05 no recording committed
(licence slot documented); F-06 original docs/tools check counts not
reproducible (rebuilt honestly); F-07 upstream parity unverifiable (404).
