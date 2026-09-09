import { Component,type ReactNode } from "react";
import { Button } from "./ui";

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <main className="empty" role="alert">
          <strong>页面暂时无法显示</strong>
          <span>应用可能刚刚更新，请重新载入。</span>
          <Button onClick={() => window.location.reload()}>重新载入</Button>
        </main>
      );
    }
    return this.props.children;
  }
}
