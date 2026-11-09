/**
 * Safe LocalStorage Utility
 * Automatically handles quota exceeded errors, performs storage cleanups,
 * and prevents uncaught storage exceptions from breaking the application.
 */

export interface SynchronousStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

const NON_ESSENTIAL_KEYS = [
  'casino_historical_patterns_v2',
  'adaptiveLogs',
  'casino_opt_records_v1',
  'heatmap_custom_alerts_v1'
];

export const safeStorage: SynchronousStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn(`[safeStorage] Failed to read key "${key}":`, e);
      return null;
    }
  },

  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (e: any) {
      // If QuotaExceededError or write failure, attempt automatic eviction of non-essential caches
      const isQuotaError = 
        e?.name === 'QuotaExceededError' ||
        e?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        e?.code === 22 ||
        e?.code === 1014 ||
        String(e?.message || '').toLowerCase().includes('quota');

      if (isQuotaError) {
        console.warn(`[safeStorage] Quota exceeded while saving "${key}". Evicting non-essential caches...`);
        
        // 1. Evict non-essential items
        for (const nonEssKey of NON_ESSENTIAL_KEYS) {
          if (nonEssKey !== key) {
            try {
              localStorage.removeItem(nonEssKey);
            } catch (_) {}
          }
        }

        // 2. Retry setItem
        try {
          localStorage.setItem(key, value);
          return;
        } catch (retryErr) {
          // 3. If key is casino-ai-storage, attempt emergency compression
          if (key === 'casino-ai-storage') {
            try {
              const parsed = JSON.parse(value);
              if (parsed?.state) {
                // Trim state history heavily to fit
                if (Array.isArray(parsed.state.historyRoulette)) {
                  parsed.state.historyRoulette = parsed.state.historyRoulette.slice(0, 100);
                }
                if (Array.isArray(parsed.state.historyBaccarat)) {
                  parsed.state.historyBaccarat = parsed.state.historyBaccarat.slice(0, 100);
                }
                if (Array.isArray(parsed.state.backtestHistoryRoulette)) {
                  parsed.state.backtestHistoryRoulette = parsed.state.backtestHistoryRoulette.slice(0, 100);
                }
                if (Array.isArray(parsed.state.backtestHistoryBaccarat)) {
                  parsed.state.backtestHistoryBaccarat = parsed.state.backtestHistoryBaccarat.slice(0, 100);
                }
                if (Array.isArray(parsed.state.dailyHistory)) {
                  parsed.state.dailyHistory = parsed.state.dailyHistory.slice(0, 15).map((d: any) => ({
                    ...d,
                    archivedOperations: []
                  }));
                }
                localStorage.setItem(key, JSON.stringify(parsed));
                console.info('[safeStorage] Successfully saved trimmed emergency backup of casino-ai-storage');
                return;
              }
            } catch (_) {}
          }
          console.warn(`[safeStorage] Unable to persist key "${key}" even after cache eviction:`, retryErr);
        }
      } else {
        console.warn(`[safeStorage] Error saving key "${key}":`, e);
      }
    }
  },

  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`[safeStorage] Failed to remove key "${key}":`, e);
    }
  }
};
