'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange?: (itemsPerPage: number) => void;
  showItemsPerPage?: boolean;
  className?: string;
}

/**
* Renders pagination controls along with item range information and an optional items-per-page selector for navigating between data pages.
* @example
* Pagination({ currentPage: 1, totalPages: 5, totalItems: 50, itemsPerPage: 10, onPageChange: (page) => console.log(page), onItemsPerPageChange: (count) => console.log(count), showItemsPerPage: true, className: 'mt-4' })
* <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0 mt-4">...</div>
* @param {{PaginationProps}} {{currentPage, totalPages, totalItems, itemsPerPage, onPageChange, onItemsPerPageChange, showItemsPerPage, className}} - Pagination settings and callbacks for controlling the current page, page size, and styling.
* @returns {{JSX.Element | null}} Rendered pagination controls or null when only a single page exists.
**/
export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  showItemsPerPage = true,
  className = ''
}: PaginationProps) {
  
  // Calculate visible page numbers
  /**/ **
  * Generates a paginated range of page numbers with ellipses when pages are skipped.
  * @example
  * getPaginationRange(5, 10)
  * [1, '...', 3, 4, 5, 6, 7, '...', 10]
  * @param {{number}} {{currentPage}} - Current active page number.
  * @param {{number}} {{totalPages}} - Total number of available pages.
  * @returns {{Array<(number|string)>}} Returns an ordered list of page indicators with ellipses.
  **/*/
  const getVisiblePages = () => {
    const delta = 2; // Number of pages to show on each side of current page
    const range = [];
    const rangeWithDots = [];

    for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
      range.push(i);
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages);
    } else if (totalPages > 1) {
      rangeWithDots.push(totalPages);
    }

    return rangeWithDots;
  };

  const visiblePages = getVisiblePages();
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      onPageChange(page);
    }
  };

  if (totalPages <= 1) return null;

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0 ${className}`}>
      {/* Items info */}
      <div className="flex items-center space-x-4">
        <span className="text-sm text-gray-700">
          Showing <span className="font-medium">{startItem}</span> to{' '}
          <span className="font-medium">{endItem}</span> of{' '}
          <span className="font-medium">{totalItems}</span> results
        </span>
        
        {/* Items per page selector */}
        {showItemsPerPage && onItemsPerPageChange && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-700">Show:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
              className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-sm text-gray-700">per page</span>
          </div>
        )}
      </div>

      {/* Pagination controls */}
      <div className="flex items-center space-x-1">
        {/* Previous button */}
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={`
            flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors
            ${currentPage === 1
              ? 'text-gray-400 cursor-not-allowed'
              : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
            }
          `}
        >
          <ChevronLeft className="size-4 mr-1" />
          Previous
        </button>

        {/* Page numbers */}
        <div className="flex items-center space-x-1">
          {visiblePages.map((page, index) => {
            if (page === '...') {
              return (
                <span
                  key={`dots-${index}`}
                  className="px-3 py-2 text-sm text-gray-500"
                >
                  <MoreHorizontal className="size-4" />
                </span>
              );
            }

            const pageNumber = page as number;
            const isCurrentPage = pageNumber === currentPage;

            return (
              <button
                key={pageNumber}
                onClick={() => handlePageChange(pageNumber)}
                className={`
                  px-3 py-2 text-sm font-medium rounded-lg transition-colors
                  ${isCurrentPage
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }
                `}
              >
                {pageNumber}
              </button>
            );
          })}
        </div>

        {/* Next button */}
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={`
            flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors
            ${currentPage === totalPages
              ? 'text-gray-400 cursor-not-allowed'
              : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
            }
          `}
        >
          Next
          <ChevronRight className="size-4 ml-1" />
        </button>
      </div>
    </div>
  );
}

// Hook for pagination logic
/**
* Manages pagination state and returns current page metadata and controls.
* @example
* usePagination(allProducts, 10)
* { currentPage: 1, totalPages: 5, itemsPerPage: 10, paginatedItems: [...], totalItems: 50, setCurrentPage: fn, setItemsPerPage: fn }
* @param {{T[]}} items - List of items to paginate.
* @param {{number}} initialItemsPerPage - Initial count of items per page.
* @returns {{object}} Pagination controls and metadata for the current view.
**/
export function usePagination<T>(
  items: T[],
  initialItemsPerPage: number = 25
) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(initialItemsPerPage);

  const totalPages = Math.ceil(items.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedItems = items.slice(startIndex, endIndex);

  // Reset to first page when items change
  useEffect(() => {
    setCurrentPage(1);
  }, [items.length]);

  // Reset to first page when items per page changes
  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  return {
    currentPage,
    totalPages,
    itemsPerPage,
    paginatedItems,
    totalItems: items.length,
    setCurrentPage,
    setItemsPerPage: handleItemsPerPageChange,
  };
}