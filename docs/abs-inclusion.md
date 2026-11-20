# ABS inclusion — the intentional difference vs upstream

> Reconstruction note: the original `docs/` tree was missing from the upload
> (see `COORDINATION.md` T6). This file records the delta described in
> `README.md` and implemented in `assets/js/reviews.js`.

## Upstream behaviour (MLB-Live-PBP)

Upstream keeps ABS pitch challenges **out** of the "All" feed and out of the
audio-alert gate: `shouldAlertForReview` / `visibleInAllFeed` return `false`
only for `typeKey === 'abs'`, so a full regular season of routine ABS
challenges does not flood the feed. The dedicated ABS tab, ABS stat and
official challenges-remaining counters remain alongside All.

## This build (POSTSEASONMLBALERTS)

ABS pitch challenges are **included** in:

- the **All** feed (`Reviews.visibleInAllFeed` returns `true` for `abs`),
- the **Events** stat,
- **alerts** (`Reviews.shouldAlertForReview` returns `true` for `abs`),
- **live tracking** (active strip + under-review status).

Source fields (official MLB StatsAPI payloads, host
https://statsapi.mlb.com):

| Tracked | Source field |
| --- | --- |
| ABS pitch challenges | `playEvents[].reviewDetails` (code `MJ`), `gameData.absChallenges` counters · [Source](https://statsapi.mlb.com/api/v1.1/game/822974/feed/live) |
| Manager challenges | `play.reviewDetails` (codes `MA`/`MF`/…), `gameData.review` counters · [Source](https://statsapi.mlb.com/api/v1/gameStatus) |
| Crew-chief / umpire reviews | `play.reviewDetails`, game status `IH` ("Instant Replay") · [Source](https://statsapi.mlb.com/api/v1/gameStatus) |
| Boundary calls | `play.reviewDetails` · [Source](https://statsapi.mlb.com/api/v1/gameStatus) |

Code meanings (`MJ`, `MA`, `MF`, …) are recorded from `README.md`; they could
not be confirmed from an official source in the build sandbox
(statsapi.mlb.com unreachable there) and are flagged F-03 in
`flagged-for-review.html`. Classification in `assets/js/reviews.js` keys off
the payload's own `type.description` text first, so a code rename degrades to
a generic review row rather than a wrong category.

## Trade-off (README.md limitation 2)

Including ABS means roughly **4+ extra cha-chings per game** (MLB's own 2025
spring data: avg 4.1 challenges/game, per README.md). Suggested upgrade:
per-category sound toggles and/or a short coalescing window. Currently one
alert per poll max + 2.5 s cooldown bounds it.

Official ABS context: https://www.mlb.com/news/abs-challenge-system-mlb-2026
and https://baseballsavant.mlb.com/leaderboard/abs-challenges (both linked
from README.md "Sources"; not re-fetched in the sandbox).
