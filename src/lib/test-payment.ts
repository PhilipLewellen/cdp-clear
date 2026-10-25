import { USDC_ASSET, loadWalletBalances, fundingChecks, decimal, stroops } from '@/lib/wallet-balances';
import { STELLAR_CONFIG } from '@/lib/stellar-config';
import { verifyTestnetAsset, verifyTestnetPayment } from '@/lib/stellar';

export const TEST_PAYMENT_AMOUNT = '1.0000000';
export interface PreparedTestPayment { source: string; destination: string; xdr: string; feeXlm: string; expiresAt: number; }
export interface ConfirmedTestPayment { hash: string; ledger?: number; }

export function paymentError(error: unknown): string {
  const codes = (error as { response?: { data?: { extras?: { result_codes?: { transaction?: string; operations?: string[] } } } } })?.response?.data?.extras?.result_codes;
  const values = [codes?.transaction, ...(codes?.operations ?? [])];
  if (values.includes('tx_too_late')) return 'Transaction expired. Review and sign a fresh transaction.';
  if (values.includes('tx_bad_seq')) return 'Account sequence changed. Review a fresh transaction.';
  if (values.some(code => code === 'op_underfunded' || code === 'tx_insufficient_balance')) return 'Insufficient spendable USDC or XLM. Refresh balances.';
  if (values.some(code => code === 'op_no_trust' || code === 'op_not_authorized' || code === 'op_line_full')) return 'USDC trustline missing, unauthorised or full. Check both accounts.';
  if (values.includes('op_no_destination')) return 'Recipient does not exist on Stellar Testnet.';
  return error instanceof Error ? error.message : 'Testnet payment unavailable. Check the transaction status before retrying.';
}

// Browser-only SDK imports: no server service, credentials or stored signing material.
export async function prepareTestPayment(source: string, destination: string): Promise<PreparedTestPayment> {
  const { Horizon, StrKey, TransactionBuilder, Operation, Asset, Networks } = await import('@stellar/stellar-sdk');
  if (!StrKey.isValidEd25519PublicKey(source) || !StrKey.isValidEd25519PublicKey(destination)) throw new Error('Enter a valid recipient public G-address and connect Freighter on Testnet.');
  await verifyTestnetAsset(USDC_ASSET.issuer);
  const server = new Horizon.Server(STELLAR_CONFIG.horizonUrl);
  const [data, account, fees] = await Promise.all([loadWalletBalances(source, destination), server.loadAccount(source), server.feeStats()]);
  const fee = [BigInt(fees.last_ledger_base_fee), BigInt(fees.fee_charged.p95)].reduce((a, b) => a > b ? a : b);
  data.feeXlm = decimal(fee);
  const reasons = fundingChecks(data, 1, source, destination, USDC_ASSET.issuer);
  if (reasons.length) throw new Error(reasons.join(' '));
  if (account.account_id !== source) throw new Error('Horizon returned a different payer account.');
  // Avoid accounts whose extra signers/threshold require a multisignature workflow.
  const master = account.signers.find(signer => signer.key === source);
  if (!master || master.weight < account.thresholds.med_threshold) throw new Error('This account requires additional signatures; use a single-signature Testnet account.');
  if (stroops(data.feeXlm) <= 0n) throw new Error('Testnet fee estimate unavailable.');
  const tx = new TransactionBuilder(account, { fee: fee.toString(), networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.payment({ destination, asset: new Asset(USDC_ASSET.code, USDC_ASSET.issuer), amount: TEST_PAYMENT_AMOUNT }))
    .setTimeout(180).build();
  return { source, destination, xdr: tx.toXDR(), feeXlm: data.feeXlm, expiresAt: Number(tx.timeBounds?.maxTime ?? 0) * 1000 };
}

export async function readTestPayment(hash: string, payment: PreparedTestPayment): Promise<ConfirmedTestPayment | null> {
  const result = await verifyTestnetPayment({ hash, source: payment.source, destination: payment.destination, amount: 1, assetCode: USDC_ASSET.code, assetIssuer: USDC_ASSET.issuer });
  if (result.failed) throw new Error('The transaction failed on Stellar Testnet. No test payment succeeded.');
  if (!result.confirmed) return null;
  if (!result.ok) throw new Error('Confirmed transaction does not match the exact 1 USDC test payment.');
  return { hash, ...(result.ledger !== undefined ? { ledger: result.ledger } : {}) };
}

export async function submitTestPayment(payment: PreparedTestPayment, signedXdr: string, onSubmission: (hash: string) => void): Promise<ConfirmedTestPayment | null> {
  const { Horizon, TransactionBuilder, Transaction, Networks } = await import('@stellar/stellar-sdk');
  const original = TransactionBuilder.fromXDR(payment.xdr, Networks.TESTNET);
  const signed = TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET);
  if (!(signed instanceof Transaction) || signed.hash().toString('hex') !== original.hash().toString('hex') || !signed.signatures.length) throw new Error('Freighter returned an altered or unsigned transaction. Nothing submitted.');
  if (Date.now() >= payment.expiresAt) throw new Error('Transaction expired before submission. Review and sign again.');
  const server = new Horizon.Server(STELLAR_CONFIG.horizonUrl);
  const root = await server.root();
  if (root.network_passphrase !== Networks.TESTNET) throw new Error('Stellar Testnet network could not be verified.');
  const hash = signed.hash().toString('hex');
  onSubmission(hash); // From here, failures may be ambiguous: never auto-resubmit.
  const response = await server.submitTransaction(signed);
  if (!response.successful || response.hash !== hash) throw new Error('Horizon did not confirm the expected transaction. Check status; do not resend.');
  return readTestPayment(hash, payment);
}