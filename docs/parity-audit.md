# Functional-parity audit — POSTSSNALRT

Session `5950e951` · 2026-11-21 (UTC) · task T9 on [COORDINATION.md](../COORDINATION.md).

**Question this answers:** what does the shipped site do that the *original author's own files* say it should do, and what does it not do? Every row below carries either an official MLB source, a GitHub source, or both. Nothing is inferred; where a value or a behaviour could not be confirmed, it is marked **unverified** and left alone rather than guessed.

---

## 1. Method

1. **Recovered the original upload.** GitHub serves any commit tree by SHA, so the ten files the owner actually uploaded are retrievable even though they are no longer the tip: [`ad2ea0a`](https://github.com/snapquast73-boop/POSTSSNALRT/tree/ad2ea0a19b75252627c1fe80ca6ca5545f3a339f) (also downloadable from `https://codeload.github.com/snapquast73-boop/POSTSSNALRT/tar.gz/ad2ea0a19b75252627c1fe80ca6ca5545f3a339f`).
2. **Byte-compared** every original file against the current tree (`sha256sum` + `diff -u`). Result in §2.
3. **Read the official MLB registries and payloads live** (`fetch_page`, 2026-11-21 UTC). Result in §3.
4. **Audited each shipped module line by line** against the contract the original files state. Result in §4–§6.
5. **Proved the repairs in a DOM**, not just in fixtures: `game.html` is booted with jsdom and fed only verbatim official captures. Result in §7.

Reproduce everything here with:

```bash
node tools/game-page-test.mjs                                    # 89 checks, no deps, no network
JSDOM_MODULE=/tmp/qa/node_modules/jsdom node tools/game-page-dom-test.mjs   # 32 checks, real game.html
node tools/review-test.mjs && node tools/scoring-change-test.mjs && \
node tools/official-scoring-test.mjs && node tools/reviews-feed-test.mjs && \
node tools/replay-feed-render-test.mjs                           # 105 checks, pre-existing suites
node tools/render-alert-sound.mjs && node tools/alert-sound-independent-check.mjs   # 8 checks
python3 qa/check-links.py                                        # 0 unresolved local references
PORT=4318 node server.mjs                                        # smoke: see §7
```

---

## 2. Which files are the author's own, and which are reconstructions

Verified by SHA-256 comparison of the current tree against upload tree `ad2ea0a`.

| File | Status | Evidence |
| --- | --- | --- |
| `server.mjs` | **Byte-identical to the original upload.** Original author code, not a reconstruction — so its feed-log schema, SSE tail and audio endpoints are an authoritative contract. | `sha256sum` match; [original](https://github.com/snapquast73-boop/POSTSSNALRT/blob/ad2ea0a19b75252627c1fe80ca6ca5545f3a339f/server.mjs) |
| `LICENSE`, `.gitignore`, `.nojekyll` | **Byte-identical to the original upload.** | `sha256sum` match |
| `index.html`, `game.html`, `reviews.html` | Original, plus one additive line each (the Flagged-for-Review footer link). No original markup was changed or removed. | `diff -u` → one `+` line per file |
| `404.html` | Original, plus an additive `<base href>` + 6-line script so nested 404s resolve their assets (session `3f78f25b`, PR #5; extended by PR #9). | `diff -u` |
| `sound-lab.html` | Original, plus later additive edits; the upload's copy is the contract for the audio API. Its inline script calls exactly **10** `ReplayFeed` members (`grep -o 'RF\.[A-Za-z_]*' sound-lab.html | sort -u`): `alertSoundSpec`, `clearAlertSample`, `getAlertSample`, `getSoundEnabled`, `playAlertSampleNow`, `playAlertSound`, `playSynthAlertNow`, `primeAlertSound`, `setAlertSampleFromBytes`, `setSoundEnabled`. All 10 exist in the shipped `reviews-feed.js`, with the shapes the page uses (`getAlertSample()` → `{url,duration,sampleRate,channels,gain}`, `setAlertSampleFromBytes()` → `{gain,…}` or null, `alertSoundSpec.bellStrikes[0].at` = the "ching" strike time). | [original sound-lab](https://github.com/snapquast73-boop/POSTSSNALRT/blob/ad2ea0a19b75252627c1fe80ca6ca5545f3a339f/sound-lab.html) |
| `README.md` | Original brief, plus later additive sections. | `diff -u` |
| `assets/**`, `docs/**`, `tools/**`, `qa/**`, `.github/**` | **Never present in the upload** → every file is a reconstruction. F-01 and F-06 stand. | [upload tree](https://github.com/snapquast73-boop/POSTSSNALRT/tree/ad2ea0a19b75252627c1fe80ca6ca5545f3a339f) |
| upstream `buffedlizard55-lab/MLB-Live-PBP` | **Does not resolve** (GitHub GraphQL `repository` lookup → `NOT_FOUND`; site unreachable). Exact parity with the original author's build therefore remains **unverified**. F-07 stands. | GraphQL lookup, 2026-11-21 |

Because `reviews.html`, `game.html`, `sound-lab.html`, `README.md` and `server.mjs` are the author's own words and code, the behaviour they describe is a **verifiable specification** for the missing client files. §4 audits against it.

---

## 3. Official MLB sources verified live on 2026-11-21

| # | Claim checked | Official source | Result |
| --- | --- | --- | --- |
| V-01 | Review-status code meanings (previously flagged **F-03, unverified**) | [`GET /api/v1/gameStatus`](https://statsapi.mlb.com/api/v1/gameStatus) | **Verified.** Every `codedGameState: "M"` code is `"Manager challenge: …"`; every `"N"` code is `"Umpire review: …"`; `MJ` = "Player challenge: Pitch Result"; `NJ` = "Umpire Challenge: Pitch Result"; `MS`/`NS` = "…Stadium boundary call"; `IH` = "Instant Replay" (`reason: "Review"`). Verbatim subset committed at [`tools/fixtures/game-status.json`](../tools/fixtures/game-status.json). **F-03 is resolved for the M/N/IH code space.** |
| V-02 | Official-scorer pending event types | [`GET /api/v1/eventTypes`](https://statsapi.mlb.com/api/v1/eventTypes) | **Verified.** `os_ruling_pending_primary` and `os_ruling_pending_prior` both carry description "Official Scorer Ruling Pending". |
| V-03 | Shape of `reviewDetails` | [`game 824474 playByPlay`](https://statsapi.mlb.com/api/v1/game/824474/playByPlay), [`game 849799 playByPlay`](https://statsapi.mlb.com/api/v1/game/849799/playByPlay) | **Verified: an OBJECT, not an array**, on plays and on `playEvents[]`. Fields observed: `isOverturned`, `inProgress`, `reviewType`, `challengeTeamId`, `reason`. |
| V-04 | Does `reviewType` use the `gameStatus` code space? | [game 824474, atBatIndex 65](https://statsapi.mlb.com/api/v1/game/824474/playByPlay) | **Verified.** That play is `reviewType: "MI"` and its own `result.eventType` is `hit_by_pitch`; the registry defines `MI` as "Manager challenge: Hit by pitch". Three other hit-by-pitch plays in the same game carry no `reviewDetails` at all, so the record is what marks the review. |
| V-05 | ABS pitch challenges surface as `MJ` inside `playEvents[]` | [game 849799 (2026 World Series, MIL @ TB, 2026-10-28)](https://statsapi.mlb.com/api/v1/game/849799/playByPlay) | **Verified.** Exactly two review records in the whole game, both `MJ`, both `isOverturned: true`: atBatIndex 36 (`index` 1, **`pitchNumber` 2**, `challengeTeamId` 158 = MIL, away) and atBatIndex 51 (`index` 0, **`pitchNumber` 1**, `challengeTeamId` 139 = TB, home). The official counters for that game are `usedSuccessful` 1 / `usedFailed` 0 for **both** clubs — consistent with one overturned challenge each. |
| V-06 | `pitchNumber` is not the array position | same capture | **Verified.** index 1 ↔ pitchNumber 2, and index 0 ↔ pitchNumber 1. Any UI that shows the array position as "pitch N" is wrong by one or more. |
| V-07 | Counter field names | [`game 824474 feed`](https://statsapi.mlb.com/api/v1.1/game/824474/feed/live), [`game 849799 feed`](https://statsapi.mlb.com/api/v1.1/game/849799/feed/live) | **Verified.** `gameData.review.{away,home}.{used,remaining}` and `gameData.absChallenges.{away,home}.{usedSuccessful,usedFailed,remaining}`, plus `hasChallenges` on each. 824474: manager away 0/1, home 1/0; ABS away 0 successful / 2 failed / 0 remaining, home 2/1/1. The home club's single used manager challenge matches the single `MI` record by `challengeTeamId` 113 (= home, Cincinnati Reds). |
| V-08 | Meaning of `hasChallenges` | same captures | **Unverified — deliberately not displayed.** MLB publishes no definition, and the data contradicts an obvious reading: game 849799 has `review.hasChallenges: false` while `review.away.remaining` is 2. Flagged as **A-09**; the field is read by nothing in this repo. |
| V-09 | Is an empty "today" slate a defect? | [`schedule 2026-11-20`](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-11-20), [`2026-10-01…2026-11-15`](https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=2026-10-01&endDate=2026-11-15) | **Verified: not a defect.** Today returns `totalGames: 0, dates: []`. The 2026 season ended 2026-10-28 with game 849799 (`gameData.game.type: "W"`). The deployed feed showing "0 games" on the default view is correct official data; PR #9 adds a labelled fallback to the most recent slate. |
| V-10 | `runners[].details.playIndex` semantics (used for runs-at-risk attribution) | [docs.statsapi.mlb.com](https://docs.statsapi.mlb.com/) | **Unverified — checked first-hand this session.** MLB's own API documentation redirects to `/login?returnTo=%2F` (title "Login \| MLB Stats API Docs", "Sign In with Okta"), so there is no public field reference; no other MLB page defines `playIndex`. Flagged as **A-10**; the existing attribution logic is left exactly as it is rather than "corrected" against a guess. The same gate is why `hasChallenges` (V-08) cannot be defined from an official source. |
| V-11 | Is the deployed site actually alive? | [deployed feed](https://snapquast73-boop.github.io/POSTSSNALRT/reviews.html), [deployed game 849799](https://snapquast73-boop.github.io/POSTSSNALRT/game.html?gamePk=849799) | **Verified.** The feed renders "0 tracked events · 0 games" (consistent with V-09). The game page renders MIL 4 – 1 TB, Final, a full linescore and play-by-play, and labels exactly the two at-bats that V-05 shows carry official review records. |

---

## 4. Contract items from the author's own files, and whether the shipped code honours them

Source of each requirement: [`reviews.html` footer (original)](https://github.com/snapquast73-boop/POSTSSNALRT/blob/ad2ea0a19b75252627c1fe80ca6ca5545f3a339f/reviews.html), [`README.md`](../README.md), [`server.mjs`](../server.mjs) (original, byte-identical).

| # | Requirement (quoted from the author's own file) | Shipped state | Disposition |
| --- | --- | --- | --- |
| C-01 | "manager challenges, crew chief/umpire reviews and boundary calls come from the live game feed's `reviewDetails`, ABS pitch challenges from `absChallenges` / pitch-level review events" | Implemented (`reviews.js extractReviewsFromPlay` scans both play and `playEvents`) | Verified by V-03/V-05 |
| C-02 | Official-scorer pending rulings from `os_ruling_pending_primary` / `_prior` | Implemented | Verified by V-02 |
| C-03 | "A pending ruling … never removes a run from the score" | Implemented: `runsAtRisk` rejects `typeKey === 'pending'` | Verified by `tools/official-scoring-test.mjs` |
| C-04 | Counters "read directly from the StatsAPI … never derived by counting feed events, and never zero-filled when a counter is absent" | Implemented in `reviews.js getReviewCounters`; **but not displayed anywhere on the Replay Feed or the Game page** | Game page **fixed** here (G-03). Feed-page display → request R-13 |
| C-05 | "A used-counter that moves backwards between polls is flagged as an irregularity" | Implemented (`flagCounterRegression`) | Verified by `tools/review-test.mjs` |
| C-06 | "The score tracker separates the observed call-on-field score, conditional possibilities, and an attributable official score after resolution when exposed" | **Not implemented anywhere.** No score tracker exists in `reviews-feed.js` | Request **R-03** |
| C-07 | "A review is flagged **Runs at Risk** only when the official payload credits one or more scoring movements to the very event under review … Unrelated runs from earlier in the same plate appearance (a steal of home, a wild pitch) are excluded" | Partially. The gating was too strict (only a brand-new row on a poll where the game was already under review *and* the play was current), and the play-level branch does not isolate the reviewed event, so an unrelated steal of home in the same plate appearance would count | Gating **fixed by PR #9** (verified by diff). Event isolation still open → request **R-14**; blocked on V-10 (`playIndex` unverified) |
| C-08 | "Each row shows the observed initial call and the final ruling, the official score after the play, and an attribution note" | Only `from → to` is shown; no official score, no attribution note | Request **R-06** |
| C-09 | "Changes that coincide with a replay review stay on that review's row" | A separate `scoring-<atBat>-<ts>` row is created instead | Request **R-07** |
| C-10 | "finals are re-scanned for 30 minutes after they end (at most every 30 seconds) to catch rulings published after the game" | **Not implemented.** Polling is a flat 15 s for every game regardless of status, and finals are never revisited after the date changes | Request **R-04** |
| C-11 | "Payload edits without a reclassification … and plays that vanish from the payload are flagged as irregularities" | First half implemented (`isPayloadOnlyEdit`); **vanished plays are not detected** | Request **R-05** |
| C-12 | "one log per date, newest seven dates kept, 500 most-recent rows … anything malformed in it is dropped with a console warning rather than guessed" | Implemented in `feed-log.js` (`MAX_DATES` 7, `MAX_ROWS` 500, `console.warn` + delete) | Verified by `tools/reviews-feed-test.mjs` |
| C-13 | `server.mjs` merges a `settled` array into every log | Client persists `state.settled` but **never writes to or reads from it** — the field is dead in the client while the original server code maintains it | Request **R-04** (it belongs with the post-final rescan window) |
| C-14 | `server.mjs` pushes the merged log over SSE (`retry: 3000`, `event: connected`, heartbeat, initial snapshot) | Implemented in `feed-log.js subscribe`; **verified live** against `node server.mjs` — a connected stream received `retry: 3000`, `event: connected` with the date, and the initial `feed-log` snapshot | Verified (§7) |
| C-15 | `server.mjs` audio slot: `GET`/`POST`/`DELETE /api/alert-sound`, probe order `.mp3,.wav,.ogg,.m4a`, 12 MB cap, ≥512 bytes, text-page rejection | Implemented in `reviews-feed.js` + `sound-lab.html`; probe order and the −2.0 dBFS normalisation match | Verified by `tools/reviews-feed-test.mjs`, `tools/alert-sound-independent-check.mjs` |
| C-16 | README: runs at risk appears in "All feed + Runs at Risk tab + **banner** + desktop alert" | Desktop alert implemented; **no banner** | Request **R-09** |
| C-17 | README: "Irregularities … are flagged on the affected rows for review, never corrected" | Implemented | — |
| C-18 | `game.html` meta: "a transparent two-sided hit forecast" | `props.js` shows observed matchup data only and says so, because no forecast model was in the upload | **F-04 stands.** Not implemented here: inventing probabilities would be a hallucination |
| C-19 | README: "ABS pitch challenges are included in the All feed, alert system, and live tracking" | Implemented (`visibleInAllFeed` / `shouldAlertForReview` return true for `abs`) | Verified by `tools/reviews-feed-test.mjs` |
| C-20 | README: "**Nothing** … is predicted, inferred from score deltas, or zero-filled when a counter is absent" | Honour­ed everywhere checked, with one gap: an unrecognised review code becomes `typeKey: 'unknown'`, which `visibleInAllFeed` excludes — so a code MLB adds in future would disappear from the All feed silently rather than being flagged | Request **R-10** |

---

## 5. Repaired in this session — `assets/js/game.js` (Game page)

Scope check before editing: PR #9 (session `a35ded9a`) is the only other open claim on `assets/js/*`, and its diff does **not** include `game.js`, `ui.js` or `props.js` (verified by `git diff --name-only origin/main arena/a35ded9a-postssnalrt`). No other session has an open claim on the Game page.

| # | Defect (verified) | Fix | Check that fails without it |
| --- | --- | --- | --- |
| G-01 | Four official fields sat unread in the payload: `reviewDetails.isOverturned`, `.inProgress`, `.challengeTeamId`, `.reason`. The tab showed a generic label and a bare code, so a visitor could not see whether a call was overturned, who challenged it, or why (V-03) | `rulingOf()` / `challengingTeamOf()` read them verbatim; an absent `isOverturned` renders "No ruling in payload (isOverturned absent — not reported as a confirmed call)" | `game-page-test.mjs` "no isOverturned key → null"; DOM "the ruling 'Overturned' is shown" |
| G-02 | The official `pitchNumber` was not used at all. The array `index` differs from it in real data (V-06) — the same class of defect another session logged as RR-02 against a sibling repo | `pitchNumberOf()` returns `pitchNumber` only, and `rawReviewFor()` matches the playEvent by its `index` while displaying `pitchNumber` | DOM "the official pitchNumber 2 is shown (playEvent index is 1)" |
| G-03 | `Reviews.getReviewCounters()` was dead code: the official challenge counters (C-04, V-07) were displayed on no page | Sourced counter table on the Challenges & Reviews tab; absent counters render blank, never 0 | `game-page-test.mjs` counter section (10 checks); DOM "every counter row links its official MLB source" |
| G-04 | `Api.getGameStatus()` existed for exactly this purpose (README: review-status codes come "from `GET /api/v1/gameStatus`") but **nothing in the repo called it**, so review codes never resolved to MLB's own wording | `loadReviewStatusRegistry()` fetches it once per page before the first paint; `registryLabelFor()` supplies the wording | DOM "MLB's own wording is shown for MJ" / "for MI" |
| G-05 | Review cards had no source link although every other table on the page does, and `qa/pages-acceptance.mjs` asserts a source link on linescore/boxscore/props rows | Every card and every counter row links that game's official live feed | DOM "every card links its official MLB source" |
| G-06 | `.badge.risk` and `.badge.under-review` (style.css lines 460–461) were emitted by nothing: the only `badgeClass` values any module produced were `challenge`, `review`, `boundary`, `abs`, `pending`, `scoring` (`under-review` existed solely as a feed *tab key*). Dead badge styles marking a lost feature | "In progress" now uses the shipped `.badge.under-review`; two new rulings needed their own classes, so `.badge.overturned` (green) and `.badge.stands` (blue) were added to `style.css` reusing the existing colour variables. "No ruling in payload" is rendered as words, not a badge | `game-page-test.mjs` "every ruling badge class emitted by game.js exists in style.css" |
| G-09 | **Near-miss found during the second pass:** the first implementation styled an overturned ABS call with `.badge.abs`. `qa/pages-acceptance.mjs` asserts `#reviews-wrap .badge.abs` count == the number of official `MJ` records in the payload, so a ruling chip reusing the type badge would have doubled that count and failed the browser acceptance run on every deploy | Ruling chips use their own classes and a test now asserts they never reuse any review-**type** class; the DOM suite additionally asserts the harness invariant itself (exactly one `.badge.abs` per official record) | `game-page-test.mjs` "ruling chips never reuse a review-TYPE badge class"; `game-page-dom-test.mjs` "browser-harness invariant" |
| G-07 | `renderReviews` wrote to `#live-review-banner-wrap` with no null guard, and `load()` had no request-generation guard although it polls every 15 s against a 20 s client timeout — a slow response could overwrite a newer one | Null guard + `state.request` generation token, mirroring the guard `reviews-feed.js` already had | — (race; guarded by inspection + the DOM boot check) |
| G-08 | `game.js` registered `DOMContentLoaded` unguarded, unlike every other module in the repo, so it could not be `require`d in Node for testing | `if (typeof document !== 'undefined')` guard, matching `api.js`/`ui.js`/`reviews.js`/`feed-log.js`/`reviews-feed.js` | both new test files load the module in Node |

Nothing was removed: the tab still shows the classification label from `reviews.js` when the registry is unavailable, and the play-by-play rows keep their existing content (they now append MLB's wording and the ruling).

---

## 6. Requests to the owners of files this session must not edit

Logged here instead of being made, per the coordination rules. Owner of `assets/js/reviews.js`, `assets/js/reviews-feed.js`, `assets/js/api.js`, `assets/js/scoreboard.js`, `README.md`, `flagged-for-review.html`, `qa/`, `.github/` is session **`a35ded9a`** (PR #9, open at the time of writing).

| # | File | Request | Why (source) |
| --- | --- | --- | --- |
| R-03 | `reviews-feed.js` | Add the score tracker the footer promises: observed call-on-field score (`play.result.awayScore` / `.homeScore`), conditional possibilities limited to runs tied to the reviewed event, and the official score after resolution (`liveData.linescore.teams.*.runs`) once the ruling is exposed | [reviews.html footer](https://github.com/snapquast73-boop/POSTSSNALRT/blob/ad2ea0a19b75252627c1fe80ca6ca5545f3a339f/reviews.html) (C-06) |
| R-04 | `reviews-feed.js` | Implement the post-final rescan window ("30 minutes after they end, at most every 30 seconds") and write the games whose window has expired into `state.settled`, which `server.mjs` already merges and the client never touches | C-10, C-13; [server.mjs `settled` merge](https://github.com/snapquast73-boop/POSTSSNALRT/blob/ad2ea0a19b75252627c1fe80ca6ca5545f3a339f/server.mjs) |
| R-05 | `reviews-feed.js` | Flag plays that vanish from `allPlays` between polls as irregularities | C-11 |
| R-06 | `reviews-feed.js` | Show on each scoring-change row the official score after the play and an attribution note | C-08 |
| R-07 | `reviews-feed.js` | When a scoring change coincides with a replay review on the same at-bat, attach it to that review's row instead of creating a second row | C-09 |
| R-08 | `reviews.js` | Carry `isOverturned`, `inProgress`, `challengeTeamId`, `reason` and `pitchNumber` through `extractReviewsFromPlay` so the Replay Feed can show them too. `assets/js/game.js` now exposes tested readers for all of them (`Game.rulingOf`, `Game.challengingTeamOf`, `Game.pitchNumberOf`, `Game.rawReviewFor`) that can be lifted or called directly | V-03, V-05, V-06; [`tools/game-page-test.mjs`](../tools/game-page-test.mjs) |
| R-09 | `reviews-feed.js` | Add the runs-at-risk **banner** the README lists alongside the desktop alert | C-16 |
| R-10 | `reviews.js` | Include `typeKey: 'unknown'` in `visibleInAllFeed` / `shouldAlertForReview` (showing the raw code and an irregularity note) so a future MLB code is flagged rather than silently dropped from the All feed | C-20 |
| R-11 | `reviews.js` | Optional: resolve `reviewType` through `GET /api/v1/gameStatus` at runtime instead of the two hardcoded code lists. The hardcoded lists match the registry exactly today (checked code by code against V-01) but they will drift when MLB adds one | V-01 |
| R-12 | `reviews.js` | Decide and document `NJ` ("Umpire Challenge: Pitch Result"). It is currently a `review`; README documents only `MJ` as the ABS code, and MLB publishes no statement that `NJ` belongs to the ABS tab. **Do not change it without a source** — it is flagged, not guessed | V-01, [README](../README.md) |
| R-13 | `reviews-feed.js` | Display the official counters on the Replay Feed as well (the footer documents them at length; the page shows none) | C-04 |
| R-14 | `reviews.js` | Isolate the reviewed event inside a plate appearance for play-level reviews, so an unrelated steal of home or wild pitch in the same at-bat does not mark the review as runs-at-risk. **Blocked on V-10**: `runners[].details.playIndex` has no official definition, so the correct comparison cannot be verified. Flag rather than change | C-07, V-10 |
| R-15 | `flagged-for-review.html` | Publish A-09 (`hasChallenges` undefined) and A-10 (`playIndex` undefined) from this audit, and update F-03: the M/N/IH review-code space is now **verified** against the official registry (V-01); what remains unverified is only the absence of any MLB statement about `NJ`'s tab and about `hasChallenges` | V-01, V-08, V-10 |
| R-16 | `.github/workflows/smoke.yml` | Add `node tools/game-page-test.mjs` to the `fixtures` job (no new dependency). `tools/game-page-dom-test.mjs` needs jsdom, so it should stay out of that job or get its own job with `npm install jsdom` | §7 |

---

## 7. Verification performed

| Check | Command | Result |
| --- | --- | --- |
| New pure-reader suite (89 assertions against verbatim official captures) | `node tools/game-page-test.mjs` | **89 passed, 0 failed** |
| New DOM suite — the real `game.html` booted in jsdom, three scenarios (2026 World Series game, manager-challenge game, registry outage) | `JSDOM_MODULE=/tmp/qa/node_modules/jsdom node tools/game-page-dom-test.mjs` | **32 passed, 0 failed**, and **0 jsdom errors / 0 console warnings** in the two healthy scenarios |
| Pre-existing fixture suites | `review-test` 25, `scoring-change-test` 8, `official-scoring-test` 7, `reviews-feed-test` 25, `replay-feed-render-test` 40 | **105 passed, 0 failed** (unchanged by this work) |
| Alert sound | `node tools/render-alert-sound.mjs && node tools/alert-sound-independent-check.mjs` | **8 passed, 0 failed** |
| Syntax | `node --check` on every `assets/js/*.js` and `server.mjs` | clean |
| Local links | `python3 qa/check-links.py` | **0 unresolved local references** |
| Server smoke (`PORT=4318 node server.mjs`) | `/`, `/index.html`, `/game.html`, `/reviews.html`, `/sound-lab.html`, `/flagged-for-review.html`, CSS, JS, `/api/health`, `/api/alert-sound`, deep missing path | all **200** with the right `Content-Type`; deep missing path **404** served from `404.html` |
| Feed-log round trip | `POST` then `GET /api/feed-log?date=2026-10-28` | accepted (`ok:true, entriesCount:1`), returned byte-for-byte, merged into `data/feed-log-2026-10-28.json`; test artefacts deleted afterwards |
| SSE tail (C-14) | `curl -N /api/feed-log/stream?date=…` | received `retry: 3000`, `event: connected` with the date, then the initial `event: feed-log` snapshot — exactly the contract `feed-log.js subscribe()` listens for |
| Deployed site | [feed](https://snapquast73-boop.github.io/POSTSSNALRT/reviews.html), [game 849799](https://snapquast73-boop.github.io/POSTSSNALRT/game.html?gamePk=849799) | live and rendering real MLB data (V-11) |

**Not verified:** exact parity with the original author's build (the upstream repo does not resolve — V-09/F-07); the original stylesheet, sound recording and props model (never in the upload); `playIndex` and `hasChallenges` semantics (V-08, V-10); the timing of future live rulings, which cannot be tested in the offseason (V-09).

---

## 8. Irregularities flagged by this audit

| ID | Irregularity | Disposition |
| --- | --- | --- |
| A-09 | `gameData.review.hasChallenges` / `gameData.absChallenges.hasChallenges` have no published meaning, and game 849799 carries `review.hasChallenges: false` alongside `review.away.remaining: 2` | **Not displayed, not interpreted.** Recorded here with both source URLs |
| A-10 | `runners[].details.playIndex` is used for runs-at-risk attribution but has no official definition (`docs.statsapi.mlb.com` is partner-gated) | **Left unchanged**; request R-14 is explicitly blocked on it |
| A-11 | `NJ` ("Umpire Challenge: Pitch Result") — registry wording says "Challenge", README documents only `MJ` as the ABS code | **Left unchanged**, flagged (R-12) |
| A-12 | The two hardcoded review-code lists in `reviews.js` duplicate the official registry; they agree with it today, code by code, but nothing keeps them in sync | Recorded; optional request R-11 |
| A-13 | Client-side `settled` is persisted and merged by the original `server.mjs` but never written by the client — a contract half-implemented | Request R-04 |

All of the above are published in the repo (this file) and requested for the [Flagged for Review page](../flagged-for-review.html) via R-15, whose owner is another session.
