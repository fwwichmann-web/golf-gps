/* === Atlantic Beach Links — Course Data === */

const COURSE_DATA = {
  id: 'atlantic-beach-links',
  name: 'Atlantic Beach Links',
  designer: 'Mark Muller',
  par: 72,
  address: '1 Fairway Drive, Melkbosstrand, Cape Town',
  location: { lat: -33.7280, lng: 18.4750 },
  tees: ['Yellow', 'White', 'Blue', 'Red'],
  teeLabels: {
    Yellow: 'Championship',
    White: 'Club',
    Blue: 'Member',
    Red: 'Ladies'
  },
  holes: [
    {
      number: 1, par: 4, si: 13,
      yardages: { Yellow: 442, White: 418, Blue: 364, Red: 331 },
      tee: { lat: -33.74000431079574, lng: 18.451811671257023 },
      green: {
        front:  { lat: -33.7432395013155, lng: 18.451039195060734 },
        center: { lat: -33.74333453027554, lng: 18.45103651285172 },
        back:   { lat: -33.74342946838068, lng: 18.451017737388614 }
      },
      hazards: []
    },
    {
      number: 2, par: 4, si: 7,
      yardages: { Yellow: 388, White: 363, Blue: 336, Red: 331 },
      tee: { lat: -33.74410510528525, lng: 18.450419604778293 },
      green: {
        front:  { lat: -33.74472062315833, lng: 18.447084277868274 },
        center: { lat: -33.744700518929854, lng: 18.446927368640903 },
        back:   { lat: -33.744707049314314, lng: 18.446759730577472 }
      },
      hazards: []
    },
    {
      number: 3, par: 3, si: 17,
      yardages: { Yellow: 171, White: 154, Blue: 143, Red: 140 },
      tee: { lat: -33.745046073662685, lng: 18.44675034284592 },
      green: {
        front:  { lat: -33.746030626866556, lng: 18.446369469165806 },
        center: { lat: -33.746287509892035, lng: 18.446417748928074 },
        back:   { lat: -33.74652695489311, lng: 18.44640970230103 }
      },
      hazards: []
    },
    {
      number: 4, par: 5, si: 3,
      yardages: { Yellow: 523, White: 495, Blue: 472, Red: 448 },
      tee: { lat: -33.74727184990209, lng: 18.446648418903354 },
      green: {
        front:  { lat: -33.74981233148634, lng: 18.449889868497852 },
        center: { lat: -33.74993139475492, lng: 18.44995960593224 },
        back:   { lat: -33.750063619024694, lng: 18.44999045133591 }
      },
      hazards: []
    },
    {
      number: 5, par: 4, si: 11,
      yardages: { Yellow: 369, White: 330, Blue: 317, Red: 312 },
      tee: { lat: -33.750494924446755, lng: 18.450202345848087 },
      green: {
        front:  { lat: -33.752084732815504, lng: 18.452557325363163 },
        center: { lat: -33.75220534772928, lng: 18.452625721693042 },
        back:   { lat: -33.752315911251195, lng: 18.452696800231937 }
      },
      hazards: []
    },
    {
      number: 6, par: 5, si: 5,
      yardages: { Yellow: 524, White: 493, Blue: 490, Red: 414 },
      tee: { lat: -33.7516630050653, lng: 18.45300525426865 },
      green: {
        front:  { lat: -33.747797706498474, lng: 18.451772779226307 },
        center: { lat: -33.747716175579065, lng: 18.451727181673053 },
        back:   { lat: -33.74762459281006, lng: 18.45168694853783 }
      },
      hazards: []
    },
    {
      number: 7, par: 4, si: 1,
      yardages: { Yellow: 445, White: 421, Blue: 399, Red: 312 },
      tee: { lat: -33.7472707086024, lng: 18.45173388719559 },
      green: {
        front:  { lat: -33.744221262046075, lng: 18.453155457973484 },
        center: { lat: -33.744049258048534, lng: 18.453190326690677 },
        back:   { lat: -33.74385268162898, lng: 18.45320910215378 }
      },
      hazards: []
    },
    {
      number: 8, par: 3, si: 15,
      yardages: { Yellow: 156, White: 141, Blue: 129, Red: 118 },
      tee: { lat: -33.743357709842456, lng: 18.453450500965122 },
      green: {
        front:  { lat: -33.74306872745477, lng: 18.452378958463672 },
        center: { lat: -33.74299414140104, lng: 18.45229178667069 },
        back:   { lat: -33.74293838942666, lng: 18.452205955982212 }
      },
      hazards: []
    },
    {
      number: 9, par: 4, si: 9,
      yardages: { Yellow: 408, White: 378, Blue: 357, Red: 270 },
      tee: { lat: -33.74327324453153, lng: 18.45165073871613 },
      green: {
        front:  { lat: -33.74057113616337, lng: 18.452513068914417 },
        center: { lat: -33.74039798869058, lng: 18.452472835779194 },
        back:   { lat: -33.74024275062186, lng: 18.452472835779194 }
      },
      hazards: []
    },
    {
      number: 10, par: 5, si: 4,
      yardages: { Yellow: 533, White: 506, Blue: 504, Red: 487 },
      tee: { lat: -33.73859576717051, lng: 18.45245942473412 },
      green: {
        front:  { lat: -33.73487349315113, lng: 18.450950682163242 },
        center: { lat: -33.73470817260054, lng: 18.450964093208317 },
        back:   { lat: -33.73456072427317, lng: 18.45097750425339 }
      },
      hazards: []
    },
    {
      number: 11, par: 4, si: 10,
      yardages: { Yellow: 396, White: 389, Blue: 355, Red: 344 },
      tee: { lat: -33.734225267912244, lng: 18.4505470097065 },
      green: {
        front:  { lat: -33.7362759735275, lng: 18.44835296273232 },
        center: { lat: -33.73640591676286, lng: 18.448350280523304 },
        back:   { lat: -33.73652990475212, lng: 18.44835296273232 }
      },
      hazards: []
    },
    {
      number: 12, par: 4, si: 8,
      yardages: { Yellow: 398, White: 367, Blue: 366, Red: 361 },
      tee: { lat: -33.73667837070875, lng: 18.447461128234867 },
      green: {
        front:  { lat: -33.73422392746647, lng: 18.445360958576206 },
        center: { lat: -33.73409456388157, lng: 18.445299267768863 },
        back:   { lat: -33.73397432493381, lng: 18.445245623588566 }
      },
      hazards: []
    },
    {
      number: 13, par: 5, si: 2,
      yardages: { Yellow: 536, White: 519, Blue: 443, Red: 407 },
      tee: { lat: -33.734345181869585, lng: 18.444714546203617 },
      green: {
        front:  { lat: -33.738344939947304, lng: 18.44451874494553 },
        center: { lat: -33.73846669116849, lng: 18.444521427154545 },
        back:   { lat: -33.73859402712318, lng: 18.44454556703568 }
      },
      hazards: []
    },
    {
      number: 14, par: 3, si: 16,
      yardages: { Yellow: 177, White: 171, Blue: 142, Red: 138 },
      tee: { lat: -33.73916245000676, lng: 18.44454422593117 },
      green: {
        front:  { lat: -33.74030461097262, lng: 18.443984985351566 },
        center: { lat: -33.74042300854033, lng: 18.444060087203983 },
        back:   { lat: -33.74053023638516, lng: 18.44415128231049 }
      },
      hazards: []
    },
    {
      number: 15, par: 4, si: 14,
      yardages: { Yellow: 405, White: 382, Blue: 262, Red: 259 },
      tee: { lat: -33.74096246760632, lng: 18.444175422191623 },
      green: {
        front:  { lat: -33.74280470042135, lng: 18.447058796882633 },
        center: { lat: -33.74290745758874, lng: 18.447163403034214 },
        back:   { lat: -33.74303031925776, lng: 18.44725459814072 }
      },
      hazards: []
    },
    {
      number: 16, par: 3, si: 18,
      yardages: { Yellow: 168, White: 164, Blue: 137, Red: 132 },
      tee: { lat: -33.74313829951082, lng: 18.44771727919579 },
      green: {
        front:  { lat: -33.74263545449098, lng: 18.449020832777027 },
        center: { lat: -33.74253024847779, lng: 18.4491240978241 },
        back:   { lat: -33.742448927211015, lng: 18.449191153049473 }
      },
      hazards: []
    },
    {
      number: 17, par: 4, si: 6,
      yardages: { Yellow: 439, White: 425, Blue: 406, Red: 343 },
      tee: { lat: -33.7419347883533, lng: 18.448469638824466 },
      green: {
        front:  { lat: -33.738641071218204, lng: 18.448128998279575 },
        center: { lat: -33.7385088171206, lng: 18.44813168048859 },
        back:   { lat: -33.73837522941936, lng: 18.44815850257874 }
      },
      hazards: [
        { id: 'h17-1', type: 'bunker', label: 'Bunker 1', position: { lat: -33.74040686675892, lng: 18.44822555780411 } },
        { id: 'h17-2', type: 'bunker', label: 'Bunker 2', position: { lat: -33.739746763205574, lng: 18.44810485839844 } }
      ]
    },
    {
      number: 18, par: 4, si: 12,
      yardages: { Yellow: 320, White: 294, Blue: 273, Red: 259 },
      tee: { lat: -33.737987144640385, lng: 18.449330627918247 },
      green: {
        front:  { lat: -33.739257404946535, lng: 18.451658785343174 },
        center: { lat: -33.73933335904917, lng: 18.45176607370377 },
        back:   { lat: -33.7394098925131, lng: 18.45187067985535 }
      },
      hazards: [
        { id: 'h18-1', type: 'bunker', label: 'Bunker 1', position: { lat: -33.73890667483556, lng: 18.45103651285172 } },
        { id: 'h18-2', type: 'bunker', label: 'Bunker 2', position: { lat: -33.73852913572506, lng: 18.451127707958225 } },
        { id: 'h18-3', type: 'bunker', label: 'Bunker 3', position: { lat: -33.7390876249445, lng: 18.451433479785923 } }
      ]
    }
  ]
};

