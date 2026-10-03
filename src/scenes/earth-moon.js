// Scene 01 — Earth and Moon.
//
// One continuous pull-back: ground level -> whole Earth -> the whole Earth-Moon
// system. Then the payoff: the other seven planets are laid end to end in the
// gap and *almost* fit — they overshoot by 3 724 km at the Moon's mean distance
// and fit with room to spare once the Moon drifts out to apogee.

import {
  W, H, PALETTE, camera, scaleFor, clear, stars, vignette,
  body, measure, tag, caption, readout, sceneTag, hexA, mono, sans, roundRect,
} from '../lib/draw.js';
import {
  clamp, lerp, logLerp, ramp, window_, easeZoom, easeOut, easeBack, group, dec,
} from '../lib/math.js';
import { EARTH, MOON, MOON_ORBIT, OTHER_PLANETS, PLANETS_TOTAL_D, gap, KM } from '../lib/data.js';

export const id = 'earth-moon';
export const title = 'Earth and Moon';
export const duration = 28.0;

// --- camera keyframes -------------------------------------------------------
// Ground level: the frame covers a strip of surface, so the limb reads as
// almost flat and you have no idea you are standing on a ball.
const SCALE_GROUND = scaleFor(EARTH.r * 0.015, H / 2);
// The whole planet, comfortably inside the frame.
const SCALE_GLOBE = scaleFor(EARTH.r, 300);
// The whole system, sized for apogee so the final drift needs no re-framing.
const SPAN_APOGEE = MOON_ORBIT.apogee + EARTH.r + MOON.r;
const SCALE_SPAN = scaleFor(SPAN_APOGEE, 1560);

const GROUND_CY = EARTH.r + 130 / SCALE_GROUND;   // puts the horizon at 62% height

const T = {
  ground: [0.0, 1.8],
  pullToGlobe: [1.8, 7.2],
  pullToSpan: [7.2, 12.6],
  ruler: [12.6, 15.8],
  planets: [15.8, 21.2],
  overshoot: [21.2, 24.4],
  apogee: [24.4, 28.0],
};

// Planet slots: laid end to end starting at Earth's surface.
const SLOTS = (() => {
  let cursor = EARTH.r;
  return OTHER_PLANETS.map((p) => {
    const x = cursor + p.d / 2;
    cursor += p.d;
    return { ...p, x, r: p.d / 2 };
  });
})();

