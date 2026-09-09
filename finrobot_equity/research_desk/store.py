import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class Store:
    def __init__(self, directory=None):
        self.directory = Path(directory or os.environ.get("DESK_DATA_DIR", ".desk")).resolve()
        self.directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.reports_dir = self.directory / "reports"
        self.reports_dir.mkdir(exist_ok=True)
        self.database = self.directory / "research.sqlite3"

    @contextmanager
    def connection(self):
        with sqlite3.connect(self.database, timeout=15) as conn:
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA foreign_keys=ON")
            yield conn

    def init(self):
        with self.connection() as db:
            db.executescript("""
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS assets (
                    symbol TEXT PRIMARY KEY, created_at TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS coverage (
                    symbol TEXT PRIMARY KEY REFERENCES assets(symbol), cadence TEXT NOT NULL,
                    active INTEGER NOT NULL, next_run TEXT, last_run TEXT);
                CREATE TABLE IF NOT EXISTS peer_selections (symbol TEXT PRIMARY KEY, symbols TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS models (
                    symbol TEXT PRIMARY KEY REFERENCES assets(symbol), assumptions TEXT NOT NULL,
                    updated_at TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS scenario_overrides (symbol TEXT NOT NULL, scenario TEXT NOT NULL, values_json TEXT NOT NULL, PRIMARY KEY(symbol,scenario));
                CREATE TABLE IF NOT EXISTS assumption_overrides (
                    symbol TEXT PRIMARY KEY, values_json TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS reports (
                    id TEXT PRIMARY KEY, symbol TEXT NOT NULL, version INTEGER NOT NULL,
                    status TEXT NOT NULL, stage TEXT NOT NULL, trigger TEXT NOT NULL,
                    focus TEXT NOT NULL, created_at TEXT NOT NULL, completed_at TEXT,
                    error TEXT, payload TEXT, UNIQUE(symbol,version));
                CREATE UNIQUE INDEX IF NOT EXISTS one_active_report ON reports(symbol)
                    WHERE status IN ('queued','running');
                CREATE TABLE IF NOT EXISTS model_filters (service_id TEXT PRIMARY KEY REFERENCES model_services(id) ON DELETE CASCADE, keywords TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS model_services (id TEXT PRIMARY KEY, name TEXT NOT NULL, base_url TEXT NOT NULL, models TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS coverage_companies (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT NOT NULL, expires REAL NOT NULL);
                CREATE TABLE IF NOT EXISTS watchlists (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS watchlist_order (list_id TEXT PRIMARY KEY REFERENCES watchlists(id) ON DELETE CASCADE, position INTEGER NOT NULL);
                CREATE TABLE IF NOT EXISTS watchlist_symbols (
                    list_id TEXT NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
                    symbol TEXT NOT NULL REFERENCES assets(symbol), position INTEGER NOT NULL,
                    PRIMARY KEY(list_id,symbol));
            """)
            # Seed the watchlist once; deleting all assets should remain an intentional empty state.
            if not db.execute("SELECT 1 FROM settings").fetchone():
                for symbol in (
                    "NVDA",
                    "AAPL",
                    "MSFT",
                    "TSLA",
                    "GOOGL",
                    "AMZN",
                    "META",
                    "AMD",
                ):
                    db.execute("INSERT OR IGNORE INTO assets VALUES (?,?)", (symbol, now()))
                settings = {
                    "provider": "openai",
                    "model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
                    "data_mode": "auto",
                }
                db.execute("INSERT INTO settings VALUES (1,?)", (json.dumps(settings),))
            db.execute("INSERT OR IGNORE INTO model_services VALUES ('openai', 'OpenAI Compatible', ?, ?)", (os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip('/'), json.dumps([os.getenv("OPENAI_MODEL", "gpt-4o-mini")])))
            if not db.execute("SELECT 1 FROM watchlists").fetchone():
                db.execute("INSERT INTO watchlists VALUES ('default','自选',?)", (now(),))
                for i, row in enumerate(
                    db.execute("SELECT symbol FROM assets ORDER BY created_at,symbol").fetchall()
                ):
                    db.execute("INSERT INTO watchlist_symbols VALUES ('default',?,?)", (row[0], i))

    def all(self, sql, params=()):
        with self.connection() as db:
            return [dict(row) for row in db.execute(sql, params).fetchall()]

    def one(self, sql, params=()):
        rows = self.all(sql, params)
        return rows[0] if rows else None

    def execute(self, sql, params=()):
        with self.connection() as db:
            db.execute(sql, params)

    def settings(self):
        return json.loads(self.one("SELECT value FROM settings WHERE id=1")["value"])

    def assumptions(self, symbol):
        row = self.one("SELECT assumptions FROM models WHERE symbol=?", (symbol,))
        return json.loads(row["assumptions"]) if row else None

    def reports(self, symbol=None):
        query = "SELECT id,symbol,version,status,stage,trigger,focus,created_at,completed_at,error, json_extract(payload, '$.quote.name') AS company_name FROM reports"
        return self.all(
            query
            + (" WHERE symbol=?" if symbol else "")
            + " ORDER BY created_at DESC,version DESC",
            (symbol,) if symbol else (),
        )
