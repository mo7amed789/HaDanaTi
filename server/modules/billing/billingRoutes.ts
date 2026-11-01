import { Router } from 'express';
import { db } from '../../db/database';
import { requireAuth, requireNurseryRole, AuthenticatedRequest, logAudit } from '../../middleware/auth';
import { computeInvoiceBalance, formatEgp } from '../../../src/utils/billingRules';

export const billingRouter = Router({ mergeParams: true });

billingRouter.use(requireAuth);

/**
 * List Invoices
 * - Admin sees all invoices in nursery
 * - Parent sees only invoices for their linked children
 * - Teacher is DENIED access to financial records (enforcing security requirement)
 */
billingRouter.get('/:nurseryId/invoices', requireNurseryRole(['admin', 'parent']), (req: AuthenticatedRequest, res) => {
  const nurseryId = req.params.nurseryId;
  const user = req.user!;
  const role = req.membership!.role;
  const childId = req.query.childId as string | undefined;

  let query = `
    SELECT
      i.id,
      i.invoice_number,
      i.child_id,
      i.title,
      i.amount_piastres,
      i.due_date,
      i.status,
      i.created_at,
      c.first_name,
      c.last_name,
      cl.name as classroom_name,
      COALESCE(
        (SELECT SUM(CASE WHEN p.is_reversal = 1 THEN -p.amount_piastres ELSE p.amount_piastres END)
         FROM child_fee_payments p
         WHERE p.invoice_id = i.id),
        0
      ) as paid_piastres
    FROM child_fee_invoices i
    JOIN children c ON c.id = i.child_id
    LEFT JOIN classrooms cl ON cl.id = c.classroom_id
    WHERE i.nursery_id = ?
  `;

  const params: any[] = [nurseryId];

  if (role === 'parent') {
    query += ` AND i.child_id IN (SELECT child_id FROM parent_child_links WHERE parent_user_id = ? AND nursery_id = ?)`;
    params.push(user.id, nurseryId);
  }

  if (childId) {
    query += ` AND i.child_id = ?`;
    params.push(childId);
  }

  query += ` ORDER BY i.created_at DESC`;

  const rawInvoices = db.prepare(query).all(...params) as Array<{
    id: string;
    invoice_number: string;
    child_id: string;
    title: string;
    amount_piastres: number;
    due_date: string;
    status: 'unpaid' | 'partial' | 'paid' | 'cancelled';
    created_at: string;
    first_name: string;
    last_name: string;
    classroom_name: string | null;
    paid_piastres: number;
  }>;

  const invoices = rawInvoices.map((inv) => {
    const remainingPiastres = Math.max(0, inv.amount_piastres - inv.paid_piastres);
    let dynamicStatus: 'unpaid' | 'partial' | 'paid' | 'cancelled' = inv.status;
    if (inv.status !== 'cancelled') {
      if (remainingPiastres === 0 && inv.paid_piastres > 0) dynamicStatus = 'paid';
      else if (inv.paid_piastres > 0 && remainingPiastres > 0) dynamicStatus = 'partial';
      else dynamicStatus = 'unpaid';
    }

    return {
      ...inv,
      status: dynamicStatus,
      amountFormatted: formatEgp(inv.amount_piastres),
      paidFormatted: formatEgp(inv.paid_piastres),
      remainingPiastres,
      remainingFormatted: formatEgp(remainingPiastres),
    };
  });

  res.json({ invoices });
});

/**
 * Create Invoice (Admin only)
 */
billingRouter.post('/:nurseryId/invoices', requireNurseryRole(['admin']), (req: AuthenticatedRequest, res) => {
  const nurseryId = req.params.nurseryId;
  const { childId, title, amountPiastres, dueDate } = req.body;

  if (!childId || !title || !amountPiastres || !dueDate) {
    return res.status(400).json({ error: 'الطفل، وصف الفاتورة، المبلغ بالقرش، وتاريخ الاستحقاق حقول مطلوبة' });
  }

  // Verify child belongs to this nursery
  const child = db.prepare('SELECT id, first_name, last_name FROM children WHERE id = ? AND nursery_id = ?').get(childId, nurseryId) as { id: string; first_name: string; last_name: string } | undefined;
  if (!child) return res.status(404).json({ error: 'الطفل غير موجود في هذه الحضانة' });

  const invoiceId = `inv-${Date.now()}`;
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const count = (db.prepare('SELECT COUNT(*) as count FROM child_fee_invoices WHERE nursery_id = ?').get(nurseryId) as { count: number }).count + 1;
  const invoiceNumber = `INV-${yearMonth}-${String(count).padStart(4, '0')}`;

  db.prepare(`
    INSERT INTO child_fee_invoices (id, nursery_id, child_id, invoice_number, title, amount_piastres, due_date, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'unpaid', ?)
  `).run(invoiceId, nurseryId, childId, invoiceNumber, title, parseInt(amountPiastres, 10), dueDate, now.toISOString());

  logAudit(req.user!.id, 'CREATE_INVOICE', 'child_fee_invoice', invoiceId, nurseryId, { invoiceNumber, amountPiastres, childId });

  res.status(201).json({ success: true, invoiceId, invoiceNumber, message: 'تم إنشاء الفاتورة بنجاح' });
});

