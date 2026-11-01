import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../../db/database';
import { generateToken, requireAuth, AuthenticatedRequest } from '../../middleware/auth';

export const authRouter = Router();

/**
 * Normal Login
 */
authRouter.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'البريد الإلكتروني وكلمة المرور مطلوبان' });
  }

  const user = db.prepare(`
    SELECT id, email, password_hash, full_name, phone, is_platform_owner
    FROM users
    WHERE LOWER(email) = LOWER(?)
  `).get(email) as {
    id: string;
    email: string;
    password_hash: string;
    full_name: string;
    phone: string;
    is_platform_owner: number;
  } | undefined;

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
  }

  // Get user memberships
  const memberships = db.prepare(`
    SELECT m.id, m.nursery_id, m.role, n.name as nursery_name
    FROM nursery_memberships m
    JOIN nurseries n ON n.id = m.nursery_id
    WHERE m.user_id = ? AND m.is_active = 1
  `).all(user.id) as Array<{
    id: string;
    nursery_id: string;
    role: 'admin' | 'teacher' | 'parent';
    nursery_name: string;
  }>;

  const firstMem = memberships[0];
  const token = generateToken({
    userId: user.id,
    activeNurseryId: firstMem?.nursery_id,
    activeRole: firstMem?.role,
  });

  res.cookie('hadanaty_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      phone: user.phone,
      isPlatformOwner: Boolean(user.is_platform_owner),
      activeMembership: firstMem
        ? {
            id: firstMem.id,
            nurseryId: firstMem.nursery_id,
            nurseryName: firstMem.nursery_name,
            role: firstMem.role,
          }
        : undefined,
      memberships: memberships.map((m) => ({
        id: m.id,
        nurseryId: m.nursery_id,
        nurseryName: m.nursery_name,
        role: m.role,
      })),
    },
  });
});

/**
 * Switch Active Nursery / Role
 */
authRouter.post('/switch-membership', requireAuth, (req: AuthenticatedRequest, res) => {
  const { nurseryId, role } = req.body;
  if (!req.user) return res.status(401).json({ error: 'غير مصرح' });

  // Verify the membership exists
  const membership = db.prepare(`
    SELECT m.id, m.nursery_id, m.role, n.name as nursery_name
    FROM nursery_memberships m
    JOIN nurseries n ON n.id = m.nursery_id
    WHERE m.user_id = ? AND m.nursery_id = ? AND m.role = ? AND m.is_active = 1
  `).get(req.user.id, nurseryId, role) as {
    id: string;
    nursery_id: string;
    role: 'admin' | 'teacher' | 'parent';
    nursery_name: string;
  } | undefined;

  if (!membership) {
    return res.status(403).json({ error: 'لا تمتلك صلاحية لهذا الدور في هذه الحضانة' });
  }

  const token = generateToken({
    userId: req.user.id,
    activeNurseryId: membership.nursery_id,
    activeRole: membership.role,
  });

  res.cookie('hadanaty_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({
    token,
    activeMembership: {
      id: membership.id,
      nurseryId: membership.nursery_id,
      nurseryName: membership.nursery_name,
      role: membership.role,
    },
  });
});

/**
 * Current User Session Info
 */
authRouter.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'غير مصرح' });

  const memberships = db.prepare(`
    SELECT m.id, m.nursery_id, m.role, n.name as nursery_name
    FROM nursery_memberships m
    JOIN nurseries n ON n.id = m.nursery_id
    WHERE m.user_id = ? AND m.is_active = 1
  `).all(req.user.id) as Array<{
    id: string;
    nursery_id: string;
    role: 'admin' | 'teacher' | 'parent';
    nursery_name: string;
  }>;

  res.json({
    user: {
      ...req.user,
      memberships: memberships.map((m) => ({
        id: m.id,
        nurseryId: m.nursery_id,
        nurseryName: m.nursery_name,
        role: m.role,
      })),
    },
  });
});

/**
 * Logout
 */
