export type Coverage = {
  symbol: string;
  cadence: "daily" | "weekly";
  active: number;
  next_run: string | null;
  last_run: string | null;
};
export type Report = {
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
  symbol: string;
  name: string;
  sector: string;
  price: number;
  change_percent: number;
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
  points: Candle[];
  source: string;
  mock: boolean;
  as_of: string;
  note: string;
};
export type Assumptions = {
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
  columns: string[];
  rows: ModelRow[];
  assumptions: Assumptions;
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
  model: FinancialModel;
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
};
export type FullReport = Report & { payload: Payload | null };
export type Provider = {
  id: string;
  name: string;
  configured: boolean;
  base_url: string;
  models: string[];
};
export type Settings = {
  provider: string;
  model: string;
  data_mode: "auto" | "mock";
  providers: Provider[];
  sources: { name: string; configured: boolean }[];
};
