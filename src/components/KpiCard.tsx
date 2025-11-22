import { LucideIcon } from 'lucide-react';
import { getThemeClasses } from '@/styles/theme';

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'orange' | 'gray';
}

/**
* Renders a themed KPI card with an icon, title, and value using provided props.
* @example
* KpiCard({ title: 'Revenue', value: '$12K', icon: ChartIcon, color: 'teal' })
* <div className="...">...</div>
* @param {{title: string, value: string, icon: React.ComponentType, color?: string}} {{props}} - Props for configuring the KPI card including title, value, icon, and optional color theme.
* @returns {{JSX.Element}} JSX representation of the styled KPI card.
**/
export default function KpiCard({ title, value, icon: Icon, color = 'blue' }: KpiCardProps) {
  return (
    <div className={`${getThemeClasses.card()} ${getThemeClasses.cardPadding()} flex items-center gap-3 hover:shadow-md transition-shadow duration-200`}>
      <div className={`p-2.5 sm:p-3 rounded-full ${getThemeClasses.color(color)} shrink-0`}>
        <Icon className={getThemeClasses.icon('medium')} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`${getThemeClasses.kpiTitle()} truncate`}>{title}</p>
        <p className={`${getThemeClasses.kpiValue()} mt-1`}>{value}</p>
      </div>
    </div>
  );
}
