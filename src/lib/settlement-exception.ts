// Phase 5 settlement exception testing. Read-only Horizon evidence compared against a
// purely hypothetical instruction; never writes records, never submits transactions,
// never touches Freighter and never modifies the genuine settlement or its status.
import { HORIZON_TESTNET, TESTNET_PASSPHRASE } from './stellar';
import { decimal, stroops } from './wallet-balances';

export type ExceptionScenario = 'amount' | 'recipient' | 'issuer';

// Documented Circle Mainnet USDC issuer, used ONLY as a clearly identified example
// alternative for the hypothetical expected instruction. It is never treated as
// equivalent to the Testnet issuer and never modifies the real transaction's asset.
export const ALTERNATIVE_ISSUER = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';

export interface PaymentEvidence {
  hash: string;
  successful: boolean;
  ledger?: number | undefined;
  createdAt?: string | undefined;
  operationId: string;
  from: string;
  to: string;
  amount: string;
  assetCode: string;
  assetIssuer: string;
}

export interface HypotheticalInstruction {
  expectedSender: string;
  expectedRecipient: string;
  expectedAmount: string;
  assetCode: string;
  expectedIssuer: string;
}

export interface ExceptionField {
  key: string;
  label: string;
  expected: string;
  actual: string;
  match: boolean;
}

export interface ExceptionResult {
  status: 'Reconciled' | 'Exception — Instruction Mismatch';
  blockchainSuccessful: boolean;
  fields: ExceptionField[];
  mismatches: string[];
  evidence: PaymentEvidence;
  checkedAt: string;
}

/** Builds the temporary expected instruction from real evidence plus one deliberate error. */
export function hypotheticalFromEvidence(
  evidence: PaymentEvidence,
  scenario: ExceptionScenario,
  overrides: { amount?: string; recipient?: string },
): HypotheticalInstruction {
  const base: HypotheticalInstruction = {
    expectedSender: evidence.from,
    expectedRecipient: evidence.to,
    expectedAmount: evidence.amount,
    assetCode: evidence.assetCode,
    expectedIssuer: evidence.assetIssuer,
  };
  if (scenario === 'amount') return { ...base, expectedAmount: overrides.amount ?? evidence.amount };
  if (scenario === 'recipient') return { ...base, expectedRecipient: overrides.recipient ?? evidence.to };
  return { ...base, expectedIssuer: ALTERNATIVE_ISSUER };
}

/** Genuine field-by-field reconciliation of the hypothetical instruction against real evidence. */
export function reconcileException(expected: HypotheticalInstruction, evidence: PaymentEvidence): ExceptionResult {
  let amountMatch = false;
  try { amountMatch = stroops(evidence.amount) === stroops(expected.expectedAmount); } catch { /* malformed expected amount never matches */ }
  const fields: ExceptionField[] = [
    { key: 'sender', label: 'Sender', expected: expected.expectedSender, actual: evidence.from, match: evidence.from === expected.expectedSender },
    { key: 'recipient', label: 'Recipient', expected: expected.expectedRecipient, actual: evidence.to, match: evidence.to === expected.expectedRecipient },
    { key: 'amount', label: 'Amount', expected: `${expected.expectedAmount} ${expected.assetCode}`, actual: `${evidence.amount} ${evidence.assetCode}`, match: amountMatch },
    { key: 'asset', label: 'Asset code', expected: expected.assetCode, actual: evidence.assetCode, match: evidence.assetCode === expected.assetCode },
    { key: 'issuer', label: 'Asset issuer', expected: expected.expectedIssuer, actual: evidence.assetIssuer, match: evidence.assetIssuer === expected.expectedIssuer },
  ];
  const mismatches = fields.filter(field => !field.match).map(field => field.label);
  return {
    status: mismatches.length ? 'Exception — Instruction Mismatch' : 'Reconciled',
    blockchainSuccessful: evidence.successful,
    fields,
    mismatches,
    evidence,
    checkedAt: new Date().toISOString(),
  };
}

/** Simplest demonstration default: expect 0.5 USDC more than the actual payment. */
export function defaultMismatchAmount(actual: string): string {
  return decimal(stroops(actual) + 5_000_000n);
}

interface HorizonPayment {
  id: string;
  type: string;
  from?: string;
  to?: string;
  amount?: string;
  asset_code?: string;
  asset_issuer?: string;
  transaction_hash?: string;
  transaction_successful?: boolean;
}

/** Retrieves the real confirmed transaction and all its paginated payment operations. */
export async function fetchPaymentEvidence(hash: string): Promise<PaymentEvidence> {
  const clean = hash.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(clean)) throw new Error('Enter a 64-character hexadecimal transaction hash.');
  const root = await fetch(HORIZON_TESTNET);
  if (!root.ok || (await root.json()).network_passphrase !== TESTNET_PASSPHRASE) throw new Error('Stellar Testnet network could not be verified.');
  const txRes = await fetch(`${HORIZON_TESTNET}/transactions/${clean}`);
  if (txRes.status === 404) throw new Error('Transaction not found on Stellar Testnet.');
  if (!txRes.ok) throw new Error(`Horizon transaction lookup unavailable (${txRes.status}).`);
  const tx = await txRes.json();
  if (tx.hash !== clean) throw new Error('Returned transaction hash does not match.');
  if (!tx.successful) throw new Error('This transaction failed on Stellar Testnet; exception testing requires a successful payment.');
  const payments: HorizonPayment[] = [];
  let url: string | undefined = `${HORIZON_TESTNET}/transactions/${clean}/operations?limit=200&order=asc`;
  const visited = new Set<string>();
  while (url && !visited.has(url)) {
    if (!url.startsWith(`${HORIZON_TESTNET}/`)) throw new Error('Untrusted operations endpoint.');
    visited.add(url);
    const response: Response = await fetch(url);
    if (!response.ok) throw new Error('Horizon operation lookup unavailable.');
    const page: { _embedded?: { records?: HorizonPayment[] }; _links?: { next?: { href: string } } } = await response.json();
    const records = page?._embedded?.records ?? [];
    for (const op of records) {
      if (op.type === 'payment' && op.transaction_hash === clean && op.transaction_successful === true) payments.push(op);
    }
    url = records.length === 200 ? page?._links?.next?.href : undefined;
  }
  const op = payments[0];
  if (!op?.from || !op.to || !op.amount) throw new Error('Transaction contains no successful payment operation.');
  return {
    hash: clean,
    successful: true,
    ledger: tx.ledger,
    createdAt: tx.created_at,
    operationId: op.id,
    from: op.from,
    to: op.to,
    amount: op.amount,
    assetCode: op.asset_code ?? 'native',
    assetIssuer: op.asset_issuer ?? '',
  };
}
