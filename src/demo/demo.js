// The demo: the first two modes of the explorer, rebuilt as a 3D scene with
// textured bodies and a card UI. Same numbers as the main app (../data.js),
// same honesty about scale, different clothes.
//
// Scene unit: one Earth radius. Everything is positioned in real proportion
// unless the "compressed" variant of the Solar System is on, which says so.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EARTH, MOON, SUN, MOON_ORBIT, OTHER_PLANETS, PLANETS, PLANETS_TOTAL_D, AU, C_LIGHT, gap } from '../data.js';
import { lengthStr, lightTime, clockFace } from '../units.js';
import { FACTS, ROWS } from './facts.js';

const ER = EARTH.r;
const U = (metres) => metres / ER;
const el = (id) => document.getElementById(id);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const now = () => performance.now();

// ------------------------------------------------------------ renderer -----

const canvas = el('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 0.02, 2e7);
camera.position.set(0, 1, 9);

const controls = new OrbitControls(camera, canvas);
controls.enablePan = false;
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.rotateSpeed = 0.55;
controls.minDistance = 0.3;
controls.maxDistance = 6e6;
controls.addEventListener('start', () => { camTween = null; follow = false; canvas.classList.add('dragging'); });
controls.addEventListener('end', () => canvas.classList.remove('dragging'));

const hemi = new THREE.HemisphereLight(0xffffff, 0xd9dde6, 0.55);
scene.add(hemi);
const sunLight = new THREE.DirectionalLight(0xfff4e0, 2.2);
sunLight.position.set(1, 0.35, 0.55);
scene.add(sunLight);
const sunPoint = new THREE.PointLight(0xfff1d6, 0, 0, 0);
scene.add(sunPoint);

// ------------------------------------------------------------ textures -----

// Textures live next to this file; a host that cannot serve them (the Vercel
// preview) points elsewhere with <html data-tex="https://…/tex/">.
const TEX_BASE = document.documentElement.dataset.tex || './tex/';
const manager = new THREE.LoadingManager(() => el('loading').classList.add('off'));
const loader = new THREE.TextureLoader(manager);
const texCache = new Map();
function tex(name, srgb = true) {
  if (!texCache.has(name)) {
    const t = loader.load(`${TEX_BASE}${name}`);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texCache.set(name, t);
  }
  return texCache.get(name);
}

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
  } else if (f.specular) {
    mesh = new THREE.Mesh(SPHERE, new THREE.MeshPhongMaterial({
      map: tex(f.tex), specularMap: tex(f.specular, false), specular: new THREE.Color('#4a5a70'), shininess: 22,
    }));
  } else {
    mesh = new THREE.Mesh(SPHERE, new THREE.MeshStandardMaterial({ map: tex(f.tex), roughness: 0.92, metalness: 0 }));
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
    group.rotation.z = THREE.MathUtils.degToRad(-f.ring.tilt);
  } else if (name === 'Earth') {
    group.rotation.z = THREE.MathUtils.degToRad(-23.4);
  } else if (name === 'Uranus') {
    group.rotation.z = THREE.MathUtils.degToRad(-82);
  }

  group.scale.setScalar(r);

  const label = document.createElement('div');
  label.className = 'label' + (name === 'Sun' || name === 'Earth' ? ' cool' : '');
  label.innerHTML = `<b>${name}</b><small></small>`;
  const marker = document.createElement('div');
  marker.className = 'marker';
  marker.style.background = color;
  el('labels').append(marker, label);

  return {
    name, r, rTrue: r, color, facts: f, group, spin, label, marker,
    pos: new THREE.Vector3(), tween: null, size: 1, sizeTween: null, shown: true,
    lines: '',
  };
}

function tweenTo(b, target, dur = 1500, delay = 0) {
  b.tween = { from: b.pos.clone(), to: target.clone(), t0: now() + delay, dur };
}
function tweenSize(b, size, dur = 1200, delay = 0) {
  b.sizeTween = { from: b.size, to: size, t0: now() + delay, dur };
}

