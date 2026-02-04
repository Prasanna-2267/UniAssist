import React from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { advisorApi } from "@/services/advisorApi";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  ArrowRight,
} from "lucide-react";

export default function AdvisorDashboard() {
  const { user } = useAuth();

  const [stats, setStats] = React.useState<any>({});
  const [breakdown, setBreakdown] = React.useState<any>({});
  const [preview, setPreview] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    Promise.all([
      advisorApi.getDashboardStats(),
      advisorApi.getRequestBreakdown(),
      advisorApi.getPendingPreview(),
    ])
      .then(([statsData, breakdownData, previewData]) => {
        setStats(statsData);
        setBreakdown(breakdownData);
        setPreview(previewData);
      })
      .catch(() => toast.error("Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, []);

  const requestTypes = [
    { label: "Leave", value: breakdown.leave || 0, color: "bg-primary" },
    { label: "Bonafide", value: breakdown.bonafide || 0, color: "bg-accent" },
    { label: "Outpass", value: breakdown.outpass || 0, color: "bg-pending" },
    { label: "OD", value: breakdown.od || 0, color: "bg-in-progress" },
  ];

  return (
    <DashboardLayout>
      <PageHeader
        title={`Welcome, ${user?.name}!`}
        description="Review and approve student requests"
      />

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard title="Total Requests" value={stats.total || 0} icon={FileText} color="primary" />
        <StatCard title="Pending" value={stats.pending || 0} icon={Clock} color="pending" />
        <StatCard title="Approved" value={stats.approved || 0} icon={CheckCircle} color="approved" />
        <StatCard title="Rejected" value={stats.rejected || 0} icon={XCircle} color="rejected" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pending Preview */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Pending Requests</CardTitle>
              <CardDescription>Requests awaiting your approval</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/advisor/pending" className="gap-1">
                View All <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>

          <CardContent>
            <div className="space-y-3">
              {preview.map((req) => (
                <div
                  key={`${req.type}-${req.id}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-pending/10">
                      <Clock className="h-4 w-4 text-pending" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {req.type} - {req.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {req.dt ? format(new Date(req.dt), "PPP") : "-"}
                      </p>
                    </div>
                  </div>
                  <span className="status-badge status-pending">Pending</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Request Type Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Request Types</CardTitle>
            <CardDescription>Breakdown by category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {requestTypes.map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <div className={`h-3 w-3 rounded-full ${item.color}`} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{item.label}</span>
                      <span className="text-sm text-muted-foreground">
                        {item.value} pending
                      </span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${item.color}`}
                        style={{
                          width: `${
                            stats.pending
                              ? (item.value / stats.pending) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
