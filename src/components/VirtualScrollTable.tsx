'use client';

import { useEffect, useRef, useState, useMemo } from 'react';

interface VirtualScrollTableProps {
  data: any[];
  rowHeight?: number;
  overscan?: number;
  renderRow: (item: any, index: number) => React.ReactNode;
  className?: string;
}

/**
* Renders a virtualized scrollable table that only measures and renders visible rows for performance.
* @example
* VirtualScrollTable({ data: sampleRows, renderRow: (row) => <div>{row.label}</div> })
* <div className="overflow-auto ..."><div style={{ height: `${totalHeight}px` }} /></div>
* @param {{VirtualScrollTableProps}} props - Props containing the dataset, rendering callback, and optional sizing and styling overrides.
* @returns {{JSX.Element}} Virtual scroll container element with only visible rows rendered.
**/
export default function VirtualScrollTable({
  data,
  rowHeight = 80,
  overscan = 5,
  renderRow,
  className = ''
}: VirtualScrollTableProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setScrollTop(container.scrollTop);
    };

    const handleResize = () => {
      setContainerHeight(container.clientHeight);
    };

    container.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleResize);
    
    // Initial height
    setContainerHeight(container.clientHeight);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const { visibleItems, offsetY, totalHeight } = useMemo(() => {
    const totalHeight = data.length * rowHeight;
    const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const endIndex = Math.min(
      data.length - 1,
      Math.ceil((scrollTop + containerHeight) / rowHeight) + overscan
    );

    const visibleItems = data.slice(startIndex, endIndex + 1).map((item, index) => ({
      item,
      index: startIndex + index
    }));

    const offsetY = startIndex * rowHeight;

    return { visibleItems, offsetY, totalHeight };
  }, [data, scrollTop, containerHeight, rowHeight, overscan]);

  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{ height: '600px' }}
    >
      <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map(({ item, index }) => (
            <div key={index} style={{ height: `${rowHeight}px` }}>
              {renderRow(item, index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
