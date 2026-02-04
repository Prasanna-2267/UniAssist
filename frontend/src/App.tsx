import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";

import LoginPage from "./pages/LoginPage";
import ForbiddenPage from "./pages/ForbiddenPage";
import NotFound from "./pages/NotFound";

// Student
import StudentDashboard from "./pages/student/StudentDashboard";
import LeaveForm from "./pages/student/LeaveForm";
import BonafideForm from "./pages/student/BonafideForm";
import OutpassForm from "./pages/student/OutpassForm";
import ODForm from "./pages/student/ODForm";
import ComplaintForm from "./pages/student/ComplaintForm";
import StudentRequests from "./pages/student/StudentRequests";

// Advisor
import AdvisorDashboard from "./pages/advisor/AdvisorDashboard";
import AdvisorPending from "./pages/advisor/AdvisorPending";
import AdvisorHistory from "./pages/advisor/AdvisorHistory";

// HOD
import HODDashboard from "./pages/hod/HODDashboard";
import HODPending from "./pages/hod/HODPending";
import HODHistory from "./pages/hod/HODHistory";

// Warden
import WardenDashboard from "./pages/warden/WardenDashboard";
import WardenPending from "./pages/warden/WardenPending";
import WardenHistory from "./pages/warden/WardenHistory";

// Dept
import DeptInchargeDashboard from "./pages/dept-incharge/DeptInchargeDashboard";
import DeptInchargeComplaints from "./pages/dept-incharge/DeptInchargeComplaints";
import DeptInchargeHistory from "./pages/dept-incharge/DeptInchargeHistory";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/AuthContext";
const queryClient = new QueryClient();
const App = () => (
  <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />

        {/* ❌ DELETE BrowserRouter from here */}

        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forbidden" element={<ForbiddenPage />} />

          {/* Student Routes */}
          <Route path="/student" element={<ProtectedRoute allowedRoles={['student']}><StudentDashboard /></ProtectedRoute>} />
          <Route path="/student/leave" element={<ProtectedRoute allowedRoles={['student']}><LeaveForm /></ProtectedRoute>} />
          <Route path="/student/bonafide" element={<ProtectedRoute allowedRoles={['student']}><BonafideForm /></ProtectedRoute>} />
          <Route path="/student/outpass" element={<ProtectedRoute allowedRoles={['student']}><OutpassForm /></ProtectedRoute>} />
          <Route path="/student/od" element={<ProtectedRoute allowedRoles={['student']}><ODForm /></ProtectedRoute>} />
          <Route path="/student/complaint" element={<ProtectedRoute allowedRoles={['student']}><ComplaintForm /></ProtectedRoute>} />
          <Route path="/student/requests" element={<ProtectedRoute allowedRoles={['student']}><StudentRequests /></ProtectedRoute>} />

          {/* Advisor Routes */}
          <Route path="/advisor" element={<ProtectedRoute allowedRoles={['advisor']}><AdvisorDashboard /></ProtectedRoute>} />
          <Route path="/advisor/pending" element={<ProtectedRoute allowedRoles={['advisor']}><AdvisorPending /></ProtectedRoute>} />
          <Route path="/advisor/history" element={<ProtectedRoute allowedRoles={['advisor']}><AdvisorHistory /></ProtectedRoute>} />

          {/* HOD Routes */}
          <Route path="/hod" element={<ProtectedRoute allowedRoles={['hod']}><HODDashboard /></ProtectedRoute>} />
          <Route path="/hod/pending" element={<ProtectedRoute allowedRoles={['hod']}><HODPending /></ProtectedRoute>} />
          <Route path="/hod/history" element={<ProtectedRoute allowedRoles={['hod']}><HODHistory /></ProtectedRoute>} />

          {/* Warden Routes */}
          <Route path="/warden" element={<ProtectedRoute allowedRoles={['warden']}><WardenDashboard /></ProtectedRoute>} />
          <Route path="/warden/pending" element={<ProtectedRoute allowedRoles={['warden']}><WardenPending /></ProtectedRoute>} />
          <Route path="/warden/history" element={<ProtectedRoute allowedRoles={['warden']}><WardenHistory /></ProtectedRoute>} />

          {/* Dept Incharge Routes */}
          <Route path="/dept-incharge" element={<ProtectedRoute allowedRoles={['dept-incharge']}><DeptInchargeDashboard /></ProtectedRoute>} />
          <Route path="/dept-incharge/complaints" element={<ProtectedRoute allowedRoles={['dept-incharge']}><DeptInchargeComplaints /></ProtectedRoute>} />
          <Route path="/dept-incharge/history" element={<ProtectedRoute allowedRoles={['dept-incharge']}><DeptInchargeHistory /></ProtectedRoute>} />

          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>

      </TooltipProvider>
  </QueryClientProvider>
);

export default App;