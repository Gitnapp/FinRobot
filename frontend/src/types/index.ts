export type Coverage = {
  symbol: string;
  cadence: "daily" | "weekly";
  active: number;
  next_run: string | null;
  last_run: string | null;
};
export type Report = {
  company_name?: string | null;
  id: string;
  symbol: string;
  version: number;
  status: "queued" | "running" | "completed" | "failed";
  stage: string;
  trigger: string;
  focus: string;
  created_at: string;
  completed_at: string | null;
  error: string | null;
};
export type Quote = {
  price_kind?: "realtime" | "close";
  symbol: string;
  name: string;
  sector: string;
  price: number | null;
  change_percent: number | null;
  market_cap: number | null;
  currency: string;
  source: string;
  mock: boolean;
  as_of: string | null;
  note: string;
};
export type Asset = Quote & {
  coverage: Coverage | null;
  report_count: number;
  latest_report: Report | null;
  active_job: Report | null;
  last_job: Report | null;
};
export type Candle = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
};
export type History = {
  currency?: string;
  complete?: boolean | null;
  points: Candle[];
  source: string;
  mock: boolean;
  as_of: string;
  note: string;
};
export type Assumptions = {
  share_growth: number;
  growth: number;
  gross_margin: number;
  opex_ratio: number;
  tax_rate: number;
  da_ratio: number;
  capex_ratio: number;
  nwc_ratio: number;
  exit_multiple: number;
};
export type ModelRow = {
  key: string;
  label: string;
  format: "money" | "percent" | "multiple";
  formula: string;
  values: (number | null)[];
};
export type FinancialModel = {
  currency?: string;
  recommendation_state?: "ready" | "pending" | "stale" | "unavailable";
  columns: string[];
  rows: ModelRow[];
  assumptions: Assumptions | null;
  available?: boolean;
  scenario: string;
  unit: string;
  source: string;
  mock: boolean;
  as_of: string;
  notes: string[];
};
export type News = {
  items: {
    title: string;
    url: string;
    source: string;
    date: string;
    summary: string;
  }[];
  source: string;
  mock: boolean;
  note: string;
};
export type Detail = {
  market_only?: boolean;
  quote: Quote;
  history: History;
  fundamentals: {
    source: string;
    mock: boolean;
    year: number;
    revenue: number;
    as_of: string;
  };
  coverage: Coverage | null;
  reports: Report[];
  model?: FinancialModel;
  technical: {
    sma20: number;
    sma50: number;
    sma200: number;
    low: number;
    high: number;
    range_position: number;
    return_year: number;
    volatility: number;
    drawdown: number;
    trend: string;
    mock: boolean;
  };
  metrics: {
    pe: number | null;
    beta: number | null;
    growth: number | null;
    mock: boolean;
  };
  valuation: {
    unit: string;
    enterprise_value: number;
    wacc: number;
    terminal_growth: number;
    sensitivity: number[][];
    wacc_axis: number[];
    growth_axis: number[];
    mock: boolean;
    note: string;
  };
  peers: {
    symbol: string;
    name: string;
    price: number | null;
    market_cap: number | null;
    pe: number | null;
    beta: number | null;
    growth: number | null;
    mock: boolean;
  }[];
  summary?: string | null;
  news: News;
};
export type Payload = {
  id: string;
  symbol: string;
  version: number;
  created_at: string;
  quote: Quote;
  model: FinancialModel;
  sections: { title: string; content: string; is_ai_generated: boolean }[];
  sources: { label: string; url: string; as_of: string; mock: boolean }[];
  engine: string;
  demo_narrative: boolean;
  has_mock_data: boolean;
  verdict: string;
  charts?: { id: string; title: string; caption: string; url: string }[];
};
export type FullReport = Report & { payload: Payload | null };
export type Provider = {
  model_filter: string;
  selectable_models: string[];
  managed_by: "env" | "manual";
  id: string;
  name: string;
  configured: boolean;
  base_url: string;
  models: string[];
};
export type Settings = {
  llm_routes?: Partial<Record<"report" | "assumptions", {provider:string;model:string}>>;
  provider: string;
  model: string;
  data_mode: "auto";
  providers: Provider[];
  sources: { name: string; configured: boolean }[];
};

export type Watchlist = { id: string; name: string; symbols: string[] };
