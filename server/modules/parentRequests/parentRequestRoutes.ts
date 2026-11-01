import { Router } from 'express';
import { db } from '../../db/database';
import { requireAuth, requireNurseryRole, AuthenticatedRequest, logAudit } from '../../middleware/auth';

export const parentRequestRouter = Router({ mergeParams: true });

parentRequestRouter.use(requireAuth);

/**
 * List Absence Notices
 * - Admin & Teachers see all notices in the nursery (or assigned classroom)
 * - Parents see their own submitted notices
 */
parentRequestRouter.get('/:nurseryId/absence-notices', requireNurseryRole(['admin', 'teacher', 'parent']), (req: AuthenticatedRequest, res) => {
  const nurseryId = req.params.nurseryId;
  const user = req.user!;
  const role = req.membership!.role;

  let query = `
    SELECT
      n.id,
      n.child_id,
      n.start_date,
      n.end_date,
      n.reason,
      n.status,
      n.created_at,
      c.first_name,
      c.last_name,
      cl.name as classroom_name,
      u.full_name as parent_name,
      u.phone as parent_phone
    FROM absence_notices n
    JOIN children c ON c.id = n.child_id
    LEFT JOIN classrooms cl ON cl.id = c.classroom_id
    JOIN users u ON u.id = n.parent_user_id
    WHERE n.nursery_id = ?
  `;

  const params: any[] = [nurseryId];

  if (role === 'parent') {
    query += ` AND n.parent_user_id = ?`;
    params.push(user.id);
  } else if (role === 'teacher') {
    query += ` AND c.classroom_id IN (SELECT classroom_id FROM teacher_classroom_assignments WHERE teacher_user_id = ? AND nursery_id = ?)`;
    params.push(user.id, nurseryId);
  }

  query += ` ORDER BY n.created_at DESC`;

  const notices = db.prepare(query).all(...params);
  res.json({ notices });
});

/**
 * Submit Absence Notice (Parent only)
 */
parentRequestRouter.post('/:nurseryId/absence-notices', requireNurseryRole(['parent']), (req: AuthenticatedRequest, res) => {
  const nurseryId = req.params.nurseryId;
  const user = req.user!;
  const { childId, startDate, endDate, reason } = req.body;

  if (!childId || !startDate || !endDate || !reason) {
    return res.status(400).json({ error: 'الطفل، تاريخ البداية، تاريخ النهاية، وسبب الغياب حقول مطلوبة' });
  }

  // Verify parent is linked to this child
  const link = db.prepare('SELECT id FROM parent_child_links WHERE child_id = ? AND parent_user_id = ? AND nursery_id = ?').get(childId, user.id, nurseryId);
  if (!link) {
    return res.status(403).json({ error: 'الطفل غير مرتبط بحسابك' });
  }

  const noticeId = `abs-${Date.now()}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO absence_notices (id, nursery_id, child_id, parent_user_id, start_date, end_date, reason, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'submitted', ?)
  `).run(noticeId, nurseryId, childId, user.id, startDate, endDate, reason, now);

  logAudit(user.id, 'SUBMIT_ABSENCE_NOTICE', 'absence_notice', noticeId, nurseryId, { childId, startDate, endDate });

  res.status(201).json({ success: true, noticeId, message: 'تم إرسال إشعار الغياب بنجاح لإدارة الحضانة' });
});

/**
 * Acknowledge Absence Notice (Admin or Teacher)
 */
parentRequestRouter.patch('/:nurseryId/absence-notices/:id/acknowledge', requireNurseryRole(['admin', 'teacher']), (req: AuthenticatedRequest, res) => {
  const { nurseryId, id } = req.params;

  db.prepare('UPDATE absence_notices SET status = ? WHERE id = ? AND nursery_id = ?').run('acknowledged', id, nurseryId);

  res.json({ success: true, message: 'تم تأكيد استلام إشعار الغياب' });
});

/**
 * List Contact Change Requests (Admin or requesting parent)
 */
