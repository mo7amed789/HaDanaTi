import { Router } from 'express';
import { db } from '../../db/database';
import { requireAuth, requireNurseryRole, AuthenticatedRequest, logAudit } from '../../middleware/auth';

export const announcementRouter = Router({ mergeParams: true });

announcementRouter.use(requireAuth);

/**
 * List Announcements
 * - Nursery-wide announcements are visible to all members of this nursery
 * - Classroom announcements are visible only to teachers of that classroom and parents of enrolled children
 */
announcementRouter.get('/:nurseryId/announcements', requireNurseryRole(['admin', 'teacher', 'parent']), (req: AuthenticatedRequest, res) => {
  const nurseryId = req.params.nurseryId;
  const user = req.user!;
  const role = req.membership!.role;

  let query = `
    SELECT
      a.id,
      a.title,
      a.content,
      a.classroom_id,
      a.created_at,
      cl.name as classroom_name,
      u.full_name as author_name,
      CASE WHEN r.id IS NOT NULL THEN 1 ELSE 0 END as is_read
    FROM announcements a
    JOIN users u ON u.id = a.author_user_id
    LEFT JOIN classrooms cl ON cl.id = a.classroom_id
    LEFT JOIN announcement_reads r ON r.announcement_id = a.id AND r.user_id = ?
    WHERE a.nursery_id = ?
  `;

  const params: any[] = [user.id, nurseryId];

  if (role === 'teacher') {
    // Nursery-wide OR assigned classroom
    query += ` AND (a.classroom_id IS NULL OR a.classroom_id IN (
      SELECT classroom_id FROM teacher_classroom_assignments WHERE teacher_user_id = ? AND nursery_id = ?
    ))`;
    params.push(user.id, nurseryId);
  } else if (role === 'parent') {
    // Nursery-wide OR classroom of linked children
    query += ` AND (a.classroom_id IS NULL OR a.classroom_id IN (
      SELECT c.classroom_id FROM children c
      JOIN parent_child_links pcl ON pcl.child_id = c.id
      WHERE pcl.parent_user_id = ? AND pcl.nursery_id = ?
    ))`;
    params.push(user.id, nurseryId);
  }

  query += ` ORDER BY a.created_at DESC`;

  const announcements = db.prepare(query).all(...params);
  res.json({ announcements });
});

/**
 * Create Announcement (Admin or Teacher for assigned room)
 */
announcementRouter.post('/:nurseryId/announcements', requireNurseryRole(['admin', 'teacher']), (req: AuthenticatedRequest, res) => {
  const nurseryId = req.params.nurseryId;
  const user = req.user!;
  const role = req.membership!.role;
  const { title, content, classroomId } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: 'عنوان الإعلان والمحتوى حقول إلزامية' });
  }

  // Teachers can only post to their assigned classrooms, not nursery-wide
  if (role === 'teacher') {
    if (!classroomId) {
      return res.status(403).json({ error: 'المعلم يمكنه نشر الإعلانات داخل فصوله المسندة إليه فقط' });
    }
    const isAssigned = db.prepare(`
      SELECT id FROM teacher_classroom_assignments WHERE classroom_id = ? AND teacher_user_id = ? AND nursery_id = ?
    `).get(classroomId, user.id, nurseryId);
    if (!isAssigned) {
      return res.status(403).json({ error: 'الفصل غير مسند إليك' });
    }
  }

  const announcementId = `ann-${Date.now()}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO announcements (id, nursery_id, classroom_id, title, content, author_user_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(announcementId, nurseryId, classroomId || null, title, content, user.id, now);

  logAudit(user.id, 'PUBLISH_ANNOUNCEMENT', 'announcement', announcementId, nurseryId, { title, classroomId });

  res.status(201).json({ success: true, announcementId, message: 'تم نشر الإعلان بنجاح' });
});

/**
 * Mark Announcement as Read
 */
announcementRouter.post('/:nurseryId/announcements/:id/read', requireNurseryRole(['admin', 'teacher', 'parent']), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const user = req.user!;
  const readId = `read-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO announcement_reads (id, announcement_id, user_id, read_at)
    VALUES (?, ?, ?, ?)
  `).run(readId, id, user.id, now);

  res.json({ success: true });
});
