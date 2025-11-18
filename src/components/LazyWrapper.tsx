'use client';

import { Suspense, lazy, ComponentType, useState, useEffect, useRef } from 'react';
import LoadingSpinner from './LoadingSpinner';

interface LazyWrapperProps {
  fallback?: React.ReactNode;
  className?: string;
}

// Higher-order component for lazy loading
export function withLazyLoading<P extends object>(
  importFunc: () => Promise<{ default: ComponentType<P> }>,
  fallback?: React.ReactNode
) {
  const LazyComponent = lazy(importFunc);

  return function LazyWrapper(props: P & LazyWrapperProps) {
    const { fallback: customFallback, className, ...componentProps } = props;
    
    const defaultFallback = (
      <div className={`flex items-center justify-center p-8 ${className || ''}`}>
        <LoadingSpinner size="md" text="Loading component..." />
      </div>
    );

    return (
      <Suspense fallback={customFallback || fallback || defaultFallback}>
        <LazyComponent {...(componentProps as any)} />
      </Suspense>
    );
  };
}

// Lazy load heavy components
export const LazyAdvancedSearch = withLazyLoading(
  () => import('./AdvancedSearch'),
  <div className="flex items-center justify-center p-4">
    <LoadingSpinner size="sm" text="Loading search..." />
  </div>
);

export const LazyDataImportExport = withLazyLoading(
  () => import('./DataImportExport'),
  <div className="flex items-center justify-center p-8">
    <LoadingSpinner size="md" text="Loading import/export..." />
  </div>
);

export const LazyEmailIntegration = withLazyLoading(
  () => import('./EmailIntegration'),
  <div className="flex items-center justify-center p-6">
    <LoadingSpinner size="md" text="Loading email..." />
  </div>
);

export const LazyCommentsSystem = withLazyLoading(
  () => import('./CommentsSystem'),
  <div className="bg-white rounded-lg border border-gray-200 p-6">
    <LoadingSpinner size="md" text="Loading comments..." />
  </div>
);

// Intersection Observer hook for lazy loading on scroll
export function useIntersectionObserver(
  ref: React.RefObject<Element>,
  options: IntersectionObserverInit = {}
) {
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
        ...options
      }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [ref, options]);

  return isIntersecting;
}

// Lazy loading container component
interface LazyContainerProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  className?: string;
  threshold?: number;
  rootMargin?: string;
}

export function LazyContainer({ 
  children, 
  fallback, 
  className = '',
  threshold = 0.1,
  rootMargin = '50px'
}: LazyContainerProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const isIntersecting = useIntersectionObserver(containerRef, {
    threshold,
    rootMargin
  });

  useEffect(() => {
    if (isIntersecting && !isLoaded) {
      setIsLoaded(true);
    }
  }, [isIntersecting, isLoaded]);

  const defaultFallback = (
    <div className="flex items-center justify-center p-8">
      <LoadingSpinner size="md" text="Loading..." />
    </div>
  );

  return (
    <div ref={containerRef} className={className}>
      {isLoaded ? children : (fallback || defaultFallback)}
    </div>
  );
}

