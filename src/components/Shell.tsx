import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useStore } from "@/lib/store";
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, RotateCcw } from 'lucide-react';

const tabs = [
  { to: "/", label: "1. Trade Capture & Lifecycle" },
  { to: "/netting", label: "2. Bilateral Payment Netting" },
  { to: "/settlement", label: "3. Cash-Leg Settlement & Reconciliation" },
] as const;

export function Shell({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  const { reset } = useStore();
  return (
    <div className="min-h-screen">
      <div className="border-b border-warning/30 bg-warning/10 px-4 py-2 text-center text-xs text-warning">
        SIMULATION / TESTNET VERIFICATION · Stellar Testnet · No real funds · Public addresses only
      </div>
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-primary font-display text-sm font-bold text-primary-foreground">CDP</div>
            <div>
              <div className="font-display text-lg font-semibold">CDP Clear</div>
              <div className="max-w-xl text-xs text-muted-foreground">Bilateral Payment Netting & USDC Cash-Leg Settlement for Tokenised Compute Derivatives</div>
            </div>
          </div>
          <nav aria-label="Operations workflow" className="flex w-full flex-wrap gap-1 border-t border-border pt-3">
            {tabs.map((t) => (
              <Button key={t.to} asChild variant="ghost" className="h-auto whitespace-normal text-left"><Link to={t.to} className="text-sm text-muted-foreground"
                activeProps={{ className: "bg-secondary text-foreground" }} activeOptions={{ exact: true }}>
                {t.label}
              </Link></Button>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <h1 className="font-display text-2xl font-semibold">{title}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{intro}</p>
        <div className="mt-6 space-y-5">{children}</div>
      </main>
      <footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 pb-8 text-xs text-muted-foreground sm:px-6">
        <span>HackMeridian · Illustrative derivatives obligations · Not a production settlement system</span>
        <Button variant="ghost" size="sm" onClick={reset}><RotateCcw />Reset demo data</Button>
      </footer>
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`border-y border-border bg-card/40 px-0 py-5 ${className}`}>{children}</section>;
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

export function Term({ label, meaning }: { label: string; meaning: string }) {
  return <TooltipProvider delayDuration={150}><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="sm" className="h-auto whitespace-normal px-0 text-left text-xs text-muted-foreground">{label}<Info className="size-3 shrink-0" /></Button></TooltipTrigger><TooltipContent className="max-w-xs">{meaning}</TooltipContent></Tooltip></TooltipProvider>;
}
