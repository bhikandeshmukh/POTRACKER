'use client';

import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, subMonths } from 'date-fns';

export interface DateRange {
  startDate: Date;
  endDate: Date;
  label: string;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

const presetRanges = [
  {
    label: 'Today',
    getValue: () => ({
      startDate: new Date(),
      endDate: new Date(),
      label: 'Today'
    })
  },
  {
    label: 'Yesterday', 
    getValue: () => ({
      startDate: subDays(new Date(), 1),
      endDate: subDays(new Date(), 1),
      label: 'Yesterday'
    })
  },
  {
    label: 'Last 7 days',
    getValue: () => ({
      startDate: subDays(new Date(), 6),
      endDate: new Date(),
      label: 'Last 7 days'
    })
  },
  {
    label: 'Last 30 days',
    getValue: () => ({
      startDate: subDays(new Date(), 29),
      endDate: new Date(),
      label: 'Last 30 days'
    })
  },
  {
    label: 'This month',
    getValue: () => ({
      startDate: startOfMonth(new Date()),
      endDate: endOfMonth(new Date()),
      label: 'This month'
    })
  },
  {
    label: 'Last month',
    getValue: () => {
      const lastMonth = subMonths(new Date(), 1);
      return {
        startDate: startOfMonth(lastMonth),
        endDate: endOfMonth(lastMonth),
        label: 'Last month'
      };
    }
  },
  {
    label: 'This year',
    getValue: () => ({
      startDate: startOfYear(new Date()),
      endDate: endOfYear(new Date()),
      label: 'This year'
    })
  }
];

export default function DateRangePicker({ value, onChange, className = '' }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customStart, setCustomStart] = useState(format(value.startDate, 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(value.endDate, 'yyyy-MM-dd'));
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePresetSelect = (preset: typeof presetRanges[0]) => {
    const range = preset.getValue();
    onChange(range);
    setIsOpen(false);
  };

  const handleCustomApply = () => {
    const startDate = new Date(customStart);
    const endDate = new Date(customEnd);
    
    if (startDate <= endDate) {
      onChange({
        startDate,
        endDate,
        label: `${format(startDate, 'MMM dd')} - ${format(endDate, 'MMM dd, yyyy')}`
      });
      setIsOpen(false);
    }
  };

  const displayText = value.label || `${format(value.startDate, 'MMM dd')} - ${format(value.endDate, 'MMM dd, yyyy')}`;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      >
        <Calendar className="w-4 h-4 text-gray-500" />
        <span className="text-gray-700">{displayText}</span>
        <ChevronDown className="w-4 h-4 text-gray-500" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Select Date Range</h3>
            
            {/* Preset Ranges */}
            <div className="space-y-1 mb-4">
              {presetRanges.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => handlePresetSelect(preset)}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Custom Range */}
            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-xs font-medium text-gray-700 mb-2">Custom Range</h4>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">End Date</label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                  />
                </div>
              </div>
              <button
                onClick={handleCustomApply}
                className="w-full px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Apply Custom Range
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}