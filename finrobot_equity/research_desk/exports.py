import csv
import html
import io
import json
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


def formatted(value, kind):
    if value is None:
        return "—"
    if kind == "percent":
        return f"{value * 100:.1f}%"
    if kind == "multiple":
        return f"{value:.1f}x"
    return f"{value:,.1f}"


def table_data(model):
    return [["行项目", *model["columns"]]] + [
        [row["label"], *[formatted(v, row["format"]) for v in row["values"]]]
        for row in model["rows"]
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
        "exit_multiple": "退出倍数",
    }
    return "；".join(
        f"{labels[k]} {formatted(v, 'multiple' if k == 'exit_multiple' else 'percent')}"
        for k, v in model["assumptions"].items()
    )


def markdown(payload):
    title = f"{payload['symbol']} · 研究报告 v{payload['version']}"
    model = payload["model"]
    marker = "含模拟数据 · 待核实" if payload["has_mock_data"] else "数据来源见附录"
    blocks = [f"# {title}", f"{payload['created_at']} | {payload['engine']} | {marker}"]
    for section in payload["sections"]:
        blocks += [f"## {section['title']}", section["content"]]
    table = table_data(model)
    blocks += [
        "## 20 行预测模型",
        f"单位：百万美元 · {model['source']}",
        " | ".join(table[0]),
        " | ".join(["---"] * 5),
    ]
    blocks += [" | ".join(row) for row in table[1:]]
    blocks += ["\n### 假设", assumption_text(model), "\n### 来源"]
    blocks += [
        f"[{i}] {s['label']} · {s['as_of']} · "
        + ("模拟数据，无外部事实依据" if s["mock"] else s["url"])
        for i, s in enumerate(payload["sources"], 1)
    ]
    return "\n\n".join(blocks)


def html_report(payload):
    esc = html.escape
    table = table_data(payload["model"])
    sections = "".join(
        f"<section><h2>{esc(s['title'])}</h2><p>{esc(s['content']).replace(chr(10), '<br>')}</p></section>"
        for s in payload["sections"]
    )
    rows = "".join(
        "<tr>"
        + "".join(f"<{'th' if i == 0 else 'td'}>{esc(c)}</{'th' if i == 0 else 'td'}>" for c in row)
        + "</tr>"
        for i, row in enumerate(table)
    )
    sources = "".join(
        f"<li>{esc(s['label'])} · {esc(str(s['as_of']))} · "
        + ("模拟数据" if s["mock"] else f'<a href="{esc(s["url"], quote=True)}">原始来源</a>')
        + "</li>"
        for s in payload["sources"]
    )
    return f"""<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{esc(payload["symbol"])} Research v{payload["version"]}</title>
<style>body{{font:15px/1.85 system-ui,sans-serif;color:#222;max-width:860px;margin:60px auto;padding:0 28px}}h1{{font-size:30px}}h2{{font-size:19px;margin-top:34px}}header{{border-bottom:2px solid #222;padding-bottom:24px}}small{{color:#666}}table{{border-collapse:collapse;width:100%;font-size:12px;font-variant-numeric:tabular-nums}}td,th{{padding:9px;border-bottom:1px solid #ddd;text-align:right}}td:first-child,th:first-child{{text-align:left}}a{{color:inherit}}section{{break-inside:avoid}}@media print{{body{{margin:16px auto}}}}</style>
<header><small>GARAGE / FINROBOT RESEARCH</small><h1>{esc(payload["symbol"])} · 研究报告 v{payload["version"]}</h1><small>{esc(payload["created_at"])} · {esc(payload["engine"])}</small><p>{"含模拟数据 · 待核实，不能用于真实投资判断" if payload["has_mock_data"] else "研究快照 · 数据时点与来源见附录"}</p></header>{sections}<h2>20 行预测模型</h2><p>百万美元 · {esc(payload["model"]["source"])}</p><table>{rows}</table><h2>模型假设</h2><p>{esc(assumption_text(payload["model"]))}</p><h2>来源</h2><ol>{sources}</ol></html>"""


