# A Sense of Scale

Cosmic distances you can handle with your fingers, plus a short film that plays
the same scenes on its own. Both are plain Canvas 2D, both read their numbers
from one file, and neither needs a paid service to build or host.

**→ [ivanvolov.github.io/a-sense-of-scale](https://ivanvolov.github.io/a-sense-of-scale/)**

Install it from the browser menu and it runs full screen and offline.

## The explorer

Two fingers to zoom, one to pan. On a desktop: scroll, drag, double-click to
reset, `+` `−` `0` on the keyboard.

| Mode | |
|---|---|
| **Earth & Moon** | Zoom out until the Moon shows up. One button lays the other seven planets into the gap — they overshoot by 3 724 km. |
| **Solar System** | Orbits of all eight planets. Zoom in on any of them and it stays a dot. |
| **Speed of Light** | A pulse leaving the Sun at the real speed of light, with a clock and a time multiplier. |
| **Powers of Ten** | A ladder of concentric sizes from a proton to the observable universe. |

The readout top right gives a scale bar and the time light needs to cross it.

## Commands

```
npm install
npm run dev       # film preview + explorer on 127.0.0.1:5178
npm run build     # dist/ — the deployable site
npm run verify    # drives a browser over dist/: manifest, icons, offline, iOS install
npm run render    # out/space-scale.mp4 — the film, 1080p, ~4 min
npm run shots     # screenshots (--device desktop|ipad|phone)
npm run icons     # redraw icons and the social preview
```

## How it holds 42 orders of magnitude

The camera state is `logSpan`: the base-10 log of how many metres fit across the
viewport. A pinch becomes an addition, a zoom tween interpolates one number, and
nothing accumulates the multiplications that cost precision. A 3D engine cannot
hold this range — float32 in a vertex buffer starts fighting well before 10¹² m.

Anything under two pixels is drawn as a marker rather than inflated to a visible
disc. Rounding it up would lie about the one thing the page exists to show.

## Layout

```
src/
  lib/data.js       every number, SI units, with its source
  lib/math.js       easing, log interpolation, formatting
  lib/draw.js       film primitives (fixed 1920×1080)
  film.js           scene list + renderFrame(ctx, t)
  scenes/           earth-moon · sun-au · light-speed · cards
  explorer/         app.js (camera, gestures, HUD) · worlds.js · units.js
tools/
  serve.js  capture.js  bundle.js  site.js  icons.js  shots.js  verify-site.js
```

`lib/data.js` feeds both the geometry and the captions describing it, so the two
cannot drift apart. `renderFrame(ctx, t)` is pure — no clock, no unseeded random
— which lets the headless renderer walk the timeline faster than real time and
still match the preview.

Every path in the build is relative: GitHub Pages serves a project site from a
subdirectory, where absolute paths resolve one level too high. `npm run verify`
serves `dist/` under a subpath for that reason.

## Deploying

Pushing to `main` builds and publishes through `.github/workflows/pages.yml`.
The build needs no npm packages. To host it elsewhere, `npm run build` and
upload `dist/`.

## Sources

NASA/JPL Planetary Fact Sheets (radii, orbits), IAU 2012 (1 AU =
149 597 870 700 m), CODATA (c = 299 792 458 m/s, exact by definition).
Inter and JetBrains Mono, SIL OFL 1.1.
