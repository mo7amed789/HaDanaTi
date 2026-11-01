export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  isPlatformOwner: boolean;
  activeMembership?: {
    id: string;
    nurseryId: string;
    nurseryName: string;
    role: 'admin' | 'teacher' | 'parent';
  };
  memberships: Array<{
    id: string;
    nurseryId: string;
    nurseryName: string;
    role: 'admin' | 'teacher' | 'parent';
  }>;
}

export interface Nursery {
  id: string;
  name: string;
  subdomain?: string;
  phone?: string;
  address?: string;
  city?: string;
  nursery_status: 'active' | 'past_due' | 'suspended';
  subscription_status?: 'trial' | 'active' | 'past_due' | 'suspended';
  plan_name?: string;
  max_children?: number;
  monthly_price_piastres?: number;
  active_children_count?: number;
  admin_name?: string;
  admin_email?: string;
  current_period_end?: string;
  created_at: string;
}

export interface Classroom {
  id: string;
  name: string;
  capacity: number;
  min_age_months: number;
  max_age_months: number;
  enrolled_children_count: number;
  assigned_teachers?: string;
  created_at: string;
}

export interface Child {
  id: string;
  nursery_id: string;
  classroom_id?: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: 'male' | 'female';
  enrollment_date: string;
  status: 'active' | 'archived';
  allergies?: string;
  medical_notes?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  classroom_name?: string;
  parents_names?: string;
  created_at: string;
}

export interface AuthorizedPickup {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  national_id?: string;
  is_primary: number;
}

export interface AttendanceRecord {
  child_id: string;
  first_name: string;
  last_name: string;
  classroom_id?: string;
  classroom_name?: string;
  attendance_id?: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused' | 'unrecorded';
  check_in_time?: string;
  check_out_time?: string;
  pickup_person_name?: string;
  checked_out_by_user_name?: string;
  notes?: string;
}

export interface DailyReport {
  id: string;
  child_id: string;
  first_name: string;
  last_name: string;
  classroom_id: string;
  classroom_name: string;
  date: string;
  mood: 'happy' | 'calm' | 'fussy' | 'tired';
  meals_summary: string;
  nap_minutes: number;
  activities_summary: string;
  individual_notes?: string;
  teacher_name?: string;
  published_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  child_id: string;
  first_name: string;
  last_name: string;
  classroom_name?: string;
  title: string;
  amount_piastres: number;
  amountFormatted: string;
  paid_piastres: number;
  paidFormatted: string;
  remainingPiastres: number;
  remainingFormatted: string;
  due_date: string;
  status: 'unpaid' | 'partial' | 'paid' | 'cancelled';
  created_at: string;
}

export interface Receipt {
  id: string;
  receipt_number: string;
  amount_piastres: number;
  amountFormatted: string;
  payment_date: string;
  payment_method: string;
  reference_no?: string;
  is_reversal: number;
  reversal_reason?: string;
  invoice_number: string;
  invoice_title: string;
  invoiceTotalFormatted: string;
  remainingFormatted: string;
  netPaidFormatted: string;
  first_name: string;
  last_name: string;
  classroom_name?: string;
  nursery_name: string;
  nursery_phone?: string;
  nursery_address?: string;
  recorded_by_user_name: string;
  created_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  classroom_id?: string;
  classroom_name?: string;
  author_name: string;
  is_read: number;
  created_at: string;
}

export interface AbsenceNotice {
  id: string;
  child_id: string;
  first_name: string;
  last_name: string;
  classroom_name?: string;
  parent_name: string;
  parent_phone?: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: 'submitted' | 'acknowledged';
  created_at: string;
}

export interface ContactChangeRequest {
  id: string;
  child_id: string;
  first_name: string;
  last_name: string;
  parent_name: string;
  requested_data_json: string;
  status: 'pending' | 'approved' | 'rejected';
  review_notes?: string;
  reviewer_name?: string;
  created_at: string;
}
