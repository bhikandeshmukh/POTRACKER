import { Clock, CheckCircle, XCircle, Truck, Package, RotateCcw } from 'lucide-react';
import { getThemeClasses } from '@/styles/theme';

interface StatusBadgeProps {
  status: 'Pending' | 'Approved' | 'Rejected' | 'Shipped' | 'Received' | 'Partial';
  animated?: boolean;
}

/**
* Renders a styled badge reflecting the provided status.
* @example
* StatusBadge({ status: 'Approved', animated: true })
* <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full ...">...</span>
* @param {{StatusBadgeProps}} {{props}} - Configuration object containing the current status and optional animation toggle.
* @returns {{JSX.Element}} Rendered badge element with status-specific styling and icon.
**/
export default function StatusBadge({ status, animated = true }: StatusBadgeProps) {
  const config = {
    Pending: {
      style: 'bg-amber-50 text-amber-700 border border-amber-200',
      icon: Clock,
      pulse: 'animate-pulse'
    },
    Approved: {
      style: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      icon: CheckCircle,
      pulse: ''
    },
    Rejected: {
      style: 'bg-red-50 text-red-700 border border-red-200',
      icon: XCircle,
      pulse: ''
    },
    Shipped: {
      style: 'bg-blue-50 text-blue-700 border border-blue-200',
      icon: Truck,
      pulse: 'animate-bounce'
    },
    Received: {
      style: 'bg-violet-50 text-violet-700 border border-violet-200',
      icon: Package,
      pulse: ''
    },
    Partial: {
      style: 'bg-orange-50 text-orange-700 border border-orange-200',
      icon: RotateCcw,
      pulse: 'animate-pulse'
    },
  }[status];

  const Icon = config.icon;

  return (
    <span className={`
      inline-flex items-center gap-1 px-2 py-1 rounded-full ${getThemeClasses.smallText()} font-medium
      ${config.style}
      ${animated ? config.pulse : ''}
      transition-all duration-200 hover:shadow-sm
    `}>
      <Icon className={getThemeClasses.icon('small')} />
      {status}
    </span>
  );
}
