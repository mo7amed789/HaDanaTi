import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/common/Navbar';
import { LoginView } from './components/auth/LoginView';
import { PlatformOwnerDashboard } from './components/platform/PlatformOwnerDashboard';
import { NurseryAdminDashboard } from './components/admin/NurseryAdminDashboard';
import { ChildrenManager } from './components/admin/ChildrenManager';
import { ClassroomsManager } from './components/admin/ClassroomsManager';
import { BillingManager } from './components/admin/BillingManager';
import { AnnouncementsManager } from './components/admin/AnnouncementsManager';
import { ParentRequestsManager } from './components/admin/ParentRequestsManager';
import { TeacherWorkspace } from './components/teacher/TeacherWorkspace';
import { ParentPortal } from './components/parent/ParentPortal';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('');

  // Synchronize default tab on role/membership change
  useEffect(() => {
    if (!user) return;
    if (user.isPlatformOwner && !user.activeMembership) {
      setCurrentTab('platform_nurseries');
    } else if (user.activeMembership?.role === 'admin') {
      setCurrentTab('admin_dashboard');
    } else if (user.activeMembership?.role === 'teacher') {
      setCurrentTab('teacher_attendance');
    } else if (user.activeMembership?.role === 'parent') {
      setCurrentTab('parent_timeline');
    }
  }, [user?.id, user?.activeMembership?.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-neutral-600">جاري تحميل نظام حضانتي...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  const isPlatformOwner = user.isPlatformOwner && !user.activeMembership;
  const role = user.activeMembership?.role;

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col font-sans" dir="rtl">
      {/* Top Navbar */}
      <Navbar currentTab={currentTab} onTabChange={setCurrentTab} />

      {/* Main Viewport Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isPlatformOwner ? (
          <PlatformOwnerDashboard activeSubTab={currentTab} />
        ) : role === 'admin' ? (
          <>
            {currentTab === 'admin_dashboard' && <NurseryAdminDashboard onNavigate={setCurrentTab} />}
            {currentTab === 'admin_children' && <ChildrenManager />}
            {currentTab === 'admin_classrooms' && <ClassroomsManager />}
            {currentTab === 'admin_attendance' && <TeacherWorkspace activeTab="teacher_attendance" />}
            {currentTab === 'admin_billing' && <BillingManager />}
            {currentTab === 'admin_announcements' && (
              <div className="space-y-6">
                <AnnouncementsManager />
                <ParentRequestsManager />
              </div>
            )}
          </>
        ) : role === 'teacher' ? (
          <TeacherWorkspace activeTab={currentTab} />
        ) : role === 'parent' ? (
          <ParentPortal activeTab={currentTab} />
        ) : (
          <div className="p-8 text-center text-xs text-neutral-500">
            يرجى اختيار عضوية الحضانة من شريط التنقل العلوي
          </div>
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-neutral-200 bg-white py-4 text-center text-[11px] text-neutral-500 no-print">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>نظام حضانتي (Hadanaty) · منصة إدارة الحضانات السحابية</span>
          <span className="font-mono tabular-nums text-neutral-400">التوقيت: بتوقيت القاهرة (Africa/Cairo) · العملة: ج.م</span>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
