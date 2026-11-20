/* ============================================================================
 * feed-log.js — per-date feed persistence (localStorage + optional server).
 *
 * Behaviour (reviews.html footer / README.md):
 *  - Every tracked entry is logged to this browser: one log per date,
 *    newest 7 dates kept, 500 most-recent rows. A refresh restores rows,
 *    scoring baselines and flagged irregularities before the first scan.
 *  - When served by `node server.mjs`, the same log syncs across browsers
 *    via GET/POST /api/feed-log and a Server-Sent Events tail
 *    (/api/feed-log/stream). On static GitHub Pages those endpoints do not
 *    exist, so every server call fails quietly and localStorage alone is
 *    used. Cross-device history is therefore not shared on Pages (README
 *    limitation 6).
 *
 * Server URLs are relative WITHOUT a leading slash ('api/feed-log?...') so
 * the project-site subpath (/POSTSSNALRT/) resolves them under the site
 * and they 404 cleanly on Pages instead of hitting the domain root.
 *
 * Rebuilt from the contracts in server.mjs + reviews.html (the original
 * file was missing from the upload; see COORDINATION.md T3).
 * ==========================================================================*/
(function () {
  'use strict';

  var LS_PREFIX = 'mlb-feed-log-';
  var LS_INDEX = 'mlb-feed-log-index';
  var MAX_DATES = 7;
  var MAX_ROWS = 500;

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
      settled: [],
    };
  }

  function isValidLog(obj, dateStr) {
    return !!obj && typeof obj === 'object' && obj.v === 1 &&
      (!dateStr || obj.date === dateStr) &&
      Array.isArray(obj.entries);
  }

  function lsGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function lsSet(key, value) {
    try { window.localStorage.setItem(key, value); return true; } catch (e) { return false; }
  }
  function lsDel(key) {
    try { window.localStorage.removeItem(key); } catch (e) { /* ignore */ }
  }

  function loadLocal(dateStr) {
    var raw = lsGet(LS_PREFIX + dateStr);
    if (!raw) return null;
    try {
      var parsed = JSON.parse(raw);
      if (!isValidLog(parsed, dateStr)) {
        console.warn('[feed-log] dropping malformed local log for ' + dateStr);
        lsDel(LS_PREFIX + dateStr);
        return null;
      }
      return parsed;
    } catch (e) {
      console.warn('[feed-log] dropping unparseable local log for ' + dateStr, e);
      lsDel(LS_PREFIX + dateStr);
      return null;
    }
  }

  function prune() {
    var raw = lsGet(LS_INDEX);
    var index = [];
    if (raw) {
      try { index = JSON.parse(raw) || []; } catch (e) { index = []; }
    }
    if (!Array.isArray(index)) index = [];
    // Keep newest MAX_DATES by date string (YYYY-MM-DD sorts chronologically).
    index.sort();
    while (index.length > MAX_DATES) {
      var oldest = index.shift();
      lsDel(LS_PREFIX + oldest);
    }
    lsSet(LS_INDEX, JSON.stringify(index));
  }

  function saveLocal(log) {
    if (!isValidLog(log)) return false;
    // Cap rows: keep the most recent MAX_ROWS by lastSeen (fallback: order).
    if (log.entries.length > MAX_ROWS) {
      var sorted = log.entries.slice().sort(function (a, b) {
        return (b.lastSeen || 0) - (a.lastSeen || 0);
      }).slice(0, MAX_ROWS);
      log.entries = sorted;
      var keep = {};
      sorted.forEach(function (e) {
        var k = e && e.gamePk + ':' + (e.review && (e.review.id || e.review.atBatIndex));
        if (k) keep[k] = true;
      });
      log.order = (log.order || []).filter(function (k) { return keep[k]; });
    }
    log.savedAt = Date.now();
    var ok = lsSet(LS_PREFIX + log.date, JSON.stringify(log));
    if (ok) {
      var raw = lsGet(LS_INDEX);
      var index = [];
      try { index = raw ? JSON.parse(raw) : []; } catch (e) { index = []; }
      if (Array.isArray(index) && index.indexOf(log.date) === -1) {
        index.push(log.date);
        lsSet(LS_INDEX, JSON.stringify(index));
      }
      prune();
    }
    return ok;
  }

  /* ------------------------------------------------------- server sync */
  function serverAvailable() {
    // Cheap probe is the GET itself; this flag only records the last result.
    return FeedLog._serverOk !== false;
  }

  function fetchServerLog(dateStr) {
    return fetch('api/feed-log?date=' + encodeURIComponent(dateStr), { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!isValidLog(data, dateStr)) throw new Error('malformed server log');
        FeedLog._serverOk = true;
        return data;
      })
      .catch(function () {
        FeedLog._serverOk = false;
        return null;
      });
  }

  function postServerLog(log) {
    return fetch('api/feed-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(log),
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      FeedLog._serverOk = true;
      return res.json();
    }).catch(function () {
      FeedLog._serverOk = false;
      return null;
    });
  }

  /**
   * Merge two logs idempotently (same key rule as server.mjs:
   * gamePk + ':' + (review.id || review.atBatIndex)). Newer lastSeen wins
   * per entry; snapshots/irregularities/grace union; settled union.
   */
  function mergeLogs(a, b) {
    if (!a) return b;
    if (!b) return a;
    var dateStr = a.date || b.date;
    var map = {};
    var order = [];
    function keyOf(e) {
      if (!e || !e.review) return null;
      return e.gamePk + ':' + (e.review.id || e.review.atBatIndex || '');
    }
    (a.entries || []).forEach(function (e) {
      var k = keyOf(e);
      if (k && !map[k]) { map[k] = e; order.push(k); }
    });
    (b.entries || []).forEach(function (e) {
      var k = keyOf(e);
      if (!k) return;
      if (!map[k]) { map[k] = e; order.push(k); return; }
      var prev = map[k];
      map[k] = {
        gamePk: e.gamePk || prev.gamePk,
        review: Object.assign({}, prev.review, e.review),
        firstSeen: Math.min(prev.firstSeen || e.firstSeen || Date.now(), e.firstSeen || prev.firstSeen || Date.now()),
        lastSeen: Math.max(prev.lastSeen || 0, e.lastSeen || 0),
        matchupLabel: e.matchupLabel || prev.matchupLabel || null,
      };
      if (prev.review && prev.review.history &&
          (!e.review.history || e.review.history.length < prev.review.history.length)) {
        map[k].review.history = prev.review.history;
      }
    });
    function mergeObj(x, y) {
      var out = {};
      Object.keys(x || {}).forEach(function (k) { out[k] = x[k]; });
      Object.keys(y || {}).forEach(function (k) {
        if (Array.isArray(out[k]) && Array.isArray(y[k])) {
          var seen = {};
          out[k] = out[k].concat(y[k]).filter(function (v) {
            var s = String(v);
            if (seen[s]) return false;
            seen[s] = true;
            return true;
          });
        } else {
          out[k] = y[k];
        }
      });
      return out;
    }
    var settled = {};
    (a.settled || []).concat(b.settled || []).forEach(function (s) { settled[String(s)] = true; });
    return {
      v: 1,
      date: dateStr,
      savedAt: Math.max(a.savedAt || 0, b.savedAt || 0),
      entries: order.map(function (k) { return map[k]; }).filter(Boolean),
      order: order,
      snapshots: mergeObj(a.snapshots, b.snapshots),
      irregularities: mergeObj(a.irregularities, b.irregularities),
      grace: mergeObj(a.grace, b.grace),
      settled: Object.keys(settled),
    };
  }

  var FeedLog = {
    MAX_DATES: MAX_DATES,
    MAX_ROWS: MAX_ROWS,
    _serverOk: null,
    emptyLog: emptyLog,
    loadLocal: loadLocal,
    saveLocal: saveLocal,
    mergeLogs: mergeLogs,
    serverAvailable: serverAvailable,

    /** Load local + server (when present), merge, persist, return merged. */
    load: function (dateStr) {
      var local = loadLocal(dateStr) || emptyLog(dateStr);
      return fetchServerLog(dateStr).then(function (server) {
        var merged = server ? mergeLogs(local, server) : local;
        saveLocal(merged);
        return merged;
      });
    },

    /** Persist locally and (when a server is present) POST to it. */
    save: function (log) {
      saveLocal(log);
      if (FeedLog._serverOk === false) return Promise.resolve(null);
      return postServerLog(log);
    },

    /**
     * Subscribe to the server SSE tail for a date. Calls onLog(mergedLog)
     * for every pushed frame. Returns an unsubscribe function. On static
     * hosting the EventSource errors immediately; the returned function is
     * still safe to call and polling remains the fallback (server.mjs
     * comment: client keeps its ordinary poll when no stream exists).
     */
    subscribe: function (dateStr, onLog) {
      if (typeof EventSource === 'undefined') return function () {};
      var es;
      try {
        es = new EventSource('api/feed-log/stream?date=' + encodeURIComponent(dateStr));
      } catch (e) {
        return function () {};
      }
      es.addEventListener('feed-log', function (ev) {
        try {
          var data = JSON.parse(ev.data);
          if (isValidLog(data, dateStr)) onLog(data);
        } catch (e) { /* ignore malformed frame */ }
      });
      es.onerror = function () { /* polling fallback continues */ };
      return function () {
        try { es.close(); } catch (e) { /* ignore */ }
      };
    },
  };

  if (typeof window !== 'undefined') window.FeedLog = FeedLog;
  if (typeof module !== 'undefined' && module.exports) module.exports = FeedLog;
})();
