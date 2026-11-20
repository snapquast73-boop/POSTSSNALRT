# COORDINATION.md — shared task board

> Session ID for this session: **fb58e457** (branch `arena/fb58e457-postssnalrt`).
> Single-session execution: no other sessions are active in this repo. Per Arena
> session rules all work happens on the current branch (no per-task branches /
> worktrees were created); the PR is opened from this branch to `main`.

## Diagnosis (2026-11-20, session fb58e457)

The uploaded repo contains only the HTML shells (`index.html`, `game.html`,
`reviews.html`, `sound-lab.html`, `404.html`), `server.mjs`, `README.md`,
`LICENSE`, `.nojekyll`, `.gitignore`. **The entire `assets/` tree is missing**
(`assets/css/style.css`, `assets/js/api.js|ui.js|reviews.js|feed-log.js|
scoreboard.js|props.js|game.js|reviews-feed.js`, `assets/audio/`), as are
`tools/`, `docs/`, `data/`, `.github/`. Every page therefore loads unstyled
and non-functional (all CSS/JS 404). GitHub Pages is enabled
(`legacy`, branch `main`, path `/`, `https://snapquast73-boop.github.io/POSTSSNALRT/`)
but serves the broken shells. The upstream repo
`buffedlizard55-lab/MLB-Live-PBP` referenced by the README is **not reachable**
from this sandbox (GitHub API 404; outbound hosts limited to github.com /
codeload / api.github.com / npm / pypi), so the missing code is reconstructed
from the contracts in the uploaded files themselves (HTML DOM ids/globals,
`server.mjs` API surface, `sound-lab.html` inline expectations, README spec).
Reconstruction choices are recorded per task below; anything that could not be
verified against an official source is listed on the Flagged for Review page
(`flagged-for-review.html`), never guessed silently.

## Tasks

| # | Task | Status | Owner | Files touched |
|---|------|--------|-------|---------------|
| 1 | Shared CSS (`assets/css/style.css`) | in progress | fb58e457 | `assets/css/style.css` |
| 2 | Core JS: API client + UI helpers + review classification + feed-log persistence | unclaimed | — | `assets/js/api.js`, `assets/js/ui.js`, `assets/js/reviews.js`, `assets/js/feed-log.js` |
| 3 | Scoreboard page controller | unclaimed | — | `assets/js/scoreboard.js` |
| 4 | Game page controllers (PBP/boxscore/props/reviews) | unclaimed | — | `assets/js/props.js`, `assets/js/game.js` |
| 5 | Replay Feed + cha-ching alert engine | unclaimed | — | `assets/js/reviews-feed.js` |
| 6 | Audio slot docs + verification docs + test suite + CI | unclaimed | — | `assets/audio/*`, `docs/*`, `tools/*`, `.github/workflows/*` |
| 7 | Flagged for Review page + footer links | unclaimed | — | `flagged-for-review.html`, `*.html` (footer line only) |
| 8 | Integration: build/link verification, PR to main, merge, Pages deploy check | unclaimed | — | (verification only) |

## Log

- 2026-11-20 fb58e457: created board, claimed task 1. Diagnosis above.
- (entries appended as tasks complete; each records sources + verification)
