import uuid

from fastapi import APIRouter, HTTPException
from pydantic import Field, field_validator

from .schemas import StrictModel, SymbolInput
from .store import now


class ListName(StrictModel):
    name: str = Field(min_length=1, max_length=40)

    @field_validator("name")
    @classmethod
    def nonempty(cls, value):
        if not value.strip():
            raise ValueError("列表名称不能为空")
        return value.strip()


class GroupOrder(StrictModel):
    ids: list[str]


class ListOrder(StrictModel):
    symbols: list[str]


def routes(store, market):
    router = APIRouter(prefix="/api/watchlists")

    def require(identifier):
        if not store.one("SELECT 1 FROM watchlists WHERE id=?", (identifier,)):
            raise HTTPException(404, "列表不存在")

    @router.get("")
    def lists():
        rows = store.all("SELECT w.* FROM watchlists w LEFT JOIN watchlist_order o ON w.id=o.list_id ORDER BY o.position IS NULL,o.position,w.created_at,w.id")
        for row in rows:
            row["symbols"] = [
                s["symbol"]
                for s in store.all(
                    "SELECT symbol FROM watchlist_symbols WHERE list_id=? ORDER BY position",
                    (row["id"],),
                )
            ]
        return rows

    @router.post("", status_code=201)
    def create(body: ListName):
        identifier = uuid.uuid4().hex
        store.execute("INSERT INTO watchlists VALUES (?,?,?)", (identifier, body.name, now()))
        return {"id": identifier, "name": body.name, "symbols": []}

    @router.put("/order")
    def order_groups(body: GroupOrder):
        with store.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            ids = {r[0] for r in db.execute("SELECT id FROM watchlists")}
            if len(body.ids) != len(set(body.ids)) or set(body.ids) != ids:
                raise HTTPException(422, "排序必须包含全部列表")
            db.executemany("INSERT OR REPLACE INTO watchlist_order VALUES (?,?)", [(identifier, i) for i, identifier in enumerate(body.ids)])
        return {"ok": True}

    @router.put("/{identifier}")
    def rename(identifier: str, body: ListName):
        require(identifier)
        store.execute("UPDATE watchlists SET name=? WHERE id=?", (body.name, identifier))
        return {"ok": True}

    @router.delete("/{identifier}")
    def delete(identifier: str):
        require(identifier)
        with store.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            if db.execute("SELECT count(*) FROM watchlists").fetchone()[0] < 2:
                raise HTTPException(409, "至少保留一个自选列表")
            db.execute("DELETE FROM watchlists WHERE id=?", (identifier,))
        return {"ok": True}

    @router.post("/{identifier}/symbols")
    async def add(identifier: str, body: SymbolInput):
        require(identifier)
        await market.instrument(body.symbol)
        with store.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            db.execute("INSERT OR IGNORE INTO assets VALUES (?,?)", (body.symbol, now()))
            position = db.execute(
                "SELECT COALESCE(MAX(position),-1)+1 FROM watchlist_symbols WHERE list_id=?",
                (identifier,),
            ).fetchone()[0]
            db.execute(
                "INSERT OR IGNORE INTO watchlist_symbols VALUES (?,?,?)",
                (identifier, body.symbol, position),
            )
        return {"symbol": body.symbol}

    @router.delete("/{identifier}/symbols/{symbol}")
    def remove(identifier: str, symbol: str):
        require(identifier)
        store.execute(
            "DELETE FROM watchlist_symbols WHERE list_id=? AND symbol=?", (identifier, symbol)
        )
        return {"ok": True}

    @router.put("/{identifier}/order")
    def order(identifier: str, body: ListOrder):
        require(identifier)
        with store.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            symbols = [
                r[0]
                for r in db.execute(
                    "SELECT symbol FROM watchlist_symbols WHERE list_id=?", (identifier,)
                )
            ]
            if len(body.symbols) != len(set(body.symbols)) or set(body.symbols) != set(symbols):
                raise HTTPException(422, "调整顺序时必须包含列表中的全部标的")
            for i, symbol in enumerate(body.symbols):
                db.execute(
                    "UPDATE watchlist_symbols SET position=? WHERE list_id=? AND symbol=?",
                    (i, identifier, symbol),
                )
        return {"ok": True}

    return router
