/* ============================================================================
 * feed-log.js — feed persistence: per-browser localStorage + optional
 * multi-browser sync via server.mjs.
 *
 * Log shape (must match server.mjs mergeFeedLogPayloads):
 *   { v: 1, date: 'YYYY-MM-DD', savedAt: <ms>,
 *     entries: [{ gamePk, review, firstSeen, lastSeen, matchupLabel }],
 *     order: [keys], snapshots: { gamePk: { atBatIndex: snapshot } },
 *     irregularities: {}, grace: {}, settled: [] }
 *
 * Local policy (per spec): one log per date, newest 7 dates kept, 500 most
 * recent rows. On static hosting (GitHub Pages) only localStorage exists;
 * under server.mjs the log also syncs via GET/POST /api/feed-log and the
 * SSE tail /api/feed-log/stream (with a 15 s poll fallback).
 * ==========================================================================*/
(function () {
  'use strict';

  var KEY_PREFIX = 'mlb-feed-log-';
  var MAX_DATES = 7;
  var MAX_ROWS = 500;
  var POLL_MS = 15000;

  function keyFor(dateStr) { return KEY_PREFIX + dateStr; }

  function emptyLog(dateStr) {
    return {
      v: 1,
      date: dateStr,
      savedAt: Date.now(),
      entries: [],
      order: [],
      snapshots: {},
      irregularities: {},
      grace: {},
      settled: []
    };
  }

  function isValidLog(log, dateStr) {
    return !!log && typeof log === 'object' && log.v === 1 &&
      (!dateStr || log.date === dateStr) &&
      Array.isArray(log.entries) && Array.isArray(log.order) &&
      log.snapshots && typeof log.snapshots === 'object';
  }

  function entryKey(entry) {
    if (!entry || !entry.review) return null;
    return String(entry.gamePk) + ':' + (entry.review.id || entry.review.atBatIndex || '');
  }

  /**
   * Idempotent merge (mirrors server.mjs): entries by key, newest data wins,
   * longest scoring history preserved, snapshots/irregularities/grace unioned,
   * settled unioned. Malformed input is dropped with a console warning.
   */
  function mergeLogs(existing, incoming) {
    if (!isValidLog(incoming)) {
      if (incoming != null) console.warn('[feed-log] dropping malformed log payload');
      return existing;
    }
    if (!isValidLog(existing)) return incoming;

    var now = Date.now();
    var entryMap = new Map();
    var orderList = [];

    function addEntries(list) {
      (Array.isArray(list) ? list : []).forEach(function (e) {
        var k = entryKey(e);
        if (!k) return;
        var prev = entryMap.get(k);
        if (!prev) {
          entryMap.set(k, e);
          if (orderList.indexOf(k) === -1) orderList.push(k);
        } else {
          var merged = {
            gamePk: e.gamePk || prev.gamePk,
            review: Object.assign({}, prev.review, e.review),
            firstSeen: Math.min(prev.firstSeen || e.firstSeen || now, e.firstSeen || prev.firstSeen || now),
            lastSeen: Math.max(prev.lastSeen || 0, e.lastSeen || 0, now),
            matchupLabel: e.matchupLabel || prev.matchupLabel || null
          };
          if (prev.review && prev.review.history &&
              (!e.review.history || e.review.history.length < prev.review.history.length)) {
            merged.review.history = prev.review.history;
          }
          entryMap.set(k, merged);
        }
      });
    }
    addEntries(existing.entries);
    addEntries(incoming.entries);

    var merged = emptyLog(incoming.date || existing.date);
    merged.savedAt = now;
    merged.entries = orderList.map(function (k) { return entryMap.get(k); }).filter(Boolean);
    merged.order = orderList;
    merged.snapshots = Object.assign({}, existing.snapshots, incoming.snapshots);
    merged.irregularities = Object.assign({}, existing.irregularities, incoming.irregularities);
    merged.grace = Object.assign({}, existing.grace, incoming.grace);
    var settled = new Set([].concat(existing.settled || [], incoming.settled || []));
    merged.settled = Array.from(settled);

    if (merged.entries.length > MAX_ROWS) {
      merged.entries = merged.entries.slice(merged.entries.length - MAX_ROWS);
      merged.order = merged.order.slice(merged.order.length - MAX_ROWS);
    }
    return merged;
  }

  function loadLocal(dateStr) {
    try {
      var raw = window.localStorage.getItem(keyFor(dateStr));
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!isValidLog(parsed, dateStr)) {
        console.warn('[feed-log] dropping malformed local log for ' + dateStr);
        return null;
      }
      return parsed;
    } catch (err) {
      console.warn('[feed-log] local read failed for ' + dateStr, err);
      return null;
    }
  }

  function saveLocal(log) {
    if (!isValidLog(log)) return false;
    try {
      window.localStorage.setItem(keyFor(log.date), JSON.stringify(log));
      pruneOldDates();
      return true;
    } catch (err) {
      console.warn('[feed-log] local write failed', err);
      return false;
    }
  }

  /** Keep only the newest MAX_DATES logs in localStorage. */
  function pruneOldDates() {
    try {
      var keys = [];
      for (var i = 0; i < window.localStorage.length; i++) {
        var k = window.localStorage.key(i);
        if (k && k.indexOf(KEY_PREFIX) === 0) keys.push(k);
      }
      keys.sort();
      while (keys.length > MAX_DATES) {
        window.localStorage.removeItem(keys.shift());
      }
    } catch (err) { /* storage unavailable — nothing to prune */ }
  }

  /* ------------------------------------------------------------ server sync
   * Relative paths ('api/...') so the same code works under server.mjs and
   * degrades silently on static hosting where the endpoints 404.
   */
  function fetchServerLog(dateStr) {
    return fetch('api/feed-log?date=' + encodeURIComponent(dateStr), { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      });
  }

  function postServerLog(log) {
    return fetch('api/feed-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(log)
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    });
  }

  /**
   * Subscribe to the SSE tail for a date. Calls onLog(mergedLog) whenever
   * another client posts. Falls back to polling every POLL_MS when the
   * stream cannot be established. Returns an unsubscribe function.
   */
  function subscribe(dateStr, onLog) {
    var stopped = false;
    var pollTimer = null;
    var source = null;

    function poll() {
      if (stopped) return;
      fetchServerLog(dateStr)
        .then(function (log) { if (!stopped && isValidLog(log)) onLog(log); })
        .catch(function () { /* static hosting — stay silent */ });
    }

    function startPolling() {
      if (pollTimer || stopped) return;
      poll();
      pollTimer = setInterval(poll, POLL_MS);
    }

    try {
      source = new EventSource('api/feed-log/stream?date=' + encodeURIComponent(dateStr));
      source.addEventListener('feed-log', function (ev) {
        try {
          var log = JSON.parse(ev.data);
          if (isValidLog(log)) onLog(log);
        } catch (err) { /* ignore malformed frames */ }
      });
      source.onerror = function () {
        /* EventSource retries on its own; if it never connects (static
         * hosting) the poll fallback covers us. */
        startPolling();
      };
    } catch (err) {
      startPolling();
    }

    return function unsubscribe() {
      stopped = true;
      if (pollTimer) clearInterval(pollTimer);
      if (source) source.close();
    };
  }

  var FeedLog = {
    MAX_DATES: MAX_DATES,
    MAX_ROWS: MAX_ROWS,
    POLL_MS: POLL_MS,
    emptyLog: emptyLog,
    isValidLog: isValidLog,
    mergeLogs: mergeLogs,
    loadLocal: loadLocal,
    saveLocal: saveLocal,
    fetchServerLog: fetchServerLog,
    postServerLog: postServerLog,
    subscribe: subscribe
  };

  if (typeof window !== 'undefined') window.FeedLog = FeedLog;
  if (typeof module !== 'undefined' && module.exports) module.exports = FeedLog;
})();
