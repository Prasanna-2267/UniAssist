import React from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable } from '@/components/common/DataTable';
import { StatusBadge } from '@/components/common/StatusBadge';
import { RequestDetailModal } from '@/components/common/RequestDetailModal';
import { Complaint, ComplaintStatus } from '@/types';
import { format } from 'date-fns';
import { toast } from 'sonner';

// Mock complaints
const mockComplaints: Complaint[] = [
  {
    id: '60',
    type: 'complaint',
    studentId: 'student-30',
    studentName: 'John Doe',
    studentEmail: 'john@college.edu',
    rollNumber: 'CS2024001',
    department: 'Computer Science',
    text: 'WiFi connectivity is very poor in Block C. Unable to access online resources for study.',
    status: 'open',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },
  {
    id: '61',
    type: 'complaint',
    studentId: 'student-31',
    studentName: 'Alice Johnson',
    studentEmail: 'alice@college.edu',
    rollNumber: 'CS2024002',
    department: 'Computer Science',
    text: 'The AC in Computer Lab 3 is not working properly. Temperature is too high for comfortable study.',
    file: '/uploads/ac-photo.jpg',
    fileName: 'ac-photo.jpg',
    status: 'in_progress',
    createdAt: '2024-01-14T09:00:00Z',
    updatedAt: '2024-01-14T14:00:00Z',
  },
  {
    id: '62',
    type: 'complaint',
    studentId: 'student-32',
    studentName: 'Bob Smith',
    studentEmail: 'bob@college.edu',
    rollNumber: 'CS2024003',
    department: 'Computer Science',
    text: 'Projector in Room 201 is not displaying colors correctly. Makes it difficult to follow presentations.',
    status: 'open',
    createdAt: '2024-01-14T11:00:00Z',
    updatedAt: '2024-01-14T11:00:00Z',
  },
  {
    id: '63',
    type: 'complaint',
    studentId: 'student-33',
    studentName: 'Carol White',
    studentEmail: 'carol@college.edu',
    rollNumber: 'CS2024004',
    department: 'Computer Science',
    text: 'Water cooler in ground floor is not working. Students have to go to other floors for drinking water.',
    status: 'in_progress',
    createdAt: '2024-01-13T15:00:00Z',
    updatedAt: '2024-01-14T10:00:00Z',
  },
];

export default function DeptInchargeComplaints() {
  const [complaints, setComplaints] = React.useState(mockComplaints);
  const [selectedComplaint, setSelectedComplaint] = React.useState<Complaint | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);

  const handleRowClick = (complaint: Complaint) => {
    setSelectedComplaint(complaint);
    setModalOpen(true);
  };

  const handleUpdateStatus = (id: string, status: ComplaintStatus, comment?: string) => {
    setComplaints(prev => 
      prev.map(c => c.id === id ? { ...c, status, updatedAt: new Date().toISOString() } : c)
    );
    
    if (status === 'resolved') {
      toast.success('Complaint marked as resolved');
    } else if (status === 'in_progress') {
      toast.success('Complaint marked as in progress');
    }
  };

  const columns = [
    {
      key: 'studentName',
      header: 'Student',
      render: (row: Complaint) => (
        <div>
          <p className="font-medium">{row.studentName}</p>
          <p className="text-xs text-muted-foreground">{row.rollNumber}</p>
        </div>
      ),
    },
    {
      key: 'text',
      header: 'Complaint',
      render: (row: Complaint) => (
        <span className="text-sm truncate max-w-[300px] block">{row.text}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Date',
      render: (row: Complaint) => format(new Date(row.createdAt), 'PP'),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: Complaint) => <StatusBadge status={row.status} />,
    },
  ];

  const filterOptions = [
    { label: 'Open', value: 'open' },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'Resolved', value: 'resolved' },
  ];

  const activeComplaints = complaints.filter(c => c.status !== 'resolved');

  return (
    <DashboardLayout>
      <PageHeader 
        title="Complaints"
        description="Manage and resolve student complaints"
      />

      <DataTable
        data={activeComplaints}
        columns={columns}
        searchPlaceholder="Search by student name or complaint..."
        searchKey="text"
        filterOptions={filterOptions}
        filterKey="status"
        onRowClick={handleRowClick}
        emptyMessage="No active complaints"
      />

      <RequestDetailModal
        request={selectedComplaint}
        open={modalOpen}
        onOpenChange={setModalOpen}
        showActions
        onUpdateStatus={handleUpdateStatus}
      />
    </DashboardLayout>
  );
}
