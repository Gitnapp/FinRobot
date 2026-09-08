"""Native vector figures for screen, standalone HTML and PDF; no screenshots."""

import base64
from decimal import Decimal, ROUND_HALF_UP

from reportlab.graphics import renderSVG
from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics.charts.lineplots import LinePlot
from reportlab.graphics.shapes import Drawing, Line, Rect, String
from reportlab.graphics.widgets.markers import makeMarker
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont

INK = colors.HexColor("#344942")
GRAY = colors.HexColor("#96aaa1")
GRID = colors.HexColor("#e7ece9")


def frame(title):
    d = Drawing(460, 250)
    d.add(Rect(0, 0, 460, 250, fillColor=colors.white, strokeColor=None))
    d.add(String(14, 232, title, fontName="Helvetica", fontSize=16, fillColor=INK))
    return d


def bars(title, labels, series, names):
    d = frame(title)
    c = VerticalBarChart()
    c.x = 58
    c.y = 58
    c.width = 352
    c.height = 140
    c.data = series
    all_values = [value for group in series for value in group]
    # Bar lengths encode magnitude: positive financial/peer bars must start at
    # zero, not ReportLab's default minimum observation.
    c.valueAxis.valueMin = min(0, min(all_values))
    c.valueAxis.valueMax = max(1, max(all_values) * 1.1)
    c.categoryAxis.categoryNames = labels
    c.categoryAxis.labels.fontSize = 14
    c.valueAxis.labels.fontSize = 14
    c.valueAxis.strokeColor = None
    c.categoryAxis.strokeColor = GRID
    c.valueAxis.gridStrokeColor = GRID
    c.valueAxis.visibleGrid = True
    for i in range(len(series)):
        c.bars[i].fillColor = [INK, GRAY, colors.HexColor("#c7bfae")][i % 3]
        c.bars[i].strokeColor = None
    d.add(c)
    for i, name in enumerate(names):
        d.add(
            Rect(
                50 + i * 132,
                12,
                7,
                7,
                fillColor=[INK, GRAY, colors.HexColor("#c7bfae")][i % 3],
                strokeColor=None,
            )
        )
        d.add(String(62 + i * 132, 12, name, fontSize=12, fillColor=INK))
    return d


