'use client';

import { useState } from 'react';
import { PurchaseOrder } from '@/lib/firestore';
import StatusBadge from './StatusBadge';
import { format } from 'date-fns';
import { Package, BarChart3, QrCode } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface EnhancedPOTableProps {
  pos: PurchaseOrder[];
  onRefresh: () => void;
}

export default function EnhancedPOTable({ pos }: EnhancedPOTableProps) {
  const [expandedPO, setExpandedPO] = useState<string | null>(null);
  const router = useRouter();

  const toggleExpanded = (poId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedPO(expandedPO === poId ? null : poId);
  };

  const handleCardClick = (poId: string) => {
    router.push(`/pos/${poId}`);
  };

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
        <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
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
                    <BarChart3 className={`w-4 h-4 text-gray-500 transition-transform ${
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
                                <QrCode className="w-3 h-3" />
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