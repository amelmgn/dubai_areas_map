# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.1.0] — 2026-06-02

### Changed
- Map base layer switched from **raster** Carto tiles (`light_all`/`dark_all` PNG)
  to **vector** Carto GL styles — Positron (light theme) and Dark Matter (dark theme).
  `buildStyle` is now async: it fetches the ready-made Carto style and merges the
  project's geojson sources into it. No API key required.
- `setStyle` logic extracted into a shared `applyStyle` helper, removing duplication
  between initialization and the theme toggle.

### Notes
- MapLibre's `glyphs` is style-wide, so both the basemap and the area labels now pull
  fonts from Carto's font CDN. The `public/glyphs/` directory (self-hosted Open Sans)
  is no longer used.

## [1.0.0] — 2026-06-01

First release: an interactive map of Dubai areas built on MapLibre.

### Added
- **Data.** Source geojson for sectors, districts and communities; enrichment script
  (`scripts/enrich.mjs`) handling sector assignment, label points and bounding boxes.
- **Map.** MapLibre initialization, base map style and a light/dark theme toggle.
- **Data layers.** Per-sector fill color, outlines, labels and zoom thresholds that
  hand off between sectors → districts → communities.
- **Hover.** Highlight via `feature-state` — fill, outline and a brighter label.
- **Click.** Zoom into a polygon on click (`fitBounds`).
- **Search.** Autocomplete, fly-to and highlight of the matched area.
- **Legend.** Sector color legend.
- **Deploy.** Netlify configuration and README.
- **Debug.** Zoom level indicator for tuning the layer handoff thresholds.

### Fixed
- Area labels were invisible due to low `text-opacity` (0.25 → 1.0).
- Labels disappeared entirely when the glyph PBF was served from an external CDN;
  fonts are now self-hosted so text renders without external dependencies.
- `setStyle` forces a full style reload (`diff: false`); otherwise data layers were
  not re-added after a style change.

### Tweaked
- Sectors give way to districts at zoom 10 (was 11).
- Districts give way to communities at zoom 12 (was 13).

[Unreleased]: #unreleased
[1.0.0]: #100--2026-06-01
