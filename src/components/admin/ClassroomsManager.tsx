import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { Classroom } from '../../types';
import { apiFetch } from '../../services/api';
import { Plus, Users, UserCheck, Shield } from 'lucide-react';

interface StaffMember {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
}

export const ClassroomsManager: React.FC = () => {
  const { user } = useAuth();
  const nurseryId = user?.activeMembership?.nurseryId;

  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [teachers, setTeachers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Classroom Modal
  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [newRoom, setNewRoom] = useState({ name: '', capacity: '15', minAgeMonths: '12', maxAgeMonths: '48' });

  // Assign Teacher Modal
  const [selectedRoom, setSelectedRoom] = useState<Classroom | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadData = async () => {
    if (!nurseryId) return;
    setLoading(true);
    try {
      const [roomRes, nurseryRes] = await Promise.all([
        apiFetch<{ classrooms: Classroom[] }>(`/api/nurseries/${nurseryId}/classrooms`),
        apiFetch<{ staff: StaffMember[] }>(`/api/nurseries/${nurseryId}/details`),
      ]);
      setClassrooms(roomRes.classrooms);
      setTeachers(nurseryRes.staff.filter((s) => s.role === 'teacher'));
    } catch (err: any) {
      setError(err.message || 'فشل تحميل بيانات الفصول');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [nurseryId]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/nurseries/${nurseryId}/classrooms`, {
        method: 'POST',
        body: JSON.stringify(newRoom),
      });
      setMessage('تم إنشاء الفصل بنجاح');
      setShowAddClassModal(false);
      setNewRoom({ name: '', capacity: '15', minAgeMonths: '12', maxAgeMonths: '48' });
      loadData();
    } catch (err: any) {
      setError(err.message || 'فشل إنشاء الفصل');
    }
  };

  const handleAssignTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom || !selectedTeacherId) return;
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/nurseries/${nurseryId}/classrooms/${selectedRoom.id}/teachers`, {
        method: 'POST',
        body: JSON.stringify({ teacherUserId: selectedTeacherId }),
      });
      setMessage('تم تعيين المعلم للفصل بنجاح');
      setSelectedRoom(null);
      setSelectedTeacherId('');
      loadData();
    } catch (err: any) {
      setError(err.message || 'فشل تعيين المعلم');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-neutral-900 tracking-tight">
            الفصول الدراسية والكادر التعليمي
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            إدارة الفصول، مراقبة السعة الاستيعابية، وتعيين المعلمات
          </p>
        </div>
        <button
          onClick={() => setShowAddClassModal(true)}
          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white transition-colors flex items-center gap-1.5 shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة فصل جديد</span>
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

      {/* Classrooms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {classrooms.map((room) => {
          const ratio = Math.round((room.enrolled_children_count / room.capacity) * 100);
          return (
            <div key={room.id} className="bg-white rounded-xl border border-neutral-200 p-5 flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-sm text-neutral-900">{room.name}</h3>
                  <span className="text-[11px] font-mono text-neutral-500">
                    {room.min_age_months}-{room.max_age_months} شهر
                  </span>
                </div>

                {/* Capacity Progress */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-neutral-600 mb-1">
                    <span>الأطفال المقيدون:</span>
                    <span className="font-mono tabular-nums font-bold text-neutral-900">
                      {room.enrolled_children_count} / {room.capacity}
                    </span>
                  </div>
                  <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${ratio >= 100 ? 'bg-rose-500' : ratio >= 80 ? 'bg-amber-500' : 'bg-teal-600'}`}
                      style={{ width: `${Math.min(100, ratio)}%` }}
                    />
                  </div>
                </div>

                {/* Assigned Teachers */}
                <div className="mt-4 pt-3 border-t border-neutral-100 text-xs">
                  <span className="text-neutral-500 block text-[11px] mb-1">المعلمات المسؤولات:</span>
                  <div className="text-neutral-800 font-medium">
                    {room.assigned_teachers || <span className="text-amber-600 text-[11px]">لا توجد معلمة مسندة</span>}
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-neutral-100 flex items-center justify-end">
                <button
                  onClick={() => setSelectedRoom(room)}
                  className="px-3 py-1.5 rounded-lg bg-teal-50 text-teal-800 hover:bg-teal-100 text-xs font-bold transition-colors"
                >
                  + إسناد معلمة
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Create Classroom */}
      {showAddClassModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-neutral-900 shadow-xl border border-neutral-200">
            <h3 className="font-bold text-base text-neutral-900 mb-4 pb-2 border-b border-neutral-100">
              إضافة فصل دراسي جديد
            </h3>
            <form onSubmit={handleCreateRoom} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-neutral-700 mb-1">اسم الفصل *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: فصل العصافير (الرضع)"
                  value={newRoom.name}
                  onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">السعة الاستيعابية (الحد الأقصى للأطفال) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  max="40"
                  value={newRoom.capacity}
                  onChange={(e) => setNewRoom({ ...newRoom, capacity: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-xl font-mono text-left"
                  dir="ltr"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-neutral-600 mb-1">السن الأدنى (بالأشهر)</label>
                  <input
                    type="number"
                    min="1"
                    value={newRoom.minAgeMonths}
                    onChange={(e) => setNewRoom({ ...newRoom, minAgeMonths: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-xl font-mono text-left"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block font-medium text-neutral-600 mb-1">السن الأقصى (بالأشهر)</label>
                  <input
                    type="number"
                    min="1"
                    value={newRoom.maxAgeMonths}
                    onChange={(e) => setNewRoom({ ...newRoom, maxAgeMonths: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-xl font-mono text-left"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setShowAddClassModal(false)}
                  className="px-3.5 py-2 rounded-xl text-neutral-600 hover:bg-neutral-100 font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold"
                >
                  حفظ الفصل
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Assign Teacher */}
      {selectedRoom && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-neutral-900 shadow-xl border border-neutral-200">
            <h3 className="font-bold text-base text-neutral-900 mb-4 pb-2 border-b border-neutral-100">
              تعيين معلمة لفصل: {selectedRoom.name}
            </h3>
            <form onSubmit={handleAssignTeacher} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-neutral-700 mb-1">اختر المعلمة *</label>
                <select
                  required
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-xl bg-white"
                >
                  <option value="">اختر من كادر المعلمات المعتمد...</option>
                  {teachers.map((t) => (
                    <option key={t.user_id} value={t.user_id}>
                      {t.full_name} ({t.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setSelectedRoom(null)}
                  className="px-3.5 py-2 rounded-xl text-neutral-600 hover:bg-neutral-100 font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold"
                >
                  تأكيد التعيين
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
