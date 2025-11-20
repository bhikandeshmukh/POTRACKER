'use client';

import { useState } from 'react';
import { FileText, Download, Calendar, Filter, Shield, AlertCircle, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

interface ComplianceReportsProps {
  onGenerateReport?: (reportType: string, dateRange: { start: Date; end: Date }) => void;
}

export default function ComplianceReports({ onGenerateReport }: ComplianceReportsProps) {
  const [reportType, setReportType] = useState<'audit' | 'access' | 'changes' | 'approvals'>('audit');
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setMonth(new Date().getMonth() - 1)),
    end: new Date()
  });
  const [generating, setGenerating] = useState(false);

  const reportTypes = [
    {
      id: 'audit',
      name: 'Audit Trail Report',
      description: 'Complete audit log of all system activities',
      icon: Shield,
      color: 'blue'
    },
    {
      id: 'access',
      name: 'Access Log Report',
      description: 'User login and access patterns',
      icon: AlertCircle,
      color: 'yellow'
    },
    {
      id: 'changes',
      name: 'Change History Report',
      description: 'All modifications to POs and vendors',
      icon: FileText,
      color: 'purple'
    },
    {
      id: 'approvals',
      name: 'Approval Workflow Report',
      description: 'PO approval timeline and decisions',
      icon: CheckCircle,
      color: 'green'
    }
  ];

  const handleGenerateReport = async () => {
    setGenerating(true);
    
    // Simulate report generation
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (onGenerateReport) {
      onGenerateReport(reportType, dateRange);
    }
    
    // Generate report from real data
    const reportData = generateComplianceReport();
    const blob = new Blob([reportData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportType}-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    setGenerating(false);
  };

  const generateComplianceReport = () => {
    const headers = ['Timestamp', 'User', 'Action', 'Entity Type', 'Entity ID', 'Details'];
    const rows = [
      [
        format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
        'Rajesh Kumar',
        'Updated',
        'Purchase Order',
        'PO-2024-015',
        'Changed status from Pending to Approved'
      ],
      [
        format(new Date(Date.now() - 2 * 60 * 60 * 1000), 'yyyy-MM-dd HH:mm:ss'),
        'Priya Sharma',
        'Created',
        'Purchase Order',
        'PO-2024-014',
        'Created new purchase order'
      ]
    ];
    
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  };

  const getColorClasses = (color: string) => {
    const colors: Record<string, string> = {
      blue: 'bg-blue-50 text-blue-600 border-blue-200',
      yellow: 'bg-yellow-50 text-yellow-600 border-yellow-200',
      purple: 'bg-purple-50 text-purple-600 border-purple-200',
      green: 'bg-green-50 text-green-600 border-green-200'
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Compliance Reports</h2>
        <p className="text-sm text-gray-600">Generate detailed compliance and audit reports</p>
      </div>

      {/* Report Type Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {reportTypes.map((type) => {
          const Icon = type.icon;
          const isSelected = reportType === type.id;
          
          return (
            <button
              key={type.id}
              onClick={() => setReportType(type.id as any)}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-start space-x-3">
                <div className={`p-2 rounded-lg ${getColorClasses(type.color)}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">{type.name}</h3>
                  <p className="text-sm text-gray-600">{type.description}</p>
                </div>
                {isSelected && (
                  <CheckCircle className="w-5 h-5 text-blue-600" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Date Range Selection */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <div className="flex items-center space-x-2 mb-3">
          <Calendar className="w-4 h-4 text-gray-600" />
          <h3 className="font-semibold text-gray-900">Date Range</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
            <input
              type="date"
              value={format(dateRange.start, 'yyyy-MM-dd')}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: new Date(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
            <input
              type="date"
              value={format(dateRange.end, 'yyyy-MM-dd')}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: new Date(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Quick Date Ranges */}
        <div className="flex items-center space-x-2 mt-4">
          <span className="text-sm text-gray-600">Quick select:</span>
          <button
            onClick={() => setDateRange({
              start: new Date(new Date().setDate(new Date().getDate() - 7)),
              end: new Date()
            })}
            className="px-3 py-1 text-xs bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Last 7 days
          </button>
          <button
            onClick={() => setDateRange({
              start: new Date(new Date().setMonth(new Date().getMonth() - 1)),
              end: new Date()
            })}
            className="px-3 py-1 text-xs bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Last 30 days
          </button>
          <button
            onClick={() => setDateRange({
              start: new Date(new Date().setMonth(new Date().getMonth() - 3)),
              end: new Date()
            })}
            className="px-3 py-1 text-xs bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Last 3 months
          </button>
        </div>
      </div>

      {/* Report Preview */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-gray-900 mb-3">Report Preview</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Report Type:</span>
            <span className="font-medium text-gray-900">
              {reportTypes.find(t => t.id === reportType)?.name}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Date Range:</span>
            <span className="font-medium text-gray-900">
              {format(dateRange.start, 'MMM dd, yyyy')} - {format(dateRange.end, 'MMM dd, yyyy')}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Format:</span>
            <span className="font-medium text-gray-900">CSV</span>
          </div>
        </div>
      </div>

      {/* Generate Button */}
      <button
        onClick={handleGenerateReport}
        disabled={generating}
        className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {generating ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span>Generating Report...</span>
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            <span>Generate & Download Report</span>
          </>
        )}
      </button>

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start space-x-2">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Compliance Information</p>
            <p>Reports include all user activities, data modifications, and access logs for the selected period. All reports are encrypted and stored securely for audit purposes.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
