/* ============================================================================
 * scoreboard.js — index.html (Scoreboard) page logic.
 *
 * Exposes window.Scoreboard with prevDay/nextDay/pickDate/today (called from
 * the inline handlers in index.html) and self-initialises on DOMContentLoaded.
 * Polls GET /api/v1/schedule?sportId=1&date=... via Api.getSchedule and
 * renders one card per game linking to game.html?gamePk=....
 *
 * Rebuilt from the DOM contract in index.html (the original file was missing
 * from the upload; see COORDINATION.md T4).
 * ==========================================================================*/
(function () {
  'use strict';

  var POLL_MS = 30000;
  var state = { date: null, filter: 'all', games: [], timer: null, feedLog: null };

  function currentDate() { return state.date || UI.todayStr(); }

  function setFilter(f) {
    state.filter = f;
    renderTabs();
    renderGames();
  }

  function renderTabs() {
    var host = UI.$('tabs');
    if (!host) return;
    var tabs = [
      { key: 'all', label: 'All Games' },
      { key: 'live', label: 'Live' },
      { key: 'final', label: 'Final' },
    ];
    host.innerHTML = '';
    tabs.forEach(function (t) {
      var b = document.createElement('button');
      b.className = 'tab-btn' + (state.filter === t.key ? ' tab-on' : '');
      b.textContent = t.label;
      b.addEventListener('click', function () { setFilter(t.key); });
      host.appendChild(b);
    });
  }

  function filteredGames() {
    return state.games.filter(function (g) {
      if (state.filter === 'live') return UI.isLiveGame(g);
      if (state.filter === 'final') return UI.isFinalGame(g);
      return true;
    });
  }

  function feedCountsByGame() {
    var counts = {};
    var log = state.feedLog;
    if (!log || !Array.isArray(log.entries)) return counts;
    log.entries.forEach(function (e) {
      if (!e || !e.gamePk) return;
      counts[e.gamePk] = (counts[e.gamePk] || 0) + 1;
    });
    return counts;
  }

  function renderGames() {
    var host = UI.$('game-list');
    if (!host) return;
    var games = filteredGames();
    var counts = feedCountsByGame();
    host.innerHTML = '';
    if (!games.length) {
      var empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = state.games.length
        ? 'No games match this filter for ' + UI.fmtDateLabel(currentDate()) + '.'
        : 'No games scheduled for ' + UI.fmtDateLabel(currentDate()) + '.';
      host.appendChild(empty);
      return;
    }
    games.forEach(function (game) {
      var card = document.createElement('a');
      card.className = 'game-card';
      card.href = UI.gameUrl(game.gamePk);

      var status = (game.status && game.status.detailedState) || '';
      var isLive = UI.isLiveGame(game);
      var isFinal = UI.isFinalGame(game);
      var head = document.createElement('div');
      head.className = 'game-card-head';
      var st = document.createElement('span');
      st.className = 'game-status' + (isLive ? ' live' : isFinal ? ' final' : '');
      st.textContent = status;
      var meta = document.createElement('span');
      meta.className = 'game-meta';
      meta.textContent = (game.gameDate || '').slice(11, 16) + ' UTC';
      head.appendChild(st);
      head.appendChild(meta);
      card.appendChild(head);

      ['away', 'home'].forEach(function (side) {
        var team = game.teams ? game.teams[side] : null;
        var row = document.createElement('div');
        row.className = 'team-row';
        var score = team && team.score !== undefined ? team.score : null;
        var opp = game.teams ? game.teams[side === 'away' ? 'home' : 'away'] : null;
        var oppScore = opp && opp.score !== undefined ? opp.score : null;
        if (isFinal && score !== null && oppScore !== null && score < oppScore) row.classList.add('loser');
        var img = document.createElement('img');
        img.className = 'team-logo';
        img.alt = '';
        img.loading = 'lazy';
        if (team?.team?.id) img.src = UI.teamLogo(team.team.id);
        var abbr = document.createElement('span');
        abbr.className = 'team-abbr';
        abbr.textContent = team?.team?.abbreviation || '';
        var name = document.createElement('span');
        name.className = 'team-name';
        name.textContent = team?.team?.name || '';
        var sc = document.createElement('span');
        sc.className = 'team-score';
        sc.textContent = score === null ? '–' : String(score);
        row.appendChild(img);
        row.appendChild(abbr);
        row.appendChild(name);
        row.appendChild(sc);
        card.appendChild(row);
      });

      var n = counts[game.gamePk] || 0;
      if (n > 0) {
        var foot = document.createElement('div');
        foot.className = 'game-card-foot';
        var chip = document.createElement('span');
        chip.className = 'chip warn';
        chip.textContent = '🚨 ' + n + ' tracked event' + (n === 1 ? '' : 's');
        foot.appendChild(chip);
        card.appendChild(foot);
      }
      host.appendChild(card);
    });
  }

  function load() {
    var date = currentDate();
    UI.setDateNav(date);
    UI.setStatus('Loading schedule for ' + UI.fmtDateLabel(date) + '…');
    UI.showBanner('');
    var scheduleP = Api.getSchedule(date).then(function (data) {
      state.games = (data && data.dates && data.dates[0] && data.dates[0].games) || [];
      UI.setStatus(state.games.length
        ? state.games.length + ' game' + (state.games.length === 1 ? '' : 's') + ' · updated ' + new Date().toLocaleTimeString()
        : 'No games for ' + UI.fmtDateLabel(date) + '.');
    }, function (err) {
      state.games = [];
      UI.setStatus('Could not load the schedule: ' + err.message, true);
      UI.showBanner('Schedule unavailable — the MLB StatsAPI did not respond. Check your connection and try again.', true);
    });
    var logP = (window.FeedLog ? FeedLog.load(date).then(function (log) {
      state.feedLog = log;
    }) : Promise.resolve());
    return Promise.all([scheduleP, logP]).then(function () {
      renderTabs();
      renderGames();
    });
  }

  function restart() {
    if (state.timer) clearInterval(state.timer);
    state.timer = setInterval(load, POLL_MS);
    load();
  }

  var Scoreboard = {
    prevDay: function () { state.date = UI.addDays(currentDate(), -1); restart(); },
    nextDay: function () { state.date = UI.addDays(currentDate(), 1); restart(); },
    pickDate: function () {
      var picker = UI.$('date-picker');
      if (picker && UI.isValidDateStr(picker.value)) state.date = picker.value;
      restart();
    },
    today: function () { state.date = UI.todayStr(); restart(); },
    _state: state,
  };

  if (typeof window !== 'undefined') window.Scoreboard = Scoreboard;
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function () {
      state.date = UI.todayStr();
      restart();
    });
  }
})();
