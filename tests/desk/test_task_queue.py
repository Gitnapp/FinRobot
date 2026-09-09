import asyncio
from finrobot_equity.research_desk.store import Store
from finrobot_equity.research_desk.task_queue import TaskQueue
from finrobot_equity.research_desk.asset_tasks import definitions
from finrobot_equity.research_desk.tasks import Tasks


def test_addition_is_durable_deduplicated_and_retries_without_duplicate_members(tmp_path):
    store=Store(tmp_path);store.init()
    class Market:
        async def instrument(self,symbol):return {'symbol':symbol}
    class Data:
        broken=True
        async def read(self,symbol,dataset):
            if dataset=='prices' and self.broken:raise RuntimeError('temporary')
            return {'state':'ready','data':{'ok':True}}
    data=Data();queue=TaskQueue(store,definitions(store,Market(),data))
    receipt=queue.submit('add_asset',{'symbol':'PLTR','list_id':'default'})
    assert receipt['status']=='queued'
    assert queue.submit('add_asset',{'symbol':'PLTR','list_id':'default'})['id']==receipt['id']
    assert not store.one("SELECT * FROM watchlist_symbols WHERE symbol='PLTR'")
    async def run():
        await queue.process_one()
        failed=queue.read(receipt['id']);assert failed['status']=='failed' and failed['completed_steps']==1
        assert store.one("SELECT * FROM watchlist_symbols WHERE symbol='PLTR'")
        data.broken=False
        assert queue.retry(receipt['id'])['id']==receipt['id']
        fresh=TaskQueue(Store(tmp_path),definitions(store,Market(),data))
        await fresh.process_one()
        done=Tasks(store,fresh).read(receipt['id'])
        assert done['status']=='completed' and done['completed_steps']==4
        assert store.one("SELECT count(*) AS n FROM watchlist_symbols WHERE symbol='PLTR'")['n']==1
        assert not store.one("SELECT * FROM reports WHERE symbol='PLTR'")
    asyncio.run(run())


def test_receipt_does_not_run_network_and_worker_cancellation_requeues(tmp_path):
    store=Store(tmp_path);store.init();entered=asyncio.Event()
    class Market:
        async def instrument(self,symbol):
            entered.set();await asyncio.sleep(30)
    queue=TaskQueue(store,definitions(store,Market(),None))
    receipt=queue.submit('add_asset',{'symbol':'PLTR','list_id':'default'})
    assert not entered.is_set()
    async def run():
        task=asyncio.create_task(queue.process_one());await entered.wait();task.cancel()
        try:await task
        except asyncio.CancelledError:pass
        assert queue.read(receipt['id'])['status']=='queued'
    asyncio.run(run())
