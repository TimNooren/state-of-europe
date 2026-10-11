#!/usr/bin/env python3
"""Generate provenance-tracked NATO European defence expenditure CSV.

Source: NATO Defence Expenditure of NATO Countries (2014-2025), cut-off 3 June 2025.
https://www.nato.int/content/dam/nato/webready/documents/finance/def-exp-2025-en.pdf

European NATO = all Allies except United States and Canada.
Türkiye and the United Kingdom are included (NATO Europe), with eu_member=false.
"""

from __future__ import annotations

import csv
from pathlib import Path

SOURCE_ID = "NATO-DEX-2025"
SOURCE_URL = (
    "https://www.nato.int/content/dam/nato/webready/documents/finance/def-exp-2025-en.pdf"
)
ACCESSED_ON = "2026-10-10"
YEARS = [2021, 2022, 2023, 2024, 2025]

# (iso2, name, currency, eu_member, nordic)
COUNTRIES = [
    ("AL", "Albania", "ALL", False, False),
    ("BE", "Belgium", "EUR", True, False),
    ("BG", "Bulgaria", "BGN", True, False),
    ("HR", "Croatia", "EUR", True, False),
    ("CZ", "Czechia", "CZK", True, False),
    ("DK", "Denmark", "DKK", True, True),
    ("EE", "Estonia", "EUR", True, False),
    ("FI", "Finland", "EUR", True, True),
    ("FR", "France", "EUR", True, False),
    ("DE", "Germany", "EUR", True, False),
    ("GR", "Greece", "EUR", True, False),
    ("HU", "Hungary", "HUF", True, False),
    ("IT", "Italy", "EUR", True, False),
    ("LV", "Latvia", "EUR", True, False),
    ("LT", "Lithuania", "EUR", True, False),
    ("LU", "Luxembourg", "EUR", True, False),
    ("ME", "Montenegro", "EUR", False, False),
    ("NL", "Netherlands", "EUR", True, False),
    ("MK", "North Macedonia", "MKD", False, False),
    ("NO", "Norway", "NOK", False, True),
    ("PL", "Poland", "PLN", True, False),
    ("PT", "Portugal", "EUR", True, False),
    ("RO", "Romania", "RON", True, False),
    ("SK", "Slovak Republic", "EUR", True, False),
    ("SI", "Slovenia", "EUR", True, False),
    ("ES", "Spain", "EUR", True, False),
    ("SE", "Sweden", "SEK", True, True),
    ("TR", "Türkiye", "TRY", False, False),
    ("GB", "United Kingdom", "GBP", False, False),
]

NA = None  # NATO ".." / unavailable

# Table 1: defence expenditure, million national currency, current prices (2021-2025)
NAT_CCY = {
    "AL": [23072, 25848, 41473, 43011, 54106],
    "BE": [5276, 6551, 7047, 7900, 12758],
    "BG": [2109, 2672, 3602, 3964, 4489],
    "HR": [1150, 1219, 1304, 1600, 1863],
    "CZ": [84864, 90969, 100735, 166600, 167800],
    "DK": [33161, 38726, 56100, 66400, 98900],
    "EE": [633, 778, 1144, 1316, 1397],
    "FI": [3503, 4485, 5794, 6680, 7974],
    "FR": [47702, 49567, 54950, 59580, 61780],
    "DE": [52431, 58266, 67621, 86638, NA],
    "GR": [6764, 8054, 6224, 6539, 7125],
    "HU": [730691, 1212914, 1538908, 1730698, 1765141],
    "IT": [28001, 29901, 31302, 32701, 45315],
    "LV": [696, 813, 1160, 1331, 1535],
    "LT": [1105, 1649, 2002, 2427, 3349],
    "LU": [341, 438, 594, 724, 1254],
    "ME": [77, 82, 106, 127, 161],
    "NL": [11758, 13189, 15500, 20200, 26100],
    "MK": [10604, 12899, 15081, 17915, 20451],
    "NO": [72483, 83589, 92951, 115970, 177000],
    "PL": [58304, 68361, 111224, 137176, 175733],
    "PT": [3295, 3395, 3563, 4482, 5935],
    "RO": [22029, 24317, 25644, 38213, 43355],
    "SK": [1746, 1983, 2260, 2588, 2873],
    "SI": [645, 737, 842, 906, 1405],
    "ES": [12546, 15610, 17451, 22693, 33123],
    "SE": [77794, 86596, 104500, 147600, 164400],
    "TR": [116482, 203704, 393841, 928133, 1361307],
    "GB": [52283, 57269, 61164, 65841, 70196],
}

