'use client';

import React, { useState, useEffect } from 'react';
import { 
  performanceService, 
  errorTrackingService, 
  retryService, 
  realtimeService,
  healthService,
  cacheService 
} from '@/lib/services';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Database, 
  RefreshCw, 
  TrendingUp,
  Wifi,
  Zap
} from 'lucide-react';

interface MetricCard {
  title: string;
  value: string | number;
  change?: string;
  status: 'good' | 'warning' | 'error';
  icon: React.ReactNode;
}

/****
* Renders the service monitoring dashboard that aggregates live stats from multiple services.
* @example
* ServiceMonitoringDashboard()
* <div>...</div>
* @param {{void}} {{none}} - No parameters are required for this component.
* @returns {{JSX.Element}} Returns the JSX structure representing the dashboard.
****/
export default function ServiceMonitoringDashboard() {
  const [performanceStats, setPerformanceStats] = useState(performanceService.getStats());
  const [errorMetrics, setErrorMetrics] = useState(errorTrackingService.getMetrics());
  const [retryStats, setRetryStats] = useState(retryService.getRetryStats());
  const [realtimeMetrics, setRealtimeMetrics] = useState(realtimeService.getMetrics());
  const [cacheStats, setCacheStats] = useState(cacheService.getStats());
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  /**
  * Synchronizes monitoring stats, health, and cache metrics for the dashboard.
  * @example
  * sync()
  * undefined
  * @param {{void}} {{none}} - No parameters required.
  * @returns {{Promise<void>}} Resolves once monitoring stats and health information are refreshed.
  **/
  const refreshData = async () => {
    setPerformanceStats(performanceService.getStats());
    setErrorMetrics(errorTrackingService.getMetrics());
    setRetryStats(retryService.getRetryStats());
    setRealtimeMetrics(realtimeService.getMetrics());
    setCacheStats(cacheService.getStats());
    
    try {
      const health = await healthService.getHealthStatus();
      setHealthStatus(health);
    } catch (error) {
      console.error('Failed to get health status:', error);
    }
    
    setLastUpdate(new Date());
  };

  useEffect(() => {
    refreshData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(refreshData, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatPercentage = (value: number): string => {
    return `${value.toFixed(1)}%`;
  };

  const getStatusColor = (status: 'good' | 'warning' | 'error'): string => {
    switch (status) {
      case 'good': return 'text-green-600 bg-green-100';
      case 'warning': return 'text-yellow-600 bg-yellow-100';
      case 'error': return 'text-red-600 bg-red-100';
    }
  };

  const metrics: MetricCard[] = [
    {
      title: 'System Health',
      value: healthStatus?.status || 'Unknown',
      status: healthStatus?.status === 'healthy' ? 'good' : 
              healthStatus?.status === 'degraded' ? 'warning' : 'error',
      icon: <CheckCircle className="size-5" />
    },
    {
      title: 'Avg Response Time',
      value: formatDuration(performanceStats.averageDuration),
      status: performanceStats.averageDuration < 1000 ? 'good' : 
              performanceStats.averageDuration < 3000 ? 'warning' : 'error',
      icon: <Clock className="size-5" />
    },
    {
      title: 'Success Rate',
      value: formatPercentage(performanceStats.successRate),
      status: performanceStats.successRate > 95 ? 'good' : 
              performanceStats.successRate > 90 ? 'warning' : 'error',
      icon: <TrendingUp className="size-5" />
    },
    {
      title: 'Error Rate',
      value: formatPercentage(errorMetrics.errorRate),
      status: errorMetrics.errorRate < 1 ? 'good' : 
              errorMetrics.errorRate < 5 ? 'warning' : 'error',
      icon: <AlertTriangle className="size-5" />
    },
    {
      title: 'Cache Hit Rate',
      value: formatPercentage(performanceStats.cacheHitRate),
      status: performanceStats.cacheHitRate > 80 ? 'good' : 
              performanceStats.cacheHitRate > 60 ? 'warning' : 'error',
      icon: <Database className="size-5" />
    },
    {
      title: 'Active Subscriptions',
      value: realtimeMetrics.activeSubscriptions,
      status: realtimeMetrics.errorRate < 5 ? 'good' : 
              realtimeMetrics.errorRate < 10 ? 'warning' : 'error',
      icon: <Wifi className="size-5" />
    },
    {
      title: 'Circuit Breakers Open',
      value: retryStats.openCircuitBreakers,
      status: retryStats.openCircuitBreakers === 0 ? 'good' : 
              retryStats.openCircuitBreakers < 3 ? 'warning' : 'error',
      icon: <Zap className="size-5" />
    },
    {
      title: 'Total Operations',
      value: performanceStats.totalOperations.toLocaleString(),
      status: 'good',
      icon: <Activity className="size-5" />
    }
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Service Monitoring</h1>
          <p className="text-gray-600">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={refreshData}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="size-4 mr-2" />
          Refresh
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric, index) => (
          <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{metric.title}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{metric.value}</p>
                {metric.change && (
                  <p className="text-sm text-gray-500 mt-1">{metric.change}</p>
                )}
              </div>
              <div className={`p-3 rounded-full ${getStatusColor(metric.status)}`}>
                {metric.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Detailed Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Details */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Details</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Operations:</span>
              <span className="font-medium">{performanceStats.totalOperations.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Average Duration:</span>
              <span className="font-medium">{formatDuration(performanceStats.averageDuration)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Success Rate:</span>
              <span className="font-medium">{formatPercentage(performanceStats.successRate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Cache Hit Rate:</span>
              <span className="font-medium">{formatPercentage(performanceStats.cacheHitRate)}</span>
            </div>
          </div>
        </div>

        {/* Error Summary */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Error Summary</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Errors:</span>
              <span className="font-medium">{errorMetrics.totalErrors.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Error Rate:</span>
              <span className="font-medium">{formatPercentage(errorMetrics.errorRate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Recent Errors:</span>
              <span className="font-medium">{errorMetrics.recentErrors.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Avg Resolution Time:</span>
              <span className="font-medium">{formatDuration(errorMetrics.averageResolutionTime)}</span>
            </div>
          </div>
        </div>

        {/* Cache Statistics */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Cache Statistics</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Entries:</span>
              <span className="font-medium">{cacheStats.totalEntries}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Valid Entries:</span>
              <span className="font-medium">{cacheStats.validEntries}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Expired Entries:</span>
              <span className="font-medium">{cacheStats.expiredEntries}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Max Size:</span>
              <span className="font-medium">{cacheStats.maxSize}</span>
            </div>
          </div>
        </div>

        {/* Real-time Metrics */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Real-time Metrics</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Active Subscriptions:</span>
              <span className="font-medium">{realtimeMetrics.activeSubscriptions}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Updates:</span>
              <span className="font-medium">{realtimeMetrics.totalUpdates.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Update Frequency:</span>
              <span className="font-medium">{realtimeMetrics.averageUpdateFrequency.toFixed(1)}/min</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Error Rate:</span>
              <span className="font-medium">{formatPercentage(realtimeMetrics.errorRate)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Errors */}
      {errorMetrics.recentErrors.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Errors</h3>
          <div className="space-y-2">
            {errorMetrics.recentErrors.slice(0, 5).map((error, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div className="flex items-center">
                  <AlertTriangle className="size-4 text-red-500 mr-2" />
                  <div>
                    <p className="text-sm font-medium text-red-800">{error.message}</p>
                    <p className="text-xs text-red-600">
                      {error.context.service} • {error.context.operation}
                    </p>
                  </div>
                </div>
                <div className="text-xs text-red-600">
                  {error.occurrences}x
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}