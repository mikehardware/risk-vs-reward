# Eddie’s Weight & Walking Points (Preview)

## Quick Deploy (Netlify)
1. Create a new folder and copy the files in this repo structure.
2. (Optional) Zip the folder.
3. Netlify → **Deploys** → **Deploy a site** → Drag & drop the folder (or zip).
4. Done. The app runs as an SPA (`netlify.toml` handles routing).

## Features
- Tabs: **Daily**, **Walking Points**, **Settings**, **Import**, **Export**
- Units: **English** (default) or **Metric**
- Gender: Male 1.00, Female 1.25
- Elevation: Sea‑level baseline=1.00; multiplier rises smoothly with altitude (γ default 0.40)
- Incline: Half‑percent table with linear interpolation
- Weekly points chart (goal 100+)
- Local‑only storage (IndexedDB)
- Import CSV from your Excel sheets (Daily / Walk Record)
- Export CSV/JSON backups

## Where to tweak
- `assets/config.json`: incline table, home elevation, gamma, brand color
- `assets/calc.js`: base points coefficients `A,B,C` if you want to fine‑tune parity

## Notes on elevation model
- Standard barometric relation \(p(h) = 101.325(1 - 2.25577×10^{-5}h)^{5.25588}\) kPa, sea level baseline = 1.00.
- O₂ fraction in dry air is ~20.9%; effective oxygen availability falls because **pressure** drops with altitude.

## History import
Paste CSV:
- **Daily:** `Date,Weight,Notes`
- **Walks:** `Date,Distance (mi),Minutes,Seconds,Incline %,Elevation m,Notes`