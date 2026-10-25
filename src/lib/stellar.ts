// Read-only verification against the public Stellar TESTNET Horizon API.
// No keys, no signing, no payment submission happens in this app.
export const HORIZON_TESTNET = "https://horizon-testnet.stellar.org";
export const NETWORK = "Stellar Testnet";

export const amountsMatch = (horizonAmount: string, expected: number) =>
  Math.round(parseFloat(horizonAmount) * 1e7) === Math.round(expected * 1e7);

export interface VerifyInput {
  hash: string;
  source: string;
  destination: string;
  amount: number;
  assetCode: string;
  assetIssuer: string; // empty for native XLM
}
export interface VerifyResult {
  ok: boolean;
  reasons: string[];
  ledger?: number;
  createdAt?: string;
}

export async function verifyTestnetPayment(i: VerifyInput): Promise<VerifyResult> {
  const hash = i.hash.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hash)) return { ok: false, reasons: ["Hash must be 64 hex characters."] };
  const txRes = await fetch(`${HORIZON_TESTNET}/transactions/${hash}`);
  if (txRes.status === 404) return { ok: false, reasons: ["Transaction not found on Stellar testnet."] };
  if (!txRes.ok) return { ok: false, reasons: [`Horizon error ${txRes.status}.`] };
  const tx = await txRes.json();
  if (!tx.successful) return { ok: false, reasons: ["Transaction was not successful."] };
  const opsRes = await fetch(`${HORIZON_TESTNET}/transactions/${hash}/operations?limit=100`);
  const ops = (await opsRes.json())?._embedded?.records ?? [];
  const native = i.assetCode.toUpperCase() === "XLM" && !i.assetIssuer.trim();
  const match = ops.find(
    (op: any) =>
      op.type === "payment" &&
      op.from === i.source.trim() &&
      op.to === i.destination.trim() &&
      amountsMatch(op.amount, i.amount) &&
      (native
        ? op.asset_type === "native"
        : op.asset_code === i.assetCode.trim() && op.asset_issuer === i.assetIssuer.trim()),
  );
  if (!match) {
    const reasons = ["No payment operation matches source, destination, amount and asset."];
    const pays = ops.filter((o: any) => o.type === "payment");
    pays.forEach((o: any) =>
      reasons.push(`Found: ${o.amount} ${o.asset_type === "native" ? "XLM" : o.asset_code} ${o.from.slice(0, 6)}… → ${o.to.slice(0, 6)}…`),
    );
    return { ok: false, reasons };
  }
  return { ok: true, reasons: [], ledger: tx.ledger, createdAt: tx.created_at };
}
