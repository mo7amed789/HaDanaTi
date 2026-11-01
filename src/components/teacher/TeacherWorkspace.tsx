import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { AttendanceRecord, Classroom, AuthorizedPickup } from '../../types';
import { apiFetch } from '../../services/api';
import { UserCheck, Clock, FileText, Sparkles, Smile, Shield, Check, AlertCircle } from 'lucide-react';

export const TeacherWorkspace: React.FC<{ activeTab: string }> = ({ activeTab }) => {
  const { user } = useAuth();
  const nurseryId = user?.activeMembership?.nurseryId;

  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>('');
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Check-Out Modal
  const [selectedChildForCheckout, setSelectedChildForCheckout] = useState<AttendanceRecord | null>(null);
  const [pickups, setPickups] = useState<AuthorizedPickup[]>([]);
  const [selectedPickupName, setSelectedPickupName] = useState('');
  const [customPickupName, setCustomPickupName] = useState('');

  // Daily Report Composer Modal
  const [selectedChildForReport, setSelectedChildForReport] = useState<AttendanceRecord | null>(null);
  const [reportForm, setReportForm] = useState({
    mood: 'happy' as 'happy' | 'calm' | 'fussy' | 'tired',
    mealsSummary: 'تناول وجبة الإفطار كاملة، ووجبة الغداء بنسبة 85%',
    napMinutes: '60',
    activitiesSummary: 'نشاط تلوين مائي + مسابقة الحروف الإنجليزية + لعب حركي',
    individualNotes: '',
  });

  // Batch Shared Activity Modal
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchSelectedChildIds, setBatchSelectedChildIds] = useState<string[]>([]);
  const [batchActivityText, setBatchActivityText] = useState('نشاط جماعي: قراءة قصة الأرنب الذكي + استكشاف حديقة الحضانة');

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const today = new Date().toISOString().slice(0, 10);

  const loadData = async () => {
    if (!nurseryId) return;
    setLoading(true);
    try {
      const classRes = await apiFetch<{ classrooms: Classroom[] }>(`/api/nurseries/${nurseryId}/classrooms`);
      setClassrooms(classRes.classrooms);
      const initialRoomId = selectedClassroomId || classRes.classrooms[0]?.id || '';
      setSelectedClassroomId(initialRoomId);

      if (initialRoomId) {
        const attRes = await apiFetch<{ records: AttendanceRecord[] }>(
          `/api/nurseries/${nurseryId}/attendance?date=${today}&classroomId=${initialRoomId}`
        );
        setRecords(attRes.records);
      }
    } catch (err: any) {
      setError(err.message || 'فشل تحميل بيانات الفصل');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [nurseryId, selectedClassroomId]);

  const handleCheckIn = async (childId: string) => {
    setError('');
    setMessage('');
    try {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      await apiFetch(`/api/nurseries/${nurseryId}/attendance/check-in`, {
        method: 'POST',
        body: JSON.stringify({ childId, date: today, checkInTime: timeStr }),
      });
      setMessage('تم تسجيل حضور الطفل بنجاح');
      loadData();
    } catch (err: any) {
      setError(err.message || 'فشل تسجيل الحضور');
    }
  };

  const handleOpenCheckoutModal = async (child: AttendanceRecord) => {
    setSelectedChildForCheckout(child);
    setSelectedPickupName('');
    setCustomPickupName('');
    try {
      const res = await apiFetch<any>(`/api/nurseries/${nurseryId}/children/${child.child_id}`);
      setPickups(res.authorizedPickups || []);
      if (res.authorizedPickups && res.authorizedPickups.length > 0) {
        setSelectedPickupName(res.authorizedPickups[0].name);
      }
    } catch (err: any) {
      setError('فشل جلب قائمة المفوضين بالاستلام');
    }
  };

  const handleConfirmCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChildForCheckout) return;
    const finalPickup = selectedPickupName === 'other' ? customPickupName : selectedPickupName;
    if (!finalPickup) {
      setError('يرجى تحديد اسم الشخص المستلم');
      return;
    }

    try {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      await apiFetch(`/api/nurseries/${nurseryId}/attendance/check-out`, {
        method: 'POST',
        body: JSON.stringify({
          childId: selectedChildForCheckout.child_id,
          date: today,
          checkOutTime: timeStr,
          pickupPersonName: finalPickup,
        }),
      });
      setMessage(`تم تسجيل انصراف الطفل وتسليمه إلى: ${finalPickup}`);
      setSelectedChildForCheckout(null);
      loadData();
    } catch (err: any) {
      setError(err.message || 'فشل تسجيل الانصراف');
    }
  };

  const handlePublishReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChildForReport) return;
    try {
      await apiFetch(`/api/nurseries/${nurseryId}/reports`, {
        method: 'POST',
        body: JSON.stringify({
          childId: selectedChildForReport.child_id,
          date: today,
          ...reportForm,
        }),
      });
      setMessage('تم نشر التقرير اليومي بنجاح إلى ولي الأمر');
      setSelectedChildForReport(null);
      loadData();
    } catch (err: any) {
      setError(err.message || 'فشل نشر التقرير');
    }
  };

  const handleBatchSharedActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (batchSelectedChildIds.length === 0) {
      setError('يرجى تحديد طفل واحد على الأقل للنشاط الجماعي');
      return;
    }
    try {
      await apiFetch(`/api/nurseries/${nurseryId}/reports/batch-shared-activity`, {
        method: 'POST',
        body: JSON.stringify({
          classroomId: selectedClassroomId,
          childIds: batchSelectedChildIds,
          date: today,
          sharedActivity: batchActivityText,
        }),
      });
      setMessage(`تم حفظ النشاط الجماعي لـ ${batchSelectedChildIds.length} طفل بنجاح`);
      setShowBatchModal(false);
      setBatchSelectedChildIds([]);
      loadData();
    } catch (err: any) {
      setError(err.message || 'فشل تسجيل النشاط الجماعي');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Classroom Picker */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-neutral-900 tracking-tight">
            مساحة عمل المعلمة (Teacher Workspace)
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            تسجيل حضور وانصراف الفصل بالاستلام المعتمد ونشر التقارير اليومية لأولياء الأمور
          </p>
        </div>

        {/* Classroom selector */}
        {classrooms.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-neutral-700 whitespace-nowrap">الفصل الحالي:</span>
            <select
              value={selectedClassroomId}
              onChange={(e) => setSelectedClassroomId(e.target.value)}
              className="px-3 py-2 border border-neutral-300 rounded-xl bg-white text-xs font-semibold focus:border-teal-500 outline-hidden"
            >
              {classrooms.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.enrolled_children_count} أطفال)
                </option>
              ))}
            </select>
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

      {/* Classroom Quick Stats Strip */}
      <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-neutral-500 block text-[11px]">أطفال الفصل:</span>
            <span className="font-bold font-mono text-base text-neutral-900">{records.length}</span>
          </div>
          <div className="h-8 w-px bg-neutral-200" />
          <div>
            <span className="text-neutral-500 block text-[11px]">حاضرون الآن:</span>
            <span className="font-bold font-mono text-base text-emerald-700">
              {records.filter((r) => r.check_in_time && !r.check_out_time).length}
            </span>
          </div>
          <div className="h-8 w-px bg-neutral-200" />
          <div>
            <span className="text-neutral-500 block text-[11px]">تم الانصراف:</span>
            <span className="font-bold font-mono text-base text-neutral-600">
              {records.filter((r) => r.check_out_time).length}
            </span>
          </div>
        </div>

        <button
          onClick={() => {
            setBatchSelectedChildIds(records.map((r) => r.child_id));
            setShowBatchModal(true);
          }}
          className="px-3 py-2 rounded-xl text-xs font-bold bg-teal-50 text-teal-900 hover:bg-teal-100 border border-teal-200 flex items-center gap-1.5 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 text-teal-600" />
          <span>تسجيل نشاط جماعي للفصل ككل</span>
        </button>
      </div>

      {/* Children Attendance & Report Cards (Mobile & Desktop optimized) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="p-8 text-center text-xs text-neutral-500 col-span-2">جاري التحميل...</div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center text-xs text-neutral-400 bg-white rounded-xl border border-neutral-200 col-span-2">
            لا يوجد أطفال مقيدون في هذا الفصل
          </div>
        ) : (
          records.map((child) => {
            const isCheckedIn = Boolean(child.check_in_time);
            const isCheckedOut = Boolean(child.check_out_time);

            return (
              <div
                key={child.child_id}
                className="bg-white rounded-xl border border-neutral-200 p-4 shadow-xs flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-sm text-neutral-900">
                        {child.first_name} {child.last_name}
                      </h3>
                      <div className="text-[11px] text-neutral-500 mt-0.5">
                        فصل: {child.classroom_name}
                      </div>
                    </div>

                    {/* Status Pill */}
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                        isCheckedOut
                          ? 'bg-neutral-100 text-neutral-700'
                          : isCheckedIn
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-neutral-50 text-neutral-500 border border-neutral-200'
                      }`}
                    >
                      {isCheckedOut ? 'انصرف بالسلامة' : isCheckedIn ? 'حاضر الآن بالفصل' : 'لم يحضر بعد'}
                    </span>
                  </div>

                  {/* Attendance Logged Details */}
                  <div className="mt-3 bg-neutral-50 p-2.5 rounded-lg text-xs space-y-1 font-mono">
                    <div className="flex justify-between text-neutral-600">
                      <span>وقت الحضور:</span>
                      <span className="font-bold tabular-nums text-neutral-900">{child.check_in_time || '—'}</span>
                    </div>
                    {isCheckedOut && (
                      <>
                        <div className="flex justify-between text-neutral-600">
                          <span>وقت الانصراف:</span>
                          <span className="font-bold tabular-nums text-neutral-900">{child.check_out_time}</span>
                        </div>
                        <div className="flex justify-between text-neutral-600">
                          <span>المستلم:</span>
                          <span className="font-bold text-teal-800 font-sans">{child.pickup_person_name}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Workflow Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-neutral-100">
                  {!isCheckedIn ? (
                    <button
                      onClick={() => handleCheckIn(child.child_id)}
                      className="flex-1 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition-colors"
                    >
                      تسجيل الحضور
                    </button>
                  ) : !isCheckedOut ? (
                    <button
                      onClick={() => handleOpenCheckoutModal(child)}
                      className="flex-1 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors"
                    >
                      تسجيل الانصراف والاستلام
                    </button>
                  ) : null}

                  <button
                    onClick={() => {
                      setSelectedChildForReport(child);
                      setReportForm({
                        mood: 'happy',
                        mealsSummary: 'تناول وجبة الإفطار كاملة، ووجبة الغداء بنسبة 85%',
                        napMinutes: '60',
                        activitiesSummary: 'نشاط تلوين مائي + مسابقة الحروف الإنجليزية + لعب حركي',
                        individualNotes: '',
                      });
                    }}
                    className="px-3 py-2 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-semibold text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>التقرير اليومي</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Check-Out with Authorized Pickup Verification */}
      {selectedChildForCheckout && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-neutral-900 shadow-xl border border-neutral-200">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-amber-600" />
              <h3 className="font-bold text-base text-neutral-900">
                تسجيل انصراف: {selectedChildForCheckout.first_name} {selectedChildForCheckout.last_name}
              </h3>
            </div>
            <p className="text-xs text-neutral-500 mb-4 pb-2 border-b border-neutral-100">
              يرجى التحقق من هوية الشخص المفوض رسمياً باستلام الطفل ومطابقة البيانات
            </p>

            <form onSubmit={handleConfirmCheckout} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-neutral-700 mb-1">
                  اختر المفوض بالاستلام المعتمد *
                </label>
                <div className="space-y-2">
                  {pickups.map((p) => (
                    <label
                      key={p.id}
                      className={`block p-2.5 rounded-xl border cursor-pointer transition-colors ${
                        selectedPickupName === p.name ? 'border-teal-500 bg-teal-50/50' : 'border-neutral-200 hover:bg-neutral-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="pickupSelection"
                          value={p.name}
                          checked={selectedPickupName === p.name}
                          onChange={(e) => setSelectedPickupName(e.target.value)}
                          className="text-teal-600"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="font-bold text-neutral-900">{p.name}</span>
                          <span className="text-[11px] text-neutral-500 mr-2">({p.relationship})</span>
                          <div className="text-[10px] text-neutral-400 font-mono mt-0.5">
                            هاتف: {p.phone} {p.national_id && `· بطاقة: ${p.national_id}`}
                          </div>
                        </div>
                      </div>
                    </label>
                  ))}

                  <label
                    className={`block p-2.5 rounded-xl border cursor-pointer transition-colors ${
                      selectedPickupName === 'other' ? 'border-teal-500 bg-teal-50/50' : 'border-neutral-200 hover:bg-neutral-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="pickupSelection"
                        value="other"
                        checked={selectedPickupName === 'other'}
                        onChange={(e) => setSelectedPickupName(e.target.value)}
                        className="text-teal-600"
                      />
                      <span className="font-medium text-neutral-800">شخص آخر بتفويض خاص مؤقت</span>
                    </div>
                  </label>
                </div>
              </div>

              {selectedPickupName === 'other' && (
                <div>
                  <label className="block font-bold text-neutral-700 mb-1">اسم الشخص المستلم وصلة القرابة *</label>
                  <input
                    type="text"
                    required
                    placeholder="اسم المستلم الثلاثي وصفته"
                    value={customPickupName}
                    onChange={(e) => setCustomPickupName(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-xl"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setSelectedChildForCheckout(null)}
                  className="px-3.5 py-2 rounded-xl text-neutral-600 hover:bg-neutral-100 font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold"
                >
                  تأكيد تسليم وانصراف الطفل
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Daily Report Editor */}
      {selectedChildForReport && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 text-neutral-900 shadow-xl border border-neutral-200">
            <h3 className="font-bold text-base text-neutral-900 mb-1">
              إعداد التقرير اليومي: {selectedChildForReport.first_name} {selectedChildForReport.last_name}
            </h3>
            <p className="text-xs text-neutral-500 mb-4 pb-2 border-b border-neutral-100">
              يظهر هذا التقرير في الخط الزمني لحساب ولي الأمر فور نشره
            </p>

            <form onSubmit={handlePublishReport} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-neutral-700 mb-1">الحالة المزاجية للطفل اليوم *</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'happy', label: 'مبتهج ومرح', emoji: '😊' },
                    { id: 'calm', label: 'هادئ ومتجاوب', emoji: '😌' },
                    { id: 'fussy', label: 'منزعج وبكاء', emoji: '🥺' },
                    { id: 'tired', label: 'مرهق ونعسان', emoji: '🥱' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setReportForm({ ...reportForm, mood: m.id as any })}
                      className={`p-2 rounded-xl border text-center transition-colors ${
                        reportForm.mood === m.id ? 'border-teal-500 bg-teal-50/70 font-bold text-teal-900' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                      }`}
                    >
                      <div className="text-base">{m.emoji}</div>
                      <div className="text-[10px] mt-0.5">{m.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">التغذية والوجبات *</label>
                <textarea
                  rows={2}
                  required
                  value={reportForm.mealsSummary}
                  onChange={(e) => setReportForm({ ...reportForm, mealsSummary: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">فترة القيلولة / النوم (بالدقائق)</label>
                <input
                  type="number"
                  min="0"
                  step="15"
                  value={reportForm.napMinutes}
                  onChange={(e) => setReportForm({ ...reportForm, napMinutes: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-xl font-mono text-left"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">الأنشطة والمهارات التفاعلية *</label>
                <textarea
                  rows={2}
                  required
                  value={reportForm.activitiesSummary}
                  onChange={(e) => setReportForm({ ...reportForm, activitiesSummary: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">
                  ملاحظة فردية خاصة لولي الأمر (سرية وفردية)
                </label>
                <textarea
                  rows={2}
                  placeholder="ملاحظة خاصة بسلوك الطفل، احتياج ملابس إضافية، أدوية..."
                  value={reportForm.individualNotes}
                  onChange={(e) => setReportForm({ ...reportForm, individualNotes: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setSelectedChildForReport(null)}
                  className="px-3.5 py-2 rounded-xl text-neutral-600 hover:bg-neutral-100 font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold"
                >
                  نشر التقرير لولي الأمر
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Batch Shared Activity */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-neutral-900 shadow-xl border border-neutral-200">
            <h3 className="font-bold text-base text-neutral-900 mb-1">
              تسجيل نشاط جماعي للفصل
            </h3>
            <p className="text-xs text-neutral-500 mb-4 pb-2 border-b border-neutral-100">
              يتم إدراج نص النشاط في التقارير اليومية للأطفال المحددين مع الحفاظ على سرية الملاحظات الفردية
            </p>

            <form onSubmit={handleBatchSharedActivity} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-neutral-700 mb-1">نص النشاط الجماعي *</label>
                <textarea
                  rows={3}
                  required
                  value={batchActivityText}
                  onChange={(e) => setBatchActivityText(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">الأطفال المشمولون بالنشاط:</label>
                <div className="max-h-40 overflow-y-auto p-2 bg-neutral-50 rounded-xl border border-neutral-200 space-y-1">
                  {records.map((r) => (
                    <label key={r.child_id} className="flex items-center gap-2 p-1 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={batchSelectedChildIds.includes(r.child_id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setBatchSelectedChildIds([...batchSelectedChildIds, r.child_id]);
                          } else {
                            setBatchSelectedChildIds(batchSelectedChildIds.filter((id) => id !== r.child_id));
                          }
                        }}
                        className="text-teal-600 rounded-sm"
                      />
                      <span>{r.first_name} {r.last_name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  className="px-3.5 py-2 rounded-xl text-neutral-600 hover:bg-neutral-100 font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold"
                >
                  تطبيق النشاط ({batchSelectedChildIds.length} طفل)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
