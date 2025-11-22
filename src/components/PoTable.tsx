'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ToastContainer';
import { poService } from '@/lib/services';
import { PurchaseOrder } from '@/lib/types';
import StatusBadge from './StatusBadge';
import { format } from 'date-fns';
import { Eye, Search, Edit, Trash2, Check, X } from 'lucide-react';

interface PoTableProps {
  pos: PurchaseOrder[];
  onRefresh?: () => void;
}

export default function PoTable({ pos, onRefresh }: PoTableProps) {
  const { userData } = useAuth();
  const { showSuccess, showError } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingStatus, setEditingStatus] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState<PurchaseOrder['status']>('Pending');

  const filteredPOs = pos.filter(po => {
    const matchesSearch = po.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         po.vendorName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || po.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleStatusEdit = (poId: string, currentStatus: PurchaseOrder['status']) => {
    setEditingStatus(poId);
    setNewStatus(currentStatus);
  };

  const handleStatusUpdate = async (poId: string) => {
    if (!userData || !userData.uid || !userData.name || !userData.role) {
      console.error('User data not available');
      return;
    }
    
    try {
      const result = await poService.updateStatus(
        poId,
        newStatus,
        {
          uid: userData.uid,
          name: userData.name,
          role: userData.role
        }
      );

      if (result.success) {
        setEditingStatus(null);
        if (onRefresh) onRefresh();
      } else {
        console.error('Failed to update PO status:', result.error);
        showError('Failed to Update', 'Failed to update status: ' + result.error);
      }
    } catch (error: any) {
      console.error('Error updating PO status:', error);
      showError('Error', 'Failed to update status: ' + error.message);
    }
  };

  const handleDelete = async (poId: string, poNumber: string) => {
    if (!userData || !userData.uid || !userData.name || !userData.role) {
      console.error('User data not available');
      return;
    }
    
    if (confirm(`Are you sure you want to delete PO "${poNumber}"?`)) {
      try {
        const result = await poService.delete(poId);

        if (result.success) {
          if (onRefresh) onRefresh();
        } else {
          console.error('Failed to delete PO:', result.error);
          showError('Failed to Delete', 'Failed to delete PO: ' + result.error);
        }
      } catch (error: any) {
        console.error('Error deleting PO:', error);
        showError('Error', 'Failed to delete PO: ' + error.message);
      }
    }
  };

  const cancelStatusEdit = () => {
    setEditingStatus(null);
    setNewStatus('Pending');
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by PO number or vendor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="Shipped">Shipped</option>
            <option value="Received">Received</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                PO Number
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Vendor
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Order Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Delivery Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredPOs.map((po) => (
              <tr key={po.id} className="hover:bg-gray-50 transition">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {po.poNumber}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {po.vendorName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {format(po.orderDate.toDate(), 'MMM dd, yyyy')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {format(po.expectedDeliveryDate.toDate(), 'MMM dd, yyyy')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  ₹{po.totalAmount.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingStatus === po.id ? (
                    <div className="flex items-center space-x-2">
                      <select
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value as PurchaseOrder['status'])}
                        className="text-sm border border-gray-300 rounded px-2 py-1"
                      >
                        <option value="Pending">Pending</option>
                        <option value="Approved">Approved</option>
                        <option value="Rejected">Rejected</option>
                        <option value="Shipped">Shipped</option>
                        <option value="Received">Received</option>
                      </select>
                      <button
                        onClick={() => handleStatusUpdate(po.id!)}
                        className="text-green-600 hover:text-green-800"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={cancelStatusEdit}
                        className="text-red-600 hover:text-red-800"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <StatusBadge status={po.status} />
                      {userData?.role === 'Admin' && (
                        <button
                          onClick={() => handleStatusEdit(po.id!, po.status)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Edit className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="flex items-center space-x-3">
                    <Link
                      href={`/pos/${po.id}`}
                      className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-700"
                    >
                      <Eye className="w-4 h-4" />
                      <span>View</span>
                    </Link>
                    
                    {userData?.role === 'Admin' && (
                      <button
                        onClick={() => handleDelete(po.id!, po.poNumber)}
                        className="inline-flex items-center space-x-1 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
