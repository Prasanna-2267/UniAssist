import React from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { RequestDetailModal } from "@/components/common/RequestDetailModal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { toast } from "sonner";
import { advisorApi } from "@/services/advisorApi";

export default function AdvisorPending() {
  const [requests, setRequests] = React.useState<any[]>([]);
  const [selectedRequest, setSelectedRequest] = React.useState<any | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

React.useEffect(() => {
  advisorApi
    .getPendingAll()
    .then((data) => {
      const merged = [
        ...data.leaves.map((r: any) => ({
          ...r,
          type: "leave",
          studentName: r.name,
          rollNumber: r.reg_no,
          department: r.department || "CSE",
          created_at: r.created_at,
          status: "pending",
        })),
        ...data.bonafides.map((r: any) => ({
          ...r,
          type: "bonafide",
          studentName: r.name,
          rollNumber: r.reg_no,
          department: r.department || "CSE",
          created_at: r.created_at,
          status: "pending",
        })),
        ...data.outpasses.map((r: any) => ({
          ...r,
          type: "outpass",
          studentName: r.name,
          rollNumber: r.reg_no,
          department: r.department || "CSE",
          created_at: r.created_at,
          status: "pending",
        })),
        ...data.ods.map((r: any) => ({
          ...r,
          type: "od",
          studentName: r.name,
          rollNumber: r.reg_no,
          department: r.department || "CSE",
          created_at: r.created_at,
          status: "pending",
        })),
      ];

      setRequests(merged);
    })
    .catch(() => toast.error("Failed to load pending requests"))
    .finally(() => setLoading(false));
}, []);


  const handleRowClick = (request: any) => {
    setSelectedRequest(request);
    setModalOpen(true);
  };

  const handleApprove = async (comment?: string) => {
    if (!selectedRequest) return;
    try {
      await advisorApi.reviewRequest(
        selectedRequest.type,
        selectedRequest.request_id,
        "APPROVED",
        comment
      );
      setRequests((prev) =>
        prev.filter((r) => r.request_id !== selectedRequest.request_id)
      );
      setModalOpen(false);
      toast.success("Request approved");
    } catch {
      toast.error("Failed to approve");
    }
  };

  const handleReject = async (comment?: string) => {
    if (!selectedRequest) return;
    try {
      await advisorApi.reviewRequest(
        selectedRequest.type,
        selectedRequest.request_id,
        "REJECTED",
        comment
      );
      setRequests((prev) =>
        prev.filter((r) => r.request_id !== selectedRequest.request_id)
      );
      setModalOpen(false);
      toast.success("Request rejected");
    } catch {
      toast.error("Failed to reject");
    }
  };

  const columns = [
    {
      key: "studentName",
      header: "Student",
      render: (row: any) => (
        <div>
          <p className="font-medium">{row.studentName}</p>
          <p className="text-xs text-muted-foreground">{row.rollNumber}</p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (row: any) => (
        <span className="font-medium capitalize">{row.type.toLowerCase()}</span>
      ),
    },
    {
      key: "created_at",
      header: "Applied On",
      render: (row: any) =>
        {
    const date =
      row.created_at ||
      row.applied_at ||
      row.start_date ||
      row.out_date ||
      row.from_date;

    return date ? format(new Date(date), "PP") : "-";
  },
    },
    {
      key: "status",
      header: "Status",
      render: () => <StatusBadge status="pending" />,
    },
  ];

  return (
    <DashboardLayout>
      <PageHeader
        title="Pending Requests"
        description="Review and approve student applications"
      />

      <Tabs defaultValue="all">
        <TabsList className="mb-4">
          <TabsTrigger value="all">All ({requests.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          {loading ? (
            <p className="text-center py-10">Loading...</p>
          ) : (
            <DataTable
              data={requests}
              columns={columns}
              searchPlaceholder="Search by student name..."
              searchKey="name"
              onRowClick={handleRowClick}
              emptyMessage="No pending requests"
            />
          )}
        </TabsContent>
      </Tabs>

      <RequestDetailModal
        request={selectedRequest}
        open={modalOpen}
        onOpenChange={setModalOpen}
        showActions
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </DashboardLayout>
  );
}
