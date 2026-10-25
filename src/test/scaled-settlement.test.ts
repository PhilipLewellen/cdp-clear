import { describe, expect, it } from 'vitest';
import { SAMPLE_OBLIGATIONS, netObligations } from '@/lib/netting';
import { DEFAULT_ISSUER } from '@/lib/stellar';
import { DEFAULT_SCALE, SETTLEMENT_SCALES, generateScaledInstruction, reconcileScaled, scaleTrades, scaledNet, settlementLifecycle, snapshotUnchanged, usdcAmount, type ScaledStatus } from '@/lib/scaled-settlement';

const base = netObligations(SAMPLE_OBLIGATIONS);

describe('scaleTrades', () => {
  it('scales quantities proportionally without touching prices or the original rows', () => {
    const scaled = scaleTrades(SAMPLE_OBLIGATIONS, 1000);
    expect(scaled.map(t => t.economics?.quantity)).toEqual([1, 0.4, 0.3]);
    expect(scaled.map(t => [t.economics?.strike, t.economics?.fixing])).toEqual([[3, 5], [4, 2], [3, 4]]);
    expect(SAMPLE_OBLIGATIONS[0]?.economics?.quantity).toBe(1000);
    expect(scaled[0]?.settlementDate).toBe(SAMPLE_OBLIGATIONS[0]?.settlementDate);
    expect(scaled[0]?.eligible).toBe(true);
  });
  it('rejects invalid divisors', () => {
    expect(() => scaleTrades(SAMPLE_OBLIGATIONS, 0)).toThrow();
    expect(() => scaleTrades(SAMPLE_OBLIGATIONS, Number.NaN)).toThrow();
  });
});

describe('scaledNet', () => {
  it('default 1:1,000 scale yields 3.10 gross and 1.50 net, CP-B pays CP-A', () => {
    const r = scaledNet(SAMPLE_OBLIGATIONS, DEFAULT_SCALE.divisor);
    expect(r.ok).toBe(true);
    expect(r.gross).toBe(3.1);
    expect(r.net).toBe(1.5);
    expect(r.payer).toBe('B');
    expect(r.payee).toBe('A');
  });
  it('full size reproduces the original 3100 / 1500 example', () => {
    const r = scaledNet(SAMPLE_OBLIGATIONS, 1);
    expect(r.gross).toBe(3100);
    expect(r.net).toBe(1500);
  });
  it('every offered scale preserves direction and proportional amounts', () => {
    for (const scale of SETTLEMENT_SCALES) {
      const r = scaledNet(SAMPLE_OBLIGATIONS, scale.divisor);
      expect(r.ok).toBe(true);
      expect(r.net).toBeCloseTo(1500 / scale.divisor, 7);
      expect(r.gross).toBeCloseTo(3100 / scale.divisor, 7);
      expect(r.payer).toBe(base.payer);
      expect(r.payee).toBe(base.payee);
    }
  });
});

describe('usdcAmount', () => {
  it('formats exact seven-decimal Stellar amounts', () => {
    expect(usdcAmount(1.5)).toBe('1.5000000');
    expect(usdcAmount(0.15)).toBe('0.1500000');
    expect(usdcAmount(1500)).toBe('1500.0000000');
  });
  it('rejects zero and non-finite amounts', () => {
    expect(() => usdcAmount(0)).toThrow();
    expect(() => usdcAmount(Number.NaN)).toThrow();
  });
});

