/* ============================================================================
 * ui.js — shared UI helpers (DOM, dates, team assets, status line, banner).
 *
 * Rebuilt from the DOM contracts in index.html / game.html / reviews.html
 * (the original file was missing from the upload; see COORDINATION.md T2).
 * No data fetching lives here — see api.js. Everything that renders API text
 * goes through esc() so payload strings can never inject markup.
 * ==========================================================================*/
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  function $$(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function esc(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ------------------------------------------------------------ dates */
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /** Local YYYY-MM-DD for a Date (matches the StatsAPI `date` parameter). */
  function toDateStr(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function todayStr() { return toDateStr(new Date()); }

  function addDays(dateStr, days) {
    var parts = String(dateStr).split('-').map(Number);
    var d = new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
    d.setDate(d.getDate() + days);
    return toDateStr(d);
  }

  function isValidDateStr(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }

  function fmtDateLabel(dateStr) {
    var parts = String(dateStr).split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return String(dateStr || '');
    var d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }

  /* ------------------------------------------------------------ teams */
  /** Official team logo host (lazy-loaded; dns-prefetched in the HTML head). */
  function teamLogo(teamId) {
    if (!teamId) return '';
    return 'https://www.mlbstatic.com/team-logos/' + teamId + '.svg';
  }

  function teamAbbr(team) {
    if (!team) return '—';
    return team.abbreviation || team.name || '—';
  }

  function teamName(team) {
    if (!team) return '—';
    return team.name || team.abbreviation || '—';
  }

  /* ------------------------------------------------------------ status */
  function setStatus(msg, isErr) {
    var el = $('status-line');
    if (!el) return;
    el.textContent = msg || '';
    el.className = 'status-line' + (isErr ? ' err' : '');
  }

  function showBanner(msg, isErr) {
    var el = $('banner');
    if (!el) return;
    if (!msg) {
      el.textContent = '';
      el.className = 'banner';
      return;
    }
    el.textContent = msg;
    el.className = 'banner show' + (isErr ? ' err' : '');
  }

  function setDateNav(dateStr) {
    var picker = $('date-picker');
    if (picker && isValidDateStr(dateStr)) picker.value = dateStr;
    var label = $('date-label');
    if (label) label.textContent = fmtDateLabel(dateStr);
  }

  /* ------------------------------------------------------------ misc */
  function gameUrl(gamePk) { return 'game.html?gamePk=' + encodeURIComponent(gamePk); }

  function isLiveGame(game) {
    var s = game && game.status && game.status.detailedState;
    return s === 'Live' || s === 'In Progress' || s === 'Warmup' || s === 'Pre-Game';
  }

  function isFinalGame(game) {
    var s = game && game.status && game.status.detailedState;
    return s === 'Final' || s === 'Completed';
  }

  // Leave absent values blank. Indicate unverified cells in the source column.
  function sourcedRow(feed, values) {
    var missing = values.some(v => v == null || v === '');
    var link = '<a href="https://statsapi.mlb.com/api/v1.1/game/' + encodeURIComponent(feed.gamePk) + '/feed/live">MLB feed</a>';
    return '<tr>' + values.map(v => '<td>' + esc(v) + '</td>').join('') + '<td>' + link +
      (missing ? ' · unverified blank' : '') + '</td></tr>';
  }

  var UI = {
    sourcedRow: sourcedRow,
    $: $, $$: $$, esc: esc,
    toDateStr: toDateStr, todayStr: todayStr, addDays: addDays,
    isValidDateStr: isValidDateStr, fmtDateLabel: fmtDateLabel,
    teamLogo: teamLogo, teamAbbr: teamAbbr, teamName: teamName,
    setStatus: setStatus, showBanner: showBanner, setDateNav: setDateNav,
    gameUrl: gameUrl, isLiveGame: isLiveGame, isFinalGame: isFinalGame,
  };

  if (typeof window !== 'undefined') window.UI = UI;
  if (typeof module !== 'undefined' && module.exports) module.exports = UI;
})();
