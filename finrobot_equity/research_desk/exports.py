"""Investment research spreads: the original FinRobot equal-column geometry."""

import csv
import html
import io
import json
from datetime import datetime
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from finrobot_equity.core.src.modules.professional_pdf_report import Layout

from .charts import figures, web_figures

SUMMARY_KEYS = {
    "revenue",
    "growth",
    "gross_margin",
    "ebitda",
    "ebitda_margin",
    "net_income",
    "net_margin",
    "capex",
    "fcf",
}
SPREADS = [(0, None), (1, 2), (3, 4), (5, 6), (7, 8), (9, 10), (11, None)]
FIGURE_FOR = {0: "price", 2: "peers", 3: "earnings", 4: "margins", 5: "cash", 6: "sensitivity"}


def report_date(payload):
    return (
        datetime.fromisoformat(payload["created_at"].replace("Z", "+00:00"))
        .astimezone()
        .date()
        .isoformat()
    )


def formatted(value, kind, currency="USD"):
    if value is None:
        return "—"
    if kind == "percent":
        return f"{value * 100:.1f}%"
    if kind == "price":
        return f"{currency} {value:,.2f}"
    if kind == "multiple":
        return f"{value:.1f}x"
    return f"{value:,.1f}"


def table_data(model, summary=False):
    return [["行项目", *model["columns"]]] + [
        [
            r["label"],
            *[formatted(v, r["format"], model.get("currency", "USD")) for v in r["values"]],
        ]
        for r in model["rows"]
        if not summary or r["key"] in SUMMARY_KEYS
    ]


def assumption_text(model):
    labels = {
        "growth": "收入增速",
        "gross_margin": "毛利率",
        "opex_ratio": "经营费用率",
        "tax_rate": "所得税率",
        "da_ratio": "折旧摊销率",
        "capex_ratio": "资本开支率",
        "nwc_ratio": "增量营运资金率",
        "exit_multiple": "估值倍数",
        "share_growth": "股数年变动率",
    }
    return "；".join(
        f"{labels[k]} {formatted(v, 'multiple' if k == 'exit_multiple' else 'percent')}"
        for k, v in model["assumptions"].items()
    )


def markdown(p):
    blocks = [
        f"# {p['symbol']} 股票研究",
        report_date(p),
        "预测基于示例财务数据" if p["has_mock_data"] else "股票研究报告",
    ]
    for s in p["sections"]:
        blocks += ["## " + s["title"], s["content"]]
    table = table_data(p["model"], True)
    blocks += [
        f"## 财务预测 · 百万 {p['model'].get('currency', 'USD')}",
        " | ".join(table[0]),
        " | ".join(["---"] * 5),
        *[" | ".join(row) for row in table[1:]],
        assumption_text(p["model"]),
        "## 来源",
    ]
    blocks += [
        f"[{i}] {s['label']} / {s['as_of']} / " + ("示例数据" if s["mock"] else s["url"])
        for i, s in enumerate(p["sources"], 1)
    ]
    return "\n\n".join(blocks)