# Table 2: million USD, current prices and exchange rates
USD = {
    "AL": [224, 231, 409, 463, 570],
    "BE": [6245, 6904, 7622, 8548, 13739],
    "BG": [1276, 1440, 1992, 2193, 2389],
    "HR": [1361, 1285, 1410, 1731, 2006],
    "CZ": [3915, 3895, 4538, 7176, 7223],
    "DK": [5274, 5473, 8143, 9631, 14303],
    "EE": [749, 820, 1238, 1424, 1504],
    "FI": [4145, 4726, 6266, 7228, 8587],
    "FR": [56457, 52238, 59433, 64469, 66531],
    "DE": [62054, 61405, 73138, 93747, NA],
    "GR": [8006, 8488, 6731, 7075, 7673],
    "HU": [2410, 3270, 4360, 4736, 4807],
    "IT": [33140, 31512, 33856, 35384, 48800],
    "LV": [824, 857, 1254, 1440, 1653],
    "LT": [1308, 1738, 2165, 2626, 3607],
    "LU": [403, 461, 642, 783, 1350],
    "ME": [91, 86, 114, 138, 174],
    "NL": [13916, 13899, 16764, 21858, 28107],
    "MK": [204, 221, 265, 315, 358],
    "NO": [8438, 8694, 8799, 10792, 16490],
    "PL": [15099, 15338, 26475, 34454, 44314],
    "PT": [3899, 3578, 3854, 4849, 6391],
    "RO": [5299, 5197, 5607, 8312, 9308],
    "SK": [2066, 2090, 2445, 2800, 3094],
    "SI": [763, 777, 911, 980, 1513],
    "ES": [14849, 16451, 18875, 24555, 35670],
    "SE": [9071, 8502, 9849, 13967, 15207],
    "TR": [12969, 12291, 16766, 28274, 32573],
    "GB": [71927, 70846, 76052, 84169, 90508],
}

# Table 3: share of real GDP (%)
GDP_SHARE = {
    "AL": [1.24, 1.20, 1.75, 1.70, 2.01],
    "BE": [1.04, 1.16, 1.18, 1.29, 2.00],
    "BG": [1.51, 1.59, 1.94, 1.95, 2.06],
    "HR": [1.97, 1.80, 1.67, 1.87, 2.03],
    "CZ": [1.35, 1.29, 1.32, 2.08, 2.00],
    "DK": [1.29, 1.36, 2.00, 2.27, 3.22],
    "EE": [2.02, 2.14, 3.00, 3.37, 3.38],
    "FI": [1.41, 1.69, 2.12, 2.40, 2.77],
    "FR": [1.90, 1.87, 1.94, 2.03, 2.05],
    "DE": [1.43, 1.48, 1.61, 2.00, NA],
    "GR": [3.66, 3.87, 2.76, 2.74, 2.85],
    "HU": [1.32, 1.83, 2.05, 2.13, 2.06],
    "IT": [1.52, 1.50, 1.47, 1.50, 2.01],
    "LV": [2.16, 2.25, 2.97, 3.36, 3.73],
    "LT": [1.95, 2.44, 2.71, 3.09, 4.00],
    "LU": [0.47, 0.56, 1.06, 1.19, 2.00],
    "ME": [1.55, 1.38, 1.52, 1.72, 2.03],
    "NL": [1.32, 1.39, 1.60, 2.00, 2.49],
    "MK": [1.45, 1.58, 1.68, 1.89, 2.00],
    "NO": [1.68, 1.46, 1.82, 2.27, 3.35],
    "PL": [2.19, 2.21, 3.27, 3.79, 4.48],
    "PT": [1.52, 1.39, 1.33, 1.58, 2.00],
    "RO": [1.85, 1.75, 1.60, 2.17, 2.28],
    "SK": [1.71, 1.80, 1.84, 1.96, 2.04],
    "SI": [1.24, 1.30, 1.32, 1.37, 2.02],
    "ES": [1.02, 1.14, 1.16, 1.43, 2.00],
    "SE": [1.43, 1.48, 1.68, 2.31, 2.51],
    "TR": [1.61, 1.36, 1.48, 2.13, 2.33],
    "GB": [2.29, 2.27, 2.25, 2.33, 2.40],
}

