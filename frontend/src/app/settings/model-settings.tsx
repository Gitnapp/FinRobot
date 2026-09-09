import { OverflowText } from "@gitnapp/ui/components/ui/overflow-text";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@gitnapp/ui/components/ui/table";
import { useState } from "react";
import { Plus, RefreshCw, Server, Check } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardAction, CardFooter } from "@gitnapp/ui/components/ui/card";
import { Label } from "@gitnapp/ui/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@gitnapp/ui/components/ui/select";
import { InfoHint } from "@gitnapp/ui/components/ui/tooltip";
import { Button, Input } from "../../components/ui";
import { api, write } from "../../api/client";
import { useRefresh } from "../../hooks/queries";
import type { Settings, Provider } from "../../types";
import { toast } from "sonner";

type Choice = {provider:string;model:string};
function ServiceEditor({service,onSaved}: {service?:Provider;onSaved:(id:string)=>void}) {
  const locked = service?.managed_by === "env";
  const [name,setName]=useState(service?.name || "");
  const [url,setUrl]=useState(service?.base_url || "");
  const [secret,setSecret]=useState("");
  const [keywords,setKeywords]=useState(service?.model_filter || "");
  const [models,setModels]=useState(service?.models || []);
  const [busy,setBusy]=useState("");
  const refresh=useRefresh();
  async function save() {
    setBusy("save");
    try {
      const result=await write<Provider>(service ? `/model-services/${service.id}` : '/model-services',{name,base_url:url,...(secret ? {secret} : {})},service ? 'PUT':'POST');
      setSecret("");await refresh();onSaved(result.id);toast.success("模型服务已保存");
    }catch(e){toast.error((e as Error).message);}finally{setBusy("");}
  }
  async function discover() {
    if (!service) return;
    setBusy("models");
    try { const result=await write<{models:string[]}>(`/model-services/${service.id}/models`,{});setModels(result.models);await refresh();toast.success(`已获取 ${result.models.length} 个模型`); }
    catch(e){toast.error((e as Error).message);}finally{setBusy("");}
  }
  async function saveFilter() {
    if (!service) return;
    setBusy("filter");
    try {await write(`/model-services/${service.id}/filter`,{keywords},"PUT");await refresh();toast.success("模型过滤已保存");}
    catch(e){toast.error((e as Error).message);}finally{setBusy("");}
  }
  const terms = keywords.replaceAll("，", ",").split(",").map(term => term.trim().toLowerCase()).filter(Boolean);
  const filteredModels = models.filter(model => !terms.length || terms.some(term => model.toLowerCase().includes(term)));
  const filterChanged = keywords.trim() !== (service?.model_filter || "");
  return <section className="service-editor">
    <div className="service-fields">
      {locked && <div className="muted">环境配置 <InfoHint>此服务由 .env 配置，名称、地址和密钥不可在页面修改。</InfoHint></div>}
      <div><Label htmlFor="service-name">服务名称</Label><Input id="service-name" readOnly={locked} value={name} onChange={e=>setName(e.target.value)} placeholder="模型服务名称"/></div>
      <div><Label htmlFor="service-url">Base URL <InfoHint>支持 OpenAI 兼容接口，填写包含版本路径的地址，如 https://example.com/v1。</InfoHint></Label><Input id="service-url" readOnly={locked} value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://example.com/v1"/></div>
      <div><Label htmlFor="service-key">API Key</Label><Input id="service-key" readOnly={locked} type="password" autoComplete="new-password" value={secret} onChange={e=>setSecret(e.target.value)} placeholder={service?.configured ? "已配置，留空保留现有密钥" : "输入密钥"}/></div>
      <section className="model-catalog" aria-label="模型列表">
        <div className="model-catalog-heading">
          <h3>模型列表</h3><span className="muted">{filteredModels.length} / {models.length}</span>
          <InfoHint>按模型名称过滤，多个关键词用逗号分隔。应用后，下方模型选择仅显示匹配结果。</InfoHint>
          <Button variant="ghost" size="icon" aria-label="获取模型列表" disabled={!!busy || !service?.configured} onClick={()=>void discover()}><RefreshCw size={15} className={busy==='models'?'animate-spin':''}/></Button>
        </div>
        {service && <div className="model-catalog-toolbar">
          <Label htmlFor="model-filter" className="sr-only">模型过滤</Label>
          <Input id="model-filter" value={keywords} onChange={e=>setKeywords(e.target.value)} placeholder="过滤模型，如 qwen, gpt"/>
          <Button variant="outline" disabled={!!busy || !filterChanged} onClick={()=>void saveFilter()}>{busy==='filter'?'保存中…':'应用过滤'}</Button>
        </div>}
        <div className="model-catalog-list" key={keywords}>
          {filteredModels.length ? filteredModels.map(model=><div className="model-catalog-item" key={model}><OverflowText text={model}/></div>) : <div className="model-catalog-empty">{models.length ? "没有匹配的模型" : "尚未获取模型"}</div>}
        </div>
      </section>
    </div>
    {!locked && <div className="service-actions"><Button disabled={ !!busy || !name.trim() || !url.trim() || (!service && !secret)} onClick={()=>void save()}>{busy==='save'?'保存中…':'保存服务'}</Button></div>}
  </section>;
}
function ModelChoices({settings}:{settings:Settings}) {
  const initial={provider:settings.provider,model:settings.model};
  const [choices,setChoices]=useState<Record<string,Choice>>({default:initial,report:settings.llm_routes?.report || initial,assumptions:settings.llm_routes?.assumptions || initial});
  const [busy,setBusy]=useState("");
  const refresh=useRefresh();
  async function save() {
    setBusy("save");try{await write('/settings',{...choices.default,data_mode:'auto',llm_routes:{report:choices.report,assumptions:choices.assumptions}},'PUT');await refresh();toast.success('模型选择已保存');}catch(e){toast.error((e as Error).message);}finally{setBusy("");}
  }
  async function test(key:string) {setBusy(key);try{await write('/settings/test',{...choices[key],data_mode:'auto'});toast.success('模型连接成功');}catch(e){toast.error((e as Error).message);}finally{setBusy("");}}
  return <Card className="model-choice-card"><CardHeader><CardTitle>模型选择</CardTitle></CardHeader><CardContent>
    <Table className="model-choice-table"><TableHeader><TableRow><TableHead>调用场景</TableHead><TableHead>模型服务</TableHead><TableHead>模型名称</TableHead><TableHead>连接测试</TableHead></TableRow></TableHeader><TableBody>
    {[["default","默认模型"],["report","研究报告"],["assumptions","预测假设"]].map(([key,label])=>{
      const choice=choices[key],service=settings.providers.find(p=>p.id===choice.provider);
      return <TableRow key={key}><TableCell>{label}</TableCell><TableCell><Select value={choice.provider} onValueChange={provider=>setChoices({...choices,[key]:{provider,model:settings.providers.find(p=>p.id===provider)?.selectable_models[0] || ''}})}><SelectTrigger className="w-full" aria-label={`${label}服务`}><SelectValue/></SelectTrigger><SelectContent>{settings.providers.map(p=><SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></TableCell>
        <TableCell><Select value={service?.selectable_models.includes(choice.model) ? choice.model : ""} onValueChange={model=>setChoices({...choices,[key]:{...choice,model}})} disabled={!service?.selectable_models.length}><SelectTrigger className="w-full" aria-label={`${label}模型`}><SelectValue placeholder={service?.selectable_models.length ? "请选择模型" : "无匹配模型"}/></SelectTrigger><SelectContent>{service?.selectable_models.map(model=><SelectItem key={model} value={model}>{model}</SelectItem>)}</SelectContent></Select></TableCell>
        <TableCell><Button variant="outline" disabled={!!busy || !service?.configured || !service.selectable_models.includes(choice.model)} onClick={()=>void test(key)}>{busy===key?'连接中…':'测试'}</Button></TableCell>
      </TableRow>;
    })}
    </TableBody></Table></CardContent><CardFooter className="justify-end"><Button disabled={!!busy || Object.values(choices).some(c=>!settings.providers.find(p=>p.id===c.provider)?.selectable_models.includes(c.model))} onClick={()=>void save()}>保存选择</Button>
  </CardFooter></Card>;
}
export function ModelSettings({settings}:{settings:Settings}) {
  const [selected,setSelected]=useState<string|null>(settings.provider);
  const service=settings.providers.find(p=>p.id===selected);
  return <>
    <Card><CardHeader><CardTitle>模型服务</CardTitle><CardAction><Button variant="outline" size="sm" onClick={()=>setSelected(null)}><Plus size={16}/>添加服务</Button></CardAction></CardHeader>
    <CardContent className="service-layout"><nav className="service-navigation" aria-label="模型服务">
      {settings.providers.map(p=><Button variant={selected===p.id ? "secondary" : "outline"} key={p.id} aria-pressed={selected===p.id} onClick={()=>setSelected(p.id)}><Server size={16}/><span className="model-service-name">{p.name}<small>{p.configured?'已配置':'未配置'}</small></span>{selected===p.id && <Check size={14}/>}</Button>)}
    </nav><ServiceEditor key={selected || 'new'} service={service} onSaved={setSelected}/></CardContent></Card>
    <ModelChoices settings={settings}/>
  </>;
}
