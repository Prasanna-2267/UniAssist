import React from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable } from '@/components/common/DataTable';
import { StatusBadge } from '@/components/common/StatusBadge';
import { RequestDetailModal } from '@/components/common/RequestDetailModal';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { advisorApi } from '@/services/advisorApi';

export default function AdvisorHistory() {
  const [requests, setRequests] = React.useState<any[]>([]);
  const [selectedRequest, setSelectedRequest] = React.useState<any | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

const filterOptions = [
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
];


React.useEffect(() => {
  advisorApi.getLeaveHistory()
    .then((data) => {
      const merged = [
        ...data.leaves,
        ...data.bonafides,
        ...data.outpasses,
        ...data.ods,
      ];

      setRequests(merged);
    })
    .catch(() => toast.error("Failed to load history"))
    .finally(() => setLoading(false));
}, []);


  const handleRowClick = (request: any) => {
    setSelectedRequest(request);
    setModalOpen(true);
  };

  const columns = [
  {
    key: 'name',
    header: 'Student',
    render: (row: any) => (
      <div>
        <p className="font-medium">{row.name}</p>
        <p className="text-xs text-muted-foreground">{row.reg_no}</p>
      </div>
    ),
  },
  {
    key: 'type',
    header: 'Type',
    render: (row: any) => (
      <span className="font-medium">{row.type}</span>
    ),
  },
  {
    key: 'reviewed_at',
    header: 'Reviewed On',
    render: (row: any) =>
      row.reviewed_at ? format(new Date(row.reviewed_at), 'PP') : '-',
  },
  {
    key: 'status',
    header: 'Status',
    render: (row: any) => <StatusBadge status={row.status.toLowerCase()} />,
  },
];


  return (
    <DashboardLayout>
      <PageHeader
        title="Leave Request History"
        description="Requests you have reviewed"
      />

      <DataTable
  data={requests}
  columns={columns}
  searchPlaceholder="Search by student name..."
  searchKey="name"
  filterOptions={filterOptions}
  filterKey="status"
  onRowClick={handleRowClick}
  emptyMessage={loading ? "Loading..." : "No history found"}
/>


      <RequestDetailModal
        request={selectedRequest}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </DashboardLayout>
  );
}
