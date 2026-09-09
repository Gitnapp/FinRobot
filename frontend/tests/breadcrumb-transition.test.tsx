import { act } from "react";
import { createRoot } from "react-dom/client";
import { RailBreadcrumb } from "@gitnapp/web-shell";
import { afterEach,expect,it,vi } from "vitest";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();});
it('keeps the previous path through fade-out before updating deep-link labels',()=>{
 vi.useFakeTimers();vi.stubGlobal('matchMedia',()=>({matches:false}));
 const animate=vi.fn(()=>({cancel:vi.fn()}));vi.stubGlobal('Animation',class {});Object.defineProperty(Element.prototype,'animate',{configurable:true,value:animate});
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 act(()=>root.render(<RailBreadcrumb items={[{label:'标的列表',href:'/'}]}/>));
 act(()=>root.render(<RailBreadcrumb compact items={[{label:'标的列表',href:'/'},{label:'AMD',href:'/stocks/AMD'}]}/>));
 expect(host.textContent).not.toContain('AMD');
 act(()=>vi.advanceTimersByTime(140));expect(host.textContent).toContain('AMD');expect(animate.mock.calls.length).toBeGreaterThanOrEqual(3);
 act(()=>root.unmount());host.remove();delete (Element.prototype as any).animate;
});
