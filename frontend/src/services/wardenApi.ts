import { fetchWithAuth } from "@/lib/fetchWithAuth"

export const wardenApi = {

  // =========================
  // 📌 DASHBOARD
  // =========================
  getDashboardStats: () =>
    fetchWithAuth("/warden/dashboard-stats"),

  getRequestBreakdown: () =>
    fetchWithAuth("/warden/request-breakdown"),

  getPendingPreview: () =>
    fetchWithAuth("/warden/pending-preview"),

  // =========================
  // 📌 PENDING REQUESTS LIST
  // =========================
  getPendingAll: () =>
    fetchWithAuth("/outpass/warden/pending"),

  // =========================
  // 📌 HISTORY
  // =========================
  getHistory: () =>
    fetchWithAuth("/warden/history"),

  // =========================
  // 📌 APPROVE / REJECT
  // =========================
  reviewRequest: (
    id: number,
    status: "APPROVED" | "REJECTED",
    remark?: string
  ) =>
    fetchWithAuth(`/outpass/warden/review/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        status,
        warden_remark: remark || "",
      }),
    }),

  // =========================
  // 📌 REQUEST DETAIL (Modal)
  // =========================
  getRequestDetail: (type: string, id: number) =>
    fetchWithAuth(`/${type}/detail/${id}`),
}