# Table 8a/8b category shares (% of total defence expenditure)
EQUIPMENT = {
    "AL": [15.12, 17.05, 25.19, 26.60, 42.12],
    "BE": [19.47, 20.36, 20.22, 15.16, 14.54],
    "BG": [11.05, 15.70, 28.27, 32.47, 29.11],
    "HR": [30.01, 31.19, 24.20, 26.37, 29.87],
    "CZ": [20.47, 24.66, 23.04, 38.12, 30.68],
    "DK": [17.19, 18.72, 12.66, 30.82, NA],
    "EE": [23.18, 21.86, 16.72, 23.24, 25.83],
    "FI": [19.88, 33.54, 42.54, 40.91, 45.97],
    "FR": [27.85, 28.64, 28.50, 28.50, 31.03],
    "DE": [16.69, 17.23, 18.04, 21.17, NA],
    "GR": [37.24, 42.29, 25.15, 25.72, 35.00],
    "HU": [36.40, 47.58, 39.22, 47.81, 44.95],
    "IT": [23.23, 22.77, 21.98, 21.58, 25.68],
    "LV": [22.07, 24.65, 31.57, 25.32, 35.50],
    "LT": [22.32, 36.62, 28.66, 30.02, 45.84],
    "LU": [39.58, 45.10, 56.40, 51.38, 53.51],
    "ME": [20.54, 22.85, 23.99, 30.41, 34.27],
    "NL": [23.85, 14.78, 23.87, 23.27, 26.05],
    "MK": [21.77, 24.13, 25.17, 29.62, 32.36],
    "NO": [29.19, 28.39, 29.29, 27.33, 31.44],
    "PL": [33.89, 32.42, 44.73, 42.90, 54.44],
    "PT": [12.46, 16.09, 18.82, 19.03, 20.00],
    "RO": [21.57, 25.51, 21.94, 32.09, 31.81],
    "SK": [32.34, 36.54, 26.08, 35.17, 31.10],
    "SI": [14.56, 22.38, 23.92, 24.94, 26.55],
    "ES": [22.47, 20.89, 27.39, 30.79, 32.29],
    "SE": [20.22, 21.13, 30.24, 35.37, 35.83],
    "TR": [29.31, 28.43, 29.79, 33.36, 27.00],
    "GB": [29.50, 31.42, 31.26, 33.36, 35.96],
}

