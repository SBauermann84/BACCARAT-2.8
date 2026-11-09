import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { safeStorage } from '../utils/safeStorage';
import { GameType, GameResult, Bankroll, Session, Strategy, ManagementMode, ManagementConfig, RiskProfile } from '../types';
import { dailyStatsService, DailyStatsRecord } from '../services/dailyStatsService';
import { calculateCumulativeGaleLoss } from '../engines/progressionEngine';
import { 
  getInitialMinedBaccaratStrategies, 
  mineBaccaratPatterns, 
  convertMinedPatternsToStrategies 
} from '../engines/baccaratPatternMiningEngine';
import { learningService } from '../services/learningService';

// Debounce timer reference for background pattern mining
let miningTimeoutBaccarat: NodeJS.Timeout | null = null;

// Helper function to merge results, prevent duplicates and ensure chronological order (newest first)
function mergeAndValidateResults(
  currentResults: GameResult[] | undefined | null,
  newResults: GameResult[] | undefined | null,
  limit: number
): GameResult[] {
  const safeCurrent = Array.isArray(currentResults) ? currentResults : [];
  const safeNew = Array.isArray(newResults) ? newResults : [];
  const combined = [...safeNew, ...safeCurrent];

  const seenIds = new Set<string>();
  const uniqueResults: GameResult[] = [];

  for (const item of combined) {
    let itemId = item.id;
    if (!itemId) {
      itemId = `gen-${Math.random().toString(36).substr(2, 9)}`;
    }
    if (!seenIds.has(itemId)) {
      seenIds.add(itemId);
      uniqueResults.push({
        ...item,
        id: itemId
      });
    }
  }

  uniqueResults.sort((a, b) => b.timestamp - a.timestamp);
  return uniqueResults.slice(0, limit);
}

interface AppState {
  currentSession: Session | null;
  history: GameResult[];
  historyRoulette: GameResult[];
  historyBaccarat: GameResult[];
  backtestHistoryRoulette: GameResult[];
  backtestHistoryBaccarat: GameResult[];
  bankroll: Bankroll & { 
    management: ManagementConfig;
  };
  bankrollRoulette: Bankroll & { 
    management: ManagementConfig;
  };
  bankrollBaccarat: Bankroll & { 
    management: ManagementConfig;
  };
  strategies: Strategy[];
  strategiesRoulette: Strategy[];
  strategiesBaccarat: Strategy[];
  deletedSystemStrategyIds?: string[];
  gameType: GameType;
  isLoading: boolean;
  editingStrategyId: string | null;
  settings: {
    currency: string;
    language: string;
    notifications: boolean;
    compactMode: boolean;
    autoReset: boolean;
    backtestLimit: number;
    backtestLimitRoulette: number;
    backtestLimitBaccarat: number;
    heatmapSoundAlerts?: boolean;
    autoPauseEnabled?: boolean;
    defaultBacktestInstant?: boolean;
    globalBacktestGaleLimit?: number;
    extremeNightMode?: boolean;
    allNotificationsEnabled?: boolean;
    stopVisualAlertsEnabled?: boolean;
    fontSizeScale?: 'small' | 'normal' | 'large' | 'xlarge';
    sniperModeEnabled?: boolean;
    entropyFilterEnabled?: boolean;
  };
  
  isSimulationMode: boolean;
  simulationBankrollRoulette: Bankroll & { 
    management: ManagementConfig;
  };
  simulationBankrollBaccarat: Bankroll & { 
    management: ManagementConfig;
  };
  simulationHistoryRoulette: GameResult[];
  simulationHistoryBaccarat: GameResult[];
  toggleSimulationMode: (enabled?: boolean) => void;
  resetSimulationBankroll: (gameType?: GameType) => void;
  resetSimulationHistory: (gameType?: GameType) => void;

  // Actions
  setGameType: (type: GameType) => void;
  setEditingStrategyId: (id: string | null) => void;
  addResult: (result: GameResult) => void;
  removeLastResult: (explicitGameType?: GameType) => void;
  resetHistory: (type: GameType) => void;
  resetBacktestHistory: (type: GameType | 'all') => void;
  resetSession: () => void;
  updateBankroll: (update: Partial<AppState['bankroll']>, explicitGameType?: GameType) => void;
  updateSettings: (update: Partial<AppState['settings']>) => void;
  setBacktestLimit: (gameType: GameType, limit: number) => void;
  startSession: (balance: number) => void;
  endSession: () => void;
  addStrategy: (strategy: Strategy) => void;
  updateStrategy: (id: string, update: Partial<Strategy>) => void;
  bulkUpdateStrategies: (updates: Array<{ id: string; update: Partial<Strategy> }>) => void;
  deleteStrategy: (id: string) => void;
  purgeUnderperformingStrategies: (minWinRate?: number, minEntries?: number) => void;
  deleteAllCustomStrategies: (gameType?: GameType) => void;
  restoreDefaultStrategies: () => void;
  toggleStrategy: (id: string) => void;
  seedHistory: (type: GameType, count: number) => void;
  seedBulkHistory: (rouletteResults: GameResult[], baccaratResults: GameResult[]) => void;
  seedGameHistory: (gameType: GameType, results: GameResult[]) => void;
  compactHistory: () => void;
  
  // Daily stats history integration
  activeOperationalDateRoulette: string;
  activeOperationalDateBaccarat: string;
  dailyHistory: DailyStatsRecord[];
  loadDailyStats: () => Promise<void>;
  closeOperationalDay: (gameType: GameType, notes?: string) => Promise<void>;
  checkAndTriggerAutoDayTransition: (gameType: GameType) => Promise<void>;
  saveDailyStatsRecord: (record: DailyStatsRecord) => Promise<void>;
  deleteDailyStatsRecord: (recordId: string) => Promise<void>;
  clearDailyHistory: () => Promise<void>;
  masterReset: () => Promise<void>;
}

