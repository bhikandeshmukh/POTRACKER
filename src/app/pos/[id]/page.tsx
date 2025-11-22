'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import StatusBadge from '@/components/StatusBadge';
import { poService } from '@/lib/services';
import { PurchaseOrder } from '@/lib/types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CheckCircle, XCircle, Truck, Package, Mail, ChevronLeft, ChevronRight, Settings, Eye, EyeOff, RotateCcw, Clock } from 'lucide-react';
import CommentsSystem from '@/components/CommentsSystem';
import EmailIntegration from '@/components/EmailIntegration';
import ShipmentManagement from '@/components/ShipmentManagement';
import ExcelExportButton from '@/components/ExcelExportButton';
import KpiCard from '@/components/KpiCard';
import { getThemeClasses } from '@/styles/theme';

export default function PoDetailPage() {
  // ALL HOOKS MUST BE AT THE TOP - NO EXCEPTIONS
  const { user, userData, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const [updating, setUpdating] = useState(false);

  // Use React Query for PO data with caching
  const { data: poResult, isLoading: loadingData, refetch } = useQuery({
    queryKey: ['po', params.id],
    queryFn: async () => {
      const result = await poService.findById(params.id as string);
      return result.success ? result.data : null;
    },
    enabled: !!params.id,
    staleTime: 2 * 60 * 1000, // 2 minutes for detail page
  });

  const po = poResult;

  // Mutation for updating PO status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ poId, status }: { poId: string; status: PurchaseOrder['status'] }) => {
      if (!userData || !userData.uid || !userData.name || !userData.role) {
        throw new Error('User not authenticated or missing required data');
      }
      
      const result = await poService.updateStatus(
        poId,
        status,
        {
          uid: userData.uid,
          name: userData.name,
          role: userData.role
        }
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update status');
      }
      
      return result.data;
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['po', params.id] });
      queryClient.invalidateQueries({ queryKey: ['pos'] });
      refetch();
    },
  });
  const [showEmailModal, setShowEmailModal] = useState(false);
  
  // Table controls
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [showAllRows, setShowAllRows] = useState(false);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [rowHeight, setRowHeight] = useState(40); // Default row height in pixels
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [resizing, setResizing] = useState<{ column: string; startX: number; startWidth: number } | null>(null);

  // Column resize handlers - ALL useCallback hooks here
  const handleMouseDown = useCallback((e: React.MouseEvent, columnKey: string) => {
    e.preventDefault();
    const startX = e.clientX;
    const columns = [
      { key: 'poNumber', label: 'PO Number', minWidth: 120 },
      { key: 'vendorName', label: 'Vendor Name', minWidth: 180 },
      { key: 'orderDate', label: 'Order Date', minWidth: 100 },
      { key: 'deliveryDate', label: 'Delivery Date', minWidth: 100 },
      { key: 'status', label: 'Status', minWidth: 80 },
      { key: 'barcode', label: 'Barcode', minWidth: 120 },
      { key: 'sku', label: 'SKU', minWidth: 80 },
      { key: 'size', label: 'Size', minWidth: 80 },
      { key: 'orderQty', label: 'Order Qty', minWidth: 80 },
      { key: 'itemPrice', label: 'Item Price', minWidth: 100 },
      { key: 'sentQty', label: 'Sent Qty', minWidth: 80 },
      { key: 'pendingQty', label: 'Pending Qty', minWidth: 80 },
      { key: 'lineTotal', label: 'Line Total', minWidth: 100 }
    ];
    const column = columns.find(c => c.key === columnKey);
    const startWidth = columnWidths[columnKey] || column?.minWidth || 100;
    
    setResizing({ column: columnKey, startX, startWidth });
  }, [columnWidths]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!resizing) return;
    
    const deltaX = e.clientX - resizing.startX;
    const newWidth = Math.max(50, resizing.startWidth + deltaX); // Minimum 50px
    
    setColumnWidths(prev => ({
      ...prev,
      [resizing.column]: newWidth
    }));
  }, [resizing]);

  const handleMouseUp = useCallback(() => {
    setResizing(null);
  }, []);

  // ALL useEffect hooks here
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // React Query handles data loading automatically

  // Add event listeners for resize
  useEffect(() => {
    if (resizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [resizing, handleMouseMove, handleMouseUp]);

  // REGULAR FUNCTIONS AFTER ALL HOOKS
  const handleStatusUpdate = async (status: PurchaseOrder['status']) => {
    if (!po || !user || !userData) return;
    
    const oldStatus = po.status;
    const reason = status === 'Rejected' ? prompt('Please provide a reason for rejection:') : undefined;
    
    if (status === 'Rejected' && !reason) {
      return; // User cancelled
    }
    
    setUpdating(true);
    try {
      await updateStatusMutation.mutateAsync({
        poId: po.id || params.id as string,
        status,
      });

      // Audit logging is now handled automatically by the service
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
    } finally {
      setUpdating(false);
    }
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

  if (!po) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Purchase Order not found</p>
      </div>
    );
  }

  // Static columns definition
  const columns = [
    { key: 'poNumber', label: 'PO Number', minWidth: 120 },
    { key: 'vendorName', label: 'Vendor Name', minWidth: 180 },
    { key: 'orderDate', label: 'Order Date', minWidth: 100 },
    { key: 'deliveryDate', label: 'Delivery Date', minWidth: 100 },
    { key: 'status', label: 'Status', minWidth: 80 },
    { key: 'warehouse', label: 'Warehouse', minWidth: 120 },
    { key: 'itemName', label: 'Item Name', minWidth: 200 },
    { key: 'barcode', label: 'Barcode', minWidth: 120 },
    { key: 'sku', label: 'SKU', minWidth: 80 },
    { key: 'size', label: 'Size', minWidth: 80 },
    { key: 'orderQty', label: 'Order Qty', minWidth: 80 },
    { key: 'itemPrice', label: 'Item Price', minWidth: 100 },
    { key: 'sentQty', label: 'Sent Qty', minWidth: 80 },
    { key: 'pendingQty', label: 'Pending Qty', minWidth: 80 },
    { key: 'lineTotal', label: 'Line Total', minWidth: 100 }
  ];

  // Helper functions
  const toggleColumn = (columnKey: string) => {
    const newHiddenColumns = new Set(hiddenColumns);
    if (newHiddenColumns.has(columnKey)) {
      newHiddenColumns.delete(columnKey);
    } else {
      newHiddenColumns.add(columnKey);
    }
    setHiddenColumns(newHiddenColumns);
  };

  const resetTableSettings = () => {
    setHiddenColumns(new Set());
    setColumnWidths({});
    setRowHeight(40);
    setRowsPerPage(10);
    setCurrentPage(1);
    setShowAllRows(false);
  };

  const getCellStyle = (columnKey: string, textAlign: 'left' | 'right' | 'center' = 'left') => {
    const column = columns.find(c => c.key === columnKey);
    const width = columnWidths[columnKey] || column?.minWidth || 100;
    
    return {
      height: `${rowHeight}px`,
      lineHeight: `${rowHeight-10}px`,
      width: width,
      maxWidth: width,
      textAlign: textAlign as any
    };
  };

  // Component logic
  const canApprove = userData?.role === 'Manager' && po?.status === 'Pending';
  const canUpdateShipping = userData?.role === 'Manager' && 
    (po?.status === 'Approved' || po?.status === 'Shipped');

  // Pagination logic - only calculate if po exists
  const totalRows = po?.lineItems?.length || 0;
  const totalPages = Math.ceil(totalRows / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = showAllRows ? totalRows : Math.min(startIndex + rowsPerPage, totalRows);
  const visibleItems = showAllRows ? (po?.lineItems || []) : (po?.lineItems?.slice(startIndex, endIndex) || []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <Sidebar />
      
      <div className="pt-16">
        <main className={`w-full ${getThemeClasses.pagePadding()}`}>
          {/* Header with Status and Actions */}
          <div className={`flex items-center justify-between ${getThemeClasses.sectionMargin()}`}>
            <div className="flex items-center space-x-4">
              <h1 className={getThemeClasses.pageTitle()}>Purchase Order Details</h1>
              <StatusBadge status={po.status} />
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center space-x-3">
              {/* Excel Export Button */}
              <ExcelExportButton
                po={po}
                variant="single"
                size="md"
              />

              <button
                onClick={() => setShowEmailModal(true)}
                className={`flex items-center space-x-2 ${getThemeClasses.buttonPadding()} ${getThemeClasses.button('primary')}`}
              >
                <Mail className={getThemeClasses.icon('small')} />
                <span>Send Email</span>
              </button>

              {canApprove && (
                <>
                  <button
                    onClick={() => handleStatusUpdate('Approved')}
                    disabled={updating}
                    className={`flex items-center space-x-2 ${getThemeClasses.buttonPadding()} ${getThemeClasses.button('success')} disabled:bg-gray-400`}
                  >
                    <CheckCircle className={getThemeClasses.icon('small')} />
                    <span>Approve</span>
                  </button>
                  <button
                    onClick={() => handleStatusUpdate('Rejected')}
                    disabled={updating}
                    className={`flex items-center space-x-2 ${getThemeClasses.buttonPadding()} ${getThemeClasses.button('danger')} disabled:bg-gray-400`}
                  >
                    <XCircle className={getThemeClasses.icon('small')} />
                    <span>Reject</span>
                  </button>
                </>
              )}
              
              {canUpdateShipping && po.status === 'Approved' && (
                <button
                  onClick={() => handleStatusUpdate('Shipped')}
                  disabled={updating}
                  className={`flex items-center space-x-2 ${getThemeClasses.buttonPadding()} ${getThemeClasses.button('primary')} disabled:bg-gray-400`}
                >
                  <Truck className={getThemeClasses.icon('small')} />
                  <span>Mark as Shipped</span>
                </button>
              )}
              
              {canUpdateShipping && po.status === 'Shipped' && (
                <button
                  onClick={() => handleStatusUpdate('Received')}
                  disabled={updating}
                  className={`flex items-center space-x-2 ${getThemeClasses.buttonPadding()} bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:bg-gray-400`}
                >
                  <Package className={getThemeClasses.icon('small')} />
                  <span>Mark as Received</span>
                </button>
              )}
            </div>
          </div>

          {/* PO Summary Cards */}
          {po && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-5">
              <KpiCard
                title="Total Quantity"
                value={po.lineItems?.reduce((sum, item) => sum + (item.quantity || 0), 0).toLocaleString()}
                icon={Package}
                color="blue"
              />
              <KpiCard
                title="Sent Quantity"
                value={po.lineItems?.reduce((sum, item) => sum + (item.sentQty || 0), 0).toLocaleString()}
                icon={Truck}
                color="green"
              />
              <KpiCard
                title="Pending Quantity"
                value={po.lineItems?.reduce((sum, item) => sum + ((item.quantity || 0) - (item.sentQty || 0)), 0).toLocaleString()}
                icon={Clock}
                color="orange"
              />
              <KpiCard
                title="Delivered Quantity"
                value={po.lineItems?.reduce((sum, item) => sum + (item.receivedQty || 0), 0).toLocaleString()}
                icon={CheckCircle}
                color="purple"
              />
            </div>
          )}

          {/* Table Controls */}
          <div className={`${getThemeClasses.card()} ${getThemeClasses.cardPadding()} ${getThemeClasses.sectionMargin()}`}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <h3 className={getThemeClasses.cardTitle()}>Table Controls</h3>
                
                {/* Rows per page */}
                <div className="flex items-center space-x-2">
                  <label className={getThemeClasses.description()}>Rows:</label>
                  <select
                    value={rowsPerPage}
                    onChange={(e) => {
                      setRowsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                      setShowAllRows(false);
                    }}
                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>

                {/* Show all toggle */}
                <button
                  onClick={() => setShowAllRows(!showAllRows)}
                  className={`flex items-center space-x-1 px-3 py-1 rounded text-sm ${
                    showAllRows 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {showAllRows ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{showAllRows ? 'Show Pages' : 'Show All'}</span>
                </button>

                {/* Row height */}
                <div className="flex items-center space-x-2">
                  <label className={getThemeClasses.description()}>Height:</label>
                  <input
                    type="range"
                    min="30"
                    max="80"
                    value={rowHeight}
                    onChange={(e) => setRowHeight(Number(e.target.value))}
                    className="w-20"
                  />
                  <span className={getThemeClasses.smallText()}>{rowHeight}px</span>
                </div>

                {/* Column width info */}
                {Object.keys(columnWidths).length > 0 && (
                  <div className="text-xs text-gray-500">
                    Resized: {Object.keys(columnWidths).length} columns
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2">
                {/* Column visibility */}
                <div className="relative group">
                  <button className={`flex items-center space-x-1 ${getThemeClasses.smallButtonPadding()} ${getThemeClasses.button('secondary')}`}>
                    <Settings className={getThemeClasses.icon('small')} />
                    <span>Columns</span>
                  </button>
                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 min-w-[200px] z-10 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                    <div className="grid grid-cols-2 gap-1">
                      {columns.map((column) => (
                        <label key={column.key} className="flex items-center space-x-2 text-sm hover:bg-gray-50 p-1 rounded">
                          <input
                            type="checkbox"
                            checked={!hiddenColumns.has(column.key)}
                            onChange={() => toggleColumn(column.key)}
                            className="w-3 h-3"
                          />
                          <span className="truncate">{column.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Reset button */}
                <button
                  onClick={resetTableSettings}
                  className="flex items-center space-x-1 px-3 py-1 bg-gray-100 text-gray-600 rounded text-sm hover:bg-gray-200"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            {/* Pagination info */}
            {!showAllRows && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
                <div className={getThemeClasses.description()}>
                  Showing {startIndex + 1} to {endIndex} of {totalRows} items
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="p-1 rounded border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    <ChevronLeft className={getThemeClasses.icon('small')} />
                  </button>
                  
                  <span className={getThemeClasses.description()}>
                    Page {currentPage} of {totalPages}
                  </span>
                  
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1 rounded border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    <ChevronRight className={getThemeClasses.icon('small')} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Excel-like Table */}
          <div className={`${getThemeClasses.card()} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                {/* Header Row */}
                <thead>
                  <tr className="bg-blue-50 border-b-2 border-blue-200">
                    <th className="w-12 px-3 py-3 text-xs font-medium text-gray-500 bg-gray-100 border-r border-gray-300 text-center">
                      #
                    </th>
                    {columns.map((column) => (
                      !hiddenColumns.has(column.key) && (
                        <th 
                          key={column.key}
                          className="relative px-4 py-3 text-left text-xs font-semibold text-blue-900 uppercase tracking-wider border-r border-blue-200 bg-blue-50 select-none"
                          style={{ 
                            width: columnWidths[column.key] || column.minWidth,
                            minWidth: 50
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="truncate">{column.label}</span>
                            
                            {/* Resize handle */}
                            <div
                              className={`absolute right-0 top-0 bottom-0 w-2 cursor-col-resize transition-colors ${
                                resizing?.column === column.key 
                                  ? 'bg-blue-500' 
                                  : 'hover:bg-blue-300 bg-transparent'
                              }`}
                              onMouseDown={(e) => handleMouseDown(e, column.key)}
                              title="Drag to resize column"
                            >
                              <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-1 h-4 bg-gray-400 rounded-full opacity-0 hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                        </th>
                      )
                    ))}
                  </tr>
                </thead>
                
                {/* Data Rows */}
                <tbody className="bg-white">
                  {visibleItems.map((item, index) => {
                    const actualIndex = showAllRows ? index : startIndex + index;
                    return (
                      <tr 
                        key={actualIndex} 
                        className={`border-b border-gray-200 hover:bg-gray-50 ${
                          actualIndex % 2 === 0 ? 'bg-white' : 'bg-gray-25'
                        }`}
                        style={{ height: `${rowHeight}px` }}
                      >
                        {/* Row Number */}
                        <td className="w-12 px-3 text-xs text-gray-500 bg-gray-50 border-r border-gray-300 text-center font-medium"
                            style={{ height: `${rowHeight}px`, lineHeight: `${rowHeight-10}px` }}>
                          {actualIndex + 1}
                        </td>
                        
                        {/* Dynamic Columns */}
                        {!hiddenColumns.has('poNumber') && (
                          <td className="px-4 text-sm text-gray-900 border-r border-gray-200 font-medium overflow-hidden"
                              style={getCellStyle('poNumber')}>
                            <div className="truncate">{po.poNumber}</div>
                          </td>
                        )}
                        
                        {!hiddenColumns.has('vendorName') && (
                          <td className="px-4 text-sm text-gray-900 border-r border-gray-200 overflow-hidden"
                              style={getCellStyle('vendorName')}>
                            <div className="truncate">{po.vendorName}</div>
                          </td>
                        )}
                        
                        {!hiddenColumns.has('orderDate') && (
                          <td className="px-4 text-sm text-gray-900 border-r border-gray-200 overflow-hidden"
                              style={getCellStyle('orderDate')}>
                            <div className="truncate">
                              {po.orderDate?.toDate ? format(po.orderDate.toDate(), 'dd/MM/yyyy') : '-'}
                            </div>
                          </td>
                        )}
                        
                        {!hiddenColumns.has('deliveryDate') && (
                          <td className="px-4 text-sm text-gray-900 border-r border-gray-200 overflow-hidden"
                              style={getCellStyle('deliveryDate')}>
                            <div className="truncate">
                              {po.expectedDeliveryDate?.toDate ? format(po.expectedDeliveryDate.toDate(), 'dd/MM/yyyy') : '-'}
                            </div>
                          </td>
                        )}
                        
                        {!hiddenColumns.has('status') && (
                          <td className="px-4 text-sm border-r border-gray-200 overflow-hidden"
                              style={getCellStyle('status', 'center')}>
                            <div className="flex items-center justify-center" style={{ height: `${rowHeight}px` }}>
                              <StatusBadge status={po.status} />
                            </div>
                          </td>
                        )}
                        
                        {!hiddenColumns.has('warehouse') && (
                          <td className="px-4 text-sm text-gray-900 border-r border-gray-200 overflow-hidden"
                              style={getCellStyle('warehouse')}>
                            <div className="truncate">{item.warehouse || 'Main Warehouse'}</div>
                          </td>
                        )}
                        
                        {!hiddenColumns.has('itemName') && (
                          <td className="px-4 text-sm text-gray-900 border-r border-gray-200 overflow-hidden"
                              style={getCellStyle('itemName')}>
                            <div className="truncate" title={item.itemName}>
                              {item.itemName}
                            </div>
                          </td>
                        )}
                        
                        {!hiddenColumns.has('barcode') && (
                          <td className="px-4 text-sm text-gray-900 border-r border-gray-200 font-mono overflow-hidden"
                              style={getCellStyle('barcode')}>
                            <div className="truncate">{item.barcode || '-'}</div>
                          </td>
                        )}
                        
                        {!hiddenColumns.has('sku') && (
                          <td className="px-4 text-sm text-gray-900 border-r border-gray-200 font-mono overflow-hidden"
                              style={getCellStyle('sku')}>
                            <div className="truncate">{item.sku || '-'}</div>
                          </td>
                        )}
                        
                        {!hiddenColumns.has('size') && (
                          <td className="px-4 text-sm text-gray-900 border-r border-gray-200 overflow-hidden"
                              style={getCellStyle('size')}>
                            <div className="truncate">{item.size || '-'}</div>
                          </td>
                        )}
                        
                        {!hiddenColumns.has('orderQty') && (
                          <td className="px-4 text-sm text-gray-900 border-r border-gray-200 overflow-hidden"
                              style={getCellStyle('orderQty', 'right')}>
                            <div className="truncate">{item.quantity}</div>
                          </td>
                        )}
                        
                        {!hiddenColumns.has('itemPrice') && (
                          <td className="px-4 text-sm text-gray-900 border-r border-gray-200 overflow-hidden"
                              style={getCellStyle('itemPrice', 'right')}>
                            <div className="truncate">₹{item.unitPrice.toLocaleString()}</div>
                          </td>
                        )}
                        
                        {!hiddenColumns.has('sentQty') && (
                          <td className="px-4 text-sm text-gray-900 border-r border-gray-200 overflow-hidden"
                              style={getCellStyle('sentQty', 'right')}>
                            <div className="truncate">{item.sentQty || 0}</div>
                          </td>
                        )}
                        
                        {!hiddenColumns.has('pendingQty') && (
                          <td className="px-4 text-sm text-gray-900 border-r border-gray-200 overflow-hidden"
                              style={getCellStyle('pendingQty', 'right')}>
                            <div className="truncate">{item.pendingQty || item.quantity}</div>
                          </td>
                        )}
                        
                        {!hiddenColumns.has('lineTotal') && (
                          <td className="px-4 text-sm font-medium text-gray-900 overflow-hidden"
                              style={getCellStyle('lineTotal', 'right')}>
                            <div className="truncate">₹{item.total.toLocaleString()}</div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                
                {/* Summary Row */}
                <tfoot>
                  <tr className="bg-gray-100 border-t-2 border-gray-300">
                    <td colSpan={14} className="px-4 py-3 text-sm font-semibold text-gray-900 text-right border-r border-gray-300">
                      Total Amount:
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                      ₹{po.totalAmount.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Additional Info */}
          <div className={`mt-6 ${getThemeClasses.card()} ${getThemeClasses.cardPadding()}`}>
            <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${getThemeClasses.description()}`}>
              <div>
                <span className="font-medium text-gray-600">Created By:</span>
                <span className="ml-2 text-gray-900">{po.createdBy_name}</span>
              </div>
              <div>
                <span className="font-medium text-gray-600">Vendor ID:</span>
                <span className="ml-2 text-gray-900 font-mono">{po.vendorId}</span>
              </div>
              <div>
                <span className="font-medium text-gray-600">Total Items:</span>
                <span className="ml-2 text-gray-900">{po.lineItems.length}</span>
              </div>
            </div>
          </div>

          {/* Shipment Management */}
          {(po.status === 'Approved' || po.status === 'Partial' || po.status === 'Shipped') && (
            <div className="mt-6">
              <ShipmentManagement po={po} onUpdate={() => refetch()} />
            </div>
          )}

          {/* Comments System */}
          <CommentsSystem poId={po.id!} className="mt-6" />
        </main>

        {/* Email Modal */}
        {showEmailModal && (
          <EmailIntegration
            po={po}
            isOpen={showEmailModal}
            onClose={() => setShowEmailModal(false)}
          />
        )}
      </div>
    </div>
  );
}
