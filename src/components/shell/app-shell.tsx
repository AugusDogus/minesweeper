import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="shell-root">
      <div className="shell-backdrop" aria-hidden />
      <main className="shell-frame">{children}</main>
    </div>
  );
}
