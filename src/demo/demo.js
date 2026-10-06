// The demo: two 3D scenes behind a card UI. Same numbers as the main app
// (../data.js), same honesty about scale, different clothes.
//
//   Sizes          pick bodies on the left; they line up at true relative size,
//                  with the Sun's limb at the right edge when it is picked.
//   Solar System   distances: orbits, a light pulse, a clock; true scale or a
//                  compressed layout that says so.
//
// Scene unit: one Earth radius.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { EARTH, MOON, SUN, PLANETS, AU, C_LIGHT } from '../data.js';
import { lengthStr, lightTime, clockFace } from '../units.js';
import { FACTS } from './facts.js';

const ER = EARTH.r;
const U = (metres) => metres / ER;
const el = (id) => document.getElementById(id);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const now = () => performance.now();
const fmt = (v, d = 2) => v.toLocaleString('en-US', { maximumFractionDigits: d });

// ------------------------------------------------------------ renderer -----

const canvas = el('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
// Two cameras: the perspective one for looking around, an orthographic one
// for the side-on size comparison, where perspective would lie about which
// sphere is bigger. `camera` is whichever is in use.
const persp = new THREE.PerspectiveCamera(34, 1, 0.02, 2e7);
persp.position.set(0, 1, 9);
const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.02, 2e7);
let camera = persp;
let orthoW = 10;          // frustum width of the ortho camera, scene units

const controls = new OrbitControls(camera, canvas);
controls.enablePan = false;
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.rotateSpeed = 0.55;
controls.minDistance = 0.3;
controls.maxDistance = 6e6;
controls.addEventListener('start', () => {
  camTween = null;
  if (follow) { follow = false; renderDock(); }
  // Any hand on the camera ends the straight-on comparison view.
  if (side) setSide(false, true);
  canvas.classList.add('dragging');
});
controls.addEventListener('end', () => canvas.classList.remove('dragging'));

const hemi = new THREE.HemisphereLight(0xffffff, 0xd9dde6, 1.25);
scene.add(hemi);
const sunLight = new THREE.DirectionalLight(0xfff4e0, 2.3);
sunLight.position.set(1, 0.35, 0.55);
scene.add(sunLight);
const sunPoint = new THREE.PointLight(0xfff1d6, 0, 0, 0);
scene.add(sunPoint);
// A cool rim from behind-left lifts the dark limb off the pale background.
const rim = new THREE.DirectionalLight(0xdbe8ff, 0.7);
rim.position.set(-0.8, 0.5, -1);
scene.add(rim);
// Sun direction in view space, for the Earth's night lights.
const uSun = { value: new THREE.Vector3(1, 0, 0) };

// A far star field for the dark theme; it rides along with the camera so it
// reads as infinitely far at every zoom.
const stars = (() => {
  const n = 2200;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    pos.set([s * Math.cos(a), u, s * Math.sin(a)], i * 3);
    const w = 0.45 + Math.random() * 0.55;
    const warm = Math.random();
    col.set([w, w * (0.92 + warm * 0.08), w * (0.85 + (1 - warm) * 0.15)], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({
    size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false,
  }));
  p.scale.setScalar(1e6);
  p.visible = false;
  p.renderOrder = -10;
  scene.add(p);
  return p;
})();

// ---------------------------------------------------------------- theme ----

const THEMES = {
  light: { hemi: 1.25, hemiSky: 0xffffff, hemiGround: 0xd9dde6, rim: 0.7, orbit: 0xaab1be, stars: false },
  dark: { hemi: 0.42, hemiSky: 0x9fb0d0, hemiGround: 0x0c0f16, rim: 0.4, orbit: 0x3a4356, stars: true },
};
let theme = 'light';
function setTheme(t) {
  if (!THEMES[t]) return;
  theme = t;
  const th = THEMES[t];
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name=color-scheme]').content = t;
  try { localStorage.setItem('demo-theme', t); } catch { /* private mode */ }
  hemi.color.setHex(th.hemiSky);
  hemi.groundColor.setHex(th.hemiGround);
  rim.intensity = th.rim;
  stars.visible = th.stars;
  for (const o of state.orbits) o.material.color.setHex(th.orbit);
  if (state.mode) applyLights();
  const btn = el('theme');
  if (btn) btn.textContent = t === 'dark' ? '☀' : '☾';
}
function applyLights() {
  const multi = MODES[state.mode].multi;
  const th = THEMES[theme];
  sunLight.intensity = multi ? 2.3 : 0.35;
  sunPoint.intensity = multi ? 0 : 3.2;
  hemi.intensity = multi ? th.hemi : th.hemi * 0.92;
}

// ------------------------------------------------------------ textures -----

// Textures live next to this file; a host that cannot serve them (the Vercel
// preview) points elsewhere with <html data-tex="https://…/tex/">.
const TEX_BASE = document.documentElement.dataset.tex || './tex/';
// The 2k set loads first and lifts the curtain; 4k versions of the hero
// bodies stream in behind it and swap into the materials as they land.
const pendingHi = [];
const manager = new THREE.LoadingManager(() => {
  el('loading').classList.add('off');
  for (const { mat, slot, name, srgb } of pendingHi) {
    loadTex(name, srgb, null, (t) => { mat[slot] = t; mat.needsUpdate = true; });
  }
});
const loader = new THREE.TextureLoader(manager);
const hiLoader = new THREE.TextureLoader();
const texCache = new Map();
function loadTex(name, srgb, ldr, onLoad) {
  const t = (ldr ?? hiLoader).load(`${TEX_BASE}${name}`, onLoad);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
function tex(name, srgb = true) {
  if (!texCache.has(name)) texCache.set(name, loadTex(name, srgb, loader));
  return texCache.get(name);
}
const hi = (mat, slot, name, srgb = true) => { if (name) pendingHi.push({ mat, slot, name, srgb }); };

function coronaTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(256, 256, 0, 256, 256, 256);
  grad.addColorStop(0.0, 'rgba(255, 214, 150, 0.95)');
  grad.addColorStop(0.70, 'rgba(255, 190, 110, 0.8)');
  grad.addColorStop(0.78, 'rgba(255, 170, 80, 0.4)');
  grad.addColorStop(0.9, 'rgba(255, 160, 70, 0.07)');
  grad.addColorStop(1.0, 'rgba(255, 160, 70, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// -------------------------------------------------------------- bodies -----

const SPHERE = new THREE.SphereGeometry(1, 96, 64);

const ATMO = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  side: THREE.BackSide,
  uniforms: { color: { value: new THREE.Color('#8cc3ff') } },
  vertexShader: `
    varying vec3 vN; varying vec3 vP;
    void main() {
      vN = normalize(normalMatrix * normal);
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vP = mv.xyz;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    uniform vec3 color; varying vec3 vN; varying vec3 vP;
    void main() {
      float d = dot(normalize(vN), normalize(-vP));
      float a = pow(clamp(-d / 0.42, 0.0, 1.0), 1.6);
      gl_FragColor = vec4(color, a * 0.6);
    }`,
});

