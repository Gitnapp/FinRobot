# 数据抽象层与 API 查漏补缺（2026-09-09）

## 调用方式

调用方只选择标的、数据集和指标，不选择供应商：

```text
GET /api/data/QCOM/metrics?fields=revenue,net_income,capex
GET /api/data/QCOM/company
GET /api/data/QCOM/prices
GET /api/data/QCOM/catalysts
GET /api/data/global/calendar?start=2026-08-01&end=2026-08-31
GET /api/data/capabilities
```

`metrics` 当前口径为最新年度报表。每个字段包含 value、unit、period、period_start、filed、provider、concept、source_url、status；派生值附 inputs/sources。缺失是 null，不是 0。金额在数据层保留原币绝对数，模型投影才统一除以一百万。

DataAccess 负责数据集分派与统一请求验证；FinancialData 是财务深模块：指标注册表、批量报表获取、标签与单位解析、年度筛选、修订版本选择、来源优先级、跨来源补值、派生计算、并发合并、超时和最近有效快照均留在模块内部。页面、财务卡片、经营证据、简单模型与研究任务均消费这一层。旧 FMP 单源财务方法及单独 SEC 卡片解析路径已经移除。

## 来源选择规则

- 美国：SEC → Finnhub 原样财报 → Yahoo 年度报表 → FMP 年度报表；缺失字段才需要后续来源，批量返回的字段一起复用。
- A股：公开年度报表（AKShare）→ Yahoo；日韩、港股、欧洲：Yahoo 年度报表。
- 同币种、同截止日、同年度期间才补值。季度不能补进年度，Yahoo 月末化日期不能直接当作 SEC 的实际财年截止日。
- 报告期以优先来源为锚；不会为凑完整率换成其他来源的另一个年度。
- 价格属于另一种一致性约束：报价和日线必须共用完整序列，不逐字段混用不同复权体系。
- EBITDA 按营业利润+D&A派生；基期净利润取披露值，基期自由现金流=经营现金流−资本开支。营运资金投入缺失时保留空值。
- 预测增长、税率、费用率及退出倍数仍是预测假设。ADR/ADS 股数和汇率未换算时不把原币普通股每股估值当成美元存托凭证目标价。

## 官方文档核查与集成结果

