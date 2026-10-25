import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useStore } from "@/lib/store";

const tabs = [
  { to: "/", label: "1 · Trades" },
  { to: "/netting", label: "2 · Netting" },
  { to: "/settlement", label: "3 · Settlement" },
] as const;

export function Shell({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  const { reset } = useStore();
  return (
    <div className="min-h-screen">
      <div className="border-b border-warning/30 bg-warning/10 px-4 py-2 text-center text-xs text-warning">
        DEMO ONLY · Stellar testnet · No real funds · No keys stored or used · Party names and values are simulated
      </div>
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-primary font-display text-sm font-bold text-primary-foreground">CDP</div>
            <div>
              <div className="font-display text-lg font-semibold">CDP Clear</div>
              <div className="text-xs text-muted-foreground">Clearing · Netting · Settlement — HackMeridian demo</div>
            </div>
          </div>
          <nav className="flex gap-1">
            {tabs.map((t) => (
              <Link key={t.to} to={t.to} className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "bg-secondary text-foreground" }} activeOptions={{ exact: true }}>
                {t.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="font-display text-3xl font-semibold">{title}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{intro}</p>
        <div className="mt-8 space-y-6">{children}</div>
      </main>
      <footer className="mx-auto max-w-5xl px-6 pb-10 text-xs text-muted-foreground">
        <button onClick={reset} className="underline hover:text-foreground">Reset demo data</button>
      </footer>
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-border bg-card p-6 ${className}`}>{children}</section>;
}

export function Tag({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "warning" | "success" | "primary" }) {
  const m = {
    muted: "bg-secondary text-muted-foreground",
    warning: "bg-warning/15 text-warning",
    success: "bg-success/15 text-success",
    primary: "bg-primary/15 text-primary",
  }[tone];
  return <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${m}`}>{children}</span>;
}

export const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono outline-none focus:border-ring";
export const btnCls =
  "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50";
export const btnGhost =
  "inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary disabled:opacity-50";