/** A body: group + mesh, plus the HTML label and marker that follow it. */
function makeBody(name, rMetres, color) {
  const f = FACTS[name];
  const r = U(rMetres);
  const group = new THREE.Group();
  const spin = new THREE.Group();
  group.add(spin);
  let mesh;

  if (f.emissive) {
    mesh = new THREE.Mesh(SPHERE, new THREE.MeshBasicMaterial({ map: tex(f.tex), color: 0xfff6e6 }));
    // Depth-tested so the halo stays behind anything in front of the Sun
    // instead of tinting it; it only shows where there is sky.
    const corona = new THREE.Sprite(new THREE.SpriteMaterial({
      map: coronaTexture(), transparent: true, depthWrite: false, depthTest: true,
    }));
    corona.scale.setScalar(2.5);
    corona.renderOrder = -2;
    group.add(corona);
    hi(mesh.material, 'map', f.hi);
  } else if (f.normal) {
    // Earth: relief, glossy oceans, and city lights that only show at night.
    const m = new THREE.MeshStandardMaterial({
      map: tex(f.tex), normalMap: tex(f.normal, false), normalScale: new THREE.Vector2(0.7, 0.7),
      roughnessMap: tex(f.rough, false), roughness: 1, metalness: 0.02,
      emissiveMap: tex(f.night), emissive: new THREE.Color('#ffd49a'), emissiveIntensity: 1.1,
    });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uSun = uSun;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uSun;')
        .replace('#include <emissivemap_fragment>',
          '#include <emissivemap_fragment>\n'
          + 'totalEmissiveRadiance *= 1.0 - smoothstep(-0.12, 0.22, dot(normalize(vNormal), normalize(uSun)));');
    };
    mesh = new THREE.Mesh(SPHERE, m);
    hi(m, 'map', f.hi);
    hi(m, 'normalMap', f.hiNormal, false);
    hi(m, 'roughnessMap', f.hiRough, false);
  } else {
    const m = new THREE.MeshStandardMaterial({ map: tex(f.tex), roughness: 0.92, metalness: 0 });
    if (f.bump) { m.bumpMap = tex(f.tex); m.bumpScale = f.bump; }
    mesh = new THREE.Mesh(SPHERE, m);
    hi(m, 'map', f.hi);
    if (f.bump && f.hi) hi(m, 'bumpMap', f.hi);
  }
  spin.add(mesh);

  if (f.clouds) {
    const clouds = new THREE.Mesh(SPHERE, new THREE.MeshLambertMaterial({
      alphaMap: tex(f.clouds, false), color: 0xffffff, transparent: true, depthWrite: false, opacity: 0.7,
    }));
    clouds.scale.setScalar(1.012);
    clouds.userData.spin = 1.4;
    spin.add(clouds);
  }
  if (f.atmosphere) {
    const atmo = new THREE.Mesh(SPHERE, ATMO);
    atmo.scale.setScalar(1.085);
    group.add(atmo);
  }
  if (f.ring) {
    const geo = new THREE.RingGeometry(f.ring.inner, f.ring.outer, 160, 1);
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const len = Math.hypot(pos.getX(i), pos.getY(i));
      uv.setXY(i, (len - f.ring.inner) / (f.ring.outer - f.ring.inner), 0.5);
    }
    const ring = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      map: tex(f.ring.tex), transparent: true, side: THREE.DoubleSide, depthWrite: false, color: 0xf3e9d3, opacity: 0.95,
    }));
    ring.rotation.x = -Math.PI / 2;
    group.add(ring);
    // Tipped towards the viewer, as Saturn shows itself from Earth at the
    // open end of its 29-year cycle; edge-on the rings would be a pencil line.
    group.rotation.x = THREE.MathUtils.degToRad(f.ring.tilt);
  } else if (name === 'Earth') {
    group.rotation.z = THREE.MathUtils.degToRad(-23.4);
  } else if (name === 'Uranus') {
    group.rotation.z = THREE.MathUtils.degToRad(-82);
  }

  group.scale.setScalar(r);

  const label = document.createElement('div');
  label.className = 'label' + (name === 'Sun' || name === 'Earth' ? ' cool' : '');
  label.innerHTML = `<b>${name}</b>`;
  const marker = document.createElement('div');
  marker.className = 'marker';
  marker.style.background = color;
  el('labels').append(marker, label);

  return {
    name, r, color, facts: f, group, spin, label, marker,
    // Horizontal half-extent used to space the row. Saturn gets a third of
    // its ring span: the rings may overlap a neighbour, the globes may not.
    ext: f.ring ? r * (1 + (f.ring.outer - 1) / 3) : r,
    pos: new THREE.Vector3(), tween: null, size: 1, sizeTween: null, shown: true,
  };
}

function tweenTo(b, target, dur = 1500, delay = 0) {
  b.tween = { from: b.pos.clone(), to: target.clone(), t0: now() + delay, dur };
}
function tweenSize(b, size, dur = 1200, delay = 0) {
  b.sizeTween = { from: b.size, to: size, t0: now() + delay, dur };
}

// --------------------------------------------------------------- modes -----

const SIZE_BODIES = [
  ['Sun', SUN.r, SUN.color],
  ...PLANETS.slice(0, 3).map((p) => [p.name, p.r, p.color]),
  ['Moon', MOON.r, MOON.color],
  ...PLANETS.slice(3).map((p) => [p.name, p.r, p.color]),
];

const PRESETS = {
  home: ['Earth', 'Moon', 'Sun'],
  planets: PLANETS.map((p) => p.name),
  all: SIZE_BODIES.map((b) => b[0]),
};

