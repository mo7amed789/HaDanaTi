import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { Child, Classroom, AuthorizedPickup } from '../../types';
import { apiFetch } from '../../services/api';
import { Users, Plus, Search, Shield, UserPlus, Phone, HeartPulse, Check, X, Eye } from 'lucide-react';

export const ChildrenManager: React.FC = () => {
  const { user } = useAuth();
  const nurseryId = user?.activeMembership?.nurseryId;

  const [children, setChildren] = useState<Child[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassroomId, setSelectedClassroomId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Add Child Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newChild, setNewChild] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '2022-05-10',
    gender: 'male',
    classroomId: '',
    enrollmentDate: new Date().toISOString().slice(0, 10),
    allergies: '',
    medicalNotes: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
  });

  // Selected Child Profile Modal State
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [childDetails, setChildDetails] = useState<{
    authorizedPickups: AuthorizedPickup[];
    linkedParents: Array<{ link_id: string; relationship: string; full_name: string; email: string; phone?: string }>;
  } | null>(null);

  // Add Pickup State
  const [showAddPickup, setShowAddPickup] = useState(false);
  const [pickupData, setPickupData] = useState({ name: '', relationship: 'مفوض استلام', phone: '', nationalId: '', isPrimary: false });

  // Link Parent State
  const [showLinkParent, setShowLinkParent] = useState(false);
  const [parentData, setParentData] = useState({ parentEmail: '', parentName: '', parentPhone: '', relationship: 'father' });

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadData = async () => {
    if (!nurseryId) return;
    setLoading(true);
    try {
      const [childRes, classRes] = await Promise.all([
        apiFetch<{ children: Child[] }>(`/api/nurseries/${nurseryId}/children?status=active`),
        apiFetch<{ classrooms: Classroom[] }>(`/api/nurseries/${nurseryId}/classrooms`),
      ]);
      setChildren(childRes.children);
      setClassrooms(classRes.classrooms);
    } catch (err: any) {
      setError(err.message || 'فشل تحميل بيانات الأطفال');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [nurseryId]);

  const handleCreateChild = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/nurseries/${nurseryId}/children`, {
        method: 'POST',
        body: JSON.stringify(newChild),
      });
      setMessage('تم تسجيل الطفل بنجاح');
      setShowAddModal(false);
      setNewChild({
        firstName: '',
        lastName: '',
        dateOfBirth: '2022-05-10',
        gender: 'male',
        classroomId: '',
        enrollmentDate: new Date().toISOString().slice(0, 10),
        allergies: '',
        medicalNotes: '',
        emergencyContactName: '',
        emergencyContactPhone: '',
      });
      loadData();
    } catch (err: any) {
      setError(err.message || 'فشل تسجيل الطفل');
    }
  };

  const handleOpenChildProfile = async (child: Child) => {
    setSelectedChild(child);
    setChildDetails(null);
    try {
      const res = await apiFetch<any>(`/api/nurseries/${nurseryId}/children/${child.id}`);
      setChildDetails(res);
    } catch (err: any) {
      setError(err.message || 'فشل تحميل تفاصيل الطفل');
    }
  };

  const handleAddPickup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChild) return;
    try {
      await apiFetch(`/api/nurseries/${nurseryId}/children/${selectedChild.id}/pickups`, {
        method: 'POST',
        body: JSON.stringify(pickupData),
      });
      setShowAddPickup(false);
      setPickupData({ name: '', relationship: 'مفوض استلام', phone: '', nationalId: '', isPrimary: false });
      handleOpenChildProfile(selectedChild);
    } catch (err: any) {
      setError(err.message || 'فشل إضافة المفوض بالاستلام');
    }
  };

  const handleLinkParent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChild) return;
    try {
      await apiFetch(`/api/nurseries/${nurseryId}/children/${selectedChild.id}/parents`, {
        method: 'POST',
        body: JSON.stringify(parentData),
      });
      setShowLinkParent(false);
      setParentData({ parentEmail: '', parentName: '', parentPhone: '', relationship: 'father' });
      handleOpenChildProfile(selectedChild);
      loadData();
    } catch (err: any) {
      setError(err.message || 'فشل ربط ولي الأمر');
    }
  };

  const filteredChildren = children.filter((c) => {
    const matchClass = !selectedClassroomId || c.classroom_id === selectedClassroomId;
    const fullName = `${c.first_name} ${c.last_name}`.toLowerCase();
    const matchSearch = !searchTerm || fullName.includes(searchTerm.toLowerCase());
    return matchClass && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-neutral-900 tracking-tight">
            سجل الأطفال والملفات الشخصية
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            إدارة بيانات الأطفال، الفصول، السجلات الطبية، والمفوضين بالاستلام
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white transition-colors flex items-center gap-1.5 shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>تسجيل طفل جديد</span>
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

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            placeholder="البحث باسم الطفل..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 pr-9 border border-neutral-300 rounded-xl outline-hidden focus:border-teal-500"
          />
          <Search className="w-4 h-4 text-neutral-400 absolute right-3 top-2.5 pointer-events-none" />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-neutral-500 whitespace-nowrap">تصفية حسب الفصل:</span>
          <select
            value={selectedClassroomId}
            onChange={(e) => setSelectedClassroomId(e.target.value)}
            className="px-3 py-2 border border-neutral-300 rounded-xl bg-white outline-hidden focus:border-teal-500"
          >
            <option value="">جميع الفصول</option>
            {classrooms.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Children Table */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
          <h2 className="text-xs font-bold text-neutral-900">قائمة الأطفال المقيدين</h2>
          <span className="text-[11px] text-neutral-500">{filteredChildren.length} طفل</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-neutral-500">جاري تحميل السجلات...</div>
        ) : filteredChildren.length === 0 ? (
          <div className="p-8 text-center text-xs text-neutral-400">لا يوجد أطفال يطابقون خيارات البحث</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-neutral-50 text-neutral-600 border-b border-neutral-200">
                <tr>
                  <th className="py-3 px-4 font-bold">اسم الطفل</th>
                  <th className="py-3 px-4 font-bold">الفصل</th>
                  <th className="py-3 px-4 font-bold">تاريخ الميلاد</th>
                  <th className="py-3 px-4 font-bold">ولي الأمر المرتبط</th>
                  <th className="py-3 px-4 font-bold">طوارئ / حساسيات</th>
                  <th className="py-3 px-4 font-bold text-left">الملف الشخصي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-neutral-700">
                {filteredChildren.map((c) => (
                  <tr key={c.id} className="hover:bg-neutral-50/50">
                    <td className="py-3 px-4">
                      <div className="font-bold text-neutral-900">
                        {c.first_name} {c.last_name}
                      </div>
                      <div className="text-[10px] text-neutral-500 mt-0.5">
                        {c.gender === 'male' ? 'ولد' : 'بنت'} · قيد {c.enrollment_date}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-neutral-800">{c.classroom_name || 'غير مسند لفصل'}</span>
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-neutral-600">
                      {c.date_of_birth}
                    </td>
                    <td className="py-3 px-4 text-neutral-700">
                      {c.parents_names || <span className="text-amber-600 text-[11px]">غير مربوط بحساب</span>}
                    </td>
                    <td className="py-3 px-4">
                      {c.allergies ? (
                        <div className="text-[11px] text-rose-700 font-medium truncate max-w-xs" title={c.allergies}>
                          حساسية: {c.allergies}
                        </div>
                      ) : (
                        <div className="text-[11px] text-neutral-400">لا توجد حساسية</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-left">
                      <button
                        onClick={() => handleOpenChildProfile(c)}
                        className="px-2.5 py-1.5 rounded-lg bg-teal-50 text-teal-800 hover:bg-teal-100 font-bold transition-colors inline-flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>عرض الملف</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Add New Child */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 text-neutral-900 shadow-xl border border-neutral-200">
            <h3 className="font-bold text-base text-neutral-900 mb-4 pb-2 border-b border-neutral-100">
              تسجيل وقيد طفل جديد بالحضانة
            </h3>
            <form onSubmit={handleCreateChild} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-neutral-700 mb-1">الاسم الأول *</label>
                  <input
                    type="text"
                    required
                    placeholder="يوسف"
                    value={newChild.firstName}
                    onChange={(e) => setNewChild({ ...newChild, firstName: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-neutral-700 mb-1">اسم العائلة *</label>
                  <input
                    type="text"
                    required
                    placeholder="خليل"
                    value={newChild.lastName}
                    onChange={(e) => setNewChild({ ...newChild, lastName: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-neutral-700 mb-1">تاريخ الميلاد *</label>
                  <input
                    type="date"
                    required
                    value={newChild.dateOfBirth}
                    onChange={(e) => setNewChild({ ...newChild, dateOfBirth: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-xl font-mono text-left"
                  />
                </div>
                <div>
                  <label className="block font-bold text-neutral-700 mb-1">النوع *</label>
                  <select
                    value={newChild.gender}
                    onChange={(e) => setNewChild({ ...newChild, gender: e.target.value as any })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-xl bg-white"
                  >
                    <option value="male">ولد</option>
                    <option value="female">بنت</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">الفصل المخصص</label>
                <select
                  value={newChild.classroomId}
                  onChange={(e) => setNewChild({ ...newChild, classroomId: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-xl bg-white"
                >
                  <option value="">بدون تعيين حالياً</option>
                  {classrooms.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (السعة: {c.enrolled_children_count}/{c.capacity})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">الحساسيات الغذائية أو الدوائية</label>
                <input
                  type="text"
                  placeholder="حساسية فول سوداني، فراولة، ألبان..."
                  value={newChild.allergies}
                  onChange={(e) => setNewChild({ ...newChild, allergies: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">ملاحظات طبية خاصة</label>
                <textarea
                  rows={2}
                  placeholder="تعليمات خاصة، أدوية، مواعيد نوم..."
                  value={newChild.medicalNotes}
                  onChange={(e) => setNewChild({ ...newChild, medicalNotes: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-neutral-100">
                <div>
                  <label className="block font-medium text-neutral-600 mb-1">اسم جهة الطوارئ</label>
                  <input
                    type="text"
                    placeholder="الأب أو الأم"
                    value={newChild.emergencyContactName}
                    onChange={(e) => setNewChild({ ...newChild, emergencyContactName: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-medium text-neutral-600 mb-1">هاتف الطوارئ</label>
                  <input
                    type="tel"
                    placeholder="01012345678"
                    value={newChild.emergencyContactPhone}
                    onChange={(e) => setNewChild({ ...newChild, emergencyContactPhone: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-xl font-mono text-left"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 rounded-xl text-neutral-600 hover:bg-neutral-100 font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold"
                >
                  حفظ وتسجيل الطفل
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Full Child Profile View with Pickups and Linked Parents */}
      {selectedChild && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 text-neutral-900 shadow-xl border border-neutral-200">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-teal-600" />
                <h3 className="font-bold text-base text-neutral-900">
                  ملف الطفل: {selectedChild.first_name} {selectedChild.last_name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedChild(null)}
                className="p-1 rounded-lg hover:bg-neutral-100 text-neutral-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-5 text-xs">
              {/* Medical and Basic Details */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-neutral-50 border border-neutral-100">
                <div>
                  <span className="text-neutral-500 block text-[11px]">الفصل المقيد به:</span>
                  <span className="font-bold text-neutral-900">{selectedChild.classroom_name || 'غير محدد'}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[11px]">تاريخ الميلاد:</span>
                  <span className="font-mono tabular-nums text-neutral-900">{selectedChild.date_of_birth}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[11px]">تاريخ القيد:</span>
                  <span className="font-mono tabular-nums text-neutral-900">{selectedChild.enrollment_date}</span>
                </div>
                <div className="col-span-2 sm:col-span-3">
                  <span className="text-neutral-500 block text-[11px]">الحساسيات والاحتياطات الطبية:</span>
                  <span className="font-semibold text-rose-700">
                    {selectedChild.allergies || 'لا توجد حساسية معروفة'}
                  </span>
                  {selectedChild.medical_notes && (
                    <p className="text-neutral-600 mt-1 font-normal leading-relaxed">{selectedChild.medical_notes}</p>
                  )}
                </div>
              </div>

              {/* Authorized Pickups Section */}
              <div className="border border-neutral-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5 font-bold text-neutral-900">
                    <Shield className="w-4 h-4 text-teal-600" />
                    <span>المفوضون باستلام الطفل (Pickups)</span>
                  </div>
                  <button
                    onClick={() => setShowAddPickup(true)}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-teal-50 text-teal-800 hover:bg-teal-100"
                  >
                    + إضافة مفوض
                  </button>
                </div>

                {childDetails?.authorizedPickups && childDetails.authorizedPickups.length > 0 ? (
                  <div className="space-y-2">
                    {childDetails.authorizedPickups.map((p) => (
                      <div key={p.id} className="p-2.5 rounded-lg bg-neutral-50 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-neutral-900">
                            {p.name} <span className="text-[11px] text-neutral-500">({p.relationship})</span>
                            {p.is_primary === 1 && (
                              <span className="mr-2 text-[10px] text-teal-700 font-semibold bg-teal-100/60 px-1.5 py-0.5 rounded-md">
                                جهة أساسية
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-neutral-500 font-mono mt-0.5">
                            هاتف: {p.phone} {p.national_id && `· بطاقة رقم قومي: ${p.national_id}`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-neutral-400 text-[11px]">لم يتم تسجيل مفوضين بالاستلام بعد</p>
                )}

                {/* Subform: Add Pickup */}
                {showAddPickup && (
                  <form onSubmit={handleAddPickup} className="mt-3 p-3 bg-neutral-100/60 rounded-xl space-y-2 border border-neutral-200">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        required
                        placeholder="اسم المفوض *"
                        value={pickupData.name}
                        onChange={(e) => setPickupData({ ...pickupData, name: e.target.value })}
                        className="px-2.5 py-1.5 border border-neutral-300 rounded-lg text-xs"
                      />
                      <input
                        type="text"
                        required
                        placeholder="صلة القرابة (خال، جدة، جار...)"
                        value={pickupData.relationship}
                        onChange={(e) => setPickupData({ ...pickupData, relationship: e.target.value })}
                        className="px-2.5 py-1.5 border border-neutral-300 rounded-lg text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="tel"
                        required
                        placeholder="رقم الهاتف *"
                        value={pickupData.phone}
                        onChange={(e) => setPickupData({ ...pickupData, phone: e.target.value })}
                        className="px-2.5 py-1.5 border border-neutral-300 rounded-lg text-xs font-mono text-left"
                        dir="ltr"
                      />
                      <input
                        type="text"
                        placeholder="الرقم القومي (اختياري)"
                        value={pickupData.nationalId}
                        onChange={(e) => setPickupData({ ...pickupData, nationalId: e.target.value })}
                        className="px-2.5 py-1.5 border border-neutral-300 rounded-lg text-xs font-mono text-left"
                        dir="ltr"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddPickup(false)}
                        className="px-2.5 py-1 rounded-lg text-neutral-600 text-[11px]"
                      >
                        إلغاء
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1 rounded-lg bg-teal-600 text-white font-bold text-[11px]"
                      >
                        حفظ المفوض
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Linked Parents Section */}
              <div className="border border-neutral-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5 font-bold text-neutral-900">
                    <UserPlus className="w-4 h-4 text-teal-600" />
                    <span>حسابات أولياء الأمور المرتبطة بالطفل</span>
                  </div>
                  <button
                    onClick={() => setShowLinkParent(true)}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-teal-50 text-teal-800 hover:bg-teal-100"
                  >
                    + ربط ولي أمر
                  </button>
                </div>

                {childDetails?.linkedParents && childDetails.linkedParents.length > 0 ? (
                  <div className="space-y-2">
                    {childDetails.linkedParents.map((p) => (
                      <div key={p.link_id} className="p-2.5 rounded-lg bg-neutral-50 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-neutral-900">
                            {p.full_name} <span className="text-[11px] text-neutral-500">({p.relationship === 'father' ? 'الأب' : p.relationship === 'mother' ? 'الأم' : 'ولي أمر'})</span>
                          </div>
                          <div className="text-[11px] text-neutral-500 font-mono mt-0.5">
                            {p.email} {p.phone && `· ${p.phone}`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-neutral-400 text-[11px]">لم يتم ربط ولي أمر بعد (يمكن إضافة بريد للدخول عبر البوابة)</p>
                )}

                {/* Subform: Link Parent */}
                {showLinkParent && (
                  <form onSubmit={handleLinkParent} className="mt-3 p-3 bg-neutral-100/60 rounded-xl space-y-2 border border-neutral-200">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="email"
                        required
                        placeholder="البريد الإلكتروني لولي الأمر *"
                        value={parentData.parentEmail}
                        onChange={(e) => setParentData({ ...parentData, parentEmail: e.target.value })}
                        className="px-2.5 py-1.5 border border-neutral-300 rounded-lg text-xs font-mono text-left"
                        dir="ltr"
                      />
                      <input
                        type="text"
                        placeholder="الاسم الكامل (إن كان حساباً جديداً)"
                        value={parentData.parentName}
                        onChange={(e) => setParentData({ ...parentData, parentName: e.target.value })}
                        className="px-2.5 py-1.5 border border-neutral-300 rounded-lg text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="tel"
                        placeholder="رقم الهاتف"
                        value={parentData.parentPhone}
                        onChange={(e) => setParentData({ ...parentData, parentPhone: e.target.value })}
                        className="px-2.5 py-1.5 border border-neutral-300 rounded-lg text-xs font-mono text-left"
                        dir="ltr"
                      />
                      <select
                        value={parentData.relationship}
                        onChange={(e) => setParentData({ ...parentData, relationship: e.target.value })}
                        className="px-2.5 py-1.5 border border-neutral-300 rounded-lg text-xs bg-white"
                      >
                        <option value="father">الأب</option>
                        <option value="mother">الأم</option>
                        <option value="guardian">ولي الأمر / وصي</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowLinkParent(false)}
                        className="px-2.5 py-1 rounded-lg text-neutral-600 text-[11px]"
                      >
                        إلغاء
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1 rounded-lg bg-teal-600 text-white font-bold text-[11px]"
                      >
                        تأكيد الربط
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
