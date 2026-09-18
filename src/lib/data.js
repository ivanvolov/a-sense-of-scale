// Every number the film shows on screen lives here, in SI units, with a source
// note. Scenes read from this file — no magic numbers in the drawing code, so a
// caption can never drift away from the geometry it describes.
//
// Sources: NASA/JPL planetary fact sheets (equatorial radii, mean distances),
// IAU 2012 definition of the astronomical unit, CODATA speed of light.

export const KM = 1e3;

export const EARTH = {
  name: 'Земля',
  en: 'Earth',
  r: 6371.0 * KM,          // volumetric mean radius
  d: 12742.0 * KM,
  color: '#3f83d8',
  color2: '#8fc4f5',
};

export const MOON = {
  name: 'Луна',
  en: 'Moon',
  r: 1737.4 * KM,
  d: 3474.8 * KM,
  color: '#8b93a3',
  color2: '#d6dae2',
};

export const SUN = {
  name: 'Солнце',
  en: 'Sun',
  r: 695700 * KM,
  d: 1391400 * KM,
  color: '#ffae3d',
  color2: '#fff0c2',
};

// Moon's orbit is an ellipse — the film leans on that in the payoff of scene 1.
export const MOON_ORBIT = {
  mean: 384400 * KM,       // centre-to-centre
  perigee: 363300 * KM,
  apogee: 405500 * KM,
};

export const AU = 149597870.7 * KM;
export const C_LIGHT = 299792458;   // m/s

/** Surface-to-surface clearance between Earth and Moon at a given centre distance. */
export const gap = (centreDistance) => centreDistance - EARTH.r - MOON.r;

/** The other seven planets, in order from the Sun, equatorial diameters. */
export const OTHER_PLANETS = [
  { name: 'Меркурий', en: 'Mercury', d: 4879 * KM, color: '#9c8d7f', color2: '#cbbfb2' },
  { name: 'Венера', en: 'Venus', d: 12104 * KM, color: '#d8a25c', color2: '#f4d9a8' },
  { name: 'Марс', en: 'Mars', d: 6779 * KM, color: '#c2603c', color2: '#e79a76' },
  { name: 'Юпитер', en: 'Jupiter', d: 139822 * KM, color: '#c8a07a', color2: '#efd5b6' },
  { name: 'Сатурн', en: 'Saturn', d: 116464 * KM, color: '#d3b686', color2: '#f0dcb8' },
  { name: 'Уран', en: 'Uranus', d: 50724 * KM, color: '#7fc3c9', color2: '#bfe6ea' },
  { name: 'Нептун', en: 'Neptune', d: 49244 * KM, color: '#4a72c8', color2: '#93aeec' },
];

export const PLANETS_TOTAL_D = OTHER_PLANETS.reduce((s, p) => s + p.d, 0);

/** Light-travel times used by scene 3. */
export const LIGHT_TIMES = [
  { name: 'до Луны', s: MOON_ORBIT.mean / C_LIGHT },
  { name: 'до Солнца', s: AU / C_LIGHT },
  { name: 'до Нептуна', s: (30.07 * AU) / C_LIGHT },
  { name: 'до Проксимы Центавра', s: 4.2465 * 31557600 },
];

// ---------------------------------------------------------------------------
// Below this line: data used only by the interactive explorer. The film never
// reads it, but it belongs in the same file so there is exactly one place where
// a number about the solar system lives.
// ---------------------------------------------------------------------------

export const LY = 9.4607304725808e15;   // light-year, metres

/**
 * All eight planets with the two numbers the explorer needs: the body's own
 * radius and the semi-major axis of its orbit. Angles are fixed rather than
 * simulated — this is a scale toy, not an ephemeris, and a frozen layout keeps
 * every planet findable between visits.
 */
