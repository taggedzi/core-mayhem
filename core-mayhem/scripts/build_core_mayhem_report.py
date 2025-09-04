#!/usr/bin/env python3
"""
Core Mayhem – LibreOffice-ready report builder

Reads the 7 CSVs your simulator exports and builds a single Excel workbook
(with charts) that opens cleanly in LibreOffice Calc. Re-run it any time with
fresh CSVs to regenerate the charts.

Usage:
    python build_core_mayhem_report.py \
        --in-dir /path/to/csvs \
        --out /path/to/core_mayhem_report.xlsx

Notes:
- Charts are created using XlsxWriter. LibreOffice Calc will render them.
- You can also pass individual --file arguments if your names differ.
- No environment variables are required; a cleanup hook is included to match
  your preference for cleaning env vars in example scripts.
"""
import argparse
import os
from pathlib import Path
import pandas as pd
import numpy as np

def load_inputs(args):
    in_dir = Path(args.in_dir) if args.in_dir else None
    def p(name_default, arg_value):
        return Path(arg_value) if arg_value else (in_dir / name_default if in_dir else None)

    paths = {
        "bin_cycles": p("core-mayhem-session-*-bin_cycles.csv", args.bin_cycles),
        "damage_timeline": p("core-mayhem-session-*-damage_timeline.csv", args.damage_timeline),
        "first_hits": p("core-mayhem-session-*-first_hits.csv", args.first_hits),
        "matches": p("core-mayhem-session-*-matches.csv", args.matches),
        "mods_agg": p("core-mayhem-session-*-mods_agg.csv", args.mods_agg),
        "mods_per_match": p("core-mayhem-session-*-mods_per_match.csv", args.mods_per_match),
        "weapon_agg": p("core-mayhem-session-*-weapon_agg.csv", args.weapon_agg),
    }

    # If globbing is needed (default names contain a session id), resolve them.
    resolved = {}
    for key, path in paths.items():
        if path is None:
            raise ValueError(f"Missing path for {key}; provide --in-dir or --{key.replace('_','-')}")
        if '*' in str(path):
            matches = list(path.parent.glob(path.name))
            if not matches:
                raise FileNotFoundError(f"No files match pattern: {path}")
            # Pick the most recently modified file that matches
            path = max(matches, key=lambda p: p.stat().st_mtime)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {path}")
        resolved[key] = path

    return resolved

def prep_summaries(dfs):
    # Weapon effectiveness (aggregate across sides too)
    wa = dfs["weapon_agg"].copy()
    # Normalize column names just in case
    wa.columns = [c.strip() for c in wa.columns]

    # Per-side summary
    per_side = wa.groupby(["side","weapon"], as_index=False).agg(
        shots=("shots","sum"),
        hits=("hits","sum"),
        misses=("misses","sum"),
        hitRate=("hitRate","mean"),
        missPct=("missPct","mean"),
        dmgShield=("dmgShield","sum"),
        dmgSeg=("dmgSeg","sum"),
        dmgCenter=("dmgCenter","sum"),
        coreHitRate=("coreHitRate","mean"),
        coreDmgPerShot=("coreDmgPerShot","mean"),
    )
    per_side["totalDamage"] = per_side["dmgShield"] + per_side["dmgSeg"] + per_side["dmgCenter"]

    # Overall by weapon (combine sides)
    by_weapon = wa.groupby("weapon", as_index=False).agg(
        shots=("shots","sum"),
        hits=("hits","sum"),
        misses=("misses","sum"),
        hitRate=("hitRate","mean"),
        dmgShield=("dmgShield","sum"),
        dmgSeg=("dmgSeg","sum"),
        dmgCenter=("dmgCenter","sum"),
        coreHitRate=("coreHitRate","mean"),
        coreDmgPerShot=("coreDmgPerShot","mean"),
    )
    by_weapon["totalDamage"] = by_weapon["dmgShield"] + by_weapon["dmgSeg"] + by_weapon["dmgCenter"]

    # First hit timing summary
    fh = dfs["first_hits"].copy()
    first_hit_summary = fh.groupby("weapon", as_index=False)["msToFirstHit"].agg(
        count="count", mean="mean", median="median", p25=lambda s: s.quantile(0.25), p75=lambda s: s.quantile(0.75)
    ).sort_values("median")

    # Damage timeline cumulative per weapon
    dt = dfs["damage_timeline"].copy()
    dt["totalDamage"] = dt[["dmgShield","dmgSeg","dmgCenter"]].sum(axis=1)
    damage_over_time = (dt.groupby(["tSec","weapon"], as_index=False)["totalDamage"].sum()
                          .sort_values(["weapon","tSec"]))
    damage_over_time["cumDamage"] = damage_over_time.groupby("weapon")["totalDamage"].cumsum()

    # Mods summaries
    mods_agg = dfs["mods_agg"].copy()
    by_kind = mods_agg.groupby(["kind"], as_index=False)["count"].sum().sort_values("count", ascending=False)
    by_side_kind = mods_agg.groupby(["side","kind"], as_index=False)["count"].sum()

    # Bin cycles summary by bin
    bc = dfs["bin_cycles"].copy()
    bin_summary = bc.groupby("bin", as_index=False).agg(
        avgCycleMs=("avgMs","mean"),
        cycles=("cycles","sum"),
        totalDeposits=("totalDeposits","sum"),
        totalAmount=("totalAmount","sum")
    ).sort_values("avgCycleMs")

    # Matches summary
    matches = dfs["matches"].copy()
    matches_summary = pd.DataFrame({
        "count":[len(matches)],
        "meanDurationMs":[matches["durationMs"].mean()],
        "medianDurationMs":[matches["durationMs"].median()],
        "minDurationMs":[matches["durationMs"].min()],
        "maxDurationMs":[matches["durationMs"].max()],
    })

    return {
        "per_side": per_side,
        "by_weapon": by_weapon,
        "first_hit_summary": first_hit_summary,
        "damage_over_time": damage_over_time,
        "mods_by_kind": by_kind,
        "mods_by_side_kind": by_side_kind,
        "bin_summary": bin_summary,
        "matches_summary": matches_summary,
    }