const MODES = {
  'earth-moon': {
    title: 'Sizes',
    multi: true,
    variants: [],
    speeds: [1],
    build() {
      const bodies = SIZE_BODIES.map(([n, r, c]) => makeBody(n, r, c));
      return { bodies, origin: bodies[0], targets: [] };
    },
  },

  'solar-system': {
    title: 'Distances',
    multi: false,
    variants: [['compressed', 'Compressed'], ['true', 'True scale']],
    speeds: [60, 600, 3600, 1],
    build() {
      const bodies = [makeBody('Sun', SUN.r, SUN.color), ...PLANETS.map((p) => makeBody(p.name, p.r, p.color))];
      const orbits = PLANETS.map((p) => {
        const pts = [];
        for (let i = 0; i <= 256; i++) {
          const a = (i / 256) * Math.PI * 2;
          pts.push(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)));
        }
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({ color: 0xaab1be }),
        );
        line.userData.a = U(p.a);
        return line;
      });
      for (const o of orbits) o.material.color.setHex(THEMES[theme].orbit);
      // The pulse leaves the photosphere, not the centre: distances to cover
      // are measured from the Sun's surface.
      return { bodies, orbits, origin: bodies[0], targets: PLANETS.map((p) => ({ name: p.name, d: p.a - SUN.r })) };
    },
    layout(v) {
      const [sun, ...planets] = state.bodies;
      const RN = U(PLANETS[7].a);
      tweenTo(sun, new THREE.Vector3(0, 0, 0));
      tweenSize(sun, v === 'true' ? 1 : (COMP_SIZE.Sun * RN) / sun.r);
      PLANETS.forEach((p, i) => {
        const b = planets[i];
        const d = v === 'true' ? U(p.a) : compress(U(p.a));
        tweenTo(b, new THREE.Vector3(Math.cos(p.angle) * d, 0, Math.sin(p.angle) * d));
        tweenSize(b, v === 'true' ? 1 : (COMP_SIZE[p.name] * RN) / b.r);
        state.orbits[i].userData.target = d;
      });
      return { center: new THREE.Vector3(0, 0, 0), width: RN * 2.25, el: 52, az: 12 };
    },
  },
};

// Compressed variant of the solar system: orbit radii follow a power law
// (Mercury lands at 16 % of Neptune instead of 1.3 %), and the bodies are
// inflated to a fixed fraction of Neptune's orbit so they read on screen.
// The light pulse goes through the same mapping, so it still reaches each
// planet at the real moment.
const COMP_P = 0.42;
const compress = (d) => {
  const RN = U(PLANETS[7].a);
  return RN * Math.pow(Math.max(d, 0) / RN, COMP_P);
};
// Inflated radii, as fractions of Neptune's orbit. Not to scale and cannot
// be (the real Sun would be a pixel), but the order and the gaps between
// the tiers hold: the Sun is ~4× Jupiter, Jupiter ~2.3× Earth, Earth ~1.6×
// Mercury.
const COMP_SIZE = {
  Sun: 0.062, Jupiter: 0.0165, Saturn: 0.014, Uranus: 0.0096, Neptune: 0.0094,
  Earth: 0.0072, Venus: 0.007, Mars: 0.0056, Mercury: 0.0046,
};

// --------------------------------------------------------------- state -----

const state = {
  mode: null, variant: null, bodies: [], orbits: [], root: null,
  selected: null, picked: new Set(), origin: null, targets: [],
};
const pulse = { on: false, sim: 0, speed: 1, arrivals: [], next: 0, mesh: null, ring: null };
let camTween = null;
let follow = false;
let lastT = now();

function setMode(id, variant) {
  const def = MODES[id];
  if (!def) return;
  if (state.root) {
    scene.remove(state.root);
    for (const b of state.bodies) { b.label.remove(); b.marker.remove(); }
  }
  state.mode = id;
  const built = def.build();
  Object.assign(state, built, { root: new THREE.Group(), selected: null, orbits: built.orbits ?? [] });
  for (const b of state.bodies) {
    state.root.add(b.group);
    b.group.position.copy(b.pos);
  }
  for (const o of state.orbits) state.root.add(o);
  scene.add(state.root);
  document.body.classList.toggle('sizes', !!def.multi);

  // Lighting: a Sun off to the right in the size row, a Sun at the centre of
  // the solar scene.
  applyLights();
  if (side) setSide(false, true);

  resetPulse();
  pulse.speed = def.speeds[0];
  follow = !def.multi;
  state.variant = null;

  if (def.multi) {
    state.picked = new Set(PRESETS.home);
    for (const b of state.bodies) { b.shown = false; b.size = 0; }
    layoutSizes(true);
    setTip(null);
  } else {
    setVariant(variant ?? def.variants[0][0], true);
    select(state.bodies[0], true);
  }
  settle();

  for (const btn of el('modes').querySelectorAll('button')) btn.classList.toggle('on', btn.dataset.mode === id);
  history.replaceState(null, '', `#${id}`);
  renderList();
  renderDock();
  renderDots();
  renderOverview();
}

/** Finish every tween at once — for the first frame of a mode. */
function settle() {
  for (const b of state.bodies) {
    if (b.tween) { b.pos.copy(b.tween.to); b.tween = null; }
    if (b.sizeTween) { b.size = b.sizeTween.to; b.sizeTween = null; }
  }
  if (camTween) { camera.position.copy(camTween.p1); controls.target.copy(camTween.t1); camTween = null; }
}

function setVariant(v, instant = false) {
  if (v === state.variant || !MODES[state.mode].layout) return;
  state.variant = v;
  const frame = MODES[state.mode].layout(v);
  flyFrame(frame, instant ? 0 : 1600);
  setTip(v === 'compressed'
    ? 'Compressed: orbits squeezed, bodies enlarged so they show. Distances and the clock stay honest; True scale is the real picture.'
    : null);
  renderDock();
}

const TIP_DEFAULT = 'Drag to orbit, scroll to zoom. Pick a body on the left to fly there.';
function setTip(text) { el('tipText').textContent = text ?? TIP_DEFAULT; }

// ------------------------------------------------------------ size row -----

/**
 * Lay the picked bodies in a row, smallest to largest, at true relative size.
 * The Sun, when picked, stands past the right end so only its limb is in
 * frame — unless it is the only thing picked, in which case it is the frame.
 */
