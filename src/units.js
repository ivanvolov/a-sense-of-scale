// Formatting for a view that spans 42 orders of magnitude. Every readout in the
// explorer goes through here so the same distance never appears as "0.0000001 km"
// in one corner and "100 nm" in another.

import { AU, C_LIGHT, LY } from './data.js';

const SI = [
  { f: 1e-15, s: 'fm' },
  { f: 1e-12, s: 'pm' },
  { f: 1e-9, s: 'nm' },
  { f: 1e-6, s: 'µm' },
  { f: 1e-3, s: 'mm' },
  { f: 1e-2, s: 'cm' },
  { f: 1, s: 'm' },
  { f: 1e3, s: 'km' },
];

/** 1234567 -> "1 234 567". Thin-space grouping reads better than commas here. */
function groupInt(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Three significant figures, without the trailing zeros toPrecision leaves. */
function sig(v) {
  if (v >= 1000) return groupInt(Math.round(v));
  const s = v.toPrecision(3);
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

/**
 * Pick the unit a person would actually say out loud at this size.
 * The astronomical units get generous thresholds — "0.4 AU" is more useful than
 * "59 800 000 km", but "384 400 km" beats "0.0026 AU".
 */
export function unitFor(m) {
  const abs = Math.abs(m);
  if (abs >= 0.08 * LY) return { f: LY, s: 'ly' };
  if (abs >= 0.05 * AU) return { f: AU, s: 'AU' };
  let pick = SI[0];
  for (const u of SI) if (abs >= u.f) pick = u;
  return pick;
}

/** Past a few thousand light-years, digits stop meaning anything — use words. */
function scaled(v, unit) {
  if (unit === 'ly') {
    if (v >= 1e9) return `${sig(v / 1e9)} billion`;
    if (v >= 1e6) return `${sig(v / 1e6)} million`;
    if (v >= 1e4) return `${sig(v / 1e3)} thousand`;
  }
  return sig(v);
}

function lengthParts(m) {
  const u = unitFor(m);
  return { value: scaled(m / u.f, u.s), unit: u.s };
}

export const lengthStr = (m) => {
  const { value, unit } = lengthParts(m);
  return `${value} ${unit}`;
};

/**
 * A map scale bar wants a round number in the unit it will be labelled with —
 * "5 AU", not the 6.68 AU you get from rounding metres and converting after.
 */
export function niceBar(metres) {
  const u = unitFor(metres);
  const rounded = niceBelow(metres / u.f) * u.f;
  const back = unitFor(rounded);           // rounding down can drop a unit tier
  return { metres: rounded, text: `${scaled(rounded / back.f, back.s)} ${back.s}` };
}

/** How long light needs to cross `m` metres, in words. */
export function lightTime(m) {
  return duration(Math.abs(m) / C_LIGHT);
}

const plural = (value, word) => `${value} ${word}${value === '1' ? '' : 's'}`;

export function duration(s) {
  if (s < 1e-21) return `${sig(s * 1e24)} ys`;
  if (s < 1e-18) return `${sig(s * 1e21)} zs`;
  if (s < 1e-15) return `${sig(s * 1e18)} as`;
  if (s < 1e-12) return `${sig(s * 1e15)} fs`;
  if (s < 1e-9) return `${sig(s * 1e12)} ps`;
  if (s < 1e-6) return `${sig(s * 1e9)} ns`;
  if (s < 1e-3) return `${sig(s * 1e6)} µs`;
  if (s < 1) return `${sig(s * 1e3)} ms`;
  if (s < 60) return `${s.toFixed(2)} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min`;
  if (s < 31557600) return plural((s / 86400).toFixed(1), 'day');
  const y = s / 31557600;
  if (y < 1e3) return plural(sig(y), 'year');
  if (y < 1e6) return `${sig(y / 1e3)} thousand years`;
  if (y < 1e9) return `${sig(y / 1e6)} million years`;
  return `${sig(y / 1e9)} billion years`;
}

/** Stopwatch face for the light pulse: h:mm:ss, or plain seconds under a minute. */
export function clockFace(s) {
  if (s < 60) return `${s.toFixed(2)} s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  if (s < 86400) return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  return `${(s / 86400).toFixed(2)} days`;
}

/** Largest 1/2/5 × 10ⁿ that is at most `v` — the length of a map scale bar. */
export function niceBelow(v) {
  const exp = Math.floor(Math.log10(v));
  const base = Math.pow(10, exp);
  const mant = v / base;
  if (mant >= 5) return 5 * base;
  if (mant >= 2) return 2 * base;
  return base;
}