def build_workbook(paths, out_path):
    # Load CSVs
    dfs = {k: pd.read_csv(v) for k, v in paths.items()}
    summaries = prep_summaries(dfs)

    # Write workbook with charts
    with pd.ExcelWriter(out_path, engine="xlsxwriter") as writer:
        # Raw sheets
        for name, df in dfs.items():
            df.to_excel(writer, sheet_name=f"raw_{name}", index=False)

        # Summary sheets
        for name, df in summaries.items():
            df.to_excel(writer, sheet_name=name, index=False)

        # Create charts
        workbook  = writer.book

        # Weapon damage (stacked columns) + HitRate (line, secondary axis)
        ws = writer.sheets["by_weapon"]
        df = summaries["by_weapon"]
        categories = ["by_weapon", 1, 0, len(df), 0]  # weapon col

        # Stacked bars for damage parts
        chart = workbook.add_chart({"type":"column", "subtype":"stacked"})
        for i, col in enumerate(["dmgShield","dmgSeg","dmgCenter"]):
            chart.add_series({
                "name":       [ "by_weapon", 0, df.columns.get_loc(col) ],
                "categories": categories,
                "values":     [ "by_weapon", 1, df.columns.get_loc(col), len(df), df.columns.get_loc(col) ],
            })
        chart.set_title({"name":"Weapon Damage Breakdown (stacked)"})
        chart.set_x_axis({"name":"Weapon"})
        chart.set_y_axis({"name":"Damage"})
        chart.set_legend({"position":"bottom"})

        # HitRate line on secondary axis
        line = workbook.add_chart({"type":"line"})
        hit_col = df.columns.get_loc("hitRate")
        line.add_series({
            "name":       ["by_weapon", 0, hit_col],
            "categories": categories,
            "values":     ["by_weapon", 1, hit_col, len(df), hit_col],
            "y2_axis":    True,
        })
        line.set_y2_axis({"name":"Hit Rate"})
        chart.combine(line)
        ws.insert_chart("H2", chart, {"x_scale": 1.6, "y_scale": 1.4})

        # First hit timing (median with IQR bars simulated as columns)
        ws2 = writer.sheets["first_hit_summary"]
        df2 = summaries["first_hit_summary"]
        chart2 = workbook.add_chart({"type":"column"})
        med_col = df2.columns.get_loc("median")
        chart2.add_series({
            "name":       ["first_hit_summary", 0, med_col],
            "categories": ["first_hit_summary", 1, 0, len(df2), 0],
            "values":     ["first_hit_summary", 1, med_col, len(df2), med_col],
        })
        chart2.set_title({"name":"Time to First Hit (median ms)"})
        chart2.set_x_axis({"name":"Weapon"})
        chart2.set_y_axis({"name":"ms"})
        ws2.insert_chart("G2", chart2, {"x_scale": 1.6, "y_scale": 1.4})

        # Damage over time (cumulative) – line chart per weapon
        ws3 = writer.sheets["damage_over_time"]
        df3 = summaries["damage_over_time"]
        chart3 = workbook.add_chart({"type":"line"})
        # Pivot unique weapons for series
        weapons = df3["weapon"].unique().tolist()
        # We'll rely on the table: tSec, weapon, totalDamage, cumDamage
        for w in weapons:
            sub = df3[df3["weapon"] == w]
            start_row = df3.index.get_indexer_for(sub.index)[0] + 1  # +1 header
            end_row   = start_row + len(sub) - 1
            t_col = df3.columns.get_loc("tSec")
            c_col = df3.columns.get_loc("cumDamage")
            chart3.add_series({
                "name":       str(w),
                "categories": ["damage_over_time", start_row, t_col, end_row, t_col],
                "values":     ["damage_over_time", start_row, c_col, end_row, c_col],
            })
        chart3.set_title({"name":"Cumulative Damage Over Time"})
        chart3.set_x_axis({"name":"Seconds"})
        chart3.set_y_axis({"name":"Cumulative Damage"})
        ws3.insert_chart("G2", chart3, {"x_scale": 1.8, "y_scale": 1.4})

        # Mods usage by kind (column)
        ws4 = writer.sheets["mods_by_kind"]
        df4 = summaries["mods_by_kind"]
        chart4 = workbook.add_chart({"type":"column"})
        cnt_col = df4.columns.get_loc("count")
        chart4.add_series({
            "name":       ["mods_by_kind", 0, cnt_col],
            "categories": ["mods_by_kind", 1, 0, len(df4), 0],
            "values":     ["mods_by_kind", 1, cnt_col, len(df4), cnt_col],
        })
        chart4.set_title({"name":"Buff/Debuff Usage by Kind"})
        chart4.set_x_axis({"name":"Kind"})
        chart4.set_y_axis({"name":"Count"})
        ws4.insert_chart("E2", chart4, {"x_scale": 1.4, "y_scale": 1.2})

        # Bin cycles – avg cycle time
        ws5 = writer.sheets["bin_summary"]
        df5 = summaries["bin_summary"]
        chart5 = workbook.add_chart({"type":"column"})
        avg_col = df5.columns.get_loc("avgCycleMs")
        chart5.add_series({
            "name":       ["bin_summary", 0, avg_col],
            "categories": ["bin_summary", 1, 0, len(df5), 0],
            "values":     ["bin_summary", 1, avg_col, len(df5), avg_col],
        })
        chart5.set_title({"name":"Ammo Bin Avg Cycle Time (ms)"})
        chart5.set_x_axis({"name":"Bin"})
        chart5.set_y_axis({"name":"ms"})
        ws5.insert_chart("F2", chart5, {"x_scale": 1.4, "y_scale": 1.2})

        # Matches duration summary (simple single-cell bars aren't useful; instead show stats)
        # Optionally, build a histogram on a separate sheet from raw matches
        matches = dfs["matches"]
        hist, bins = np.histogram(matches["durationMs"], bins=10)
        hist_df = pd.DataFrame({"bin_start": bins[:-1], "bin_end": bins[1:], "count": hist})
        hist_df.to_excel(writer, sheet_name="match_duration_hist", index=False)
        ws6 = writer.sheets["match_duration_hist"]
        chart6 = workbook.add_chart({"type":"column"})
        chart6.add_series({
            "name":       "Match Duration Histogram",
            "categories": ["match_duration_hist", 1, 0, len(hist_df), 0],
            "values":     ["match_duration_hist", 1, 2, len(hist_df), 2],
        })
        chart6.set_title({"name":"Match Durations (ms)"})
        chart6.set_x_axis({"name":"Bin Start (ms)"})
        chart6.set_y_axis({"name":"Count"})
        ws6.insert_chart("E2", chart6, {"x_scale": 1.6, "y_scale": 1.2})

    return out_path

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--in-dir", help="Directory containing the 7 CSVs (glob supported).")
    parser.add_argument("--out", required=True, help="Output .xlsx path for LibreOffice Calc.")
    # Optional explicit files
    parser.add_argument("--bin-cycles")
    parser.add_argument("--damage-timeline")
    parser.add_argument("--first-hits")
    parser.add_argument("--matches")
    parser.add_argument("--mods-agg")
    parser.add_argument("--mods-per-match")
    parser.add_argument("--weapon-agg")

    args = parser.parse_args()

    # Build
    paths = load_inputs(args)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    built = build_workbook(paths, out_path)

    print(f"Report written to: {built}")

    # --- Environment cleanup (per your preference for example scripts) ---
    # This script does not set env vars, but if you add any in the future,
    # clean them here, e.g.:
    # for key in ("MY_TMP_VAR",):
    #     if key in os.environ:
    #         del os.environ[key]

if __name__ == "__main__":
    main()