PERSONNEL = {
    "AL": [63.57, 60.05, 38.37, 42.03, 33.41],
    "BE": [56.79, 49.89, 49.92, 48.34, 32.44],
    "BG": [65.59, 57.80, 53.14, 55.27, 52.79],
    "HR": [56.71, 55.38, 58.30, 58.10, 54.31],
    "CZ": [44.70, 42.85, 42.86, 27.79, 28.72],
    "DK": [48.31, 40.88, 29.57, 27.38, 18.93],
    "EE": [33.61, 29.41, 24.31, 22.14, 22.64],
    "FI": [35.09, 28.64, 23.76, 21.00, 17.97],
    "FR": [42.99, 42.33, 40.35, 38.90, 38.22],
    "DE": [42.28, 39.26, 35.77, 31.15, NA],
    "GR": [53.78, 45.92, 60.67, 61.20, 58.45],
    "HU": [38.74, 31.42, 25.00, 24.86, 28.20],
    "IT": [63.73, 63.67, 62.35, 58.42, 42.85],
    "LV": [37.24, 36.53, 32.31, 32.41, 29.77],
    "LT": [42.58, 33.21, 32.05, 29.98, 25.29],
    "LU": [34.58, 28.78, 20.43, 19.62, 11.73],
    "ME": [59.90, 61.12, 58.40, 46.22, 44.40],
    "NL": [47.86, 47.04, 35.78, 37.78, 30.57],
    "MK": [51.03, 42.80, 47.72, 49.66, 41.00],
    "NO": [34.15, 34.22, 33.97, 31.67, 20.45],
    "PL": [43.55, 42.72, 31.91, 30.42, 26.75],
    "PT": [63.09, 61.81, 63.61, 55.15, NA],
    "RO": [57.79, 55.03, 59.70, 45.46, 45.23],
    "SK": [46.61, 42.77, 41.81, 40.12, 38.86],
    "SI": [61.99, 53.77, 50.13, 46.44, 31.29],
    "ES": [58.70, 52.70, 49.30, 38.43, 27.76],
    "SE": [22.66, 21.48, 19.34, 14.98, 14.45],
    "TR": [47.88, 45.27, 44.20, 40.14, 34.41],
    "GB": [31.49, 29.74, 30.69, 30.35, 29.25],
}

INFRASTRUCTURE = {
    "AL": [3.61, 5.12, 18.67, 6.01, 3.70],
    "BE": [0.82, 2.67, 3.58, 3.75, 3.73],
    "BG": [4.93, 6.96, 2.01, 4.90, 2.36],
    "HR": [0.55, 0.71, 3.01, 2.30, 1.31],
    "CZ": [6.24, 4.32, 6.37, 7.02, 14.07],
    "DK": [4.08, 3.07, 2.64, 2.36, 1.07],
    "EE": [5.55, 8.02, 10.65, 9.67, 8.04],
    "FI": [0.63, 0.52, 0.33, 0.36, 0.18],
    "FR": [3.04, 3.01, 3.48, 3.67, 3.83],
    "DE": [3.74, 3.54, 3.35, 3.35, NA],
    "GR": [0.26, 0.26, 0.59, 0.36, 0.00],
    "HU": [9.16, 2.23, 4.19, 4.82, 5.75],
    "IT": [1.48, 1.95, 2.13, 2.92, 1.90],
    "LV": [5.28, 4.31, 6.85, 5.20, 5.60],
    "LT": [2.47, 4.54, 9.77, 9.50, 6.05],
    "LU": [7.28, 4.96, 12.95, 9.79, 7.05],
    "ME": [5.26, 0.49, 5.16, 7.68, 6.64],
    "NL": [2.99, 3.32, 2.65, 3.87, 3.09],
    "MK": [3.09, 3.09, 1.64, 4.31, 1.84],
    "NO": [6.45, 5.64, 5.17, 7.46, 4.71],
    "PL": [3.71, 4.12, 4.41, 4.45, 3.76],
    "PT": [4.48, 2.11, 2.48, 3.65, NA],
    "RO": [7.06, 4.19, 4.49, 11.50, 13.57],
    "SK": [1.46, 2.60, 3.48, 5.99, 4.32],
    "SI": [1.31, 1.92, 6.72, 4.74, 2.20],
    "ES": [1.08, 0.76, 1.46, 2.32, 4.63],
    "SE": [0.29, 0.23, 0.35, 0.29, 0.40],
    "TR": [7.49, 7.63, 9.48, 8.62, 7.39],
    "GB": [1.72, 2.88, 2.21, 2.24, 2.80],
}