def pdf_report(payload, destination):
    pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
    body = ParagraphStyle(
        "Body",
        fontName="STSong-Light",
        fontSize=10,
        leading=17,
        wordWrap="CJK",
        alignment=TA_LEFT,
    )
    heading = ParagraphStyle(
        "Heading",
        parent=body,
        fontSize=15,
        leading=22,
        spaceBefore=18,
        spaceAfter=8,
        keepWithNext=True,
    )
    title = ParagraphStyle("Title", parent=body, fontSize=24, leading=30, spaceAfter=18)

    def safe(text):
        # STSong's standard CID map lacks the Latin middle-dot glyph.
        return html.escape(text.replace("·", " / "))

    parts = [
        Paragraph(f"{payload['symbol']} / 研究报告 v{payload['version']}", title),
        Paragraph(safe(payload["engine"] + " / " + payload["created_at"]), body),
        Spacer(1, 12),
        Paragraph(
            "含模拟数据 / 待核实" if payload["has_mock_data"] else "研究快照 / 来源见附录",
            body,
        ),
    ]
    for s in payload["sections"]:
        parts += [
            Paragraph(s["title"], heading),
            Paragraph(safe(s["content"]).replace("\n", "<br/>"), body),
        ]
    parts += [
        PageBreak(),
        Paragraph("20 行预测模型 / 百万美元", heading),
        Paragraph(safe(payload["model"]["source"]), body),
        Spacer(1, 12),
    ]
    data = table_data(payload["model"])
    data = [
        [
            Paragraph(
                html.escape(c),
                ParagraphStyle("Cell", parent=body, fontSize=8, leading=11),
            )
            for c in row
        ]
        for row in data
    ]
    table = Table(data, colWidths=[177, 79, 79, 79, 79], repeatRows=1, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#ededed")),
                ("LINEBELOW", (0, 0), (-1, -1), 0.3, colors.HexColor("#dddddd")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    parts.append(table)
    parts += [
        Paragraph("模型假设", heading),
        Paragraph(assumption_text(payload["model"]), body),
        PageBreak(),
        Paragraph("来源索引", heading),
    ]
    for i, s in enumerate(payload["sources"], 1):
        link = (
            "模拟数据，无外部事实依据"
            if s["mock"]
            else f'<link href="{html.escape(s["url"], quote=True)}" color="#335577">查看原始来源</link>'
        )
        parts += [
            Spacer(1, 12),
            Paragraph(safe(f"[{i}] {s['label']}"), body),
            Paragraph(safe(str(s["as_of"])) + " / " + link, body),
        ]

    def footer(canvas, doc):
        canvas.setFont("STSong-Light", 8)
        canvas.drawString(50, 25, "Garage Research / FinRobot")
        canvas.drawRightString(A4[0] - 50, 25, str(doc.page))

    SimpleDocTemplate(
        str(destination),
        title=f"{payload['symbol']} Research v{payload['version']}",
        author="Garage Research / FinRobot",
        pagesize=A4,
        rightMargin=50,
        leftMargin=50,
        topMargin=44,
        bottomMargin=48,
    ).build(parts, onFirstPage=footer, onLaterPages=footer)


def export_files(payload, directory):
    root = Path(directory)
    root.mkdir(exist_ok=True)
    content = {
        "md": markdown(payload),
        "html": html_report(payload),
        "json": json.dumps(payload, ensure_ascii=False, indent=2),
    }
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        [
            "symbol",
            payload["symbol"],
            "unit",
            "USD million",
            "source",
            payload["model"]["source"],
        ]
    )
    writer.writerows(table_data(payload["model"]))
    writer.writerow(["assumptions", json.dumps(payload["model"]["assumptions"])])
    content["csv"] = "\ufeff" + buf.getvalue()
    for extension, value in content.items():
        temp = root / f"report.{extension}.tmp"
        temp.write_text(value, encoding="utf-8")
        temp.replace(root / f"report.{extension}")
    pdf_report(payload, root / "report.pdf.tmp")
    (root / "report.pdf.tmp").replace(root / "report.pdf")
