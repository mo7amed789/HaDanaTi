import React, { useEffect, useState } from 'react';
import type { Receipt } from '../../types';
import { apiFetch } from '../../services/api';
import { Printer, X, CheckCircle, Building } from 'lucide-react';

interface ReceiptModalProps {
  nurseryId: string;
  receiptNumber: string;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ nurseryId, receiptNumber, onClose }) => {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<{ receipt: Receipt }>(`/api/nurseries/${nurseryId}/receipts/${receiptNumber}`)
      .then((res) => setReceipt(res.receipt))
      .catch((err) => setError(err.message || 'فشل تحميل بيانات الإيصال'))
      .finally(() => setLoading(false));
  }, [nurseryId, receiptNumber]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 sm:p-8 text-neutral-900 border border-neutral-200">
        <div className="flex items-center justify-between pb-4 border-b border-neutral-100 no-print">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-teal-600" />
            <h3 className="font-bold text-base text-neutral-900">إيصال سداد رسوم حضانة</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-800 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-neutral-500">جاري تحميل بيانات الإيصال...</div>
        ) : error || !receipt ? (
          <div className="py-8 text-center text-sm text-rose-600">{error || 'لم يتم العثور على الإيصال'}</div>
        ) : (
          <div className="mt-4 space-y-5 text-right font-sans">
            {/* Nursery Header */}
            <div className="text-center pb-4 border-b border-neutral-100">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-teal-50 text-teal-700 mb-2">
                <Building className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-neutral-900">{receipt.nursery_name}</h2>
              <div className="flex items-center justify-center gap-3 text-xs text-neutral-500 mt-1">
                {receipt.nursery_address && <span>{receipt.nursery_address}</span>}
                {receipt.nursery_phone && (
                  <>
                    <span>·</span>
                    <span className="font-mono tabular-nums">{receipt.nursery_phone}</span>
                  </>
                )}
              </div>
            </div>

            {/* Receipt Identification */}
            <div className="bg-neutral-50 p-3.5 rounded-xl flex items-center justify-between text-xs">
              <div>
                <span className="text-neutral-500 block text-[11px]">رقم الإيصال الرسمي:</span>
                <span className="font-bold font-mono text-neutral-900 text-sm tracking-wider">{receipt.receipt_number}</span>
              </div>
              <div className="text-left">
                <span className="text-neutral-500 block text-[11px]">تاريخ السداد:</span>
                <span className="font-medium font-mono tabular-nums text-neutral-800">{receipt.payment_date}</span>
              </div>
            </div>

            {/* Child & Parent Details */}
            <div className="space-y-2 text-xs border-b border-neutral-100 pb-4">
              <div className="flex justify-between py-1">
                <span className="text-neutral-500">اسم الطفل:</span>
                <span className="font-bold text-neutral-900">
                  {receipt.first_name} {receipt.last_name}
                </span>
              </div>
              {receipt.classroom_name && (
                <div className="flex justify-between py-1">
                  <span className="text-neutral-500">الفصل:</span>
                  <span className="text-neutral-800">{receipt.classroom_name}</span>
                </div>
              )}
              <div className="flex justify-between py-1">
                <span className="text-neutral-500">بند الرسوم / الفاتورة:</span>
                <span className="text-neutral-800">{receipt.invoice_title} ({receipt.invoice_number})</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-neutral-500">طريقة التحصيل:</span>
                <span className="text-neutral-800 font-medium">
                  {receipt.payment_method === 'cash' && 'نقداً بالخزينة'}
                  {receipt.payment_method === 'instapay' && 'انستاباي (InstaPay)'}
                  {receipt.payment_method === 'vodafone_cash' && 'فودافون كاش'}
                  {receipt.payment_method === 'bank_transfer' && 'تحويل بنكي'}
                  {receipt.reference_no && ` - مرجع: ${receipt.reference_no}`}
                </span>
              </div>
            </div>

            {/* Amounts Breakdown */}
            <div className="space-y-2 text-xs border-b border-neutral-100 pb-4">
              <div className="flex justify-between py-1">
                <span className="text-neutral-500">إجمالي قيمة الفاتورة:</span>
                <span className="font-mono tabular-nums text-neutral-700">{receipt.invoiceTotalFormatted}</span>
              </div>
              <div className="flex justify-between py-1 text-sm font-bold text-teal-800 bg-teal-50/60 p-2.5 rounded-lg">
                <span>المبلغ المسدد بهذا الإيصال:</span>
                <span className="font-mono tabular-nums">{receipt.amountFormatted}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-neutral-500">الرصيد المتبقي على الفاتورة:</span>
                <span className={`font-mono tabular-nums font-semibold ${receipt.remainingFormatted.startsWith('0') ? 'text-emerald-600' : 'text-amber-700'}`}>
                  {receipt.remainingFormatted}
                </span>
              </div>
            </div>

            {/* Footer Sign-off */}
            <div className="pt-2 flex items-center justify-between text-[11px] text-neutral-500">
              <div>
                <span>الموظف المسؤول: </span>
                <span className="font-medium text-neutral-800">{receipt.recorded_by_user_name}</span>
              </div>
              <div className="font-mono text-[10px] text-neutral-400">
                حضانتي · نظام محاسبي معتمد
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
