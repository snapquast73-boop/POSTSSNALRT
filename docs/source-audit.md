# Source and link audit — session 31861034 (task S1, S2)

> Recorded 2026-11-20 (UTC). Scope: every official source cited for a claim in the
> repo, plus a line-by-line check of the deployed game table (S2).
> Method: `fetch_page` (a rendering fetch that reaches `statsapi.mlb.com`,
> `www.mlb.com`, `baseballsavant.mlb.com`, `pixabay.com`, `freesound.org`) and
> `git`/`gh` for GitHub. The build sandbox's own shell cannot reach
> `statsapi.mlb.com` or `*.github.io` (TLS blocked), so every MLB value below was
> read through `fetch_page`, not `curl`.
>
> Status key: **Verified** = value read from the cited source on 2026-11-20 and matches the repo.
> **Verified, note** = matches, with a caveat listed in the irregularities.
> **Not re-checked** = cited, but not fetched in this session (reason given).
> **Irregular** = the source and the repo (or two sources) disagree; flagged, not corrected.

## 1. Official sources cited by the repo

| # | Cited URL | Publisher | Used for (repo location) | Result on 2026-11-20 | Status |
|---|---|---|---|---|---|
| 1 | [statsapi.mlb.com/api/v1/gameStatus](https://statsapi.mlb.com/api/v1/gameStatus) | MLB StatsAPI registry | Review-status codes: `IH` "Instant Replay"; `MA`, `MF`, `MS`, `MX` manager-challenge codes; `NS`, `NJ`, `NX` umpire-review codes; `MJ` "Player challenge: Pitch Result" (README tracked-table, `docs/api-compliance.md`) | Read in pages 0–2 of 4. `IH` = "Instant Replay" (reason "Review"). `MA` = "Manager challenge: Tag play", `MF` = "Manager challenge: Close play at 1st", `MS` = "Manager challenge: Stadium boundary call", `MJ` = "Player challenge: Pitch Result", `NJ` = "Umpire Challenge: Pitch Result", `NS` = "Umpire review: Stadium boundary call", `NX` = "Umpire review" (no reason). | **Verified** |
| 2 | [statsapi.mlb.com/api/v1/eventTypes](https://statsapi.mlb.com/api/v1/eventTypes) | MLB StatsAPI registry | `os_ruling_pending_primary`, `os_ruling_pending_prior` = "Official Scorer Ruling Pending" (README, `reviews.html` footer) | Page 0 of 2 lists both codes with description "Official Scorer Ruling Pending". | **Verified** |
| 3 | [statsapi.mlb.com/api/v1/schedule?sportId=1&date=2024-10-30](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2024-10-30) | MLB StatsAPI | Historical test game `775296` (README, `SOURCE-PROVENANCE.md`) | gamePk 775296, `Final`, `World Series Game 5`, Los Angeles Dodgers 7 – New York Yankees 6, `link` `/api/v1.1/game/775296/feed/live`. | **Verified** |
| 4 | [statsapi.mlb.com/api/v1.1/game/775296/feed/live?fields=gamePk](https://statsapi.mlb.com/api/v1.1/game/775296/feed/live?fields=gamePk) | MLB StatsAPI | Route validation (`SOURCE-PROVENANCE.md`) | `{"gamePk":775296}` | **Verified** |
| 5 | [statsapi.mlb.com/api/v1/game/775296/linescore](https://statsapi.mlb.com/api/v1/game/775296/linescore) | MLB StatsAPI | Game-table cross-check (S2) | Innings runs (away) 0,0,0,0,5,0,0,2,0; (home) 3,1,1,0,0,1,0,0,0. Totals away R7 H7 E0; home R6 H8 **E2**. | **Irregular** — see A-03 |
| 6 | [statsapi.mlb.com/api/v1.1/game/775296/feed/live (filtered: liveData.linescore, boxscore.teamStats.fielding)](https://statsapi.mlb.com/api/v1.1/game/775296/feed/live?fields=liveData,linescore,teams,home,away,errors,runs,hits,innings,num,fielding,boxscore,teamStats,errors) | MLB StatsAPI feed | The page's game table reads this (`assets/js/game.js` `renderLinescore`) | Innings runs and hits match the linescore endpoint. Home errors by inning: 5th = 2, 8th = 1; totals `teams.home.errors` = **3**; `boxscore.teams.home.teamStats.fielding.errors` = **3**. | **Irregular** — see A-03 |
| 7 | [statsapi.mlb.com/api/v1/game/775296/boxscore](https://statsapi.mlb.com/api/v1/game/775296/boxscore) | MLB StatsAPI | Team fielding totals (S2) | Away `fielding.errors` = 0 (matches). Home total read from the filtered feed (item 6) = 3; the first page of this endpoint did not reach the home block. | **Verified** (away) · home see item 6 |
| 8 | [statsapi.mlb.com/api/v1.1/game/775296/feed/live?fields=liveData,decisions,…](https://statsapi.mlb.com/api/v1.1/game/775296/feed/live?fields=liveData,decisions,winner,loser,save,players,fullName,id) | MLB StatsAPI feed | Game header "winner / loser / save" line | winner Blake Treinen (595014), loser Tommy Kahnle (592454), save Walker Buehler (621111). | **Verified** |
| 9 | [statsapi.mlb.com/api/v1.1/game/822974/feed/live (filtered)](https://statsapi.mlb.com/api/v1.1/game/822974/feed/live?fields=gameData,review,absChallenges,away,home,remaining,used,usedSuccessful,usedFailed,liveData,plays,allPlays,reviewDetails,reviewType,challengeTeamId,isOverturned,playEvents) | MLB StatsAPI feed | ABS `MJ` example, `reviewDetails` shape (README, `SOURCE-PROVENANCE.md`) | **Not re-checked here.** Owned by session a35ded9a (PR #9, task V1-B), which reports the same shape. | Not re-checked |
| 10 | [mlb.com/glossary/rules/replay-review](https://www.mlb.com/glossary/rules/replay-review) | MLB.com glossary | Replay-review scope; initiation by manager challenge or crew chief | "initiated by a manager challenge or by the umpire crew chief"; reviewable-call list; 2015 change "two challenges for any All-Star Game, postseason game…". | **Verified** |
| 11 | [mlb.com/glossary/rules/manager-challenge](https://www.mlb.com/glossary/rules/manager-challenge) | MLB.com glossary | Challenge counts (README "postseason: two per club") | "Each club receives two manager challenges to start each All-Star Game and postseason game and one manager challenge to start every other game." Club retains challenge if any call is overturned. | **Verified** |
| 12 | [mlb.com/official-information/scoring-changes](https://www.mlb.com/official-information/scoring-changes) | MLB.com | Scoring-change sources (README, `reviews.html` footer) | "Changes can be made by the Official Scorer, Elias Sports Bureau, or following a review initiated by a player or club." Log entries from 2026 regular season. | **Verified** |
| 13 | [mlb.com/news/abs-challenge-system-mlb-2026](https://www.mlb.com/news/abs-challenge-system-mlb-2026) | MLB.com | ABS rules: two challenges per team, retained on success, used in postseason (README sources) | Body text: "Each team will start the game with two challenges apiece."; "Are successful challenges retained? Yes."; postseason: "Yes."; Spring Training 2025, 288 games, "an average of 4.1 challenges per game". | **Verified, note** — see A-02 |
| 14 | [baseballsavant.mlb.com/leaderboard/abs-challenges](https://baseballsavant.mlb.com/leaderboard/abs-challenges) | MLB Statcast (Baseball Savant) | ABS definitions (README sources) | "Each team starts with two challenges; teams will lose the ability to challenge after they do so incorrectly twice." Official ABS zone definition. | **Verified** |
| 15 | [statsapi.mlb.com](https://statsapi.mlb.com) (host, `api.js` `BASE`) | MLB StatsAPI | Data host for every API call | Host reachable through `fetch_page`; the sandbox shell cannot reach it (TLS). | **Verified** (via fetch tool) |
| 16 | [mlbstatic.com team logos](https://www.mlbstatic.com/team-logos/119.svg) | MLB | Team logos in `ui.js` `teamLogo` | Logo URLs for teams 119 and 147 appear in the rendered game page. | Verified (render only) |

## 2. Non-MLB sources cited for the alert sound (licence and reference)

These are not MLB sources. They are listed because the repo cites them as licence and
measurement references.

| # | Cited URL | Publisher | Used for | Result on 2026-11-20 | Status |
|---|---|---|---|---|---|
| 17 | [pixabay.com/service/license-summary/](https://pixabay.com/service/license-summary/) | Pixabay | Licence summary (`assets/audio/README.md`, `docs/alert-sound.md`) | "Use Content for free"; "Use Content without having to attribute the author"; "You cannot sell or distribute Content … on a Standalone basis." | **Verified** |
| 18 | [pixabay.com/sound-effects/…-cash-register-kaching-sound-effect-125042/](https://pixabay.com/sound-effects/film-special-effects-cash-register-kaching-sound-effect-125042/) | Pixabay (Modestas123123) | Candidate recording slot (`assets/audio/README.md`) | Title "Cash register (kaching) money sound effect", author Modestas123123, duration 0:03, "Free for use under the Pixabay Content License". | **Verified** (no audio file committed) |
| 19 | [pixabay.com/sound-effects/…-cash-register-fake-88639/](https://pixabay.com/sound-effects/film-special-effects-cash-register-fake-88639/) | Pixabay (freesound_community / CapsLok) | Candidate recording slot; measurement reference (`sound-lab.html`) | Title "Cash register fake ding sound effect", artist CapsLok (Freesound), duration 0:02, Pixabay Content License. | **Verified, note** — see A-05 |
| 20 | [freesound.org/people/CapsLok/sounds/184438/](https://freesound.org/people/CapsLok/sounds/184438/) | Freesound (CapsLok) | Underlying CC0 sound (`assets/audio/README.md`, `sound-lab.html`) | Licence "Creative Commons 0"; duration 0:02.195; description: "It's not the sound of an actual cash register but the combination of 5 different single sounds…". | **Verified, note** — see A-05 |

## 3. Upstream and references that could not be verified

| # | Cited URL | Result | Status |
|---|---|---|---|
| 21 | [buffedlizard55-lab.github.io/MLB-Live-PBP/reviews.html](https://buffedlizard55-lab.github.io/MLB-Live-PBP/reviews.html) (README "Copy of…") | `fetch_page` error: "Failed to fetch page". `git ls-remote https://github.com/buffedlizard55-lab/MLB-Live-PBP.git` → "Repository not found". | **Irregular / unverifiable** — see A-01 |
| 22 | `api.github.com/repos/buffedlizard55-lab/MLB-Live-PBP` (`SOURCE-PROVENANCE.md`) | Unauthenticated API returned HTTP 403 (rate limit) in this session. | Not re-checked |
| 23 | GitHub-internal links (PR, commit, Actions run, `blob/…` links in `COORDINATION.md`, `SOURCE-PROVENANCE.md`) | `gh pr list` worked; `gh run list` and the unauthenticated REST API returned rate-limit 403s. Not every internal link was fetched. | Partly checked (see A-08) |
| 24 | [docs.github.com/en/pages](https://docs.github.com/en/pages) | Not fetched. | Not re-checked |

## 4. S2 — game table line-by-line (game 775296, 2024-10-30)

The deployed `game.html?gamePk=775296` page renders the table below (read through
`fetch_page`, 2026-11-20). Each row's Source column links to
`statsapi.mlb.com/api/v1.1/game/775296/feed/live`.

| Team | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | R | H | E | Official value (feed, item 6) | Check |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Los Angeles Dodgers (away) | 0 | 0 | 0 | 0 | 5 | 0 | 0 | 2 | 0 | 7 | 7 | 0 | runs 0,0,0,0,5,0,0,2,0 · R 7 · H 7 · E 0 | Match (all cells) |
| New York Yankees (home) | 3 | 1 | 1 | 0 | 0 | 1 | 0 | 0 | 0 | 6 | 8 | 3 | runs 3,1,1,0,0,1,0,0,0 · R 6 · H 8 · E 3 | Runs and hits match. **E shows the feed value (3); the v1 linescore endpoint says 2 — see A-03.** |

Header line: "LAD 7 – 6 NYY · Final · 2024-10-31T00:08:00Z" matches item 3 (`gameDate`) and
the linescore/schedule totals. Decisions line matches item 8. Live-matchup line
"Alex Verdugo vs Walker Buehler · 1–3, 3 outs" matches the linescore's `balls 1`,
`strikes 3`, `outs 3`, batter Verdugo, pitcher Buehler.

## 5. Table-row source coverage

Checked every Markdown table row and every `<tr>` in `flagged-for-review.html`
(2026-11-20, scripted read of the repo).

- `README.md`: every data row contains an http link. Header-only rows have none.
- `docs/api-compliance.md`, `docs/verification-report.md`, `docs/abs-inclusion.md`,
  `docs/scoring-changes.md`, `SOURCE-PROVENANCE.md`: every data row contains a link.
- `flagged-for-review.html`: every data row contains a link.
- `assets/audio/LICENCE.md`: all data rows are deliberately blank with the text
  `_(unverified — fill in on install)_`. This follows the rule "leave blank and flag".
- `COORDINATION.md` board rows **T1, T4, T6, T7, T8** cite repo files only, not an
  official source (A-07).

## 6. Irregularities for review (not corrected)

- **A-01 — Upstream is unreachable.** The original `buffedlizard55-lab/MLB-Live-PBP`
  repository and its Pages site could not be fetched (see §3, item 21). The reference
  pages the user named (`LIVPBP2/reviews.html`, `POSTSSNALRT/reviews.html`) are both
  reconstructions. `LIVPBP2/README.md` says so in its own words: "no screen here can be
  proven identical to [the original]". Exact parity with the original therefore cannot
  be confirmed from any source available here. See `docs/reference-parity.md`.
- **A-02 — ABS explainer fetch metadata.** For `mlb.com/news/abs-challenge-system-mlb-2026`
  the fetch tool returned the explainer body, but the page metadata (title and URL) named
  a different article ("Ranking the Padres' biggest remaining offseason needs"). The body
  text matches the explainer, so the facts above are taken from the body. A human should
  re-open the link to confirm, because the metadata mismatch may be a fetch-tool fault.
- **A-03 — MLB's own endpoints disagree on game 775296 errors.** The v1 linescore
  endpoint reports home errors 2 (inning 5 = 2). The v1.1 live feed and its boxscore
  report home errors 3 (inning 5 = 2, inning 8 = 1). The page follows the live feed,
  which is the source `game.js` reads. The inning-8 error does not appear in the linescore
  endpoint. The repo does not correct either source. Manual review should decide which
  value is canonical for the table.
- **A-04 — "verified live 2026-09-29" in README.** The README's "Sources" heading
  states the sources were verified on 2026-09-29. This session's records are 2026-11-20.
  The 2026-09-29 date is not supported by any record in the repo, so it is flagged as
  unverified.
- **A-05 — The README calls the reference sounds "real recordings".**
  `README.md` says the synthesized alert was built "by decoding two real cash-register
  recordings". Freesound's page for 184438 says "It's not the sound of an actual cash
  register but the combination of 5 different single sounds". Pixabay 88639 is titled
  "Cash register fake ding sound effect". The repo's `assets/audio/README.md` does state
  that neither file is the video's sound. The README's wording overstates what the
  references are. Flagged for review; wording not changed in this session.
- **A-06 — Props forecast differs from the other reconstruction.** `LIVPBP2/README.md`
  describes "the two-sided hit forecast (`assets/js/props.js`)" as implemented. This
  repo's `props.js` deliberately has no forecast model (flagged as F-04 on
  `flagged-for-review.html`). The two "working" reference pages therefore do not match
  each other on this feature.
- **A-07 — Board rows without official sources.** `COORDINATION.md` rows T1, T4, T6,
  T7 and T8 cite repo files, not official MLB or StatsAPI links. The rule "every table
  row must have a source link to an official site" is not met for these rows. History is
  not edited; this is flagged here.
- **A-08 — GitHub-side links only partly checked.** Because of unauthenticated rate limits
  (HTTP 403) and the sandbox's network limits, the PR/Actions/commit links in
  `COORDINATION.md` and `SOURCE-PROVENANCE.md` were not each fetched. `gh pr list` returned
  the PR records that are cited. The Actions run pages were not opened.

## 7. What this audit does not establish

- It does not show that the site behaves like the original upstream, because the original
  is unreachable (A-01).
- It does not re-verify the ABS review payload (`reviewDetails`, game 822974); that is
  owned by session a35ded9a (PR #9).
- It does not check live-game behaviour. No game was in progress on 2026-11-20 (the last
  official slate is 2026-10-28, per PR #9's notes).
- It does not verify the replay feed's rendering for a historical date. `reviews.html`
  has no `?date=` parameter, so the page cannot be rendered for a past slate through
  `fetch_page`.
