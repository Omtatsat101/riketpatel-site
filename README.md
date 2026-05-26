# riketpatel-site

Three-page interactive personal site for [riketpatel.com](https://riketpatel.com): Professional, Side Projects, Family.

Hosted on GitHub Pages. Plain HTML + CSS + a small vanilla-JS render layer. No build step.

## Files

- `index.html` — markup
- `style.css` — styles
- `app.js` — tab navigation, reveal-on-scroll, JSON-driven brag wall render, soft-lock password gates (family tab + AIPM download)
- `data/recommendations.json` — source of truth for the Wall of Brags (auto-updated, see below)
- `assets/` — photos and LinkedIn rec screenshots
- `assets/downloads/` — public downloadable résumés + cover letters (.docx)
- `assets/downloads/private/` — password-gated downloads (currently: AI Product Management capstone). Obfuscated filenames so they're not casually crawlable.
- `scripts/refresh_recommendations.py` — OCR-and-append script for new recommendations
- `.github/workflows/refresh-recommendations.yml` — nightly auto-refresh
- `CNAME` — custom domain binding

## Password-gated AIPM download

The "Featured project" card on the Professional page exposes a download button for the AI Product Management capstone (.pptx + certificate .pdf). Flow:

1. User clicks **Download (password required)** → modal opens
2. Enters password → JS checks against `RP_CONFIG.AIPM_DOWNLOAD_PASSWORD` in `config.js`
3. On match, both files download via temporary anchor clicks; on mismatch, friendly error

Soft lock only — not real security. To rotate: change `AIPM_DOWNLOAD_PASSWORD` in `config.js` AND rename the two files in `assets/downloads/private/` to new obfuscated names (then update the `AIPM_FILES` array in `app.js`).

## Deploy

Pushes to `main` deploy automatically via GitHub Pages. DNS: ALIAS / CNAME at the apex points at `omtatsat101.github.io`.

## Wall of Brags — drop-in workflow

The "Wall of Brags" section on the Professional page renders from `data/recommendations.json`.

To add a new recommendation:

1. Drop the screenshot into `assets/recommendations/` (any filename — `firstname-lastname.png` is ideal).
2. Commit + push, **or** wait for the nightly cron.
3. The [Refresh recommendations](.github/workflows/refresh-recommendations.yml) workflow runs Tesseract OCR (Japanese + Chinese Simplified + Chinese Traditional + English), creates a new entry in `data/recommendations.json`, and commits it back. GitHub Pages redeploys automatically.
4. To polish the auto-generated entry, edit `data/recommendations.json` directly — set `name`, `title`, `direction` (`"received"` or `"sent"`), `date`, and a one-line `summary`.

Two slots are reserved for personal artifacts and won't be touched by the OCR job:

- `assets/recommendations/bhavika-note.jpg` — Bhavika's hand-written note
- `assets/recommendations/mural-board.png` — Mural board export

The wall shows a placeholder for each until the file exists at that path.

### Running the refresh locally

```sh
pip install pytesseract pillow
# Make sure tesseract is installed with jpn + chi_sim + chi_tra + eng packs
python scripts/refresh_recommendations.py
```
