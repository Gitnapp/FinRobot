"""Durable step-based jobs. Definitions own work; the queue owns lifecycle and retry."""
import asyncio
import json
import uuid
from dataclasses import dataclass
from .store import now


@dataclass(frozen=True)
class TaskDefinition:
    title: str
    steps: tuple


class TaskQueue:
    def __init__(self, store, definitions):
        self.store, self.definitions = store, definitions

    def submit(self, kind, payload):
        if kind not in self.definitions: raise ValueError('unknown_task_kind')
        dedupe = f"{kind}:{payload['symbol']}:{payload.get('list_id', '')}"
        with self.store.connection() as db:
            db.execute('BEGIN IMMEDIATE')
            active = db.execute("SELECT id FROM task_queue WHERE dedupe=? AND status IN ('queued','running')", (dedupe,)).fetchone()
            if active: identifier = active['id']
            else:
                identifier = uuid.uuid4().hex
                db.execute("INSERT INTO task_queue(id,kind,payload,dedupe,status,step,warnings,created_at) VALUES (?,?,?,?,'queued',0,'[]',?)", (identifier,kind,json.dumps(payload),dedupe,now()))
        return self.read(identifier)

    def view(self,row):
        payload=json.loads(row['payload']);definition=self.definitions[row['kind']]
        price=self.store.one('SELECT value FROM cache WHERE key=?',('price-bundle:'+payload['symbol'],))
        name=json.loads(price['value']).get('quote',{}).get('name') if price else None
        steps=[step[0] for step in definition.steps]
        detail_url=('/coverage/' if row['kind']=='track_asset' else '/stocks/')+payload['symbol']
        return {'id':row['id'],'kind':row['kind'],'title':definition.title,'scope':{'list_id':payload.get('list_id')},'subject':{'symbol':payload['symbol'],'name':name or payload['symbol']},'status':row['status'],'steps':steps,'completed_steps':row['step'],'current_step':steps[row['step']] if row['status']=='running' and row['step']<len(steps) else None,'queue_position':None,'created_at':row['created_at'],'completed_at':row['completed_at'],'error':row['error'],'warnings':json.loads(row['warnings']),'result_url':detail_url if row['status']=='completed' else None,'detail_url':detail_url if row['step']>0 else None}

    def read(self,identifier):
        row=self.store.one('SELECT * FROM task_queue WHERE id=?',(identifier,))
        return self.view(row) if row else None

    def list(self):
        return [self.view(row) for row in self.store.all("SELECT * FROM task_queue WHERE status IN ('queued','running') ORDER BY created_at") + self.store.all("SELECT * FROM task_queue WHERE status IN ('completed','failed') ORDER BY created_at DESC LIMIT 10")]

    def retry(self,identifier):
        with self.store.connection() as db:
            db.execute('BEGIN IMMEDIATE')
            row=db.execute('SELECT * FROM task_queue WHERE id=?',(identifier,)).fetchone()
            if not row: raise LookupError('task_not_found')
            if row['status']!='failed' and not (row['status']=='completed' and json.loads(row['warnings'])): raise ValueError('task_not_retryable')
            active=db.execute("SELECT id FROM task_queue WHERE dedupe=? AND status IN ('queued','running')",(row['dedupe'],)).fetchone()
            if active: return self.read(active['id'])
            db.execute("UPDATE task_queue SET status='queued',step=0,warnings='[]',error=NULL,completed_at=NULL,created_at=? WHERE id=?",(now(),identifier))
        return self.read(identifier)

    async def process_one(self):
        with self.store.connection() as db:
            db.execute('BEGIN IMMEDIATE')
            row=db.execute("SELECT * FROM task_queue WHERE status='queued' ORDER BY created_at,id LIMIT 1").fetchone()
            if not row:return False
            row=dict(row)
            db.execute("UPDATE task_queue SET status='running' WHERE id=?",(row['id'],))
        warnings=[]
        try:
            payload=json.loads(row['payload'])
            for index,(_,handler) in enumerate(self.definitions[row['kind']].steps):
                self.store.execute('UPDATE task_queue SET step=? WHERE id=?',(index,row['id']))
                async with asyncio.timeout(90):result=await handler(payload)
                warnings.extend(result or [])
                self.store.execute('UPDATE task_queue SET step=?,warnings=? WHERE id=?',(index+1,json.dumps(warnings),row['id']))
            self.store.execute("UPDATE task_queue SET status='completed',completed_at=? WHERE id=?",(now(),row['id']))
        except asyncio.CancelledError:
            # All registered steps are idempotent; queued work resumes on restart.
            self.store.execute("UPDATE task_queue SET status='queued' WHERE id=?",(row['id'],))
            raise
        except Exception:
            self.store.execute("UPDATE task_queue SET status='failed',error='处理未完成，可重试；已完成的添加不会重复。',completed_at=? WHERE id=?",(now(),row['id']))
        return True

    async def run(self):
        self.store.execute("UPDATE task_queue SET status='queued' WHERE status='running'")
        while True:
            if not await self.process_one(): await asyncio.sleep(.5)
