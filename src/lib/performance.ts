import React, { useCallback, useRef, useEffect, useMemo } from 'react';

// Memoization and caching utilities
export class CacheManager {
  private static instance: CacheManager;
  private cache: Map<string, { data: any; expiry: number }> = new Map();
  private defaultTTL: number = 300000; // 5 minutes

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  set(key: string, data: any, ttl?: number): void {
    const expiry = Date.now() + (ttl || this.defaultTTL);
    this.cache.set(key, { data, expiry });
  }

  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  invalidate(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }
    
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  size(): number {
    return this.cache.size;
  }
}

// Debounce hook for performance
export const useDebounce = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T => {
  const timeoutRef = useRef<NodeJS.Timeout>();

  return useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    }) as T,
    [callback, delay]
  );
};

// Throttle hook for performance
export const useThrottle = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T => {
  const lastRun = useRef(Date.now());

  return useCallback(
    ((...args: Parameters<T>) => {
      if (Date.now() - lastRun.current >= delay) {
        callback(...args);
        lastRun.current = Date.now();
      }
    }) as T,
    [callback, delay]
  );
};

// Lazy loading utilities
export const createLazyComponent = <T extends React.ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>
) => {
  return React.lazy(importFunc);
};

// Virtual scrolling for large lists
export const useVirtualScrolling = (
  items: any[],
  itemHeight: number,
  containerHeight: number
) => {
  const [scrollTop, setScrollTop] = React.useState(0);
  
  const visibleItems = useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight) + 1,
      items.length
    );
    
    return items.slice(startIndex, endIndex).map((item, index) => ({
      item,
      index: startIndex + index,
      style: {
        position: 'absolute' as const,
        top: (startIndex + index) * itemHeight,
        height: itemHeight,
        width: '100%',
      },
    }));
  }, [items, itemHeight, containerHeight, scrollTop]);

  const totalHeight = items.length * itemHeight;

  return {
    visibleItems,
    totalHeight,
    onScroll: (e: React.UIEvent<HTMLDivElement>) => {
      setScrollTop(e.currentTarget.scrollTop);
    },
  };
};

// Performance monitoring
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, number[]> = new Map();

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  startTimer(label: string): () => void {
    const start = performance.now();
    
    return () => {
      const duration = performance.now() - start;
      this.recordMetric(label, duration);
    };
  }

  recordMetric(label: string, value: number): void {
    if (!this.metrics.has(label)) {
      this.metrics.set(label, []);
    }
    
    const values = this.metrics.get(label)!;
    values.push(value);
    
    // Keep only last 100 measurements
    if (values.length > 100) {
      values.shift();
    }
  }

  getAverageMetric(label: string): number {
    const values = this.metrics.get(label) || [];
    if (values.length === 0) return 0;
    
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  getAllMetrics(): Record<string, { average: number; count: number }> {
    const result: Record<string, { average: number; count: number }> = {};
    
    for (const [label, values] of this.metrics.entries()) {
      result[label] = {
        average: this.getAverageMetric(label),
        count: values.length,
      };
    }
    
    return result;
  }
}

// React performance hooks
export const usePerformanceMetric = (label: string) => {
  const monitor = PerformanceMonitor.getInstance();
  
  return useCallback(() => {
    return monitor.startTimer(label);
  }, [label, monitor]);
};

// Image optimization utilities
export const optimizeImageUrl = (
  url: string,
  width?: number,
  height?: number,
  quality: number = 80
): string => {
  if (!url) return url;
  
  // For external images, you might use a service like Cloudinary or ImageKit
  // This is a simple example that works with query parameters
  const separator = url.includes('?') ? '&' : '?';
  const params: string[] = [];
  
  if (width) params.push(`w=${width}`);
  if (height) params.push(`h=${height}`);
  if (quality !== 80) params.push(`q=${quality}`);
  
  return params.length > 0 ? `${url}${separator}${params.join('&')}` : url;
};

// Database query optimization
export const createOptimizedQuery = (baseQuery: any) => {
  return {
    ...baseQuery,
    // Add common optimizations
    abortSignal: new AbortController().signal,
    // Add pagination
    range: (from: number, to: number) => baseQuery.range(from, to),
    // Add selective fields
    select: (fields: string) => baseQuery.select(fields),
    // Add indexing hints for complex queries
    explain: () => baseQuery.explain({ analyze: true, buffers: true }),
  };
};

// Memory management
export const useMemoryOptimization = () => {
  useEffect(() => {
    const cleanup = () => {
      // Clear caches periodically
      const cache = CacheManager.getInstance();
      if (cache.size() > 1000) {
        cache.invalidate();
      }
    };

    const interval = setInterval(cleanup, 600000); // Every 10 minutes
    return () => clearInterval(interval);
  }, []);
};