parentRequestRouter.get('/:nurseryId/contact-change-requests', requireNurseryRole(['admin', 'parent']), (req: AuthenticatedRequest, res) => {
  const nurseryId = req.params.nurseryId;
  const user = req.user!;
  const role = req.membership!.role;

  let query = `
    SELECT
      r.id,
      r.child_id,
      r.parent_user_id,
      r.requested_data_json,
      r.status,
      r.review_notes,
      r.created_at,
      c.first_name,
      c.last_name,
      u.full_name as parent_name,
      rev.full_name as reviewer_name
    FROM contact_change_requests r
    JOIN children c ON c.id = r.child_id
    JOIN users u ON u.id = r.parent_user_id
    LEFT JOIN users rev ON rev.id = r.reviewed_by_user_id
    WHERE r.nursery_id = ?
  `;

  const params: any[] = [nurseryId];

  if (role === 'parent') {
    query += ` AND r.parent_user_id = ?`;
    params.push(user.id);
  }

  query += ` ORDER BY r.created_at DESC`;

  const requests = db.prepare(query).all(...params);
  res.json({ requests });
});

/**
 * Submit Contact Change Request (Parent)
 */
parentRequestRouter.post('/:nurseryId/contact-change-requests', requireNurseryRole(['parent']), (req: AuthenticatedRequest, res) => {
  const nurseryId = req.params.nurseryId;
  const user = req.user!;
  const { childId, emergencyContactName, emergencyContactPhone, notes } = req.body;

  if (!childId || !emergencyContactName || !emergencyContactPhone) {
    return res.status(400).json({ error: 'الطفل واسم ورقم جهة الاتصال في الطوارئ حقول مطلوبة' });
  }

  // Verify child link
  const link = db.prepare('SELECT id FROM parent_child_links WHERE child_id = ? AND parent_user_id = ? AND nursery_id = ?').get(childId, user.id, nurseryId);
  if (!link) {
    return res.status(403).json({ error: 'الطفل غير مرتبط بحسابك' });
  }

  const requestId = `ccr-${Date.now()}`;
  const now = new Date().toISOString();
  const dataJson = JSON.stringify({ emergencyContactName, emergencyContactPhone, notes });

  db.prepare(`
    INSERT INTO contact_change_requests (id, nursery_id, child_id, parent_user_id, requested_data_json, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?)
  `).run(requestId, nurseryId, childId, user.id, dataJson, now);

  logAudit(user.id, 'SUBMIT_CONTACT_CHANGE_REQUEST', 'contact_change_request', requestId, nurseryId, { childId });

  res.status(201).json({ success: true, requestId, message: 'تم تقديم طلب تحديث بيانات الطوارئ لمراجعة إدارة الحضانة' });
});

/**
 * Review Contact Change Request (Admin only: Approve or Reject)
 */
parentRequestRouter.post('/:nurseryId/contact-change-requests/:id/review', requireNurseryRole(['admin']), (req: AuthenticatedRequest, res) => {
  const { nurseryId, id } = req.params;
  const user = req.user!;
  const { action, reviewNotes } = req.body; // action: 'approve' | 'reject'

  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'الإجراء يجب أن يكون قبول (approve) أو رفض (reject)' });
  }

  const request = db.prepare('SELECT * FROM contact_change_requests WHERE id = ? AND nursery_id = ?').get(id, nurseryId) as Record<string, any> | undefined;
  if (!request) return res.status(404).json({ error: 'الطلب غير موجود' });
  if (request.status !== 'pending') return res.status(400).json({ error: 'تمت مراجعة هذا الطلب مسبقاً' });

  const status = action === 'approve' ? 'approved' : 'rejected';

  // If approved, update the child record
  if (action === 'approve') {
    try {
      const data = JSON.parse(request.requested_data_json);
      db.prepare(`
        UPDATE children
        SET emergency_contact_name = COALESCE(?, emergency_contact_name),
            emergency_contact_phone = COALESCE(?, emergency_contact_phone)
        WHERE id = ? AND nursery_id = ?
      `).run(data.emergencyContactName, data.emergencyContactPhone, request.child_id, nurseryId);
    } catch (e) {
      console.error('Failed to parse requested data JSON:', e);
    }
  }

  db.prepare(`
    UPDATE contact_change_requests
    SET status = ?, reviewed_by_user_id = ?, review_notes = ?
    WHERE id = ? AND nursery_id = ?
  `).run(status, user.id, reviewNotes || null, id, nurseryId);

  logAudit(user.id, `REVIEW_CONTACT_CHANGE_${action.toUpperCase()}`, 'contact_change_request', id, nurseryId, {
    childId: request.child_id,
    action,
    reviewNotes,
  });

  res.json({ success: true, message: action === 'approve' ? 'تم قبول الطلب وتحديث بيانات الطوارئ للطفل' : 'تم رفض الطلب' });
});
