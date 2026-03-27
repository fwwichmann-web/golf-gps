/* === NFC Tag Manager === */

const NfcManager = {
  reader: null,
  scanning: false,
  _mode: 'play',      // 'play' | 'register'
  _onPlay: null,      // callback(uid, clubName) during play
  _onRegister: null,  // callback(uid) during registration

  isSupported() {
    return 'NDEFReader' in window;
  },

  getClubForTag(uid) {
    const map = Storage.getNfcTagMap();
    return map[uid] || null;
  },

  mapTagToClub(uid, club) {
    const map = Storage.getNfcTagMap();
    map[uid] = club;
    Storage.saveNfcTagMap(map);
  },

  removeTag(uid) {
    const map = Storage.getNfcTagMap();
    delete map[uid];
    Storage.saveNfcTagMap(map);
  },

  getAllMappings() {
    const map = Storage.getNfcTagMap();
    return Object.entries(map).map(([uid, club]) => ({ uid, club }));
  },

  // Start the NFC reader (called once on app init).
  // In 'play' mode: onPlay(uid, clubName) is called on each tag read.
  // Switch to 'register' mode via setRegisterMode(onRead).
  async start(onPlay) {
    if (!this.isSupported()) return { ok: false, error: 'NFC not supported on this browser/device. Use Android Chrome.' };

    this._onPlay = onPlay;

    try {
      this.reader = new NDEFReader();
      await this.reader.scan();
      this.scanning = true;

      this.reader.onreading = (event) => {
        const uid = event.serialNumber;
        if (!uid) return;

        if (this._mode === 'register' && this._onRegister) {
          this._onRegister(uid);
        } else if (this._mode === 'play' && this._onPlay) {
          const club = this.getClubForTag(uid);
          this._onPlay(uid, club);
        }
      };

      this.reader.onreadingerror = () => {};
      return { ok: true };
    } catch (e) {
      this.scanning = false;
      const msg = e.name === 'NotAllowedError'
        ? 'NFC permission denied. Allow NFC in browser settings.'
        : (e.message || 'Could not start NFC scanning');
      return { ok: false, error: msg };
    }
  },

  setPlayMode() {
    this._mode = 'play';
    this._onRegister = null;
  },

  setRegisterMode(onRead) {
    this._mode = 'register';
    this._onRegister = onRead;
  }
};
