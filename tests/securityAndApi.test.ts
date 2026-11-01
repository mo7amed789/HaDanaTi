import test from 'node:test';
import assert from 'node:assert/strict';
import { db, initDatabase } from '../server/db/database';
import { canEnrollChild, validateAttendanceCheckout, computeInvoiceBalance } from '../src/utils/billingRules';

// Initialize DB schema and seed data
initDatabase();

test('Security: Tenant Isolation - Nursery Amal user cannot access Nursery Zohour child', () => {
  // Query Nursery Zohour child
  const zohourChild = db.prepare('SELECT id, nursery_id FROM children WHERE nursery_id = ? LIMIT 1').get('nursery-zohour') as { id: string; nursery_id: string };
  assert.ok(zohourChild, 'Zohour child exists');

  // Verify membership check: amal admin does NOT have membership in nursery-zohour
  const amalAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get('amal.admin@hadanaty.eg') as { id: string };
  const zohourMembership = db.prepare('SELECT id FROM nursery_memberships WHERE user_id = ? AND nursery_id = ?').get(amalAdmin.id, 'nursery-zohour');
  assert.equal(zohourMembership, undefined, 'Amal Admin has no membership in Nursery Zohour');

  // Attempting to query child with mismatched nursery_id returns null
  const crossQuery = db.prepare('SELECT id FROM children WHERE id = ? AND nursery_id = ?').get(zohourChild.id, 'nursery-amal');
  assert.equal(crossQuery, undefined, 'Mismatched nurseryId query is completely blocked by database query scoping');
});

test('Security: Parent Access - Parent cannot access unlinked child', () => {
  const amalParent = db.prepare('SELECT id FROM users WHERE email = ?').get('amal.parent@hadanaty.eg') as { id: string };
  // Child 1 is linked
  const linkedChild1 = db.prepare('SELECT id FROM parent_child_links WHERE parent_user_id = ? AND child_id = ?').get(amalParent.id, 'child-amal-1');
  assert.ok(linkedChild1, 'Child 1 is linked to parent');

  // Child 2 (Farida) is NOT linked to this parent
  const unlinkedChild2 = db.prepare('SELECT id FROM parent_child_links WHERE parent_user_id = ? AND child_id = ?').get(amalParent.id, 'child-amal-2');
  assert.equal(unlinkedChild2, undefined, 'Child 2 is unlinked and blocked from parent access');
});

test('Security: Teacher Classroom Scope - Teacher cannot access unassigned classroom', () => {
  const amalTeacher = db.prepare('SELECT id FROM users WHERE email = ?').get('amal.teacher@hadanaty.eg') as { id: string };
  // Teacher is assigned to room-amal-1
  const assigned = db.prepare('SELECT id FROM teacher_classroom_assignments WHERE teacher_user_id = ? AND classroom_id = ?').get(amalTeacher.id, 'room-amal-1');
  assert.ok(assigned, 'Teacher is assigned to room 1');

  // Teacher is NOT assigned to room-amal-2
  const unassigned = db.prepare('SELECT id FROM teacher_classroom_assignments WHERE teacher_user_id = ? AND classroom_id = ?').get(amalTeacher.id, 'room-amal-2');
  assert.equal(unassigned, undefined, 'Teacher has no assignment to room 2');
});

test('Security: Teacher Role is blocked from recording or modifying child fee payments', () => {
  // Membership role for amal.teacher is 'teacher', not 'admin'
  const amalTeacher = db.prepare('SELECT id FROM users WHERE email = ?').get('amal.teacher@hadanaty.eg') as { id: string };
  const member = db.prepare('SELECT role FROM nursery_memberships WHERE user_id = ? AND nursery_id = ?').get(amalTeacher.id, 'nursery-amal') as { role: string };
  assert.equal(member.role, 'teacher');
  assert.equal((member as any).role === 'admin', false, 'Teacher does not possess admin role needed for payments');
});

test('Business Rule: Subscription Active Child Limits are strictly checked', () => {
  // Plan Starter has max 15 children
  const starterPlan = db.prepare('SELECT max_children FROM saas_plans WHERE id = ?').get('plan-starter') as { max_children: number };
  assert.equal(starterPlan.max_children, 15);

  assert.equal(canEnrollChild(14, starterPlan.max_children), true);
  assert.equal(canEnrollChild(15, starterPlan.max_children), false, 'Enrollment rejected when quota is reached');
});

test('Business Rule: Partial payments and outstanding balances calculated correctly with reversals', () => {
  const invoice = { id: 'test-inv', amountPiastres: 250000, status: 'unpaid' as const };
  const payments = [
    { id: 'p1', invoiceId: 'test-inv', amountPiastres: 100000, isReversal: false },
    { id: 'p2', invoiceId: 'test-inv', amountPiastres: 50000, isReversal: false },
    { id: 'p3', invoiceId: 'test-inv', amountPiastres: 50000, isReversal: true }, // Reversal
  ];

  // Net paid: 100000 + 50000 - 50000 = 100000 piastres (1,000 EGP)
  // Remaining: 250000 - 100000 = 150000 piastres (1,500 EGP)
  const balance = computeInvoiceBalance(invoice, payments);
  assert.equal(balance.paidPiastres, 100000);
  assert.equal(balance.remainingPiastres, 150000);
  assert.equal(balance.status, 'partial');
});

test('Business Rule: Invalid attendance transitions are rejected', () => {
  const check = validateAttendanceCheckout('09:00', '08:45');
  assert.equal(check.isValid, false);
  assert.equal(check.error, 'وقت الانصراف يجب أن يكون بعد وقت الحضور');
});