function layoutSizes(instant = false) {
  const picked = state.bodies.filter((b) => state.picked.has(b.name));
  // Smallest to largest by footprint, so Saturn's rings end the row instead
  // of lying across Jupiter and Uranus.
  const row = picked.filter((b) => b.name !== 'Sun').sort((a, b) => a.ext - b.ext);
  const sun = picked.find((b) => b.name === 'Sun');

  let x = 0;
  let prev = null;
  const place = new Map();
  const full = (b) => (b.facts.ring ? b.r * b.facts.ring.outer : b.r);
  let reach = 0;      // rightmost pixel of anything, rings included
  for (const b of row) {
    if (prev) x += 0.12 * Math.max(prev.ext, b.ext) + 0.12;
    x += b.ext;
    place.set(b, x);
    reach = Math.max(reach, x + full(b));
    x += b.ext;
    prev = b;
  }
  const rowW = Math.max(x, reach);
  let left = row.length ? -0.4 : 0;
  let right = row.length ? rowW + 0.4 : 0;
  if (sun) {
    if (row.length) {
      const limb = rowW + Math.max(0.7, rowW * 0.08);
      place.set(sun, limb + sun.r);
      right = limb + Math.max(1.1, rowW * 0.14);
    } else {
      place.set(sun, 0);
      left = -sun.r * 1.15;
      right = sun.r * 1.15;
    }
  }

  for (const b of state.bodies) {
    const target = place.get(b);
    if (target != null) {
      if (!b.shown) {
        // New arrival: drop in from above, or just swell up when it is the Sun.
        const dropFrom = b.name === 'Sun' ? 0 : 3 + b.r * 2.5;
        b.pos.set(target, dropFrom, 0);
        b.size = 0;
      }
      tweenTo(b, new THREE.Vector3(target, 0, 0), instant ? 0.001 : 1300);
      tweenSize(b, 1, instant ? 0.001 : 1000);
      b.shown = true;
    } else if (b.shown) {
      tweenTo(b, new THREE.Vector3(b.pos.x, b.name === 'Sun' ? 0 : -(3 + b.r * 2.5), 0), 900);
      tweenSize(b, 0, 700);
      b.shown = false;
    }
  }

  const width = Math.max(right - left, 4) * 1.08;
  const center = new THREE.Vector3((left + right) / 2, (sun && !row.length ? 0 : 0.05), 0);
  flyFrame({ center, width, el: side ? 0 : 6 }, instant ? 0 : 1500);
}

// ------------------------------------------------------------ side view ----

let side = false;        // orthographic, straight along the row
let switchAt = null;     // swap cameras once the fly-in has landed

/**
 * Compare view: fly the perspective camera straight in front of the row, then
 * hand over to the orthographic one at the same framing, so nothing jumps
 * except the perspective itself. It is a one-shot: the first drag or scroll
 * hands the scene back to the ordinary camera where it stands.
 */
function setSide(on, instant = false) {
  if (on === side) {
    if (on && state.frame) flyFrame(state.frame, instant ? 0 : 1200);
    return;
  }
  side = on;
  if (on) {
    if (state.frame) flyFrame(state.frame, instant ? 0 : 1200);
    if (instant) toOrtho(); else switchAt = camTween;
  } else {
    switchAt = null;
    toPersp();
    if (!instant && state.frame) flyFrame(state.frame, 1200);
  }
  renderDock();
}

function toOrtho() {
  const dist = persp.position.distanceTo(controls.target);
  const vfov = THREE.MathUtils.degToRad(persp.fov);
  orthoW = 2 * dist * Math.tan(vfov / 2) * persp.aspect;
  ortho.zoom = 1;
  ortho.position.copy(persp.position);
  ortho.quaternion.copy(persp.quaternion);
  camera = ortho;
  controls.object = ortho;
  fitOrtho();
}

function toPersp() {
  if (camera !== ortho) return;
  const vfov = THREE.MathUtils.degToRad(persp.fov);
  const dir = ortho.position.clone().sub(controls.target).normalize();
  const d = ((orthoW / ortho.zoom) / 2) / (Math.tan(vfov / 2) * persp.aspect);
  persp.position.copy(controls.target).add(dir.multiplyScalar(d));
  persp.quaternion.copy(ortho.quaternion);
  camera = persp;
  controls.object = persp;
}

function fitOrtho() {
  ortho.left = -orthoW / 2;
  ortho.right = orthoW / 2;
  ortho.top = orthoW / (2 * persp.aspect);
  ortho.bottom = -ortho.top;
  ortho.updateProjectionMatrix();
}

function togglePick(b) {
  if (state.picked.has(b.name)) state.picked.delete(b.name);
  else state.picked.add(b.name);
  layoutSizes();
  renderList();
  renderDock();
  renderOverview();
}

function setPicked(names) {
  state.picked = new Set(names);
  layoutSizes();
  renderList();
  renderDock();
  renderOverview();
}

// -------------------------------------------------------------- camera -----

/** Camera distance that fits `width` scene units across the viewport. */
function distanceFor(width) {
  const vfov = THREE.MathUtils.degToRad(persp.fov);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * persp.aspect);
  return (width / 2) / Math.tan(hfov / 2);
}

/** The part of the viewport the cards leave open, in CSS pixels. */
function freeArea() {
  const W = canvas.clientWidth, H = canvas.clientHeight;
  const list = el('list'), side = el('side');
  if (W < 860 || getComputedStyle(list).display === 'none') return { left: 0, right: W, top: 0, bottom: H, W, H };
  const l = list.getBoundingClientRect(), r = side.getBoundingClientRect();
  return { left: l.right, right: r.left, top: 0, bottom: H, W, H };
}

function flyFrame({ center, width, el: elev = 10, az = 0 }, dur = 1500) {
  state.frame = { center, width, el: elev, az };
  // Fit `width` into the open band between the columns and aim the camera so
  // the scene centres in that band rather than behind a card.
  const f = freeArea();
  const scale = f.W / Math.max(1, f.right - f.left);
  const fullWidth = width * scale;
  const d = distanceFor(fullWidth);
  const e = THREE.MathUtils.degToRad(elev);
  const a = THREE.MathUtils.degToRad(az);
  const right = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));
  const shift = ((f.W / 2 - (f.left + f.right) / 2) / f.W) * fullWidth;
  const target = center.clone().add(right.multiplyScalar(shift));
  const pos = new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)).multiplyScalar(d).add(target);
  flyTo(pos, target, dur);
  if (camera === ortho) {
    camTween = camTween ?? { p0: pos.clone(), p1: pos.clone(), t0: target.clone(), t1: target.clone(), start: now(), dur: 1 };
    camTween.w0 = orthoW / ortho.zoom;
    camTween.w1 = fullWidth;
    if (dur <= 0) { orthoW = fullWidth; ortho.zoom = 1; fitOrtho(); camTween = null; }
  }
}

