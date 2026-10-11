# Europe defense industry tracker — spending data (v0)

Public, provenance-tracked dataset for European defence spending.

## Layout

```
state-of-europe/
  index.html / styles.css / app.js / data.json   # briefing site (GitHub Pages)
  README.md
  sources/registry.csv
  data/nato_defence_expenditure.csv   # European NATO, full category breakdown
  data/germany_national_budget.csv    # DE Einzelplan 14 + Sondervermögen
  data/germany_sipri_milex.csv        # DE SIPRI USD context
  scripts/generate_nato_expenditure.py
```

Live: https://timnooren.github.io/state-of-europe/

## View the briefing

```bash
python3 -m http.server 8765
# open http://127.0.0.1:8765/
```

## Provenance rules

1. Every observation has `source_id`, `source_url`, and `accessed_on`.
2. `source_id` must exist in `sources/registry.csv`.
3. Prefer primary publishers (NATO, Bundeshaushalt, BMVg, SIPRI).
4. Never mix NATO / national-budget / SIPRI series in one chart without labeling.
5. Empty `value` + `value_status=not_available` means the source had no figure (NATO `..`).
6. `derived` / `derived_from_estimate` rows are computed as **total × category share / 100**.

## Coverage

**European NATO** = all Allies except the United States and Canada (29 countries), including Türkiye and the United Kingdom. Flags: `european_nato`, `eu_member`, `nordic`.

Years: **2021–2025** (2021 = pre-Zeitenwende baseline). NATO marks **2024–2025 as estimates**.

Regenerate after editing embedded tables:

```bash
python3 scripts/generate_nato_expenditure.py
```

## NATO category breakdown

NATO splits defence expenditure into four shares (Tables 8a/8b):

| Share metric | Absolute metrics (derived) | Contents |
|--------------|----------------------------|----------|
| `equipment_share_of_defence_expenditure` | `equipment_expenditure_*` | Major equipment + R&D devoted to major equipment |
| `personnel_share_of_defence_expenditure` | `personnel_expenditure_*` | Military + civilian pay, allowances, **pensions** |
| `infrastructure_share_of_defence_expenditure` | `infrastructure_expenditure_*` | National military construction + NATO common infrastructure |
| `other_share_of_defence_expenditure` | `other_expenditure_*` | O&M (fuel, spares, consumables), other R&D, unallocated |

Absolute amounts are stored in both national currency and current USD:

- `*_expenditure_national_currency` = Table 1 total × share / 100  
- `*_expenditure_current_usd` = Table 2 total × share / 100  

Also stored: totals (`defence_expenditure_national_currency`, `defence_expenditure_current_usd`) and `defence_expenditure_share_of_gdp`.

### Germany 2024e example (NATO)

| Category | Share | ≈ amount |
|----------|------:|----------|
| Equipment | 21.2% | €18.3 bn |
| Personnel | 31.2% | €27.0 bn |
| Infrastructure | 3.4% | €2.9 bn |
| Other (mostly O&M) | 44.3% | €38.4 bn |
| **Total** | **100%** | **€86.6 bn** |

## Other datasets

### `germany_national_budget.csv`

Einzelplan 14 (MoD chapter) and Sondervermögen Bundeswehr — **not** identical to NATO totals.

### `germany_sipri_milex.csv`

SIPRI current-USD series for global ranking context.

## Quick snapshot — NATO % of GDP (selected)

| Country | 2022 | 2023 | 2024e | 2025e |
|---------|------|------|-------|-------|
| Germany | 1.48 | 1.61 | 2.00 | n/a |
| France | 1.87 | 1.94 | 2.03 | 2.05 |
| Poland | 2.21 | 3.27 | 3.79 | 4.48 |
| United Kingdom | 2.27 | 2.25 | 2.33 | 2.40 |
| Estonia | 2.14 | 3.00 | 3.37 | 3.38 |
| Lithuania | 2.44 | 2.71 | 3.09 | 4.00 |

## Next layers (not yet collected)

- EU members that are not NATO (Ireland, Austria, Malta, Cyprus) via SIPRI/EDA
- Company / industry layer (Rheinmetall, MBDA, KNDS, Saab, Leonardo, Thales, …)
- Capability proxies (air defence, munitions) — sparse public data

## Update checklist

1. Download latest NATO defence expenditure PDF → new `source_id` if edition changes.
2. Update tables in `scripts/generate_nato_expenditure.py` → re-run script.
3. Refresh Germany Bundeshaushalt / Sondervermögen / SIPRI files as needed.
4. Bump `accessed_on` on changed rows / script constant.
