import { USDC_ASSET, loadWalletBalances, fundingChecks, decimal, stroops } from '@/lib/wallet-balances';
import { STELLAR_CONFIG } from '@/lib/stellar-config';
import { verifyTestnetAsset, verifyTestnetPayment } from '@/lib/stellar';
import { paymentError } from '@/lib/test-payment';

// Real classic USDC payment for a scaled settlement instruction. Browser-only; no keys or signing material stored.
const hex = (bytes: Uint8Array) => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
export interface PreparedScaledPayment { source: string; destination: string; amount: string; xdr: string; feeXlm: string; expiresAt: number; }
export interface ConfirmedScaledPayment { hash: string; ledger?: number; }
export { paymentError };

export async function prepareScaledPayment(source: string, destination: string, amount: string): Promise<PreparedScaledPayment> {
  const { Horizon, StrKey, TransactionBuilder, Operation, Asset, Networks } = await import('@stellar/stellar-sdk');
  if (!StrKey.isValidEd25519PublicKey(source) || !StrKey.isValidEd25519PublicKey(destination)) throw new Error('Enter a valid recipient public G-address and connect Freighter on Testnet.');
  if (!/^\d+(\.\d{1,7})?$/.test(amount) || stroops(amount) <= 0n) throw new Error('A positive seven-decimal USDC amount is required.');
  await verifyTestnetAsset(USDC_ASSET.issuer);
  const server = new Horizon.Server(STELLAR_CONFIG.horizonUrl);
  const [data, account, fees] = await Promise.all([loadWalletBalances(source, destination), server.loadAccount(source), server.feeStats()]);
  const base = BigInt(fees.last_ledger_base_fee);
  if (base > 100_000n) throw new Error('Network base fee exceeds the 0.0100000 XLM safety limit. Retry when fees fall.');
  const estimate = [base, BigInt(fees.fee_charged.p95)].reduce((a, b) => a > b ? a : b);
  const fee = estimate > 100_000n ? 100_000n : estimate;
  data.feeXlm = decimal(fee);
  const reasons = fundingChecks(data, Number(amount), source, destination, USDC_ASSET.issuer);
  if (reasons.length) throw new Error(reasons.join(' '));
  if (account.account_id !== source) throw new Error('Horizon returned a different payer account.');
  const master = account.signers.find(signer => signer.key === source);
  if (!master || master.weight < account.thresholds.med_threshold) throw new Error('This account requires additional signatures; use a single-signature Testnet account.');
  if (stroops(data.feeXlm) <= 0n) throw new Error('Testnet fee estimate unavailable.');
  const tx = new TransactionBuilder(account, { fee: fee.toString(), networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.payment({ destination, asset: new Asset(USDC_ASSET.code, USDC_ASSET.issuer), amount }))
    .setTimeout(180).build();
  return { source, destination, amount, xdr: tx.toXDR(), feeXlm: data.feeXlm, expiresAt: Number(tx.timeBounds?.maxTime ?? 0) * 1000 };
}

export async function readScaledPayment(hash: string, payment: PreparedScaledPayment): Promise<ConfirmedScaledPayment | null> {
  const result = await verifyTestnetPayment({ hash, source: payment.source, destination: payment.destination, amount: Number(payment.amount), assetCode: USDC_ASSET.code, assetIssuer: USDC_ASSET.issuer });
  if (result.failed) throw new Error('The transaction failed on Stellar Testnet. No settlement payment succeeded.');
  if (!result.confirmed) return null;
  if (!result.ok) throw new Error(`Confirmed transaction does not match the exact ${payment.amount} USDC settlement payment.`);
  return { hash, ...(result.ledger !== undefined ? { ledger: result.ledger } : {}) };
}

export async function submitScaledPayment(payment: PreparedScaledPayment, signedXdr: string, onSubmission: (hash: string) => void): Promise<ConfirmedScaledPayment | null> {
  const { Horizon, TransactionBuilder, Transaction, Networks, Keypair } = await import('@stellar/stellar-sdk');
  const original = TransactionBuilder.fromXDR(payment.xdr, Networks.TESTNET);
  const signed = TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET);
  if (!(signed instanceof Transaction) || hex(signed.hash()) !== hex(original.hash()) || !signed.signatures.length) throw new Error('Freighter returned an altered or unsigned transaction. Nothing submitted.');
  const signer = Keypair.fromPublicKey(payment.source);
  if (!signed.signatures.some(signature => signer.verify(signed.hash(), signature.signature))) throw new Error('Signed transaction lacks a valid payer signature. Nothing submitted.');
  if (Date.now() >= payment.expiresAt) throw new Error('Transaction expired before submission. Review and sign again.');
  const server = new Horizon.Server(STELLAR_CONFIG.horizonUrl);
  const root = await server.root();
  if (root.network_passphrase !== Networks.TESTNET) throw new Error('Stellar Testnet network could not be verified.');
  const hash = hex(signed.hash());
  onSubmission(hash); // From here, failures may be ambiguous: never auto-resubmit.
  const response = await server.submitTransaction(signed);
  if (!response.successful || response.hash !== hash) throw new Error('Horizon did not confirm the expected transaction. Check status; do not resend.');
  return readScaledPayment(hash, payment);
}
