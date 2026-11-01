import { Router } from 'express';
import { db } from '../../db/database';
import { requireAuth, requireNurseryRole, AuthenticatedRequest, logAudit } from '../../middleware/auth';
import { validateAttendanceCheckout } from '../../../src/utils/billingRules';

export const attendanceRouter = Router({ mergeParams: true });

attendanceRouter.use(requireAuth);

/**
 * List Attendance for a classroom or nursery on a given date (defaults to today)
 */
attendanceRouter.get('/:nurseryId/attendance', requireNurseryRole(['admin', 'teacher']), (req: AuthenticatedRequest, res) => {
  const nurseryId = req.params.nurseryId;
  const user = req.user!;
  const role = req.membership!.role;
  const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
  const classroomId = req.query.classroomId as string | undefined;

  let query = `
    SELECT
      c.id as child_id,
      c.first_name,
      c.last_name,
      c.classroom_id,
      cl.name as classroom_name,
      a.id as attendance_id,
      a.date,
      COALESCE(a.status, 'unrecorded') as status,
      a.check_in_time,
      a.check_out_time,
      a.pickup_person_name,
      u.full_name as checked_out_by_user_name,
      a.notes
    FROM children c
    LEFT JOIN classrooms cl ON cl.id = c.classroom_id
    LEFT JOIN attendance_records a ON a.child_id = c.id AND a.date = ?
    LEFT JOIN users u ON u.id = a.checked_out_by_user_id
    WHERE c.nursery_id = ? AND c.status = 'active'
  `;

  const params: any[] = [date, nurseryId];

  // If teacher, scope to assigned classrooms only
  if (role === 'teacher') {
    query += ` AND c.classroom_id IN (SELECT classroom_id FROM teacher_classroom_assignments WHERE teacher_user_id = ? AND nursery_id = ?)`;
    params.push(user.id, nurseryId);
  }

  if (classroomId) {
    query += ` AND c.classroom_id = ?`;
    params.push(classroomId);
  }

  query += ` ORDER BY cl.name ASC, c.first_name ASC`;

  const records = db.prepare(query).all(...params);
  res.json({ date, records });
});

/**
 * Record Check-In
 */
attendanceRouter.post('/:nurseryId/attendance/check-in', requireNurseryRole(['admin', 'teacher']), (req: AuthenticatedRequest, res) => {
  const nurseryId = req.params.nurseryId;
  const user = req.user!;
  const role = req.membership!.role;
  const { childId, date, checkInTime, notes } = req.body;

  if (!childId) return res.status(400).json({ error: 'معرّف الطفل مطلوب' });

  const recordDate = date || new Date().toISOString().slice(0, 10);
  const now = new Date();
  const timeStr = checkInTime || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Verify child belongs to this nursery
  const child = db.prepare(`
    SELECT id, classroom_id, nursery_id FROM children WHERE id = ? AND nursery_id = ?
  `).get(childId, nurseryId) as { id: string; classroom_id: string; nursery_id: string } | undefined;

  if (!child) return res.status(404).json({ error: 'الطفل غير موجود في هذه الحضانة' });

  // If teacher, verify assigned classroom
  if (role === 'teacher') {
    const isAssigned = db.prepare(`
      SELECT id FROM teacher_classroom_assignments WHERE classroom_id = ? AND teacher_user_id = ? AND nursery_id = ?
    `).get(child.classroom_id, user.id, nurseryId);

    if (!isAssigned) {
      return res.status(403).json({ error: 'ليس لديك صلاحية لتسجيل حضور هذا الطفل' });
    }
  }

  // Check if attendance already recorded today
  const existing = db.prepare(`
    SELECT id, check_in_time, check_out_time FROM attendance_records WHERE child_id = ? AND date = ?
  `).get(childId, recordDate) as { id: string; check_in_time: string; check_out_time: string } | undefined;

  if (existing && existing.check_in_time) {
    return res.status(400).json({ error: 'تم تسجيل حضور هذا الطفل بالفعل لهذا اليوم' });
  }

  const attendanceId = existing ? existing.id : `att-${Date.now()}`;
  const nowIso = now.toISOString();

  if (existing) {
    db.prepare(`
      UPDATE attendance_records
      SET status = 'present', check_in_time = ?, notes = COALESCE(?, notes)
      WHERE id = ?
    `).run(timeStr, notes || null, attendanceId);
  } else {
    db.prepare(`
      INSERT INTO attendance_records (id, nursery_id, child_id, classroom_id, date, status, check_in_time, notes, created_at)
      VALUES (?, ?, ?, ?, ?, 'present', ?, ?, ?)
    `).run(attendanceId, nurseryId, childId, child.classroom_id, recordDate, timeStr, notes || null, nowIso);
  }

  logAudit(user.id, 'ATTENDANCE_CHECK_IN', 'attendance', attendanceId, nurseryId, { childId, date: recordDate, time: timeStr });

  res.status(201).json({ success: true, attendanceId, message: 'تم تسجيل الحضور بنجاح' });
});

