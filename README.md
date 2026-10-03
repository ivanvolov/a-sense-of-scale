# A Sense of Scale

Cosmic distances you can handle with your fingers. Plain Canvas 2D, no
dependencies at runtime, and nothing to pay for to build or host it.

**→ [ivanvolov.github.io/a-sense-of-scale](https://ivanvolov.github.io/a-sense-of-scale/)**

Install it from the browser menu and it runs full screen and offline.

## Using it

Two fingers to zoom, one to pan. On a desktop: scroll, drag, double-click to
reset, `+` `−` `0` on the keyboard.

| Mode | |
|---|---|
| **Earth & Moon** | Zoom out until the Moon shows up. One button lays the other seven planets into the gap — they overshoot by 3 724 km. |
| **Solar System** | Orbits of all eight planets. Zoom in on any of them and it stays a dot. |
| **Speed of Light** | A pulse leaving the Sun at the real speed of light, with a clock and a time multiplier. |
| **Powers of Ten** | Concentric sizes from a proton to the observable universe. |

The readout top right gives a scale bar and the time light needs to cross it.

## Commands

```
npm install
npm run dev       # 127.0.0.1:5178
npm run build     # dist/ — the deployable site
npm run verify    # drives a browser over dist/: manifest, icons, offline, iOS install
npm run bundle    # out/explorer.html — the whole app as one file
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
  index.html   markup and styles
  app.js       camera, gestures, drawing, HUD
  worlds.js    the four modes: data plus one draw(g) each
  units.js     formatting across 42 decades
  data.js      every number, SI units, with its source
  assets/      icons and the social preview
tools/
  serve.js  bundle.js  site.js  icons.js  shots.js  verify-site.js
```

A world gets a camera and primitives through `g`; it never touches the DOM or
the input layer. `data.js` feeds both the geometry and the labels describing it,
so the two cannot drift apart.

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
