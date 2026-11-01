import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../../db/database';
import { requireAuth, requireNurseryRole, AuthenticatedRequest, logAudit } from '../../middleware/auth';
import { canEnrollChild } from '../../../src/utils/billingRules';

export const childrenRouter = Router({ mergeParams: true });

childrenRouter.use(requireAuth);

/**
 * List Children in Nursery
 * - Admins see all children in their nursery
 * - Teachers see children in their assigned classrooms
 * - Parents see ONLY their linked children
 */
childrenRouter.get('/:nurseryId/children', requireNurseryRole(['admin', 'teacher', 'parent']), (req: AuthenticatedRequest, res) => {
  const nurseryId = req.params.nurseryId;
  const user = req.user!;
  const role = req.membership!.role;
  const { classroomId, status } = req.query;

  let query = `
    SELECT
      c.id,
      c.nursery_id,
      c.classroom_id,
      c.first_name,
      c.last_name,
      c.date_of_birth,
      c.gender,
      c.enrollment_date,
      c.status,
      c.allergies,
      c.medical_notes,
      c.emergency_contact_name,
      c.emergency_contact_phone,
      c.created_at,
      cl.name as classroom_name,
      (SELECT GROUP_CONCAT(p_u.full_name, '، ')
       FROM parent_child_links pcl
       JOIN users p_u ON p_u.id = pcl.parent_user_id
       WHERE pcl.child_id = c.id) as parents_names
    FROM children c
    LEFT JOIN classrooms cl ON cl.id = c.classroom_id
    WHERE c.nursery_id = ?
  `;

  const params: any[] = [nurseryId];

  // Role Scoping
  if (role === 'parent') {
    // Parent sees ONLY linked children
    query += ` AND c.id IN (SELECT child_id FROM parent_child_links WHERE parent_user_id = ? AND nursery_id = ?)`;
    params.push(user.id, nurseryId);
  } else if (role === 'teacher') {
    // Teacher sees ONLY children in assigned classrooms
    query += ` AND c.classroom_id IN (SELECT classroom_id FROM teacher_classroom_assignments WHERE teacher_user_id = ? AND nursery_id = ?)`;
    params.push(user.id, nurseryId);
  }

  // Filter queries
  if (classroomId) {
    query += ` AND c.classroom_id = ?`;
    params.push(classroomId);
  }

  if (status) {
    query += ` AND c.status = ?`;
    params.push(status);
  } else {
    // Default to active unless specified
    query += ` AND c.status = 'active'`;
  }

  query += ` ORDER BY c.first_name ASC`;

  const children = db.prepare(query).all(...params);
  res.json({ children });
});

/**
 * Get Single Child Details
 */
childrenRouter.get('/:nurseryId/children/:childId', requireNurseryRole(['admin', 'teacher', 'parent']), (req: AuthenticatedRequest, res) => {
  const { nurseryId, childId } = req.params;
  const user = req.user!;
  const role = req.membership!.role;

  // Verify child belongs to this nursery
  const child = db.prepare(`
    SELECT
      c.id, c.nursery_id, c.classroom_id, c.first_name, c.last_name,
      c.date_of_birth, c.gender, c.enrollment_date, c.status,
      c.allergies, c.medical_notes, c.emergency_contact_name, c.emergency_contact_phone,
      c.created_at,
      cl.name as classroom_name
    FROM children c
    LEFT JOIN classrooms cl ON cl.id = c.classroom_id
    WHERE c.id = ? AND c.nursery_id = ?
  `).get(childId, nurseryId) as Record<string, unknown> | undefined;

  if (!child) {
    return res.status(404).json({ error: 'الطفل غير موجود في هذه الحضانة' });
  }

  // Security checks:
  if (role === 'parent') {
    const isLinked = db.prepare(`
      SELECT id FROM parent_child_links WHERE child_id = ? AND parent_user_id = ? AND nursery_id = ?
    `).get(childId, user.id, nurseryId);
    if (!isLinked) {
      return res.status(403).json({ error: 'ليس لديك صلاحية للاطلاع على بيانات هذا الطفل' });
    }
  } else if (role === 'teacher') {
    const isAssigned = db.prepare(`
      SELECT id FROM teacher_classroom_assignments WHERE classroom_id = ? AND teacher_user_id = ? AND nursery_id = ?
    `).get(child.classroom_id as string, user.id, nurseryId);
    if (!isAssigned) {
      return res.status(403).json({ error: 'الطفل ليس ضمن فصولك المسندة إليك' });
    }
  }

  // Get authorized pickups
  const authorizedPickups = db.prepare(`
    SELECT id, name, relationship, phone, national_id, is_primary
    FROM authorized_pickups
    WHERE child_id = ? AND nursery_id = ?
    ORDER BY is_primary DESC, name ASC
  `).all(childId, nurseryId);

  // Get linked parents
  const linkedParents = db.prepare(`
    SELECT pcl.id as link_id, pcl.relationship, u.id as user_id, u.full_name, u.email, u.phone
    FROM parent_child_links pcl
    JOIN users u ON u.id = pcl.parent_user_id
    WHERE pcl.child_id = ? AND pcl.nursery_id = ?
  `).all(childId, nurseryId);

  res.json({
    child,
    authorizedPickups,
    linkedParents,
  });
});

