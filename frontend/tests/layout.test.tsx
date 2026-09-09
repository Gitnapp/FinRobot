import { afterEach,expect,it,vi } from "vitest";
import { act } from "react";
import { createRoot,Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { TooltipProvider } from "@gitnapp/ui/components/ui/tooltip";
import { AsyncContent } from "../src/components/layout/async-content";
import { NavigationLink } from "../src/components/navigation-link";
import { SplitView } from "../src/components/layout/split-view";
let root:Root|undefined;
const mount=(node:React.ReactNode)=>{const host=document.createElement("div");document.body.append(host);root=createRoot(host);act(()=>root!.render(node));return host;};
afterEach(()=>{act(()=>root?.unmount());document.body.innerHTML="";});
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
it("shows local loading and retains content with a refresh error",()=>{
 const host=mount(<AsyncContent hasData={false} pending><p>data</p></AsyncContent>);expect(host.querySelector('[role="status"]')).not.toBeNull();expect(host.textContent).not.toContain("data");
 act(()=>root!.render(<TooltipProvider><AsyncContent hasData pending={false} error={new Error("offline")}><p>cached data</p></AsyncContent></TooltipProvider>));expect(host.textContent).toContain("cached data");expect(host.textContent).toContain("更新失败");
});
it("keeps the last word and arrow together in a wrapped navigation title",()=>{
 const host=mount(<MemoryRouter><NavigationLink to="/stocks/AMD" label="Advanced Micro Devices, Inc." wrap/></MemoryRouter>);expect(host.querySelector('.title-ending')?.textContent).toBe("Inc.");expect(host.querySelector('.title-ending svg')).not.toBeNull();expect(host.querySelector('a')?.getAttribute('href')).toBe('/stocks/AMD');
});
it("makes a closing preview inert and completes only its layout transition",()=>{
 const done=vi.fn();const host=mount(<SplitView open={false} closing onClosed={done} preview={<button>detail</button>}><p>list</p></SplitView>);
 expect(host.querySelector('.split-view-preview')?.hasAttribute('inert')).toBe(true);
 const fire=(propertyName:string)=>{const event=new Event('transitionend',{bubbles:true});Object.defineProperty(event,'propertyName',{value:propertyName});act(()=>host.querySelector('.split-view')!.dispatchEvent(event));};
 fire('opacity');expect(done).not.toHaveBeenCalled();fire('grid-template-columns');expect(done).toHaveBeenCalledTimes(1);
});
