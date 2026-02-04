import { 
  LeaveRequest, 
  BonafideRequest, 
  OutpassRequest, 
  ODRequest, 
  Complaint,
  RequestStatus,
  ComplaintStatus,
  DashboardStats
} from '@/types';

// API Base URL - replace with your actual backend URL
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Token management
const getAuthToken = (): string | null => {
  return localStorage.getItem('college_auth_token');
};

// Generic fetch wrapper with auth
async function fetchWithAuth<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// File upload helper
async function uploadFile(file: File): Promise<string> {
  const token = getAuthToken();
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error('File upload failed');
  }

  const data = await response.json();
  return data.url;
}

// ============ Student APIs ============

export const studentApi = {
  // Leave requests
  createLeaveRequest: (data: Omit<LeaveRequest, 'id' | 'createdAt' | 'updatedAt' | 'status'>) =>
    fetchWithAuth<LeaveRequest>('/leave/apply', { method: 'POST', body: JSON.stringify(data) }),

  // Bonafide requests
  createBonafideRequest: (data: Omit<BonafideRequest, 'id' | 'createdAt' | 'updatedAt' | 'status'>) =>
    fetchWithAuth<BonafideRequest>('/bonafide/apply', { method: 'POST', body: JSON.stringify(data) }),

  // Outpass requests
  createOutpassRequest: (data: Omit<OutpassRequest, 'id' | 'createdAt' | 'updatedAt' | 'status'>) =>
    fetchWithAuth<OutpassRequest>('/outpass/apply', { method: 'POST', body: JSON.stringify(data) }),

  // OD requests (with file)
  createODRequest: async (data: Omit<ODRequest, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'proofFile'>, file: File) => {
    const fileUrl = await uploadFile(file);
    return fetchWithAuth<ODRequest>('/od/apply', {
      method: 'POST',
      body: JSON.stringify({ ...data, proofFile: fileUrl, proofFileName: file.name }),
    });
  },

  // Complaints
  createComplaint: async (text: string, file?: File) => {
    let fileUrl: string | undefined;
    let fileName: string | undefined;
    if (file) {
      fileUrl = await uploadFile(file);
      fileName = file.name;
    }
    return fetchWithAuth<Complaint>('/complaints/create', {
      method: 'POST',
      body: JSON.stringify({ text, file: fileUrl, fileName }),
    });
  },

  // Get all requests for tracking
  getMyRequests: () => fetchWithAuth<{
    leaves: LeaveRequest[];
    bonafides: BonafideRequest[];
    outpasses: OutpassRequest[];
    ods: ODRequest[];
    complaints: Complaint[];
  }>('/student/requests'),

  // Get dashboard stats
  getDashboardStats: () => fetchWithAuth<DashboardStats>('/student/stats'),
};

// ============ Advisor APIs ============

export const advisorApi = {
  // Get pending requests
  getPendingRequests: () => fetchWithAuth<{
    leaves: LeaveRequest[];
    bonafides: BonafideRequest[];
    outpasses: OutpassRequest[];
    ods: ODRequest[];
  }>('/leave/advisor/pending'),

  // Get request history
  getRequestHistory: () => fetchWithAuth<{
    leaves: LeaveRequest[];
    bonafides: BonafideRequest[];
    outpasses: OutpassRequest[];
    ods: ODRequest[];
  }>('/advisor/history'),

  // Approve/Reject leave
  updateLeaveStatus: (id: string, status: RequestStatus, comment?: string) =>
    fetchWithAuth<LeaveRequest>(`/leave/review/{id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, comment }),
    }),

  // Approve/Reject bonafide
  updateBonafideStatus: (id: string, status: RequestStatus, comment?: string) =>
    fetchWithAuth<BonafideRequest>(`/bonafide/advisor/review/{id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, comment }),
    }),

  // Approve/Reject outpass
  updateOutpassStatus: (id: string, status: RequestStatus, comment?: string) =>
    fetchWithAuth<OutpassRequest>(`/outpass/advisor/review/{id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, comment }),
    }),

  // Approve/Reject OD
  updateODStatus: (id: string, status: RequestStatus, comment?: string) =>
    fetchWithAuth<ODRequest>(`/od/advisor/review/{id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, comment }),
    }),

  // Get dashboard stats
  getDashboardStats: () => fetchWithAuth<DashboardStats>('/advisor/stats'),
};

// ============ HOD APIs ============

export const hodApi = {
  // Get pending requests (only advisor-approved ones)
  getPendingRequests: () => fetchWithAuth<{
    bonafides: BonafideRequest[];
    outpasses: OutpassRequest[];
    ods: ODRequest[];
  }>('/hod/pending'),

  // Get request history
  getRequestHistory: () => fetchWithAuth<{
    bonafides: BonafideRequest[];
    outpasses: OutpassRequest[];
    ods: ODRequest[];
  }>('/hod/history'),

  // Approve/Reject bonafide
  updateBonafideStatus: (id: string, status: RequestStatus, comment?: string) =>
    fetchWithAuth<BonafideRequest>(`/bonafide/hod/review/{id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, comment }),
    }),

  // Approve/Reject outpass
  updateOutpassStatus: (id: string, status: RequestStatus, comment?: string) =>
    fetchWithAuth<OutpassRequest>(`/outpass/hod/review/{id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, comment }),
    }),

  // Approve/Reject OD
  updateODStatus: (id: string, status: RequestStatus, comment?: string) =>
    fetchWithAuth<ODRequest>(`/od/hod/review/{id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, comment }),
    }),

  // Get dashboard stats
  getDashboardStats: () => fetchWithAuth<DashboardStats>('/hod/stats'),
};

// ============ Warden APIs ============

export const wardenApi = {
  // Get pending outpass requests (only HOD-approved for hostelers)
  getPendingOutpasses: () => fetchWithAuth<OutpassRequest[]>('/outpass/warden/pending'),

  // Get outpass history
  getOutpassHistory: () => fetchWithAuth<OutpassRequest[]>('/warden/history'),

  // Approve/Reject outpass
  updateOutpassStatus: (id: string, status: RequestStatus, comment?: string) =>
    fetchWithAuth<OutpassRequest>(`/outpass/warden/review/{id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, comment }),
    }),

  // Get dashboard stats
  getDashboardStats: () => fetchWithAuth<DashboardStats>('/warden/stats'),
};

// ============ Dept Incharge APIs ============

export const deptInchargeApi = {
  // Get all complaints
  getComplaints: () => fetchWithAuth<Complaint[]>('/dept/complaints'),

  // Get complaint history
  getComplaintHistory: () => fetchWithAuth<Complaint[]>('/dept/complaints/update/{id}'),

  // Update complaint status
  updateComplaintStatus: (id: string, status: ComplaintStatus, comment?: string) =>
    fetchWithAuth<Complaint>(`/dept-incharge/complaint/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, comment }),
    }),

  // Get dashboard stats
  getDashboardStats: () => fetchWithAuth<DashboardStats>('/dept-incharge/stats'),
};

export { uploadFile };
