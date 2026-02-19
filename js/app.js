/* === Golf GPS App — Main Orchestrator === */

const App = {
  currentHole: 1,
  currentTee: 'White',
  gpsReady: false,
  wakeLock: null,

  init() {
    // Load settings
    this.currentTee = Storage.getSetting('tee', 'White');
    const showMapper = Storage.getSetting('showMapper', false);

    // Load or start round
    if (ShotTracker.hasActiveRound()) {
      this.currentHole = ShotTracker.round.currentHole;
      this.currentTee = ShotTracker.round.tee;
    }

    // Setup settings controls
    document.getElementById('setting-tee').value = this.currentTee;
    document.getElementById('setting-mapper-access').checked = showMapper;
    if (showMapper) document.getElementById('nav-mapper').style.display = '';

    // Bind navigation
    this._bindNavigation();
    this._bindHoleNav();
    this._bindSettings();
    this._bindShotTracker();

    // Start GPS
    GpsManager.onPositionUpdate(pos => this._onGpsUpdate(pos));
    GpsManager.start();

    // Request wake lock
    this._requestWakeLock();

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(err => {
        console.log('SW registration failed:', err);
      });
    }

    // Render initial state
    this._renderHoleInfo();
    this._renderTrackerScreen();
    this._renderScorecard();
  },

  // === Navigation ===

  _bindNavigation() {
    document.querySelectorAll('.nav-btn[data-screen]').forEach(btn => {
      btn.addEventListener('click', () => {
        const screenId = btn.dataset.screen;
        this._showScreen(screenId);

        // Load mapper on demand
        if (screenId === 'screen-mapper' && typeof CourseMapper !== 'undefined') {
          CourseMapper.init();
        }
      });
    });

    document.getElementById('nav-settings').addEventListener('click', () => {
      document.getElementById('settings-modal').classList.remove('hidden');
    });
  },

  _showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.querySelector('.nav-btn[data-screen="' + screenId + '"]');
    if (activeBtn) activeBtn.classList.add('active');
  },

  // === Hole Navigation ===

  _bindHoleNav() {
    document.getElementById('btn-prev-hole').addEventListener('click', () => this._changeHole(-1));
    document.getElementById('btn-next-hole').addEventListener('click', () => this._changeHole(1));

    // Swipe support
    let touchStartX = 0;
    const gpsScreen = document.getElementById('screen-gps');
    gpsScreen.addEventListener('touchstart', e => {
      touchStartX = e.touches[0].clientX;
    }, { passive: true });
    gpsScreen.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 60) {
        this._changeHole(dx < 0 ? 1 : -1);
      }
    }, { passive: true });
  },

  _changeHole(delta) {
    const newHole = this.currentHole + delta;
    if (newHole < 1 || newHole > 18) return;
    this.currentHole = newHole;
    this._renderHoleInfo();
    this._updateDistances();
  },

  _renderHoleInfo() {
    const hole = CourseData.getHole(this.currentHole);
    if (!hole) return;

    document.getElementById('hole-number').textContent = 'Hole ' + hole.number;
    document.getElementById('hole-par').textContent = 'Par ' + hole.par;
    document.getElementById('hole-si').textContent = 'SI ' + hole.si;
    document.getElementById('hole-yardage').textContent =
      this.currentTee + ': ' + hole.yardages[this.currentTee] + 'm';
  },

  // === GPS Updates ===

  _onGpsUpdate(pos) {
    if (!this.gpsReady) {
      this.gpsReady = true;
      document.getElementById('gps-overlay').classList.add('hidden');
    }

    // Update accuracy indicator
    const dot = document.getElementById('gps-dot');
    const label = document.getElementById('gps-accuracy');
    const bucket = GpsManager.getAccuracyBucket();
    dot.className = 'gps-dot ' + bucket;
    label.textContent = 'GPS: ' + GpsManager.getAccuracyLabel();

    this._updateDistances();
  },

  _updateDistances() {
    const pos = GpsManager.getLastPosition();
    if (!pos) return;

    const hole = CourseData.getHole(this.currentHole);
    if (!hole) return;

    // Green distances
    const distFront = Distance.toTarget(pos.lat, pos.lng, hole.green.front);
    const distCenter = Distance.toTarget(pos.lat, pos.lng, hole.green.center);
    const distBack = Distance.toTarget(pos.lat, pos.lng, hole.green.back);

    document.getElementById('dist-front').textContent = Distance.formatDistance(distFront);
    document.getElementById('dist-center').textContent = Distance.formatDistance(distCenter);
    document.getElementById('dist-back').textContent = Distance.formatDistance(distBack);

    // Hazards
    this._renderHazards(pos, hole);
  },

  _renderHazards(pos, hole) {
    const container = document.getElementById('hazard-list');
    if (!hole.hazards || hole.hazards.length === 0) {
      container.innerHTML = '<div class="empty-msg">No hazards mapped for this hole</div>';
      return;
    }

    // Calculate distances and sort
    const hazards = hole.hazards
      .map(h => {
        const dist = Distance.toTarget(pos.lat, pos.lng, h.position);
        const bearing = Distance.bearingToTarget(pos.lat, pos.lng, h.position);
        return { ...h, dist, bearing };
      })
      .filter(h => h.dist != null && h.dist < 400)
      .sort((a, b) => a.dist - b.dist);

    if (hazards.length === 0) {
      container.innerHTML = '<div class="empty-msg">No hazards in range</div>';
      return;
    }

    const icons = { bunker: '\u26F3', water: '\uD83D\uDCA7', ob: '\u26D4' };
    container.innerHTML = hazards.map(h => {
      const icon = icons[h.type] || '\u26A0';
      const arrow = h.bearing != null ? Distance.bearingToArrow(h.bearing) : '';
      return '<div class="hazard-item">' +
        '<span class="hazard-icon ' + h.type + '">' + icon + '</span>' +
        '<span class="hazard-label">' + (h.label || h.type) + '</span>' +
        '<span class="hazard-dist">' + Distance.formatDistance(h.dist) + '</span>' +
        '<span class="hazard-arrow">' + arrow + '</span>' +
      '</div>';
    }).join('');
  },

  // === Shot Tracker UI ===

  _bindShotTracker() {
    // Mark shot from GPS screen
    document.getElementById('btn-mark-shot').addEventListener('click', () => {
      this._handleMarkShot();
    });

    // End hole
    document.getElementById('btn-end-hole').addEventListener('click', () => {
      const section = document.getElementById('end-hole-section');
      section.classList.toggle('hidden');
    });

    // Putt buttons
    document.querySelectorAll('.btn-putt').forEach(btn => {
      btn.addEventListener('click', () => {
        const putts = parseInt(btn.dataset.putts);
        this._handleEndHole(putts);
      });
    });

    // Club buttons (build them)
    this._buildClubButtons();

    // New round button
    document.getElementById('btn-new-round').addEventListener('click', () => {
      this._startNewRound();
    });

    // Share/copy button
    document.getElementById('btn-share-round').addEventListener('click', () => {
      this._shareRound();
    });
  },

  _buildClubButtons() {
    const container = document.getElementById('club-buttons');
    container.innerHTML = CLUBS.map(club => {
      const label = club.replace(' Iron', 'i').replace(' Wood', 'W').replace(' Hybrid', 'H');
      return '<button class="club-btn" data-club="' + club + '">' + label + '</button>';
    }).join('');

    container.querySelectorAll('.club-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        ShotTracker.setClubForLastShot(btn.dataset.club);
        document.getElementById('club-selector').classList.add('hidden');
        this._renderTrackerScreen();
      });
    });
  },

  _handleMarkShot() {
    // Auto-start round if needed
    if (!ShotTracker.hasActiveRound()) {
      ShotTracker.startRound(this.currentTee);
    }

    // Sync hole
    if (ShotTracker.round) {
      ShotTracker.round.currentHole = this.currentHole;
    }

    const shot = ShotTracker.markShot();
    if (!shot) {
      alert('Cannot mark shot: no GPS signal');
      return;
    }

    // Show club selector
    document.getElementById('club-selector').classList.remove('hidden');
    document.getElementById('end-hole-section').classList.add('hidden');

    this._renderTrackerScreen();
    this._showScreen('screen-tracker');
  },

  _handleEndHole(putts) {
    ShotTracker.endHole(putts);
    document.getElementById('end-hole-section').classList.add('hidden');
    document.getElementById('club-selector').classList.add('hidden');

    // Move to next hole on GPS screen too
    if (this.currentHole < 18) {
      this.currentHole = ShotTracker.round.currentHole;
      this._renderHoleInfo();
    }

    this._renderTrackerScreen();
    this._renderScorecard();

    // Check if round is done
    const allDone = ShotTracker.round.holes.every(h => h.completed);
    if (allDone) {
      const summary = ShotTracker.endRound();
      this._renderSummary(summary);
      this._showScreen('screen-summary');
    }
  },

  _renderTrackerScreen() {
    if (!ShotTracker.round) {
      document.getElementById('tracker-hole').textContent = 'Hole ' + this.currentHole;
      document.getElementById('tracker-par').textContent = 'Par --';
      document.getElementById('tracker-shots').textContent = 'Shots: 0';
      document.getElementById('shot-list').innerHTML =
        '<div class="empty-msg">No shots recorded. Go to GPS screen and tap MARK SHOT.</div>';
      return;
    }

    const holeData = ShotTracker.getCurrentHoleData();
    document.getElementById('tracker-hole').textContent = 'Hole ' + ShotTracker.round.currentHole;
    document.getElementById('tracker-par').textContent = 'Par ' + holeData.par;
    document.getElementById('tracker-shots').textContent = 'Shots: ' + holeData.shots.length;

    // Shot list
    const list = document.getElementById('shot-list');
    if (holeData.shots.length === 0) {
      list.innerHTML = '<div class="empty-msg">No shots recorded. Go to GPS screen and tap MARK SHOT.</div>';
    } else {
      list.innerHTML = holeData.shots.map(s => {
        const clubLabel = s.club || '(select club)';
        const distLabel = s.distanceFromPrevious != null ? s.distanceFromPrevious + 'm' : 'Tee';
        return '<div class="shot-item">' +
          '<span class="shot-num">#' + s.index + '</span>' +
          '<span class="shot-club">' + clubLabel + '</span>' +
          '<span class="shot-distance">' + distLabel + '</span>' +
        '</div>';
      }).join('');
    }
  },

  _renderScorecard() {
    const miniCard = document.getElementById('running-scorecard');
    if (!ShotTracker.round) {
      miniCard.innerHTML = '<div class="empty-msg">Start a round to see scorecard</div>';
      return;
    }

    let html = '<table><tr><th>Hole</th>';
    for (let i = 1; i <= 9; i++) html += '<th>' + i + '</th>';
    html += '<th>OUT</th></tr>';

    // Par row
    html += '<tr><td>Par</td>';
    let frontPar = 0;
    for (let i = 0; i < 9; i++) {
      const h = ShotTracker.round.holes[i];
      html += '<td>' + h.par + '</td>';
      frontPar += h.par;
    }
    html += '<td>' + frontPar + '</td></tr>';

    // Score row
    html += '<tr><td>Score</td>';
    let frontScore = 0;
    let frontPlayed = false;
    for (let i = 0; i < 9; i++) {
      const h = ShotTracker.round.holes[i];
      if (h.completed) {
        const cls = h.scoreToPar > 0 ? 'score-over' : (h.scoreToPar < 0 ? 'score-under' : 'score-even');
        html += '<td class="' + cls + '">' + h.totalStrokes + '</td>';
        frontScore += h.totalStrokes;
        frontPlayed = true;
      } else {
        html += '<td>-</td>';
      }
    }
    html += '<td>' + (frontPlayed ? frontScore : '-') + '</td></tr>';

    // Back 9
    html += '<tr><th>Hole</th>';
    for (let i = 10; i <= 18; i++) html += '<th>' + i + '</th>';
    html += '<th>IN</th></tr>';

    html += '<tr><td>Par</td>';
    let backPar = 0;
    for (let i = 9; i < 18; i++) {
      const h = ShotTracker.round.holes[i];
      html += '<td>' + h.par + '</td>';
      backPar += h.par;
    }
    html += '<td>' + backPar + '</td></tr>';

    html += '<tr><td>Score</td>';
    let backScore = 0;
    let backPlayed = false;
    for (let i = 9; i < 18; i++) {
      const h = ShotTracker.round.holes[i];
      if (h.completed) {
        const cls = h.scoreToPar > 0 ? 'score-over' : (h.scoreToPar < 0 ? 'score-under' : 'score-even');
        html += '<td class="' + cls + '">' + h.totalStrokes + '</td>';
        backScore += h.totalStrokes;
        backPlayed = true;
      } else {
        html += '<td>-</td>';
      }
    }
    html += '<td>' + (backPlayed ? backScore : '-') + '</td></tr>';

    html += '</table>';
    miniCard.innerHTML = html;
  },

  // === Round Summary ===

  _renderSummary(roundData) {
    const summary = roundData.summary || ShotTracker.getRoundSummary();
    if (!summary) return;

    document.getElementById('summary-date').textContent =
      new Date(roundData.date).toLocaleDateString() + ' — ' + roundData.tee + ' Tees';

    const scoreEl = document.getElementById('summary-score');
    const sign = summary.scoreToPar >= 0 ? '+' : '';
    const cls = summary.scoreToPar > 0 ? 'score-over' : (summary.scoreToPar < 0 ? 'score-under' : 'score-even');
    scoreEl.innerHTML =
      '<div class="big-score">' + summary.totalStrokes + '</div>' +
      '<div class="score-to-par ' + cls + '">' + sign + summary.scoreToPar + '</div>';

    const frontSign = summary.frontScoreToPar >= 0 ? '+' : '';
    const backSign = summary.backScoreToPar >= 0 ? '+' : '';
    document.getElementById('summary-front').textContent = summary.frontStrokes + ' (' + frontSign + summary.frontScoreToPar + ')';
    document.getElementById('summary-back').textContent = summary.backStrokes + ' (' + backSign + summary.backScoreToPar + ')';
    document.getElementById('summary-putts').textContent = summary.totalPutts;

    // Club stats
    const clubContainer = document.getElementById('club-stats');
    const clubEntries = Object.entries(summary.clubStats).sort((a, b) => b[1].avgDistance - a[1].avgDistance);
    clubContainer.innerHTML = clubEntries.map(([club, stats]) => {
      return '<div class="club-stat-row">' +
        '<span class="club-stat-name">' + club + '</span>' +
        '<span class="club-stat-avg">avg ' + stats.avgDistance + 'm</span>' +
        '<span class="club-stat-count">(' + stats.count + ' shots)</span>' +
      '</div>';
    }).join('');

    // Full scorecard
    this._renderScorecard();
    document.getElementById('full-scorecard').innerHTML =
      document.getElementById('running-scorecard').innerHTML;
  },

  _startNewRound() {
    if (ShotTracker.hasActiveRound()) {
      if (!confirm('End current round and start a new one?')) return;
      ShotTracker.endRound();
    }
    this.currentHole = 1;
    ShotTracker.startRound(this.currentTee);
    this._renderHoleInfo();
    this._renderTrackerScreen();
    this._renderScorecard();
    this._showScreen('screen-gps');
  },

  _shareRound() {
    const summary = ShotTracker.round ?
      ShotTracker.getRoundSummary() :
      (Storage.getRounds().length > 0 ? Storage.getRounds().slice(-1)[0].summary : null);

    if (!summary) {
      alert('No round data to share');
      return;
    }

    const sign = summary.scoreToPar >= 0 ? '+' : '';
    let text = 'Atlantic Beach Links\n';
    text += 'Score: ' + summary.totalStrokes + ' (' + sign + summary.scoreToPar + ')\n';
    text += 'Front: ' + summary.frontStrokes + ' | Back: ' + summary.backStrokes + '\n';
    text += 'Putts: ' + summary.totalPutts + '\n\n';

    const clubEntries = Object.entries(summary.clubStats).sort((a, b) => b[1].avgDistance - a[1].avgDistance);
    if (clubEntries.length > 0) {
      text += 'Club Distances:\n';
      for (const [club, stats] of clubEntries) {
        text += club + ': avg ' + stats.avgDistance + 'm (' + stats.count + ' shots)\n';
      }
    }

    navigator.clipboard.writeText(text).then(() => {
      alert('Round summary copied to clipboard!');
    }).catch(() => {
      prompt('Copy this text:', text);
    });
  },

  // === Settings ===

  _bindSettings() {
    document.getElementById('btn-settings-close').addEventListener('click', () => {
      document.getElementById('settings-modal').classList.add('hidden');
    });

    document.getElementById('setting-tee').addEventListener('change', e => {
      this.currentTee = e.target.value;
      Storage.setSetting('tee', this.currentTee);
      this._renderHoleInfo();
    });

    document.getElementById('setting-mapper-access').addEventListener('change', e => {
      const show = e.target.checked;
      Storage.setSetting('showMapper', show);
      document.getElementById('nav-mapper').style.display = show ? '' : 'none';
    });
  },

  // === Wake Lock ===

  async _requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    try {
      this.wakeLock = await navigator.wakeLock.request('screen');
      this.wakeLock.addEventListener('release', () => {
        this.wakeLock = null;
      });
    } catch (e) {
      // Wake lock not available
    }

    // Re-acquire on visibility change
    document.addEventListener('visibilitychange', async () => {
      if (!document.hidden && !this.wakeLock) {
        try {
          this.wakeLock = await navigator.wakeLock.request('screen');
        } catch (e) {}
      }
    });
  }
};

// === Start the app ===
document.addEventListener('DOMContentLoaded', () => App.init());
