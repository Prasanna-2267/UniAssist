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
import { FileText, Calendar, Clock, User, MapPin, Phone, Building } from 'lucide-react';

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

  /* 🔥 UNIVERSAL FIELD NORMALIZATION (NO LOGIC CHANGE) */
  const studentName = request.studentName || (request as any).name;
  const rollNumber = request.rollNumber || (request as any).rollNo;
  const createdAt = request.createdAt || (request as any).submittedAt;
  /* SAFE DATE FORMATTER */
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
    switch (request.type) {
      case 'leave':
        return (
          <>
            <DetailRow icon={Calendar} label="Start Date" value={safeFormat(request.startDate)} />
            <DetailRow icon={Calendar} label="End Date" value={safeFormat(request.endDate)} />
            <DetailRow icon={FileText} label="Category" value={request.category} />
            {request.reason && <DetailRow icon={FileText} label="Reason" value={request.reason} />}
          </>
        );

      case 'bonafide':
        return (
          <>
            <DetailRow icon={FileText} label="Category" value={request.category} />
            {request.purpose && <DetailRow icon={FileText} label="Purpose" value={request.purpose} />}
            {request.category === 'internship' && (
              <>
                <DetailRow icon={Calendar} label="Internship Start" value={safeFormat(request.internshipStartDate)} />
                <DetailRow icon={Calendar} label="Internship End" value={safeFormat(request.internshipEndDate)} />
              </>
            )}
          </>
        );

      case 'outpass':
        const contactNumber = request.contactNumber ?? request.contact;
        const parentContact = request.parentContact ?? request.parentMobile;
        return (
          <>
            <DetailRow icon={Calendar} label="Out Date" value={safeFormat(request.outDate)} />
            <DetailRow icon={Clock} label="Out Time" value={request.outTime} />
            {request.inDate && <DetailRow icon={Calendar} label="In Date" value={safeFormat(request.inDate)} />}
            {request.inTime && <DetailRow icon={Clock} label="In Time" value={request.inTime} />}
            <DetailRow icon={Phone} label="Contact" value={contactNumber} />
            <DetailRow icon={Phone} label="Parent Contact" value={parentContact} />
            <DetailRow icon={FileText} label="Purpose" value={request.purpose} />
            {request.isHosteler && (
              <>
                <DetailRow icon={Building} label="Hostel ID" value={request.hostelId} />
                <DetailRow icon={Building} label="Floor" value={request.floorId} />
                <DetailRow icon={Building} label="Room" value={request.roomNumber} />
              </>
            )}
          </>
        );

      case 'od':
        return (
          <>
            <DetailRow icon={Calendar} label="From Date" value={safeFormat(request.fromDate)} />
            <DetailRow icon={Calendar} label="To Date" value={safeFormat(request.toDate)} />
            <DetailRow icon={FileText} label="Purpose" value={request.purpose} />
            {request.startTime && <DetailRow icon={Clock} label="Start Time" value={request.startTime} />}
            {request.endTime && <DetailRow icon={Clock} label="End Time" value={request.endTime} />}
            {request.place && <DetailRow icon={MapPin} label="Place" value={request.place} />}
            {request.proofFile && (
              <DetailRow
                icon={FileText}
                label="Proof File"
                value={
                  <a href={request.proofFile} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {request.proofFileName}
                  </a>
                }
              />
            )}
          </>
        );

      case 'complaint':
        return (
          <>
            <DetailRow icon={FileText} label="Complaint" value={request.text} />
            {request.file && (
              <DetailRow
                icon={FileText}
                label="Attachment"
                value={
                  <a href={request.file} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {request.fileName}
                  </a>
                }
              />
            )}
          </>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="capitalize">{request.type} Request</span>
            <StatusBadge status={request.status} />
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
              <span>{studentName}</span>
              <span className="text-muted-foreground">Roll No:</span>
              <span>{rollNumber}</span>
              <span className="text-muted-foreground">Department:</span>
              <span>{request.department || 'CSE'}</span>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium">Request Details</h4>
            {renderDetails()}
            <DetailRow icon={Clock} label="Submitted" value={safeFormat(createdAt, 'datetime')} />
          </div>

          {showActions && request.status === 'pending' && (
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
