'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import EnhancedPOTable from '@/components/EnhancedPOTable';
import { getPOs, PurchaseOrder } from '@/lib/firestore';
import { useQuery } from '@tanstack/react-query';
import { Plus, Download, Search, Filter, RefreshCw, Package, Truck, CheckCircle, Clock } from 'lucide-react';
import DataImportExport from '@/components/DataImportExport';
import AdvancedSearch from '@/components/AdvancedSearch';
import AdvancedFilters, { FilterConfig } from '@/components/AdvancedFilters';
import ExportOptions from '@/components/ExportOptions';
import ExcelExportButton from '@/components/ExcelExportButton';
import Pagination, { usePagination } from '@/components/Pagination';
import ModernButton from '@/components/ModernButton';
import { getThemeClasses } from '@/styles/theme';

/**
* Renders the purchase order dashboard with filters, KPIs, tables, pagination, and supporting modals while handling authentication gating and data refreshing.
* @example
* PosPage()
* <div>...</div>
* @param {void} none - This component does not accept props.
* @returns {JSX.Element} Rendered purchase order page layout with navigation, filters, summary cards, and data tables.
**/
export default function PosPage() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({});

  // Use React Query for POs with caching
  const { 
    data: pos = [], 
    isLoading: loadingData, 
    refetch,
    isFetching: isRefreshing 
  } = useQuery({
    queryKey: ['pos', user?.uid, userData?.role],
    queryFn: () => getPOs(user?.uid, userData?.role, 100),
    enabled: !!user && !!userData,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Filter configurations
  const filterConfigs: FilterConfig[] = useMemo(() => {
    const statuses = [...new Set(pos.map(po => po.status))];
    const vendors = [...new Set(pos.map(po => po.vendorName))];
    
    return [
      {
        key: 'status',
        label: 'Status',
        multiSelect: true,
        options: statuses.map(status => ({
          value: status,
          label: status,
          count: pos.filter(po => po.status === status).length
        }))
      },
      {
        key: 'vendor',
        label: 'Vendor',
        multiSelect: true,
        options: vendors.map(vendor => ({
          value: vendor,
          label: vendor,
          count: pos.filter(po => po.vendorName === vendor).length
        }))
      }
    ];
  }, [pos]);

  // Apply filters
  const filteredPOs = useMemo(() => {
    return pos.filter(po => {
      // Status filter
      if (selectedFilters.status?.length > 0) {
        if (!selectedFilters.status.includes(po.status)) return false;
      }
      
      // Vendor filter
      if (selectedFilters.vendor?.length > 0) {
        if (!selectedFilters.vendor.includes(po.vendorName)) return false;
      }
      
      return true;
    });
  }, [pos, selectedFilters]);

  // Pagination
  const {
    currentPage,
    totalPages,
    itemsPerPage,
    paginatedItems: paginatedPOs,
    totalItems,
    setCurrentPage,
    setItemsPerPage
  } = usePagination(filteredPOs, 25);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const handleRefresh = () => {
    refetch();
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full size-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <Sidebar />
      
      <div className="pt-16">
        <main className={`w-full ${getThemeClasses.pagePadding()}`}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className={getThemeClasses.pageTitle()}>Purchase Orders</h1>
              <p className="text-sm text-gray-600 mt-1">
                {filteredPOs.length} {filteredPOs.length !== pos.length && `of ${pos.length}`} orders
                {Object.values(selectedFilters).some(arr => arr.length > 0) && ' (filtered)'}
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Refresh Button */}
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                title="Refresh data"
              >
                <RefreshCw className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>

              {/* Search Input */}
              <div className="w-64">
                <ModernButton
                  variant="search"
                  icon={Search}
                  onClick={() => setShowAdvancedSearch(true)}
                  className="cursor-pointer"
                >
                  Search
                </ModernButton>
              </div>

              {/* Advanced Filters */}
              <AdvancedFilters
                filters={filterConfigs}
                selectedFilters={selectedFilters}
                onFiltersChange={setSelectedFilters}
              />

              {/* Excel Export */}
              <ExcelExportButton
                pos={pos}
                filteredPOs={filteredPOs}
                filters={selectedFilters}
                variant="dropdown"
                size="md"
              />

              {/* Export Options */}
              <ExportOptions
                data={filteredPOs}
                filename={`purchase-orders-${new Date().toISOString().split('T')[0]}`}
              />

              {/* Import/Export Button */}
              {(userData?.role === 'Admin' || userData?.role === 'Manager') && (
                <ModernButton
                  variant="secondary"
                  icon={Download}
                  onClick={() => setShowImportExport(true)}
                >
                  Import
                </ModernButton>
              )}

              {/* Add PO Button */}
              <Link href="/pos/new">
                <ModernButton
                  variant="primary"
                  icon={Plus}
                >
                  New PO
                </ModernButton>
              </Link>
            </div>
          </div>

          {/* PO Summary Cards */}
          {filteredPOs.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
              {/* Total Ordered Qty */}
              <div className={`${getThemeClasses.card()} ${getThemeClasses.cardPadding()} flex items-center gap-3 hover:shadow-md transition-shadow duration-200`}>
                <div className="p-2 sm:p-2.5 rounded-full bg-blue-50 text-blue-600 shrink-0">
                  <Package className={getThemeClasses.icon('medium')} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`${getThemeClasses.kpiTitle()} truncate`}>Total Ordered Qty</p>
                  <p className={`${getThemeClasses.kpiValue()} mt-1`}>
                    {filteredPOs.reduce((sum, po) => sum + po.lineItems.reduce((itemSum, item) => itemSum + item.quantity, 0), 0).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Sent Qty */}
              <div className={`${getThemeClasses.card()} ${getThemeClasses.cardPadding()} flex items-center gap-3 hover:shadow-md transition-shadow duration-200`}>
                <div className="p-2 sm:p-2.5 rounded-full bg-green-50 text-green-600 shrink-0">
                  <Truck className={getThemeClasses.icon('medium')} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`${getThemeClasses.kpiTitle()} truncate`}>Sent Qty</p>
                  <p className={`${getThemeClasses.kpiValue()} mt-1 text-green-600`}>
                    {filteredPOs.reduce((sum, po) => sum + po.lineItems.reduce((itemSum, item) => itemSum + (item.sentQty || 0), 0), 0).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Received Qty */}
              <div className={`${getThemeClasses.card()} ${getThemeClasses.cardPadding()} flex items-center gap-3 hover:shadow-md transition-shadow duration-200`}>
                <div className="p-2 sm:p-2.5 rounded-full bg-blue-50 text-blue-600 shrink-0">
                  <CheckCircle className={getThemeClasses.icon('medium')} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`${getThemeClasses.kpiTitle()} truncate`}>Received Qty</p>
                  <p className={`${getThemeClasses.kpiValue()} mt-1 text-blue-600`}>
                    {filteredPOs.reduce((sum, po) => sum + po.lineItems.reduce((itemSum, item) => itemSum + (item.receivedQty || 0), 0), 0).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Pending Qty */}
              <div className={`${getThemeClasses.card()} ${getThemeClasses.cardPadding()} flex items-center gap-3 hover:shadow-md transition-shadow duration-200`}>
                <div className="p-2 sm:p-2.5 rounded-full bg-orange-50 text-orange-600 shrink-0">
                  <Clock className={getThemeClasses.icon('medium')} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`${getThemeClasses.kpiTitle()} truncate`}>Pending Qty</p>
                  <p className={`${getThemeClasses.kpiValue()} mt-1 text-orange-600`}>
                    {filteredPOs.reduce((sum, po) => sum + po.lineItems.reduce((itemSum, item) => itemSum + (item.pendingQty || (item.quantity - (item.sentQty || 0))), 0), 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Empty State */}
          {filteredPOs.length === 0 && pos.length > 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <Filter className="size-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No matching orders</h3>
              <p className="text-gray-600 mb-4">Try adjusting your filters</p>
              <button
                onClick={() => setSelectedFilters({})}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <EnhancedPOTable pos={paginatedPOs} onRefresh={() => refetch()} />
          )}

          {/* Pagination */}
          {pos.length > 0 && (
            <div className="mt-8">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
              />
            </div>
          )}
        </main>

        {/* Advanced Search Modal */}
        <AdvancedSearch
          isOpen={showAdvancedSearch}
          onClose={() => setShowAdvancedSearch(false)}
          pos={pos}
        />

        {/* Import/Export Modal */}
        <DataImportExport
          type="pos"
          isOpen={showImportExport}
          onClose={() => setShowImportExport(false)}
          onImportComplete={() => refetch()}
        />
      </div>
    </div>
  );
}
