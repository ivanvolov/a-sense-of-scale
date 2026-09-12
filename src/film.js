// The film: an ordered list of scenes and a single pure `renderFrame(ctx, t)`.
//
// Nothing in here reads the clock. Frame n is a function of n alone, which is
// what lets the headless renderer walk the timeline as fast as the CPU allows
// and still produce exactly what the browser preview shows.

import { W, H, fade } from './lib/draw.js';
import { clamp } from './lib/math.js';
import { intro, outro } from './scenes/cards.js';
import * as earthMoon from './scenes/earth-moon.js';
import * as sunAu from './scenes/sun-au.js';
import * as lightSpeed from './scenes/light-speed.js';

export const FPS = 30;
export const WIDTH = W;
export const HEIGHT = H;

/** Seconds of dip-to-black at every scene seam. */
const SEAM = 0.35;

export const scenes = [intro, earthMoon, sunAu, lightSpeed, outro].map((s, i, all) => {
  const start = all.slice(0, i).reduce((acc, p) => acc + p.duration, 0);
  return { ...s, start, end: start + s.duration };
});

export const DURATION = scenes[scenes.length - 1].end;
export const TOTAL_FRAMES = Math.round(DURATION * FPS);

export function sceneAt(t) {
  const clamped = clamp(t, 0, DURATION - 1e-6);
  return scenes.find((s) => clamped >= s.start && clamped < s.end) ?? scenes[scenes.length - 1];
}

export function renderFrame(ctx, t) {
  const scene = sceneAt(t);
  const local = clamp(t - scene.start, 0, scene.duration);

  ctx.save();
  ctx.resetTransform?.();
  scene.draw(ctx, local);
  ctx.restore();

  // Dip to black at the seams — but never at the very start or the very end of
  // the film, where the encoder's own fade would double up.
  const inSeam = scene.start > 0 ? 1 - clamp(local / SEAM) : 0;
  const outSeam = scene.end < DURATION ? 1 - clamp((scene.duration - local) / SEAM) : 0;
  fade(ctx, Math.max(inSeam, outSeam));

  // Film-level fade in/out.
  fade(ctx, Math.max(1 - clamp(t / 0.8), 1 - clamp((DURATION - t) / 1.0)));
}

export const manifest = scenes.map((s) => ({
  id: s.id, title: s.title, start: +s.start.toFixed(2), duration: s.duration,
}));
