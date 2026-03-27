/* === localStorage Abstraction === */

const Storage = {
  _get(key) {
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : null;
    } catch (e) {
      console.error('Storage read error:', key, e);
      return null;
    }
  },

  _set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Storage write error:', key, e);
    }
  },

  // --- Course Coordinate Overrides ---

  getMappedCoordinates(courseId) {
    return this._get('course_' + courseId + '_coords');
  },

  saveMappedCoordinates(courseId, holes) {
    this._set('course_' + courseId + '_coords', holes);
  },

  // --- Rounds ---

  getRounds(courseId) {
    const rounds = this._get('rounds') || [];
    if (courseId) return rounds.filter(r => r.courseId === courseId);
    return rounds;
  },

  saveRound(round) {
    const rounds = this._get('rounds') || [];
    const idx = rounds.findIndex(r => r.id === round.id);
    if (idx >= 0) {
      rounds[idx] = round;
    } else {
      rounds.push(round);
    }
    this._set('rounds', rounds);
  },

  deleteRound(roundId) {
    const rounds = (this._get('rounds') || []).filter(r => r.id !== roundId);
    this._set('rounds', rounds);
  },

  getCurrentRound() {
    return this._get('current_round');
  },

  saveCurrentRound(round) {
    this._set('current_round', round);
  },

  clearCurrentRound() {
    localStorage.removeItem('current_round');
  },

  // --- In-progress hole scores (survives page reload) ---

  getLiveScores() {
    return this._get('live_scores'); // { holeNumber, scores: [{strokes,putts},...] }
  },

  saveLiveScores(holeNumber, scores) {
    this._set('live_scores', { holeNumber, scores });
  },

  clearLiveScores() {
    localStorage.removeItem('live_scores');
  },

  // --- Players ---

  getPlayers() {
    return this._get('players') || [{ name: 'Player 1', handicap: 0 }];
  },

  savePlayers(players) {
    this._set('players', players);
  },

  // --- NFC Tag Mappings ---

  getNfcTagMap() {
    return this._get('nfc_tags') || {};
  },

  saveNfcTagMap(map) {
    this._set('nfc_tags', map);
  },

  // --- Settings ---

  getSetting(key, defaultVal) {
    const settings = this._get('settings') || {};
    return settings[key] !== undefined ? settings[key] : defaultVal;
  },

  setSetting(key, value) {
    const settings = this._get('settings') || {};
    settings[key] = value;
    this._set('settings', settings);
  }
};
