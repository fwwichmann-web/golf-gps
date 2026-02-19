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
    this.round = {
      id: 'r_' + Date.now(),
      courseId: course.id,
      courseName: course.name,
      tee: tee,
      date: new Date().toISOString(),
      status: 'in_progress',
      currentHole: 1,
      holes: []
    };
    for (let i = 1; i <= 18; i++) {
      const hole = CourseData.getHole(i);
      this.round.holes.push({
        number: i,
        par: hole ? hole.par : 4,
        shots: [],
        putts: null,
        totalStrokes: 0,
        scoreToPar: null,
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

  markShot() {
    if (!this.round) return null;
    const pos = GpsManager.getLastPosition();
    if (!pos) return null;

    const holeData = this.getCurrentHoleData();
    const shotIndex = holeData.shots.length + 1;

    let distFromPrev = null;
    if (holeData.shots.length > 0) {
      const prev = holeData.shots[holeData.shots.length - 1];
      distFromPrev = Math.round(Distance.haversineMeters(prev.lat, prev.lng, pos.lat, pos.lng));
    }

    const shot = {
      index: shotIndex,
      lat: pos.lat,
      lng: pos.lng,
      timestamp: new Date().toISOString(),
      club: null,
      distanceFromPrevious: distFromPrev
    };

    holeData.shots.push(shot);
    holeData.totalStrokes = holeData.shots.length;
    this._save();

    // Haptic feedback
    if (navigator.vibrate) navigator.vibrate(50);

    return shot;
  },

  setClubForLastShot(club) {
    if (!this.round) return;
    const holeData = this.getCurrentHoleData();
    if (holeData.shots.length === 0) return;
    holeData.shots[holeData.shots.length - 1].club = club;
    this.lastClub = club;
    this._save();
  },

  endHole(putts) {
    if (!this.round) return;
    const holeData = this.getCurrentHoleData();
    holeData.putts = putts;
    holeData.totalStrokes = holeData.shots.length + putts;
    holeData.scoreToPar = holeData.totalStrokes - holeData.par;
    holeData.completed = true;

    if (this.round.currentHole < 18) {
      this.round.currentHole++;
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
    let totalStrokes = 0;
    let totalPutts = 0;
    let frontStrokes = 0;
    let backStrokes = 0;
    let frontPar = 0;
    let backPar = 0;
    let holesPlayed = 0;
    const clubMap = {};

    for (const hole of this.round.holes) {
      if (!hole.completed) continue;
      holesPlayed++;
      totalStrokes += hole.totalStrokes;
      totalPutts += hole.putts || 0;

      if (hole.number <= 9) {
        frontStrokes += hole.totalStrokes;
        frontPar += hole.par;
      } else {
        backStrokes += hole.totalStrokes;
        backPar += hole.par;
      }

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

    return {
      holesPlayed,
      totalStrokes,
      scoreToPar: totalStrokes - 72,
      totalPutts,
      frontStrokes,
      frontScoreToPar: frontStrokes - frontPar,
      backStrokes,
      backScoreToPar: backStrokes - backPar,
      clubStats
    };
  },

  _save() {
    Storage.saveCurrentRound(this.round);
  }
};
