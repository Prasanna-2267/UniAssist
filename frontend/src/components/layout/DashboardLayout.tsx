import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Home,
  FileText,
  FilePlus,
  ClipboardList,
  Clock,
  LogOut,
  Menu,
  X,
  GraduationCap,
  Users,
  Building2,
  Shield,
  Wrench,
  AlertCircle,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const roleNavItems: Record<string, NavItem[]> = {
  student: [
    { label: 'Dashboard', href: '/student', icon: Home },
    { label: 'Apply Leave', href: '/student/leave', icon: FilePlus },
    { label: 'Apply Bonafide', href: '/student/bonafide', icon: FileText },
    { label: 'Apply Outpass', href: '/student/outpass', icon: ClipboardList },
    { label: 'Apply OD', href: '/student/od', icon: Clock },
    { label: 'Raise Complaint', href: '/student/complaint', icon: AlertCircle },
    { label: 'My Requests', href: '/student/requests', icon: FileText },
  ],
  advisor: [
    { label: 'Dashboard', href: '/advisor', icon: Home },
    { label: 'Pending Requests', href: '/advisor/pending', icon: ClipboardList },
    { label: 'Request History', href: '/advisor/history', icon: Clock },
  ],
  hod: [
    { label: 'Dashboard', href: '/hod', icon: Home },
    { label: 'Pending Requests', href: '/hod/pending', icon: ClipboardList },
    { label: 'Request History', href: '/hod/history', icon: Clock },
  ],
  warden: [
    { label: 'Dashboard', href: '/warden', icon: Home },
    { label: 'Pending Outpasses', href: '/warden/pending', icon: ClipboardList },
    { label: 'Outpass History', href: '/warden/history', icon: Clock },
  ],
  'dept-incharge': [
    { label: 'Dashboard', href: '/dept-incharge', icon: Home },
    { label: 'Complaints', href: '/dept-incharge/complaints', icon: AlertCircle },
    { label: 'History', href: '/dept-incharge/history', icon: Clock },
  ],
};

const roleIcons: Record<string, React.ElementType> = {
  student: GraduationCap,
  advisor: Users,
  hod: Building2,
  warden: Shield,
  'dept-incharge': Wrench,
};

const roleLabels: Record<string, string> = {
  student: 'Student',
  advisor: 'Class Advisor',
  hod: 'Head of Department',
  warden: 'Warden',
  'dept-incharge': 'Dept Incharge',
};

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!user) return null;

  const navItems = roleNavItems[user.role] || [];
  const RoleIcon = roleIcons[user.role] || GraduationCap;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar transform transition-transform duration-200 ease-in-out lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Sidebar Header */}
          <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
                <GraduationCap className="h-5 w-5 text-sidebar-primary-foreground" />
              </div>
              <span className="font-semibold text-sidebar-foreground">College Portal</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-sidebar-foreground"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Role Badge */}
          <div className="px-4 py-3 border-b border-sidebar-border">
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-sidebar-accent">
              <RoleIcon className="h-4 w-4 text-sidebar-primary" />
              <span className="text-sm font-medium text-sidebar-foreground">
                {roleLabels[user.role]}
              </span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <ul className="space-y-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      to={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "sidebar-link",
                        isActive && "sidebar-link-active"
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Sidebar Footer */}
          <div className="border-t border-sidebar-border p-4">
            <button
              onClick={handleLogout}
              className="sidebar-link w-full text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-5 w-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-card px-4 sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex-1" />

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {user.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{roleLabels[user.role]}</p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page Content */}
        <main className="p-4 sm:p-6 lg:p-8 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
