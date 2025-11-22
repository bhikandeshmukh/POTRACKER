'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Filter, FileText, Building2, User, Calendar, DollarSign } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SearchResult {
  id: string;
  type: 'po' | 'vendor' | 'user';
  title: string;
  subtitle: string;
  description: string;
  metadata?: Record<string, any>;
  url: string;
}

interface AdvancedSearchProps {
  isOpen: boolean;
  onClose: () => void;
  placeholder?: string;
  pos?: any[];
}

/**/ **
* Provides modal search UI for POs, vendors, and users with filters, keyboard navigation, and real PO data.
* @example
* AdvancedSearch({ isOpen: true, onClose: () => {}, placeholder: "Search...", pos: [] })
* <div className="fixed inset-0 z-50 ..."></div>
* @param {{AdvancedSearchProps}} {{props}} - Props controlling visibility, cleanup callback, placeholder text, and PO dataset.
* @returns {{JSX.Element | null}} JSX for the search modal when visible, otherwise null.
*/*/
export default function AdvancedSearch({ isOpen, onClose, placeholder = "Search POs, vendors, users...", pos = [] }: AdvancedSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filters, setFilters] = useState({
    type: 'all' as 'all' | 'po' | 'vendor' | 'user',
    dateRange: 'all' as 'all' | 'week' | 'month' | 'year'
  });
  
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Search function using actual PO data
  /**/ **
  * Performs a filtered search for purchase orders and updates UI state based on the query.
  * @example
  * sync("PO123")
  * undefined
  * @param {{string}} {searchQuery} - Search query string to match against purchase order data.
  * @returns {{Promise<void>}} Updates state with the search results once resolved.
  ** /*/
  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    
    // Simulate slight delay for better UX
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const searchLower = searchQuery.toLowerCase();
    
    // Search through actual POs
    const poResults: SearchResult[] = pos
      .filter(po => {
        const matchesQuery = 
          po.poNumber?.toLowerCase().includes(searchLower) ||
          po.vendorName?.toLowerCase().includes(searchLower) ||
          po.status?.toLowerCase().includes(searchLower) ||
          po.lineItems?.some((item: any) => 
            item.itemName?.toLowerCase().includes(searchLower) ||
            item.sku?.toLowerCase().includes(searchLower) ||
            item.barcode?.toLowerCase().includes(searchLower)
          );
        
        const matchesFilter = filters.type === 'all' || filters.type === 'po';
        
        return matchesQuery && matchesFilter;
      })
      .map(po => ({
        id: po.id || '',
        type: 'po' as const,
        title: po.poNumber || '',
        subtitle: po.vendorName || '',
        description: `${po.lineItems?.length || 0} items - ₹${po.totalAmount?.toLocaleString() || 0}`,
        metadata: { 
          status: po.status, 
          amount: po.totalAmount,
          items: po.lineItems?.length 
        },
        url: `/pos/${po.id}`
      }));

    setResults(poResults);
    setSelectedIndex(0);
    setLoading(false);
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, filters, performSearch]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    /**
    * Handles keyboard navigation and selection for the advanced search results when the dropdown is open.
    * @example
    * handleKeyDown(event)
    * undefined
    * @param {{KeyboardEvent}} {{e}} - Keyboard event triggered while the search dropdown is open.
    * @returns {{void}} No return value.
    **/
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            router.push(results[selectedIndex].url);
            onClose();
          }
          break;
        case 'Escape':
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, router, onClose]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'po': return FileText;
      case 'vendor': return Building2;
      case 'user': return User;
      default: return Search;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'po': return 'text-blue-600 bg-blue-50';
      case 'vendor': return 'text-green-600 bg-green-50';
      case 'user': return 'text-purple-600 bg-purple-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const handleResultClick = (result: SearchResult) => {
    router.push(result.url);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative min-h-screen flex items-start justify-center p-4 pt-16">
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl">
          {/* Header */}
          <div className="flex items-center p-4 border-b border-gray-200">
            <Search className="size-5 text-gray-400 mr-3" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="flex-1 text-lg outline-none"
            />
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Filters */}
          <div className="flex items-center space-x-4 p-4 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center space-x-2">
              <Filter className="size-4 text-gray-500" />
              <span className="text-sm text-gray-600">Type:</span>
              <select
                value={filters.type}
                onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value as any }))}
                className="text-sm border border-gray-300 rounded px-2 py-1"
              >
                <option value="all">All</option>
                <option value="po">Purchase Orders</option>
                <option value="vendor">Vendors</option>
                <option value="user">Users</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <Calendar className="size-4 text-gray-500" />
              <span className="text-sm text-gray-600">Date:</span>
              <select
                value={filters.dateRange}
                onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value as any }))}
                className="text-sm border border-gray-300 rounded px-2 py-1"
              >
                <option value="all">All Time</option>
                <option value="week">Last Week</option>
                <option value="month">Last Month</option>
                <option value="year">Last Year</option>
              </select>
            </div>
          </div>

          {/* Results */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <div className="size-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="ml-2 text-gray-600">Searching...</span>
              </div>
            ) : results.length > 0 ? (
              <div className="py-2">
                {results.map((result, index) => {
                  const Icon = getIcon(result.type);
                  const isSelected = index === selectedIndex;
                  
                  return (
                    <button
                      key={result.id}
                      onClick={() => handleResultClick(result)}
                      className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                        isSelected ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`p-2 rounded-lg ${getTypeColor(result.type)}`}>
                          <Icon className="size-4" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <h3 className="font-medium text-gray-900 truncate">
                              {result.title}
                            </h3>
                            <span className={`px-2 py-1 text-xs rounded-full ${getTypeColor(result.type)}`}>
                              {result.type.toUpperCase()}
                            </span>
                          </div>
                          
                          <p className="text-sm text-gray-600 mb-1">{result.subtitle}</p>
                          <p className="text-sm text-gray-500">{result.description}</p>
                          
                          {result.metadata && (
                            <div className="flex items-center space-x-4 mt-2">
                              {result.metadata.status && (
                                <span className="text-xs text-gray-500">
                                  Status: {result.metadata.status}
                                </span>
                              )}
                              {result.metadata.amount && (
                                <span className="text-xs text-gray-500 flex items-center">
                                  <DollarSign className="size-3 mr-1" />
                                  ₹{result.metadata.amount.toLocaleString()}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : query ? (
              <div className="text-center p-8 text-gray-500">
                <Search className="size-8 mx-auto mb-2 text-gray-400" />
                <p>No results found for "{query}"</p>
                <p className="text-sm mt-1">Try different keywords or filters</p>
              </div>
            ) : (
              <div className="text-center p-8 text-gray-500">
                <Search className="size-8 mx-auto mb-2 text-gray-400" />
                <p>Start typing to search...</p>
                <div className="text-xs mt-4 space-y-1">
                  <p>• Search across POs, vendors, and users</p>
                  <p>• Use ↑↓ to navigate, Enter to select</p>
                  <p>• Press Esc to close</p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          {results.length > 0 && (
            <div className="flex items-center justify-between p-3 bg-gray-50 text-xs text-gray-500 border-t border-gray-200">
              <span>{results.length} result{results.length !== 1 ? 's' : ''} found</span>
              <div className="flex items-center space-x-4">
                <span>↑↓ Navigate</span>
                <span>↵ Select</span>
                <span>Esc Close</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}