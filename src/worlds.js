// The four things you can zoom around in. A world is data plus one `draw(g)`;
// it never touches the DOM, the camera or the input layer — `g` hands it a
// camera and a set of primitives and it paints metres.

import {
  EARTH, MOON, SUN, MOON_ORBIT, OTHER_PLANETS, PLANETS, PLANETS_TOTAL_D, LADDER, gap,
  HISTORY, HISTORY_SPAN,
} from './data.js';
import { lengthStr, calendarLabel, niceBelow } from './units.js';

// --------------------------------------------------------------- 01 ---------

/** The seven other planets, laid end to end from Earth's surface toward the Moon. */
const GAP_ROW = (() => {
  let cursor = EARTH.r;
  return OTHER_PLANETS.map((p) => {
    const x = cursor + p.d / 2;
    cursor += p.d;
    return { ...p, x, r: p.d / 2 };
  });
})();

const earthMoon = {
  id: 'earth-moon',
  title: 'Earth & Moon',
  hint: 'Zoom out until the Moon appears. Almost everyone draws this far too close.',
  span: [3e4, 8e9],
  home: { cx: MOON_ORBIT.mean / 2, cy: 0, logSpan: Math.log10(5.6e8) },
  tools: ['planets', 'light'],
  // No timeScales: the trip takes 1.28 s, so it is always watched in real time.
  lightOrigin: { x: 0, y: 0 },
  lightTargets: () => [{ name: 'Moon', d: MOON_ORBIT.mean }],

  draw(g) {
    connectorLine(g, 0, MOON_ORBIT.mean);

    if (g.state.planets) {
      for (const p of GAP_ROW) {
        g.body({ x: p.x, y: 0, r: p.r, color: p.color, color2: p.color2, name: p.name });
      }
    }

    g.body({ x: 0, y: 0, r: EARTH.r, color: EARTH.color, color2: EARTH.color2, name: 'Earth', glow: 0.25 });
    g.body({ x: MOON_ORBIT.mean, y: 0, r: MOON.r, color: MOON.color, color2: MOON.color2, name: 'Moon' });

    g.after(() => {
      midChip(g, 0, MOON_ORBIT.mean, `${lengthStr(MOON_ORBIT.mean)} centre to centre`);
      if (!g.state.planets) return;
      // The row of seven is longer than the clearance. The overshoot itself is
      // only a few pixels wide at most zooms, so the chip hangs off a tick at
      // Neptune's far edge rather than trying to span the gap it describes.
      const slack = gap(MOON_ORBIT.mean) - PLANETS_TOTAL_D;
      tickChip(g, EARTH.r + PLANETS_TOTAL_D,
        `${slack < 0 ? '−' : '+'}${lengthStr(Math.abs(slack))} · they overshoot the Moon`,
        '#ff7b6b');
    });
  },
};

// --------------------------------------------------------------- 02 ---------

function drawSolar(g) {
  for (const p of PLANETS) g.ring({ r: p.a, alpha: 0.32 });

  g.body({ x: 0, y: 0, r: SUN.r, color: SUN.color, color2: SUN.color2, name: 'Sun', emissive: true, glow: 0.9 });

  for (const p of PLANETS) {
    g.body({
      x: Math.cos(p.angle) * p.a,
      y: Math.sin(p.angle) * p.a,
      r: p.r, color: p.color, color2: p.color2, name: p.name,
    });
  }
}

const solarTargets = () => PLANETS.map((p) => ({ name: p.name, d: p.a }));

const solarSystem = {
  id: 'solar-system',
  title: 'Solar System',
  hint: 'Mostly empty: pinch in on a planet and it never gets big. Send a pulse of light and watch how long it takes to cross.',
  span: [1e7, 3e13],
  // Opens close in, where the Sun and the Earth are both in frame and a
  // pulse reaches something while you are still watching.
  home: { cx: 5.6e10, cy: -3.0e10, logSpan: Math.log10(6.2e11) },
  tools: ['light'],
  timeScales: [1, 60, 600, 3600],
  lightOrigin: { x: 0, y: 0 },
  lightTargets: solarTargets,
  draw: drawSolar,
};

// --------------------------------------------------------------- 03 ---------

const powersOfTen = {
  id: 'powers-of-ten',
  title: 'Powers of Ten',
  hint: 'One continuous ladder from a proton to the observable universe — 42 decades.',
  span: [2e-15, 6e27],
  home: { cx: 0, cy: 0, logSpan: Math.log10(4e7) },
  tools: [],
  lightOrigin: { x: 0, y: 0 },
  lightTargets: () => [],

  draw(g) {
    for (const item of LADDER) {
      g.ring({ r: item.r, color: item.color, alpha: 0.85, label: item.name, note: item.note, bold: true });
    }
  },
};

