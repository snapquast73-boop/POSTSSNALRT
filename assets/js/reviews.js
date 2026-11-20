/* ============================================================================
 * reviews.js — replay-review classification, counters, runs-at-risk,
 * official-scoring-change diffing and irregularity flagging.
 *
 * Pure functions only (no DOM, no fetch) so the fixture tests in tools/
 * can require this file in Node. Data comes exclusively from official MLB
 * StatsAPI payloads (https://statsapi.mlb.com) — nothing is predicted,
 * inferred from score deltas, or zero-filled when a counter is absent.
 *
 * Rebuilt from the contracts in README.md, reviews.html (footer), game.html
 * and server.mjs (the original file was missing from the upload; see
 * COORDINATION.md T3 and flagged-for-review.html F-01/F-03).
 *
 * Intentional difference vs upstream MLB-Live-PBP (README.md): ABS pitch
 * challenges ARE included in the All feed, the Events stat, alerts and live
 * tracking here. Upstream excludes them (shouldAlertForReview /
 * visibleInAllFeed return false only for typeKey === 'abs'); this build
 * returns true for every tracked type. See docs/abs-inclusion.md.
 *
 * Verification limits (flagged, not guessed — see flagged-for-review.html):
 *  - Review code meanings (MA/MF/MJ/…) could not be confirmed from an
 *    official source in the build sandbox (statsapi.mlb.com unreachable
 *    there). Classification therefore keys off the payload's own
 *    `type.description` text first and treats codes as opaque labels.
 *  - Exact runner-scoring field names for runs-at-risk could not be
 *    confirmed live; the check is defensive and returns false when the
 *    payload shape is unrecognised.
 * ==========================================================================*/
