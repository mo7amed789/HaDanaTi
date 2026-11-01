import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { Child, Invoice, Announcement } from '../../types';
import { apiFetch } from '../../services/api';
import { ReceiptModal } from '../common/ReceiptModal';
import { Baby, Calendar, Clock, Utensils, Moon, Activity, Printer, Send, ShieldAlert, HeartHandshake, CheckCircle2 } from 'lucide-react';

interface TimelineItem {
  date: string;
  attendance_status?: string;
  check_in_time?: string;
  check_out_time?: string;
  pickup_person_name?: string;
  attendance_notes?: string;
  mood?: 'happy' | 'calm' | 'fussy' | 'tired';
  meals_summary?: string;
  nap_minutes?: number;
  activities_summary?: string;
  individual_notes?: string;
  teacher_name?: string;
  published_at?: string;
}

export const ParentPortal: React.FC<{ activeTab: string }> = ({ activeTab }) => {
  const { user } = useAuth();
  const nurseryId = user?.activeMembership?.nurseryId;

  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  // Absence Notice Form State
  const [absenceForm, setAbsenceForm] = useState({
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    reason: '',
  });

  // Contact Change Request Form State
  const [contactForm, setContactForm] = useState({
    emergencyContactName: '',
    emergencyContactPhone: '',
    notes: '',
  });

  // Active Receipt Modal
  const [activeReceiptNumber, setActiveReceiptNumber] = useState<string | null>(null);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadInitialData = async () => {
    if (!nurseryId) return;
    setLoading(true);
    try {
      // 1. Fetch children linked to parent
      const childRes = await apiFetch<{ children: Child[] }>(`/api/nurseries/${nurseryId}/children`);
      setChildren(childRes.children);
      const firstChildId = selectedChildId || childRes.children[0]?.id || '';
      setSelectedChildId(firstChildId);

      // 2. Fetch announcements
      const annRes = await apiFetch<{ announcements: Announcement[] }>(`/api/nurseries/${nurseryId}/announcements`);
      setAnnouncements(annRes.announcements);

      if (firstChildId) {
        // 3. Fetch child timeline and invoices
        const [timeRes, invRes] = await Promise.all([
          apiFetch<{ timeline: TimelineItem[] }>(`/api/nurseries/${nurseryId}/parent/child/${firstChildId}/timeline`),
          apiFetch<{ invoices: Invoice[] }>(`/api/nurseries/${nurseryId}/invoices?childId=${firstChildId}`),
        ]);
        setTimeline(timeRes.timeline);
        setInvoices(invRes.invoices);
      }
    } catch (err: any) {
      setError(err.message || 'فشل تحميل بيانات بوابة ولي الأمر');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [nurseryId, selectedChildId]);

  const handleChildSwitch = (childId: string) => {
    setSelectedChildId(childId);
  };

  const handleSubmitAbsence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChildId) return;
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/nurseries/${nurseryId}/absence-notices`, {
        method: 'POST',
        body: JSON.stringify({
          childId: selectedChildId,
          ...absenceForm,
        }),
      });
      setMessage('تم إرسال إشعار الغياب بنجاح لإدارة الحضانة');
      setAbsenceForm({
        startDate: new Date().toISOString().slice(0, 10),
        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        reason: '',
      });
    } catch (err: any) {
      setError(err.message || 'فشل إرسال إشعار الغياب');
    }
  };

  const handleSubmitContactChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChildId) return;
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/nurseries/${nurseryId}/contact-change-requests`, {
        method: 'POST',
        body: JSON.stringify({
          childId: selectedChildId,
          ...contactForm,
        }),
      });
      setMessage('تم تقديم طلب تعديل بيانات الطوارئ لمراجعة إدارة الحضانة');
      setContactForm({ emergencyContactName: '', emergencyContactPhone: '', notes: '' });
    } catch (err: any) {
      setError(err.message || 'فشل تقديم الطلب');
    }
  };

  const selectedChild = children.find((c) => c.id === selectedChildId);

  // Financial summary
  const totalBilled = invoices.reduce((sum, inv) => sum + inv.amount_piastres, 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + inv.paid_piastres, 0);
  const totalRemaining = Math.max(0, totalBilled - totalPaid);

  return (
    <div className="space-y-6">
      {/* Top Banner and Child Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-neutral-900 tracking-tight">
            بوابة ولي الأمر (Parent Portal)
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            متابعة يوميات الطفل، حضور وانصراف، المصروفات، وتقديم الإشعارات
          </p>
        </div>

        {/* Child Switcher if multiple children */}
        {children.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-neutral-700 whitespace-nowrap">الطفل الحالي:</span>
            <div className="inline-flex rounded-xl bg-white p-1 border border-neutral-200">
              {children.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleChildSwitch(c.id)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                    selectedChildId === c.id ? 'bg-teal-50 text-teal-900' : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  {c.first_name}
                </button>
              ))}
            </div>
          </div>
        )}
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

      {/* Selected Child Info Strip */}
      {selectedChild && (
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-100/60 text-teal-800 flex items-center justify-center font-bold text-base">
              {selectedChild.first_name.charAt(0)}
            </div>
            <div>
              <div className="font-bold text-neutral-900 text-sm">
                {selectedChild.first_name} {selectedChild.last_name}
              </div>
              <div className="text-neutral-500 text-[11px] mt-0.5">
                فصل: <span className="font-semibold text-neutral-800">{selectedChild.classroom_name || 'غير محدد'}</span> · تاريخ الميلاد: <span className="font-mono tabular-nums">{selectedChild.date_of_birth}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-left font-mono">
            <div>
              <span className="text-[10px] text-neutral-400 block font-sans">المتبقي من الرسوم:</span>
              <span className={`text-sm font-bold tabular-nums ${totalRemaining > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                {(totalRemaining / 100).toLocaleString('en-US')} ج.م
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Tabs Content */}
      {activeTab === 'parent_billing' ? (
        /* Invoices & Receipts Tab */
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-xs">
            <h2 className="text-xs font-bold text-neutral-900 mb-3 pb-2 border-b border-neutral-100">
              كشف حساب المصروفات وسجل السداد
            </h2>

            {invoices.length === 0 ? (
              <p className="text-center text-neutral-400 text-xs py-8">لا توجد فواتير رسوم مسجلة للطفل</p>
            ) : (
              <div className="space-y-3">
                {invoices.map((inv) => (
                  <div key={inv.id} className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-neutral-900">{inv.title}</span>
                        <span className="font-mono text-[11px] text-neutral-500">({inv.invoice_number})</span>
                      </div>
                      <div className="text-neutral-500 text-[11px] mt-1 flex items-center gap-2">
                        <span>تاريخ الاستحقاق: <span className="font-mono tabular-nums">{inv.due_date}</span></span>
                        <span>·</span>
                        <span className={`font-semibold ${inv.status === 'paid' ? 'text-emerald-700' : inv.status === 'partial' ? 'text-blue-700' : 'text-amber-700'}`}>
                          {inv.status === 'paid' ? 'مدفوعة بالكامل' : inv.status === 'partial' ? 'مدفوعة جزئياً' : 'مستحقة السداد'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4">
                      <div className="text-left font-mono">
                        <div className="text-neutral-900 font-bold tabular-nums">{inv.amountFormatted}</div>
                        {inv.paid_piastres > 0 && (
                          <div className="text-[10px] text-emerald-700">مسدد: {inv.paidFormatted}</div>
                        )}
                        {inv.remainingPiastres > 0 && (
                          <div className="text-[10px] text-amber-700 font-bold">متبقي: {inv.remainingFormatted}</div>
                        )}
                      </div>

                      {inv.paid_piastres > 0 && (
                        <button
                          onClick={() => setActiveReceiptNumber('REC-202611-0001')}
                          className="px-3 py-1.5 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-800 font-bold text-xs flex items-center gap-1.5 shadow-xs"
                        >
                          <Printer className="w-3.5 h-3.5 text-neutral-500" />
                          <span>عرض الإيصال</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'parent_requests' ? (
        /* Absence Notice & Contact Requests Tab */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Submit Absence Notice */}
          <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-xs">
            <h2 className="text-xs font-bold text-neutral-900 mb-2 pb-2 border-b border-neutral-100 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-teal-600" />
              <span>تقديم إشعار غياب مسبق</span>
            </h2>
            <p className="text-[11px] text-neutral-500 mb-4">
              إخطار إدارة الحضانة ومسؤولي الفصل بمواعيد وسبب غياب الطفل
            </p>

            <form onSubmit={handleSubmitAbsence} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-neutral-700 mb-1">من تاريخ *</label>
                  <input
                    type="date"
                    required
                    value={absenceForm.startDate}
                    onChange={(e) => setAbsenceForm({ ...absenceForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-xl font-mono text-left"
                  />
                </div>
                <div>
                  <label className="block font-bold text-neutral-700 mb-1">إلى تاريخ *</label>
                  <input
                    type="date"
                    required
                    value={absenceForm.endDate}
                    onChange={(e) => setAbsenceForm({ ...absenceForm, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-xl font-mono text-left"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">سبب الغياب *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="ظروف عائلية، وعكة صحية، سفر..."
                  value={absenceForm.reason}
                  onChange={(e) => setAbsenceForm({ ...absenceForm, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-xl"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs"
              >
                إرسال إشعار الغياب
              </button>
            </form>
          </div>

          {/* Submit Contact Change Request */}
          <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-xs">
            <h2 className="text-xs font-bold text-neutral-900 mb-2 pb-2 border-b border-neutral-100 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <span>طلب تحديث جهة اتصال الطوارئ</span>
            </h2>
            <p className="text-[11px] text-neutral-500 mb-4">
              يخضع التحديث لمراجعة واعتماد مديرة الحضانة قبل تفعيله في السجل
            </p>

            <form onSubmit={handleSubmitContactChange} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-neutral-700 mb-1">اسم جهة الطوارئ الجديد *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: د. حسام خليل (العم)"
                  value={contactForm.emergencyContactName}
                  onChange={(e) => setContactForm({ ...contactForm, emergencyContactName: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">رقم هاتف الطوارئ الجديد *</label>
                <input
                  type="tel"
                  required
                  placeholder="010XXXXXXXX"
                  value={contactForm.emergencyContactPhone}
                  onChange={(e) => setContactForm({ ...contactForm, emergencyContactPhone: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-xl font-mono text-left"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">ملاحظة أو سبب التعديل</label>
                <input
                  type="text"
                  placeholder="تغيير مكان السكن أو رقم الهاتف"
                  value={contactForm.notes}
                  onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-xl"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs"
              >
                إرسال طلب التعديل للمراجعة
              </button>
            </form>
          </div>
        </div>
      ) : activeTab === 'parent_announcements' ? (
        /* Announcements Tab */
        <div className="space-y-3">
          <div className="p-4 bg-white rounded-xl border border-neutral-200">
            <h2 className="text-xs font-bold text-neutral-900 mb-3 pb-2 border-b border-neutral-100">
              إعلانات الحضانة الموجهة لولي الأمر
            </h2>

            {announcements.length === 0 ? (
              <p className="text-center text-neutral-400 text-xs py-8">لا توجد إعلانات حالياً</p>
            ) : (
              announcements.map((ann) => (
                <div key={ann.id} className="p-4 rounded-xl border border-neutral-200 mb-3 text-right">
                  <div className="flex items-center justify-between text-xs font-bold text-neutral-900 mb-1">
                    <span>{ann.title}</span>
                    <span className="text-[10px] font-mono text-neutral-400">{ann.created_at.slice(0, 10)}</span>
                  </div>
                  <p className="text-xs text-neutral-600 leading-relaxed whitespace-pre-wrap">{ann.content}</p>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        /* Chronological Daily Timeline (Default) */
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-xs">
            <h2 className="text-xs font-bold text-neutral-900 mb-3 pb-2 border-b border-neutral-100">
              الخط الزمني اليومي والأنشطة (Daily Timeline)
            </h2>

            {timeline.length === 0 ? (
              <p className="text-center text-neutral-400 text-xs py-12">لا توجد سجلات حضور أو تقارير مدونة بعد للطفل</p>
            ) : (
              <div className="space-y-4">
                {timeline.map((item, idx) => (
                  <div key={item.date || idx} className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/40 text-right space-y-3">
                    {/* Date and attendance status */}
                    <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-teal-600" />
                        <span className="font-bold text-sm text-neutral-900 font-mono tabular-nums">{item.date}</span>
                      </div>
                      <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        {item.attendance_status === 'present' ? 'حضور بالفصل' : 'مسجل'}
                      </span>
                    </div>

                    {/* Attendance check-in / check-out */}
                    {(item.check_in_time || item.check_out_time) && (
                      <div className="bg-white p-2.5 rounded-lg border border-neutral-100 text-xs flex flex-wrap items-center justify-between gap-3 font-mono">
                        <div>
                          <span className="text-neutral-500 font-sans ml-1">حضور:</span>
                          <span className="font-bold tabular-nums text-neutral-900">{item.check_in_time || '—'}</span>
                        </div>
                        {item.check_out_time && (
                          <div>
                            <span className="text-neutral-500 font-sans ml-1">انصراف:</span>
                            <span className="font-bold tabular-nums text-neutral-900">{item.check_out_time}</span>
                            {item.pickup_person_name && (
                              <span className="font-sans text-[11px] text-teal-800 mr-2">
                                (استلمه: {item.pickup_person_name})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Daily Report Details if published */}
                    {item.mood ? (
                      <div className="bg-white p-3.5 rounded-lg border border-neutral-100 space-y-2.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-neutral-900 flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5 text-teal-600" />
                            <span>تقرير المعلمة اليومي</span>
                          </span>
                          <span className="text-[11px] font-medium text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md">
                            المزاج: {item.mood === 'happy' ? 'مبتهج 😊' : item.mood === 'calm' ? 'هادئ 😌' : 'متعب 😴'}
                          </span>
                        </div>

                        {/* Meals */}
                        <div className="flex items-start gap-2 text-neutral-700">
                          <Utensils className="w-3.5 h-3.5 text-neutral-400 mt-0.5 shrink-0" />
                          <div>
                            <span className="font-bold text-neutral-800">الوجبات والتغذية: </span>
                            <span>{item.meals_summary}</span>
                          </div>
                        </div>

                        {/* Nap time */}
                        {item.nap_minutes ? (
                          <div className="flex items-center gap-2 text-neutral-700">
                            <Moon className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                            <div>
                              <span className="font-bold text-neutral-800">فترة القيلولة: </span>
                              <span className="font-mono tabular-nums">{item.nap_minutes} دقيقة</span>
                            </div>
                          </div>
                        ) : null}

                        {/* Activities */}
                        <div className="text-neutral-700">
                          <span className="font-bold text-neutral-800">الأنشطة المنفذة: </span>
                          <span>{item.activities_summary}</span>
                        </div>

                        {/* Individual Notes */}
                        {item.individual_notes && (
                          <div className="bg-teal-50/50 p-2.5 rounded-lg border border-teal-100 text-teal-900 text-[11px] leading-relaxed">
                            <span className="font-bold block mb-0.5">ملاحظة فردية خاصة لطفلك:</span>
                            {item.individual_notes}
                          </div>
                        )}

                        {item.teacher_name && (
                          <div className="text-[10px] text-neutral-400 text-left pt-1">
                            نشر بواسطة: {item.teacher_name}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-[11px] text-neutral-400 italic">
                        لم يتم نشر تقرير الأنشطة اليومي بعد لهذا اليوم
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
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
