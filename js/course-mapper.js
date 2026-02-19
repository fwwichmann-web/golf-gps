/* === Course Mapper — Admin Tool === */

const CourseMapper = {
  map: null,
  markers: {},
  currentHole: 1,
  initialized: false,
  workingData: null,

  init() {
    if (this.initialized) {
      this._updateChecklist();
      return;
    }

    // Load Leaflet CSS + JS dynamically
    this._loadLeaflet(() => {
      this._setupMap();
      this._loadWorkingData();
      this._bindControls();
      this._updateChecklist();
      this.initialized = true;
    });
  },

  _loadLeaflet(callback) {
    // Check if already loaded
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

  _setupMap() {
    const course = CourseData.getCourse();
    this.map = L.map('mapper-map', {
      center: [course.location.lat, course.location.lng],
      zoom: 17,
      zoomControl: true
    });

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri',
      maxZoom: 20
    }).addTo(this.map);

    // Click handler for placing markers
    this.map.on('click', e => this._onMapClick(e.latlng));

    // Fix map size on first show
    setTimeout(() => this.map.invalidateSize(), 200);
  },

  _loadWorkingData() {
    const mapped = Storage.getMappedCoordinates(COURSE_DATA.id);
    if (mapped) {
      this.workingData = JSON.parse(JSON.stringify(mapped));
    } else {
      // Initialize empty working data for 18 holes
      this.workingData = [];
      for (let i = 0; i < 18; i++) {
        this.workingData.push({
          tee: null,
          green: { front: null, center: null, back: null },
          hazards: [],
          layups: [],
          dogleg: null
        });
      }
    }
    this._showMarkersForHole();
  },

  _bindControls() {
    document.getElementById('mapper-prev').addEventListener('click', () => {
      if (this.currentHole > 1) {
        this.currentHole--;
        this._onHoleChange();
      }
    });

    document.getElementById('mapper-next').addEventListener('click', () => {
      if (this.currentHole < 18) {
        this.currentHole++;
        this._onHoleChange();
      }
    });

    // Show/hide hazard label input based on mode
    document.getElementById('mapper-mode').addEventListener('change', () => {
      const mode = document.getElementById('mapper-mode').value;
      const labelEl = document.getElementById('mapper-hazard-label');
      if (mode.startsWith('hazard-') || mode === 'layup') {
        labelEl.classList.remove('hidden');
      } else {
        labelEl.classList.add('hidden');
      }
    });

    document.getElementById('btn-mapper-save').addEventListener('click', () => this._save());
    document.getElementById('btn-mapper-export').addEventListener('click', () => this._exportJson());
    document.getElementById('btn-mapper-import').addEventListener('click', () => {
      document.getElementById('mapper-import-file').click();
    });
    document.getElementById('mapper-import-file').addEventListener('change', e => {
      this._importJson(e.target.files[0]);
    });
  },

  _onHoleChange() {
    document.getElementById('mapper-hole-num').textContent = 'Hole ' + this.currentHole;
    this._clearMarkers();
    this._showMarkersForHole();
    this._updateChecklist();
  },

  _onMapClick(latlng) {
    const mode = document.getElementById('mapper-mode').value;
    const holeIdx = this.currentHole - 1;
    const holeData = this.workingData[holeIdx];
    const coord = { lat: latlng.lat, lng: latlng.lng };

    if (mode === 'green-front') {
      holeData.green.front = coord;
      this._addMarker('green-front', latlng, '#90ee90', 'F');
    } else if (mode === 'green-center') {
      holeData.green.center = coord;
      this._addMarker('green-center', latlng, '#00e676', 'C');
    } else if (mode === 'green-back') {
      holeData.green.back = coord;
      this._addMarker('green-back', latlng, '#2e7d32', 'B');
    } else if (mode === 'tee') {
      holeData.tee = coord;
      this._addMarker('tee', latlng, '#448aff', 'T');
    } else if (mode.startsWith('hazard-')) {
      const type = mode.replace('hazard-', '');
      const label = document.getElementById('mapper-hazard-name').value || (type + ' ' + (holeData.hazards.length + 1));
      const hazard = {
        id: 'h' + this.currentHole + '-' + (holeData.hazards.length + 1),
        type: type,
        label: label,
        position: coord
      };
      holeData.hazards.push(hazard);
      const colors = { bunker: '#ffd740', water: '#448aff', ob: '#ff5252' };
      this._addMarker('hazard-' + holeData.hazards.length, latlng, colors[type] || '#ff9100', type[0].toUpperCase());
      document.getElementById('mapper-hazard-name').value = '';
    } else if (mode === 'layup') {
      if (!holeData.layups) holeData.layups = [];
      const label = document.getElementById('mapper-hazard-name').value || ('Layup ' + (holeData.layups.length + 1));
      holeData.layups.push({ id: 'l' + this.currentHole + '-' + (holeData.layups.length + 1), label: label, position: coord });
      this._addMarker('layup-' + holeData.layups.length, latlng, '#ff9100', 'L');
      document.getElementById('mapper-hazard-name').value = '';
    } else if (mode === 'dogleg') {
      holeData.dogleg = coord;
      this._addMarker('dogleg', latlng, '#ce93d8', 'D');
    }

    this._updateChecklist();
  },

  _addMarker(key, latlng, color, label) {
    // Remove existing marker for this key
    if (this.markers[key]) {
      this.map.removeLayer(this.markers[key]);
    }

    const icon = L.divIcon({
      className: 'mapper-marker',
      html: '<div style="background:' + color + ';width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#000;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.5);">' + label + '</div>',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    const marker = L.marker(latlng, { icon: icon, draggable: true });
    marker.on('dragend', e => {
      const newPos = e.target.getLatLng();
      this._updateCoordForKey(key, { lat: newPos.lat, lng: newPos.lng });
    });
    marker.addTo(this.map);
    this.markers[key] = marker;
  },

  _updateCoordForKey(key, coord) {
    const holeIdx = this.currentHole - 1;
    const holeData = this.workingData[holeIdx];

    if (key === 'green-front') holeData.green.front = coord;
    else if (key === 'green-center') holeData.green.center = coord;
    else if (key === 'green-back') holeData.green.back = coord;
    else if (key === 'tee') holeData.tee = coord;
    else if (key === 'dogleg') holeData.dogleg = coord;
    else if (key.startsWith('hazard-')) {
      const idx = parseInt(key.split('-')[1]) - 1;
      if (holeData.hazards[idx]) holeData.hazards[idx].position = coord;
    } else if (key.startsWith('layup-')) {
      const idx = parseInt(key.split('-')[1]) - 1;
      if (holeData.layups && holeData.layups[idx]) holeData.layups[idx].position = coord;
    }
  },

  _clearMarkers() {
    Object.values(this.markers).forEach(m => this.map.removeLayer(m));
    this.markers = {};
  },

  _showMarkersForHole() {
    const holeIdx = this.currentHole - 1;
    const holeData = this.workingData[holeIdx];
    if (!holeData) return;

    const positions = [];

    if (holeData.tee) {
      this._addMarker('tee', L.latLng(holeData.tee.lat, holeData.tee.lng), '#448aff', 'T');
      positions.push([holeData.tee.lat, holeData.tee.lng]);
    }
    if (holeData.green.front) {
      this._addMarker('green-front', L.latLng(holeData.green.front.lat, holeData.green.front.lng), '#90ee90', 'F');
      positions.push([holeData.green.front.lat, holeData.green.front.lng]);
    }
    if (holeData.green.center) {
      this._addMarker('green-center', L.latLng(holeData.green.center.lat, holeData.green.center.lng), '#00e676', 'C');
      positions.push([holeData.green.center.lat, holeData.green.center.lng]);
    }
    if (holeData.green.back) {
      this._addMarker('green-back', L.latLng(holeData.green.back.lat, holeData.green.back.lng), '#2e7d32', 'B');
      positions.push([holeData.green.back.lat, holeData.green.back.lng]);
    }
    if (holeData.dogleg) {
      this._addMarker('dogleg', L.latLng(holeData.dogleg.lat, holeData.dogleg.lng), '#ce93d8', 'D');
      positions.push([holeData.dogleg.lat, holeData.dogleg.lng]);
    }

    (holeData.hazards || []).forEach((h, i) => {
      if (!h.position) return;
      const colors = { bunker: '#ffd740', water: '#448aff', ob: '#ff5252' };
      this._addMarker('hazard-' + (i + 1), L.latLng(h.position.lat, h.position.lng), colors[h.type] || '#ff9100', h.type[0].toUpperCase());
      positions.push([h.position.lat, h.position.lng]);
    });

    (holeData.layups || []).forEach((l, i) => {
      if (!l.position) return;
      this._addMarker('layup-' + (i + 1), L.latLng(l.position.lat, l.position.lng), '#ff9100', 'L');
      positions.push([l.position.lat, l.position.lng]);
    });

    // Fit map to markers if any exist
    if (positions.length > 0) {
      this.map.fitBounds(positions, { padding: [40, 40], maxZoom: 19 });
    }
  },

  _updateChecklist() {
    const holeIdx = this.currentHole - 1;
    const holeData = this.workingData[holeIdx];
    const container = document.getElementById('mapper-checklist');

    const items = [
      { label: 'Tee Box', done: !!holeData.tee },
      { label: 'Green Front', done: !!holeData.green.front },
      { label: 'Green Center', done: !!holeData.green.center },
      { label: 'Green Back', done: !!holeData.green.back },
      { label: 'Hazards (' + (holeData.hazards || []).length + ')', done: (holeData.hazards || []).length > 0 }
    ];

    container.innerHTML = items.map(item => {
      const cls = item.done ? 'done' : 'pending';
      const icon = item.done ? '\u2713' : '\u25CB';
      return '<div class="mapper-check-item ' + cls + '">' + icon + ' ' + item.label + '</div>';
    }).join('');

    // Update progress
    let mapped = 0;
    for (let i = 0; i < 18; i++) {
      const h = this.workingData[i];
      if (h && h.green && h.green.center) mapped++;
    }
    document.getElementById('mapper-progress').textContent = mapped + '/18 holes mapped';
  },

  _save() {
    Storage.saveMappedCoordinates(COURSE_DATA.id, this.workingData);
    alert('Coordinates saved! GPS distances will now update.');
  },

  _exportJson() {
    // Merge working data with base course data for a complete export
    const course = JSON.parse(JSON.stringify(COURSE_DATA));
    for (let i = 0; i < 18; i++) {
      const wd = this.workingData[i];
      if (!wd) continue;
      if (wd.tee) course.holes[i].tee = wd.tee;
      if (wd.green.front) course.holes[i].green.front = wd.green.front;
      if (wd.green.center) course.holes[i].green.center = wd.green.center;
      if (wd.green.back) course.holes[i].green.back = wd.green.back;
      if (wd.hazards) course.holes[i].hazards = wd.hazards;
      if (wd.layups) course.holes[i].layups = wd.layups;
      if (wd.dogleg) course.holes[i].dogleg = wd.dogleg;
    }

    const blob = new Blob([JSON.stringify(course, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'atlantic-beach-links.json';
    a.click();
    URL.revokeObjectURL(url);
  },

  _importJson(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.holes && data.holes.length === 18) {
          // Extract mapping data from imported course
          this.workingData = data.holes.map(h => ({
            tee: h.tee && h.tee.lat ? h.tee : null,
            green: {
              front: h.green && h.green.front && h.green.front.lat ? h.green.front : null,
              center: h.green && h.green.center && h.green.center.lat ? h.green.center : null,
              back: h.green && h.green.back && h.green.back.lat ? h.green.back : null
            },
            hazards: h.hazards || [],
            layups: h.layups || [],
            dogleg: h.dogleg || null
          }));
          this._save();
          this._clearMarkers();
          this._showMarkersForHole();
          this._updateChecklist();
          alert('Course data imported successfully!');
        } else {
          alert('Invalid file: must contain 18 holes');
        }
      } catch (err) {
        alert('Error reading file: ' + err.message);
      }
    };
    reader.readAsText(file);
  }
};
