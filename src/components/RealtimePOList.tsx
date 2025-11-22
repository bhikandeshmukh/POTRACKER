'use client';

import { useRealtimeCollection } from '@/hooks/useRealtime';
import { PurchaseOrder } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import StatusBadge from './StatusBadge';
import LoadingSpinner from './LoadingSpinner';
import { format } from 'date-fns';
import { AlertCircle, Wifi, WifiOff } from 'lucide-react';

interface RealtimePOListProps {
  filters?: {
    status?: PurchaseOrder['status'];
    vendorId?: string;
    limit?: number;
  };
}

/**
* Renders a real-time purchase order list with optional filters and connection status feedback.
* @example
* RealtimePOList({ filters: { status: 'open', vendorId: 'vendor123', limit: 25 } })
* <div className="space-y-4">...</div>
* @param {{RealtimePOListProps}} {{filters}} - Filters and options used to query and display purchase orders in real time.
* @returns {{JSX.Element}} Rendered list of purchase orders with loading, error, and connection state handling.
**/
export default function RealtimePOList({ filters }: RealtimePOListProps) {
  const { userData } = useAuth();
  
  // Build query options based on filters and user role
  const queryOptions = {
    where: [
      ...(filters?.status ? [{ field: 'status', operator: '==' as const, value: filters.status }] : []),
      ...(filters?.vendorId ? [{ field: 'vendorId', operator: '==' as const, value: filters.vendorId }] : []),
      ...(userData?.role === 'Employee' ? [{ field: 'createdBy_uid', operator: '==' as const, value: userData.uid }] : [])
    ],
    orderBy: 'createdAt',
    orderDirection: 'desc' as const,
    limit: filters?.limit || 50,
    includeMetadataChanges: true // Show real-time updates even from cache
  };

  const { data: pos, loading, error, subscriptionId } = useRealtimeCollection<PurchaseOrder>(
    'pos',
    queryOptions
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner />
        <span className="ml-2 text-gray-600">Loading purchase orders...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
          <div>
            <h3 className="text-sm font-medium text-red-800">
              Real-time Connection Error
            </h3>
            <p className="text-sm text-red-700 mt-1">
              {error.message}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <div className="flex items-center justify-between bg-gray-50 px-4 py-2 rounded-lg">
        <div className="flex items-center text-sm text-gray-600">
          {subscriptionId ? (
            <>
              <Wifi className="h-4 w-4 text-green-500 mr-2" />
              Real-time updates active
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4 text-red-500 mr-2" />
              Real-time updates disconnected
            </>
          )}
        </div>
        <div className="text-sm text-gray-500">
          {pos.length} purchase orders
        </div>
      </div>

      {/* PO List */}
      {pos.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No purchase orders found
        </div>
      ) : (
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    PO Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vendor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expected Delivery
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pos.map((po) => (
                  <tr 
                    key={po.id} 
                    className="hover:bg-gray-50 transition-colors duration-150"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {po.poNumber}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {po.vendorName}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        ₹{po.totalAmount.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={po.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {po.createdAt && format(po.createdAt.toDate(), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {po.expectedDeliveryDate && format(po.expectedDeliveryDate.toDate(), 'MMM dd, yyyy')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Real-time Indicator */}
      <div className="text-xs text-gray-400 text-center">
        Updates automatically • Subscription ID: {subscriptionId?.slice(-8)}
      </div>
    </div>
  );
}