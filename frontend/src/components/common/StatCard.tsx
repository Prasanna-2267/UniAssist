import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  color?: 'primary' | 'pending' | 'approved' | 'rejected' | 'in-progress';
  className?: string;
}

const colorClasses: Record<string, string> = {
  primary: 'bg-primary/10 text-primary',
  pending: 'bg-pending/10 text-pending',
  approved: 'bg-approved/10 text-approved',
  rejected: 'bg-destructive/10 text-destructive',
  'in-progress': 'bg-in-progress/10 text-in-progress',
};

export function StatCard({ title, value, icon: Icon, color = 'primary', className }: StatCardProps) {
  return (
    <div className={cn('stat-card animate-slide-up', className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div className={cn('p-2 rounded-lg', colorClasses[color])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}
