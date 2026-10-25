import { DEFAULT_ISSUER, HORIZON_TESTNET, TESTNET_PASSPHRASE } from './stellar';
import { stroops } from './wallet-balances';
export const TEST_RECORD_ID = 'TEST-SETTLEMENT-001';
export type TestStatus = 'Awaiting verification' | 'Reconciled' | 'Exception — Mismatch' | 'Verification unavailable';
export interface ActualPayment { id: string; transaction_hash: string; transaction_successful: boolean; type: string; from?: string; to?: string; amount?: string; asset_code?: string; asset_issuer?: string; }
export interface TestChecks { sender: boolean; recipient: boolean; amount: boolean; asset: boolean; confirmed: boolean; membership: boolean; }
export interface TestResult { status: TestStatus; reasons: string[]; checks: TestChecks; payments: ActualPayment[]; operationId?: string; confirmedAt?: string; ledger?: number; checkedAt: string; }
export interface TestAudit { action: string; at: string; detail: string; }
export interface TestSettlement { id: string; source: string; destination: string; hash: string; createdAt: string; result: TestResult | null; audit: TestAudit[]; }
export function createTestSettlement(source = '', destination = '', hash = ''): TestSettlement {
  const at = new Date().toISOString();
  return { id: TEST_RECORD_ID, source, destination, hash, createdAt: at, result: null, audit: [{ action: 'Settlement record created', at, detail: 'Retrospective 1.0000000 USDC test reconciliation' }, ...(hash ? [{ action: 'Existing transaction associated', at, detail: hash }] : [])] };
}
const emptyChecks = (): TestChecks => ({ sender: false, recipient: false, amount: false, asset: false, confirmed: false, membership: false });
export function matchTestPayment(record: TestSettlement, tx: { hash: string; successful: boolean; created_at?: string; ledger?: number }, operations: ActualPayment[], allocated: string[]): TestResult {
  const confirmed = tx.hash === record.hash && tx.successful === true;
  const payments = operations.filter(op => op.type === 'payment');
  const rows = payments.map(op => {
    let amount = false;
    try { amount = stroops(op.amount ?? '') === 10_000_000n; } catch { /* malformed decimal never matches */ }
    return { op, checks: { sender: op.from === record.source, recipient: op.to === record.destination, amount, asset: op.asset_code === 'USDC' && op.asset_issuer === DEFAULT_ISSUER, confirmed, membership: op.transaction_hash === record.hash && op.transaction_successful === true } };
  });
  const match = rows.find(row => Object.values(row.checks).every(Boolean));
  const candidate = match ?? rows.sort((a, b) => Object.values(b.checks).filter(Boolean).length - Object.values(a.checks).filter(Boolean).length)[0];
  const checks = candidate?.checks ?? { ...emptyChecks(), confirmed };
  const reasons: string[] = [];
  if (!confirmed) reasons.push(tx.hash !== record.hash ? 'Returned transaction hash differs.' : 'Transaction failed on Stellar Testnet.');
  if (!payments.length) reasons.push('Transaction contains no payment operation.');
  if (payments.length && !match) {
    for (const [key, label] of Object.entries({ sender: 'Sender mismatch', recipient: 'Recipient mismatch', amount: 'Amount is not exactly 1.0000000', asset: 'USDC asset or Circle Testnet issuer mismatch', membership: 'Payment does not belong to this successful transaction' })) {
      if (!checks[key as keyof TestChecks]) reasons.push(label + '.');
    }
  }
  if (match && (!match.op.id || allocated.includes(`${record.hash}:${match.op.id}`) || allocated.includes(record.hash))) reasons.push('Payment operation already allocated or missing its operation ID.');
  return { status: match && !reasons.length ? 'Reconciled' : 'Exception — Mismatch', reasons, checks, payments, ...(match ? { operationId: match.op.id } : {}), ...(confirmed ? { confirmedAt: tx.created_at, ledger: tx.ledger } : {}), checkedAt: new Date().toISOString() };
}
export async function verifyExistingTestPayment(record: TestSettlement, allocated: string[]): Promise<TestResult> {
  const unavailable = (reason: string): TestResult => ({ status: 'Verification unavailable', reasons: [reason], checks: emptyChecks(), payments: [], checkedAt: new Date().toISOString() });
  if (!/^[a-f0-9]{64}$/.test(record.hash)) return unavailable('Enter a 64-character hexadecimal transaction hash.');
  try {
    const { Horizon, StrKey } = await import('@stellar/stellar-sdk');
    if (!StrKey.isValidEd25519PublicKey(record.source) || !StrKey.isValidEd25519PublicKey(record.destination)) return unavailable('Enter valid expected sender and recipient public G-addresses.');
    const server = new Horizon.Server(HORIZON_TESTNET);
    const root = await server.root();
    if (root.network_passphrase !== TESTNET_PASSPHRASE) return unavailable('Stellar Testnet network could not be verified.');
    const tx = await server.transactions().transaction(record.hash).call();
    const operations: ActualPayment[] = [];
    let page = await server.operations().forTransaction(record.hash).limit(200).order('asc').call();
    const seen = new Set<string>();
    while (page.records.length) {
      for (const op of page.records) {
        if (seen.has(op.id)) throw new Error('Horizon repeated an operation; complete verification unavailable.');
        seen.add(op.id);
        if (op.type === 'payment') operations.push(op as ActualPayment);
      }
      page = await page.next();
    }
    return matchTestPayment(record, tx, operations, allocated);
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    return unavailable(status === 404 ? 'Transaction not found on Stellar Testnet.' : error instanceof Error ? error.message : 'Horizon verification unavailable.');
  }
}