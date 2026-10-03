// Small deterministic math helpers shared by every scene.
// Nothing here may touch Date.now() or Math.random() without a seed — the whole
// film has to render identically frame by frame in a headless browser.

export const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);

export const lerp = (a, b, u) => a + (b - a) * u;

/** Interpolate in log space. Used for every zoom: scale is multiplicative. */
export const logLerp = (a, b, u) => a * Math.pow(b / a, u);

/** Normalised progress through [t0, t1], clamped to 0..1. */
export const ramp = (t, t0, t1) => clamp((t - t0) / (t1 - t0));

/** 1 while inside [t0, t1] with `fade` seconds of ease on each edge. */
export const window_ = (t, t0, t1, fade = 0.4) =>
  Math.min(easeInOut(ramp(t, t0, t0 + fade)), easeInOut(ramp(t, t1, t1 - fade)));

export const easeInOut = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
export const easeOut = (u) => 1 - Math.pow(1 - u, 3);
export const easeIn = (u) => u * u * u;
/** Gentle S-curve with long tails — the default for long zooms. */
export const easeZoom = (u) => u * u * (3 - 2 * u);
/** Overshoots slightly then settles. For things that snap into place. */
export const easeBack = (u) => {
  const c = 1.70158, c3 = c + 1;
  return 1 + c3 * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2);
};

/** Deterministic PRNG (mulberry32) so the starfield is identical every run. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 1234567 -> "1 234 567". Plain spaces: no exotic glyphs to go missing. */
export function group(n, digits = 0) {
  const fixed = Math.abs(n).toFixed(digits);
  const [int, frac] = fixed.split('.');
  const spaced = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const sign = n < 0 ? '-' : '';
  return sign + (frac ? `${spaced}.${frac}` : spaced);
}

/** Seconds -> "8 min 20 s" / "1.28 s" / "4 h 10 min". */
export function humanSeconds(s) {
  if (s < 60) return `${group(s, 2)} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min ${group(Math.round(s % 60))} s`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min`;
  return `${group(s / 31557600, 2)} years`;
}

/** mm:ss.cc stopwatch face. */
export function stopwatch(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const cs = Math.floor((s * 100) % 100);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

/** Round to `digits` significant figures — nobody needs ×104 513 507. */
export function roundSig(n, digits = 3) {
  if (n === 0) return 0;
  const mag = Math.pow(10, digits - 1 - Math.floor(Math.log10(Math.abs(n))));
  return Math.round(n * mag) / mag;
}

/** 30.17 -> "30.2". */
export const dec = (n, digits = 1) => n.toFixed(digits);
