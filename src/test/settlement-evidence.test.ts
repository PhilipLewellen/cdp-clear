import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SAMPLE_OBLIGATIONS } from '@/lib/netting';
import { canonicalSnapshot, checkSnapshotIntegrity, fingerprintSnapshot } from '@/lib/financial-snapshot';
import { DEFAULT_SCALE, generateFingerprintedInstruction, generateScaledInstruction } from '@/lib/scaled-settlement';
import { exportSettlementEvidence, refreshSettlementEvidence } from '@/lib/settlement-evidence';
import { amountsMatch, verifyTestnetPayment } from '@/lib/stellar';

vi.mock('@/lib/stellar', async original => ({ ...await original<typeof import('@/lib/stellar')>(), verifyTestnetPayment: vi.fn() }));
beforeEach(() => { vi.stubGlobal('crypto', webcrypto); vi.clearAllMocks(); });
afterEach(() => vi.unstubAllGlobals());

describe('Financial settlement evidence', () => {
  it('produces the same SHA-256 for identical snapshots and canonical key order', async () => {
    const instruction = await generateFingerprintedInstruction(SAMPLE_OBLIGATIONS, DEFAULT_SCALE);
    expect(await fingerprintSnapshot(instruction.financialSnapshot)).toBe(instruction.financialFingerprint);
    expect(await fingerprintSnapshot({ a: '1', b: '2' })).toBe(await fingerprintSnapshot({ b: '2', a: '1' }));
    expect(await fingerprintSnapshot({})).toBe('44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a');
  });
  it('changes fingerprint for any changed financial input', async () => {
    const instruction = await generateFingerprintedInstruction(SAMPLE_OBLIGATIONS, DEFAULT_SCALE);
    const snapshot = instruction.financialSnapshot;
    if (!snapshot) throw new Error('Missing snapshot');
    for (const field of ['quantityGpuHours', 'forwardPrice', 'fixingPrice'] as const) {
      const changed = structuredClone(snapshot);
      const contract = changed.contracts[0];
      if (!contract) throw new Error('Missing contract');
      contract[field] = '999';
      expect(await fingerprintSnapshot(changed)).not.toBe(instruction.financialFingerprint);
    }
  });
  it('captures actual gross 3100, net 1500, scale 1000 and 1.5000000 USDC', async () => {
    const instruction = await generateFingerprintedInstruction(SAMPLE_OBLIGATIONS, DEFAULT_SCALE);
    expect(instruction.financialSnapshot).toMatchObject({ netting: { gross: '3100.00', net: '1500.00', payer: 'B', receiver: 'A' }, demonstration: { divisor: '1000' }, expectedAtCreation: { amount: '1.5000000', sender: null, recipient: null } });
    expect(instruction.financialSnapshot?.contracts.map(row => row.id)).toEqual(['T-001', 'T-002', 'T-003']);
  });
  it('keeps original snapshot and hash across saved JSON reload and later trade edits', async () => {
    const instruction = await generateFingerprintedInstruction(SAMPLE_OBLIGATIONS, DEFAULT_SCALE);
    const restored = JSON.parse(JSON.stringify(instruction));
    const changed = structuredClone(SAMPLE_OBLIGATIONS);
    if (changed[0]?.economics) changed[0].economics.fixing = 99;
    expect(restored.financialSnapshot.contracts[0].fixingPrice).toBe('5');
    expect(await checkSnapshotIntegrity(restored.financialSnapshot, restored.financialFingerprint)).toBe('Verified — snapshot unchanged');
  });
  it('warns when a saved snapshot is modified', async () => {
    const instruction = await generateFingerprintedInstruction(SAMPLE_OBLIGATIONS, DEFAULT_SCALE);
    if (!instruction.financialSnapshot) throw new Error('Missing snapshot');
    instruction.financialSnapshot.netting.net = '999.00';
    expect(await checkSnapshotIntegrity(instruction.financialSnapshot, instruction.financialFingerprint)).toBe('Warning — snapshot fingerprint mismatch');
  });
  it('never invents original snapshots or hashes for historical instructions', async () => {
    const old = generateScaledInstruction(SAMPLE_OBLIGATIONS, DEFAULT_SCALE);
    const file = await exportSettlementEvidence(old);
    expect(file.financial.snapshot).toBeNull();
    expect(file.financial.sha256).toBeNull();
    expect(file.financial.availability).toBe('Historical snapshot unavailable');
  });
  it('exports actual operation, hash, checks and genuine confirmation timestamps without changing reconciliation', async () => {
    const instruction = { ...await generateFingerprintedInstruction(SAMPLE_OBLIGATIONS, DEFAULT_SCALE), status: 'Reconciled' as const, txHash: 'a'.repeat(64), payerAddress: 'G' + 'A'.repeat(55), recipient: 'G' + 'B'.repeat(55), reconciledAt: '2026-10-25T10:00:00Z' };
    const before = JSON.stringify(instruction);
    const payment = { id: '1234', transactionHash: instruction.txHash, successful: true, source: instruction.payerAddress, destination: instruction.recipient, amount: '1.5000000', assetCode: 'USDC', assetIssuer: instruction.assetIssuer, createdAt: '2026-10-25T09:00:00Z' };
    vi.mocked(verifyTestnetPayment).mockResolvedValue({ ok: true, confirmed: true, reasons: [], payment, createdAt: payment.createdAt, verifiedAt: '2026-10-25T11:00:00Z', checks: [{ field: 'Amount', passed: true, expected: '1.5000000', actual: '1.5000000' }] });
    const verification = await refreshSettlementEvidence(instruction);
    expect(JSON.stringify(instruction)).toBe(before);
    const file = await exportSettlementEvidence({ ...instruction, paymentVerification: verification });
    expect(file.stellar.paymentOperation).toEqual(payment);
    expect(file.timestamps).toMatchObject({ blockchainConfirmed: payment.createdAt, latestVerification: '2026-10-25T11:00:00Z', reconciled: instruction.reconciledAt });
    expect(file.financial.canonicalRepresentation).toBe(canonicalSnapshot(instruction.financialSnapshot));
    expect(file.reconciliation.checks?.[0]?.passed).toBe(true);
  });
  it('does not claim success or retain stale payment evidence when Horizon fails', async () => {
    const instruction = { ...generateScaledInstruction(SAMPLE_OBLIGATIONS, DEFAULT_SCALE), status: 'Reconciled' as const, txHash: 'a'.repeat(64), payerAddress: 'G' + 'A'.repeat(55), recipient: 'G' + 'B'.repeat(55) };
    vi.mocked(verifyTestnetPayment).mockRejectedValue(new Error('Horizon unavailable'));
    const result = await refreshSettlementEvidence(instruction);
    expect(result.ok).toBe(false);
    expect(result.payment).toBeUndefined();
    expect(instruction.status).toBe('Reconciled');
  });
  it('compares amounts exactly at seven-decimal precision, including large values', () => {
    expect(amountsMatch('1.5000001', '1.5000000')).toBe(false);
    expect(amountsMatch('90000000000.0000001', '90000000000.0000002')).toBe(false);
    expect(amountsMatch('1.50000000', '1.5000000')).toBe(false);
    expect(amountsMatch('1.5', '1.5000000')).toBe(true);
  });
});