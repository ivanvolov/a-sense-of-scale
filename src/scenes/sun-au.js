// Scene 02 — The Sun and the astronomical unit.
//
// Two honest halves. First sizes only, with the distance deliberately faked and
// labelled as such, because at true separation the Sun and the Earth cannot
// share a frame. Then the Earth flies out to its real orbit and both become
// dots — which is the actual point.

import {
  W, H, MARGIN, PALETTE, camera, scaleFor, clear, stars, vignette,
  body, measure, tag, caption, sceneTag, disclosure, hexA, mono, sans, roundRect,
} from '../lib/draw.js';
import { clamp, lerp, logLerp, ramp, window_, easeZoom, group, humanSeconds } from '../lib/math.js';
import { EARTH, SUN, AU, C_LIGHT, KM } from '../lib/data.js';

export const id = 'sun-au';
export const title = 'The Sun and 1 AU';
export const duration = 22.0;

const SCALE_SUN = scaleFor(SUN.r, 420);          // Sun fills most of the height
const SCALE_AU = scaleFor(AU, 1560);             // the whole orbit radius fits

// Sun parked left of centre while we compare sizes; centred on the midpoint
// of the gap once we show the real distance.
const CX_SIZES = 400 / SCALE_SUN;
const CX_TRUE = AU / 2;

// Where the Earth stands during the size comparison — close enough to share the
// frame, and called out on screen as not being to scale.
const EARTH_X_SIZES = 860 / SCALE_SUN;

const T = {
  sizes: [0.0, 9.0],
  flyOut: [9.0, 13.6],
  ruler: [12.8, 17.2],
  model: [17.2, 22.0],
};

const EARTHS_INSIDE = Math.pow(SUN.r / EARTH.r, 3);
const BALL_D = 0.24;                              // a basketball, metres
const PEA_D = (BALL_D * EARTH.d) / SUN.d;
const MODEL_DIST = (BALL_D * AU) / SUN.d;
// How wide the frame would have to be to hold 1 AU at the size-comparison scale.
const HONEST_FRAME_PX = Math.round((AU * SCALE_SUN) / 1000) * 1000;

export function draw(ctx, t) {
  const u = easeZoom(ramp(t, ...T.flyOut));

  const scale = logLerp(SCALE_SUN, SCALE_AU, u);
  const cam = camera({ cx: lerp(CX_SIZES, CX_TRUE, u), cy: 0, scale });
  const earthX = logLerp(EARTH_X_SIZES, AU, u);

  clear(ctx, { glow: 0.5 });
  stars(ctx, { seed: 23, count: 340, alpha: 0.25 + 0.6 * u, depth: u });

  const sun = body(ctx, cam, {
    x: 0, y: 0, r: SUN.r, color: SUN.color, color2: SUN.color2,
    emissive: true, glow: 0.55,
  });
  const earth = body(ctx, cam, {
    x: earthX, y: 0, r: EARTH.r, color: EARTH.color, color2: EARTH.color2,
    lightFrom: -1, ring: 0.8,
  });

  // --- size comparison ----------------------------------------------------
  const sizesAlpha = window_(t, 0.4, T.flyOut[0] + 0.5, 0.5);
  if (sizesAlpha > 0.01) {
    magnifier(ctx, { cx: earth.px, cy: earth.py, worldX: earthX, scale, alpha: sizesAlpha });
    disclosure(ctx, { text: 'sizes to scale · distance is not', alpha: sizesAlpha });
  }

  // --- true distance ------------------------------------------------------
  const farAlpha = window_(t, T.flyOut[0] + 2.2, duration - 0.2, 0.5);
  if (earth.marked) {
    tag(ctx, { tx: earth.px, ty: earth.py, dx: 0, dy: -110, text: 'Earth', alpha: farAlpha, color: EARTH.color2 });
    tag(ctx, { tx: sun.px, ty: sun.py - sun.pr, dx: 0, dy: -90, text: 'Sun', alpha: farAlpha, color: SUN.color2 });
  }

  measure(ctx, {
    x0: sun.px, x1: earth.px, y: cam.sy(0) + 150,
    label: `${group(AU / KM)} km`,
    sub: `1 astronomical unit — ${(AU / SUN.d).toFixed(0)} solar diameters`,
    alpha: window_(t, T.ruler[0], T.model[0] + 0.2, 0.45),
    grow: ramp(t, T.ruler[0], T.ruler[0] + 1.4),
  });

  // --- text ---------------------------------------------------------------
  sceneTag(ctx, { index: 2, title, alpha: window_(t, 0.3, duration - 0.2, 0.6) });

  caption(ctx, {
    kicker: 'sizes only',
    title: `The Sun is ${(SUN.d / EARTH.d).toFixed(0)} Earth diameters across`,
    body: `About ${group(Math.round(EARTHS_INSIDE / 1e5) * 1e5)} Earths would fit inside it by volume. Earth is the dot on the right.`,
    alpha: window_(t, 0.5, 4.6),
    accent: SUN.color,
  });

  caption(ctx, {
    kicker: 'and the distance?',
    title: 'It does not fit in the frame',
    body: `Showing the real gap at this scale would take a frame ${group(HONEST_FRAME_PX)} pixels wide. Easier to let the Earth go back to its orbit.`,
    alpha: window_(t, 4.8, 9.2),
    accent: SUN.color,
  });

  caption(ctx, {
    kicker: 'the real distance',
    title: 'Both are dots now',
    body: `The Sun is a ${(SUN.r * scale * 2).toFixed(0)}-pixel ball here; the Earth is smaller than a pixel and gets a marker. Light crosses this in ${humanSeconds(AU / C_LIGHT)}.`,
    alpha: window_(t, T.ruler[0] + 0.2, T.model[0], 0.45),
  });

  if (t >= T.model[0] - 0.5) modelCard(ctx, window_(t, T.model[0], duration - 0.15, 0.45));

  vignette(ctx, 0.5);
}

