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
 *
 * ---------------------------------------------------------------------------
 * Challenges & Reviews enrichment (session 5950e951, 2026-11-21).
 *
 * The official payload carries four review fields that this page used to
 * throw away, so the tab showed a generic label and a bare code. All four are
 * read here verbatim; none is inferred, and an absent value is shown as
 * absent rather than guessed:
 *
 *  - `reviewDetails.isOverturned` / `.inProgress` — the ruling. Verified on
 *    real games: https://statsapi.mlb.com/api/v1/game/824474/playByPlay
 *    (atBatIndex 65, `{isOverturned:false, inProgress:false, reviewType:"MI"}`)
 *    and https://statsapi.mlb.com/api/v1/game/849799/playByPlay (2026 World
 *    Series, two `MJ` pitch records with `isOverturned:true`). A record with
 *    no `isOverturned` key is reported as "no ruling in payload", never as a
 *    confirmed call.
 *  - `reviewDetails.challengeTeamId` — resolved against
 *    `gameData.teams.{away,home}.id` only (849799: 158 = Milwaukee Brewers,
 *    away; 824474: 113 = Cincinnati Reds, home). An id that matches neither
 *    side is left blank instead of being labelled.
 *  - `playEvents[].pitchNumber` — the OFFICIAL pitch number. It is not the
 *    array position: in game 849799 the challenged pitch at atBatIndex 36 is
 *    `index` 1 / `pitchNumber` 2, and at atBatIndex 51 `index` 0 /
 *    `pitchNumber` 1. Displayed value is `pitchNumber`; when the payload
 *    omits it the row shows nothing.
 *  - `reviewDetails.reviewType` — resolved to MLB's own wording through the
 *    official game-status registry (GET /api/v1/gameStatus), which defines
 *    MI as "Manager challenge: Hit by pitch", MJ as "Player challenge:
 *    Pitch Result", MS/NS as "Stadium boundary call", IH as "Instant Replay"
 *    and so on. The mapping is confirmed by game 824474 atBatIndex 65: code
 *    MI on a play whose own `result.eventType` is `hit_by_pitch`. When the
 *    registry cannot be fetched the page keeps the generic classification
 *    label from reviews.js and says the registry was unavailable.
 *
 * The official challenge counters (`gameData.review.{away,home}.used/remaining`
 * and `gameData.absChallenges.{away,home}.usedSuccessful/usedFailed/remaining`,
 * verified on 824474 and 849799) are now shown on this tab as a sourced table,
 * matching the Source column the linescore/box score/props tables already have.
 * Counters absent from the payload (e.g. pre-ABS seasons) stay blank.
 * ==========================================================================*/