const CourseData = {
  /**
   * Get course data with mapped coordinate overrides merged in
   */
  getCourse() {
    const mapped = Storage.getMappedCoordinates(COURSE_DATA.id);
    if (!mapped) return COURSE_DATA;

    // Deep clone base data and merge mapped coordinates
    const course = JSON.parse(JSON.stringify(COURSE_DATA));
    for (let i = 0; i < course.holes.length; i++) {
      const override = mapped[i];
      if (!override) continue;

      if (override.tee) course.holes[i].tee = override.tee;
      if (override.green) {
        if (override.green.front) course.holes[i].green.front = override.green.front;
        if (override.green.center) course.holes[i].green.center = override.green.center;
        if (override.green.back) course.holes[i].green.back = override.green.back;
      }
      if (override.hazards) course.holes[i].hazards = override.hazards;
      if (override.layups) course.holes[i].layups = override.layups;
      if (override.dogleg) course.holes[i].dogleg = override.dogleg;
    }
    return course;
  },

  /**
   * Get a single hole (0-indexed internally, 1-indexed for display)
   */
  getHole(holeNumber) {
    const course = this.getCourse();
    return course.holes[holeNumber - 1] || null;
  },

  /**
   * Check if a hole has mapped green coordinates
   */
  isHoleMapped(holeNumber) {
    const hole = this.getHole(holeNumber);
    if (!hole) return false;
    return hole.green.center.lat != null && hole.green.center.lng != null;
  },

  /**
   * Count how many holes are fully mapped
   */
  getMappedCount() {
    let count = 0;
    for (let i = 1; i <= 18; i++) {
      if (this.isHoleMapped(i)) count++;
    }
    return count;
  }
};
