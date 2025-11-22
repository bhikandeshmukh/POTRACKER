'use client';

import { Suspense, lazy, ComponentType, useState, useEffect, useRef } from 'react';
import LoadingSpinner from './LoadingSpinner';

interface LazyWrapperProps {
  fallback?: React.ReactNode;
  className?: string;
}

// Higher-order component for lazy loading
/****
* Creates a higher-order component that lazy loads a component with an optional global fallback.
* @example
* withLazyLoading(() => import('./SomeComponent'))
* LazyWrapper component that renders the lazily loaded component
* @param {{() => Promise<import('./SomeComponent')>}} importFunc - Function that dynamically imports the component.
* @param {{React.ReactNode}} fallback - Optional fallback node shown while loading.
* @returns {{ComponentType<P & LazyWrapperProps>}} A LazyWrapper component that renders the lazy-loaded component inside Suspense.
****/
export function withLazyLoading<P extends object>(
  importFunc: () => Promise<{ default: ComponentType<P> }>,
  fallback?: React.ReactNode
) {
  const LazyComponent = lazy(importFunc);

  /**
  * Renders a lazy-loaded component within a Suspense boundary with configurable fallback UI.
  * @example
  * LazyWrapper({ componentProp: value, fallback: <CustomSpinner /> })
  * <Suspense fallback={...}><LazyComponent {...componentProps} /></Suspense>
  * @param {{P & LazyWrapperProps}} props - Props for the lazy-loaded wrapper, including custom fallback and component props.
  * @returns {JSX.Element} The Suspense-wrapped lazy component with the selected fallback.
  **/
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
/**
* Tracks whether the referenced element is intersecting with the viewport.
* @example
* useIntersectionObserver(ref, { rootMargin: '100px' })
* true
* @param {{React.RefObject<Element>}} ref - Reference to the DOM element to observe.
* @param {{IntersectionObserverInit}} options - Optional IntersectionObserver configuration overrides.
* @returns {{boolean}} Current intersection state of the observed element.
**/
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

/**
* Lazy load provided children with an optional fallback until the component enters the viewport.
* @example
* LazyContainer({children: <span>Content</span>})
* <div className="">Content</div>
* @param {{LazyContainerProps}} {{props}} - Lazy container properties including children, fallback, styling, and intersection thresholds.
* @returns {{JSX.Element}} Rendered container that swaps between the fallback and the loaded children based on intersection status.
**/
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

