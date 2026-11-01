# حضانتي (Hadanaty) — Multi-Tenant Nursery Management SaaS

A production-grade, multi-tenant nursery management SaaS tailored for Egyptian nurseries, empowering nursery administrators, teachers, and parents with daily attendance, digital reports, billing and fee ledgers, and announcements.

> [!IMPORTANT]
> **Confirmed Technical Decisions (Phase 1 Alignment)**:
> 1. **Backend Stack**: Node.js Express with TypeScript and persistent relational SQLite (`node:sqlite`) with WAL mode, transactions, and foreign key enforcement, as ASP.NET Core and PostgreSQL are unavailable in this environment.
> 2. **Authentication & Session**: Secure JWT Bearer tokens with HTTP-only cookies, salted `bcrypt` password hashing, and server-side membership validation on every request.
> 3. **Currency & Localization**: Arabic-first RTL interface, Egyptian Pounds formatted with standard numerals and `ج.م` symbol, dates localized to `Africa/Cairo` with UTC persistence, and isolated UI string dictionaries for clean bilingual extensibility.

---

## 1. Overview & Core Concept

**حضانتي** delivers an end-to-end operational operating system for independent Egyptian nurseries. It replaces chaotic WhatsApp groups and paper logbooks with a secure, role-restricted web platform:

- **Platform Owner**: Manages nursery tenants, tier plans, monthly subscriptions, active child quota limits, and platform-level audit logs.
- **Nursery Administrator**: Oversees children records, emergency contacts, classroom assignments, teacher memberships, fee invoices, manual payments, printable receipts, and nursery-wide announcements.
- **Teacher**: Operates a fast, mobile-optimized classroom workspace to mark check-in/out (recording authorized pickup people), log meals, naps, moods, activities, and individual private notes.
- **Parent**: Accesses a dedicated portal strictly limited to their linked children, displaying daily timelines, attendance history, daily reports, fee statements, absence notices, and contact change requests.

---

## 2. User Experience & Visual Design

### Visual Identity & Theme
- **Direction**: Calm, clean, professional administrative SaaS with warm neutral backgrounds (`#F8F9FA` / `#FDFBF7`) and rich teal accents (`#0D9488` / `#0F766E`) conveying care, safety, and operational rigor.
- **Typography**: Clean Arabic typography with Cairo/Tajawal-compatible legible hierarchy, generous touch targets ($\ge 44\text{px}$ on mobile), and tabular figures (`tabular-nums`) for fee amounts and timestamps.
- **RTL & Layout Integrity**: Native `dir="rtl"` layout with proper mirroring of flex containers, chevron icons, and timeline tracks.
- **Anti-Slop Restraint**: Zero decorative pills or badges; metadata separated with clean typographic dots (`·`); single elevation depth; no fake widgets.

### Core User Journeys
1. **Platform Owner Onboarding & Plan Enforcement**:
   Owner provisions a new nursery tenant with a monthly tier (e.g., 20 children limit). When the nursery admin enrolls children, the backend strictly rejects enrollment if the active child quota is reached.
2. **Nursery Administration & Staff Assignment**:
   Admin sets up classrooms (with capacity limit), creates child profiles with emergency contacts/allergies, assigns teachers to classrooms, and links parent accounts.
3. **Teacher Daily Workflow**:
   Teacher views only assigned classrooms, records one-tap check-in and check-out with authorized pickup person selection, and drafts classroom daily reports (meals, nap, mood, group activity, individual medical notes).
4. **Parent Timeline & Fee Settlement**:
   Parent logs in, switches between linked children, inspects the daily activity timeline, reviews invoices, inspects receipt references, and submits absence notices or emergency contact updates for review.

---

## 3. Key Product Decisions & Trade-Offs

