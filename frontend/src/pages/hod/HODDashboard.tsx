import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { FileText, Clock, CheckCircle, XCircle, ArrowRight } from 'lucide-react'
import { hodApi } from "@/services/hodApi"

export default function HODDashboard() {
  const { user } = useAuth()

  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  })

  const [recentPending, setRecentPending] = useState<any[]>([])
  const [breakdown, setBreakdown] = useState({
    bonafide: 0,
    outpass: 0,
    od: 0,
  })

  useEffect(() => {
    const loadData = async () => {
      try {
        const statsRes = await hodApi.getDashboardStats()
        setStats(statsRes)

        const preview = await hodApi.getPendingPreview()
        setRecentPending(Array.isArray(preview) ? preview : [])

        const breakdownRes = await hodApi.getRequestBreakdown()
        setBreakdown(breakdownRes)

      } catch (err) {
        console.error("HOD Dashboard Error:", err)
      }
    }

    loadData()
  }, [])

  return (
    <DashboardLayout>
      <PageHeader
        title={`Welcome, ${user?.name || "HOD"}!`}
        description="Review advisor-approved requests"
      />

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard title="Total Requests" value={stats.total} icon={FileText} color="primary" />
        <StatCard title="Pending" value={stats.pending} icon={Clock} color="pending" />
        <StatCard title="Approved" value={stats.approved} icon={CheckCircle} color="approved" />
        <StatCard title="Rejected" value={stats.rejected} icon={XCircle} color="rejected" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">

        {/* Pending Preview */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Pending Requests</CardTitle>
              <CardDescription>Advisor-approved requests for your review</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/hod/pending" className="gap-1">
                View All <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>

          <CardContent>
            <div className="space-y-3">
              {recentPending.length === 0 && (
                <p className="text-sm text-muted-foreground">No pending requests 🎉</p>
              )}

              {recentPending.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-pending/10">
                      <Clock className="h-4 w-4 text-pending" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{req.type} - {req.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {req.dt ? new Date(req.dt).toLocaleDateString() : "—"}
                      </p>
                    </div>
                  </div>
                  <span className="status-badge status-pending">Pending</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Type Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Request Types</CardTitle>
            <CardDescription>HOD approval required for</CardDescription>
          </CardHeader>

          <CardContent>
            <div className="space-y-4">
              {[
                { type: 'Bonafide', count: breakdown.bonafide, color: 'bg-accent' },
                { type: 'Outpass', count: breakdown.outpass, color: 'bg-pending' },
                { type: 'OD', count: breakdown.od, color: 'bg-in-progress' },
              ].map((item) => (
                <div key={item.type} className="flex items-center gap-3">
                  <div className={`h-3 w-3 rounded-full ${item.color}`} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{item.type}</span>
                      <span className="text-sm text-muted-foreground">
                        {item.count} pending
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              Note: Leave requests are handled by Class Advisor only
            </p>
          </CardContent>
        </Card>

      </div>
    </DashboardLayout>
  )
}
