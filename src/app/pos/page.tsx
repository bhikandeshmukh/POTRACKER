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
import { Plus, Download, Search, Filter, RefreshCw } from 'lucide-react';
import DataImportExport from '@/components/DataImportExport';
import AdvancedSearch from '@/components/AdvancedSearch';
import AdvancedFilters, { FilterConfig } from '@/components/AdvancedFilters';
import ExportOptions from '@/components/ExportOptions';
import Pagination, { usePagination } from '@/components/Pagination';
import { getThemeClasses } from '@/styles/theme';

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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
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
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>

              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search"
                  onClick={() => setShowAdvancedSearch(true)}
                  readOnly
                  className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer hover:border-gray-400 transition-colors w-48"
                />
              </div>

              {/* Advanced Filters */}
              <AdvancedFilters
                filters={filterConfigs}
                selectedFilters={selectedFilters}
                onFiltersChange={setSelectedFilters}
              />

              {/* Export Options */}
              <ExportOptions
                data={filteredPOs}
                filename={`purchase-orders-${new Date().toISOString().split('T')[0]}`}
              />

              {/* Import/Export Button */}
              {(userData?.role === 'Admin' || userData?.role === 'Manager') && (
                <button
                  onClick={() => setShowImportExport(true)}
                  className={`flex items-center space-x-2 ${getThemeClasses.buttonPadding()} ${getThemeClasses.button('secondary')}`}
                >
                  <Download className={getThemeClasses.icon('small')} />
                  <span>Import</span>
                </button>
              )}

              {/* Add PO Button */}
              <Link
                href="/pos/new"
                className={`flex items-center space-x-2 ${getThemeClasses.buttonPadding()} ${getThemeClasses.button('primary')}`}
              >
                <Plus className={getThemeClasses.icon('medium')} />
                <span>New PO</span>
              </Link>
            </div>
          </div>

          {/* Empty State */}
          {filteredPOs.length === 0 && pos.length > 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <Filter className="w-12 h-12 text-gray-400 mx-auto mb-4" />
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
