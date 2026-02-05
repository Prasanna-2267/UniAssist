import React, { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { PageHeader } from "@/components/common/PageHeader"
import { DataTable } from "@/components/common/DataTable"
import { StatusBadge } from "@/components/common/StatusBadge"
import { RequestDetailModal } from "@/components/common/RequestDetailModal"
import { wardenApi } from "@/services/wardenApi"

export default function WardenHistory() {
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await wardenApi.getHistory()

        // ⭐ NORMALIZATION FIX
        const formatted = res.map((r: any) => ({
          id: r.id,
          type: r.type?.toLowerCase(),   // 🔥 REQUIRED

          studentName: r.studentname,
          rollNumber: r.rollnumber,
          department: r.department,

          outDate: r.outdate,
          inDate: r.indate,
          purpose: r.purpose,

          status: r.status.toLowerCase(),

          createdAt: r.submittedat,  // modal expects createdAt
          updatedAt: r.actedat,
          actedAt: r.actedat,
        }))

        setHistory(formatted)
      } catch (err) {
        console.error("History load failed", err)
      } finally {
        setLoading(false)
      }
    }

    loadHistory()
  }, [])

  const handleRowClick = async (request: any) => {
    try {
      const detail = await wardenApi.getRequestDetail(request.type, request.id)
      setSelectedRequest(detail)
      setModalOpen(true)
    } catch (err) {
      console.error("Detail fetch failed", err)
    }
  }

  const columns = [
    {
      key: 'studentName',
      header: 'Student',
      render: (row: any) => (
        <div>
          <p className="font-medium">{row.studentName}</p>
          <p className="text-xs text-muted-foreground">{row.rollNumber}</p>
        </div>
      ),
    },
    {
      key: 'hostel',
      header: 'Hostel',
      render: () => <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'actedAt',
      header: 'Acted On',
      render: (row: any) =>
        row.actedAt ? new Date(row.actedAt).toLocaleDateString() : "—",
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: any) => (
        <StatusBadge status={row.status} />
      ),
    },
  ]

  const filterOptions = [
    { label: "Approved", value: "approved" },
    { label: "Rejected", value: "rejected" },
  ]

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6">Loading history...</div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Outpass History"
        description="View all outpasses you've acted on"
      />

      <DataTable
        data={history}
        columns={columns}
        searchPlaceholder="Search by student name..."
        searchKey="studentName"
        filterOptions={filterOptions}
        filterKey="status"
        onRowClick={handleRowClick}
        emptyMessage="No history found"
      />

      <RequestDetailModal
        request={selectedRequest}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </DashboardLayout>
  )
}