OTHER = {
    "AL": [17.70, 17.78, 17.76, 25.36, 20.77],
    "BE": [22.92, 27.08, 26.27, 32.75, 49.29],
    "BG": [18.43, 19.54, 16.58, 7.36, 15.74],
    "HR": [12.73, 12.72, 14.49, 13.22, 14.51],
    "CZ": [28.58, 28.17, 27.73, 27.08, 26.52],
    "DK": [30.42, 37.33, 55.14, 39.44, 34.39],
    "EE": [37.65, 40.71, 48.32, 44.95, 43.50],
    "FI": [44.40, 37.30, 33.37, 37.73, 35.88],
    "FR": [26.12, 26.02, 27.67, 28.94, 26.92],
    "DE": [37.29, 39.96, 42.84, 44.34, NA],
    "GR": [8.72, 11.53, 13.60, 12.71, 6.55],
    "HU": [15.70, 18.76, 31.59, 22.51, 21.09],
    "IT": [11.56, 11.61, 13.54, 17.08, 29.57],
    "LV": [35.42, 34.51, 29.27, 37.08, 29.13],
    "LT": [32.63, 25.63, 29.51, 30.50, 22.82],
    "LU": [18.57, 21.15, 10.22, 19.21, 27.71],
    "ME": [14.30, 15.53, 12.44, 15.69, 14.69],
    "NL": [25.29, 34.85, 37.70, 35.09, 40.28],
    "MK": [24.10, 29.98, 25.47, 16.42, 24.80],
    "NO": [30.21, 31.75, 31.57, 33.53, 43.41],
    "PL": [18.85, 20.74, 18.94, 22.23, 15.05],
    "PT": [19.97, 19.99, 15.09, 22.17, NA],
    "RO": [13.58, 15.26, 13.87, 10.95, 9.39],
    "SK": [19.59, 18.09, 28.63, 18.72, 25.72],
    "SI": [22.14, 21.94, 19.23, 23.88, 39.96],
    "ES": [17.76, 25.65, 21.85, 28.46, 35.32],
    "SE": [56.83, 57.15, 50.07, 49.36, 49.33],
    "TR": [15.32, 18.67, 16.54, 17.88, 31.20],
    "GB": [37.29, 35.96, 35.84, 34.05, 31.99],
}

NOTES = {
    "DE": {
        2025: "NATO shows '..' for Germany 2025e; national budget not approved at 3 June 2025 cut-off"
    },
    "FI": {2021: "Finland joined NATO 4 April 2023; earlier years still reported"},
    "SE": {2021: "Sweden joined NATO 7 March 2024; earlier years still reported"},
    "NO": {2021: "Nordic peer; not an EU member"},
    "TR": {2021: "Included as NATO Europe (not EU)"},
    "GB": {2021: "Included as NATO Europe (not EU)"},
    "AL": {2021: "EU candidate; NATO Ally"},
    "ME": {2021: "EU candidate; NATO Ally"},
    "MK": {2021: "EU candidate; NATO Ally"},
}


def year_status(year: int, value) -> str:
    if value is NA:
        return "not_available"
    if year >= 2024:
        return "estimate"
    return "final"


def fmt_value(value) -> str:
    if value is NA:
        return ""
    if isinstance(value, float):
        # Keep two decimals for percentages/shares; drop trailing noise
        return f"{value:.2f}".rstrip("0").rstrip(".") if value != int(value) else str(int(value))
    return str(value)


def row(
    iso2,
    name,
    eu,
    nordic,
    year,
    metric,
    value,
    unit,
    basis,
    status,
    table,
    notes="",
):
    return {
        "country_iso2": iso2,
        "country_name": name,
        "eu_member": "true" if eu else "false",
        "nordic": "true" if nordic else "false",
        "european_nato": "true",
        "year": year,
        "metric": metric,
        "value": fmt_value(value),
        "unit": unit,
        "currency_or_basis": basis,
        "value_status": status,
        "source_id": SOURCE_ID,
        "source_table": table,
        "source_url": SOURCE_URL,
        "accessed_on": ACCESSED_ON,
        "notes": notes,
    }


def derive_amount(total, share_pct):
    if total is NA or share_pct is NA:
        return NA
    return round(total * share_pct / 100.0, 3)


