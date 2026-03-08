import { runCashFlowProjection } from '@retiree-plan/finance-engine';
import type { CashFlowInput } from '@retiree-plan/finance-engine';

type ProjectionWorkerRequest = {
  type: 'run';
  payload: CashFlowInput;
  requestId?: number;
};

type ProjectionWorkerResponse =
  | { type: 'result'; data: ReturnType<typeof runCashFlowProjection>; requestId?: number }
  | { type: 'error'; message: string; requestId?: number };

self.onmessage = (event: MessageEvent<ProjectionWorkerRequest>) => {
  if (event.data.type === 'run') {
    try {
      const result = runCashFlowProjection(event.data.payload);
      const message: ProjectionWorkerResponse = {
        type: 'result',
        data: result,
        requestId: event.data.requestId,
      };
      self.postMessage(message);
    } catch (error) {
      const message: ProjectionWorkerResponse = {
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
        requestId: event.data.requestId,
      };
      self.postMessage(message);
    }
  }
};