(function () {
  'use strict';

  var POLL_MS = 15000;
  var state = { gamePk: null, feed: null, timer: null, countdownTimer: null, nextPoll: 0, tab: 'plays', request: 0 };

  /* --------------------------------------------- official status registry */
  /**
   * code -> the official registry entry from GET /api/v1/gameStatus.
   * `registryState` is 'loading' | 'live' | 'unavailable' so the UI can say
   * which wording it is using instead of implying an unverified mapping.
   */
  var reviewStatusMap = null;
  var registryState = 'loading';

  /** Build code -> entry from the official registry array. Pure; tested. */
  function buildReviewStatusMap(list) {
    var map = {};
    (Array.isArray(list) ? list : []).forEach(function (entry) {
      if (entry && entry.statusCode) map[String(entry.statusCode)] = entry;
    });
    return map;
  }

  /** The registry's own wording for a review code, or null when unknown. */
  function registryLabelFor(code) {
    if (!code || !reviewStatusMap) return null;
    var entry = reviewStatusMap[String(code).toUpperCase()];
    return entry && entry.detailedState ? entry.detailedState : null;
  }

  /**
   * Load the official game-status registry once per page. Api.getGameStatus()
   * already existed for this purpose (README: review-status codes come "from
   * GET /api/v1/gameStatus") but nothing called it. A failure is recorded,
   * not silently swallowed: the tab then says the registry is unavailable.
   */
  function loadReviewStatusRegistry() {
    if (!window.Api || !Api.getGameStatus) {
      registryState = 'unavailable';
      return Promise.resolve(null);
    }
    return Api.getGameStatus().then(function (list) {
      reviewStatusMap = buildReviewStatusMap(list);
      registryState = 'live';
      return reviewStatusMap;
    }, function (err) {
      reviewStatusMap = null;
      registryState = 'unavailable';
      console.warn('[game] official game-status registry unavailable (' + err.message +
        ') — review codes keep their generic label');
      return null;
    });
  }

  /* ------------------------------------------------- review-detail readers */
  /** Any non-empty reviewDetails shape. Official payloads use an OBJECT on
   *  both plays and playEvents (verified 824474 / 849799); older captures use
   *  an array. Returns the single object, or the first array element. */
  function firstReviewDetail(value) {
    if (!value) return null;
    if (Array.isArray(value)) {
      for (var i = 0; i < value.length; i++) if (value[i] && typeof value[i] === 'object') return value[i];
      return null;
    }
    return typeof value === 'object' ? value : null;
  }

  /**
   * Re-read the raw official record behind one extracted review row, so the
   * fields reviews.js does not carry (ruling, challenging club, pitch number)
   * come straight from the payload rather than from a second guess.
   * Returns { play, event, detail } with nulls where the payload has none.
   */
  function rawReviewFor(feed, review) {
    var out = { play: null, event: null, detail: null };
    if (!feed || !review) return out;
    var plays = (feed.liveData && feed.liveData.plays && feed.liveData.plays.allPlays) || [];
    var play = null;
    for (var i = 0; i < plays.length; i++) {
      var p = plays[i];
      if (p && p.about && String(p.about.atBatIndex) === String(review.atBatIndex)) { play = p; break; }
    }
    out.play = play;
    if (!play) return out;
    if (review.eventIndex !== undefined && review.eventIndex !== null) {
      var events = play.playEvents || [];
      for (var j = 0; j < events.length; j++) {
        if (events[j] && String(events[j].index) === String(review.eventIndex)) { out.event = events[j]; break; }
      }
      if (out.event) out.detail = firstReviewDetail(out.event.reviewDetails);
    }
    if (!out.detail) out.detail = firstReviewDetail(play.reviewDetails);
    return out;
  }

  /**
   * The ruling, read only from the payload's own booleans.
   * `inProgress` wins (a review still open has no ruling yet). An absent
   * `isOverturned` is NOT a confirmed ruling — it returns null and the row
   * says so, per the integration request recorded in COORDINATION.md.
   */
  function rulingOf(detail) {
    if (!detail || typeof detail !== 'object') return null;
    if (detail.inProgress === true) return { key: 'in-progress', label: 'In progress' };
    if (detail.isOverturned === true) return { key: 'overturned', label: 'Overturned' };
    if (detail.isOverturned === false) return { key: 'stands', label: 'Call stands (not overturned)' };
    return null;
  }

  /** The challenging club, resolved against this game's own team ids only. */
  function challengingTeamOf(feed, detail) {
    if (!detail || detail.challengeTeamId === undefined || detail.challengeTeamId === null) return null;
    var teams = (feed && feed.gameData && feed.gameData.teams) || {};
    var id = detail.challengeTeamId;
    var sides = ['away', 'home'];
    for (var i = 0; i < sides.length; i++) {
      var t = teams[sides[i]];
      if (t && String(t.id) === String(id)) {
        return { id: t.id, side: sides[i], name: t.name || null, abbreviation: t.abbreviation || null };
      }
    }
    return null;   // unknown id: left blank, never labelled
  }

  /**
   * The OFFICIAL pitch number for a pitch-level review. Never the playEvent
   * array position — the two differ in real data (game 849799: index 1 is
   * pitchNumber 2). Returns null when the payload does not carry it.
   */
  function pitchNumberOf(event) {
    if (!event || event.pitchNumber === undefined || event.pitchNumber === null) return null;
    return event.pitchNumber;
  }

  /** The Reviews module, resolved safely in both the browser (global) and
   *  Node (no `window`), so the pure readers can be tested without a DOM. */
  function reviewsModule() {
    if (typeof Reviews !== 'undefined' && Reviews) return Reviews;
    if (typeof window !== 'undefined' && window.Reviews) return window.Reviews;
    return null;
  }

  /**
   * Official challenge counters as display rows, from Reviews.getReviewCounters
   * (which reads the payload verbatim and returns null for absent sides).
   * A value the payload does not carry is rendered blank, never zero.
   */
  function counterRows(feed) {
    var mod = reviewsModule();
    var counters = (mod && mod.getReviewCounters) ? mod.getReviewCounters(feed) : null;
    if (!counters) return [];
    function val(side, key) {
      return side && side[key] !== undefined && side[key] !== null ? side[key] : '';
    }
    var rows = [];
    var m = counters.manager;
    if (m) {
      rows.push(['Manager challenges used', val(m.away, 'used'), val(m.home, 'used')]);
      rows.push(['Manager challenges remaining', val(m.away, 'remaining'), val(m.home, 'remaining')]);
    }
    var a = counters.abs;
    if (a) {
      rows.push(['ABS challenges retained (successful)', val(a.away, 'usedSuccessful'), val(a.home, 'usedSuccessful')]);
      rows.push(['ABS challenges lost (failed)', val(a.away, 'usedFailed'), val(a.home, 'usedFailed')]);
      rows.push(['ABS challenges remaining', val(a.away, 'remaining'), val(a.home, 'remaining')]);
    }
    return rows;
  }

  /** One review row, fully resolved against the payload + official registry. */
  function reviewRowModel(feed, review) {
    var raw = rawReviewFor(feed, review);
    var detail = raw.detail || {};
    var team = challengingTeamOf(feed, detail);
    var code = review.code || detail.reviewType || null;
    var official = registryLabelFor(code);
    return {
      id: review.id,
      typeKey: review.typeKey,
      label: review.label,
      badgeClass: review.badgeClass,
      code: code,
      officialLabel: official,
      officialReason: detail.reason || null,
      ruling: rulingOf(detail),
      pitchNumber: pitchNumberOf(raw.event),
      eventIndex: review.eventIndex === undefined ? null : review.eventIndex,
      challengingTeam: team,
      challengingTeamLabel: team ? (team.abbreviation || team.name) : null,
      atBatIndex: review.atBatIndex,
      inning: review.inning,
      isTopInning: review.isTopInning,
      batter: review.batter,
      pitcher: review.pitcher,
      playDescription: review.playDescription,
      sourceUrl: 'https://statsapi.mlb.com/api/v1.1/game/' +
        encodeURIComponent(feed && feed.gamePk !== undefined ? feed.gamePk : '') + '/feed/live',
      registryState: registryState,
    };
  }

  /** Badge class for a ruling chip; reuses classes already in style.css. */
  function rulingBadgeClass(ruling) {
    if (!ruling) return 'risk';
    if (ruling.key === 'overturned') return 'abs';        // green: call changed
    if (ruling.key === 'in-progress') return 'under-review'; // amber: still open
    return 'review';                                      // blue: call stands
  }

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
    if (feed.liveData && feed.liveData.decisions) {
      ['winner', 'loser', 'save'].forEach(function (k) {
        var p = feed.liveData.decisions[k];
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
    html += '<th>R</th><th>H</th><th>E</th><th>Source</th></tr></thead><tbody>';
    ['away', 'home'].forEach(function (side) {
      var team = ls.teams[side] || {};
      html += UI.sourcedRow(feed, [feed.gameData?.teams?.[side]?.name, ...ls.innings.map(inn => inn[side]?.runs), team.runs, team.hits, team.errors]);
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
      reviews.forEach(function (r) {
        // MLB's own wording for the code plus the ruling the payload states.
        var m = reviewRowModel(feed, r);
        bits.push((m.officialLabel || m.label) + (m.ruling ? ' — ' + m.ruling.label : ''));
      });
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
        '<table class="score-table"><thead><tr><th>Player</th><th>AB</th><th>R</th><th>H</th><th>RBI</th><th>Source</th></tr></thead><tbody>';
      names.forEach(function (key) {
        var p = players[key] || {};
        var bat = p.stats && p.stats.batting;
        if (!bat) return;
        html += UI.sourcedRow(feed, [p.person?.fullName, bat.atBats, bat.runs, bat.hits, bat.rbi]);
      });
      html += '</tbody></table>';
    });
    host.innerHTML = html || '<p class="matchup">Box score not in payload.</p>';
  }

  function renderReviews(feed) {
    var host = UI.$('reviews-wrap');
    if (!host) return;
    var extracted = Reviews.extractReviewsFromFeed(feed);
    var all = extracted.reviews.concat(extracted.pending);
    var badge = UI.$('reviews-tab-count');
    if (badge) {
      badge.style.display = all.length ? '' : 'none';
      badge.textContent = String(all.length);
    }
    var banner = UI.$('live-review-banner-wrap');
    if (banner) {
      banner.innerHTML = extracted.underReview.active
        ? '<div class="live-review-banner">⏳ Under review' +
          (extracted.underReview.statusCode ? ' (' + UI.esc(extracted.underReview.statusCode) + ')' : '') +
          (extracted.underReview.description ? ' — ' + UI.esc(extracted.underReview.description) +
            ' · <a href="https://statsapi.mlb.com/api/v1/gameStatus" target="_blank" rel="noopener">official status registry</a>' : '') +
          '</div>'
        : '';
    }
    host.innerHTML = '';

    /* Official challenge counters, read verbatim from the payload. Every row
     * carries its source link, like the linescore/box score/props tables. */
    var rows = counterRows(feed);
    if (rows.length) {
      var table = '<h3>Official challenge counters</h3>' +
        '<table class="score-table"><thead><tr><th>Counter (official payload)</th>' +
        '<th>' + UI.esc(UI.teamAbbr(feed.gameData && feed.gameData.teams && feed.gameData.teams.away)) + '</th>' +
        '<th>' + UI.esc(UI.teamAbbr(feed.gameData && feed.gameData.teams && feed.gameData.teams.home)) + '</th>' +
        '<th>Source</th></tr></thead><tbody>';
      rows.forEach(function (r) { table += UI.sourcedRow(feed, r); });
      table += '</tbody></table>' +
        '<p class="props-note">Read directly from <code>gameData.review</code> and ' +
        '<code>gameData.absChallenges</code> — never derived by counting feed events, and blank ' +
        '(never 0) when the payload does not carry the counter. Field names verified against ' +
        '<a href="https://statsapi.mlb.com/api/v1.1/game/824474/feed/live" target="_blank" rel="noopener">game 824474</a> and ' +
        '<a href="https://statsapi.mlb.com/api/v1.1/game/849799/feed/live" target="_blank" rel="noopener">game 849799</a>.</p>';
      host.insertAdjacentHTML('beforeend', table);
    }

    if (registryState === 'unavailable') {
      host.insertAdjacentHTML('beforeend',
        '<p class="props-note">⚠️ The official game-status registry ' +
        '(<a href="https://statsapi.mlb.com/api/v1/gameStatus" target="_blank" rel="noopener">GET /api/v1/gameStatus</a>) ' +
        'could not be fetched, so review codes below keep their generic label instead of MLB\'s own ' +
        'wording. Nothing is guessed.</p>');
    }

    if (!all.length) {
      host.insertAdjacentHTML('beforeend',
        '<p class="matchup">No challenges or reviews tracked for this game yet.</p>');
      return;
    }

    host.insertAdjacentHTML('beforeend', '<h3>Challenges &amp; reviews</h3>');
    all.forEach(function (r) {
      var m = reviewRowModel(feed, r);
      var card = document.createElement('div');
      card.className = 'review-card';

      var head = document.createElement('h4');
      // MLB's own wording for the code when the registry supplied it, else the
      // classification label from reviews.js.
      head.innerHTML = '<span class="badge ' + UI.esc(m.badgeClass) + '">' +
        UI.esc(m.officialLabel || m.label) + '</span>' +
        UI.esc(m.playDescription || '');
      card.appendChild(head);

      if (m.ruling) {
        var ruling = document.createElement('span');
        ruling.className = 'badge ' + rulingBadgeClass(m.ruling);
        ruling.textContent = m.ruling.label;
        card.appendChild(ruling);
      } else if (m.typeKey !== 'pending') {
        var none = document.createElement('span');
        none.className = 'feed-meta';
        none.textContent = 'No ruling in payload (isOverturned absent — not reported as a confirmed call).';
        card.appendChild(none);
      }

      var meta = document.createElement('p');
      var bits = [];
      if (m.inning) bits.push((m.isTopInning ? 'Top ' : 'Bot ') + m.inning);
      if (m.batter) bits.push('Batter: ' + m.batter);
      if (m.pitcher) bits.push('Pitcher: ' + m.pitcher);
      // Official pitch number, not the playEvent array position (they differ
      // in real data — see the file header). Blank when the payload omits it.
      if (m.pitchNumber !== null) bits.push('Pitch: ' + m.pitchNumber);
      if (m.challengingTeamLabel) bits.push('Challenged by: ' + m.challengingTeamLabel);
      if (m.code) bits.push('Code: ' + m.code);
      if (m.officialReason) bits.push('Reason: ' + m.officialReason);
      meta.className = 'feed-meta';
      meta.textContent = bits.join(' · ');
      card.appendChild(meta);

      var src = document.createElement('a');
      src.href = m.sourceUrl;
      src.target = '_blank';
      src.rel = 'noopener';
      src.textContent = 'MLB source';
      card.appendChild(src);

      host.appendChild(card);
    });
  }

  function switchTab(tab) {
    state.tab = tab;
    UI.$$('.tab-btn').forEach(function (b) {
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
    var request = ++state.request;
    UI.setStatus('Loading game ' + state.gamePk + '…');
    Api.getFeed(state.gamePk).then(function (feed) {
      // A slow response must not overwrite a newer one: polls run every 15 s
      // and the client timeout is 20 s, so two can be in flight at once.
      if (request !== state.request) return;
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
      if (request !== state.request) return;
      UI.setStatus('Could not load game ' + state.gamePk + ': ' + err.message, true);
    }).then(function () {
      if (request !== state.request) return;
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

  /* --------------------------------------------------------------- public
   * The readers above are pure (payload in, model out) and are exported so
   * tools/game-page-test.mjs can assert them against verbatim official MLB
   * captures without a DOM. The renderer only consumes reviewRowModel(). */
  var Game = {
    buildReviewStatusMap: buildReviewStatusMap,
    registryLabelFor: registryLabelFor,
    loadReviewStatusRegistry: loadReviewStatusRegistry,
    firstReviewDetail: firstReviewDetail,
    rawReviewFor: rawReviewFor,
    rulingOf: rulingOf,
    challengingTeamOf: challengingTeamOf,
    pitchNumberOf: pitchNumberOf,
    counterRows: counterRows,
    reviewRowModel: reviewRowModel,
    rulingBadgeClass: rulingBadgeClass,
    getRegistryState: function () { return registryState; },
    _setReviewStatusMap: function (map, st) { reviewStatusMap = map; registryState = st || 'live'; },
    _state: state,
  };

  if (typeof window !== 'undefined') window.Game = Game;
  if (typeof module !== 'undefined' && module.exports) module.exports = Game;

  // Guarded like every other module in this repo (api.js, ui.js, reviews.js,
  // feed-log.js, reviews-feed.js) so the pure readers above can be required in
  // Node by the test suite without a DOM.
  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', function () {
    state.gamePk = gamePkFromUrl();
    UI.$$('.tab-btn').forEach(function (b) {
      b.addEventListener('click', function () { switchTab(b.getAttribute('data-tab')); });
    });
    var refresh = UI.$('refresh-btn');
    if (refresh) refresh.addEventListener('click', load);
    setLoading(true);
    // The official status registry is fetched once, before the first render,
    // so review rows can carry MLB's own wording from the very first paint.
    // A failure does not block the page: registryState records it and the
    // Challenges & Reviews tab says so instead of guessing.
    loadReviewStatusRegistry().then(function () { restart(); });
  });
})();