/**
 * Record Manual Payment (Admin only)
 */
billingRouter.post('/:nurseryId/payments', requireNurseryRole(['admin']), (req: AuthenticatedRequest, res) => {
  const nurseryId = req.params.nurseryId;
  const { invoiceId, amountPiastres, paymentMethod, referenceNo, paymentDate } = req.body;

  if (!invoiceId || !amountPiastres) {
    return res.status(400).json({ error: 'معرّف الفاتورة والمبلغ بالقرش مطلوبان' });
  }

  const invoice = db.prepare('SELECT id, nursery_id, child_id, amount_piastres, status FROM child_fee_invoices WHERE id = ? AND nursery_id = ?').get(invoiceId, nurseryId) as {
    id: string;
    nursery_id: string;
    child_id: string;
    amount_piastres: number;
    status: string;
  } | undefined;

  if (!invoice) return res.status(404).json({ error: 'الفاتورة غير موجودة في هذه الحضانة' });

  // Get current payments to verify remaining balance
  const currentPayments = db.prepare('SELECT id, invoice_id, amount_piastres, is_reversal FROM child_fee_payments WHERE invoice_id = ?').all(invoiceId) as Array<{
    id: string;
    invoice_id: string;
    amount_piastres: number;
    is_reversal: number;
  }>;

  const currentBal = computeInvoiceBalance(
    { id: invoice.id, amountPiastres: invoice.amount_piastres, status: invoice.status as any },
    currentPayments.map((p) => ({
      id: p.id,
      invoiceId: p.invoice_id,
      amountPiastres: p.amount_piastres,
      isReversal: Boolean(p.is_reversal),
    }))
  );

  const paymentPiastres = parseInt(amountPiastres, 10);
  if (paymentPiastres <= 0) {
    return res.status(400).json({ error: 'المبلغ يجب أن يكون أكبر من صفر' });
  }

  if (paymentPiastres > currentBal.remainingPiastres) {
    return res.status(400).json({
      error: `المبلغ المدخل (${formatEgp(paymentPiastres)}) أكبر من الرصيد المتبقي على الفاتورة (${formatEgp(currentBal.remainingPiastres)})`,
    });
  }

  const paymentId = `pay-${Date.now()}`;
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const receiptCount = (db.prepare('SELECT COUNT(*) as count FROM child_fee_payments WHERE nursery_id = ? AND is_reversal = 0').get(nurseryId) as { count: number }).count + 1;
  const receiptNumber = `REC-${yearMonth}-${String(receiptCount).padStart(4, '0')}`;
  const dateStr = paymentDate || now.toISOString().slice(0, 10);

  db.prepare(`
    INSERT INTO child_fee_payments (
      id, nursery_id, invoice_id, receipt_number, amount_piastres,
      payment_date, payment_method, reference_no, recorded_by_user_id,
      is_reversal, reversal_reason, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?)
  `).run(
    paymentId,
    nurseryId,
    invoiceId,
    receiptNumber,
    paymentPiastres,
    dateStr,
    paymentMethod || 'cash',
    referenceNo || null,
    req.user!.id,
    now.toISOString()
  );

  // Update invoice status
  const newRemaining = currentBal.remainingPiastres - paymentPiastres;
  const newStatus = newRemaining === 0 ? 'paid' : 'partial';
  db.prepare('UPDATE child_fee_invoices SET status = ? WHERE id = ?').run(newStatus, invoiceId);

  logAudit(req.user!.id, 'RECORD_PAYMENT', 'child_fee_payment', paymentId, nurseryId, {
    receiptNumber,
    amountPiastres: paymentPiastres,
    invoiceId,
    newStatus,
  });

  res.status(201).json({
    success: true,
    paymentId,
    receiptNumber,
    newStatus,
    remainingFormatted: formatEgp(newRemaining),
    message: 'تم تسجيل الدفعة وإصدار الإيصال بنجاح',
  });
});

/**
 * Reversal / Correction of a Payment (Admin only)
 * Strictly preserves audit history: never deletes original payment
 */
