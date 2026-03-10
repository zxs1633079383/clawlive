import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import type { MeetingStatus } from '@clawlive/shared';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'lobster';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-surface-600 text-text-secondary',
  success: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  warning: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  danger: 'bg-red-500/20 text-red-400 border-red-500/30',
  lobster: 'bg-lobster-muted text-lobster border-lobster/30',
};

export function Badge({ variant = 'default', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        variantStyles[variant],
        className,
      )}
      {...props}
    />
  );
}

const statusVariantMap: Record<MeetingStatus, BadgeVariant> = {
  created: 'default',
  lobby: 'warning',
  active: 'success',
  ended: 'danger',
  summary: 'lobster',
};

export function MeetingStatusBadge({ status }: { status: MeetingStatus }) {
  return <Badge variant={statusVariantMap[status]}>{status}</Badge>;
}
