// Every number the app shows lives here, in SI units, with a source note.
// The worlds read from this file — no magic numbers in the drawing code, so a
// label can never drift away from the geometry it describes.
//
// Sources: NASA/JPL planetary fact sheets (volumetric mean radii, semi-major
// axes),
// IAU 2012 definition of the astronomical unit, CODATA speed of light.

export const KM = 1e3;

export const EARTH = {
  name: 'Earth',
  r: 6371.0 * KM,          // volumetric mean radius
  d: 12742.0 * KM,
  color: '#3f83d8',
  color2: '#8fc4f5',
};

export const MOON = {
  name: 'Moon',
  r: 1737.4 * KM,
  d: 3474.8 * KM,
  color: '#8b93a3',
  color2: '#d6dae2',
};

export const SUN = {
  name: 'Sun',
  r: 695700 * KM,
  d: 1391400 * KM,
  color: '#ffae3d',
  color2: '#fff0c2',
};

// The Moon's orbit is an ellipse, which is what decides whether the other
// seven planets fit in the gap.
export const MOON_ORBIT = {
  mean: 384400 * KM,       // centre-to-centre
  perigee: 363300 * KM,
  apogee: 405500 * KM,
};

export const AU = 149597870.7 * KM;
export const C_LIGHT = 299792458;   // m/s

/** Surface-to-surface clearance between Earth and Moon at a given centre distance. */
export const gap = (centreDistance) => centreDistance - EARTH.r - MOON.r;

/**
 * The other seven planets, in order from the Sun, as mean diameters — the
 * figure the familiar "they all fit between the Earth and the Moon" claim is
 * built on. Equatorial diameters would add about 10 000 km to the row.
 */
export const OTHER_PLANETS = [
  { name: 'Mercury', d: 4879 * KM, color: '#9c8d7f', color2: '#cbbfb2' },
  { name: 'Venus', d: 12104 * KM, color: '#d8a25c', color2: '#f4d9a8' },
  { name: 'Mars', d: 6779 * KM, color: '#c2603c', color2: '#e79a76' },
  { name: 'Jupiter', d: 139822 * KM, color: '#c8a07a', color2: '#efd5b6' },
  { name: 'Saturn', d: 116464 * KM, color: '#d3b686', color2: '#f0dcb8' },
  { name: 'Uranus', d: 50724 * KM, color: '#7fc3c9', color2: '#bfe6ea' },
  { name: 'Neptune', d: 49244 * KM, color: '#4a72c8', color2: '#93aeec' },
];

export const PLANETS_TOTAL_D = OTHER_PLANETS.reduce((s, p) => s + p.d, 0);

export const LY = 9.4607304725808e15;   // light-year, metres

/**
 * All eight planets with the two numbers the app needs: the body's own radius
 * and the semi-major axis of its orbit. Both are real; the angles are not.
 * Where a planet sits along its orbit is fixed arbitrary, because this is a
 * scale toy rather than an ephemeris, and a frozen layout keeps every planet
 * findable between visits. Orbits are drawn as circles at the semi-major axis,
 * so a planet's distance from the Sun is right to within its eccentricity.
 */
export const PLANETS = [
  { name: 'Mercury', r: 2.4397e6, a: 5.7909e10, angle: 2.71, color: '#9c8d7f', color2: '#cbbfb2' },
  { name: 'Venus', r: 6.0518e6, a: 1.08209e11, angle: 0.62, color: '#d8a25c', color2: '#f4d9a8' },
  { name: 'Earth', r: 6.371e6, a: 1.495979e11, angle: 5.34, color: '#3f83d8', color2: '#8fc4f5' },
  { name: 'Mars', r: 3.3895e6, a: 2.27939e11, angle: 3.95, color: '#c2603c', color2: '#e79a76' },
  { name: 'Jupiter', r: 6.9911e7, a: 7.78570e11, angle: 1.48, color: '#c8a07a', color2: '#efd5b6' },
  { name: 'Saturn', r: 5.8232e7, a: 1.433529e12, angle: 4.72, color: '#d3b686', color2: '#f0dcb8' },
  { name: 'Uranus', r: 2.5362e7, a: 2.872463e12, angle: 0.15, color: '#7fc3c9', color2: '#bfe6ea' },
  { name: 'Neptune', r: 2.4622e7, a: 4.495060e12, angle: 2.16, color: '#4a72c8', color2: '#93aeec' },
];

/**
 * The powers-of-ten ladder: concentric reference sizes from a proton to the
 * observable universe. `r` is a radius in metres — for things that are not
 * round it is the honest half-size, and `note` says which.
 */
