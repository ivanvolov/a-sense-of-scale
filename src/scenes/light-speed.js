// Scene 03 — The speed of light.
//
// The trick of this scene is that the screen distance never changes — only what
// it means. First it is 384 400 km and a photon crosses it in real time, in
// 1.28 s. Then the same strip of screen becomes 1 AU, the photon keeps its
// real speed, and the only way to watch it arrive is to speed time up 64×.

import {
  W, H, MARGIN, PALETTE, clear, stars, vignette,
  caption, sceneTag, disclosure, hexA, mono, sans, roundRect,
} from '../lib/draw.js';
import { clamp, lerp, ramp, window_, easeZoom, easeOut, group, roundSig, stopwatch, humanSeconds } from '../lib/math.js';
import { EARTH, MOON, SUN, MOON_ORBIT, AU, C_LIGHT, LIGHT_TIMES, KM } from '../lib/data.js';

export const id = 'light-speed';
export const title = 'The Speed of Light';

const BEAM_Y = 470;
const X_SRC = 300;
const X_DST = 1620;

const T_MOON = MOON_ORBIT.mean / C_LIGHT;      // 1,28 s
const T_SUN = AU / C_LIGHT;                    // 499 s
const TIME_X = 64;                             // time compression for the Sun leg
const SUN_LEG = T_SUN / TIME_X;                // 7,8 s of video

const T = {
  intro: [0.0, 1.4],
  shot1: [1.4, 1.4 + T_MOON],
  shot2: [4.4, 4.4 + T_MOON],
  handover: [7.4, 9.0],
  sunLeg: [9.0, 9.0 + SUN_LEG],
  ladder: [17.4, 23.4],
  close: [23.4, 27.2],
};

export const duration = 27.2;

export function draw(ctx, t) {
  clear(ctx, { glow: 0.4 });
  stars(ctx, { seed: 41, count: 300, alpha: 0.55 });

  const toSun = easeZoom(ramp(t, T.handover[0], T.handover[1]));
  const ladder = ramp(t, T.ladder[0] - 0.6, T.ladder[0] + 0.4);

  if (ladder < 1) drawBeam(ctx, t, toSun, 1 - ladder);
  if (ladder > 0) drawLadder(ctx, t, ladder);

  sceneTag(ctx, { index: 3, title, alpha: window_(t, 0.3, duration - 0.2, 0.6) });

  caption(ctx, {
    kicker: 'real time',
    title: 'Light to the Moon',
    body: `This span is ${group(MOON_ORBIT.mean / KM)} km. The dot travels at ${group(C_LIGHT / KM)} km/s, and the video is not sped up.`,
    alpha: window_(t, 0.4, 7.2, 0.45),
    accent: PALETTE.cool,
  });

  caption(ctx, {
    kicker: 'the same strip of screen',
    title: 'Now it is the trip to the Sun',
    body: `The distance grew ${(AU / MOON_ORBIT.mean).toFixed(0)} times over; the speed did not. To watch it arrive at all, time runs ${TIME_X} times faster.`,
    alpha: window_(t, 7.6, T.ladder[0] - 0.8, 0.45),
    accent: PALETTE.cool,
  });

  caption(ctx, {
    kicker: 'summary',
    title: 'How long light takes',
    body: 'Each row is not a bit further than the last but another order of magnitude. The bars run on a log scale, or the first row would be invisible.',
    alpha: window_(t, T.ladder[0] + 0.3, T.close[0], 0.45),
    accent: PALETTE.cool,
  });

  caption(ctx, {
    kicker: 'what follows',
    title: 'The sky is an archive',
    body: `The Sun you see is always ${humanSeconds(T_SUN)} in the past. Proxima is ${humanSeconds(LIGHT_TIMES[3].s)} behind. Further out, billions of years.`,
    alpha: window_(t, T.close[0] + 0.2, duration - 0.15, 0.45),
    accent: PALETTE.cool,
  });

  vignette(ctx, 0.5);
}

