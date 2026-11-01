import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DemoAccountSwitcher } from './DemoAccountSwitcher';
import { LogOut, Menu, X, Baby, Building2, User } from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onTabChange }) => {
  const { user, logout, switchMembership } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [membershipDropdownOpen, setMembershipDropdownOpen] = useState(false);

  if (!user) return null;

  const isPlatformOwner = user.isPlatformOwner && !user.activeMembership;
  const role = user.activeMembership?.role;

  // Build role-specific navigation tabs
  const getNavLinks = () => {
    if (isPlatformOwner) {
      return [
        { id: 'platform_nurseries', label: 'الحضانات والاشتراكات' },
        { id: 'platform_plans', label: 'باقات الأسعار' },
        { id: 'platform_audit', label: 'سجل العمليات' },
      ];
    }

    if (role === 'admin') {
      return [
        { id: 'admin_dashboard', label: 'نظرة عامة' },
        { id: 'admin_children', label: 'سجل الأطفال' },
        { id: 'admin_classrooms', label: 'الفصول والمعلمات' },
        { id: 'admin_attendance', label: 'الحضور اليومي' },
        { id: 'admin_billing', label: 'المصروفات والتحصيل' },
        { id: 'admin_announcements', label: 'الإعلانات والطلبات' },
      ];
    }

    if (role === 'teacher') {
      return [
        { id: 'teacher_attendance', label: 'تسجيل الحضور والانصراف' },
        { id: 'teacher_reports', label: 'التقارير اليومية' },
        { id: 'teacher_announcements', label: 'إعلانات الفصل' },
      ];
    }

    if (role === 'parent') {
      return [
        { id: 'parent_timeline', label: 'يوميات الطفل' },
        { id: 'parent_billing', label: 'المصروفات والإيصالات' },
        { id: 'parent_requests', label: 'إبلاغ غياب وطوارئ' },
        { id: 'parent_announcements', label: 'إعلانات الحضانة' },
      ];
    }

    return [];
  };

  const navLinks = getNavLinks();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-neutral-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2 sm:gap-6">
          {/* Zone 1: Brand Wordmark */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={() => onTabChange(navLinks[0]?.id || '')}
              className="flex items-center gap-2 text-right focus:outline-hidden"
            >
              <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white shadow-xs shrink-0">
                <Baby className="w-5 h-5" />
              </div>
              <div className="flex flex-col text-right">
                <span className="text-base sm:text-lg font-extrabold tracking-tight text-neutral-900 leading-none">
                  حضانتي
                </span>
                <span className="text-[10px] text-teal-700 font-medium tracking-wide truncate max-w-[110px] sm:max-w-xs">
                  {user.activeMembership?.nurseryName || (isPlatformOwner ? 'إدارة المنصة' : '')}
                </span>
              </div>
            </button>
          </div>

          {/* Zone 2: Navigation Links (Desktop) */}
          <nav className="hidden lg:flex items-center gap-1 xl:gap-2 text-xs font-semibold">
            {navLinks.map((link) => {
              const active = currentTab === link.id;
              return (
                <button
                  key={link.id}
                  onClick={() => onTabChange(link.id)}
                  className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-teal-50 text-teal-900 font-bold'
                      : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/70'
                  }`}
                >
                  {link.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Actions, Demo Switcher, Memberships & Logout */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Quick Demo Switcher */}
            <DemoAccountSwitcher />

            {/* Multiple Memberships Switcher if user belongs to more than 1 role/nursery */}
            {user.memberships && user.memberships.length > 1 && (
              <div className="relative">
                <button
                  onClick={() => setMembershipDropdownOpen(!membershipDropdownOpen)}
                  className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                  title="التبديل بين عضويات الحضانة"
                >
                  <Building2 className="w-3.5 h-3.5 text-neutral-500" />
                  <span className="max-w-[120px] truncate">{user.activeMembership?.nurseryName}</span>
                </button>
                {membershipDropdownOpen && (
                  <div className="absolute left-0 mt-2 w-64 rounded-xl bg-white shadow-lg border border-neutral-200 p-2 z-50">
                    <p className="text-[11px] font-bold text-neutral-500 px-2 py-1">عضوياتك المسجلة:</p>
                    {user.memberships.map((m) => (
                      <button
                        key={`${m.nurseryId}-${m.role}`}
                        onClick={async () => {
                          await switchMembership(m.nurseryId, m.role);
                          setMembershipDropdownOpen(false);
                        }}
                        className={`w-full text-right px-2.5 py-1.5 rounded-lg text-xs flex flex-col ${
                          m.id === user.activeMembership?.id ? 'bg-teal-50 text-teal-900 font-bold' : 'hover:bg-neutral-50'
                        }`}
                      >
                        <span className="text-neutral-900">{m.nurseryName}</span>
                        <span className="text-[10px] text-neutral-500">
                          {m.role === 'admin' ? 'مدير الحضانة' : m.role === 'teacher' ? 'معلم' : 'ولي أمر'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* User Profile Pill */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-neutral-700 bg-neutral-100/70 px-2.5 py-1.5 rounded-lg">
              <User className="w-3.5 h-3.5 text-neutral-500" />
              <span className="font-medium max-w-[100px] truncate">{user.fullName}</span>
            </div>

            {/* Logout Button */}
            <button
              onClick={logout}
              className="p-2 rounded-lg text-neutral-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              title="تسجيل الخروج"
            >
              <LogOut className="w-4 h-4" />
            </button>

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-neutral-600 hover:bg-neutral-100"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-neutral-200 bg-white px-4 pt-2 pb-4 space-y-1">
          <div className="py-1 text-xs text-neutral-500 font-medium">
            مرحباً، {user.fullName} ({user.activeMembership?.role === 'admin' ? 'مدير الحضانة' : user.activeMembership?.role === 'teacher' ? 'معلم' : user.activeMembership?.role === 'parent' ? 'ولي أمر' : 'مدير المنصة'})
          </div>
          {navLinks.map((link) => {
            const active = currentTab === link.id;
            return (
              <button
                key={link.id}
                onClick={() => {
                  onTabChange(link.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-right px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  active ? 'bg-teal-50 text-teal-900 font-bold' : 'text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                {link.label}
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
};