// --------------------------------------------------------------- modes -----

const MODES = {
  'earth-moon': {
    title: 'Earth & Moon',
    variants: [['size', 'Size'], ['distance', 'Distance']],
    speeds: [1],
    build() {
      const bodies = [
        makeBody('Earth', EARTH.r, EARTH.color),
        makeBody('Moon', MOON.r, MOON.color),
        makeBody('Sun', SUN.r, SUN.color),
      ];
      const gapBodies = OTHER_PLANETS.map((p) => {
        const b = makeBody(p.name, p.d / 2, p.color);
        b.shown = false;
        b.size = 0;
        return b;
      });
      return { bodies, gapBodies, origin: bodies[0], targets: [{ name: 'Moon', d: MOON_ORBIT.mean }] };
    },
    lines(b) {
      if (b.name === 'Moon') return `${lengthStr(MOON_ORBIT.mean)} from Earth<br>${lightTime(MOON_ORBIT.mean)} of light`;
      if (b.name === 'Sun') return `Shown for size only<br>${Math.round(SUN.r / EARTH.r)} Earths across`;
      if (b.name === 'Earth') return `The unit: 1 Earth radius`;
      return `⌀ ${lengthStr(b.rTrue * ER * 2)}`;
    },
    chips(b) {
      if (b.name === 'Moon') return [['⌀', lengthStr(MOON.d)], ['↔', `${lengthStr(MOON_ORBIT.mean)} away`], ['⚡', lightTime(MOON_ORBIT.mean)]];
      if (b.name === 'Sun') return [['⌀', lengthStr(SUN.d)], ['⊕', `${Math.round(SUN.r / EARTH.r)} × Earth`], ['⚡', `${lightTime(AU)} to Earth`]];
      return [['⌀', lengthStr(EARTH.d)], ['↓', '1 g'], ['◌', '1 moon']];
    },
    layout(v) {
      const [earth, moon, sun] = state.bodies;
      const g = state.gapBodies;
      if (v === 'size') {
        tweenTo(earth, new THREE.Vector3(0, 0, 0));
        tweenTo(moon, new THREE.Vector3(1 + moon.r + 0.62, 0, 0));
        tweenTo(sun, new THREE.Vector3(1 + moon.r * 2 + 0.62 + 1.6 + sun.r, 0, 0));
        for (const b of g) { if (b.shown) tweenSize(b, 0, 600); b.shown = false; }
        state.gapOn = false;
        return { center: new THREE.Vector3(1.3, 0.05, 0), width: 6.2, el: 7 };
      }
      const moonX = U(MOON_ORBIT.mean);
      tweenTo(earth, new THREE.Vector3(0, 0, 0));
      tweenTo(moon, new THREE.Vector3(moonX, 0, 0));
      tweenTo(sun, new THREE.Vector3(moonX + moon.r + 3.2 + sun.r, 0, 0));
      return { center: new THREE.Vector3(moonX / 2 + 1.5, 0.6, 0), width: moonX + 12, el: 7 };
    },
    tools: () => [
      { id: 'view', ic: '⇔', cls: 't', label: () => (state.variant === 'size' ? 'Show the distance' : 'Show the sizes'),
        small: 'Side by side, or thirty Earths apart as they really are.',
        run: () => setVariant(state.variant === 'size' ? 'distance' : 'size') },
      { id: 'gap', ic: '◍', cls: '', label: () => (state.gapOn ? 'Clear the gap' : 'Fill the gap with planets'),
        small: () => `The other seven, end to end. They overshoot by ${lengthStr(PLANETS_TOTAL_D - gap(MOON_ORBIT.mean))}.`,
        on: () => state.gapOn, run: toggleGap },
      { id: 'light', ic: '⚡', cls: 'v', label: () => (pulse.sim > 0 ? 'Replay the light pulse' : 'Send a light pulse'),
        small: 'From Earth to the Moon at the real speed of light: 1.28 s.', run: startPulse },
      { id: 'sun', ic: '☀', cls: '', label: () => (state.sunOn ? 'Hide the Sun' : 'Show the Sun'),
        small: 'Its limb waits at the right edge, in true proportion.', on: () => state.sunOn, run: toggleSun },
    ],
    speedLabel: null,
  },

  'solar-system': {
    title: 'Solar System',
    variants: [['true', 'True scale'], ['compressed', 'Compressed']],
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
          new THREE.LineBasicMaterial({ color: 0x6f7786, transparent: true, opacity: 0.42 }),
        );
        line.userData.a = U(p.a);
        return line;
      });
      return { bodies, gapBodies: [], orbits, origin: bodies[0], targets: PLANETS.map((p) => ({ name: p.name, d: p.a })) };
    },
    lines(b) {
      if (b.name === 'Sun') return `⌀ ${lengthStr(SUN.d)}`;
      const p = PLANETS.find((q) => q.name === b.name);
      return `${(p.a / AU).toFixed(2)} AU from the Sun<br>${lightTime(p.a)} of light`;
    },
    chips(b) {
      if (b.name === 'Sun') return [['⌀', lengthStr(SUN.d)], ['⊕', `${Math.round(SUN.r / EARTH.r)} × Earth`], ['⚡', `${lightTime(PLANETS[7].a)} to Neptune`]];
      const p = PLANETS.find((q) => q.name === b.name);
      return [['⌀', lengthStr(p.r * 2)], ['☉', `${(p.a / AU).toFixed(2)} AU`], ['⚡', lightTime(p.a)]];
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
    tools: () => [
      { id: 'scale', ic: '⇔', cls: 't', label: () => (state.variant === 'true' ? 'Compress the distances' : 'Back to true scale'),
        small: 'True scale makes the planets dots. Compressed pulls them in and inflates them so you can see them.',
        run: () => setVariant(state.variant === 'true' ? 'compressed' : 'true') },
      { id: 'light', ic: '⚡', cls: 'v', label: () => (pulse.sim > 0 ? 'Replay the light pulse' : 'Send a light pulse'),
        small: 'From the Sun outward. Eight minutes to Earth, four hours to Neptune.', run: startPulse },
      { id: 'speed', ic: '◷', cls: '', label: () => (pulse.speed === 1 ? 'Time ×1 (real)' : `Time ×${pulse.speed}`),
        small: 'How fast the clock runs while the light travels.', run: cycleSpeed },
      { id: 'follow', ic: '◎', cls: '', label: () => (follow ? 'Camera follows the light' : 'Camera stays put'),
        small: 'Pull back as the pulse grows, so the front is always in view.', on: () => follow, run: () => { follow = !follow; renderTools(); } },
    ],
  },
};

