'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import { FileText, Plus, Edit, Trash2, Eye, Package, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { getThemeClasses } from '@/styles/theme';
import { getReturnOrders, ReturnOrder } from '@/lib/firestore';

/**
* Renders the return orders dashboard with authentication checks, filtering, and summary stats.
* @example
* ReturnOrdersPage()
* <ReturnOrdersPage />
* @param {{void}} voidParam - This component does not accept props.
* @returns {{JSX.Element}} The rendered return orders page layout.
**/
export default function ReturnOrdersPage() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();
  const [returnOrders, setReturnOrders] = useState<ReturnOrder[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [filter, setFilter] = useState<'all' | 'Pending' | 'Approved' | 'Rejected' | 'Completed'>('all');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const loadReturnOrders = useCallback(async () => {
    setLoadingData(true);
    try {
      const ros = await getReturnOrders(user?.uid, userData?.role);
      setReturnOrders(ros);
    } catch (error) {
      console.error('Error loading return orders:', error);
    } finally {
      setLoadingData(false);
    }
  }, [user, userData]);

  useEffect(() => {
    if (user) {
      loadReturnOrders();
    }
  }, [user, loadReturnOrders]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending': return 'bg-yellow-100 text-yellow-800';
      case 'Approved': return 'bg-green-100 text-green-800';
      case 'Rejected': return 'bg-red-100 text-red-800';
      case 'Completed': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Pending': return <AlertCircle className="size-4" />;
      case 'Approved': return <CheckCircle className="size-4" />;
      case 'Rejected': return <XCircle className="size-4" />;
      case 'Completed': return <Package className="size-4" />;
      default: return <FileText className="size-4" />;
    }
  };

  const filteredROs = filter === 'all' 
    ? returnOrders 
    : returnOrders.filter(ro => ro.status === filter);

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
        <main className="w-full p-8">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className={getThemeClasses.pageTitle()}>Return Orders</h1>
              <p className={getThemeClasses.description()}>Manage product returns and RMA requests</p>
            </div>
            <Link
              href="/ros/new"
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Plus className="size-5" />
              <span>New Return Order</span>
            </Link>
          </div>

          {/* Filters */}
          <div className="flex space-x-2 mb-6">
            {['all', 'Pending', 'Approved', 'Rejected', 'Completed'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status as any)}
                className={`px-4 py-2 rounded-lg transition ${
                  filter === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                {status === 'all' ? 'All' : status}
                {status !== 'all' && (
                  <span className="ml-2 px-2 py-0.5 bg-white bg-opacity-20 rounded-full text-xs">
                    {returnOrders.filter(ro => ro.status === status).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Return Orders Table */}
          <div className={getThemeClasses.card()}>
            {filteredROs.length === 0 ? (
              <div className="text-center py-12">
                <Package className="size-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Return Orders</h3>
                <p className="text-gray-500 mb-4">
                  {filter === 'all' 
                    ? 'Create your first return order to get started'
                    : `No ${filter.toLowerCase()} return orders found`
                  }
                </p>
                <Link
                  href="/ros/new"
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  <Plus className="size-5" />
                  <span>New Return Order</span>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">RO Number</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO Number</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Return Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredROs.map((ro) => (
                      <tr key={ro.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <FileText className="size-4 text-gray-400" />
                            <span className="font-medium text-gray-900">{ro.roNumber}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Link href={`/pos/${ro.poId}`} className="text-blue-600 hover:text-blue-800">
                            {ro.poNumber}
                          </Link>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-700">{ro.vendorName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                          {ro.returnDate?.toDate ? ro.returnDate.toDate().toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-900 font-medium">
                          ₹{ro.totalAmount?.toLocaleString() || '0'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                          {ro.lineItems?.length || 0} items
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(ro.status)}`}>
                            {getStatusIcon(ro.status)}
                            <span>{ro.status}</span>
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex space-x-2">
                            <Link
                              href={`/ros/${ro.id}`}
                              className="text-blue-600 hover:text-blue-900"
                              title="View Details"
                            >
                              <Eye className="size-4" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Summary Stats */}
          {returnOrders.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
              <div className={`${getThemeClasses.card()} ${getThemeClasses.cardPadding()}`}>
                <p className="text-sm text-gray-600">Total Returns</p>
                <p className="text-2xl font-bold text-gray-900">{returnOrders.length}</p>
              </div>
              <div className={`${getThemeClasses.card()} ${getThemeClasses.cardPadding()}`}>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {returnOrders.filter(ro => ro.status === 'Pending').length}
                </p>
              </div>
              <div className={`${getThemeClasses.card()} ${getThemeClasses.cardPadding()}`}>
                <p className="text-sm text-gray-600">Approved</p>
                <p className="text-2xl font-bold text-green-600">
                  {returnOrders.filter(ro => ro.status === 'Approved').length}
                </p>
              </div>
              <div className={`${getThemeClasses.card()} ${getThemeClasses.cardPadding()}`}>
                <p className="text-sm text-gray-600">Total Amount</p>
                <p className="text-2xl font-bold text-gray-900">
                  ₹{returnOrders.reduce((sum, ro) => sum + (ro.totalAmount || 0), 0).toLocaleString()}
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
