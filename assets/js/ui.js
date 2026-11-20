/* ============================================================================
 * ui.js — shared UI helpers (dates, escaping, status line, countdown).
 * Loaded after api.js on every page. Exposes window.UI.
 * ==========================================================================*/
(function () {
  'use strict';

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function toDateStr(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function todayStr() { return toDateStr(new Date()); }

  /** Add `days` (may be negative) to a YYYY-MM-DD string; returns YYYY-MM-DD. */
  function addDays(dateStr, days) {
    var parts = String(dateStr).split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return dateStr;
    var d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() + days);
    return toDateStr(d);
  }

  /** "2026-09-29" -> "Tue, Sep 29, 2026" (local, no timezone surprises). */
  function fmtDate(dateStr) {
    var parts = String(dateStr).split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return String(dateStr);
    var d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
    });
  }

  /** ISO timestamp -> local time string, or '' when unparseable. */
  function fmtTime(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  /** Escape text for safe insertion into HTML. */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function el(id) { return document.getElementById(id); }

  function setStatus(id, msg, isErr) {
    var node = typeof id === 'string' ? el(id) : id;
    if (!node) return;
    node.textContent = msg || '';
    node.classList.toggle('err', !!isErr);
  }

  function setBanner(id, msg, isErr) {
    var node = typeof id === 'string' ? el(id) : id;
    if (!node) return;
    node.textContent = '';
    if (!msg) return;
    var div = document.createElement('div');
    div.className = 'banner-msg' + (isErr ? ' err' : '');
    div.textContent = msg;
    node.appendChild(div);
  }

  /** Team abbreviation badge (text only — no external image dependency). */
  function teamBadge(abbrev) {
    return '<span class="team-badge">' + esc(abbrev || '—') + '</span>';
  }

  /**
   * Countdown ticker: calls `onTick(secondsLeft)` every second until it
   * reaches 0, then calls `onDone()`. Returns a stop function.
   */
  function startCountdown(seconds, onTick, onDone) {
    var left = Math.max(0, Math.floor(seconds));
    var stopped = false;
    function tick() {
      if (stopped) return;
      if (onTick) onTick(left);
      if (left <= 0) {
        stopped = true;
        if (onDone) onDone();
        return;
      }
      left -= 1;
      setTimeout(tick, 1000);
    }
    tick();
    return function () { stopped = true; };
  }

  /** Shared date-nav wiring for a page with #date-picker + #date-label. */
  function initDateNav(owner, onChange) {
    var picker = el('date-picker');
    var label = el('date-label');
    function sync() {
      if (picker) picker.value = owner.date;
      if (label) label.textContent = fmtDate(owner.date);
    }
    owner._syncDateNav = sync;
    sync();
    return sync;
  }

  var UI = {
    pad: pad,
    todayStr: todayStr,
    addDays: addDays,
    fmtDate: fmtDate,
    fmtTime: fmtTime,
    esc: esc,
    el: el,
    setStatus: setStatus,
    setBanner: setBanner,
    teamBadge: teamBadge,
    startCountdown: startCountdown,
    initDateNav: initDateNav
  };

  if (typeof window !== 'undefined') window.UI = UI;
  if (typeof module !== 'undefined' && module.exports) module.exports = UI;
})();
