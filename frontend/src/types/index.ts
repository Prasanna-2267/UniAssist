export type UserRole =
  | "student"
  | "advisor"
  | "hod"
  | "warden"
  | "dept-incharge";

interface BaseUser {
  email: string;
  name: string;
  role: UserRole;
}

export interface StudentUser extends BaseUser {
  role: "student";
  reg_no: string;
  residence_type: "HOSTEL" | "DAY_SCHOLAR";
}

export interface StaffUser extends BaseUser {
  role: "advisor" | "hod" | "warden" | "dept-incharge";
}

export type User = StudentUser | StaffUser;


export type RequestStatus = 'pending' | 'approved' | 'rejected';
export type ComplaintStatus = 'open' | 'in_progress' | 'resolved';

export type LeaveCategory = 'short' | 'long' | 'emergency' | 'others';
export type BonafideCategory = 'internship' | 'general' | 'educational_loan' | 'scholarship';

/* ========================================================= */
/* 🔥 BASE REQUEST (UNIVERSAL FIX — NO LOGIC CHANGE) */
/* ========================================================= */

export interface BaseRequest {
  id: string;

  /** Normal UI Fields */
  studentId?: string;
  studentName?: string;
  studentEmail?: string;
  rollNumber?: string;
  department?: string;
  createdAt?: string;
  updatedAt?: string;

  /** 🔹 Backend alternate field names (DO NOT REMOVE) */
  name?: string;            // backend uses name
  reg_no?: string;          // backend uses reg_no
  rollNo?: string;          // some endpoints use rollNo
  submittedAt?: string;     // backend uses submittedAt
}


/* ====================== LEAVE ====================== */

export interface LeaveRequest extends BaseRequest {
  type: 'leave';
  startDate: string;
  endDate: string;
  category: LeaveCategory;
  reason?: string;
  status: RequestStatus;
  advisorStatus?: RequestStatus;
  advisorComment?: string;
  advisorActedAt?: string;
}


/* ====================== BONAFIDE ====================== */

export interface BonafideRequest extends BaseRequest {
  type: 'bonafide';
  category: BonafideCategory;
  purpose?: string;
  internshipStartDate?: string;
  internshipEndDate?: string;
  status: RequestStatus;
  advisorStatus?: RequestStatus;
  advisorComment?: string;
  advisorActedAt?: string;
  hodStatus?: RequestStatus;
  hodComment?: string;
  hodActedAt?: string;
}


/* ====================== OUTPASS ====================== */

export interface OutpassRequest extends BaseRequest {
  type: 'outpass';

  outDate?: string;
  outTime?: string;
  inDate?: string;
  inTime?: string;

  /** UI fields */
  contactNumber?: string;
  parentContact?: string;

  /** Backend fields */
  contact?: string;
  parentMobile?: string;

  purpose?: string;
  hostelId?: string;
  floorId?: string;
  roomNumber?: string;
  isHosteler?: boolean;

  status: RequestStatus;
  advisorStatus?: RequestStatus;
  advisorComment?: string;
  advisorActedAt?: string;
  hodStatus?: RequestStatus;
  hodComment?: string;
  hodActedAt?: string;
  wardenStatus?: RequestStatus;
  wardenComment?: string;
  wardenActedAt?: string;
}


/* ====================== OD ====================== */

export interface ODRequest extends BaseRequest {
  type: 'od';
  fromDate?: string;
  toDate?: string;
  purpose?: string;
  proofFile?: string;
  proofFileName?: string;
  startTime?: string;
  endTime?: string;
  place?: string;

  status: RequestStatus;
  advisorStatus?: RequestStatus;
  advisorComment?: string;
  advisorActedAt?: string;
  hodStatus?: RequestStatus;
  hodComment?: string;
  hodActedAt?: string;
}


/* ====================== COMPLAINT ====================== */

export interface Complaint extends BaseRequest {
  type: 'complaint';
  text: string;
  file?: string;
  fileName?: string;
  status: ComplaintStatus;
  assignedTo?: string;
  resolvedAt?: string;
  comments?: Array<{
    id: string;
    text: string;
    authorId: string;
    authorName: string;
    createdAt: string;
  }>;
}


/* ====================== UNION ====================== */

export type Request =
  | LeaveRequest
  | BonafideRequest
  | OutpassRequest
  | ODRequest
  | Complaint;


/* ====================== DASHBOARD ====================== */

export interface DashboardStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  resolved?: number;
  inProgress?: number;
  open?: number;
}