// Compressed variant of the solar system: orbit radii follow a power law
// (Mercury lands at 16 % of Neptune instead of 1.3 %), and the bodies are
// inflated to a fixed fraction of Neptune's orbit so they read on screen.
const COMP_P = 0.42;
const compress = (d) => {
  const RN = U(PLANETS[7].a);
  return RN * Math.pow(Math.max(d, 0) / RN, COMP_P);
};
const COMP_SIZE = {
  Sun: 0.05, Jupiter: 0.021, Saturn: 0.018, Uranus: 0.0115, Neptune: 0.0112,
  Earth: 0.0085, Venus: 0.0082, Mars: 0.0064, Mercury: 0.0052,
};

// --------------------------------------------------------------- state -----

const state = {
  mode: null, variant: null, bodies: [], gapBodies: [], orbits: [], root: null,
  selected: null, gapOn: false, sunOn: true, origin: null, targets: [],
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
    for (const b of [...state.bodies, ...state.gapBodies]) { b.label.remove(); b.marker.remove(); }
  }
  state.mode = id;
  const built = def.build();
  Object.assign(state, built, { root: new THREE.Group(), gapOn: false, selected: null });
  for (const b of [...state.bodies, ...state.gapBodies]) {
    state.root.add(b.group);
    b.lines = def.lines(b);
    b.label.querySelector('small').innerHTML = b.lines;
    b.group.position.copy(b.pos);
  }
  for (const o of state.orbits ?? []) state.root.add(o);
  if (!built.orbits) state.orbits = [];
  scene.add(state.root);

  // Lighting: a Sun off to the right in the Earth scene, a Sun at the centre
  // of the solar one.
  sunLight.intensity = id === 'earth-moon' ? 1.7 : 0.3;
  sunPoint.intensity = id === 'solar-system' ? 2.4 : 0;
  hemi.intensity = id === 'earth-moon' ? 1.0 : 0.95;

  resetPulse();
  pulse.speed = def.speeds[0];
  follow = id === 'solar-system';
  state.variant = null;
  setVariant(variant ?? def.variants[0][0], true);
  for (const b of [...state.bodies, ...state.gapBodies]) {
    if (b.tween) { b.pos.copy(b.tween.to); b.tween = null; }
    if (b.sizeTween) { b.size = b.sizeTween.to; b.sizeTween = null; }
  }
  if (camTween) { camera.position.copy(camTween.p1); controls.target.copy(camTween.t1); camTween = null; }
  select(state.bodies[0], true);

  for (const btn of el('modes').querySelectorAll('button')) btn.classList.toggle('on', btn.dataset.mode === id);
  history.replaceState(null, '', `#${id}`);
  renderList();
  renderDock();
  renderTools();
  renderDots();
}