function flyTo(pos, target, dur = 1500) {
  if (dur <= 0) {
    camera.position.copy(pos);
    controls.target.copy(target);
    camTween = null;
    return;
  }
  camTween = { p0: camera.position.clone(), p1: pos.clone(), t0: controls.target.clone(), t1: target.clone(), start: now(), dur };
}

/** Fly to a body, keeping the current viewing direction. */
function flyToBody(b) {
  const dir = camera.position.clone().sub(controls.target).normalize();
  if (dir.lengthSq() < 1e-6) dir.set(0, 0.2, 1).normalize();
  // Aim at where the body is going, not where it is mid-tween, or a click
  // during a layout change leaves the camera staring at empty space.
  const dest = b.tween ? b.tween.to : b.pos;
  const size = b.sizeTween ? b.sizeTween.to : b.size;
  const r = b.r * Math.max(size, 0.001);
  const vfov = THREE.MathUtils.degToRad(persp.fov);
  const d = (r / Math.tan(vfov / 2)) * (b.name === 'Sun' ? 2.3 : 2.1);
  // Centre the body in the band between the columns, not behind a card.
  const f = freeArea();
  const width = 2 * d * Math.tan(vfov / 2) * persp.aspect;
  const shift = ((f.W / 2 - (f.left + f.right) / 2) / f.W) * width;
  const right = new THREE.Vector3().crossVectors(dir, camera.up).normalize().negate();
  const target = dest.clone().add(right.multiplyScalar(shift));
  flyTo(target.clone().add(dir.multiplyScalar(d)), target, 1500);
}

// --------------------------------------------------------------- pulse -----

const PULSE_COLOR = 0x17a589;

function ensurePulse() {
  if (pulse.mesh) return;
  // The shell: a fresnel wash that thickens towards the limb, so the front
  // reads as a surface rather than a flat tint.
  pulse.mesh = new THREE.Mesh(SPHERE, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.FrontSide,
    uniforms: { color: { value: new THREE.Color(PULSE_COLOR) }, opacity: { value: 1 } },
    vertexShader: `
      varying vec3 vN; varying vec3 vP;
      void main() {
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vP = mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 color; uniform float opacity; varying vec3 vN; varying vec3 vP;
      void main() {
        float d = abs(dot(normalize(vN), normalize(-vP)));
        float a = 0.07 + 0.55 * pow(1.0 - d, 3.0);
        gl_FragColor = vec4(color, a * opacity);
      }`,
  }));
  pulse.mesh.renderOrder = 5;

  // The front itself: a fat line, constant width in pixels at every zoom.
  const ring = [];
  for (let i = 0; i <= 256; i++) {
    const a = (i / 256) * Math.PI * 2;
    ring.push(Math.cos(a), 0, Math.sin(a));
  }
  const ringGeo = new LineGeometry();
  ringGeo.setPositions(ring);
  pulse.ring = new Line2(ringGeo, new LineMaterial({
    color: PULSE_COLOR, linewidth: 3, transparent: true, opacity: 0.95, depthWrite: false,
  }));
  pulse.ring.renderOrder = 6;

  // The radius vector: Sun → front, aimed at the next planet in line, with
  // the elapsed time and distance written at its tip.
  const vecGeo = new LineGeometry();
  vecGeo.setPositions([0, 0, 0, 1, 0, 0]);
  pulse.vec = new Line2(vecGeo, new LineMaterial({
    color: PULSE_COLOR, linewidth: 1.5, transparent: true, opacity: 0.7, depthWrite: false,
  }));
  pulse.vec.renderOrder = 6;
  pulse.ang = 0;

  pulse.tag = document.createElement('div');
  pulse.tag.className = 'ptag';
  el('labels').append(pulse.tag);

  scene.add(pulse.mesh, pulse.ring, pulse.vec);
  setPulseVisible(false);
}

function setPulseVisible(on) {
  if (!pulse.mesh) return;
  pulse.mesh.visible = pulse.ring.visible = pulse.vec.visible = on;
  pulse.tag.style.opacity = on ? 1 : 0;
}

/** Direction from the Sun to the planet the pulse will reach next. */
function nextAngle() {
  const t = state.targets[Math.min(pulse.next, state.targets.length - 1)];
  const b = state.bodies.find((x) => x.name === t.name);
  const p = b.tween ? b.tween.to : b.pos;
  return Math.atan2(p.z, p.x);
}

function startPulse() {
  if (MODES[state.mode].multi) return;
  ensurePulse();
  pulse.on = true;
  pulse.sim = 0;
  pulse.arrivals = [];
  pulse.next = 0;
  pulse.ang = nextAngle();
  setPulseVisible(true);
  follow = true;
  renderDock();
  renderOverview();
}

function resetPulse() {
  pulse.on = false;
  pulse.sim = 0;
  pulse.arrivals = [];
  pulse.next = 0;
  setPulseVisible(false);
}

function cycleSpeed() {
  const speeds = MODES[state.mode].speeds;
  pulse.speed = speeds[(speeds.indexOf(pulse.speed) + 1) % speeds.length];
  renderDock();
  renderOverview();
}

function tickPulse(dt) {
  if (!pulse.on) return;
  pulse.sim += dt * pulse.speed;
  const metres = C_LIGHT * pulse.sim;
  const targets = state.targets;
  let arrived = false;
  while (pulse.next < targets.length && metres >= targets[pulse.next].d) {
    const t = targets[pulse.next];
    pulse.arrivals.push({ name: t.name, at: t.d / C_LIGHT });
    pulse.next++;
    arrived = true;
  }
  if (arrived) renderOverview();
  const last = targets[targets.length - 1].d;
  if (metres > last * 1.35) { pulse.on = false; renderOverview(); }
}

