import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { studentApi } from '@/services/studentApi';
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  FilePlus,
  ClipboardList,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';

const quickActions = [
  { label: 'Apply Leave', href: '/student/leave', icon: FilePlus, color: 'bg-primary' },
  { label: 'Apply Bonafide', href: '/student/bonafide', icon: FileText, color: 'bg-accent' },
  { label: 'Apply Outpass', href: '/student/outpass', icon: ClipboardList, color: 'bg-pending' },
  { label: 'Apply OD', href: '/student/od', icon: Clock, color: 'bg-in-progress' },
  { label: 'Raise Complaint', href: '/student/complaint', icon: AlertCircle, color: 'bg-destructive' },
];

export default function StudentDashboard() {
  const { user } = useAuth();

  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });

  const [recentRequests, setRecentRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const statsData = await studentApi.getDashboardStats();
        const recentData = await studentApi.getRecentRequests();

        setStats(statsData);
        setRecentRequests(recentData);
      } catch (err) {
        console.error("Dashboard load failed", err);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  return (
    <DashboardLayout>
      <PageHeader
        title={`Welcome, ${user?.name}!`}
        description="Manage your requests and track their status"
      />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard title="Total Requests" value={stats.total} icon={FileText} color="primary" />
        <StatCard title="Pending" value={stats.pending} icon={Clock} color="pending" />
        <StatCard title="Approved" value={stats.approved} icon={CheckCircle} color="approved" />
        <StatCard title="Rejected" value={stats.rejected} icon={XCircle} color="rejected" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Submit a new request</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {quickActions.map((action) => (
                <Link key={action.href} to={action.href}>
                  <Button variant="outline" className="w-full justify-start gap-3 h-auto py-3">
                    <div className={`p-2 rounded-md ${action.color}`}>
                      <action.icon className="h-4 w-4 text-white" />
                    </div>
                    <span>{action.label}</span>
                  </Button>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Requests */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Requests</CardTitle>
              <CardDescription>Your latest submissions</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/student/requests" className="gap-1">
                View All <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : (
                recentRequests.map((req) => (
                  <div key={req.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-md bg-primary/10">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{req.type} Request</p>
                        <p className="text-xs text-muted-foreground">{req.date}</p>
                      </div>
                    </div>
                    <span className={`status-badge status-${req.status.toLowerCase()}`}>
                      {req.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
