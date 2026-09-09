from fastapi import FastAPI
from fastapi.testclient import TestClient
from finrobot_equity.research_desk.store import Store
from finrobot_equity.research_desk.watchlists import routes


def test_list_management_and_persisted_order(tmp_path):
    store = Store(tmp_path)
    store.init()
    app = FastAPI()
    app.include_router(routes(store, None))
    with TestClient(app) as client:
        created = client.post('/api/watchlists', json={'name': 'Test group'}).json()
        ids = [row['id'] for row in client.get('/api/watchlists').json()][::-1]
        assert client.put('/api/watchlists/order', json={'ids': ids}).status_code == 200
        assert [row['id'] for row in client.get('/api/watchlists').json()] == ids
        assert client.put('/api/watchlists/order', json={'ids': ids[:-1]}).status_code == 422
        assert client.put('/api/watchlists/' + created['id'], json={'name': 'Renamed'}).status_code == 200
        assert next(row['name'] for row in client.get('/api/watchlists').json() if row['id'] == created['id']) == 'Renamed'
        assert client.delete('/api/watchlists/' + created['id']).status_code == 200
        assert store.one('SELECT * FROM watchlist_order WHERE list_id=?', (created['id'],)) is None
