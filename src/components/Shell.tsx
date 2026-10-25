import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useStore } from "@/lib/store";
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, RotateCcw } from 'lucide-react';

const tabs = [
  { to: "/", label: "Trade Capture" },
  { to: "/netting", label: "Payment Netting" },
  { to: "/settlement", label: "Settlement & Reconciliation" },
] as const;

export function Shell({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  const { reset } = useStore();
  return (
    <div className="workstation min-h-screen">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1480px] flex-wrap items-center gap-x-10 px-4 sm:px-7">
          <div className="flex shrink-0 items-center gap-2.5 py-4">
            <div aria-hidden="true" className="grid size-7 place-items-center border border-primary/50 font-mono text-sm font-semibold text-primary">C</div>
            <span className="font-display text-base font-semibold">CDP Clear</span>
          </div>
          <nav aria-label="Operations workflow" className="flex max-w-full gap-1 overflow-x-auto self-stretch">
            {tabs.map((t, i) => <Button key={t.to} asChild variant="ghost" className="!h-auto !rounded-none border-b-2 border-transparent px-3 py-3"><Link to={t.to} className="whitespace-nowrap text-muted-foreground" activeProps={{ className: "!border-primary !text-primary" }} activeOptions={{ exact: true }}><span className="mr-1 font-mono text-[10px] opacity-50">0{i + 1}</span>{t.label}</Link></Button>)}
          </nav>
          <span className="ml-auto hidden text-[10px] text-muted-foreground xl:block">BILATERAL POST-TRADE OPERATIONS</span>
        </div>
      </header>
      <div className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-[1480px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 text-[10px] text-muted-foreground sm:px-7">
          <span>Environment <b className="ml-1 font-medium text-warning">DEMO</b></span>
          <span>Network <b className="ml-1 font-medium text-foreground">Stellar Testnet</b></span>
          <span>Settlement Asset <b className="ml-1 font-mono text-foreground">USDC</b></span>
          <span>Netting Set <b className="ml-1 font-mono text-foreground">NS-AB-001</b></span>
          <span className="flex items-center gap-1.5 sm:ml-auto"><span className="size-1.5 rounded-full bg-primary" />Verification available · public Horizon</span>
        </div>
      </div>
      <main className="mx-auto max-w-[1480px] px-4 py-5 sm:px-7">
        <div className="mb-5 border-b border-border pb-4">
          <h1 className="font-display text-xl font-semibold">{title}</h1>
          <p className="mt-1 text-xs text-muted-foreground">{intro}</p>
        </div>
        <div className="space-y-4">{children}</div>
      </main>
      <footer className="mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-2 px-4 pb-5 text-[10px] text-muted-foreground sm:px-7">
        <span>HackMeridian · Illustrative obligations · Testnet only / no real funds</span>
        <Button variant="ghost" size="sm" onClick={reset}><RotateCcw className="size-3" />Reset demo data</Button>
      </footer>
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`border-y border-border bg-card px-4 py-4 ${className}`}>{children}</section>;
}

export function Tag({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "warning" | "success" | "primary" }) {
  const m = {
    muted: "text-muted-foreground",
    warning: "text-warning",
    success: "text-success",
    primary: "text-primary",
  }[tone];
  return <span className={`inline-block text-[10px] font-medium ${m}`}>{children}</span>;
}

export const inputCls =
  "w-full rounded-sm border border-input bg-background px-2.5 py-1.5 text-xs text-foreground font-mono outline-none focus:border-ring";
export const btnCls =
  "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50";
export const btnGhost =
  "inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary disabled:opacity-50";

export function Term({ label, meaning }: { label: string; meaning: string }) {
  return <TooltipProvider delayDuration={150}><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="sm" className="h-auto whitespace-normal px-0 text-left text-xs text-muted-foreground">{label}<Info className="size-3 shrink-0" /></Button></TooltipTrigger><TooltipContent className="max-w-xs">{meaning}</TooltipContent></Tooltip></TooltipProvider>;
}
