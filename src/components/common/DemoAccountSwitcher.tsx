import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../services/api';
import { Users, ChevronDown, Check, Building2 } from 'lucide-react';

interface DemoAccount {
  role: string;
  title: string;
  email: string;
  name: string;
  nursery: string;
  description: string;
}

export const DemoAccountSwitcher: React.FC = () => {
  const { user, demoLogin } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [accounts, setAccounts] = useState<DemoAccount[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch<{ accounts: DemoAccount[] }>('/api/auth/demo-accounts')
      .then((res) => setAccounts(res.accounts))
      .catch((err) => console.error('Failed to load demo accounts', err));
  }, []);

  const handleSelectAccount = async (email: string) => {
    setLoading(true);
    try {
      await demoLogin(email);
      setIsOpen(false);
    } catch (err: any) {
      alert(err.message || 'فشل التبديل للحساب التجريبي');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative inline-block text-right">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-50 text-teal-800 hover:bg-teal-100 transition-colors border border-teal-200 whitespace-nowrap shrink-0"
        title="تبديل سريع بين الحسابات التجريبية لاختبار المنصة"
      >
        <Users className="w-3.5 h-3.5 text-teal-600 shrink-0" />
        <span className="hidden sm:inline">تبديل الحساب التجريبي</span>
        <span className="inline sm:hidden">حساب تجريبي</span>
        <ChevronDown className="w-3 h-3 text-teal-600 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-80 sm:w-96 rounded-xl bg-white shadow-xl ring-1 ring-black/10 z-50 p-2 divide-y divide-neutral-100">
          <div className="px-3 py-2">
            <p className="text-xs font-bold text-neutral-800">الحسابات التجريبية المجهزة للتجربة</p>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              اختر أي حساب للانتقال الفوري إلى بيئته وصلاحياته:
            </p>
          </div>

          <div className="py-1 space-y-1 max-h-96 overflow-y-auto">
            {accounts.map((acc) => {
              const isCurrent = user?.email.toLowerCase() === acc.email.toLowerCase();
              return (
                <button
                  key={acc.email}
                  disabled={loading}
                  onClick={() => handleSelectAccount(acc.email)}
                  className={`w-full text-right px-3 py-2 rounded-lg text-xs transition-colors flex items-start gap-2.5 ${
                    isCurrent ? 'bg-teal-50/70 border border-teal-200' : 'hover:bg-neutral-50'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {isCurrent ? (
                      <Check className="w-4 h-4 text-teal-600 font-bold" />
                    ) : (
                      <Building2 className="w-4 h-4 text-neutral-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-neutral-900">{acc.title}</span>
                      <span className="text-[10px] text-neutral-500 font-mono">{acc.email.split('@')[0]}</span>
                    </div>
                    <p className="text-[11px] text-teal-700 font-medium truncate mt-0.5">{acc.nursery}</p>
                    <p className="text-[10px] text-neutral-500 mt-0.5 leading-relaxed">{acc.description}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="px-3 py-1.5 bg-neutral-50/50 rounded-b-lg">
            <p className="text-[10px] text-neutral-400 text-center">
              كلمة المرور لجميع الحسابات التجريبية: <span className="font-mono text-neutral-600">Password123!</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
