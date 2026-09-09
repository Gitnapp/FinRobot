import { X } from "lucide-react";
import { useDetail } from "../hooks/queries";
import "../styles/market-preview.css";
import { TechnicalPanel } from "./coverage-insights";
import { AsyncContent } from "./layout/async-content";
import { NavigationLink } from "./navigation-link";
import { PriceChart } from "./price-chart";
import { Button, Change, compact, money } from "./ui";

export function MarketPreview({
  symbol,
  onClose: closePreview,
}: {
  symbol: string;
  onClose: () => void;
}) {
  const detail = useDetail(symbol);
  return (
    <aside className="market-side" id="market-preview" aria-label="标的预览">
      <Button
        className="preview-close"
        variant="ghost"
        size="icon"
        aria-label="关闭预览"
        onClick={closePreview}
      >
        <X size={16} />
      </Button>
      <AsyncContent
        hasData={Boolean(detail.data)}
        pending={detail.isPending}
        error={detail.error}
        refreshing={detail.isFetching}
        retry={() => void detail.refetch()}
      >
        {detail.data ? (
          <>
            <div className="preview-heading">
              <div>
                <NavigationLink
                  to={"/stocks/" + symbol}
                  label={detail.data.quote.name}
                  wrap
                  className="symbol-title"
                />
                <span className="muted">{detail.data.quote.symbol}</span>
              </div>
            </div>
            <div className="preview-quote-row">
              <div className="preview-price">
                <strong>
                  {money(detail.data.quote.price, detail.data.quote.currency)}
                </strong>
                <Change value={detail.data.quote.change_percent} />
              </div>
              <dl className="preview-quote-facts">
                <div>
                  <dt>市值</dt>
                  <dd>{compact(detail.data.quote.market_cap)}</dd>
                </div>
                <div>
                  <dt>市盈率</dt>
                  <dd>{detail.data.metrics.pe?.toFixed(1) || "—"}</dd>
                </div>
              </dl>
            </div>
            <PriceChart key={symbol} symbol={symbol} small />
            <div className="preview-data">
              <TechnicalPanel data={detail.data} />
            </div>
          </>
        ) : null}
      </AsyncContent>
    </aside>
  );
}
