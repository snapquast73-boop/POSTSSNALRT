/* ============================================================================
 * api.js — MLB StatsAPI client (official data host: https://statsapi.mlb.com).
 *
 * Endpoints used (all documented under https://statsapi.mlb.com/api/v1/):
 *   GET /api/v1/schedule?sportId=1&date=YYYY-MM-DD
 *   GET /api/v1/game/{gamePk}/feed/live
 *   GET /api/v1/game/{gamePk}/boxscore
 *   GET /api/v1/game/{gamePk}/linescore
 *   GET /api/v1/eventTypes          (official event-type registry)
 *   GET /api/v1/gameStatus          (official game-status registry)
 *   GET /api/v1/teams?sportId=1
 *
 * Every function returns the parsed JSON and throws an Error on a non-2xx
 * response or a network failure. Callers decide how to surface failures;
 * nothing here fabricates data.
 * ==========================================================================*/
(function () {
  'use strict';

  var BASE = 'https://statsapi.mlb.com';

  function getJSON(path) {
    return fetch(BASE + path, { headers: { Accept: 'application/json' } })
      .then(function (res) {
        if (!res.ok) {
          throw new Error('StatsAPI ' + res.status + ' for ' + path);
        }
        return res.json();
      });
  }

  /* Registries change rarely; cache them for the session so a poll cycle
   * does not re-fetch them every 15 s. A failed fetch is NOT cached. */
  var registryCache = {};

  function getRegistry(name, path) {
    if (registryCache[name]) return Promise.resolve(registryCache[name]);
    return getJSON(path).then(function (data) {
      registryCache[name] = data;
      return data;
    });
  }

  var MlbApi = {
    BASE: BASE,

    getSchedule: function (dateStr) {
      return getJSON('/api/v1/schedule?sportId=1&date=' + encodeURIComponent(dateStr));
    },

    getFeedLive: function (gamePk) {
      return getJSON('/api/v1/game/' + encodeURIComponent(gamePk) + '/feed/live');
    },

    getBoxscore: function (gamePk) {
      return getJSON('/api/v1/game/' + encodeURIComponent(gamePk) + '/boxscore');
    },

    getLinescore: function (gamePk) {
      return getJSON('/api/v1/game/' + encodeURIComponent(gamePk) + '/linescore');
    },

    getEventTypes: function () {
      return getRegistry('eventTypes', '/api/v1/eventTypes');
    },

    getGameStatus: function () {
      return getRegistry('gameStatus', '/api/v1/gameStatus');
    },

    getTeams: function () {
      return getRegistry('teams', '/api/v1/teams?sportId=1');
    },

    /** Test hook: drop cached registries (used by the test suite). */
    _clearCache: function () {
      registryCache = {};
    }
  };

  if (typeof window !== 'undefined') window.MlbApi = MlbApi;
  if (typeof module !== 'undefined' && module.exports) module.exports = MlbApi;
})();
