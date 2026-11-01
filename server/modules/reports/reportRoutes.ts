import { Router } from 'express';
import { db } from '../../db/database';
import { requireAuth, requireNurseryRole, AuthenticatedRequest, logAudit } from '../../middleware/auth';

export const reportRouter = Router({ mergeParams: true });

reportRouter.use(requireAuth);

/**
 * List Daily Reports for a classroom and date
 */
reportRouter.get('/:nurseryId/reports', requireNurseryRole(['admin', 'teacher']), (req: AuthenticatedRequest, res) => {
  const nurseryId = req.params.nurseryId;
  const user = req.user!;
  const role = req.membership!.role;
  const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
  const classroomId = req.query.classroomId as string | undefined;

  let query = `
    SELECT
      r.id,
      r.child_id,
      r.classroom_id,
      r.date,
      r.mood,
      r.meals_summary,
      r.nap_minutes,
      r.activities_summary,
      r.individual_notes,
      r.published_at,
      c.first_name,
      c.last_name,
      cl.name as classroom_name,
      u.full_name as teacher_name
    FROM daily_reports r
    JOIN children c ON c.id = r.child_id
    JOIN classrooms cl ON cl.id = r.classroom_id
    JOIN users u ON u.id = r.teacher_user_id
    WHERE r.nursery_id = ? AND r.date = ?
  `;

  const params: any[] = [nurseryId, date];

  if (role === 'teacher') {
    query += ` AND r.classroom_id IN (SELECT classroom_id FROM teacher_classroom_assignments WHERE teacher_user_id = ? AND nursery_id = ?)`;
    params.push(user.id, nurseryId);
  }

  if (classroomId) {
    query += ` AND r.classroom_id = ?`;
    params.push(classroomId);
  }

  query += ` ORDER BY c.first_name ASC`;

  const reports = db.prepare(query).all(...params);
  res.json({ reports, date });
});

/**
 * Create or Update Daily Report for an individual child
 */
reportRouter.post('/:nurseryId/reports', requireNurseryRole(['admin', 'teacher']), (req: AuthenticatedRequest, res) => {
  const nurseryId = req.params.nurseryId;
  const user = req.user!;
  const role = req.membership!.role;
  const { childId, date, mood, mealsSummary, napMinutes, activitiesSummary, individualNotes } = req.body;

  if (!childId || !mood || !mealsSummary || !activitiesSummary) {
    return res.status(400).json({ error: 'الطفل، الحالة المزاجية، ملخص الوجبات، وملخص الأنشطة حقول مطلوبة' });
  }

  const reportDate = date || new Date().toISOString().slice(0, 10);

  // Verify child
  const child = db.prepare('SELECT id, classroom_id FROM children WHERE id = ? AND nursery_id = ?').get(childId, nurseryId) as { id: string; classroom_id: string } | undefined;
  if (!child) return res.status(404).json({ error: 'الطفل غير موجود في هذه الحضانة' });

  // If teacher, verify classroom assignment
  if (role === 'teacher') {
    const isAssigned = db.prepare(`
      SELECT id FROM teacher_classroom_assignments WHERE classroom_id = ? AND teacher_user_id = ? AND nursery_id = ?
    `).get(child.classroom_id, user.id, nurseryId);

    if (!isAssigned) {
      return res.status(403).json({ error: 'ليس لديك صلاحية لإضافة تقرير لهذا الفصل' });
    }
  }

  const reportId = `rep-${Date.now()}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO daily_reports (id, nursery_id, child_id, classroom_id, date, mood, meals_summary, nap_minutes, activities_summary, individual_notes, teacher_user_id, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(child_id, date) DO UPDATE SET
      mood = excluded.mood,
      meals_summary = excluded.meals_summary,
      nap_minutes = excluded.nap_minutes,
      activities_summary = excluded.activities_summary,
      individual_notes = excluded.individual_notes,
      teacher_user_id = excluded.teacher_user_id,
      published_at = excluded.published_at
  `).run(
    reportId,
    nurseryId,
    childId,
    child.classroom_id,
    reportDate,
    mood,
    mealsSummary,
    parseInt(napMinutes, 10) || 0,
    activitiesSummary,
    individualNotes || null,
    user.id,
    now
  );

  logAudit(user.id, 'PUBLISH_DAILY_REPORT', 'daily_report', reportId, nurseryId, { childId, date: reportDate });

  res.status(201).json({ success: true, message: 'تم حفظ ونشر التقرير اليومي بنجاح' });
});

/**
 * Batch Shared Activity across selected children in a classroom
 * Keeps individual medical or private notes separate from shared activity text.
 */
