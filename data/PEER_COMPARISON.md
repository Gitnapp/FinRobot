# 同业比较接入与全量核验

## 更新方式

- `/api/data/{symbol}/peers` 统一读取名单和指标；`PUT` 提交1–6家用户选择，symbols=null恢复自动。
- 不再使用静态12家公司目录，也不按市场直接返回空同业列表。适用于所有已接入市场的上市标的。
- 自动名单每周刷新。候选来自Yahoo同行业筛选／行业目录，Finnhub同业候选在行业核验后参与排序；按汇率换算后的市值衡量规模，排除自身、重复公司、不支持的交易所、无市值及可识别的权证／优先股。同行业不保证业务完全可比，用户可以调整。
- 单行行情／估值快照每15分钟检查，复用行情和指标模块自身的有效期。财务通过FinancialData读取各自年度、原币种及字段来源。
- 服务独立后台扫描，跟踪暂停后停止该主体的后台扫描；同行交叉引用仍可能更新共享数据。页面访问不负责触发全量更新。
- 单个来源失败保留上次有效数据；首次缺失字段留空，失败15分钟后重试。用户名单单独持久化，自动名单更新不覆盖。
- 汇率每日更新，仅用于候选规模筛选。展示的股价和财务金额保持原币；股价币种和财务币种可能不同。

## 已验证

- 51/51 个跟踪标的已取得同业名单，涉及 139 家不同同业公司，均已取得财务快照。
- 70项后端测试通过，包含跨市场、同公司去重、汇率规模比较、用户名单持久化、恢复自动、单行失败保留旧值。
- 已在苹果页面验证数据显示、编辑保存、刷新后保留及恢复自动。
- 00470.HK 已通过统一行情源切换取得 Yahoo 报价及140条日线；2026-09-08 收盘 HK$27.66。无需新增 API。

## 官方文档

- https://finnhub.io/docs/api/company-peers
- https://ranaroussi.github.io/yfinance/reference/api/yfinance.Industry.html
- https://ranaroussi.github.io/yfinance/reference/api/yfinance.screen.html

| 标的 | 自动同业名单 |
|---|---|
| AAPL | 005930.KS, 6758.T, 01810.HK, 6752.T |
| NVDA | AVGO, MU, AMD, INTC |
| AMD | MU, INTC, AVGO, TXN |
| AMZN | EBAY, CPNG, ETSY, PTRN |
| GOOGL | META, RDDT, PINS, MTCH |
| PLTR | ORCL, PANW, CRWD, FTNT |
| MSFT | ORCL, PANW, CRWD, FTNT |
| TSLA | GM, F, RIVN, 7203.T |
| QCOM | ADI, MRVL, TXN, INTC |
| AVGO | MU, AMD, NVDA, INTC |
| 688256.SH | ASX, 402340.KS, 00981.HK, MPWR |
| 688795.SH | HPQ, SMCI, 688836.SH, 7751.T |
| 06082.HK | 6963.T, 300475.SZ, 603893.SH, 688249.SH |
| 688802.SH | 688498.SH, CRDO, 688008.SH, ON |
| 09903.HK | 300661.SZ, 688396.SH, SWKS, 00501.HK |
| MRVL | QCOM, ADI, MPWR, ALAB |
| MU | AMD, AVGO, INTC, TXN |
| SNDK | DELL, WDC, P, HPQ |
| TSM | AVGO, SKHY, MU, NVDA |
| ASX | 688256.SH, 402340.KS, 00981.HK, ADI |
| AMKR | ONTO, FORM, ENTG, Q |
| 600584.SH | SITM, 688702.SH, LSCC, MTSI |
| 002156.SZ | 601012.SH, 6525.T, AMKR, NVMI |
| 002185.SZ | 300751.SZ, 300316.SZ, 688048.SH, 688019.SH |
| 00522.HK | 002409.SZ, 688630.SH, 300666.SZ, 688037.SH |
| CRWV | NET, XYZ, SNPS, FTNT |
| NBIS | SPOT, 09888.HK, RDDT, 6098.T |
| ORCL | PANW, CRWD, FTNT, MSFT |
| GDS | 000034.SZ, 300383.SZ, 300738.SZ, INGM |
| VNET | 300541.SZ, 300468.SZ, 00856.HK, 300469.SZ |
| BABA | PDD, MELI, PRX.AS, DASH |
| 02513.HK | CRWV, XYZ, SNPS, NET |
| BIDU | 000681.SZ, 300785.SZ, RDDT, 035420.KS |
| NOW | UBER, SNOW, SHOP, ADP |
| CRM | ADBE, INTU, CDNS, DDOG |
| 01024.HK | 035420.KS, 01698.HK, 035720.KS, PINS |
| 00100.HK | XYZ, CRWV, SNPS, NET |
| 688836.SH | P, HPQ, 688795.SH, SMCI |
| 688169.SH | 300776.SZ, 6465.T, 6113.T, 02208.HK |
| 603486.SH | ALH, 002032.SZ, 600839.SH, 00921.HK |
| 09880.HK | 603699.SH, 00470.HK, 688433.SH, 02208.HK |
| 02590.HK | DDOG, CDNS, INTU, ADBE |
| AVAV | SARO, KTOS, DRS, HII |
| KTOS | DRS, SARO, AVAV, HII |
| CBRS | ALAB, MCHP, MPWR, ON |
| SKHY | 000990.KS, 440110.KQ, 080220.KQ, 067310.KQ |
| 005930.KS | AAPL, 6758.T, 01810.HK, 6752.T |
| 285A.T | MRVL, QCOM, TXN, ADI |
| 042700.KS | 688120.SH, ONTO, 7735.T, 688783.SH |
| BESI.AS | 688120.SH, 042700.KS, ONTO, 7735.T |
| EXA.PA | 688523.SH, 00317.HK, 600435.SH, 7014.T |