const defaultBankrollBaccarat = {
  balance: 1000,
  initialBalance: 1000,
  currency: 'BRL',
  profit: 0,
  drawdown: 0,
  drawdownLimit: 20,
  stopWin: 50,
  stopLoss: 100,
  maxDailyRounds: 0,
  management: {
    mode: ManagementMode.MARTINGALE,
    profile: RiskProfile.MODERATE,
    initialBet: 1,
    levels: 10,
    multiplier: 2,
    targetProfit: 50,
    stopLoss: 100,
    gameTarget: GameType.BACCARAT,
    coverZero: false,
    coverTie: false,
    minBet: 0.20,
    maxBet: 999999999,
    minChip: 0.20,
    unitsTier: 1.0
  }
};

const defaultStrategiesBaccarat: Strategy[] = [
  {
    id: 'system-baccarat-trends',
    name: 'Análise de Tendência Quente/Fria (Baccarat)',
    gameType: GameType.BACCARAT,
    isActive: true,
    rules: { bets: [] },
    isSystem: true,
    performance: { winRate: 0, totalEntries: 0, wins: 0, losses: 0, roi: 0, maxDrawdown: 0 }
  },
  {
    id: 'system-baccarat-probability',
    name: 'Análise de Probabilidades (Baccarat)',
    gameType: GameType.BACCARAT,
    isActive: true,
    rules: { bets: [] },
    isSystem: true,
    performance: { winRate: 0, totalEntries: 0, wins: 0, losses: 0, roi: 0, maxDrawdown: 0 }
  },
  {
    id: 'system-baccarat-historical-base',
    name: 'Base Histórica de Reconhecimento (Baccarat)',
    gameType: GameType.BACCARAT,
    isActive: true,
    rules: { bets: [] },
    isSystem: true,
    performance: { winRate: 0, totalEntries: 0, wins: 0, losses: 0, roi: 0, maxDrawdown: 0 }
  },
  {
    id: 'system-baccarat-delay',
    name: 'Análise de Frequência e Assertividade (Baccarat)',
    gameType: GameType.BACCARAT,
    isActive: true,
    rules: { bets: [] },
    isSystem: true,
    performance: { winRate: 0, totalEntries: 0, wins: 0, losses: 0, roi: 0, maxDrawdown: 0 }
  }
];

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      activeOperationalDateRoulette: new Date().toLocaleDateString('sv-SE'),
      activeOperationalDateBaccarat: new Date().toLocaleDateString('sv-SE'),
      dailyHistory: [],
      currentSession: null,
      history: [],
      historyRoulette: [],
      historyBaccarat: [],
      backtestHistoryRoulette: [],
      backtestHistoryBaccarat: [],
      bankrollRoulette: { ...defaultBankrollBaccarat, management: { ...defaultBankrollBaccarat.management, gameTarget: GameType.ROULETTE } },
      bankrollBaccarat: defaultBankrollBaccarat,
      bankroll: defaultBankrollBaccarat,
      
      // Simulation / Training Mode State
      isSimulationMode: false,
      simulationBankrollRoulette: { ...defaultBankrollBaccarat, management: { ...defaultBankrollBaccarat.management, gameTarget: GameType.ROULETTE } },
      simulationBankrollBaccarat: { ...defaultBankrollBaccarat },
      simulationHistoryRoulette: [],
      simulationHistoryBaccarat: [],

      strategiesRoulette: [],
      strategiesBaccarat: defaultStrategiesBaccarat,
      strategies: defaultStrategiesBaccarat,
      deletedSystemStrategyIds: [],
      gameType: GameType.BACCARAT,
      isLoading: false,
      editingStrategyId: null,
      settings: {
        currency: 'BRL',
        language: 'pt-BR',
        notifications: true,
        compactMode: false,
        autoReset: false,
        backtestLimit: 10000,
        backtestLimitRoulette: 10000,
        backtestLimitBaccarat: 10000,
        heatmapSoundAlerts: true,
        autoPauseEnabled: true,
        defaultBacktestInstant: false,
        globalBacktestGaleLimit: 2,
        extremeNightMode: false,
        allNotificationsEnabled: true,
        stopVisualAlertsEnabled: true,
        fontSizeScale: 'large',
        sniperModeEnabled: true,
        entropyFilterEnabled: true,
      },

      toggleSimulationMode: (enabled) => set((state) => {
        const simBankrollKey = 'simulationBankrollBaccarat';
        const simHistKey = 'simulationHistoryBaccarat';

        const nextIsSimulationMode = enabled !== undefined ? enabled : !state.isSimulationMode;

        return {
          isSimulationMode: nextIsSimulationMode,
          bankroll: nextIsSimulationMode ? (state[simBankrollKey] || defaultBankrollBaccarat) : state.bankrollBaccarat,
          history: nextIsSimulationMode ? (state[simHistKey] || []) : state.historyBaccarat,
          strategies: state.strategiesBaccarat
        };
      }),

      resetSimulationBankroll: () => set((state) => {
        const simBankrollKey = 'simulationBankrollBaccarat';
        const currentSim = state[simBankrollKey] || defaultBankrollBaccarat;

        const autoStopLoss = currentSim.management
          ? calculateCumulativeGaleLoss(currentSim.management, currentSim.initialBalance)
          : (currentSim.stopLoss || 100);

        const stopLossToUse = currentSim.stopLoss && currentSim.stopLoss !== 50 && currentSim.stopLoss !== 100
          ? currentSim.stopLoss
          : autoStopLoss;

        const resetBankroll = {
          ...currentSim,
          balance: currentSim.initialBalance,
          profit: 0,
          drawdown: 0,
          stopLoss: stopLossToUse,
          management: {
            ...currentSim.management,
            stopLoss: stopLossToUse
          }
        };

        return {
          [simBankrollKey]: resetBankroll,
          ...(state.isSimulationMode ? { bankroll: resetBankroll } : {})
        };
      }),

      resetSimulationHistory: () => set((state) => {
        const simHistKey = 'simulationHistoryBaccarat';
        const simBankrollKey = 'simulationBankrollBaccarat';
        const currentSim = state[simBankrollKey] || defaultBankrollBaccarat;

        const autoStopLoss = currentSim.management
          ? calculateCumulativeGaleLoss(currentSim.management, currentSim.initialBalance)
          : (currentSim.stopLoss || 100);

        const stopLossToUse = currentSim.stopLoss && currentSim.stopLoss !== 50 && currentSim.stopLoss !== 100
          ? currentSim.stopLoss
          : autoStopLoss;

        const resetBankroll = {
          ...currentSim,
          balance: currentSim.initialBalance,
          profit: 0,
          drawdown: 0,
          stopLoss: stopLossToUse,
          management: {
            ...currentSim.management,
            stopLoss: stopLossToUse
          }
        };

        return {
          [simHistKey]: [],
          [simBankrollKey]: resetBankroll,
          ...(state.isSimulationMode ? { history: [], bankroll: resetBankroll } : {})
        };
      }),

      setGameType: () => {}, // Always Baccarat, so noop
      
      setEditingStrategyId: (id) => set({ editingStrategyId: id }),

      addResult: (result) => {
        set((state) => {
          const isSim = state.isSimulationMode || result.isSimulation;

          if (isSim) {
            const simHistKey = 'simulationHistoryBaccarat';
            const simBankrollKey = 'simulationBankrollBaccarat';
            const currentSimBankroll = state[simBankrollKey] || defaultBankrollBaccarat;

            const taggedResult = { ...result, isSimulation: true };
            const newSimHistory = mergeAndValidateResults(state[simHistKey] || [], [taggedResult], 10000);
            const newBalance = currentSimBankroll.balance + (result.profit || 0);
            const newProfit = (currentSimBankroll.profit || 0) + (result.profit || 0);

            const newSimBankroll = {
              ...currentSimBankroll,
              balance: newBalance,
              profit: newProfit
            };

            return {
              [simHistKey]: newSimHistory,
              [simBankrollKey]: newSimBankroll,
              ...(state.isSimulationMode ? { 
                history: newSimHistory, 
                bankroll: newSimBankroll
              } : {})
            };
          }

          const historyKey = 'historyBaccarat';
          const backtestKey = 'backtestHistoryBaccarat';
          const limit = state.settings.backtestLimitBaccarat ?? 10000;

          const newGameHistory = mergeAndValidateResults(state[historyKey], [result], 10000);
          const newBacktestHistory = mergeAndValidateResults(state[backtestKey] || [], [result], limit);
          
          return { 
            [historyKey]: newGameHistory,
            [backtestKey]: newBacktestHistory,
            history: !state.isSimulationMode ? newGameHistory : state.history
          };
        });

        // Background Baccarat patterns mining
        if (miningTimeoutBaccarat) clearTimeout(miningTimeoutBaccarat);
        miningTimeoutBaccarat = setTimeout(() => {
          const state = get();
          const isSim = state.isSimulationMode || result.isSimulation;
          const historyKey = isSim ? 'simulationHistoryBaccarat' : 'historyBaccarat';
          const hist = state[historyKey] || [];
          const minedPatterns = mineBaccaratPatterns(hist);
          const minedStrats = convertMinedPatternsToStrategies(minedPatterns);
          const nonMined = (state.strategiesBaccarat || []).filter(s => !s.id.startsWith('mined-baccarat-'));
          const updatedBaccaratStrategies = [...nonMined, ...minedStrats];
          set({
            strategiesBaccarat: updatedBaccaratStrategies,
            strategies: updatedBaccaratStrategies
          });
          miningTimeoutBaccarat = null;
        }, 0);
      },
      
      removeLastResult: () => {
        const state = get();

        if (state.isSimulationMode) {
          const simHistKey = 'simulationHistoryBaccarat';
          const simBankrollKey = 'simulationBankrollBaccarat';
          const simList = state[simHistKey] || [];
          const lastRes = simList[0];
          const subProfit = lastRes ? (lastRes.profit || 0) : 0;
          const currentSimBankroll = state[simBankrollKey] || defaultBankrollBaccarat;

          const newSimBankroll = {
            ...currentSimBankroll,
            balance: currentSimBankroll.balance - subProfit,
            profit: (currentSimBankroll.profit || 0) - subProfit
          };
          const newSimList = simList.slice(1);

          set({
            [simHistKey]: newSimList,
            [simBankrollKey]: newSimBankroll,
            history: newSimList,
            bankroll: newSimBankroll
          });

          setTimeout(() => {
            const freshState = get();
            const currentSimList = freshState[simHistKey] || [];
            const minedPatterns = mineBaccaratPatterns(currentSimList);
            const minedStrats = convertMinedPatternsToStrategies(minedPatterns);
            const nonMined = (freshState.strategiesBaccarat || []).filter(s => !s.id.startsWith('mined-baccarat-'));
            const updatedStrategiesList = [...nonMined, ...minedStrats];
            set({
              strategiesBaccarat: updatedStrategiesList,
              strategies: updatedStrategiesList
            });
          }, 100);

          return;
        }

        const historyKey = 'historyBaccarat';
        const backtestKey = 'backtestHistoryBaccarat';
        
        const lastResult = state[historyKey][0];
        const profitToSubtract = lastResult ? (lastResult.profit || 0) : 0;
        
        const currentBankrollKey = 'bankrollBaccarat';
        const currentBankroll = state[currentBankrollKey] || defaultBankrollBaccarat;

        const newBankroll = {
          ...currentBankroll,
          balance: currentBankroll.balance - profitToSubtract
        };

        const newHistoryList = state[historyKey].slice(1);

        set({
          [historyKey]: newHistoryList,
          [backtestKey]: (state[backtestKey] || []).slice(1),
          [currentBankrollKey]: newBankroll,
          history: newHistoryList,
          bankroll: newBankroll
        });

        setTimeout(() => {
          const freshState = get();
          const currentHistoryList = freshState[historyKey] || [];
          const minedPatterns = mineBaccaratPatterns(currentHistoryList);
          const minedStrats = convertMinedPatternsToStrategies(minedPatterns);
          const nonMined = (freshState.strategiesBaccarat || []).filter(s => !s.id.startsWith('mined-baccarat-'));
          const updatedStrategiesList = [...nonMined, ...minedStrats];
          set({
            strategiesBaccarat: updatedStrategiesList,
            strategies: updatedStrategiesList
          });
        }, 100);
      },
      
      resetHistory: () => set((state) => {
        if (state.isSimulationMode) {
          const simHistKey = 'simulationHistoryBaccarat';
          const simBankrollKey = 'simulationBankrollBaccarat';
          const currentSim = state[simBankrollKey] || defaultBankrollBaccarat;

          const autoStopLoss = currentSim.management
            ? calculateCumulativeGaleLoss(currentSim.management, currentSim.initialBalance)
            : (currentSim.stopLoss || 100);

          const stopLossToUse = currentSim.stopLoss && currentSim.stopLoss !== 50 && currentSim.stopLoss !== 100
            ? currentSim.stopLoss
            : autoStopLoss;

          const updatedSim = {
            ...currentSim,
            balance: currentSim.initialBalance,
            profit: 0,
            drawdown: 0,
            stopLoss: stopLossToUse,
            management: {
              ...currentSim.management,
              stopLoss: stopLossToUse
            }
          };

          const minedPatterns = mineBaccaratPatterns([]);
          const minedStrats = convertMinedPatternsToStrategies(minedPatterns);
          const nonMined = (state.strategiesBaccarat || []).filter(s => !s.id.startsWith('mined-baccarat-'));
          const updatedBaccaratStrategies = [...nonMined, ...minedStrats];

          return {
            [simHistKey]: [],
            [simBankrollKey]: updatedSim,
            strategiesBaccarat: updatedBaccaratStrategies,
            history: [],
            bankroll: updatedSim,
            strategies: updatedBaccaratStrategies
          };
        }

        const historyKey = 'historyBaccarat';
        const currentBankrollKey = 'bankrollBaccarat';
        const currentBankroll = state[currentBankrollKey] || state.bankroll;

        const autoStopLoss = currentBankroll.management
          ? calculateCumulativeGaleLoss(currentBankroll.management, currentBankroll.initialBalance)
          : (currentBankroll.stopLoss || 100);

        const stopLossToUse = currentBankroll.stopLoss && currentBankroll.stopLoss !== 50 && currentBankroll.stopLoss !== 100
          ? currentBankroll.stopLoss
          : autoStopLoss;

        const updatedBankroll = {
          ...currentBankroll,
          balance: currentBankroll.initialBalance,
          profit: 0,
          drawdown: 0,
          stopLoss: stopLossToUse,
          management: {
            ...currentBankroll.management,
            stopLoss: stopLossToUse
          }
        };

        const strategiesKey = 'strategiesBaccarat';
        const updatedStrategies = state[strategiesKey];

        return { 
          [historyKey]: [],
          [strategiesKey]: updatedStrategies,
          [currentBankrollKey]: updatedBankroll,
          history: [], 
          bankroll: updatedBankroll,
          strategies: updatedStrategies
        };
      }),

      resetBacktestHistory: (type) => set((state) => {
        if (type === 'all') {
          const updatedBankrollBaccarat = {
            ...state.bankrollBaccarat,
            balance: state.bankrollBaccarat.initialBalance,
            profit: 0,
            drawdown: 0
          };
          const resetStrategiesBaccarat = state.strategiesBaccarat || [];

          return {
            backtestHistoryRoulette: [],
            backtestHistoryBaccarat: [],
            bankrollRoulette: { ...updatedBankrollBaccarat, management: { ...updatedBankrollBaccarat.management, gameTarget: GameType.ROULETTE } },
            bankrollBaccarat: updatedBankrollBaccarat,
            bankroll: updatedBankrollBaccarat,
            strategiesRoulette: [],
            strategiesBaccarat: resetStrategiesBaccarat,
            strategies: resetStrategiesBaccarat,
            currentSession: null
          };
        }

        const currentBankrollKey = 'bankrollBaccarat';
        const currentBankroll = state[currentBankrollKey] || state.bankroll;

        const updatedBankroll = {
          ...currentBankroll,
          balance: currentBankroll.initialBalance,
          profit: 0,
          drawdown: 0
        };

        const strategiesKey = 'strategiesBaccarat';
        const updatedStrategies = state[strategiesKey];

        return {
          backtestHistoryBaccarat: [],
          bankrollBaccarat: updatedBankroll,
          strategiesBaccarat: updatedStrategies,
          bankroll: updatedBankroll, 
          strategies: updatedStrategies 
        };
      }),

      resetSession: () => set((state) => {
        const updatedBankrollBaccarat = {
          ...state.bankrollBaccarat,
          balance: state.bankrollBaccarat.initialBalance,
          profit: 0,
          drawdown: 0
        };
        const resetStrategiesBaccarat = state.strategiesBaccarat || [];

        return {
          history: [],
          historyRoulette: [],
          historyBaccarat: [],
          backtestHistoryRoulette: [],
          backtestHistoryBaccarat: [],
          bankrollRoulette: { ...updatedBankrollBaccarat, management: { ...updatedBankrollBaccarat.management, gameTarget: GameType.ROULETTE } },
          bankrollBaccarat: updatedBankrollBaccarat,
          bankroll: updatedBankrollBaccarat,
          strategiesRoulette: [],
          strategiesBaccarat: resetStrategiesBaccarat,
          strategies: resetStrategiesBaccarat
        };
      }),
      
      updateBankroll: (update) => set((state) => {
        if (state.isSimulationMode) {
          const simBankrollKey = 'simulationBankrollBaccarat';
          const currentSimBankroll = state[simBankrollKey] || defaultBankrollBaccarat;

          const mergedManagement = update.management 
            ? { ...(currentSimBankroll.management || {}), ...update.management }
            : currentSimBankroll.management;

          const newSimBankroll = {
            ...currentSimBankroll,
            ...update,
            management: mergedManagement
          };

          const simHistKey = 'simulationHistoryBaccarat';
          if (update.initialBalance !== undefined && update.balance === undefined && (state[simHistKey] || []).length === 0) {
            newSimBankroll.balance = update.initialBalance;
          }

          if (update.management || update.initialBalance !== undefined) {
            const configToUse = newSimBankroll.management;
            if (configToUse.gameTarget === undefined) {
              configToUse.gameTarget = GameType.BACCARAT;
            }
            const initialBalanceToUse = update.initialBalance !== undefined ? update.initialBalance : currentSimBankroll.initialBalance;
            const autoStopLoss = calculateCumulativeGaleLoss(configToUse, initialBalanceToUse);
            newSimBankroll.stopLoss = autoStopLoss;
          }

          newSimBankroll.management = {
            ...newSimBankroll.management,
            targetProfit: newSimBankroll.stopWin,
            stopLoss: newSimBankroll.stopLoss
          };

          return {
            [simBankrollKey]: newSimBankroll,
            bankroll: newSimBankroll
          };
        }

        const currentBankrollKey = 'bankrollBaccarat';
        const currentBankroll = state[currentBankrollKey] || defaultBankrollBaccarat;
        
        const mergedManagement = update.management 
          ? { ...(currentBankroll.management || {}), ...update.management }
          : currentBankroll.management;

        const newBankroll = { 
          ...currentBankroll, 
          ...update,
          management: mergedManagement
        };
        const historyKey = 'historyBaccarat';
        if (update.initialBalance !== undefined && update.balance === undefined && (state[historyKey] || []).length === 0) {
          newBankroll.balance = update.initialBalance;
        }

        if (update.management || update.initialBalance !== undefined) {
          const configToUse = newBankroll.management;
          
          if (configToUse.gameTarget === undefined) {
            configToUse.gameTarget = GameType.BACCARAT;
          }

          const initialBalanceToUse = update.initialBalance !== undefined ? update.initialBalance : currentBankroll.initialBalance;
          
          const autoStopLoss = calculateCumulativeGaleLoss(configToUse, initialBalanceToUse);
          newBankroll.stopLoss = autoStopLoss;
        }

        newBankroll.management = {
          ...newBankroll.management,
          targetProfit: newBankroll.stopWin,
          stopLoss: newBankroll.stopLoss
        };
        return { 
          [currentBankrollKey]: newBankroll,
          bankroll: newBankroll
        };
      }),

      updateSettings: (update) => set((state) => ({
        settings: { ...state.settings, ...update }
      })),

      setBacktestLimit: (gameType, limit) => set((state) => {
        const limitKey = 'backtestLimitBaccarat';
        const backtestKey = 'backtestHistoryBaccarat';
        
        return {
          settings: {
            ...state.settings,
            [limitKey]: limit
          },
          [backtestKey]: state[backtestKey] ? state[backtestKey].slice(0, limit) : []
        };
      }),
      
      startSession: (balance) => set((state) => ({
        currentSession: {
          id: Math.random().toString(36).substr(2, 9),
          gameType: state.gameType,
          startTime: Date.now(),
          initialBalance: balance,
          currentBalance: balance,
          profit: 0,
          history: [],
          status: 'active'
        }
      })),
      
      endSession: () => set((state) => ({
        currentSession: state.currentSession ? { ...state.currentSession, status: 'finished', endTime: Date.now() } : null
      })),
      
      addStrategy: (strategy) => set((state) => {
        const strategiesKey = 'strategiesBaccarat';
        const currentList = state[strategiesKey] || [];
        const updatedList = [...currentList.filter(s => s.id !== strategy.id), strategy];
        const cleanedDeletedIds = (state.deletedSystemStrategyIds || []).filter(id => id !== strategy.id);

        return {
          deletedSystemStrategyIds: cleanedDeletedIds,
          [strategiesKey]: updatedList,
          strategies: updatedList
        };
      }),

      updateStrategy: (id, update) => set((state) => {
        const updateInList = (list: Strategy[]) => list.map(s => s.id === id ? { ...s, ...update } : s);
        const nextBaccarat = updateInList(state.strategiesBaccarat || []);
        return {
          strategiesBaccarat: nextBaccarat,
          strategies: nextBaccarat
        };
      }),

      bulkUpdateStrategies: (updates: Array<{ id: string; update: Partial<Strategy> }>) => set((state) => {
        if (!updates || updates.length === 0) return {};
        const map = new Map<string, Partial<Strategy>>(updates.map(u => [u.id, u.update]));
        const updateInList = (list: Strategy[]) => list.map(s => {
          const patch = map.get(s.id);
          return patch ? ({ ...s, ...patch } as Strategy) : s;
        });
        const nextBaccarat = updateInList(state.strategiesBaccarat || []);
        return {
          strategiesBaccarat: nextBaccarat,
          strategies: nextBaccarat
        };
      }),

      deleteStrategy: (id) => set((state) => {
        const nextBaccarat = (state.strategiesBaccarat || []).filter(s => s.id !== id);
        const updatedDeletedIds = Array.from(new Set([...(state.deletedSystemStrategyIds || []), id]));

        return {
          deletedSystemStrategyIds: updatedDeletedIds,
          strategiesBaccarat: nextBaccarat,
          strategies: nextBaccarat,
          editingStrategyId: state.editingStrategyId === id ? null : state.editingStrategyId
        };
      }),

      purgeUnderperformingStrategies: (minWinRate = 40, minEntries = 2) => set((state) => {
        const filterList = (list: Strategy[]) => {
          return (list || []).filter(strat => {
            const perf = strat.performance;
            if (!perf || (perf.totalEntries || 0) < minEntries) {
              return true;
            }
            return (perf.winRate || 0) >= minWinRate;
          });
        };

        const nextBaccarat = filterList(state.strategiesBaccarat);

        return {
          strategiesBaccarat: nextBaccarat,
          strategies: nextBaccarat
        };
      }),

      deleteAllCustomStrategies: () => set((state) => {
        const filterOutCustom = (list: Strategy[]) => (list || []).filter(s => s.isSystem || s.id.startsWith('system-'));
        const nextB = filterOutCustom(state.strategiesBaccarat);
        return {
          strategiesBaccarat: nextB,
          strategies: nextB
        };
      }),

      restoreDefaultStrategies: () => set(() => {
        const cleanSystemBaccarat = defaultStrategiesBaccarat.map(s => ({
          ...s,
          performance: { winRate: 0, totalEntries: 0, wins: 0, losses: 0, roi: 0, maxDrawdown: 0 }
        }));

        return {
          deletedSystemStrategyIds: [],
          strategiesRoulette: [],
          strategiesBaccarat: cleanSystemBaccarat,
          strategies: cleanSystemBaccarat
        };
      }),

      toggleStrategy: (id) => set((state) => {
        const toggleInList = (list: Strategy[]) => (list || []).map(s => s.id === id ? { ...s, isActive: !s.isActive } : s);
        const nextBaccarat = toggleInList(state.strategiesBaccarat || []);
        return {
          strategiesBaccarat: nextBaccarat,
          strategies: nextBaccarat
        };
      }),

      seedHistory: (type, count) => set((state) => {
        const isSim = state.isSimulationMode;
        const historyKey = 'historyBaccarat';
        const backtestKey = 'backtestHistoryBaccarat';
        
        const seeded: GameResult[] = [];
        const baseTime = Date.now() - (count * 60 * 1000);
        
        for (let i = 0; i < count; i++) {
          let resultValue: any;
          const rand = Math.random();
          if (rand < 0.44) resultValue = 'P';
          else if (rand < 0.88) resultValue = 'B';
          else resultValue = 'T';
          
          seeded.push({
            id: `seed-${i}-${Math.random().toString(36).substr(2, 5)}`,
            gameType: GameType.BACCARAT,
            result: resultValue,
            timestamp: baseTime + (i * 60 * 1000),
            sessionId: 'seed-session',
            metadata: {},
            score: Math.floor(65 + Math.random() * 30),
            isWin: Math.random() > 0.35,
            profit: 0,
            isSimulation: isSim
          });
        }
        
        const newGameHistory = mergeAndValidateResults(state[historyKey] || [], seeded, 10000);
        const newBacktestHistory = mergeAndValidateResults(state[backtestKey] || [], seeded, 10000);
        
        const minedPatterns = mineBaccaratPatterns(newGameHistory);
        const minedStrats = convertMinedPatternsToStrategies(minedPatterns);
        const nonMined = (state.strategiesBaccarat || []).filter(s => !s.id.startsWith('mined-baccarat-'));
        const updatedBaccaratStrategies = [...nonMined, ...minedStrats];

        return {
          [historyKey]: newGameHistory,
          [backtestKey]: newBacktestHistory,
          strategiesBaccarat: updatedBaccaratStrategies,
          history: newGameHistory,
          strategies: updatedBaccaratStrategies 
        };
      }),

      seedBulkHistory: (rouletteResults, baccaratResults) => set((state) => {
        const validatedBaccarat = mergeAndValidateResults([], baccaratResults, 10000);

        const minedBaccarat = convertMinedPatternsToStrategies(mineBaccaratPatterns(validatedBaccarat));
        const nonMinedBaccarat = (state.strategiesBaccarat || []).filter(s => !s.id.startsWith('mined-baccarat-'));
        const updatedBaccaratStrategies = [...nonMinedBaccarat, ...minedBaccarat];

        return {
          historyBaccarat: validatedBaccarat,
          backtestHistoryBaccarat: validatedBaccarat.slice(0, 10000),
          strategiesBaccarat: updatedBaccaratStrategies,
          strategies: updatedBaccaratStrategies,
          history: validatedBaccarat
        };
      }),

      seedGameHistory: (gameType, results) => set((state) => {
        const isSim = state.isSimulationMode;
        const historyKey = 'historyBaccarat';
        const backtestKey = 'backtestHistoryBaccarat';
        
        const newGameHistory = mergeAndValidateResults(state[historyKey] || [], results, 10000);
        const newBacktestHistory = mergeAndValidateResults(state[backtestKey] || [], results, 10000);
        
        const minedPatterns = mineBaccaratPatterns(newGameHistory);
        const minedStrats = convertMinedPatternsToStrategies(minedPatterns);
        const nonMined = (state.strategiesBaccarat || []).filter(s => !s.id.startsWith('mined-baccarat-'));
        const updatedBaccaratStrategies = [...nonMined, ...minedStrats];

        return {
          [historyKey]: newGameHistory,
          [backtestKey]: newBacktestHistory,
          strategiesBaccarat: updatedBaccaratStrategies,
          history: newGameHistory,
          strategies: updatedBaccaratStrategies 
        };
      }),

      compactHistory: () => set((state) => {
        const historyBaccarat = (state.historyBaccarat || []).slice(0, 500);
        const backtestHistoryBaccarat = (state.backtestHistoryBaccarat || []).slice(0, 500);
        return {
          historyBaccarat,
          backtestHistoryBaccarat,
          history: historyBaccarat
        };
      }),

      loadDailyStats: async () => {
        dailyStatsService.registerSyncCallback((records) => {
          set({ dailyHistory: records });
          const s = get();
          learningService.syncAllHistoricalData(
            [],
            s.historyBaccarat,
            records,
            [],
            s.backtestHistoryBaccarat
          );
        });
        const records = await dailyStatsService.getAllDailyStats();
        set({ dailyHistory: records });
        const s = get();
        learningService.syncAllHistoricalData(
          [],
          s.historyBaccarat,
          records,
          [],
          s.backtestHistoryBaccarat
        );
      },

      saveDailyStatsRecord: async (record) => {
        await dailyStatsService.saveDailyStats(record);
        const records = await dailyStatsService.getAllDailyStats();
        set({ dailyHistory: records });
      },

      closeOperationalDay: async (gameType, notes = "") => {
        if (get().isSimulationMode) return;

        const historyKey = 'historyBaccarat';
        const dateKey = 'activeOperationalDateBaccarat';
        const bankrollKey = 'bankrollBaccarat';
        
        const state = get();
        const currentDate = state[dateKey] || new Date().toLocaleDateString('sv-SE');
        const dayOps = state[historyKey] || [];
        const currentBankroll = state[bankrollKey];

        const existingRecords = await dailyStatsService.getAllDailyStats();
        const existingRecordsOfGameType = existingRecords.filter(r => r.gameType === GameType.BACCARAT);
        const operationNumber = existingRecordsOfGameType.length + 1;
        
        const calculated = dailyStatsService.calculateDailyStats(
          currentDate,
          GameType.BACCARAT,
          dayOps,
          currentBankroll.initialBalance,
          currentBankroll.balance,
          notes,
          currentBankroll.management.levels || 3,
          operationNumber
        );

        await dailyStatsService.saveDailyStats(calculated);

        const autoStopLoss = calculateCumulativeGaleLoss(currentBankroll.management, currentBankroll.balance);
        const updatedBankroll = {
          ...currentBankroll,
          initialBalance: currentBankroll.balance,
          stopLoss: autoStopLoss,
          management: {
            ...currentBankroll.management,
            stopLoss: autoStopLoss
          },
          profit: 0,
          drawdown: 0
        };

        const nextDate = new Date().toLocaleDateString('sv-SE');
        const newSessionId = `sess-${Math.random().toString(36).substr(2, 9)}`;

        const nextStateUpdate: any = {
          [historyKey]: [],
          [bankrollKey]: updatedBankroll,
          [dateKey]: nextDate,
          currentSession: {
            id: newSessionId,
            gameType: GameType.BACCARAT,
            startTime: Date.now(),
            initialBalance: updatedBankroll.balance,
            currentBalance: updatedBankroll.balance,
            profit: 0,
            history: [],
            status: 'active'
          },
          history: [],
          bankroll: updatedBankroll
        };

        set(nextStateUpdate);

        const updatedHistory = await dailyStatsService.getAllDailyStats();
        set({ dailyHistory: updatedHistory });
      },

      checkAndTriggerAutoDayTransition: async (gameType) => {
        if (get().isSimulationMode) return;

        const dateKey = 'activeOperationalDateBaccarat';
        const historyKey = 'historyBaccarat';
        const bankrollKey = 'bankrollBaccarat';
        
        const state = get();
        const activeDate = state[dateKey];
        const todayDate = new Date().toLocaleDateString('sv-SE');
        const bankroll = state[bankrollKey];
        const history = state[historyKey] || [];

        if (activeDate && activeDate !== todayDate) {
          console.log(`[Auto Transition] Transição automática de data de ${activeDate} para ${todayDate}.`);
          await state.closeOperationalDay(GameType.BACCARAT, "Fechamento automático por transição de data.");
          return;
        }

        if (bankroll && bankroll.maxDailyRounds && bankroll.maxDailyRounds > 0 && history.length >= bankroll.maxDailyRounds) {
          console.log(`[Auto Transition] Limite diário de rodadas atingido (${history.length}/${bankroll.maxDailyRounds}).`);
          await state.closeOperationalDay(GameType.BACCARAT, `Fechamento automático por limite diário de ${bankroll.maxDailyRounds} rodadas atingido.`);
        }
      },

      deleteDailyStatsRecord: async (recordId: string) => {
        await dailyStatsService.deleteDailyStatsRecord(recordId);
        set((state) => ({
          dailyHistory: state.dailyHistory.filter((r) => r.id !== recordId)
        }));
      },

      clearDailyHistory: async () => {
        await dailyStatsService.clearAllDailyStats();
        set({ dailyHistory: [] });
      },

      masterReset: async () => {
        await dailyStatsService.clearAllDailyStats();

        localStorage.removeItem('casino_patterns');
        localStorage.removeItem('adaptiveLogs');
        localStorage.removeItem('casino_opt_records_v1');
        localStorage.removeItem('heatmap_custom_alerts_v1');

        set(() => {
          const cleanSystemBaccarat = defaultStrategiesBaccarat.map(s => ({
            ...s,
            performance: { winRate: 0, totalEntries: 0, wins: 0, losses: 0, roi: 0, maxDrawdown: 0 }
          }));

          return {
            historyRoulette: [],
            historyBaccarat: [],
            history: [],

            backtestHistoryRoulette: [],
            backtestHistoryBaccarat: [],

            simulationHistoryRoulette: [],
            simulationHistoryBaccarat: [],

            bankrollRoulette: { ...defaultBankrollBaccarat, management: { ...defaultBankrollBaccarat.management, gameTarget: GameType.ROULETTE } },
            bankrollBaccarat: { ...defaultBankrollBaccarat },
            bankroll: { ...defaultBankrollBaccarat },

            strategiesRoulette: [],
            strategiesBaccarat: cleanSystemBaccarat,
            strategies: cleanSystemBaccarat,
            deletedSystemStrategyIds: [],

            dailyHistory: [],
            currentSession: null,
            isSimulationMode: false
          };
        });
      }

    }),
    {
      name: 'casino-ai-baccarat-storage',
      storage: createJSONStorage(() => safeStorage),
      partialize: (state: any) => ({
        gameType: state.gameType,
        bankrollBaccarat: state.bankrollBaccarat,
        bankroll: state.bankroll,
        strategiesBaccarat: state.strategiesBaccarat,
        strategies: state.strategies,
        deletedSystemStrategyIds: state.deletedSystemStrategyIds,
        settings: state.settings,
        activeOperationalDateBaccarat: state.activeOperationalDateBaccarat,
        historyBaccarat: (state.historyBaccarat || []).slice(0, 300),
        backtestHistoryBaccarat: (state.backtestHistoryBaccarat || []).slice(0, 300),
        dailyHistory: (state.dailyHistory || []).slice(0, 30).map((rec: any) => ({
          ...rec,
          archivedOperations: (rec.archivedOperations || []).slice(0, 50)
        })),
        isSimulationMode: state.isSimulationMode,
        simulationBankrollBaccarat: state.simulationBankrollBaccarat,
        simulationHistoryBaccarat: (state.simulationHistoryBaccarat || []).slice(0, 100),
      }),
      merge: (persistedState: any, currentState: any) => {
        if (!persistedState) return currentState;

        const deletedSystemStrategyIds: string[] = persistedState?.deletedSystemStrategyIds || [];

        let mergedStrategiesBaccarat: Strategy[] = defaultStrategiesBaccarat
          .filter(s => !deletedSystemStrategyIds.includes(s.id))
          .map(s => {
            const pStrat = (persistedState?.strategiesBaccarat || []).find((x: any) => x && x.id === s.id);
            return {
              ...s,
              performance: pStrat?.performance || { winRate: 0, totalEntries: 0, wins: 0, losses: 0, roi: 0, maxDrawdown: 0 }
            };
          });

        const otherB = (persistedState?.strategiesBaccarat || []).filter(
          (s: any) => s && s.id && !defaultStrategiesBaccarat.some(ds => ds.id === s.id)
        );

        mergedStrategiesBaccarat = [...mergedStrategiesBaccarat, ...otherB];

        const historyBaccarat = persistedState.historyBaccarat || currentState.historyBaccarat || [];
        const dailyHistory = persistedState.dailyHistory || currentState.dailyHistory || [];

        const pastOpsBaccarat = (dailyHistory || [])
          .filter((record: any) => record && record.gameType === 'baccarat')
          .flatMap((record: any) => record.archivedOperations || []);

        const currentIdsB = new Set(historyBaccarat.map((h: any) => h && h.id));
        const uniquePastOpsB = pastOpsBaccarat.filter((h: any) => h && h.id && !currentIdsB.has(h.id));
        const combinedHistoryBaccarat = [...uniquePastOpsB, ...historyBaccarat].sort((a: any, b: any) => a.timestamp - b.timestamp);

        if (combinedHistoryBaccarat && combinedHistoryBaccarat.length > 0) {
          const minedB = convertMinedPatternsToStrategies(mineBaccaratPatterns(combinedHistoryBaccarat));
          minedB.forEach(mb => {
            const exists = mergedStrategiesBaccarat.some(s => s.id === mb.id);
            if (!exists) {
              mergedStrategiesBaccarat.push(mb);
            } else {
              mergedStrategiesBaccarat = mergedStrategiesBaccarat.map(s => {
                if (s.id === mb.id) {
                  return {
                    ...mb,
                    ...s
                  };
                }
                return s;
              });
            }
          });
        }

        const bankrollBaccarat = persistedState.bankrollBaccarat || currentState.bankrollBaccarat;
        if (bankrollBaccarat && bankrollBaccarat.management) {
          if (bankrollBaccarat.management.maxBet === 5000 || !bankrollBaccarat.management.maxBet) {
            bankrollBaccarat.management.maxBet = 999999999;
          }
        }

        return {
          ...currentState,
          ...persistedState,
          deletedSystemStrategyIds,
          bankrollRoulette: { ...bankrollBaccarat, management: { ...bankrollBaccarat.management, gameTarget: GameType.ROULETTE } },
          bankrollBaccarat,
          bankroll: bankrollBaccarat,
          strategiesRoulette: [],
          strategiesBaccarat: mergedStrategiesBaccarat,
          strategies: mergedStrategiesBaccarat,
          historyRoulette: [],
          historyBaccarat,
          history: historyBaccarat
        };
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          learningService.syncAllHistoricalData(
            [],
            state.historyBaccarat,
            state.dailyHistory,
            [],
            state.backtestHistoryBaccarat
          );
        }
      }
    }
  )
);
