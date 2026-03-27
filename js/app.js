/* === Golf GPS App — Main Orchestrator === */

const App = {
  currentHole: 1,
  currentTee: 'White',
  gpsReady: false,
  wakeLock: null,
  scoringHole: 1,
  currentHoleScores: [],   // [{strokes, putts}, ...] — one per player, unsaved
  _paceTimer: null,

  init() {
    // Load settings
    this.currentTee = Storage.getSetting('tee', 'White');
    const showMapper = Storage.getSetting('showMapper', false);

    // Bind history screen
    this._bindHistory();

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
    this._bindNfc();  // NFC activates only on explicit button tap (browser requirement)

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

    // Init scoring
    this._initScoring();

    // Render initial state first so player card DOM exists
    this._renderHoleInfo();
    this._renderScoringScreen();
    this._renderScorecard();

    // Handle NFC URL tag after DOM is ready
    this._handleNfcUrlTag();

    // Start pace timer if a round is already active
    this._startPaceTimer();
  },

  // === Navigation ===

  _bindNavigation() {
    document.querySelectorAll('.nav-btn[data-screen]').forEach(btn => {
      btn.addEventListener('click', () => {
        const screenId = btn.dataset.screen;
        this._showScreen(screenId);

        if (screenId === 'screen-mapper' && typeof CourseMapper !== 'undefined') {
          CourseMapper.init();
        }
        if (screenId === 'screen-scorecard') {
          this._renderFullScorecard();
        }
        if (screenId === 'screen-summary') {
          // Active round takes priority, then fall back to last saved round
          if (ShotTracker.hasActiveRound()) {
            this._renderSummary(ShotTracker.round);
          } else {
            const rounds = Storage.getRounds();
            if (rounds.length > 0) {
              this._renderSummary(rounds[rounds.length - 1]);
            } else {
              document.getElementById('summary-leaderboard').innerHTML =
                '<div class="empty-msg">No rounds yet</div>';
            }
          }
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

    // Init hole map when the details panel is first opened
    document.getElementById('hole-map-details').addEventListener('toggle', e => {
      if (e.target.open) {
        HoleMap.init(this.currentHole);
      }
    });

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
    if (document.getElementById('hole-map-details').open) {
      HoleMap.showHole(this.currentHole);
    }
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

    // If last shot was recorded without GPS (NFC URL tap), fill it in now
    if (ShotTracker.round) {
      const updated = ShotTracker.updateLastShotGps(pos);
      if (updated) this._updateShotList();
    }

    // Update accuracy indicator
    const dot = document.getElementById('gps-dot');
    const label = document.getElementById('gps-accuracy');
    const bucket = GpsManager.getAccuracyBucket();
    dot.className = 'gps-dot ' + bucket;
    label.textContent = 'GPS: ' + GpsManager.getAccuracyLabel();

    this._updateDistances();
    if (document.getElementById('hole-map-details').open) {
      HoleMap.updatePlayerPosition(pos.lat, pos.lng);
    }
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

  // === Scoring ===

  _initScoring() {
    const players = Storage.getPlayers();
    this.currentHoleScores = players.map(() => ({ strokes: 0, putts: 0 }));
    if (ShotTracker.hasActiveRound()) {
      this.scoringHole = ShotTracker.round.currentHole;
      this._loadHoleScores();
      // Restore in-progress hole scores that survived page reload (e.g. NFC tap)
      const live = Storage.getLiveScores();
      if (live && live.holeNumber === this.scoringHole && live.scores) {
        live.scores.forEach((s, i) => {
          if (this.currentHoleScores[i]) {
            this.currentHoleScores[i] = { strokes: s.strokes || 0, putts: s.putts || 0 };
          }
        });
      }
    } else {
      this.scoringHole = 1;
    }
  },

  _loadHoleScores() {
    if (!ShotTracker.round) return;
    const hole = ShotTracker.round.holes[this.scoringHole - 1];
    if (!hole || !hole.playerScores) return;
    hole.playerScores.forEach((ps, i) => {
      if (this.currentHoleScores[i]) {
        this.currentHoleScores[i] = { strokes: ps.strokes || 0, putts: ps.putts || 0 };
      }
    });
  },

  _bindShotTracker() {
    // Mark shot (GPS) — stays on GPS screen, just updates badge
    document.getElementById('btn-mark-shot').addEventListener('click', () => {
      this._handleMarkShot();
    });

    // Build club buttons (GPS shot club assignment)
    this._buildClubButtons();

    // Save hole button
    document.getElementById('btn-save-hole').addEventListener('click', () => {
      this._handleSaveHole();
    });

    // Scoring hole navigation
    document.getElementById('score-prev').addEventListener('click', () => {
      if (this.scoringHole > 1) {
        this.scoringHole--;
        this._loadHoleScores();
        this._renderScoringScreen();
      }
    });
    document.getElementById('score-next').addEventListener('click', () => {
      if (this.scoringHole < 18) {
        this.scoringHole++;
        const players = Storage.getPlayers();
        this.currentHoleScores = players.map(() => ({ strokes: 0, putts: 0 }));
        this._loadHoleScores();
        this._renderScoringScreen();
      }
    });

    // New round / share
    document.getElementById('btn-new-round').addEventListener('click', () => this._startNewRound());
    document.getElementById('btn-share-round').addEventListener('click', () => this._shareRound());
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
        this._updateShotsBadge();
      });
    });
  },

  _handleMarkShot() {
    if (!ShotTracker.hasActiveRound()) {
      ShotTracker.startRound(this.currentTee);
    }
    if (ShotTracker.round) {
      ShotTracker.round.currentHole = this.currentHole;
    }
    const shot = ShotTracker.markShot();
    if (!shot) {
      alert('Cannot mark shot: no GPS signal');
      return;
    }
    // Open the GPS shots section and show club selector
    const details = document.getElementById('gps-shots-details');
    details.open = true;
    document.getElementById('club-selector').classList.remove('hidden');
    this._updateShotsBadge();
    this._updateShotList();
    this._showScreen('screen-tracker');
  },

  _updateShotsBadge() {
    const badge = document.getElementById('shots-count-badge');
    if (!ShotTracker.round) { badge.textContent = '0'; return; }
    const holeData = ShotTracker.getCurrentHoleData();
    badge.textContent = holeData ? holeData.shots.length : '0';
  },

  _updateShotList() {
    const list = document.getElementById('shot-list');
    if (!ShotTracker.round) {
      list.innerHTML = '<div class="empty-msg">No GPS shots. Use MARK SHOT on the GPS screen.</div>';
      return;
    }
    const holeData = ShotTracker.getCurrentHoleData();
    if (!holeData || holeData.shots.length === 0) {
      list.innerHTML = '<div class="empty-msg">No GPS shots. Use MARK SHOT on the GPS screen.</div>';
      return;
    }
    list.innerHTML = holeData.shots.map(s => {
      const clubLabel = s.club || '(select club)';
      const distLabel = s.distanceFromPrevious != null ? s.distanceFromPrevious + 'm' : 'Tee';
      return '<div class="shot-item">' +
        '<span class="shot-num">#' + s.index + '</span>' +
        '<span class="shot-club">' + clubLabel + '</span>' +
        '<span class="shot-distance">' + distLabel + '</span>' +
      '</div>';
    }).join('');
  },

  _renderScoringScreen() {
    const players = Storage.getPlayers();
    const hole = CourseData.getHole(this.scoringHole);
    if (!hole) return;

    // Ensure scores array matches player count
    while (this.currentHoleScores.length < players.length) {
      this.currentHoleScores.push({ strokes: 0, putts: 0 });
    }

    document.getElementById('score-hole-label').textContent = 'Hole ' + this.scoringHole;
    document.getElementById('score-hole-sub').textContent = 'Par ' + hole.par + ' · SI ' + hole.si;

    const container = document.getElementById('player-score-cards');
    container.innerHTML = players.map((player, i) => {
      const s = this.currentHoleScores[i];
      const pts = Scoring.stablefordPoints(s.strokes, hole.par, hole.si, player.handicap);
      const ptsLabel = pts !== null ? pts + ' pts' : '— pts';
      const ptsCls = pts !== null ? 'player-card-pts pts-' + pts : 'player-card-pts';
      const received = Scoring.strokesReceived(player.handicap, hole.si);
      const hcpLabel = 'HCP ' + player.handicap + (received > 0 ? ' (+' + received + ')' : '');

      return '<div class="player-card">' +
        '<div class="player-card-header">' +
          '<span class="player-card-name">' + player.name + '</span>' +
          '<span class="player-card-hcp">' + hcpLabel + '</span>' +
          '<span class="' + ptsCls + '" id="score-pts-' + i + '">' + ptsLabel + '</span>' +
        '</div>' +
        '<div class="player-card-row">' +
          '<span class="player-card-label">Strokes</span>' +
          '<div class="counter-group">' +
            '<button class="counter-btn" data-player="' + i + '" data-field="strokes" data-delta="-1">−</button>' +
            '<span class="counter-value" id="score-strokes-' + i + '">' + s.strokes + '</span>' +
            '<button class="counter-btn" data-player="' + i + '" data-field="strokes" data-delta="1">+</button>' +
          '</div>' +
        '</div>' +
        '<div class="player-card-row">' +
          '<span class="player-card-label">Putts</span>' +
          '<div class="counter-group">' +
            '<button class="counter-btn" data-player="' + i + '" data-field="putts" data-delta="-1">−</button>' +
            '<span class="counter-value" id="score-putts-' + i + '">' + s.putts + '</span>' +
            '<button class="counter-btn" data-player="' + i + '" data-field="putts" data-delta="1">+</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    // Bind +/- buttons
    container.querySelectorAll('.counter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const pi = parseInt(btn.dataset.player);
        const field = btn.dataset.field;
        const delta = parseInt(btn.dataset.delta);
        this.currentHoleScores[pi][field] = Math.max(0, this.currentHoleScores[pi][field] + delta);
        this._updatePlayerCardLive(pi, players[pi], hole);
        Storage.saveLiveScores(this.scoringHole, this.currentHoleScores);
        this._renderScorecard();
        if (navigator.vibrate) navigator.vibrate(20);
      });
    });

    this._updateShotsBadge();
    this._updateShotList();
  },

  _updatePlayerCardLive(pi, player, hole) {
    const s = this.currentHoleScores[pi];
    document.getElementById('score-strokes-' + pi).textContent = s.strokes;
    document.getElementById('score-putts-' + pi).textContent = s.putts;

    const ptsEl = document.getElementById('score-pts-' + pi);
    const pts = Scoring.stablefordPoints(s.strokes, hole.par, hole.si, player.handicap);
    if (pts !== null) {
      ptsEl.textContent = pts + ' pts';
      ptsEl.className = 'player-card-pts pts-' + pts;
    } else {
      ptsEl.textContent = '— pts';
      ptsEl.className = 'player-card-pts';
    }
  },

  _handleSaveHole() {
    if (!ShotTracker.hasActiveRound()) {
      ShotTracker.startRound(this.currentTee);
    }

    const players = Storage.getPlayers();
    const hole = CourseData.getHole(this.scoringHole);

    const playerScores = this.currentHoleScores.map((s, i) => ({
      strokes: s.strokes,
      putts: s.putts,
      stablefordPoints: Scoring.stablefordPoints(s.strokes, hole.par, hole.si, players[i].handicap) || 0
    }));

    ShotTracker.saveHoleScores(this.scoringHole, playerScores);
    Storage.clearLiveScores();

    if (this.scoringHole < 18) {
      this.scoringHole++;
      this.currentHole = this.scoringHole;
      this.currentHoleScores = players.map(() => ({ strokes: 0, putts: 0 }));
      this._loadHoleScores();
      this._renderHoleInfo();
      this._renderScoringScreen();
      this._renderScorecard();
    } else {
      const summary = ShotTracker.endRound();
      this._stopPaceTimer();
      this._renderSummary(summary);
      this._showScreen('screen-summary');
    }
  },

  _renderLiveLeaderboard() {
    const el = document.getElementById('live-leaderboard');
    if (!el) return;
    const players = (ShotTracker.round && ShotTracker.round.players) || Storage.getPlayers();
    const holes = ShotTracker.round ? ShotTracker.round.holes : [];

    // Build per-player totals from completed holes + current live hole
    const standings = players.map((p, pi) => {
      let strokes = 0, par = 0, stableford = 0, holesPlayed = 0;
      for (const h of holes) {
        if (h.completed && h.playerScores && h.playerScores[pi]) {
          const ps = h.playerScores[pi];
          strokes += ps.strokes || 0;
          par += h.par;
          stableford += ps.stablefordPoints || 0;
          holesPlayed++;
        } else if (h.number === this.scoringHole) {
          const s = this.currentHoleScores[pi];
          if (s && s.strokes > 0) {
            strokes += s.strokes;
            par += h.par;
            stableford += Scoring.stablefordPoints(s.strokes, h.par, h.si, p.handicap) || 0;
            holesPlayed++;
          }
        }
      }
      const diff = strokes > 0 ? strokes - par : null;
      return { name: p.name, strokes, diff, stableford, holesPlayed };
    });

    // Sort by stableford desc, then diff asc
    standings.sort((a, b) => b.stableford - a.stableford || (a.diff || 0) - (b.diff || 0));

    el.innerHTML = standings.map((s, idx) => {
      const pos = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : (idx + 1) + '.';
      const diffStr = s.diff === null ? 'E' : s.diff === 0 ? 'E' : (s.diff > 0 ? '+' + s.diff : '' + s.diff);
      const diffCls = s.diff === null || s.diff === 0 ? '' : s.diff > 0 ? 'lb-over' : 'lb-under';
      const thru = s.holesPlayed > 0 ? 'Thru ' + s.holesPlayed : 'No scores';
      return '<div class="lb-row">' +
        '<span class="lb-pos">' + pos + '</span>' +
        '<div class="lb-info">' +
          '<span class="lb-name">' + s.name + '</span>' +
          '<span class="lb-thru">' + thru + '</span>' +
        '</div>' +
        '<div class="lb-scores">' +
          '<span class="lb-diff ' + diffCls + '">' + diffStr + '</span>' +
          '<span class="lb-pts">' + s.stableford + ' pts</span>' +
        '</div>' +
      '</div>';
    }).join('');
  },

  _renderScorecard() {
    const miniCard = document.getElementById('running-scorecard');
    if (!ShotTracker.round) {
      miniCard.innerHTML = '<div class="empty-msg">Save a hole to see scorecard</div>';
      this._renderLiveLeaderboard();
      return;
    }

    const players = ShotTracker.round.players || Storage.getPlayers();

    // Build header
    let html = '<table><tr><th>H</th><th>Par</th>';
    players.forEach(p => {
      html += '<th>' + p.name.substring(0, 4) + '</th><th>Pts</th>';
    });
    html += '</tr>';

    let playerFrontStrokes = players.map(() => 0);
    let playerFrontPts = players.map(() => 0);
    let playerBackStrokes = players.map(() => 0);
    let playerBackPts = players.map(() => 0);
    let frontPar = 0, backPar = 0;

    for (let i = 0; i < 18; i++) {
      const h = ShotTracker.round.holes[i];
      if (i === 9) {
        // OUT totals row
        html += '<tr><td><b>OUT</b></td><td><b>' + frontPar + '</b></td>';
        players.forEach((_, pi) => {
          html += '<td><b>' + (playerFrontStrokes[pi] || '-') + '</b></td>' +
                  '<td><b>' + (playerFrontPts[pi] || '-') + '</b></td>';
        });
        html += '</tr>';
      }

      if (i < 9) frontPar += h.par; else backPar += h.par;

      const isCurrentHole = (h.number === this.scoringHole);
      const liveScores = isCurrentHole ? this.currentHoleScores : null;
      const rowCls = isCurrentHole ? ' class="scorecard-current-hole"' : '';
      html += '<tr' + rowCls + '><td>' + h.number + '</td><td>' + h.par + '</td>';
      if (h.completed && h.playerScores) {
        h.playerScores.forEach((ps, pi) => {
          const diff = ps.strokes - h.par;
          const cls = diff <= -2 ? 'score-eagle' : diff === -1 ? 'score-birdie' : diff === 0 ? 'score-par' : diff === 1 ? 'score-bogey' : 'score-double';
          html += '<td class="' + cls + '">' + ps.strokes + '</td>' +
                  '<td>' + (ps.stablefordPoints || 0) + '</td>';
          if (i < 9) { playerFrontStrokes[pi] += ps.strokes; playerFrontPts[pi] += ps.stablefordPoints || 0; }
          else        { playerBackStrokes[pi]  += ps.strokes; playerBackPts[pi]  += ps.stablefordPoints || 0; }
        });
      } else if (liveScores) {
        liveScores.forEach((s, pi) => {
          const strokes = s.strokes || 0;
          const pts = strokes > 0 ? (Scoring.stablefordPoints(strokes, h.par, h.si, players[pi] ? players[pi].handicap : 0) || 0) : null;
          const diff = strokes - h.par;
          const cls = strokes > 0 ? (diff <= -2 ? 'score-eagle' : diff === -1 ? 'score-birdie' : diff === 0 ? 'score-par' : diff === 1 ? 'score-bogey' : 'score-double') : '';
          html += '<td class="' + cls + '">' + (strokes || '-') + '</td>' +
                  '<td>' + (pts !== null ? pts : '-') + '</td>';
          if (strokes > 0) {
            if (i < 9) { playerFrontStrokes[pi] += strokes; playerFrontPts[pi] += pts || 0; }
            else        { playerBackStrokes[pi]  += strokes; playerBackPts[pi]  += pts || 0; }
          }
        });
      } else {
        players.forEach(() => { html += '<td>-</td><td>-</td>'; });
      }
      html += '</tr>';
    }

    // IN totals
    html += '<tr><td><b>IN</b></td><td><b>' + backPar + '</b></td>';
    players.forEach((_, pi) => {
      html += '<td><b>' + (playerBackStrokes[pi] || '-') + '</b></td>' +
              '<td><b>' + (playerBackPts[pi] || '-') + '</b></td>';
    });
    html += '</tr>';

    // TOTAL row
    html += '<tr><td><b>TOT</b></td><td><b>' + (frontPar + backPar) + '</b></td>';
    players.forEach((_, pi) => {
      const totStr = (playerFrontStrokes[pi] + playerBackStrokes[pi]) || '-';
      const totPts = (playerFrontPts[pi] + playerBackPts[pi]) || '-';
      html += '<td><b>' + totStr + '</b></td><td><b>' + totPts + '</b></td>';
    });
    html += '</tr></table>';

    miniCard.innerHTML = html;
    this._renderLiveLeaderboard();
    this._renderFullScorecard();
  },

  _renderFullScorecard() {
    const holesEl    = document.getElementById('sc-holes');
    const totalsEl   = document.getElementById('sc-totals');
    const headersEl  = document.getElementById('sc-player-headers');
    const infoEl     = document.getElementById('sc-round-info');
    if (!holesEl) return;

    const round   = ShotTracker.round;
    const players = (round && round.players) || Storage.getPlayers();
    const course  = CourseData.getCourse();

    if (infoEl) infoEl.textContent = round ? (round.tee + ' Tees · ' + new Date(round.date).toLocaleDateString()) : 'Start a round to see scores';

    // Player header strip
    headersEl.innerHTML = '<div class="sc-ph-hole">H</div><div class="sc-ph-par">Par</div>' +
      players.map(p => '<div class="sc-ph-player">' + p.name.substring(0, 6) + '</div>').join('');

    // Accumulators
    const totStrokes  = players.map(() => 0);
    const totPts      = players.map(() => 0);
    const f9Strokes   = players.map(() => 0);
    const f9Pts       = players.map(() => 0);
    const b9Strokes   = players.map(() => 0);
    const b9Pts       = players.map(() => 0);
    let frontPar = 0, backPar = 0;

    let holesHtml = '';

    for (let i = 0; i < 18; i++) {
      const h = round ? round.holes[i] : CourseData.getHole(i + 1);
      if (!h) continue;
      const hNum = h.number || (i + 1);
      const hPar = h.par || 4;
      const hSi  = h.si  || (i + 1);

      if (i < 9) frontPar += hPar; else backPar += hPar;

      // OUT row between 9 and 10
      if (i === 9) {
        holesHtml += '<div class="sc-subtotal-row">' +
          '<div class="sc-hole-num">OUT</div><div class="sc-hole-par">' + frontPar + '</div>' +
          players.map((_, pi) => {
            const s = f9Strokes[pi], p = f9Pts[pi];
            return '<div class="sc-hole-score">' + (s || '-') + '<span class="sc-pts-inline">' + (s ? p : '') + '</span></div>';
          }).join('') +
        '</div>';
      }

      const isCurrentHole = round && hNum === this.scoringHole;
      const rowCls = isCurrentHole ? ' sc-hole-row sc-active-hole' : ' sc-hole-row';

      holesHtml += '<div class="' + rowCls + '">' +
        '<div class="sc-hole-num">' + hNum + '</div>' +
        '<div class="sc-hole-par">' + hPar + '</div>';

      if (round && h.completed && h.playerScores) {
        h.playerScores.forEach((ps, pi) => {
          const diff = ps.strokes - hPar;
          const cls  = diff <= -2 ? 'score-eagle' : diff === -1 ? 'score-birdie' : diff === 0 ? 'score-par' : diff === 1 ? 'score-bogey' : 'score-double';
          const pts  = ps.stablefordPoints || 0;
          holesHtml += '<div class="sc-hole-score"><span class="' + cls + '">' + ps.strokes + '</span><span class="sc-pts-inline">' + pts + 'p</span></div>';
          if (i < 9) { f9Strokes[pi] += ps.strokes; f9Pts[pi] += pts; }
          else        { b9Strokes[pi] += ps.strokes; b9Pts[pi] += pts; }
          totStrokes[pi] += ps.strokes;
          totPts[pi]     += pts;
        });
      } else if (isCurrentHole) {
        this.currentHoleScores.forEach((s, pi) => {
          const strokes = s.strokes || 0;
          const pts     = strokes > 0 ? (Scoring.stablefordPoints(strokes, hPar, hSi, players[pi] ? players[pi].handicap : 0) || 0) : null;
          const diff    = strokes - hPar;
          const cls     = strokes > 0 ? (diff <= -2 ? 'score-eagle' : diff === -1 ? 'score-birdie' : diff === 0 ? 'score-par' : diff === 1 ? 'score-bogey' : 'score-double') : '';
          holesHtml += '<div class="sc-hole-score"><span class="' + cls + '">' + (strokes || '·') + '</span>' + (pts !== null ? '<span class="sc-pts-inline">' + pts + 'p</span>' : '') + '</div>';
        });
      } else {
        players.forEach(() => { holesHtml += '<div class="sc-hole-score sc-blank">·</div>'; });
      }

      holesHtml += '</div>';
    }

    // IN row
    holesHtml += '<div class="sc-subtotal-row">' +
      '<div class="sc-hole-num">IN</div><div class="sc-hole-par">' + backPar + '</div>' +
      players.map((_, pi) => {
        const s = b9Strokes[pi], p = b9Pts[pi];
        return '<div class="sc-hole-score">' + (s || '-') + '<span class="sc-pts-inline">' + (s ? p : '') + '</span></div>';
      }).join('') +
    '</div>';

    holesEl.innerHTML = holesHtml;

    // TOTAL row
    totalsEl.innerHTML = '<div class="sc-total-row">' +
      '<div class="sc-hole-num">TOT</div><div class="sc-hole-par">' + (frontPar + backPar) + '</div>' +
      players.map((_, pi) => {
        const s = totStrokes[pi], p = totPts[pi];
        const diff = s > 0 ? s - (frontPar + backPar) : null;
        const diffStr = diff === null ? '' : diff === 0 ? 'E' : (diff > 0 ? '+' + diff : '' + diff);
        return '<div class="sc-hole-score sc-total-cell">' +
          '<span class="sc-total-strokes">' + (s || '-') + '</span>' +
          '<span class="sc-total-sub">' + (s ? diffStr + ' · ' + p + 'p' : '') + '</span>' +
        '</div>';
      }).join('') +
    '</div>';
  },

  // === Round Summary ===

  _renderSummary(roundData) {
    if (!roundData) return;
    // For in-progress rounds use live calculation; for completed use stored summary
    let summary = roundData.summary;
    if (!summary) {
      const saved = ShotTracker.round;
      ShotTracker.round = roundData;
      summary = ShotTracker.getRoundSummary();
      ShotTracker.round = saved;
    }
    if (!summary) return;

    document.getElementById('summary-date').textContent =
      new Date(roundData.date).toLocaleDateString() + ' — ' + roundData.tee + ' Tees';

    // Stableford leaderboard
    const lb = document.getElementById('summary-leaderboard');
    if (summary.leaderboard && summary.leaderboard.length > 0) {
      lb.innerHTML = summary.leaderboard.map((p, idx) => {
        const cls = idx === 0 ? 'leaderboard-row first' : 'leaderboard-row';
        const pos = idx === 0 ? '🏆' : (idx + 1) + '.';
        return '<div class="' + cls + '">' +
          '<span class="leaderboard-pos">' + pos + '</span>' +
          '<div style="flex:1">' +
            '<div class="leaderboard-name">' + p.name + '</div>' +
            '<div class="leaderboard-hcp">HCP ' + p.handicap + ' · ' + p.strokes + ' strokes</div>' +
          '</div>' +
          '<div style="text-align:right">' +
            '<div class="leaderboard-pts">' + p.stableford + '</div>' +
            '<div class="leaderboard-pts-label">points</div>' +
          '</div>' +
        '</div>';
      }).join('');
    } else {
      lb.innerHTML = '<div class="empty-msg">No scores recorded</div>';
    }

    // Stroke details table
    const strokeTable = document.getElementById('summary-stroke-table');
    if (summary.playerTotals && summary.playerTotals.length > 0) {
      let html = '<table><tr><th>Player</th><th>HCP</th><th>Front</th><th>Back</th><th>Total</th><th>Putts</th></tr>';
      summary.playerTotals.forEach(p => {
        const coursePar = 72;
        const sign = (p.strokes - coursePar) >= 0 ? '+' : '';
        html += '<tr>' +
          '<td>' + p.name + '</td>' +
          '<td>' + p.handicap + '</td>' +
          '<td>' + (p.front9Strokes || '-') + '</td>' +
          '<td>' + (p.back9Strokes || '-') + '</td>' +
          '<td><b>' + (p.strokes || '-') + '</b> (' + sign + (p.strokes - coursePar) + ')</td>' +
          '<td>' + (p.putts || '-') + '</td>' +
        '</tr>';
      });
      html += '</table>';
      strokeTable.innerHTML = html;
    }

    // Club stats
    const clubContainer = document.getElementById('club-stats');
    const clubEntries = Object.entries(summary.clubStats).sort((a, b) => b[1].avgDistance - a[1].avgDistance);
    clubContainer.innerHTML = clubEntries.length > 0 ? clubEntries.map(([club, stats]) =>
      '<div class="club-stat-row">' +
        '<span class="club-stat-name">' + club + '</span>' +
        '<span class="club-stat-avg">avg ' + stats.avgDistance + 'm</span>' +
        '<span class="club-stat-count">(' + stats.count + ' shots)</span>' +
      '</div>'
    ).join('') : '<div class="empty-msg">No GPS shots recorded</div>';

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
    this.scoringHole = 1;
    ShotTracker.startRound(this.currentTee);
    const players = Storage.getPlayers();
    this.currentHoleScores = players.map(() => ({ strokes: 0, putts: 0 }));
    this._renderHoleInfo();
    this._renderScoringScreen();
    this._renderScorecard();
    this._showScreen('screen-gps');
  },

  _shareRound() {
    const rounds = Storage.getRounds();
    const summary = ShotTracker.round
      ? ShotTracker.getRoundSummary()
      : (rounds.length > 0 ? rounds.slice(-1)[0].summary : null);

    if (!summary) { alert('No round data to share'); return; }

    let text = 'Atlantic Beach Links\n';
    text += new Date().toLocaleDateString() + '\n\n';

    if (summary.leaderboard && summary.leaderboard.length > 0) {
      text += 'STABLEFORD\n';
      summary.leaderboard.forEach((p, i) => {
        text += (i + 1) + '. ' + p.name + ' (HCP ' + p.handicap + '): ' + p.stableford + ' pts / ' + p.strokes + ' strokes\n';
      });
    }

    if (Object.keys(summary.clubStats).length > 0) {
      text += '\nCLUB DISTANCES\n';
      Object.entries(summary.clubStats)
        .sort((a, b) => b[1].avgDistance - a[1].avgDistance)
        .forEach(([club, stats]) => {
          text += club + ': avg ' + stats.avgDistance + 'm (' + stats.count + ' shots)\n';
        });
    }

    navigator.clipboard.writeText(text).then(() => {
      alert('Round summary copied to clipboard!');
    }).catch(() => {
      prompt('Copy this text:', text);
    });
  },

  // === Pace of Play ===

  _startPaceTimer() {
    if (this._paceTimer) { clearInterval(this._paceTimer); this._paceTimer = null; }
    const targetMins = parseInt(Storage.getSetting('paceTarget', '260'));
    const bar = document.getElementById('pace-bar');
    if (!targetMins || !ShotTracker.hasActiveRound()) { bar.classList.add('hidden'); return; }

    bar.classList.remove('hidden');
    this._updatePaceBar(targetMins);
    this._paceTimer = setInterval(() => this._updatePaceBar(targetMins), 10000);
  },

  _updatePaceBar(targetMins) {
    if (!ShotTracker.round) return;
    const started  = new Date(ShotTracker.round.date).getTime();
    const elapsed  = Math.floor((Date.now() - started) / 1000); // seconds
    const hole     = ShotTracker.round.currentHole || 1;
    const targetSec = targetMins * 60;
    const expectedSec = Math.round((hole - 1) / 18 * targetSec);
    const diffSec  = elapsed - expectedSec;

    // Format elapsed
    const h = Math.floor(elapsed / 3600);
    const m = Math.floor((elapsed % 3600) / 60);
    const elapsedStr = h > 0 ? h + 'h ' + m + 'm' : m + 'm';

    // Avg per hole
    const avgMin = hole > 1 ? Math.round(elapsed / 60 / (hole - 1)) : 0;
    const avgStr = hole > 1 ? avgMin + 'm/hole' : '—';

    // Status
    const statusEl = document.getElementById('pace-status');
    const absDiff  = Math.abs(Math.round(diffSec / 60));
    if (Math.abs(diffSec) < 120) {
      statusEl.textContent = 'On pace';
      statusEl.className   = 'pace-status pace-ok';
    } else if (diffSec > 0) {
      statusEl.textContent = absDiff + 'm slow';
      statusEl.className   = 'pace-status pace-slow';
    } else {
      statusEl.textContent = absDiff + 'm fast';
      statusEl.className   = 'pace-status pace-fast';
    }

    document.getElementById('pace-elapsed').textContent  = elapsedStr;
    document.getElementById('pace-hole-avg').textContent = avgStr;
  },

  _stopPaceTimer() {
    if (this._paceTimer) { clearInterval(this._paceTimer); this._paceTimer = null; }
    const bar = document.getElementById('pace-bar');
    if (bar) bar.classList.add('hidden');
  },

  // === Settings ===

  _bindSettings() {
    document.getElementById('btn-settings-close').addEventListener('click', () => {
      document.getElementById('settings-modal').classList.add('hidden');
      // Re-init scoring in case player list changed
      const players = Storage.getPlayers();
      this.currentHoleScores = players.map(() => ({ strokes: 0, putts: 0 }));
      this._loadHoleScores();
      this._renderScoringScreen();
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

    const paceSelect = document.getElementById('setting-pace');
    paceSelect.value = Storage.getSetting('paceTarget', '260');
    paceSelect.addEventListener('change', e => {
      Storage.setSetting('paceTarget', e.target.value);
      this._startPaceTimer();
    });

    // Show players when settings opens
    document.getElementById('nav-settings').addEventListener('click', () => {
      this._renderSettingsPlayers();
    }, { once: false });

    // Add player
    document.getElementById('btn-add-player').addEventListener('click', () => {
      const players = Storage.getPlayers();
      if (players.length >= 4) { alert('Maximum 4 players'); return; }
      players.push({ name: 'Player ' + (players.length + 1), handicap: 0 });
      Storage.savePlayers(players);
      this._renderSettingsPlayers();
    });

    // Render on first open
    this._renderSettingsPlayers();
  },

  _renderSettingsPlayers() {
    const players = Storage.getPlayers();
    const list = document.getElementById('settings-player-list');
    list.innerHTML = players.map((p, i) =>
      '<div class="settings-player-row">' +
        '<input class="player-name-input" type="text" value="' + p.name + '" data-index="' + i + '" placeholder="Name">' +
        '<input class="player-hcp-input" type="number" value="' + p.handicap + '" data-index="' + i + '" min="0" max="54" placeholder="HCP">' +
        (players.length > 1 ? '<button class="player-delete-btn" data-index="' + i + '">✕</button>' : '<span style="width:24px"></span>') +
      '</div>'
    ).join('');

    list.querySelectorAll('.player-name-input, .player-hcp-input').forEach(inp => {
      inp.addEventListener('change', () => this._savePlayersFromSettings());
    });
    list.querySelectorAll('.player-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const players = Storage.getPlayers();
        players.splice(parseInt(btn.dataset.index), 1);
        Storage.savePlayers(players);
        this._renderSettingsPlayers();
      });
    });
  },

  _savePlayersFromSettings() {
    const players = [];
    document.querySelectorAll('.settings-player-row').forEach(row => {
      const name = (row.querySelector('.player-name-input').value || 'Player').trim();
      const handicap = Math.max(0, Math.min(54, parseInt(row.querySelector('.player-hcp-input').value) || 0));
      players.push({ name, handicap });
    });
    Storage.savePlayers(players);
    // Update active round players so stableford recalculates immediately
    if (ShotTracker.round) {
      ShotTracker.round.players = players;
      ShotTracker._save();
    }
    this._renderScoringScreen();
    this._renderScorecard();
  },

  // === History ===

  _bindHistory() {
    // Render when tab is opened
    document.querySelector('.nav-btn[data-screen="screen-history"]').addEventListener('click', () => {
      this._renderHistory();
    });

    // Close round detail modal
    document.getElementById('btn-rd-close').addEventListener('click', () => {
      document.getElementById('round-detail-modal').classList.add('hidden');
    });
  },

  _buildLifetimeClubStats(rounds) {
    // Aggregate across all rounds using weighted average
    const map = {};
    let roundsWithShots = 0;
    for (const round of rounds) {
      if (!round.summary || !round.summary.clubStats) continue;
      const stats = round.summary.clubStats;
      if (Object.keys(stats).length === 0) continue;
      roundsWithShots++;
      for (const [club, s] of Object.entries(stats)) {
        if (!map[club]) map[club] = { totalDist: 0, count: 0, max: 0, min: Infinity };
        map[club].totalDist += s.avgDistance * s.count;
        map[club].count     += s.count;
        map[club].max        = Math.max(map[club].max, s.maxDistance);
        map[club].min        = Math.min(map[club].min, s.minDistance);
      }
    }
    const result = [];
    for (const [club, d] of Object.entries(map)) {
      result.push({
        club,
        avg:   Math.round(d.totalDist / d.count),
        max:   d.max,
        min:   d.min === Infinity ? 0 : d.min,
        count: d.count
      });
    }
    // Sort by CLUBS order, fallback to avg desc
    result.sort((a, b) => {
      const ia = CLUBS.indexOf(a.club);
      const ib = CLUBS.indexOf(b.club);
      if (ia !== -1 && ib !== -1) return ia - ib;
      return b.avg - a.avg;
    });
    return { stats: result, roundsWithShots };
  },

  _renderLifetimeClubs(rounds) {
    const container = document.getElementById('lifetime-clubs');
    const badge = document.getElementById('clubs-round-count');
    const { stats, roundsWithShots } = this._buildLifetimeClubStats(rounds);

    if (stats.length === 0) {
      badge.textContent = '';
      container.innerHTML = '<div class="empty-msg">Complete a round with GPS shots to see distances</div>';
      return;
    }

    badge.textContent = roundsWithShots + ' round' + (roundsWithShots !== 1 ? 's' : '');

    // Find longest club for bar scaling
    const maxAvg = Math.max(...stats.map(s => s.avg));

    container.innerHTML = stats.map(s => {
      const barWidth = Math.round((s.avg / maxAvg) * 100);
      const minPct   = Math.round(((s.min - 0) / maxAvg) * 100);
      const rangePct = Math.round(((s.max - s.min) / maxAvg) * 100);

      return '<div class="lifetime-club-row">' +
        '<span class="lifetime-club-name">' + s.club + '</span>' +
        '<div>' +
          '<span class="lifetime-club-avg">' + s.avg + '</span>' +
          '<span class="lifetime-club-avg-label">m avg</span>' +
        '</div>' +
        '<div class="lifetime-club-range">' +
          '<div style="font-size:10px;color:var(--text-muted)">' + s.min + '–' + s.max + 'm</div>' +
          '<div class="lifetime-club-bar-wrap">' +
            '<div class="lifetime-club-bar" style="margin-left:' + minPct + '%;width:' + Math.max(rangePct, 2) + '%"></div>' +
            '<div class="lifetime-club-bar-avg" style="left:' + barWidth + '%"></div>' +
          '</div>' +
        '</div>' +
        '<div class="lifetime-club-meta">' + s.count + ' shots</div>' +
      '</div>';
    }).join('');
  },

  _renderHistory() {
    const rounds = Storage.getRounds().slice().reverse(); // newest first
    const countEl = document.getElementById('history-count');
    const list = document.getElementById('history-list');

    this._renderLifetimeClubs(rounds);

    countEl.textContent = rounds.length + ' round' + (rounds.length !== 1 ? 's' : '');

    if (rounds.length === 0) {
      list.innerHTML = '<div class="empty-msg">No completed rounds yet. Finish a round to see it here.</div>';
      return;
    }

    list.innerHTML = rounds.map(round => {
      const summary = round.summary;
      const date = new Date(round.date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
      const teeLabel = round.tee + ' Tees';
      const players = round.players || [];
      const playerNames = players.map(p => p.name).join(', ');

      let winnerHtml = '';
      let ptsHtml = '<div class="history-card-pts">-</div><div class="history-card-pts-label">pts</div>';

      if (summary && summary.leaderboard && summary.leaderboard.length > 0) {
        const winner = summary.leaderboard[0];
        winnerHtml = '<div class="history-card-winner">🏆 ' + winner.name + ' — ' + winner.stableford + ' pts</div>';
        ptsHtml = '<div class="history-card-pts">' + winner.stableford + '</div><div class="history-card-pts-label">pts</div>';
      }

      return '<div class="history-card">' +
        '<div class="history-card-info">' +
          '<div class="history-card-date">' + date + '</div>' +
          '<div class="history-card-sub">' + teeLabel + ' · ' + (summary ? summary.holesPlayed + ' holes' : '?') + (playerNames ? ' · ' + playerNames : '') + '</div>' +
          winnerHtml +
        '</div>' +
        '<div>' + ptsHtml + '</div>' +
        '<div class="history-card-actions">' +
          '<button class="btn-view-round" data-id="' + round.id + '">View</button>' +
          '<button class="btn-delete-round" data-id="' + round.id + '">Delete</button>' +
        '</div>' +
      '</div>';
    }).join('');

    list.querySelectorAll('.btn-view-round').forEach(btn => {
      btn.addEventListener('click', () => {
        const round = rounds.find(r => r.id === btn.dataset.id);
        if (round) this._showRoundDetail(round);
      });
    });

    list.querySelectorAll('.btn-delete-round').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!confirm('Delete this round?')) return;
        Storage.deleteRound(btn.dataset.id);
        this._renderHistory();
      });
    });
  },

  _showRoundDetail(round) {
    const summary = round.summary;
    const date = new Date(round.date).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

    document.getElementById('rd-date').textContent = date + ' — ' + round.tee + ' Tees';
    document.getElementById('rd-course').textContent = round.courseName || 'Atlantic Beach Links';

    // Leaderboard
    const lb = document.getElementById('rd-leaderboard');
    if (summary && summary.leaderboard && summary.leaderboard.length > 0) {
      lb.innerHTML = summary.leaderboard.map((p, idx) => {
        const cls = idx === 0 ? 'leaderboard-row first' : 'leaderboard-row';
        const pos = idx === 0 ? '🏆' : (idx + 1) + '.';
        return '<div class="' + cls + '">' +
          '<span class="leaderboard-pos">' + pos + '</span>' +
          '<div style="flex:1"><div class="leaderboard-name">' + p.name + '</div>' +
          '<div class="leaderboard-hcp">HCP ' + p.handicap + ' · ' + p.strokes + ' strokes</div></div>' +
          '<div style="text-align:right"><div class="leaderboard-pts">' + p.stableford + '</div>' +
          '<div class="leaderboard-pts-label">points</div></div>' +
        '</div>';
      }).join('');
    } else {
      lb.innerHTML = '<div class="empty-msg">No score data</div>';
    }

    // Scorecard
    const sc = document.getElementById('rd-scorecard');
    const players = round.players || [];
    let html = '<table><tr><th>H</th><th>Par</th>';
    players.forEach(p => { html += '<th>' + p.name.substring(0, 4) + '</th><th>Pts</th>'; });
    html += '</tr>';
    round.holes.forEach(h => {
      if (!h.completed) return;
      const diff = h.scoreToPar;
      html += '<tr><td>' + h.number + '</td><td>' + h.par + '</td>';
      if (h.playerScores) {
        h.playerScores.forEach(ps => {
          const d = ps.strokes - h.par;
          const cls = d <= -2 ? 'score-eagle' : d === -1 ? 'score-birdie' : d === 0 ? 'score-par' : d === 1 ? 'score-bogey' : 'score-double';
          html += '<td class="' + cls + '">' + ps.strokes + '</td><td>' + (ps.stablefordPoints || 0) + '</td>';
        });
      } else {
        players.forEach(() => { html += '<td>-</td><td>-</td>'; });
      }
      html += '</tr>';
    });
    html += '</table>';
    sc.innerHTML = html;

    // Club stats
    const clubs = document.getElementById('rd-clubs');
    if (summary && summary.clubStats && Object.keys(summary.clubStats).length > 0) {
      clubs.innerHTML = Object.entries(summary.clubStats)
        .sort((a, b) => b[1].avgDistance - a[1].avgDistance)
        .map(([club, s]) =>
          '<div class="club-stat-row"><span class="club-stat-name">' + club + '</span>' +
          '<span class="club-stat-avg">avg ' + s.avgDistance + 'm</span>' +
          '<span class="club-stat-count">(' + s.count + ' shots)</span></div>'
        ).join('');
    } else {
      clubs.innerHTML = '<div class="empty-msg">No GPS shots recorded</div>';
    }

    document.getElementById('btn-rd-edit').onclick = () => this._openScoreEdit(round);
    document.getElementById('round-detail-modal').classList.remove('hidden');
  },

  _openScoreEdit(round) {
    this._editRound = round;
    this._editHole  = 1;

    // Deep-copy hole scores so we can cancel without side effects
    this._editScores = round.holes.map(h => ({
      completed: h.completed,
      playerScores: h.playerScores
        ? h.playerScores.map(ps => ({ strokes: ps.strokes || 0, putts: ps.putts || 0 }))
        : (round.players || []).map(() => ({ strokes: 0, putts: 0 }))
    }));

    document.getElementById('edit-modal-title').textContent = 'Edit — ' + (round.courseName || 'Round');
    this._renderEditHole();

    document.getElementById('edit-prev').onclick = () => {
      if (this._editHole > 1) { this._editHole--; this._renderEditHole(); }
    };
    document.getElementById('edit-next').onclick = () => {
      if (this._editHole < 18) { this._editHole++; this._renderEditHole(); }
    };
    document.getElementById('btn-edit-save-hole').onclick = () => this._saveEditHole();
    document.getElementById('btn-edit-done').onclick     = () => this._finishScoreEdit();
    document.getElementById('btn-edit-close').onclick    = () => {
      document.getElementById('score-edit-modal').classList.add('hidden');
    };

    document.getElementById('score-edit-modal').classList.remove('hidden');
  },

  _renderEditHole() {
    const h       = CourseData.getHole(this._editHole);
    const players = this._editRound.players || [];
    const scores  = this._editScores[this._editHole - 1].playerScores;

    document.getElementById('edit-hole-label').textContent = 'Hole ' + this._editHole;
    document.getElementById('edit-hole-sub').textContent   = 'Par ' + (h ? h.par : 4) + ' · SI ' + (h ? h.si : this._editHole);

    const container = document.getElementById('edit-player-cards');
    container.innerHTML = players.map((p, i) => {
      const s = scores[i] || { strokes: 0, putts: 0 };
      return '<div class="player-card">' +
        '<div class="player-card-header"><span class="player-card-name">' + p.name + '</span></div>' +
        '<div class="player-card-row"><span class="player-card-label">Strokes</span>' +
          '<div class="counter-group">' +
            '<button class="edit-counter" data-pi="' + i + '" data-field="strokes" data-delta="-1">−</button>' +
            '<span class="counter-value" id="edit-strokes-' + i + '">' + s.strokes + '</span>' +
            '<button class="edit-counter" data-pi="' + i + '" data-field="strokes" data-delta="1">+</button>' +
          '</div></div>' +
        '<div class="player-card-row"><span class="player-card-label">Putts</span>' +
          '<div class="counter-group">' +
            '<button class="edit-counter" data-pi="' + i + '" data-field="putts" data-delta="-1">−</button>' +
            '<span class="counter-value" id="edit-putts-' + i + '">' + s.putts + '</span>' +
            '<button class="edit-counter" data-pi="' + i + '" data-field="putts" data-delta="1">+</button>' +
          '</div></div>' +
      '</div>';
    }).join('');

    container.querySelectorAll('.edit-counter').forEach(btn => {
      btn.addEventListener('click', () => {
        const pi    = parseInt(btn.dataset.pi);
        const field = btn.dataset.field;
        const delta = parseInt(btn.dataset.delta);
        scores[pi][field] = Math.max(0, scores[pi][field] + delta);
        document.getElementById('edit-' + field + '-' + pi).textContent = scores[pi][field];
        if (navigator.vibrate) navigator.vibrate(20);
      });
    });
  },

  _saveEditHole() {
    const holeIdx = this._editHole - 1;
    const h       = CourseData.getHole(this._editHole);
    const players = this._editRound.players || [];
    const scores  = this._editScores[holeIdx].playerScores;

    const playerScores = scores.map((s, i) => ({
      strokes: s.strokes,
      putts:   s.putts,
      stablefordPoints: Scoring.stablefordPoints(s.strokes, h ? h.par : 4, h ? h.si : this._editHole, players[i] ? players[i].handicap : 0) || 0
    }));

    const hole = this._editRound.holes[holeIdx];
    hole.playerScores  = playerScores;
    hole.completed     = playerScores.some(ps => ps.strokes > 0);
    if (playerScores.length > 0) {
      hole.totalStrokes = playerScores[0].strokes;
      hole.putts        = playerScores[0].putts;
      hole.scoreToPar   = playerScores[0].strokes - (h ? h.par : 4);
    }

    // Advance to next hole automatically
    if (this._editHole < 18) { this._editHole++; this._renderEditHole(); }
    if (navigator.vibrate) navigator.vibrate(50);
  },

  _finishScoreEdit() {
    // Recalculate summary and persist
    this._editRound.summary = (() => {
      const saved = ShotTracker.round;
      ShotTracker.round = this._editRound;
      const s = ShotTracker.getRoundSummary();
      ShotTracker.round = saved;
      return s;
    })();
    Storage.saveRound(this._editRound);
    document.getElementById('score-edit-modal').classList.add('hidden');
    // Refresh the detail view with updated data
    this._showRoundDetail(this._editRound);
    this._renderHistory();
  },

  // === NFC ===

  _handleNfcUrlTag() {
    const params = new URLSearchParams(window.location.search);
    const club = params.get('club');
    if (!club) return;

    // Clean URL immediately so refresh doesn't re-trigger
    window.history.replaceState({}, '', window.location.pathname);

    // Show toast immediately so user knows it worked
    this._showNfcToast('⛳ ' + club + ' — logging...');

    // Auto-start round if needed
    if (!ShotTracker.hasActiveRound()) {
      ShotTracker.startRound(this.currentTee);
    }
    if (ShotTracker.round) {
      ShotTracker.round.currentHole = this.currentHole;
    }

    // Record shot now (GPS may be null — that's ok)
    const shot = ShotTracker.markShot();
    if (shot) {
      ShotTracker.setClubForLastShot(club);
      this._incrementPlayerStroke(0);
      this._showNfcToast('⛳ ' + club + ' — shot ' + this.currentHoleScores[0].strokes);
      this._updateShotsBadge();
      this._updateShotList();
      if (navigator.vibrate) navigator.vibrate(80);
    } else {
      setTimeout(() => {
        const s2 = ShotTracker.markShot();
        if (s2) {
          ShotTracker.setClubForLastShot(club);
          this._incrementPlayerStroke(0);
          this._showNfcToast('⛳ ' + club + ' — shot ' + this.currentHoleScores[0].strokes);
          this._updateShotsBadge();
        } else {
          this._showNfcToast('⛳ ' + club + ' — tap again');
        }
      }, 800);
    }
  },

  _incrementPlayerStroke(playerIndex) {
    if (!this.currentHoleScores[playerIndex]) return;
    this.currentHoleScores[playerIndex].strokes++;
    Storage.saveLiveScores(this.scoringHole, this.currentHoleScores);
    this._renderScoringScreen();
    this._renderScorecard();
  },

  _showNfcToast(message) {
    let toast = document.getElementById('nfc-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'nfc-toast';
      toast.className = 'nfc-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = '⛳ ' + message + ' logged';
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 2500);
  },

  _bindNfc() {
    const modal = document.getElementById('nfc-modal');

    // Populate club select
    document.getElementById('nfc-club-select').innerHTML =
      CLUBS.map(c => '<option value="' + c + '">' + c + '</option>').join('');

    // Open modal
    document.getElementById('btn-nfc-setup-open').addEventListener('click', () => {
      document.getElementById('settings-modal').classList.add('hidden');
      NfcManager.setPlayMode();
      this._setNfcRegisterStatus('');
      this._renderNfcTagList();
      // Show correct step
      if (NfcManager.scanning) {
        this._showNfcStep('register');
      } else {
        this._showNfcStep('enable');
      }
      modal.classList.remove('hidden');
    });

    // Close modal
    document.getElementById('btn-nfc-modal-close').addEventListener('click', () => {
      NfcManager.setPlayMode();
      this._setNfcRegisterStatus('');
      modal.classList.add('hidden');
    });

    // Step 1: ENABLE NFC button — must be called from user gesture
    document.getElementById('btn-nfc-enable').addEventListener('click', async () => {
      if (!NfcManager.isSupported()) {
        this._showNfcEnableError('NFC not supported. Use Chrome on Android.');
        return;
      }
      const btn = document.getElementById('btn-nfc-enable');
      btn.textContent = 'Activating...';
      btn.disabled = true;

      const result = await NfcManager.start((uid, club) => {
        this._handleNfcShot(uid, club);
      });

      btn.textContent = 'ENABLE NFC';
      btn.disabled = false;

      if (result.ok) {
        this._showNfcActiveBar(true);
        this._showNfcStep('register');
      } else {
        this._showNfcEnableError(result.error);
      }
    });

    // Step 2: TAP TAG TO REGISTER
    document.getElementById('btn-nfc-register').addEventListener('click', () => {
      const club = document.getElementById('nfc-club-select').value;
      this._setNfcRegisterStatus('Hold phone to the ' + club + ' tag...', 'waiting');

      NfcManager.setRegisterMode((uid) => {
        NfcManager.mapTagToClub(uid, club);
        NfcManager.setPlayMode();
        this._setNfcRegisterStatus(club + ' registered! ✓', 'success');
        this._renderNfcTagList();
        if (navigator.vibrate) navigator.vibrate([50, 50, 100]);
      });
    });
  },

  _showNfcStep(step) {
    document.getElementById('nfc-step-enable').classList.toggle('hidden', step !== 'enable');
    document.getElementById('nfc-step-register').classList.toggle('hidden', step !== 'register');
  },

  _showNfcEnableError(msg) {
    const el = document.getElementById('nfc-enable-error');
    el.textContent = msg;
    el.className = 'nfc-register-status error';
    el.classList.remove('hidden');
  },

  _handleNfcShot(uid, club) {
    // Auto-start round if needed
    if (!ShotTracker.hasActiveRound()) {
      ShotTracker.startRound(this.currentTee);
    }
    if (ShotTracker.round) {
      ShotTracker.round.currentHole = this.currentHole;
    }

    const shot = ShotTracker.markShot();
    if (!shot) return;

    if (club) {
      ShotTracker.setClubForLastShot(club);
      // Hide club selector — club already known
      document.getElementById('club-selector').classList.add('hidden');
    } else {
      // Unknown tag — show club selector so user can still assign
      document.getElementById('club-selector').classList.remove('hidden');
    }

    document.getElementById('end-hole-section').classList.add('hidden');
    this._renderTrackerScreen();
    this._showScreen('screen-tracker');

    // Brief vibrate to confirm
    if (navigator.vibrate) navigator.vibrate(80);
  },

  _showNfcActiveBar(show) {
    const bar = document.getElementById('nfc-active-bar');
    if (show) {
      bar.classList.remove('hidden');
      document.getElementById('nfc-gps-dot').className = 'nfc-dot active';
    } else {
      bar.classList.add('hidden');
    }
  },

  _renderNfcTagList() {
    const list = document.getElementById('nfc-tag-list');
    const mappings = NfcManager.getAllMappings();
    if (mappings.length === 0) {
      list.innerHTML = '<div class="empty-msg">No clubs registered yet</div>';
      return;
    }
    list.innerHTML = mappings.map(({ uid, club }) =>
      '<div class="nfc-tag-item">' +
        '<span class="nfc-tag-club">' + club + '</span>' +
        '<span class="nfc-tag-uid">' + uid + '</span>' +
        '<button class="nfc-tag-delete" data-uid="' + uid + '">&#x2715;</button>' +
      '</div>'
    ).join('');
    list.querySelectorAll('.nfc-tag-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        NfcManager.removeTag(btn.dataset.uid);
        this._renderNfcTagList();
      });
    });
  },

  _updateNfcStatusBadge() {
    const dot = document.getElementById('nfc-dot');
    const label = document.getElementById('nfc-status-label');
    if (!NfcManager.isSupported()) {
      dot.className = 'nfc-dot error';
      label.textContent = 'Not supported';
    } else if (NfcManager.scanning) {
      dot.className = 'nfc-dot active';
      label.textContent = 'Ready';
    } else {
      dot.className = 'nfc-dot error';
      label.textContent = 'Not scanning';
    }
  },

  _setNfcRegisterStatus(msg, type) {
    const el = document.getElementById('nfc-register-status');
    if (!msg) {
      el.classList.add('hidden');
      el.className = 'nfc-register-status hidden';
      el.textContent = '';
      return;
    }
    el.textContent = msg;
    el.className = 'nfc-register-status ' + (type || '');
    el.classList.remove('hidden');
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