export const LADDER = [
  { name: 'Proton', r: 8.4e-16, note: 'charge radius', color: '#ff7b6b' },
  { name: 'Hydrogen atom', r: 5.29e-11, note: 'Bohr radius', color: '#ff9f6b' },
  { name: 'DNA helix', r: 1.0e-9, note: 'width of the double helix', color: '#ffc95c' },
  { name: 'Coronavirus', r: 5.0e-8, note: 'typical virion', color: '#d6d36b' },
  { name: 'Red blood cell', r: 3.9e-6, note: 'across the disc', color: '#b4dd6f' },
  { name: 'Human hair', r: 3.5e-5, note: 'strand radius', color: '#7fdc9a' },
  { name: 'Grain of sand', r: 2.5e-4, note: 'medium sand', color: '#5cd0ff' },
  { name: 'Ant', r: 2.5e-3, note: 'body length', color: '#6fb6ff' },
  { name: 'Human', r: 0.85, note: 'arm span', color: '#8fc4f5' },
  { name: 'Blue whale', r: 15, note: 'length', color: '#6f9bff' },
  { name: 'Football pitch', r: 52, note: 'half the long side', color: '#9a8fff' },
  { name: 'Burj Khalifa', r: 415, note: 'height', color: '#c08fff' },
  { name: 'Mount Everest', r: 4425, note: 'height above sea level', color: '#e08fe8' },
  { name: 'Greater London', r: 2.5e4, note: 'across the city', color: '#ff8fcf' },
  { name: 'Earth', r: 6.371e6, note: 'mean radius', color: '#3f83d8' },
  { name: 'Jupiter', r: 6.9911e7, note: 'mean radius', color: '#c8a07a' },
  { name: 'The Sun', r: 6.957e8, note: 'photosphere', color: '#ffae3d' },
  { en: "Earth's orbit", r: 1.495979e11, note: '1 astronomical unit', color: '#ffcf5c' },
  { en: "Neptune's orbit", r: 4.495060e12, note: '30 AU', color: '#4a72c8' },
  { name: 'One light-year', r: LY, note: 'light travels this in a year', color: '#5cd0ff' },
  { name: 'Proxima Centauri', r: 4.2465 * LY, note: 'nearest star', color: '#ff9f6b' },
  { name: 'The Milky Way', r: 4.7e20, note: 'about 50 000 light-years', color: '#d6c6ff' },
  { name: 'Local Group', r: 2.4e22, note: 'our galaxy cluster', color: '#9a8fff' },
  { name: 'Observable universe', r: 4.4e26, note: '46.5 billion light-years', color: '#ffffff' },
];

// ---------------------------------------------------------------------------
// Human history, for the Deep Time mode.
// ---------------------------------------------------------------------------

/** What "now" means when turning an age into a calendar label. */
export const PRESENT_YEAR = 2025;

/** How far back the mode reaches, in years. */
export const HISTORY_SPAN = 200000;

/**
 * Dates are approximate and many are actively argued over — the earliest ones
 * can move by tens of thousands of years as a single site is re-dated. They are
 * here to carry a sense of proportion, not to settle a question. Events are
 * written with whichever field is natural, `ago` in years or a calendar `year`,
 * and normalised below so the recent ones cannot drift as PRESENT_YEAR moves.
 *
 * `major` marks the ones worth keeping when labels collide at low zoom.
 */
const EVENTS = [
  { ago: 200000, name: 'Modern humans', note: 'Homo sapiens in Africa', major: true },
  { ago: 164000, name: 'Seafood', note: 'Pinnacle Point, South Africa' },
  { ago: 120000, name: 'Shell beads', note: 'the earliest known ornament' },
  { ago: 100000, name: 'Deliberate burial', note: 'Qafzeh and Skhul' },
  { ago: 77000, name: 'Engraved ochre', note: 'Blombos Cave', major: true },
  { ago: 70000, name: 'Out of Africa', note: 'the expansion that peopled the world', major: true },
  { ago: 65000, name: 'Australia', note: 'Madjedbebe' },
  { ago: 50000, name: 'Bone tools and needles' },
  { ago: 45000, name: 'Europe' },
  { ago: 44000, name: 'Figurative painting', note: 'Sulawesi', major: true },
  { ago: 40000, name: 'Music', note: 'bone flutes' },
  { ago: 36000, name: 'Chauvet' },
  { ago: 30000, name: 'Dogs', note: 'earliest domestication, debated' },
  { ago: 26000, name: 'Woven cloth', note: 'Dolní Věstonice' },
  { ago: 20000, name: 'Glacial maximum', note: 'the ice at its greatest', major: true },
  { ago: 16000, name: 'The Americas' },
  { ago: 14000, name: 'Pottery', note: 'Jōmon, Japan' },
  { ago: 11600, name: 'Göbekli Tepe' },
  { ago: 11000, name: 'Farming', note: 'the Fertile Crescent', major: true },
  { ago: 9000, name: 'Çatalhöyük' },
  { ago: 6000, name: 'The wheel' },
  { ago: 5200, name: 'Writing', note: 'cuneiform, Sumer', major: true },
  { ago: 4600, name: 'Great Pyramid' },
  { ago: 3200, name: 'Iron' },
  { year: -776, name: 'First Olympics' },
  { year: -430, name: 'Classical Athens' },
  { year: 117, name: 'Rome at its greatest', major: true },
  { year: 622, name: 'Islam begins' },
  { year: 1000, name: 'Norse reach America' },
  { year: 1450, name: 'Printing press', major: true },
  { year: 1492, name: 'Columbus crosses' },
  { year: 1780, name: 'Industrial Revolution', major: true },
  { year: 1876, name: 'Telephone' },
  { year: 1903, name: 'Powered flight' },
  { year: 1945, name: 'Nuclear weapons' },
  { year: 1969, name: 'Moon landing', major: true },
  { year: 1990, name: 'World Wide Web' },
  { year: 2007, name: 'Smartphone' },
];

/** Oldest first, every entry carrying `ago` in years. */
export const HISTORY = EVENTS
  .map((e) => ({ ...e, ago: e.ago ?? PRESENT_YEAR - e.year }))
  .sort((a, b) => b.ago - a.ago);
