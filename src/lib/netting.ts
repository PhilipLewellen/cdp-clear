export type Party = "A" | "B";
export interface ForwardEconomics {
  instrument: 'GPU compute forward';
  longParty: Party;
  quantity: number;
  strike: number;
  fixing: number;
}
export interface Obligation {
  id: string;
  receiver: Party; // the party that receives cash; the other party pays
  amount: number;
  currency: string;
  settlementDate?: string;
  lifecycle?: 'Captured' | 'Validated';
  eligible?: boolean;
  economics?: ForwardEconomics;
}

export function forwardPayoff(e: ForwardEconomics) {
  return Math.round(e.quantity * (e.fixing - e.strike) * 100) / 100;
}
export function deriveObligation(trade: Obligation): Obligation {
  if (!trade.economics) return trade;
  const payoff = forwardPayoff(trade.economics);
  return { ...trade, amount: Math.abs(payoff), receiver: payoff >= 0 ? trade.economics.longParty : trade.economics.longParty === 'A' ? 'B' : 'A' };
}
/** Upgrade old cash rows without replacing saved values or contract metadata. */
export function upgradeObligation(trade: Obligation): Obligation {
  if (trade.economics) return deriveObligation(trade);
  const sample = SAMPLE_OBLIGATIONS.find(row => row.id === trade.id)?.economics;
  const quantity = sample?.quantity ?? 100;
  const strike = sample?.strike ?? 3;
  return deriveObligation({ ...trade, economics: { instrument: 'GPU compute forward', longParty: 'A', quantity, strike, fixing: strike + (trade.receiver === 'A' ? trade.amount : -trade.amount) / quantity } });
}

export const SAMPLE_OBLIGATIONS: Obligation[] = [
  { id: "T-001", receiver: "A", amount: 2000, currency: "USD", settlementDate: '2026-10-26', lifecycle: 'Validated', eligible: true, economics: { instrument: 'GPU compute forward', longParty: 'A', quantity: 1000, strike: 3, fixing: 5 } },
  { id: "T-002", receiver: "B", amount: 800, currency: "USD", settlementDate: '2026-10-26', lifecycle: 'Validated', eligible: true, economics: { instrument: 'GPU compute forward', longParty: 'A', quantity: 400, strike: 4, fixing: 2 } },
  { id: "T-003", receiver: "A", amount: 300, currency: "USD", settlementDate: '2026-10-26', lifecycle: 'Validated', eligible: true, economics: { instrument: 'GPU compute forward', longParty: 'A', quantity: 300, strike: 3, fixing: 4 } },
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
  if (obs.some(o => o.economics && (!Number.isFinite(o.economics.quantity) || o.economics.quantity <= 0 || !Number.isFinite(o.economics.strike) || o.economics.strike < 0 || !Number.isFinite(o.economics.fixing) || o.economics.fixing < 0)))
    return { ...base, ok: false, error: 'GPU quantity must be positive; strike and simulated fixing must be non-negative finite prices.' };
  if (obs.some(o => o.economics && (deriveObligation(o).amount !== o.amount || deriveObligation(o).receiver !== o.receiver)))
    return { ...base, ok: false, error: 'Cash obligations must match the GPU-forward economics.' };
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
