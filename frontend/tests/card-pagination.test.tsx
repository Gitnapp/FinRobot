import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect,it } from "vitest";
import { CardPagination,useCardPage } from "@gitnapp/ui/components/ui/card-pagination";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
it("pages every item, clamps after data shrinks, and resets on subject changes",()=>{
 const element=document.createElement('div');document.body.append(element);const root=createRoot(element);
 function Harness({items,scope}:{items:number[];scope:string}) {const page=useCardPage(items,3,scope);return <><output>{page.items.join(',')}</output><CardPagination {...page} onChange={page.setPage} label="测试分页"/></>;}
 const render=(items:number[],scope='AMD')=>act(()=>root.render(<Harness items={items} scope={scope}/>));
 render([1,2,3,4,5,6,7]);expect(element.querySelector('output')?.textContent).toBe('1,2,3');
 act(()=>(element.querySelector('[aria-label="下一页"]') as HTMLButtonElement).click());expect(element.querySelector('output')?.textContent).toBe('4,5,6');
 act(()=>(element.querySelector('[aria-label="下一页"]') as HTMLButtonElement).click());expect(element.querySelector('output')?.textContent).toBe('7');expect((element.querySelector('[aria-label="下一页"]') as HTMLButtonElement).disabled).toBe(true);
 render([1,2]);expect(element.querySelector('output')?.textContent).toBe('1,2');expect(element.querySelector('[aria-label="下一页"]')).toBeNull();
 render([8,9,10,11],'NVDA');expect(element.querySelector('output')?.textContent).toBe('8,9,10');
 act(()=>root.unmount());element.remove();
});