def main() -> None:
    out = Path(__file__).resolve().parents[1] / "data" / "nato_defence_expenditure.csv"
    rows = []

    for iso2, name, ccy, eu, nordic in COUNTRIES:
        for i, year in enumerate(YEARS):
            note = NOTES.get(iso2, {}).get(year, "")

            nat = NAT_CCY[iso2][i]
            usd = USD[iso2][i]
            gdp = GDP_SHARE[iso2][i]
            eq = EQUIPMENT[iso2][i]
            pe = PERSONNEL[iso2][i]
            inf = INFRASTRUCTURE[iso2][i]
            ot = OTHER[iso2][i]

            rows.append(
                row(
                    iso2, name, eu, nordic, year,
                    "defence_expenditure_national_currency",
                    nat, "million", ccy, year_status(year, nat),
                    "Table 1 current prices", note,
                )
            )
            rows.append(
                row(
                    iso2, name, eu, nordic, year,
                    "defence_expenditure_current_usd",
                    usd, "million", "USD", year_status(year, usd),
                    "Table 2 current prices and exchange rates", note,
                )
            )
            rows.append(
                row(
                    iso2, name, eu, nordic, year,
                    "defence_expenditure_share_of_gdp",
                    gdp, "percent", "share of real GDP (2021 prices)",
                    year_status(year, gdp), "Table 3", note,
                )
            )

            for metric, val, table in [
                ("equipment_share_of_defence_expenditure", eq, "Table 8a Equipment"),
                ("personnel_share_of_defence_expenditure", pe, "Table 8a Personnel"),
                (
                    "infrastructure_share_of_defence_expenditure",
                    inf,
                    "Table 8b Infrastructure",
                ),
                ("other_share_of_defence_expenditure", ot, "Table 8b Other"),
            ]:
                rows.append(
                    row(
                        iso2,
                        name,
                        eu,
                        nordic,
                        year,
                        metric,
                        val,
                        "percent",
                        "percent of total defence expenditure",
                        year_status(year, val),
                        table,
                        note,
                    )
                )

            # Derived absolute amounts: total × share
            for cat, share, label in [
                ("equipment", eq, "Derived: Table1 × Table8a equipment share / 100"),
                ("personnel", pe, "Derived: Table1 × Table8a personnel share / 100"),
                ("infrastructure", inf, "Derived: Table1 × Table8b infrastructure share / 100"),
                ("other", ot, "Derived: Table1 × Table8b other share / 100"),
            ]:
                amt_nat = derive_amount(nat, share)
                amt_usd = derive_amount(usd, share)
                st = (
                    "not_available"
                    if amt_nat is NA
                    else ("derived_from_estimate" if year >= 2024 else "derived")
                )
                rows.append(
                    row(
                        iso2, name, eu, nordic, year,
                        f"{cat}_expenditure_national_currency",
                        amt_nat, "million", ccy, st,
                        "Derived from Table 1 and Table 8", label,
                    )
                )
                st_usd = (
                    "not_available"
                    if amt_usd is NA
                    else ("derived_from_estimate" if year >= 2024 else "derived")
                )
                rows.append(
                    row(
                        iso2, name, eu, nordic, year,
                        f"{cat}_expenditure_current_usd",
                        amt_usd, "million", "USD", st_usd,
                        "Derived from Table 2 and Table 8",
                        label.replace("Table1", "Table2"),
                    )
                )

    # Sanity: category shares should sum ~100 when all present
    warnings = []
    for iso2, *_ in COUNTRIES:
        for i, year in enumerate(YEARS):
            parts = [
                EQUIPMENT[iso2][i],
                PERSONNEL[iso2][i],
                INFRASTRUCTURE[iso2][i],
                OTHER[iso2][i],
            ]
            if any(p is NA for p in parts):
                continue
            s = sum(parts)
            if abs(s - 100.0) > 0.2:
                warnings.append(f"{iso2} {year}: category shares sum to {s:.2f}")

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
        "currency_or_basis",
        "value_status",
        "source_id",
        "source_table",
        "source_url",
        "accessed_on",
        "notes",
    ]
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)

    print(f"Wrote {len(rows)} rows -> {out}")
    print(f"Countries: {len(COUNTRIES)}")
    if warnings:
        print("WARNINGS:")
        for wmsg in warnings:
            print(" ", wmsg)
    else:
        print("Category share sums OK (|sum-100| <= 0.2) where complete")


if __name__ == "__main__":
    main()
