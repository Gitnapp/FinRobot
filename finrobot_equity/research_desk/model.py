"""20-line model. USD millions throughout. Forecasts are assumptions, never facts."""

from .schemas import Assumptions

ROWS = [
    ("revenue", "营业收入", "money", "基期收入 × (1 + 收入增速)"),
    ("growth", "收入增速", "percent", "本年收入 / 上年收入 − 1"),
    ("cogs", "营业成本", "money", "营业收入 × (1 − 毛利率)"),
    ("gross_profit", "毛利润", "money", "营业收入 − 营业成本"),
    ("gross_margin", "毛利率", "percent", "毛利润 / 营业收入"),
    (
        "opex",
        "经营费用（含 SG&A、研发）",
        "money",
        "营业收入 × 经营费用率；不含折旧摊销",
    ),
    ("ebitda", "EBITDA", "money", "毛利润 − 经营费用"),
    ("ebitda_margin", "EBITDA Margin", "percent", "EBITDA / 营业收入"),
    ("da", "折旧摊销", "money", "营业收入 × 折旧摊销率"),
    ("ebit", "EBIT", "money", "EBITDA − 折旧摊销"),
    ("interest", "利息费用", "money", "预测期维持基期利息费用"),
    ("pretax", "税前利润", "money", "EBIT − 利息费用"),
    ("tax", "所得税", "money", "max(税前利润, 0) × 税率；亏损不假设税收抵免"),
    ("net_income", "净利润", "money", "税前利润 − 所得税"),
    ("net_margin", "净利率", "percent", "净利润 / 营业收入"),
    ("capex", "资本开支 CapEx", "money", "营业收入 × 资本开支率"),
    ("nwc", "营运资金变动", "money", "(本年收入 − 上年收入) × 增量营运资金率"),
    (
        "fcf",
        "自由现金流 FCF",
        "money",
        "净利润 + 折旧摊销 − CapEx − 营运资金变动；简化股权现金流",
    ),
    ("multiple", "EV / EBITDA", "multiple", "预测末年的退出倍数假设"),
    (
        "ev",
        "企业价值 EV",
        "money",
        "预测末年 EBITDA × 退出倍数；未折现，非股权价值或目标价",
    ),
]


def defaults(base):
    rev = base["revenue"]
    return Assumptions(
        gross_margin=max(0, min(1, (rev - base["cogs"]) / rev)),
        opex_ratio=max(0, min(1, base["opex"] / rev)),
        da_ratio=max(0, min(0.5, base["da"] / rev)),
        capex_ratio=max(0, min(0.6, base["capex"] / rev)),
    ).model_dump()


def compute_model(base, assumptions=None, scenario="base"):
    a = Assumptions(**(assumptions or defaults(base))).model_dump()
    if scenario == "bull":
        a.update(
            growth=min(2, a["growth"] + 0.05),
            gross_margin=min(1, a["gross_margin"] + 0.02),
        )
    elif scenario == "bear":
        a.update(
            growth=max(-0.8, a["growth"] - 0.08),
            gross_margin=max(0, a["gross_margin"] - 0.03),
        )
    elif scenario != "base":
        raise ValueError("Unknown scenario")
    history = {key: base.get(key) for key, *_ in ROWS}
    rev = base["revenue"]
    if rev <= 0:
        raise ValueError("Positive base revenue required")
    history.update(gross_profit=rev - base["cogs"], growth=base.get("growth"))
    history["ebitda"] = history["gross_profit"] - base["opex"]
    history["ebit"] = history["ebitda"] - base["da"]
    history["pretax"] = history["ebit"] - base["interest"]
    history["net_income"] = history["pretax"] - base["tax"]
    history["fcf"] = history["net_income"] + base["da"] - base["capex"] - base["nwc"]
    for metric, amount in [
        ("gross_margin", "gross_profit"),
        ("ebitda_margin", "ebitda"),
        ("net_margin", "net_income"),
    ]:
        history[metric] = history[amount] / rev
    years = [history]
    for i in range(3):
        prev = rev
        rev *= 1 + a["growth"]
        row = dict(
            revenue=rev,
            growth=a["growth"],
            cogs=rev * (1 - a["gross_margin"]),
            gross_profit=rev * a["gross_margin"],
            gross_margin=a["gross_margin"],
            opex=rev * a["opex_ratio"],
            da=rev * a["da_ratio"],
            interest=base["interest"],
            capex=rev * a["capex_ratio"],
            nwc=(rev - prev) * a["nwc_ratio"],
        )
        row["ebitda"] = row["gross_profit"] - row["opex"]
        row["ebitda_margin"] = row["ebitda"] / rev
        row["ebit"] = row["ebitda"] - row["da"]
        row["pretax"] = row["ebit"] - row["interest"]
        row["tax"] = max(0, row["pretax"]) * a["tax_rate"]
        row["net_income"] = row["pretax"] - row["tax"]
        row["net_margin"] = row["net_income"] / rev
        row["fcf"] = row["net_income"] + row["da"] - row["capex"] - row["nwc"]
        row["multiple"] = a["exit_multiple"] if i == 2 and row["ebitda"] > 0 else None
        row["ev"] = row["ebitda"] * a["exit_multiple"] if row["multiple"] else None
        years.append(row)
    return {
        "columns": [f"{base['year']}A"] + [f"{base['year'] + i}E" for i in range(1, 4)],
        "rows": [
            {
                "key": key,
                "label": label,
                "format": fmt,
                "formula": formula,
                "values": [year.get(key) for year in years],
            }
            for key, label, fmt, formula in ROWS
        ],
        "assumptions": a,
        "scenario": scenario,
        "unit": "USD million",
        "source": base["source"],
        "mock": base["mock"],
        "as_of": base["as_of"],
        "notes": [
            "A 表示基期；模拟基期仍为演示数据。E 表示假设预测。",
            "经营费用包含研发等费用并剔除折旧摊销，避免重复扣减。",
            "该简化模型省略非经营损益。FCF 采用净利润口径，非 FCFF。",
            "EV 是预测末年未折现企业价值，不能直接与当前市值或股价比较。",
        ],
    }
