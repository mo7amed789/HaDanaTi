import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { AbsenceNotice, ContactChangeRequest } from '../../types';
import { apiFetch } from '../../services/api';
import { Clock, CheckCircle, XCircle, AlertCircle, Phone, Calendar } from 'lucide-react';

export const ParentRequestsManager: React.FC = () => {
  const { user } = useAuth();
  const nurseryId = user?.activeMembership?.nurseryId;

  const [activeTab, setActiveTab] = useState<'absence' | 'contacts'>('absence');
  const [notices, setNotices] = useState<AbsenceNotice[]>([]);
  const [contactRequests, setContactRequests] = useState<ContactChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadData = async () => {
    if (!nurseryId) return;
    setLoading(true);
    try {
      const [noticesRes, ccrRes] = await Promise.all([
        apiFetch<{ notices: AbsenceNotice[] }>(`/api/nurseries/${nurseryId}/absence-notices`),
        apiFetch<{ requests: ContactChangeRequest[] }>(`/api/nurseries/${nurseryId}/contact-change-requests`),
      ]);
      setNotices(noticesRes.notices);
      setContactRequests(ccrRes.requests);
    } catch (err: any) {
      setError(err.message || 'فشل تحميل طلبات أولياء الأمور');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [nurseryId]);

  const handleAcknowledgeNotice = async (id: string) => {
    try {
      await apiFetch(`/api/nurseries/${nurseryId}/absence-notices/${id}/acknowledge`, { method: 'PATCH' });
      setMessage('تم تأكيد استلام إشعار الغياب');
      loadData();
    } catch (err: any) {
      setError(err.message || 'فشل تحديث حالة الإشعار');
    }
  };

  const handleReviewContactRequest = async (id: string, action: 'approve' | 'reject') => {
    try {
      await apiFetch(`/api/nurseries/${nurseryId}/contact-change-requests/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      setMessage(action === 'approve' ? 'تم اعتماد التحديث وتعديل بيانات الطوارئ للطفل' : 'تم رفض الطلب');
      loadData();
    } catch (err: any) {
      setError(err.message || 'فشل مراجعة الطلب');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-extrabold text-neutral-900 tracking-tight">
          طلبات وإشعارات أولياء الأمور
        </h1>
        <p className="text-xs text-neutral-500 mt-0.5">
          متابعة إشعارات الغياب ومراجعة طلبات تعديل أرقام وبيانات الطوارئ
        </p>
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

      {/* Tabs */}
      <div className="flex items-center gap-2 p-1 bg-white border border-neutral-200 rounded-xl text-xs w-fit">
        <button
          onClick={() => setActiveTab('absence')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
            activeTab === 'absence' ? 'bg-teal-50 text-teal-900' : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          إشعارات الغياب ({notices.filter((n) => n.status === 'submitted').length} جديدة)
        </button>
        <button
          onClick={() => setActiveTab('contacts')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
            activeTab === 'contacts' ? 'bg-teal-50 text-teal-900' : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          تعديل بيانات الطوارئ ({contactRequests.filter((r) => r.status === 'pending').length} بانتظار المراجعة)
        </button>
      </div>

      {/* Absence Notices */}
      {activeTab === 'absence' ? (
        <div className="space-y-3">
          {loading ? (
            <div className="p-8 text-center text-xs text-neutral-500">جاري التحميل...</div>
          ) : notices.length === 0 ? (
            <div className="p-12 text-center text-xs text-neutral-400 bg-white rounded-xl border border-neutral-200">
              لا توجد إشعارات غياب مسجلة
            </div>
          ) : (
            notices.map((n) => (
              <div key={n.id} className="bg-white rounded-xl border border-neutral-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-right">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-neutral-900">
                      الطفل: {n.first_name} {n.last_name}
                    </span>
                    <span className="text-[11px] text-neutral-500 font-medium">({n.classroom_name || 'الفصل'})</span>
                  </div>
                  <div className="text-xs text-neutral-600 mt-1 flex items-center gap-2 font-mono tabular-nums">
                    <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                    <span>فترة الغياب: من {n.start_date} إلى {n.end_date}</span>
                  </div>
                  <p className="text-xs text-neutral-700 mt-1 font-medium">السبب: {n.reason}</p>
                  <div className="text-[10px] text-neutral-400 mt-1">
                    مقدم بواسطة: {n.parent_name} {n.parent_phone && `(${n.parent_phone})`} · {n.created_at.slice(0, 10)}
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  {n.status === 'submitted' ? (
                    <button
                      onClick={() => handleAcknowledgeNotice(n.id)}
                      className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs"
                    >
                      تأكيد الاطلاع
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>تم الاطلاع</span>
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Contact Change Requests */
        <div className="space-y-3">
          {loading ? (
            <div className="p-8 text-center text-xs text-neutral-500">جاري التحميل...</div>
          ) : contactRequests.length === 0 ? (
            <div className="p-12 text-center text-xs text-neutral-400 bg-white rounded-xl border border-neutral-200">
              لا توجد طلبات تعديل جهات طوارئ معلقة
            </div>
          ) : (
            contactRequests.map((req) => {
              let parsed: any = {};
              try {
                parsed = JSON.parse(req.requested_data_json);
              } catch {}

              return (
                <div key={req.id} className="bg-white rounded-xl border border-neutral-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-right">
                  <div>
                    <div className="font-bold text-sm text-neutral-900">
                      طلب تحديث طوارئ للطفل: {req.first_name} {req.last_name}
                    </div>
                    <div className="text-xs text-neutral-700 mt-1 bg-amber-50/60 p-2.5 rounded-lg border border-amber-100">
                      <div>اسم جهة الطوارئ الجديد: <span className="font-bold text-neutral-900">{parsed.emergencyContactName}</span></div>
                      <div>رقم الهاتف الجديد: <span className="font-bold font-mono text-neutral-900">{parsed.emergencyContactPhone}</span></div>
                      {parsed.notes && <div className="text-neutral-500 text-[11px] mt-0.5">ملاحظة: {parsed.notes}</div>}
                    </div>
                    <div className="text-[10px] text-neutral-400 mt-1">
                      طلب مقدم من: {req.parent_name} · {req.created_at.slice(0, 10)}
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {req.status === 'pending' ? (
                      <>
                        <button
                          onClick={() => handleReviewContactRequest(req.id, 'approve')}
                          className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs"
                        >
                          قبول وتحديث السجل
                        </button>
                        <button
                          onClick={() => handleReviewContactRequest(req.id, 'reject')}
                          className="px-2.5 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold text-xs"
                        >
                          رفض
                        </button>
                      </>
                    ) : (
                      <span className={`text-xs font-bold ${req.status === 'approved' ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {req.status === 'approved' ? 'تم الاعتماد' : 'تم الرفض'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
