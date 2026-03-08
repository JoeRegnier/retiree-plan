import { useEffect, useRef, useCallback, useState } from 'react';
import { runCashFlowProjection } from '@retiree-plan/finance-engine';
import type { CashFlowInput } from '@retiree-plan/finance-engine';

type ProjectionResult = ReturnType<typeof runCashFlowProjection>;

interface UseProjectionWorkerResult {
  data: ProjectionResult | null;
  isRunning: boolean;
  run: (input: CashFlowInput) => void;
}

type ProjectionWorkerRequest = {
  type: 'run';
  payload: CashFlowInput;
  requestId: number;
};

type ProjectionWorkerResponse =
  | { type: 'result'; data: ProjectionResult; requestId?: number }
  | { type: 'error'; message: string; requestId?: number };

export function useProjectionWorker(debounceMs = 300): UseProjectionWorkerResult {
  const [data, setData] = useState<ProjectionResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const fallbackRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceMsRef = useRef(debounceMs);
  const requestCounterRef = useRef(0);
  const latestRequestIdRef = useRef(0);

  useEffect(() => {
    debounceMsRef.current = debounceMs;
  }, [debounceMs]);

  useEffect(() => {
    try {
      const worker = new Worker(new URL('../workers/projection.worker.ts', import.meta.url), {
        type: 'module',
      });

      worker.onmessage = (event: MessageEvent<ProjectionWorkerResponse>) => {
        const { type, requestId } = event.data;
        if (typeof requestId === 'number' && requestId !== latestRequestIdRef.current) {
          return;
        }

        if (type === 'result') {
          setData(event.data.data);
          setIsRunning(false);
          return;
        }

        if (type === 'error') {
          console.error('[useProjectionWorker] worker error:', event.data.message);
          setIsRunning(false);
        }
      };

      workerRef.current = worker;
      fallbackRef.current = false;
    } catch (error) {
      console.warn('[useProjectionWorker] Worker unavailable, using sync fallback:', error);
      workerRef.current = null;
      fallbackRef.current = true;
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  const run = useCallback((input: CashFlowInput) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    timeoutRef.current = setTimeout(() => {
      const requestId = Date.now() + requestCounterRef.current;
      requestCounterRef.current += 1;
      latestRequestIdRef.current = requestId;
      setIsRunning(true);

      if (fallbackRef.current || !workerRef.current) {
        try {
          const result = runCashFlowProjection(input);
          if (latestRequestIdRef.current === requestId) {
            setData(result);
          }
        } catch (error) {
          console.error(
            '[useProjectionWorker] sync fallback error:',
            error instanceof Error ? error.message : String(error),
          );
        } finally {
          if (latestRequestIdRef.current === requestId) {
            setIsRunning(false);
          }
        }

        return;
      }

      const message: ProjectionWorkerRequest = {
        type: 'run',
        payload: input,
        requestId,
      };
      workerRef.current.postMessage(message);
    }, debounceMsRef.current);
  }, []);

  return { data, isRunning, run };
}
