import React, { useState, useEffect } from 'react';
import type { Nursery } from '../../types';
import { apiFetch } from '../../services/api';
import { Building2, Plus, DollarSign, Users, ShieldAlert, CheckCircle, Clock } from 'lucide-react';

interface SaaSPlan {
  id: string;
  name: string;
  max_children: number;
  monthly_price_piastres: number;
  is_active: number;
}

interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  user_name: string;
  nursery_name?: string;
  created_at: string;
  details_json?: string;
}

export const PlatformOwnerDashboard: React.FC<{ activeSubTab: string }> = ({ activeSubTab }) => {
  const [stats, setStats] = useState<{
    totalNurseries: number;
    activeSubscriptions: number;
    totalRevenuePiastres: number;
    totalChildrenAcrossAllNurseries: number;
  } | null>(null);

  const [nurseries, setNurseries] = useState<Nursery[]>([]);
  const [plans, setPlans] = useState<SaaSPlan[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Create Nursery Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newNursery, setNewNursery] = useState({
    name: '',
    subdomain: '',
    phone: '',
    address: '',
    city: 'القاهرة',
    planId: 'plan-starter',
    adminName: '',
    adminEmail: '',
    adminPhone: '',
    adminPassword: 'Password123!',
  });

  // Record Subscription Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentData, setPaymentData] = useState({
    nurseryId: '',
    amountEgp: '2200',
    paymentMethod: 'instapay',
    referenceNo: '',
    notes: '',
  });

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, nurseriesRes, plansRes, logsRes] = await Promise.all([
        apiFetch<any>('/api/platform/stats'),
        apiFetch<{ nurseries: Nursery[] }>('/api/platform/nurseries'),
        apiFetch<{ plans: SaaSPlan[] }>('/api/platform/plans'),
        apiFetch<{ logs: AuditLog[] }>('/api/platform/audit-logs'),
      ]);
      setStats(statsRes);
      setNurseries(nurseriesRes.nurseries);
      setPlans(plansRes.plans);
      setAuditLogs(logsRes.logs);
    } catch (err: any) {
      setError(err.message || 'فشل تحميل بيانات منصة الإدارة');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateNursery = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await apiFetch('/api/platform/nurseries', {
        method: 'POST',
        body: JSON.stringify(newNursery),
      });
      setMessage('تم إنشاء الحضانة وتعيين المدير بنجاح');
      setShowCreateModal(false);
      loadData();
    } catch (err: any) {
      setError(err.message || 'فشل إنشاء الحضانة');
    }
  };

  const handleRecordSubscriptionPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const amountPiastres = Math.round(parseFloat(paymentData.amountEgp) * 100);
      await apiFetch('/api/platform/subscription-payments', {
        method: 'POST',
        body: JSON.stringify({
          nurseryId: paymentData.nurseryId,
          amountPiastres,
          paymentMethod: paymentData.paymentMethod,
          referenceNo: paymentData.referenceNo,
          notes: paymentData.notes,
        }),
      });
      setMessage('تم تسجيل سداد اشتراك الحضانة وتجديد الصلاحية');
      setShowPaymentModal(false);
      loadData();
    } catch (err: any) {
      setError(err.message || 'فشل تسجيل الدفعة');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-sm text-neutral-500">جاري تحميل بيانات المنصة...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & KPI strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-neutral-900 tracking-tight">
            لوحة إدارة المنصة (Platform Owner)
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            إدارة اشتراكات الحضانات المصرية، تحديد باقات وسعة الأطفال، ومتابعة الإيرادات
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPaymentModal(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-800 transition-colors flex items-center gap-1.5"
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>تسجيل سداد اشتراك</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة حضانة جديدة</span>
          </button>
        </div>
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 text-xs mb-1">
            <span>الحضانات المشتركة</span>
            <Building2 className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl font-extrabold text-neutral-900 font-mono tabular-nums">
            {stats?.totalNurseries || 0}
          </div>
          <div className="text-[11px] text-teal-700 font-medium mt-1">
            {stats?.activeSubscriptions || 0} اشتراك نشط حالياً
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 text-xs mb-1">
            <span>إجمالي الأطفال بالمنصة</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-extrabold text-neutral-900 font-mono tabular-nums">
            {stats?.totalChildrenAcrossAllNurseries || 0}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            عبر جميع الحضانات المسجلة
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 text-xs mb-1">
            <span>إيرادات الاشتراكات المحصلة</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-neutral-900 font-mono tabular-nums">
            {stats ? (stats.totalRevenuePiastres / 100).toLocaleString('en-US') : 0} <span className="text-xs font-normal">ج.م</span>
          </div>
          <div className="text-[11px] text-emerald-700 font-medium mt-1">
            رسوم اشتراكات شهرية مدفوعة
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 text-xs mb-1">
            <span>عزل أمني تام للمستأجرين</span>
            <ShieldAlert className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-sm font-bold text-neutral-800 mt-1">
            مفصول بالكامل
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            بيانات الأطفال محجوبة عن مدير المنصة
          </div>
        </div>
      </div>

      {/* Main Content Sections based on sub-tab */}
      {activeSubTab === 'platform_plans' ? (
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h2 className="text-sm font-bold text-neutral-900 mb-4">باقات الاشتراك الشهرية وسعة الأطفال</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((p) => (
              <div key={p.id} className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-sm text-neutral-900">{p.name}</h3>
                  <div className="mt-3 text-2xl font-extrabold font-mono text-teal-800">
                    {(p.monthly_price_piastres / 100).toLocaleString('en-US')} <span className="text-xs font-normal">ج.م / شهرياً</span>
                  </div>
                  <div className="mt-2 text-xs text-neutral-600 space-y-1">
                    <p>• الحد الأقصى للأطفال: <span className="font-bold font-mono">{p.max_children} طفل</span></p>
                    <p>• فصول ومعلمات غير محدودة</p>
                    <p>• إشعارات وتقارير يومية</p>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-neutral-200 text-[11px] text-teal-700 font-semibold">
                  باقة معتمدة ونشطة
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : activeSubTab === 'platform_audit' ? (
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
            <h2 className="text-xs font-bold text-neutral-900">سجل عمليات المنصة والتدقيق الأمني (Audit Log)</h2>
            <span className="text-[11px] text-neutral-500">آخر 100 عملية مسجلة</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-neutral-50 text-neutral-600 border-b border-neutral-200">
                <tr>
                  <th className="py-2.5 px-4 font-bold">الوقت والتاريخ</th>
                  <th className="py-2.5 px-4 font-bold">المنفذ</th>
                  <th className="py-2.5 px-4 font-bold">الحضانة</th>
                  <th className="py-2.5 px-4 font-bold">العملية</th>
                  <th className="py-2.5 px-4 font-bold">الكيان</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-neutral-700">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-neutral-50/60">
                    <td className="py-2.5 px-4 font-mono tabular-nums text-neutral-500">{log.created_at.slice(0, 16).replace('T', ' ')}</td>
                    <td className="py-2.5 px-4 font-medium text-neutral-900">{log.user_name}</td>
                    <td className="py-2.5 px-4 text-neutral-600">{log.nursery_name || 'المنصة العامة'}</td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-teal-800">{log.action}</td>
                    <td className="py-2.5 px-4 font-mono text-neutral-500">{log.entity_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Nurseries List (Default) */
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
            <h2 className="text-xs font-bold text-neutral-900">الحضانات المسجلة وحالة الاشتراكات</h2>
            <span className="text-[11px] text-neutral-500">{nurseries.length} حضانة مسجلة</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-neutral-50 text-neutral-600 border-b border-neutral-200">
                <tr>
                  <th className="py-3 px-4 font-bold">الحضانة والمدينة</th>
                  <th className="py-3 px-4 font-bold">المدير المسؤول</th>
                  <th className="py-3 px-4 font-bold">باقة الاشتراك</th>
                  <th className="py-3 px-4 font-bold">سعة الأطفال المستهلكة</th>
                  <th className="py-3 px-4 font-bold">حالة الاشتراك</th>
                  <th className="py-3 px-4 font-bold">نهاية الفترة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-neutral-700">
                {nurseries.map((n) => {
                  const used = n.active_children_count || 0;
                  const max = n.max_children || 15;
                  const ratio = Math.min(100, Math.round((used / max) * 100));

                  return (
                    <tr key={n.id} className="hover:bg-neutral-50/50">
                      <td className="py-3 px-4">
                        <div className="font-bold text-neutral-900">{n.name}</div>
                        <div className="text-[11px] text-neutral-500 flex items-center gap-1.5 mt-0.5">
                          <span>{n.city}</span>
                          {n.subdomain && (
                            <>
                              <span>·</span>
                              <span className="font-mono">{n.subdomain}.hadanaty.eg</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-neutral-900">{n.admin_name || 'غير محدد'}</div>
                        <div className="text-[11px] text-neutral-500 font-mono">{n.admin_email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-teal-800">{n.plan_name || 'الأساسية'}</div>
                        <div className="text-[11px] text-neutral-500 font-mono tabular-nums">
                          {n.monthly_price_piastres ? (n.monthly_price_piastres / 100).toLocaleString('en-US') : 0} ج.م / شهر
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono tabular-nums font-bold text-neutral-900">
                            {used} / {max}
                          </span>
                          <span className="text-[10px] text-neutral-500">({ratio}%)</span>
                        </div>
                        <div className="w-28 bg-neutral-100 h-1.5 rounded-full overflow-hidden mt-1">
                          <div
                            className={`h-full ${ratio >= 90 ? 'bg-rose-500' : 'bg-teal-600'}`}
                            style={{ width: `${ratio}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 font-semibold text-[11px] ${
                            n.subscription_status === 'active'
                              ? 'text-emerald-700'
                              : n.subscription_status === 'past_due'
                              ? 'text-amber-700'
                              : 'text-rose-700'
                          }`}
                        >
                          {n.subscription_status === 'active' ? (
                            <CheckCircle className="w-3.5 h-3.5" />
                          ) : (
                            <Clock className="w-3.5 h-3.5" />
                          )}
                          {n.subscription_status === 'active'
                            ? 'نشط وساري'
                            : n.subscription_status === 'past_due'
                            ? 'متأخر السداد'
                            : 'معلق'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-neutral-600">
                        {n.current_period_end || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Create Nursery */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 text-neutral-900 shadow-xl border border-neutral-200">
            <h3 className="font-bold text-base text-neutral-900 mb-4 pb-2 border-b border-neutral-100">
              تسجيل حضانة جديدة وتعيين المدير
            </h3>
            <form onSubmit={handleCreateNursery} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-neutral-700 mb-1">اسم الحضانة *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: حضانة براعم المستقبل"
                  value={newNursery.name}
                  onChange={(e) => setNewNursery({ ...newNursery, name: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-neutral-700 mb-1">النطاق الفرعي (Subdomain)</label>
                  <input
                    type="text"
                    placeholder="baraem"
                    value={newNursery.subdomain}
                    onChange={(e) => setNewNursery({ ...newNursery, subdomain: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-xl font-mono text-left"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block font-bold text-neutral-700 mb-1">المدينة</label>
                  <input
                    type="text"
                    value={newNursery.city}
                    onChange={(e) => setNewNursery({ ...newNursery, city: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">باقة الاشتراك وسعة الأطفال *</label>
                <select
                  value={newNursery.planId}
                  onChange={(e) => setNewNursery({ ...newNursery, planId: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-xl bg-white"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (حتى {p.max_children} طفل) — {(p.monthly_price_piastres / 100).toLocaleString('en-US')} ج.م
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 border-t border-neutral-100">
                <p className="font-bold text-neutral-800 mb-2">بيانات حساب مدير الحضانة:</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-neutral-600 mb-1">اسم المدير *</label>
                    <input
                      type="text"
                      required
                      placeholder="أ. سامح عبد الله"
                      value={newNursery.adminName}
                      onChange={(e) => setNewNursery({ ...newNursery, adminName: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-neutral-600 mb-1">البريد الإلكتروني *</label>
                    <input
                      type="email"
                      required
                      placeholder="sameh@baraem.eg"
                      value={newNursery.adminEmail}
                      onChange={(e) => setNewNursery({ ...newNursery, adminEmail: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-xl font-mono text-left"
                      dir="ltr"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-2 rounded-xl text-neutral-600 hover:bg-neutral-100 font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold"
                >
                  حفظ وإنشاء الحضانة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Record Subscription Payment */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-neutral-900 shadow-xl border border-neutral-200">
            <h3 className="font-bold text-base text-neutral-900 mb-4 pb-2 border-b border-neutral-100">
              تسجيل سداد اشتراك شهري للحضانة
            </h3>
            <form onSubmit={handleRecordSubscriptionPayment} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-neutral-700 mb-1">الحضانة المشتركة *</label>
                <select
                  required
                  value={paymentData.nurseryId}
                  onChange={(e) => setPaymentData({ ...paymentData, nurseryId: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-xl bg-white"
                >
                  <option value="">اختر الحضانة...</option>
                  {nurseries.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name} ({n.plan_name || 'باقة'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">المبلغ المسدد (بالجنيه المصري) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  value={paymentData.amountEgp}
                  onChange={(e) => setPaymentData({ ...paymentData, amountEgp: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-xl font-mono text-left"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">طريقة السداد *</label>
                <select
                  value={paymentData.paymentMethod}
                  onChange={(e) => setPaymentData({ ...paymentData, paymentMethod: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-xl bg-white"
                >
                  <option value="instapay">انستاباي (InstaPay)</option>
                  <option value="bank_transfer">تحويل بنكي</option>
                  <option value="vodafone_cash">فودافون كاش</option>
                  <option value="manual_cash">نقداً باليد</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">رقم الإيصال / المرجع البنكي *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: INSTA-99214"
                  value={paymentData.referenceNo}
                  onChange={(e) => setPaymentData({ ...paymentData, referenceNo: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-xl font-mono text-left"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">ملاحظات إضافية</label>
                <input
                  type="text"
                  placeholder="اشتراك شهر نوفمبر 2026"
                  value={paymentData.notes}
                  onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-3.5 py-2 rounded-xl text-neutral-600 hover:bg-neutral-100 font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold"
                >
                  تسجيل الدفعة وتمديد الصلاحية
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
