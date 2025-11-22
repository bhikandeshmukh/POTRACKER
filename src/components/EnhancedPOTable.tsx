'use client';

import React, { useState } from 'react';
import { PurchaseOrder } from '@/lib/firestore';
import StatusBadge from './StatusBadge';
import { format } from 'date-fns';
import { Package, BarChart3, QrCode, Check, X, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ToastContainer';
import { poService } from '@/lib/services';

interface EnhancedPOTableProps {
  pos: PurchaseOrder[];
  onRefresh: () => void;
}

/**
* Renders an interactive list of purchase orders with expandable details and action buttons.
* @example
* EnhancedPOTable({ pos: samplePosList, onRefresh: () => {} })
* <div>...</div>
* @param {{EnhancedPOTableProps}} {{props}} - Props containing purchase order data and a refresh callback.
* @returns {{JSX.Element | null}} Rendered enhanced purchase order table or an empty state placeholder.
**/
export default function EnhancedPOTable({ pos, onRefresh }: EnhancedPOTableProps) {
  const [expandedPO, setExpandedPO] = useState<string | null>(null);
  const [processingPO, setProcessingPO] = useState<string | null>(null);
  const router = useRouter();
  const { user, userData } = useAuth();
  const { showSuccess, showError } = useToast();

  const toggleExpanded = (poId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedPO(expandedPO === poId ? null : poId);
  };

  const handleCardClick = (poId: string) => {
    router.push(`/pos/${poId}`);
  };

  /**
  * Syncs purchase order status after user confirmation and handles UI feedback.
  * @example
  * sync('po123', 'Approved', event)
  * undefined
  * @param {{string}} poId - Purchase order identifier for the status update.
  * @param {{'Approved'|'Rejected'}} status - Desired status to transition the purchase order to.
  * @param {{React.MouseEvent}} e - Mouse event to stop propagation and trigger confirmation dialog.
  * @returns {{void}} void
  **/
  const handleStatusChange = async (poId: string, status: 'Approved' | 'Rejected', e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!user || !userData) return;
    
    const confirmMessage = `Are you sure you want to ${status.toLowerCase()} this PO?`;
    // eslint-disable-next-line no-alert
    if (!confirm(confirmMessage)) return;

    setProcessingPO(poId);
    
    try {
      console.log('Updating PO status:', { poId, status, user: user.uid, userData: userData.name });
      
      const result = await poService.updateStatus(
        poId,
        status,
        {
          uid: user.uid, // Use Firebase Auth UID instead of userData.uid
          name: userData.name,
          role: userData.role
        }
      );

      if (result.success) {
        showSuccess(
          `PO ${status}`,
          `Purchase Order has been ${status.toLowerCase()} successfully`
        );
        onRefresh();
      } else {
        showError('Error', result.error || `Failed to ${status.toLowerCase()} PO`);
      }
    } catch (error) {
      showError('Error', `Failed to ${status.toLowerCase()} PO`);
    } finally {
      setProcessingPO(null);
    }
  };

  /**
  * Computes aggregate quantities and progress percentage from line items.
  * @example
  * calculateLineItemProgress([{ quantity: 10, sentQty: 5, pendingQty: 5 }])
  * { totalQty: 10, sentQty: 5, pendingQty: 5, progressPercentage: 50 }
  * @param {{any[]}} lineItems - Array of line item objects with quantity fields.
  * @returns {{object}} Return contains total, sent, pending quantities and progress percentage.
  **/
  const calculatePOProgress = (lineItems: any[]) => {
    const totalQty = lineItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const sentQty = lineItems.reduce((sum, item) => sum + (item.sentQty || 0), 0);
    const pendingQty = lineItems.reduce((sum, item) => sum + (item.pendingQty || 0), 0);
    
    return {
      totalQty,
      sentQty,
      pendingQty,
      progressPercentage: totalQty > 0 ? Math.round((sentQty / totalQty) * 100) : 0
    };
  };

  const getProgressColor = (percentage: number) => {
    if (percentage === 0) return 'bg-gray-200';
    if (percentage < 50) return 'bg-red-400';
    if (percentage < 100) return 'bg-yellow-400';
    return 'bg-green-400';
  };

  if (pos.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <Package className="size-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">No purchase orders found</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pos.map((po) => {
        const progress = calculatePOProgress(po.lineItems);
        const isExpanded = expandedPO === po.id;
        
        return (
          <div 
            key={po.id} 
            onClick={() => handleCardClick(po.id!)}
            className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer"
          >
            {/* Main PO Card */}
            <div className="p-5">
              <div className="flex items-start justify-between">
                {/* Left: PO Details */}
                <div className="flex items-start space-x-4 flex-1">
                  <button
                    onClick={(e) => toggleExpanded(po.id!, e)}
                    className="mt-1 p-1.5 hover:bg-gray-100 rounded transition-colors"
                  >
                    <BarChart3 className={`size-4 text-gray-500 transition-transform ${
                      isExpanded ? 'rotate-90' : ''
                    }`} />
                  </button>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-base font-semibold text-gray-900">{po.poNumber}</h3>
                      <StatusBadge status={po.status} />
                    </div>
                    <p className="text-sm text-gray-600 mb-1">{po.vendorName}</p>
                    <p className="text-xs text-gray-500">{po.lineItems.length} items</p>
                  </div>
                </div>

                {/* Center: Dates */}
                <div className="px-6 text-sm">
                  <div className="mb-2">
                    <span className="text-gray-500">Order: </span>
                    <span className="text-gray-900">{format(po.orderDate.toDate(), 'MMM dd, yyyy')}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Delivery: </span>
                    <span className="text-gray-900">{format(po.expectedDeliveryDate.toDate(), 'MMM dd, yyyy')}</span>
                  </div>
                </div>

                {/* Center-Right: Progress */}
                <div className="px-6 min-w-[200px]">
                  <div className="mb-2">
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1.5">
                      <span className="font-medium">Progress</span>
                      <span className="font-semibold">{progress.progressPercentage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(progress.progressPercentage)}`}
                        style={{ width: `${progress.progressPercentage}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Sent: <span className="font-medium text-gray-700">{progress.sentQty}</span></span>
                    <span className="text-gray-500">Pending: <span className="font-medium text-gray-700">{progress.pendingQty}</span></span>
                  </div>
                </div>

                {/* Right: Amount */}
                <div className="text-right pl-6">
                  <div className="text-lg font-bold text-gray-900">₹{po.totalAmount.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">Avg: ₹{Math.round(po.totalAmount / progress.totalQty).toLocaleString()}/unit</div>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2 pl-4">
                  {po.status === 'Pending' && userData?.role !== 'Employee' && (
                    <>
                      <button
                        onClick={(e) => handleStatusChange(po.id!, 'Approved', e)}
                        disabled={processingPO === po.id}
                        className="flex items-center space-x-1 px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition disabled:opacity-50"
                      >
                        <Check className="size-3" />
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={(e) => handleStatusChange(po.id!, 'Rejected', e)}
                        disabled={processingPO === po.id}
                        className="flex items-center space-x-1 px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition disabled:opacity-50"
                      >
                        <X className="size-3" />
                        <span>Reject</span>
                      </button>
                    </>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/pos/${po.id}`);
                    }}
                    className="flex items-center space-x-1 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition"
                  >
                    <Eye className="size-3" />
                    <span>View</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Expanded Items */}
            {isExpanded && (
              <div className="border-t border-gray-200 bg-gray-50 p-5">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Line Items</h4>
                <div className="space-y-2">
                  {po.lineItems.map((item, index) => (
                    <div key={index} className="bg-white rounded-lg border border-gray-200 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 mb-1">{item.itemName}</div>
                          <div className="flex items-center space-x-3 text-xs text-gray-500">
                            {item.sku && <span>SKU: {item.sku}</span>}
                            {item.size && <span>Size: {item.size}</span>}
                            {item.barcode && (
                              <span className="flex items-center space-x-1">
                                <QrCode className="size-3" />
                                <span>{item.barcode}</span>
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-8 text-center">
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Order</div>
                            <div className="text-sm font-semibold text-blue-600">{item.quantity}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Sent</div>
                            <div className="text-sm font-semibold text-green-600">{item.sentQty || 0}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Pending</div>
                            <div className="text-sm font-semibold text-orange-600">{item.pendingQty || item.quantity}</div>
                          </div>
                          <div className="text-right pl-8">
                            <div className="text-xs text-gray-500 mb-1">Unit Price</div>
                            <div className="text-sm font-semibold text-gray-900">₹{item.unitPrice.toLocaleString()}</div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-3">
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div 
                            className={`h-1.5 rounded-full transition-all ${
                              getProgressColor(Math.round(((item.sentQty || 0) / item.quantity) * 100))
                            }`}
                            style={{ width: `${Math.round(((item.sentQty || 0) / item.quantity) * 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}