# Scoring changes — how the feed tracks them

> Reconstruction note: the original `docs/` tree was missing from the upload
> (see `COORDINATION.md` T6). This file records the behaviour described in
> `README.md` and `reviews.html` (footer) and implemented in
> `assets/js/reviews.js` (`snapshotPlay` / `detectScoringChange`) and
> `assets/js/reviews-feed.js`.

## What counts as a scoring change

Official scoring changes (a hit reclassified as an error or vice versa, a
single changed to a double or back, a base hit changed to a fielder's choice
+ error, an out changed to a hit, and so on) are tracked by snapshotting
every completed play's official classification on every poll and diffing it
against previous polls:

- `result.eventType`
- `result.isOut`
- `count.outs`
- error movements in `runners[]`

The StatsAPI payload carries **no scoring-change marker**, so the initial
call and the final ruling are known only from consecutive observations. Each
row shows the observed initial call and the final ruling, the official score
after the play, and an attribution note. Changes that coincide with a replay
review stay on that review's row; everything else is attributed as an
official scoring change.

Per MLB's own log, changes are made by the **Official Scorer, the Elias
Sports Bureau, or after a player/club review**:
https://www.mlb.com/official-information/scoring-changes

## Limits (flagged, not hidden)

- A change can only be tracked when its initial call was observed **before**
  the change landed. Finals are re-scanned for 30 minutes after they end (at
  most every 30 seconds) to catch rulings published after the game.
- Payload edits **without** a reclassification (description / RBI / score
  only) and plays that **vanish** from the payload are flagged as
  irregularities for review, never corrected or hidden
  (`Reviews.isPayloadOnlyEdit`).
- A used-challenge counter moving backwards between polls is flagged as an
  irregularity on the affected rows instead of being corrected
  (`Reviews.flagCounterRegression`).

Fixture coverage: `tools/scoring-change-test.mjs` and
`tools/official-scoring-test.mjs` (no network).
