'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import KpiCard from '@/components/KpiCard';
import { getPOs, getPOsFromOrganizedStructure, getShipments, PurchaseOrder, Shipment, testFirestoreConnection } from '@/lib/firestore';
import { IndianRupee, Clock, CheckCircle, AlertCircle, FileText, Package, Truck, PlayCircle, XCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { getThemeClasses } from '@/styles/theme';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format, isWithinInterval } from 'date-fns';
import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';
import DateRangePicker, { DateRange } from '@/components/DateRangePicker';
import { useToast } from '@/components/ToastContainer';
import LoadingSpinner from '@/components/LoadingSpinner';
import AdvancedFilters, { FilterConfig } from '@/components/AdvancedFilters';
import ExportOptions from '@/components/ExportOptions';
import { useRealTimeUpdates } from '@/hooks/useRealTimeUpdates';
import InteractiveCharts from '@/components/InteractiveCharts';
import ComparisonView from '@/components/ComparisonView';
import RecentActivity from '@/components/RecentActivity';
import CalendarIntegration from '@/components/CalendarIntegration';
import ComplianceReports from '@/components/ComplianceReports';


export default function Dashboard() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();
  const { showSuccess, showError, showInfo } = useToast();
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    endDate: new Date(),
    label: 'This month'
  });
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({});

  useEffect(() => {
    console.log('Dashboard useEffect - loading:', loading, 'user:', user ? user.uid : 'null', 'userData:', userData);
    if (!loading && !user) {
      console.log('Redirecting to login - no user found');
      router.push('/login');
    }
  }, [user, loading, router, userData]);

  useEffect(() => {
    if (user && userData) {
      loadData();
    }
  }, [user, userData]);

  const loadData = async () => {
    try {
      console.log('Loading PO data for user:', user?.uid, 'role:', userData?.role);
      
      // Test Firestore connection first
      console.log('Testing Firestore connection...');
      const connectionTest = await testFirestoreConnection();
      console.log('Connection test results:', connectionTest);
      
      // Try organized structure first, fallback to regular structure
      const [poList, shipmentList] = await Promise.all([
        getPOsFromOrganizedStructure(user?.uid, userData?.role),
        getShipments()
      ]);
      console.log('PO data loaded:', poList.length, 'items');
      console.log('Shipment data loaded:', shipmentList.length, 'items');
      setPos(poList);
      setShipments(shipmentList);
    } catch (error) {
      console.error('Error loading data:', error);
      showError('Data Load Failed', 'Failed to load dashboard data');
    } finally {
      setLoadingData(false);
    }
  };

  // Real-time updates
  const { isActive: isRealTimeActive, lastUpdate, toggleRealTime, forceUpdate } = useRealTimeUpdates({
    onUpdate: loadData,
    interval: 30000, // 30 seconds
    enabled: true
  });

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading dashboard..." />
      </div>
    );
  }

  // Filter POs based on selected date range and advanced filters
  const filteredPOs = pos.filter(po => {
    const poDate = po.orderDate.toDate();
    const dateMatch = isWithinInterval(poDate, {
      start: dateRange.startDate,
      end: dateRange.endDate
    });

    // Apply advanced filters
    const statusFilter = selectedFilters.status || [];
    const vendorFilter = selectedFilters.vendor || [];
    const amountFilter = selectedFilters.amount || [];

    const statusMatch = statusFilter.length === 0 || statusFilter.includes(po.status);
    const vendorMatch = vendorFilter.length === 0 || vendorFilter.includes(po.vendorName);
    
    let amountMatch = true;
    if (amountFilter.length > 0) {
      amountMatch = amountFilter.some(range => {
        switch (range) {
          case 'low': return po.totalAmount < 10000;
          case 'medium': return po.totalAmount >= 10000 && po.totalAmount < 50000;
          case 'high': return po.totalAmount >= 50000;
          default: return true;
        }
      });
    }

    return dateMatch && statusMatch && vendorMatch && amountMatch;
  });

  // Create filter configurations
  const filterConfigs: FilterConfig[] = [
    {
      key: 'status',
      label: 'Status',
      multiSelect: true,
      options: [
        { value: 'Pending', label: 'Pending', count: pos.filter(p => p.status === 'Pending').length },
        { value: 'Approved', label: 'Approved', count: pos.filter(p => p.status === 'Approved').length },
        { value: 'Shipped', label: 'Shipped', count: pos.filter(p => p.status === 'Shipped').length },
        { value: 'Received', label: 'Received', count: pos.filter(p => p.status === 'Received').length },
        { value: 'Rejected', label: 'Rejected', count: pos.filter(p => p.status === 'Rejected').length },
      ]
    },
    {
      key: 'vendor',
      label: 'Vendor',
      multiSelect: true,
      options: Array.from(new Set(pos.map(p => p.vendorName))).map(vendor => ({
        value: vendor,
        label: vendor,
        count: pos.filter(p => p.vendorName === vendor).length
      }))
    },
    {
      key: 'amount',
      label: 'Amount Range',
      multiSelect: true,
      options: [
        { value: 'low', label: 'Under ₹10,000', count: pos.filter(p => p.totalAmount < 10000).length },
        { value: 'medium', label: '₹10,000 - ₹50,000', count: pos.filter(p => p.totalAmount >= 10000 && p.totalAmount < 50000).length },
        { value: 'high', label: 'Above ₹50,000', count: pos.filter(p => p.totalAmount >= 50000).length },
      ]
    }
  ];
  
  // Calculate quantities from all POs
  const totalItemQty = pos.reduce((sum, po) => {
    return sum + po.lineItems.reduce((itemSum, item) => itemSum + item.quantity, 0);
  }, 0);
  
  const sentQty = pos.reduce((sum, po) => {
    return sum + po.lineItems.reduce((itemSum, item) => itemSum + (item.sentQty || 0), 0);
  }, 0);
  
  const receivedQty = pos.reduce((sum, po) => {
    return sum + po.lineItems.reduce((itemSum, item) => itemSum + (item.receivedQty || 0), 0);
  }, 0);
  
  const pendingQty = pos.reduce((sum, po) => {
    return sum + po.lineItems.reduce((itemSum, item) => itemSum + (item.pendingQty || item.quantity), 0);
  }, 0);
  
  const inTransitQty = sentQty - receivedQty;
  
  // Calculate quantities from filtered POs
  const filteredTotalQty = filteredPOs.reduce((sum, po) => {
    return sum + po.lineItems.reduce((itemSum, item) => itemSum + item.quantity, 0);
  }, 0);
  
  const filteredSentQty = filteredPOs.reduce((sum, po) => {
    return sum + po.lineItems.reduce((itemSum, item) => itemSum + (item.sentQty || 0), 0);
  }, 0);
  
  const filteredReceivedQty = filteredPOs.reduce((sum, po) => {
    return sum + po.lineItems.reduce((itemSum, item) => itemSum + (item.receivedQty || 0), 0);
  }, 0);
  
  const filteredPendingQty = filteredPOs.reduce((sum, po) => {
    return sum + po.lineItems.reduce((itemSum, item) => itemSum + (item.pendingQty || item.quantity), 0);
  }, 0);
  
  // Status-based quantities
  const pendingStatusQty = pos.filter(po => po.status === 'Pending').reduce((sum, po) => {
    return sum + po.lineItems.reduce((itemSum, item) => itemSum + item.quantity, 0);
  }, 0);
  
  const approvedStatusQty = pos.filter(po => po.status === 'Approved').reduce((sum, po) => {
    return sum + po.lineItems.reduce((itemSum, item) => itemSum + item.quantity, 0);
  }, 0);
  
  const shippedStatusQty = pos.filter(po => po.status === 'Shipped' || po.status === 'Partial').reduce((sum, po) => {
    return sum + po.lineItems.reduce((itemSum, item) => itemSum + item.quantity, 0);
  }, 0);
  
  const receivedStatusQty = pos.filter(po => po.status === 'Received').reduce((sum, po) => {
    return sum + po.lineItems.reduce((itemSum, item) => itemSum + item.quantity, 0);
  }, 0);

  // Status distribution by QUANTITY for pie chart (using filtered data)
  const statusData = [
    { 
      name: 'Pending', 
      value: filteredPOs.filter(p => p.status === 'Pending').reduce((sum, po) => 
        sum + po.lineItems.reduce((itemSum, item) => itemSum + item.quantity, 0), 0
      ), 
      color: '#f59e0b' 
    },
    { 
      name: 'Approved', 
      value: filteredPOs.filter(p => p.status === 'Approved').reduce((sum, po) => 
        sum + po.lineItems.reduce((itemSum, item) => itemSum + item.quantity, 0), 0
      ), 
      color: '#10b981' 
    },
    { 
      name: 'Shipped', 
      value: filteredPOs.filter(p => p.status === 'Shipped' || p.status === 'Partial').reduce((sum, po) => 
        sum + po.lineItems.reduce((itemSum, item) => itemSum + item.quantity, 0), 0
      ), 
      color: '#3b82f6' 
    },
    { 
      name: 'Received', 
      value: filteredPOs.filter(p => p.status === 'Received').reduce((sum, po) => 
        sum + po.lineItems.reduce((itemSum, item) => itemSum + item.quantity, 0), 0
      ), 
      color: '#8b5cf6' 
    },
    { 
      name: 'Rejected', 
      value: filteredPOs.filter(p => p.status === 'Rejected').reduce((sum, po) => 
        sum + po.lineItems.reduce((itemSum, item) => itemSum + item.quantity, 0), 0
      ), 
      color: '#ef4444' 
    },
  ].filter(item => item.value > 0);

  // Quantity by vendor for bar chart (using filtered data)
  const vendorQuantity = filteredPOs.reduce((acc, po) => {
    const qty = po.lineItems.reduce((sum, item) => sum + item.quantity, 0);
    acc[po.vendorName] = (acc[po.vendorName] || 0) + qty;
    return acc;
  }, {} as Record<string, number>);

  const vendorData = Object.entries(vendorQuantity)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // Recent activity
  const recentPOs = [...pos]
    .sort((a, b) => b.orderDate.toDate().getTime() - a.orderDate.toDate().getTime())
    .slice(0, 5);

  const actionRequired = userData?.role === 'Manager' 
    ? pos.filter(po => po.status === 'Pending').slice(0, 5)
    : [];

  // Chart interaction handlers
  const handleStatusChartClick = (data: any) => {
    if (data && data.activePayload && data.activePayload[0]) {
      const status = data.activePayload[0].payload.name;
      showInfo('Status Filter', `Showing ${status} POs. Click to view details.`);
      // Navigate to POs page with status filter
      router.push(`/pos?status=${status.toLowerCase()}`);
    }
  };

  const handleVendorChartClick = (data: any) => {
    if (data && data.activePayload && data.activePayload[0]) {
      const vendor = data.activePayload[0].payload.name;
      showInfo('Vendor Filter', `Showing POs for ${vendor}. Click to view details.`);
      // Navigate to POs page with vendor filter
      router.push(`/pos?vendor=${encodeURIComponent(vendor)}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <Sidebar />
      
      <div className="pt-16">
        <main className="w-full p-3 sm:p-4 md:p-5">
          {/* Dashboard Header with Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h2 className={getThemeClasses.pageTitle()}>Dashboard Overview</h2>
              <p className={getThemeClasses.description()}>
                Showing {filteredPOs.length} of {pos.length} POs
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              {/* Real-time Controls */}
              <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-lg">
                <button
                  onClick={toggleRealTime}
                  className={`p-1 rounded transition-colors ${
                    isRealTimeActive 
                      ? 'text-green-600 hover:text-green-700' 
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                  title={isRealTimeActive ? 'Real-time updates ON' : 'Real-time updates OFF'}
                >
                  {isRealTimeActive ? <Wifi className={getThemeClasses.icon('small')} /> : <WifiOff className={getThemeClasses.icon('small')} />}
                </button>
                
                <button
                  onClick={forceUpdate}
                  className="p-1 text-gray-600 hover:text-gray-800 transition-colors"
                  title="Refresh now"
                >
                  <RefreshCw className={getThemeClasses.icon('small')} />
                </button>
                
                <span className={`${getThemeClasses.smallText()} ml-1`}>
                  {format(lastUpdate, 'HH:mm')}
                </span>
              </div>

              <DateRangePicker 
                value={dateRange} 
                onChange={setDateRange}
              />
              <AdvancedFilters
                filters={filterConfigs}
                selectedFilters={selectedFilters}
                onFiltersChange={setSelectedFilters}
              />
              <ExportOptions
                data={filteredPOs}
                filename={`po-dashboard-${format(new Date(), 'yyyy-MM-dd')}`}
              />
            </div>
          </div>

          {/* Main KPI Cards - Item Quantities */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4">
            <KpiCard
              title="Total Ordered Qty"
              value={totalItemQty.toLocaleString()}
              icon={Package}
              color="blue"
            />
            <KpiCard
              title="Sent Qty"
              value={sentQty.toLocaleString()}
              icon={Truck}
              color="green"
            />
            <KpiCard
              title="Received Qty"
              value={receivedQty.toLocaleString()}
              icon={CheckCircle}
              color="purple"
            />
            <KpiCard
              title="Pending Qty"
              value={pendingQty.toLocaleString()}
              icon={Clock}
              color="yellow"
            />
          </div>

          {/* Status-wise Quantity Breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-5">
            <KpiCard
              title="Pending Status Qty"
              value={pendingStatusQty.toLocaleString()}
              icon={Clock}
              color="yellow"
            />
            <KpiCard
              title="Approved Status Qty"
              value={approvedStatusQty.toLocaleString()}
              icon={CheckCircle}
              color="green"
            />
            <KpiCard
              title="Shipped Status Qty"
              value={shippedStatusQty.toLocaleString()}
              icon={Truck}
              color="blue"
            />
            <KpiCard
              title="Received Status Qty"
              value={receivedStatusQty.toLocaleString()}
              icon={Package}
              color="purple"
            />
          </div>

          {/* Charts - Quantity Focused */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
            <div className={`${getThemeClasses.card()} ${getThemeClasses.sectionPadding()}`}>
              <h2 className={getThemeClasses.sectionHeading()}>Item Quantity by Status</h2>
              {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart onClick={handleStatusChartClick}>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value, percent }) => `${name}: ${value.toLocaleString()} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      className="cursor-pointer"
                    >
                      {statusData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.color}
                          className="hover:opacity-80 transition-opacity"
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value, name) => [`${Number(value).toLocaleString()} items`, name]}
                      labelFormatter={() => 'Click to filter'}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-gray-500 py-12">No data available</p>
              )}
            </div>

            <div className={`${getThemeClasses.card()} ${getThemeClasses.sectionPadding()}`}>
              <h2 className={getThemeClasses.sectionHeading()}>Item Quantity by Vendor</h2>
              {vendorData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={vendorData} onClick={handleVendorChartClick}>
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value) => [`${Number(value).toLocaleString()} items`, 'Total Quantity']}
                      labelFormatter={(label) => `${label} - Click to filter`}
                    />
                    <Bar 
                      dataKey="value" 
                      fill="#0ea5e9"
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-gray-500 py-12">No data available</p>
              )}
            </div>
          </div>

          {/* Interactive Charts */}
          <div className="mb-5">
            <InteractiveCharts 
              data={filteredPOs} 
              onChartClick={(data) => {
                if (data.type === 'month') {
                  showInfo('Month Filter', `Viewing data for ${data.data.month}`);
                }
              }}
            />
          </div>

          {/* Comparison View */}
          <div className="mb-5">
            <ComparisonView data={pos} period="month" />
          </div>

          {/* Recent Activity & Calendar */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
            <RecentActivity userId={user?.uid} limit={10} showFilters={true} />
            <CalendarIntegration pos={filteredPOs} />
          </div>

          {/* Action Required (for Managers) */}
          {userData?.role === 'Manager' && actionRequired.length > 0 && (
            <div className={`${getThemeClasses.card()} ${getThemeClasses.sectionPadding()} mb-5`}>
              <h2 className={getThemeClasses.sectionHeading()}>Action Required</h2>
              <div className="space-y-4">
                {actionRequired.map((po) => (
                  <Link
                    key={po.id}
                    href={`/pos/${po.id}`}
                    className="block p-4 border border-yellow-200 bg-yellow-50 rounded-lg hover:border-yellow-300 transition"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={getThemeClasses.cardTitle()}>{po.poNumber}</span>
                      <StatusBadge status={po.status} />
                    </div>
                    <div className={getThemeClasses.description()}>
                      <p>{po.vendorName}</p>
                      <p>₹{po.totalAmount.toLocaleString()}</p>
                      <p>Created by: {po.createdBy_name}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Compliance Reports (Admin/Manager only) */}
          {(userData?.role === 'Admin' || userData?.role === 'Manager') && (
            <div className="mb-5">
              <ComplianceReports 
                onGenerateReport={(type, range) => {
                  showSuccess('Report Generated', `${type} report has been downloaded`);
                }}
              />
            </div>
          )}
        </main>
      </div>

    </div>
  );
}
