# Garage Research Desk

FinRobot 的本地单用户投研工作台。MVP 聚焦自选行情、研究报告、Coverage 与 20 行预测模型。旧 Jinja Web 应用已移除，`run_web_app.py` 是新工作台唯一入口。

## 启动

需要 Node 24、pnpm 11.12.0、Python 3.12、uv；真实数据模式需要已登录 Infisical。

```bash
make setup
make build
make start
```

打开 http://127.0.0.1:8001。`make start` 通过仓库现有 `.infisical.json` 注入 dev 环境密钥，不生成本地密钥文件。无密钥可 `make demo`，首次启动会选用演示研究；已有工作空间请在模型设置中明确选择演示引擎。开发时后端照常启动，另运行 `make dev` 打开 http://127.0.0.1:5178。

## 功能

- 自选标的：添加、筛选、移除；行情、价格日线 / K 线与来源时间分别展示。
- Research：输入研究重点，后台生成 8 章报告；状态可观察，失败可重试。真实模型失败保留失败任务，不伪造成功报告。
- 报告库：保存所有版本与输入快照；下载 PDF、HTML、Markdown、JSON 与预测模型 CSV。
- Coverage：加入即排期首次研究，此后每日 / 每周生成报告；可暂停、恢复、修改频率、移出。手动与定时任务共享队列，同一标的只允许一个未结束任务。
- 预测模型：基期 + 三年、20 行，包含收入、利润、CapEx、营运资金、FCF、退出 EV；支持 3 种情景与 8 个假设参数。CSV 导出和报告使用同一计算函数。
- 模型设置：参考 ValueCell 的服务商 → API endpoint → 模型组织；支持当前 OpenAI-compatible / SiliconFlow / Kimi 与本地演示引擎。API Key 只在后端。

## 数据与计算边界

- Finnhub 用于报价、公司市值与新闻；FMP 用于年报和历史价格。请求缓存减少免费额度使用，429 后冷却 15 分钟。原始服务报错和带密钥的 URL 不返回前端或写入应用日志。
- 接口不可用或套餐受限时，使用固定种子的模拟数据并明确标注。模拟行情时间固定在 2026-09-04；财务模拟基期固定在 2025 年。不会生成假新闻。
- USD 为唯一财务计价币种；非 USD 报表不混入模型。未验证的自定义代码可能只显示模拟行情。
- 行 6 包含 SG&A、研发等经营费用并剔除 D&A，避免重复扣减。模型省略非经营损益。FCF = 净利润 + D&A − CapEx − 营运资金变动，为简化股权现金流，非完整 FCFF。
- EV = 末年 EBITDA × 退出倍数，是末年未折现企业价值，不是当前股权价值或目标股价。亏损 EBITDA 不计算退出 EV。
- 模拟财务输入对应的报告标记“待核实”。研究文本与确定性模型分开，人工修改假设不会改写已有报告。
- Tavily / Exa 的密钥状态可查看，MVP 尚未启用其搜索调用。

## 实现组织

```
frontend/src/
  app/{market,coverage,reports,settings}/   业务页面
  components/                              通用业务组件
  api/ hooks/ types/                       API、查询和类型
packages/{ui,design-tokens,web-shell}/      Rational UI 原样源码快照
finrobot_equity/research_desk/
  main.py schemas.py                       HTTP 边界、验证
  store.py jobs.py                          SQLite、队列、调度
  market.py                                数据源、缓存、模拟标记
  model.py                                 纯计算预测模型
  research.py exports.py                    FinRobot 章节编排、LLM、文件
```

FinRobot 现有 `financial_data_processor.extract_historical_metrics_from_api_data` 负责 FMP 收入归一化，`ReportStructureManager` 负责章节与结构校验。原 FinRobot 库和教程保留用于研究参考；旧 Web UI 已删除。前端复用 Garage dashboard 所采用的 Lightweight Charts 日线 / K 线设计，前端模块组织参考 ValueCell。Rational UI 上游版本见 `packages/RATIONAL_UI.md`，不依赖兄弟目录才能构建。

## 运行与验证

数据默认存于 `.desk/research.sqlite3` 和 `.desk/reports/<id>/`，可用 `DESK_DATA_DIR` 指向独立持久目录。**本地单进程**运行，勿使用多个 Uvicorn worker；SQLite 队列持久化，启动将中断的运行标记为失败、继续处理排队任务，并补跑到期 Coverage 一次。电脑休眠 / 服务关闭期间不运行，恢复后处理到期项，不追补每个错过周期。暂停只影响后续调度，已经运行的报告继续生成。

```bash
make test
make build
```

自动化测试覆盖公式一致性、情景、非法参数、并发去重、报告文件、快照不可变、调度、暂停、重启中断恢复、API 验证和模型失败。浏览器验收记录见 `QA.md`。

Dockerfile 提供构建入口，容器启动应仅映射本机地址 `-p 127.0.0.1:8001:8001` 并挂载 `/data`。本 MVP 没有多用户登录，不能直接作为公网服务部署。本次未进行云部署。

参考文档：[FastAPI lifespan](https://fastapi.tiangolo.com/advanced/events/)、[Lightweight Charts](https://tradingview.github.io/lightweight-charts/docs)、[Model Studio Qwen 思考模式](https://www.alibabacloud.com/help/en/model-studio/deep-thinking)。
