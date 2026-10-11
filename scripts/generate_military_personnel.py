#!/usr/bin/env python3
"""Generate provenance-tracked European NATO military personnel CSV.

Primary metric: active military personnel (full-time / active-duty strength).

Source: International Institute for Strategic Studies (IISS) Military Balance
figures as compiled in Wikipedia's country personnel table (accessed 2026-10-11).
IISS separates active military from reserve and paramilitary; use active for
cross-country comparison of standing forces.

Coverage: European NATO Allies excluding United States and Canada.
"""

from __future__ import annotations

import csv
from pathlib import Path

SOURCE_ID = "IISS-MB-WIKI"
SOURCE_URL = (
    "https://en.wikipedia.org/wiki/"
    "List_of_countries_by_number_of_military_and_paramilitary_personnel"
)
SOURCE_PUBLISHER_NOTE = (
    "Transcribed from Wikipedia compilation of IISS Military Balance country "
    "personnel figures (active / reserve / paramilitary). Underlying publisher "
    "is IISS; Wikipedia cites mixed 2024–2026 Balance editions by country. "
    "Active = full-time military; excludes reserve and paramilitary."
)
ACCESSED_ON = "2026-10-11"
REFERENCE_YEAR = 2025  # IISS Balance edition year most commonly cited for Europe

# (iso2, name, eu_member, nordic, active, reserve, paramilitary)
# Active is the headline comparable series.
ROWS = [
    ("AL", "Albania", False, False, 7500, 0, 0),
    ("BE", "Belgium", True, False, 23500, 5900, 0),
    ("BG", "Bulgaria", True, False, 36950, 3000, 0),
    ("HR", "Croatia", True, False, 16800, 2100, 0),
    ("CZ", "Czechia", True, False, 26600, 0, 0),
    ("DK", "Denmark", True, True, 13100, 44200, 0),
    ("EE", "Estonia", True, False, 7100, 41200, 21200),
    ("FI", "Finland", True, True, 23850, 233000, 14900),
    ("FR", "France", True, False, 203900, 38100, 126600),
    ("DE", "Germany", True, False, 179850, 34100, 0),
    ("GR", "Greece", True, False, 131650, 264500, 7400),
    ("HU", "Hungary", True, False, 32150, 20000, 0),
    ("IT", "Italy", True, False, 160400, 14500, 179250),
    ("LV", "Latvia", True, False, 6600, 16000, 0),
    ("LT", "Lithuania", True, False, 16100, 12950, 18400),
    ("LU", "Luxembourg", True, False, 1100, 0, 0),
    ("ME", "Montenegro", False, False, 2885, 2800, 4100),
    ("NL", "Netherlands", True, False, 33650, 6350, 6800),
    ("MK", "North Macedonia", False, False, 8000, 4850, 7600),
    ("NO", "Norway", False, True, 25400, 40000, 0),
    ("PL", "Poland", True, False, 173000, 37500, 14300),
    ("PT", "Portugal", True, False, 26050, 23500, 22820),
    ("RO", "Romania", True, False, 69900, 55000, 57000),
    ("SK", "Slovak Republic", True, False, 15850, 0, 0),
    ("SI", "Slovenia", True, False, 6200, 950, 0),
    ("ES", "Spain", True, False, 122200, 13800, 87450),
    ("SE", "Sweden", True, True, 14850, 21500, 21500),
    ("TR", "Türkiye", False, False, 355200, 378700, 161400),
    ("GB", "United Kingdom", False, False, 141100, 70450, 0),
]


def main() -> None:
    out = Path(__file__).resolve().parents[1] / "data" / "military_personnel.csv"
    fieldnames = [
        "country_iso2",
        "country_name",
        "eu_member",
        "nordic",
        "european_nato",
        "year",
        "metric",
        "value",
        "unit",
        "value_status",
        "source_id",
        "source_table",
        "source_url",
        "accessed_on",
        "notes",
    ]

    metric_defs = [
        (
            "active_personnel",
            "active",
            "IISS active military (full-time / active duty). Primary comparable series.",
        ),
        (
            "reserve_personnel",
            "reserve",
            "IISS reserve military. Not standing active duty; definitions vary.",
        ),
        (
            "paramilitary_personnel",
            "paramilitary",
            "IISS paramilitary (e.g. gendarmerie). Not regular armed-forces active duty.",
        ),
        (
            "total_military_personnel",
            "total",
            "IISS total = active + reserve + paramilitary (derived here from those three).",
        ),
    ]

    rows_out: list[dict] = []
    for iso2, name, eu, nordic, active, reserve, paramil in ROWS:
        values = {
            "active": active,
            "reserve": reserve,
            "paramilitary": paramil,
            "total": active + reserve + paramil,
        }
        for metric, key, metric_note in metric_defs:
            note = f"{metric_note} {SOURCE_PUBLISHER_NOTE}"
            if iso2 == "DE" and metric == "active_personnel":
                note += (
                    " Bundeswehr reported ~184,200 soldiers at end-2025; IISS figure "
                    "is slightly lower (edition lag)."
                )
            rows_out.append(
                {
                    "country_iso2": iso2,
                    "country_name": name,
                    "eu_member": str(eu).lower(),
                    "nordic": str(nordic).lower(),
                    "european_nato": "true",
                    "year": REFERENCE_YEAR,
                    "metric": metric,
                    "value": values[key],
                    "unit": "persons",
                    "value_status": "estimate",
                    "source_id": SOURCE_ID,
                    "source_table": f"IISS via Wikipedia · {key}",
                    "source_url": SOURCE_URL,
                    "accessed_on": ACCESSED_ON,
                    "notes": note,
                }
            )

    with out.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows_out)

    active_sum = sum(r[4] for r in ROWS)
    print(f"Wrote {len(rows_out)} rows → {out}")
    print(f"European NATO active total: {active_sum:,}")
    print(f"Source: {SOURCE_URL}")


if __name__ == "__main__":
    main()
