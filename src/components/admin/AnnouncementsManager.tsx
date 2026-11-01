import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { Announcement, Classroom } from '../../types';
import { apiFetch } from '../../services/api';
import { Bell, Plus, Users, Send } from 'lucide-react';

export const AnnouncementsManager: React.FC = () => {
  const { user } = useAuth();
  const nurseryId = user?.activeMembership?.nurseryId;

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);

  // New Announcement Form
  const [showForm, setShowForm] = useState(false);
  const [newAnn, setNewAnn] = useState({ title: '', content: '', classroomId: '' });

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadData = async () => {
    if (!nurseryId) return;
    setLoading(true);
    try {
      const [annRes, classRes] = await Promise.all([
        apiFetch<{ announcements: Announcement[] }>(`/api/nurseries/${nurseryId}/announcements`),
        apiFetch<{ classrooms: Classroom[] }>(`/api/nurseries/${nurseryId}/classrooms`),
      ]);
      setAnnouncements(annRes.announcements);
      setClassrooms(classRes.classrooms);
    } catch (err: any) {
      setError(err.message || 'فشل تحميل الإعلانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [nurseryId]);

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/nurseries/${nurseryId}/announcements`, {
        method: 'POST',
        body: JSON.stringify(newAnn),
      });
      setMessage('تم نشر الإعلان وإرسال الإشعار بنجاح');
      setShowForm(false);
      setNewAnn({ title: '', content: '', classroomId: '' });
      loadData();
    } catch (err: any) {
      setError(err.message || 'فشل نشر الإعلان');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-neutral-900 tracking-tight">
            إعلانات الحضانة والتواصل الداخلي
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            نشر إعلانات عامة لجميع أولياء الأمور أو إعلانات خاصة بفصول محددة
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white transition-colors flex items-center gap-1.5 shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>نشر إعلان جديد</span>
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

      {/* New Announcement Box */}
      {showForm && (
        <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-xs">
          <h2 className="text-xs font-bold text-neutral-900 mb-3 pb-2 border-b border-neutral-100 flex items-center gap-2">
            <Send className="w-4 h-4 text-teal-600" />
            <span>صياغة إعلان فوري</span>
          </h2>
          <form onSubmit={handleCreateAnnouncement} className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-neutral-700 mb-1">عنوان الإعلان *</label>
              <input
                type="text"
                required
                placeholder="تنويه بشأن الإجازة الرسمية، يوم الأنشطة، التطعيمات..."
                value={newAnn.title}
                onChange={(e) => setNewAnn({ ...newAnn, title: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold text-neutral-700 mb-1">الجمهور المستهدف *</label>
              <select
                value={newAnn.classroomId}
                onChange={(e) => setNewAnn({ ...newAnn, classroomId: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-xl bg-white"
              >
                <option value="">إعلان عام لجميع الفصول وأولياء الأمور بالحضانة</option>
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    مخصص لفصل: {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-neutral-700 mb-1">نص وتفاصيل الإعلان *</label>
              <textarea
                required
                rows={3}
                placeholder="اكتب تفاصيل الإعلان هنا بوضوح..."
                value={newAnn.content}
                onChange={(e) => setNewAnn({ ...newAnn, content: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-xl"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-3.5 py-2 rounded-xl text-neutral-600 hover:bg-neutral-100 font-semibold"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold"
              >
                نشر الإعلان الآن
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Announcements Stream */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-8 text-center text-xs text-neutral-500">جاري تحميل الإعلانات...</div>
        ) : announcements.length === 0 ? (
          <div className="p-12 text-center text-xs text-neutral-400 bg-white rounded-xl border border-neutral-200">
            لا توجد إعلانات منشورة بعد
          </div>
        ) : (
          announcements.map((ann) => (
            <div key={ann.id} className="bg-white rounded-xl border border-neutral-200 p-4 shadow-xs text-right">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <h3 className="font-bold text-sm text-neutral-900">{ann.title}</h3>
                  <div className="flex items-center gap-2 text-[11px] text-neutral-500 mt-1">
                    <span>الكاتب: {ann.author_name}</span>
                    <span>·</span>
                    <span className="font-mono tabular-nums">{ann.created_at.slice(0, 16).replace('T', ' ')}</span>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold bg-neutral-100 text-neutral-700 shrink-0">
                  {ann.classroom_name ? `فصل ${ann.classroom_name}` : 'إعلان عام للحضانة'}
                </span>
              </div>
              <p className="text-xs text-neutral-700 leading-relaxed whitespace-pre-wrap">{ann.content}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
