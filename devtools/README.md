# 隔离调试

正常启动 `python run_web_app.py` 只使用真实服务，没有演示开关或自动补造数据。

运行 `.venv/bin/python -m devtools.fixture_app`，访问 http://127.0.0.1:8002。
该入口注入 `FixtureMarket` 与固定报告生成器，数据和报告保存在 `.desk-fixture/`，不会读写 `.desk/`。行情、财务、历史曲线由同一套固定种子的虚构公司生成，明确标注为测试数据；不针对真实公司编造财务。

复用 fixtures 到 pytest 时使用临时 Store；通过替换 adapter 方法返回空值或抛出 ProviderError 验证缺失/失败状态。不得将 fixture 导入正式应用模块。宏观、情绪等未提供 fixture 的外部服务不属于此调试入口的离线覆盖范围。

正式接口缺失财报时返回不可用状态或仅行情页面；PE/Beta 缺失为 null，不能填默认数字。预测情景仍可使用明确的假设，不能反向生成历史事实。