// ---------------------------------------------------------------------------

/** Hairline along the x axis between two world points. */
function connectorLine(g, x0, x1) {
  const a = g.sx(x0), b = g.sx(x1), y = g.sy(0);
  if (Math.max(a, b) < 0 || Math.min(a, b) > g.w) return;
  if (Math.abs(b - a) < 90) return;
  const { ctx } = g;
  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.strokeStyle = '#ffcf5c';
  ctx.setLineDash([2, 8]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(a, y);
  ctx.lineTo(b, y);
  ctx.stroke();
  ctx.restore();
}

/** A chip on a stalk above one world point — for a gap too small to label across. */
function tickChip(g, x, text, color) {
  const px = g.sx(x), y = g.sy(0);
  if (px < 140 || px > g.w - 140) return;
  const { ctx } = g;
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px, y - 18);
  ctx.lineTo(px, y - 96);
  ctx.stroke();
  ctx.restore();
  g.chip({ x: px, y: y - 96, text, color });
}

/** A chip centred between two world points, skipped when the span is too tight. */
function midChip(g, x0, x1, text, opts = {}) {
  const a = g.sx(x0), b = g.sx(x1);
  if (Math.abs(b - a) < 60) return;
  const mid = (a + b) / 2;
  if (mid < 80 || mid > g.w - 80) return;
  g.chip({ x: mid, y: g.sy(0) - (opts.y ?? 26), text, color: opts.color });
}

// --------------------------------------------------------------- 04 ---------

/**
 * Human history on one line. The world x axis is negative years before the
 * present, so the past runs left and now sits at the origin — the same camera
 * as the other modes, measuring years instead of metres.
 */
const deepTime = {
  id: 'deep-time',
  title: 'Human History',
  unit: 'time',
  hint: 'Two hundred thousand years on one line. Play it at 50 years a second and the whole of it runs an hour — everything you were taught in school arrives in the last two minutes.',
  span: [2, 4e5],
  home: { cx: -HISTORY_SPAN / 2, cy: 0, logSpan: Math.log10(2.3e5) },
  tools: ['play'],
  playRates: [50, 250, 1000],
  playFrom: HISTORY_SPAN,
  events: () => HISTORY,

  draw(g) {
    const { ctx } = g;
    const y = g.sy(0);

    ctx.save();
    ctx.strokeStyle = 'rgba(133,147,173,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(g.w, y);
    ctx.stroke();

    // A plain ruler underneath: the scale bar names the interval, so these
    // carry no text of their own.
    const step = niceBelow(g.span / 6);
    const first = Math.ceil(g.wx(0) / step) * step;
    ctx.strokeStyle = 'rgba(133,147,173,0.22)';
    for (let x = first; x <= g.wx(g.w); x += step) {
      const px = g.sx(x);
      ctx.beginPath();
      ctx.moveTo(px, y + 1);
      ctx.lineTo(px, y + 9);
      ctx.stroke();
    }
    ctx.restore();

    for (const e of HISTORY) {
      const px = g.sx(-e.ago);
      if (px < -40 || px > g.w + 40) continue;
      const strong = !!e.major;

      ctx.save();
      ctx.strokeStyle = strong ? '#ffcf5c' : 'rgba(143,196,245,0.7)';
      ctx.lineWidth = strong ? 1.6 : 1;
      ctx.beginPath();
      ctx.moveTo(px, y - (strong ? 20 : 12));
      ctx.lineTo(px, y);
      ctx.stroke();
      ctx.fillStyle = strong ? '#ffcf5c' : '#8fc4f5';
      ctx.beginPath();
      ctx.arc(px, y, strong ? 3.2 : 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      g.label({
        x: px,
        y: y - (strong ? 28 : 20),
        text: e.name,
        note: e.note ? `${calendarLabel(e.ago)} · ${e.note}` : calendarLabel(e.ago),
        color: strong ? '#ffcf5c' : '#eaf0fb',
        priority: strong ? 2e6 : 1e6,
      });
    }
  },
};

// ---------------------------------------------------------------------------

export const WORLDS = [earthMoon, solarSystem, powersOfTen, deepTime];

// 'light-speed' was its own mode until it turned out to be this one with a
// closer opening shot; the alias keeps old links and installed shortcuts alive.
const ALIASES = { 'light-speed': 'solar-system' };

export const worldById = (id) => WORLDS.find((wd) => wd.id === (ALIASES[id] ?? id)) ?? WORLDS[0];
