import { fetchWithAuth } from "@/lib/fetchWithAuth";


export interface BonafideRequestPayload {
  reg_no: string;
  category: string;
  purpose: string;
  intern_start_date?: string;
  intern_end_date?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
export const studentApi = {
  createLeaveRequest: (data: {
    category: string;
    start_date: string;
    end_date: string;
    reason: string;
  }) =>
    fetchWithAuth("/leave/apply", {
      method: "POST",
      body: JSON.stringify(data),
    }),

    createBonafideRequest: (data: BonafideRequestPayload) =>
    fetchWithAuth("/bonafide/apply", {
      method: "POST",
      body: JSON.stringify(data),
    }),

    createOutpassRequest: (data: {
    out_date: string
    out_time: string
    in_date?: string
    in_time?: string
    purpose: string
    contact_number: string
    parent_mobile: string
    hostel_id?: string
    floor_id?: string
    room_no?: string
  }) =>
    fetchWithAuth("/outpass/apply", {
      method: "POST",
      body: JSON.stringify(data),
    }),




  createODRequest: async (
  data: {
    fromDate: string
    toDate: string
    startTime?: string
    endTime?: string
    purpose: string
    place?: string
  },
  file: File
) => {
  const formData = new FormData()

  formData.append("from_date", data.fromDate)
  formData.append("to_date", data.toDate)
  formData.append("purpose", data.purpose)

  if (data.startTime) formData.append("start_time", data.startTime)
  if (data.endTime) formData.append("end_time", data.endTime)
  if (data.place) formData.append("place", data.place)

  formData.append("proof_files", file)

  const token = localStorage.getItem("college_token")

  const res = await fetch("http://localhost:8000/od/apply", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`, // ❗ DO NOT set Content-Type
    },
    body: formData,
  })

  const responseData = await res.json()

  if (!res.ok) {
    throw new Error(responseData?.detail || "OD request failed")
  }

  return responseData
},
// Complaints
createComplaint: async (text: string, file?: File) => {
  const token = localStorage.getItem("college_token");

  const formData = new FormData();
  formData.append("complaint_text", text);

  if (file) {
    formData.append("file", file);
  }

  const response = await fetch("http://localhost:8000/complaints/create", {
    method: "POST",
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }), // ❗ do NOT set Content-Type
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Complaint failed" }));
    throw new Error(error.detail || "Complaint failed");
  }

  return response.json();
},
  getDashboardStats: () =>
    fetchWithAuth("/student/dashboard-stats"),

  getRecentRequests: () =>
    fetchWithAuth("/student/recent-requests"),

  getRequestDetail: (type: string, id: number) =>
  fetchWithAuth(`/${type}/detail/${id}`),

  getStudentRequests : async () => {
  const res = await fetchWithAuth("/student/requests");
  return res;   // should be array

  
},




};


