import { describe, expect, it } from 'vitest';
import { ALTERNATIVE_ISSUER, defaultMismatchAmount, hypotheticalFromEvidence, reconcileException, type PaymentEvidence } from '@/lib/settlement-exception';

const TESTNET_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
const SENDER = `G${'A'.repeat(55)}`;
const RECIPIENT = `G${'B'.repeat(55)}`;

const evidence: PaymentEvidence = {
  hash: 'a'.repeat(64),
  successful: true,
  ledger: 123456,
  createdAt: '2026-10-25T00:00:00Z',
  operationId: 'op-1',
  from: SENDER,
  to: RECIPIENT,
  amount: '1.5000000',
  assetCode: 'USDC',
  assetIssuer: TESTNET_ISSUER,
};

describe('hypotheticalFromEvidence', () => {
  it('keeps every real field and changes only the expected amount', () => {
    const hypothetical = hypotheticalFromEvidence(evidence, 'amount', { amount: '2.0000000' });
    expect(hypothetical).toEqual({ expectedSender: SENDER, expectedRecipient: RECIPIENT, expectedAmount: '2.0000000', assetCode: 'USDC', expectedIssuer: TESTNET_ISSUER });
  });
  it('changes only the expected recipient for the recipient scenario', () => {
    const other = `G${'C'.repeat(55)}`;
    const hypothetical = hypotheticalFromEvidence(evidence, 'recipient', { recipient: other });
    expect(hypothetical.expectedRecipient).toBe(other);
    expect(hypothetical.expectedAmount).toBe('1.5000000');
    expect(hypothetical.expectedIssuer).toBe(TESTNET_ISSUER);
  });
  it('uses the identified alternative issuer only for the issuer scenario', () => {
    const hypothetical = hypotheticalFromEvidence(evidence, 'issuer', {});
    expect(hypothetical.expectedIssuer).toBe(ALTERNATIVE_ISSUER);
    expect(hypothetical.expectedIssuer).not.toBe(evidence.assetIssuer);
    expect(hypothetical.expectedAmount).toBe('1.5000000');
  });
  it('never mutates the real evidence', () => {
    hypotheticalFromEvidence(evidence, 'issuer', {});
    expect(evidence.assetIssuer).toBe(TESTNET_ISSUER);
  });
});

describe('defaultMismatchAmount', () => {
  it('expects 0.5 USDC more than the actual payment at seven-decimal precision', () => {
    expect(defaultMismatchAmount('1.5000000')).toBe('2.0000000');
    expect(defaultMismatchAmount('0.0100000')).toBe('0.5100000');
  });
});

describe('reconcileException', () => {
  it('reconciles when the hypothetical instruction matches the real payment exactly', () => {
    const result = reconcileException(hypotheticalFromEvidence(evidence, 'amount', { amount: '1.5000000' }), evidence);
    expect(result.status).toBe('Reconciled');
    expect(result.mismatches).toEqual([]);
    expect(result.fields.every(field => field.match)).toBe(true);
  });
  it('flags only the amount for an incorrect expected amount', () => {
    const result = reconcileException(hypotheticalFromEvidence(evidence, 'amount', { amount: '2.0000000' }), evidence);
    expect(result.status).toBe('Exception — Instruction Mismatch');
    expect(result.mismatches).toEqual(['Amount']);
    expect(result.fields.find(field => field.key === 'amount')?.match).toBe(false);
    expect(result.fields.filter(field => field.match)).toHaveLength(4);
  });
  it('flags only the recipient for an incorrect expected recipient', () => {
    const result = reconcileException(hypotheticalFromEvidence(evidence, 'recipient', { recipient: `G${'C'.repeat(55)}` }), evidence);
    expect(result.status).toBe('Exception — Instruction Mismatch');
    expect(result.mismatches).toEqual(['Recipient']);
  });
  it('flags only the issuer for an incorrect expected issuer', () => {
    const result = reconcileException(hypotheticalFromEvidence(evidence, 'issuer', {}), evidence);
    expect(result.status).toBe('Exception — Instruction Mismatch');
    expect(result.mismatches).toEqual(['Asset issuer']);
  });
  it('keeps the blockchain result successful even when reconciliation mismatches', () => {
    const result = reconcileException(hypotheticalFromEvidence(evidence, 'amount', { amount: '2.0000000' }), evidence);
    expect(result.blockchainSuccessful).toBe(true);
  });
  it('detects a single-stroop difference at seven-decimal precision', () => {
    const result = reconcileException(hypotheticalFromEvidence(evidence, 'amount', { amount: '1.5000001' }), evidence);
    expect(result.mismatches).toEqual(['Amount']);
  });
  it('never matches a malformed expected amount', () => {
    const result = reconcileException(hypotheticalFromEvidence(evidence, 'amount', { amount: 'abc' }), evidence);
    expect(result.mismatches).toEqual(['Amount']);
  });
  it('lists every differing field when several are wrong', () => {
    const hypothetical = { expectedSender: `G${'D'.repeat(55)}`, expectedRecipient: `G${'E'.repeat(55)}`, expectedAmount: '9.0000000', assetCode: 'USDC', expectedIssuer: ALTERNATIVE_ISSUER };
    const result = reconcileException(hypothetical, evidence);
    expect(result.mismatches).toEqual(['Sender', 'Recipient', 'Amount', 'Asset issuer']);
  });
});
