/* === Stableford & Scoring Calculator === */

const Scoring = {

  /**
   * How many strokes a player receives on a hole.
   * handicap: player's course handicap (0-54)
   * si: stroke index of the hole (1-18)
   */
  strokesReceived(handicap, si) {
    const hcp = Math.max(0, Math.round(handicap));
    return Math.floor(hcp / 18) + (si <= (hcp % 18) ? 1 : 0);
  },

  /**
   * Stableford points for a hole.
   * Returns 0 if strokes is 0 (not played).
   *
   * Net -3 or better (albatross) = 6 pts
   * Net -2 (eagle)               = 5 pts
   * Net -1 (birdie)              = 4 pts
   * Net par                      = 3 pts
   * Net +1 (bogey)               = 2 pts
   * Net +2 (double bogey)        = 1 pt
   * Net +3 or worse              = 0 pts
   */
  stablefordPoints(strokes, par, si, handicap) {
    if (!strokes || strokes <= 0) return null;
    const received = this.strokesReceived(handicap, si);
    const net = strokes - received;
    const diff = net - par;
    if (diff <= -3) return 6;
    if (diff === -2) return 5;
    if (diff === -1) return 4;
    if (diff === 0)  return 3;
    if (diff === 1)  return 2;
    if (diff === 2)  return 1;
    return 0;
  },

  /** Human-readable label for a score vs par */
  scoreName(diff) {
    if (diff <= -3) return 'Albatross';
    if (diff === -2) return 'Eagle';
    if (diff === -1) return 'Birdie';
    if (diff === 0)  return 'Par';
    if (diff === 1)  return 'Bogey';
    if (diff === 2)  return 'Double';
    return '+' + diff;
  }
};