/**
 * Pulse radius in scene units. The front starts on the photosphere and goes
 * through the same mapping as the planets, so it meets each one at the real
 * moment. In the compressed layout the drawn Sun is fatter than the mapping
 * would put it, so the front sits on its surface for the first few seconds.
 */
function pulseRadius() {
  const r = U(SUN.r + C_LIGHT * pulse.sim);
  if (state.variant !== 'compressed') return r;
  const sun = state.origin;
  return Math.max(compress(r), sun.r * (sun.sizeTween ? sun.sizeTween.to : sun.size));
}

function placePulse(dt) {
  if (!pulse.mesh || !pulse.mesh.visible) return;
  const r = Math.max(pulseRadius(), 1e-4);
  const origin = state.origin.pos;
  pulse.mesh.position.copy(origin);
  pulse.ring.position.copy(origin);
  pulse.vec.position.copy(origin);
  pulse.mesh.scale.setScalar(r);
  pulse.ring.scale.setScalar(r);
  // Swing the radius vector towards the next planet by the short way round.
  const want = nextAngle();
  let diff = want - pulse.ang;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  pulse.ang += diff * (1 - Math.exp(-dt * 4));
  pulse.vec.rotation.y = -pulse.ang;
  pulse.vec.scale.setScalar(r);
  const fade = pulse.on ? 1 : 0.4;
  pulse.mesh.material.uniforms.opacity.value = fade;
  pulse.ring.material.opacity = 0.95 * fade;
  pulse.vec.material.opacity = 0.7 * fade;
}

const _tip = new THREE.Vector3();
/**
 * The time/distance tag on the radius vector, in screen space. It sits
 * halfway between the Sun's surface and the front, like a dimension label,
 * so it never lands on the planet the vector points at.
 */
function placePulseTag(w, h) {
  if (!pulse.mesh || !pulse.mesh.visible) return;
  const r = pulse.vec.scale.x;
  const sun = state.origin;
  const s = (sun.r * sun.size + r) / 2;
  _tip.set(Math.cos(pulse.ang) * s, 0, Math.sin(pulse.ang) * s).add(sun.pos).project(camera);
  const x = (_tip.x + 1) / 2 * w;
  const y = (1 - _tip.y) / 2 * h;
  const on = _tip.z < 1 && x > -80 && x < w + 80 && y > -40 && y < h + 40;
  pulse.tag.style.opacity = on ? 1 : 0;
  pulse.tagBox = on ? { left: x - 70, right: x + 70, top: y - 16, bottom: y + 16 } : null;
  if (!on) return;
  pulse.tag.innerHTML = `<b>${clockFace(pulse.sim)}</b><span>${lengthStr(C_LIGHT * pulse.sim)}</span>`;
  pulse.tag.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
}

// ----------------------------------------------------------------- UI ------

function select(b, instant = false) {
  if (MODES[state.mode].multi) { togglePick(b); return; }
  if (state.selected === b && !instant) { flyToBody(b); return; }
  state.selected = b;
  const head = el('head');
  const fill = () => {
    el('titleText').textContent = b.name;
    const p = PLANETS.find((q) => q.name === b.name);
    el('epithet').textContent = p
      ? `${(p.a / AU).toFixed(2)} AU from the Sun · light takes ${lightTime(p.a - SUN.r)}`
      : `${lengthStr(SUN.d)} across · light reaches Neptune in ${lightTime(PLANETS[7].a - SUN.r)}`;
    el('blurb').textContent = '';
    el('chips').innerHTML = '';
  };
  if (instant) fill();
  else {
    head.classList.add('swap');
    setTimeout(() => { fill(); head.classList.remove('swap'); }, 300);
    flyToBody(b);
  }
  for (const btn of el('list').children) btn.classList.toggle('on', btn.dataset.name === b.name);
  renderDots();
}

function renderList() {
  const list = el('list');
  list.innerHTML = '';
  const multi = MODES[state.mode].multi;
  for (const b of state.bodies) {
    const btn = document.createElement('button');
    const on = multi ? state.picked.has(b.name) : b === state.selected;
    btn.className = 'body' + (on ? ' on' : '');
    btn.dataset.name = b.name;
    btn.innerHTML = `<span class="thumb${b.facts.ring ? ' ringed' : ''}" style="background-image:url(${TEX_BASE}${b.facts.tex})"></span>`
      + `<span><b>${b.name}</b><small>${multi ? `⌀ ${lengthStr(b.r * ER * 2)}` : b.facts.epithet}</small></span>`
      + `<span class="tag">${multi ? 'Shown' : 'Selected'}</span>`;
    btn.onclick = () => select(b);
    list.append(btn);
  }
}

function renderDock() {
  const dock = el('dock');
  dock.innerHTML = '';
  const def = MODES[state.mode];
  const add = (label, on, run, cls = '') => {
    const btn = document.createElement('button');
    btn.innerHTML = label;
    btn.className = cls;
    btn.classList.toggle('on', on);
    btn.onclick = run;
    dock.append(btn);
    return btn;
  };
  const sep = () => { const s = document.createElement('span'); s.className = 'sep'; dock.append(s); };

  if (def.multi) {
    const same = (names) => names.length === state.picked.size && names.every((n) => state.picked.has(n));
    add('Earth · Moon · Sun', same(PRESETS.home), () => setPicked(PRESETS.home));
    add('The planets', same(PRESETS.planets), () => setPicked(PRESETS.planets));
    add('Everything', same(PRESETS.all), () => setPicked(PRESETS.all));
    sep();
    add('Clear', false, () => setPicked([]));
    sep();
    add('<i>▭</i>Compare', side, () => setSide(true), 'tog').title = 'Straight on, no perspective: drag or scroll to leave';
    return;
  }
  for (const [v, label] of def.variants) add(label, v === state.variant, () => setVariant(v));
  sep();
  add(`<i>⚡</i>${pulse.sim > 0 ? 'Replay' : 'Send light'}`, false, startPulse, 'go');
  if (def.speeds.length > 1) {
    const sp = add(pulse.speed === 1 ? '×1' : `×${pulse.speed}`, false, cycleSpeed);
    sp.title = 'Time multiplier';
  }
  const fl = add('<i>◎</i>Follow light', follow, () => { follow = !follow; renderDock(); }, 'tog');
  fl.title = 'Pull the camera back as the pulse grows';
}