function setVariant(v, instant = false) {
  if (v === state.variant) return;
  state.variant = v;
  const frame = MODES[state.mode].layout(v);
  flyFrame(frame, instant ? 0 : 1600);
  renderDock();
  renderTools();
  renderNote();
}

function toggleGap() {
  if (state.mode !== 'earth-moon') return;
  if (state.variant !== 'distance') setVariant('distance');
  state.gapOn = !state.gapOn;
  let cursor = 1; // Earth's surface, in Earth radii
  state.gapBodies.forEach((b, i) => {
    const x = cursor + b.r;
    cursor += b.r * 2;
    b.shown = state.gapOn;
    if (state.gapOn) {
      b.pos.set(x, 6 + b.r * 2, 0);
      tweenTo(b, new THREE.Vector3(x, 0, 0), 1100, 350 + i * 110);
      tweenSize(b, 1, 900, 350 + i * 110);
    } else {
      tweenTo(b, new THREE.Vector3(x, -6 - b.r * 2, 0), 900, i * 60);
      tweenSize(b, 0, 700, i * 60);
    }
  });
  renderTools();
}

function toggleSun() {
  state.sunOn = !state.sunOn;
  const sun = state.bodies.find((b) => b.name === 'Sun');
  tweenSize(sun, state.sunOn ? 1 : 0, 900);
  renderTools();
}

// -------------------------------------------------------------- camera -----

/** Camera distance that fits `width` scene units across the viewport. */
function distanceFor(width) {
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
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
  const r = b.r * Math.max(b.size, 0.001);
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const d = (r / Math.tan(vfov / 2)) * (b.name === 'Sun' ? 2.3 : 2.1);
  // Centre the body in the band between the columns, not behind a card.
  const f = freeArea();
  const width = 2 * d * Math.tan(vfov / 2) * camera.aspect;
  const shift = ((f.W / 2 - (f.left + f.right) / 2) / f.W) * width;
  const right = new THREE.Vector3().crossVectors(dir, camera.up).normalize().negate();
  const target = b.pos.clone().add(right.multiplyScalar(shift));
  flyTo(target.clone().add(dir.multiplyScalar(d)), target, 1500);
}

// --------------------------------------------------------------- pulse -----