authRouter.post('/logout', (_req, res) => {
  res.clearCookie('hadanaty_token');
  res.json({ success: true });
});

/**
 * Demo Accounts list for development and testing
 */
authRouter.get('/demo-accounts', (_req, res) => {
  res.json({
    accounts: [
      {
        role: 'platform_owner',
        title: 'مدير المنصة (Platform Owner)',
        email: 'admin@hadanaty.eg',
        name: 'محمد جمال',
        nursery: 'لوحة إدارة المنصة والاشتراكات',
        description: 'إدارة الحضانات، باقات الاشتراك، تحصيل رسوم المنصة، وتحديد سعة الأطفال.',
      },
      {
        role: 'admin',
        title: 'مديرة الحضانة (Nursery Admin)',
        email: 'amal.admin@hadanaty.eg',
        name: 'د. منى سعيد',
        nursery: 'حضانة الأمل النموذجية',
        description: 'إدارة الفصول، الأطفال، رسوم أولياء الأمور، الإيصالات، والإعلانات.',
      },
      {
        role: 'teacher',
        title: 'معلمة فصل (Teacher)',
        email: 'amal.teacher@hadanaty.eg',
        name: 'أ. سارة أحمد',
        nursery: 'حضانة الأمل النموذجية - فصل الفراشات',
        description: 'تسجيل الحضور والانصراف، استلام الأطفال المصرح لهم، وكتابة التقارير اليومية.',
      },
      {
        role: 'parent',
        title: 'ولي أمر (Parent)',
        email: 'amal.parent@hadanaty.eg',
        name: 'م. أحمد خليل',
        nursery: 'حضانة الأمل النموذجية - ولي أمر يوسف',
        description: 'متابعة الخط الزمني للطفل، سجل الحضور، المصروفات والإيصالات، وإشعارات الغياب.',
      },
      {
        role: 'admin_tenant_2',
        title: 'مدير الحضانة الثانية (Tenant 2 Admin)',
        email: 'zohour.admin@hadanaty.eg',
        name: 'أ. طارق عبد الرحمن',
        nursery: 'حضانة الزهور الدولية (منشأة مستقلة)',
        description: 'اختبار العزل التام للمستأجرين وضمان عدم اختلاط البيانات مع حضانة الأمل.',
      },
    ],
  });
});

/**
 * Quick switch to demo account (Development only)
 */
authRouter.post('/demo-login', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'البريد الإلكتروني مطلوب' });

  const user = db.prepare(`
    SELECT id, email, full_name, phone, is_platform_owner
    FROM users
    WHERE LOWER(email) = LOWER(?)
  `).get(email) as {
    id: string;
    email: string;
    full_name: string;
    phone: string;
    is_platform_owner: number;
  } | undefined;

  if (!user) {
    return res.status(404).json({ error: 'الحساب التجريبي غير موجود' });
  }

  const memberships = db.prepare(`
    SELECT m.id, m.nursery_id, m.role, n.name as nursery_name
    FROM nursery_memberships m
    JOIN nurseries n ON n.id = m.nursery_id
    WHERE m.user_id = ? AND m.is_active = 1
  `).all(user.id) as Array<{
    id: string;
    nursery_id: string;
    role: 'admin' | 'teacher' | 'parent';
    nursery_name: string;
  }>;

  const firstMem = memberships[0];
  const token = generateToken({
    userId: user.id,
    activeNurseryId: firstMem?.nursery_id,
    activeRole: firstMem?.role,
  });

  res.cookie('hadanaty_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      phone: user.phone,
      isPlatformOwner: Boolean(user.is_platform_owner),
      activeMembership: firstMem
        ? {
            id: firstMem.id,
            nurseryId: firstMem.nursery_id,
            nurseryName: firstMem.nursery_name,
            role: firstMem.role,
          }
        : undefined,
      memberships: memberships.map((m) => ({
        id: m.id,
        nurseryId: m.nursery_id,
        nurseryName: m.nursery_name,
        role: m.role,
      })),
    },
  });
});
