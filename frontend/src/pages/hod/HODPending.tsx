import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable } from '@/components/common/DataTable';
import { StatusBadge } from '@/components/common/StatusBadge';
import { RequestDetailModal } from '@/components/common/RequestDetailModal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { hodApi } from '@/services/hodApi';

type HODPendingRequest = {
  id: string;
  type: string;
  studentName: string;
  rollNumber: string;
  department: string;
  createdAt: string;
  advisorStatus: "approved";
  status: "pending";
};

export default function HODPending() {
  const [requests, setRequests] = useState<HODPendingRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<HODPendingRequest | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // 🔥 LOAD FROM BACKEND
  useEffect(() => {
    const load = async () => {
      try {
        const data = await hodApi.getPendingAll();

        const mapped: HODPendingRequest[] = (Array.isArray(data) ? data : []).map((r: any) => ({
          id: String(r.id),
          type: r.type.toLowerCase(),
          studentName: r.name,
          rollNumber: r.reg_no,
          department: r.department || 'CSE',
          createdAt: r.dt,
          advisorStatus: 'approved',
          status: 'pending',
        }));

        setRequests(mapped);
      } catch (err) {
        console.error(err);
        toast.error('Failed to load requests');
      }
    };

    load();
  }, []);

  const handleRowClick = (request: HODPendingRequest) => {
    setSelectedRequest(request);
    setModalOpen(true);
  };

  const handleApprove = async (id: string, comment?: string) => {
    try {
      const req = requests.find(r => r.id === id);
      if (!req) return;

      await hodApi.reviewRequest(req.type, Number(id), "APPROVED", comment);
      setRequests(prev => prev.filter(r => r.id !== id));
      toast.success('Request approved successfully');
    } catch (err) {
      console.error(err);
      toast.error('Approval failed');
    }
  };

  const handleReject = async (id: string, comment?: string) => {
    try {
      const req = requests.find(r => r.id === id);
      if (!req) return;

      await hodApi.reviewRequest(req.type, Number(id), "REJECTED", comment);
      setRequests(prev => prev.filter(r => r.id !== id));
      toast.success('Request rejected');
    } catch (err) {
      console.error(err);
      toast.error('Rejection failed');
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      bonafide: 'Bonafide',
      outpass: 'Outpass',
      od: 'OD',
    };
    return labels[type] || type;
  };

  const columns = [
    {
      key: 'studentName',
      header: 'Student',
      render: (row: HODPendingRequest) => (
        <div>
          <p className="font-medium">{row.studentName}</p>
          <p className="text-xs text-muted-foreground">{row.rollNumber}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (row: HODPendingRequest) => (
        <span className="font-medium capitalize">{getTypeLabel(row.type)}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Date',
      render: (row: HODPendingRequest) =>
        format(new Date(row.createdAt), 'PP'),
    },
    {
      key: 'advisorStatus',
      header: 'Advisor',
      render: () => <StatusBadge status="approved" />,
    },
  ];

  const filterByType = (type: string) => {
    if (type === 'all') return requests;
    return requests.filter(r => r.type === type);
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Pending Requests"
        description="Advisor-approved requests awaiting your approval"
      />

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="all">All ({requests.length})</TabsTrigger>
          <TabsTrigger value="bonafide">Bonafide ({filterByType('bonafide').length})</TabsTrigger>
          <TabsTrigger value="outpass">Outpass ({filterByType('outpass').length})</TabsTrigger>
          <TabsTrigger value="od">OD ({filterByType('od').length})</TabsTrigger>
        </TabsList>

        {['all', 'bonafide', 'outpass', 'od'].map((type) => (
          <TabsContent key={type} value={type}>
            <DataTable<HODPendingRequest>
              data={filterByType(type)}
              columns={columns}
              searchPlaceholder="Search by student name..."
              searchKey="studentName"
              onRowClick={handleRowClick}
              emptyMessage="No pending requests"
            />
          </TabsContent>
        ))}
      </Tabs>

      <RequestDetailModal
        request={selectedRequest as any} 
        open={modalOpen}
        onOpenChange={setModalOpen}
        showActions
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </DashboardLayout>
  );
}
