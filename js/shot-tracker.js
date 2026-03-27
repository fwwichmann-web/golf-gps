/* === Shot Tracker === */

const CLUBS = [
  'Driver', '3 Wood', '5 Wood', '4 Hybrid',
  '4 Iron', '5 Iron', '6 Iron', '7 Iron', '8 Iron', '9 Iron',
  'PW', 'GW', 'SW', 'LW', 'Putter'
];

const ShotTracker = {
  round: null,
  lastClub: 'Driver',

  startRound(tee) {
    const course = CourseData.getCourse();
    const players = Storage.getPlayers();
    this.round = {
      id: 'r_' + Date.now(),
      courseId: course.id,
      courseName: course.name,
      tee: tee,
      date: new Date().toISOString(),
      status: 'in_progress',
      currentHole: 1,
      players: players.map(p => ({ name: p.name, handicap: p.handicap })),
      holes: []
    };
    for (let i = 1; i <= 18; i++) {
      const hole = CourseData.getHole(i);
      this.round.holes.push({
        number: i,
        par: hole ? hole.par : 4,
        si: hole ? hole.si : i,
        shots: [],
        playerScores: null,   // set by saveHoleScores()
        completed: false
      });
    }
    Storage.saveCurrentRound(this.round);
    return this.round;
  },

  loadRound() {
    this.round = Storage.getCurrentRound();
    return this.round;
  },

  hasActiveRound() {
    if (this.round && this.round.status === 'in_progress') return true;
    const saved = Storage.getCurrentRound();
    if (saved && saved.status === 'in_progress') {
      this.round = saved;
      return true;
    }
    return false;
  },

  getCurrentHoleData() {
    if (!this.round) return null;
    return this.round.holes[this.round.currentHole - 1];
  },

  // --- GPS Shot Tracking (for club distance stats) ---

  markShot() {
    if (!this.round) return null;
    const pos = GpsManager.getLastPosition(); // may be null — shot still recorded

    const holeData = this.getCurrentHoleData();
    const shotIndex = holeData.shots.length + 1;

    let distFromPrev = null;
    if (pos && holeData.shots.length > 0) {
      const prev = holeData.shots[holeData.shots.length - 1];
      if (prev.lat && prev.lng) {
        distFromPrev = Math.round(Distance.haversineMeters(prev.lat, prev.lng, pos.lat, pos.lng));
      }
    }

    const shot = {
      index: shotIndex,
      lat: pos ? pos.lat : null,
      lng: pos ? pos.lng : null,
      timestamp: new Date().toISOString(),
      club: null,
      distanceFromPrevious: distFromPrev
    };

    holeData.shots.push(shot);
    this._save();
    if (navigator.vibrate) navigator.vibrate(50);
    return shot;
  },

  /**
   * If the last shot has no GPS position, update it once GPS is available.
   * Called from GpsManager's position update callback.
   */
  updateLastShotGps(pos) {
    if (!this.round || !pos) return false;
    const holeData = this.getCurrentHoleData();
    if (!holeData || holeData.shots.length === 0) return false;
    const last = holeData.shots[holeData.shots.length - 1];
    if (last.lat !== null) return false; // already has GPS

    last.lat = pos.lat;
    last.lng = pos.lng;

    // Recalculate distance from previous shot
    if (holeData.shots.length > 1) {
      const prev = holeData.shots[holeData.shots.length - 2];
      if (prev.lat && prev.lng) {
        last.distanceFromPrevious = Math.round(
          Distance.haversineMeters(prev.lat, prev.lng, pos.lat, pos.lng)
        );
      }
    }

    this._save();
    return true;
  },

  setClubForLastShot(club) {
    if (!this.round) return;
    const holeData = this.getCurrentHoleData();
    if (holeData.shots.length === 0) return;
    holeData.shots[holeData.shots.length - 1].club = club;
    this.lastClub = club;
    this._save();
  },

  // --- Scoring ---

  /**
   * Save scores for a hole and advance the round.
   * playerScores: [{strokes, putts, stablefordPoints}, ...]
   */
  saveHoleScores(holeNumber, playerScores) {
    if (!this.round) return;
    const hole = this.round.holes[holeNumber - 1];
    hole.playerScores = playerScores;
    hole.completed = true;

    // Keep backward-compat fields from player 0
    if (playerScores.length > 0) {
      const p0 = playerScores[0];
      hole.totalStrokes = p0.strokes;
      hole.putts = p0.putts;
      hole.scoreToPar = p0.strokes - hole.par;
    }

    if (holeNumber < 18) {
      this.round.currentHole = holeNumber + 1;
    }
    this._save();
  },

  endRound() {
    if (!this.round) return null;
    this.round.status = 'completed';
    this.round.summary = this.getRoundSummary();
    Storage.saveRound(this.round);
    Storage.clearCurrentRound();
    const summary = this.round;
    this.round = null;
    return summary;
  },

  getRoundSummary() {
    if (!this.round) return null;

    const players = this.round.players || Storage.getPlayers();
    const course = CourseData.getCourse();

    // Per-player accumulators
    const totals = players.map(p => ({
      name: p.name,
      handicap: p.handicap,
      strokes: 0,
      putts: 0,
      stableford: 0,
      front9Strokes: 0,
      back9Strokes: 0,
      front9Stableford: 0,
      back9Stableford: 0
    }));

    let holesPlayed = 0;
    const clubMap = {};

    for (const hole of this.round.holes) {
      if (!hole.completed || !hole.playerScores) continue;
      holesPlayed++;

      hole.playerScores.forEach((ps, i) => {
        if (!totals[i]) return;
        totals[i].strokes    += ps.strokes || 0;
        totals[i].putts      += ps.putts || 0;
        totals[i].stableford += ps.stablefordPoints || 0;
        if (hole.number <= 9) {
          totals[i].front9Strokes    += ps.strokes || 0;
          totals[i].front9Stableford += ps.stablefordPoints || 0;
        } else {
          totals[i].back9Strokes    += ps.strokes || 0;
          totals[i].back9Stableford += ps.stablefordPoints || 0;
        }
      });

      // Club distance stats from GPS shots (player 0)
      for (const shot of hole.shots) {
        if (!shot.club || shot.club === 'Putter') continue;
        if (shot.distanceFromPrevious == null) continue;
        if (!clubMap[shot.club]) {
          clubMap[shot.club] = { count: 0, total: 0, max: 0, min: Infinity };
        }
        const c = clubMap[shot.club];
        c.count++;
        c.total += shot.distanceFromPrevious;
        c.max = Math.max(c.max, shot.distanceFromPrevious);
        c.min = Math.min(c.min, shot.distanceFromPrevious);
      }
    }

    const clubStats = {};
    for (const [club, data] of Object.entries(clubMap)) {
      clubStats[club] = {
        count: data.count,
        avgDistance: Math.round(data.total / data.count),
        maxDistance: data.max,
        minDistance: data.min === Infinity ? 0 : data.min
      };
    }

    // Sort players by stableford descending for leaderboard
    const leaderboard = [...totals].sort((a, b) => b.stableford - a.stableford);

    const p0 = totals[0] || { strokes: 0, putts: 0, stableford: 0, front9Strokes: 0, back9Strokes: 0 };

    return {
      holesPlayed,
      playerTotals: totals,
      leaderboard,
      // backward compat
      totalStrokes: p0.strokes,
      scoreToPar: p0.strokes - course.par,
      totalPutts: p0.putts,
      frontStrokes: p0.front9Strokes,
      backStrokes: p0.back9Strokes,
      clubStats
    };
  },

  _save() {
    Storage.saveCurrentRound(this.round);
  }
};
