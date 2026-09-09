import { describe,it,expect,vi } from "vitest";
import { QueryObserver } from "@tanstack/react-query";
import { createQueryClient, invalidateDomain } from "../src/api/query-policy";
import { api,ApiError } from "../src/api/client";

describe("request contract",()=>{
  it("deduplicates cached reads, and cancellation reaches the transport",async()=>{
    const client=createQueryClient();const fn=vi.fn(async()=>({price:12}));
    await client.fetchQuery({queryKey:["assets"],queryFn:fn});await client.fetchQuery({queryKey:["assets"],queryFn:fn});expect(fn).toHaveBeenCalledTimes(1);
    let signal:AbortSignal|undefined;
    const observer=new QueryObserver(client,{queryKey:["detail","NEW"],queryFn:({signal:next})=>{signal=next;return new Promise((_resolve,reject)=>next.addEventListener("abort",()=>reject(new DOMException("aborted","AbortError"))));}});
    const stop=observer.subscribe(()=>{});expect(signal?.aborted).toBe(false);stop();expect(signal?.aborted).toBe(true);client.clear();
  });
  it("keeps the last good value after a failed refresh and never retries authorization failures",async()=>{
    const client=createQueryClient();client.setQueryData(["assets"],[{symbol:"AAPL"}]);
    const fail=vi.fn(async()=>{throw new ApiError("denied",401);});
    await expect(client.fetchQuery({queryKey:["assets"],queryFn:fail,staleTime:0})).rejects.toThrow("denied");
    expect(fail).toHaveBeenCalledTimes(1);expect(client.getQueryData(["assets"])).toEqual([{symbol:"AAPL"}]);client.clear();
  });
  it("does not invalidate prices when changing model service settings",async()=>{
    const client=createQueryClient();client.setQueryData(["assets"],[]);client.setQueryData(["settings"],{});
    await invalidateDomain(client,"settings");expect(client.getQueryState(["assets"])?.isInvalidated).toBe(false);expect(client.getQueryState(["settings"])?.isInvalidated).toBe(true);client.clear();
  });
  it("only task polling survives a hidden tab and stops for completed receipts",()=>{
    const client=createQueryClient();expect(client.getDefaultOptions().queries?.refetchIntervalInBackground).toBe(false);expect(client.getQueryDefaults(["tasks"]).refetchIntervalInBackground).toBe(true);
    const poll=client.getQueryDefaults(["task"]).refetchInterval as (query:any)=>number|false;
    expect(poll({state:{data:{status:"running"}}})).toBe(1500);expect(poll({state:{data:{status:"completed"}}})).toBe(false);client.clear();
  });
  it("uses one HTTP cache and forwards caller cancellation",async()=>{
    const abort=new AbortController();let request:RequestInit|undefined;
    vi.stubGlobal("fetch",vi.fn((_url,options)=>{request=options;return Promise.resolve(new Response(JSON.stringify({ok:true}),{status:200}));}));
    await api("/settings",{signal:abort.signal});expect(request?.cache).toBe("no-store");abort.abort();expect(request?.signal?.aborted).toBe(true);vi.unstubAllGlobals();
  });
});
