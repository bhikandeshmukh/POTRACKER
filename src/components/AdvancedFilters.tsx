'use client';

import { useState, useRef, useEffect } from 'react';
import { Filter, X, Check } from 'lucide-react';

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface FilterConfig {
  key: string;
  label: string;
  options: FilterOption[];
  multiSelect?: boolean;
}

interface AdvancedFiltersProps {
  filters: FilterConfig[];
  selectedFilters: Record<string, string[]>;
  onFiltersChange: (filters: Record<string, string[]>) => void;
  className?: string;
}

export default function AdvancedFilters({ 
  filters, 
  selectedFilters, 
  onFiltersChange, 
  className = '' 
}: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFilterToggle = (filterKey: string, value: string) => {
    const currentValues = selectedFilters[filterKey] || [];
    const filterConfig = filters.find(f => f.key === filterKey);
    
    let newValues: string[];
    
    if (filterConfig?.multiSelect) {
      if (currentValues.includes(value)) {
        newValues = currentValues.filter(v => v !== value);
      } else {
        newValues = [...currentValues, value];
      }
    } else {
      newValues = currentValues.includes(value) ? [] : [value];
    }

    onFiltersChange({
      ...selectedFilters,
      [filterKey]: newValues
    });
  };

  const clearFilter = (filterKey: string) => {
    onFiltersChange({
      ...selectedFilters,
      [filterKey]: []
    });
  };

  const clearAllFilters = () => {
    const clearedFilters = Object.keys(selectedFilters).reduce((acc, key) => {
      acc[key] = [];
      return acc;
    }, {} as Record<string, string[]>);
    onFiltersChange(clearedFilters);
  };

  const getActiveFilterCount = () => {
    return Object.values(selectedFilters).reduce((count, values) => count + values.length, 0);
  };

  const activeCount = getActiveFilterCount();

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center space-x-2 px-3 py-2 text-sm border rounded-lg transition-colors
          ${activeCount > 0 
            ? 'border-blue-500 bg-blue-50 text-blue-700' 
            : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
          }
        `}
      >
        <Filter className="w-4 h-4" />
        <span>Filters</span>
        {activeCount > 0 && (
          <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full">
            {activeCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-900">Advanced Filters</h3>
              {activeCount > 0 && (
                <button
                  onClick={clearAllFilters}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Clear All
                </button>
              )}
            </div>

            <div className="space-y-4">
              {filters.map((filter) => {
                const selectedValues = selectedFilters[filter.key] || [];
                
                return (
                  <div key={filter.key}>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-700">
                        {filter.label}
                      </label>
                      {selectedValues.length > 0 && (
                        <button
                          onClick={() => clearFilter(filter.key)}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    <div className="relative">
                      <button
                        onClick={() => setOpenDropdown(
                          openDropdown === filter.key ? null : filter.key
                        )}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm border border-gray-300 rounded bg-white hover:border-gray-400"
                      >
                        <span className="text-gray-700">
                          {selectedValues.length > 0 
                            ? `${selectedValues.length} selected`
                            : 'Select options...'
                          }
                        </span>
                        <Filter className="w-4 h-4 text-gray-400" />
                      </button>

                      {openDropdown === filter.key && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-10 max-h-48 overflow-y-auto">
                          {filter.options.map((option) => {
                            const isSelected = selectedValues.includes(option.value);
                            
                            return (
                              <button
                                key={option.value}
                                onClick={() => handleFilterToggle(filter.key, option.value)}
                                className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50"
                              >
                                <div className="flex items-center space-x-2">
                                  <div className={`
                                    w-4 h-4 border rounded flex items-center justify-center
                                    ${isSelected 
                                      ? 'bg-blue-600 border-blue-600' 
                                      : 'border-gray-300'
                                    }
                                  `}>
                                    {isSelected && <Check className="w-3 h-3 text-white" />}
                                  </div>
                                  <span className="text-gray-700">{option.label}</span>
                                </div>
                                {option.count !== undefined && (
                                  <span className="text-xs text-gray-500">
                                    ({option.count})
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Active Filters Display */}
            {activeCount > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h4 className="text-xs font-medium text-gray-700 mb-2">Active Filters:</h4>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(selectedFilters).map(([filterKey, values]) =>
                    values.map((value) => {
                      const filter = filters.find(f => f.key === filterKey);
                      const option = filter?.options.find(o => o.value === value);
                      
                      return (
                        <span
                          key={`${filterKey}-${value}`}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                        >
                          {option?.label || value}
                          <button
                            onClick={() => handleFilterToggle(filterKey, value)}
                            className="hover:text-blue-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}