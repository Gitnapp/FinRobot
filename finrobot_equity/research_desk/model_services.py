"""Persistent OpenAI-compatible services and model selection for each LLM workflow."""
import json
import os
import uuid
from urllib.parse import urlsplit

import httpx
from dotenv import dotenv_values, set_key
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator


class ServiceInput(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    base_url: str
    secret: str | None = None

    @field_validator('name')
    @classmethod
    def name_not_empty(cls, value):
        if not value.strip(): raise ValueError('名称不能为空')
        return value.strip()

    @field_validator('base_url')
    @classmethod
    def valid_url(cls, value):
        parsed = urlsplit(value)
        if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise ValueError('请输入有效的服务地址')
        return value.rstrip('/')


class ModelFilterInput(BaseModel):
    keywords: str = Field(default="", max_length=500)


class ModelServices:
    def __init__(self, store):
        self.store = store
        self.secrets = store.directory / 'model-services.env'

    def key(self, identifier):
        stored = dotenv_values(self.secrets).get('MODEL_' + identifier.upper()) if self.secrets.exists() else None
        return stored or (os.getenv('OPENAI_API_KEY') if identifier == 'openai' else None)

    def managed_by(self, identifier):
        return "env" if identifier == "openai" and any(os.getenv(key) for key in ("OPENAI_API_KEY", "OPENAI_BASE_URL", "OPENAI_MODEL")) else "manual"

    def list(self):
        rows = self.store.all("SELECT s.*, COALESCE(f.keywords, '') AS model_filter FROM model_services s LEFT JOIN model_filters f ON f.service_id=s.id ORDER BY s.rowid")
        results = []
        for row in rows:
            models = json.loads(row['models'])
            terms = row['model_filter'].replace('，', ',').lower().split(',')
            terms = [term.strip() for term in terms if term.strip()]
            available = [model for model in models if not terms or any(term in model.lower() for term in terms)]
            results.append({**row, 'managed_by': self.managed_by(row['id']), 'models': models, 'selectable_models': available, 'configured': bool(self.key(row['id']))})
        return results

    def validate_selection(self, selection):
        self.resolve(selection)
        service = next(row for row in self.list() if row['id'] == selection['provider'])
        if selection['model'] not in service['selectable_models']:
            raise ValueError('请选择过滤后的模型')

    def resolve(self, selection):
        service = self.store.one('SELECT * FROM model_services WHERE id=?', (selection['provider'],))
        if not service: raise ValueError('模型服务不存在')
        if not selection.get('model', '').strip(): raise ValueError('请选择模型')
        return {**selection, '_connection': {'url': service['base_url'], 'secret': self.key(service['id'])}}

    def for_workflow(self, purpose):
        settings = self.store.settings()
        selection = settings.get('llm_routes', {}).get(purpose) or {'provider': settings['provider'], 'model': settings['model']}
        return self.resolve(selection)

    def save(self, body, identifier=None):
        identifier = identifier or uuid.uuid4().hex
        existing = self.store.one('SELECT * FROM model_services WHERE id=?', (identifier,))
        if existing and self.managed_by(identifier) == "env":
            raise ValueError("环境配置的服务不可修改，请修改 .env")
        if body.secret:
            self.secrets.touch(mode=0o600, exist_ok=True)
            self.secrets.chmod(0o600)
            set_key(self.secrets, 'MODEL_' + identifier.upper(), body.secret, quote_mode='always')
        models = existing['models'] if existing and existing['base_url'] == body.base_url else '[]'
        self.store.execute('INSERT INTO model_services VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,base_url=excluded.base_url,models=excluded.models', (identifier, body.name, body.base_url, models))
        return next(row for row in self.list() if row['id'] == identifier)

    async def models(self, identifier):
        row = self.store.one('SELECT * FROM model_services WHERE id=?', (identifier,))
        if not row: raise ValueError('模型服务不存在')
        secret = self.key(identifier)
        if not secret: raise ValueError('请先配置密钥')
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                response = await client.get(row['base_url'] + '/models', headers={'Authorization': 'Bearer ' + secret})
            if response.status_code != 200: raise ValueError(f'获取模型列表失败（HTTP {response.status_code}）')
            models = sorted({item['id'] for item in response.json()['data'] if isinstance(item.get('id'), str) and item['id'].strip()})
            if not models: raise ValueError('服务未返回可用模型')
        except (httpx.HTTPError, KeyError, TypeError):
            raise ValueError('模型列表暂时无法获取') from None
        self.store.execute('UPDATE model_services SET models=? WHERE id=?', (json.dumps(models), identifier))
        return {'models': models}


def routes(store):
    router = APIRouter(prefix='/api/model-services')
    services = ModelServices(store)

    @router.post('', status_code=201)
    def create(body: ServiceInput):
        return services.save(body)

    @router.put('/{identifier}')
    def update(identifier: str, body: ServiceInput):
        if not store.one('SELECT id FROM model_services WHERE id=?', (identifier,)): raise HTTPException(404, '模型服务不存在')
        try: return services.save(body, identifier)
        except ValueError as error: raise HTTPException(403, str(error)) from None

    @router.put('/{identifier}/filter')
    def filter_models(identifier: str, body: ModelFilterInput):
        if not store.one('SELECT id FROM model_services WHERE id=?', (identifier,)):
            raise HTTPException(404, '模型服务不存在')
        store.execute('INSERT OR REPLACE INTO model_filters VALUES (?,?)', (identifier, body.keywords.strip()))
        return next(row for row in services.list() if row['id'] == identifier)

    @router.post('/{identifier}/models')
    async def models(identifier: str):
        try: return await services.models(identifier)
        except ValueError as error: raise HTTPException(502, str(error)) from None

    return router
