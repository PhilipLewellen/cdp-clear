// Read-only Stellar Testnet verification. No keys, signing or submission.
export const HORIZON_TESTNET = "https://horizon-testnet.stellar.org";
export const NETWORK = "Stellar Testnet";
export const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
export const DEFAULT_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
export const amountsMatch = (actual: string, expected: number | string) => {
  const integer = (value: string) => {
    if (!/^\d+(\.\d{1,7})?$/.test(value)) return null;
    const [whole = '0', fraction = ''] = value.split('.');
    return BigInt(whole) * 10_000_000n + BigInt(fraction.padEnd(7, '0'));
  };
  const right = typeof expected === 'number' ? (Number.isFinite(expected) && expected >= 0 ? expected.toFixed(7) : '') : expected;
  const left = integer(actual);
  return left !== null && left === integer(right);
};
export interface VerifyInput { hash: string; source: string; destination: string; amount: number | string; assetCode: string; assetIssuer: string; }
export interface PaymentEvidence { id: string; transactionHash: string; successful: boolean; source: string; destination: string; amount: string; assetCode: string; assetIssuer: string; createdAt: string | null; }
export interface EvidenceCheck { field: string; passed: boolean; expected: string; actual: string | null; }
export interface VerifyResult { ok: boolean; confirmed?: boolean; failed?: boolean; reasons: string[]; ledger?: number; createdAt?: string; verifiedAt?: string; transactionHash?: string; payment?: PaymentEvidence; checks?: EvidenceCheck[]; }
export async function verifyTestnetAsset(issuer: string) {
  const root = await fetch(HORIZON_TESTNET);
  if (!root.ok || (await root.json()).network_passphrase !== TESTNET_PASSPHRASE) throw new Error('Stellar Testnet network could not be verified.');
  const response = await fetch(`${HORIZON_TESTNET}/assets?asset_code=USDC&asset_issuer=${encodeURIComponent(issuer.trim())}&limit=1`);
  if (!response.ok) throw new Error('Testnet asset lookup unavailable.');
  const records = (await response.json())?._embedded?.records ?? [];
  if (!records.some((asset: { asset_code: string; asset_issuer: string }) => asset.asset_code === 'USDC' && asset.asset_issuer === issuer.trim())) throw new Error('No matching USDC asset issuer found on Stellar Testnet.');
  return new Date().toISOString();
}
interface PaymentOperation { id: string; transaction_hash: string; transaction_successful: boolean; created_at?: string; type: string; from: string; to: string; amount: string; asset_code?: string; asset_issuer?: string; }
export async function verifyTestnetPayment(i: VerifyInput): Promise<VerifyResult> {
  const hash = i.hash.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hash)) return { ok: false, reasons: ['Hash must be 64 hex characters.'] };
  await verifyTestnetAsset(i.assetIssuer);
  const txRes = await fetch(`${HORIZON_TESTNET}/transactions/${hash}`);
  if (txRes.status === 404) return { ok: false, reasons: ['Transaction not found on Stellar Testnet.'] };
  if (!txRes.ok) throw new Error(`Horizon transaction lookup unavailable (${txRes.status}).`);
  const tx = await txRes.json();
  if (tx.hash !== hash) return { ok: false, reasons: ['Returned transaction hash does not match.'] };
  if (tx.successful !== true) return { ok: false, failed: true, transactionHash: hash, verifiedAt: new Date().toISOString(), checks: [{ field: 'Transaction success', passed: false, expected: 'true', actual: String(tx.successful) }], reasons: ['Network transaction failed.'] };
  const confirmation = { confirmed: true, ledger: tx.ledger, createdAt: tx.created_at, transactionHash: hash, verifiedAt: new Date().toISOString() };
  const operations: PaymentOperation[] = [];
  let url: string | undefined = `${HORIZON_TESTNET}/transactions/${hash}/operations?limit=200&order=asc`;
  const visited = new Set<string>();
  while (url && !visited.has(url)) {
    if (!url.startsWith(`${HORIZON_TESTNET}/`)) throw new Error('Untrusted operations endpoint.');
    visited.add(url);
    const response: Response = await fetch(url);
    if (!response.ok) throw new Error('Network confirmed; operation lookup unavailable.');
    const page: { _embedded?: { records: PaymentOperation[] }; _links?: { next?: { href: string } } } = await response.json();
    const records: PaymentOperation[] = page?._embedded?.records ?? [];
    operations.push(...records);
    url = records.length === 200 ? page?._links?.next?.href : undefined;
  }
  const matches = (op: PaymentOperation) => op.type === 'payment' && op.transaction_hash === hash && op.transaction_successful === true && Boolean(op.id) && op.from === i.source.trim() && op.to === i.destination.trim() && amountsMatch(op.amount, i.amount) && op.asset_code === 'USDC' && i.assetCode === 'USDC' && op.asset_issuer === i.assetIssuer.trim() && i.assetIssuer.trim() === DEFAULT_ISSUER;
  const matched = operations.find(matches);
  const observed = matched ?? operations.find(op => op.type === 'payment' && op.transaction_hash === hash && op.transaction_successful === true);
  const check = (field: string, expected: string, actual: string | null, passed = expected === actual): EvidenceCheck => ({ field, expected, actual, passed });
  const checks = [
    check('Network', NETWORK, NETWORK), check('Transaction success', 'true', 'true'),
    check('Payment operation success', 'true', observed ? String(observed.transaction_successful) : null),
    check('Transaction membership', hash, observed?.transaction_hash ?? null),
    check('Operation ID', 'Available', observed?.id ?? null, Boolean(observed?.id)),
    check('Sender', i.source.trim(), observed?.from ?? null), check('Recipient', i.destination.trim(), observed?.to ?? null),
    check('Amount', typeof i.amount === 'number' ? i.amount.toFixed(7) : i.amount, observed?.amount ?? null, observed ? amountsMatch(observed.amount, i.amount) : false),
    check('Asset code', 'USDC', observed?.asset_code ?? null, i.assetCode === 'USDC' && observed?.asset_code === 'USDC'),
    check('Asset issuer', i.assetIssuer.trim(), observed?.asset_issuer ?? null, i.assetIssuer.trim() === DEFAULT_ISSUER && observed?.asset_issuer === DEFAULT_ISSUER),
  ];
  const payment = matched ? { id: matched.id, transactionHash: matched.transaction_hash, successful: matched.transaction_successful, source: matched.from, destination: matched.to, amount: matched.amount, assetCode: matched.asset_code ?? '', assetIssuer: matched.asset_issuer ?? '', createdAt: matched.created_at ?? null } : undefined;
  return { ...confirmation, verifiedAt: new Date().toISOString(), ok: Boolean(matched), payment, checks, reasons: matched ? [] : ['Network transaction succeeded, but no payment matches the USDC asset, issuer, amount, payer and beneficiary.'] };
}
