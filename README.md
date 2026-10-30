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

Useful URL switches: `?mode=live|standby`, `?theme=fall|winter|none`, `?debug=1` (errors and weather on screen),
`?weather=clear|cloudy|rain|heavy|snow|fog|windy|...` (pretend weather),
`?icons=text|emoji`. Autumn also has `?seed=<any text>` (another day's layout), `?fallpal=a|b`, `?haze=0`.

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
| `src/core/` | Helpers: SVG, text measuring, time, shared state, events, debug |
| `src/plan/` | The floor plan, clock, list panel, QR code |
| `src/data/` | Fetching bookings and working out room states |
| `src/system/` | Standby mode, auto-update and reload |
| `src/weather/` | Live weather for the office (Open-Meteo), as a simple description themes can use |
| `src/themes/` | Seasonal themes: `index.js` picks one by date, `toolkit.js` has shared helpers |
| `src/themes/fall/settings.js` | Autumn tuning knobs (palettes, falling, ledges) |
| `assets/themes/fall/sprites.svg` | Autumn shapes (leaves, acorns, mushrooms, stump), editable in any SVG editor |
| `floorplan.css` | Styles |

Themes get a "scene" from `main.js`: their own layer, the geometry, spots to keep clear (QR code,
logos) and whether it's standby. They don't touch the plan itself.

## Weather data

Weather comes from [Open-Meteo](https://open-meteo.com) (free for non-commercial use, data licensed
CC BY 4.0). Once weather visibly affects the screen, show a small credit on it, e.g.
"Weather: Open-Meteo.com". The office location is `WEATHER_AT` in `src/config.js`.
