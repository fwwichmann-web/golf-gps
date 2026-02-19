/* === Distance Calculations === */

const Distance = {
  /**
   * Haversine distance in meters between two GPS coordinates
   */
  haversineMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const toRad = deg => deg * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  },

  /**
   * Initial bearing in degrees (0-360) from point 1 to point 2
   */
  bearingDegrees(lat1, lng1, lat2, lng2) {
    const toRad = deg => deg * Math.PI / 180;
    const toDeg = rad => rad * 180 / Math.PI;
    const dLng = toRad(lng2 - lng1);
    const y = Math.sin(dLng) * Math.cos(toRad(lat2));
    const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
              Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  },

  /**
   * Convert bearing to a compass arrow character
   */
  bearingToArrow(bearing) {
    const arrows = ['\u2191', '\u2197', '\u2192', '\u2198', '\u2193', '\u2199', '\u2190', '\u2196'];
    const index = Math.round(bearing / 45) % 8;
    return arrows[index];
  },

  /**
   * Format meters for display: "142m" or "1.2km"
   */
  formatDistance(meters) {
    if (meters == null || isNaN(meters)) return '---';
    const m = Math.round(meters);
    if (m >= 1000) return (meters / 1000).toFixed(1) + 'km';
    return m + 'm';
  },

  /**
   * Get distance from a position to a coordinate object { lat, lng }
   * Returns null if target is unmapped
   */
  toTarget(playerLat, playerLng, target) {
    if (!target || target.lat == null || target.lng == null) return null;
    return this.haversineMeters(playerLat, playerLng, target.lat, target.lng);
  },

  /**
   * Get bearing from a position to a coordinate object
   */
  bearingToTarget(playerLat, playerLng, target) {
    if (!target || target.lat == null || target.lng == null) return null;
    return this.bearingDegrees(playerLat, playerLng, target.lat, target.lng);
  }
};
