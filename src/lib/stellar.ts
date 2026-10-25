// Read-only Stellar Testnet verification. No keys, signing or submission.
export const HORIZON_TESTNET = "https://horizon-testnet.stellar.org";
export const NETWORK = "Stellar Testnet";
export const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
export const DEFAULT_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
export const amountsMatch = (actual: string, expected: number) =>
  Number.isFinite(Number(actual)) && Math.round(Number(actual) * 1e7) === Math.round(expected * 1e7);
export interface VerifyInput { hash: string; source: string; destination: string; amount: number; assetCode: string; assetIssuer: string; }
export interface VerifyResult { ok: boolean; confirmed?: boolean; failed?: boolean; reasons: string[]; ledger?: number; createdAt?: string; }
export async function verifyTestnetAsset(issuer: string) {
  const root = await fetch(HORIZON_TESTNET);
  if (!root.ok || (await root.json()).network_passphrase !== TESTNET_PASSPHRASE) throw new Error('Stellar Testnet network could not be verified.');
  const response = await fetch(`${HORIZON_TESTNET}/assets?asset_code=USDC&asset_issuer=${encodeURIComponent(issuer.trim())}&limit=1`);
  if (!response.ok) throw new Error('Testnet asset lookup unavailable.');
  const records = (await response.json())?._embedded?.records ?? [];
  if (!records.some((asset: { asset_code: string; asset_issuer: string }) => asset.asset_code === 'USDC' && asset.asset_issuer === issuer.trim())) throw new Error('No matching USDC asset issuer found on Stellar Testnet.');
  return new Date().toISOString();
}
interface PaymentOperation { type: string; from: string; to: string; amount: string; asset_code?: string; asset_issuer?: string; }
export async function verifyTestnetPayment(i: VerifyInput): Promise<VerifyResult> {
  const hash = i.hash.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hash)) return { ok: false, reasons: ['Hash must be 64 hex characters.'] };
  await verifyTestnetAsset(i.assetIssuer);
  const txRes = await fetch(`${HORIZON_TESTNET}/transactions/${hash}`);
  if (txRes.status === 404) return { ok: false, reasons: ['Transaction not found on Stellar Testnet.'] };
  if (!txRes.ok) throw new Error(`Horizon transaction lookup unavailable (${txRes.status}).`);
  const tx = await txRes.json();
  if (tx.hash !== hash) return { ok: false, reasons: ['Returned transaction hash does not match.'] };
  if (!tx.successful) return { ok: false, failed: true, reasons: ['Network transaction failed.'] };
  const confirmation = { confirmed: true, ledger: tx.ledger, createdAt: tx.created_at };
  const operations: PaymentOperation[] = [];
  let url: string | undefined = `${HORIZON_TESTNET}/transactions/${hash}/operations?limit=200&order=asc`;
  const visited = new Set<string>();
  while (url && !visited.has(url)) {
    if (!url.startsWith(`${HORIZON_TESTNET}/`)) throw new Error('Untrusted operations endpoint.');
    visited.add(url);
    const response: Response = await fetch(url);
    if (!response.ok) return { ...confirmation, ok: false, reasons: ['Network confirmed; operation lookup unavailable.'] };
    const page: { _embedded?: { records: PaymentOperation[] }; _links?: { next?: { href: string } } } = await response.json();
    const records: PaymentOperation[] = page?._embedded?.records ?? [];
    operations.push(...records);
    url = records.length === 200 ? page?._links?.next?.href : undefined;
  }
  const match = operations.some(op => op.type === 'payment' && op.from === i.source.trim() && op.to === i.destination.trim() && amountsMatch(op.amount, i.amount) && op.asset_code === 'USDC' && i.assetCode === 'USDC' && op.asset_issuer === i.assetIssuer.trim());
  return { ...confirmation, ok: match, reasons: match ? [] : ['Network transaction succeeded, but no payment matches the USDC asset, issuer, amount, payer and beneficiary.'] };
}
