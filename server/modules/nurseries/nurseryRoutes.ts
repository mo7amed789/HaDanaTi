import { Router } from 'express';
import { db } from '../../db/database';
import { requireAuth, requireNurseryRole, AuthenticatedRequest } from '../../middleware/auth';

export const nurseryRouter = Router({ mergeParams: true });

nurseryRouter.use(requireAuth);

/**
 * Nursery Dashboard Statistics
 */
nurseryRouter.get('/:nurseryId/dashboard', requireNurseryRole(['admin', 'teacher']), (req: AuthenticatedRequest, res) => {
  const nurseryId = req.params.nurseryId;
  const today = new Date().toISOString().slice(0, 10);

  // 1. Active children count
  const activeChildren = db.prepare(`
    SELECT COUNT(*) as count FROM children WHERE nursery_id = ? AND status = 'active'
  `).get(nurseryId) as { count: number };

  // 2. Attendance today
  const attendanceToday = db.prepare(`
    SELECT
      COUNT(*) as total_logged,
      SUM(CASE WHEN check_out_time IS NULL THEN 1 ELSE 0 END) as currently_present,
      SUM(CASE WHEN check_out_time IS NOT NULL THEN 1 ELSE 0 END) as checked_out
    FROM attendance_records
    WHERE nursery_id = ? AND date = ?
  `).get(nurseryId, today) as { total_logged: number; currently_present: number; checked_out: number };

  // 3. Outstanding parent balances
  // Invoices amount minus net non-reversal payments
  const totalInvoiced = db.prepare(`
    SELECT COALESCE(SUM(amount_piastres), 0) as total
    FROM child_fee_invoices
    WHERE nursery_id = ? AND status != 'cancelled'
  `).get(nurseryId) as { total: number };

  const totalPaid = db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN is_reversal = 1 THEN -amount_piastres ELSE amount_piastres END), 0) as total
    FROM child_fee_payments
    WHERE nursery_id = ?
  `).get(nurseryId) as { total: number };

  const outstandingBalancePiastres = Math.max(0, totalInvoiced.total - totalPaid.total);

  // 4. Classrooms count
  const classroomsCount = db.prepare(`
    SELECT COUNT(*) as count FROM classrooms WHERE nursery_id = ?
  `).get(nurseryId) as { count: number };

  // 5. Subscription limit info
  const subInfo = db.prepare(`
    SELECT s.status, p.name as plan_name, p.max_children
    FROM nursery_subscriptions s
    JOIN saas_plans p ON p.id = s.plan_id
    WHERE s.nursery_id = ?
  `).get(nurseryId) as { status: string; plan_name: string; max_children: number } | undefined;

  // 6. Recent announcements
  const recentAnnouncements = db.prepare(`
    SELECT a.id, a.title, a.content, a.created_at, u.full_name as author_name
    FROM announcements a
    JOIN users u ON u.id = a.author_user_id
    WHERE a.nursery_id = ?
    ORDER BY a.created_at DESC
    LIMIT 3
  `).all(nurseryId);

  // 7. Recent reports count
  const reportsToday = db.prepare(`
    SELECT COUNT(*) as count FROM daily_reports WHERE nursery_id = ? AND date = ?
  `).get(nurseryId, today) as { count: number };

  res.json({
    activeChildrenCount: activeChildren.count,
    attendanceToday: {
      totalLogged: attendanceToday.total_logged || 0,
      currentlyPresent: attendanceToday.currently_present || 0,
      checkedOut: attendanceToday.checked_out || 0,
    },
    outstandingBalancePiastres,
    classroomsCount: classroomsCount.count,
    reportsCountToday: reportsToday.count,
    subscription: subInfo,
    recentAnnouncements,
  });
});

/**
 * Nursery details & staff members
 */
nurseryRouter.get('/:nurseryId/details', requireNurseryRole(['admin', 'teacher', 'parent']), (req: AuthenticatedRequest, res) => {
  const nurseryId = req.params.nurseryId;

  const nursery = db.prepare(`
    SELECT id, name, subdomain, phone, address, city, status, created_at
    FROM nurseries
    WHERE id = ?
  `).get(nurseryId);

  if (!nursery) return res.status(404).json({ error: 'الحضانة غير موجودة' });

  // Only admin gets full staff list
  let staff: unknown[] = [];
  if (req.membership?.role === 'admin') {
    staff = db.prepare(`
      SELECT m.id as membership_id, m.role, m.is_active, u.id as user_id, u.full_name, u.email, u.phone
      FROM nursery_memberships m
      JOIN users u ON u.id = m.user_id
      WHERE m.nursery_id = ? AND m.role IN ('admin', 'teacher')
      ORDER BY m.role ASC, u.full_name ASC
    `).all(nurseryId);
  }

  res.json({ nursery, staff });
});

/**
 * Update nursery profile (Admin only)
 */
nurseryRouter.patch('/:nurseryId/settings', requireNurseryRole(['admin']), (req: AuthenticatedRequest, res) => {
  const nurseryId = req.params.nurseryId;
  const { name, phone, address, city } = req.body;

  db.prepare(`
    UPDATE nurseries
    SET name = COALESCE(?, name),
        phone = COALESCE(?, phone),
        address = COALESCE(?, address),
        city = COALESCE(?, city)
    WHERE id = ?
  `).run(name || null, phone || null, address || null, city || null, nurseryId);

  res.json({ success: true, message: 'تم حفظ إعدادات الحضانة' });
});
