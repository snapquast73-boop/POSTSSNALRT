/* ============================================================================
 * reviews.js — replay-review classification, counters, and scoring-change
 * detection. Pure functions (no DOM, no network) so the test suite in tools/
 * can exercise them directly.
 *
 * Data comes ONLY from official MLB StatsAPI payloads (see README "Sources"):
 *   play.reviewDetails            manager challenges / crew reviews / ABS
 *   gameData.review               official challenges-remaining counters
 *   gameData.absChallenges        official ABS counters
 *   gameData.status               "under review" live status (M, N, IH codes)
 *   result.eventType              os_ruling_pending_primary / _prior
 *   result.eventType/isOut, count.outs, runners[]   scoring-change diffing
 *
 * INTENTIONAL DIFFERENCE vs upstream MLB-Live-PBP: ABS pitch challenges ARE
 * included in the All feed and the alert gate (shouldAlertForReview /
 * visibleInAllFeed return true for typeKey 'abs'). Upstream returns false
 * for ABS during the regular season to limit volume. See docs/abs-inclusion.md.
 *
 * Nothing here predicts, infers from score deltas, or zero-fills absent
 * counters. Irregularities are returned as flags for the UI to display,
 * never silently corrected.
 * ==========================================================================*/
(function () {
  'use strict';

  /* Official event types for official-scorer pending rulings, per the
   * StatsAPI event-type registry (GET /api/v1/eventTypes). */
  var SCORING_PENDING_TYPES = ['os_ruling_pending_primary', 'os_ruling_pending_prior'];

  /* Review codes named in the project spec: MA/MF/… for manager challenges,
   * MJ for ABS pitch challenges. Any other code is still tracked as a review
   * (never dropped) but classified by description text. */
  var ABS_CODES = ['MJ'];
  var MANAGER_CODES = ['MA', 'MF'];

  function asArray(v) { return Array.isArray(v) ? v : []; }

  function reviewDetailsOf(play) {
    if (!play || typeof play !== 'object') return [];
    if (Array.isArray(play.reviewDetails)) return play.reviewDetails;
    return [];
  }

  function detailCode(detail) {
    if (!detail || typeof detail !== 'object') return '';
    var raw = detail.code || detail.reviewCode || detail.type || detail.reviewType || '';
    return String(raw).toUpperCase();
  }

  function playText(play) {
    var r = (play && play.result) || {};
    return [r.description, r.event, r.eventType].filter(Boolean).join(' | ');
  }

  function isAbsDetail(detail) {
    var code = detailCode(detail);
    if (ABS_CODES.indexOf(code) !== -1) return true;
    if (/ABS/.test(code)) return true;
    return false;
  }

  function isManagerDetail(detail) {
    var code = detailCode(detail);
    if (MANAGER_CODES.indexOf(code) !== -1) return true;
    return false;
  }

  /**
   * Classify one play. Returns null when the play is not a tracked review
   * event; otherwise { typeKey, label, details, overturned, inProgress }.
   * typeKey is one of: 'abs' | 'boundary' | 'challenge' | 'review'.
   */
  function classifyPlay(play) {
    var details = reviewDetailsOf(play);
    if (!details.length) return null;

    var text = playText(play);
    var anyAbs = details.some(isAbsDetail);
    var anyManager = details.some(isManagerDetail);
    var isBoundary = /boundary/i.test(text) ||
      details.some(function (d) { return /BOUNDARY/.test(detailCode(d)); });

    var typeKey, label;
    if (anyAbs) {
      typeKey = 'abs';
      label = 'ABS pitch challenge';
    } else if (isBoundary) {
      typeKey = 'boundary';
      label = 'Boundary call review';
    } else if (anyManager || /manager challenge/i.test(text)) {
      typeKey = 'challenge';
      label = 'Manager challenge';
    } else {
      typeKey = 'review';
      label = 'Crew-chief / umpire review';
    }

    var overturned = details.some(function (d) { return d && d.isOverturned === true; });
    var inProgress = details.some(function (d) { return d && d.inProgress === true; });

    return {
      typeKey: typeKey,
      label: label,
      details: details,
      overturned: overturned,
      inProgress: inProgress
    };
  }

  /** True when the play's result is an official-scorer pending ruling. */
  function isScoringPending(play) {
    var t = play && play.result && play.result.eventType;
    return SCORING_PENDING_TYPES.indexOf(t) !== -1;
  }

  /**
   * True when a game-status code means "under review" (M, N, IH codes per the
   * official game-status registry, GET /api/v1/gameStatus).
   */
  function isUnderReviewStatus(code) {
    if (!code) return false;
    var c = String(code);
    return c === 'IH' || c.charAt(0) === 'M' || c.charAt(0) === 'N';
  }

  /**
   * True when the reviewed play credited a run (runners[] moves with
   * isRun) — i.e. an overturn could take a run OFF the scoreboard.
   */
  function isRunAtRisk(play) {
    var runners = asArray(play && play.runners);
    for (var i = 0; i < runners.length; i++) {
      var moves = asArray(runners[i] && runners[i].moves);
      for (var j = 0; j < moves.length; j++) {
        if (moves[j] && moves[j].isRun === true) return true;
      }
    }
    return false;
  }

  /**
   * Official challenges-remaining counters, read directly from the payload.
   * Returns null for a counter family when the payload does not carry it
   * (e.g. pre-ABS seasons) — NEVER zero-filled.
   */
  function getChallengeCounters(gameData) {
    var gd = gameData || {};
    var out = { manager: null, abs: null };

    var rev = gd.review;
    if (rev && typeof rev === 'object') {
      out.manager = {
        away: counterSide(rev.away),
        home: counterSide(rev.home)
      };
    }

    var abs = gd.absChallenges;
    if (abs && typeof abs === 'object') {
      out.abs = {
        away: absSide(abs.away),
        home: absSide(abs.home)
      };
    }
    return out;
  }

  function counterSide(side) {
    if (!side || typeof side !== 'object') return null;
    if (side.used == null && side.remaining == null) return null;
    return { used: side.used, remaining: side.remaining };
  }

  function absSide(side) {
    if (!side || typeof side !== 'object') return null;
    if (side.usedSuccessful == null && side.usedFailed == null && side.remaining == null) return null;
    return {
      usedSuccessful: side.usedSuccessful,
      usedFailed: side.usedFailed,
      remaining: side.remaining
    };
  }

  /**
   * Compare two counter snapshots. Returns a list of irregularity strings
   * (empty when consistent). A used-counter moving backwards is flagged,
   * never corrected.
   */
  function checkCounterIrregularity(prev, next) {
    var flags = [];
    if (!prev || !next) return flags;
    ['manager', 'abs'].forEach(function (family) {
      var p = prev[family], n = next[family];
      if (!p || !n) return;
      ['away', 'home'].forEach(function (side) {
        var ps = p[side], ns = n[side];
        if (!ps || !ns) return;
        if (family === 'manager') {
          if (typeof ps.used === 'number' && typeof ns.used === 'number' && ns.used < ps.used) {
            flags.push(family + '.' + side + '.used moved backwards (' + ps.used + ' -> ' + ns.used + ')');
          }
        } else {
          ['usedSuccessful', 'usedFailed'].forEach(function (k) {
            if (typeof ps[k] === 'number' && typeof ns[k] === 'number' && ns[k] < ps[k]) {
              flags.push(family + '.' + side + '.' + k + ' moved backwards (' + ps[k] + ' -> ' + ns[k] + ')');
            }
          });
        }
      });
    });
    return flags;
  }

  /**
   * Snapshot of the scoring-relevant fields of one play, for poll-to-poll
   * diffing. The StatsAPI carries no scoring-change marker, so a change is
   * known only from consecutive observations.
   */
  function snapshotPlay(play) {
    var r = (play && play.result) || {};
    var c = (play && play.count) || {};
    var runners = asArray(play && play.runners).map(function (runner) {
      var moves = asArray(runner && runner.moves).map(function (m) {
        return { base: m && m.base, isRun: !!(m && m.isRun) };
      });
      return { id: runner && runner.runner && runner.runner.id, moves: moves };
    });
    return {
      eventType: r.eventType || null,
      isOut: r.isOut == null ? null : !!r.isOut,
      outs: c.outs == null ? null : c.outs,
      description: r.description || '',
      rbi: r.rbi == null ? null : r.rbi,
      runners: runners
    };
  }

  function runnersEqual(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i].id !== b[i].id) return false;
      if (a[i].moves.length !== b[i].moves.length) return false;
      for (var j = 0; j < a[i].moves.length; j++) {
        if (a[i].moves[j].base !== b[i].moves[j].base ||
            a[i].moves[j].isRun !== b[i].moves[j].isRun) return false;
      }
    }
    return true;
  }

  /**
   * Diff two snapshots of the same play.
   * Returns { change: bool, irregularity: string|null }.
   * A reclassification (eventType / isOut / outs / runner movements) is a
   * scoring change. A payload edit WITHOUT reclassification (description /
   * RBI only) is flagged as an irregularity, never hidden.
   */
  function diffSnapshots(prev, next) {
    if (!prev || !next) return { change: false, irregularity: null };
    var reclassified =
      prev.eventType !== next.eventType ||
      prev.isOut !== next.isOut ||
      prev.outs !== next.outs ||
      !runnersEqual(prev.runners || [], next.runners || []);
    if (reclassified) return { change: true, irregularity: null };
    if (prev.description !== next.description || prev.rbi !== next.rbi) {
      return {
        change: false,
        irregularity: 'payload edited without reclassification (description/RBI changed, eventType/isOut/outs unchanged)'
      };
    }
    return { change: false, irregularity: null };
  }

  /**
   * Alert gate. INTENTIONAL DIFFERENCE vs upstream: ABS ('abs') IS alerted.
   * Every tracked review type alerts; anything else does not.
   */
  function shouldAlertForReview(review) {
    if (!review || !review.typeKey) return false;
    return ['challenge', 'review', 'boundary', 'abs'].indexOf(review.typeKey) !== -1;
  }

  /**
   * All-feed visibility. INTENTIONAL DIFFERENCE vs upstream: ABS IS visible
   * in the All feed. Every tracked review type is visible.
   */
  function visibleInAllFeed(review) {
    if (!review || !review.typeKey) return false;
    return ['challenge', 'review', 'boundary', 'abs'].indexOf(review.typeKey) !== -1;
  }

  var Reviews = {
    SCORING_PENDING_TYPES: SCORING_PENDING_TYPES,
    ABS_CODES: ABS_CODES,
    MANAGER_CODES: MANAGER_CODES,
    reviewDetailsOf: reviewDetailsOf,
    classifyPlay: classifyPlay,
    isScoringPending: isScoringPending,
    isUnderReviewStatus: isUnderReviewStatus,
    isRunAtRisk: isRunAtRisk,
    getChallengeCounters: getChallengeCounters,
    checkCounterIrregularity: checkCounterIrregularity,
    snapshotPlay: snapshotPlay,
    diffSnapshots: diffSnapshots,
    shouldAlertForReview: shouldAlertForReview,
    visibleInAllFeed: visibleInAllFeed
  };

  if (typeof window !== 'undefined') window.Reviews = Reviews;
  if (typeof module !== 'undefined' && module.exports) module.exports = Reviews;
})();