| 来源 | 官方文档提供的相关能力 | 实际接入与本次补齐 | 权限/口径边界 |
|---|---|---|---|
| [SEC](https://www.sec.gov/search-filings/edgar-application-programming-interfaces) | Company Facts、Company Concept、Submissions、历史分卷 | 本次把年度事实用于全部财务展示和模型，标准 US-GAAP/IFRS 标签，保留修订与原始申报出处；历史公告原有接入继续复用 | Company Facts 不含企业自定义标签；不能等同所有原报表字段都自动可得 |
| [Finnhub](https://finnhub.io/docs/api/financials-reported) | 原样财报、标准财务、指标、财报日程、新闻、经济日历 | 新增原样财报适配器复用指标解析，QCOM实测16份年报；现有指标/新闻/财报日程继续接入；PE/Beta可由Yahoo补值 | 经济日历实际返回 access_denied；没有将其冒充可用功能 |
| [FMP](https://site.financialmodelingprep.com/developer/docs/stable/income-statement) | 三大报表、原样财务、指标、估值、日历、新闻、分析师预测 | 将三表迁入年度报表适配器，不再作为唯一基期入口 | 抽查财务及经济日历返回 rate_limited；不是已证明没有套餐 |
| [Yahoo/yfinance](https://ranaroussi.github.io/yfinance/reference/api/yfinance.Ticker.html) | 历史行情、元数据、三表、财报日期、分析师估计 | 本次新增年度三表、市值、PE/Beta与财报日期适配；现有原币行情/完整日线复用 | 历史报表可能使用月末化截止日，不能跨日拼接；分析师估计未混入历史事实 |
| [AKShare](https://akshare.akfamily.xyz/data/stock/stock.html) | 中外行情、A股公开报表、巨潮公告、预约披露；宏观数据 | A股年度财务接入相同字段注册/派生层；原公告/CPI/PMI继续使用 | 预约披露是可补充的独立功能；与年报正式披露日不混同；公开抓取有可用性限制 |
| [巨潮](https://webapi.cninfo.com.cn/) | 公告、报表及结构化数据服务 | 当前使用AKShare公开公告查询与原文链接 | 商业结构化接口需要另行申请；目前不强制购买 |
| [TickFlow](https://docs.tickflow.org/zh-Hans/sdk/python-quickstart) | 中美港证券目录、K线、报价 | 行情和历史序列仍统一使用现有适配器 | 免费历史日线不等于实时行情；不提供公司三表 |
| [Twelve Data](https://twelvedata.com/docs/introduction/overview) | 日线、报价、三表、财报日程、分析师数据 | 已验证密钥和AAPL日线；能力在注册清单标明 | 日韩请求需Pro/Venture，欧洲需Grow/Venture；未擅自切换已可用Yahoo来源，也未购买套餐 |
| [FRED](https://fred.stlouisfed.org/docs/api/fred/) | 宏观序列、观测修订、发布日历 | 现有宏观序列通过统一入口；历史观测完整保留 | 发布日期不包含市场预期，不作为财经日历数值的替代 |
| [JBlanked](https://www.jblanked.com/news/api/docs/calendar/) | 今日、本周、日期范围日历；MQL5/Forex Factory/FxStreet | 本次补上范围请求，并保持缺失/零值/待公布区分 | 最新401正文为“没有credits”，不是密钥失效；免费文档配额为1请求/日，具体端点当前要求credits |
| [Adanos](https://api.adanos.org/docs) | Reddit、X、新闻、Polymarket、文本情绪分析 | 已阅读官方OpenAPI；当前散户情绪为Reddit样本，统一入口消费 | 不把X/新闻/预测市场结果混成同一个Reddit缺失字段；非同一调查总体 |
| [Tavily](https://docs.tavily.com/documentation/api-reference/endpoint/search) | 搜索、网页证据、内容提取 | 已接研究线索入口，保留URL和摘录 | 不能把网页摘录或LLM回答变成已核实财务字段 |
| [Exa](https://exa.ai/docs/reference/search) | 搜索、正文内容检索 | 新增研究线索适配器，Tavily不可用时尝试已有Exa配置 | 同上；仍标识为线索，不参与财务数字自动填充 |

“官方有此功能”与“当前账号可调用”分别记录。文档中的未使用能力不自动成为当前产品功能，权限受限的接口不会包装为已接通。

## 实际验证

- 51个跟踪证券均取得年度财务快照，每个有17–26个有效指标（其余为null），覆盖USD/CNY/HKD/TWD/KRW/JPY/EUR，未统一伪装成美元。
- QCOM 2025-09-28：营收442.84亿美元、营业成本197.38亿美元、营业利润123.55亿美元、净利润55.41亿美元、经营现金流140.12亿美元、D&A16.02亿美元、资本开支11.92亿美元。
- QCOM派生EBITDA139.57亿美元、FCF128.20亿美元、总债务148.11亿美元、净债务92.91亿美元，摊薄股数11.05亿股。
- 上述QCOM关键事实全部来自SEC；资本开支标签为PaymentsToAcquireProductiveAssets，与[原年报现金流量表](https://www.sec.gov/Archives/edgar/data/804328/000080432825000085/qcom-20250928.htm)的Capital expenditures一致。
- 已测试：并发请求只批量取一次、跨币种/跨期间拒绝、缺失字段跨来源补齐、修订值选择、真实零债务保留、基期利润与FCF不被模型反推覆盖。

字段代码与所有候选标签见 `financial_data/registry.py`；接口运行时清单见 `/api/data/capabilities`。

## 保留的事实边界
年度财务仅按同一报表期补值；不能把Yahoo的季度增长率填成Finnhub的TTM增长率。市场指标中的Beta、PE、市值与年度报表指标分开读取。市值保留其市场时间戳，历史收盘价仍来自完整价格序列。

## 后台财务更新（2026-09-09）

- 应用启动时独立运行 `FinancialData.run()`，每分钟扫描全部启用的持续跟踪标的，不依赖页面访问，也不等待研报生成完成。
- 财务快照按标的的每日／每周设置到期；成功时间、到期时间及失败重试时间保存在 SQLite，服务重启后补跑到期项。将每周改成每日时，已有快照立即按较短周期检查。
- 后台和前台共用相同请求合并、8路并发上限、40秒请求预算和失败退避。上游失败15分钟后重试，不把失败写成零值或清空最近有效报表；旧财务快照最多保留可读366天，并明确标记过期。
- 暂停跟踪后不再后台刷新；新加入的标的在下一次扫描时自动纳入。显式访问详情仍可读取和刷新其数据。
- 更新只写财务事实快照，不改预测假设、AI推荐或用户覆盖值。AI推荐仍按原跟踪任务更新，用户覆盖值持续优先。
- 本地后台自动更新要求应用服务运行。电脑休眠／服务停止期间不会拉取；恢复后自动检查到期数据。
- `/api/health` 的 `financial_scheduler` 和 `financial_last_tick` 用于检查财务调度器存活及最近扫描时间。

## 港股散户情绪（2026-09-09 更正）

Adanos 的股票目录包含 HKEX，不能以非美股为由排除港股。已移除港股拦截；港股代码在适配器内转成 Adanos 的四位数字标识（例如 00700.HK → 0700），外部统一接口仍使用原始证券代码，并严格检查响应标识。腾讯、小米官方搜索结果均为 HKEX，非借用其美股 ADR 情绪。实际统计总体仍是 Reddit 最近7个UTC自然日讨论，不代表所有香港散户。支持但无样本的响应 found=false 保留为空，不产生零分。

## 分项折旧摊销（2026-09-09）

增加 OtherDepreciationAndAmortization 与 AdjustmentForAmortization 两个标准现金流量表分项。已有合计值时优先使用合计；合计缺失且两项期间、币种匹配时才相加，任一缺失则保持空值。AMD 2025 年现金流量表分别披露 750 百万美元和 2,254 百万美元，D&A 合计 3,004；营业利润 3,694，按本项目营业利润+D&A口径得到 EBITDA 6,698 百万美元。此值不是公司调整后 EBITDA。来源：https://ir.amd.com/financial-information/sec-filings/content/0000002488-26-000018/amd-20251227.htm

## 行情源切换

主源无法取得有效报价或完整日线时，行情模块整体切换至Yahoo。报价与完整日线共用成对缓存和并发请求，切换成功后持久记录所选来源，重启后保持，避免复权口径反复切换。所有来源失败时保留有限期限内的上次有效数据。00470.HK 实测报价与日线末值均为27.66 HKD，截至2026-09-08。

## 详情接口与市场能力（2026-09-09）

- 详情读取统一为 `/api/data/{symbol}/detail?context=stocks|coverage`；模型为 `model?scenario=base|bull|bear`，推荐假设为 `assumptions`，报告内容为 `report?report_id=...`。行情、财务、同业、情绪、日历继续使用该统一入口。
- 原 `/api/assets/{symbol}`、`/api/coverage/{symbol}`、`/api/models/{symbol}` 和模型 assumptions 的重复 GET 实现已删除；PUT/DELETE 等业务命令和下载导出保留，并调用领域模块。
- 移除估值、跟踪模型初始化和研报生成的非美股禁用分支。功能依据数据可用性判断，估值使用原财务币种；模型缺失输入不会填假事实。
- 情绪通过Adanos目录核验代码和交易所；完整证券代码也可作为身份依据。Euronext附加国家核验，不能将荷兰上市股票与美国ADR混用。
- 51/51 标的均已通过统一详情接口取得模型与估值。情绪核验：28 ready、17 empty、6 asset_not_supported；未支持项为688795.SH、688802.SH、00522.HK、01024.HK、688836.SH、BESI.AS。样本不足与市场禁止不混为一谈。