// ---------------------------------------------------------------------------

function drawBeam(ctx, t, toSun, alpha) {
  const target = toSun > 0.5
    ? { name: 'Sun', color: SUN.color, color2: SUN.color2, r: 62 }
    : { name: 'Moon', color: MOON.color, color2: MOON.color2, r: 34 };

  ctx.save();
  ctx.globalAlpha = alpha;

  // The track.
  ctx.strokeStyle = hexA(PALETTE.line, 1);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(X_SRC, BEAM_Y);
  ctx.lineTo(X_DST, BEAM_Y);
  ctx.stroke();

  discs(ctx, target, toSun);

  // Which leg are we on, and how far along?
  const leg = legState(t);
  if (leg) photon(ctx, leg.progress);

  clock(ctx, t, leg, toSun);

  ctx.restore();
  disclosure(ctx, { text: 'distance to scale · body sizes are not', alpha: alpha * 0.9, color: PALETTE.faint });
}

/** Where the photon is, if one is in flight. */
function legState(t) {
  if (t >= T.shot1[0] && t <= T.shot1[1] + 0.9) {
    return { progress: clamp((t - T.shot1[0]) / T_MOON), elapsed: clamp(t - T.shot1[0], 0, T_MOON), total: T_MOON, x: 1 };
  }
  if (t >= T.shot2[0] && t <= T.shot2[1] + 0.9) {
    return { progress: clamp((t - T.shot2[0]) / T_MOON), elapsed: clamp(t - T.shot2[0], 0, T_MOON), total: T_MOON, x: 1 };
  }
  if (t >= T.sunLeg[0] && t <= T.ladder[0]) {
    const p = clamp((t - T.sunLeg[0]) / SUN_LEG);
    return { progress: p, elapsed: p * T_SUN, total: T_SUN, x: TIME_X };
  }
  return null;
}

function discs(ctx, target, toSun) {
  // Earth, always on the left.
  sphere(ctx, X_SRC, BEAM_Y, 46, EARTH.color, EARTH.color2);
  label(ctx, X_SRC, BEAM_Y + 46 + 44, 'Earth');

  // Target morphs from Moon to Sun.
  const r = lerp(34, 62, toSun);
  sphere(ctx, X_DST, BEAM_Y, r, blend(MOON.color, SUN.color, toSun), blend(MOON.color2, SUN.color2, toSun));
  label(ctx, X_DST, BEAM_Y + r + 44, toSun > 0.5 ? 'Sun' : 'Moon');

  // What the strip is worth right now.
  const dist = toSun > 0.5 ? AU : MOON_ORBIT.mean;
  ctx.font = mono(30, 600);
  ctx.fillStyle = PALETTE.accent;
  ctx.textAlign = 'center';
  ctx.fillText(`${group(dist / KM)} km`, (X_SRC + X_DST) / 2, BEAM_Y - 40);
}

function sphere(ctx, x, y, r, color, color2) {
  const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.05, x, y, r * 1.1);
  g.addColorStop(0, color2);
  g.addColorStop(0.6, color);
  g.addColorStop(1, 'rgba(0,0,0,0.85)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function label(ctx, x, y, text) {
  ctx.font = sans(26, 600);
  ctx.fillStyle = PALETTE.ink;
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y);
}

