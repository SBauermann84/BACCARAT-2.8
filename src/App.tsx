import React from 'react';
import { useAppStore } from './store/useAppStore';
import { GameType, ManagementMode, RiskProfile, GameResult, Strategy } from './types';
import { useTranslation } from './locales/translations';
import Layout from './components/Layout';
import OtherGameInput from './components/OtherGameInput';
import StatsCards from './components/StatsCards';
import SignalsPanel from './components/SignalsPanel';
import { ManagementPanel } from './components/ManagementPanel';
import { findMostProbableEntry, checkWin } from './engines/statsEngine';
import { calculateScore, generateSignal } from './engines/scoreEngine';
import { getDynamicBetAndState, calculateProportionalCoverage, getInitialProgressionState, updateProgressionState, generateFibonacciSequence, generatePadovanSequence, getOverrideChipForSignal, calculatePayoutRatioForEntry, getPositionCountForSignal } from './engines/progressionEngine';
import { learningService } from './services/learningService';
import { strategyEngine, StrategySignal } from './engines/strategyEngine';
import { getEnrichedRules } from './lib/rulesEnricher';
import { trendAnalysisEngine } from './engines/trendAnalysisEngine';
import { TrendAnalysisPanel } from './components/TrendAnalysisPanel';
import { DistributionStatsPanel } from './components/DistributionStatsPanel';
import { dynamicStrategyEngine, AdaptiveLog, STRATEGY_EXPLANATIONS, getStrategyExplanation } from './engines/dynamicStrategyEngine';
import { COLOR_MAP } from './constants';
import { PwaInstallWidget } from './components/PwaInstallWidget';
import { SystemDiagnosticsPanel } from './components/SystemDiagnosticsPanel';
import { StorageManager } from './components/StorageManager';
import { DailyStatsHistoryPanel } from './components/DailyStatsHistoryPanel';
import { CompoundInterestPanel } from './components/CompoundInterestPanel';
import { BaccaratPatternMiningPanel } from './components/BaccaratPatternMiningPanel';
import { getInitialMinedBaccaratStrategies } from './engines/baccaratPatternMiningEngine';
import { safeStorage } from './utils/safeStorage';

import { ActionPlanPanel } from './components/ActionPlanPanel';
import { Activity, Clock, Trash2, History as HistoryIcon, CheckCircle2, ShieldCheck, Plus, Settings, Edit3, BookOpen, TrendingUp, Calculator, Target, DollarSign, Percent, Scale, Sparkles, Award, ShieldAlert, Download, Trophy, AlertTriangle, RotateCcw, Search, Filter, Grid, List, Cpu, Layers, Zap, Check, Flame, PauseCircle, PlayCircle, ChevronRight, Compass, BarChart3, FlaskConical } from 'lucide-react';
import { runBacktest, runBacktestAsync, getStrategyPositionCount } from './engines/backtestEngine';
import { MotionConfig } from 'motion/react';
import StrategyEditor from './components/StrategyEditor';
import { NotificationAlerts, AlertsHistoryPanel, BacktestAlert } from './components/NotificationAlerts';
import { OverlayWidget } from './components/OverlayWidget';
import { SessionSummaryReport } from './components/SessionSummaryReport';
import { QuickManagementBar } from './components/QuickManagementBar';
import { BacktestOptimizationPanel } from './components/BacktestOptimizationPanel';

