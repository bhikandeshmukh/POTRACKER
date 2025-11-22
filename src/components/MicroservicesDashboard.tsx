'use client';

import { useState, useEffect } from 'react';
import { 
  orchestrator, 
  eventBus, 
  serviceRegistry,
  checkAllServicesHealth 
} from '@/lib/microservices';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Database, 
  RefreshCw, 
  Server,
  Zap,
  MessageSquare,
  Network,
  BarChart3
} from 'lucide-react';

interface ServiceStatus {
  name: string;
  status: 'running' | 'stopped' | 'error';
  health?: any;
  uptime?: number;
}

interface MicroserviceMetrics {
  orchestrator: {
    uptime: number;
    servicesCount: number;
    healthyServices: number;
    isRunning: boolean;
  };
  services: Record<string, any>;
  eventBus: {
    totalEvents: number;
    eventRate: number;
    totalSubscriptions: number;
    errorRate: number;
  };
  serviceRegistry: {
    totalServices: number;
    healthyServices: number;
    unhealthyServices: number;
  };
  apiGateway?: {
    totalRoutes: number;
    errorRate: number;
    averageResponseTime: number;
  };
}

export default function MicroservicesDashboard() {
  const [metrics, setMetrics] = useState<MicroserviceMetrics | null>(null);
  const [serviceHealth, setServiceHealth] = useState<Record<string, any>>({});
  const [orchestratorStatus, setOrchestratorStatus] = useState<any>(null);
  const [eventStats, setEventStats] = useState<any>(null);
  const [registryStats, setRegistryStats] = useState<any>(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [loading, setLoading] = useState(true);

  const refreshData = async () => {
    try {
      setLoading(true);

      // Get orchestrator metrics
      const orchestratorMetrics = await orchestrator.getMetrics();
      setMetrics(orchestratorMetrics);

      // Get orchestrator status
      const status = orchestrator.getStatus();
      setOrchestratorStatus(status);

      // Get service health
      const health = await checkAllServicesHealth();
      setServiceHealth(health);

      // Get event bus stats
      const eventBusStats = eventBus.getEventStats();
      setEventStats(eventBusStats);

      // Get service registry stats
      const serviceRegistryStats = serviceRegistry.getStats();
      setRegistryStats(serviceRegistryStats);

      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to refresh microservices data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(refreshData, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'healthy':
      case 'running':
        return 'text-green-600 bg-green-100';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-100';
      case 'unhealthy':
      case 'error':
        return 'text-red-600 bg-red-100';
      case 'stopped':
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'running':
        return <CheckCircle className="size-5" />;
      case 'degraded':
        return <AlertTriangle className="size-5" />;
      case 'unhealthy':
      case 'error':
        return <AlertTriangle className="size-5" />;
      default:
        return <Server className="size-5" />;
    }
  };

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full size-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading microservices dashboard...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Microservices Dashboard</h1>
          <p className="text-gray-600">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={refreshData}
          disabled={loading}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`size-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Orchestrator Status */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Orchestrator</p>
              <p className="text-2xl font-bold text-gray-900">
                {orchestratorStatus?.isRunning ? 'Running' : 'Stopped'}
              </p>
              {metrics && (
                <p className="text-sm text-gray-500 mt-1">
                  Uptime: {formatUptime(metrics.orchestrator.uptime)}
                </p>
              )}
            </div>
            <div className={`p-3 rounded-full ${getStatusColor(orchestratorStatus?.isRunning ? 'running' : 'stopped')}`}>
              {getStatusIcon(orchestratorStatus?.isRunning ? 'running' : 'stopped')}
            </div>
          </div>
        </div>

        {/* Services Count */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Services</p>
              <p className="text-2xl font-bold text-gray-900">
                {metrics?.orchestrator.servicesCount || 0}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {metrics?.orchestrator.healthyServices || 0} healthy
              </p>
            </div>
            <div className="p-3 rounded-full text-blue-600 bg-blue-100">
              <Server className="size-5" />
            </div>
          </div>
        </div>

        {/* Event Bus */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Events</p>
              <p className="text-2xl font-bold text-gray-900">
                {eventStats?.totalEvents || 0}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {eventStats?.eventRate?.toFixed(1) || 0}/min
              </p>
            </div>
            <div className="p-3 rounded-full text-purple-600 bg-purple-100">
              <MessageSquare className="size-5" />
            </div>
          </div>
        </div>

        {/* Service Registry */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Registry</p>
              <p className="text-2xl font-bold text-gray-900">
                {registryStats?.totalServices || 0}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {registryStats?.healthyServices || 0} healthy
              </p>
            </div>
            <div className="p-3 rounded-full text-green-600 bg-green-100">
              <Database className="size-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Services Status */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Service Status</h3>
        <div className="space-y-4">
          {orchestratorStatus?.services?.map((service: ServiceStatus) => (
            <div key={service.name} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center">
                <div className={`p-2 rounded-full mr-3 ${getStatusColor(service.status)}`}>
                  {getStatusIcon(service.status)}
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">{service.name}</h4>
                  <p className="text-sm text-gray-500">
                    Status: {service.status}
                    {serviceHealth[service.name] && (
                      <span className="ml-2">
                        Health: {serviceHealth[service.name].status}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(service.status)}`}>
                  {service.status}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Event Bus Details */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Event Bus Metrics</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Events:</span>
              <span className="font-medium">{eventStats?.totalEvents?.toLocaleString() || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Event Rate:</span>
              <span className="font-medium">{eventStats?.eventRate?.toFixed(2) || 0} events/min</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Subscriptions:</span>
              <span className="font-medium">{eventStats?.totalSubscriptions || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Recent Events:</span>
              <span className="font-medium">{eventStats?.recentEvents?.length || 0}</span>
            </div>
          </div>
        </div>

        {/* Service Registry Details */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Service Registry</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Services:</span>
              <span className="font-medium">{registryStats?.totalServices || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Healthy Services:</span>
              <span className="font-medium text-green-600">{registryStats?.healthyServices || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Unhealthy Services:</span>
              <span className="font-medium text-red-600">{registryStats?.unhealthyServices || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Degraded Services:</span>
              <span className="font-medium text-yellow-600">{registryStats?.degradedServices || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Events */}
      {eventStats?.recentEvents && eventStats.recentEvents.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Events</h3>
          <div className="space-y-2">
            {eventStats.recentEvents.slice(0, 10).map((event: any, index: number) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <div className="p-2 rounded-full text-blue-600 bg-blue-100 mr-3">
                    <Zap className="size-4" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{event.type}</p>
                    <p className="text-sm text-gray-500">
                      From: {event.service}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* API Gateway Stats (if available) */}
      {metrics?.apiGateway && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">API Gateway</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{metrics.apiGateway.totalRoutes}</p>
              <p className="text-sm text-gray-600">Total Routes</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {metrics.apiGateway.averageResponseTime.toFixed(0)}ms
              </p>
              <p className="text-sm text-gray-600">Avg Response Time</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {metrics.apiGateway.errorRate.toFixed(1)}%
              </p>
              <p className="text-sm text-gray-600">Error Rate</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}