def lines(title, labels, series, names):
    d = frame(title)
    c = LinePlot()
    c.x = 58
    c.y = 58
    c.width = 352
    c.height = 140
    c.data = [[(i, float(v)) for i, v in enumerate(s)] for s in series]
    c.joinedLines = True
    c.xValueAxis.valueMin = 0
    c.xValueAxis.valueMax = max(1, len(labels) - 1)
    ticks = list(dict.fromkeys([0, len(labels) // 3, 2 * len(labels) // 3, len(labels) - 1]))
    c.xValueAxis.valueSteps = ticks
    c.xValueAxis.labelTextFormat = lambda v: labels[min(len(labels) - 1, max(0, int(v)))]
    c.xValueAxis.labels.fontSize = 14
    c.yValueAxis.labels.fontSize = 14
    c.yValueAxis.gridStrokeColor = GRID
    c.yValueAxis.visibleGrid = True
    c.xValueAxis.strokeColor = GRID
    c.yValueAxis.strokeColor = None
    for i in range(len(series)):
        c.lines[i].strokeColor = [INK, GRAY, colors.HexColor("#b69a74")][i % 3]
        c.lines[i].strokeWidth = 1.4
        if len(labels) <= 12:
            c.lines[i].symbol = makeMarker(
                "FilledCircle",
                size=4,
                fillColor=c.lines[i].strokeColor,
                strokeColor=c.lines[i].strokeColor,
            )
    d.add(c)
    for i, name in enumerate(names):
        d.add(
            String(
                50 + i * 125,
                12,
                name,
                fontSize=12,
                fillColor=[INK, GRAY, colors.HexColor("#b69a74")][i % 3],
            )
        )
    return d


def profitability_table(labels, series):
    """Exact annual margin comparison; no interpolated trends between assumptions."""
    font = "STSong-Light"
    if font not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(UnicodeCIDFont(font))
    drawing = Drawing(460, 202)
    drawing.add(Rect(0, 0, 460, 202, fillColor=colors.white, strokeColor=None))

    def text(x, y, value, size=12, color=INK, anchor="start"):
        drawing.add(
            String(x, y, value, fontName=font, fontSize=size, fillColor=color, textAnchor=anchor)
        )

    text(14, 179, "盈利能力", 15)
    text(442, 180, "单位：%", 10, GRAY, "end")
    drawing.add(Rect(181, 14, 65, 145, fillColor=colors.HexColor("#f1f4f2"), strokeColor=None))
    right_edges = [235, 304, 373, 442]
    text(14, 137, "指标", 10, GRAY)
    for i, label in enumerate(labels):
        text(right_edges[i], 143, label[:-1], 11, INK, "end")
        text(right_edges[i], 128, "实际" if label.endswith("A") else "预测", 9, GRAY, "end")
    names = ["毛利率", "EBITDA 利润率", "净利率"]
    for y in [116, 82, 48, 14]:
        drawing.add(Line(14, y, 446, y, strokeColor=GRID, strokeWidth=0.5))
    for i, (name, values) in enumerate(zip(names, series)):
        y = 94 - i * 34
        text(14, y, name, 12)
        for x, value in zip(right_edges, values):
            text(x, y, str(Decimal(str(round(value, 8))).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)), 13, INK, "end")
    return drawing


def sensitivity(val):
    d = frame("DCF enterprise value sensitivity | USD bn")
    matrix = val["sensitivity"]
    flat = [v for row in matrix for v in row]
    lo = min(flat)
    hi = max(flat)
    for j, g in enumerate(val["growth_axis"]):
        d.add(String(180 + j * 85, 201, f"{g:.0%}", fontSize=14, fillColor=INK))
    d.add(String(18, 201, "WACC / growth", fontSize=13, fillColor=INK))
    for i, w in enumerate(val["wacc_axis"]):
        y = 162 - i * 31
        d.add(String(40, y + 10, f"{w:.0%}", fontSize=14, fillColor=INK))
        for j, value in enumerate(matrix[i]):
            shade = 0.95 - 0.25 * (value - lo) / max(1, hi - lo)
            d.add(
                Rect(
                    130 + j * 95,
                    y,
                    90,
                    27,
                    fillColor=colors.Color(shade - 0.04, shade, shade - 0.02),
                    strokeColor=None,
                )
            )
            d.add(
                String(
                    173 + j * 95,
                    y + 9,
                    f"{value / 1000:,.1f}",
                    textAnchor="middle",
                    fontSize=14,
                    fillColor=INK,
                )
            )
    return d


def figures(data):
    model = data["model"]
    rows = {r["key"]: r["values"] for r in model["rows"]}
    years = model["columns"]
    history = data["history"]
    prices = [r["close"] for r in history["points"]]

    def average(n):
        return [sum(prices[max(0, i - n + 1) : i + 1]) / min(n, i + 1) for i in range(len(prices))]

    val = data["valuation"]
    return [
        (
            "price",
            "价格走势与均线",
            "历史日线与 20 / 50 日均线。"
            + ("图中历史行情为示例。" if history["mock"] else "按收盘价计算。"),
            lines(
                "Price and moving averages | USD",
                [r["time"][2:7] for r in history["points"]],
                [prices, average(20), average(50)],
                ["Close", "SMA 20", "SMA 50"],
            ),
        ),
        (
            "earnings",
            "收入与经营利润",
            "百万美元；A 为基期，E 为假设预测。",
            bars(
                "Revenue and EBITDA | USD million",
                years,
                [rows["revenue"], rows["ebitda"]],
                ["Revenue", "EBITDA"],
            ),
        ),
        (
            "margins",
            "盈利能力",
            "毛利率、EBITDA 利润率与净利率；A 为实际基期，E 为假设预测。",
            profitability_table(
                years,
                [
                    [v * 100 for v in rows[k]]
                    for k in ["gross_margin", "ebitda_margin", "net_margin"]
                ],
            ),
        ),
        (
            "cash",
            "现金流与再投资",
            "百万美元；区分净利润、资本开支与简化自由现金流。",
            bars(
                "Cash conversion and reinvestment | USD million",
                years,
                [rows["net_income"], rows["capex"], rows["fcf"]],
                ["Net income", "CapEx", "Free cash flow"],
            ),
        ),
        (
            "sensitivity",
            "估值敏感性",
            "不同折现率与永续增长率下的企业价值；非目标股价。",
            sensitivity(val),
        ),
        (
            "peers",
            "同业估值比较",
            "同业市盈率比较。"
            + (
                "部分指标为示例。"
                if any(p["mock"] for p in data["peers"])
                else "需结合业务与利润口径判断。"
            ),
            bars(
                "Peer valuation | P/E TTM",
                [p["symbol"] for p in data["peers"] if p.get("pe") is not None] or ["Unavailable"],
                [[p["pe"] for p in data["peers"] if p.get("pe") is not None] or [0]],
                ["P/E TTM"],
            ),
        ),
    ]


def web_figures(data):
    return [
        {
            "id": key,
            "title": title,
            "caption": caption,
            "url": "data:image/svg+xml;base64,"
            + base64.b64encode(renderSVG.drawToString(drawing).encode()).decode(),
        }
        for key, title, caption, drawing in figures(data)
    ]