def html_report(p):
    esc = html.escape

    def section(i):
        s = p["sections"][i]
        return f"<h2>{esc(s['title'])}</h2>" + "".join(
            f"<p>{esc(t)}</p>" for t in s["content"].split("\n") if t.strip()
        )

    def figure(i):
        key = FIGURE_FOR.get(i)
        f = next((f for f in p["charts"] if f["id"] == key), None)
        return (
            f'<figure><img src="{f["url"]}" alt="{esc(f["title"])}"><figcaption>{esc(f["caption"])}</figcaption></figure>'
            if f
            else ""
        )

    quote = p["quote"]
    val = p["valuation"]
    facts = f"<h2>市场与估值</h2><dl><dt>最近收盘价</dt><dd>{quote.get('currency', 'USD')} {quote['price']:,.2f}</dd><dt>市值</dt><dd>{(quote['market_cap'] or 0) / 1e9:,.2f} 十亿 {quote.get('currency', 'USD')}</dd><dt>现金流折现企业价值</dt><dd>{val['enterprise_value']:,.0f} 百万 {p['model'].get('currency', 'USD')}</dd><dt>折现率 / 永续增长率</dt><dd>{val['wacc']:.0%} / {val['terminal_growth']:.0%}</dd></dl><p class='note'>企业价值测算未扣净债务，不能解读为目标股价。</p>"
    sources = "<h2>来源索引</h2>" + "".join(
        f"<p class='reference'>[{i}] {esc(s['label'])}<br><small>{esc(str(s['as_of']))}</small><br>"
        + ("示例输入" if s["mock"] else f'<a href="{esc(s["url"], quote=True)}">查看原始来源</a>')
        + "</p>"
        for i, s in enumerate(p["sources"], 1)
    )
    content = ""
    for left, right in SPREADS:
        left_body = section(left)
        right_body = section(right) if right is not None else (facts if left == 0 else sources)
        if left == 0:
            right_body = figure(0) + right_body
        else:
            left_body += figure(left)
            if right is not None:
                right_body += figure(right)
        content += (
            f'<article class="spread"><div>{left_body}</div><div>{right_body}</div></article>'
        )
    table = table_data(p["model"], True)
    table_html = "".join(
        "<tr>"
        + "".join(f"<{'th' if i == 0 else 'td'}>{esc(c)}</{'th' if i == 0 else 'td'}>" for c in row)
        + "</tr>"
        for i, row in enumerate(table)
    )
    return f"""<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{p["symbol"]} 股票研究</title><style>
    *{{box-sizing:border-box}}body{{font:14px/1.85 system-ui,sans-serif;color:#25332e;background:#f0f3f1;margin:0}}main{{max-width:1080px;background:white;padding:48px 52px;margin:32px auto}}header{{border-top:4px solid #344942;border-bottom:1px solid #aebdb6;padding:22px 0;margin-bottom:28px}}header .meta{{display:flex;justify-content:space-between;font-size:12px;color:#687c71}}h1{{font-size:34px;font-weight:500;margin:16px 0 5px}}h2{{font-size:18px;font-weight:600;border-bottom:1px solid #dbe2de;padding-bottom:10px;margin:0 0 16px}}p{{margin:0 0 16px;text-align:justify}}.spread{{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:32px;padding:26px 0;border-bottom:1px solid #dbe2de;break-after:page}}.spread>div+div{{border-left:1px solid #e2e7e4;padding-left:28px}}figure{{margin:24px 0 12px}}img{{width:100%;display:block}}figcaption,.note,small{{color:#6c7e74;font-size:11px}}dl{{display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:12px}}dd{{text-align:right;margin:0;font-variant-numeric:tabular-nums}}table{{width:100%;border-collapse:collapse;font-size:12px;font-variant-numeric:tabular-nums}}th,td{{text-align:right;padding:10px;border-bottom:1px solid #dce3df}}td:first-child,th:first-child{{text-align:left}}th{{background:#eef2ef}}.financial{{margin-top:30px}}.reference{{font-size:12px;overflow-wrap:anywhere}}a{{color:#34584a}}.quality{{font-size:12px;color:#846d41}}@media(max-width:750px){{main{{padding:24px;margin:0}}.spread{{grid-template-columns:1fr}}.spread>div+div{{border:0;padding:0}}}}@media print{{body{{background:white}}main{{margin:0;padding:0;max-width:none}}@page{{size:A4;margin:18mm}}.spread{{gap:8mm;break-inside:auto}}h2{{break-after:avoid}}figure{{break-inside:avoid}}}}
    </style><main><header><div class="meta"><span>Garage Research · 股票研究</span><span>{report_date(p)}</span></div><h1>{p["quote"]["name"]} / {p["symbol"]}</h1><div>{esc(p["quote"]["sector"])} · 基本面与估值</div><div class="quality">{"预测基于示例财务数据" if p["has_mock_data"] else "数据口径与来源见附录"}</div></header>{content}<section class="financial"><h2>财务预测 / 百万 {p["model"].get("currency", "USD")}</h2><table>{table_html}</table><p class="note">{esc(assumption_text(p["model"]))}</p></section></main></html>"""


