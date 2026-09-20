# Sprint Routechoice Analyser

An interactive, high-performance sprint orienteering course planning and routechoice analysis web application.

## Features

- **Vector PDF & High-Res Map Support**: Direct PDF.js rendering with calibrated scale (1:4,000, 1:3,000, etc.) and DPI adjustment.
- **Multi-Page PDF & Multi-Part Course Stitching**: Automatically stitches 2-page PDFs (Part 1 & Part 2) or multiple map files side-by-side or stacked with visual demarcations.
- **Interactive Course Drawing**: Control points, Start triangle, Finish double circles, and straight leg course overprints.
- **Precision Route Choice Comparison**: Draw color-coded alternative routes with automatic distance calculations, pacing/time differentials, and optimal route detection.
- **Interactive Presentation Deck Export**:
  - Export self-contained standalone HTML presentations.
  - Auto-centering and zoom per leg (`initLegView`).
  - Mobile-ready responsive interface with full-touch gesture support and iOS fullscreen fallbacks.
  - Executive Performance Summary slide with KPI cards and interactive leg evaluation track.
  - 1-Click direct GitHub Pages deployment with ready-to-paste iframe embed codes.

## Usage

Open `index.html` in any modern web browser, or serve locally with:
```bash
python -m http.server 8585
```
