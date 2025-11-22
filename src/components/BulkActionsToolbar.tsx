'use client';

import { CheckSquare, Square, Minus, X } from 'lucide-react';
import { BulkAction } from '@/hooks/useBulkActions';

interface BulkActionsToolbarProps {
  selectedCount: number;
  totalCount: number;
  isAllSelected: boolean;
  isIndeterminate: boolean;
  isProcessing: boolean;
  actions: BulkAction[];
  onToggleSelectAll: () => void;
  onClearSelection: () => void;
  onExecuteAction: (actionId: string) => void;
  className?: string;
}

export default function BulkActionsToolbar({
  selectedCount,
  totalCount,
  isAllSelected,
  isIndeterminate,
  isProcessing,
  actions,
  onToggleSelectAll,
  onClearSelection,
  onExecuteAction,
  className = ''
}: BulkActionsToolbarProps) {
  if (selectedCount === 0) return null;

  const getColorClasses = (color: string) => {
    const colorMap = {
      blue: 'bg-blue-600 hover:bg-blue-700 text-white',
      green: 'bg-green-600 hover:bg-green-700 text-white',
      red: 'bg-red-600 hover:bg-red-700 text-white',
      yellow: 'bg-yellow-600 hover:bg-yellow-700 text-white',
      purple: 'bg-purple-600 hover:bg-purple-700 text-white'
    };
    return colorMap[color as keyof typeof colorMap] || colorMap.blue;
  };

  return (
    <div className={`
      fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-white
      border border-gray-200 rounded-lg shadow-lg p-4 transition-all
      duration-300 ease-in-out
      ${className}
    `}>
      <div className="flex items-center space-x-4">
        {/* Selection Info */}
        <div className="flex items-center space-x-2">
          <button
            onClick={onToggleSelectAll}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            {isAllSelected ? (
              <CheckSquare className="size-5 text-blue-600" />
            ) : isIndeterminate ? (
              <Minus className="size-5 text-blue-600" />
            ) : (
              <Square className="size-5 text-gray-400" />
            )}
          </button>
          
          <span className="text-sm font-medium text-gray-700">
            {selectedCount} of {totalCount} selected
          </span>
          
          <button
            onClick={onClearSelection}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            title="Clear selection"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-gray-300"></div>

        {/* Bulk Actions */}
        <div className="flex items-center space-x-2">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => onExecuteAction(action.id)}
                disabled={isProcessing}
                className={`
                  flex items-center space-x-2 px-3 py-2 text-sm rounded-lg transition-colors
                  ${getColorClasses(action.color)}
                  ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                <Icon className="size-4" />
                <span>{action.label}</span>
              </button>
            );
          })}
        </div>

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <div className="size-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
            <span>Processing...</span>
          </div>
        )}
      </div>
    </div>
  );
}