function photon(ctx, p) {
  const x = lerp(X_SRC, X_DST, p);
  const tail = Math.max(X_SRC, x - 210);
  const g = ctx.createLinearGradient(tail, 0, x, 0);
  g.addColorStop(0, hexA(PALETTE.cool, 0));
  g.addColorStop(1, hexA(PALETTE.cool, 0.85));
  ctx.strokeStyle = g;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(tail, BEAM_Y);
  ctx.lineTo(x, BEAM_Y);
  ctx.stroke();

  const glow = ctx.createRadialGradient(x, BEAM_Y, 0, x, BEAM_Y, 44);
  glow.addColorStop(0, hexA(PALETTE.cool, 0.55));
  glow.addColorStop(1, hexA(PALETTE.cool, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, BEAM_Y, 44, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, BEAM_Y, 7, 0, Math.PI * 2);
  ctx.fill();
}

/** Stopwatch plus the time-compression badge. */
function clock(ctx, t, leg, toSun) {
  const elapsed = leg ? leg.elapsed : (toSun > 0.5 ? 0 : 0);
  const speed = leg ? leg.x : (toSun > 0.5 ? TIME_X : 1);

  ctx.save();
  ctx.textAlign = 'right';
  ctx.font = mono(96, 600);
  ctx.fillStyle = leg && leg.progress >= 1 ? PALETTE.accent : PALETTE.ink;
  ctx.fillText(stopwatch(elapsed), W - MARGIN, MARGIN + 60);

  ctx.font = sans(24, 500);
  ctx.fillStyle = PALETTE.dim;
  ctx.fillText('photon flight time — mm:ss.cc', W - MARGIN, MARGIN + 104);

  const badge = speed === 1 ? 'real time · ×1' : `time sped up · ×${speed}`;
  ctx.font = sans(24, 600);
  const bw = ctx.measureText(badge).width + 40;
  const bx = W - MARGIN - bw, by = MARGIN + 132;
  ctx.fillStyle = hexA(speed === 1 ? PALETTE.cool : PALETTE.warn, 0.12);
  roundRect(ctx, bx, by, bw, 46, 23);
  ctx.fill();
  ctx.strokeStyle = hexA(speed === 1 ? PALETTE.cool : PALETTE.warn, 0.5);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = speed === 1 ? PALETTE.cool : PALETTE.warn;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(badge, bx + bw / 2, by + 23);
  ctx.restore();
}

/** Closing card: four destinations on a log axis. */
function drawLadder(ctx, t, alpha) {
  const rows = LIGHT_TIMES;
  const maxLog = Math.log10(rows[rows.length - 1].s);
  const x = MARGIN, y = 250, rowH = 104, barW = 900, barX = 700;

  ctx.save();
  ctx.globalAlpha = alpha;
  rows.forEach((r, i) => {
    const appear = easeOut(ramp(t, T.ladder[0] + i * 0.55, T.ladder[0] + i * 0.55 + 0.8));
    if (appear <= 0) return;
    const ry = y + i * rowH;
    ctx.globalAlpha = alpha * appear;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = sans(34, 600);
    ctx.fillStyle = PALETTE.ink;
    ctx.fillText(r.name, x, ry + 10);

    ctx.font = mono(34, 600);
    ctx.fillStyle = PALETTE.accent;
    ctx.fillText(humanSeconds(r.s), x + 520, ry + 10);

    const frac = Math.log10(r.s) / maxLog;
    ctx.fillStyle = hexA(PALETTE.line, 1);
    roundRect(ctx, barX + 340, ry - 24, barW - 340, 34, 6);
    ctx.fill();
    ctx.fillStyle = hexA(PALETTE.cool, 0.85);
    roundRect(ctx, barX + 340, ry - 24, Math.max(8, (barW - 340) * frac * appear), 34, 6);
    ctx.fill();

    ctx.font = mono(24, 500);
    ctx.fillStyle = PALETTE.dim;
    ctx.textAlign = 'right';
    ctx.fillText(`×${group(roundSig(r.s / rows[0].s, 3))}`, barX + 320, ry + 6);
  });

  ctx.globalAlpha = alpha * 0.8;
  ctx.textAlign = 'right';
  ctx.font = sans(20, 500);
  ctx.fillStyle = PALETTE.faint;
  ctx.fillText('logarithmic scale', barX + barW, y + rows.length * rowH - 30);
  ctx.restore();
}

function blend(a, b, u) {
  const pa = hexToRgb(a), pb = hexToRgb(b);
  return `rgb(${Math.round(lerp(pa[0], pb[0], u))},${Math.round(lerp(pa[1], pb[1], u))},${Math.round(lerp(pa[2], pb[2], u))})`;
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
