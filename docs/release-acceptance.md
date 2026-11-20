# Released-site acceptance — 2026-11-20

Session `1016822d` independently checked released commit `a0478fc9438b0b53cd87bdef6dc1d39e1ec05c4a`. No implementation changes were needed in this acceptance session. Earlier sessions restored the missing assets and corrected real-payload browser regressions in PRs #2 and #4.

## Evidence

- [Live site](https://snapquast73-boop.github.io/POSTSSNALRT/)
- [Published limitations and flagged items](https://snapquast73-boop.github.io/POSTSSNALRT/flagged-for-review.html)
- [Successful Pages deployment](https://github.com/snapquast73-boop/POSTSSNALRT/actions/runs/44828723381). GitHub's Pages build API reported `built`, no error, and commit `a0478fc9438b0b53cd87bdef6dc1d39e1ec05c4a`.
- [Fresh successful live-site browser acceptance](https://github.com/snapquast73-boop/POSTSSNALRT/actions/runs/44828859601), explicitly dispatched against `main`. This is a deployed-site check, not just PR localhost testing. The harness uses real MLB schedule/feed responses and checks game navigation, team names, row citations, review extraction and page errors. See [test source](../qa/pages-acceptance.mjs).
- [Successful release smoke CI](https://github.com/snapquast73-boop/POSTSSNALRT/actions/runs/44828724782), including live StatsAPI access.

## Repeated locally

All seven fixture suites passed: 25 review, 8 scoring-change, 7 official-scoring, 25 reviews-feed, 40 replay-render, 7 audio-render, 8 independent audio checks: **120 passed, zero failed**. `node --check` succeeded for every asset JavaScript file, tool module, QA module and `server.mjs`. `python3 qa/check-links.py` reported **0 unresolved local references**.

These checks do not establish that every possible live-game event behaves correctly, that every external URL remains available, or that the reconstructed interface is identical to the unavailable upstream implementation.

## Source and uncertainty policy

Official MLB data endpoints used by acceptance:

- [Historical schedule](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2024-10-30)
- [Historical game feed](https://statsapi.mlb.com/api/v1.1/game/775296/feed/live)
- [Pitch-review payload](https://statsapi.mlb.com/api/v1.1/game/822974/feed/live)

See [source provenance](../SOURCE-PROVENANCE.md) for the missing original assets, unavailable exact upstream snapshot, and independently checked payload structure. Exact original-site parity and contemporary live-overturn timing remain **unverified**. Missing forecasts, unavailable licensed reference audio and unknown review-code meanings must not be presented as confirmed facts. Existing public flags remain non-blocking, as requested.

Coordination: this session owns only this report and its additive coordination log; functional changes owned by other sessions are not duplicated.
