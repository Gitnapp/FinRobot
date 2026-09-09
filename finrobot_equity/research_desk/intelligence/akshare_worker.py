"""Run AKShare in a killable process: its internal requests can block indefinitely."""

import json
import math
import re
import sys

import akshare as ak

FUNCTIONS = {
    "pmi": ("macro_china_pmi", "制造业-指数", "中国制造业 PMI", "指数"),
    "cpi": ("macro_china_cpi", "全国-同比增长", "中国 CPI", "%"),
}
function, column, label, unit = FUNCTIONS[sys.argv[1]]
frame = getattr(ak, function)()
points = []
for _, row in frame.iterrows():
    match = re.search(r"(\d{4})\D+(\d{1,2})", str(row["月份"]))
    value = float(row[column])
    if match and math.isfinite(value):
        point = {"date": f"{match[1]}-{int(match[2]):02d}-01", "value": value}
        if sys.argv[1] == "cpi":
            for field, source in [
                ("yoy", "全国-同比增长"),
                ("mom", "全国-环比增长"),
                ("index", "全国-当月"),
            ]:
                number = float(row[source])
                point[field] = number if math.isfinite(number) else None
        points.append(point)
points = sorted({p["date"]: p for p in points}.values(), key=lambda p: p["date"])
if not points:
    raise ValueError("empty dataset")
print(
    json.dumps(
        {
            "label": label,
            "unit": unit,
            "points": points,
            "source": "AKShare / 东方财富",
            "source_url": "https://akshare.akfamily.xyz/data/macro/macro.html",
        },
        ensure_ascii=False,
    )
)
