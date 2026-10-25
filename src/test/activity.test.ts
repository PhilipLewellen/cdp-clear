import { describe, expect, it } from 'vitest';
import { instructionActivity } from '@/lib/activity';
import type { Instruction } from '@/lib/settlement';

const draft: Instruction = { id: 'SI-TEST', createdAt: '2026-10-26', assetCode: 'USDC', assetIssuer: 'issuer', source: 'source', destination: 'destination', amount: 1500, currency: 'USD', payer: 'B', beneficiary: 'A', obligationSnapshot: 'snapshot', status: 'Draft', txHash: '' };
describe('Truthful activity evidence', () => {
  it('labels generated instructions as demo operations, never payments', () => {
    expect(instructionActivity(null, draft)?.category).toBe('Demo operation');
  });
  it('requires network evidence before labelling confirmed events as network evidence', () => {
    expect(instructionActivity(draft, { ...draft, status: 'Confirmed' })?.category).toBe('Demo operation');
    expect(instructionActivity(draft, { ...draft, status: 'Confirmed', confirmedAt: '2026-10-26', issuerVerifiedAt: '2026-10-26', txHash: 'a'.repeat(64) })?.category).toBe('Network evidence');
  });
  it('does not invent events for an unchanged instruction', () => {
    expect(instructionActivity(draft, draft)).toBeNull();
  });
});