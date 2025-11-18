import { LucideIcon } from 'lucide-react';
import { getThemeClasses } from '@/styles/theme';

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'orange' | 'gray';
}

export default function KpiCard({ title, value, icon: Icon, color = 'blue' }: KpiCardProps) {
  return (
    <div className={`${getThemeClasses.card()} ${getThemeClasses.cardPadding()}`}>
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className={`${getThemeClasses.kpiTitle()} truncate`}>{title}</p>
          <p className={`${getThemeClasses.kpiValue()} mt-1`}>{value}</p>
        </div>
        <div className={`p-1.5 sm:p-2 rounded-lg ${getThemeClasses.color(color)} flex-shrink-0 ml-2`}>
          <Icon className={getThemeClasses.icon('medium')} />
        </div>
      </div>
    </div>
  );
}
