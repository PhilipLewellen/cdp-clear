import { describe, expect, it } from 'vitest';
import { deriveObligation, netObligations, SAMPLE_OBLIGATIONS } from '@/lib/netting';
import { overviewSettlement, signedNet, stressObligations } from '@/lib/risk-overview';
import { obligationSnapshot, type Instruction } from '@/lib/settlement';

describe('Isolated GPU fixing scenarios', () => {
  it('zero shock reproduces USD 1500 net and USD 3100 gross', () => {
    const result = stressObligations(SAMPLE_OBLIGATIONS, 0);
    expect(result.net).toBe(1500); expect(result.gross).toBe(3100);
  });
  it('+10% produces USD 2200 net from CP-B to CP-A', () => {
    const result = stressObligations(SAMPLE_OBLIGATIONS, 10);
    expect(result.net).toBe(2200); expect(result.payer).toBe('B'); expect(result.payee).toBe('A');
    expect(result.gross).toBe(3640); expect(signedNet(result) - signedNet(netObligations(SAMPLE_OBLIGATIONS))).toBe(700);
  });
  it('supports −30% and reversed payer', () => {
    const result = stressObligations(SAMPLE_OBLIGATIONS, -30);
    expect(result.net).toBe(600); expect(result.payer).toBe('A'); expect(result.payee).toBe('B');
    expect(signedNet(result)).toBe(-600);
  });
  it('rejects out-of-range and non-5% increments', () => {
    expect(stressObligations(SAMPLE_OBLIGATIONS, 35).ok).toBe(false);
    expect(stressObligations(SAMPLE_OBLIGATIONS, 3).ok).toBe(false);
  });
  it('leaves stored economics and instruction snapshots unchanged', () => {
    const trades = structuredClone(SAMPLE_OBLIGATIONS);
    const before = obligationSnapshot(trades);
    stressObligations(trades, 10);
    expect(obligationSnapshot(trades)).toBe(before); expect(trades[0]?.economics?.fixing).toBe(5);
  });
  it('updates from edited booked quantities', () => {
    const trades = SAMPLE_OBLIGATIONS.map(trade => trade.id === 'T-001' && trade.economics ? deriveObligation({ ...trade, economics: { ...trade.economics, quantity: 500 } }) : trade);
    expect(stressObligations(trades, 0).net).toBe(500);
    expect(stressObligations(trades, 10).net).toBe(950);
  });
});

describe('Settlement overview evidence', () => {
  const instruction: Instruction = { id: 'SI-TEST', createdAt: '2026-10-25', source: 'source', destination: 'destination', assetCode: 'USDC', assetIssuer: 'issuer', amount: 1500, currency: 'USD', payer: 'B', beneficiary: 'A', status: 'Draft', txHash: '', obligationSnapshot: obligationSnapshot(SAMPLE_OBLIGATIONS) };
  it('does not label a supplied hash as verified blockchain evidence', () => {
    expect(overviewSettlement(SAMPLE_OBLIGATIONS, { ...instruction, status: 'Pending Authorisation', txHash: 'a'.repeat(64) }, []).verified).toBe(false);
  });
  it('never applies old instruction evidence to changed booked obligations', () => {
    const state = overviewSettlement(SAMPLE_OBLIGATIONS.slice(1), { ...instruction, status: 'Reconciled', confirmedAt: '2026-10-25', issuerVerifiedAt: '2026-10-25', txHash: 'a'.repeat(64) }, []);
    expect(state.current).toBeNull(); expect(state.verified).toBe(false); expect(state.stale).toBe(true);
  });
});