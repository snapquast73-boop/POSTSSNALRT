/* ============================================================================
 * game.js — game.html (Game) page logic.
 *
 * Reads ?gamePk= from the URL, polls GET /api/v1.1/game/{gamePk}/feed/live
 * every 15s, and renders: header (teams/score/status/decisions), live panel
 * (current matchup), linescore, Play-by-Play, Box Score, Props & Matchup
 * (props.js) and Challenges & Reviews (reviews.js). Tab buttons switch
 * panels; the reviews badge counts tracked reviews for the game.
 *
 * Rebuilt from the DOM contract in game.html (the original file was missing
 * from the upload; see COORDINATION.md T4).
 * ==========================================================================*/
(function () {
  'use strict';

  var POLL_MS = 15000;
  var state = { gamePk: null, feed: null, timer: null, countdownTimer: null, nextPoll: 0, tab: 'plays' };

  function gamePkFromUrl() {
    var m = /[?&]gamePk=([^&]+)/.exec(window.location.search || '');
    return m ? decodeURIComponent(m[1]) : null;
  }

  function setLoading(on) {
    var el = UI.$('loading');
    if (el) el.hidden = !on;
  }

  function renderHeader(feed) {
    var gd = feed.gameData || {};
    var teams = gd.teams || {};
    var away = teams.away || {};
    var home = teams.home || {};
    var status = gd.status || {};
    var linescore = feed.liveData && feed.liveData.linescore;

    function sideHtml(team) {
      return '<img class="team-logo" alt="" src="' + UI.esc(UI.teamLogo(team.id)) + '">' +
        '<span class="team-abbr">' + UI.esc(UI.teamAbbr(team)) + '</span>' +
        '<span class="team-name">' + UI.esc(UI.teamName(team)) + '</span>';
    }
    UI.$('header-away').innerHTML = sideHtml(away);
    UI.$('header-home').innerHTML = sideHtml(home);
    var awayScore = linescore && linescore.teams && linescore.teams.away ? linescore.teams.away.runs : away.score;
    var homeScore = linescore && linescore.teams && linescore.teams.home ? linescore.teams.home.runs : home.score;
    UI.$('header-center').innerHTML =
      '<div class="header-score">' + UI.esc(awayScore === undefined || awayScore === null ? '–' : awayScore) +
      ' – ' + UI.esc(homeScore === undefined || homeScore === null ? '–' : homeScore) + '</div>' +
      '<div class="header-status">' + UI.esc(status.detailedState || '') + '</div>';
    UI.$('header-meta').textContent =
      (status.abstractGameState || '') + (gd.datetime && gd.datetime.dateTime ? ' · ' + gd.datetime.dateTime : '');
    var decisions = [];
    if (linescore && linescore.decisions) {
      ['winner', 'loser', 'save'].forEach(function (k) {
        var p = linescore.decisions[k];
        if (p && p.fullName) decisions.push(k + ': ' + p.fullName);
      });
    }
    UI.$('header-decisions').textContent = decisions.join(' · ');
  }

  function renderLivePanel(feed) {
    var host = UI.$('live-panel');
    var plays = feed.liveData && feed.liveData.plays;
    var current = plays && plays.currentPlay;
    if (!current || !current.matchup) {
      host.innerHTML = '<h3>Live</h3><p class="matchup">No live matchup in payload.</p>';
      return;
    }
    var m = current.matchup;
    var count = current.count || {};
    host.innerHTML = '<h3>Live matchup</h3>' +
      '<p class="matchup">' + UI.esc(m.batter ? m.batter.fullName : '—') + ' vs ' +
      UI.esc(m.pitcher ? m.pitcher.fullName : '—') +
      ' · ' + UI.esc(count.balls) + '–' + UI.esc(count.strikes) + ', ' + UI.esc(count.outs) + ' out' +
      (count.outs === 1 ? '' : 's') + '</p>' +
      '<p class="matchup">' + UI.esc(current.result ? current.result.description : '') + '</p>';
  }

  function renderLinescore(feed) {
    var host = UI.$('linescore-wrap');
    var ls = feed.liveData && feed.liveData.linescore;
    if (!ls || !ls.innings || !ls.teams) {
      host.innerHTML = '<p class="matchup">Linescore not in payload.</p>';
      return;
    }
    var html = '<table class="score-table"><thead><tr><th></th>';
    ls.innings.forEach(function (inn) { html += '<th>' + UI.esc(inn.num) + '</th>'; });
    html += '<th>R</th><th>H</th><th>E</th></tr></thead><tbody>';
    ['away', 'home'].forEach(function (side) {
      var team = ls.teams[side] || {};
      html += '<tr><td>' + UI.esc(team.abbreviation || side) + '</td>';
      ls.innings.forEach(function (inn) {
        var v = inn[side] && inn[side].runs !== undefined ? inn[side].runs : '–';
        html += '<td>' + UI.esc(v) + '</td>';
      });
      html += '<td>' + UI.esc(team.runs !== undefined ? team.runs : '–') + '</td>' +
        '<td>' + UI.esc(team.hits !== undefined ? team.hits : '–') + '</td>' +
        '<td>' + UI.esc(team.errors !== undefined ? team.errors : '–') + '</td></tr>';
    });
    host.innerHTML = html + '</tbody></table>';
  }

  function renderPlays(feed) {
    var host = UI.$('plays-wrap');
    var plays = (feed.liveData && feed.liveData.plays && feed.liveData.plays.allPlays) || [];
    host.innerHTML = '';
    if (!plays.length) {
      host.innerHTML = '<p class="matchup">No plays in payload yet.</p>';
      return;
    }
    plays.slice().reverse().forEach(function (play, idx) {
      var row = document.createElement('div');
      row.className = 'play-row';
      var reviews = Reviews.extractReviewsFromPlay(play, idx);
      if (reviews.length) row.classList.add('has-review');
      var about = play.about || {};
      var inning = document.createElement('div');
      inning.className = 'play-inning';
      inning.textContent = (about.isTopInning ? 'Top ' : 'Bot ') + (about.inning || '');
      var body = document.createElement('div');
      body.className = 'play-body';
      var desc = document.createElement('div');
      desc.className = 'play-desc';
      desc.textContent = (play.result && play.result.description) || 'Play';
      var meta = document.createElement('div');
      meta.className = 'play-meta';
      var bits = [];
      if (play.matchup && play.matchup.batter) bits.push(play.matchup.batter.fullName);
      if (play.matchup && play.matchup.pitcher) bits.push('P: ' + play.matchup.pitcher.fullName);
      if (play.result && play.result.rbi) bits.push(play.result.rbi + ' RBI');
      reviews.forEach(function (r) { bits.push(r.label); });
      meta.textContent = bits.join(' · ');
      body.appendChild(desc);
      body.appendChild(meta);
      row.appendChild(inning);
      row.appendChild(body);
      host.appendChild(row);
    });
  }

  function renderBoxscore(feed) {
    var host = UI.$('boxscore-wrap');
    var box = feed.liveData && feed.liveData.boxscore;
    if (!box || !box.teams) {
      host.innerHTML = '<p class="matchup">Box score not in payload.</p>';
      return;
    }
    var html = '';
    ['away', 'home'].forEach(function (side) {
      var team = box.teams[side] || {};
      var players = team.players || {};
      var names = Object.keys(players);
      if (!names.length) return;
      html += '<h3>' + UI.esc(team.team ? team.team.name : side) + '</h3>' +
        '<table class="score-table"><thead><tr><th>Player</th><th>AB</th><th>R</th><th>H</th><th>RBI</th></tr></thead><tbody>';
      names.forEach(function (key) {
        var p = players[key] || {};
        var bat = p.stats && p.stats.batting;
        if (!bat) return;
        html += '<tr><td>' + UI.esc(p.person ? p.person.fullName : key) + '</td>' +
          '<td>' + UI.esc(bat.atBats !== undefined ? bat.atBats : '–') + '</td>' +
          '<td>' + UI.esc(bat.runs !== undefined ? bat.runs : '–') + '</td>' +
          '<td>' + UI.esc(bat.hits !== undefined ? bat.hits : '–') + '</td>' +
          '<td>' + UI.esc(bat.rbi !== undefined ? bat.rbi : '–') + '</td></tr>';
      });
      html += '</tbody></table>';
    });
    host.innerHTML = html || '<p class="matchup">Box score not in payload.</p>';
  }

  function renderReviews(feed) {
    var host = UI.$('reviews-wrap');
    var extracted = Reviews.extractReviewsFromFeed(feed);
    var all = extracted.reviews.concat(extracted.pending);
    var badge = UI.$('reviews-tab-count');
    if (badge) {
      badge.style.display = all.length ? '' : 'none';
      badge.textContent = String(all.length);
    }
    var banner = UI.$('live-review-banner-wrap');
    if (extracted.underReview.active) {
      banner.innerHTML = '<div class="live-review-banner">⏳ Under review' +
        (extracted.underReview.statusCode ? ' (' + UI.esc(extracted.underReview.statusCode) + ')' : '') +
        (extracted.underReview.description ? ' — ' + UI.esc(extracted.underReview.description) : '') + '</div>';
    } else {
      banner.innerHTML = '';
    }
    host.innerHTML = '';
    if (!all.length) {
      host.innerHTML = '<p class="matchup">No challenges or reviews tracked for this game yet.</p>';
      return;
    }
    all.forEach(function (r) {
      var card = document.createElement('div');
      card.className = 'review-card';
      var head = document.createElement('h4');
      head.innerHTML = '<span class="badge ' + UI.esc(r.badgeClass) + '">' + UI.esc(r.label) + '</span>' +
        UI.esc(r.playDescription || r.description || '');
      var meta = document.createElement('p');
      var bits = [];
      if (r.inning) bits.push((r.isTopInning ? 'Top ' : 'Bot ') + r.inning);
      if (r.batter) bits.push('Batter: ' + r.batter);
      if (r.pitcher) bits.push('Pitcher: ' + r.pitcher);
      if (r.code) bits.push('Code: ' + r.code);
      meta.textContent = bits.join(' · ');
      card.appendChild(head);
      card.appendChild(meta);
      host.appendChild(card);
    });
  }

  function switchTab(tab) {
    state.tab = tab;
    UI.$$('tab-btn').forEach(function (b) {
      b.classList.toggle('tab-on', b.getAttribute('data-tab') === tab);
    });
    ['plays', 'boxscore', 'props', 'reviews'].forEach(function (t) {
      var panel = UI.$('panel-' + t);
      if (panel) panel.style.display = (t === tab) ? '' : 'none';
    });
  }

  function tickCountdown() {
    var el = UI.$('countdown');
    if (!el) return;
    var secs = Math.max(0, Math.ceil((state.nextPoll - Date.now()) / 1000));
    el.textContent = 'next poll in ' + secs + 's';
  }

  function load() {
    if (!state.gamePk) {
      UI.setStatus('Missing ?gamePk= in the URL. Open a game from the scoreboard.', true);
      setLoading(false);
      return;
    }
    UI.setStatus('Loading game ' + state.gamePk + '…');
    Api.getFeed(state.gamePk).then(function (feed) {
      state.feed = feed;
      renderHeader(feed);
      renderLivePanel(feed);
      renderLinescore(feed);
      renderPlays(feed);
      renderBoxscore(feed);
      renderReviews(feed);
      if (window.Props) Props.renderProps(feed);
      switchTab(state.tab);
      var gd = feed.gameData || {};
      var label = gd.teams && gd.teams.away && gd.teams.home
        ? UI.teamAbbr(gd.teams.away) + ' @ ' + UI.teamAbbr(gd.teams.home)
        : 'Game ' + state.gamePk;
      UI.setStatus(label + ' · updated ' + new Date().toLocaleTimeString());
    }, function (err) {
      UI.setStatus('Could not load game ' + state.gamePk + ': ' + err.message, true);
    }).then(function () {
      setLoading(false);
      state.nextPoll = Date.now() + POLL_MS;
      tickCountdown();
    });
  }

  function restart() {
    if (state.timer) clearInterval(state.timer);
    if (state.countdownTimer) clearInterval(state.countdownTimer);
    state.timer = setInterval(load, POLL_MS);
    state.countdownTimer = setInterval(tickCountdown, 1000);
    state.nextPoll = Date.now() + POLL_MS;
    load();
  }

  document.addEventListener('DOMContentLoaded', function () {
    state.gamePk = gamePkFromUrl();
    UI.$$('tab-btn').forEach(function (b) {
      b.addEventListener('click', function () { switchTab(b.getAttribute('data-tab')); });
    });
    var refresh = UI.$('refresh-btn');
    if (refresh) refresh.addEventListener('click', load);
    setLoading(true);
    restart();
  });
})();