const DecimalCommaInput = ({ 
  value, 
  onChange, 
  className 
}: { 
  value: number; 
  onChange: (val: number) => void; 
  className?: string;
}) => {
  const [localVal, setLocalVal] = React.useState<string>(() => 
    (value || 0).toFixed(2).replace('.', ',')
  );

  React.useEffect(() => {
    const parsed = parseFloat(localVal.replace(',', '.'));
    if (!isNaN(parsed)) {
      if (Math.abs(parsed - value) > 0.001) {
        setLocalVal((value || 0).toFixed(2).replace('.', ','));
      }
    } else {
      setLocalVal((value || 0).toFixed(2).replace('.', ','));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const clean = raw.replace(/[^0-9.,-]/g, '');
    setLocalVal(clean);
    
    const parsed = parseFloat(clean.replace(',', '.'));
    if (!isNaN(parsed)) {
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    const parsed = parseFloat(localVal.replace(',', '.'));
    const finalVal = !isNaN(parsed) ? parsed : 0;
    const formatted = finalVal.toFixed(2).replace('.', ',');
    setLocalVal(formatted);
    onChange(finalVal);
  };

  return (
    <input
      type="text"
      className={className}
      value={localVal}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
};

export default function App() {
  const [activeTab, setActiveTab] = React.useState<string>(() => {
    const store = useAppStore.getState();
    return store.gameType || 'baccarat';
  });
  const [isReportOpen, setIsReportOpen] = React.useState(false);
  const [confirmActionId, setConfirmActionId] = React.useState<string | null>(null);
  const { t } = useTranslation();

  React.useEffect(() => {
    if (confirmActionId) {
      const timer = setTimeout(() => {
        setConfirmActionId(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [confirmActionId]);

  const { 
    gameType, 
    setGameType, 
    history, 
    addResult, 
    bankroll,
    settings,
    updateSettings,
    removeLastResult,
    resetSession,
    strategiesRoulette,
    strategiesBaccarat,
    toggleStrategy,
    deleteStrategy,
    purgeUnderperformingStrategies,
    deleteAllCustomStrategies,
    addStrategy,
    updateStrategy,
    updateBankroll,
    editingStrategyId,
    setEditingStrategyId,
    historyRoulette,
    historyBaccarat,
    backtestHistoryRoulette,
    backtestHistoryBaccarat,
    resetHistory,
    resetBacktestHistory,
    seedHistory,
    seedBulkHistory,
    seedGameHistory,
    setBacktestLimit,
    masterReset,
    dailyHistory,
    loadDailyStats
  } = useAppStore();

  React.useEffect(() => {
    loadDailyStats();
  }, [loadDailyStats]);

  const isGameTab = activeTab === 'baccarat';
  
  // Direct derivation of gameType from activeTab to avoid state lag
  const currentGameType = isGameTab ? (activeTab as GameType) : gameType;

  const strategies = React.useMemo(() => {
    return currentGameType === GameType.ROULETTE ? (strategiesRoulette || []) : (strategiesBaccarat || []);
  }, [currentGameType, strategiesRoulette, strategiesBaccarat]);

  const [backtestSubTab, setBacktestSubTab] = React.useState<GameType>(GameType.BACCARAT);
  const backtestGameType = backtestSubTab;

  const [historicalRecommendation, setHistoricalRecommendation] = React.useState<any>(null);
  const [strategySignals, setStrategySignals] = React.useState<StrategySignal[]>([]);
  const [backtestResultRoulette, setBacktestResultRoulette] = React.useState<any>(null);
  const [backtestResultBaccarat, setBacktestResultBaccarat] = React.useState<any>(null);

  const backtestResult = backtestGameType === GameType.ROULETTE ? backtestResultRoulette : backtestResultBaccarat;
  const setBacktestResult = (val: any) => {
    if (backtestGameType === GameType.ROULETTE) {
      setBacktestResultRoulette(val);
    } else {
      setBacktestResultBaccarat(val);
    }
  };
  const [isBacktesting, setIsBacktesting] = React.useState(false);
  const [backtestAlerts, setBacktestAlerts] = React.useState<BacktestAlert[]>([]);
  const [backtestSortBy, setBacktestSortBy] = React.useState<string>('winRate');
  const [backtestSortDesc, setBacktestSortDesc] = React.useState<boolean>(true);
  const [backtestProgress, setBacktestProgress] = React.useState<Record<string, { progress: number; status: 'idle' | 'running' | 'completed' }>>({});
  const [backtestIntermediateResults, setBacktestIntermediateResults] = React.useState<any[]>([]);
  const [backtestHideLowPerformance, setBacktestHideLowPerformance] = React.useState<boolean>(false);
  const [backtestGroupByRiskProfile, setBacktestGroupByRiskProfile] = React.useState<boolean>(false);

  const backtestGales = settings?.globalBacktestGaleLimit ?? 2;
  const setBacktestGales = (val: number) => {
    updateSettings({ globalBacktestGaleLimit: val });
  };

  const [backtestInitialBetRoulette, setBacktestInitialBetRoulette] = React.useState<number>(() => {
    const cached = safeStorage.getItem('backtestInitialBetRoulette_v2');
    return cached ? Number(cached) : 10;
  });

  const [backtestInitialBetBaccarat, setBacktestInitialBetBaccarat] = React.useState<number>(() => {
    const cached = safeStorage.getItem('backtestInitialBetBaccarat_v2');
    return cached ? Number(cached) : 10;
  });

  React.useEffect(() => {
    safeStorage.setItem('backtestInitialBetRoulette_v2', String(backtestInitialBetRoulette));
  }, [backtestInitialBetRoulette]);

  React.useEffect(() => {
    safeStorage.setItem('backtestInitialBetBaccarat_v2', String(backtestInitialBetBaccarat));
  }, [backtestInitialBetBaccarat]);

  const backtestInitialBet = backtestGameType === GameType.ROULETTE ? backtestInitialBetRoulette : Math.max(0.20, backtestInitialBetBaccarat);
  const setBacktestInitialBet = (val: number) => {
    if (backtestGameType === GameType.ROULETTE) {
      setBacktestInitialBetRoulette(val);
    } else {
      setBacktestInitialBetBaccarat(val);
    }
  };

  const [selectedBacktestManagementModeRoulette, setSelectedBacktestManagementModeRoulette] = React.useState<ManagementMode>(() => {
    const cached = safeStorage.getItem('selectedBacktestManagementModeRoulette_v3');
    return cached && Object.values(ManagementMode).includes(cached as ManagementMode)
      ? (cached as ManagementMode)
      : ManagementMode.MARTINGALE;
  });

  const [selectedBacktestManagementModeBaccarat, setSelectedBacktestManagementModeBaccarat] = React.useState<ManagementMode>(() => {
    const cached = safeStorage.getItem('selectedBacktestManagementModeBaccarat_v3');
    return cached && Object.values(ManagementMode).includes(cached as ManagementMode)
      ? (cached as ManagementMode)
      : ManagementMode.MARTINGALE;
  });

  React.useEffect(() => {
    safeStorage.setItem('selectedBacktestManagementModeRoulette_v3', selectedBacktestManagementModeRoulette);
  }, [selectedBacktestManagementModeRoulette]);

  React.useEffect(() => {
    safeStorage.setItem('selectedBacktestManagementModeBaccarat_v3', selectedBacktestManagementModeBaccarat);
  }, [selectedBacktestManagementModeBaccarat]);

  const selectedBacktestManagementMode = backtestGameType === GameType.ROULETTE ? selectedBacktestManagementModeRoulette : selectedBacktestManagementModeBaccarat;
  const setSelectedBacktestManagementMode = (val: ManagementMode) => {
    if (backtestGameType === GameType.ROULETTE) {
      setSelectedBacktestManagementModeRoulette(val);
    } else {
      setSelectedBacktestManagementModeBaccarat(val);
    }
  };

  const [percentConsMin, setPercentConsMin] = React.useState<number>(() => {
    const cached = safeStorage.getItem('percentConsMin_v1');
    return cached ? Number(cached) : 0.5;
  });
  const [percentConsMax, setPercentConsMax] = React.useState<number>(() => {
    const cached = safeStorage.getItem('percentConsMax_v1');
    return cached ? Number(cached) : 1.5;
  });

  const [percentModMin, setPercentModMin] = React.useState<number>(() => {
    const cached = safeStorage.getItem('percentModMin_v1');
    return cached ? Number(cached) : 1.6;
  });
  const [percentModMax, setPercentModMax] = React.useState<number>(() => {
    const cached = safeStorage.getItem('percentModMax_v1');
    return cached ? Number(cached) : 3.5;
  });

  const [percentAgrMin, setPercentAgrMin] = React.useState<number>(() => {
    const cached = safeStorage.getItem('percentAgrMin_v1');
    return cached ? Number(cached) : 3.6;
  });
  const [percentAgrMax, setPercentAgrMax] = React.useState<number>(() => {
    const cached = safeStorage.getItem('percentAgrMax_v1');
    return cached ? Number(cached) : 8.0;
  });

  React.useEffect(() => {
    safeStorage.setItem('percentConsMin_v1', String(percentConsMin));
    safeStorage.setItem('percentConsMax_v1', String(percentConsMax));
    safeStorage.setItem('percentModMin_v1', String(percentModMin));
    safeStorage.setItem('percentModMax_v1', String(percentModMax));
    safeStorage.setItem('percentAgrMin_v1', String(percentAgrMin));
    safeStorage.setItem('percentAgrMax_v1', String(percentAgrMax));
  }, [percentConsMin, percentConsMax, percentModMin, percentModMax, percentAgrMin, percentAgrMax]);

  const [strategyGaleLimits, setStrategyGaleLimits] = React.useState<Record<string, number>>(() => {
    try {
      const cached = safeStorage.getItem('strategyGaleLimits_v1');
      return cached ? JSON.parse(cached) : {};
    } catch (_) {
      return {};
    }
  });

  React.useEffect(() => {
    safeStorage.setItem('strategyGaleLimits_v1', JSON.stringify(strategyGaleLimits));
  }, [strategyGaleLimits]);

  const [backtestPanelTab, setBacktestPanelTab] = React.useState<'select' | 'results' | 'compare' | 'import'>('select');
  const [comparisonOverrides, setComparisonOverrides] = React.useState<Record<string, {
    managementMode?: ManagementMode;
    galeLimit?: number;
    initialBet?: number;
  }>>({});
  const [selectedComparisonStrategyIds, setSelectedComparisonStrategyIds] = React.useState<string[]>([]);
  const [backtestBankrollMode, setBacktestBankrollMode] = React.useState<'average' | 'max'>('max');
  const [backtestCoverageSectors, setBacktestCoverageSectors] = React.useState<number>(() => {
    const cached = safeStorage.getItem('backtestCoverageSectors_v1');
    return cached ? Number(cached) : 1;
  });

  React.useEffect(() => {
    safeStorage.setItem('backtestCoverageSectors_v1', String(backtestCoverageSectors));
  }, [backtestCoverageSectors]);

  const [importInputText, setImportInputText] = React.useState('');
  const [importSuccessCount, setImportSuccessCount] = React.useState<number | null>(null);
  const [importErrorMsg, setImportErrorMsg] = React.useState<string | null>(null);
  const [importOrderAsc, setImportOrderAsc] = React.useState<boolean>(true);
  const [clearBeforeImport, setClearBeforeImport] = React.useState<boolean>(true);

  const [analyticsSubTab, setAnalyticsSubTab] = React.useState<'action' | 'trends' | 'distribution' | 'heatmap' | 'baccarat_mining'>('baccarat_mining');
  const [rightSideSubTab, setRightSideSubTab] = React.useState<'history' | 'signals'>('history');

  const [selectedBacktestStrategyIdsRoulette, setSelectedBacktestStrategyIdsRoulette] = React.useState<string[]>(() => {
    const cached = safeStorage.getItem('selectedBacktestStrategyIdsRoulette_v4');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {}
    }
    return [
      'trend-assertive',
      'system-roulette-racetrack',
      'system-roulette-tpa84',
      'system-roulette-angel84',
      'system-roulette-trends',
      '1', '3', '4'
    ];
  });

  const [selectedBacktestStrategyIdsBaccarat, setSelectedBacktestStrategyIdsBaccarat] = React.useState<string[]>(() => {
    const cached = safeStorage.getItem('selectedBacktestStrategyIdsBaccarat_v4');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {}
    }
    return [
      'trend-assertive',
      'system-baccarat-trends',
      '2', '5'
    ];
  });

  React.useEffect(() => {
    safeStorage.setItem('selectedBacktestStrategyIdsRoulette_v4', JSON.stringify(selectedBacktestStrategyIdsRoulette));
  }, [selectedBacktestStrategyIdsRoulette]);

  React.useEffect(() => {
    safeStorage.setItem('selectedBacktestStrategyIdsBaccarat_v4', JSON.stringify(selectedBacktestStrategyIdsBaccarat));
  }, [selectedBacktestStrategyIdsBaccarat]);

  const selectedBacktestStrategyIds = backtestGameType === GameType.ROULETTE ? selectedBacktestStrategyIdsRoulette : selectedBacktestStrategyIdsBaccarat;

  const setSelectedBacktestStrategyIds = (val: string[] | ((prev: string[]) => string[])) => {
    if (backtestGameType === GameType.ROULETTE) {
      setSelectedBacktestStrategyIdsRoulette(prev => {
        const next = typeof val === 'function' ? val(prev) : val;
        return next;
      });
    } else {
      setSelectedBacktestStrategyIdsBaccarat(prev => {
        const next = typeof val === 'function' ? val(prev) : val;
        return next;
      });
    }
  };
  const [backtestSearchQuery, setBacktestSearchQuery] = React.useState('');
  const [tableScrollTop, setTableScrollTop] = React.useState(0);

  const backtestActiveStrategies = React.useMemo(() => {
    const trendStrat = {
      id: 'trend-assertive',
      name: '🔥 Algoritmo de Tendências (Frios/Quentes)',
      gameType: backtestGameType,
      isActive: true,
      rules: { bets: [] },
      performance: { winRate: 0, totalEntries: 0, wins: 0, losses: 0, roi: 0, maxDrawdown: 0 }
    };

    const allPossibleStrategies = [
      trendStrat,
      ...strategies.filter(s => s.gameType === backtestGameType)
    ];

    return allPossibleStrategies.filter(s => 
      selectedBacktestStrategyIds.includes(s.id)
    );
  }, [strategies, backtestGameType, selectedBacktestStrategyIds]);

  const sortedBacktestResults = React.useMemo(() => {
    let source = isBacktesting ? backtestIntermediateResults : (backtestResult || []);
    if (!Array.isArray(source) || source.length === 0) return [];
    
    if (backtestHideLowPerformance) {
      source = source.filter((res: any) => res.winRate >= 50);
    }

    return [...source].sort((a: any, b: any) => {
      if (backtestSortBy === 'riskProfile') {
        const orderA = (a.maxGaleNeeded ?? 0) <= 1 ? 1 : (a.maxGaleNeeded ?? 0) <= 3 ? 2 : 3;
        const orderB = (b.maxGaleNeeded ?? 0) <= 1 ? 1 : (b.maxGaleNeeded ?? 0) <= 3 ? 2 : 3;
        if (orderA !== orderB) {
          return backtestSortDesc ? orderB - orderA : orderA - orderB;
        }
        // secondary sort by ROI or profit (most profitable first by default)
        const roiA = Number(a.roi) || 0;
        const roiB = Number(b.roi) || 0;
        return roiB - roiA;
      }

      let valA = a[backtestSortBy];
      let valB = b[backtestSortBy];

      if (backtestSortBy === 'strategyName') {
        const strA = String(valA || '').toLowerCase();
        const strB = String(valB || '').toLowerCase();
        return backtestSortDesc ? strB.localeCompare(strA) : strA.localeCompare(strB);
      }

      const numA = Number(valA) || 0;
      const numB = Number(valB) || 0;
      return backtestSortDesc ? numB - numA : numA - numB;
    });
  }, [backtestResult, backtestIntermediateResults, isBacktesting, backtestSortBy, backtestSortDesc, backtestHideLowPerformance]);

  const bestRoiValue = React.useMemo(() => {
    if (sortedBacktestResults.length === 0) return -Infinity;
    const rois = sortedBacktestResults.map((r: any) => r.roi).filter((val: any) => typeof val === 'number' && !isNaN(val));
    if (rois.length === 0) return -Infinity;
    return Math.max(...rois);
  }, [sortedBacktestResults]);

  const getManagementSequence = React.useCallback((chipSize: number, levels: number, strategyId: string, mode: ManagementMode) => {
    let positionCount = 1;
    let multiplier = 2;
    if (strategyId === 'system-roulette-tpa84') {
      positionCount = 22;
      multiplier = 2; // Forced standard doubling as per user requests (no tripling)
    } else if (strategyId === 'system-roulette-racetrack') {
      positionCount = 11;
      multiplier = 2;
    } else {
      const strat = strategies.find(s => s.id === strategyId);
      if (strat) {
        positionCount = getStrategyPositionCount(strat);
      }
      multiplier = bankroll?.management?.multiplier || 2;
    }

    console.log(`[getManagementSequence] Calculating sequence - Mode: ${mode}, Strategy: ${strategyId}, Max Level/Gale: ${levels}, Base Chip: ${chipSize}, Multiplier: ${multiplier}, Positions Count: ${positionCount}`);

    const list = [];
    let accumulated = 0;

    for (let i = 0; i <= levels; i++) {
      let individualBetSize = chipSize;

      const manualChips = bankroll?.management?.manualGaleChips;
      const isManualOverride = manualChips && manualChips[i] !== undefined && manualChips[i] !== null && manualChips[i] > 0;

      if (isManualOverride) {
        individualBetSize = manualChips[i];
      } else {
        if (mode === ManagementMode.MARTINGALE || mode === ManagementMode.SOROS) {
          // Exponential progression: chipSize * multiplier^i
          individualBetSize = chipSize * Math.pow(multiplier, i);
        } else if (mode === ManagementMode.NIVEL_FIXO_RECUPERACAO) {
          // Linear progression: chipSize * (1 + i)
          individualBetSize = chipSize * (1 + i);
        } else if (mode === ManagementMode.FIBONACCI) {
          const fibSequence = generateFibonacciSequence(Math.max(30, levels + 5));
          const fibMultiplier = fibSequence[i] || fibSequence[fibSequence.length - 1];
          individualBetSize = chipSize * fibMultiplier;
        } else if (mode === ManagementMode.CYCLIC) {
          const cycle = [1, 2, 4, 8, 16];
          const cycleMultiplier = cycle[i % cycle.length] || 1;
          individualBetSize = chipSize * cycleMultiplier;
        } else if (mode === ManagementMode.SISTEMA_2_GANHOS) {
          individualBetSize = chipSize * (i + 1);
        } else if (mode === ManagementMode.SISTEMA_2U_REC1) {
          individualBetSize = chipSize * (1 + 2 * i);
        } else if (mode === ManagementMode.D_ALEMBERT) {
          individualBetSize = chipSize * (i + 1);
        } else if (mode === ManagementMode.STAR_2_2) {
          const star22Seq = [1, 1, 2, 2, 3, 4, 5, 7, 9, 12, 16, 21, 28, 37, 49, 65, 86, 114, 151, 200, 265, 351, 465, 616, 816];
          const starMultiplier = i < star22Seq.length ? star22Seq[i] : star22Seq[star22Seq.length - 1];
          individualBetSize = chipSize * starMultiplier;
        } else if (mode === ManagementMode.STAR_2_0) {
          const star20Seq = [1, 1, 1, 1, 1, 1, 1, 1, 2, 3, 4, 5, 7, 9, 12, 16, 21, 28, 37, 49, 65, 86, 114, 151, 200, 265, 351, 465, 616, 816];
          const starMultiplier = i < star20Seq.length ? star20Seq[i] : star20Seq[star20Seq.length - 1];
          individualBetSize = chipSize * starMultiplier;
        } else if (mode === ManagementMode.DUTCH) {
          const dutchIdx = Math.floor(i / 3);
          const dutchMultiplier = 1 + dutchIdx * 2;
          individualBetSize = chipSize * dutchMultiplier;
        } else if (mode === ManagementMode.PADOVAN) {
          const padovanSequence = generatePadovanSequence(Math.max(30, levels + 5));
          const padovanMultiplier = i < padovanSequence.length ? padovanSequence[i] : padovanSequence[padovanSequence.length - 1];
          individualBetSize = chipSize * padovanMultiplier;
        } else {
          // Fixed or fallback: constant chip size
          individualBetSize = chipSize;
        }
      }

      // Format to 2 decimal places
      individualBetSize = Number(individualBetSize.toFixed(2));

      // Calculate totalEntry based on covered positions
      let totalEntry = Number((individualBetSize * positionCount).toFixed(2));
      accumulated += totalEntry;
      accumulated = Number(accumulated.toFixed(2));

      const stepName = i === 0 ? 'Entrada' : `G${i}`;
      console.log(`  └─> [Step: ${stepName}] chipValue=${individualBetSize}, totalEntry=${totalEntry}, accumulated=${accumulated}`);

      list.push({
        stepName: stepName,
        chipValue: individualBetSize,
        totalEntry: totalEntry,
        accumulated: accumulated
      });
    }

    console.log(`[getManagementSequence] Completed sequence. Generated ${list.length} steps. Final Accumulated Cost: ${accumulated}`);
    return list;
  }, [bankroll, strategies]);

  const getDynamicBankrolls = React.useCallback((maxGaleNeeded: number, chipSize: number, strategyId: string, mode: ManagementMode) => {
    const safeGales = Math.max(0, maxGaleNeeded);
    
    // Conservador: foca em proteger a banca contra sequências longas de perdas, parando cedo (máximo de 1 ou safeGales - 1).
    const galesCons = Math.max(1, safeGales - 1);
    // Moderado: cobre o pior caso registrado no teste (mínimo de 2).
    const galesMod = Math.max(2, safeGales);
    // Agressivo: preparado para enfrentar sequências ainda piores que o teste (+2 gales extras para alta tolerância, mínimo de 3).
    const galesAgr = Math.max(3, safeGales + 2);

    const seqCons = getManagementSequence(chipSize, galesCons, strategyId, mode);
    const seqMod = getManagementSequence(chipSize, galesMod, strategyId, mode);
    const seqAgr = getManagementSequence(chipSize, galesAgr, strategyId, mode);

    const costCons = seqCons.length > 0 ? seqCons[seqCons.length - 1].accumulated : 0;
    const costMod = seqMod.length > 0 ? seqMod[seqMod.length - 1].accumulated : 0;
    const costAgr = seqAgr.length > 0 ? seqAgr[seqAgr.length - 1].accumulated : 0;

    return {
      consMin: costCons,
      consMax: costCons,
      modMin: costMod,
      modMax: costMod,
      agrMin: costAgr,
      agrMax: costAgr,
      
      // Single values for backwards compatibility
      safeBankrollConservative: costCons,
      safeBankrollModerate: costMod,
      safeBankrollAggressive: costAgr,

      costCons,
      costMod,
      costAgr,

      galesCons,
      galesMod,
      galesAgr
    };
  }, [getManagementSequence]);

  const getChipProgressionList = React.useCallback((chipSize: number, gales: number, strategyId: string, mode: ManagementMode) => {
    return getManagementSequence(chipSize, gales, strategyId, mode);
  }, [getManagementSequence]);

  const survivalGaleAnalysis = React.useMemo(() => {
    if (!sortedBacktestResults || sortedBacktestResults.length === 0) return null;

    const completed = sortedBacktestResults.filter((r: any) => r.maxGaleNeeded !== undefined);
    if (completed.length === 0) return null;

    let worstResult = completed[0];
    completed.forEach((r: any) => {
      if ((r.maxGaleNeeded || 0) > (worstResult?.maxGaleNeeded || 0)) {
        worstResult = r;
      }
    });

    const maxGale = worstResult?.maxGaleNeeded || 0;
    const worstStrategyId = worstResult?.strategyId || 'system-roulette-tpa84';
    const worstStrategyName = worstResult?.strategyName || 'TPA84';

    // Get the sequence and total bankroll needed to survive the maximum gale reached (worst-case)
    const sequence = getManagementSequence(backtestInitialBet, maxGale, worstStrategyId, selectedBacktestManagementMode);
    const realBankrollNeeded = sequence.length > 0 ? sequence[sequence.length - 1].accumulated : 0;

    return {
      maxGale,
      realBankrollNeeded,
      sequence,
      bestStrategyId: worstStrategyId,
      bestStrategyName: worstStrategyName
    };
  }, [sortedBacktestResults, backtestInitialBet, getManagementSequence, selectedBacktestManagementMode]);

  const consolidatedStats = React.useMemo(() => {
    if (!sortedBacktestResults || sortedBacktestResults.length === 0) return null;

    let totalProfit = 0;
    let totalWins = 0;
    let totalLosses = 0;
    let sumRoi = 0;
    let maxDrawdown = 0;
    let sumWinRate = 0;
    let profitableCount = 0;

    sortedBacktestResults.forEach((r: any) => {
      totalProfit += r.totalProfit || 0;
      totalWins += r.wins || 0;
      totalLosses += r.losses || 0;
      sumRoi += r.roi || 0;
      sumWinRate += r.winRate || 0;
      if ((r.totalProfit || 0) > 0) {
        profitableCount++;
      }
      if ((r.maxDrawdown || 0) > maxDrawdown) {
        maxDrawdown = r.maxDrawdown;
      }
    });

    const avgRoi = sumRoi / sortedBacktestResults.length;
    const avgWinRate = sumWinRate / sortedBacktestResults.length;

    return {
      totalProfit,
      totalWins,
      totalLosses,
      avgRoi,
      maxDrawdown,
      avgWinRate,
      profitableCount,
      totalCount: sortedBacktestResults.length
    };
  }, [sortedBacktestResults]);

  const formatBankrollValue = React.useCallback((value: number) => {
    const hasDecimals = backtestInitialBet % 1 !== 0;
    return hasDecimals 
      ? value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : Math.round(value).toLocaleString('pt-BR');
  }, [backtestInitialBet]);

  const handleBacktestSort = (column: string) => {
    if (backtestSortBy === column) {
      setBacktestSortDesc(!backtestSortDesc);
    } else {
      setBacktestSortBy(column);
      setBacktestSortDesc(true);
    }
  };

  // Persist backtest selections to localStorage
  React.useEffect(() => {
    safeStorage.setItem('selectedBacktestStrategyIds_v3', JSON.stringify(selectedBacktestStrategyIds));
  }, [selectedBacktestStrategyIds]);

  // Reset the view tab and search query when switching game types
  React.useEffect(() => {
    setBacktestPanelTab('select');
    setBacktestSearchQuery('');
  }, [backtestGameType]);

  const [adaptiveLogs, setAdaptiveLogs] = React.useState<AdaptiveLog[]>(() => {
    try {
      const cached = safeStorage.getItem('adaptiveLogs');
      return cached ? JSON.parse(cached) : [];
    } catch (_) {
      return [];
    }
  });

  const [isAdaptiveIAEnabled, setIsAdaptiveIAEnabled] = React.useState<boolean>(() => {
    try {
      const cached = safeStorage.getItem('isAdaptiveIAEnabled');
      return cached !== null ? cached === 'true' : true;
    } catch (_) {
      return true;
    }
  });

  const [selectedStrategyIdForExplanation, setSelectedStrategyIdForExplanation] = React.useState<string | null>('1');
  const [deletingStrategyId, setDeletingStrategyId] = React.useState<string | null>(null);
  const [confirmRestoreDefaults, setConfirmRestoreDefaults] = React.useState<boolean>(false);
  const [strategyCategoryTab, setStrategyCategoryTab] = React.useState<'all' | 'system' | 'custom' | 'adaptive' | 'elite'>('all');
  const [strategySearchQuery, setStrategySearchQuery] = React.useState<string>('');
  const [strategyStatusFilter, setStrategyStatusFilter] = React.useState<'all' | 'active' | 'paused' | 'signal'>('all');
  const [strategyViewMode, setStrategyViewMode] = React.useState<'grid' | 'dense'>('grid');

  React.useEffect(() => {
    if (adaptiveLogs && adaptiveLogs.length > 0) {
      safeStorage.setItem('adaptiveLogs', JSON.stringify(adaptiveLogs.slice(0, 50)));
    }
  }, [adaptiveLogs]);

  React.useEffect(() => {
    safeStorage.setItem('isAdaptiveIAEnabled', String(isAdaptiveIAEnabled));
  }, [isAdaptiveIAEnabled]);

  // Self-heal and synchronize all standard system strategies if missing from hydrated local storage (Run once on mount with no reactive loops)
  const hasSelfHealedSystemStrategies = React.useRef(false);
  const lastNotifiedS84ResultId = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (hasSelfHealedSystemStrategies.current) return;
    hasSelfHealedSystemStrategies.current = true;

    const defaultSystemStrategies = [
      {
        id: 'system-roulette-racetrack',
        name: 'TERMINAL S84',
        gameType: GameType.ROULETTE,
        isActive: true,
        rules: { bets: [] },
        isSystem: true,
        performance: { winRate: 0, totalEntries: 0, wins: 0, losses: 0, roi: 0, maxDrawdown: 0 }
      },
      {
        id: 'system-roulette-tpa84',
        name: 'TPA84 (Penúltimo + Antepenúltimo)',
        gameType: GameType.ROULETTE,
        isActive: true,
        rules: { bets: [] },
        isSystem: true,
        performance: { winRate: 0, totalEntries: 0, wins: 0, losses: 0, roi: 0, maxDrawdown: 0 }
      },
      {
        id: 'system-roulette-angel84',
        name: 'Angel84',
        gameType: GameType.ROULETTE,
        isActive: true,
        rules: { bets: [] },
        isSystem: true,
        performance: { winRate: 0, totalEntries: 0, wins: 0, losses: 0, roi: 0, maxDrawdown: 0 }
      },
      {
        id: 'system-roulette-trends',
        name: 'Análise de Tendência Quente/Fria (Roleta)',
        gameType: GameType.ROULETTE,
        isActive: true,
        rules: { bets: [] },
        isSystem: true,
        performance: { winRate: 0, totalEntries: 0, wins: 0, losses: 0, roi: 0, maxDrawdown: 0 }
      },
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
        id: 'system-roulette-probability',
        name: 'Análise de Probabilidades (Roleta)',
        gameType: GameType.ROULETTE,
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
        id: 'system-roulette-historical-base',
        name: 'Base Histórica de Reconhecimento (Roleta)',
        gameType: GameType.ROULETTE,
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
        id: 'system-roulette-delay',
        name: 'Análise de Frequência e Assertividade (Roleta)',
        gameType: GameType.ROULETTE,
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

    const state = useAppStore.getState();
    const deletedIds = state.deletedSystemStrategyIds || [];
    defaultSystemStrategies.forEach(ds => {
      const isRoulette = ds.gameType === GameType.ROULETTE;
      const listToCheck = isRoulette ? (state.strategiesRoulette || []) : (state.strategiesBaccarat || []);
      const exists = listToCheck.some(s => s.id === ds.id);
      const wasDeleted = deletedIds.includes(ds.id);
      if (!exists && !wasDeleted) {
        useAppStore.getState().addStrategy(ds);
      }
    });
  }, []);

  // Monte Carlo states
  const [isRouletteMCSimulating, setIsRouletteMCSimulating] = React.useState(false);
  const [rouletteMCStep, setRouletteMCStep] = React.useState(0);
  const [rouletteMCProgress, setRouletteMCProgress] = React.useState(0);
  const [rouletteMCResults, setRouletteMCResults] = React.useState<any>(null);

  const [isBaccaratMCSimulating, setIsBaccaratMCSimulating] = React.useState(false);
  const [baccaratMCStep, setBaccaratMCStep] = React.useState(0);
  const [baccaratMCProgress, setBaccaratMCProgress] = React.useState(0);
  const [baccaratMCResults, setBaccaratMCResults] = React.useState<any>(null);

  // State for evaluated strategies to prevent CPU-intensive backtests during render loops
  const [evaluatedStrategies, setEvaluatedStrategies] = React.useState<any[]>([]);

  // Fast, lightweight strategy performance mapper for the strategies list
  React.useEffect(() => {
    const runCalculation = () => {
      const result = (strategies || []).map(strat => {
        const perf = strat.performance || { winRate: 0, totalEntries: 0, wins: 0, losses: 0, roi: 0, maxDrawdown: 0 };
        return {
          strat,
          winRate: perf.winRate || 0,
          totalEntries: perf.totalEntries || (perf.wins + perf.losses) || 0,
          roi: perf.roi || 0,
          wins: perf.wins || 0,
          losses: perf.losses || 0,
          maxDrawdown: perf.maxDrawdown || 0,
          isTested: (perf.wins + perf.losses) > 0
        };
      });

      setEvaluatedStrategies(result);
    };

    runCalculation();
  }, [strategies]);

  const editingStrategy = strategies.find(s => s.id === editingStrategyId) || 
    (strategiesRoulette || []).find(s => s.id === editingStrategyId) || 
    (strategiesBaccarat || []).find(s => s.id === editingStrategyId);

  const handleSaveStrategy = (updatedStrategy: any) => {
    const currentAll = [...(strategies || []), ...(strategiesRoulette || []), ...(strategiesBaccarat || [])];
    if (currentAll.some(s => s.id === updatedStrategy.id)) {
      updateStrategy(updatedStrategy.id, updatedStrategy);
    } else {
      addStrategy(updatedStrategy);
    }
    setEditingStrategyId(null);
  };

  const filteredHistory = React.useMemo(() => {
    return currentGameType === GameType.ROULETTE ? (historyRoulette || []) : (historyBaccarat || []);
  }, [currentGameType, historyRoulette, historyBaccarat]);

  // Stop Win / Stop Loss notifications monitor
  const notifiedStopWinRef = React.useRef<Record<string, boolean>>({});
  const notifiedStopLossRef = React.useRef<Record<string, boolean>>({});
  const notifiedStopLossNearRef = React.useRef<Record<string, boolean>>({});

  React.useEffect(() => {
    // Reset notifications if history is empty (e.g. session reset or day closed)
    if (filteredHistory.length === 0) {
      notifiedStopWinRef.current[currentGameType] = false;
      notifiedStopLossRef.current[currentGameType] = false;
      notifiedStopLossNearRef.current[currentGameType] = false;
      return;
    }

    const initialBalance = bankroll?.initialBalance ?? 1000;
    const balance = bankroll?.balance ?? 1000;
    const stopLoss = bankroll?.stopLoss ?? 100;
    const stopWin = bankroll?.stopWin ?? 200;

    const currentLoss = initialBalance - balance;
    const currentProfit = balance - initialBalance;

    // Trigger Stop Win if reached
    if (stopWin > 0 && currentProfit >= stopWin) {
      if (!notifiedStopWinRef.current[currentGameType]) {
        notifiedStopWinRef.current[currentGameType] = true;
        
        // Only trigger alerts if master notifications setting is enabled
        if (settings?.allNotificationsEnabled !== false) {
          const formattedStopWin = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: bankroll?.currency || 'BRL' }).format(stopWin);
          const formattedBalance = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: bankroll?.currency || 'BRL' }).format(balance);
          
          const stopWinAlert: BacktestAlert = {
            id: `stop-win-hit-${currentGameType}-${Date.now()}`,
            strategyName: `Meta de Stop Win Atingida! 🏆`,
            winRate: 100,
            gameType: currentGameType,
            timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            type: 'success',
            message: `Parabéns! Você alcançou o seu objetivo de Stop Win de ${formattedStopWin} (Saldo Atual: ${formattedBalance}). Considere garantir seus lucros e finalizar a sessão!`
          };

          setBacktestAlerts(prev => [stopWinAlert, ...prev]);
        }
      }
    } else {
      notifiedStopWinRef.current[currentGameType] = false;
    }

    // Trigger Stop Loss if reached
    if (stopLoss > 0 && currentLoss >= stopLoss) {
      if (!notifiedStopLossRef.current[currentGameType]) {
        notifiedStopLossRef.current[currentGameType] = true;
        
        if (settings?.allNotificationsEnabled !== false) {
          const formattedStopLoss = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: bankroll?.currency || 'BRL' }).format(stopLoss);
          const formattedBalance = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: bankroll?.currency || 'BRL' }).format(balance);

          const stopLossAlert: BacktestAlert = {
            id: `stop-loss-hit-${currentGameType}-${Date.now()}`,
            strategyName: `Limite de Stop Loss Atingido! ⚠️`,
            winRate: 0,
            gameType: currentGameType,
            timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            message: `Atenção: O limite máximo de perda de ${formattedStopLoss} foi atingido (Saldo Atual: ${formattedBalance}). Recomendamos parar imediatamente a operação para proteger sua banca.`
          };

          setBacktestAlerts(prev => [stopLossAlert, ...prev]);
        }
      }
    } else {
      notifiedStopLossRef.current[currentGameType] = false;
    }

    // Trigger Stop Loss Near (remaining 10%)
    if (stopLoss > 0 && currentLoss >= stopLoss * 0.9 && currentLoss < stopLoss) {
      if (!notifiedStopLossNearRef.current[currentGameType]) {
        notifiedStopLossNearRef.current[currentGameType] = true;

        if (settings?.allNotificationsEnabled !== false) {
          const formattedRemaining = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: bankroll?.currency || 'BRL' }).format(stopLoss - currentLoss);
          const formattedStopLoss = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: bankroll?.currency || 'BRL' }).format(stopLoss);

          const stopLossNearAlert: BacktestAlert = {
            id: `stop-loss-near-${currentGameType}-${Date.now()}`,
            strategyName: `Stop Loss Próximo! 🚨`,
            winRate: 10,
            gameType: currentGameType,
            timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            type: 'signal', // yellow/amber warning
            message: `Aviso Importante: Você está a menos de 10% de atingir o Stop Loss (Faltam apenas ${formattedRemaining} de perdas para o limite total de ${formattedStopLoss}). Avalie pausar a sessão.`
          };

          setBacktestAlerts(prev => [stopLossNearAlert, ...prev]);
        }
      }
    } else if (stopLoss > 0 && currentLoss < stopLoss * 0.8) {
      notifiedStopLossNearRef.current[currentGameType] = false;
    }
  }, [
    currentGameType,
    bankroll?.balance,
    bankroll?.initialBalance,
    bankroll?.stopLoss,
    bankroll?.stopWin,
    settings?.allNotificationsEnabled,
    filteredHistory.length
  ]);

  const activeSignals = React.useMemo(() => {
    if (filteredHistory.length < 5) return [];
    
    const signals: any[] = [];

    // Inject the most assertive Trend Analysis (Frios / Quentes) as an active signal
    const isTrendsActive = strategies.some(s => s.id === 'system-baccarat-trends' && s.isActive);

    if (isTrendsActive) {
      const mostAssertiveTrend = trendAnalysisEngine.getBaccaratTrends(filteredHistory).mostAssertive;

      if (mostAssertiveTrend && mostAssertiveTrend.confidence >= 70) {
        signals.push({
          type: mostAssertiveTrend.confidence > 85 ? 'strong' : 'moderate',
          patternName: `🔥 Tendência Quente: ${mostAssertiveTrend.category} - ${mostAssertiveTrend.name}`,
          confidence: mostAssertiveTrend.confidence,
          entry: mostAssertiveTrend.entry,
          source: 'strategy',
          winRate: Math.round(mostAssertiveTrend.confidence),
          strategyId: 'system-baccarat-trends'
        });
      }
    }

    const isProbabilityActive = strategies.some(s => s.id === 'system-baccarat-probability' && s.isActive);

    if (isProbabilityActive) {
      const bestProbability = findMostProbableEntry(history, currentGameType);
      
      // User requested only signals with > 64% assertivity (confidence)
      if (bestProbability && bestProbability.confidence > 64) {
        signals.push({
          type: bestProbability.confidence > 85 ? 'strong' : 'moderate',
          patternName: bestProbability.patternName,
          confidence: bestProbability.confidence,
          entry: bestProbability.entry,
          source: 'engine',
          strategyId: 'system-baccarat-probability'
        });
      }
    }

    const isHistoricalActive = strategies.some(s => s.id === 'system-baccarat-historical-base' && s.isActive);

    if (isHistoricalActive) {
      const instantHistoricalRec = learningService.getRecommendedEntrySync(currentGameType, filteredHistory);
      if (instantHistoricalRec && instantHistoricalRec.confidence >= 65) {
        signals.push({
          type: (instantHistoricalRec.confidence || instantHistoricalRec.winRate) >= 80 ? 'strong' : 'moderate',
          patternName: instantHistoricalRec.patternName || `Base Histórica (${instantHistoricalRec.count} ocorrências)`,
          confidence: instantHistoricalRec.confidence || instantHistoricalRec.winRate,
          entry: instantHistoricalRec.entry,
          source: 'database',
          entryNumbers: instantHistoricalRec.entryNumbers,
          unitsRequired: instantHistoricalRec.unitsRequired || 1,
          strategyId: 'system-baccarat-historical-base'
        });
      }
    }

    // Instant Synchronous Strategy Signals Detection (0ms latency)
    const instantCustomSignals = strategyEngine.findStrategySignalsSync(strategies, filteredHistory, currentGameType);
    if (instantCustomSignals.length > 0) {
      instantCustomSignals.forEach(sig => {
        const isStratActive = strategies.some(s => s.id === sig.strategyId && s.isActive);
        if (isStratActive) {
          signals.push(sig);
        }
      });
    }

    const isDelayActive = strategies.some(s => s.id === 'system-baccarat-delay' && s.isActive);

    if (isDelayActive) {
      const last = filteredHistory[0];
      if (last && last.score && last.score > 64 && signals.length === 0) {
        signals.push({
          type: last.score > 85 ? 'strong' : 'moderate',
          patternName: 'Análise de Frequência e Assertividade',
          confidence: last.score,
          entry: 'PLAYER',
          source: 'engine',
          strategyId: 'system-baccarat-delay'
        });
      }
    }
    
    // Helper to calculate units/positions required for a signal's entry
    const calculateUnitsRequiredForEntry = (entryStr: string | undefined, strategyIdStr: string | undefined): number => {
      return 1;
    };

    // Helper to determine the bet category of a signal's recommended entry
    const getEntryBetCategory = (entryStr: string, nameStr: string): string | null => {
      return null;
    };

    // Helper to check if a specific bet category is active among non-general strategy panel items
    const isBetCategoryActive = (category: string | null): boolean => {
      return true;
    };

    // Filter signals to ensure they only contain active strategies AND active bet categories (e.g. no inactive colors/dozens/columns)
    const filteredSignals = signals.filter(sig => {
      const strat = strategies.find(s => s.id === sig.strategyId);
      if (!strat || !strat.isActive) return false;

      // Check if entry belongs to a category that is not active in the strategy panel
      const category = getEntryBetCategory(sig.entry, sig.patternName || '');
      if (category && !isBetCategoryActive(category)) {
        return false;
      }

      return true;
    });

    // Resolve real-time win rate and unitsRequired for each signal based on evaluatedStrategies
    const signalsWithWinRate = filteredSignals.map(sig => {
      const evalStrat = evaluatedStrategies.find(item => item.strat.id === sig.strategyId);
      const winRate = evalStrat ? evalStrat.winRate : (sig.confidence || 0);
      let units = sig.unitsRequired !== undefined ? sig.unitsRequired : calculateUnitsRequiredForEntry(sig.entry, sig.strategyId);
      
      // Safety check: force 1 for any simple chance (1:1) or dozen/column (2:1) entry
      if (sig.entry) {
        units = 1;
      }

      return {
        ...sig,
        strategyWinRate: winRate,
        strategyWins: evalStrat ? evalStrat.wins : undefined,
        strategyLosses: evalStrat ? evalStrat.losses : undefined,
        strategyRoi: evalStrat ? evalStrat.roi : undefined,
        strategyTotalEntries: evalStrat ? evalStrat.totalEntries : undefined,
        strategyMaxDrawdown: evalStrat ? evalStrat.maxDrawdown : undefined,
        unitsRequired: units
      };
    });

    // Sort signals descending by their live signal confidence (assertividade no momento) as requested by the user,
    // falling back to their strategy's overall backtest win rate.
    signalsWithWinRate.sort((a, b) => {
      const assertivenessA = a.confidence || a.winRate || a.strategyWinRate || 0;
      const assertivenessB = b.confidence || b.winRate || b.strategyWinRate || 0;
      if (assertivenessB !== assertivenessA) {
        return assertivenessB - assertivenessA;
      }
      return (b.strategyWinRate || 0) - (a.strategyWinRate || 0);
    });

    // We do NOT truncate the signals list so the user can see all active confirmations,
    // but the highest assertiveness (strategyWinRate) signal is always at index 0 and takes priority.
    return signalsWithWinRate;
  }, [filteredHistory, history, currentGameType, strategies, evaluatedStrategies]);

  // Fetch historical Recommendation & Strategy Signals
  React.useEffect(() => {
    if (filteredHistory.length >= 2) {
      learningService.getRecommendedEntry(currentGameType, filteredHistory).then(setHistoricalRecommendation);
      strategyEngine.findStrategySignals(strategies, filteredHistory, currentGameType).then(setStrategySignals);
    } else {
      setHistoricalRecommendation(null);
      setStrategySignals([]);
    }
  }, [filteredHistory, currentGameType, strategies]);

  // Sync back to store for actions that need it
  React.useEffect(() => {
    if (isGameTab) {
      setGameType(activeTab as GameType);
    }
  }, [activeTab, setGameType, isGameTab]);

  // Reset analyticsSubTab to 'action' on currentGameType change
  React.useEffect(() => {
    setAnalyticsSubTab('action');
  }, [currentGameType]);

  const winRate = React.useMemo(() => {
    // Count both strong and moderate signals with entries for the session win rate
    const signalResults = filteredHistory.filter(h => h.isWin !== undefined);
    if (signalResults.length === 0) return 0;
    const wins = signalResults.filter(h => h.isWin).length;
    return (wins / signalResults.length) * 100;
  }, [filteredHistory]);

  const nextBetState = React.useMemo(() => {
    const activeSig = activeSignals[0];
    const positions = getPositionCountForSignal(activeSig);
    const overrideChip = getOverrideChipForSignal(activeSig, bankroll.management);
    const targetPayoutRatio = activeSig ? calculatePayoutRatioForEntry(activeSig.entry, activeSig) : undefined;
    return getDynamicBetAndState(filteredHistory, bankroll.management, positions, overrideChip, targetPayoutRatio);
  }, [filteredHistory, bankroll.management, activeSignals]);

  const derivedStats = React.useMemo(() => {
    const profit = filteredHistory.reduce((acc, h) => acc + (h.profit || 0), 0);
    const initialBalance = bankroll.initialBalance || 1000;
    
    const profitPercentage = (profit / initialBalance) * 100;

    // Drawdown calculation
    let maxBalance = initialBalance;
    let currentBalance = initialBalance;
    let maxDD = 0;
    
    // We need history in chronological order (oldest first)
    const chronoHistory = [...filteredHistory].reverse();
    chronoHistory.forEach(h => {
      currentBalance += (h.profit || 0);
      if (currentBalance > maxBalance) maxBalance = currentBalance;
      const dd = maxBalance > 0 ? ((maxBalance - currentBalance) / maxBalance) * 100 : 0;
      if (dd > maxDD) maxDD = dd;
    });

    // Highest Gale level calculation chronologically
    let maxGaleLevelReached = 0;
    let currentGale = 0;
    const isRecoveryMode = [
      ManagementMode.MARTINGALE,
      ManagementMode.FIBONACCI,
      ManagementMode.D_ALEMBERT,
      ManagementMode.CYCLIC,
      ManagementMode.SISTEMA_2_GANHOS,
      ManagementMode.SISTEMA_2U_REC1,
      ManagementMode.OSCARS_GRIND,
      ManagementMode.LABOUCHERE,
      ManagementMode.NIVEL_FIXO_RECUPERACAO,
      ManagementMode.STAR_2_2,
      ManagementMode.STAR_2_0
    ].includes(bankroll.management?.mode);

    let runningProfitForGale = 0;
    let maxRunningProfitForGale = 0;

    chronoHistory.forEach(h => {
      const win = h.isWin;
      const resStr = String(h.result).toUpperCase().trim();
      const isTie = resStr === 'TIE' || resStr === 'T' || resStr === 'EMPATE' || resStr === 'E';
      const isPush = win === undefined || (h.profit === 0 && (win === undefined || isTie || h.gameType === GameType.BACCARAT));

      if (isPush) return;

      runningProfitForGale += h.profit || 0;
      if (runningProfitForGale > maxRunningProfitForGale) {
        maxRunningProfitForGale = runningProfitForGale;
      }

      if (win === false) {
        currentGale += 1;
        if (currentGale > maxGaleLevelReached) {
          maxGaleLevelReached = currentGale;
        }
      }

      const hasRecovered = isRecoveryMode && (runningProfitForGale >= maxRunningProfitForGale);
      if (hasRecovered) {
        currentGale = 0;
      } else if (bankroll.management?.mode === ManagementMode.FIXED) {
        currentGale = 0;
      }
    });

    const avgScore = filteredHistory.length > 0 
      ? (filteredHistory.reduce((acc, h) => acc + (h.score || 0), 0) / filteredHistory.length)
      : 0;

    return {
      profit,
      profitPercentage,
      drawdown: Math.max(0, maxDD),
      precisionScore: avgScore,
      winRate,
      maxGaleUsed: maxGaleLevelReached
    };
  }, [filteredHistory, bankroll.initialBalance, winRate, bankroll.management?.mode]);

  const isAutoPaused = React.useMemo(() => {
    if (settings.autoPauseEnabled === false) return false;
    const initialBalance = bankroll?.initialBalance ?? 1000;
    const balance = bankroll?.balance ?? 1000;
    const currentLoss = initialBalance - balance;
    const currentProfit = balance - initialBalance;
    const stopLoss = bankroll?.stopLoss ?? 100;
    const stopWin = bankroll?.stopWin ?? 200;
    return (currentLoss > 0 && currentLoss >= stopLoss) || (currentProfit > 0 && currentProfit >= stopWin);
  }, [settings.autoPauseEnabled, bankroll?.initialBalance, bankroll?.balance, bankroll?.stopLoss, bankroll?.stopWin]);

  const ROULETTE_CANDIDATES = [
    {
      name: "Massa: Dozen Dominance (D1+D2)",
      rules: {
        bets: [
          { type: 'dozen', target: '1', amount: 10 },
          { type: 'dozen', target: '2', amount: 10 }
        ]
      }
    },
    {
      name: "Massa: Column Divergence (C2+C3)",
      rules: {
        bets: [
          { type: 'column', target: '2', amount: 10 },
          { type: 'column', target: '3', amount: 10 }
        ]
      }
    },
    {
      name: "Massa: Red Cover & Even Chance Combo",
      rules: {
        bets: [
          { type: 'color', target: 'red', amount: 10 },
          { type: 'even_chance', target: 'odd', amount: 10 }
        ]
      }
    },
    {
      name: "Massa: Zero Orphelins Split Center (17/20, 26/29)",
      rules: {
        bets: [
          { type: 'multi', target: [17, 20], amount: 10 },
          { type: 'multi', target: [26, 29], amount: 10 }
        ]
      }
    },
    {
      name: "Massa: Golden Street Confluence (13-18)",
      rules: {
        bets: [
          { type: 'multi', target: [13, 14, 15], amount: 10 },
          { type: 'multi', target: [16, 17, 18], amount: 10 }
        ]
      }
    },
    {
      name: "Novos: Estratégia de Terminais Gêmeos [1-3-7-9]",
      rules: {
        bets: [
          { type: 'number', target: 1, amount: 10 },
          { type: 'number', target: 3, amount: 10 },
          { type: 'number', target: 7, amount: 10 },
          { type: 'number', target: 9, amount: 10 }
        ]
      }
    },
    {
      name: "Novos: Alvo Quadrante Tiers du Cylindre",
      rules: {
        bets: [
          { type: 'dozen', target: '2', amount: 15 },
          { type: 'column', target: '2', amount: 10 }
        ]
      }
    },
    {
      name: "Novos: Triângulo Pivot Voisins du Zero",
      rules: {
        bets: [
          { type: 'number', target: 0, amount: 15 },
          { type: 'multi', target: [2, 3, 4], amount: 10 }
        ]
      }
    },
    {
      name: "Novos: Red Velvet High Roller (M1+M3 Spl)",
      rules: {
        bets: [
          { type: 'color', target: 'red', amount: 20 },
          { type: 'dozen', target: '3', amount: 10 }
        ]
      }
    },
    {
      name: "Novos: Terminais Pares Extremos [0-2-8]",
      rules: {
        bets: [
          { type: 'number', target: 0, amount: 10 },
          { type: 'number', target: 2, amount: 10 },
          { type: 'number', target: 8, amount: 10 }
        ]
      }
    }
  ];

  const BACCARAT_CANDIDATES = [
    {
      name: "Massa: Triple Banker Burst (BBB➔P)",
      rules: {
        baccaratPattern: [
          { r: 0, c: 0, type: 'B' },
          { r: 1, c: 0, type: 'B' },
          { r: 2, c: 0, type: 'B' },
          { r: 3, c: 0, type: '?' }
        ]
      }
    },
    {
      name: "Massa: Triple Player Burst (PPP➔B)",
      rules: {
        baccaratPattern: [
          { r: 0, c: 0, type: 'P' },
          { r: 1, c: 0, type: 'P' },
          { r: 2, c: 0, type: 'P' },
          { r: 3, c: 0, type: '?' }
        ]
      }
    },
    {
      name: "Massa: Zig-Zag Alternating Drift (PBP➔B)",
      rules: {
        baccaratPattern: [
          { r: 0, c: 0, type: 'P' },
          { r: 0, c: 1, type: 'B' },
          { r: 0, c: 2, type: 'P' },
          { r: 0, c: 3, type: '?' }
        ]
      }
    },
    {
      name: "Massa: High Velocity Banker Drift (BB➔B)",
      rules: {
        baccaratPattern: [
          { r: 0, c: 0, type: 'B' },
          { r: 1, c: 0, type: 'B' },
          { r: 2, c: 0, type: '?' }
        ]
      }
    },
    {
      name: "Massa: Tie Breaking Confluence (PT➔P)",
      rules: {
        baccaratPattern: [
          { r: 0, c: 0, type: 'P' },
          { r: 1, c: 0, type: 'T' },
          { r: 2, c: 0, type: '?' }
        ]
      }
    },
    {
      name: "Novos: Sequência Escada de Empate (B T B T ➔ B)",
      rules: {
        baccaratPattern: [
          { r: 0, c: 0, type: 'B' },
          { r: 1, c: 0, type: 'T' },
          { r: 2, c: 0, type: 'B' },
          { r: 3, c: 0, type: 'T' },
          { r: 4, c: 0, type: '?' }
        ]
      }
    },
    {
      name: "Novos: Dobra Reversa Player (PP BB P ➔ B)",
      rules: {
        baccaratPattern: [
          { r: 0, c: 0, type: 'P' },
          { r: 1, c: 0, type: 'P' },
          { r: 0, c: 1, type: 'B' },
          { r: 1, c: 1, type: 'B' },
          { r: 0, c: 2, type: 'P' },
          { r: 1, c: 2, type: '?' }
        ]
      }
    },
    {
      name: "Novos: Avalanche de Banker (BBBB ➔ B)",
      rules: {
        baccaratPattern: [
          { r: 0, c: 0, type: 'B' },
          { r: 1, c: 0, type: 'B' },
          { r: 2, c: 0, type: 'B' },
          { r: 3, c: 0, type: 'B' },
          { r: 4, c: 0, type: '?' }
        ]
      }
    },
    {
      name: "Novos: Mapeador Espelho de Linha (P P ➔ P)",
      rules: {
        baccaratPattern: [
          { r: 0, c: 0, type: 'P' },
          { r: 0, c: 1, type: 'P' },
          { r: 0, c: 2, type: '?' }
        ]
      }
    },
    {
      name: "Novos: Confluência Alternada Dupla (PP BB ➔ P)",
      rules: {
        baccaratPattern: [
          { r: 0, c: 0, type: 'P' },
          { r: 1, c: 0, type: 'P' },
          { r: 0, c: 1, type: 'B' },
          { r: 1, c: 1, type: 'B' },
          { r: 0, c: 2, type: '?' }
        ]
      }
    }
  ];

  const parsedImportedItems = React.useMemo(() => {
    if (!importInputText.trim()) return [];
    
    // Split by common delimiters: commas, spaces, semicolons, tabs, newlines
    const rawTokens = importInputText.split(/[,\s;\t\r\n]+/).map(t => t.trim()).filter(Boolean);
    
    if (backtestGameType === GameType.ROULETTE) {
      // Find all valid roulette numbers 0 to 36
      const validNumbers: number[] = [];
      for (const token of rawTokens) {
        const num = parseInt(token, 10);
        if (!isNaN(num) && num >= 0 && num <= 36) {
          validNumbers.push(num);
        }
      }
      return validNumbers;
    } else {
      // Baccarat: P (Player), B (Banker), T (Tie)
      const validBaccarat: string[] = [];
      for (const token of rawTokens) {
        const upper = token.toUpperCase();
        if (upper === 'P' || upper === 'PLAYER' || upper === 'JOGADOR' || upper === 'J' || upper === 'AZUL') {
          validBaccarat.push('P');
        } else if (upper === 'B' || upper === 'BANKER' || upper === 'BANCA' || upper === 'BANCO' || upper === 'VERMELHO') {
          validBaccarat.push('B');
        } else if (upper === 'T' || upper === 'TIE' || upper === 'EMPATE' || upper === 'E' || upper === 'VERDE') {
          validBaccarat.push('T');
        }
      }
      return validBaccarat;
    }
  }, [importInputText, backtestGameType]);

  const handleConfirmImport = () => {
    if (parsedImportedItems.length === 0) {
      setImportErrorMsg('Nenhum resultado válido pôde ser parseado no texto colado. Verifique os formatos aceitos.');
      return;
    }

    try {
      const itemsToSequence = [...parsedImportedItems];
      if (!importOrderAsc) {
        // if left to right = newest to oldest, reverse them so index 0 is the newest
        itemsToSequence.reverse();
      }
      
      // Now itemsToSequence has oldest at index 0, and newest at the end (index length - 1)
      const generatedResults: GameResult[] = itemsToSequence.map((resVal, idx) => {
        return {
          id: `import-${Math.random().toString(36).substring(2, 9)}-${Date.now()}-${idx}`,
          gameType: backtestGameType,
          result: resVal,
          timestamp: Date.now() - (itemsToSequence.length - 1 - idx) * 1000, // 1 second intervals
          sessionId: 'bulk-import',
          metadata: {}
        };
      });

      if (clearBeforeImport) {
        // Clear history first
        resetBacktestHistory(backtestGameType);
      }

      // Seed them into history!
      seedGameHistory(backtestGameType, generatedResults);

      setImportSuccessCount(generatedResults.length);
      setImportInputText('');
      setImportErrorMsg(null);
      setBacktestResult(null); // reset backtest results so they run on new data

      // Auto clear success message after 5 seconds
      setTimeout(() => {
        setImportSuccessCount(null);
      }, 5000);
    } catch (err: any) {
      setImportErrorMsg(`Ocorreu um erro ao importar os dados: ${err?.message || err}`);
    }
  };

  const handleRunMonteCarloRoulette = () => {
    setIsRouletteMCSimulating(true);
    setRouletteMCStep(2);
    setRouletteMCProgress(50);
    setRouletteMCResults(null);

    setTimeout(() => {
      try {
        const rouletteResults: GameResult[] = [];
        const rouletteBaseTime = Date.now() - (1000 * 60 * 1000);
        for (let i = 0; i < 1000; i++) {
          const val = Math.floor(Math.random() * 37);
          rouletteResults.push({
            id: `mc-r-${i}-${Math.random().toString(36).substring(2, 7)}`,
            gameType: GameType.ROULETTE,
            result: val,
            timestamp: rouletteBaseTime + (i * 60 * 1000),
            sessionId: 'mc-session',
            metadata: {},
            score: Math.floor(70 + Math.random() * 25),
            isWin: Math.random() > 0.35,
            profit: 0
          });
        }

        const existingRoulette = strategies.filter(s => s.gameType === GameType.ROULETTE);
        const allRouletteCandidates = [
          ...existingRoulette.map(s => ({
            id: s.id,
            name: `${s.name} [Existente]`,
            rules: getEnrichedRules(s.name, s.rules, GameType.ROULETTE),
            isNew: false
          })),
          ...ROULETTE_CANDIDATES.map((c, idx) => ({
            id: `mc-cand-r-${idx}-${Date.now()}`,
            name: c.name,
            rules: c.rules,
            isNew: true
          }))
        ];

        const rouletteBacktested = allRouletteCandidates.map(cand => {
          const strat: Strategy = {
            id: cand.id,
            name: cand.name,
            gameType: GameType.ROULETTE,
            rules: cand.rules,
            isActive: true,
            performance: { winRate: 0, totalEntries: 0, wins: 0, losses: 0, roi: 0, maxDrawdown: 0 }
          };
          const customManagement = {
            ...bankroll.management,
            initialBet: backtestInitialBet,
            multiplier: bankroll.management.multiplier
          };
          const bres = runBacktest(rouletteResults, strat, customManagement, bankroll.stopWin, bankroll.stopLoss);
          return {
            id: cand.id,
            name: cand.name,
            gameType: GameType.ROULETTE,
            rules: cand.rules,
            isNew: cand.isNew,
            performance: {
              winRate: bres.winRate,
              totalEntries: bres.wins + bres.losses,
              wins: bres.wins,
              losses: bres.losses,
              roi: bres.roi,
              maxDrawdown: bres.maxDrawdown
            }
          };
        });

        const sortedRoulette = [...rouletteBacktested].sort((a, b) => b.performance.winRate - a.performance.winRate);
        const bestNewRouletteCandidates = sortedRoulette.filter(s => s.isNew).slice(0, 2);

        bestNewRouletteCandidates.forEach((s) => {
          addStrategy({
            id: `opt-r-${Math.random().toString(36).substring(2, 7)}-${Date.now()}`,
            name: `🎯 Otimizada: ${s.name.replace('Massa: ', '').replace('Novos: ', '')} (Sim. ${s.performance.winRate.toFixed(1)}% WR)`,
            gameType: GameType.ROULETTE,
            rules: s.rules,
            isActive: true,
            performance: s.performance
          });
        });

        seedGameHistory(GameType.ROULETTE, rouletteResults);

        setRouletteMCResults({
          best: sortedRoulette[0],
          allTested: sortedRoulette,
          savedCount: bestNewRouletteCandidates.length,
          sampleSize: 1000
        });

        setRouletteMCStep(3);
        setRouletteMCProgress(100);
      } catch (err) {
        console.error("Error in Monte Carlo Roulette:", err);
      } finally {
        setIsRouletteMCSimulating(false);
        setBacktestResult(null);
      }
    }, 50);
  };

  const handleRunMonteCarloBaccarat = () => {
    setIsBaccaratMCSimulating(true);
    setBaccaratMCStep(2);
    setBaccaratMCProgress(50);
    setBaccaratMCResults(null);

    setTimeout(() => {
      try {
        const baccaratResults: GameResult[] = [];
        const baccaratBaseTime = Date.now() - (1000 * 60 * 1000);
        for (let i = 0; i < 1000; i++) {
          const r = Math.random();
          let val = 'P';
          if (r < 0.446) val = 'P';
          else if (r < 0.905) val = 'B';
          else val = 'T';

          baccaratResults.push({
            id: `mc-b-${i}-${Math.random().toString(36).substring(2, 7)}`,
            gameType: GameType.BACCARAT,
            result: val,
            timestamp: baccaratBaseTime + (i * 60 * 1000),
            sessionId: 'mc-session',
            metadata: {},
            score: Math.floor(70 + Math.random() * 25),
            isWin: Math.random() > 0.35,
            profit: 0
          });
        }

        const existingBaccarat = strategies.filter(s => s.gameType === GameType.BACCARAT);
        const allBaccaratCandidates = [
          ...existingBaccarat.map(s => ({
            id: s.id,
            name: `${s.name} [Existente]`,
            rules: getEnrichedRules(s.name, s.rules, GameType.BACCARAT),
            isNew: false
          })),
          ...BACCARAT_CANDIDATES.map((c, idx) => ({
            id: `mc-cand-b-${idx}-${Date.now()}`,
            name: c.name,
            rules: c.rules,
            isNew: true
          }))
        ];

        const baccaratBacktested = allBaccaratCandidates.map(cand => {
          const strat: Strategy = {
            id: cand.id,
            name: cand.name,
            gameType: GameType.BACCARAT,
            rules: cand.rules,
            isActive: true,
            performance: { winRate: 0, totalEntries: 0, wins: 0, losses: 0, roi: 0, maxDrawdown: 0 }
          };
          const customManagement = { ...bankroll.management, initialBet: backtestInitialBet };
          const bres = runBacktest(baccaratResults, strat, customManagement, bankroll.stopWin, bankroll.stopLoss);
          return {
            id: cand.id,
            name: cand.name,
            gameType: GameType.BACCARAT,
            rules: cand.rules,
            isNew: cand.isNew,
            performance: {
              winRate: bres.winRate,
              totalEntries: bres.wins + bres.losses,
              wins: bres.wins,
              losses: bres.losses,
              roi: bres.roi,
              maxDrawdown: bres.maxDrawdown
            }
          };
        });

        const sortedBaccarat = [...baccaratBacktested].sort((a, b) => b.performance.winRate - a.performance.winRate);
        const bestNewBaccaratCandidates = sortedBaccarat.filter(s => s.isNew).slice(0, 2);

        bestNewBaccaratCandidates.forEach((s) => {
          addStrategy({
            id: `opt-b-${Math.random().toString(36).substring(2, 7)}-${Date.now()}`,
            name: `💎 Otimizada: ${s.name.replace('Massa: ', '').replace('Novos: ', '')} (Sim. ${s.performance.winRate.toFixed(1)}% WR)`,
            gameType: GameType.BACCARAT,
            rules: s.rules,
            isActive: true,
            performance: s.performance
          });
        });

        seedGameHistory(GameType.BACCARAT, baccaratResults);

        setBaccaratMCResults({
          best: sortedBaccarat[0],
          allTested: sortedBaccarat,
          savedCount: bestNewBaccaratCandidates.length,
          sampleSize: 1000
        });

        setBaccaratMCStep(3);
        setBaccaratMCProgress(100);
      } catch (err) {
        console.error("Error in Monte Carlo Baccarat:", err);
      } finally {
        setIsBaccaratMCSimulating(false);
        setBacktestResult(null);
      }
    }, 50);
  };

  const handleRunBacktest = () => {
    setIsBacktesting(true);
    setBacktestPanelTab('results');
    setBacktestResult(null);
    setBacktestIntermediateResults([]);

    const trendStrat = {
      id: 'trend-assertive',
      name: '🔥 Algoritmo de Tendências (Frios/Quentes)',
      gameType: backtestGameType,
      isActive: true,
      rules: { bets: [] },
      performance: { winRate: 0, totalEntries: 0, wins: 0, losses: 0, roi: 0, maxDrawdown: 0 }
    };

    const allPossibleStrategies = [
      trendStrat,
      ...strategies.filter(s => s.gameType === backtestGameType)
    ];

    const activeStrategies = allPossibleStrategies.filter(s => 
      selectedBacktestStrategyIds.includes(s.id)
    );
    
    const limit = backtestGameType === GameType.ROULETTE 
      ? (settings.backtestLimitRoulette ?? settings.backtestLimit ?? 1000)
      : (settings.backtestLimitBaccarat ?? settings.backtestLimit ?? 1000);
    const historyData = backtestGameType === GameType.ROULETTE ? backtestHistoryRoulette : backtestHistoryBaccarat;
    const data = (historyData || []).slice(0, limit);
    
    if (data.length === 0) {
      setBacktestResult({ error: 'Histórico vazio para este jogo.' });
      setIsBacktesting(false);
      return;
    }

    // Initialize progress
    const initialProgress: Record<string, { progress: number; status: 'idle' | 'running' | 'completed' }> = {};
    activeStrategies.forEach(s => {
      initialProgress[s.id] = { progress: 0, status: 'idle' };
    });
    setBacktestProgress(initialProgress);

    if (isInstantBacktest) {
      // Process strategies sequentially but asynchronously to let the UI breathe
      (async () => {
        try {
          const completedProgress: Record<string, { progress: number; status: 'idle' | 'running' | 'completed' }> = {};
          const instantResults: any[] = [];

          // Pre-initialize all progress indicators to running or preparing
          activeStrategies.forEach(s => {
            completedProgress[s.id] = { progress: 0, status: 'idle' };
          });

          for (let i = 0; i < activeStrategies.length; i++) {
            const s = activeStrategies[i];
            
            // Mark current strategy as running
            setBacktestProgress(prev => ({
              ...prev,
              [s.id]: { progress: 50, status: 'running' }
            }));
            
            // Yield control back to UI to render progress
            await new Promise(resolve => setTimeout(resolve, 15));

            const customManagement = {
              ...bankroll.management,
              mode: selectedBacktestManagementMode,
              initialBet: s.gameType === GameType.ROULETTE
                ? (s.id === 'system-roulette-tpa84'
                    ? backtestInitialBet * 22
                    : s.id === 'system-roulette-racetrack'
                      ? backtestInitialBet * 11
                      : s.id === 'system-roulette-angel84'
                        ? backtestInitialBet * 25
                        : backtestInitialBet)
                : backtestInitialBet,
              multiplier: s.gameType === GameType.ROULETTE
                ? (s.id === 'system-roulette-tpa84' || s.id === 'system-roulette-racetrack' || s.id === 'system-roulette-angel84'
                    ? 2
                    : bankroll.management.multiplier)
                : bankroll.management.multiplier
            };
            const res = await runBacktestAsync(data, s, customManagement, bankroll.stopWin, bankroll.stopLoss, undefined);
            
            completedProgress[s.id] = { progress: 100, status: 'completed' };
            instantResults.push({
              strategyId: s.id,
              strategyName: s.name,
              ...res
            });

            // Update intermediate states incrementally
            setBacktestProgress({ ...completedProgress });
            setBacktestIntermediateResults([...instantResults]);
            
            // Yield control back to UI to process events
            await new Promise(resolve => setTimeout(resolve, 15));
          }

          setBacktestResult(instantResults);

          const lowWRResults = instantResults.filter(r => r.winRate < 60);
          if (lowWRResults.length > 0) {
            const r = lowWRResults[0];
            const singleAlert: BacktestAlert = {
              id: Math.random().toString(36).substring(2, 11),
              strategyName: r.strategyName,
              winRate: r.winRate,
              gameType: backtestGameType,
              timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            };
            setBacktestAlerts([singleAlert]);
          }
        } catch (err: any) {
          console.error('[Instant Backtest Error]:', err);
          setBacktestResult({ error: `Erro no processamento instantâneo: ${err instanceof Error ? err.message : String(err)}` });
        } finally {
          setIsBacktesting(false);
        }
      })();
      return;
    }

    let currentIdx = 0;
    const finalResults: any[] = [];

    const processNext = () => {
      try {
        if (currentIdx >= activeStrategies.length) {
          // All strategies done
          const lowWRResults = finalResults.filter(r => r.winRate < 60);
          if (lowWRResults.length > 0) {
            const r = lowWRResults[0];
            const singleAlert: BacktestAlert = {
              id: Math.random().toString(36).substring(2, 11),
              strategyName: r.strategyName,
              winRate: r.winRate,
              gameType: backtestGameType,
              timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            };
            setBacktestAlerts([singleAlert]);
          }
          
          setBacktestResult(finalResults);
          setIsBacktesting(false);
          return;
        }

        const s = activeStrategies[currentIdx];
        
        // Set current strategy to running status
        setBacktestProgress(prev => ({
          ...prev,
          [s.id]: { progress: 50, status: 'running' }
        }));

        // Calculate actual result asynchronously
        const customManagement = {
          ...bankroll.management,
          mode: selectedBacktestManagementMode,
          initialBet: s.gameType === GameType.ROULETTE
            ? (s.id === 'system-roulette-tpa84'
                ? backtestInitialBet * 22
                : s.id === 'system-roulette-racetrack'
                  ? backtestInitialBet * 11
                  : s.id === 'system-roulette-angel84'
                    ? backtestInitialBet * 25
                    : backtestInitialBet)
            : backtestInitialBet,
          multiplier: s.gameType === GameType.ROULETTE
            ? (s.id === 'system-roulette-tpa84' || s.id === 'system-roulette-racetrack' || s.id === 'system-roulette-angel84'
                ? 2
                : bankroll.management.multiplier)
            : bankroll.management.multiplier
        };

        runBacktestAsync(data, s, customManagement, bankroll.stopWin, bankroll.stopLoss, undefined)
          .then(res => {
            const formattedResult = {
              strategyId: s.id,
              strategyName: s.name,
              ...res
            };
            finalResults.push(formattedResult);

            // Update intermediate results so the table renders completed rows as they finish
            setBacktestIntermediateResults([...finalResults]);

            setBacktestProgress(prev => ({
              ...prev,
              [s.id]: { progress: 100, status: 'completed' }
            }));

            setTimeout(() => {
              currentIdx++;
              processNext();
            }, 10);
          })
          .catch(err => {
            console.error(`[Backtest Async Error] Strategy "${s.name}":`, err);
            finalResults.push({
              strategyId: s.id,
              strategyName: s.name,
              winRate: 0,
              wins: 0,
              losses: 0,
              totalProfit: 0,
              maxDrawdown: 0,
              roi: 0,
              error: err instanceof Error ? err.message : String(err)
            });
            setBacktestIntermediateResults([...finalResults]);
            setBacktestProgress(prev => ({
              ...prev,
              [s.id]: { progress: 100, status: 'completed' }
            }));
            setTimeout(() => {
              currentIdx++;
              processNext();
            }, 10);
          });
      } catch (err: any) {
        console.error('[processNext Outer Error]:', err);
        setBacktestResult({ error: `Erro no sequenciamento do backtest: ${err instanceof Error ? err.message : String(err)}` });
        setIsBacktesting(false);
      }
    };

    // Begin sequential processing
    setTimeout(() => {
      processNext();
    }, 100);
  };

  const handleResult = (val: any) => {
    // Fetch fresh store state to prevent stale react closures
    const freshStore = useAppStore.getState();
    const freshHistory = freshStore.historyBaccarat || [];
    const freshBankroll = freshStore.bankrollBaccarat || freshStore.bankroll;

    const analysis = { result: val };
    
    // Use the first active signal (highest confidence) from the active strategies
    const activeSignal = activeSignals[0];
    
    let positionCount = 1;

    // Calculate current dynamic bet size beforehand so it can be passed to the strategy win analyzer
    const overrideChip = getOverrideChipForSignal(activeSignal, freshBankroll.management);
    const targetPayoutRatio = activeSignal ? calculatePayoutRatioForEntry(activeSignal.entry, activeSignal) : undefined;
    const { currentBetSize } = getDynamicBetAndState(freshHistory, freshBankroll.management, positionCount, overrideChip, targetPayoutRatio);
    const betSize = currentBetSize;

    let isWin = undefined;
    let strategy = undefined;
    
    const valStr = String(val).toUpperCase().trim();
    const entStr = activeSignal?.entry ? String(activeSignal.entry).toUpperCase().trim() : '';
    const isBaccaratTieResult = valStr === 'T' || valStr === 'TIE' || valStr === 'EMPATE' || valStr === 'E';
    const isBetOnPlayerOrBanker = (entStr.includes('PLAYER') || entStr.includes('BANKER') || entStr.includes('JOGADOR') || entStr.includes('BANQUEIRO') || entStr === 'P' || entStr === 'B');
    const isBaccaratTiePush = isBaccaratTieResult && (isBetOnPlayerOrBanker || (!entStr.includes('TIE') && !entStr.includes('EMPATE') && entStr !== 'T'));

    if (activeSignal) {
      strategy = strategies.find(s => s.id === activeSignal.strategyId);
      if (strategy && strategy.rules && strategy.rules.bets && strategy.rules.bets.length > 0) {
        // Check if overall strategy resulted in positive profit with the current bet size
        isWin = strategyEngine.checkStrategyWin(strategy, val, betSize, freshBankroll.management);
      } else if (isBaccaratTiePush) {
        isWin = undefined;
      } else {
        isWin = checkWin(val, activeSignal.entry);
      }
    }
    
    const signalType = activeSignal ? activeSignal.type : undefined;
    
    const localMinChip = freshBankroll.management.minChip || (currentGameType === GameType.BACCARAT ? 0.20 : 0.10);
    let profit = 0;
    if (isBaccaratTiePush) {
      profit = 0;
      isWin = undefined;
    } else if (isWin !== undefined) {
      if (strategy && strategy.rules && strategy.rules.bets && strategy.rules.bets.length > 0) {
        profit = strategyEngine.calculateStrategySpinProfit(strategy, val, betSize, freshBankroll.management);
      } else {
        const ent = activeSignal?.entry.toLowerCase() || '';
        if (isWin) {
          let multiplier = 1; // Default 1:1 profit
          if (ent.includes('banker') || ent === 'b' || ent.includes('banca') || ent.includes('banqueiro')) {
            multiplier = 0.95;
          } else if (ent.includes('empate') || ent === 't' || ent.includes('tie')) {
            multiplier = 8;
          }
          profit = betSize * multiplier;
        } else {
          profit = -betSize;
        }
      }
    }

    const score = calculateScore(analysis, freshHistory);
    const signal = generateSignal(score, 80);
    
    const result = {
      id: Math.random().toString(36).substr(2, 9),
      gameType: currentGameType,
      result: val,
      timestamp: Date.now(),
      sessionId: 'sess-1',
      metadata: {
        ...analysis,
        betSize,
        positionCount
      },
      score,
      signal: signal.message,
      signalType,
      volatility: 0.1,
      isWin,
      profit,
      betSize,
      positionCount
    };

    // 1. Synchronous & Immediate UI State Update (< 2ms response)
    addResult(result);
    if (profit !== 0) {
      updateBankroll({ balance: freshBankroll.balance + profit });
    }

    // 2. Non-blocking asynchronous background execution for AI learning, backtesting & calibrations
    setTimeout(() => {
      // Check for automatic day transition based on current date
      useAppStore.getState().checkAndTriggerAutoDayTransition(currentGameType);

      // Record pattern to database for future sessions
      if (freshHistory.length >= 2) {
        const sequence = freshHistory.slice(0, 8).map(h => String(h.result)).reverse();
        learningService.recordPattern(currentGameType, sequence, String(val), !!isWin);
      }

      // Adaptive Accuracy: Update performance of ALL strategies of the current game type in one batch
      const updatedHistory = [result, ...freshHistory];
      const strategyBulkUpdates: Array<{ id: string; update: Partial<Strategy> }> = [];

      // For maximum UI fluency and zero-lag performance, real-time calibrations are evaluated on the recent 300-spin window
      const liveCalibrationHistory = updatedHistory.slice(0, 300);

      strategies.filter(s => s.gameType === currentGameType).forEach(strat => {
        const customManagement = {
          ...freshBankroll.management,
          mode: selectedBacktestManagementMode,
          initialBet: backtestInitialBet,
          multiplier: freshBankroll.management.multiplier
        };
        const perf = runBacktest(liveCalibrationHistory, strat, customManagement, freshBankroll.stopWin, freshBankroll.stopLoss);
        strategyBulkUpdates.push({
          id: strat.id,
          update: { 
            performance: {
              ...strat.performance,
              winRate: Math.round(perf.winRate),
              wins: perf.wins,
              losses: perf.losses,
              roi: perf.roi,
              maxDrawdown: perf.maxDrawdown,
              totalEntries: perf.wins + perf.losses
            }
          }
        });
      });

      // --- MOTOR REVOLUCIONÁRIO DE IA ADAPTATIVA INTEGRADO ---
      if (isAdaptiveIAEnabled) {
        const adaptiveResult = dynamicStrategyEngine.analyzeAndGenerateStrategies(
          liveCalibrationHistory,
          strategies,
          currentGameType,
          freshBankroll.management
        );

        // Se gerou ou melhorou estratégias adaptativas autônomas, adiciona ou atualiza no store
        const deletedIds = useAppStore.getState().deletedSystemStrategyIds || [];
        adaptiveResult.newStrategies.forEach(newStrat => {
          if (deletedIds.includes(newStrat.id)) return; // Don't re-add deleted strategies
          const alreadyExists = strategies.some(s => s.id === newStrat.id);
          if (alreadyExists) {
            strategyBulkUpdates.push({
              id: newStrat.id,
              update: {
                name: newStrat.name,
                rules: newStrat.rules,
                performance: newStrat.performance
              }
            });
          } else {
            addStrategy(newStrat);
          }
        });

        const combinedLogs = [...adaptiveResult.logs];

        // Apply all bulk updates in a single store transaction
        if (strategyBulkUpdates.length > 0) {
          useAppStore.getState().bulkUpdateStrategies(strategyBulkUpdates);
        }

        // Salva os logs de calibração/melhoria para auditoria do usuário
        if (combinedLogs.length > 0) {
          setAdaptiveLogs(prev => [...combinedLogs, ...prev].slice(0, 50));
          
          const latestLog = combinedLogs[combinedLogs.length - 1];
          const iaAlert: BacktestAlert = {
            id: latestLog.id,
            strategyName: latestLog.strategyName,
            winRate: Math.round(latestLog.newWinRate),
            gameType: currentGameType,
            timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            type: 'success',
            message: latestLog.description
          };
          setBacktestAlerts([iaAlert]);
        }
      } else if (strategyBulkUpdates.length > 0) {
        useAppStore.getState().bulkUpdateStrategies(strategyBulkUpdates);
      }

      // --- LÓGICA DE RECUPERAÇÃO AUTOMÁTICA DE ESTRATÉGIA ---
      let peakBalance = freshBankroll.initialBalance || 1000;
      let runningBalance = freshBankroll.initialBalance || 1000;
      const chronoHistoryBefore = [...filteredHistory].reverse();
      chronoHistoryBefore.forEach(h => {
        runningBalance += (h.profit || 0);
        if (runningBalance > peakBalance) {
          peakBalance = runningBalance;
        }
      });

      const currentBalance = freshBankroll.balance;
      const newBalance = currentBalance + profit;
      const wasInLoss = currentBalance < peakBalance;
      const isNowRecovered = wasInLoss && newBalance >= peakBalance;

      if (isNowRecovered) {
        const formattedCurrency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: freshBankroll.currency || 'BRL' }).format(newBalance);
        const formattedPeak = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: freshBankroll.currency || 'BRL' }).format(peakBalance);
        
        const recoveryAlert: BacktestAlert = {
          id: Math.random().toString(36).substring(2, 11),
          strategyName: "Recuperação Automática Concluída!",
          winRate: 100,
          gameType: currentGameType,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          type: 'success',
          message: `Saldo recuperado com sucesso para ${formattedCurrency} (Pico anterior: ${formattedPeak}). Aposta de entrada restaurada para o valor inicial.`
        };
        setBacktestAlerts([recoveryAlert]);
      }
    }, 400);

    // Update global balance
    if (profit !== 0) {
      updateBankroll({ balance: freshBankroll.balance + profit });
    }

    // Check if maxDailyRounds is reached after adding the result
    const latestStoreState = useAppStore.getState();
    const currentBankroll = currentGameType === GameType.ROULETTE ? (latestStoreState.bankrollRoulette || latestStoreState.bankroll) : (latestStoreState.bankrollBaccarat || latestStoreState.bankroll);
    const currentHistoryList = currentGameType === GameType.ROULETTE ? (latestStoreState.historyRoulette || []) : (latestStoreState.historyBaccarat || []);

    if (currentBankroll.maxDailyRounds && currentBankroll.maxDailyRounds > 0 && currentHistoryList.length >= currentBankroll.maxDailyRounds) {
      setTimeout(async () => {
        const limitAlert: BacktestAlert = {
          id: Math.random().toString(36).substring(2, 11),
          strategyName: "Limite de Rodadas Atingido!",
          winRate: 100,
          gameType: currentGameType,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          type: 'signal',
          message: `Limite de ${currentBankroll.maxDailyRounds} rodadas diárias atingido. Arquivando dia e limpando dashboard para novo ciclo.`
        };
        setBacktestAlerts(prev => [limitAlert, ...prev]);
        
        await useAppStore.getState().closeOperationalDay(currentGameType, `Limite diário de ${currentBankroll.maxDailyRounds} rodadas atingido.`);
      }, 300);
    }
  };

  const chartData = React.useMemo(() => {
    let current = bankroll.initialBalance;
    const historyInOrder = [...filteredHistory].reverse();
    return historyInOrder.map((h, i) => {
      current += (h.profit || 0);
      return {
        name: i + 1,
        score: h.score,
        balance: current
      };
    }).slice(-10);
  }, [filteredHistory, bankroll.initialBalance]);

  const [isCompactMode, setIsCompactMode] = React.useState<boolean>(() => {
    const cached = safeStorage.getItem('isCompactMode');
    return cached === 'false' ? false : true;
  });

  const [isInstantBacktest, setIsInstantBacktest] = React.useState<boolean>(() => {
    const cached = safeStorage.getItem('isInstantBacktest');
    if (cached !== null) {
      return cached === 'true';
    }
    return settings?.defaultBacktestInstant ?? false;
  });

  React.useEffect(() => {
    safeStorage.setItem('isCompactMode', String(isCompactMode));
  }, [isCompactMode]);

  React.useEffect(() => {
    safeStorage.setItem('isInstantBacktest', String(isInstantBacktest));
  }, [isInstantBacktest]);

  React.useEffect(() => {
    if (settings?.defaultBacktestInstant !== undefined) {
      setIsInstantBacktest(settings.defaultBacktestInstant);
    }
  }, [settings?.defaultBacktestInstant]);

  React.useEffect(() => {
    const scaleKey = settings?.fontSizeScale || 'large';
    let fontScale = 1.12;
    let rootFontSize = '18px';
    if (scaleKey === 'small') {
      fontScale = 0.88;
      rootFontSize = '14px';
    } else if (scaleKey === 'normal') {
      fontScale = 1.0;
      rootFontSize = '16px';
    } else if (scaleKey === 'large') {
      fontScale = 1.12;
      rootFontSize = '18px';
    } else if (scaleKey === 'xlarge') {
      fontScale = 1.25;
      rootFontSize = '20px';
    }
    document.documentElement.style.setProperty('--font-scale', fontScale.toString());
    document.documentElement.style.fontSize = rootFontSize;
    document.documentElement.setAttribute('data-font-size', scaleKey);
  }, [settings?.fontSizeScale]);

  return (
    <MotionConfig reducedMotion={settings?.extremeNightMode ? "always" : "user"}>
      <Layout 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        balance={bankroll?.balance || 0}
        gameType={currentGameType}
        setGameType={(type) => {
          setGameType(type);
          if (type === GameType.ROULETTE && activeTab === 'baccarat') {
            setActiveTab('roulette');
          } else if (type === GameType.BACCARAT && activeTab === 'roulette') {
            setActiveTab('baccarat');
          }
        }}
        actions={
          <div className="flex items-center gap-1.5 md:gap-2">
            {isGameTab && (
              <>
                {currentGameType === GameType.ROULETTE && (
                  <span className="hidden sm:inline-flex text-[9px] font-black text-[#c6a34f] bg-[#c6a34f]/10 border border-[#c6a34f]/25 px-2.5 h-8 items-center justify-center rounded-xl uppercase tracking-wider">
                    Assertividade: {winRate.toFixed(1)}%
                  </span>
                )}
                <div className="flex items-center gap-1 bg-black/60 p-0.5 rounded-xl border border-white/5 shrink-0 h-8">
                  <button
                    type="button"
                    onClick={() => setIsCompactMode(true)}
                    className={`h-7 px-2.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer ${
                      isCompactMode 
                        ? 'bg-[#c6a34f] text-black shadow-md' 
                        : 'text-white/45 hover:text-white/80'
                    }`}
                    title="Modo Operação Focado: mostrando apenas as informações realmente necessárias para fazer apostas"
                  >
                    <Zap size={12} className={isCompactMode ? 'text-black' : 'text-amber-400'} />
                    <span>Focado</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCompactMode(false)}
                    className={`h-7 px-2.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer ${
                      !isCompactMode 
                        ? 'bg-[#c6a34f] text-black shadow-md' 
                        : 'text-white/45 hover:text-white/80'
                    }`}
                    title="Modo Avançado Analítico: detalhamento completo de frequências, atrasos e wheel sectors"
                  >
                    <BarChart3 size={12} className={!isCompactMode ? 'text-black' : 'text-[#c6a34f]'} />
                    <span>Completo</span>
                  </button>
                </div>
              </>
            )}
            <OverlayWidget
              activeSignals={activeSignals}
              onAddResult={handleResult}
              currentGameType={currentGameType}
              setGameType={setGameType}
              derivedStats={derivedStats}
            />
          </div>
        }
      >
      <div className="space-y-4 max-w-full pb-4">
        {isAutoPaused && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-[0_0_15px_-3px_rgba(239,68,68,0.1)]">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-red-500/20 text-red-500 rounded-xl">
                <ShieldAlert size={20} className="animate-pulse" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-red-400">Limite de Banca Atingido (Auto-Pause Ativo)</h4>
                <p className="text-xs text-white/60">As entradas e botões de lançamento foram bloqueados temporariamente para proteção de capital pois seu Stop Win / Stop Loss foi atingido.</p>
              </div>
            </div>
            <button
              onClick={() => resetHistory(currentGameType)}
              className="px-4 py-2 bg-red-600/25 border border-red-500/30 hover:bg-red-600/40 text-red-300 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer active:scale-95 whitespace-nowrap"
            >
              Resetar Sessão
            </button>
          </div>
        )}

        {isGameTab && (
          <div className="space-y-6">
            <div className="space-y-4">
              {/* Quick Bankroll & Management Bar always on top */}
              <QuickManagementBar 
                bankroll={bankroll}
                updateBankroll={(update) => updateBankroll(update, GameType.BACCARAT)}
                management={bankroll.management}
                updateManagement={(update) => updateBankroll({
                  management: {
                    ...bankroll.management,
                    ...update
                  }
                }, GameType.BACCARAT)}
                gameType={GameType.BACCARAT}
              />

              {/* Full-width Ultra-fast Input Component */}
              <OtherGameInput 
                gameType={currentGameType} 
                history={filteredHistory}
                onResultClick={handleResult} 
                onUndo={() => removeLastResult(GameType.BACCARAT)} 
                onReset={() => resetHistory(GameType.BACCARAT)} 
                config={bankroll.management}
                activeSignal={activeSignals[0]}
                isAutoPaused={isAutoPaused}
              />

              {/* Row Grid below the Input Component */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Left Column: Sub-Tabbed Analytics Panel */}
                <div className="lg:col-span-8 space-y-3">
                  {!isCompactMode && (
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-[#111111] p-1.5 rounded-2xl border border-white/10 shadow-md">
                      <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar py-0.5">
                        {filteredHistory.length > 0 && (
                          <>
                            <button
                              type="button"
                              onClick={() => setAnalyticsSubTab('baccarat_mining')}
                              className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                                analyticsSubTab === 'baccarat_mining'
                                  ? 'bg-[#c6a34f] text-black shadow-md'
                                  : 'text-amber-400/90 bg-amber-500/10 border border-amber-500/20 hover:text-white hover:bg-amber-500/20'
                              }`}
                            >
                              <Sparkles size={13} className="animate-pulse text-amber-300" /> Mineração AI
                            </button>

                            <button
                              type="button"
                              onClick={() => setAnalyticsSubTab('trends')}
                              className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                                analyticsSubTab === 'trends'
                                  ? 'bg-[#c6a34f] text-black shadow-md'
                                  : 'text-white/60 hover:text-white hover:bg-white/5'
                              }`}
                            >
                              <BarChart3 size={13} /> Tendências
                            </button>

                            <button
                              type="button"
                              onClick={() => setAnalyticsSubTab('distribution')}
                              className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                                analyticsSubTab === 'distribution'
                                  ? 'bg-[#c6a34f] text-black shadow-md'
                                  : 'text-white/60 hover:text-white hover:bg-white/5'
                              }`}
                            >
                              <TrendingUp size={13} /> Distribuição
                            </button>
                          </>
                        )}
                      </div>

                      {filteredHistory.length === 0 && (
                        <span className="text-[9px] text-amber-500/80 font-mono font-bold px-2.5 py-0.5 bg-amber-500/10 rounded-xl border border-amber-500/20">
                          ● Lance mãos para liberar análises
                        </span>
                      )}
                    </div>
                  )}

                  {!isCompactMode && filteredHistory.length > 0 && analyticsSubTab === 'baccarat_mining' && (
                    <div className="animate-in fade-in duration-300">
                      <BaccaratPatternMiningPanel 
                        history={filteredHistory}
                        existingStrategies={strategies}
                        onApplyMinedStrategies={(minedStrats) => {
                          minedStrats.forEach(s => addStrategy(s));
                        }}
                      />
                    </div>
                  )}



                  {!isCompactMode && filteredHistory.length > 0 && analyticsSubTab === 'trends' && (
                    <div className="animate-in fade-in duration-300">
                      <TrendAnalysisPanel 
                        gameType={currentGameType} 
                        history={filteredHistory} 
                        onApplyEntry={(entry) => {
                          console.log(`Padrão principal selecionado: ${entry}`);
                        }}
                        compact={isCompactMode}
                      />
                    </div>
                  )}

                  {!isCompactMode && filteredHistory.length > 0 && analyticsSubTab === 'distribution' && (
                    <div className="animate-in fade-in duration-300">
                      <DistributionStatsPanel 
                        gameType={currentGameType} 
                        history={filteredHistory} 
                        compact={isCompactMode}
                      />
                    </div>
                  )}
                </div>

                {/* Right Column: Tabbed Recent History & Active Signals */}
                <div className="lg:col-span-4 space-y-3">
                  <div className="flex items-center gap-1 p-1 bg-[#111111] border border-white/10 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => setRightSideSubTab('history')}
                      className={`flex-1 py-1.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        rightSideSubTab === 'history'
                          ? 'bg-[#c6a34f] text-black shadow-md'
                          : 'text-white/60 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <HistoryIcon size={12} /> Rodadas ({filteredHistory.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setRightSideSubTab('signals')}
                      className={`flex-1 py-1.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer relative ${
                        rightSideSubTab === 'signals'
                          ? 'bg-[#c6a34f] text-black shadow-md'
                          : 'text-white/60 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Zap size={12} /> Sinais ({activeSignals.length})
                      {activeSignals.length > 0 && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping absolute top-1 right-2" />
                      )}
                    </button>
                  </div>

                  {rightSideSubTab === 'history' ? (
                    <div className="bg-[#111111] p-4 rounded-2xl border border-white/5 shadow-lg space-y-3">
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#c6a34f]">Últimas Mãos</span>
                        <span className="text-[9px] text-zinc-500 font-mono font-bold uppercase">{filteredHistory.length} rodadas</span>
                      </div>

                      <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                        {filteredHistory.length === 0 ? (
                          <p className="text-[9px] text-center text-white/25 uppercase py-6 tracking-widest">Nenhuma mão gravada</p>
                        ) : (
                          filteredHistory.slice(0, 20).map((h, idx) => (
                            <div key={h.id} className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/[0.08] transition-all">
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] text-white/30 font-mono">#{filteredHistory.length - idx}</span>
                                <div className="w-6 h-6 rounded-md flex items-center justify-center font-black text-[10px] text-white shadow-sm bg-zinc-800 border border-white/5">
                                  {h.result}
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[9px] font-bold text-[#c6a34f] uppercase leading-none">{h.signal || 'Analista'}</span>
                                  <span className="text-[7px] text-white/30">{new Date(h.timestamp).toLocaleTimeString()}</span>
                                </div>
                              </div>
                              {h.isWin !== undefined ? (
                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${h.isWin ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                  {h.isWin ? 'WIN' : 'LOSS'}
                                </span>
                              ) : (h.profit === 0 && h.signal) ? (
                                <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                  EMPATE
                                </span>
                              ) : null}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ) : (
                    <SignalsPanel signals={activeSignals} winRate={winRate} currentGaleLevel={nextBetState.currentLevel} sequenceBaseBet={nextBetState.sequenceBaseBet} />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'strategies' && (() => {
          const filteredEvaluatedStrategies = evaluatedStrategies.filter(
            item => item.strat.gameType === currentGameType
          );

          const systemItems = filteredEvaluatedStrategies.filter(
            item => item.strat.isSystem || item.strat.id.startsWith('system-')
          );

          const customItems = filteredEvaluatedStrategies.filter(
            item => !item.strat.isSystem && !item.strat.id.startsWith('system-') && !item.strat.id.startsWith('adaptive-')
          );

          const adaptiveItems = filteredEvaluatedStrategies.filter(
            item => item.strat.id.startsWith('adaptive-')
          );

          const eliteItems = filteredEvaluatedStrategies
            .filter(item => item.winRate >= 64)
            .sort((a, b) => b.winRate - a.winRate);

          const totalCount = filteredEvaluatedStrategies.length;
          const activeCount = filteredEvaluatedStrategies.filter(i => i.strat.isActive).length;
          const pausedCount = filteredEvaluatedStrategies.filter(i => !i.strat.isActive).length;
          const withSignalCount = filteredEvaluatedStrategies.filter(i => activeSignals.some(s => s.strategyId === i.strat.id)).length;
          const avgWinRate = totalCount > 0 ? (filteredEvaluatedStrategies.reduce((acc, curr) => acc + curr.winRate, 0) / totalCount).toFixed(1) : '0.0';

          // Apply Category Sub-Tab
          let currentCategoryList = filteredEvaluatedStrategies;
          if (strategyCategoryTab === 'system') currentCategoryList = systemItems;
          else if (strategyCategoryTab === 'custom') currentCategoryList = customItems;
          else if (strategyCategoryTab === 'adaptive') currentCategoryList = adaptiveItems;
          else if (strategyCategoryTab === 'elite') currentCategoryList = eliteItems;

          // Apply Status Filter
          let statusFilteredList = currentCategoryList;
          if (strategyStatusFilter === 'active') {
            statusFilteredList = currentCategoryList.filter(i => i.strat.isActive);
          } else if (strategyStatusFilter === 'paused') {
            statusFilteredList = currentCategoryList.filter(i => !i.strat.isActive);
          } else if (strategyStatusFilter === 'signal') {
            statusFilteredList = currentCategoryList.filter(i => activeSignals.some(s => s.strategyId === i.strat.id));
          }

          // Apply Search Query Filter
          const finalDisplayList = statusFilteredList.filter(item => {
            if (!strategySearchQuery.trim()) return true;
            const q = strategySearchQuery.toLowerCase();
            return (
              item.strat.name.toLowerCase().includes(q) ||
              item.strat.id.toLowerCase().includes(q) ||
              item.strat.gameType.toLowerCase().includes(q)
            );
          });

          const getStrategyRulesSummary = (strat: any) => {
            const rules: { icon: any; label: string; value: string; status: 'active' | 'pending' | 'info' }[] = [];

            if (strat.id === 'system-roulette-racetrack') {
              rules.push({ icon: Zap, label: 'Gatilho S84', value: 'Confluência Racetrack', status: 'active' });
              rules.push({ icon: Target, label: 'Cobertura', value: '11 Números (1 Núcleo + 10 Vizinhos)', status: 'active' });
              rules.push({ icon: ShieldCheck, label: 'Proteção', value: 'Gale N2 + Cobertura Zero', status: 'info' });
            } else if (strat.id === 'system-roulette-tpa84') {
              rules.push({ icon: Zap, label: 'Gatilho TPA84', value: 'Soma Penúltimo + Antepenúltimo', status: 'active' });
              rules.push({ icon: Target, label: 'Cobertura', value: '22 Números Racetrack', status: 'active' });
              rules.push({ icon: ShieldCheck, label: 'Gestão', value: 'Progressão Soros/Gale N2', status: 'info' });
            } else if (strat.id === 'system-roulette-angel84') {
              rules.push({ icon: Zap, label: 'Gatilho Angel84', value: 'Terminais das últimas 12 rodadas', status: 'active' });
              rules.push({ icon: Target, label: 'Cobertura', value: 'Máximo 30 Números (Terminais Quentes)', status: 'active' });
              rules.push({ icon: ShieldCheck, label: 'Segurança B', value: 'Pelo menos 1 repetição de terminal', status: 'info' });
            } else if (strat.id.includes('trends')) {
              rules.push({ icon: Zap, label: 'Tendência', value: 'Desvio Padrão > 2σ (Zonas Quentes/Frias)', status: 'active' });
              rules.push({ icon: Target, label: 'Entrada', value: 'Repetição de Padrão Dominante', status: 'active' });
            } else if (strat.id.includes('probability')) {
              rules.push({ icon: Zap, label: 'Probabilidade', value: 'Regressão de Média Estatística', status: 'active' });
              rules.push({ icon: Target, label: 'Entrada', value: 'Dúzias / Colunas em Atraso', status: 'active' });
            } else if (strat.id.includes('historical-base')) {
              rules.push({ icon: Zap, label: 'Base Histórica', value: 'Matriz de Similaridade > 80%', status: 'active' });
              rules.push({ icon: Target, label: 'Entrada', value: 'Sequência Repetitiva Identificada', status: 'active' });
            } else if (strat.id.includes('delay')) {
              rules.push({ icon: Zap, label: 'Atraso Relativo', value: 'Confluência de Ausência Extrema', status: 'active' });
              rules.push({ icon: Target, label: 'Entrada', value: 'Reversão de Zonas Ausentes', status: 'active' });
            } else if (strat.id.startsWith('adaptive-')) {
              rules.push({ icon: Cpu, label: 'Motor IA', value: 'Calibração Adaptativa em Tempo Real', status: 'active' });
              rules.push({ icon: Sparkles, label: 'Ponderação', value: 'Ajuste Dinâmico por Assertividade', status: 'active' });
            } else {
              const tc = strat.rules?.triggerConfig;
              if (tc?.minDelay > 0) {
                rules.push({ icon: Clock, label: 'Atraso Mínimo', value: `${tc.minDelay} rodadas`, status: 'active' });
              }
              if (tc?.useRacetrackConfluence) {
                rules.push({ icon: Target, label: 'Vizinhos', value: `Confluência Racetrack (+${tc.globalNeighborsCount || 2})`, status: 'active' });
              }
              if (strat.rules?.bets?.length > 0) {
                const targets = strat.rules.bets.map((b: any) => b.type || b.target).slice(0, 3).join(', ');
                rules.push({ icon: Layers, label: 'Alvos', value: targets || 'Apostas Configuradas', status: 'active' });
              }
              if (strat.rules?.baccaratPattern?.length > 0) {
                rules.push({ icon: Layers, label: 'Padrão Baccarat', value: `${strat.rules.baccaratPattern.length} posições`, status: 'active' });
              }
              if (rules.length === 0) {
                rules.push({ icon: CheckCircle2, label: 'Regra Personalizada', value: 'Configuração Ativa', status: 'active' });
              }
            }

            return rules;
          };

          return (
            <div className="space-y-6 animate-in fade-in duration-500">
              {/* TOP PANEL HEADER */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
                 <div>
                    <h2 className="text-xl font-bold text-[#c6a34f] uppercase tracking-widest flex items-center gap-2">
                       <Target size={18} /> Central de Estratégias & Regras Operacionais
                    </h2>
                    <p className="text-[9px] text-white/40 uppercase tracking-wider">Acompanhe, organize e reconfigure suas diretrizes de confluência probabilística em tempo real</p>
                 </div>
                 <div className="flex flex-wrap items-center gap-3">
                   <button
                     onClick={() => {
                       purgeUnderperformingStrategies(40, 2);
                     }}
                     className="flex items-center gap-1.5 px-3.5 py-2 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 hover:text-red-300 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all cursor-pointer"
                     title="Excluir imediatamente todas as estratégias (sistema, criadas e personalizadas) com assertividade abaixo de 40%"
                   >
                     <Trash2 size={13} /> Limpar &lt; 40%
                   </button>
                   {confirmRestoreDefaults ? (
                     <div className="flex items-center gap-1.5 bg-amber-950/80 border border-amber-500/40 p-1.5 rounded-xl animate-in fade-in duration-200">
                       <span className="text-[9px] font-black text-amber-300 uppercase tracking-wider px-1">Restaurar Padrões?</span>
                       <button
                         onClick={() => {
                           useAppStore.getState().restoreDefaultStrategies();
                           setConfirmRestoreDefaults(false);
                         }}
                         className="px-2 py-1 bg-[#c6a34f] hover:bg-amber-400 text-black font-bold rounded-lg text-[9px] uppercase tracking-wider transition-all cursor-pointer"
                       >
                         Sim
                       </button>
                       <button
                         onClick={() => setConfirmRestoreDefaults(false)}
                         className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white font-bold rounded-lg text-[9px] uppercase tracking-wider transition-all cursor-pointer"
                       >
                         Não
                       </button>
                     </div>
                   ) : (
                     <button
                       onClick={() => setConfirmRestoreDefaults(true)}
                       className="flex items-center gap-1.5 px-3.5 py-2 bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all cursor-pointer"
                       title="Restaurar todas as estratégias padrão do sistema"
                     >
                       <RotateCcw size={13} /> Restaurar Padrões
                     </button>
                   )}
                   <button 
                      onClick={() => {
                        const newId = Math.random().toString(36).substr(2, 9);
                        const dummyStrategy = {
                          id: newId,
                          name: `Nova Estratégia ${strategies.length + 1}`,
                          gameType: currentGameType,
                          isActive: true,
                          rules: { bets: [] },
                          performance: { winRate: 0, totalEntries: 0, wins: 0, losses: 0, roi: 0, maxDrawdown: 0 }
                        };
                        addStrategy(dummyStrategy);
                        setEditingStrategyId(newId);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-[#c6a34f] text-black rounded-xl font-bold text-[10px] uppercase tracking-widest hover:scale-105 transition-transform cursor-pointer"
                    >
                      <Plus size={14} /> Nova Estratégia
                    </button>
                 </div>
              </div>

              {/* OVERVIEW DASHBOARD STATS SUMMARY */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5 flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                    <Layers size={16} />
                  </div>
                  <div>
                    <span className="text-[9px] text-white/40 uppercase font-mono tracking-wider block">Total Estratégias</span>
                    <div className="text-base font-black text-white">{totalCount} <span className="text-[10px] font-normal text-white/40">registas</span></div>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5 flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-green-500/10 text-green-400">
                    <CheckCircle2 size={16} />
                  </div>
                  <div>
                    <span className="text-[9px] text-white/40 uppercase font-mono tracking-wider block">Ativas / Pausadas</span>
                    <div className="text-base font-black text-white">
                      <span className="text-green-400">{activeCount}</span> <span className="text-white/30 text-xs">/</span> <span className="text-amber-400/70">{pausedCount}</span>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5 flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                    <Flame size={16} />
                  </div>
                  <div>
                    <span className="text-[9px] text-white/40 uppercase font-mono tracking-wider block">Sinais Ativos Agora</span>
                    <div className="text-base font-black text-amber-400">{withSignalCount} <span className="text-[10px] text-amber-400/60 font-mono">{withSignalCount > 0 ? '🔥 DISPARADO' : 'Aguardando'}</span></div>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5 flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-[#c6a34f]/10 text-[#c6a34f]">
                    <TrendingUp size={16} />
                  </div>
                  <div>
                    <span className="text-[9px] text-white/40 uppercase font-mono tracking-wider block">Assertividade Média</span>
                    <div className="text-base font-black text-[#c6a34f]">{avgWinRate}%</div>
                  </div>
                </div>
              </div>

              {/* CATEGORY SUB-TABS & SEARCH / FILTER CONTROLS */}
              <div className="space-y-3">
                {/* CATEGORY TABS BAR */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-2">
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                    <button
                      onClick={() => setStrategyCategoryTab('all')}
                      className={`px-3.5 py-1.5 rounded-xl font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                        strategyCategoryTab === 'all'
                          ? 'bg-[#c6a34f] text-black shadow-md shadow-amber-500/10'
                          : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <span>Todas</span>
                      <span className={`px-1.5 py-0.2 rounded-md text-[9px] ${strategyCategoryTab === 'all' ? 'bg-black/20 text-black font-black' : 'bg-white/10 text-white/60'}`}>
                        {totalCount}
                      </span>
                    </button>

                    <button
                      onClick={() => setStrategyCategoryTab('system')}
                      className={`px-3.5 py-1.5 rounded-xl font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                        strategyCategoryTab === 'system'
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                          : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <Cpu size={12} />
                      <span>Sistema</span>
                      <span className={`px-1.5 py-0.2 rounded-md text-[9px] ${strategyCategoryTab === 'system' ? 'bg-black/30 text-white font-black' : 'bg-white/10 text-white/60'}`}>
                        {systemItems.length}
                      </span>
                    </button>

                    <button
                      onClick={() => setStrategyCategoryTab('custom')}
                      className={`px-3.5 py-1.5 rounded-xl font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                        strategyCategoryTab === 'custom'
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                          : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <Layers size={12} />
                      <span>Personalizadas</span>
                      <span className={`px-1.5 py-0.2 rounded-md text-[9px] ${strategyCategoryTab === 'custom' ? 'bg-black/30 text-white font-black' : 'bg-white/10 text-white/60'}`}>
                        {customItems.length}
                      </span>
                    </button>

                    <button
                      onClick={() => setStrategyCategoryTab('adaptive')}
                      className={`px-3.5 py-1.5 rounded-xl font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                        strategyCategoryTab === 'adaptive'
                          ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                          : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <Sparkles size={12} />
                      <span>IA Adaptativa</span>
                      <span className={`px-1.5 py-0.2 rounded-md text-[9px] ${strategyCategoryTab === 'adaptive' ? 'bg-black/30 text-white font-black' : 'bg-white/10 text-white/60'}`}>
                        {adaptiveItems.length}
                      </span>
                    </button>

                    <button
                      onClick={() => setStrategyCategoryTab('elite')}
                      className={`px-3.5 py-1.5 rounded-xl font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                        strategyCategoryTab === 'elite'
                          ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-black shadow-md shadow-amber-500/20'
                          : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <Award size={12} />
                      <span>Elite ({">"}64%)</span>
                      <span className={`px-1.5 py-0.2 rounded-md text-[9px] ${strategyCategoryTab === 'elite' ? 'bg-black/30 text-amber-200 font-black' : 'bg-white/10 text-white/60'}`}>
                        {eliteItems.length}
                      </span>
                    </button>
                  </div>

                  {/* SEARCH & STATUS FILTERS TOOLBAR */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Search Input */}
                    <div className="relative min-w-[180px]">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                      <input
                        type="text"
                        value={strategySearchQuery}
                        onChange={(e) => setStrategySearchQuery(e.target.value)}
                        placeholder="Buscar por nome..."
                        className="w-full bg-black/50 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-[10px] text-white placeholder:text-white/30 focus:outline-none focus:border-[#c6a34f]/60 transition-colors"
                      />
                      {strategySearchQuery && (
                        <button 
                          onClick={() => setStrategySearchQuery('')} 
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-[10px]"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Status Filter Dropdown */}
                    <div className="flex items-center bg-black/50 border border-white/10 rounded-xl p-0.5">
                      <button
                        onClick={() => setStrategyStatusFilter('all')}
                        className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase transition-all cursor-pointer ${
                          strategyStatusFilter === 'all' ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/80'
                        }`}
                      >
                        Todos
                      </button>
                      <button
                        onClick={() => setStrategyStatusFilter('active')}
                        className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase transition-all cursor-pointer ${
                          strategyStatusFilter === 'active' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'text-white/40 hover:text-white/80'
                        }`}
                      >
                        🟢 Ativas
                      </button>
                      <button
                        onClick={() => setStrategyStatusFilter('paused')}
                        className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase transition-all cursor-pointer ${
                          strategyStatusFilter === 'paused' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-white/40 hover:text-white/80'
                        }`}
                      >
                        ⏸️ Pausadas
                      </button>
                      <button
                        onClick={() => setStrategyStatusFilter('signal')}
                        className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase transition-all cursor-pointer ${
                          strategyStatusFilter === 'signal' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'text-white/40 hover:text-white/80'
                        }`}
                      >
                        🔥 Com Sinal
                      </button>
                    </div>

                    {/* View Mode Toggle */}
                    <div className="flex items-center bg-black/50 border border-white/10 rounded-xl p-0.5">
                      <button
                        onClick={() => setStrategyViewMode('grid')}
                        className={`p-1.5 rounded-lg transition-all cursor-pointer ${strategyViewMode === 'grid' ? 'bg-[#c6a34f]/20 text-[#c6a34f]' : 'text-white/40 hover:text-white'}`}
                        title="Modo Cards"
                      >
                        <Grid size={13} />
                      </button>
                      <button
                        onClick={() => setStrategyViewMode('dense')}
                        className={`p-1.5 rounded-lg transition-all cursor-pointer ${strategyViewMode === 'dense' ? 'bg-[#c6a34f]/20 text-[#c6a34f]' : 'text-white/40 hover:text-white'}`}
                        title="Modo Lista Adensada"
                      >
                        <List size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* HIGH ASSERTIVITY / ELITE HIGHLIGHT PANEL (WHEN ON ALL OR ELITE TAB) */}
              {(strategyCategoryTab === 'all' || strategyCategoryTab === 'elite') && !strategySearchQuery && (
                <div className="bg-[#1c1913]/90 p-5 rounded-3xl border border-[#c6a34f]/30 relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-6 opacity-[0.03] select-none pointer-events-none">
                      <Target size={120} />
                   </div>
                   <div className="flex items-center justify-between gap-3 mb-4 relative z-10">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-[#c6a34f]/10 text-[#c6a34f]">
                           <TrendingUp size={16} />
                        </div>
                        <div>
                           <h3 className="text-xs font-black text-[#c6a34f] uppercase tracking-widest flex items-center gap-2">
                             Estratégias de Elite ({">"}64% Win Rate)
                           </h3>
                           <p className="text-[9px] text-white/40 uppercase tracking-widest font-mono">Confluências com maior probabilidade identificadas pelo backtest em tempo real</p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-[#c6a34f]/15 border border-[#c6a34f]/30 text-[#c6a34f] text-[9px] font-bold font-mono uppercase">
                        {eliteItems.length} Padrões de Topo
                      </span>
                   </div>

                   {eliteItems.length === 0 ? (
                      <div className="p-5 bg-black/40 rounded-2xl text-center border border-white/5 relative z-10">
                          <p className="text-xs text-white/50 italic leading-relaxed">
                            Nenhum padrão ultrapassou os 64% de win-rate na amostragem em tempo real ainda.<br/>
                            Alimente o simulador com mais jogadas reais (mínimo recomendado: 210) para recalibrar o ranking.
                          </p>
                      </div>
                   ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 relative z-10">
                          {eliteItems.slice(0, 3).map((item, idx) => (
                             <div key={item.strat.id} className="p-3.5 rounded-2xl bg-black/60 border border-[#c6a34f]/25 hover:border-[#c6a34f]/60 transition-all duration-300 flex justify-between items-center gap-3">
                                <div className="space-y-1 min-w-0 flex-1">
                                   <div className="flex items-center gap-1.5">
                                      <span className="px-1.5 py-0.5 rounded bg-[#c6a34f]/20 text-[#c6a34f] text-[8px] font-bold uppercase tracking-wider">Top {idx + 1}</span>
                                      {item.strat.isSystem && (
                                        <span className="px-1 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[7px] font-bold uppercase tracking-wider">Sistema</span>
                                      )}
                                      {item.strat.id.startsWith('adaptive-') && (
                                        <span className="px-1 py-0.5 rounded bg-purple-500/20 text-purple-400 text-[7px] font-bold uppercase tracking-wider">IA</span>
                                      )}
                                   </div>
                                   <h4 className="text-xs font-bold text-white truncate">{item.strat.name}</h4>
                                   <div className="flex items-center gap-2 text-[8px] text-white/40 uppercase font-mono">
                                     <span>Amostras: {item.totalEntries} ({item.wins}W - {item.losses}L)</span>
                                     <span>•</span>
                                     <span className="text-green-400">ROI: +{item.roi.toFixed(1)}%</span>
                                   </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                   <div className="text-right">
                                      <div className="text-lg font-black text-[#c6a34f] font-mono leading-none mb-0.5">
                                         {item.winRate.toFixed(1)}%
                                      </div>
                                      <span className="text-[7px] text-green-400 font-bold uppercase tracking-widest block">Alta Assertividade</span>
                                   </div>

                                   {deletingStrategyId === item.strat.id ? (
                                     <div className="flex items-center gap-1 bg-red-950/90 border border-red-500/50 p-1 rounded-lg animate-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>
                                       <button 
                                         onClick={(e) => {
                                           e.stopPropagation();
                                           deleteStrategy(item.strat.id);
                                           setDeletingStrategyId(null);
                                         }}
                                         className="px-1.5 py-0.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded text-[8px] uppercase cursor-pointer"
                                       >
                                         Sim
                                       </button>
                                       <button 
                                         onClick={(e) => {
                                           e.stopPropagation();
                                           setDeletingStrategyId(null);
                                         }}
                                         className="px-1.5 py-0.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded text-[8px] uppercase cursor-pointer"
                                       >
                                         Não
                                       </button>
                                     </div>
                                   ) : ['system-roulette-racetrack', 'system-roulette-tpa84', 'system-roulette-angel84'].includes(item.strat.id) ? (
                                       <div className="p-1.5 rounded-lg bg-[#c6a34f]/10 border border-[#c6a34f]/20 text-[#c6a34f]" title="Diretriz Protegida (Exclusão Desabilitada)">
                                         <ShieldCheck size={12} className="text-[#c6a34f]" />
                                       </div>
                                    ) : (
                                       <button 
                                         onClick={(e) => {
                                           e.stopPropagation();
                                           setDeletingStrategyId(item.strat.id);
                                         }}
                                         className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:text-red-200 hover:bg-red-500/30 transition-all cursor-pointer"
                                         title="Apagar Estratégia"
                                       >
                                         <Trash2 size={12} />
                                       </button>
                                    )}
                                </div>
                             </div>
                          ))}
                      </div>
                   )}
                </div>
              )}

              {/* LIST OF STRATEGIES */}
              <div className="space-y-3">
                 <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xs font-black text-white/50 uppercase tracking-widest flex items-center gap-2">
                        <Filter size={12} className="text-[#c6a34f]" />
                        Listagem de Diretrizes ({finalDisplayList.length})
                      </h3>
                      {strategyCategoryTab === 'custom' && customItems.length > 0 && (
                        <button
                          onClick={() => {
                            deleteAllCustomStrategies(currentGameType);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-[9px] font-bold uppercase transition-all cursor-pointer flex items-center gap-1.5"
                          title="Apagar todas as estratégias personalizadas"
                        >
                          <Trash2 size={11} />
                          <span>Limpar Personalizadas</span>
                        </button>
                      )}
                    </div>
                    <span className="text-[9px] text-stone-400 uppercase tracking-wider font-mono">
                      Clique na estratégia para expandir o <strong className="text-[#c6a34f]">Raio-X de Explicação em Tempo Real</strong>
                    </span>
                 </div>

                 {finalDisplayList.length === 0 ? (
                   <div className="p-8 bg-black/40 border border-white/5 rounded-3xl text-center space-y-2">
                     <AlertTriangle size={24} className="mx-auto text-amber-500/60" />
                     <p className="text-xs text-white/60 font-medium">Nenhuma estratégia encontrada com os filtros selecionados.</p>
                     <p className="text-[10px] text-white/30 uppercase tracking-wider">Tente alterar os termos da busca ou selecione a aba "Todas".</p>
                   </div>
                 ) : strategyViewMode === 'dense' ? (
                   /* DENSE LIST VIEW MODE */
                   <div className="bg-[#111111] border border-white/10 rounded-2xl overflow-hidden divide-y divide-white/5">
                     {finalDisplayList.map((item) => {
                       const isElite = item.winRate >= 64;
                       const isAdaptive = item.strat.id.startsWith('adaptive-');
                       const hasSignal = activeSignals.some(s => s.strategyId === item.strat.id);
                       const isSelectedExplanation = selectedStrategyIdForExplanation === item.strat.id;
                       const ruleSummary = getStrategyRulesSummary(item.strat);

                       return (
                         <div key={item.strat.id} className="p-3 hover:bg-white/[0.02] transition-colors">
                           <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                             {/* Left info */}
                             <div className="flex items-center gap-3 min-w-0 flex-1">
                               <button 
                                 onClick={() => toggleStrategy(item.strat.id)}
                                 className={`p-1.5 rounded-xl transition-all cursor-pointer shrink-0 ${
                                   item.strat.isActive 
                                     ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                                     : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                                 }`}
                                 title={item.strat.isActive ? 'Pausar Estratégia' : 'Ativar Estratégia'}
                               >
                                 {item.strat.isActive ? <CheckCircle2 size={15} /> : <PauseCircle size={15} />}
                               </button>

                               <div className="min-w-0 flex-1">
                                 <div className="flex items-center gap-2 flex-wrap">
                                   <span className="text-xs font-bold text-white truncate">{item.strat.name}</span>
                                   {item.strat.isSystem ? (
                                     <span className="bg-blue-500/20 border border-blue-500/30 text-blue-400 text-[8px] px-1.5 py-0.2 rounded font-black tracking-wider uppercase">
                                       Sistema
                                     </span>
                                   ) : isAdaptive ? (
                                     <span className="bg-purple-600/20 border border-purple-500/30 text-purple-300 text-[8px] px-1.5 py-0.2 rounded font-black tracking-wider uppercase">
                                       IA
                                     </span>
                                   ) : (
                                     <span className="bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-[8px] px-1.5 py-0.2 rounded font-black tracking-wider uppercase">
                                       Personalizada
                                     </span>
                                   )}

                                   {hasSignal && (
                                     <span className="bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[8px] px-1.5 py-0.2 rounded font-bold uppercase animate-pulse flex items-center gap-0.5">
                                       <Flame size={10} /> Sinal Ativo
                                     </span>
                                   )}
                                   {isElite && (
                                     <span className="bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[8px] px-1.5 py-0.2 rounded font-bold uppercase">
                                       ★ Elite
                                     </span>
                                   )}
                                 </div>

                                 {/* Rules Pills inline */}
                                 <div className="flex items-center gap-2 mt-1 overflow-x-auto no-scrollbar">
                                   {ruleSummary.map((r, rIdx) => {
                                     const RuleIcon = r.icon;
                                     return (
                                       <span key={rIdx} className="inline-flex items-center gap-1 text-[9px] bg-white/5 border border-white/5 px-2 py-0.5 rounded-md text-stone-300 font-mono whitespace-nowrap">
                                         <RuleIcon size={10} className="text-[#c6a34f]" />
                                         <strong className="text-white/60">{r.label}:</strong> {r.value}
                                       </span>
                                     );
                                   })}
                                 </div>
                               </div>
                             </div>

                             {/* Right stats & actions */}
                             <div className="flex items-center gap-4 shrink-0">
                               <div className="text-right font-mono">
                                 <div className="text-xs font-black text-[#c6a34f]">{item.winRate.toFixed(1)}%</div>
                                 <div className="text-[8px] text-white/40 uppercase">{item.totalEntries} entradas ({item.wins}W - {item.losses}L) | ROI: {item.roi.toFixed(1)}%</div>
                               </div>

                               <div className="flex items-center gap-1.5">
                                 <button
                                   onClick={() => setSelectedStrategyIdForExplanation(isSelectedExplanation ? null : item.strat.id)}
                                   className={`p-1.5 rounded-lg text-[9px] font-bold uppercase transition-all cursor-pointer flex items-center gap-1 ${
                                     isSelectedExplanation ? 'bg-[#c6a34f] text-black' : 'bg-white/5 hover:bg-white/10 text-white/70'
                                   }`}
                                   title="Ver Explicação Raio-X"
                                 >
                                   <BookOpen size={12} />
                                 </button>

                                 {!item.strat.id.startsWith('system-') && !isAdaptive && (
                                   <button 
                                     onClick={() => setEditingStrategyId(item.strat.id)}
                                     className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[#c6a34f] text-[9px] font-bold uppercase transition-all cursor-pointer"
                                     title="Editar Estratégia"
                                   >
                                     <Edit3 size={12} />
                                   </button>
                                 )}

                                 {deletingStrategyId === item.strat.id ? (
                                   <div className="flex items-center gap-1 bg-red-950/90 border border-red-500/50 p-1 rounded-lg" onClick={(e) => e.stopPropagation()}>
                                     <span className="text-[8px] font-black text-red-300 uppercase px-0.5">Excluir?</span>
                                     <button 
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         if (selectedStrategyIdForExplanation === item.strat.id) {
                                           setSelectedStrategyIdForExplanation(null);
                                         }
                                         deleteStrategy(item.strat.id);
                                         setDeletingStrategyId(null);
                                       }}
                                       className="px-1.5 py-0.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded text-[8px] uppercase cursor-pointer"
                                     >
                                       Sim
                                     </button>
                                     <button 
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         setDeletingStrategyId(null);
                                       }}
                                       className="px-1.5 py-0.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded text-[8px] uppercase cursor-pointer"
                                     >
                                       Não
                                     </button>
                                   </div>
                                 ) : ['system-roulette-racetrack', 'system-roulette-tpa84', 'system-roulette-angel84'].includes(item.strat.id) ? (
                                     <div className="p-1.5 rounded-lg bg-[#c6a34f]/10 border border-[#c6a34f]/20 text-[#c6a34f]" title="Diretriz Protegida (Exclusão Desabilitada)">
                                       <ShieldCheck size={12} className="text-[#c6a34f]" />
                                     </div>
                                   ) : (
                                     <button 
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         setDeletingStrategyId(item.strat.id);
                                       }}
                                       className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[9px] font-bold uppercase transition-all cursor-pointer"
                                       title="Apagar Estratégia"
                                     >
                                       <Trash2 size={12} />
                                     </button>
                                   )}
                               </div>
                             </div>
                           </div>

                           {/* EXPANDABLE RAIO-X IN DENSE VIEW */}
                           {isSelectedExplanation && (
                             <div className="mt-3 p-4 rounded-xl bg-black/80 border border-[#c6a34f]/30 space-y-3 animate-in slide-in-from-top-2 duration-300">
                               <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                                 <BookOpen size={12} className="text-[#c6a34f]" />
                                 <span className="text-[10px] uppercase tracking-widest text-[#c6a34f] font-black font-mono">
                                   Raio-X de Padrões Probabilísticos do Motor IA
                                 </span>
                               </div>
                               {(() => {
                                 const explanation = getStrategyExplanation(item.strat);
                                 return (
                                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-stone-300 text-[11px]">
                                     <div>
                                       <strong className="text-white text-[10px] uppercase tracking-wider block mb-0.5">🎯 Objetivo:</strong>
                                       <p className="text-stone-300 mb-2">{explanation.objective}</p>
                                       <strong className="text-white text-[10px] uppercase tracking-wider block mb-0.5">⚙️ Funcionamento:</strong>
                                       <p className="text-stone-400">{explanation.howItWorks}</p>
                                     </div>
                                     <div>
                                       <strong className="text-white text-[10px] uppercase tracking-wider block mb-0.5">📊 Padrões Analisados:</strong>
                                       <ul className="list-disc list-inside space-y-0.5 text-stone-300 mb-2">
                                         {explanation.patternsAnalyzed.map((p, idx) => (
                                           <li key={idx}>{p}</li>
                                         ))}
                                       </ul>
                                       <strong className="text-[#c6a34f] text-[10px] uppercase tracking-wider block mb-0.5">💡 Dica de Entrada:</strong>
                                       <p className="italic text-stone-400">{explanation.tips}</p>
                                     </div>
                                   </div>
                                 );
                               })()}
                             </div>
                           )}
                         </div>
                       );
                     })}
                   </div>
                 ) : (
                   /* STANDARD GRID VIEW MODE */
                   <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                      {finalDisplayList.map((item) => {
                        const isElite = item.winRate >= 64;
                        const isAdaptive = item.strat.id.startsWith('adaptive-');
                        const hasSignal = activeSignals.some(s => s.strategyId === item.strat.id);
                        const explanation = getStrategyExplanation(item.strat);
                        const isSelectedExplanation = selectedStrategyIdForExplanation === item.strat.id;
                        const rulesSummary = getStrategyRulesSummary(item.strat);

                        return (
                          <div key={item.strat.id} className="space-y-2">
                            <div 
                              onClick={() => setSelectedStrategyIdForExplanation(isSelectedExplanation ? null : item.strat.id)}
                              className={`p-5 rounded-3xl relative overflow-hidden group transition-all duration-300 cursor-pointer ${
                                isSelectedExplanation
                                  ? 'bg-[#151310] border border-[#c6a34f]/60 shadow-xl shadow-amber-500/5 scale-[1.005]' 
                                  : isElite
                                  ? 'bg-[#121110] border border-[#c6a34f]/25 hover:border-[#c6a34f]/50'
                                  : 'bg-[#111111] border border-white/5 hover:border-white/15'
                              }`}
                            >
                               {isElite && (
                                 <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-amber-400 via-[#c6a34f] to-amber-600 animate-pulse" />
                               )}
                               
                               {/* TOP RIGHT STATUS BADGES & ACTIONS */}
                               <div className="absolute top-0 right-0 p-4 flex items-center gap-2 z-10" onClick={(e) => e.stopPropagation()}>
                                  {deletingStrategyId === item.strat.id ? (
                                    <div className="flex items-center gap-1.5 bg-red-950/90 border border-red-500/50 p-1 rounded-lg animate-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>
                                      <span className="text-[8px] font-black text-red-300 uppercase tracking-wider px-1">Excluir?</span>
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (selectedStrategyIdForExplanation === item.strat.id) {
                                            setSelectedStrategyIdForExplanation(null);
                                          }
                                          deleteStrategy(item.strat.id);
                                          setDeletingStrategyId(null);
                                        }}
                                        className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded text-[8px] uppercase tracking-wider transition-all cursor-pointer"
                                      >
                                        Sim
                                      </button>
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDeletingStrategyId(null);
                                        }}
                                        className="px-1.5 py-0.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded text-[8px] uppercase tracking-wider transition-all cursor-pointer"
                                      >
                                        Não
                                      </button>
                                    </div>
                                  ) : ['system-roulette-racetrack', 'system-roulette-tpa84', 'system-roulette-angel84'].includes(item.strat.id) ? (
                                      <div className="p-1.5 rounded-lg bg-[#c6a34f]/10 border border-[#c6a34f]/20 text-[#c6a34f] flex items-center gap-1 text-[9px] font-bold uppercase" title="Diretriz Protegida (Exclusão Desabilitada)">
                                        <ShieldCheck size={12} className="text-[#c6a34f]" />
                                        <span>Protegida</span>
                                      </div>
                                    ) : (
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDeletingStrategyId(item.strat.id);
                                        }}
                                        className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:text-red-200 hover:bg-red-500/30 transition-all cursor-pointer flex items-center gap-1 text-[9px] font-bold uppercase"
                                        title="Apagar Estratégia"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    )}
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleStrategy(item.strat.id);
                                    }}
                                    className={`px-2.5 py-1 rounded-lg text-[8px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 ${
                                      item.strat.isActive 
                                        ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                                        : 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30'
                                    }`}
                                  >
                                     <span className={`w-1.5 h-1.5 rounded-full ${item.strat.isActive ? 'bg-green-400 animate-ping' : 'bg-zinc-500'}`} />
                                     {item.strat.isActive ? 'Ativo' : 'Pausado'}
                                  </button>
                               </div>

                               {/* STRATEGY HEADER TITLE & BADGES */}
                               <div className="pr-28">
                                 <h4 className="text-sm font-bold text-white mb-1.5 flex items-center gap-1.5 flex-wrap">
                                    <span>{item.strat.name}</span>
                                    {isElite && <span className="text-[#c6a34f] text-xs" title="Assertividade superior a 64%">★</span>}
                                    {isAdaptive && (
                                      <span className="bg-purple-600/20 border border-purple-500/30 text-purple-300 text-[7px] px-1.5 py-0.5 rounded font-black tracking-widest uppercase animate-pulse">
                                        🤖 IA Adaptativa
                                      </span>
                                    )}
                                    {item.strat.isSystem && (
                                      <span className="bg-blue-500/20 border border-blue-500/30 text-blue-400 text-[7px] px-1.5 py-0.5 rounded font-black tracking-widest uppercase">
                                        Sistema
                                      </span>
                                    )}
                                    {!item.strat.isSystem && !isAdaptive && (
                                      <span className="bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-[7px] px-1.5 py-0.5 rounded font-black tracking-widest uppercase">
                                        Personalizada
                                      </span>
                                    )}
                                    {hasSignal && (
                                      <span className="bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[8px] px-1.5 py-0.5 rounded font-bold uppercase animate-pulse flex items-center gap-0.5">
                                        <Flame size={10} /> Sinal Disparado
                                      </span>
                                    )}
                                 </h4>

                                 {/* RULES & STATUS BADGES */}
                                 <div className="space-y-1.5 my-3 bg-black/40 p-2.5 rounded-2xl border border-white/5">
                                   <div className="text-[8px] font-mono text-white/40 uppercase tracking-widest flex items-center gap-1">
                                     <Activity size={10} className="text-[#c6a34f]" />
                                     Regras Operacionais Ativas:
                                   </div>
                                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                     {rulesSummary.map((r, rIdx) => {
                                       const RuleIcon = r.icon;
                                       return (
                                         <div key={rIdx} className="flex items-center gap-1.5 bg-white/5 border border-white/5 px-2 py-1 rounded-xl text-[9.5px]">
                                           <RuleIcon size={12} className="text-[#c6a34f] shrink-0" />
                                           <div className="min-w-0 flex-1 truncate">
                                             <span className="text-white/50 text-[8px] font-mono uppercase block leading-none">{r.label}</span>
                                             <span className="text-stone-200 font-medium truncate block">{r.value}</span>
                                           </div>
                                           <CheckCircle2 size={11} className="text-green-400 shrink-0" />
                                         </div>
                                       );
                                     })}
                                   </div>
                                 </div>
                               </div>
                               
                               {/* PERFORMANCE STATS FOOTER */}
                               <div className="flex justify-between items-end pt-2 border-t border-white/5">
                                  <div className="space-y-0.5">
                                     <div className="flex items-center gap-1">
                                       <div className={`text-[8px] uppercase font-bold tracking-wider ${isElite ? 'text-[#c6a34f]' : 'text-white/40'}`}>
                                          {isElite ? '★ Alta Assertividade' : 'Win Rate Histórico'}
                                       </div>
                                     </div>
                                     <div className={`text-xl font-black font-mono leading-none ${isElite ? 'text-[#c6a34f]' : 'text-white'}`}>
                                       {item.winRate.toFixed(1)}%
                                     </div>
                                     <div className="text-[8px] text-white/40 uppercase font-mono">
                                       Total: {item.totalEntries} amostras ({item.wins}W - {item.losses}L) | ROI: <span className={item.roi >= 0 ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>{item.roi.toFixed(1)}%</span>
                                     </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                    <button 
                                      className="flex items-center gap-1 text-[10px] uppercase font-bold text-[#c6a34f]/80 hover:text-[#c6a34f] cursor-pointer bg-white/5 hover:bg-[#c6a34f]/20 border border-white/10 hover:border-[#c6a34f]/40 px-2 py-1 rounded-xl transition-all"
                                      onClick={() => setEditingStrategyId(item.strat.id)}
                                      title="Editar estratégia"
                                    >
                                      <Edit3 size={11} /> Editar
                                    </button>
                                    <button 
                                      className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#c6a34f]/10 border border-[#c6a34f]/25 text-[10px] uppercase font-bold text-[#c6a34f] hover:bg-[#c6a34f]/20 transition-all cursor-pointer"
                                      onClick={() => setSelectedStrategyIdForExplanation(isSelectedExplanation ? null : item.strat.id)}
                                    >
                                      <BookOpen size={11} /> {isSelectedExplanation ? 'Fechar' : 'Raio-X Explicação'}
                                    </button>
                                  </div>
                               </div>
                            </div>

                            {/* EXPANDABLE INTERACTIVE RAIO-X / EXPLANATION CARD */}
                            {isSelectedExplanation && (
                              <div className="p-5 rounded-2xl bg-black/80 border border-[#c6a34f]/40 space-y-4 animate-in slide-in-from-top-2 duration-300">
                                <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                                  <BookOpen size={13} className="text-[#c6a34f]" />
                                  <span className="text-[10px] uppercase tracking-widest text-[#c6a34f] font-black font-mono">
                                    Raio-X de Padrões Probabilísticos do Motor IA
                                  </span>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-stone-250 text-[11px] leading-relaxed">
                                  <div className="space-y-3.5">
                                    <div>
                                      <strong className="text-white text-[10px] uppercase tracking-wider block mb-1">🎯 Objetivo Técnico:</strong>
                                      <p className="font-medium text-stone-300">{explanation.objective}</p>
                                    </div>
                                    <div>
                                      <strong className="text-white text-[10px] uppercase tracking-wider block mb-1">⚙️ Funcionamento na Prática:</strong>
                                      <p className="text-stone-400 font-medium">{explanation.howItWorks}</p>
                                    </div>
                                  </div>

                                  <div className="space-y-3.5">
                                    <div>
                                      <strong className="text-white text-[10px] uppercase tracking-wider block mb-1">📊 Padrões Analisados para Entrada:</strong>
                                      <div className="space-y-1.5 mt-1.5">
                                        {explanation.patternsAnalyzed.map((pattern, pIdx) => (
                                          <div key={pIdx} className="flex gap-2 items-start bg-white/5 p-2 rounded-xl border border-white/5 font-medium">
                                            <span className="text-[#c6a34f] font-black">●</span>
                                            <span>{pattern}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                    <div className="pt-2 border-t border-white/5">
                                      <strong className="text-[#c6a34f] text-[10px] uppercase tracking-wider block mb-1">💡 Dica de Entrada de Alta Margem:</strong>
                                      <p className="italic text-stone-400 font-medium">{explanation.tips}</p>
                                    </div>
                                  </div>

                                  {/* NOVO: Como fazer as Apostas / Entrada */}
                                  <div className="md:col-span-2 pt-3.5 border-t border-white/10 space-y-2.5">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <strong className="text-[#c6a34f] text-[10px] uppercase tracking-wider block">💸 Posições / Apostas (Entrada):</strong>
                                      <div className="flex flex-wrap gap-1.5 mt-0.5">
                                        {(explanation.betSpots || []).map((spot, sIdx) => (
                                          <span key={sIdx} className="px-2 py-0.5 rounded-md bg-[#c6a34f]/15 text-[#c6a34f] border border-[#c6a34f]/25 text-[9px] font-mono font-bold">
                                            {spot}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                    <p className="text-stone-200 font-semibold bg-white/5 p-3 rounded-xl border border-white/5 leading-relaxed text-[11.5px]">
                                      {explanation.entryInstructions}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                   </div>
                 )}
              </div>
            </div>
          );
        })()}

        {editingStrategy && (
          <StrategyEditor 
            strategy={editingStrategy} 
            onSave={handleSaveStrategy} 
            onCancel={() => setEditingStrategyId(null)} 
            onDelete={(id) => {
              deleteStrategy(id);
              setEditingStrategyId(null);
            }}
            baccaratHistory={historyBaccarat || []}
            rouletteHistory={historyRoulette || []}
          />
        )}

        {activeTab === 'manual' && (
          <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-[#111111] p-10 rounded-[40px] border border-[#c6a34f]/20 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                   <BookOpen size={160} />
                </div>
                
                <h2 className="text-3xl font-black text-[#c6a34f] uppercase tracking-tighter mb-8 italic">Manual de Operação AI</h2>
                
                <div className="space-y-10 relative z-10">
                  {/* Seção 1: Conceitos e Métricas Principais */}
                  <section className="space-y-6">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/5 pb-3">
                       <div className="w-1.5 h-6 bg-[#c6a34f] rounded-full" />
                       Conceitos e Métricas Operacionais
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div className="bg-black/40 p-5 rounded-2xl border border-white/5 space-y-2">
                          <div className="flex items-center gap-2 text-[#c6a34f]">
                             <DollarSign size={18} />
                             <h4 className="font-bold text-sm text-white">Lucro Líquido</h4>
                          </div>
                          <p className="text-xs text-white/50 leading-relaxed">
                             O ganho financeiro líquido e real consolidado nas suas sessões de operação. É obtido através da diferença entre os retornos ganhos das apostas acertadas e os custos investidos nas rodadas/perdas. Revela a lucratividade real do seu caixa ativo.
                          </p>
                       </div>

                       <div className="bg-black/40 p-5 rounded-2xl border border-white/5 space-y-2">
                          <div className="flex items-center gap-2 text-red-500">
                             <Percent size={18} />
                             <h4 className="font-bold text-sm text-white">Drawdown Máximo</h4>
                          </div>
                          <p className="text-xs text-white/50 leading-relaxed">
                             A maior queda ou desvalorização acumulada que seu capital sofreu a partir de um ponto de pico até a mínima subsequente, antes de uma nova recuperação de saldo. Funciona como um importante indicador de estresse econômico de sua banca durante variações desfavoráveis.
                          </p>
                       </div>

                       <div className="bg-black/40 p-5 rounded-2xl border border-white/5 space-y-2">
                          <div className="flex items-center gap-2 text-green-400">
                             <Target size={18} />
                             <h4 className="font-bold text-sm text-white">Assertividade Sessão</h4>
                          </div>
                          <p className="text-xs text-white/50 leading-relaxed">
                             A taxa percentual de eficiência de sucesso das suas jogadas operadas. Trata-se da quantidade de palpites corretos em relação ao total de sinais concluídos na sessão corrente, demonstrando o nível de precisão de acerto momentâneo do mecanismo estatístico.
                          </p>
                       </div>

                       <div className="bg-black/40 p-5 rounded-2xl border border-white/5 space-y-2">
                          <div className="flex items-center gap-2 text-blue-400">
                             <Calculator size={18} />
                             <h4 className="font-bold text-sm text-white">Score de Precisão</h4>
                          </div>
                          <p className="text-xs text-white/50 leading-relaxed">
                             A classificação de acurácia matemática calculada algoritmicamente para cada alerta operacional. A inteligência analisa dispersões matemáticas, a profundidade do histórico recente e repetições consecutivas para estimar a confluência máxima de vitória antes de emitir a recomendação de entrada.
                          </p>
                       </div>
                    </div>
                  </section>

                  {/* Seção 2: Perfis de Gestão de Banca */}
                  <section className="space-y-6">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/5 pb-3">
                       <div className="w-1.5 h-6 bg-[#c6a34f] rounded-full" />
                       Perfis de Gestão de Banca
                    </h3>
                    <p className="text-white/60 text-sm leading-relaxed">
                      Selecione o perfil de gerenciamento mais compatível com sua tolerância de risco e apetite por ganho. O sistema recalcula os alvos e reações financeiras sob três modos distintos de exposição:
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                       <div className="bg-[#c6a34f]/5 p-5 rounded-2xl border border-[#c6a34f]/10 space-y-2">
                          <div className="flex items-center gap-2 text-green-400 font-bold text-xs uppercase tracking-wider">
                             <Scale size={14} />
                             <span>Conservador</span>
                          </div>
                          <p className="text-[11px] text-white/50 leading-normal">
                             Foco absoluto em segurança e proteção do patrimônio principal. Trabalha com stakes (valores bases de entrada) reduzidos, metas de ganho (Stop Win) calculadas e limites de perda (Stop Loss) extremamente estreitos. Minimiza a profundidade de coberturas adicionais (Gales) para blindar seu capital sob turbulências.
                          </p>
                       </div>

                       <div className="bg-[#c6a34f]/5 p-5 rounded-2xl border border-[#c6a34f]/10 space-y-2">
                          <div className="flex items-center gap-2 text-[#c6a34f] font-bold text-xs uppercase tracking-wider">
                             <Scale size={14} />
                             <span>Moderado</span>
                          </div>
                          <p className="text-[11px] text-white/50 leading-normal">
                             Excelente equilíbrio entre rentabilidade recorrente e risco controlado. Permite pequenas progressões estruturadas para recuperação em caso de perdas pontuais de forma matemática, desenhado para atingir resultados sólidos e estáveis em médio prazo sob exposições médias normais.
                          </p>
                       </div>

                       <div className="bg-[#c6a34f]/5 p-5 rounded-2xl border border-[#c6a34f]/10 space-y-2">
                          <div className="flex items-center gap-2 text-red-500 font-bold text-xs uppercase tracking-wider">
                             <Scale size={14} />
                             <span>Agressivo</span>
                          </div>
                          <p className="text-[11px] text-white/50 leading-normal">
                             Planejado exclusivamente para crescimento rápido e alta alavancagem de banca. Admite limites de ganhos e perdas consideravelmente superiores com o uso de coberturas profundas sequenciais (Martingale estendido). Demanda uma banca maior para contornar oscilações pontuais sem estourar.
                          </p>
                       </div>
                    </div>
                  </section>

                  {/* Seção 3: Modos de Jogo */}
                  <section className="space-y-6">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/5 pb-3">
                       <div className="w-1.5 h-6 bg-[#c6a34f] rounded-full" />
                       Modos de Jogo & Análise Padrão
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div className="p-5 bg-black/40 rounded-2xl border border-white/5 space-y-2">
                          <h4 className="text-sm font-bold text-[#c6a34f] uppercase tracking-wider">Baccarat (Modo Adaptativo)</h4>
                          <p className="text-xs text-white/50 leading-relaxed">
                             Analisa o comportamento do sapato ativo identificando ciclos combinatórios entre Player (Jogador), Banker (Banco) e Tie (Empate). O motor calcula a probabilidade matemática das próximas rodadas baseando-se em tendências geométricas de colunas, pontes ou sequências de desvios, de modo a orientar a melhor aposta com maior taxa de vitória.
                          </p>
                       </div>

                       <div className="p-5 bg-black/40 rounded-2xl border border-white/5 space-y-2">
                          <h4 className="text-sm font-bold text-[#c6a34f] uppercase tracking-wider">Roleta (Ciclos Probabilísticos)</h4>
                          <p className="text-xs text-white/50 leading-relaxed">
                             Voltado ao estudo dinâmico de cores (Preto/Vermelho), paridades, dúzias, colunas ou vizinhos de zero. Com base na ausência temporária destas opções (efeito de atraso dinâmico), a inteligência prevê o desvio padrão e projeta o momento preciso de correção matemática para emissão do sinal de entrada ativo.
                          </p>
                       </div>
                    </div>
                  </section>

                  {/* Seção 4: Regra de Ouro */}
                  <section className="p-6 bg-[#c6a34f]/5 rounded-3xl border border-[#c6a34f]/20">
                    <h3 className="text-sm font-black text-[#c6a34f] uppercase tracking-widest mb-3 flex items-center gap-2">
                       <TrendingUp size={16} /> Regra de Ouro (Mínimo de Dados)
                    </h3>
                    <p className="text-white/70 text-sm leading-relaxed">
                      Para que as confluências automáticas e as previsões da nossa inteligência estatística tenham eficácia científica e assertividade validada, é essencial alimentar a ferramenta com registros frequentes e consistentes.
                    </p>
                    <div className="mt-4 flex items-center gap-4">
                       <div className="text-4xl font-black text-[#c6a34f]">210</div>
                       <div className="text-xs uppercase font-bold text-white/40 leading-tight">
                          Resultados Mínimos Recomendados<br/>para calibragem ideal
                       </div>
                    </div>
                  </section>

                  {/* Seção 5: Como Montar Padrões */}
                  <section className="space-y-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/5 pb-3">
                       <div className="w-1.5 h-6 bg-[#c6a34f] rounded-full" />
                       Criação de Filtros e Padrões Customizados
                    </h3>
                    <ul className="space-y-4 text-sm text-white/50">
                       <li className="flex gap-3">
                          <span className="text-[#c6a34f] font-black text-base">01.</span>
                          <span>Navegue até o menu de <strong className="text-white">"Estratégias"</strong> e crie uma nova estratégia do seu tipo preferido.</span>
                       </li>
                       <li className="flex gap-3">
                          <span className="text-[#c6a34f] font-black text-base">02.</span>
                          <span>Utilize o editor de padrão para desenhar graficamente a sequência de cores ou símbolos que servirá como gatilho principal.</span>
                       </li>
                       <li className="flex gap-3">
                          <span className="text-[#c6a34f] font-black text-base">03.</span>
                          <span>Marque com o botão de <strong className="text-white">?</strong> no local onde você de fato quer apostar. O sistema medirá o acerto estatístico dessa posição específica.</span>
                       </li>
                       <li className="flex gap-3">
                          <span className="text-[#c6a34f] font-black text-base">04.</span>
                          <span>Salve as alterações. O motor de busca monitorará as rodadas recebidas e emitirá o sinal visual quando for correspondido na mesa de jogo!</span>
                       </li>
                    </ul>
                  </section>
                </div>
             </div>
          </div>
        )}

        {activeTab === 'bankroll' && (
          <div className="space-y-6">
            <StatsCards bankroll={{ ...bankroll, ...derivedStats }} sessions={[]} />
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-12">
                 <div className="bg-[#111111] p-6 rounded-3xl border border-white/5 mb-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                       <div>
                          <h2 className="text-xl font-bold text-[#c6a34f] uppercase tracking-widest">{t('bankroll.title')}</h2>
                          <p className="text-white/40 text-xs mt-1 italic">{t('bankroll.subtitle')}</p>
                       </div>
                       <div>
                          <button
                            id="btn-session-report-trigger"
                            onClick={() => setIsReportOpen(true)}
                            className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-yellow-600 via-[#c6a34f] to-yellow-600 hover:scale-[1.02] active:scale-[0.98] text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-[0_4px_12px_rgba(198,163,79,0.15)] flex items-center justify-center gap-2 cursor-pointer"
                          >
                             <Award size={14} className="animate-spin-slow" />
                             <span>Resumo & Relatório PDF</span>
                          </button>
                       </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
                       <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                          <label className="text-[10px] uppercase text-white/40 font-bold mb-2 block">{t('bankroll.initial')}</label>
                          <DecimalCommaInput 
                            className="w-full bg-transparent border-none p-0 font-mono text-2xl text-white/50 outline-none" 
                            value={bankroll?.initialBalance ?? 1000}
                            onChange={(val) => updateBankroll({ initialBalance: val })}
                          />
                       </div>
                       <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                          <label className="text-[10px] uppercase text-[#c6a34f] font-bold mb-2 block">{t('bankroll.current')}</label>
                          <DecimalCommaInput 
                            className="w-full bg-transparent border-none p-0 font-mono text-2xl text-[#c6a34f] outline-none" 
                            value={bankroll?.balance ?? 1000}
                            onChange={(val) => updateBankroll({ balance: val })}
                          />
                       </div>
                       <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                          <label className="text-[10px] uppercase text-green-500/40 font-bold mb-2 block">Stop Win</label>
                          <DecimalCommaInput 
                            className="w-full bg-transparent border-none p-0 font-mono text-2xl text-green-500 outline-none" 
                            value={bankroll?.stopWin ?? 200}
                            onChange={(val) => updateBankroll({ stopWin: val })}
                          />
                        </div>
                        <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                           <label className="text-[10px] uppercase text-red-500/40 font-bold mb-2 block">Stop Loss</label>
                           <DecimalCommaInput 
                             className="w-full bg-transparent border-none p-0 font-mono text-2xl text-red-500 outline-none" 
                             value={bankroll?.stopLoss ?? 100}
                             onChange={(val) => updateBankroll({ stopLoss: val })}
                           />
                        </div>
                        <div className="p-4 rounded-2xl bg-black/40 border border-white/5 flex flex-col justify-between">
                           <label className="text-[10px] uppercase text-amber-500/40 font-bold mb-2 block">Rodadas Diárias</label>
                           <select
                             id="select-max-daily-rounds"
                             value={bankroll?.maxDailyRounds ?? 0}
                             onChange={(e) => updateBankroll({ maxDailyRounds: Number(e.target.value) })}
                             className="w-full bg-transparent border-none p-0 font-mono text-lg text-amber-500 outline-none cursor-pointer focus:ring-0"
                           >
                             <option value={0} className="bg-neutral-900 text-white">Sem Limite</option>
                             <option value={10} className="bg-neutral-900 text-white">10 rodadas</option>
                             <option value={20} className="bg-neutral-900 text-white">20 rodadas</option>
                             <option value={50} className="bg-neutral-900 text-white">50 rodadas</option>
                             <option value={100} className="bg-neutral-900 text-white">100 rodadas</option>
                             <option value={500} className="bg-neutral-900 text-white">500 rodadas</option>
                             <option value={1000} className="bg-neutral-900 text-white">1000 rodadas</option>
                           </select>
                        </div>
                     </div>

                    <ManagementPanel 
                      config={bankroll.management}
                      bankroll={bankroll}
                      history={filteredHistory}
                      onBankrollChange={(update) => updateBankroll(update, currentGameType)}
                      positionCount={getPositionCountForSignal(activeSignals[0])}
                      onChange={(update) => updateBankroll({ 
                        management: { 
                          ...bankroll.management,
                          ...update 
                        } 
                      }, currentGameType)}
                    />
                 </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'dailyStats' && (
          <div className="space-y-6 animate-fade-in">
            <DailyStatsHistoryPanel />
          </div>
        )}

        {activeTab === 'backtest' && (
          <div className="space-y-6 animate-fade-in">
            <BacktestOptimizationPanel />
          </div>
        )}

        {activeTab === 'compound' && (
          <div className="space-y-6 animate-fade-in">
            <CompoundInterestPanel />
          </div>
        )}
        {activeTab === 'settings' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-3 mb-8">
               <div className="p-3 bg-[#c6a34f]/10 rounded-2xl text-[#c6a34f]">
                  <Settings size={24} />
               </div>
               <div>
                  <h2 className="text-2xl font-bold tracking-tight">{t('settings.title')}</h2>
                  <p className="text-white/40 text-xs uppercase tracking-widest">{t('settings.subtitle')}</p>
               </div>
            </div>

            <PwaInstallWidget />

            <SystemDiagnosticsPanel />

            <StorageManager />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               {/* Preferências de Interface */}
               <div className="bg-[#111111] p-6 rounded-3xl border border-white/5 space-y-6">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-[#c6a34f] border-b border-white/5 pb-4">{t('settings.preferences')}</h3>
                  
                  <div className="flex items-center justify-between">
                     <div>
                        <div className="text-sm font-bold">{t('settings.allNotifications')}</div>
                        <div className="text-[10px] text-white/40">{t('settings.allNotifications.desc')}</div>
                     </div>
                     <button 
                        onClick={() => updateSettings({ allNotificationsEnabled: settings.allNotificationsEnabled === false ? true : false })}
                        className={`w-12 h-6 rounded-full transition-all relative ${settings.allNotificationsEnabled !== false ? 'bg-[#c6a34f]' : 'bg-zinc-800'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.allNotificationsEnabled !== false ? 'right-1' : 'left-1'}`} />
                     </button>
                  </div>

                  <div className="flex items-center justify-between">
                     <div>
                        <div className="text-sm font-bold">{t('settings.notifications')}</div>
                        <div className="text-[10px] text-white/40">{t('settings.notifications.desc')}</div>
                     </div>
                     <button 
                        onClick={() => updateSettings({ notifications: !settings.notifications })}
                        className={`w-12 h-6 rounded-full transition-all relative ${settings.notifications ? 'bg-[#c6a34f]' : 'bg-zinc-800'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.notifications ? 'right-1' : 'left-1'}`} />
                     </button>
                  </div>

                  <div className="flex items-center justify-between">
                     <div>
                        <div className="text-sm font-bold">{t('settings.soundAlerts')}</div>
                        <div className="text-[10px] text-white/40">{t('settings.soundAlerts.desc')}</div>
                     </div>
                     <button 
                        onClick={() => updateSettings({ heatmapSoundAlerts: !settings.heatmapSoundAlerts })}
                        className={`w-12 h-6 rounded-full transition-all relative ${settings.heatmapSoundAlerts !== false ? 'bg-[#c6a34f]' : 'bg-zinc-800'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.heatmapSoundAlerts !== false ? 'right-1' : 'left-1'}`} />
                     </button>
                  </div>

                  <div className="flex items-center justify-between">
                     <div>
                        <div className="text-sm font-bold">{t('settings.compact')}</div>
                        <div className="text-[10px] text-white/40">{t('settings.compact.desc')}</div>
                     </div>
                     <button 
                        onClick={() => updateSettings({ compactMode: !settings.compactMode })}
                        className={`w-12 h-6 rounded-full transition-all relative ${settings.compactMode ? 'bg-[#c6a34f]' : 'bg-zinc-800'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.compactMode ? 'right-1' : 'left-1'}`} />
                     </button>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-2xl bg-[#c6a34f]/5 border border-[#c6a34f]/20">
                     <div>
                        <div className="text-sm font-bold text-[#c6a34f]">{t('settings.extremeNightMode')}</div>
                        <div className="text-[10px] text-white/50">{t('settings.extremeNightMode.desc')}</div>
                     </div>
                     <button 
                        onClick={() => updateSettings({ extremeNightMode: !settings.extremeNightMode })}
                        className={`w-12 h-6 rounded-full transition-all relative shrink-0 ${settings.extremeNightMode ? 'bg-[#c6a34f]' : 'bg-zinc-800'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.extremeNightMode ? 'right-1' : 'left-1'}`} />
                     </button>
                  </div>

                  <div className="flex items-center justify-between">
                     <div>
                        <div className="text-sm font-bold">{t('settings.autoreset')}</div>
                        <div className="text-[10px] text-white/40">{t('settings.autoreset.desc')}</div>
                     </div>
                     <button 
                        onClick={() => updateSettings({ autoReset: !settings.autoReset })}
                        className={`w-12 h-6 rounded-full transition-all relative ${settings.autoReset ? 'bg-[#c6a34f]' : 'bg-zinc-800'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.autoReset ? 'right-1' : 'left-1'}`} />
                     </button>
                  </div>

                  <div className="flex items-center justify-between">
                     <div>
                        <div className="text-sm font-bold">{t('settings.autoPause')}</div>
                        <div className="text-[10px] text-white/40">{t('settings.autoPause.desc')}</div>
                     </div>
                     <button 
                        onClick={() => updateSettings({ autoPauseEnabled: settings.autoPauseEnabled !== false ? false : true })}
                        className={`w-12 h-6 rounded-full transition-all relative ${settings.autoPauseEnabled !== false ? 'bg-[#c6a34f]' : 'bg-zinc-800'}`}
                     >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.autoPauseEnabled !== false ? 'right-1' : 'left-1'}`} />
                     </button>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-2xl bg-[#c6a34f]/5 border border-[#c6a34f]/20">
                     <div>
                        <div className="text-sm font-bold text-[#c6a34f]">{t('settings.stopVisualAlerts')}</div>
                        <div className="text-[10px] text-white/50">{t('settings.stopVisualAlerts.desc')}</div>
                     </div>
                     <button 
                        onClick={() => updateSettings({ stopVisualAlertsEnabled: settings.stopVisualAlertsEnabled !== false ? false : true })}
                        className={`w-12 h-6 rounded-full transition-all relative shrink-0 ${settings.stopVisualAlertsEnabled !== false ? 'bg-[#c6a34f]' : 'bg-zinc-800'}`}
                     >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.stopVisualAlertsEnabled !== false ? 'right-1' : 'left-1'}`} />
                     </button>
                  </div>

                  <div className="flex items-center justify-between">
                     <div>
                        <div className="text-sm font-bold text-[#c6a34f] flex items-center gap-1.5">
                           <span>{t('settings.sniperMode')}</span>
                           <span className="text-[9px] bg-[#c6a34f]/20 text-[#c6a34f] px-1.5 py-0.5 rounded font-mono">PRO</span>
                        </div>
                        <div className="text-[10px] text-white/40">{t('settings.sniperMode.desc')}</div>
                     </div>
                     <button 
                        onClick={() => updateSettings({ sniperModeEnabled: settings.sniperModeEnabled !== false ? false : true })}
                        className={`w-12 h-6 rounded-full transition-all relative shrink-0 ${settings.sniperModeEnabled !== false ? 'bg-[#c6a34f]' : 'bg-zinc-800'}`}
                     >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.sniperModeEnabled !== false ? 'right-1' : 'left-1'}`} />
                     </button>
                  </div>

                  <div className="flex items-center justify-between">
                     <div>
                        <div className="text-sm font-bold">{t('settings.entropyFilter')}</div>
                        <div className="text-[10px] text-white/40">{t('settings.entropyFilter.desc')}</div>
                     </div>
                     <button 
                        onClick={() => updateSettings({ entropyFilterEnabled: settings.entropyFilterEnabled !== false ? false : true })}
                        className={`w-12 h-6 rounded-full transition-all relative shrink-0 ${settings.entropyFilterEnabled !== false ? 'bg-[#c6a34f]' : 'bg-zinc-800'}`}
                     >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.entropyFilterEnabled !== false ? 'right-1' : 'left-1'}`} />
                     </button>
                  </div>

                  {/* Configuração de Tamanho de Fonte */}
                  <div className="space-y-3 p-4 rounded-2xl bg-white/[0.03] border border-white/10 mt-4">
                     <div>
                        <div className="text-sm font-bold text-[#c6a34f]">{t('settings.fontSize')}</div>
                        <div className="text-xs text-white/60 leading-relaxed mt-0.5">{t('settings.fontSize.desc')}</div>
                     </div>
                     <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                        {[
                           { id: 'small', label: t('settings.fontSize.small') },
                           { id: 'normal', label: t('settings.fontSize.normal') },
                           { id: 'large', label: t('settings.fontSize.large') },
                           { id: 'xlarge', label: t('settings.fontSize.xlarge') }
                        ].map((opt) => (
                           <button
                              key={opt.id}
                              type="button"
                              onClick={() => updateSettings({ fontSizeScale: opt.id as any })}
                              className={`py-2.5 px-2 rounded-xl text-xs font-extrabold transition-all text-center border cursor-pointer ${
                                 (settings.fontSizeScale || 'large') === opt.id
                                    ? 'bg-[#c6a34f] text-black border-[#c6a34f] font-black shadow-lg shadow-[#c6a34f]/20'
                                    : 'bg-black/50 text-white/70 border-white/10 hover:text-white hover:bg-white/10'
                              }`}
                           >
                              {opt.label}
                           </button>
                        ))}
                     </div>
                  </div>
                </div>

                              {/* Configurações Regionais */}
               <div className="bg-[#111111] p-6 rounded-3xl border border-white/5 space-y-6">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-[#c6a34f] border-b border-white/5 pb-4">{t('settings.regional')}</h3>
                  
                  <div className="space-y-2">
                     <label className="text-[10px] uppercase font-bold text-white/40 tracking-widest">{t('settings.languageSelect')}</label>
                     <select 
                        value={settings.language || 'pt-BR'}
                        onChange={(e) => updateSettings({ language: e.target.value })}
                        className="w-full bg-black/40 border border-white/10 p-3 rounded-xl text-sm outline-none focus:border-[#c6a34f]/50 text-white"
                      >
                        <option value="pt-BR">Português Brasileiro (pt-BR)</option>
                        <option value="en">English (en)</option>
                        <option value="es">Español (es)</option>
                        <option value="zh">中文 (zh)</option>
                        <option value="ru">Русский (ru)</option>
                     </select>
                  </div>

                  <div className="space-y-2">
                     <label className="text-[10px] uppercase font-bold text-white/40 tracking-widest">{t('settings.currency')}</label>
                     <select 
                        value={settings.currency}
                        onChange={(e) => updateSettings({ currency: e.target.value })}
                        className="w-full bg-black/40 border border-white/10 p-3 rounded-xl text-sm outline-none focus:border-[#c6a34f]/50 text-white"
                      >
                        <option value="BRL">{t('term.currency.brl')}</option>
                        <option value="USD">{t('term.currency.usd')}</option>
                        <option value="EUR">{t('term.currency.eur')}</option>
                     </select>
                  </div>

                  <div className="p-4 rounded-2xl bg-zinc-800/20 border border-zinc-800 text-[10px] text-white/50 leading-relaxed italic">
                    {t('settings.dbInfo')}
                  </div>
               </div>

               <div className="bg-red-500/5 p-4 rounded-2xl border border-red-500/20 flex items-center justify-between mt-4">
                  <div className="text-[10px] text-red-500/60 uppercase font-black tracking-widest">{t('settings.resetZone')}</div>
                  <button 
                    onClick={async () => { 
                      if (confirmActionId === 'reset-app-all') {
                        try {
                          await masterReset();
                        } catch (e) {
                          console.error(e);
                        }
                        localStorage.clear(); 
                        window.location.reload(); 
                      } else {
                        setConfirmActionId('reset-app-all');
                      }
                    }}
                    className={`px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                      confirmActionId === 'reset-app-all'
                        ? 'bg-yellow-500 text-black hover:bg-yellow-600 animate-pulse'
                        : 'bg-red-600 text-white hover:bg-red-700'
                    }`}
                  >
                    {confirmActionId === 'reset-app-all' ? t('settings.resetSure') : t('settings.resetBtn')}
                  </button>
               </div>
            </div>

            <div className="bg-[#c6a34f]/5 p-6 rounded-3xl border border-[#c6a34f]/10 mt-6">
               <div className="flex items-center gap-4 text-[#c6a34f]">
                  <ShieldCheck size={24} />
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-tight">{t('settings.security')}</h4>
                    <p className="text-[10px] text-white/60">{t('settings.security.desc')}</p>
                  </div>
               </div>
            </div>
          </div>
        )}
{/* Consolidated operation manual at top */}
      </div>
      {settings?.allNotificationsEnabled !== false && (
        <NotificationAlerts 
          alerts={backtestAlerts} 
          onDismiss={(id) => setBacktestAlerts(prev => prev.filter(a => a.id !== id))} 
          onClearAll={() => setBacktestAlerts([])} 
        />
      )}
      <SessionSummaryReport 
        history={filteredHistory} 
        bankroll={bankroll} 
        derivedStats={derivedStats} 
        strategies={strategies} 
        gameType={currentGameType} 
        isOpen={isReportOpen} 
        onClose={() => setIsReportOpen(false)} 
      />
    </Layout>
  </MotionConfig>
  );
}
