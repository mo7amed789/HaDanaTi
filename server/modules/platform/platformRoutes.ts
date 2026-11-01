import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../../db/database';
import { requireAuth, requirePlatformOwner, AuthenticatedRequest, logAudit } from '../../middleware/auth';

export const platformRouter = Router();

// All routes in platformRouter require Platform Owner role
platformRouter.use(requireAuth, requirePlatformOwner);

/**
 * Overview statistics for Platform Owner
 */
platformRouter.get('/stats', (_req, res) => {
  const nurseriesCount = db.prepare('SELECT COUNT(*) as count FROM nurseries').get() as { count: number };
  const activeSubsCount = db.prepare("SELECT COUNT(*) as count FROM nursery_subscriptions WHERE status = 'active'").get() as { count: number };
  const totalRevenuePiastres = db.prepare('SELECT COALESCE(SUM(amount_piastres), 0) as total FROM subscription_payments').get() as { total: number };
  const totalChildrenCount = db.prepare("SELECT COUNT(*) as count FROM children WHERE status = 'active'").get() as { count: number };

  res.json({
    totalNurseries: nurseriesCount.count,
    activeSubscriptions: activeSubsCount.count,
    totalRevenuePiastres: totalRevenuePiastres.total,
    totalChildrenAcrossAllNurseries: totalChildrenCount.count,
  });
});

/**
 * List all nurseries with subscription status, plan name, and active child counts
 */
platformRouter.get('/nurseries', (_req, res) => {
  const nurseries = db.prepare(`
    SELECT
      n.id,
      n.name,
      n.subdomain,
      n.phone,
      n.address,
      n.city,
      n.status as nursery_status,
      n.created_at,
      s.status as subscription_status,
      s.start_date,
      s.current_period_end,
      p.id as plan_id,
      p.name as plan_name,
      p.max_children,
      p.monthly_price_piastres,
      (SELECT COUNT(*) FROM children c WHERE c.nursery_id = n.id AND c.status = 'active') as active_children_count,
      (SELECT u.full_name FROM nursery_memberships m JOIN users u ON u.id = m.user_id WHERE m.nursery_id = n.id AND m.role = 'admin' LIMIT 1) as admin_name,
      (SELECT u.email FROM nursery_memberships m JOIN users u ON u.id = m.user_id WHERE m.nursery_id = n.id AND m.role = 'admin' LIMIT 1) as admin_email
    FROM nurseries n
    LEFT JOIN nursery_subscriptions s ON s.nursery_id = n.id
    LEFT JOIN saas_plans p ON p.id = s.plan_id
    ORDER BY n.created_at DESC
  `).all();

  res.json({ nurseries });
});

/**
 * Create a new Nursery with plan and initial administrator account
 */
platformRouter.post('/nurseries', (req: AuthenticatedRequest, res) => {
  const { name, subdomain, phone, address, city, planId, adminName, adminEmail, adminPhone, adminPassword } = req.body;

  if (!name || !planId || !adminEmail || !adminName) {
    return res.status(400).json({ error: 'اسم الحضانة، الباقة، واسم وبريد المدير مطلوبان' });
  }

  const existingSubdomain = subdomain ? db.prepare('SELECT id FROM nurseries WHERE subdomain = ?').get(subdomain) : null;
  if (existingSubdomain) {
    return res.status(400).json({ error: 'اسم النطاق الفرعي مستخدم بالفعل' });
  }

  const nurseryId = `nursery-${Date.now()}`;
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // 1. Insert Nursery
  db.prepare(`
    INSERT INTO nurseries (id, name, subdomain, phone, address, city, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
  `).run(nurseryId, name, subdomain || null, phone || null, address || null, city || 'القاهرة', now);

  // 2. Link Subscription
  db.prepare(`
    INSERT INTO nursery_subscriptions (id, nursery_id, plan_id, status, start_date, current_period_end, created_at)
    VALUES (?, ?, ?, 'active', ?, ?, ?)
  `).run(`sub-${Date.now()}`, nurseryId, planId, today, nextMonth, now);

  // 3. Create or find Admin User
  let adminUser = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(adminEmail) as { id: string } | undefined;
  if (!adminUser) {
    const userId = `user-${Date.now()}`;
    const salt = bcrypt.genSaltSync(10);
    const passHash = bcrypt.hashSync(adminPassword || 'Password123!', salt);

    db.prepare(`
      INSERT INTO users (id, email, password_hash, full_name, phone, is_platform_owner, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `).run(userId, adminEmail, passHash, adminName, adminPhone || null, now);
    adminUser = { id: userId };
  }

  // 4. Assign admin membership
  db.prepare(`
    INSERT INTO nursery_memberships (id, user_id, nursery_id, role, is_active, created_at)
    VALUES (?, ?, ?, 'admin', 1, ?)
  `).run(`mem-${Date.now()}`, adminUser.id, nurseryId, now);

  logAudit(req.user!.id, 'CREATE_NURSERY', 'nursery', nurseryId, nurseryId, { name, planId, adminEmail });

  res.status(201).json({
    success: true,
    nurseryId,
    message: 'تم إنشاء الحضانة وتعيين المدير بنجاح',
  });
});

