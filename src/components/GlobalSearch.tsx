'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X, FileText, Users, Package } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getPOs, getVendors, getAllUsers } from '@/lib/firestore';
import { useAuth } from '@/contexts/AuthContext';

interface SearchResult {
  id: string;
  type: 'po' | 'vendor' | 'user';
  title: string;
  subtitle: string;
  url: string;
}

export default function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { user, userData } = useAuth();

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    
    try {
      const searchResults: SearchResult[] = [];
      const searchLower = searchQuery.toLowerCase();

      // Search POs
      const pos = await getPOs(
        userData?.role === 'Employee' ? user?.uid : undefined,
        userData?.role,
        20
      );
      
      pos.forEach(po => {
        if (
          po.poNumber.toLowerCase().includes(searchLower) ||
          po.vendorName.toLowerCase().includes(searchLower)
        ) {
          searchResults.push({
            id: po.id || '',
            type: 'po',
            title: po.poNumber,
            subtitle: `${po.vendorName} - ₹${po.totalAmount.toLocaleString()} - ${po.status}`,
            url: `/pos/${po.id}`
          });
        }
      });

      // Search Vendors (only for Admin/Manager)
      if (userData?.role !== 'Employee') {
        const vendors = await getVendors();
        vendors.forEach(vendor => {
          if (
            vendor.name.toLowerCase().includes(searchLower) ||
            vendor.contactPerson.toLowerCase().includes(searchLower) ||
            (vendor.gst && vendor.gst.toLowerCase().includes(searchLower))
          ) {
            searchResults.push({
              id: vendor.id || '',
              type: 'vendor',
              title: vendor.name,
              subtitle: `${vendor.contactPerson} - ${vendor.phone}${vendor.gst ? ` - GST: ${vendor.gst}` : ''}`,
              url: '/vendors'
            });
          }
        });

        // Search Users (only for Admin)
        if (userData?.role === 'Admin') {
          const users = await getAllUsers();
          users.forEach(user => {
            if (
              user.name.toLowerCase().includes(searchLower) ||
              user.email.toLowerCase().includes(searchLower)
            ) {
              searchResults.push({
                id: user.id,
                type: 'user',
                title: user.name,
                subtitle: `${user.email} - ${user.role}`,
                url: '/admin/users'
              });
            }
          });
        }
      }

      setResults(searchResults.slice(0, 10)); // Limit to 10 results
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => clearTimeout(delayedSearch);
  }, [query]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        setQuery('');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleResultClick = (result: SearchResult) => {
    router.push(result.url);
    setIsOpen(false);
    setQuery('');
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'po': return FileText;
      case 'vendor': return Users;
      case 'user': return Package;
      default: return Search;
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
      >
        <Search className="w-4 h-4" />
        <span>Search...</span>
      </button>
    );
  }

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={() => setIsOpen(false)}
      />
      
      {/* Search Modal */}
      <div className="fixed top-20 left-1/2 transform -translate-x-1/2 w-full max-w-lg z-50">
        <div className="bg-white rounded-lg shadow-xl border border-gray-200 mx-4">
          {/* Search Input */}
          <div className="flex items-center p-4 border-b border-gray-200">
            <Search className="w-5 h-5 text-gray-400 mr-3" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search POs, vendors, users..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 outline-none text-sm"
              autoFocus
            />
            <button
              onClick={() => setIsOpen(false)}
              className="ml-3 p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500">
                <div className="animate-spin w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full mx-auto mb-2"></div>
                Searching...
              </div>
            ) : results.length > 0 ? (
              <div className="py-2">
                {results.map((result) => {
                  const Icon = getIcon(result.type);
                  return (
                    <button
                      key={result.id}
                      onClick={() => handleResultClick(result)}
                      className="w-full flex items-center p-3 hover:bg-gray-50 text-left"
                    >
                      <Icon className="w-4 h-4 text-gray-400 mr-3 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {result.title}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {result.subtitle}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : query ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                No results found for "{query}"
              </div>
            ) : (
              <div className="p-4 text-center text-gray-500 text-sm">
                Start typing to search...
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}