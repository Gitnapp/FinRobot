# 证券与数据覆盖核查（2026-09-08）

现有44个匹配证券均有行情。补接CBRS和SKHY后为46个。SKHY是美国存托凭证，不是韩国000660本地股价。

## 所需数据权限

- 日韩与欧洲：已通过Yahoo Finance补接五只股票，当前无需新增API Key。若需要额外授权行情源，可再评估Twelve Data，需确认XKRX、XJPX、XAMS、XPAR权限。供应商交易所清单：https://twelvedata.com/exchanges 。获取密钥后仍需逐个验证五只证券，不能仅凭套餐名称保证可用。
- 财报：27个原有美股/ADR中，8个有有效财务基期，19个未取得有效财报。抽查FMP首个请求返回rate_limited，后续被限流保护拦截；不能推断这19个全部缺订阅。先核实当前FMP额度/限速；ADR还需适配原币及IFRS，行情权限不等于财报权限。
- 非上市公司：普通行情API没有连续公开股价。需要融资、股权、私募估值时可另采购公司数据服务；私募估值不得冒充交易所报价。
- 未核实项：没有足够证据判定上市状态，不标记为未上市，也不盲目要求新增API。以下逐项保留核实边界。

## 明细

| 公司 | 结果 | 证券 / 市场 | 说明与来源 |
|---|---|---|---|
| 华为（昇腾业务） | 非上市 | — / — | 华为为员工持有的非上市公司；昇腾不是独立上市证券 [来源](https://www.huawei.com/en/media-center/company-facts) |
| 燧原科技 | IPO进程中 | 688801 / SSE | 已取得发行代码；未核实上市交易日，行情目录尚无记录 [来源](https://www.cninfo.com.cn/new/commonUrl?url=disclosure%2Fipo%2Farea) |
| Cerebras | 已补接 | CBRS / NASDAQ | 已核实上市；补齐证券映射 [来源](https://www.cerebras.ai/press-release/cerebras-systems-announces-closing-of-initial-public-offering) |
| SK 海力士 | 已补接 | SKHY / NASDAQ | 接入美股存托凭证；与韩国000660为不同交易证券，价格币种不可混用 [来源](https://www.nasdaqtrader.com/TraderNews.aspx?id=DTN2026-11) |
| 三星电子（存储业务） | 交易所待接入 | 005930 / KRX | 韩国上市；存储业务不是独立上市主体，当前行情源未覆盖韩股 [来源](https://www.samsung.com/global/ir/stock-information/listing-Info/) |
| 铠侠 Kioxia | 交易所待接入 | 285A / TSE | 东京上市；当前行情源未覆盖日股 [来源](https://www.kioxia-holdings.com/ja-jp/ir/stock/outline.html) |
| 韩美半导体 Hanmi Semiconductor | 交易所待接入 | 042700 / KRX | 韩国上市；当前行情源未覆盖韩股 [来源](https://englishdart.fss.or.kr/dsbc001/selectPopup.ax?selectKey=00161383) |
| Besi | 交易所待接入 | BESI / Euronext Amsterdam | 阿姆斯特丹上市；当前行情源未覆盖此交易所 [来源](https://www.besi.com/investor-relations/share-information) |
| Crusoe | 非上市 | — / — | 非上市公司，无交易所连续公开行情 [来源](https://forgeglobal.com/crusoe-energy-systems_stock/) |
| Lambda | 非上市 | — / — | 非上市公司，IPO预期不等于已经挂牌 [来源](https://stockanalysis.com/private/lambda/) |
| Nscale | 非上市 | — / — | 公开资料列为非上市公司，无交易所连续公开行情 [来源](https://stockanalysis.com/private/nscale/) |
| Fluidstack | 非上市 | — / — | 公开资料列为非上市公司，暂无交易所证券 [来源](https://stockanalysis.com/private/fluidstack/) |
| OpenAI | 非上市 | — / — | 非上市公司，无交易所连续公开行情 [来源](https://forgeglobal.com/openai_stock/) |
| DeepSeek | 非上市 | — / — | 公开资料列为非上市公司，无交易所连续公开行情 [来源](https://docs.house.gov/meetings/HM/HM08/20260317/118982/HHRG-119-HM08-Wstate-DoshiPhDR-20260317.pdf) |
| 月之暗面 Moonshot AI | 非上市 | — / — | 公开资料列为非上市公司，无交易所连续公开行情 [来源](https://stockanalysis.com/private/moonshot-ai/) |
| Perplexity | 非上市 | — / — | 非上市公司；私募交易估值不等于公开股价 [来源](https://forgeglobal.com/perplexity_stock/) |
| xAI（Grok 业务） | 非独立上市主体 | — / — | 已被收购，非独立上市证券；不以母公司行情冒充自身股价 [来源](https://x.ai/news/xai-joins-spacex) |
| Mistral AI | 非上市 | — / — | 非上市公司，无交易所连续公开行情 [来源](https://forgeglobal.com/insights/how-to-invest-in-mistral-ai-stock-pre-ipo/) |
| Anthropic | 非上市 | — / — | 公开资料列为非上市公司，无交易所连续公开行情 [来源](https://www.msci.com/research-and-insights/paper/private-company-insights-anthropic) |
| Anysphere（Cursor） | 非独立上市主体 | — / — | 已被收购，非独立上市证券；不以母公司行情冒充自身股价 [来源](https://www.hiive.com/securities/anysphere-cursor.com-stock) |
| Cognition（Devin／Windsurf） | 非上市 | — / — | 公开资料列为非上市公司，暂无交易所证券 [来源](https://stockanalysis.com/private/cognition/) |
| Replit | 非上市 | — / — | 非上市公司，无交易所连续公开行情 [来源](https://forgeglobal.com/replit_stock/) |
| Lovable | 非上市 | — / — | 公开资料列为非上市公司，暂无交易所证券 [来源](https://stockanalysis.com/private/lovable/) |
| StackBlitz（Bolt） | 非上市 | — / — | 公开资料列为非上市公司，无交易所连续公开行情 [来源](https://www.collectiveliquidity.com/companies/stackblitz) |
| Augment Code | 非上市 | — / — | 公开资料列为非上市公司，无交易所连续公开行情 [来源](https://stockanalysis.com/private/augment/valuation/) |
| Sierra | 非上市 | — / — | 公开资料列为非上市公司，无交易所连续公开行情 [来源](https://forgeglobal.com/sierra-ai_stock/) |
| Glean | 非上市 | — / — | 公开资料列为非上市公司，无交易所连续公开行情 [来源](https://www.upmarket.co/private-markets/pre-ipo/glean/) |
| Harvey | 非上市 | — / — | 公开资料列为非上市公司，无交易所连续公开行情 [来源](https://forgeglobal.com/harvey_ipo/) |
| Abridge | 非上市 | — / — | 公开资料列为非上市公司，无交易所连续公开行情 [来源](https://www.nasdaqprivatemarket.com/company/abridge/) |
| Cohere | 非上市 | — / — | 公开资料列为非上市公司，无交易所连续公开行情 [来源](https://forgeglobal.com/cohere_ipo/) |
| 字节跳动（Seedance／即梦） | 非上市 | — / — | 公开资料列为非上市公司，无交易所连续公开行情 [来源](https://www.theinformation.com/articles/bytedance-investors-struggle-to-sell-shares-at-discounted-240-billion-value-amid-ipo-uncertainty) |
| Runway | 非上市 | — / — | 公开资料列为非上市公司，无交易所连续公开行情 [来源](https://axevil.com/company/runway) |
| Luma AI | 非上市 | — / — | 公开资料列为非上市公司，无交易所连续公开行情 [来源](https://stockanalysis.com/private/luma-ai/) |
| Pika | 尚未取得足够上市证明 | — / — | 当前证券目录未匹配；未取得足够上市证明，不能据此断言未上市 |
| 生数科技（Vidu） | 尚未取得足够上市证明 | — / — | 当前证券目录未匹配；未取得足够上市证明，不能据此断言未上市 |
| 普渡机器人 Pudu | 尚未取得足够上市证明 | — / — | 当前证券目录未匹配；未取得足够上市证明，不能据此断言未上市 |
| 擎朗智能 Keenon | 尚未取得足够上市证明 | — / — | 当前证券目录未匹配；未取得足够上市证明，不能据此断言未上市 |
| 高仙机器人 Gaussian Robotics | 尚未取得足够上市证明 | — / — | 当前证券目录未匹配；未取得足够上市证明，不能据此断言未上市 |
| 智元机器人 AgiBot | IPO进程中 | — / — | 已见上市申请或合并上市资料，尚未核实交易完成及正式挂牌 [来源](https://m.21jingji.com/article/20260725/herald/038a0e9d1986a0080a69162af846769c.html) |
| 银河通用 Galbot | 尚未取得足够上市证明 | — / — | 当前证券目录未匹配；未取得足够上市证明，不能据此断言未上市 |
| 1X | 尚未取得足够上市证明 | — / — | 当前证券目录未匹配；未取得足够上市证明，不能据此断言未上市 |
| 傅利叶智能 Fourier | 尚未取得足够上市证明 | — / — | 当前证券目录未匹配；未取得足够上市证明，不能据此断言未上市 |
| Figure AI | 非上市 | — / — | 公开资料列为非上市公司，无交易所连续公开行情 [来源](https://forgeglobal.com/figure-ai_ipo/) |
| Agility Robotics | IPO进程中 | — / — | 已见上市申请或合并上市资料，尚未核实交易完成及正式挂牌 [来源](https://www.sec.gov/Archives/edgar/data/2074973/000121390026071655/ea029583801-425_church11.htm) |
| Apptronik | 非上市 | — / — | 公开资料列为非上市公司，无交易所连续公开行情 [来源](https://forgeglobal.com/apptronik_stock/) |
| Boston Dynamics | 非独立上市主体 | — / — | 现代汽车集团旗下公司；不以母公司行情替代其独立行情 [来源](https://bostondynamics.com/faq/) |
| Sanctuary AI | 尚未取得足够上市证明 | — / — | 当前证券目录未匹配；未取得足够上市证明，不能据此断言未上市 |
| Dexterity | 尚未取得足够上市证明 | — / — | 当前证券目录未匹配；未取得足够上市证明，不能据此断言未上市 |
| 海柔创新 Hai Robotics | IPO进程中 | — / — | 已见上市申请或合并上市资料，尚未核实交易完成及正式挂牌 [来源](https://content.etnet.com.hk/content/shk/sc/categorized_news_detail.php?newsid=ETN360213779) |
| Anduril | 非上市 | — / — | 公开资料列为非上市公司，无交易所连续公开行情 [来源](https://www.nasdaqprivatemarket.com/company/anduril/) |
| Shield AI | 非上市 | — / — | 公开资料列为非上市公司，无交易所连续公开行情 [来源](https://forgeglobal.com/shield-ai_stock/) |
| Helsing | 尚未取得足够上市证明 | — / — | 当前证券目录未匹配；未取得足够上市证明，不能据此断言未上市 |
| Skydio | 尚未取得足够上市证明 | — / — | 当前证券目录未匹配；未取得足够上市证明，不能据此断言未上市 |
| ANYbotics | 尚未取得足够上市证明 | — / — | 当前证券目录未匹配；未取得足够上市证明，不能据此断言未上市 |
| 云深处科技 DEEP Robotics | IPO进程中 | — / — | 已见IPO审核资料，未取得已挂牌交易代码 [来源](https://www.stcn.com/ipo/detail/3659.html) |
| Exail Technologies | 交易所待接入 | EXA / Euronext Paris | 巴黎上市；当前行情源未覆盖此交易所 [来源](https://www.exail-technologies.com/investors/) |
| Gecko Robotics | 非上市 | — / — | 公开资料列为非上市公司，无交易所连续公开行情 [来源](https://www.nasdaqprivatemarket.com/company/gecko-robotics/) |
| Flyability | 尚未取得足够上市证明 | — / — | 当前证券目录未匹配；未取得足够上市证明，不能据此断言未上市 |

## Yahoo补接结果
五家原“交易所待接入”现均已接入Yahoo，跟踪可用行情数增至51。最新证券映射以listing-audit.json为准。
