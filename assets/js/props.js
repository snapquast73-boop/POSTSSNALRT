/* ============================================================================
 * props.js — game.html "Props & Matchup" tab.
 *
 * Honest scope (flagged-for-review.html F-04): the game.html meta description
 * promises a "transparent two-sided hit forecast", but no forecast model was
 * in the upload and inventing probabilities would be a hallucination. This
 * tab therefore shows ONLY observed payload data — the current matchup
 * (batter vs pitcher, count, outs, base state) straight from the live feed,
 * plus season stats fetched from the official people-stats endpoint when
 * available. When a field is absent from the payload it is shown as
 * "not in payload", never filled in.
 *
 * Rebuilt from the DOM contract in game.html (see COORDINATION.md T4).
 * ==========================================================================*/
(function () {
  'use strict';

  function renderMatchupTable(feed) {
    var plays = feed && feed.liveData && feed.liveData.plays;
    var current = plays && plays.currentPlay;
    var matchup = current && current.matchup;
    var count = current && current.count;
    var offense = feed.liveData?.linescore?.offense;
    var rows = [
      ['Batter', matchup && matchup.batter ? matchup.batter.fullName : null],
      ['Pitcher', matchup && matchup.pitcher ? matchup.pitcher.fullName : null],
      ['Count (balls–strikes)', count?.balls != null && count?.strikes != null ? count.balls + '–' + count.strikes : null],
      ['Outs', count ? count.outs : null],
      ['Runner on 1st', offense?.first?.fullName],
      ['Runner on 2nd', offense?.second?.fullName],
      ['Runner on 3rd', offense?.third?.fullName],
      ['Last play', current && current.result ? current.result.description : null],
    ];
    var html = '<table><thead><tr><th>Matchup (observed)</th><th>Value</th><th>Source</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      html += UI.sourcedRow(feed, r);
    });
    html += '</tbody></table>';
    html += '<p class="props-note">Observed from the live feed payload only. ' +
      'No hit-forecast probabilities are shown: no verified model was in the upload, ' +
      'and none is invented here. See <a href="flagged-for-review.html">Flagged for Review (F-04)</a>.</p>';
    return html;
  }

  function renderSeasonStats(host, feed) {
    var plays = feed && feed.liveData && feed.liveData.plays;
    var current = plays && plays.currentPlay;
    var matchup = current && current.matchup;
    var people = [];
    if (matchup && matchup.batter && matchup.batter.id) {
      people.push({ id: matchup.batter.id, name: matchup.batter.fullName, group: 'hitting' });
    }
    if (matchup && matchup.pitcher && matchup.pitcher.id) {
      people.push({ id: matchup.pitcher.id, name: matchup.pitcher.fullName, group: 'pitching' });
    }
    if (!people.length) return;
    var season = feed.gameData?.game?.season;
    if (!season) return;
    var note = document.createElement('p');
    note.className = 'props-note';
    note.textContent = 'Season stats (official people-stats endpoint) for the game season:';
    host.appendChild(note);
    people.forEach(function (p) {
      Api.getPersonStats(p.id, 'season', season, p.group).then(function (data) {
        var stats = data && data.stats && data.stats[0] && data.stats[0].splits && data.stats[0].splits[0] && data.stats[0].splits[0].stat;
        if (!stats) return;
        var tr = document.createElement('div');
        tr.className = 'props-note';
        tr.textContent = p.name + ' (' + p.group + ', ' + season + '): ' +
          Object.keys(stats).slice(0, 8).map(function (k) { return k + ' ' + stats[k]; }).join(' · ');
        host.appendChild(tr);
      }, function () {
        var tr = document.createElement('div');
        tr.className = 'props-note';
        tr.textContent = p.name + ': season stats unavailable (endpoint did not respond).';
        host.appendChild(tr);
      });
    });
  }

  var Props = {
    renderProps: function (feed, host) {
      host = host || UI.$('props-wrap');
      if (!host) return;
      host.innerHTML = renderMatchupTable(feed);
      renderSeasonStats(host, feed);
    },
  };

  if (typeof window !== 'undefined') window.Props = Props;
  if (typeof module !== 'undefined' && module.exports) module.exports = Props;
})();
