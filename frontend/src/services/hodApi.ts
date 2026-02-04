import { fetchWithAuth } from "@/lib/fetchWithAuth"

export const hodApi = {

  // =========================
  // 📌 DASHBOARD
  // =========================
  getDashboardStats: () =>
    fetchWithAuth("/hod/dashboard-stats"),

  getRequestBreakdown: () =>
    fetchWithAuth("/hod/request-breakdown"),

  getPendingPreview: () =>
    fetchWithAuth("/hod/pending-preview"),

  // =========================
  // 📌 PENDING REQUESTS LIST
  // =========================
  getPendingAll: () =>
    fetchWithAuth("/hod/pending"),

  // =========================
  // 📌 HISTORY
  // =========================
  getHistory: () =>
    fetchWithAuth("/hod/history"),

  // =========================
  // 📌 APPROVE / REJECT
  // =========================
  reviewRequest: (
    type: string,
    id: number,
    status: "APPROVED" | "REJECTED",
    remark?: string
  ) =>
    fetchWithAuth(`/${type}/hod/review/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        status,
        hod_remark: remark || "",
      }),
    }),

  // =========================
  // 📌 REQUEST DETAIL (Modal)
  // =========================
  getRequestDetail: (type: string, id: number) =>
    fetchWithAuth(`/${type}/detail/${id}`),
}
