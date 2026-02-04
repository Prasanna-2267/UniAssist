import React from 'react';
import { cn } from '@/lib/utils';
import { RequestStatus, ComplaintStatus } from '@/types';

interface StatusBadgeProps {
  status: RequestStatus | ComplaintStatus;
  className?: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'status-pending' },
  approved: { label: 'Approved', className: 'status-approved' },
  rejected: { label: 'Rejected', className: 'status-rejected' },
  open: { label: 'Open', className: 'status-open' },
  in_progress: { label: 'In Progress', className: 'status-in-progress' },
  resolved: { label: 'Resolved', className: 'status-resolved' },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, className: '' };

  return (
    <span className={cn('status-badge', config.className, className)}>
      {config.label}
    </span>
  );
}
