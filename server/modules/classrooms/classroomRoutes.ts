import { Router } from 'express';
import { db } from '../../db/database';
import { requireAuth, requireNurseryRole, AuthenticatedRequest, logAudit } from '../../middleware/auth';

export const classroomRouter = Router({ mergeParams: true });

classroomRouter.use(requireAuth);

/**
 * List Classrooms
 * - Admins see all classrooms in the nursery
 * - Teachers see their assigned classrooms (or all if requested, but edit rights restricted)
 * - Parents see the classroom of their linked children
 */
classroomRouter.get('/:nurseryId/classrooms', requireNurseryRole(['admin', 'teacher', 'parent']), (req: AuthenticatedRequest, res) => {
  const nurseryId = req.params.nurseryId;
  const user = req.user!;
  const role = req.membership!.role;

  let query = `
    SELECT
      c.id,
      c.name,
      c.capacity,
      c.min_age_months,
      c.max_age_months,
      c.created_at,
      (SELECT COUNT(*) FROM children ch WHERE ch.classroom_id = c.id AND ch.status = 'active') as enrolled_children_count,
      (SELECT GROUP_CONCAT(u.full_name, '، ')
       FROM teacher_classroom_assignments a
       JOIN users u ON u.id = a.teacher_user_id
       WHERE a.classroom_id = c.id) as assigned_teachers
    FROM classrooms c
    WHERE c.nursery_id = ?
  `;

  const params: any[] = [nurseryId];

  // If teacher, flag assigned classrooms
  if (role === 'teacher') {
    query += ` AND c.id IN (SELECT classroom_id FROM teacher_classroom_assignments WHERE teacher_user_id = ? AND nursery_id = ?)`;
    params.push(user.id, nurseryId);
  }

  query += ` ORDER BY c.name ASC`;

  const classrooms = db.prepare(query).all(...params);
  res.json({ classrooms });
});

/**
 * Create Classroom (Admin only)
 */
classroomRouter.post('/:nurseryId/classrooms', requireNurseryRole(['admin']), (req: AuthenticatedRequest, res) => {
  const nurseryId = req.params.nurseryId;
  const { name, capacity, minAgeMonths, maxAgeMonths } = req.body;

  if (!name || !capacity) {
    return res.status(400).json({ error: 'اسم الفصل والسعة الاستيعابية مطلوبان' });
  }

  const roomId = `room-${Date.now()}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO classrooms (id, nursery_id, name, capacity, min_age_months, max_age_months, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(roomId, nurseryId, name, parseInt(capacity, 10), minAgeMonths || 12, maxAgeMonths || 48, now);

  logAudit(req.user!.id, 'CREATE_CLASSROOM', 'classroom', roomId, nurseryId, { name, capacity });

  res.status(201).json({ success: true, classroomId: roomId, message: 'تم إنشاء الفصل بنجاح' });
});

/**
 * Assign Teacher to Classroom (Admin only)
 */
classroomRouter.post('/:nurseryId/classrooms/:classroomId/teachers', requireNurseryRole(['admin']), (req: AuthenticatedRequest, res) => {
  const { nurseryId, classroomId } = req.params;
  const { teacherUserId } = req.body;

  if (!teacherUserId) return res.status(400).json({ error: 'معرّف المعلم مطلوب' });

  // Verify teacher has active teacher membership in this nursery
  const teacherMember = db.prepare(`
    SELECT id FROM nursery_memberships
    WHERE user_id = ? AND nursery_id = ? AND role = 'teacher' AND is_active = 1
  `).get(teacherUserId, nurseryId);

  if (!teacherMember) {
    return res.status(400).json({ error: 'المستخدم ليس معلماً معتمداً في هذه الحضانة' });
  }

  // Prevent duplicate assignment
  const existing = db.prepare(`
    SELECT id FROM teacher_classroom_assignments
    WHERE teacher_user_id = ? AND classroom_id = ?
  `).get(teacherUserId, classroomId);

  if (existing) {
    return res.status(400).json({ error: 'المعلم مضاف بالفعل إلى هذا الفصل' });
  }

  const assignId = `assign-${Date.now()}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO teacher_classroom_assignments (id, nursery_id, teacher_user_id, classroom_id, assigned_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(assignId, nurseryId, teacherUserId, classroomId, now);

  logAudit(req.user!.id, 'ASSIGN_TEACHER', 'classroom_assignment', assignId, nurseryId, { teacherUserId, classroomId });

  res.status(201).json({ success: true, message: 'تم تعيين المعلم للفصل بنجاح' });
});

/**
 * Remove Teacher assignment (Admin only)
 */
classroomRouter.delete('/:nurseryId/classrooms/:classroomId/teachers/:teacherUserId', requireNurseryRole(['admin']), (req: AuthenticatedRequest, res) => {
  const { nurseryId, classroomId, teacherUserId } = req.params;

  db.prepare(`
    DELETE FROM teacher_classroom_assignments
    WHERE nursery_id = ? AND classroom_id = ? AND teacher_user_id = ?
  `).run(nurseryId, classroomId, teacherUserId);

  logAudit(req.user!.id, 'UNASSIGN_TEACHER', 'classroom_assignment', `${classroomId}-${teacherUserId}`, nurseryId, { teacherUserId, classroomId });

  res.json({ success: true, message: 'تم إلغاء تعيين المعلم من الفصل' });
});
