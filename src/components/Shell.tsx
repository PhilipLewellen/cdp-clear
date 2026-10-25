import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useStore } from "@/lib/use-store";
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, RotateCcw } from 'lucide-react';

const tabs = [
  { to: "/", label: "Obligations" },
  { to: "/netting", label: "Netting" },
  { to: "/settlement", label: "Settlement" },
  { to: "/activity", label: "Activity" },
] as const;

export function Shell({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  const { reset } = useStore();
  return (
    <div className="workstation min-h-screen">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <span className="font-display text-base font-semibold">CDP Clear</span>
          <span className="text-[11px] text-muted-foreground">STELLAR TESTNET <span className="mx-2 text-border">/</span> USDC <span className="mx-2 text-border">/</span> <b className="font-medium text-warning">DEMO · NO REAL FUNDS</b></span>
        </div>
      </header>
      <nav aria-label="Operations workflow" className="border-b border-border">
        <div className="mx-auto flex max-w-[1480px] gap-2 px-4 sm:px-6">
          {tabs.map(t => <Button key={t.to} asChild variant="ghost" className="!h-10 !rounded-none border-b-2 border-transparent px-3"><Link to={t.to} className="text-muted-foreground" activeProps={{ className: "!border-primary !text-primary bg-card" }} activeOptions={{ exact: true }}>{t.label}</Link></Button>)}
        </div>
      </nav>
      <main className="mx-auto max-w-[1480px] px-4 py-5 sm:px-6">
        <div className="mb-4">
          <h1 className="font-display text-xl font-semibold">{title}</h1>
          <p className="mt-1 text-xs text-muted-foreground">{intro}</p>
        </div>
        <div className="space-y-4">{children}</div>
      </main>
      <footer className="mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-2 px-4 pb-5 text-[10px] text-muted-foreground sm:px-6">
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
  return <span className={`inline-block text-xs font-medium ${m}`}>{children}</span>;
}

export function Term({ label, meaning }: { label: string; meaning: string }) {
  return <TooltipProvider delayDuration={150}><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="sm" className="h-auto whitespace-normal px-0 text-left text-xs text-muted-foreground">{label}<Info className="size-3 shrink-0" /></Button></TooltipTrigger><TooltipContent className="max-w-xs">{meaning}</TooltipContent></Tooltip></TooltipProvider>;
}