reportRouter.post('/:nurseryId/reports/batch-shared-activity', requireNurseryRole(['admin', 'teacher']), (req: AuthenticatedRequest, res) => {
  const nurseryId = req.params.nurseryId;
  const user = req.user!;
  const role = req.membership!.role;
  const { classroomId, childIds, date, sharedActivity, defaultMood, mealsSummary, napMinutes } = req.body;

  if (!classroomId || !Array.isArray(childIds) || childIds.length === 0 || !sharedActivity) {
    return res.status(400).json({ error: 'الفصل، قائمة الأطفال، والنشاط الجماعي حقول مطلوبة' });
  }

  // If teacher, verify assigned classroom
  if (role === 'teacher') {
    const isAssigned = db.prepare(`
      SELECT id FROM teacher_classroom_assignments WHERE classroom_id = ? AND teacher_user_id = ? AND nursery_id = ?
    `).get(classroomId, user.id, nurseryId);

    if (!isAssigned) {
      return res.status(403).json({ error: 'ليس لديك صلاحية لهذا الفصل' });
    }
  }

  const reportDate = date || new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();

  const insertOrUpdate = db.prepare(`
    INSERT INTO daily_reports (id, nursery_id, child_id, classroom_id, date, mood, meals_summary, nap_minutes, activities_summary, individual_notes, teacher_user_id, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
    ON CONFLICT(child_id, date) DO UPDATE SET
      activities_summary = excluded.activities_summary,
      mood = COALESCE(daily_reports.mood, excluded.mood),
      meals_summary = COALESCE(daily_reports.meals_summary, excluded.meals_summary),
      nap_minutes = COALESCE(daily_reports.nap_minutes, excluded.nap_minutes),
      teacher_user_id = excluded.teacher_user_id,
      published_at = excluded.published_at
  `);

  for (const childId of childIds) {
    const repId = `rep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    insertOrUpdate.run(
      repId,
      nurseryId,
      childId,
      classroomId,
      reportDate,
      defaultMood || 'happy',
      mealsSummary || 'تم تقديم وجبات اليوم بانتظام',
      napMinutes || 60,
      sharedActivity,
      user.id,
      now
    );
  }

  logAudit(user.id, 'BATCH_SHARED_ACTIVITY', 'daily_report', classroomId, nurseryId, { count: childIds.length, date: reportDate });

  res.json({ success: true, count: childIds.length, message: `تم تسجيل النشاط الجماعي لـ ${childIds.length} طفل بنجاح` });
});

/**
 * Parent Child Timeline
 * Chronological view of daily attendance and published reports for linked child
 */
reportRouter.get('/:nurseryId/parent/child/:childId/timeline', requireNurseryRole(['parent', 'admin']), (req: AuthenticatedRequest, res) => {
  const { nurseryId, childId } = req.params;
  const user = req.user!;
  const role = req.membership!.role;

  // If parent, strictly verify child link
  if (role === 'parent') {
    const isLinked = db.prepare(`
      SELECT id FROM parent_child_links WHERE child_id = ? AND parent_user_id = ? AND nursery_id = ?
    `).get(childId, user.id, nurseryId);

    if (!isLinked) {
      return res.status(403).json({ error: 'غير مصرح: هذا الطفل غير مرتبط بحسابك' });
    }
  }

  // Child details
  const child = db.prepare(`
    SELECT c.id, c.first_name, c.last_name, c.date_of_birth, cl.name as classroom_name
    FROM children c
    LEFT JOIN classrooms cl ON cl.id = c.classroom_id
    WHERE c.id = ? AND c.nursery_id = ?
  `).get(childId, nurseryId);

  if (!child) return res.status(404).json({ error: 'الطفل غير موجود' });

  // Get combined daily attendance and reports for the past 30 days
  const timeline = db.prepare(`
    SELECT
      d.date,
      a.status as attendance_status,
      a.check_in_time,
      a.check_out_time,
      a.pickup_person_name,
      a.notes as attendance_notes,
      r.mood,
      r.meals_summary,
      r.nap_minutes,
      r.activities_summary,
      r.individual_notes,
      r.published_at,
      u.full_name as teacher_name
    FROM (
      SELECT date FROM attendance_records WHERE child_id = ?
      UNION
      SELECT date FROM daily_reports WHERE child_id = ?
    ) d
    LEFT JOIN attendance_records a ON a.child_id = ? AND a.date = d.date
    LEFT JOIN daily_reports r ON r.child_id = ? AND r.date = d.date
    LEFT JOIN users u ON u.id = r.teacher_user_id
    ORDER BY d.date DESC
    LIMIT 30
  `).all(childId, childId, childId, childId);

  res.json({ child, timeline });
});
