/* === GPS Manager === */

const GpsManager = {
  watchId: null,
  lastPosition: null,
  callbacks: [],
  accuracyThreshold: 30,

  start() {
    if (!navigator.geolocation) {
      this._showError('GPS not supported on this device');
      return;
    }
    this.watchId = navigator.geolocation.watchPosition(
      pos => this._onPosition(pos),
      err => this._onError(err),
      {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 10000
      }
    );

    // Handle app going to background/foreground
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.stop();
      } else {
        this.start();
      }
    });
  },

  stop() {
    if (this.watchId != null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  },

  onPositionUpdate(callback) {
    this.callbacks.push(callback);
  },

  getLastPosition() {
    return this.lastPosition;
  },

  getAccuracyBucket() {
    if (!this.lastPosition) return 'none';
    const acc = this.lastPosition.accuracy;
    if (acc < 5) return 'excellent';
    if (acc < 10) return 'good';
    if (acc < 20) return 'fair';
    return 'poor';
  },

  getAccuracyLabel() {
    if (!this.lastPosition) return 'Waiting...';
    const acc = Math.round(this.lastPosition.accuracy);
    const bucket = this.getAccuracyBucket();
    const labels = { excellent: 'Excellent', good: 'Good', fair: 'Fair', poor: 'Poor' };
    return (labels[bucket] || 'Unknown') + ' (' + acc + 'm)';
  },

  _onPosition(pos) {
    const position = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      heading: pos.coords.heading,
      timestamp: pos.timestamp
    };

    // Filter out very inaccurate readings
    if (position.accuracy > this.accuracyThreshold) {
      // Still update position for display but mark as low quality
      position.lowQuality = true;
    }

    this.lastPosition = position;
    this.callbacks.forEach(cb => cb(position));
  },

  _onError(err) {
    console.error('GPS error:', err.code, err.message);
    if (err.code === 1) {
      this._showError('Location permission denied. Please enable in your device settings.');
    } else if (err.code === 2) {
      this._showError('GPS unavailable. Move to an open area.');
    } else if (err.code === 3) {
      // Timeout — just wait for next attempt
    }
  },

  _showError(msg) {
    const overlay = document.getElementById('gps-overlay');
    const msgEl = document.getElementById('gps-overlay-msg');
    if (overlay && msgEl) {
      msgEl.textContent = msg;
      overlay.classList.remove('hidden');
    }
  }
};