export const PLANETS = [
  { en: 'Mercury', r: 2.4397e6, a: 5.7909e10, angle: 2.71, color: '#9c8d7f', color2: '#cbbfb2' },
  { en: 'Venus', r: 6.0518e6, a: 1.08209e11, angle: 0.62, color: '#d8a25c', color2: '#f4d9a8' },
  { en: 'Earth', r: 6.371e6, a: 1.495979e11, angle: 5.34, color: '#3f83d8', color2: '#8fc4f5' },
  { en: 'Mars', r: 3.3895e6, a: 2.27939e11, angle: 3.95, color: '#c2603c', color2: '#e79a76' },
  { en: 'Jupiter', r: 6.9911e7, a: 7.78570e11, angle: 1.48, color: '#c8a07a', color2: '#efd5b6' },
  { en: 'Saturn', r: 5.8232e7, a: 1.433529e12, angle: 4.72, color: '#d3b686', color2: '#f0dcb8' },
  { en: 'Uranus', r: 2.5362e7, a: 2.872463e12, angle: 0.15, color: '#7fc3c9', color2: '#bfe6ea' },
  { en: 'Neptune', r: 2.4622e7, a: 4.495060e12, angle: 2.16, color: '#4a72c8', color2: '#93aeec' },
];

/**
 * The powers-of-ten ladder: concentric reference sizes from a proton to the
 * observable universe. `r` is a radius in metres — for things that are not
 * round it is the honest half-size, and `note` says which.
 */
export const LADDER = [
  { en: 'Proton', r: 8.4e-16, note: 'charge radius', color: '#ff7b6b' },
  { en: 'Hydrogen atom', r: 5.29e-11, note: 'Bohr radius', color: '#ff9f6b' },
  { en: 'DNA helix', r: 1.0e-9, note: 'width of the double helix', color: '#ffc95c' },
  { en: 'Coronavirus', r: 5.0e-8, note: 'typical virion', color: '#d6d36b' },
  { en: 'Red blood cell', r: 3.9e-6, note: 'across the disc', color: '#b4dd6f' },
  { en: 'Human hair', r: 3.5e-5, note: 'strand radius', color: '#7fdc9a' },
  { en: 'Grain of sand', r: 2.5e-4, note: 'medium sand', color: '#5cd0ff' },
  { en: 'Ant', r: 2.5e-3, note: 'body length', color: '#6fb6ff' },
  { en: 'Human', r: 0.85, note: 'arm span', color: '#8fc4f5' },
  { en: 'Blue whale', r: 15, note: 'length', color: '#6f9bff' },
  { en: 'Football pitch', r: 52, note: 'half the long side', color: '#9a8fff' },
  { en: 'Burj Khalifa', r: 415, note: 'height', color: '#c08fff' },
  { en: 'Mount Everest', r: 4425, note: 'height above sea level', color: '#e08fe8' },
  { en: 'Greater London', r: 2.5e4, note: 'across the city', color: '#ff8fcf' },
  { en: 'Earth', r: 6.371e6, note: 'mean radius', color: '#3f83d8' },
  { en: 'Jupiter', r: 6.9911e7, note: 'equatorial radius', color: '#c8a07a' },
  { en: 'The Sun', r: 6.957e8, note: 'photosphere', color: '#ffae3d' },
  { en: "Earth's orbit", r: 1.495979e11, note: '1 astronomical unit', color: '#ffcf5c' },
  { en: "Neptune's orbit", r: 4.495060e12, note: '30 AU', color: '#4a72c8' },
  { en: 'One light-year', r: LY, note: 'light travels this in a year', color: '#5cd0ff' },
  { en: 'Proxima Centauri', r: 4.2465 * LY, note: 'nearest star', color: '#ff9f6b' },
  { en: 'The Milky Way', r: 4.7e20, note: 'about 50 000 light-years', color: '#d6c6ff' },
  { en: 'Local Group', r: 2.4e22, note: 'our galaxy cluster', color: '#9a8fff' },
  { en: 'Observable universe', r: 4.4e26, note: '46.5 billion light-years', color: '#ffffff' },
];
