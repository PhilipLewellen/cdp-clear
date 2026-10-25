export type Party = "A" | "B";
export interface Obligation {
  id: string;
  receiver: Party; // the party that receives cash; the other party pays
  amount: number;
  currency: string;
  settlementDate?: string;
  lifecycle?: 'Captured' | 'Validated';
  eligible?: boolean;
}

export const SAMPLE_OBLIGATIONS: Obligation[] = [
  { id: "T-001", receiver: "A", amount: 2000, currency: "USD", settlementDate: '2026-10-26', lifecycle: 'Validated', eligible: true },
  { id: "T-002", receiver: "B", amount: 800, currency: "USD", settlementDate: '2026-10-26', lifecycle: 'Validated', eligible: true },
  { id: "T-003", receiver: "A", amount: 300, currency: "USD", settlementDate: '2026-10-26', lifecycle: 'Validated', eligible: true },
];

export interface NetResult {
  ok: boolean;
  error?: string;
  currency: string;
  gross: number;
  aReceives: number;
  bReceives: number;
  net: number;
  payer: Party | null;
  payee: Party | null;
  reduction: number;
}

/** Bilateral netting for a single currency between A and B. */
export function netObligations(obs: Obligation[]): NetResult {
  const currencies = new Set(obs.map((o) => o.currency.trim().toUpperCase()));
  const currency = [...currencies][0] ?? "USD";
  const base = { currency, gross: 0, aReceives: 0, bReceives: 0, net: 0, payer: null, payee: null, reduction: 0 };
  if (currencies.size > 1)
    return { ...base, ok: false, error: "Mixed currencies cannot be netted bilaterally." };
  if (new Set(obs.map(o => o.settlementDate ?? '2026-10-26')).size > 1)
    return { ...base, ok: false, error: 'Matching settlement dates are required within the netting set.' };
  if (obs.some(o => o.eligible === false))
    return { ...base, ok: false, error: 'All obligations in this netting set must be eligible.' };
  if (obs.some((o) => !Number.isFinite(o.amount) || o.amount < 0))
    return { ...base, ok: false, error: "Amounts must be non-negative numbers." };
  const cents = (n: number) => Math.round(n * 100);
  const aR = obs.filter((o) => o.receiver === "A").reduce((s, o) => s + cents(o.amount), 0);
  const bR = obs.filter((o) => o.receiver === "B").reduce((s, o) => s + cents(o.amount), 0);
  const gross = aR + bR;
  const diff = aR - bR;
  const net = Math.abs(diff);
  return {
    ok: true,
    currency,
    gross: gross / 100,
    aReceives: aR / 100,
    bReceives: bR / 100,
    net: net / 100,
    payer: diff > 0 ? "B" : diff < 0 ? "A" : null,
    payee: diff > 0 ? "A" : diff < 0 ? "B" : null,
    reduction: (gross - net) / 100,
  };
}

export const fmt = (n: number, ccy = "USD") =>
  `${ccy} ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
