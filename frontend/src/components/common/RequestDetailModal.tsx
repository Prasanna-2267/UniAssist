import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from './StatusBadge';
import { Request, ComplaintStatus } from '@/types';
import { format } from 'date-fns';
import {
  FileText,
  Calendar,
  Clock,
  User,
  MapPin,
  Phone,
  Building,
} from 'lucide-react';

interface RequestDetailModalProps {
  request: Request | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showActions?: boolean;
  onApprove?: (id: string, comment?: string) => void;
  onReject?: (id: string, comment?: string) => void;
  onUpdateStatus?: (id: string, status: ComplaintStatus, comment?: string) => void;
}

export function RequestDetailModal({
  request,
  open,
  onOpenChange,
  showActions,
  onApprove,
  onReject,
  onUpdateStatus,
}: RequestDetailModalProps) {
  const [comment, setComment] = React.useState('');

  if (!request) return null;

  // 🔥 UNIVERSAL NORMALIZER (handles backend inconsistencies)
  const normalized = {
    id: request.id,
    type: request.type?.toLowerCase(),
    status: request.status?.toLowerCase(),

    studentName: (request as any).studentname || (request as any).name,
    rollNumber: (request as any).rollnumber || (request as any).rollNo || (request as any).rollno,
    department: request.department,

    createdAt: (request as any).createdAt || (request as any).submittedAt || (request as any).createdat || (request as any).submittedat,

    // Outpass
    outDate: (request as any).outDate || (request as any).outdate,
    outTime: (request as any).outTime || (request as any).outtime,
    inDate: (request as any).inDate || (request as any).indate,
    inTime: (request as any).inTime || (request as any).intime,
    contactNumber: (request as any).contactNumber || (request as any).contactnumber,
    parentContact: (request as any).parentContact || (request as any).parentcontact,
    roomNumber: (request as any).roomNumber || (request as any).room_no || (request as any).roomnumber,

    // Bonafide
    category: (request as any).category,
    purpose: (request as any).purpose,

    // OD
    fromDate: (request as any).fromDate || (request as any).fromdate,
    toDate: (request as any).toDate || (request as any).todate,
    startTime: (request as any).startTime || (request as any).starttime,
    endTime: (request as any).endTime || (request as any).endtime,
    place: (request as any).place,
  };

  const safeFormat = (date?: string, type: 'date' | 'datetime' = 'date') => {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    return type === 'date' ? format(d, 'PPP') : format(d, 'PPp');
  };

  const handleAction = (action: 'approve' | 'reject' | ComplaintStatus) => {
    if (action === 'approve' && onApprove) onApprove(request.id, comment);
    else if (action === 'reject' && onReject) onReject(request.id, comment);
    else if (onUpdateStatus) onUpdateStatus(request.id, action as ComplaintStatus, comment);

    setComment('');
    onOpenChange(false);
  };

  const renderDetails = () => {
    switch (normalized.type) {
      case 'leave':
        return (
          <>
            <DetailRow icon={Calendar} label="Start Date" value={safeFormat((request as any).startdate)} />
            <DetailRow icon={Calendar} label="End Date" value={safeFormat((request as any).enddate)} />
            <DetailRow icon={FileText} label="Category" value={normalized.category} />
            {(request as any).reason && (
              <DetailRow icon={FileText} label="Reason" value={(request as any).reason} />
            )}
          </>
        );

      case 'bonafide':
        return (
          <>
            <DetailRow icon={FileText} label="Category" value={normalized.category} />
            <DetailRow icon={FileText} label="Purpose" value={normalized.purpose} />
          </>
        );

      case 'outpass':
        return (
          <>
            <DetailRow icon={Calendar} label="Out Date" value={safeFormat(normalized.outDate)} />
            <DetailRow icon={Clock} label="Out Time" value={normalized.outTime} />
            <DetailRow icon={Phone} label="Contact" value={normalized.contactNumber} />
            <DetailRow icon={Phone} label="Parent Contact" value={normalized.parentContact} />
            <DetailRow icon={FileText} label="Purpose" value={normalized.purpose} />
            <DetailRow icon={Building} label="Room" value={normalized.roomNumber} />
          </>
        );

      case 'od':
        return (
          <>
            <DetailRow icon={Calendar} label="From Date" value={safeFormat(normalized.fromDate)} />
            <DetailRow icon={Calendar} label="To Date" value={safeFormat(normalized.toDate)} />
            <DetailRow icon={Clock} label="Start Time" value={normalized.startTime} />
            <DetailRow icon={Clock} label="End Time" value={normalized.endTime} />
            <DetailRow icon={MapPin} label="Place" value={normalized.place} />
            <DetailRow icon={FileText} label="Purpose" value={normalized.purpose} />
          </>
        );

      case 'complaint':
        return <DetailRow icon={FileText} label="Complaint" value={(request as any).text} />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="capitalize">{normalized.type} Request</span>
            <StatusBadge status={normalized.status as any} />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-muted/50 p-4">
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <User className="h-4 w-4" />
              Student Information
            </h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Name:</span>
              <span>{normalized.studentName || '-'}</span>
              <span className="text-muted-foreground">Roll No:</span>
              <span>{normalized.rollNumber || '-'}</span>
              <span className="text-muted-foreground">Department:</span>
              <span>{normalized.department || '-'}</span>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium">Request Details</h4>
            {renderDetails()}
            <DetailRow icon={Clock} label="Submitted" value={safeFormat(normalized.createdAt, 'datetime')} />
          </div>

          {showActions && normalized.status === 'pending' && (
            <div className="space-y-3 pt-4 border-t">
              <Textarea
                placeholder="Add a comment (optional)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <div className="flex gap-2">
                <Button className="flex-1 bg-approved hover:bg-approved/90" onClick={() => handleAction('approve')}>
                  Approve
                </Button>
                <Button variant="destructive" className="flex-1" onClick={() => handleAction('reject')}>
                  Reject
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5" />
      <div className="flex-1">
        <span className="text-muted-foreground">{label}:</span>
        <span className="ml-2">{value || '-'}</span>
      </div>
    </div>
  );
}