describe('generateScaledInstruction', () => {
  it('records an immutable snapshot, amounts, parties, asset and network without any blockchain action', () => {
    const instruction = generateScaledInstruction(SAMPLE_OBLIGATIONS, DEFAULT_SCALE);
    expect(instruction.id).toMatch(/^SI-[0-9A-F]{8}$/);
    expect(instruction.originalNet).toBe(1500);
    expect(instruction.originalGross).toBe(3100);
    expect(instruction.scaledNet).toBe(1.5);
    expect(instruction.scaledGross).toBe(3.1);
    expect(instruction.usdcAmount).toBe('1.5000000');
    expect(instruction.payer).toBe('B');
    expect(instruction.beneficiary).toBe('A');
    expect(instruction.assetCode).toBe('USDC');
    expect(instruction.assetIssuer).toBe(DEFAULT_ISSUER);
    expect(instruction.network).toBe('Stellar Testnet');
    expect(instruction.status).toBe('Instruction Created');
    expect(instruction.txHash).toBe('');
    expect(instruction.createdAt).toBeTruthy();
    expect(snapshotUnchanged(instruction, SAMPLE_OBLIGATIONS)).toBe(true);
  });
  it('generates unique IDs', () => {
    const a = generateScaledInstruction(SAMPLE_OBLIGATIONS, DEFAULT_SCALE);
    const b = generateScaledInstruction(SAMPLE_OBLIGATIONS, DEFAULT_SCALE);
    expect(a.id).not.toBe(b.id);
  });
  it('detects a changed portfolio after generation', () => {
    const instruction = generateScaledInstruction(SAMPLE_OBLIGATIONS, DEFAULT_SCALE);
    const changed = SAMPLE_OBLIGATIONS.map(t => t.id === 'T-001' ? { ...t, economics: { ...t.economics!, quantity: 500 }, amount: 1000 } : t);
    expect(snapshotUnchanged(instruction, changed)).toBe(false);
  });
});

describe('reconcileScaled', () => {
  const instruction = { ...generateScaledInstruction(SAMPLE_OBLIGATIONS, DEFAULT_SCALE), txHash: 'a'.repeat(64), payerAddress: 'G' + 'A'.repeat(55), recipient: 'G' + 'B'.repeat(55) };
  const confirmed = { ok: true, confirmed: true, reasons: [], ledger: 123, createdAt: '2026-10-25T00:00:00Z' };
  it('marks Reconciled only when confirmed, matching, unchanged and unallocated', () => {
    const result = reconcileScaled(instruction, confirmed, SAMPLE_OBLIGATIONS, []);
    expect(result.status).toBe('Reconciled');
    expect(result.reconciledAt).toBeTruthy();
    expect(result.confirmedAt).toBe('2026-10-25T00:00:00Z');
  });
  it('rejects a transaction hash already allocated elsewhere', () => {
    const result = reconcileScaled(instruction, confirmed, SAMPLE_OBLIGATIONS, [instruction.txHash]);
    expect(result.status).toBe('Exception — Mismatch');
    expect(result.verifiedNote).toContain('already allocated');
  });
  it('rejects a changed portfolio snapshot', () => {
    const changed = SAMPLE_OBLIGATIONS.map(t => t.id === 'T-002' ? { ...t, economics: { ...t.economics!, quantity: 500 }, amount: 1000 } : t);
    const result = reconcileScaled(instruction, confirmed, changed, []);
    expect(result.status).toBe('Exception — Mismatch');
    expect(result.verifiedNote).toContain('Portfolio changed');
  });
  it('shows Exception — Mismatch with the network reason when the payment does not match', () => {
    const result = reconcileScaled(instruction, { ...confirmed, ok: false, reasons: ['Network transaction succeeded, but no payment matches the USDC asset, issuer, amount, payer and beneficiary.'] }, SAMPLE_OBLIGATIONS, []);
    expect(result.status).toBe('Exception — Mismatch');
    expect(result.verifiedNote).toContain('no payment matches');
  });
  it('keeps an unverified status when the transaction is not confirmed yet', () => {
    const result = reconcileScaled(instruction, { ok: false, reasons: ['Transaction not found on Stellar Testnet.'] }, SAMPLE_OBLIGATIONS, []);
    expect(result.status).toBe('Verification unavailable');
    expect(result.confirmedAt).toBeUndefined();
  });
  it('marks Failed for an unsuccessful network transaction', () => {
    const result = reconcileScaled(instruction, { ok: false, failed: true, reasons: ['Network transaction failed.'] }, SAMPLE_OBLIGATIONS, []);
    expect(result.status).toBe('Failed');
  });
});
