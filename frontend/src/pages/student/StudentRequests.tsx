import React from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable } from '@/components/common/DataTable';
import { StatusBadge } from '@/components/common/StatusBadge';
import { RequestDetailModal } from '@/components/common/RequestDetailModal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Request } from '@/types';
import { format } from 'date-fns';
import { studentApi } from "@/services/studentApi";


export default function StudentRequests() {
  const [requests, setRequests] = React.useState<Request[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedRequest, setSelectedRequest] = React.useState<Request | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);

  // 🔥 Load from backend
  React.useEffect(() => {
  const loadRequests = async () => {
    try {
      const data = await studentApi.getStudentRequests();

      const normalized = data.map((r: any) => ({
        id: r.id,
        type: r.type.toLowerCase(),          // FIX 1
        createdAt: r.created_at,             // FIX 2
        status: r.status.toLowerCase(),      // FIX 3
      }));

      setRequests(normalized);
    } catch (err) {
      console.error("Failed to fetch requests", err);
    } finally {
      setLoading(false);
    }
  };

  loadRequests();
}, []);

  const handleRowClick = async (request: Request) => {
  try {
    const detail = await studentApi.getRequestDetail(request.type, request.id);
    setSelectedRequest(detail);   // FULL backend data
    setModalOpen(true);
  } catch (err) {
    console.error("Failed to load request detail", err);
  }
};


  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      leave: 'Leave',
      bonafide: 'Bonafide',
      outpass: 'Outpass',
      od: 'OD',
      complaint: 'Complaint',
    };
    return labels[type] || type;
  };

  const columns = [
    {
      key: 'type',
      header: 'Type',
      render: (row: Request) => (
        <span className="font-medium capitalize">
          {getTypeLabel(row.type)}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Date',
      render: (row: Request) => {
    if (!row.createdAt) return "—";

    const date = new Date(row.createdAt);
    return isNaN(date.getTime()) ? "—" : format(date, 'PP');
  },
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: Request) => <StatusBadge status={row.status} />,
    },
  ];

  const filterOptions = [
    { label: 'Pending', value: 'pending' },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
  ];

  const filterByType = (type: string) => {
    if (type === 'all') return requests;
    return requests.filter(r => r.type === type);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <PageHeader title="My Requests" description="Loading requests..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="My Requests"
        description="Track all your submitted requests"
      />

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="all">All ({requests.length})</TabsTrigger>
          <TabsTrigger value="leave">Leave ({filterByType('leave').length})</TabsTrigger>
          <TabsTrigger value="bonafide">Bonafide ({filterByType('bonafide').length})</TabsTrigger>
          <TabsTrigger value="outpass">Outpass ({filterByType('outpass').length})</TabsTrigger>
          <TabsTrigger value="od">OD ({filterByType('od').length})</TabsTrigger>
          <TabsTrigger value="complaint">Complaints ({filterByType('complaint').length})</TabsTrigger>
        </TabsList>

        {['all', 'leave', 'bonafide', 'outpass', 'od', 'complaint'].map((type) => (
          <TabsContent key={type} value={type}>
            <DataTable
              data={filterByType(type)}
              columns={columns}
              searchPlaceholder="Search requests..."
              searchKey="type"
              filterOptions={filterOptions}
              filterKey="status"
              onRowClick={handleRowClick}
              emptyMessage="No requests found"
            />
          </TabsContent>
        ))}
      </Tabs>

      <RequestDetailModal
        request={selectedRequest}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </DashboardLayout>
  );
}
