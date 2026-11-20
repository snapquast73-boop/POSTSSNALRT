# Reference parity — session 31861034 (task S3)

> Recorded 2026-11-20 (UTC). Question from the request: does this site work "functionally
> the same as before", using the two pages the user named as the reference?
>
> Short answer: **it cannot be proven from any source available here.** The original
> upstream (`buffedlizard55-lab/MLB-Live-PBP`) no longer exists, and the two reference
> pages are themselves reconstructions that differ from each other. Details below.
> Sources and checks: [`docs/source-audit.md`](source-audit.md).

## 1. The three candidate baselines

| Baseline | URL | State on 2026-11-20 | Evidence |
|---|---|---|---|
| Original upstream | [buffedlizard55-lab.github.io/MLB-Live-PBP/reviews.html](https://buffedlizard55-lab.github.io/MLB-Live-PBP/reviews.html) | **Not reachable.** `fetch_page` failed; `git ls-remote` returned "Repository not found". | [source-audit §3 item 21](source-audit.md) |
| Reference 1 (user-named) | [snapquast73-boop.github.io/LIVPBP2/reviews.html](https://snapquast73-boop.github.io/LIVPBP2/reviews.html) | Live. Reconstruction. Its own README says the original "no longer exists … so no screen here can be proven identical to it." Source: [LIVPBP2 README](https://github.com/snapquast73-boop/LIVPBP2/blob/main/README.md). | Rendered 2026-11-20 |
| Reference 2 (user-named, this repo) | [snapquast73-boop.github.io/POSTSSNALRT/reviews.html](https://snapquast73-boop.github.io/POSTSSNALRT/reviews.html) | Live. Reconstruction (README "Intentional differences vs. MLB-Live-PBP"; `SOURCE-PROVENANCE.md`). | Rendered 2026-11-20 |

## 2. Reviews page — rendered side by side (empty slate, 2026-11-20)

Both pages were rendered with the same tool on the same day. Neither has an active
slate today (the last official 2026 slate is 2026-10-28, per the StatsAPI schedule).

| Element | Reference 1 (LIVPBP2) | Reference 2 (POSTSSNALRT) | Parity |
|---|---|---|---|
| Title | "MLB Live PBP — Replay Feed" | "MLB Live PBP — Replay Feed" | Same |
| Summary cards | 4: Reviews & Challenges · ABS Challenges · Under Review · Runs at Risk | 8: Events · Challenges · Reviews · Boundary · ABS · Runs at Risk · Pending · Scoring | **Different** (see §3) |
| Empty state | "No matching review events for this date/filter." · "Scanned 0/0 game(s)" | "No tracked events for this filter yet. New challenges, reviews, ABS challenges, pending rulings and scoring changes will appear here live." · "0 tracked events · 0 games" | Different wording |
| Feed tabs (from each `assets/js/reviews-feed.js`, `TABS`) | All · ABS · Challenges · Reviews · Boundary Calls · Under Review · ⚠️ Runs at Risk · ✏️ Scoring Changes · **Flagged** | All · Challenges · Reviews · Boundary Calls · ABS · Under Review · Runs at Risk · **Scoring Pending** · Scoring Changes | **Different** — each has a tab the other lacks |
| Official-scorer pending rulings (`os_ruling_pending_*`) | Classified in `assets/js/reviews.js` (line ~414), shown in the feed; no dedicated tab | Classified in `assets/js/reviews.js` (line ~33); dedicated "Scoring Pending" tab | Different presentation |
| Source for the rules | [MLB glossary: Replay Review](https://www.mlb.com/glossary/rules/replay-review) (this repo's README) | Same source in this repo's README | Same source cited by this repo; **LIVPBP2's README does not cite the MLB glossary** (checked by grep) |

## 3. Why the two references differ, with sources

1. **Feature set.** Reference 2 (this repo) includes ABS challenges in the All feed, plus
   Boundary, Pending (official-scorer rulings) and Scoring-change tracking. The README
   calls ABS-in-All an "intentional difference vs. MLB-Live-PBP". Source: this repo's
   `README.md` ("Intentional differences"). Reference 1 has the same underlying feed
   categories but a different tab set: it adds a **Flagged** tab, has no **Scoring Pending**
   tab, and shows four summary cards instead of eight (see §2).
2. **Props forecast.** Reference 1's README says "the two-sided hit forecast
   (`assets/js/props.js`)" is implemented. This repo's `props.js` deliberately has no
   forecast model (`flagged-for-review.html`, F-04). **Not** the same feature. Source:
   [LIVPBP2 README](https://github.com/snapquast73-boop/LIVPBP2/blob/main/README.md)
   ("Implemented" list).
3. **Game page text.** Reference 1 prints a score after every play row (for example
   "top 8 · Sac Fly 7–6"). Reference 2 prints the inning label and the play, and the
   score is not repeated on each row. The data are the same; the presentation differs.

## 4. Same data, same numbers — game 775296 (2024 World Series Game 5)

Both game pages were rendered for `gamePk=775296` on 2026-11-20. Both read the official
feed (`statsapi.mlb.com/api/v1.1/game/775296/feed/live`).

| Item | Official value | Reference 1 | Reference 2 | Note |
|---|---|---|---|---|
| Final score | LAD 7, NYY 6 — [schedule](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2024-10-30) | 7 – 6 | 7 – 6 | Match |
| LAD runs by inning | 0,0,0,0,5,0,0,2,0 — [feed](https://statsapi.mlb.com/api/v1.1/game/775296/feed/live?fields=liveData,linescore,teams,home,away,errors,runs,hits,innings,num,fielding,boxscore,teamStats,errors) | 0 0 0 0 5 0 0 2 0 | same | Match |
| NYY runs by inning | 3,1,1,0,0,1,0,0,0 | 3 1 1 0 0 1 0 0 0 | same | Match |
| NYY errors (E) | **2** in [linescore endpoint](https://statsapi.mlb.com/api/v1/game/775296/linescore); **3** in [live feed](https://statsapi.mlb.com/api/v1.1/game/775296/feed/live?fields=liveData,linescore,teams,home,away,errors,runs,hits,innings,num,fielding,boxscore,teamStats,errors) and boxscore | 3 | 3 | Both references follow the feed. **Irregular — see A-03 in source-audit.** |
| Decisions | winner Treinen, loser Kahnle, save Buehler — [feed](https://statsapi.mlb.com/api/v1.1/game/775296/feed/live?fields=liveData,decisions,winner,loser,save,players,fullName,id) | (not rendered in the first chunk) | (not rendered in the first chunk) | Not compared |
| Manager challenge, top 8 (catcher interference, upheld) | in the feed's play events | rendered as "Manager challenge" | rendered as "Catcher Interference · Review" | Both present; labels differ |

## 5. Conclusion for the request

- The deployed site (this repo) and Reference 1 agree on every number checked for game
  775296. Both follow the live feed, including its E=3, which disagrees with MLB's own
  linescore endpoint (A-03).
- Reference 1 and Reference 2 differ on feature set and on the props model. They cannot
  both be "exactly as before". Whichever one the user regards as the original baseline,
  the other differs on these items.
- The original upstream is unreachable, so no source here can confirm either reference
  against the original. Nothing was changed to make the two references match. Any change
  would be a guess about the original, and the request says not to guess.
- What remains open for the user to decide (not changed here):
  1. Which reference is the baseline for the summary cards and the props model.
  2. Whether the feed's E=3 or the linescore endpoint's E=2 should be shown (A-03).
  3. Whether the alert-sound wording should be corrected (A-05).
