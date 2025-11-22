'use client';

import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, DollarSign, Package, CheckCircle } from 'lucide-react';

interface ComparisonViewProps {
  data: any[];
  period?: 'month' | 'quarter' | 'year';
}

/**
 * Renders a month-over-month comparison dashboard summarizing current and previous period metrics.
 * @example
 * ComparisonView({ data: sampleData, period: 'month' })
 * <div className="space-y-6">…</div>
 */
export default function ComparisonView({ data, period = 'month' }: ComparisonViewProps) {
  const comparison = useMemo(() => {
    const now = new Date();
    const currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousPeriodEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const currentPeriodData = data.filter(po => {
      const date = po.orderDate.toDate();
      return date >= currentPeriodStart;
    });

    const previousPeriodData = data.filter(po => {
      const date = po.orderDate.toDate();
      return date >= previousPeriodStart && date <= previousPeriodEnd;
    });

    const calculateMetrics = (dataset: any[]) => ({
      totalPOs: dataset.length,
      totalQuantity: dataset.reduce((sum, po) => sum + po.lineItems.reduce((s: number, item: any) => s + item.quantity, 0), 0),
      avgQuantity: dataset.length > 0 ? dataset.reduce((sum, po) => sum + po.lineItems.reduce((s: number, item: any) => s + item.quantity, 0), 0) / dataset.length : 0,
      sentQuantity: dataset.reduce((sum, po) => sum + po.lineItems.reduce((s: number, item: any) => s + (item.sentQty || 0), 0), 0),
      receivedQuantity: dataset.reduce((sum, po) => sum + po.lineItems.reduce((s: number, item: any) => s + (item.receivedQty || 0), 0), 0),
      pendingQuantity: dataset.reduce((sum, po) => sum + po.lineItems.reduce((s: number, item: any) => s + (item.pendingQty || item.quantity), 0), 0),
    });

    const current = calculateMetrics(currentPeriodData);
    const previous = calculateMetrics(previousPeriodData);

    const calculateChange = (current: number, previous: number) => {
      if (previous === 0) return { value: 0, percentage: 0 };
      const change = current - previous;
      const percentage = (change / previous) * 100;
      return { value: change, percentage };
    };

    return {
      current,
      previous,
      changes: {
        totalPOs: calculateChange(current.totalPOs, previous.totalPOs),
        totalQuantity: calculateChange(current.totalQuantity, previous.totalQuantity),
        avgQuantity: calculateChange(current.avgQuantity, previous.avgQuantity),
        sentQuantity: calculateChange(current.sentQuantity, previous.sentQuantity),
        receivedQuantity: calculateChange(current.receivedQuantity, previous.receivedQuantity),
        pendingQuantity: calculateChange(current.pendingQuantity, previous.pendingQuantity),
      }
    };
  }, [data]);

  /**
  * Renders a comparison panel summarizing current and previous metrics with change indicators and coloring.
  * @example
  * ComparisonView({ title: 'Revenue', icon: CoinIcon, currentValue: 500000, previousValue: 450000, change: { percentage: 11.1, value: 50000 }, format: 'currency', color: 'green' })
  * <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">...</div>
  * @param {{ComparisonViewProps}} {{props}} - Props for the comparison view including title, icon, values, change metadata, format, and color hint.
  * @returns {{JSX.Element}} JSX element that visualizes the current and previous values with formatted change.
  **/
  const MetricCard = ({ 
    title, 
    icon: Icon, 
    currentValue, 
    previousValue, 
    change, 
    format = 'number',
    color = 'blue'
  }: any) => {
    const isPositive = change.percentage > 0;
    const isNegative = change.percentage < 0;
    const isNeutral = change.percentage === 0;

    const colorMap: Record<string, string> = {
      blue: 'bg-blue-50 text-blue-600',
      green: 'bg-green-50 text-green-600',
      yellow: 'bg-yellow-50 text-yellow-600',
      purple: 'bg-purple-50 text-purple-600',
    };
    const colorClasses = colorMap[color] || colorMap.blue;

    const formatValue = (value: number) => {
      if (format === 'currency') return `₹${(value / 1000).toFixed(0)}K`;
      if (format === 'currency-full') return `₹${value.toLocaleString()}`;
      return value.toFixed(0);
    };

    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={`p-3 rounded-lg ${colorClasses}`}>
            <Icon className="size-6" />
          </div>
          
          <div className={`flex items-center space-x-1 text-sm font-medium ${
            isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-600'
          }`}>
            {isPositive && <TrendingUp className="size-4" />}
            {isNegative && <TrendingDown className="size-4" />}
            {isNeutral && <Minus className="size-4" />}
            <span>{Math.abs(change.percentage).toFixed(1)}%</span>
          </div>
        </div>

        <h3 className="text-sm font-medium text-gray-600 mb-2">{title}</h3>
        
        <div className="space-y-2">
          <div>
            <p className="text-2xl font-bold text-gray-900">{formatValue(currentValue)}</p>
            <p className="text-xs text-gray-500">Current Month</p>
          </div>
          
          <div className="pt-2 border-t border-gray-200">
            <p className="text-lg font-semibold text-gray-600">{formatValue(previousValue)}</p>
            <p className="text-xs text-gray-500">Previous Month</p>
          </div>
        </div>

        <div className={`mt-4 pt-4 border-t border-gray-200 text-sm ${
          isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-600'
        }`}>
          {isPositive && '↑ '}
          {isNegative && '↓ '}
          {format === 'currency' || format === 'currency-full' 
            ? `₹${Math.abs(change.value).toLocaleString()}` 
            : Math.abs(change.value).toFixed(0)
          } vs last month
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Month-over-Month Comparison</h2>
          <p className="text-sm text-gray-600 mt-1">
            {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} vs{' '}
            {new Date(new Date().setMonth(new Date().getMonth() - 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Purchase Orders"
          icon={Package}
          currentValue={comparison.current.totalPOs}
          previousValue={comparison.previous.totalPOs}
          change={comparison.changes.totalPOs}
          color="blue"
        />

        <MetricCard
          title="Total Item Quantity"
          icon={Package}
          currentValue={comparison.current.totalQuantity}
          previousValue={comparison.previous.totalQuantity}
          change={comparison.changes.totalQuantity}
          format="number"
          color="green"
        />

        <MetricCard
          title="Sent Quantity"
          icon={TrendingUp}
          currentValue={comparison.current.sentQuantity}
          previousValue={comparison.previous.sentQuantity}
          change={comparison.changes.sentQuantity}
          format="number"
          color="yellow"
        />

        <MetricCard
          title="Received Quantity"
          icon={CheckCircle}
          currentValue={comparison.current.receivedQuantity}
          previousValue={comparison.previous.receivedQuantity}
          change={comparison.changes.receivedQuantity}
          format="number"
          color="purple"
        />
      </div>

      {/* Detailed Breakdown */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Detailed Breakdown</h3>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Metric</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Current</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Previous</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Change</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">% Change</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-3 px-4 text-sm text-gray-900">Total POs</td>
                <td className="py-3 px-4 text-sm text-gray-900 text-right font-medium">{comparison.current.totalPOs}</td>
                <td className="py-3 px-4 text-sm text-gray-600 text-right">{comparison.previous.totalPOs}</td>
                <td className={`py-3 px-4 text-sm text-right font-medium ${
                  comparison.changes.totalPOs.value > 0 ? 'text-green-600' : 
                  comparison.changes.totalPOs.value < 0 ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {comparison.changes.totalPOs.value > 0 ? '+' : ''}{comparison.changes.totalPOs.value.toFixed(0)}
                </td>
                <td className={`py-3 px-4 text-sm text-right font-medium ${
                  comparison.changes.totalPOs.percentage > 0 ? 'text-green-600' : 
                  comparison.changes.totalPOs.percentage < 0 ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {comparison.changes.totalPOs.percentage > 0 ? '+' : ''}{comparison.changes.totalPOs.percentage.toFixed(1)}%
                </td>
              </tr>
              
              <tr className="border-b border-gray-100">
                <td className="py-3 px-4 text-sm text-gray-900">Total Item Quantity</td>
                <td className="py-3 px-4 text-sm text-gray-900 text-right font-medium">{comparison.current.totalQuantity.toLocaleString()}</td>
                <td className="py-3 px-4 text-sm text-gray-600 text-right">{comparison.previous.totalQuantity.toLocaleString()}</td>
                <td className={`py-3 px-4 text-sm text-right font-medium ${
                  comparison.changes.totalQuantity.value > 0 ? 'text-green-600' : 
                  comparison.changes.totalQuantity.value < 0 ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {comparison.changes.totalQuantity.value > 0 ? '+' : ''}{Math.abs(comparison.changes.totalQuantity.value).toLocaleString()}
                </td>
                <td className={`py-3 px-4 text-sm text-right font-medium ${
                  comparison.changes.totalQuantity.percentage > 0 ? 'text-green-600' : 
                  comparison.changes.totalQuantity.percentage < 0 ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {comparison.changes.totalQuantity.percentage > 0 ? '+' : ''}{comparison.changes.totalQuantity.percentage.toFixed(1)}%
                </td>
              </tr>
              
              <tr className="border-b border-gray-100">
                <td className="py-3 px-4 text-sm text-gray-900">Sent Quantity</td>
                <td className="py-3 px-4 text-sm text-gray-900 text-right font-medium">{comparison.current.sentQuantity.toLocaleString()}</td>
                <td className="py-3 px-4 text-sm text-gray-600 text-right">{comparison.previous.sentQuantity.toLocaleString()}</td>
                <td className={`py-3 px-4 text-sm text-right font-medium ${
                  comparison.changes.sentQuantity.value > 0 ? 'text-green-600' : 
                  comparison.changes.sentQuantity.value < 0 ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {comparison.changes.sentQuantity.value > 0 ? '+' : ''}{Math.abs(comparison.changes.sentQuantity.value).toLocaleString()}
                </td>
                <td className={`py-3 px-4 text-sm text-right font-medium ${
                  comparison.changes.sentQuantity.percentage > 0 ? 'text-green-600' : 
                  comparison.changes.sentQuantity.percentage < 0 ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {comparison.changes.sentQuantity.percentage > 0 ? '+' : ''}{comparison.changes.sentQuantity.percentage.toFixed(1)}%
                </td>
              </tr>
              
              <tr className="border-b border-gray-100">
                <td className="py-3 px-4 text-sm text-gray-900">Received Quantity</td>
                <td className="py-3 px-4 text-sm text-gray-900 text-right font-medium">{comparison.current.receivedQuantity.toLocaleString()}</td>
                <td className="py-3 px-4 text-sm text-gray-600 text-right">{comparison.previous.receivedQuantity.toLocaleString()}</td>
                <td className={`py-3 px-4 text-sm text-right font-medium ${
                  comparison.changes.receivedQuantity.value > 0 ? 'text-green-600' : 
                  comparison.changes.receivedQuantity.value < 0 ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {comparison.changes.receivedQuantity.value > 0 ? '+' : ''}{Math.abs(comparison.changes.receivedQuantity.value).toLocaleString()}
                </td>
                <td className={`py-3 px-4 text-sm text-right font-medium ${
                  comparison.changes.receivedQuantity.percentage > 0 ? 'text-green-600' : 
                  comparison.changes.receivedQuantity.percentage < 0 ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {comparison.changes.receivedQuantity.percentage > 0 ? '+' : ''}{comparison.changes.receivedQuantity.percentage.toFixed(1)}%
                </td>
              </tr>
              
              <tr>
                <td className="py-3 px-4 text-sm text-gray-900">Pending Quantity</td>
                <td className="py-3 px-4 text-sm text-gray-900 text-right font-medium">{comparison.current.pendingQuantity.toLocaleString()}</td>
                <td className="py-3 px-4 text-sm text-gray-600 text-right">{comparison.previous.pendingQuantity.toLocaleString()}</td>
                <td className={`py-3 px-4 text-sm text-right font-medium ${
                  comparison.changes.pendingQuantity.value > 0 ? 'text-green-600' : 
                  comparison.changes.pendingQuantity.value < 0 ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {comparison.changes.pendingQuantity.value > 0 ? '+' : ''}{Math.abs(comparison.changes.pendingQuantity.value).toLocaleString()}
                </td>
                <td className={`py-3 px-4 text-sm text-right font-medium ${
                  comparison.changes.pendingQuantity.percentage > 0 ? 'text-green-600' : 
                  comparison.changes.pendingQuantity.percentage < 0 ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {comparison.changes.pendingQuantity.percentage > 0 ? '+' : ''}{comparison.changes.pendingQuantity.percentage.toFixed(1)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