billingRouter.post('/:nurseryId/payments/:paymentId/reversal', requireNurseryRole(['admin']), (req: AuthenticatedRequest, res) => {
  const { nurseryId, paymentId } = req.params;
  const { reason } = req.body;

  if (!reason) {
    return res.status(400).json({ error: 'سبب إلغاء/عكس الدفعة إلزامي للتدقيق المالي' });
  }

  const payment = db.prepare('SELECT * FROM child_fee_payments WHERE id = ? AND nursery_id = ?').get(paymentId, nurseryId) as Record<string, any> | undefined;
  if (!payment) return res.status(404).json({ error: 'الدفعة غير موجودة' });
  if (payment.is_reversal) return res.status(400).json({ error: 'هذه الدفعة هي عملية عكس بالفعل' });

  const reversalId = `rev-${Date.now()}`;
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const receiptNumber = `REV-${yearMonth}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  db.prepare(`
    INSERT INTO child_fee_payments (
      id, nursery_id, invoice_id, receipt_number, amount_piastres,
      payment_date, payment_method, reference_no, recorded_by_user_id,
      is_reversal, reversal_reason, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(
    reversalId,
    nurseryId,
    payment.invoice_id,
    receiptNumber,
    payment.amount_piastres,
    now.toISOString().slice(0, 10),
    payment.payment_method,
    payment.receipt_number,
    req.user!.id,
    reason,
    now.toISOString()
  );

  // Recalculate invoice status
  const allPayments = db.prepare('SELECT id, invoice_id, amount_piastres, is_reversal FROM child_fee_payments WHERE invoice_id = ?').all(payment.invoice_id) as Array<{
    id: string;
    invoice_id: string;
    amount_piastres: number;
    is_reversal: number;
  }>;
  const inv = db.prepare('SELECT amount_piastres FROM child_fee_invoices WHERE id = ?').get(payment.invoice_id) as { amount_piastres: number };
  const bal = computeInvoiceBalance(
    { id: payment.invoice_id, amountPiastres: inv.amount_piastres, status: 'unpaid' },
    allPayments.map((p) => ({
      id: p.id,
      invoiceId: p.invoice_id,
      amountPiastres: p.amount_piastres,
      isReversal: Boolean(p.is_reversal),
    }))
  );
  db.prepare('UPDATE child_fee_invoices SET status = ? WHERE id = ?').run(bal.status, payment.invoice_id);

  logAudit(req.user!.id, 'REVERSE_PAYMENT', 'child_fee_payment', reversalId, nurseryId, {
    originalPaymentId: paymentId,
    amountPiastres: payment.amount_piastres,
    reason,
  });

  res.json({ success: true, reversalId, receiptNumber, message: 'تم تسجيل عملية العكس المالي بنجاح' });
});

/**
 * Printable Receipt Data Endpoint
 * Accessible by Admin or the Parent linked to the child
 */
billingRouter.get('/:nurseryId/receipts/:receiptNumber', requireNurseryRole(['admin', 'parent']), (req: AuthenticatedRequest, res) => {
  const { nurseryId, receiptNumber } = req.params;
  const user = req.user!;
  const role = req.membership!.role;

  const payment = db.prepare(`
    SELECT
      p.id,
      p.receipt_number,
      p.amount_piastres,
      p.payment_date,
      p.payment_method,
      p.reference_no,
      p.is_reversal,
      p.reversal_reason,
      p.created_at,
      i.id as invoice_id,
      i.invoice_number,
      i.title as invoice_title,
      i.amount_piastres as invoice_total_piastres,
      c.id as child_id,
      c.first_name,
      c.last_name,
      cl.name as classroom_name,
      n.name as nursery_name,
      n.phone as nursery_phone,
      n.address as nursery_address,
      u.full_name as recorded_by_user_name
    FROM child_fee_payments p
    JOIN child_fee_invoices i ON i.id = p.invoice_id
    JOIN children c ON c.id = i.child_id
    LEFT JOIN classrooms cl ON cl.id = c.classroom_id
    JOIN nurseries n ON n.id = p.nursery_id
    JOIN users u ON u.id = p.recorded_by_user_id
    WHERE p.receipt_number = ? AND p.nursery_id = ?
  `).get(receiptNumber, nurseryId) as Record<string, any> | undefined;

  if (!payment) return res.status(404).json({ error: 'الإيصال غير موجود' });

  // Security check for parent
  if (role === 'parent') {
    const isLinked = db.prepare('SELECT id FROM parent_child_links WHERE child_id = ? AND parent_user_id = ? AND nursery_id = ?').get(payment.child_id, user.id, nurseryId);
    if (!isLinked) return res.status(403).json({ error: 'غير مصرح: هذا الإيصال خاص بطفل غير مرتبط بحسابك' });
  }

  // Calculate invoice remaining balance at this moment
  const allPayments = db.prepare('SELECT amount_piastres, is_reversal FROM child_fee_payments WHERE invoice_id = ?').all(payment.invoice_id) as Array<{ amount_piastres: number; is_reversal: number }>;
  const netPaid = allPayments.reduce((sum, p) => (p.is_reversal ? sum - p.amount_piastres : sum + p.amount_piastres), 0);
  const remaining = Math.max(0, payment.invoice_total_piastres - netPaid);

  res.json({
    receipt: {
      ...payment,
      amountFormatted: formatEgp(payment.amount_piastres),
      invoiceTotalFormatted: formatEgp(payment.invoice_total_piastres),
      remainingFormatted: formatEgp(remaining),
      netPaidFormatted: formatEgp(netPaid),
    },
  });
});
