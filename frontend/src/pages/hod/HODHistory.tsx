import React, { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { PageHeader } from "@/components/common/PageHeader"
import { DataTable } from "@/components/common/DataTable"
import { StatusBadge } from "@/components/common/StatusBadge"
import { RequestDetailModal } from "@/components/common/RequestDetailModal"
import { format } from "date-fns"
import { hodApi } from "@/services/hodApi"
import { toast } from "sonner"
import { Request } from "@/types"

type HODHistoryRow = {
  id: string
  type: string
  studentName: string
  rollNumber: string
  department: string
  status: "approved" | "rejected"
  actedOn: string
}

export default function HODHistory() {
  const [history, setHistory] = useState<HODHistoryRow[]>([])
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await hodApi.getHistory()

        const mapped: HODHistoryRow[] = (Array.isArray(data) ? data : []).map((r: any) => ({
          id: String(r.id),
          type: r.type.toLowerCase(),
          studentName: r.name,
          rollNumber: r.reg_no,
          department: r.department || "CSE",
          status: r.status.toLowerCase(),
          actedOn: r.acted_on,
        }))

        setHistory(mapped)
      } catch {
        toast.error("Failed to load history")
      }
    }

    load()
  }, [])

  const handleRowClick = async (row: HODHistoryRow) => {
    try {
      const full = await hodApi.getRequestDetail(row.type, Number(row.id))
      setSelectedRequest(full)
      setModalOpen(true)
    } catch {
      toast.error("Failed to load request")
    }
  }

  const getTypeLabel = (type: string) =>
    ({ bonafide: "Bonafide", outpass: "Outpass", od: "OD" } as Record<string, string>)[type] || type

  const columns = [
    {
      key: "studentName",
      header: "Student",
      render: (row: HODHistoryRow) => (
        <div>
          <p className="font-medium">{row.studentName}</p>
          <p className="text-xs text-muted-foreground">{row.rollNumber}</p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (row: HODHistoryRow) => (
        <span className="font-medium capitalize">{getTypeLabel(row.type)}</span>
      ),
    },
    {
      key: "actedOn",
      header: "Acted On",
      render: (row: HODHistoryRow) => format(new Date(row.actedOn), "PP"),
    },
    {
      key: "status",
      header: "Status",
      render: (row: HODHistoryRow) => (
        <StatusBadge status={row.status === "approved" ? "approved" : "rejected"} />
      ),
    },
  ]

  return (
    <DashboardLayout>
      <PageHeader
        title="Request History"
        description="View all requests you've acted on"
      />

      <DataTable<HODHistoryRow>
        data={history}
        columns={columns}
        searchPlaceholder="Search by student name..."
        searchKey="studentName"
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
