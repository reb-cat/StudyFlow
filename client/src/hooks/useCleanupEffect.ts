// Custom hooks for memory leak prevention in React components
import { useEffect, useRef } from 'react';

// Custom hook for managing intervals with automatic cleanup
export function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef<() => void>();

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;

    const id = setInterval(() => savedCallback.current?.(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

// Custom hook for managing timeouts with automatic cleanup
export function useTimeout(callback: () => void, delay: number | null) {
  const savedCallback = useRef<() => void>();
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;

    timeoutRef.current = setTimeout(() => savedCallback.current?.(), delay);
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [delay]);

  const clear = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
  };

  return { clear };
}

// Custom hook for managing async operations with cleanup
export function useAsyncEffect(
  effect: (signal: AbortSignal) => Promise<void>,
  deps: React.DependencyList
) {
  useEffect(() => {
    const controller = new AbortController();
    
    effect(controller.signal).catch(error => {
      if (!controller.signal.aborted) {
        console.error('Async effect error:', error);
      }
    });

    return () => {
      controller.abort();
    };
  }, deps);
}

// Custom hook for cleanup on component unmount
export function useCleanup(cleanup: () => void) {
  useEffect(() => {
    return cleanup;
  }, []);
}