/**
 * Record Check-Out (Requires authorized pickup person and validates sequence)
 */
attendanceRouter.post('/:nurseryId/attendance/check-out', requireNurseryRole(['admin', 'teacher']), (req: AuthenticatedRequest, res) => {
  const nurseryId = req.params.nurseryId;
  const user = req.user!;
  const role = req.membership!.role;
  const { childId, date, checkOutTime, pickupPersonName, notes } = req.body;

  if (!childId || !pickupPersonName) {
    return res.status(400).json({ error: 'معرّف الطفل واسم الشخص المستلم مطلوبان لتسجيل الانصراف' });
  }

  const recordDate = date || new Date().toISOString().slice(0, 10);
  const now = new Date();
  const timeStr = checkOutTime || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Verify child belongs to this nursery
  const child = db.prepare(`
    SELECT id, classroom_id FROM children WHERE id = ? AND nursery_id = ?
  `).get(childId, nurseryId) as { id: string; classroom_id: string } | undefined;

  if (!child) return res.status(404).json({ error: 'الطفل غير موجود في هذه الحضانة' });

  // If teacher, verify assigned classroom
  if (role === 'teacher') {
    const isAssigned = db.prepare(`
      SELECT id FROM teacher_classroom_assignments WHERE classroom_id = ? AND teacher_user_id = ? AND nursery_id = ?
    `).get(child.classroom_id, user.id, nurseryId);

    if (!isAssigned) {
      return res.status(403).json({ error: 'ليس لديك صلاحية لتسجيل انصراف هذا الطفل' });
    }
  }

  // Get current attendance record
  const existing = db.prepare(`
    SELECT id, check_in_time, check_out_time FROM attendance_records WHERE child_id = ? AND date = ?
  `).get(childId, recordDate) as { id: string; check_in_time: string; check_out_time: string } | undefined;

  if (!existing || !existing.check_in_time) {
    return res.status(400).json({ error: 'لا يمكن تسجيل الانصراف: الطفل لم يتم تسجيل حضوره اليوم بعد' });
  }

  if (existing.check_out_time) {
    return res.status(400).json({ error: 'تم تسجيل انصراف هذا الطفل مسبقاً' });
  }

  // Pure logic validation
  const validation = validateAttendanceCheckout(existing.check_in_time, timeStr);
  if (!validation.isValid) {
    return res.status(400).json({ error: validation.error });
  }

  db.prepare(`
    UPDATE attendance_records
    SET check_out_time = ?,
        pickup_person_name = ?,
        checked_out_by_user_id = ?,
        notes = COALESCE(?, notes)
    WHERE id = ?
  `).run(timeStr, pickupPersonName, user.id, notes || null, existing.id);

  logAudit(user.id, 'ATTENDANCE_CHECK_OUT', 'attendance', existing.id, nurseryId, {
    childId,
    date: recordDate,
    checkInTime: existing.check_in_time,
    checkOutTime: timeStr,
    pickupPersonName,
  });

  res.json({ success: true, message: `تم تسجيل انصراف الطفل واستلامه بواسطة ${pickupPersonName}` });
});

/**
 * Mark Child as Absent / Excused
 */
attendanceRouter.post('/:nurseryId/attendance/mark-absent', requireNurseryRole(['admin', 'teacher']), (req: AuthenticatedRequest, res) => {
  const nurseryId = req.params.nurseryId;
  const { childId, date, status, notes } = req.body;

  if (!childId) return res.status(400).json({ error: 'معرّف الطفل مطلوب' });

  const recordDate = date || new Date().toISOString().slice(0, 10);
  const child = db.prepare('SELECT id, classroom_id FROM children WHERE id = ? AND nursery_id = ?').get(childId, nurseryId) as { id: string; classroom_id: string } | undefined;
  if (!child) return res.status(404).json({ error: 'الطفل غير موجود' });

  const attendanceId = `att-${Date.now()}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO attendance_records (id, nursery_id, child_id, classroom_id, date, status, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(child_id, date) DO UPDATE SET
      status = excluded.status,
      notes = COALESCE(excluded.notes, attendance_records.notes)
  `).run(attendanceId, nurseryId, childId, child.classroom_id, recordDate, status || 'absent', notes || null, now);

  res.json({ success: true, message: 'تم تحديث حالة الغياب بنجاح' });
});
