import type { ReactNode } from "react";
export function PageHeader({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div data-slot="page-header" className="page-heading">
      <div>
        <h1>{title}</h1>
      </div>
      {children && <div className="actions">{children}</div>}
    </div>
  );
}
