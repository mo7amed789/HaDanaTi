import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Baby, Shield, KeyRound, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login, demoLogin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'فشل تسجيل الدخول، يرجى التأكد من البيانات');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoClick = async (demoEmail: string) => {
    setError('');
    setLoading(true);
    try {
      await demoLogin(demoEmail);
    } catch (err: any) {
      setError(err.message || 'فشل الدخول بالحساب التجريبي');
    } finally {
      setLoading(false);
    }
  };

  const demoPresets = [
    {
      role: 'مدير المنصة (Platform Owner)',
      email: 'admin@hadanaty.eg',
      name: 'محمد جمال',
      subtitle: 'إدارة الحضانات، الباقات، الاشتراكات وسعة الأطفال',
      tagColor: 'text-purple-700 bg-purple-50 border-purple-200',
    },
    {
      role: 'مديرة الحضانة (Nursery Admin)',
      email: 'amal.admin@hadanaty.eg',
      name: 'د. منى سعيد · حضانة الأمل',
      subtitle: 'الفصول، الأطفال، المصروفات، الإيصالات، والإعلانات',
      tagColor: 'text-teal-700 bg-teal-50 border-teal-200',
    },
    {
      role: 'معلمة الفصل (Teacher)',
      email: 'amal.teacher@hadanaty.eg',
      name: 'أ. سارة أحمد · فصل الفراشات',
      subtitle: 'حضور وانصراف، استلام بالهوية، التقارير والأنشطة',
      tagColor: 'text-amber-700 bg-amber-50 border-amber-200',
    },
    {
      role: 'ولي الأمر (Parent)',
      email: 'amal.parent@hadanaty.eg',
      name: 'م. أحمد خليل · والد الطفل يوسف',
      subtitle: 'متابعة اليوميات، كشف المصروفات، وإشعارات الغياب',
      tagColor: 'text-blue-700 bg-blue-50 border-blue-200',
    },
    {
      role: 'مدير الحضانة المستقلة (Tenant 2 Admin)',
      email: 'zohour.admin@hadanaty.eg',
      name: 'أ. طارق عبد الرحمن · حضانة الزهور',
      subtitle: 'إثبات العزل التام للمستأجرين بين الحضانات',
      tagColor: 'text-neutral-700 bg-neutral-100 border-neutral-300',
    },
  ];

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-600 text-white shadow-md mb-4">
          <Baby className="w-8 h-8" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight">
          حضانتي
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          نظام إدارة الحضانات السحابي متعدد المنشآت
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl">
        {/* Instant Demo Switcher Card */}
        <div className="bg-white py-6 px-4 shadow-sm sm:rounded-2xl sm:px-8 border border-neutral-200 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-teal-600" />
            <h2 className="text-xs font-bold text-neutral-900 tracking-wide">
              تسجيل دخول تجريبي فوري بنقرة واحدة (One-Click Demo Access)
            </h2>
          </div>
          <p className="text-xs text-neutral-500 mb-4 leading-relaxed">
            اختر أي دور من الأدوار التالية للدخول واستكشاف المنصة وصلاحياتها مباشرة:
          </p>

          <div className="grid grid-cols-1 gap-2.5">
            {demoPresets.map((preset) => (
              <button
                key={preset.email}
                type="button"
                disabled={loading}
                onClick={() => handleDemoClick(preset.email)}
                className="w-full text-right p-3 rounded-xl border border-neutral-200 hover:border-teal-400 hover:bg-teal-50/30 transition-all flex items-center justify-between group"
              >
                <div className="min-w-0 pr-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-neutral-900 group-hover:text-teal-800 transition-colors">
                      {preset.role}
                    </span>
                    <span className="text-[11px] text-neutral-500 font-medium">({preset.name})</span>
                  </div>
                  <p className="text-[11px] text-neutral-500 mt-0.5 truncate">{preset.subtitle}</p>
                </div>
                <div className="w-7 h-7 rounded-lg bg-neutral-100 group-hover:bg-teal-600 group-hover:text-white flex items-center justify-center text-neutral-500 transition-colors shrink-0">
                  <ArrowLeft className="w-4 h-4" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Regular Login Form */}
        <div className="bg-white py-6 px-4 shadow-sm sm:rounded-2xl sm:px-8 border border-neutral-200">
          <h2 className="text-xs font-bold text-neutral-700 mb-4 pb-2 border-b border-neutral-100">
            أو تسجيل الدخول بالبريد الإلكتروني وكلمة المرور
          </h2>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                البريد الإلكتروني
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@hadanaty.eg"
                  className="w-full px-3 py-2 pr-9 border border-neutral-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-hidden"
                  dir="ltr"
                />
                <Mail className="w-4 h-4 text-neutral-400 absolute right-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 pr-9 border border-neutral-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-hidden"
                  dir="ltr"
                />
                <KeyRound className="w-4 h-4 text-neutral-400 absolute right-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
            >
              {loading ? 'جاري التحقق...' : 'تسجيل الدخول'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
