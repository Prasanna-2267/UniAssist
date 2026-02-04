import React, { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { PageHeader } from "@/components/common/PageHeader"
import { StatCard } from "@/components/common/StatCard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { wardenApi } from "@/services/wardenApi"

import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  ArrowRight,
  Building,
} from "lucide-react"

export default function WardenDashboard() {
  const { user } = useAuth()

  const [stats, setStats] = useState<any>(null)
  const [pendingPreview, setPendingPreview] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const statsRes = await wardenApi.getDashboardStats()
        const pendingRes = await wardenApi.getPendingPreview()

        setStats(statsRes)
        setPendingPreview(pendingRes)
      } catch (err) {
        console.error("Dashboard load failed", err)
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [])

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6">Loading dashboard...</div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <PageHeader
        title={`Welcome, ${user?.name?.split(" ")[0]}!`}
        description="Manage hosteler outpass requests"
      />

      {/* ================= STATS ================= */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title="Total Outpasses"
          value={stats?.total_outpasses ?? 0}
          icon={FileText}
          color="primary"
        />
        <StatCard
          title="Pending"
          value={stats?.pending ?? 0}
          icon={Clock}
          color="pending"
        />
        <StatCard
          title="Approved"
          value={stats?.approved ?? 0}
          icon={CheckCircle}
          color="approved"
        />
        <StatCard
          title="Rejected"
          value={stats?.rejected ?? 0}
          icon={XCircle}
          color="rejected"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">

        {/* ================= PENDING PREVIEW ================= */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Pending Outpasses</CardTitle>
              <CardDescription>
                HOD-approved outpasses for hostelers
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/warden/pending" className="gap-1">
                View All <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>

          <CardContent>
            <div className="space-y-3">
              {pendingPreview.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No pending outpasses 🎉
                </p>
              ) : (
                pendingPreview.map((request: any) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-md bg-pending/10">
                        <Building className="h-4 w-4 text-pending" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {request.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Room: {request.room_no}
                        </p>
                      </div>
                    </div>
                    <span className="status-badge status-pending">
                      Pending
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* ================= QUICK INFO ================= */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Info</CardTitle>
            <CardDescription>Warden responsibilities</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <h4 className="font-medium mb-2">Your Role</h4>
              <p className="text-sm text-muted-foreground">
                As Warden, you review and approve outpass requests for hosteler
                students after they have been approved by both the Class
                Advisor and HOD.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-muted/50">
              <h4 className="font-medium mb-2">Approval Flow</h4>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Student submits outpass request</li>
                <li>Class Advisor approves</li>
                <li>HOD approves</li>
                <li>Warden gives final approval (for hostelers)</li>
              </ol>
            </div>
          </CardContent>
        </Card>

      </div>
    </DashboardLayout>
  )
}
