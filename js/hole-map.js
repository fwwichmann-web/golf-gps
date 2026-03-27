/* === Hole Flyover Map === */

const HoleMap = {
  map: null,
  _teeMarker:    null,
  _greenMarker:  null,
  _fairwayLine:  null,
  _playerMarker: null,
  _hazardMarkers: [],
  _shotMarkers:  [],
  _initialized:  false,
  _currentHole:  null,

  _loadLeaflet(callback) {
    if (window.L) { callback(); return; }
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);
    const js = document.createElement('script');
    js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    js.onload = callback;
    document.head.appendChild(js);
  },

  init(holeNumber) {
    this._loadLeaflet(() => {
      if (!this._initialized) {
        const hole = CourseData.getHole(holeNumber || 1);
        this.map = L.map('hole-map', {
          zoomControl: false,
          attributionControl: false,
          dragging: true,
          scrollWheelZoom: false,
          doubleClickZoom: false
        }).setView([hole.tee.lat, hole.tee.lng], 16);

        L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          { maxZoom: 20 }
        ).addTo(this.map);

        this._initialized = true;
      }
      this.showHole(holeNumber || 1);
    });
  },

  showHole(holeNumber) {
    if (!this._initialized || !this.map) return;
    const hole = CourseData.getHole(holeNumber);
    if (!hole) return;
    this._currentHole = holeNumber;

    // Clear previous layers
    [this._teeMarker, this._greenMarker, this._fairwayLine, this._playerMarker]
      .filter(Boolean).forEach(l => this.map.removeLayer(l));
    this._hazardMarkers.forEach(m => this.map.removeLayer(m));
    this._shotMarkers.forEach(m => this.map.removeLayer(m));
    this._hazardMarkers = [];
    this._shotMarkers   = [];

    const tee   = [hole.tee.lat, hole.tee.lng];
    const green = [hole.green.center.lat, hole.green.center.lng];

    // Tee marker — white flag
    this._teeMarker = L.marker(tee, {
      icon: L.divIcon({
        className: '',
        html: '<div class="map-marker map-tee">T</div>',
        iconSize: [26, 26], iconAnchor: [13, 13]
      })
    }).addTo(this.map);

    // Green marker — pin
    this._greenMarker = L.marker(green, {
      icon: L.divIcon({
        className: '',
        html: '<div class="map-marker map-green">⛳</div>',
        iconSize: [26, 26], iconAnchor: [13, 13]
      })
    }).addTo(this.map);

    // Tee → green line
    this._fairwayLine = L.polyline([tee, green], {
      color: '#4ae54a', weight: 2, opacity: 0.7, dashArray: '6 4'
    }).addTo(this.map);

    // Hazards
    (hole.hazards || []).forEach(hz => {
      const m = L.marker([hz.position.lat, hz.position.lng], {
        icon: L.divIcon({
          className: '',
          html: '<div class="map-marker map-hazard">' + (hz.type === 'bunker' ? 'B' : 'W') + '</div>',
          iconSize: [22, 22], iconAnchor: [11, 11]
        })
      }).bindTooltip(hz.label, { permanent: false }).addTo(this.map);
      this._hazardMarkers.push(m);
    });

    // GPS shots for current hole
    if (ShotTracker.round) {
      const holeData = ShotTracker.round.holes[holeNumber - 1];
      if (holeData && holeData.shots) {
        holeData.shots.filter(s => s.lat && s.lng).forEach((s, idx) => {
          const m = L.marker([s.lat, s.lng], {
            icon: L.divIcon({
              className: '',
              html: '<div class="map-marker map-shot">' + (idx + 1) + '</div>',
              iconSize: [20, 20], iconAnchor: [10, 10]
            })
          }).addTo(this.map);
          this._shotMarkers.push(m);
        });
      }
    }

    // Fit map to show tee + green with padding
    const bounds = L.latLngBounds([tee, green]);
    (hole.hazards || []).forEach(hz => bounds.extend([hz.position.lat, hz.position.lng]));
    this.map.fitBounds(bounds, { padding: [36, 36], maxZoom: 18 });

    // Trigger resize in case map was hidden when initialised
    setTimeout(() => this.map.invalidateSize(), 50);
  },

  updatePlayerPosition(lat, lng) {
    if (!this._initialized || !this.map) return;
    if (this._playerMarker) this.map.removeLayer(this._playerMarker);
    this._playerMarker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: '',
        html: '<div class="map-marker map-player">●</div>',
        iconSize: [16, 16], iconAnchor: [8, 8]
      })
    }).addTo(this.map);
  }
};
