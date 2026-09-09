"""Asset operations use the same data abstractions as detail pages, without LLM calls."""
import asyncio
from .task_queue import TaskDefinition
from .store import now


def definitions(store, market, data_access):
    async def register(payload):
        symbol=payload['symbol']
        # Network validation is background work, never part of the task receipt.
        await market.instrument(symbol)
        with store.connection() as db:
            db.execute('BEGIN IMMEDIATE')
            if not db.execute('SELECT id FROM watchlists WHERE id=?',(payload['list_id'],)).fetchone(): raise ValueError('list_removed')
            db.execute('INSERT OR IGNORE INTO assets VALUES (?,?)',(symbol,now()))
            position=db.execute('SELECT COALESCE(MAX(position),-1)+1 FROM watchlist_symbols WHERE list_id=?',(payload['list_id'],)).fetchone()[0]
            db.execute('INSERT OR IGNORE INTO watchlist_symbols VALUES (?,?,?)',(payload['list_id'],symbol,position))

    async def track(payload):
        symbol=payload['symbol']
        await market.instrument(symbol)
        with store.connection() as db:
            db.execute('BEGIN IMMEDIATE')
            db.execute('INSERT OR IGNORE INTO assets VALUES (?,?)',(symbol,now()))
            db.execute("INSERT INTO coverage(symbol,cadence,active,next_run) VALUES (?,'weekly',1,NULL) ON CONFLICT(symbol) DO UPDATE SET active=1",(symbol,))

    async def prices(payload):
        result=await data_access.read(payload['symbol'],'prices')
        if not result.get('data'):raise ValueError('prices_unavailable')

    async def financials(payload):
        result=await data_access.read(payload['symbol'],'metrics')
        return [] if result.get('data') else ['财务数据暂未取得']

    async def snapshot(symbol,dataset):
        try:
            result=await data_access.read(symbol,dataset)
            while result.get('refreshing') or result.get('state') == 'pending':
                await asyncio.sleep(.25)
                result = await data_access.read(symbol, dataset)
            if result.get('state') in ('pending','unavailable') or result.get('status')=='unavailable' or result.get('refresh_failed'):return dataset
        except Exception:return dataset

    async def context(payload):
        names={'company':'财务资料','peers':'同业比较','disclosures':'披露记录','research':'资料线索','sentiment':'散户情绪','catalysts':'披露日程'}
        warnings=[]
        for dataset,label in names.items():
            try:
                async with asyncio.timeout(12): missing=await snapshot(payload['symbol'],dataset)
            except TimeoutError:missing=dataset
            if missing:warnings.append(label+'暂未取得')
        return warnings

    async def tracking_context(payload):
        warnings=await context(payload)
        store.execute("UPDATE coverage SET next_run=? WHERE symbol=? AND next_run IS NULL",(now(),payload['symbol']))
        return warnings

    return {
        'add_asset':TaskDefinition('添加标的并准备数据',(('加入分组',register),('获取行情走势',prices),('获取财务数据',financials),('补齐研究资料',context))),
        'track_asset':TaskDefinition('添加跟踪并准备数据',(('加入跟踪',track),('获取行情走势',prices),('获取财务数据',financials),('补齐研究资料',tracking_context))),
        'refresh_asset':TaskDefinition('更新标的数据',(('更新行情走势',prices),('更新财务数据',financials),('更新研究资料',context))),
    }