- **Tenant Isolation**: Every database table containing tenant-scoped data includes a non-nullable `nursery_id`. Server-side middleware verifies that the authenticated user possesses an active membership for the target nursery before executing any controller logic.
- **Separation of Platform vs. Tenant Privileges**: Platform owners cannot view private child records, medical notes, or parent contact details by default; tenant data boundaries remain strictly hermetic.
- **Financial Ledger Rigor**: Financial amounts are stored as integers (in Egyptian Piastres, $1\text{ EGP} = 100\text{ Piastres}$) to prevent floating-point rounding errors. Deletion of payments is strictly prohibited; corrections require recorded reversal entries. Printable receipts carry cryptographically verifiable sequential reference numbers (`REC-YYYYMM-XXXX`).
- **Subscription Grace Periods**: Subscriptions track statuses (`trial`, `active`, `past_due`, `suspended`). Suspended nurseries restrict write actions (attendance, reports, child creation) while allowing read-only access for existing records.

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                   React 19 + TypeScript Frontend                       │
│      (RTL Arabic UI · Role-Based Navigation · Mobile-Responsive)       │
├───────────────────────────────────┬────────────────────────────────────┤
│         Admin Workspace           │   Teacher View   │  Parent Portal  │
└─────────────────┬─────────────────┴────────┬─────────┴────────┬────────┘
                  │                          │                  │
                  ▼                          ▼                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  Express REST API & Security Gateway                   │
│      - JWT Auth Middleware & Membership Resolver                       │
│      - Multi-Tenant Isolation & Role Authorization Guards              │
│      - Active Child Plan Limits & Capacity Checkers                    │
│      - Financial Transaction Engine (Piastres-based Ledger)            │
│      - Immutable Audit Logging Module                                  │
├────────────────────────────────────────────────────────────────────────┤
│           Relational Database Layer (`node:sqlite` + WAL)              │
│      Persistent SQLite DB (`data/hadanaty.db`) with Foreign Keys       │
└────────────────────────────────────────────────────────────────────────┘
```

### Relational Database Schema

```sql
-- 1. Identity & Multi-Tenancy
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  is_platform_owner INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE nurseries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subdomain TEXT UNIQUE,
  phone TEXT,
  address TEXT,
  city TEXT DEFAULT 'القاهرة',
  status TEXT NOT NULL DEFAULT 'active', -- active, past_due, suspended
  created_at TEXT NOT NULL
);

CREATE TABLE nursery_memberships (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nursery_id TEXT NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- admin, teacher, parent
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, nursery_id, role)
);

