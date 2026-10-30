# Room status screen

Floor plan of the office with live room bookings, shown on a TV in the open space.
Room data comes from a Power Automate flow; outside office hours the screen goes to standby
(big clock). Seasonal themes add some ambiance on top.

The TV runs an old browser (Chromium 56). The code is written as modern ES modules in `src/`
and bundled by esbuild into `dist/app.js`, compiled down for that browser.

## Working on it

```
npm install        # once
npm run dev        # http://localhost:8000, rebuilds on every save
```

Useful URL switches: `?mode=live|standby`, `?theme=fall|winter|none`, `?debug=1` (errors, weather, fps and
detail level on screen), `?weather=clear|cloudy|rain|heavy|snow|fog|windy|...` (pretend weather),
`?detail=0..1` (fixed animation detail instead of self-adjusting), `?wind=<km/h>` (pretend wind),
`?gusts=often` (a gust every few seconds),
`?skip=tree,floor,fungi,spider,owl,wind,falling` (leave out parts of the autumn theme), `?icons=text|emoji`. Autumn also has `?seed=<any text>` (another day's layout), `?fallpal=a|b`, `?haze=0`.

## When the TV crashes

A crashed page can't show errors, so the page saves a trail of milestones in the browser's storage as it
runs (startup steps, each theme part, then a heartbeat every 15 s, later every minute), always. Open
the page with `?debug=1` afterwards: it shows how far the previous run got. Leave parts out with `?skip=`
to find the one the TV can't handle.

## Old browser on the TV

The TV runs Chrome 56. The build makes everything it publishes readable for it: the app's code via
esbuild, and the small inline scripts in `index.html` and `diag.html` via `scripts/build-html.cjs`
(the deploy publishes those converted copies, not the originals). So write and format the source
however you like; if something can't be converted, the build fails and the TV keeps the last good
version. `diag.html` on the TV shows its browser version and any error when loading the app.

## Publishing

Push to `main`. A GitHub Action builds and publishes to GitHub Pages; the TV notices the new
version within about 5 minutes and reloads by itself.

## Where things are

| Path | What |
|---|---|
| `src/config.js` | All settings: data URL, office hours, timings, palette, asset positions |
| `src/floorplan.json` | Room and anchor coordinates |
| `src/layout.js` | Geometry derived from the two above |
| `src/main.js` | Wires everything together, in drawing order |
| `src/core/` | Helpers: SVG, text measuring, time, shared state, events, debug, animation detail level |
| `src/plan/` | The floor plan, clock, list panel, QR code |
| `src/data/` | Fetching bookings and working out room states |
| `src/system/` | Standby mode, auto-update and reload |
| `src/weather/` | Live weather for the office (Open-Meteo), as a simple description themes can use |
| `src/themes/` | Seasonal themes: `index.js` picks one by date, `toolkit.js` has shared helpers, `wind.js` turns the weather into wind |
| `src/themes/fall/settings.js` | Autumn tuning knobs (palettes, falling, ledges) |
| `assets/themes/fall/sprites.svg` | Autumn shapes (leaves, acorns, mushrooms, stump), editable in any SVG editor |
| `floorplan.css` | Styles |

Themes get a "scene" from `main.js`: their own layer, the geometry, spots to keep clear (QR code,
logos) and whether it's standby. They don't touch the plan itself.

## Weather data

Weather comes from [Open-Meteo](https://open-meteo.com) (free for non-commercial use, data licensed
CC BY 4.0). The licence asks for a credit where the data is shown: it's under the QR code
(`WEATHER_CREDIT` in `src/config.js`). The office location is `WEATHER_AT` in the same file.

## Animation performance

The TV is slow, so animations adjust themselves: `src/core/perf.js` watches the frame rate and lowers a
shared detail level (0 to 1) when it drops, then slowly raises it again. Animations scale with it (fewer
falling leaves, fewer resting ones, later also fewer raindrops). Thresholds are `PERF` in `src/config.js`;
`?debug=1` shows the live numbers.

The TV redraws a whole drawing whenever anything in it moves, so everything that moves (falling leaves,
owl, spider, later rain) lives in its own transparent drawing on top of the plan (`overlay()` in
`src/core/svg.js`, the theme's `scene.front`), and the QR code in another one above that. The plan and
the static scene (tree, floor, fungi) are then drawn once. New moving parts go in `scene.front`.