def pdf_report(p, destination):
    pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
    ink = colors.HexColor("#273c32")
    muted = colors.HexColor("#6b7a70")
    rule = colors.HexColor("#dbe3de")
    body = ParagraphStyle(
        "Body",
        fontName="STSong-Light",
        fontSize=9,
        leading=13,
        wordWrap="CJK",
        textColor=ink,
        spaceAfter=7,
    )
    head = ParagraphStyle(
        "Heading", parent=body, fontSize=14, leading=21, spaceAfter=12, keepWithNext=True
    )
    small = ParagraphStyle("Small", parent=body, fontSize=8, leading=12, textColor=muted)
    title = ParagraphStyle("Title", parent=head, fontSize=25, leading=32)

    def esc(s):
        return html.escape(str(s).replace("·", " / "))

    charts = {key: (drawing, caption) for key, _, caption, drawing in figures(p)}

    def graphic(i):
        key = FIGURE_FOR.get(i)
        if key not in charts:
            return []
        drawing, caption = charts[key]
        factor = Layout.COL_WIDTH / drawing.width
        drawing.scale(factor, factor)
        drawing.width *= factor
        drawing.height *= factor
        return [Spacer(1, 10), drawing, Paragraph(esc(caption), small)]

    class SectionOpening(Paragraph):
        # Table cell splitting does not honor a heading's keepWithNext. Keep the
        # title and its first complete sentence as one indivisible opening block.
        def split(self, availWidth, availHeight):
            return []

    def section(i):
        s = p["sections"][i]
        paragraphs = [t for t in s["content"].split("\n") if t.strip()]
        first = paragraphs.pop(0)
        stop = first.find("。")
        opening = first[: stop + 1] if stop >= 0 else first
        remainder = first[stop + 1 :] if stop >= 0 else ""
        if remainder.strip():
            paragraphs.insert(0, remainder)
        return [
            SectionOpening(
                '<font size="14">' + esc(s["title"]) + "</font><br/><br/>" + esc(opening), body
            )
        ] + [Paragraph(esc(t), body) for t in paragraphs]

    def spread(left, right):
        t = Table(
            [[left, "", right]],
            colWidths=[Layout.COL_WIDTH, Layout.COL_GAP, Layout.COL_WIDTH],
            splitInRow=1,
            hAlign="LEFT",
        )
        t.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ]
            )
        )
        return t

    q = p["quote"]
    val = p["valuation"]
    facts = [Paragraph("市场与估值", head)]
    for k, v in [
        ("最近收盘价", f"{q.get('currency', 'USD')} {q['price']:,.2f}"),
        ("市值", f"{(q['market_cap'] or 0) / 1e9:,.2f} 十亿 {q.get('currency', 'USD')}"),
        (
            "DCF 企业价值",
            f"{val['enterprise_value']:,.0f} 百万 {p['model'].get('currency', 'USD')}",
        ),
        ("折现率 / 永续增长率", f"{val['wacc']:.0%} / {val['terminal_growth']:.0%}"),
    ]:
        facts += [Paragraph(esc(k + "：" + v), body)]
    facts += [Paragraph("企业价值未扣净债务；假设测算不是目标股价。", small)]
    sources = [Paragraph("来源索引", head)]
    for i, s in enumerate(p["sources"], 1):
        link = (
            "示例输入"
            if s["mock"]
            else f'<link href="{html.escape(s["url"], quote=True)}" color="#34584a">查看原始来源</link>'
        )
        sources += [
            Paragraph(esc(f"[{i}] {s['label']}"), body),
            Paragraph(esc(s["as_of"]) + " / " + link, small),
            Spacer(1, 10),
        ]
    story = [
        Paragraph(esc(q["name"] + " / " + p["symbol"]), title),
        Paragraph(
            "股票研究 / "
            + esc(report_date(p))
            + " / "
            + ("预测基于示例财务数据" if p["has_mock_data"] else "口径与出处见附录"),
            small,
        ),
        Spacer(1, 20),
    ]
    for count, (left, right) in enumerate(SPREADS):
        if count == 1:
            story.append(PageBreak())
        elif count:
            story.append(Spacer(1, 24))
        a = section(left)
        b = section(right) if right is not None else (graphic(0) + facts if left == 0 else sources)
        if left != 0:
            a += graphic(left)
            if right is not None:
                b += graphic(right)
        story.append(spread(a, b))
    story += [
        Spacer(1, 24),
        Paragraph(f"财务预测 / 百万 {p['model'].get('currency', 'USD')}", head),
    ]
    table = Table(
        [[Paragraph(esc(c), small) for c in row] for row in table_data(p["model"], True)],
        colWidths=[155] + [(Layout.CONTENT_WIDTH - 155) / 4] * 4,
        repeatRows=1,
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#edf2ef")),
                ("LINEBELOW", (0, 0), (-1, -1), 0.35, rule),
                ("TOPPADDING", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
            ]
        )
    )
    story += [
        table,
        Spacer(1, 20),
        Paragraph("模型假设", head),
        Paragraph(esc(assumption_text(p["model"])), body),
    ]

    def furniture(canvas, doc):
        canvas.setStrokeColor(rule)
        canvas.line(
            Layout.MARGIN_LEFT,
            Layout.PAGE_HEIGHT - 30,
            Layout.PAGE_WIDTH - Layout.MARGIN_RIGHT,
            Layout.PAGE_HEIGHT - 30,
        )
        canvas.setFont("STSong-Light", 8)
        canvas.setFillColor(muted)
        canvas.drawString(
            Layout.MARGIN_LEFT, Layout.PAGE_HEIGHT - 22, "Garage Research / " + p["symbol"]
        )
        canvas.drawRightString(
            Layout.PAGE_WIDTH - Layout.MARGIN_RIGHT, 22, f"{report_date(p)} / {doc.page}"
        )

    SimpleDocTemplate(
        str(destination),
        pagesize=(Layout.PAGE_WIDTH, Layout.PAGE_HEIGHT),
        leftMargin=Layout.MARGIN_LEFT,
        rightMargin=Layout.MARGIN_RIGHT,
        topMargin=48,
        bottomMargin=42,
        title=p["symbol"] + " 股票研究",
        author="Garage Research",
    ).build(story, onFirstPage=furniture, onLaterPages=furniture)


def export_files(p, directory):
    p["charts"] = web_figures(p)
    root = Path(directory)
    root.mkdir(exist_ok=True)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([p["symbol"], p["model"].get("currency", "USD") + " million"])
    writer.writerows(table_data(p["model"], True))
    content = {
        "md": markdown(p),
        "html": html_report(p),
        "json": json.dumps(p, ensure_ascii=False, indent=2),
        "csv": "\ufeff" + buf.getvalue(),
    }
    for ext, value in content.items():
        temp = root / f"report.{ext}.tmp"
        temp.write_text(value, encoding="utf-8")
        temp.replace(root / f"report.{ext}")
    pdf_report(p, root / "report.pdf.tmp")
    (root / "report.pdf.tmp").replace(root / "report.pdf")
