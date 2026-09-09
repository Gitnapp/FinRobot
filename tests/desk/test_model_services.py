import asyncio
import json
import stat
import httpx
import pytest
from finrobot_equity.research_desk.model_services import ModelServices, ServiceInput
from finrobot_equity.research_desk.store import Store


def test_services_and_workflow_selection_survive_restart(tmp_path):
    store = Store(tmp_path)
    store.init()
    services = ModelServices(store)
    created = services.save(ServiceInput(name='Test provider', base_url='https://example.com/v1', secret='test-secret'))
    assert created['configured']
    assert 'test-secret' not in json.dumps(services.list())
    assert stat.S_IMODE(services.secrets.stat().st_mode) == 0o600
    services.save(ServiceInput(name='Renamed', base_url=created['base_url']), created['id'])
    settings = store.settings()
    settings['llm_routes'] = {'report': {'provider': created['id'], 'model': 'report-model'}, 'assumptions': {'provider': created['id'], 'model': 'assumption-model'}}
    store.execute('UPDATE settings SET value=?', (json.dumps(settings),))
    fresh = ModelServices(Store(tmp_path))
    for purpose, model in [('report', 'report-model'), ('assumptions', 'assumption-model')]:
        choice = fresh.for_workflow(purpose)
        assert choice['model'] == model
        assert choice['_connection']['secret'] == 'test-secret'
    assert next(row for row in fresh.list() if row['id'] == created['id'])['name'] == 'Renamed'


def test_discovery_persists_models_and_keeps_list_on_failure(tmp_path, monkeypatch):
    store = Store(tmp_path)
    store.init()
    services = ModelServices(store)
    created = services.save(ServiceInput(name='Test', base_url='https://example.com/v1', secret='test-key'))
    async def success(self, url, **kwargs):
        assert url == 'https://example.com/v1/models'
        assert kwargs['headers']['Authorization'] == 'Bearer test-key'
        return httpx.Response(200, json={'data':[{'id':'b'},{'id':'a'},{'id':'a'}]})
    monkeypatch.setattr(httpx.AsyncClient, 'get', success)
    assert asyncio.run(services.models(created['id']))['models'] == ['a','b']
    async def failed(*args, **kwargs): return httpx.Response(429)
    monkeypatch.setattr(httpx.AsyncClient, 'get', failed)
    with pytest.raises(ValueError): asyncio.run(services.models(created['id']))
    assert next(row for row in services.list() if row['id'] == created['id'])['models'] == ['a','b']


def test_environment_service_cannot_be_overwritten(tmp_path, monkeypatch):
    monkeypatch.setenv('OPENAI_API_KEY', 'environment-secret')
    store = Store(tmp_path)
    store.init()
    services = ModelServices(store)
    assert services.list()[0]['managed_by'] == 'env'
    with pytest.raises(ValueError):
        services.save(ServiceInput(name='Changed', base_url='https://example.com/v1', secret='replacement'), 'openai')
    assert services.key('openai') == 'environment-secret'
    assert not services.secrets.exists()


def test_model_filter_persists_and_restricts_selection(tmp_path):
    store = Store(tmp_path)
    store.init()
    services = ModelServices(store)
    service = services.save(ServiceInput(name='Filter test', base_url='https://example.com/v1'))
    store.execute('UPDATE model_services SET models=? WHERE id=?', (json.dumps(['gpt-a','qwen-b','embedding-c']), service['id']))
    store.execute('INSERT INTO model_filters VALUES (?,?)', (service['id'], 'GPT，qwen'))
    fresh = ModelServices(Store(tmp_path))
    row = next(row for row in fresh.list() if row['id'] == service['id'])
    assert row['selectable_models'] == ['gpt-a','qwen-b']
    fresh.validate_selection({'provider':service['id'],'model':'qwen-b'})
    with pytest.raises(ValueError):fresh.validate_selection({'provider':service['id'],'model':'embedding-c'})
