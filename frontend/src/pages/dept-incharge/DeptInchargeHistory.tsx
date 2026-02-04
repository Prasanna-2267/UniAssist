import React from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable } from '@/components/common/DataTable';
import { StatusBadge } from '@/components/common/StatusBadge';
import { RequestDetailModal } from '@/components/common/RequestDetailModal';
import { Complaint } from '@/types';
import { format } from 'date-fns';

const mockHistory: Complaint[] = [
  {
    id: '70',
    type: 'complaint',
    studentId: 'student-34',
    studentName: 'Emily Davis',
    studentEmail: 'emily@college.edu',
    rollNumber: 'CS2024006',
    department: 'Computer Science',
    text: 'Library computers are running very slow. Need maintenance.',
    status: 'resolved',
    resolvedAt: '2024-01-10T16:00:00Z',
    createdAt: '2024-01-08T10:00:00Z',
    updatedAt: '2024-01-10T16:00:00Z',
  },
  {
    id: '71',
    type: 'complaint',
    studentId: 'student-35',
    studentName: 'Frank Wilson',
    studentEmail: 'frank@college.edu',
    rollNumber: 'CS2024007',
    department: 'Computer Science',
    text: 'Broken chair in seminar hall needs replacement.',
    file: '/uploads/chair-photo.jpg',
    fileName: 'chair-photo.jpg',
    status: 'resolved',
    resolvedAt: '2024-01-05T14:00:00Z',
    createdAt: '2024-01-03T09:00:00Z',
    updatedAt: '2024-01-05T14:00:00Z',
  },
  {
    id: '72',
    type: 'complaint',
    studentId: 'student-36',
    studentName: 'Grace Lee',
    studentEmail: 'grace@college.edu',
    rollNumber: 'CS2024008',
    department: 'Computer Science',
    text: 'Printer in computer lab is out of paper frequently.',
    status: 'resolved',
    resolvedAt: '2024-01-02T11:00:00Z',
    createdAt: '2024-01-01T15:00:00Z',
    updatedAt: '2024-01-02T11:00:00Z',
  },
];

export default function DeptInchargeHistory() {
  const [selectedComplaint, setSelectedComplaint] = React.useState<Complaint | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);

  const handleRowClick = (complaint: Complaint) => {
    setSelectedComplaint(complaint);
    setModalOpen(true);
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
      key: 'resolvedAt',
      header: 'Resolved On',
      render: (row: Complaint) => row.resolvedAt ? format(new Date(row.resolvedAt), 'PP') : '-',
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: Complaint) => <StatusBadge status={row.status} />,
    },
  ];

  return (
    <DashboardLayout>
      <PageHeader 
        title="Complaint History"
        description="View all resolved complaints"
      />

      <DataTable
        data={mockHistory}
        columns={columns}
        searchPlaceholder="Search by student name or complaint..."
        searchKey="text"
        onRowClick={handleRowClick}
        emptyMessage="No resolved complaints"
      />

      <RequestDetailModal
        request={selectedComplaint}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </DashboardLayout>
  );
}
