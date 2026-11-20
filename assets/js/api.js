/* ============================================================================
 * api.js — MLB StatsAPI client.
 *
 * Data host: https://statsapi.mlb.com (the public JSON backend behind
 * MLB.com Gameday; no key required). Every endpoint below is a GET on that
 * host. The browser calls it cross-origin directly — no proxy, no server
 * needed — so the site works identically on GitHub Pages and under
 * `node server.mjs`.
 *
 * Rebuilt from the contracts in index.html / game.html / reviews.html and
 * README.md (the original file was missing from the upload; see
 * COORDINATION.md T2 and flagged-for-review.html F-01/F-02). Endpoint shapes
 * are documented in docs/api-compliance.md. statsapi.mlb.com is unreachable
 * from the build sandbox, so live responses could not be re-verified there;
 * the client fails loudly (throws) on any non-2xx or non-JSON response
 * instead of guessing.
 * ==========================================================================*/
(function () {
  'use strict';

  var BASE = 'https://statsapi.mlb.com';
  var TIMEOUT_MS = 20000;
  var teamMapPromise = null;

  function fetchJSON(url, options) {
    options = options || {};
    var controller = null;
    var timer = null;
    var fetchOpts = {
      method: options.method || 'GET',
      headers: { Accept: 'application/json' },
      cache: options.cache || 'no-store',
    };
    if (typeof AbortController !== 'undefined') {
      controller = new AbortController();
      fetchOpts.signal = controller.signal;
      timer = setTimeout(function () { controller.abort(); }, options.timeoutMs || TIMEOUT_MS);
    }
    return fetch(url, fetchOpts).then(function (res) {
      if (timer) clearTimeout(timer);
      if (!res.ok) {
        throw new Error('StatsAPI HTTP ' + res.status + ' for ' + url);
      }
      var ct = res.headers.get('content-type') || '';
      if (ct.indexOf('application/json') === -1 && ct.indexOf('text/json') === -1) {
        // Some error pages return 200 with HTML; refuse to parse as data.
        throw new Error('StatsAPI returned non-JSON (' + ct + ') for ' + url);
      }
      return res.json();
    }, function (err) {
      if (timer) clearTimeout(timer);
      if (err && err.name === 'AbortError') {
        throw new Error('StatsAPI request timed out: ' + url);
      }
      throw err;
    });
  }

  function qs(params) {
    var parts = [];
    Object.keys(params || {}).forEach(function (k) {
      var v = params[k];
      if (v === undefined || v === null || v === '') return;
      parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(v)));
    });
    return parts.length ? '?' + parts.join('&') : '';
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /** YYYY-MM-DD plus a whole number of days (UTC-safe: dates are plain days). */
  function shiftDate(dateStr, days) {
    var p = String(dateStr).split('-').map(Number);
    var d = new Date(Date.UTC(p[0], (p[1] || 1) - 1, p[2] || 1));
    d.setUTCDate(d.getUTCDate() + days);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }

  var Api = {
    BASE: BASE,

    /** GET /api/v1/schedule?sportId=1&date=YYYY-MM-DD — games for one date. */
    getSchedule: function (dateStr, extra) {
      var params = { sportId: 1, date: dateStr };
      if (extra) Object.keys(extra).forEach(function (k) { params[k] = extra[k]; });
      return fetchJSON(BASE + '/api/v1/schedule' + qs(params));
    },

    /** GET /api/v1/schedule with a date range (startDate/endDate). */
    getScheduleRange: function (startDate, endDate, extra) {
      var params = { sportId: 1, startDate: startDate, endDate: endDate };
      if (extra) Object.keys(extra).forEach(function (k) { params[k] = extra[k]; });
      return fetchJSON(BASE + '/api/v1/schedule' + qs(params));
    },

    /** GET /api/v1.1/game/{gamePk}/feed/live — full live feed for one game. */
    getFeed: function (gamePk) {
      return fetchJSON(BASE + '/api/v1.1/game/' + encodeURIComponent(gamePk) + '/feed/live');
    },

    /** GET /api/v1/game/{gamePk}/boxscore */
    getBoxscore: function (gamePk) {
      return fetchJSON(BASE + '/api/v1/game/' + encodeURIComponent(gamePk) + '/boxscore');
    },

    /** GET /api/v1/game/{gamePk}/linescore */
    getLinescore: function (gamePk) {
      return fetchJSON(BASE + '/api/v1/game/' + encodeURIComponent(gamePk) + '/linescore');
    },

    /** GET /api/v1/teams?sportId=1 */
    getTeams: function (sportId) {
      return fetchJSON(BASE + '/api/v1/teams' + qs({ sportId: sportId || 1 }));
    },

    /**
     * Official team metadata keyed by team id (memoized for the page).
     *
     * Why: GET /api/v1/schedule returns team objects with only id/name/link —
     * verified 2026-11-20 against
     * https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-06-01
     * (abbreviation present in the requested fields list and still absent).
     * GET /api/v1/teams?sportId=1 does carry `abbreviation`
     * (https://statsapi.mlb.com/api/v1/teams?sportId=1), so the scoreboard
     * reads the official abbreviation from there instead of inventing one.
     */
    getTeamMap: function () {
      if (!teamMapPromise) {
        teamMapPromise = Api.getTeams(1).then(function (data) {
          var map = {};
          ((data && data.teams) || []).forEach(function (t) {
            if (t && t.id !== undefined && t.id !== null) map[t.id] = t;
          });
          return map;
        }, function (err) {
          teamMapPromise = null; // allow a retry on the next page load
          throw err;
        });
      }
      return teamMapPromise;
    },

    /**
     * Most recent date on or before `endDate` that has at least one game,
     * from the official schedule. Used only when the requested day is empty
     * (MLB has no games on many days — e.g. the whole 2026-11 offseason), so
     * the site shows the last real slate instead of an empty page. Returns
     * null when no game is found inside the widest window.
     *
     * Windows are widened progressively (14/45/200/400 days) so the common
     * off-day costs one small request.
     */
    getLatestSlateDate: function (endDate) {
      var windows = [14, 45, 200, 400];
      function attempt(i) {
        if (i >= windows.length) return Promise.resolve(null);
        var start = shiftDate(endDate, -windows[i]);
        return Api.getScheduleRange(start, endDate).then(function (data) {
          var best = null;
          ((data && data.dates) || []).forEach(function (day) {
            if (!day || !day.date || !Array.isArray(day.games) || !day.games.length) return;
            if (day.date > endDate) return;
            if (!best || day.date > best) best = day.date;
          });
          if (best) return best;
          return attempt(i + 1);
        });
      }
      return attempt(0);
    },

    /** GET /api/v1/people/{personId} */
    getPerson: function (personId) {
      return fetchJSON(BASE + '/api/v1/people/' + encodeURIComponent(personId));
    },

    /** GET /api/v1/people/{personId}/stats?stats=...&season=...&group=... */
    getPersonStats: function (personId, stats, season, group) {
      return fetchJSON(BASE + '/api/v1/people/' + encodeURIComponent(personId) + '/stats' +
        qs({ stats: stats, season: season, group: group }));
    },

    /** GET /api/v1/gameStatus — official game-status registry (review codes). */
    getGameStatus: function () {
      return fetchJSON(BASE + '/api/v1/gameStatus');
    },

    /** GET /api/v1/eventTypes — official event-type registry (os_ruling_*). */
    getEventTypes: function () {
      return fetchJSON(BASE + '/api/v1/eventTypes');
    },

    /** Exposed for tests / diagnostics. */
    _fetchJSON: fetchJSON,
    _qs: qs,
    _shiftDate: shiftDate,
  };

  if (typeof window !== 'undefined') window.Api = Api;
  if (typeof module !== 'undefined' && module.exports) module.exports = Api;
})();