function ensurePulse() {
  if (pulse.mesh) return;
  pulse.mesh = new THREE.Mesh(SPHERE, new THREE.MeshBasicMaterial({
    color: 0x17a589, transparent: true, opacity: 0.09, depthWrite: false, side: THREE.FrontSide,
  }));
  pulse.mesh.renderOrder = 5;
  const pts = [];
  for (let i = 0; i <= 256; i++) {
    const a = (i / 256) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0));
  }
  pulse.ring = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: 0x17a589, transparent: true, opacity: 0.9 }),
  );
  pulse.ring.renderOrder = 6;
  scene.add(pulse.mesh, pulse.ring);
  pulse.mesh.visible = pulse.ring.visible = false;
}

function startPulse() {
  if (state.mode === 'earth-moon' && state.variant !== 'distance') setVariant('distance');
  ensurePulse();
  pulse.on = true;
  pulse.sim = 0;
  pulse.arrivals = [];
  pulse.next = 0;
  pulse.mesh.visible = pulse.ring.visible = true;
  if (state.mode === 'solar-system') follow = true;
  renderTools();
  renderDock();
}

function resetPulse() {
  pulse.on = false;
  pulse.sim = 0;
  pulse.arrivals = [];
  pulse.next = 0;
  if (pulse.mesh) pulse.mesh.visible = pulse.ring.visible = false;
  renderClock();
}

function cycleSpeed() {
  const speeds = MODES[state.mode].speeds;
  pulse.speed = speeds[(speeds.indexOf(pulse.speed) + 1) % speeds.length];
  renderTools();
  renderDock();
}

function tickPulse(dt) {
  if (!pulse.on) return;
  pulse.sim += dt * pulse.speed;
  const metres = C_LIGHT * pulse.sim;
  const targets = state.targets;
  while (pulse.next < targets.length && metres >= targets[pulse.next].d) {
    const t = targets[pulse.next];
    pulse.arrivals.push({ name: t.name, at: t.d / C_LIGHT });
    pulse.next++;
  }
  const last = targets[targets.length - 1].d;
  if (metres > last * 1.35) pulse.on = false;
}

function placePulse() {
  if (!pulse.mesh || !pulse.mesh.visible) return;
  const metres = C_LIGHT * pulse.sim;
  let r = U(metres);
  if (state.mode === 'solar-system' && state.variant === 'compressed') r = compress(r);
  const origin = state.origin.pos;
  pulse.mesh.position.copy(origin);
  pulse.ring.position.copy(origin);
  pulse.mesh.scale.setScalar(Math.max(r, 1e-4));
  pulse.ring.scale.setScalar(Math.max(r, 1e-4));
  if (state.mode === 'solar-system') pulse.ring.rotation.set(Math.PI / 2, 0, 0);
  else pulse.ring.rotation.set(0, 0, 0);
  const fade = pulse.on ? 1 : 0.35;
  pulse.mesh.material.opacity = 0.09 * fade;
  pulse.ring.material.opacity = 0.9 * fade;
}

// ----------------------------------------------------------------- UI ------

