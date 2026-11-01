import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../services/api';
import { Users, UserCheck, CreditCard, Bell, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';

interface DashboardStats {
  activeChildrenCount: number;
  attendanceToday: {
    totalLogged: number;
    currentlyPresent: number;
    checkedOut: number;
  };
  outstandingBalancePiastres: number;
  classroomsCount: number;
  reportsCountToday: number;
  subscription?: {
    status: string;
    plan_name: string;
    max_children: number;
  };
  recentAnnouncements: Array<{
    id: string;
    title: string;
    content: string;
    created_at: string;
    author_name: string;
  }>;
}

export const NurseryAdminDashboard: React.FC<{ onNavigate: (tab: string) => void }> = ({ onNavigate }) => {
  const { user } = useAuth();
  const nurseryId = user?.activeMembership?.nurseryId;
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!nurseryId) return;
    setLoading(true);
    apiFetch<DashboardStats>(`/api/nurseries/${nurseryId}/dashboard`)
      .then((data) => setStats(data))
      .catch((err) => setError(err.message || 'فشل تحميل بيانات لوحة الإدارة'))
      .finally(() => setLoading(false));
  }, [nurseryId]);

  if (loading) {
    return <div className="p-8 text-center text-sm text-neutral-500">جاري تحميل إحصائيات الحضانة...</div>;
  }

  if (error || !stats) {
    return <div className="p-4 rounded-xl bg-rose-50 text-rose-700 text-xs">{error || 'تعذر تحميل البيانات'}</div>;
  }

  const childUsagePercent = stats.subscription
    ? Math.round((stats.activeChildrenCount / stats.subscription.max_children) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-neutral-900 tracking-tight">
            لوحة إدارة {user?.activeMembership?.nurseryName}
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            متابعة العمليات اليومية، الحضور، تقارير الفصول، والتحصيل المالي
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('admin_children')}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white transition-colors shadow-xs"
          >
            إضافة طفل جديد
          </button>
          <button
            onClick={() => onNavigate('admin_attendance')}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-800 transition-colors"
          >
            سجل الحضور اليوم
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Children */}
        <div
          onClick={() => onNavigate('admin_children')}
          className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs hover:border-teal-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-neutral-500 text-xs mb-1">
            <span>الأطفال النشطون</span>
            <Users className="w-4 h-4 text-teal-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-extrabold text-neutral-900 font-mono tabular-nums">
            {stats.activeChildrenCount}
            {stats.subscription && (
              <span className="text-xs text-neutral-400 font-normal mr-1.5">
                / {stats.subscription.max_children}
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-neutral-500">
            <span>سعة باقة الحضانة</span>
            <span className="font-mono">{childUsagePercent}%</span>
          </div>
        </div>

        {/* Attendance Today */}
        <div
          onClick={() => onNavigate('admin_attendance')}
          className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs hover:border-teal-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-neutral-500 text-xs mb-1">
            <span>الحضور اليوم</span>
            <UserCheck className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-extrabold text-neutral-900 font-mono tabular-nums">
            {stats.attendanceToday.currentlyPresent}
            <span className="text-xs text-neutral-400 font-normal mr-1.5">
              / {stats.activeChildrenCount}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-emerald-700 font-medium">
            {stats.attendanceToday.checkedOut > 0 ? `${stats.attendanceToday.checkedOut} أطفال انصرفوا` : 'بانتظار مواعيد الانصراف'}
          </div>
        </div>

        {/* Outstanding Parent Balances */}
        <div
          onClick={() => onNavigate('admin_billing')}
          className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs hover:border-teal-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-neutral-500 text-xs mb-1">
            <span>المصروفات المستحقة</span>
            <CreditCard className="w-4 h-4 text-amber-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-extrabold text-neutral-900 font-mono tabular-nums">
            {(stats.outstandingBalancePiastres / 100).toLocaleString('en-US')} <span className="text-xs font-normal">ج.م</span>
          </div>
          <div className="mt-1 text-[11px] text-amber-700 font-medium">
            متبقي تحصيله من أولياء الأمور
          </div>
        </div>

        {/* Daily Reports & Classrooms */}
        <div
          onClick={() => onNavigate('admin_classrooms')}
          className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs hover:border-teal-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-neutral-500 text-xs mb-1">
            <span>الفصول النشطة</span>
            <ShieldCheck className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-extrabold text-neutral-900 font-mono tabular-nums">
            {stats.classroomsCount}
          </div>
          <div className="mt-1 text-[11px] text-teal-700 font-medium">
            {stats.reportsCountToday} تقارير يومية نُشرت اليوم
          </div>
        </div>
      </div>

      {/* Subscription Limit Warning if near quota */}
      {stats.subscription && childUsagePercent >= 85 && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">تنبيه استهلاك سعة الأطفال: </span>
            وصلت الحضانة إلى {stats.activeChildrenCount} طفل من أصل {stats.subscription.max_children} متاحين في {stats.subscription.plan_name}. لزيادة السعة يرجى التواصل مع إدارة المنصة لترقية الباقة.
          </div>
        </div>
      )}

      {/* Two-column Section: Quick Actions & Recent Announcements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Workflow Actions */}
        <div className="bg-white rounded-xl border border-neutral-200 p-5 space-y-3">
          <h2 className="text-xs font-bold text-neutral-900 pb-2 border-b border-neutral-100">
            العمليات اليومية السريعة
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              onClick={() => onNavigate('admin_children')}
              className="p-3 rounded-xl border border-neutral-200 hover:border-teal-400 hover:bg-teal-50/20 text-right transition-colors"
            >
              <div className="font-bold text-xs text-neutral-900">إدارة وتسجيل الأطفال</div>
              <div className="text-[11px] text-neutral-500 mt-0.5">تسجيل بيانات جديدة، جهات الطوارئ والمفوضين</div>
            </button>
            <button
              onClick={() => onNavigate('admin_attendance')}
              className="p-3 rounded-xl border border-neutral-200 hover:border-teal-400 hover:bg-teal-50/20 text-right transition-colors"
            >
              <div className="font-bold text-xs text-neutral-900">حضور وانصراف اليوم</div>
              <div className="text-[11px] text-neutral-500 mt-0.5">مراجعة الأطفال الحاضرين والمستلمين بالهوية</div>
            </button>
            <button
              onClick={() => onNavigate('admin_billing')}
              className="p-3 rounded-xl border border-neutral-200 hover:border-teal-400 hover:bg-teal-50/20 text-right transition-colors"
            >
              <div className="font-bold text-xs text-neutral-900">إصدار الفواتير وتحصيل الرسوم</div>
              <div className="text-[11px] text-neutral-500 mt-0.5">طباعة الإيصالات، التحصيل النقدي والبنكي</div>
            </button>
            <button
              onClick={() => onNavigate('admin_announcements')}
              className="p-3 rounded-xl border border-neutral-200 hover:border-teal-400 hover:bg-teal-50/20 text-right transition-colors"
            >
              <div className="font-bold text-xs text-neutral-900">نشر إعلان للحضانة</div>
              <div className="text-[11px] text-neutral-500 mt-0.5">إرسال إشعار فوري لجميع أولياء الأمور والمعلمات</div>
            </button>
          </div>
        </div>

        {/* Recent Announcements */}
        <div className="bg-white rounded-xl border border-neutral-200 p-5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
            <h2 className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-teal-600" />
              <span>آخر إعلانات الحضانة</span>
            </h2>
            <button
              onClick={() => onNavigate('admin_announcements')}
              className="text-[11px] text-teal-700 font-semibold hover:underline flex items-center gap-1"
            >
              <span>عرض الكل</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2.5">
            {stats.recentAnnouncements.length === 0 ? (
              <div className="py-6 text-center text-xs text-neutral-400">لا توجد إعلانات منشورة بعد</div>
            ) : (
              stats.recentAnnouncements.map((ann) => (
                <div key={ann.id} className="p-3 rounded-xl bg-neutral-50/70 border border-neutral-100">
                  <div className="flex items-center justify-between text-xs font-bold text-neutral-900 mb-1">
                    <span>{ann.title}</span>
                    <span className="text-[10px] font-mono text-neutral-400">{ann.created_at.slice(0, 10)}</span>
                  </div>
                  <p className="text-[11px] text-neutral-600 line-clamp-2 leading-relaxed">{ann.content}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
