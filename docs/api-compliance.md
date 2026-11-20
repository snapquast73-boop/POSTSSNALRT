# API compliance — MLB StatsAPI endpoints used

> Reconstruction note: the original `docs/` tree was missing from the upload
> (see `COORDINATION.md` T6). Endpoint list below is taken from
> `assets/js/api.js` (rebuilt) and `README.md`. The MLB StatsAPI host is
> https://statsapi.mlb.com. Live responses could not be re-verified in the
> build sandbox (TLS to statsapi.mlb.com blocked there — flagged F-02); the
> client fails loudly on any non-2xx / non-JSON response instead of guessing.

## Endpoints (all GET, no key)

| Endpoint | Used by | Purpose |
| --- | --- | --- |
| `/api/v1/schedule?sportId=1&date=YYYY-MM-DD` | `Api.getSchedule` (scoreboard, feed) | Games for one date · [Source](https://github.com/snapquast73-boop/POSTSSNALRT/blob/f95dff4e96dabfcc456255490fae0f040d616f23/assets/js/api.js) |
| `/api/v1/schedule?sportId=1&startDate=…&endDate=…` | `Api.getScheduleRange` | Date-range schedules · [Source](https://github.com/snapquast73-boop/POSTSSNALRT/blob/f95dff4e96dabfcc456255490fae0f040d616f23/assets/js/api.js) |
| `/api/v1.1/game/{gamePk}/feed/live` | `Api.getFeed` (game, feed) | Full live feed for one game · [Source](https://github.com/snapquast73-boop/POSTSSNALRT/blob/f95dff4e96dabfcc456255490fae0f040d616f23/assets/js/api.js) |
| `/api/v1/game/{gamePk}/boxscore` | `Api.getBoxscore` | Box score · [Source](https://github.com/snapquast73-boop/POSTSSNALRT/blob/f95dff4e96dabfcc456255490fae0f040d616f23/assets/js/api.js) |
| `/api/v1/game/{gamePk}/linescore` | `Api.getLinescore` | Linescore · [Source](https://github.com/snapquast73-boop/POSTSSNALRT/blob/f95dff4e96dabfcc456255490fae0f040d616f23/assets/js/api.js) |
| `/api/v1/teams?sportId=1` | `Api.getTeams` | Team list · [Source](https://github.com/snapquast73-boop/POSTSSNALRT/blob/f95dff4e96dabfcc456255490fae0f040d616f23/assets/js/api.js) |
| `/api/v1/people/{personId}` | `Api.getPerson` | Player bio · [Source](https://github.com/snapquast73-boop/POSTSSNALRT/blob/f95dff4e96dabfcc456255490fae0f040d616f23/assets/js/api.js) |
| `/api/v1/people/{personId}/stats?stats=…&season=…&group=…` | `Api.getPersonStats` (props) | Season stats · [Source](https://github.com/snapquast73-boop/POSTSSNALRT/blob/f95dff4e96dabfcc456255490fae0f040d616f23/assets/js/api.js) |
| `/api/v1/gameStatus` | `Api.getGameStatus` | Game-status registry (review codes `M*`/`N*`/`IH`) · [Source](https://github.com/snapquast73-boop/POSTSSNALRT/blob/f95dff4e96dabfcc456255490fae0f040d616f23/assets/js/api.js) |
| `/api/v1/eventTypes` | `Api.getEventTypes` | Event-type registry (`os_ruling_pending_primary` / `os_ruling_pending_prior`) · [Source](https://github.com/snapquast73-boop/POSTSSNALRT/blob/f95dff4e96dabfcc456255490fae0f040d616f23/assets/js/api.js) |

Team logos: `https://www.mlbstatic.com/team-logos/{teamId}.svg` (lazy-loaded;
dns-prefetched in the HTML head).

## Payload fields read (observed only, never zero-filled)

| Field | Meaning | Official source |
| --- | --- | --- |
| `play.reviewDetails` | Manager / crew-chief / boundary reviews | https://statsapi.mlb.com (feed/live) |
| `playEvents[].reviewDetails` | ABS pitch challenges (code `MJ`) | https://statsapi.mlb.com (feed/live) |
| `gameData.review.away/home.used/remaining` | Manager-challenge counters | https://statsapi.mlb.com (feed/live) |
| `gameData.absChallenges.away/home.usedSuccessful/usedFailed/remaining` | ABS counters | https://statsapi.mlb.com (feed/live) |
| `gameData.status` codes `M*`/`N*`/`IH` | "Under review" live status | https://statsapi.mlb.com/api/v1/gameStatus |
| `result.eventType` = `os_ruling_pending_primary` / `os_ruling_pending_prior` | Official-scorer pending rulings | https://statsapi.mlb.com/api/v1/eventTypes |
| `result.eventType` / `result.isOut` / `count.outs` / error movements in `runners[]` | Official scoring changes (poll-to-poll diff) | https://statsapi.mlb.com (feed/live) |

Rules context (verified live via `fetch_page` on 2026-11-20):

- Replay Review (reviewable calls, crew-chief review):
  https://www.mlb.com/glossary/rules/replay-review
- Manager Challenge (counts, retention; postseason: two per club):
  https://www.mlb.com/glossary/rules/manager-challenge
- Official scoring changes (Official Scorer / Elias / player-club review):
  https://www.mlb.com/official-information/scoring-changes

## Drift policy

The MLB StatsAPI is public but unofficial for third-party use; field shapes
and rate limits can change. The fixture tests in `tools/` fail loudly on
drift in the pure logic; `tools/smoke-test.mjs` checks live endpoints in CI.
Treat any smoke failure as an irregularity for review (README.md limitation 8).