/**
 * Update nursery details or subscription status (active, past_due, suspended)
 */
platformRouter.patch('/nurseries/:id', (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { name, phone, address, city, subscriptionStatus, planId } = req.body;

  const nursery = db.prepare('SELECT id FROM nurseries WHERE id = ?').get(id);
  if (!nursery) return res.status(404).json({ error: 'الحضانة غير موجودة' });

  if (name || phone || address || city) {
    db.prepare(`
      UPDATE nurseries
      SET name = COALESCE(?, name),
          phone = COALESCE(?, phone),
          address = COALESCE(?, address),
          city = COALESCE(?, city)
      WHERE id = ?
    `).run(name || null, phone || null, address || null, city || null, id);
  }

  if (subscriptionStatus || planId) {
    db.prepare(`
      UPDATE nursery_subscriptions
      SET status = COALESCE(?, status),
          plan_id = COALESCE(?, plan_id)
      WHERE nursery_id = ?
    `).run(subscriptionStatus || null, planId || null, id);
  }

  logAudit(req.user!.id, 'UPDATE_NURSERY', 'nursery', id, id, req.body);

  res.json({ success: true, message: 'تم تحديث بيانات الحضانة' });
});

/**
 * List SaaS Plans
 */
platformRouter.get('/plans', (_req, res) => {
  const plans = db.prepare(`
    SELECT id, name, max_children, monthly_price_piastres, is_active
    FROM saas_plans
    ORDER BY monthly_price_piastres ASC
  `).all();
  res.json({ plans });
});

/**
 * Record manual SaaS subscription payment for a nursery
 */
platformRouter.post('/subscription-payments', (req: AuthenticatedRequest, res) => {
  const { nurseryId, amountPiastres, paymentMethod, referenceNo, notes } = req.body;

  if (!nurseryId || !amountPiastres || !referenceNo) {
    return res.status(400).json({ error: 'معرّف الحضانة، المبلغ بالقرش، ورقم الإيصال/المرجع مطلوبان' });
  }

  const paymentId = `subpay-${Date.now()}`;
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  db.prepare(`
    INSERT INTO subscription_payments (id, nursery_id, amount_piastres, payment_date, payment_method, reference_no, notes, created_by_user_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(paymentId, nurseryId, amountPiastres, today, paymentMethod || 'manual_cash', referenceNo, notes || null, req.user!.id, now);

  // Extend subscription period by 30 days and mark active
  const nextPeriod = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  db.prepare(`
    UPDATE nursery_subscriptions
    SET status = 'active', current_period_end = ?
    WHERE nursery_id = ?
  `).run(nextPeriod, nurseryId);

  logAudit(req.user!.id, 'RECORD_SUBSCRIPTION_PAYMENT', 'subscription_payment', paymentId, nurseryId, { amountPiastres, referenceNo });

  res.status(201).json({ success: true, paymentId, message: 'تم تسجيل دفعة الاشتراك وتمديد الصلاحية بنجاح' });
});

/**
 * Platform Audit Logs
 */
platformRouter.get('/audit-logs', (_req, res) => {
  const logs = db.prepare(`
    SELECT
      l.id,
      l.action,
      l.entity_type,
      l.entity_id,
      l.details_json,
      l.created_at,
      u.full_name as user_name,
      u.email as user_email,
      n.name as nursery_name
    FROM audit_logs l
    JOIN users u ON u.id = l.user_id
    LEFT JOIN nurseries n ON n.id = l.nursery_id
    ORDER BY l.created_at DESC
    LIMIT 100
  `).all();

  res.json({ logs });
});