export function draw(ctx, t) {
  // --- camera -------------------------------------------------------------
  const uGlobe = easeZoom(ramp(t, ...T.pullToGlobe));
  const uSpan = easeZoom(ramp(t, ...T.pullToSpan));

  // Moon distance: parked at its mean until the apogee beat at the very end.
  const uApogee = easeZoom(ramp(t, T.apogee[0] + 0.4, T.apogee[0] + 2.6));
  const dMoon = lerp(MOON_ORBIT.mean, MOON_ORBIT.apogee, uApogee);

  const scale = uSpan > 0
    ? logLerp(SCALE_GLOBE, SCALE_SPAN, uSpan)
    : logLerp(SCALE_GROUND, SCALE_GLOBE, uGlobe);
  const cx = lerp(0, dMoon / 2, uSpan);
  const cy = lerp(GROUND_CY, 0, uGlobe);
  const cam = camera({ cx, cy, scale });

  // --- backdrop -----------------------------------------------------------
  clear(ctx, { glow: 0.35 + 0.4 * uSpan });
  stars(ctx, { seed: 11, count: 380, alpha: 0.35 + 0.65 * uGlobe, depth: uGlobe + uSpan });

  // --- bodies -------------------------------------------------------------
  const earth = body(ctx, cam, {
    x: 0, y: 0, r: EARTH.r, color: EARTH.color, color2: EARTH.color2,
    lightFrom: -1, glow: 0.25 * uGlobe, ring: uGlobe,
  });

  // The planets go in first so the Moon — 13 px wide by this point — is drawn
  // last and stays findable where Neptune crowds it.
  const planetsOn = ramp(t, T.planets[0], T.apogee[1]);
  if (planetsOn > 0) drawPlanets(ctx, cam, t);

  const moon = body(ctx, cam, {
    x: dMoon, y: 0, r: MOON.r, color: MOON.color, color2: MOON.color2,
    lightFrom: -1, ring: 0.6,
  });

  // --- rulers -------------------------------------------------------------
  const axisY = cam.sy(0) + 210;

  measure(ctx, {
    x0: earth.px, x1: moon.px, y: axisY,
    label: `${group(MOON_ORBIT.mean / KM)} km`,
    sub: `${dec(MOON_ORBIT.mean / EARTH.d)} Earth diameters, centre to centre`,
    alpha: window_(t, T.ruler[0], T.planets[0] + 0.6, 0.45),
    grow: ramp(t, T.ruler[0], T.ruler[0] + 1.1),
  });

  drawGapVerdict(ctx, cam, t, dMoon, axisY);

  // --- text ---------------------------------------------------------------
  sceneTag(ctx, { index: 1, title, alpha: window_(t, 0.3, duration - 0.2, 0.6) });

  caption(ctx, {
    kicker: 'ground level',
    title: 'Everything looks flat',
    body: `The frame covers about ${group(Math.round(W / SCALE_GROUND / 1000))} km of surface. No curvature from down here.`,
    alpha: window_(t, 0.4, 4.6),
  });

  caption(ctx, {
    kicker: 'the whole planet',
    title: 'Earth',
    body: `Diameter ${group(EARTH.d / KM)} km. All the way around is 40 000 km — a little over two days by plane.`,
    alpha: window_(t, 4.8, 9.4),
  });

  caption(ctx, {
    kicker: 'and now the Moon',
    title: 'An almost empty frame',
    body: 'Nothing in between. This pair is usually drawn side by side, and almost never like this.',
    alpha: window_(t, 9.6, 13.4),
  });

  caption(ctx, {
    kicker: 'the clearance',
    title: 'What would fit in there?',
    body: `${group(gap(MOON_ORBIT.mean) / KM)} km between the surfaces. Let us lay the other seven planets into it.`,
    alpha: window_(t, 13.6, 17.0),
  });

  // Running total as the planets land.
  const totalAlpha = window_(t, T.planets[0] + 0.8, T.apogee[1] - 0.3, 0.5);
  if (totalAlpha > 0) {
    let landed = 0;
    SLOTS.forEach((p, i) => { landed += p.d * clamp(planetEntry(t, i)); });
    readout(ctx, {
      value: group(landed / KM),
      unit: 'km',
      note: 'combined diameter of the planets placed so far',
      alpha: totalAlpha,
    });
  }

  vignette(ctx, 0.45);
}

// ---------------------------------------------------------------------------

/** 0..1 entry progress for planet `i`, staggered. */
function planetEntry(t, i) {
  const start = T.planets[0] + i * 0.62;
  return easeBack(ramp(t, start, start + 0.75));
}

function drawPlanets(ctx, cam, t) {
  SLOTS.forEach((p, i) => {
    const u = planetEntry(t, i);
    if (u <= 0.001) return;
    const shown = body(ctx, cam, {
      x: p.x, y: 0, r: p.r * clamp(u, 0, 1.06), color: p.color, color2: p.color2,
      lightFrom: -1, alpha: clamp(u * 1.4),
    });
    // Only the two biggest get a name — seven labels at this size is noise.
    if ((p.name === 'Jupiter' || p.name === 'Neptune') && shown.pr > 4) {
      // Neptune's label leans left so it does not run into the verdict chip.
      tag(ctx, {
        tx: shown.px, ty: shown.py - shown.pr, dx: p.name === 'Neptune' ? -70 : 0, dy: -70, text: p.name,
        alpha: clamp(u) * window_(t, T.planets[0] + 1.2, duration - 0.4, 0.6),
        color: p.color2,
      });
    }
  });
}