-- 2. SaaS Subscriptions & Platform Plans
CREATE TABLE saas_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  max_children INTEGER NOT NULL,
  monthly_price_piastres INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE nursery_subscriptions (
  id TEXT PRIMARY KEY,
  nursery_id TEXT UNIQUE NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES saas_plans(id),
  status TEXT NOT NULL, -- trial, active, past_due, suspended
  start_date TEXT NOT NULL,
  current_period_end TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE subscription_payments (
  id TEXT PRIMARY KEY,
  nursery_id TEXT NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  amount_piastres INTEGER NOT NULL,
  payment_date TEXT NOT NULL,
  payment_method TEXT NOT NULL, -- manual_cash, bank_transfer, vodafone_cash, instapay
  reference_no TEXT NOT NULL,
  notes TEXT,
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);

-- 3. Classrooms & Staff Assignments
CREATE TABLE classrooms (
  id TEXT PRIMARY KEY,
  nursery_id TEXT NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 15,
  min_age_months INTEGER DEFAULT 12,
  max_age_months INTEGER DEFAULT 48,
  created_at TEXT NOT NULL
);

CREATE TABLE teacher_classroom_assignments (
  id TEXT PRIMARY KEY,
  nursery_id TEXT NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  teacher_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  classroom_id TEXT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  assigned_at TEXT NOT NULL,
  UNIQUE(teacher_user_id, classroom_id)
);

-- 4. Children, Parents & Contacts
CREATE TABLE children (
  id TEXT PRIMARY KEY,
  nursery_id TEXT NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  classroom_id TEXT REFERENCES classrooms(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth TEXT NOT NULL,
  gender TEXT NOT NULL, -- male, female
  enrollment_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- active, archived
  allergies TEXT,
  medical_notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE parent_child_links (
  id TEXT PRIMARY KEY,
  nursery_id TEXT NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  parent_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL, -- father, mother, guardian
  created_at TEXT NOT NULL,
  UNIQUE(parent_user_id, child_id)
);

CREATE TABLE authorized_pickups (
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

-- 5. Attendance & Daily Reports
CREATE TABLE attendance_records (
  id TEXT PRIMARY KEY,
  nursery_id TEXT NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  classroom_id TEXT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  date TEXT NOT NULL, -- YYYY-MM-DD
  status TEXT NOT NULL, -- present, absent, late, excused
  check_in_time TEXT, -- HH:mm or ISO
  check_out_time TEXT,
  pickup_person_name TEXT,
  checked_out_by_user_id TEXT REFERENCES users(id),
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE daily_reports (
  id TEXT PRIMARY KEY,
  nursery_id TEXT NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  classroom_id TEXT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  date TEXT NOT NULL, -- YYYY-MM-DD
  mood TEXT NOT NULL, -- happy, calm, fussy, tired
  meals_summary TEXT NOT NULL, -- breakfast, lunch, snack intake
  nap_minutes INTEGER DEFAULT 0,
  activities_summary TEXT NOT NULL,
  individual_notes TEXT,
  teacher_user_id TEXT NOT NULL REFERENCES users(id),
  published_at TEXT NOT NULL
);

-- 6. Child Fee Invoices & Manual Payments
CREATE TABLE child_fee_invoices (
  id TEXT PRIMARY KEY,
  nursery_id TEXT NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  amount_piastres INTEGER NOT NULL,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unpaid', -- unpaid, partial, paid, cancelled
  created_at TEXT NOT NULL
);

CREATE TABLE child_fee_payments (
  id TEXT PRIMARY KEY,
  nursery_id TEXT NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  invoice_id TEXT NOT NULL REFERENCES child_fee_invoices(id) ON DELETE CASCADE,
  receipt_number TEXT NOT NULL UNIQUE,
  amount_piastres INTEGER NOT NULL,
  payment_date TEXT NOT NULL,
  payment_method TEXT NOT NULL, -- cash, instapay, vodafone_cash, bank_transfer
  reference_no TEXT,
  recorded_by_user_id TEXT NOT NULL REFERENCES users(id),
  is_reversal INTEGER NOT NULL DEFAULT 0,
  reversal_reason TEXT,
  created_at TEXT NOT NULL
);

-- 7. Announcements, Absence Notices & Parent Requests
CREATE TABLE announcements (
  id TEXT PRIMARY KEY,
  nursery_id TEXT NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  classroom_id TEXT REFERENCES classrooms(id) ON DELETE CASCADE, -- NULL = nursery-wide
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE announcement_reads (
  id TEXT PRIMARY KEY,
  announcement_id TEXT NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at TEXT NOT NULL,
  UNIQUE(announcement_id, user_id)
);

CREATE TABLE absence_notices (
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

CREATE TABLE contact_change_requests (
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

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  nursery_id TEXT REFERENCES nurseries(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details_json TEXT,
  created_at TEXT NOT NULL
);
```

### Authorization Matrix

| Actor | Nursery Records | Classrooms | Children & Pickups | Attendance & Reports | Invoices & Payments | Announcements |
|---|---|---|---|---|---|---|
| **Platform Owner** | Full CRUD & Subscriptions | None (Blocked) | None (Blocked) | None (Blocked) | Platform Subscriptions Only | Platform Alerts |
| **Nursery Admin** | Own nursery settings | Full CRUD | Full CRUD within Nursery | View all; check-in/out | Full Invoice & Manual Payment CRUD | Publish nursery/classroom |
| **Teacher** | None | Assigned classrooms only | Children in assigned classrooms | Check-in/out & draft daily reports | Read invoice count (no financial details) | View relevant announcements |
| **Parent** | None | View linked children's room | Linked children only | View daily timeline & reports for linked children | View invoices, receipts & balances for linked children | View nursery & classroom announcements |

---

## 5. Verification & Test Plan

1. **Deterministic Unit Tests (`node:test`)**:
   - Multi-tenant boundary isolation: Nursery A user rejected from Nursery B endpoints.
   - Parent access scope: Parent rejected from accessing unlinked children.
   - Teacher classroom scope: Teacher rejected from modifying unassigned classroom or payments.
   - Subscription active-child limits: Rejects creating $(N+1)$-th active child when plan quota is full.
   - Financial ledger precision: Verifies integer piastre calculations, partial payment balances, and reversals.
2. **Browser Verification Journeys (`playwright-cli`)**:
   - Journey 1: Platform Owner creates nursery and configures subscription plan.
   - Journey 2: Admin creates child, assigns classroom, and links parent.
   - Journey 3: Teacher records attendance and publishes daily report.
   - Journey 4: Parent logs in, views child timeline, submits absence notice, and views invoice receipt.
