// What the cards say about each body. Geometry (radii, orbits) comes from
// ../data.js so the picture and the numbers cannot disagree; this file only
// adds the words and the fact-sheet values the cards show.
//
// Sources: NASA/JPL Planetary Fact Sheets (surface gravity, sidereal rotation,
// orbital period, mean temperature, moon counts as of 2024).

export const FACTS = {
  Sun: {
    epithet: 'The Furnace',
    blurb: 'A ball of plasma 109 Earths across. Everything else in this demo would fit inside it a million times over.',
    gravity: 27.9, day: 609.1, year: null, temp: 5500, moons: null, mass: 333000,
    tex: 'sun.jpg', hi: 'sun_4k.jpg', emissive: true, limb: true,
  },
  Mercury: {
    epithet: 'The Scorched Messenger',
    blurb: 'Smallest planet, closest to the Sun. A day here lasts two of its years.',
    gravity: 0.38, day: 1407.6, year: 88.0, temp: 167, moons: 0, mass: 0.0553,
    tex: 'mercury.jpg', hi: 'mercury_4k.jpg', bump: 0.02,
  },
  Venus: {
    epithet: 'The Veiled Twin',
    blurb: 'Earth-sized, wrapped in clouds of sulphuric acid. The hottest surface of any planet.',
    gravity: 0.904, day: 5832.5, year: 224.7, temp: 464, moons: 0, mass: 0.815,
    tex: 'venus_atmosphere.jpg', atmosphere: { scale: 1.012, color: '#f1dcb0' },
  },
  Earth: {
    epithet: 'The Pale Blue Dot',
    blurb: 'Home. Everything in these scenes is measured against it: one Earth radius is the unit.',
    gravity: 1.0, day: 23.9, year: 365.25, temp: 15, moons: 1, mass: 1,
    tex: 'earth_daymap.jpg', hi: 'earth_daymap_4k.jpg', clouds: 'earth_clouds.jpg', night: 'earth_nightmap.jpg',
    normal: 'earth_normal.jpg', hiNormal: 'earth_normal_4k.jpg', rough: 'earth_rough.jpg', hiRough: 'earth_rough_4k.jpg',
    atmosphere: { scale: 1.016, color: '#8cc3ff' },   // Kármán line, 100 km
  },
  Moon: {
    epithet: 'The Quiet Companion',
    blurb: 'A quarter of Earth across, thirty Earths away. Almost every drawing puts it far too close.',
    gravity: 0.166, day: 708.7, year: 27.3, temp: -20, moons: null, mass: 0.0123,
    tex: 'moon.jpg', hi: 'moon_4k.jpg', bump: 0.07, craters: true,
  },
  Mars: {
    epithet: 'The Rusted World',
    blurb: 'Half the size of Earth, with the tallest volcano and the deepest canyon in the solar system.',
    gravity: 0.379, day: 24.6, year: 687.0, temp: -65, moons: 2, mass: 0.107,
    tex: 'mars.jpg', hi: 'mars_4k.jpg', bump: 0.015, atmosphere: { scale: 1.012, color: '#e8c4a0' },
  },
  Jupiter: {
    epithet: 'The Storm King',
    blurb: 'Eleven Earths across. Its Great Red Spot alone is wider than our planet.',
    gravity: 2.53, day: 9.9, year: 4333, temp: -110, moons: 95, mass: 317.8,
    tex: 'jupiter.jpg', hi: 'jupiter_4k.jpg',
  },
  Saturn: {
    epithet: 'The Ringed Giant',
    blurb: 'Light enough to float on water, with rings that span 280 000 km yet are only tens of metres thick.',
    gravity: 1.07, day: 10.7, year: 10759, temp: -140, moons: 146, mass: 95.2,
    tex: 'saturn.jpg', hi: 'saturn_4k.jpg', ring: { inner: 1.24, outer: 2.27, tex: 'saturn_ring_alpha.png', tilt: 26.7 },
  },
  Uranus: {
    epithet: 'The Sideways World',
    blurb: 'Rolls around the Sun on its side. Four Earths across, cold enough for methane to freeze.',
    gravity: 0.905, day: 17.2, year: 30687, temp: -195, moons: 28, mass: 14.5,
    tex: 'uranus.jpg',
  },
  Neptune: {
    epithet: 'The Far Blue',
    blurb: 'Thirty times further from the Sun than we are. Its winds reach 2 000 km/h.',
    gravity: 1.14, day: 16.1, year: 60190, temp: -200, moons: 16, mass: 17.1,
    tex: 'neptune.jpg',
  },
  'Sagittarius A*': {
    epithet: 'The Galactic Anchor',
    blurb: 'The black hole at the centre of the Milky Way: 4.3 million Suns inside an event horizon 18 Suns across.',
    day: null, massText: '4.3 million ☉', kind: 'blackhole',
    tex: 'sgr_a.svg',
  },
  Betelgeuse: {
    epithet: 'The Red Supergiant',
    blurb: 'A red supergiant 550 light-years away, about 760 Suns across. In the Sun\'s place it would swallow Mars and the whole asteroid belt and stop just short of Jupiter.',
    day: null, massText: '16–19 ☉', kind: 'star', emissive: true, limb: true,
    tex: 'betelgeuse.jpg', proc: true, limbDark: '#3a0800',
  },
};

/** Fact-sheet rows for the overview card, in display order. */
export const ROWS = [
  { key: 'gravity', label: 'Gravity', icon: '↓', fmt: (v) => `${v} g`, log: true },
  { key: 'day', label: 'Day length', icon: '◷', fmt: (v) => (v >= 48 ? `${(v / 24).toFixed(v / 24 < 10 ? 1 : 0)} days` : `${v} h`), log: true },
  { key: 'year', label: 'Year', icon: '◯', fmt: (v) => (v >= 1000 ? `${(v / 365.25).toFixed(1)} yr` : `${v} days`), log: true },
  { key: 'temp', label: 'Mean temp.', icon: '🌡', fmt: (v) => `${v > 0 ? '+' : ''}${v} °C`, lin: [-220, 500] },
  { key: 'moons', label: 'Moons', icon: '◌', fmt: (v) => `${v}`, lin: [0, 150] },
  { key: 'mass', label: 'Mass', icon: '⚖', fmt: (v) => (v >= 1000 ? `${Math.round(v / 1000)} 000 ⊕` : `${v} ⊕`), log: true },
];
