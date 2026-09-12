// Every number the film shows on screen lives here, in SI units, with a source
// note. Scenes read from this file — no magic numbers in the drawing code, so a
// caption can never drift away from the geometry it describes.
//
// Sources: NASA/JPL planetary fact sheets (equatorial radii, mean distances),
// IAU 2012 definition of the astronomical unit, CODATA speed of light.

export const KM = 1e3;

export const EARTH = {
  name: 'Земля',
  r: 6371.0 * KM,          // volumetric mean radius
  d: 12742.0 * KM,
  color: '#3f83d8',
  color2: '#8fc4f5',
};

export const MOON = {
  name: 'Луна',
  r: 1737.4 * KM,
  d: 3474.8 * KM,
  color: '#8b93a3',
  color2: '#d6dae2',
};

export const SUN = {
  name: 'Солнце',
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
  { name: 'Меркурий', d: 4879 * KM, color: '#9c8d7f', color2: '#cbbfb2' },
  { name: 'Венера', d: 12104 * KM, color: '#d8a25c', color2: '#f4d9a8' },
  { name: 'Марс', d: 6779 * KM, color: '#c2603c', color2: '#e79a76' },
  { name: 'Юпитер', d: 139822 * KM, color: '#c8a07a', color2: '#efd5b6' },
  { name: 'Сатурн', d: 116464 * KM, color: '#d3b686', color2: '#f0dcb8' },
  { name: 'Уран', d: 50724 * KM, color: '#7fc3c9', color2: '#bfe6ea' },
  { name: 'Нептун', d: 49244 * KM, color: '#4a72c8', color2: '#93aeec' },
];

export const PLANETS_TOTAL_D = OTHER_PLANETS.reduce((s, p) => s + p.d, 0);

/** Light-travel times used by scene 3. */
export const LIGHT_TIMES = [
  { name: 'до Луны', s: MOON_ORBIT.mean / C_LIGHT },
  { name: 'до Солнца', s: AU / C_LIGHT },
  { name: 'до Нептуна', s: (30.07 * AU) / C_LIGHT },
  { name: 'до Проксимы Центавра', s: 4.2465 * 31557600 },
];
