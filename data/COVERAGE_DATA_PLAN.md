# 智富界覆盖清单接入状态

来源：用户提供《智富界3×4体系_公司覆盖清单.md》，2026-09-08导入。101家公司、12场景，保留主归属、角色、业务逻辑和重点验证。目录与证券解耦，未匹配证券不生成虚构代码/报价。完整机器清单见 coverage-companies.json。

## 已接通

清单中的 NVDA、AMD、AMZN、GOOGL、MSFT、PLTR、TSLA 已验证实际USD报表，并加入自动跟踪；原有NVDA设置保留。新加入证券按周跟踪，初次研究错峰执行，研究重点来自清单。AAPL为原有跟踪标的，保留，不计入本次101家。

## 需要的凭证与权限

1. **现有 FMP_API_KEY 扩充订阅权限**：例如 QCOM profile 成功，但 income-statement 实测402，返回当前订阅不包括该symbol。不要重复申请同一免费key；需要开通目标证券的 income-statement / cash-flow-statement / balance-sheet-statement / historical-price-eod/full。其他已标识美股也需逐项复测。无需先买Finnhub高档套餐。
2. **TUSHARE_TOKEN**：A股与港股公司身份、日线和财务。A股 stock_basic、income、balancesheet、cashflow 官方权限一般2000积分起；港股 hk_income等需单独权限。来源：https://tushare.pro/document/1?doc_id=108 、https://tushare.pro/document/2?doc_id=389 。凭证配置后还需要实现对应适配器，不能承诺填key即自动完成。
3. **其他国际交易所**：SK海力士/三星（韩国）、铠侠（日本）、Besi（荷兰）、Exail（法国）等需要具备相关市场覆盖的全球行情/财务订阅，可先让FMP确认目标交易所与财报覆盖。TSM/BABA/BIDU的现有FMP凭证已返回TWD/CNY财报，当前模型限定USD，首先需要币种适配而非重复买key；不得把本币财务当美元。
4. **TAVILY_API_KEY**（可选 EXA_API_KEY 替代）：用于未匹配证券的企业、私营公司与集团业务的公告/产品/融资/客户证据检索。Tavily支持普通网页与news检索：https://docs.tavily.com/documentation/api-reference/endpoint/search 。公开检索不能保证获得未公开收入、估值、现金流，需公司文件/访谈资料；也不能给未上市公司生成行情价格。当前本地.env未配置上述搜索key。

只有通过身份、报表和币种校验的证券启用当前行情/模型/研报链路。其余已加入覆盖研究池，状态为“待接入”；不能把该状态理解成后台已在自动采集。上市状态可能变化，未匹配代码的公司仍需基于交易所和官方资料核验。

## TickFlow 更新

行情缺口已部分解决：43家公司已取得TickFlow中、美、港元数据及日线。查看 coverage-companies.json 的 market_available 字段。免费服务无需key；实时行情需 TICKFLOW_API_KEY 及相应权限。先前FMP 402仍属于财务权限问题，不再阻塞这些公司的行情浏览。无需为了中美港历史日线另买FMP/Tushare；国际其他市场和财务研究仍按上文核验。
