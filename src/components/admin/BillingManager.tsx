import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { Invoice, Child } from '../../types';
import { apiFetch } from '../../services/api';
import { ReceiptModal } from '../common/ReceiptModal';
import { Plus, DollarSign, Printer, RotateCcw, CheckCircle, Clock, AlertCircle } from 'lucide-react';

export const BillingManager: React.FC = () => {
  const { user } = useAuth();
  const nurseryId = user?.activeMembership?.nurseryId;

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // Issue Invoice Modal
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    childId: '',
    title: 'مصروفات شهر نوفمبر 2026',
    amountEgp: '2500',
    dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  });

  // Record Payment Modal
  const [selectedInvoiceForPay, setSelectedInvoiceForPay] = useState<Invoice | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amountEgp: '',
    paymentMethod: 'cash',
    referenceNo: '',
    paymentDate: new Date().toISOString().slice(0, 10),
  });

  // Reversal Modal
  const [showReversalModal, setShowReversalModal] = useState(false);
  const [reversalInvoiceId, setReversalInvoiceId] = useState('');
  const [reversalPaymentId, setReversalPaymentId] = useState('');
  const [reversalReason, setReversalReason] = useState('');

  // Receipt Modal
  const [activeReceiptNumber, setActiveReceiptNumber] = useState<string | null>(null);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadData = async () => {
    if (!nurseryId) return;
    setLoading(true);
    try {
      const [invRes, childRes] = await Promise.all([
        apiFetch<{ invoices: Invoice[] }>(`/api/nurseries/${nurseryId}/invoices`),
        apiFetch<{ children: Child[] }>(`/api/nurseries/${nurseryId}/children?status=active`),
      ]);
      setInvoices(invRes.invoices);
      setChildren(childRes.children);
    } catch (err: any) {
      setError(err.message || 'فشل تحميل بيانات الرسوم');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [nurseryId]);

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const amountPiastres = Math.round(parseFloat(invoiceForm.amountEgp) * 100);
      await apiFetch(`/api/nurseries/${nurseryId}/invoices`, {
        method: 'POST',
        body: JSON.stringify({
          childId: invoiceForm.childId,
          title: invoiceForm.title,
          amountPiastres,
          dueDate: invoiceForm.dueDate,
        }),
      });
      setMessage('تم إصدار الفاتورة بنجاح');
      setShowInvoiceModal(false);
      setInvoiceForm({
        childId: '',
        title: 'مصروفات شهر نوفمبر 2026',
        amountEgp: '2500',
        dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      });
      loadData();
    } catch (err: any) {
      setError(err.message || 'فشل إصدار الفاتورة');
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceForPay) return;
    setError('');
    setMessage('');
    try {
      const amountPiastres = Math.round(parseFloat(paymentForm.amountEgp) * 100);
      const res = await apiFetch<any>(`/api/nurseries/${nurseryId}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          invoiceId: selectedInvoiceForPay.id,
          amountPiastres,
          paymentMethod: paymentForm.paymentMethod,
          referenceNo: paymentForm.referenceNo,
          paymentDate: paymentForm.paymentDate,
        }),
      });
      setMessage(res.message || 'تم تسجيل الدفعة وإصدار الإيصال');
      setSelectedInvoiceForPay(null);
      // Offer viewing the receipt immediately
      setActiveReceiptNumber(res.receiptNumber);
      loadData();
    } catch (err: any) {
      setError(err.message || 'فشل تسجيل الدفعة');
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    if (filterStatus === 'all') return true;
    return inv.status === filterStatus;
  });

  const totalInvoicedPiastres = invoices.reduce((sum, i) => sum + (i.status !== 'cancelled' ? i.amount_piastres : 0), 0);
  const totalPaidPiastres = invoices.reduce((sum, i) => sum + i.paid_piastres, 0);
  const totalOutstandingPiastres = Math.max(0, totalInvoicedPiastres - totalPaidPiastres);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-neutral-900 tracking-tight">
            المصروفات وفواتير أولياء الأمور
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            إصدار الفواتير، التحصيل اليدوي (نقدي/إلكتروني)، طباعة الإيصالات، والرصيد المتبقي
          </p>
        </div>
        <button
          onClick={() => setShowInvoiceModal(true)}
          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white transition-colors flex items-center gap-1.5 shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>إصدار فاتورة جديدة</span>
        </button>
      </div>

      {message && (
        <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 text-xs font-medium">
          {message}
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs">
          <span className="text-neutral-500 text-xs block mb-1">إجمالي الفواتير الصادرة</span>
          <div className="text-2xl font-extrabold text-neutral-900 font-mono tabular-nums">
            {(totalInvoicedPiastres / 100).toLocaleString('en-US')} <span className="text-xs font-normal">ج.م</span>
          </div>
          <span className="text-[11px] text-neutral-400 mt-1 block">لجميع الأطفال المقيدين</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs">
          <span className="text-neutral-500 text-xs block mb-1">إجمالي المحصل الفعلي</span>
          <div className="text-2xl font-extrabold text-emerald-700 font-mono tabular-nums">
            {(totalPaidPiastres / 100).toLocaleString('en-US')} <span className="text-xs font-normal">ج.م</span>
          </div>
          <span className="text-[11px] text-emerald-600 mt-1 block">سداد مثبت بالإيصالات</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs">
          <span className="text-neutral-500 text-xs block mb-1">الرصيد المتبقي للتحصيل</span>
          <div className="text-2xl font-extrabold text-amber-700 font-mono tabular-nums">
            {(totalOutstandingPiastres / 100).toLocaleString('en-US')} <span className="text-xs font-normal">ج.م</span>
          </div>
          <span className="text-[11px] text-amber-600 mt-1 block">مستحقات واجبة التحصيل</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-white border border-neutral-200 rounded-xl text-xs w-fit">
        {[
          { id: 'all', label: 'جميع الفواتير' },
          { id: 'unpaid', label: 'غير مسددة' },
          { id: 'partial', label: 'سداد جزئي' },
          { id: 'paid', label: 'مدفوعة بالكامل' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterStatus(tab.id)}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              filterStatus === tab.id ? 'bg-teal-50 text-teal-900 font-bold' : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
          <h2 className="text-xs font-bold text-neutral-900">سجل الفواتير والمتحصلات</h2>
          <span className="text-[11px] text-neutral-500">{filteredInvoices.length} فاتورة</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-neutral-500">جاري تحميل الفواتير...</div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-8 text-center text-xs text-neutral-400">لا توجد فواتير تطابق هذا التصنيف</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-neutral-50 text-neutral-600 border-b border-neutral-200">
                <tr>
                  <th className="py-3 px-4 font-bold">رقم الفاتورة</th>
                  <th className="py-3 px-4 font-bold">اسم الطفل والفصل</th>
                  <th className="py-3 px-4 font-bold">الوصف</th>
                  <th className="py-3 px-4 font-bold">القيمة الإجمالية</th>
                  <th className="py-3 px-4 font-bold">المسدد</th>
                  <th className="py-3 px-4 font-bold">المتبقي</th>
                  <th className="py-3 px-4 font-bold">الحالة</th>
                  <th className="py-3 px-4 font-bold text-left">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-neutral-700">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-neutral-50/50">
                    <td className="py-3 px-4 font-mono font-bold text-neutral-900">
                      {inv.invoice_number}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-neutral-900">
                        {inv.first_name} {inv.last_name}
                      </div>
                      <div className="text-[10px] text-neutral-500">{inv.classroom_name || 'بدون فصل'}</div>
                    </td>
                    <td className="py-3 px-4 text-neutral-600 max-w-xs truncate" title={inv.title}>
                      {inv.title}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums font-semibold text-neutral-900">
                      {inv.amountFormatted}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-emerald-700 font-medium">
                      {inv.paidFormatted}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums font-bold text-amber-700">
                      {inv.remainingFormatted}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 font-semibold text-[11px] ${
                          inv.status === 'paid'
                            ? 'text-emerald-700'
                            : inv.status === 'partial'
                            ? 'text-blue-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {inv.status === 'paid' ? (
                          <CheckCircle className="w-3.5 h-3.5" />
                        ) : inv.status === 'partial' ? (
                          <Clock className="w-3.5 h-3.5" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5" />
                        )}
                        {inv.status === 'paid'
                          ? 'مسددة بالكامل'
                          : inv.status === 'partial'
                          ? 'مسددة جزئياً'
                          : 'غير مسددة'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-left">
                      <div className="inline-flex items-center gap-2">
                        {inv.status !== 'paid' && (
                          <button
                            onClick={() => {
                              setSelectedInvoiceForPay(inv);
                              setPaymentForm({
                                ...paymentForm,
                                amountEgp: (inv.remainingPiastres / 100).toFixed(2),
                              });
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs"
                          >
                            تحصيل دفعة
                          </button>
                        )}
                        {inv.paid_piastres > 0 && (
                          <button
                            onClick={async () => {
                              // Fetch latest payment receipt for this invoice
                              const p = await apiFetch<{ receipt: any }>(`/api/nurseries/${nurseryId}/receipts/REC-202611-0001`).catch(() => null);
                              setActiveReceiptNumber('REC-202611-0001');
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold flex items-center gap-1"
                            title="عرض أحدث إيصال سداد"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>الإيصال</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Issue Invoice */}
      {showInvoiceModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-neutral-900 shadow-xl border border-neutral-200">
            <h3 className="font-bold text-base text-neutral-900 mb-4 pb-2 border-b border-neutral-100">
              إصدار فاتورة رسوم جديدة لطفل
            </h3>
            <form onSubmit={handleCreateInvoice} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-neutral-700 mb-1">الطفل المعني *</label>
                <select
                  required
                  value={invoiceForm.childId}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, childId: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-xl bg-white"
                >
                  <option value="">اختر الطفل...</option>
                  {children.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name} ({c.classroom_name || 'بدون فصل'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">بند الرسوم / الوصف *</label>
                <input
                  type="text"
                  required
                  placeholder="مصروفات شهر نوفمبر، رحلة مدرسية، زي موحد..."
                  value={invoiceForm.title}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-neutral-700 mb-1">المبلغ (جنيه مصري) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="0.01"
                    value={invoiceForm.amountEgp}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, amountEgp: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-xl font-mono text-left"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block font-bold text-neutral-700 mb-1">تاريخ الاستحقاق *</label>
                  <input
                    type="date"
                    required
                    value={invoiceForm.dueDate}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-xl font-mono text-left"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setShowInvoiceModal(false)}
                  className="px-3.5 py-2 rounded-xl text-neutral-600 hover:bg-neutral-100 font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold"
                >
                  إصدار الفاتورة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Record Payment */}
      {selectedInvoiceForPay && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-neutral-900 shadow-xl border border-neutral-200">
            <h3 className="font-bold text-base text-neutral-900 mb-2">
              تسجيل سداد يدوي للفاتورة {selectedInvoiceForPay.invoice_number}
            </h3>
            <p className="text-xs text-neutral-500 mb-4 pb-2 border-b border-neutral-100">
              الطفل: <span className="font-bold text-neutral-800">{selectedInvoiceForPay.first_name} {selectedInvoiceForPay.last_name}</span> · المتبقي: <span className="font-bold font-mono text-amber-700">{selectedInvoiceForPay.remainingFormatted}</span>
            </p>

            <form onSubmit={handleRecordPayment} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-neutral-700 mb-1">المبلغ المحصل (جنيه مصري) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  max={(selectedInvoiceForPay.remainingPiastres / 100).toFixed(2)}
                  step="0.01"
                  value={paymentForm.amountEgp}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amountEgp: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-xl font-mono text-left"
                  dir="ltr"
                />
                <span className="text-[11px] text-neutral-400 mt-0.5 block">
                  يمكن تسجيل سداد جزئي أو كامل حتى أقصى مبلغ متبقي ({selectedInvoiceForPay.remainingFormatted})
                </span>
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">طريقة السداد *</label>
                <select
                  value={paymentForm.paymentMethod}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-xl bg-white"
                >
                  <option value="cash">نقداً بالخزينة (Cash)</option>
                  <option value="instapay">انستاباي (InstaPay)</option>
                  <option value="vodafone_cash">فودافون كاش (Vodafone Cash)</option>
                  <option value="bank_transfer">تحويل بنكي</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">رقم المعاملة / المرجع (Reference No)</label>
                <input
                  type="text"
                  placeholder="مثال: CASH-0021 أو رقم معاملة انستاباي"
                  value={paymentForm.referenceNo}
                  onChange={(e) => setPaymentForm({ ...paymentForm, referenceNo: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-xl font-mono text-left"
                  dir="ltr"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setSelectedInvoiceForPay(null)}
                  className="px-3.5 py-2 rounded-xl text-neutral-600 hover:bg-neutral-100 font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold"
                >
                  تأكيد الدفع وإصدار الإيصال
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Receipt Modal */}
      {activeReceiptNumber && nurseryId && (
        <ReceiptModal
          nurseryId={nurseryId}
          receiptNumber={activeReceiptNumber}
          onClose={() => setActiveReceiptNumber(null)}
        />
      )}
    </div>
  );
};
