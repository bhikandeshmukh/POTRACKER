'use client';

import React, { useState, useCallback } from 'react';
import { useToast } from '@/components/ToastContainer';

export interface BulkAction {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  color: 'blue' | 'green' | 'red' | 'yellow' | 'purple';
  confirmMessage?: string;
  action: (selectedIds: string[]) => Promise<void>;
}

/**
* Creates reusable selection state and helpers for performing bulk actions on a collection of items.
* @example
* useBulkActions([{ id: '1' }], [{ id: 'archive', label: 'Archive', action: ids => Promise.resolve() }])
* { selectedIds: [], selectedCount: 0, isProcessing: false, ... }
* @param {{T[]}} {{items}} - Array of items that can be selected for bulk operations.
* @param {{BulkAction[]}} {{actions}} - Available bulk actions that can be executed against the selected items.
* @returns {{UseBulkActionsResult}} Returns selection state, control handlers, and execution helpers for bulk actions.
**/
export function useBulkActions<T extends { id?: string }>(
  items: T[],
  actions: BulkAction[]
) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { showSuccess, showError } = useToast();

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => (
      prev.includes(id) 
        ? prev.filter(selectedId => selectedId !== id)
        : [...prev, id]
    ));
  }, []);

  const toggleSelectAll = useCallback(() => {
    const allIds = items.map(item => item.id!).filter(Boolean);
    setSelectedIds(prev => (
      prev.length === allIds.length ? [] : allIds
    ));
  }, [items]);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const executeBulkAction = useCallback(async (actionId: string) => {
    const action = actions.find(a => a.id === actionId);
    if (!action || selectedIds.length === 0) return;

    // Show confirmation if required
    if (action.confirmMessage) {
      // eslint-disable-next-line no-alert
      const confirmed = window.confirm(
        action.confirmMessage.replace('{count}', selectedIds.length.toString())
      );
      if (!confirmed) return;
    }

    setIsProcessing(true);
    
    try {
      await action.action(selectedIds);
      showSuccess(
        'Bulk Action Complete',
        `${action.label} applied to ${selectedIds.length} items`
      );
      clearSelection();
    } catch (error: any) {
      showError('Bulk Action Failed', error.message || 'Operation failed');
    } finally {
      setIsProcessing(false);
    }
  }, [actions, selectedIds, showSuccess, showError, clearSelection]);

  const getSelectedItems = useCallback(() => {
    return items.filter(item => item.id && selectedIds.includes(item.id));
  }, [items, selectedIds]);

  const isSelected = useCallback((id: string) => {
    return selectedIds.includes(id);
  }, [selectedIds]);

  const isAllSelected = useCallback(() => {
    const allIds = items.map(item => item.id!).filter(Boolean);
    return allIds.length > 0 && selectedIds.length === allIds.length;
  }, [items, selectedIds]);

  const isIndeterminate = useCallback(() => {
    return selectedIds.length > 0 && selectedIds.length < items.length;
  }, [items.length, selectedIds.length]);

  return {
    selectedIds,
    selectedCount: selectedIds.length,
    isProcessing,
    toggleSelection,
    toggleSelectAll,
    clearSelection,
    executeBulkAction,
    getSelectedItems,
    isSelected,
    isAllSelected,
    isIndeterminate
  };
}