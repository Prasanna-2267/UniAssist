import React, { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable } from '@/components/common/DataTable'
import { RequestDetailModal } from '@/components/common/RequestDetailModal'
import { OutpassRequest } from '@/types'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { wardenApi } from '@/services/wardenApi'



export default function WardenPending() {
  const [outpasses, setOutpasses] = useState<OutpassRequest[]>([])
  const [selectedRequest, setSelectedRequest] = useState<OutpassRequest | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  // 🔥 LOAD DATA
  useEffect(() => {
    const load = async () => {
      try {
        const data = await wardenApi.getPendingAll()

        const mapped: OutpassRequest[] = (Array.isArray(data) ? data : []).map((o: any) => ({
          id: String(o.outpass_id),
          type: 'outpass',
          studentId: o.reg_no,
          studentName: o.student_name,
          studentEmail: '',
          rollNumber: o.reg_no,
          department: '',
          outDate: o.out_date,
          outTime: o.out_time,
          inDate: o.in_date,
          inTime: o.in_time,
          contactNumber: '',
          parentContact: '',
          purpose: o.purpose,
          hostelId: '',
          floorId: '',
          roomNumber: o.room_no,
          isHosteler: true,
          status: 'pending',
          createdAt: o.out_date,
          updatedAt: o.out_date,
        }))

        setOutpasses(mapped)
      } catch (err) {
        toast.error("Failed to load outpasses")
      }
    }

    load()
  }, [])

  const handleRowClick = async (row: OutpassRequest) => {
    try {
      const detail = await wardenApi.getRequestDetail('outpass', Number(row.id))
      setSelectedRequest(detail)
      setModalOpen(true)
    } catch {
      toast.error("Failed to load detail")
    }
  }

  const handleApprove = async (id: string, comment?: string) => {
    try {
      await wardenApi.reviewRequest(Number(id), "APPROVED", comment)
      setOutpasses(prev => prev.filter(r => r.id !== id))
      toast.success("Outpass approved")
    } catch {
      toast.error("Approval failed")
    }
  }

  const handleReject = async (id: string, comment?: string) => {
    try {
      await wardenApi.reviewRequest(Number(id), "REJECTED", comment)
      setOutpasses(prev => prev.filter(r => r.id !== id))
      toast.success("Outpass rejected")
    } catch {
      toast.error("Rejection failed")
    }
  }

  const columns = [
    {
      key: 'studentName',
      header: 'Student',
      render: (row: OutpassRequest) => (
        <div>
          <p className="font-medium">{row.studentName}</p>
          <p className="text-xs text-muted-foreground">{row.rollNumber}</p>
        </div>
      ),
    },
    {
      key: 'room',
      header: 'Room',
      render: (row: OutpassRequest) => row.roomNumber,
    },
    {
      key: 'outDate',
      header: 'Out Date',
      render: (row: OutpassRequest) => format(new Date(row.outDate), 'PP'),
    },
    {
      key: 'purpose',
      header: 'Purpose',
      render: (row: OutpassRequest) => row.purpose,
    },
  ]

  return (
    <DashboardLayout>
      <PageHeader
        title="Pending Outpasses"
        description="HOD-approved outpasses awaiting warden approval"
      />

      <DataTable
        data={outpasses}
        columns={columns}
        searchPlaceholder="Search by student name..."
        searchKey="studentName"
        onRowClick={handleRowClick}
        emptyMessage="No pending outpasses"
      />

      <RequestDetailModal
        request={selectedRequest}
        open={modalOpen}
        onOpenChange={setModalOpen}
        showActions
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </DashboardLayout>
  )
}