// ---------------------------------------------------------------------------

/** Circular inset showing the Earth enlarged, with the factor spelled out. */
function magnifier(ctx, { cx, cy, worldX, scale, alpha }) {
  const ZOOM = 24;
  const R = 118;
  const ix = W - MARGIN - R, iy = MARGIN + 210;

  ctx.save();
  ctx.globalAlpha = alpha;

  ctx.strokeStyle = hexA(PALETTE.faint, 0.9);
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(ix - R * 0.7, iy + R * 0.7);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.save();
  ctx.beginPath();
  ctx.arc(ix, iy, R, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = PALETTE.bgLift;
  ctx.fillRect(ix - R, iy - R, R * 2, R * 2);
  const s2 = scale * ZOOM;
  body(ctx, camera({ cx: worldX - (ix - W / 2) / s2, cy: (iy - H / 2) / s2, scale: s2 }), {
    x: worldX, y: 0, r: EARTH.r, color: EARTH.color, color2: EARTH.color2, lightFrom: -1, ring: 1,
  });
  ctx.restore();

  ctx.strokeStyle = hexA(PALETTE.ink, 0.35);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(ix, iy, R, 0, Math.PI * 2);
  ctx.stroke();

  ctx.font = mono(22, 600);
  ctx.fillStyle = PALETTE.dim;
  ctx.textAlign = 'center';
  ctx.fillText(`×${ZOOM}`, ix, iy + R + 34);
  ctx.restore();
}

/** Three-column card turning the ratios into objects you can hold. */
function modelCard(ctx, alpha) {
  if (alpha <= 0) return;
  const cols = [
    { k: 'the Sun', v: `${(BALL_D * 100).toFixed(0)} cm`, n: 'a basketball' },
    { k: 'the Earth', v: `${(PEA_D * 1000).toFixed(1)} mm`, n: 'a pea' },
    { k: 'between them', v: `${MODEL_DIST.toFixed(0)} m`, n: 'a quarter of a football pitch' },
  ];
  const boxW = 1240, boxH = 240;
  const x = W / 2 - boxW / 2, y = H - MARGIN - boxH;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = hexA('#0a1020', 0.92);
  roundRect(ctx, x, y, boxW, boxH, 16);
  ctx.fill();
  ctx.strokeStyle = hexA(PALETTE.line, 1);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.font = sans(22, 600);
  ctx.fillStyle = PALETTE.accent;
  ctx.letterSpacing = '0.22em';
  ctx.fillText('SHRUNK TO TABLETOP SIZE', x + 44, y + 52);
  ctx.letterSpacing = '0px';

  cols.forEach((c, i) => {
    const cxp = x + 44 + i * ((boxW - 88) / 3);
    ctx.fillStyle = PALETTE.dim;
    ctx.font = sans(24, 500);
    ctx.fillText(c.k, cxp, y + 104);
    ctx.fillStyle = PALETTE.ink;
    ctx.font = mono(58, 600);
    ctx.fillText(c.v, cxp, y + 170);
    ctx.fillStyle = PALETTE.faint;
    ctx.font = sans(22, 400);
    ctx.fillText(c.n, cxp, y + 206);
  });
  ctx.restore();
}
