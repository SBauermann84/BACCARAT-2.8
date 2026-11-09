import { runBacktest } from './backtestEngine';

self.onmessage = (e: MessageEvent) => {
  const { history, strategy, managementConfig, stopWin, stopLoss, maxGalesForBacktest } = e.data;
  try {
    const result = runBacktest(history, strategy, managementConfig, stopWin, stopLoss, maxGalesForBacktest);
    self.postMessage({ success: true, result });
  } catch (err: any) {
    self.postMessage({
      success: false,
      error: err instanceof Error ? err.message : String(err)
    });
  }
};