function renderDots() {
  const dots = el('dots');
  dots.innerHTML = '';
  if (MODES[state.mode].multi) return;
  for (const b of state.bodies) {
    const i = document.createElement('i');
    i.classList.toggle('on', b === state.selected);
    i.onclick = () => select(b);
    dots.append(i);
  }
}

/** The right-hand card: a size table in Sizes, the light clock in Solar System. */
function renderOverview() {
  const rows = el('rows');
  if (MODES[state.mode].multi) {
    el('overviewTitle').textContent = 'Diameters';
    const picked = state.bodies.filter((b) => state.picked.has(b.name)).sort((a, b) => b.r - a.r);
    if (!picked.length) {
      rows.innerHTML = '<div class="hint">Pick bodies on the left. They line up at true relative size.</div>';
      return;
    }
    const big = picked[0].r;
    rows.innerHTML = picked.map((b) => {
      const f = b.facts;
      const d = b.r * ER * 2;
      const xe = b.r / U(EARTH.r);
      const day = f.day >= 48 ? `${(f.day / 24).toFixed(f.day / 24 < 10 ? 1 : 0)} d` : `${f.day} h`;
      const mass = f.mass >= 1000 ? `${Math.round(f.mass / 1000)} 000 ⊕` : `${fmt(f.mass, 3)} ⊕`;
      return `<div class="cmp">
        <span class="thumb" style="background-image:url(${TEX_BASE}${f.tex})"></span>
        <span><b>${b.name}</b><small>${mass} · spins in ${day}</small></span>
        <span class="num"><b>${lengthStr(d)}</b><small>${xe >= 1 ? fmt(xe, xe >= 10 ? 1 : 2) : fmt(xe, 3)} × Earth</small></span>
        <span class="scale" style="transform:scaleX(${Math.max(b.r / big, 0.004)})"></span>
      </div>`;
    }).join('');
    return;
  }

  el('overviewTitle').textContent = 'Light clock';
  const started = pulse.on || pulse.sim > 0;
  if (!rows.querySelector('#clockTime')) {
    rows.innerHTML = '<div id="clockTime"></div><div id="clockMeta"></div><div id="clockBarWrap"><i id="clockBar"></i></div><ul id="clockArrivals"></ul>';
  }
  el('clockTime').textContent = clockFace(pulse.sim);
  el('clockMeta').innerHTML = started
    ? `<b>${pulse.speed === 1 ? 'real time' : `time ×${pulse.speed}`}</b> · ${lengthStr(C_LIGHT * pulse.sim)} travelled`
    : `<b>${pulse.speed === 1 ? 'real time' : `time ×${pulse.speed}`}</b> · send a pulse from the Sun to start`;
  const last = state.targets[state.targets.length - 1].d;
  el('clockBar').style.width = `${clamp((C_LIGHT * pulse.sim) / last, 0, 1) * 100}%`;
  const next = state.targets[pulse.next];
  el('clockArrivals').innerHTML = pulse.arrivals.map((a) => `<li><b>${a.name}</b><span>${clockFace(a.at)}</span></li>`).join('')
    + (started && next ? `<li class="next"><b>${next.name}</b><span>${clockFace(next.d / C_LIGHT)}</span></li>` : '');
}

/** Cheap per-frame refresh of the clock numbers while the pulse runs. */
function tickClock() {
  if (MODES[state.mode].multi || !(pulse.on || pulse.sim > 0)) return;
  const t = el('clockTime');
  if (!t) return;
  t.textContent = clockFace(pulse.sim);
  const last = state.targets[state.targets.length - 1].d;
  el('clockBar').style.width = `${clamp((C_LIGHT * pulse.sim) / last, 0, 1) * 100}%`;
  el('clockMeta').innerHTML = `<b>${pulse.speed === 1 ? 'real time' : `time ×${pulse.speed}`}</b> · ${lengthStr(C_LIGHT * pulse.sim)} travelled`;
}

// -------------------------------------------------------- per-frame ---------

const _v = new THREE.Vector3();

