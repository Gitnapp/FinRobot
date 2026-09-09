"""Scale to earnings to equity value and per-share price. Explicit forecast assumptions."""

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
    ("multiple", "EV / EBITDA", "multiple", "各预测期 EV / EBITDA 倍数假设"),
    (
        "ev",
        "企业价值 EV",
        "money",
        "各预测期 EBITDA × 估值倍数；未折现企业价值",
    ),
    ("net_debt", "净债务", "money", "总债务减现金及现金等价物；预测期保持基期水平"),
    ("equity_value", "隐含股权价值", "money", "企业价值减净债务；为各预测期末名义价值，未折现"),
    (
        "shares",
        "摊薄股数（百万股）",
        "number",
        "以基期摊薄加权平均股数作为预测股数，按股数变动假设逐年调整",
    ),
    (
        "price",
        "隐含每股价格（美元）",
        "price",
        "隐含股权价值 ÷ 摊薄股数；两者均为百万单位，不需再换算",
    ),
]


def defaults(base):
    if base is None:
        from .providers import ProviderError

        raise ProviderError("financials_unavailable")
    rev = base["revenue"]
    values = Assumptions().model_dump()
    for key, source, max_value in [
        ("gross_margin", "cogs", 1),
        ("opex_ratio", "opex", 1),
        ("da_ratio", "da", 0.5),
        ("capex_ratio", "capex", 0.6),
    ]:
        value = base.get(source)
        if value is not None:
            ratio = (rev - value) / rev if source == "cogs" else value / rev
            values[key] = max(0, min(max_value, ratio))
    return values


def scenario_assumptions(assumptions, scenario="base", overrides=None):
    a = dict(assumptions)
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
    return Assumptions.model_validate({**a, **(overrides or {})}).model_dump()


def compute_model(base, assumptions=None, scenario="base", overrides=None):
    if base is None:
        from .providers import ProviderError

        raise ProviderError("financials_unavailable")
    a = Assumptions(**(assumptions or defaults(base))).model_dump()
    a = scenario_assumptions(a, scenario, overrides)
    history = {key: base.get(key) for key, *_ in ROWS}
    rev = base["revenue"]
    if rev <= 0:
        raise ValueError("Positive base revenue required")

    def subtract(left, right):
        return left - right if left is not None and right is not None else None

    def add(left, right):
        return left + right if left is not None and right is not None else None

    gross = subtract(rev, base.get("cogs"))
    history.update(gross_profit=gross, growth=base.get("growth"))
    history["ebitda"] = add(base.get("operating_income"), base.get("da"))
    history["ebit"] = base.get("operating_income")
    history["pretax"] = base.get("pretax")
    history["net_income"] = base.get("net_income")
    history["fcf"] = base.get("fcf")
    for metric, amount in [
        ("gross_margin", "gross_profit"),
        ("ebitda_margin", "ebitda"),
        ("net_margin", "net_income"),
    ]:
        history[metric] = history[amount] / rev if history[amount] is not None else None
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
        row["pretax"] = subtract(row["ebit"], row["interest"])
        row["tax"] = max(0, row["pretax"]) * a["tax_rate"] if row["pretax"] is not None else None
        row["net_income"] = subtract(row["pretax"], row["tax"])
        row["net_margin"] = row["net_income"] / rev if row["net_income"] is not None else None
        row["fcf"] = subtract(subtract(add(row["net_income"], row["da"]), row["capex"]), row["nwc"])
        row["multiple"] = a["exit_multiple"] if row["ebitda"] > 0 else None
        row["ev"] = row["ebitda"] * a["exit_multiple"] if row["multiple"] else None
        row["net_debt"] = base.get("net_debt")
        shares = base.get("shares")
        row["shares"] = (
            shares * (1 + a["share_growth"]) ** (i + 1) if shares and shares > 0 else None
        )
        row["equity_value"] = (
            row["ev"] - row["net_debt"]
            if row["ev"] is not None and row["net_debt"] is not None
            else None
        )
        row["price"] = (
            row["equity_value"] / row["shares"]
            if row["equity_value"] is not None and row["equity_value"] >= 0 and row["shares"]
            else None
        )
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
        "currency": base.get("currency", "USD"),
        "unit": f"金额：百万 {base.get('currency', 'USD')}；股数：百万股；每股价格：{base.get('currency', 'USD')}",
        "source": base["source"],
        "mock": base["mock"],
        "as_of": base["as_of"],
        "notes": [
            "A 表示已披露基期，E 表示假设预测。基期净利润直接采用披露值；基期FCF采用经营现金流减资本开支，预测FCF为简化估算。",
            "经营费用包含研发等费用并剔除折旧摊销，避免重复扣减。",
            "该简化模型省略非经营损益。FCF 采用净利润口径，非 FCFF。",
            "EV、股权价值与每股价格均为各预测期末名义估值，未经折现，不是当前目标价。",
            "净债务预测保持基期水平；基期摊薄加权平均股数用作股数假设，并非期末实际流通股数。",
            "缺少净债务或股数时不计算每股价格；负股权价值不映射为负股票价格。",
            "每股估值采用财报摊薄股数口径；未进行ADR/ADS比例换算，不能直接与不同币种或股类的市场报价比较。",
        ],
    }


def unavailable_model(scenario="base"):
    return {
        "available": False,
        "columns": ["基期", "预测第1年", "预测第2年", "预测第3年"],
        "rows": [
            {"key": key, "label": label, "format": fmt, "formula": formula, "values": [None] * 4}
            for key, label, fmt, formula in ROWS
        ],
        "assumptions": None,
        "scenario": scenario,
        "unit": "金额口径待财务基期确认",
        "source": "尚未取得可用财务基期",
        "mock": False,
        "as_of": "—",
        "notes": ["尚未取得完整、同币种的财务输入，保留模型栏位，不生成预测数字。"],
    }
