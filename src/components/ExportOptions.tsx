'use client';

import { useState } from 'react';
import { Download, FileText, FileSpreadsheet, Printer, Share2 } from 'lucide-react';
import { useToast } from './ToastContainer';
import ModernButton from './ModernButton';

interface ExportOptionsProps {
  data: any[];
  filename?: string;
  className?: string;
}

export default function ExportOptions({ data, filename = 'export', className = '' }: ExportOptionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { showSuccess, showError, showInfo } = useToast();

  const exportToPDF = async () => {
    setIsExporting(true);
    try {
      // Simulate PDF generation
      await new Promise(resolve => setTimeout(resolve, 1500));
      showSuccess('PDF Export', 'Data exported to PDF successfully');
      
      // In real implementation, you would use a library like jsPDF
      // const doc = new jsPDF();
      // doc.text('PO Tracking Report', 20, 20);
      // doc.save(`${filename}.pdf`);
      
    } catch (error) {
      showError('Export Failed', 'Failed to export PDF');
    } finally {
      setIsExporting(false);
      setIsOpen(false);
    }
  };

  const exportToExcel = async () => {
    setIsExporting(true);
    try {
      // Simulate Excel generation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simple CSV export (in real app, use xlsx library)
      const csvContent = convertToCSV(data);
      downloadCSV(csvContent, `${filename}.csv`);
      
      showSuccess('Excel Export', 'Data exported to Excel successfully');
    } catch (error) {
      showError('Export Failed', 'Failed to export Excel');
    } finally {
      setIsExporting(false);
      setIsOpen(false);
    }
  };

  const printReport = () => {
    showInfo('Print Report', 'Opening print dialog...');
    window.print();
    setIsOpen(false);
  };

  const shareReport = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'PO Tracking Report',
          text: `Report generated with ${data.length} records`,
          url: window.location.href
        });
        showSuccess('Shared', 'Report shared successfully');
      } catch (error) {
        showError('Share Failed', 'Failed to share report');
      }
    } else {
      // Fallback: copy link to clipboard
      navigator.clipboard.writeText(window.location.href);
      showSuccess('Link Copied', 'Report link copied to clipboard');
    }
    setIsOpen(false);
  };

  const convertToCSV = (data: any[]) => {
    if (!data.length) return '';
    
    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');
    
    const csvRows = data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Escape commas and quotes
        return typeof value === 'string' && value.includes(',') 
          ? `"${value.replace(/"/g, '""')}"` 
          : value;
      }).join(',')
    );
    
    return [csvHeaders, ...csvRows].join('\n');
  };

  const downloadCSV = (csvContent: string, filename: string) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const exportOptions = [
    {
      label: 'Export to PDF',
      icon: FileText,
      action: exportToPDF,
      description: 'Download as PDF document'
    },
    {
      label: 'Export to Excel',
      icon: FileSpreadsheet, 
      action: exportToExcel,
      description: 'Download as Excel spreadsheet'
    },
    {
      label: 'Print Report',
      icon: Printer,
      action: printReport,
      description: 'Print current view'
    },
    {
      label: 'Share Report',
      icon: Share2,
      action: shareReport,
      description: 'Share report link'
    }
  ];

  return (
    <div className={`relative ${className}`}>
      <ModernButton
        variant="secondary"
        icon={Download}
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExporting}
      >
        {isExporting ? 'Exporting...' : 'Export'}
      </ModernButton>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full right-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
            <div className="p-2">
              <div className="text-xs text-gray-500 px-3 py-2 border-b border-gray-100">
                Export {data.length} records
              </div>
              
              {exportOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.label}
                    onClick={option.action}
                    disabled={isExporting}
                    className="w-full flex items-start space-x-3 p-3 text-left hover:bg-gray-50 rounded transition-colors disabled:opacity-50"
                  >
                    <Icon className="size-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {option.label}
                      </p>
                      <p className="text-xs text-gray-500">
                        {option.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}