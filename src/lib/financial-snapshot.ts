import { deriveObligation, netObligations, type Obligation } from './netting';

export interface FinancialSnapshot {
  schemaVersion: 'cdp-clear-financial-snapshot/v1';
  instructionId: string;
  createdAt: string;
  contracts: Array<{
    id: string; currency: string; settlementDate: string | null; eligible: boolean;
    lifecycle: string | null; instrument: string | null; longParty: string | null;
    quantityGpuHours: string | null; forwardPrice: string | null; fixingPrice: string | null;
    payer: string; receiver: string; cashObligation: string;
  }>;
  netting: {
    id: string; assumptions: string[]; currency: string; gross: string; net: string;
    aReceives: string; bReceives: string; reduction: string; payer: string | null; receiver: string | null;
  };
  demonstration: { divisor: string; ratio: string; scaledGross: string; scaledNet: string; conversion: string };
  expectedAtCreation: { network: string; assetCode: string; assetIssuer: string; amount: string; sender: string | null; recipient: string | null };
}

/** Object keys sort lexically; arrays retain order. Only JSON values are accepted. */
export function canonicalSnapshot(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalSnapshot).join(',')}]`;
  if (typeof value === 'object' && value) {
    return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => `${JSON.stringify(key)}:${canonicalSnapshot(item)}`).join(',')}}`;
  }
  throw new Error('Snapshot contains a non-JSON or non-finite value.');
}

export async function fingerprintSnapshot(snapshot: unknown): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalSnapshot(snapshot)));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export type Integrity = 'Verified — snapshot unchanged' | 'Warning — snapshot fingerprint mismatch' | 'Historical snapshot unavailable' | 'Fingerprint unavailable' | 'Integrity verification unavailable';
export async function checkSnapshotIntegrity(snapshot?: FinancialSnapshot, fingerprint?: string): Promise<Integrity> {
  if (!snapshot) return 'Historical snapshot unavailable';
  if (!fingerprint) return 'Fingerprint unavailable';
  try { return await fingerprintSnapshot(snapshot) === fingerprint ? 'Verified — snapshot unchanged' : 'Warning — snapshot fingerprint mismatch'; }
  catch { return 'Integrity verification unavailable'; }
}

export function captureFinancialSnapshot(trades: Obligation[], instruction: {
  id: string; createdAt: string; divisor: number; scaledGross: number; scaledNet: number;
  network: string; assetCode: string; assetIssuer: string; usdcAmount: string; payerAddress: string; recipient: string;
}): FinancialSnapshot {
  const net = netObligations(trades);
  if (!net.ok) throw new Error(net.error ?? 'Netting unavailable.');
  return {
    schemaVersion: 'cdp-clear-financial-snapshot/v1', instructionId: instruction.id, createdAt: instruction.createdAt,
    contracts: [...trades].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).map(row => {
      const derived = deriveObligation(row);
      return {
        id: row.id, currency: row.currency, settlementDate: row.settlementDate ?? null, eligible: row.eligible !== false,
        lifecycle: row.lifecycle ?? null, instrument: row.economics?.instrument ?? null, longParty: row.economics?.longParty ?? null,
        quantityGpuHours: row.economics?.quantity.toString() ?? null, forwardPrice: row.economics?.strike.toString() ?? null,
        fixingPrice: row.economics?.fixing.toString() ?? null, payer: derived.receiver === 'A' ? 'B' : 'A',
        receiver: derived.receiver, cashObligation: derived.amount.toFixed(2),
      };
    }),
    netting: {
      id: 'NS-AB-001', assumptions: ['Same counterparties CP-A and CP-B', 'Same settlement cycle', 'Same currency', 'All obligations eligible', 'Enforceable bilateral netting agreement assumed, not independently verified', 'Fixing prices simulated'],
      currency: net.currency, gross: net.gross.toFixed(2), net: net.net.toFixed(2), aReceives: net.aReceives.toFixed(2),
      bReceives: net.bReceives.toFixed(2), reduction: net.reduction.toFixed(2), payer: net.payer, receiver: net.payee,
    },
    demonstration: { divisor: instruction.divisor.toString(), ratio: `1:${instruction.divisor}`, scaledGross: instruction.scaledGross.toFixed(2), scaledNet: instruction.scaledNet.toFixed(2), conversion: '1 USD = 1 USDC (illustrative; no legal discharge)' },
    expectedAtCreation: { network: instruction.network, assetCode: instruction.assetCode, assetIssuer: instruction.assetIssuer, amount: instruction.usdcAmount, sender: instruction.payerAddress || null, recipient: instruction.recipient || null },
  };
}