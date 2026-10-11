# AGENTS.md

Working notes for agents. This project evolves; treat the below as current intent, not a fixed spec.

## Goal

Make Europe’s post-2022 defence buildup inspectable: spending first, then (later) industry and capabilities. Public sources only; every number should be traceable.

## Current focus

- **In hand:** European NATO defence expenditure (2021–2025), including the NATO four-way split (equipment / personnel / infrastructure / other) and derived absolute amounts. Extra Germany series: Bundeshaushalt Einzelplan 14, Sondervermögen, SIPRI.
- **Not yet:** non-NATO EU states, company/production data, capability inventories (e.g. air defence).

## Layout (as of now)

| Path | Role |
|------|------|
| `sources/registry.csv` | Source catalog (`source_id` is the join key) |
| `data/nato_defence_expenditure.csv` | Main cross-country series (generated) |
| `data/germany_*.csv` | Germany national / SIPRI overlays |
| `scripts/generate_nato_expenditure.py` | Regenerates the NATO CSV from embedded tables |
| `index.html` / `app.js` / `styles.css` / `data.json` | Static briefing site (GitHub Pages) |
| `README.md` | Minimal public blurb (keep static) |

## Hosting

- **Live site:** https://timnooren.github.io/state-of-europe/
- **Repo:** https://github.com/TimNooren/state-of-europe (site files at repo root)
- **GitHub Pages:** legacy branch deploy from **`main`** / **`/`** (root). A push to `main` rebuilds the site; no Actions workflow required.
- Fine-grained PATs can push Contents but typically cannot create/change the Pages config via API — enable or adjust Pages in the repo Settings UI if needed.

## Conventions

- Prefer tidy/long tables: one observation per row, with `source_id`, `source_url`, `accessed_on`, `value_status`.
- Do not mix NATO, national-budget, and SIPRI figures in one chart without labeling definition differences.
- NATO 2024–2025 are estimates; empty value + `not_available` means the source had no figure.
- When changing NATO tables, edit the generator script and re-run it—don’t hand-edit the big CSV.
- Keep docs short; update this file when the goal or data shape shifts.

## Likely next steps (unordered)

Expand EU coverage; industry/company layer; capability proxies. Confirm with the user before large new collection efforts.