/**
 * Create Child (Admin only)
 * Strictly verifies SaaS Subscription active-child quota and Classroom capacity!
 */
childrenRouter.post('/:nurseryId/children', requireNurseryRole(['admin']), (req: AuthenticatedRequest, res) => {
  const nurseryId = req.params.nurseryId;
  const {
    firstName,
    lastName,
    dateOfBirth,
    gender,
    classroomId,
    enrollmentDate,
    allergies,
    medicalNotes,
    emergencyContactName,
    emergencyContactPhone,
    pickupPersons, // optional array
  } = req.body;

  if (!firstName || !lastName || !dateOfBirth || !gender) {
    return res.status(400).json({ error: 'الاسم الأول، اسم العائلة، تاريخ الميلاد، والنوع حقول إلزامية' });
  }

  // 1. Verify SaaS Subscription Child Limit
  const sub = db.prepare(`
    SELECT s.status, p.max_children
    FROM nursery_subscriptions s
    JOIN saas_plans p ON p.id = s.plan_id
    WHERE s.nursery_id = ?
  `).get(nurseryId) as { status: string; max_children: number } | undefined;

  if (!sub || sub.status === 'suspended') {
    return res.status(403).json({ error: 'اشتراك الحضانة معلّق أو غير متاح. يرجى تجديد الاشتراك أولاً' });
  }

  const currentCount = db.prepare(`
    SELECT COUNT(*) as count FROM children WHERE nursery_id = ? AND status = 'active'
  `).get(nurseryId) as { count: number };

  if (!canEnrollChild(currentCount.count, sub.max_children)) {
    return res.status(403).json({
      error: `تم الوصول إلى الحد الأقصى للأطفال المتاحين في باقة اشتراك الحضانة (${sub.max_children} طفل). يرجى ترقية الباقة لإضافة المزيد`,
    });
  }

  // 2. Verify Classroom Capacity if classroom assigned
  if (classroomId) {
    const room = db.prepare(`
      SELECT capacity, (SELECT COUNT(*) FROM children WHERE classroom_id = ? AND status = 'active') as enrolled
      FROM classrooms
      WHERE id = ? AND nursery_id = ?
    `).get(classroomId, classroomId, nurseryId) as { capacity: number; enrolled: number } | undefined;

    if (!room) {
      return res.status(400).json({ error: 'الفصل المختار غير موجود في هذه الحضانة' });
    }

    if (room.enrolled >= room.capacity) {
      return res.status(400).json({ error: `الفصل مكتمل السعة (${room.capacity} أطفال). يرجى اختيار فصل آخر` });
    }
  }

  const childId = `child-${Date.now()}`;
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  db.prepare(`
    INSERT INTO children (
      id, nursery_id, classroom_id, first_name, last_name, date_of_birth,
      gender, enrollment_date, status, allergies, medical_notes,
      emergency_contact_name, emergency_contact_phone, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)
  `).run(
    childId,
    nurseryId,
    classroomId || null,
    firstName,
    lastName,
    dateOfBirth,
    gender,
    enrollmentDate || today,
    allergies || null,
    medicalNotes || null,
    emergencyContactName || null,
    emergencyContactPhone || null,
    now
  );

  // Add initial authorized pickup persons if provided
  if (Array.isArray(pickupPersons)) {
    const insertPickup = db.prepare(`
      INSERT INTO authorized_pickups (id, child_id, nursery_id, name, relationship, phone, national_id, is_primary, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const p of pickupPersons) {
      if (p.name && p.phone) {
        insertPickup.run(`pickup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, childId, nurseryId, p.name, p.relationship || 'مفوض استلام', p.phone, p.nationalId || null, p.isPrimary ? 1 : 0, now);
      }
    }
  }

  logAudit(req.user!.id, 'CREATE_CHILD', 'child', childId, nurseryId, { name: `${firstName} ${lastName}`, classroomId });

  res.status(201).json({ success: true, childId, message: 'تم تسجيل الطفل بنجاح' });
});

/**
 * Update Child (Admin only)
 */