/**
 * The verdict strip: does the row of planets clear the Moon?
 * Red while it overshoots, amber once the Moon drifts out to apogee.
 */
function drawGapVerdict(ctx, cam, t, dMoon, axisY) {
  const alpha = window_(t, T.overshoot[0], duration - 0.15, 0.5);
  if (alpha <= 0) return;

  const rowEnd = EARTH.r + PLANETS_TOTAL_D;        // far edge of Neptune
  const moonNear = dMoon - MOON.r;                 // near surface of the Moon
  const slack = moonNear - rowEnd;                 // <0 = they stick into the Moon
  const overshooting = slack < 0;
  const color = overshooting ? PALETTE.warn : PALETTE.accent;

  const x0 = cam.sx(Math.min(rowEnd, moonNear));
  const x1 = cam.sx(Math.max(rowEnd, moonNear));
  const y = cam.sy(0);

  ctx.save();
  ctx.globalAlpha = alpha;

  // Hatched band over the contested millimetres.
  if (Math.abs(x1 - x0) > 1.5) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y - 150, x1 - x0, 300);
    ctx.clip();
    ctx.strokeStyle = hexA(color, 0.55);
    ctx.lineWidth = 2;
    for (let x = x0 - 300; x < x1 + 300; x += 12) {
      ctx.beginPath();
      ctx.moveTo(x, y + 150);
      ctx.lineTo(x + 300, y - 150);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Vertical guide on the end of the planet row.
  ctx.strokeStyle = hexA(color, 0.8);
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 7]);
  ctx.beginPath();
  ctx.moveTo(cam.sx(rowEnd), y - 190);
  ctx.lineTo(cam.sx(rowEnd), axisY + 40);
  ctx.stroke();
  ctx.setLineDash([]);

  // Halo so the eye can still find the Moon in all this.
  ctx.strokeStyle = hexA(MOON.color2, 0.55);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cam.sx(dMoon), y, Math.max(cam.len(MOON.r) + 22, 26), 0, Math.PI * 2);
  ctx.stroke();

  // The verdict chip, parked above the band.
  const mid = (x0 + x1) / 2;
  const text = `${overshooting ? '−' : '+'}${group(Math.abs(slack) / KM)} km`;
  const sub = overshooting ? 'short' : 'to spare';
  ctx.font = mono(40, 600);
  const boxW = Math.max(ctx.measureText(text).width, 160) + 52;
  const bx = clamp(mid - boxW / 2, 40, W - boxW - 40);
  const by = y - 300;
  ctx.fillStyle = PALETTE.bg;
  roundRect(ctx, bx, by, boxW, 104, 10);
  ctx.fill();
  ctx.strokeStyle = hexA(color, 0.5);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.font = mono(40, 600);
  ctx.fillText(text, bx + boxW / 2, by + 48);
  ctx.font = sans(22, 500);
  ctx.fillStyle = PALETTE.dim;
  ctx.fillText(sub, bx + boxW / 2, by + 82);
  ctx.restore();

  caption(ctx, {
    kicker: 'almost',
    title: `${group(PLANETS_TOTAL_D / KM)} km against ${group(gap(MOON_ORBIT.mean) / KM)} km`,
    body: 'The row of seven is slightly longer than the gap, and Neptune runs into the Moon. The familiar claim that every planet fits between the Earth and the Moon is wrong at the mean distance.',
    alpha: window_(t, T.overshoot[0] + 0.3, T.apogee[0] + 0.2, 0.45),
    accent: PALETTE.warn,
  });

  caption(ctx, {
    kicker: 'but the orbit is an ellipse',
    title: `At apogee: ${group(MOON_ORBIT.apogee / KM)} km`,
    body: `The Moon swings ${group((MOON_ORBIT.apogee - MOON_ORBIT.mean) / KM)} km further out, and now all seven fit with ${group(gap(MOON_ORBIT.apogee) / KM - PLANETS_TOTAL_D / KM)} km to spare.`,
    alpha: window_(t, T.apogee[0] + 0.4, duration - 0.15, 0.45),
  });
}
