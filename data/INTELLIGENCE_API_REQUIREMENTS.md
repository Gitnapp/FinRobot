# 新数据源配置与仍缺失的数据

## 当前实测

- AKShare已安装，版本锁定在 requirements-desk.lock。中国制造业PMI已取得2026-08观测值49.8，中国CPI同比已取得2026-07观测值0.5%。来源通道为AKShare/东方财富；这些观测期不等于抓取当天。
- 国家统计局当前网络请求返回403，未绕过访问控制，接口已纳入后台隔离与冷却。不可声称已获得统计局直连数据。
- FRED、JBlanked及Tavily凭证已配置并实测成功：4组美国宏观序列、8个日历事件、5条NVDA资料线索。
- SEC EDGAR联系标识已配置。AAPL和NVDA真实年度数据已取得，期间分别为2025-09-27和2026-01-25，均包含财报原文。无需额外SEC API key。

## 已配置与剩余访问条件

| 配置 | 用途 | 开通说明 |
|---|---|---|
| `FRED_API_KEY` | 政策利率、国债收益率、期限利差、失业率；后续可扩展M2、实际利率、信用利差 | FRED个人账户申请key；https://fred.stlouisfed.org/docs/api/api_key.html |
| `JBLANKED_API_KEY` | 本周宏观数据发布、预期/前值/实际、事件重要性 | 官方目前免费额度1请求/天，本模块按天缓存；https://www.jblanked.com/news/api/docs/calendar/ |
| `SEC_USER_AGENT` | EDGAR fair-access合规标识 | 不是密码：填写真实应用/机构名称及联系邮箱；https://www.sec.gov/about/webmaster-frequently-asked-questions |
| 国家统计局合法访问条件 | 官方原始中国宏观序列 | 无需臆造key；需要该服务允许访问的部署环境、官方导出文件或正式授权通道，当前403不能靠填key解决 |

将配置放在项目 `.env` 后重启服务。配置缺失的冷却在重启时重置；不会输出密钥到前端。

## 有必要但当前仍缺失

1. **AI业务/分部收入、付费客户、NRR、留存、CAC/LTV**：优先公司业绩会/IR材料和年报；可以补 `TAVILY_API_KEY` 或 `EXA_API_KEY` 做发现，但检索API不保证这些指标存在，也不能代替原始披露。
2. **分析师预期、前瞻PE、收入和EPS一致预期**：需FMP相应权限或其他有授权的一致预期接口。当前FMP部分公司财报返回402，现有key覆盖不足仍需解决。
3. **A/H财报与分部、债务附注**：TickFlow免费行情不包括完整研究所需财报。可补Tushare相应权限或授权财报源，并实现本币财务模型；不能直接当美元使用。
4. **私营公司融资估值/经营披露**：公司公告、融资资料及授权数据库；不建议为缺失的私营财务填假数。Crunchbase/Dealroom等商业数据是否值得采购应按实际公司覆盖再核查。
5. **持仓、成本、资金期限、可承受回撤和计划比例**：需要用户自己的券商API/CSV或手动输入；外部宏观API不能代替。这是“投资计划/复盘节奏”页的前置数据。
6. **高频行业供需数据**：HBM出货/价格、CoWoS产能、GPU租赁价格、AI付费使用量及机器人交付/接管率，多数没有统一免费API，需按行业授权来源或手工证据记录。

已提供的四项本地配置无需重复补充。尚缺的重点是分析师一致预期/分部经营指标、A/H本币财报适配、持仓数据及国家统计局合法访问条件。Tavily可帮助找到资料，但返回的搜索摘要保持未核验状态。


2026-09-08 更新：中国 CPI 使用 AKShare macro_china_cpi 公开接口，同一次请求取得全国同比、环比与上年同月=100指数，已验证223个月。原 NBS 403 路径已移除，不再阻塞 CPI 展示。财经日历日期筛选目前针对 JBlanked 已取得的本周事件，不表示完整历史覆盖。


2026-09-08 证券核查更新：CBRS、SKHY已通过现有TickFlow补接。五只海外本地股票需要 XKRX/XJPX/XAMS/XPAR 行情，可提供 Twelve Data API Key 与相应交易所日线权限。FMP抽查返回rate_limited，并非已证实缺少套餐；先核实额度。详见 LISTING_COVERAGE_AUDIT.md。


Twelve Data 密钥已保存并实测（2026-09-08）：AAPL日线HTTP200。005930/XKRX、042700/XKRX、285A/XJPX明确返回Pro或Venture权限要求；BESI/XAMS、EXA/XPAR明确返回Grow或Venture权限要求。维持Yahoo作为这五只证券的行情来源，不自动更换口径或购买套餐。


2026-09-09：完成全数据源能力审计与统一数据入口，详见 DATA_ABSTRACTION.md。财务不再依赖FMP单源空缓存；51个跟踪证券已有标准化财务快照。JBlanked401已核对为credits不足，Finnhub经济日历为访问权限受限，FMP为限流；不要将这些情况混称为缺少API密钥。
