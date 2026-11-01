import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateNetPaidPiastres,
  computeInvoiceBalance,
  formatEgp,
  egpToPiastres,
  canEnrollChild,
  validateAttendanceCheckout,
} from '../src/utils/billingRules';

test('egpToPiastres converts Egyptian pounds correctly to integer piastres', () => {
  assert.equal(egpToPiastres(1500), 150000);
  assert.equal(egpToPiastres('250.50'), 25050);
  assert.equal(egpToPiastres('0.75'), 75);
  assert.throws(() => egpToPiastres('-10'), /المبلغ غير صالح/);
});

test('formatEgp formats piastres into Egyptian Pounds with ج.م symbol', () => {
  assert.equal(formatEgp(150000), '1,500.00 ج.م');
  assert.equal(formatEgp(25050), '250.50 ج.م');
  assert.equal(formatEgp(0), '0.00 ج.م');
});

test('calculateNetPaidPiastres accounts for manual payments and reversals correctly', () => {
  const payments = [
    { id: 'p1', invoiceId: 'inv-1', amountPiastres: 50000, isReversal: false },
    { id: 'p2', invoiceId: 'inv-1', amountPiastres: 30000, isReversal: false },
    { id: 'p3', invoiceId: 'inv-1', amountPiastres: 20000, isReversal: true }, // Reversal entry
    { id: 'p4', invoiceId: 'inv-2', amountPiastres: 40000, isReversal: false },
  ];

  // Net paid for inv-1: 50000 + 30000 - 20000 = 60000 piastres (600 EGP)
  const netInv1 = calculateNetPaidPiastres(payments, 'inv-1');
  assert.equal(netInv1, 60000);

  // Net total paid across all invoices: 60000 + 40000 = 100000
  const netTotal = calculateNetPaidPiastres(payments);
  assert.equal(netTotal, 100000);
});

test('computeInvoiceBalance accurately computes remaining balance and status transitions', () => {
  const invoice = { id: 'inv-1', amountPiastres: 100000, status: 'unpaid' as const };

  // 1. Unpaid with 0 payments
  const bal1 = computeInvoiceBalance(invoice, []);
  assert.equal(bal1.paidPiastres, 0);
  assert.equal(bal1.remainingPiastres, 100000);
  assert.equal(bal1.status, 'unpaid');

  // 2. Partial payment (400 EGP paid out of 1000 EGP)
  const bal2 = computeInvoiceBalance(invoice, [
    { id: 'p1', invoiceId: 'inv-1', amountPiastres: 40000, isReversal: false },
  ]);
  assert.equal(bal2.paidPiastres, 40000);
  assert.equal(bal2.remainingPiastres, 60000);
  assert.equal(bal2.status, 'partial');

  // 3. Fully paid (remaining 600 EGP paid)
  const bal3 = computeInvoiceBalance(invoice, [
    { id: 'p1', invoiceId: 'inv-1', amountPiastres: 40000, isReversal: false },
    { id: 'p2', invoiceId: 'inv-1', amountPiastres: 60000, isReversal: false },
  ]);
  assert.equal(bal3.paidPiastres, 100000);
  assert.equal(bal3.remainingPiastres, 0);
  assert.equal(bal3.status, 'paid');
});

test('canEnrollChild enforces subscription plan child quota', () => {
  assert.equal(canEnrollChild(14, 15), true);
  assert.equal(canEnrollChild(15, 15), false);
  assert.equal(canEnrollChild(25, 20), false);
});

test('validateAttendanceCheckout checks check-in status and time sequence', () => {
  // Not checked in
  const v1 = validateAttendanceCheckout('', '14:30');
  assert.equal(v1.isValid, false);

  // Missing checkout time
  const v2 = validateAttendanceCheckout('08:30', '');
  assert.equal(v2.isValid, false);

  // Checkout earlier than checkin
  const v3 = validateAttendanceCheckout('09:00', '08:30');
  assert.equal(v3.isValid, false);

  // Valid sequence
  const v4 = validateAttendanceCheckout('08:30', '14:30');
  assert.equal(v4.isValid, true);
});
