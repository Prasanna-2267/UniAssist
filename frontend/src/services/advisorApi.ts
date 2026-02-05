import { fetchWithAuth } from "@/lib/fetchWithAuth";

export const advisorApi = {
  // 📌 Pending Leaves (old leave-only endpoint)
  getPendingLeaves: () =>
    fetchWithAuth("/leave/advisor/pending"),

  // 📌 Review Leave (old leave-only review)
  reviewLeave: (leaveId: number, status: "APPROVED" | "REJECTED", remark?: string) =>
    fetchWithAuth(`/leave/review/${leaveId}`, {
      method: "PUT",
      body: JSON.stringify({
        status,
        advisor_remark: remark || "",
      }),
    }),

  // 📌 Leave History
  getLeaveHistory: () =>
    fetchWithAuth("/advisor/history"),

  // 📌 All Pending Requests (NEW unified endpoint)
  getPendingAll: () =>
    fetchWithAuth("/advisor/pending"),

  // 📌 Full History (if used elsewhere)
  getFullHistory: (advisorId: number) =>
    fetchWithAuth(`/advisor/${advisorId}/history`),

  getDashboardStats: () =>
  fetchWithAuth("/advisor/dashboard-stats"),

  getRequestDetail: (type: string, id: number) =>
  fetchWithAuth(`/${type}/detail/${id}`),


getRequestBreakdown: () =>
  fetchWithAuth("/advisor/request-breakdown"),

getPendingPreview: () =>
  fetchWithAuth("/advisor/pending-preview"),


  // 📌 Unified Review (LEAVE / OD / BONAFIDE / OUTPASS)
  reviewRequest: (
    type: string,
    id: number,
    status: "APPROVED" | "REJECTED",
    remark?: string
  ) =>
    fetchWithAuth(`/advisor/review/${type.toLowerCase()}/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        status,
        advisor_remark: remark || "",
      }),
    }),
};
