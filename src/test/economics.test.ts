import { describe, expect, it } from 'vitest';
import { deriveObligation, forwardPayoff, netObligations, SAMPLE_OBLIGATIONS, upgradeObligation } from '@/lib/netting';

describe('GPU-forward economics', () => {
  it.each([
    ['T-001', 1000, 3, 5, 2000, 'A'],
    ['T-002', 400, 4, 2, -800, 'B'],
    ['T-003', 300, 3, 4, 300, 'A'],
  ])('%s derives quantity times fixing minus strike', (id, quantity, strike, fixing, payoff, receiver) => {
    const t = SAMPLE_OBLIGATIONS.find(row => row.id === id);
    if (!t?.economics) throw new Error('Missing sample economics');
    expect(t.economics).toMatchObject({ quantity, strike, fixing, longParty: 'A' });
    expect(forwardPayoff(t.economics)).toBe(payoff);
    expect(deriveObligation(t)).toMatchObject({ amount: Math.abs(Number(payoff)), receiver });
  });
  const sample = SAMPLE_OBLIGATIONS[0];
  if (!sample) throw new Error('Missing sample');
  function edited(patch: Record<string, unknown>) {
    if (!sample?.economics) throw new Error('Missing economics');
    return deriveObligation({ ...sample, economics: { ...sample.economics, ...patch } });
  }
  it('recalculates quantity changes', () => expect(edited({ quantity: 500 }).amount).toBe(1000));
  it('fixing below strike reverses payer and beneficiary', () => expect(edited({ fixing: 2 })).toMatchObject({ amount: 1000, receiver: 'B' }));
  it('strike changes recalculate payoff', () => expect(edited({ strike: 4 }).amount).toBe(1000));
  it('switching the long counterparty reverses cash direction', () => expect(edited({ longParty: 'B' })).toMatchObject({ amount: 2000, receiver: 'B' }));
  it('zero payoff requires no payment', () => expect(edited({ fixing: 3 }).amount).toBe(0));
  it('rejects cash fields conflicting with economics', () => expect(netObligations([{ ...sample, amount: 7 }]).ok).toBe(false));
  it('rejects nonpositive GPU quantity', () => expect(netObligations([edited({ quantity: 0 })]).ok).toBe(false));
  it('upgrades saved cash edits without changing amount, direction or dates', () => expect(upgradeObligation({ id: 'T-001', amount: 2750, receiver: 'B', currency: 'USD', settlementDate: '2026-11-01', eligible: false })).toMatchObject({ amount: 2750, receiver: 'B', settlementDate: '2026-11-01', eligible: false }));
});