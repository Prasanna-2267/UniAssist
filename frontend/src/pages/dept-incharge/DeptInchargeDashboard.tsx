import React from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { 
  AlertCircle, 
  Clock, 
  CheckCircle, 
  ArrowRight,
  Loader
} from 'lucide-react';

const mockStats = {
  total: 12,
  open: 3,
  inProgress: 4,
  resolved: 5,
};

const recentComplaints = [
  { id: '1', text: 'WiFi not working in Block C', student: 'John Doe', status: 'open' },
  { id: '2', text: 'AC maintenance required in lab', student: 'Alice Johnson', status: 'in_progress' },
  { id: '3', text: 'Projector issue in Room 201', student: 'Bob Smith', status: 'open' },
];

export default function DeptInchargeDashboard() {
  const { user } = useAuth();

  return (
    <DashboardLayout>
      <PageHeader 
        title={`Welcome, ${user?.name?.split(' ')[0]}!`}
        description="Manage and resolve student complaints"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard 
          title="Total Complaints" 
          value={mockStats.total} 
          icon={AlertCircle} 
          color="primary" 
        />
        <StatCard 
          title="Open" 
          value={mockStats.open} 
          icon={Clock} 
          color="pending" 
        />
        <StatCard 
          title="In Progress" 
          value={mockStats.inProgress} 
          icon={Loader} 
          color="in-progress" 
        />
        <StatCard 
          title="Resolved" 
          value={mockStats.resolved} 
          icon={CheckCircle} 
          color="approved" 
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Complaints</CardTitle>
              <CardDescription>Complaints needing attention</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dept-incharge/complaints" className="gap-1">
                View All <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentComplaints.map((complaint) => (
                <div 
                  key={complaint.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-md ${complaint.status === 'open' ? 'bg-pending/10' : 'bg-in-progress/10'}`}>
                      <AlertCircle className={`h-4 w-4 ${complaint.status === 'open' ? 'text-pending' : 'text-in-progress'}`} />
                    </div>
                    <div>
                      <p className="font-medium text-sm truncate max-w-[200px]">{complaint.text}</p>
                      <p className="text-xs text-muted-foreground">{complaint.student}</p>
                    </div>
                  </div>
                  <span className={`status-badge status-${complaint.status.replace('_', '-')}`}>
                    {complaint.status === 'in_progress' ? 'In Progress' : 'Open'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status Overview</CardTitle>
            <CardDescription>Complaint resolution workflow</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-pending/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-pending" />
                </div>
                <div>
                  <p className="font-medium">Open</p>
                  <p className="text-xs text-muted-foreground">New complaints awaiting action</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-in-progress/10 flex items-center justify-center">
                  <Loader className="h-5 w-5 text-in-progress" />
                </div>
                <div>
                  <p className="font-medium">In Progress</p>
                  <p className="text-xs text-muted-foreground">Currently being addressed</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-approved/10 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-approved" />
                </div>
                <div>
                  <p className="font-medium">Resolved</p>
                  <p className="text-xs text-muted-foreground">Successfully resolved</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