function select(b, instant = false) {
  if (state.selected === b && !instant) { flyToBody(b); return; }
  state.selected = b;
  const head = el('head');
  const fill = () => {
    el('titleText').textContent = b.name;
    el('epithet').textContent = b.facts.epithet;
    el('blurb').textContent = b.facts.blurb;
    el('chips').innerHTML = MODES[state.mode].chips(b)
      .map(([ic, text]) => `<span class="chip"><i>${ic}</i>${text}</span>`).join('');
    renderRows(b);
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
  for (const b of state.bodies) {
    const btn = document.createElement('button');
    btn.className = 'body' + (b === state.selected ? ' on' : '');
    btn.dataset.name = b.name;
    btn.innerHTML = `<span class="thumb${b.facts.ring ? ' ringed' : ''}" style="background-image:url(${TEX_BASE}${b.facts.tex})"></span>`
      + `<span><b>${b.name}</b><small>${b.facts.epithet}</small></span><span class="tag">Selected</span>`;
    btn.onclick = () => select(b);
    list.append(btn);
  }
}

const LOG_RANGE = {};
for (const row of ROWS) {
  if (!row.log) continue;
  const vals = Object.values(FACTS).map((f) => f[row.key]).filter((v) => v != null && v > 0).map(Math.log10);
  LOG_RANGE[row.key] = [Math.min(...vals), Math.max(...vals)];
}

function renderRows(b) {
  const rows = el('rows');
  rows.innerHTML = '';
  for (const row of ROWS) {
    const v = b.facts[row.key];
    if (v == null) continue;
    let k;
    if (row.log) {
      const [lo, hi] = LOG_RANGE[row.key];
      k = (Math.log10(Math.max(v, 1e-9)) - lo) / (hi - lo);
    } else {
      const [lo, hi] = row.lin;
      k = (v - lo) / (hi - lo);
    }
    const n = clamp(Math.round(1 + 9 * k), 1, 10);
    const div = document.createElement('div');
    div.className = 'row2';
    div.innerHTML = `<span class="ic">${row.icon}</span><span class="lb">${row.label}</span><span class="vl">${row.fmt(v)}</span>`
      + `<span class="bar${row.key === 'temp' && v > 100 ? ' warm' : ''}">${Array.from({ length: 10 }, (_, i) => `<i class="${i < n ? 'on' : ''}" style="transition-delay:${i * 40}ms"></i>`).join('')}</span>`;
    rows.append(div);
  }
}

function renderTools() {
  const ul = el('toolList');
  ul.innerHTML = '';
  for (const t of MODES[state.mode].tools()) {
    const li = document.createElement('li');
    const on = typeof t.on === 'function' ? t.on() : false;
    if (on) li.classList.add('on');
    const label = typeof t.label === 'function' ? t.label() : t.label;
    const small = typeof t.small === 'function' ? t.small() : t.small;
    li.innerHTML = `<span class="ic ${t.cls}">${t.ic}</span><span><b>${label}</b><small>${small}</small></span><span class="chev">›</span>`;
    li.onclick = t.run;
    ul.append(li);
  }
}

function renderDock() {
  const dock = el('dock');
  dock.innerHTML = '';
  for (const [v, label] of MODES[state.mode].variants) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.classList.toggle('on', v === state.variant);
    btn.onclick = () => setVariant(v);
    dock.append(btn);
  }
  const sep = document.createElement('span');
  sep.className = 'sep';
  dock.append(sep);
  const light = document.createElement('button');
  light.className = 'go';
  light.innerHTML = `<i>⚡</i>${pulse.sim > 0 ? 'Replay' : 'Send light'}`;
  light.onclick = startPulse;
  dock.append(light);
  if (MODES[state.mode].speeds.length > 1) {
    const sp = document.createElement('button');
    sp.textContent = pulse.speed === 1 ? '×1' : `×${pulse.speed}`;
    sp.title = 'Time multiplier';
    sp.onclick = cycleSpeed;
    dock.append(sp);
  }
}

function renderDots() {
  const dots = el('dots');
  dots.innerHTML = '';
  for (const b of state.bodies) {
    const i = document.createElement('i');
    i.classList.toggle('on', b === state.selected);
    i.onclick = () => select(b);
    dots.append(i);
  }
}

function renderClock() {
  const show = pulse.on || pulse.sim > 0;
  el('clockTime').textContent = clockFace(pulse.sim);
  el('clockSpeed').textContent = pulse.speed === 1 ? 'real time' : `time ×${pulse.speed}`;
  el('clockTravel').textContent = show ? `${lengthStr(C_LIGHT * pulse.sim)} travelled` : 'Send a pulse to start';
  const last = state.targets?.length ? state.targets[state.targets.length - 1].d : 1;
  el('clockBar').style.width = `${clamp((C_LIGHT * pulse.sim) / last, 0, 1) * 100}%`;
  el('clockArrivals').innerHTML = pulse.arrivals.slice(-4)
    .map((a) => `<li><b>${a.name}</b><span>${clockFace(a.at)}</span></li>`).join('');
}

