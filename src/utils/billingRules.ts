/**
 * Pure domain logic for Nursery Billing, Plan Limits, and Attendance rules.
 * Separated from Express/React for deterministic unit testing.
 */

export interface InvoiceItem {
  id: string;
  amountPiastres: number; // Stored in piastres (1 EGP = 100 piastres)
  status: 'unpaid' | 'partial' | 'paid' | 'cancelled';
}

export interface PaymentItem {
  id: string;
  invoiceId: string;
  amountPiastres: number;
  isReversal: boolean;
}

/**
 * Calculates net paid amount for an invoice, accounting for reversals.
 */
export function calculateNetPaidPiastres(payments: PaymentItem[], invoiceId?: string): number {
  return payments
    .filter((p) => !invoiceId || p.invoiceId === invoiceId)
    .reduce((sum, p) => (p.isReversal ? sum - p.amountPiastres : sum + p.amountPiastres), 0);
}

/**
 * Computes remaining balance for a specific invoice.
 */
export function computeInvoiceBalance(invoice: InvoiceItem, payments: PaymentItem[]): {
  amountPiastres: number;
  paidPiastres: number;
  remainingPiastres: number;
  status: 'unpaid' | 'partial' | 'paid' | 'cancelled';
} {
  if (invoice.status === 'cancelled') {
    return {
      amountPiastres: invoice.amountPiastres,
      paidPiastres: 0,
      remainingPiastres: 0,
      status: 'cancelled',
    };
  }

  const paid = Math.max(0, calculateNetPaidPiastres(payments, invoice.id));
  const remaining = Math.max(0, invoice.amountPiastres - paid);

  let status: 'unpaid' | 'partial' | 'paid' = 'unpaid';
  if (remaining === 0 && paid > 0) {
    status = 'paid';
  } else if (paid > 0 && remaining > 0) {
    status = 'partial';
  }

  return {
    amountPiastres: invoice.amountPiastres,
    paidPiastres: paid,
    remainingPiastres: remaining,
    status,
  };
}

/**
 * Formats piastres into Egyptian Pounds (EGP) with Arabic label 'ج.م'.
 * 100 piastres = 1.00 EGP
 * Uses standard numerals as confirmed in Phase 1 clarification.
 */
export function formatEgp(piastres: number): string {
  const egp = (piastres / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${egp} ج.م`;
}

/**
 * Converts EGP amount (e.g. 1500 or 1500.50) into integer piastres.
 */
export function egpToPiastres(egp: number | string): number {
  const num = typeof egp === 'string' ? parseFloat(egp) : egp;
  if (isNaN(num) || num < 0) {
    throw new Error('المبلغ غير صالح');
  }
  return Math.round(num * 100);
}

/**
 * Enforces SaaS subscription active child limit.
 */
export function canEnrollChild(currentActiveCount: number, planMaxChildren: number): boolean {
  return currentActiveCount < planMaxChildren;
}

/**
 * Validates attendance check-out transition.
 */
export function validateAttendanceCheckout(
  checkInTime: string,
  checkOutTime: string
): { isValid: boolean; error?: string } {
  if (!checkInTime) {
    return { isValid: false, error: 'الطفل لم يتم تسجيل حضوره بعد' };
  }
  if (!checkOutTime) {
    return { isValid: false, error: 'وقت الانصراف مطلوب' };
  }
  if (checkOutTime <= checkInTime) {
    return { isValid: false, error: 'وقت الانصراف يجب أن يكون بعد وقت الحضور' };
  }
  return { isValid: true };
}