// Cards the labels must stay out from under. Refreshed once a second; the
// layout only moves on resize or when the list changes length.
let blocked = [];
let blockedAt = 0;
function refreshBlocked(t) {
  if (t - blockedAt < 1000) return;
  blockedAt = t;
  blocked = [
    ...['brand', 'list', 'modes', 'side', 'dock'].map((id) => el(id)),
    ...el('head').children,
  ].map((n) => n.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
}
const inRect = (x, y, r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;

function placeLabels(w, h, t) {
  if (MODES[state.mode].multi) {
    for (const b of state.bodies) { b.label.style.opacity = 0; b.marker.style.display = 'none'; }
    return;
  }
  refreshBlocked(t);
  const vfov = THREE.MathUtils.degToRad(persp.fov);
  const pxPerUnitAt = (dist) => (camera === ortho
    ? h / ((ortho.top - ortho.bottom) / ortho.zoom)
    : (h / 2) / (dist * Math.tan(vfov / 2)));
  const want = [];
  for (const b of state.bodies) {
    const r = b.r * b.size;
    if (b.size < 0.02) { b.label.style.opacity = 0; b.marker.style.display = 'none'; continue; }
    const dist = camera.position.distanceTo(b.pos);
    const px = r * pxPerUnitAt(dist);
    _v.copy(b.pos).project(camera);
    const behind = _v.z > 1 || dist < r * 1.02;
    const x = (_v.x + 1) / 2 * w;
    const y = (1 - _v.y) / 2 * h;
    const onScreen = !behind && x > -40 && x < w + 40 && y > -40 && y < h + 40;
    const tiny = px < 1.6;
    const covered = blocked.some((rc) => inRect(x, y, rc));
    const showMarker = onScreen && tiny && !covered;
    b.marker.style.display = showMarker ? 'block' : 'none';
    if (showMarker) b.marker.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
    // Too big to label without the text landing on the texture — the title does the job.
    const huge = px > h * 0.6;
    if (onScreen && !huge && !covered) {
      const lift = tiny ? 20 : Math.min(px, h) + 8;
      want.push({ b, x, y: y - lift, px, sel: b === state.selected });
    } else {
      b.label.style.opacity = 0;
    }
  }
  // Greedy: the selected body first, then the biggest on screen; anything whose
  // box would land on an already placed label stays hidden.
  want.sort((p, q) => (q.sel - p.sel) || (q.px - p.px));
  const placed = pulse.tagBox && pulse.mesh?.visible ? [pulse.tagBox] : [];
  for (const p of want) {
    const box = { left: p.x - 44, right: p.x + 44, top: p.y - 22, bottom: p.y + 4 };
    const clash = placed.some((o) => !(box.right < o.left || box.left > o.right || box.bottom < o.top || box.top > o.bottom))
      || blocked.some((rc) => !(box.right < rc.left || box.left > rc.right || box.bottom < rc.top || box.top > rc.bottom));
    if (clash) { p.b.label.style.opacity = 0; continue; }
    placed.push(box);
    p.b.label.style.opacity = 1;
    p.b.label.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) translate(-50%, -100%)`;
  }
}

function frame() {
  const t = now();
  const dt = Math.min(0.1, (t - lastT) / 1000);
  lastT = t;

  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) {
    renderer.setSize(w, h, false);
    persp.aspect = w / h;
    persp.updateProjectionMatrix();
    fitOrtho();
    if (pulse.ring) {
      pulse.ring.material.resolution.set(canvas.width, canvas.height);
      pulse.vec.material.resolution.set(canvas.width, canvas.height);
    }
  }

  for (const b of state.bodies) {
    if (b.tween) {
      const k = clamp((t - b.tween.t0) / b.tween.dur, 0, 1);
      b.pos.lerpVectors(b.tween.from, b.tween.to, ease(k));
      if (k >= 1) b.tween = null;
    }
    if (b.sizeTween) {
      const k = clamp((t - b.sizeTween.t0) / b.sizeTween.dur, 0, 1);
      b.size = THREE.MathUtils.lerp(b.sizeTween.from, b.sizeTween.to, ease(k));
      if (k >= 1) b.sizeTween = null;
    }
    b.group.position.copy(b.pos);
    b.group.scale.setScalar(Math.max(b.r * b.size, 1e-6));
    b.group.visible = b.size > 0.001;
    b.spin.rotation.y += dt * 0.05;
    for (const c of b.spin.children) if (c.userData.spin) c.rotation.y += dt * 0.05 * (c.userData.spin - 1);
  }
  for (const o of state.orbits) {
    if (o.userData.target != null) {
      const cur = o.scale.x || o.userData.a;
      const next = THREE.MathUtils.lerp(cur, o.userData.target, 1 - Math.exp(-dt * 4.5));
      o.scale.setScalar(next);
    }
  }

  tickPulse(dt);
  placePulse(dt);
  tickClock();

  if (camTween) {
    const k = ease(clamp((t - camTween.start) / camTween.dur, 0, 1));
    camera.position.lerpVectors(camTween.p0, camTween.p1, k);
    controls.target.lerpVectors(camTween.t0, camTween.t1, k);
    if (camTween.w1 != null && camera === ortho) {
      orthoW = THREE.MathUtils.lerp(camTween.w0, camTween.w1, k);
      ortho.zoom = 1;
      fitOrtho();
    }
    if (k >= 1) {
      const done = camTween;
      camTween = null;
      if (switchAt === done) { switchAt = null; toOrtho(); }
    }
  } else if (follow && pulse.on && !MODES[state.mode].multi) {
    // Keep the front of the pulse at about 40 % of the frame width.
    const r = pulse.mesh.scale.x;
    const want = Math.max(distanceFor(Math.max(r * 2 / 0.4, U(PLANETS[0].a) * 2.5)), controls.minDistance);
    const dir = camera.position.clone().sub(controls.target).normalize();
    const have = camera.position.distanceTo(controls.target);
    const d = THREE.MathUtils.lerp(have, want, 1 - Math.exp(-dt * 2.5));
    controls.target.lerp(state.origin.pos, 1 - Math.exp(-dt * 2.5));
    camera.position.copy(controls.target).add(dir.multiplyScalar(d));
  }
  controls.update();

  // The labels project through the camera's world matrix; refresh it now, or
  // they are placed with last frame's camera and trail behind a drag.
  camera.updateMatrixWorld(true);
  stars.position.copy(camera.position);
  placePulseTag(w, h);
  {
    const earth = state.bodies.find((b) => b.name === 'Earth');
    const dir = MODES[state.mode].multi || !earth
      ? sunLight.position.clone()
      : state.origin.pos.clone().sub(earth.pos);
    uSun.value.copy(dir.normalize().transformDirection(camera.matrixWorldInverse));
  }
  placeLabels(w, h, t);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- wire -----

for (const btn of el('modes').querySelectorAll('button[data-mode]')) btn.onclick = () => setMode(btn.dataset.mode);
el('tipClose').onclick = () => { el('tip').style.display = 'none'; };
el('theme').onclick = () => setTheme(theme === 'dark' ? 'light' : 'dark');
{
  let saved = null;
  try { saved = localStorage.getItem('demo-theme'); } catch { /* private mode */ }
  setTheme(saved === 'dark' ? 'dark' : 'light');
}

addEventListener('keydown', (e) => {
  if (MODES[state.mode].multi) {
    if (e.key === '1') setMode('earth-moon');
    else if (e.key === '2') setMode('solar-system');
    return;
  }
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    const i = state.bodies.indexOf(state.selected);
    const n = state.bodies.length;
    select(state.bodies[(i + (e.key === 'ArrowRight' ? 1 : n - 1)) % n]);
  } else if (e.key === ' ') {
    e.preventDefault();
    startPulse();
  } else if (e.key === '1') setMode('earth-moon');
  else if (e.key === '2') setMode('solar-system');
  else if (e.key === 'v') {
    const vs = MODES[state.mode].variants.map((x) => x[0]);
    setVariant(vs[(vs.indexOf(state.variant) + 1) % vs.length]);
  }
});

addEventListener('hashchange', () => {
  const id = location.hash.slice(1);
  if (MODES[id] && id !== state.mode) setMode(id);
});

setMode(MODES[location.hash.slice(1)] ? location.hash.slice(1) : 'earth-moon');
requestAnimationFrame(frame);

// Handy for the screenshot tool and the console.
window.__demo = {
  setMode, setVariant, select, startPulse, setPicked, togglePick, setSide, setTheme, pulseRadius, compress, U,
  state, pulse, controls, flyToBody, get camera() { return camera; }, get side() { return side; },
};