function renderNote() {
  const note = el('scaleNote');
  if (state.mode === 'solar-system' && state.variant === 'compressed') {
    note.textContent = 'distances compressed (d^0.42) · sizes enlarged · the light clock stays honest';
    note.classList.add('on');
  } else {
    note.classList.remove('on');
  }
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
    ...['brand', 'list', 'clock', 'modes', 'side', 'dock'].map((id) => el(id)),
    ...el('head').children,
  ].map((n) => n.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
}
const inRect = (x, y, r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;

function placeLabels(w, h, t) {
  refreshBlocked(t);
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const pxPerUnitAt = (dist) => (h / 2) / (dist * Math.tan(vfov / 2));
  const want = [];
  for (const b of [...state.bodies, ...state.gapBodies]) {
    const r = b.r * b.size;
    const hidden = b.size < 0.02 || (!b.shown && state.gapBodies.includes(b));
    if (hidden) { b.label.style.opacity = 0; b.marker.style.display = 'none'; continue; }
    const dist = camera.position.distanceTo(b.pos);
    const px = r * pxPerUnitAt(dist);
    _v.copy(b.pos).project(camera);
    const behind = _v.z > 1 || dist < r * 1.02;
    const x = (_v.x + 1) / 2 * w;
    const y = (1 - _v.y) / 2 * h;
    const onScreen = !behind && x > -40 && x < w + 40 && y > -40 && y < h + 40;
    const tiny = px < 1.6;
    const covered = blocked.some((rc) => inRect(x, y, rc));
    b.marker.style.display = onScreen && tiny && !covered ? 'block' : 'none';
    if (onScreen && tiny) { b.marker.style.left = `${x}px`; b.marker.style.top = `${y}px`; }
    // Too big to label without the text landing on the texture — the title does the job.
    const huge = px > h * 0.6;
    if (onScreen && !huge && !covered) {
      const lift = tiny ? 20 : Math.min(px, h) + 10;
      want.push({ b, x, y: y - lift, px, sel: b === state.selected });
    } else {
      b.label.style.opacity = 0;
    }
  }
  // Greedy: the selected body first, then the biggest on screen; anything whose
  // box would land on an already placed label stays hidden.
  want.sort((p, q) => (q.sel - p.sel) || (q.px - p.px));
  const placed = [];
  for (const p of want) {
    const box = { left: p.x - 72, right: p.x + 72, top: p.y - 46, bottom: p.y + 4 };
    const clash = placed.some((o) => !(box.right < o.left || box.left > o.right || box.bottom < o.top || box.top > o.bottom))
      || blocked.some((rc) => !(box.right < rc.left || box.left > rc.right || box.bottom < rc.top || box.top > rc.bottom));
    if (clash) { p.b.label.style.opacity = 0; continue; }
    placed.push(box);
    p.b.label.style.opacity = 1;
    p.b.label.style.left = `${p.x}px`;
    p.b.label.style.top = `${p.y}px`;
  }
}

function frame() {
  const t = now();
  const dt = Math.min(0.1, (t - lastT) / 1000);
  lastT = t;

  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  for (const b of [...state.bodies, ...state.gapBodies]) {
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
  placePulse();
  if (pulse.on || pulse.sim > 0) renderClock();

  if (camTween) {
    const k = ease(clamp((t - camTween.start) / camTween.dur, 0, 1));
    camera.position.lerpVectors(camTween.p0, camTween.p1, k);
    controls.target.lerpVectors(camTween.t0, camTween.t1, k);
    if (k >= 1) camTween = null;
  } else if (follow && pulse.on && state.mode === 'solar-system') {
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

  placeLabels(w, h, t);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- wire -----

for (const btn of el('modes').querySelectorAll('button')) btn.onclick = () => setMode(btn.dataset.mode);
el('tipClose').onclick = () => { el('tip').style.display = 'none'; };

addEventListener('keydown', (e) => {
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
window.__demo = { setMode, setVariant, select, startPulse, toggleGap, state, pulse, camera, controls, flyToBody };
