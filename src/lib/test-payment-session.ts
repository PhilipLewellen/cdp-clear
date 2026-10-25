import type { PreparedTestPayment } from './test-payment';
export type PendingTestPayment = { payment: PreparedTestPayment; hash: string };
// Nonpersisted lock survives navigation; only unresolved public evidence is saved separately.
export const testPaymentSession: { locked: boolean; pending: PendingTestPayment | null } = { locked: false, pending: null };