import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import bcrypt from 'bcryptjs';

const DB_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'hadanaty.db');
export const db = new DatabaseSync(DB_PATH);

// Enable foreign keys and WAL mode for high concurrency
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

/**
 * Initialize database schema
 */
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      phone TEXT,
      is_platform_owner INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS nurseries (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      subdomain TEXT UNIQUE,
      phone TEXT,
      address TEXT,
      city TEXT DEFAULT 'القاهرة',
      status TEXT NOT NULL DEFAULT 'active', -- active, past_due, suspended
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS nursery_memberships (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      nursery_id TEXT NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
      role TEXT NOT NULL, -- admin, teacher, parent
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      UNIQUE(user_id, nursery_id, role)
    );

    CREATE TABLE IF NOT EXISTS saas_plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      max_children INTEGER NOT NULL,
      monthly_price_piastres INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS nursery_subscriptions (
      id TEXT PRIMARY KEY,
      nursery_id TEXT UNIQUE NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
      plan_id TEXT NOT NULL REFERENCES saas_plans(id),
      status TEXT NOT NULL, -- trial, active, past_due, suspended
      start_date TEXT NOT NULL,
      current_period_end TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subscription_payments (
      id TEXT PRIMARY KEY,
      nursery_id TEXT NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
      amount_piastres INTEGER NOT NULL,
      payment_date TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      reference_no TEXT NOT NULL,
      notes TEXT,
      created_by_user_id TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS classrooms (
      id TEXT PRIMARY KEY,
      nursery_id TEXT NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      capacity INTEGER NOT NULL DEFAULT 15,
      min_age_months INTEGER DEFAULT 12,
      max_age_months INTEGER DEFAULT 48,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS teacher_classroom_assignments (
      id TEXT PRIMARY KEY,
      nursery_id TEXT NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
      teacher_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      classroom_id TEXT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
      assigned_at TEXT NOT NULL,
      UNIQUE(teacher_user_id, classroom_id)
    );

    CREATE TABLE IF NOT EXISTS children (
      id TEXT PRIMARY KEY,
      nursery_id TEXT NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
      classroom_id TEXT REFERENCES classrooms(id) ON DELETE SET NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      date_of_birth TEXT NOT NULL,
      gender TEXT NOT NULL,
      enrollment_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active', -- active, archived
      allergies TEXT,
      medical_notes TEXT,
      emergency_contact_phone TEXT,
      emergency_contact_name TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS parent_child_links (
      id TEXT PRIMARY KEY,
      nursery_id TEXT NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
      parent_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
      relationship TEXT NOT NULL, -- father, mother, guardian
      created_at TEXT NOT NULL,
      UNIQUE(parent_user_id, child_id)
    );

    CREATE TABLE IF NOT EXISTS authorized_pickups (
      id TEXT PRIMARY KEY,
      child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
      nursery_id TEXT NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      relationship TEXT NOT NULL,
      phone TEXT NOT NULL,
      national_id TEXT,
      is_primary INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS attendance_records (
      id TEXT PRIMARY KEY,
      nursery_id TEXT NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
      child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
      classroom_id TEXT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
      date TEXT NOT NULL, -- YYYY-MM-DD
      status TEXT NOT NULL, -- present, absent, late, excused
      check_in_time TEXT,
      check_out_time TEXT,
      pickup_person_name TEXT,
      checked_out_by_user_id TEXT REFERENCES users(id),
      notes TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(child_id, date)
    );

    CREATE TABLE IF NOT EXISTS daily_reports (
      id TEXT PRIMARY KEY,
      nursery_id TEXT NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
      child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
      classroom_id TEXT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
      date TEXT NOT NULL, -- YYYY-MM-DD
      mood TEXT NOT NULL,
      meals_summary TEXT NOT NULL,
      nap_minutes INTEGER DEFAULT 0,
      activities_summary TEXT NOT NULL,
      individual_notes TEXT,
      teacher_user_id TEXT NOT NULL REFERENCES users(id),
      published_at TEXT NOT NULL,
      UNIQUE(child_id, date)
    );

    CREATE TABLE IF NOT EXISTS child_fee_invoices (
      id TEXT PRIMARY KEY,
      nursery_id TEXT NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
      child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
      invoice_number TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      amount_piastres INTEGER NOT NULL,
      due_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'unpaid',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS child_fee_payments (
      id TEXT PRIMARY KEY,
      nursery_id TEXT NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
      invoice_id TEXT NOT NULL REFERENCES child_fee_invoices(id) ON DELETE CASCADE,
      receipt_number TEXT NOT NULL UNIQUE,
      amount_piastres INTEGER NOT NULL,
      payment_date TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      reference_no TEXT,
      recorded_by_user_id TEXT NOT NULL REFERENCES users(id),
      is_reversal INTEGER NOT NULL DEFAULT 0,
      reversal_reason TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id TEXT PRIMARY KEY,
      nursery_id TEXT NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
      classroom_id TEXT REFERENCES classrooms(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      author_user_id TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS announcement_reads (
      id TEXT PRIMARY KEY,
      announcement_id TEXT NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      read_at TEXT NOT NULL,
      UNIQUE(announcement_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS absence_notices (
      id TEXT PRIMARY KEY,
      nursery_id TEXT NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
      child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
      parent_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'submitted', -- submitted, acknowledged
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contact_change_requests (
      id TEXT PRIMARY KEY,
      nursery_id TEXT NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
      child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
      parent_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      requested_data_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
      reviewed_by_user_id TEXT REFERENCES users(id),
      review_notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      nursery_id TEXT REFERENCES nurseries(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id),
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      details_json TEXT,
      created_at TEXT NOT NULL
    );
  `);

  seedDefaultData();
}

/**
 * Seed initial development data for two distinct nurseries with realistic accounts
 */
function seedDefaultData() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount && userCount.count > 0) {
    return; // Already seeded
  }

  const salt = bcrypt.genSaltSync(10);
  const defaultPasswordHash = bcrypt.hashSync('Password123!', salt);
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  // 1. SaaS Plans
  const insertPlan = db.prepare(`
    INSERT INTO saas_plans (id, name, max_children, monthly_price_piastres, is_active)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertPlan.run('plan-starter', 'الباقة الأساسية (Starter)', 15, 120000, 1);
  insertPlan.run('plan-standard', 'الباقة المتقدمة (Standard)', 30, 220000, 1);
  insertPlan.run('plan-pro', 'الباقة الاحترافية (Pro)', 60, 380000, 1);

  // 2. Platform Owner
  const insertUser = db.prepare(`
    INSERT INTO users (id, email, password_hash, full_name, phone, is_platform_owner, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertUser.run('user-platform-owner', 'admin@hadanaty.eg', defaultPasswordHash, 'محمد جمال (مدير المنصة)', '01001234567', 1, now);

  // 3. Nursery 1: حضانة الأمل النموذجية (Maadi, Cairo)
  const insertNursery = db.prepare(`
    INSERT INTO nurseries (id, name, subdomain, phone, address, city, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertNursery.run('nursery-amal', 'حضانة الأمل النموذجية', 'amal', '0223456789', 'شارع 9، المعادي', 'القاهرة', 'active', now);

  // Subscription for Nursery 1 (Standard: 30 children)
  const insertSub = db.prepare(`
    INSERT INTO nursery_subscriptions (id, nursery_id, plan_id, status, start_date, current_period_end, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertSub.run('sub-amal', 'nursery-amal', 'plan-standard', 'active', today, '2027-11-01', now);

  // Subscription payment for Nursery 1
  db.prepare(`
    INSERT INTO subscription_payments (id, nursery_id, amount_piastres, payment_date, payment_method, reference_no, notes, created_by_user_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('subpay-amal-1', 'nursery-amal', 220000, today, 'instapay', 'SUB-AMAL-202611', 'اشتراك شهر نوفمبر عبر انستاباي', 'user-platform-owner', now);

  // Nursery 1 Users
  insertUser.run('user-amal-admin', 'amal.admin@hadanaty.eg', defaultPasswordHash, 'د. منى سعيد', '01011112222', 0, now);
  insertUser.run('user-amal-teacher', 'amal.teacher@hadanaty.eg', defaultPasswordHash, 'أ. سارة أحمد', '01022223333', 0, now);
  insertUser.run('user-amal-parent', 'amal.parent@hadanaty.eg', defaultPasswordHash, 'م. أحمد خليل', '01033334444', 0, now);

  const insertMember = db.prepare(`
    INSERT INTO nursery_memberships (id, user_id, nursery_id, role, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertMember.run('mem-amal-admin', 'user-amal-admin', 'nursery-amal', 'admin', 1, now);
  insertMember.run('mem-amal-teacher', 'user-amal-teacher', 'nursery-amal', 'teacher', 1, now);
  insertMember.run('mem-amal-parent', 'user-amal-parent', 'nursery-amal', 'parent', 1, now);

  // Classrooms for Nursery 1
  const insertRoom = db.prepare(`
    INSERT INTO classrooms (id, nursery_id, name, capacity, min_age_months, max_age_months, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertRoom.run('room-amal-1', 'nursery-amal', 'فصل الفراشات (براعم)', 12, 18, 36, now);
  insertRoom.run('room-amal-2', 'nursery-amal', 'فصل العصافير (رضع)', 10, 6, 18, now);

  // Teacher assignment to room-amal-1
  db.prepare(`
    INSERT INTO teacher_classroom_assignments (id, nursery_id, teacher_user_id, classroom_id, assigned_at)
    VALUES (?, ?, ?, ?, ?)
  `).run('assign-amal-1', 'nursery-amal', 'user-amal-teacher', 'room-amal-1', now);

  // Children for Nursery 1
  const insertChild = db.prepare(`
    INSERT INTO children (id, nursery_id, classroom_id, first_name, last_name, date_of_birth, gender, enrollment_date, status, allergies, medical_notes, emergency_contact_phone, emergency_contact_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertChild.run(
    'child-amal-1',
    'nursery-amal',
    'room-amal-1',
    'يوسف',
    'أحمد خليل',
    '2022-03-15',
    'male',
    '2026-09-01',
    'active',
    'حساسية من الفول السوداني والفراولة',
    'يحمل بخاخ ربو وقائي عند الحاجة',
    '01033334444',
    'أحمد خليل (الأب)',
    now
  );
  insertChild.run(
    'child-amal-2',
    'nursery-amal',
    'room-amal-1',
    'فريدة',
    'محمود الشريف',
    '2022-08-10',
    'female',
    '2026-09-01',
    'active',
    'لا توجد حساسية معروفة',
    'تفضل النوم على أنغام هادئة',
    '01099998888',
    'محمود الشريف (الأب)',
    now
  );
  insertChild.run(
    'child-amal-3',
    'nursery-amal',
    'room-amal-2',
    'حمزة',
    'طارق النجار',
    '2024-01-20',
    'male',
    '2026-10-01',
    'active',
    'حساسية من بروتين الحليب البقري',
    'حليب صناعي نباتي خاص',
    '01077776666',
    'طارق النجار (الأب)',
    now
  );

  // Link Parent to Child 1
  db.prepare(`
    INSERT INTO parent_child_links (id, nursery_id, parent_user_id, child_id, relationship, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('link-amal-1', 'nursery-amal', 'user-amal-parent', 'child-amal-1', 'father', now);

  // Authorized Pickups for Child 1
  const insertPickup = db.prepare(`
    INSERT INTO authorized_pickups (id, child_id, nursery_id, name, relationship, phone, national_id, is_primary, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertPickup.run('pickup-amal-1', 'child-amal-1', 'nursery-amal', 'أحمد خليل', 'الأب', '01033334444', '28905150102345', 1, now);
  insertPickup.run('pickup-amal-2', 'child-amal-1', 'nursery-amal', 'مروة الشاذلي', 'الأم', '01055556666', '29207200109876', 0, now);
  insertPickup.run('pickup-amal-3', 'child-amal-1', 'nursery-amal', 'سميحة عبد الرؤوف', 'الجدة', '01122334455', '26001010103322', 0, now);

  // Attendance for Child 1 & 2 today
  const insertAttendance = db.prepare(`
    INSERT INTO attendance_records (id, nursery_id, child_id, classroom_id, date, status, check_in_time, check_out_time, pickup_person_name, checked_out_by_user_id, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertAttendance.run('att-amal-1', 'nursery-amal', 'child-amal-1', 'room-amal-1', today, 'present', '08:15', null, null, null, 'وصل مبتهجاً برفقة والده', now);
  insertAttendance.run('att-amal-2', 'nursery-amal', 'child-amal-2', 'room-amal-1', today, 'present', '08:30', '14:00', 'محمود الشريف', 'user-amal-teacher', 'انصراف مبكر بموافقة الإدارة', now);

  // Daily Report for Child 1
  db.prepare(`
    INSERT INTO daily_reports (id, nursery_id, child_id, classroom_id, date, mood, meals_summary, nap_minutes, activities_summary, individual_notes, teacher_user_id, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'rep-amal-1',
    'nursery-amal',
    'child-amal-1',
    'room-amal-1',
    today,
    'happy',
    'تناول وجبة الإفطار (بيض مسلوق وخيار) كاملة، ووجبة الغداء (أرز وخضار مشكل) بنسبة 80%',
    60,
    'نشاط الرسم بالألوان المائية + تعلم أنشودة الحروف الهجائية + لعب حركي في الحديقة الخارجية',
    'يوسف كان متفاعلاً جداً في النشاط الجماعي وأظهر مهارة ممتازة في مشاركة الألعاب مع زملائه.',
    'user-amal-teacher',
    now
  );

  // Fee Invoices and Payments for Nursery 1
  const insertInvoice = db.prepare(`
    INSERT INTO child_fee_invoices (id, nursery_id, child_id, invoice_number, title, amount_piastres, due_date, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertInvoice.run('inv-amal-1', 'nursery-amal', 'child-amal-1', 'INV-202611-001', 'مصروفات شهر نوفمبر 2026 (شاملة الوجبات والأنشطة)', 250000, `${today.slice(0, 7)}-10`, 'partial', now);
  insertInvoice.run('inv-amal-2', 'nursery-amal', 'child-amal-2', 'INV-202611-002', 'مصروفات شهر نوفمبر 2026', 220000, `${today.slice(0, 7)}-10`, 'paid', now);

  const insertPayment = db.prepare(`
    INSERT INTO child_fee_payments (id, nursery_id, invoice_id, receipt_number, amount_piastres, payment_date, payment_method, reference_no, recorded_by_user_id, is_reversal, reversal_reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  // Child 1 partial payment (1,500 EGP out of 2,500 EGP)
  insertPayment.run('pay-amal-1', 'nursery-amal', 'inv-amal-1', 'REC-202611-0001', 150000, today, 'instapay', 'INSTA-8849201', 'user-amal-admin', 0, null, now);
  // Child 2 full payment (2,200 EGP)
  insertPayment.run('pay-amal-2', 'nursery-amal', 'inv-amal-2', 'REC-202611-0002', 220000, today, 'cash', 'CASH-0042', 'user-amal-admin', 0, null, now);

  // Nursery 1 Announcements
  const insertAnn = db.prepare(`
    INSERT INTO announcements (id, nursery_id, classroom_id, title, content, author_user_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertAnn.run(
    'ann-amal-1',
    'nursery-amal',
    null,
    'إشعار هام: موعد رحلة حديقة الحيوان القادمة',
    'نود إعلام جميع أولياء الأمور بأن رحلة الحضانة التعليمية ستكون يوم الخميس القادم. يرجى إرسال الموافقة المكتوبة وملابس إضافية للطفل.',
    'user-amal-admin',
    now
  );
  insertAnn.run(
    'ann-amal-2',
    'nursery-amal',
    'room-amal-1',
    'نشاط فصل الفراشات: يوم المهن والألوان',
    'غداً هو يوم المهن التفاعلي لفصل الفراشات، يرجى تشجيع الطفل على ارتداء زي المهنة المفضلة لديه (طبيب، مهندس، رائد فضاء...).',
    'user-amal-teacher',
    now
  );

  // 4. Nursery 2: حضانة الزهور الدولية (Heliopolis, Cairo) - completely isolated tenant
  insertNursery.run('nursery-zohour', 'حضانة الزهور الدولية', 'zohour', '0224159876', 'مصر الجديدة، القاهرة', 'القاهرة', 'active', now);
  insertSub.run('sub-zohour', 'nursery-zohour', 'plan-starter', 'active', today, '2027-11-01', now);

  insertUser.run('user-zohour-admin', 'zohour.admin@hadanaty.eg', defaultPasswordHash, 'أ. طارق عبد الرحمن', '01044445555', 0, now);
  insertUser.run('user-zohour-teacher', 'zohour.teacher@hadanaty.eg', defaultPasswordHash, 'أ. مريم يوسف', '01066667777', 0, now);
  insertUser.run('user-zohour-parent', 'zohour.parent@hadanaty.eg', defaultPasswordHash, 'أ. نادية إبراهيم', '01088889999', 0, now);

  insertMember.run('mem-zohour-admin', 'user-zohour-admin', 'nursery-zohour', 'admin', 1, now);
  insertMember.run('mem-zohour-teacher', 'user-zohour-teacher', 'nursery-zohour', 'teacher', 1, now);
  insertMember.run('mem-zohour-parent', 'user-zohour-parent', 'nursery-zohour', 'parent', 1, now);

  insertRoom.run('room-zohour-1', 'nursery-zohour', 'فصل النجوم المشرقة', 15, 36, 60, now);
  db.prepare(`
    INSERT INTO teacher_classroom_assignments (id, nursery_id, teacher_user_id, classroom_id, assigned_at)
    VALUES (?, ?, ?, ?, ?)
  `).run('assign-zohour-1', 'nursery-zohour', 'user-zohour-teacher', 'room-zohour-1', now);

  insertChild.run(
    'child-zohour-1',
    'nursery-zohour',
    'room-zohour-1',
    'ليلى',
    'طارق حسني',
    '2021-11-05',
    'female',
    '2026-08-15',
    'active',
    'حساسية بيض خفيفة',
    'لا توجد ملاحظات طبية خاصة',
    '01088889999',
    'نادية إبراهيم (الأم)',
    now
  );

  db.prepare(`
    INSERT INTO parent_child_links (id, nursery_id, parent_user_id, child_id, relationship, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('link-zohour-1', 'nursery-zohour', 'user-zohour-parent', 'child-zohour-1', 'mother', now);

  insertPickup.run('pickup-zohour-1', 'child-zohour-1', 'nursery-zohour', 'نادية إبراهيم', 'الأم', '01088889999', '29004120108899', 1, now);

  insertAttendance.run('att-zohour-1', 'nursery-zohour', 'child-zohour-1', 'room-zohour-1', today, 'present', '08:40', null, null, null, 'حضور منتظم', now);

  insertInvoice.run('inv-zohour-1', 'nursery-zohour', 'child-zohour-1', 'INV-ZOHOUR-001', 'رسوم شهر نوفمبر 2026', 180000, `${today.slice(0, 7)}-10`, 'unpaid', now);

  insertAnn.run(
    'ann-zohour-1',
    'nursery-zohour',
    null,
    'مرحبا بكم في العام الدراسي الجديد في حضانة الزهور',
    'يسعدنا استقبال أطفالكم الأعزاء ونتمنى فصلاً دراسياً مليئاً بالتعلم والبهجة.',
    'user-zohour-admin',
    now
  );

  // Initial audit log
  db.prepare(`
    INSERT INTO audit_logs (id, nursery_id, user_id, action, entity_type, entity_id, details_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run('audit-init-1', 'nursery-amal', 'user-amal-admin', 'CREATE_CHILD', 'child', 'child-amal-1', JSON.stringify({ name: 'يوسف أحمد خليل' }), now);
}
