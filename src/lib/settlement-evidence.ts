import { canonicalSnapshot, checkSnapshotIntegrity } from './financial-snapshot';
import type { ScaledInstruction } from './scaled-settlement';
import { verifyTestnetPayment, type VerifyResult } from './stellar';

/** Evidence refresh never changes instruction lifecycle, reconciliation time or audit history. */
export async function refreshSettlementEvidence(instruction: ScaledInstruction): Promise<VerifyResult> {
  try {
    if (!instruction.txHash || !instruction.payerAddress || !instruction.recipient) throw new Error('Payment hash, sender or recipient unavailable.');
    if (instruction.network !== 'Stellar Testnet') throw new Error('Expected instruction network is not Stellar Testnet.');
    return await verifyTestnetPayment({ hash: instruction.txHash, source: instruction.payerAddress, destination: instruction.recipient, amount: instruction.usdcAmount, assetCode: instruction.assetCode, assetIssuer: instruction.assetIssuer });
  } catch (error) {
    return { ok: false, reasons: [error instanceof Error ? error.message : 'Horizon verification unavailable.'], verifiedAt: new Date().toISOString() };
  }
}

/** Explicit allowlist: never serialize store, wallet objects, signed XDR or arbitrary fields. */
export async function exportSettlementEvidence(instruction: ScaledInstruction) {
  const verification = instruction.paymentVerification;
  return {
    evidenceSchemaVersion: 'cdp-clear-settlement-evidence/v1',
    instructionId: instruction.id,
    timestamps: { instructionCreated: instruction.createdAt, reconciled: instruction.reconciledAt ?? null, blockchainConfirmed: verification?.createdAt ?? null, latestVerification: verification?.verifiedAt ?? null },
    financial: {
      snapshot: instruction.financialSnapshot ?? null,
      availability: instruction.financialSnapshot ? 'Available' : 'Historical snapshot unavailable',
      schemaVersion: instruction.financialSnapshot?.schemaVersion ?? null,
      sha256: instruction.financialFingerprint ?? null,
      integrity: await checkSnapshotIntegrity(instruction.financialSnapshot, instruction.financialFingerprint),
      canonicalRepresentation: instruction.financialSnapshot ? canonicalSnapshot(instruction.financialSnapshot) : null,
      canonicalRules: 'v1: UTF-8 JSON; object keys sorted lexically; arrays retain order; contract IDs sorted at capture. Decimal inputs use shortest round-trip base-10 strings; cash uses 2 decimals; USDC uses 7 decimals. SHA-256 hashes canonicalRepresentation bytes.',
      limitations: 'Browser-local data consistency only; not proof of truth, independent timestamping, legal validity or an on-chain commitment. Wallet addresses unknown at creation remain null; current instruction addresses appear separately.',
    },
    netting: instruction.financialSnapshot?.netting ?? null,
    expectedInstruction: { network: instruction.network, payer: instruction.payer, receiver: instruction.beneficiary, sender: instruction.payerAddress || null, recipient: instruction.recipient || null, amount: instruction.usdcAmount, assetCode: instruction.assetCode, assetIssuer: instruction.assetIssuer, divisor: instruction.divisor },
    stellar: {
      transactionHash: instruction.txHash || null,
      paymentOperation: verification?.payment ?? null,
      ledger: verification?.ledger ?? null,
      availability: verification?.payment ? 'Independently retrieved matched payment' : 'Verified payment-operation evidence unavailable',
      explorerUrl: /^[a-f0-9]{64}$/.test(instruction.txHash) ? `https://stellar.expert/explorer/testnet/tx/${instruction.txHash}` : null,
    },
    reconciliation: { recordedStatus: instruction.status, recordedNote: instruction.verifiedNote ?? null, latestVerification: verification ?? null, checks: verification?.checks ?? null },
  };
}