childrenRouter.patch('/:nurseryId/children/:childId', requireNurseryRole(['admin']), (req: AuthenticatedRequest, res) => {
  const { nurseryId, childId } = req.params;
  const {
    firstName,
    lastName,
    dateOfBirth,
    gender,
    classroomId,
    status,
    allergies,
    medicalNotes,
    emergencyContactName,
    emergencyContactPhone,
  } = req.body;

  const child = db.prepare('SELECT id FROM children WHERE id = ? AND nursery_id = ?').get(childId, nurseryId);
  if (!child) return res.status(404).json({ error: 'الطفل غير موجود' });

  // If changing classroom, check capacity
  if (classroomId) {
    const room = db.prepare(`
      SELECT capacity, (SELECT COUNT(*) FROM children WHERE classroom_id = ? AND id != ? AND status = 'active') as enrolled
      FROM classrooms
      WHERE id = ? AND nursery_id = ?
    `).get(classroomId, childId, classroomId, nurseryId) as { capacity: number; enrolled: number } | undefined;

    if (!room) return res.status(400).json({ error: 'الفصل غير صالح' });
    if (room.enrolled >= room.capacity) {
      return res.status(400).json({ error: `الفصل مكتمل السعة (${room.capacity} أطفال)` });
    }
  }

  db.prepare(`
    UPDATE children
    SET first_name = COALESCE(?, first_name),
        last_name = COALESCE(?, last_name),
        date_of_birth = COALESCE(?, date_of_birth),
        gender = COALESCE(?, gender),
        classroomId = COALESCE(?, classroom_id),
        status = COALESCE(?, status),
        allergies = COALESCE(?, allergies),
        medical_notes = COALESCE(?, medical_notes),
        emergency_contact_name = COALESCE(?, emergency_contact_name),
        emergency_contact_phone = COALESCE(?, emergency_contact_phone)
    WHERE id = ? AND nursery_id = ?
  `).run(
    firstName || null,
    lastName || null,
    dateOfBirth || null,
    gender || null,
    classroomId || null,
    status || null,
    allergies !== undefined ? allergies : null,
    medicalNotes !== undefined ? medicalNotes : null,
    emergencyContactName || null,
    emergencyContactPhone || null,
    childId,
    nurseryId
  );

  logAudit(req.user!.id, 'UPDATE_CHILD', 'child', childId, nurseryId, req.body);

  res.json({ success: true, message: 'تم تحديث بيانات الطفل' });
});

/**
 * Add Authorized Pickup Person (Admin only)
 */
childrenRouter.post('/:nurseryId/children/:childId/pickups', requireNurseryRole(['admin']), (req: AuthenticatedRequest, res) => {
  const { nurseryId, childId } = req.params;
  const { name, relationship, phone, nationalId, isPrimary } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ error: 'اسم الشخص المفوض ورقم هاتفه مطلوبان' });
  }

  const pickupId = `pickup-${Date.now()}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO authorized_pickups (id, child_id, nursery_id, name, relationship, phone, national_id, is_primary, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(pickupId, childId, nurseryId, name, relationship || 'مفوض استلام', phone, nationalId || null, isPrimary ? 1 : 0, now);

  logAudit(req.user!.id, 'ADD_AUTHORIZED_PICKUP', 'authorized_pickup', pickupId, nurseryId, { childId, name, phone });

  res.status(201).json({ success: true, pickupId, message: 'تمت إضافة المفوض بالاستلام' });
});

/**
 * Link Parent to Child (Admin only)
 */
childrenRouter.post('/:nurseryId/children/:childId/parents', requireNurseryRole(['admin']), (req: AuthenticatedRequest, res) => {
  const { nurseryId, childId } = req.params;
  const { parentEmail, parentName, parentPhone, parentPassword, relationship } = req.body;

  if (!parentEmail || !relationship) {
    return res.status(400).json({ error: 'بريد ولي الأمر وصلة القرابة مطلوبان' });
  }

  // 1. Find or create user
  let user = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(parentEmail) as { id: string } | undefined;
  const now = new Date().toISOString();

  if (!user) {
    const userId = `user-${Date.now()}`;
    const salt = bcrypt.genSaltSync(10);
    const passHash = bcrypt.hashSync(parentPassword || 'Password123!', salt);

    db.prepare(`
      INSERT INTO users (id, email, password_hash, full_name, phone, is_platform_owner, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `).run(userId, parentEmail, passHash, parentName || 'ولي أمر', parentPhone || null, now);
    user = { id: userId };
  }

  // 2. Ensure parent has nursery membership
  const existingMem = db.prepare(`
    SELECT id FROM nursery_memberships WHERE user_id = ? AND nursery_id = ? AND role = 'parent'
  `).get(user.id, nurseryId);

  if (!existingMem) {
    db.prepare(`
      INSERT INTO nursery_memberships (id, user_id, nursery_id, role, is_active, created_at)
      VALUES (?, ?, ?, 'parent', 1, ?)
    `).run(`mem-${Date.now()}`, user.id, nurseryId, now);
  }

  // 3. Link child
  const existingLink = db.prepare(`
    SELECT id FROM parent_child_links WHERE parent_user_id = ? AND child_id = ?
  `).get(user.id, childId);

  if (existingLink) {
    return res.status(400).json({ error: 'ولي الأمر مرتبط بالفعل بهذا الطفل' });
  }

  const linkId = `link-${Date.now()}`;
  db.prepare(`
    INSERT INTO parent_child_links (id, nursery_id, parent_user_id, child_id, relationship, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(linkId, nurseryId, user.id, childId, relationship, now);

  logAudit(req.user!.id, 'LINK_PARENT', 'parent_link', linkId, nurseryId, { parentUserId: user.id, childId, relationship });

  res.status(201).json({ success: true, linkId, message: 'تم ربط ولي الأمر بالطفل بنجاح' });
});
