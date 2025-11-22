'use client';

import { useState } from 'react';
import { FileSpreadsheet, Download, ChevronDown } from 'lucide-react';
import { PurchaseOrder } from '@/lib/types';
import { exportSinglePOToExcel, exportBulkPOsToExcel, exportFilteredPOsToExcel } from '@/lib/excelExport';

interface ExcelExportButtonProps {
  // For single PO export
  po?: PurchaseOrder;
  
  // For bulk export
  pos?: PurchaseOrder[];
  
  // For filtered export
  filteredPOs?: PurchaseOrder[];
  filters?: Record<string, any>;
  
  // UI options
  variant?: 'single' | 'bulk' | 'dropdown';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
* Renders Excel export controls for single, bulk, or dropdown variants based on provided PO data and options.
* @example
* ExcelExportButton({ po, pos, filteredPOs, filters, variant: 'bulk', size: 'md', className: '' })
* <ExcelExportButton ... />
* @param {{ExcelExportButtonProps}} props - Props containing PO data, filters, UI variants, and styling options.
* @returns {{JSX.Element | null}} JSX element representing the export button(s) or null if nothing renders.
**/
export default function ExcelExportButton({
  po,
  pos = [],
  filteredPOs = [],
  filters = {},
  variant = 'single',
  size = 'md',
  className = ''
}: ExcelExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  /****
  * Syncs the current purchase order export state and initiates export to Excel with metadata.
  * @example
  * sync()
  * undefined
  * @param {{}} {{}} - .
  * @returns {{Promise<void>}} Indicates completion of the export process.
  ****/
  const handleSingleExport = async () => {
    if (!po) return;
    
    setIsExporting(true);
    try {
      await exportSinglePOToExcel(po, {
        includeMetadata: true,
        filename: `PO-${po.poNumber}-Detailed-${new Date().toISOString().split('T')[0]}.xlsx`
      });
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  /**
  * Exports filtered or bulk purchase orders to Excel, optionally including line items.
  * @example
  * sync(true)
  * undefined
  * @param {{boolean}} {{includeLineItems}} - Whether to include line items in the exported workbook.
  * @returns {{Promise<void>}} Completion promise for the export operation.
  **/
  const handleBulkExport = async (includeLineItems = true) => {
    const dataToExport = filteredPOs.length > 0 ? filteredPOs : pos;
    if (dataToExport.length === 0) return;
    
    setIsExporting(true);
    try {
      if (filteredPOs.length > 0 && Object.keys(filters).length > 0) {
        await exportFilteredPOsToExcel(filteredPOs, filters, {
          includeLineItems,
          filename: `POs-Filtered-${new Date().toISOString().split('T')[0]}.xlsx`
        });
      } else {
        await exportBulkPOsToExcel(dataToExport, {
          includeLineItems,
          filename: `POs-Bulk-Export-${new Date().toISOString().split('T')[0]}.xlsx`
        });
      }
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
      setShowDropdown(false);
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-2 py-1 text-xs';
      case 'lg':
        return 'px-4 py-3 text-base';
      default:
        return 'px-3 py-2 text-sm';
    }
  };

  const getIconSize = () => {
    switch (size) {
      case 'sm':
        return 'w-3 h-3';
      case 'lg':
        return 'w-5 h-5';
      default:
        return 'w-4 h-4';
    }
  };

  // Single PO export button
  if (variant === 'single' && po) {
    return (
      <button
        onClick={handleSingleExport}
        disabled={isExporting}
        className={`
          flex items-center space-x-2 ${getSizeClasses()}
          bg-green-600 text-white rounded-lg hover:bg-green-700 
          transition-colors disabled:opacity-50 disabled:cursor-not-allowed
          ${className}
        `}
        title="Download detailed Excel report"
      >
        <FileSpreadsheet className={getIconSize()} />
        <span>{isExporting ? 'Exporting...' : 'Excel Export'}</span>
      </button>
    );
  }

  // Bulk export with dropdown
  if (variant === 'bulk' || variant === 'dropdown') {
    const dataCount = filteredPOs.length > 0 ? filteredPOs.length : pos.length;
    
    return (
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          disabled={isExporting || dataCount === 0}
          className={`
            flex items-center space-x-2 ${getSizeClasses()}
            bg-green-600 text-white rounded-lg hover:bg-green-700 
            transition-colors disabled:opacity-50 disabled:cursor-not-allowed
            ${className}
          `}
          title={`Export ${dataCount} POs to Excel`}
        >
          <FileSpreadsheet className={getIconSize()} />
          <span>{isExporting ? 'Exporting...' : `Excel Export (${dataCount})`}</span>
          <ChevronDown className={`${getIconSize()} ${showDropdown ? 'rotate-180' : ''} transition-transform`} />
        </button>

        {showDropdown && !isExporting && (
          <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[200px] z-50">
            <button
              onClick={() => handleBulkExport(false)}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
            >
              <FileSpreadsheet className="size-4 text-green-600" />
              <div>
                <div className="font-medium">Summary Only</div>
                <div className="text-xs text-gray-500">PO overview without line items</div>
              </div>
            </button>
            
            <button
              onClick={() => handleBulkExport(true)}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
            >
              <FileSpreadsheet className="size-4 text-blue-600" />
              <div>
                <div className="font-medium">Detailed Report</div>
                <div className="text-xs text-gray-500">Complete data with all line items</div>
              </div>
            </button>

            {filteredPOs.length > 0 && Object.keys(filters).length > 0 && (
              <div className="border-t border-gray-100 mt-1 pt-1">
                <div className="px-4 py-1 text-xs text-gray-500">
                  Filtered: {filteredPOs.length} of {pos.length} POs
                </div>
              </div>
            )}
          </div>
        )}

        {/* Backdrop to close dropdown */}
        {showDropdown && (
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowDropdown(false)}
          />
        )}
      </div>
    );
  }

  // Simple bulk export button
  return (
    <button
      onClick={() => handleBulkExport(true)}
      disabled={isExporting || pos.length === 0}
      className={`
        flex items-center space-x-2 ${getSizeClasses()}
        bg-green-600 text-white rounded-lg hover:bg-green-700 
        transition-colors disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
      title={`Export ${pos.length} POs to Excel`}
    >
      <Download className={getIconSize()} />
      <span>{isExporting ? 'Exporting...' : `Export Excel (${pos.length})`}</span>
    </button>
  );
}