(function () {
  'use strict';

  var PENDING_EVENT_TYPES = {
    os_ruling_pending_primary: true,
    os_ruling_pending_prior: true,
  };

  function normText(s) { return String(s || '').toLowerCase(); }

  /**
   * Classify one reviewDetails entry.
   * Input: { type: { code, description }, ... } (or a bare description string).
   * Output: { typeKey, label, badgeClass, code, description }
   * typeKey: challenge | review | boundary | abs | unknown
   */
  function classifyReview(detail) {
    var code = '';
    var description = '';
    if (typeof detail === 'string') {
      description = detail;
    } else if (detail && typeof detail === 'object') {
      var t = detail.type || {};
      code = String(t.code || detail.code || '');
      description = String(t.description || detail.description || '');
    }
    var text = normText(description);
    var typeKey = 'unknown';
    var label = description || 'Review';
    var badgeClass = 'review';

    if (text.indexOf('abs') !== -1 || text.indexOf('automated ball-strike') !== -1 ||
        text.indexOf('automated ball strike') !== -1 || code.toUpperCase() === 'MJ') {
      typeKey = 'abs';
      label = 'ABS pitch challenge';
      badgeClass = 'abs';
    } else if (text.indexOf('manager challenge') !== -1) {
      typeKey = 'challenge';
      label = 'Manager challenge';
      badgeClass = 'challenge';
    } else if (text.indexOf('boundary') !== -1 || text.indexOf('home run') !== -1 ||
               text.indexOf('fan interference') !== -1) {
      typeKey = 'boundary';
      label = 'Boundary call review';
      badgeClass = 'boundary';
    } else if (text.indexOf('crew chief') !== -1 || text.indexOf('umpire') !== -1 ||
               text.indexOf('replay review') !== -1 || text.indexOf('instant replay') !== -1) {
      typeKey = 'review';
      label = 'Crew-chief / umpire review';
      badgeClass = 'review';
    } else if (description) {
      // Any other reviewDetails entry is still a tracked review; keep the
      // payload's own wording as the label rather than inventing a category.
      typeKey = 'review';
      label = description;
      badgeClass = 'review';
    }

    return { typeKey: typeKey, label: label, badgeClass: badgeClass, code: code, description: description };
  }

  function reviewId(detail, play, index) {
    if (detail && detail.id !== undefined && detail.id !== null && detail.id !== '') return String(detail.id);
    var atBat = play && play.about ? play.about.atBatIndex : '';
    return 'play-' + (atBat !== undefined && atBat !== null ? atBat : index);
  }

  /**
   * Extract normalized reviews from one play object.
   * Scans play.reviewDetails and play.playEvents[].reviewDetails (ABS pitch
   * challenges surface at pitch level per README.md), deduped by id.
   */
  function extractReviewsFromPlay(play, playIndex) {
    var out = [];
    var seen = {};
    function add(detail) {
      if (!detail || typeof detail !== 'object') return;
      var id = reviewId(detail, play, playIndex);
      if (seen[id]) return;
      seen[id] = true;
      var c = classifyReview(detail);
      out.push({
        id: id,
        typeKey: c.typeKey,
        label: c.label,
        badgeClass: c.badgeClass,
        code: c.code,
        description: c.description,
        atBatIndex: play && play.about ? play.about.atBatIndex : null,
        inning: play && play.about ? play.about.inning : null,
        halfInning: play && play.about ? play.about.halfInning : null,
        isTopInning: play && play.about ? play.about.isTopInning : null,
        batter: play && play.matchup && play.matchup.batter ? play.matchup.batter.fullName : null,
        pitcher: play && play.matchup && play.matchup.pitcher ? play.matchup.pitcher.fullName : null,
        playDescription: play && play.result ? play.result.description : null,
      });
    }
    var details = (play && play.reviewDetails) || [];
    for (var i = 0; i < details.length; i++) add(details[i]);
    var events = (play && play.playEvents) || [];
    for (var j = 0; j < events.length; j++) {
      var evDetails = events[j] && events[j].reviewDetails;
      if (Array.isArray(evDetails)) {
        for (var k = 0; k < evDetails.length; k++) add(evDetails[k]);
      }
    }
    return out;
  }

  function isPendingRulingPlay(play) {
    var et = play && play.result ? play.result.eventType : '';
    return !!PENDING_EVENT_TYPES[et];
  }

  /**
   * Extract every tracked entry from a full feed/live payload.
   * Returns { reviews, pending, underReview, counters } where:
   *  - reviews: normalized review objects (all types incl. ABS)
   *  - pending: official-scorer pending-ruling plays (os_ruling_pending_*)
   *  - underReview: { active, statusCode, description } from gameData.status
   *  - counters: official used/remaining counters, or null fields when absent
   */
  function extractReviewsFromFeed(feed) {
    var reviews = [];
    var pending = [];
    var plays = (feed && feed.liveData && feed.liveData.plays && feed.liveData.plays.allPlays) || [];
    for (var i = 0; i < plays.length; i++) {
      var play = plays[i];
      var rs = extractReviewsFromPlay(play, i);
      for (var j = 0; j < rs.length; j++) reviews.push(rs[j]);
      if (isPendingRulingPlay(play)) {
        pending.push({
          id: 'pending-' + (play.about ? play.about.atBatIndex : i),
          typeKey: 'pending',
          label: 'Official Scorer Ruling Pending',
          badgeClass: 'pending',
          atBatIndex: play.about ? play.about.atBatIndex : null,
          inning: play.about ? play.about.inning : null,
          halfInning: play.about ? play.about.halfInning : null,
          isTopInning: play.about ? play.about.isTopInning : null,
          batter: play.matchup && play.matchup.batter ? play.matchup.batter.fullName : null,
          pitcher: play.matchup && play.matchup.pitcher ? play.matchup.pitcher.fullName : null,
          playDescription: play.result ? play.result.description : null,
          eventType: play.result ? play.result.eventType : null,
        });
      }
    }

    var status = (feed && feed.gameData && feed.gameData.status) || null;
    var statusCode = status && status.abstractGameCode ? String(status.abstractGameCode) : '';
    var underReview = {
      active: isUnderReviewStatus(statusCode),
      statusCode: statusCode || null,
      description: status ? (status.detailedState || status.abstractGameState || null) : null,
    };

    return { reviews: reviews, pending: pending, underReview: underReview, counters: getReviewCounters(feed) };
  }

  /**
   * "Under review" live status from gameData.status codes (M, N, IH)
   * (README.md; registry GET /api/v1/gameStatus). Exact code meanings are
   * unverified from an official source in the sandbox — flagged F-03 — so
   * this matches the documented prefixes only and surfaces the raw code.
   */
  function isUnderReviewStatus(statusCode) {
    var c = String(statusCode || '').toUpperCase();
    if (!c) return false;
    if (c === 'IH') return true;
    if (c.charAt(0) === 'M' || c.charAt(0) === 'N') return true;
    return false;
  }

  /**
   * Official challenges-remaining counters, read verbatim from the payload.
   * Returns null for a side when the counter is absent (never zero-filled).
   */
  function getReviewCounters(feed) {
    var gd = (feed && feed.gameData) || {};
    var review = gd.review || null;
    var abs = gd.absChallenges || null;
    function side(obj, keys) {
      if (!obj || typeof obj !== 'object') return null;
      var out = {};
      var any = false;
      keys.forEach(function (k) {
        if (obj[k] !== undefined && obj[k] !== null) { out[k] = obj[k]; any = true; }
      });
      return any ? out : null;
    }
    return {
      manager: review ? {
        away: side(review.away, ['used', 'remaining']),
        home: side(review.home, ['used', 'remaining']),
      } : null,
      abs: abs ? {
        away: side(abs.away, ['usedSuccessful', 'usedFailed', 'remaining']),
        home: side(abs.home, ['usedSuccessful', 'usedFailed', 'remaining']),
      } : null,
    };
  }

  /**
   * Runs-at-risk: true only when the payload credits scoring to the very
   * event under review (README.md / reviews.html footer). Defensive field
   * checks; returns false when the shape is unrecognised (flagged F-03).
   */
  function runsAtRisk(play) {
    if (!play) return false;
    var hasReview = Array.isArray(play.reviewDetails) && play.reviewDetails.length > 0;
    if (!hasReview) {
      var events = play.playEvents || [];
      for (var i = 0; i < events.length; i++) {
        if (events[i] && Array.isArray(events[i].reviewDetails) && events[i].reviewDetails.length) {
          hasReview = true;
          break;
        }
      }
    }
    if (!hasReview) return false;
    var rbi = play.result ? play.result.rbi : null;
    if (typeof rbi === 'number' && rbi > 0) return true;
    var runners = play.runners || [];
    for (var j = 0; j < runners.length; j++) {
      var r = runners[j] || {};
      if (r.isScoring === true) return true;
      if (r.movement && r.movement.isScoring === true) return true;
    }
    return false;
  }

  /* ------------------------------------------------- scoring changes */
  /** Snapshot of a completed play's official classification for diffing. */
  function snapshotPlay(play) {
    if (!play || !play.result) return null;
    var errors = [];
    var runners = play.runners || [];
    for (var i = 0; i < runners.length; i++) {
      var r = runners[i] || {};
      var err = r.errors || r.error || null;
      if (err) errors.push(String(err));
    }
    return {
      eventType: play.result.eventType || null,
      isOut: play.result.isOut === undefined ? null : !!play.result.isOut,
      outs: play.count && play.count.outs !== undefined ? play.count.outs : null,
      rbi: play.result.rbi === undefined ? null : play.result.rbi,
      description: play.result.description || null,
      errors: errors,
    };
  }

  /**
   * Diff two snapshots. Returns null when nothing reclassified, else
   * { from, to, summary }. Payload edits without a reclassification
   * (description/RBI/score only) return null here; callers flag those as
   * irregularities separately (see docs/scoring-changes.md).
   */
  function detectScoringChange(prev, curr) {
    if (!prev || !curr) return null;
    var reclassified =
      prev.eventType !== curr.eventType ||
      prev.isOut !== curr.isOut ||
      prev.outs !== curr.outs ||
      JSON.stringify(prev.errors || []) !== JSON.stringify(curr.errors || []);
    if (!reclassified) return null;
    var from = [prev.eventType, prev.isOut ? 'out' : 'not out', 'outs=' + prev.outs].join(' / ');
    var to = [curr.eventType, curr.isOut ? 'out' : 'not out', 'outs=' + curr.outs].join(' / ');
    return { from: from, to: to, summary: from + '  →  ' + to };
  }

  /** True when only non-classification fields changed (irregularity signal). */
  function isPayloadOnlyEdit(prev, curr) {
    if (!prev || !curr) return false;
    if (detectScoringChange(prev, curr)) return false;
    return prev.description !== curr.description || prev.rbi !== curr.rbi;
  }

  /**
   * A used-counter moving backwards between polls is an irregularity
   * (README.md). Returns a note string or null.
   */
  function flagCounterRegression(prevUsed, currUsed, label) {
    if (typeof prevUsed !== 'number' || typeof currUsed !== 'number') return null;
    if (currUsed < prevUsed) {
      return (label || 'Used counter') + ' moved backwards (' + prevUsed + ' → ' + currUsed + ') — flagged for review, not corrected.';
    }
    return null;
  }

  /* ------------------------------------------- All-feed / alert gates */
  /**
   * This build includes ABS in the All feed and alerts (the intentional
   * difference vs upstream). Every tracked type returns true.
   */
  function visibleInAllFeed(review) {
    if (!review) return false;
    return ['challenge', 'review', 'boundary', 'abs', 'pending', 'scoring'].indexOf(review.typeKey) !== -1;
  }

  function shouldAlertForReview(review) {
    if (!review) return false;
    return ['challenge', 'review', 'boundary', 'abs', 'pending', 'scoring'].indexOf(review.typeKey) !== -1;
  }

  var Reviews = {
    PENDING_EVENT_TYPES: PENDING_EVENT_TYPES,
    classifyReview: classifyReview,
    extractReviewsFromPlay: extractReviewsFromPlay,
    extractReviewsFromFeed: extractReviewsFromFeed,
    isPendingRulingPlay: isPendingRulingPlay,
    isUnderReviewStatus: isUnderReviewStatus,
    getReviewCounters: getReviewCounters,
    runsAtRisk: runsAtRisk,
    snapshotPlay: snapshotPlay,
    detectScoringChange: detectScoringChange,
    isPayloadOnlyEdit: isPayloadOnlyEdit,
    flagCounterRegression: flagCounterRegression,
    visibleInAllFeed: visibleInAllFeed,
    shouldAlertForReview: shouldAlertForReview,
  };

  if (typeof window !== 'undefined') window.Reviews = Reviews;
  if (typeof module !== 'undefined' && module.exports) module.exports = Reviews;
})();
