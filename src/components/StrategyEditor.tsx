import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  X, 
  Save, 
  Trash2, 
  Coins, 
  Calculator,
  RotateCcw,
  Layout as LayoutIcon,
  CircleDot,
  CheckCircle2,
  History,
  Activity,
  Ghost,
  Play,
  TrendingUp,
  Percent,
  Copy,
  Download,
  Upload,
  Sliders,
  ShieldCheck,
  Gauge,
  Zap,
  Sparkles,
  Check,
  Layers,
  Flame,
  Info
} from 'lucide-react';
import { GameType, Strategy, ManagementMode } from '../types';
import { COLOR_MAP, ROULETTE_RACE_SEQUENCE } from '../constants';
import { checkWin } from '../engines/statsEngine';

interface StrategyEditorProps {
  strategy: Strategy;
  onSave: (strategy: Strategy) => void;
  onCancel: () => void;
  onDelete?: (id: string) => void;
  baccaratHistory?: any[];
  rouletteHistory?: any[];
}

interface AutoAdjustLog {
  id: string;
  time: string;
  description: string;
  oldVal: number;
  newVal: number;
  trigger: string;
}

const CHIP_VALUES = [1, 2, 3, 4, 5, 10, 20, 50, 100];

const SmallChip: React.FC<{ amount: number }> = ({ amount }) => (
  amount > 0 ? (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white text-black font-black text-[11px] flex items-center justify-center border-2 border-[#c6a34f] shadow-lg z-30 pointer-events-none">
      {amount.toFixed(0)}U
    </div>
  ) : null
);

const AutoScale: React.FC<{ children: React.ReactNode; baseWidth: number }> = ({ children, baseWidth }) => {
  const [scale, setScale] = useState(1);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        if (containerWidth < baseWidth) {
          setScale(containerWidth / baseWidth);
        } else {
          setScale(1);
        }
      }
    };

    const observer = new ResizeObserver(updateScale);
    if (containerRef.current) observer.observe(containerRef.current);
    updateScale();

    return () => observer.disconnect();
  }, [baseWidth]);

  return (
    <div ref={containerRef} className="w-full flex justify-center overflow-visible">
      <div 
        style={{ 
          transform: `scale(${scale})`, 
          transformOrigin: 'top center',
          width: `${baseWidth}px`
        }}
      >
        {children}
      </div>
    </div>
  );
};

const StrategyEditor: React.FC<StrategyEditorProps> = ({ strategy, onSave, onCancel, onDelete, baccaratHistory = [], rouletteHistory = [] }) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState(strategy.name);
  const [gameType, setGameType] = useState(strategy.gameType);
  const [selectedChip, setSelectedChip] = useState(1);
  const [bets, setBets] = useState<{ target: any; amount: number; type: string }[]>(strategy.rules.bets || []);
  const [baccaratPattern, setBaccaratPattern] = useState<{ r: number, c: number, type: 'P'|'B'|'T'|'?' }[]>(strategy.rules.baccaratPattern || []);
  const [history, setHistory] = useState<({ target: any; amount: number; type: string }[] | { r: number, c: number, type: 'P'|'B'|'T'|'?' }[])[]>([]);

  // Configuração de Gestão e Progressão Recomendada por Estratégia
  const initialMaxGale = strategy.management?.levels !== undefined 
    ? strategy.management.levels 
    : (strategy.rules?.maxGale !== undefined ? strategy.rules.maxGale : 2);
  const initialProgressionMode = strategy.management?.mode || strategy.rules?.progressionMode || ManagementMode.MARTINGALE;
  const initialMultiplier = strategy.management?.multiplier || strategy.rules?.progressionMultiplier || 2.0;

  const [maxGale, setMaxGale] = useState<number>(initialMaxGale);
  const [progressionMode, setProgressionMode] = useState<ManagementMode>(initialProgressionMode);
  const [progressionMultiplier, setProgressionMultiplier] = useState<number>(initialMultiplier);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [copiedToast, setCopiedToast] = useState<boolean>(false);
  const [showJsonModal, setShowJsonModal] = useState<'export' | 'import' | null>(null);
  const [jsonInput, setJsonInput] = useState<string>('');
  const [jsonError, setJsonError] = useState<string>('');

  const isSystemStrategy = Boolean(strategy.isSystem || strategy.id.startsWith('system-'));

  // Configurações de Gatilho de Confirmação (Estilo S84)
  const initialTriggerConfig = strategy.rules?.triggerConfig || {};
  const [selectedPositions, setSelectedPositions] = useState<number[]>(
    initialTriggerConfig.selectedPositions && Array.isArray(initialTriggerConfig.selectedPositions) && initialTriggerConfig.selectedPositions.length > 0
      ? initialTriggerConfig.selectedPositions
      : [0]
  );
  const [minDelay, setMinDelay] = useState<number>(initialTriggerConfig.minDelay || 0);
  const [maxDelay, setMaxDelay] = useState<number>(initialTriggerConfig.maxDelay || 0);
  const [minFrequency, setMinFrequency] = useState<number>(initialTriggerConfig.minFrequency || 0);
  const [frequencyWindow, setFrequencyWindow] = useState<number>(initialTriggerConfig.frequencyWindow || 10);
  const [statCriterion, setStatCriterion] = useState<'manual' | 'maior_ausencia' | 'maior_frequencia'>('manual');
  const [analysisWindow, setAnalysisWindow] = useState<number>(initialTriggerConfig.analysisWindow || 30);
  
  const [useRacetrackConfluence, setUseRacetrackConfluence] = useState<boolean>(initialTriggerConfig.useRacetrackConfluence || false);
  const [confluenceType, setConfluenceType] = useState<'terminals' | 'sectors' | 'numbers' | 'both' | 'external' | 'dozens' | 'columns' | 'lines' | 'streets' | 'dozens_columns' | 'lines_streets' | 'corners_splits' | 'all'>(initialTriggerConfig.confluenceType || 'terminals');
  const [confluenceMode, setConfluenceMode] = useState<'global' | 'custom'>(initialTriggerConfig.confluenceMode || 'global');
  const [globalNeighborsCount, setGlobalNeighborsCount] = useState<number>(initialTriggerConfig.globalNeighborsCount !== undefined ? initialTriggerConfig.globalNeighborsCount : 3);
  const [selectedTerminals, setSelectedTerminals] = useState<number[]>(initialTriggerConfig.selectedTerminals || [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const [customTerminalsConfig, setCustomTerminalsConfig] = useState<Record<number, number>>(initialTriggerConfig.customTerminalsConfig || {});
  const [selectedSectors, setSelectedSectors] = useState<string[]>(initialTriggerConfig.selectedSectors || []);
  const [customSectorsConfig, setCustomSectorsConfig] = useState<Record<string, number>>(initialTriggerConfig.customSectorsConfig || {});
  const [confluenceNumbers, setConfluenceNumbers] = useState<number[]>(initialTriggerConfig.confluenceNumbers || Array.from({ length: 37 }, (_, i) => i));
  const [customNumbersConfig, setCustomNumbersConfig] = useState<Record<number, number>>(initialTriggerConfig.customNumbersConfig || {});
  const [selectedExternalBets, setSelectedExternalBets] = useState<string[]>(initialTriggerConfig.selectedExternalBets || ['high', 'low', 'even', 'odd', 'red', 'black']);
  const [selectedDozensColumns, setSelectedDozensColumns] = useState<string[]>(initialTriggerConfig.selectedDozensColumns || ['dozen_1', 'dozen_2', 'dozen_3', 'col_1', 'col_2', 'col_3']);
  const [selectedLinesStreets, setSelectedLinesStreets] = useState<string[]>(initialTriggerConfig.selectedLinesStreets || ['line_1_6', 'line_7_12', 'line_13_18', 'line_19_24', 'line_25_30', 'line_31_36', 'street_1_3', 'street_4_6', 'street_7_9', 'street_10_12', 'street_13_15', 'street_16_18', 'street_19_21', 'street_22_24', 'street_25_27', 'street_28_30', 'street_31_33', 'street_34_36']);
  const [selectedCornersSplits, setSelectedCornersSplits] = useState<string[]>(initialTriggerConfig.selectedCornersSplits || ['corner_1_5', 'corner_2_6', 'corner_7_11', 'corner_19_23', 'corner_28_32', 'corner_32_36', 'split_0_1', 'split_0_2', 'split_0_3', 'split_1_2', 'split_2_3', 'split_10_11', 'split_13_14', 'split_26_27', 'split_35_36']);
  const [useS84Sequence, setUseS84Sequence] = useState<boolean>(initialTriggerConfig.useS84Sequence || false);

  // Auto-população de parâmetros conhecidos para estratégias do sistema caso venham vazias
  React.useEffect(() => {
    if (strategy.id === 'system-roulette-tpa84' && (!strategy.rules?.triggerConfig || Object.keys(strategy.rules.triggerConfig).length === 0)) {
      setSelectedPositions([1, 2]);
      setStatCriterion('manual');
      setUseRacetrackConfluence(true);
      setConfluenceType('terminals');
      setGlobalNeighborsCount(2);
      setSelectedTerminals([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    } else if (strategy.id === 'system-roulette-racetrack' && (!strategy.rules?.triggerConfig || Object.keys(strategy.rules.triggerConfig).length === 0)) {
      setSelectedPositions([0]);
      setStatCriterion('maior_ausencia');
      setAnalysisWindow(30);
      setUseRacetrackConfluence(true);
      setConfluenceType('terminals');
      setGlobalNeighborsCount(3);
      setSelectedTerminals([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    } else if (strategy.id === 'system-roulette-angel84' && (!strategy.rules?.triggerConfig || Object.keys(strategy.rules.triggerConfig).length === 0)) {
      setSelectedPositions([0, 1]);
      setStatCriterion('maior_frequencia');
      setAnalysisWindow(12);
      setUseRacetrackConfluence(true);
      setConfluenceType('terminals');
      setGlobalNeighborsCount(2);
      setSelectedTerminals([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    }
  }, [strategy.id]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleDuplicate = () => {
    const newStrategy: Strategy = {
      ...strategy,
      id: 'custom-' + Date.now(),
      name: `${name} (Cópia)`,
      isSystem: false,
      rules: {
        ...strategy.rules,
        bets,
        baccaratPattern,
        maxGale,
        progressionMode,
        progressionMultiplier,
        triggerConfig: {
          selectedPositions,
          minDelay,
          maxDelay,
          minFrequency,
          frequencyWindow,
          statCriterion,
          analysisWindow,
          useRacetrackConfluence,
          confluenceType,
          confluenceMode,
          globalNeighborsCount,
          selectedTerminals,
          customTerminalsConfig,
          selectedSectors,
          customSectorsConfig,
          confluenceNumbers,
          customNumbersConfig,
          selectedExternalBets,
          selectedDozensColumns,
          selectedLinesStreets,
          selectedCornersSplits,
          useS84Sequence
        }
      },
      management: {
        ...(strategy.management || {} as any),
        mode: progressionMode,
        levels: maxGale,
        multiplier: progressionMultiplier,
        initialBet: totalBet > 0 ? totalBet : (strategy.management?.initialBet || 1)
      }
    };
    onSave(newStrategy);
  };

  const handleRestoreFactory = () => {
    const defaultConfigs: Record<string, any> = {
      'system-roulette-tpa84': {
        name: 'TPA84 (Penúltimo + Antepenúltimo)',
        positions: [1, 2],
        criterion: 'manual',
        racetrack: true,
        type: 'terminals',
        neighbors: 2,
        maxGale: 2,
        progression: ManagementMode.MARTINGALE
      },
      'system-roulette-racetrack': {
        name: 'TERMINAL S84',
        positions: [0],
        criterion: 'maior_ausencia',
        window: 30,
        racetrack: true,
        type: 'terminals',
        neighbors: 3,
        maxGale: 2,
        progression: ManagementMode.MARTINGALE
      },
      'system-roulette-angel84': {
        name: 'Angel84',
        positions: [0, 1],
        criterion: 'maior_frequencia',
        window: 12,
        racetrack: true,
        type: 'terminals',
        neighbors: 2,
        maxGale: 2,
        progression: ManagementMode.MARTINGALE
      },
      'system-roulette-trends': {
        name: 'Análise de Tendência Quente/Fria (Roleta)',
        positions: [0],
        criterion: 'maior_frequencia',
        window: 20,
        racetrack: false,
        maxGale: 2,
        progression: ManagementMode.MARTINGALE
      },
      'system-roulette-probability': {
        name: 'Análise de Probabilidades (Roleta)',
        positions: [0],
        criterion: 'maior_ausencia',
        window: 36,
        racetrack: false,
        maxGale: 2,
        progression: ManagementMode.MARTINGALE
      },
      'system-roulette-delay': {
        name: 'Análise de Frequência e Assertividade (Roleta)',
        positions: [0],
        minDelay: 3,
        maxDelay: 15,
        criterion: 'maior_ausencia',
        window: 30,
        maxGale: 2,
        progression: ManagementMode.MARTINGALE
      }
    };

    const preset = defaultConfigs[strategy.id];
    if (preset) {
      setName(preset.name);
      setMaxGale(preset.maxGale);
      setProgressionMode(preset.progression);
      setSelectedPositions(preset.positions || [0]);
      setStatCriterion(preset.criterion || 'manual');
      if (preset.window) setAnalysisWindow(preset.window);
      if (preset.racetrack !== undefined) setUseRacetrackConfluence(preset.racetrack);
      if (preset.type) setConfluenceType(preset.type);
      if (preset.neighbors !== undefined) setGlobalNeighborsCount(preset.neighbors);
      if (preset.minDelay !== undefined) setMinDelay(preset.minDelay);
      if (preset.maxDelay !== undefined) setMaxDelay(preset.maxDelay);
      showToast('Configuração de fábrica restaurada com sucesso!');
    } else {
      setMaxGale(2);
      setProgressionMode(ManagementMode.MARTINGALE);
      setSelectedPositions([0]);
      setStatCriterion('manual');
      showToast('Padrão restaurado!');
    }
  };

  const handleExportJson = () => {
    const payload = {
      name,
      gameType,
      maxGale,
      progressionMode,
      progressionMultiplier,
      rules: {
        bets,
        baccaratPattern,
        maxGale,
        progressionMode,
        progressionMultiplier,
        triggerConfig: {
          selectedPositions,
          minDelay,
          maxDelay,
          minFrequency,
          frequencyWindow,
          statCriterion,
          analysisWindow,
          useRacetrackConfluence,
          confluenceType,
          confluenceMode,
          globalNeighborsCount,
          selectedTerminals,
          customTerminalsConfig,
          selectedSectors,
          customSectorsConfig,
          confluenceNumbers,
          customNumbersConfig,
          selectedExternalBets,
          selectedDozensColumns,
          selectedLinesStreets,
          selectedCornersSplits,
          useS84Sequence
        }
      }
    };
    const jsonStr = JSON.stringify(payload, null, 2);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(jsonStr).then(() => {
        setCopiedToast(true);
        setTimeout(() => setCopiedToast(false), 2500);
      }).catch(() => {
        setJsonInput(jsonStr);
        setShowJsonModal('export');
      });
    } else {
      setJsonInput(jsonStr);
      setShowJsonModal('export');
    }
  };

  const handleImportJson = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      if (parsed.name) setName(parsed.name);
      if (parsed.gameType) setGameType(parsed.gameType);
      if (parsed.maxGale !== undefined) setMaxGale(parsed.maxGale);
      if (parsed.rules?.maxGale !== undefined) setMaxGale(parsed.rules.maxGale);
      if (parsed.progressionMode) setProgressionMode(parsed.progressionMode);
      if (parsed.rules?.progressionMode) setProgressionMode(parsed.rules.progressionMode);
      if (parsed.rules?.bets) setBets(parsed.rules.bets);
      if (parsed.rules?.baccaratPattern) setBaccaratPattern(parsed.rules.baccaratPattern);
      
      if (parsed.rules?.triggerConfig) {
        const tc = parsed.rules.triggerConfig;
        if (tc.selectedPositions) setSelectedPositions(tc.selectedPositions);
        if (tc.minDelay !== undefined) setMinDelay(tc.minDelay);
        if (tc.maxDelay !== undefined) setMaxDelay(tc.maxDelay);
        if (tc.minFrequency !== undefined) setMinFrequency(tc.minFrequency);
        if (tc.frequencyWindow !== undefined) setFrequencyWindow(tc.frequencyWindow);
        setStatCriterion('manual');
        if (tc.analysisWindow !== undefined) setAnalysisWindow(tc.analysisWindow);
        if (tc.useRacetrackConfluence !== undefined) setUseRacetrackConfluence(tc.useRacetrackConfluence);
        if (tc.confluenceType) setConfluenceType(tc.confluenceType);
        if (tc.confluenceMode) setConfluenceMode(tc.confluenceMode);
        if (tc.globalNeighborsCount !== undefined) setGlobalNeighborsCount(tc.globalNeighborsCount);
        if (tc.selectedTerminals) setSelectedTerminals(tc.selectedTerminals);
        if (tc.customTerminalsConfig) setCustomTerminalsConfig(tc.customTerminalsConfig);
        if (tc.selectedSectors) setSelectedSectors(tc.selectedSectors);
        if (tc.customSectorsConfig) setCustomSectorsConfig(tc.customSectorsConfig);
        if (tc.confluenceNumbers) setConfluenceNumbers(tc.confluenceNumbers);
        if (tc.customNumbersConfig) setCustomNumbersConfig(tc.customNumbersConfig);
        if (tc.selectedExternalBets) setSelectedExternalBets(tc.selectedExternalBets);
        if (tc.selectedDozensColumns) setSelectedDozensColumns(tc.selectedDozensColumns);
        if (tc.selectedLinesStreets) setSelectedLinesStreets(tc.selectedLinesStreets);
        if (tc.selectedCornersSplits) setSelectedCornersSplits(tc.selectedCornersSplits);
        if (tc.useS84Sequence !== undefined) setUseS84Sequence(tc.useS84Sequence);
      }
      
      setShowJsonModal(null);
      setJsonInput('');
      setJsonError('');
      showToast('Estratégia importada com sucesso!');
    } catch (err: any) {
      setJsonError('JSON inválido. Por favor, verifique o formato e tente novamente.');
    }
  };

  const cloneBets = (bList: { target: any; amount: number; type: string }[]) => {
    return bList.map(b => ({
      ...b,
      target: Array.isArray(b.target) ? [...b.target] : b.target
    }));
  };

  const cloneBaccaratPattern = (pList: { r: number, c: number, type: 'P'|'B'|'T'|'?' }[]) => {
    return pList.map(p => ({ ...p }));
  };

  const pushToHistory = (customBets?: { target: any; amount: number; type: string }[], customPattern?: { r: number, c: number, type: 'P'|'B'|'T'|'?' }[]) => {
    const targetBets = customBets || bets;
    const targetPattern = customPattern || baccaratPattern;
    if (gameType === GameType.BACCARAT) {
      setHistory(prev => [...prev.slice(-49), cloneBaccaratPattern(targetPattern)]);
    } else {
      setHistory(prev => [...prev.slice(-49), cloneBets(targetBets)]);
    }
  };
  const [viewMode, setViewMode] = useState<'traditional' | 'race'>('traditional');
  const [neighborCount, setNeighborCount] = useState<number>(2);
  const [applyNeighborsOnClick, setApplyNeighborsOnClick] = useState<boolean>(true);
  const [autoAdjustNeighbors, setAutoAdjustNeighbors] = useState<boolean>(false);
  const [lastAutoAdjustMsg, setLastAutoAdjustMsg] = useState<string>('');
  const [showAutoAdjustLogs, setShowAutoAdjustLogs] = useState<boolean>(false);
  const [autoAdjustLogs, setAutoAdjustLogs] = useState<AutoAdjustLog[]>([]);
  const [hoveredNumber, setHoveredNumber] = useState<number | null>(null);
  const [ghostCoverage, setGhostCoverage] = useState<boolean>(true);

  const [backtestResult, setBacktestResult] = useState<{
    totalRounds: number;
    staticWins: number;
    dynamicWins: number;
    staticWinRate: number;
    dynamicWinRate: number;
    difference: number;
    analyzedCenters: number[];
  } | null>(null);
  const [isBacktesting, setIsBacktesting] = useState<boolean>(false);

  const getDynamicNeighborsAtStep = (num: number, recentSpins: any[]): number => {
    const index = ROULETTE_RACE_SEQUENCE.indexOf(num);
    if (index === -1) return neighborCount;
    
    const sectorNumbers = new Set<number>();
    for (let i = -3; i <= 3; i++) {
      const idx = (index + i + 37) % 37;
      sectorNumbers.add(ROULETTE_RACE_SEQUENCE[idx]);
    }
    
    if (recentSpins.length < 5) {
      return 2;
    }
    
    const N = recentSpins.length;
    let weightedHitsSum = 0;
    let totalWeight = 0;
    const hitIndices: number[] = [];
    
    recentSpins.forEach((spin, spinIdx) => {
      const val = typeof spin.result === 'number' ? spin.result : Number(spin.result);
      const weight = N - spinIdx;
      
      const isHit = !isNaN(val) && sectorNumbers.has(val);
      if (isHit) {
        weightedHitsSum += weight;
        hitIndices.push(spinIdx);
      }
      totalWeight += weight;
    });

    const weightedFreq = weightedHitsSum / totalWeight;
    
    let volatility = 0.5;
    if (hitIndices.length >= 2) {
      const gaps: { val: number; weight: number }[] = [];
      for (let j = 0; j < hitIndices.length - 1; j++) {
        const avgIndex = (hitIndices[j] + hitIndices[j + 1]) / 2;
        const weight = N - avgIndex;
        gaps.push({ val: hitIndices[j + 1] - hitIndices[j], weight });
      }
      
      const sumWeights = gaps.reduce((acc, g) => acc + g.weight, 0);
      const weightedMeanGap = gaps.reduce((acc, g) => acc + g.val * g.weight, 0) / (sumWeights || 1);
      const weightedVariance = gaps.reduce((acc, g) => acc + Math.pow(g.val - weightedMeanGap, 2) * g.weight, 0) / (sumWeights || 1);
      
      volatility = Math.min(1, Math.max(0, Math.sqrt(weightedVariance) / 10));
    } else if (hitIndices.length === 1) {
      volatility = 0.8;
    } else {
      volatility = 0.1;
    }

    if (weightedFreq <= 0.05) {
      return 5;
    } else if (volatility > 0.6) {
      return 1;
    } else if (weightedFreq > 0.20) {
      return 3;
    } else {
      return 2;
    }
  };

  const findRacetrackCenters = (bettedNumbers: number[], currentK: number): number[] => {
    if (bettedNumbers.length === 0) return [];
    const bettedSet = new Set(bettedNumbers);
    const centers: number[] = [];

    if (currentK === 0) {
      return bettedNumbers;
    }

    const candidates = ROULETTE_RACE_SEQUENCE.map((num, idx) => {
      let hits = 0;
      for (let step = -currentK; step <= currentK; step++) {
        const neighborIdx = (idx + step + 37) % 37;
        if (bettedSet.has(ROULETTE_RACE_SEQUENCE[neighborIdx])) {
          hits++;
        }
      }
      return { num, idx, hits };
    });

    candidates.sort((a, b) => b.hits - a.hits);

    const coveredByCenters = new Set<number>();
    for (const cand of candidates) {
      if (cand.hits === 0) continue;
      let coversNew = false;
      for (let step = -currentK; step <= currentK; step++) {
        const neighborIdx = (cand.idx + step + 37) % 37;
        const val = ROULETTE_RACE_SEQUENCE[neighborIdx];
        if (bettedSet.has(val) && !coveredByCenters.has(val)) {
          coversNew = true;
          break;
        }
      }

      if (coversNew) {
        centers.push(cand.num);
        for (let step = -currentK; step <= currentK; step++) {
          const neighborIdx = (cand.idx + step + 37) % 37;
          coveredByCenters.add(ROULETTE_RACE_SEQUENCE[neighborIdx]);
        }
      }
      
      if (coveredByCenters.size >= bettedSet.size) {
        break;
      }
    }

    return centers;
  };

  const runBacktestAutoAdjust = () => {
    if (!rouletteHistory || rouletteHistory.length === 0) return;
    setIsBacktesting(true);
    
    setTimeout(() => {
      try {
        const bettedNumbers = bets.filter(b => b.type === 'number').map(b => Number(b.target));
        const centers = findRacetrackCenters(bettedNumbers, neighborCount);
        
        const N = rouletteHistory.length;
        let staticWins = 0;
        let dynamicWins = 0;
        let totalRounds = 0;

        for (let i = N - 1; i >= 0; i--) {
          const spin = rouletteHistory[i];
          const resultVal = typeof spin.result === 'number' ? spin.result : Number(spin.result);
          if (isNaN(resultVal)) continue;

          totalRounds++;
          
          // 1. Evaluate Static Win
          let staticHit = false;
          bettedNumbers.forEach(targetNum => {
            const index = ROULETTE_RACE_SEQUENCE.indexOf(targetNum);
            if (index !== -1) {
              const covered = new Set<number>();
              covered.add(targetNum);
              for (let k = 1; k <= 5; k++) {
                covered.add(ROULETTE_RACE_SEQUENCE[(index - k + 37) % 37]);
                covered.add(ROULETTE_RACE_SEQUENCE[(index + k) % 37]);
              }
              if (covered.has(resultVal)) {
                staticHit = true;
              }
            } else if (targetNum === resultVal) {
              staticHit = true;
            }
          });
          
          const nonNumberBets = bets.filter(b => b.type !== 'number');
          nonNumberBets.forEach(bet => {
            let entryRef = '';
            if (bet.type === 'dozen' || bet.type === 'column') {
              entryRef = (bet.type === 'dozen' ? 'Dúzia ' : 'Coluna ') + bet.target;
            } else if (bet.type === 'color') {
              entryRef = bet.target === 'red' ? 'Red' : 'Black';
            } else if (bet.type === 'even_chance') {
              entryRef = bet.target.charAt(0).toUpperCase() + bet.target.slice(1);
            } else if (bet.type === 'multi') {
              entryRef = JSON.stringify(bet.target);
            }
            if (entryRef && checkWin(resultVal, entryRef)) {
              staticHit = true;
            }
          });
          
          if (staticHit) {
            staticWins++;
          }

          // 2. Evaluate Dynamic Win
          const historySlice = rouletteHistory.slice(i + 1, i + 101);
          const dynamicCoveredNumbers = new Set<number>();
          centers.forEach(center => {
            const K_dynamic = getDynamicNeighborsAtStep(center, historySlice);
            const index = ROULETTE_RACE_SEQUENCE.indexOf(center);
            if (index !== -1) {
              dynamicCoveredNumbers.add(center);
              for (let step = 1; step <= K_dynamic; step++) {
                const leftIndex = (index - step + 37) % 37;
                const rightIndex = (index + step) % 37;
                dynamicCoveredNumbers.add(ROULETTE_RACE_SEQUENCE[leftIndex]);
                dynamicCoveredNumbers.add(ROULETTE_RACE_SEQUENCE[rightIndex]);
              }
            }
          });

          let dynamicHit = false;
          if (dynamicCoveredNumbers.has(resultVal)) {
            dynamicHit = true;
          }

          nonNumberBets.forEach(bet => {
            let entryRef = '';
            if (bet.type === 'dozen' || bet.type === 'column') {
              entryRef = (bet.type === 'dozen' ? 'Dúzia ' : 'Coluna ') + bet.target;
            } else if (bet.type === 'color') {
              entryRef = bet.target === 'red' ? 'Red' : 'Black';
            } else if (bet.type === 'even_chance') {
              entryRef = bet.target.charAt(0).toUpperCase() + bet.target.slice(1);
            } else if (bet.type === 'multi') {
              entryRef = JSON.stringify(bet.target);
            }
            if (entryRef && checkWin(resultVal, entryRef)) {
              dynamicHit = true;
            }
          });

          if (dynamicHit) {
            dynamicWins++;
          }
        }

        const staticWinRate = totalRounds > 0 ? (staticWins / totalRounds) * 100 : 0;
        const dynamicWinRate = totalRounds > 0 ? (dynamicWins / totalRounds) * 100 : 0;
        const difference = dynamicWinRate - staticWinRate;

        setBacktestResult({
          totalRounds,
          staticWins,
          dynamicWins,
          staticWinRate,
          dynamicWinRate,
          difference,
          analyzedCenters: centers
        });
      } catch (err) {
        console.error("Erro no backtest de auto-adjust:", err);
      } finally {
        setIsBacktesting(false);
      }
    }, 600);
  };

  const dynamicNeighborsMap = useMemo(() => {
    const map = new Map<number, { count: number; msg: string }>();
    const recentSpins = rouletteHistory.slice(0, 100);
    const N = recentSpins.length;

    for (let num = 0; num <= 36; num++) {
      if (!autoAdjustNeighbors) {
        map.set(num, { count: neighborCount, msg: '' });
        continue;
      }

      const index = ROULETTE_RACE_SEQUENCE.indexOf(num);
      if (index === -1) {
        map.set(num, { count: neighborCount, msg: '' });
        continue;
      }

      const sectorNumbers = new Set<number>();
      for (let i = -3; i <= 3; i++) {
        const idx = (index + i + 37) % 37;
        sectorNumbers.add(ROULETTE_RACE_SEQUENCE[idx]);
      }

      if (N < 5) {
        map.set(num, { count: 2, msg: 'Sem dados suficientes (Padrão: ±2)' });
        continue;
      }

      let weightedHitsSum = 0;
      let totalWeight = 0;
      const hitIndices: number[] = [];

      recentSpins.forEach((spin, spinIdx) => {
        const val = typeof spin.result === 'number' ? spin.result : Number(spin.result);
        const weight = N - spinIdx;

        const isHit = !isNaN(val) && sectorNumbers.has(val);
        if (isHit) {
          weightedHitsSum += weight;
          hitIndices.push(spinIdx);
        }
        totalWeight += weight;
      });

      const weightedFreq = weightedHitsSum / totalWeight;

      let volatility = 0.5;
      if (hitIndices.length >= 2) {
        const gaps: { val: number; weight: number }[] = [];
        for (let j = 0; j < hitIndices.length - 1; j++) {
          const avgIndex = (hitIndices[j] + hitIndices[j + 1]) / 2;
          const weight = N - avgIndex;
          gaps.push({ val: hitIndices[j + 1] - hitIndices[j], weight });
        }

        const sumWeights = gaps.reduce((acc, g) => acc + g.weight, 0);
        const weightedMeanGap = gaps.reduce((acc, g) => acc + g.val * g.weight, 0) / (sumWeights || 1);
        const weightedVariance = gaps.reduce((acc, g) => acc + Math.pow(g.val - weightedMeanGap, 2) * g.weight, 0) / (sumWeights || 1);

        volatility = Math.min(1, Math.max(0, Math.sqrt(weightedVariance) / 10));
      } else if (hitIndices.length === 1) {
        volatility = 0.8;
      } else {
        volatility = 0.1;
      }

      let calculatedCoverage = 2;
      let msg = '';

      if (weightedFreq <= 0.05) {
        calculatedCoverage = 5;
        msg = `Setor Alvo Frio WMA (${(weightedFreq * 100).toFixed(1)}% Hits) → Cobertura Ampliada (±5 Vizinhos)`;
      } else if (volatility > 0.6) {
        calculatedCoverage = 1;
        msg = `Alta Volatilidade WMA (${(volatility * 100).toFixed(0)}%) → Cobertura Encolhida (±1 Vizinho)`;
      } else if (weightedFreq > 0.20) {
        calculatedCoverage = 3;
        msg = `Cluster Ativo WMA (${(weightedFreq * 100).toFixed(1)}% Hits) → Cobertura Padrão (±3 Vizinhos)`;
      } else {
        calculatedCoverage = 2;
        msg = `Setor Equilibrado WMA (Volatilidade: ${(volatility * 100).toFixed(0)}%, Hits: ${(weightedFreq * 100).toFixed(1)}%) → Cobertura Padrão (±2 Vizinhos)`;
      }

      map.set(num, { count: calculatedCoverage, msg });
    }
    return map;
  }, [rouletteHistory, neighborCount, autoAdjustNeighbors]);

  const forcedDynamicNeighborsMap = useMemo(() => {
    const map = new Map<number, { count: number; msg: string }>();
    const recentSpins = rouletteHistory.slice(0, 100);
    const N = recentSpins.length;

    for (let num = 0; num <= 36; num++) {
      const index = ROULETTE_RACE_SEQUENCE.indexOf(num);
      if (index === -1) {
        map.set(num, { count: neighborCount, msg: '' });
        continue;
      }

      const sectorNumbers = new Set<number>();
      for (let i = -3; i <= 3; i++) {
        const idx = (index + i + 37) % 37;
        sectorNumbers.add(ROULETTE_RACE_SEQUENCE[idx]);
      }

      if (N < 5) {
        map.set(num, { count: 2, msg: 'Sem dados suficientes (Padrão: ±2)' });
        continue;
      }

      let weightedHitsSum = 0;
      let totalWeight = 0;
      const hitIndices: number[] = [];

      recentSpins.forEach((spin, spinIdx) => {
        const val = typeof spin.result === 'number' ? spin.result : Number(spin.result);
        const weight = N - spinIdx;

        const isHit = !isNaN(val) && sectorNumbers.has(val);
        if (isHit) {
          weightedHitsSum += weight;
          hitIndices.push(spinIdx);
        }
        totalWeight += weight;
      });

      const weightedFreq = weightedHitsSum / totalWeight;

      let volatility = 0.5;
      if (hitIndices.length >= 2) {
        const gaps: { val: number; weight: number }[] = [];
        for (let j = 0; j < hitIndices.length - 1; j++) {
          const avgIndex = (hitIndices[j] + hitIndices[j + 1]) / 2;
          const weight = N - avgIndex;
          gaps.push({ val: hitIndices[j + 1] - hitIndices[j], weight });
        }

        const sumWeights = gaps.reduce((acc, g) => acc + g.weight, 0);
        const weightedMeanGap = gaps.reduce((acc, g) => acc + g.val * g.weight, 0) / (sumWeights || 1);
        const weightedVariance = gaps.reduce((acc, g) => acc + Math.pow(g.val - weightedMeanGap, 2) * g.weight, 0) / (sumWeights || 1);

        volatility = Math.min(1, Math.max(0, Math.sqrt(weightedVariance) / 10));
      } else if (hitIndices.length === 1) {
        volatility = 0.8;
      } else {
        volatility = 0.1;
      }

      let calculatedCoverage = 2;
      let msg = '';

      if (weightedFreq <= 0.05) {
        calculatedCoverage = 5;
        msg = `Setor Alvo Frio WMA (${(weightedFreq * 100).toFixed(1)}% Hits) → Cobertura Ampliada (±5 Vizinhos)`;
      } else if (volatility > 0.6) {
        calculatedCoverage = 1;
        msg = `Alta Volatilidade WMA (${(volatility * 100).toFixed(0)}%) → Cobertura Encolhida (±1 Vizinho)`;
      } else if (weightedFreq > 0.20) {
        calculatedCoverage = 3;
        msg = `Cluster Ativo WMA (${(weightedFreq * 100).toFixed(1)}% Hits) → Cobertura Padrão (±3 Vizinhos)`;
      } else {
        calculatedCoverage = 2;
        msg = `Setor Equilibrado WMA (Volatilidade: ${(volatility * 100).toFixed(0)}%, Hits: ${(weightedFreq * 100).toFixed(1)}%) → Cobertura Padrão (±2 Vizinhos)`;
      }

      map.set(num, { count: calculatedCoverage, msg });
    }
    return map;
  }, [rouletteHistory, neighborCount]);

  const getDynamicNeighbors = (num: number, forceAutoAdjust: boolean = false): { count: number; msg: string } => {
    if (forceAutoAdjust) {
      const cached = forcedDynamicNeighborsMap.get(num);
      if (cached) return cached;
    } else {
      const cached = dynamicNeighborsMap.get(num);
      if (cached) return cached;
    }
    if (!autoAdjustNeighbors && !forceAutoAdjust) return { count: neighborCount, msg: '' };
    
    const index = ROULETTE_RACE_SEQUENCE.indexOf(num);
    if (index === -1) return { count: neighborCount, msg: '' };
    
    // Sector definition: target number and 3 neighbors on each side (total 7 numbers)
    const sectorNumbers = new Set<number>();
    for (let i = -3; i <= 3; i++) {
      const idx = (index + i + 37) % 37;
      sectorNumbers.add(ROULETTE_RACE_SEQUENCE[idx]);
    }
    
    const recentSpins = rouletteHistory.slice(0, 100);
    if (recentSpins.length < 5) {
      return { count: 2, msg: 'Sem dados suficientes (Padrão: ±2)' };
    }
    
    // Calculate Weighted Moving Average (WMA) for Sector Hits (newest = highest weight)
    const N = recentSpins.length;
    let weightedHitsSum = 0;
    let totalWeight = 0;
    const hitIndices: number[] = [];
    
    recentSpins.forEach((spin, spinIdx) => {
      const val = typeof spin.result === 'number' ? spin.result : Number(spin.result);
      // Recency weight: newest spin has weight N, oldest has weight 1
      const weight = N - spinIdx;
      
      const isHit = !isNaN(val) && sectorNumbers.has(val);
      if (isHit) {
        weightedHitsSum += weight;
        hitIndices.push(spinIdx);
      }
      totalWeight += weight;
    });

    // Weighted hit frequency
    const weightedFreq = weightedHitsSum / totalWeight;
    
    // Weighted standard volatility calculated across last 100 spins
    let volatility = 0.5;
    if (hitIndices.length >= 2) {
      const gaps: { val: number; weight: number }[] = [];
      for (let j = 0; j < hitIndices.length - 1; j++) {
        // Average index to model recency of gap
        const avgIndex = (hitIndices[j] + hitIndices[j + 1]) / 2;
        const weight = N - avgIndex;
        gaps.push({ val: hitIndices[j + 1] - hitIndices[j], weight });
      }
      
      const sumWeights = gaps.reduce((acc, g) => acc + g.weight, 0);
      const weightedMeanGap = gaps.reduce((acc, g) => acc + g.val * g.weight, 0) / (sumWeights || 1);
      const weightedVariance = gaps.reduce((acc, g) => acc + Math.pow(g.val - weightedMeanGap, 2) * g.weight, 0) / (sumWeights || 1);
      
      volatility = Math.min(1, Math.max(0, Math.sqrt(weightedVariance) / 10));
    } else if (hitIndices.length === 1) {
      volatility = 0.8;
    } else {
      volatility = 0.1;
    }

    let calculatedCoverage = 2;
    let msg = '';
    
    // Standard expected frequency of 7 numbers on 37-slot layout is ~18.9%
    // Smooth threshold mappings using WMA:
    if (weightedFreq <= 0.05) {
      calculatedCoverage = 5;
      msg = `Setor Alvo Frio WMA (${(weightedFreq * 100).toFixed(1)}% Hits) → Cobertura Ampliada (±5 Vizinhos)`;
    } else if (volatility > 0.6) {
      calculatedCoverage = 1;
      msg = `Alta Volatilidade WMA (${(volatility * 100).toFixed(0)}%) → Cobertura Encolhida (±1 Vizinho)`;
    } else if (weightedFreq > 0.20) {
      calculatedCoverage = 3;
      msg = `Cluster Ativo WMA (${(weightedFreq * 100).toFixed(1)}% Hits) → Cobertura Padrão (±3 Vizinhos)`;
    } else {
      calculatedCoverage = 2;
      msg = `Setor Equilibrado WMA (Volatilidade: ${(volatility * 100).toFixed(0)}%, Hits: ${(weightedFreq * 100).toFixed(1)}%) → Cobertura Padrão (±2 Vizinhos)`;
    }
    
    return { count: calculatedCoverage, msg };
  };

  const getVolatilityStats = () => {
    const recentSpins = rouletteHistory.slice(0, 100);
    if (recentSpins.length < 5) {
      return { volatility: 0.3, label: 'Aguardando', color: 'text-[#c6a34f]', barColor: 'bg-[#c6a34f]/50', percent: 30, text: 'Aguardando mais spins (mínimo de 5 giros) para calibrar a volatilidade do setor.', lastNum: 'N/A', weightedFreq: '0.0' };
    }
    
    const lastNum = typeof recentSpins[0].result === 'number' 
      ? recentSpins[0].result 
      : Number(recentSpins[0].result) || 0;
      
    const index = ROULETTE_RACE_SEQUENCE.indexOf(lastNum);
    if (index === -1) {
      return { volatility: 0.3, label: 'Média', color: 'text-stone-400', barColor: 'bg-stone-550', percent: 30, text: 'Calibrando com base no setor ativo...', lastNum, weightedFreq: '0.0' };
    }
    
    const sectorNumbers = new Set<number>();
    for (let i = -3; i <= 3; i++) {
      const idx = (index + i + 37) % 37;
      sectorNumbers.add(ROULETTE_RACE_SEQUENCE[idx]);
    }
    
    const N = recentSpins.length;
    let weightedHitsSum = 0;
    let totalWeight = 0;
    const hitIndices: number[] = [];
    
    recentSpins.forEach((spin, spinIdx) => {
      const val = typeof spin.result === 'number' ? spin.result : Number(spin.result);
      const weight = N - spinIdx;
      
      const isHit = !isNaN(val) && sectorNumbers.has(val);
      if (isHit) {
        weightedHitsSum += weight;
        hitIndices.push(spinIdx);
      }
      totalWeight += weight;
    });

    const weightedFreq = weightedHitsSum / (totalWeight || 1);
    
    let volatility = 0.5;
    if (hitIndices.length >= 2) {
      const gaps: { val: number; weight: number }[] = [];
      for (let j = 0; j < hitIndices.length - 1; j++) {
        const avgIndex = (hitIndices[j] + hitIndices[j + 1]) / 2;
        const weight = N - avgIndex;
        gaps.push({ val: hitIndices[j + 1] - hitIndices[j], weight });
      }
      
      const sumWeights = gaps.reduce((acc, g) => acc + g.weight, 0);
      const weightedMeanGap = gaps.reduce((acc, g) => acc + g.val * g.weight, 0) / (sumWeights || 1);
      const weightedVariance = gaps.reduce((acc, g) => acc + Math.pow(g.val - weightedMeanGap, 2) * g.weight, 0) / (sumWeights || 1);
      
      volatility = Math.min(1, Math.max(0, Math.sqrt(weightedVariance) / 10));
    } else if (hitIndices.length === 1) {
      volatility = 0.8;
    } else {
      volatility = 0.1;
    }

    let label = 'Média';
    let color = 'text-amber-400';
    let barColor = 'bg-amber-400';
    let text = 'Setor operando dentro da normalidade estatística. Cobertura de ±2 vizinhos ativa.';
    
    if (volatility <= 0.25) {
      label = 'Baixa';
      color = 'text-green-400';
      barColor = 'bg-green-500';
      text = 'Ritmo altamente estável. O setor foi atingido de forma homogênea ou os gaps são curtos.';
    } else if (volatility > 0.25 && volatility <= 0.45) {
      label = 'Média';
      color = 'text-amber-400';
      barColor = 'bg-amber-400';
      text = 'Setor operando dentro da normalidade estatística. Cobertura de ±2 vizinhos ativa.';
    } else if (volatility > 0.45 && volatility <= 0.60) {
      label = 'Alta';
      color = 'text-orange-400';
      barColor = 'bg-orange-400';
      text = 'Forte instabilidade com saltos amplos. Redução recomendada na abrangência para conter dispersão.';
    } else if (volatility > 0.60) {
      label = 'Extrema';
      color = 'text-red-500';
      barColor = 'bg-red-550';
      text = 'Zonas de alto risco irracional. Cobertura restrita (±1 vizinho) para evitar perdas aceleradas.';
    }

    return {
      volatility,
      label,
      color,
      barColor,
      percent: Math.round(volatility * 100),
      text,
      lastNum,
      weightedFreq: (weightedFreq * 100).toFixed(1)
    };
  };

  const getTerminalAndNeighbors = (terminalIndex: number, kNeighbors: number) => {
    const centralTerminals = Array.from({ length: 37 }, (_, i) => i).filter(num => num % 10 === terminalIndex);
    const numbersSet = new Set<number>();
    
    // Always include the central terminals themselves
    centralTerminals.forEach(num => numbersSet.add(num));

    // For each central terminal, get kNeighbors left neighbors and kNeighbors right neighbors on the real wheel order
    centralTerminals.forEach(num => {
      const index = ROULETTE_RACE_SEQUENCE.indexOf(num);
      if (index !== -1) {
        for (let step = 1; step <= kNeighbors; step++) {
          // Left neighbors
          const leftIndex = (index - step + 37) % 37;
          numbersSet.add(ROULETTE_RACE_SEQUENCE[leftIndex]);
          
          // Right neighbors
          const rightIndex = (index + step) % 37;
          numbersSet.add(ROULETTE_RACE_SEQUENCE[rightIndex]);
        }
      }
    });

    return Array.from(numbersSet);
  };

  const applyTerminalPreset = (terminalId: number) => {
    let activeNeighborCount = neighborCount;
    if (autoAdjustNeighbors) {
      const centralTerminals = Array.from({ length: 37 }, (_, i) => i).filter(num => num % 10 === terminalId);
      let sum = 0;
      let msgs: string[] = [];
      let coldest = false;
      let hottest = false;
      centralTerminals.forEach(num => {
        const d = getDynamicNeighbors(num);
        sum += d.count;
        if (d.count === 5) coldest = true;
        if (d.count === 1) hottest = true;
        if (d.msg) {
          msgs.push(`${num}: ${d.count}v`);
        }
      });
      activeNeighborCount = Math.round(sum / centralTerminals.length);
      setLastAutoAdjustMsg(`Terminal ${terminalId} auto-ajustado: ±${activeNeighborCount}v (${msgs.slice(0, 2).join(', ')})`);

      const logTrigger = coldest ? "Setor Alvo Frio" : (hottest ? "Alta Volatilidade" : "Setor Equilibrado");
      const timestamp = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const newLog: AutoAdjustLog = {
        id: `${Date.now()}-${Math.random()}`,
        time: timestamp,
        description: `Terminal ${terminalId}`,
        oldVal: neighborCount,
        newVal: activeNeighborCount,
        trigger: logTrigger
      };
      setAutoAdjustLogs(prev => [newLog, ...prev.slice(0, 19)]);
    }

    const numbersToCover = getTerminalAndNeighbors(terminalId, activeNeighborCount);
    
    if (!name || name.trim() === '' || name.toLowerCase().includes('estratégia sem nome') || name === 'Nova Estratégia' || name === strategy.name) {
      setName(`Racetrack Terminal ${terminalId} (±${activeNeighborCount} viz)`);
    }

    pushToHistory();
    const newBets = cloneBets(bets);
    numbersToCover.forEach(num => {
      const existingIndex = newBets.findIndex(b => b.target === num && b.type === 'number');
      if (existingIndex === -1) {
        newBets.push({ target: num, amount: selectedChip, type: 'number' });
      } else {
        newBets[existingIndex].amount += selectedChip;
        newBets[existingIndex].amount = Number(newBets[existingIndex].amount.toFixed(2));
      }
    });
    setBets(newBets);
  };

  const handleRaceClick = (num: number) => {
    pushToHistory();
    let numbersToCover = [num];
    if (applyNeighborsOnClick) {
      const dynamicResult = getDynamicNeighbors(num);
      const activeNeighbors = dynamicResult.count;
      
      if (autoAdjustNeighbors && dynamicResult.msg) {
        setLastAutoAdjustMsg(dynamicResult.msg);

        let logTrigger = "Setor Equilibrado";
        if (activeNeighbors === 5) logTrigger = "Setor Alvo Frio";
        else if (activeNeighbors === 1) logTrigger = "Alta Volatilidade";
        else if (activeNeighbors === 3) logTrigger = "Cluster Ativo";

        const timestamp = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const newLog: AutoAdjustLog = {
          id: `${Date.now()}-${Math.random()}`,
          time: timestamp,
          description: `Número ${num}`,
          oldVal: neighborCount,
          newVal: activeNeighbors,
          trigger: logTrigger
        };
        setAutoAdjustLogs(prev => [newLog, ...prev.slice(0, 19)]);
      }
      
      if (activeNeighbors > 0) {
        const index = ROULETTE_RACE_SEQUENCE.indexOf(num);
        if (index !== -1) {
          const numbersSet = new Set<number>([num]);
          for (let step = 1; step <= activeNeighbors; step++) {
            const leftIndex = (index - step + 37) % 37;
            const rightIndex = (index + step) % 37;
            numbersSet.add(ROULETTE_RACE_SEQUENCE[leftIndex]);
            numbersSet.add(ROULETTE_RACE_SEQUENCE[rightIndex]);
          }
          numbersToCover = Array.from(numbersSet);
        }
      }
    }

    const newBets = cloneBets(bets);
    numbersToCover.forEach(n => {
      const existingIndex = newBets.findIndex(b => b.target === n && b.type === 'number');
      if (existingIndex > -1) {
        newBets[existingIndex].amount += selectedChip;
        newBets[existingIndex].amount = Number(newBets[existingIndex].amount.toFixed(2));
      } else {
        newBets.push({ target: n, amount: selectedChip, type: 'number' });
      }
    });
    setBets(newBets);
  };

  const totalBet = useMemo(() => bets.reduce((acc, b) => acc + b.amount, 0), [bets]);

  const handleToggleBet = (target: any, type: string) => {
    pushToHistory(); // Keep last 50 steps
    const existingIndex = bets.findIndex(b => {
      if (Array.isArray(target) && Array.isArray(b.target)) {
        return target.length === b.target.length && target.every(v => b.target.includes(v));
      }
      return b.target === target && b.type === type;
    });

    if (existingIndex > -1) {
      const newBets = cloneBets(bets);
      newBets[existingIndex].amount += selectedChip;
      newBets[existingIndex].amount = Number(newBets[existingIndex].amount.toFixed(2));
      setBets(newBets);
    } else {
      setBets([...bets, { target, amount: selectedChip, type }]);
    }
  };

  const handleToggleBaccaratCell = (r: number, c: number) => {
    pushToHistory();
    const existingIndex = baccaratPattern.findIndex(p => p.r === r && p.c === c);
    const types: ('P'|'B'|'T'|'?')[] = ['P', 'B', 'T', '?'];
    
    if (existingIndex > -1) {
      const currentType = baccaratPattern[existingIndex].type;
      const nextIdx = types.indexOf(currentType as any) + 1;
      
      if (nextIdx >= types.length) {
        setBaccaratPattern(baccaratPattern.filter((_, i) => i !== existingIndex));
      } else {
        const newPattern = cloneBaccaratPattern(baccaratPattern);
        newPattern[existingIndex] = { r, c, type: types[nextIdx] };
        setBaccaratPattern(newPattern);
      }
    } else {
      setBaccaratPattern([...baccaratPattern, { r, c, type: 'P' }]);
    }
  };

  const baccaratAssertiveness = useMemo(() => {
    if (gameType !== GameType.BACCARAT || baccaratPattern.length === 0) return null;
    const signalCell = baccaratPattern.find(p => p.type === '?');
    const otherCells = baccaratPattern.filter(p => p.type !== '?');
    if (!signalCell || otherCells.length === 0) return null;

    // Simplified assertiveness check
    const chrono = [...baccaratHistory].reverse();
    const grid: Record<string, string> = {};
    chrono.forEach((h, i) => {
      const row = i % 6;
      const col = Math.floor(i / 6);
      grid[`${row},${col}`] = h.result;
    });

    const outcomes = { P: 0, B: 0, T: 0 };
    let matchesFound = 0;

    // Anchor on last non-signal cell to find occurrences in history
    const anchorCell = otherCells[otherCells.length - 1];
    
    for (let i = 0; i < chrono.length; i++) {
        const curR = i % 6;
        const curC = Math.floor(i / 6);
        
        const offR = curR - anchorCell.r;
        const offC = curC - anchorCell.c;
        
        const matches = otherCells.every(p => grid[`${p.r + offR},${p.c + offC}`] === p.type);
        if (matches) {
            const nextVal = grid[`${signalCell.r + offR},${signalCell.c + offC}`];
            if (nextVal) {
                if (nextVal === 'PLAYER') outcomes.P++;
                else if (nextVal === 'BANKER') outcomes.B++;
                else if (nextVal === 'TIE') outcomes.T++;
                matchesFound++;
            }
        }
    }

    if (matchesFound === 0) return null;

    const best = (outcomes.P >= outcomes.B && outcomes.P >= outcomes.T) ? { type: 'P', name: 'PLAYER', rate: (outcomes.P / matchesFound) * 100 } :
                 (outcomes.B >= outcomes.P && outcomes.B >= outcomes.T) ? { type: 'B', name: 'BANKER', rate: (outcomes.B / matchesFound) * 100 } :
                 { type: 'T', name: 'TIE', rate: (outcomes.T / matchesFound) * 100 };

    return { ...best, matches: matchesFound, outcomes };
  }, [baccaratPattern, baccaratHistory, gameType]);

  const renderBaccaratPatternBuilder = () => {
    return (
      <div className="flex flex-col items-center gap-6 py-6 w-full">
        <div className="bg-[#111111] p-8 rounded-3xl border border-white/5 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-[#c6a34f] flex items-center gap-2">
              <LayoutIcon size={16} /> Montador de Padrões
            </h3>
            <div className="flex items-center gap-4 text-[9px] uppercase font-bold text-white/40">
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-600" /> P</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-600" /> B</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-600" /> T</div>
              <div className="flex items-center gap-1"><div className="w-4 h-4 flex items-center justify-center font-black text-black bg-white rounded-full">?</div> Entrada</div>
            </div>
          </div>
          
          <div className="grid grid-cols-10 gap-2">
            {Array.from({ length: 6 }).map((_, r) => (
              Array.from({ length: 10 }).map((_, c) => {
                const cell = baccaratPattern.find(p => p.r === r && p.c === c);
                const isSignal = cell?.type.startsWith('?');
                const signalValue = isSignal ? cell?.type.substring(1) : null;

                return (
                  <button
                    key={`${r}-${c}`}
                    onClick={() => handleToggleBaccaratCell(r, c)}
                    className={`w-10 h-10 rounded-xl border transition-all flex items-center justify-center relative group ${
                      cell 
                        ? {
                            'P': 'bg-blue-600 border-white text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]',
                            'B': 'bg-red-600 border-white text-white shadow-[0_0_15px_rgba(220,38,38,0.4)]',
                            'T': 'bg-green-600 border-white text-white shadow-[0_0_15px_rgba(22,163,74,0.4)]',
                            '?': 'bg-white text-black border-white font-black animate-pulse scale-110 shadow-[0_0_20px_white]'
                          }[cell.type as 'P'|'B'|'T'|'?']
                        : 'bg-white/5 border-white/10 hover:border-white/30'
                    }`}
                  >
                    {cell?.type}
                    <div className="absolute inset-0 rounded-xl bg-white/0 group-hover:bg-white/10" />
                  </button>
                );
              })
            ))}
          </div>
          
          {baccaratAssertiveness && (
            <div className="mt-8 bg-black/40 p-6 rounded-2xl border border-[#c6a34f]/20">
               <div className="flex justify-between items-center mb-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#c6a34f]">Análise de Assertividade Dinâmica</h4>
                  <span className="text-[9px] text-white/40 uppercase font-mono">Baseado em {baccaratAssertiveness.matches} ocorrências</span>
               </div>
               <div className="flex items-center gap-6">
                  <div className="flex flex-col">
                     <span className="text-[8px] uppercase text-white/30 font-bold mb-1">Entrada Sugerida</span>
                     <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${
                          baccaratAssertiveness.type === 'P' ? 'bg-blue-600 text-white' :
                          baccaratAssertiveness.type === 'B' ? 'bg-red-600 text-white' :
                          'bg-green-600 text-white'
                        }`}>
                           {baccaratAssertiveness.type}
                        </div>
                        <span className="text-lg font-black text-white">{baccaratAssertiveness.name}</span>
                     </div>
                  </div>
                  <div className="h-10 w-px bg-white/5" />
                  <div className="flex flex-col">
                     <span className="text-[8px] uppercase text-white/30 font-bold mb-1">Assertividade Real</span>
                     <span className={`text-2xl font-black ${baccaratAssertiveness.rate > 80 ? 'text-green-500' : 'text-yellow-500'}`}>
                        {baccaratAssertiveness.rate.toFixed(1)}%
                     </span>
                  </div>
               </div>
            </div>
          )}

          <div className="mt-8 p-4 rounded-2xl bg-white/5 border border-white/5">
             <div className="flex items-center gap-2 text-[10px] text-white/40 mb-2">
                <RotateCcw size={14} />
                <span className="uppercase font-bold tracking-widest">Configuração do Motor Integrado</span>
             </div>
             <p className="text-[9px] text-white/30 leading-relaxed italic">
               Desenhe o padrão. O sinal <span className="text-white font-bold text-xs">?</span> é adaptativo: o sistema buscará no histórico qual resultado (<span className="text-blue-400">P</span>, <span className="text-red-400">B</span> ou <span className="text-green-400">T</span>) é o mais assertivo para finalizar este padrão.
               <br/><br/>
               <span className="text-yellow-500/60 font-bold">RECOMENDAÇÃO:</span> Insira no mínimo <span className="text-yellow-500 font-black">210 resultados</span> no histórico antes de operar padrões complexos para garantir dados estatísticos sólidos.
             </p>
          </div>
        </div>
      </div>
    );
  };

  const getBetAmount = (target: any, type: string) => {
    return bets.find(b => {
      if (Array.isArray(target) && Array.isArray(b.target)) {
        return target.length === b.target.length && target.every(v => b.target.includes(v));
      }
      return b.target === target && b.type === type;
    })?.amount || 0;
  };

  const calculatePayout = (num: number) => {
    let win = 0;
    bets.forEach(bet => {
      // Straight Number
      if (bet.type === 'number' && bet.target === num) {
        win += bet.amount * 36;
      }
      
      // Multi-number bets (Split, Street, Corner, Line)
      if (bet.type === 'multi' && Array.isArray(bet.target) && bet.target.includes(num)) {
        const multipliers: Record<number, number> = {
          2: 18, // Split
          3: 12, // Street
          4: 9,  // Corner
          6: 6   // Line
        };
        const multiplier = multipliers[bet.target.length];
        if (multiplier) win += bet.amount * multiplier;
      }

      // Outside bets lose on Zero
      if (num === 0) return;

      // Color
      if (bet.type === 'color') {
        const isRed = COLOR_MAP.ROULETTE.RED.includes(num);
        if (bet.target === 'red' && isRed) win += bet.amount * 2;
        if (bet.target === 'black' && !isRed) win += bet.amount * 2;
      }

      // Dozens
      if (bet.type === 'dozen') {
        if (bet.target === 1 && num >= 1 && num <= 12) win += bet.amount * 3;
        if (bet.target === 2 && num >= 13 && num <= 24) win += bet.amount * 3;
        if (bet.target === 3 && num >= 25 && num <= 36) win += bet.amount * 3;
      }

      // Columns
      if (bet.type === 'column') {
        if (bet.target === 1 && num % 3 === 1) win += bet.amount * 3;
        if (bet.target === 2 && num % 3 === 2) win += bet.amount * 3;
        if (bet.target === 3 && num % 3 === 0) win += bet.amount * 3;
      }

      // High/Low & Parity
      if (bet.type === 'even_chance') {
        if (bet.target === 'low' && num >= 1 && num <= 18) win += bet.amount * 2;
        if (bet.target === 'high' && num >= 19 && num <= 36) win += bet.amount * 2;
        if (bet.target === 'even' && num % 2 === 0) win += bet.amount * 2;
        if (bet.target === 'odd' && num % 2 !== 0) win += bet.amount * 2;
      }
    });
    return win - totalBet;
  };

  const calculatePayoutRange = () => {
    const payouts = Array.from({ length: 37 }, (_, i) => calculatePayout(i));
    const min = Math.min(...payouts);
    const max = Math.max(...payouts);
    const winners = payouts.filter(p => p > 0).length;
    return { min, max, winners, payouts };
  };

  const stats = calculatePayoutRange();

  const liveSimulation = useMemo(() => {
    if (gameType === GameType.ROULETTE) {
      if (!rouletteHistory || rouletteHistory.length === 0) return null;
      const historyList = rouletteHistory.slice(0, 100);
      const totalSpins = historyList.length;
      if (totalSpins === 0) return null;

      let g0Wins = 0;
      let g1Wins = 0;
      let g2Wins = 0;
      let totalWins = 0;
      let currentGale = 0;
      let totalProfitUnits = 0;
      let maxLossStreak = 0;
      let currentLossStreak = 0;

      for (let i = historyList.length - 1; i >= 0; i--) {
        const spin = historyList[i];
        const num = typeof spin.result === 'number' ? spin.result : Number(spin.result);
        if (isNaN(num)) continue;

        const profit = calculatePayout(num);
        const isWin = profit > 0;

        if (isWin) {
          if (currentGale === 0) g0Wins++;
          else if (currentGale === 1) g1Wins++;
          else if (currentGale === 2) g2Wins++;
          totalWins++;
          
          let betMult = 1;
          if (progressionMode === ManagementMode.MARTINGALE) {
            betMult = Math.pow(progressionMultiplier || 2, currentGale);
          } else if (progressionMode === ManagementMode.FIBONACCI) {
            const fibs = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55];
            betMult = fibs[Math.min(currentGale, fibs.length - 1)];
          } else if (progressionMode === ManagementMode.D_ALEMBERT) {
            betMult = 1 + currentGale;
          }
          
          totalProfitUnits += profit * betMult;
          currentGale = 0;
          currentLossStreak = 0;
        } else {
          let betMult = 1;
          if (progressionMode === ManagementMode.MARTINGALE) {
            betMult = Math.pow(progressionMultiplier || 2, currentGale);
          }
          totalProfitUnits -= (totalBet || 1) * betMult;
          currentLossStreak++;
          if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;

          if (currentGale < maxGale) {
            currentGale++;
          } else {
            currentGale = 0;
          }
        }
      }

      const winRate = totalSpins > 0 ? (totalWins / totalSpins) * 100 : 0;
      const g0Rate = totalSpins > 0 ? (g0Wins / totalSpins) * 100 : 0;
      const g1Rate = totalSpins > 0 ? (g1Wins / totalSpins) * 100 : 0;
      const g2Rate = totalSpins > 0 ? (g2Wins / totalSpins) * 100 : 0;

      return {
        totalSpins,
        totalWins,
        winRate,
        g0Wins,
        g0Rate,
        g1Wins,
        g1Rate,
        g2Wins,
        g2Rate,
        totalProfitUnits,
        maxLossStreak
      };
    }
    return null;
  }, [bets, rouletteHistory, gameType, totalBet, maxGale, progressionMode, progressionMultiplier]);

  const getResultType = (num: number) => {
    const profit = calculatePayout(num);
    const payout = profit + totalBet;
    
    if (totalBet === 0) return 'none';
    if (profit === stats.max && stats.max > 0) return 'jackpot';
    if (profit > 0) return 'profit';
    if (profit === 0) return 'tie';
    if (payout > 0 && profit < 0) return 'partial';
    return 'loss';
  };

  const renderRouletteGrid = () => {
    const rows = [
      [1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12],
      [13, 14, 15], [16, 17, 18], [19, 20, 21], [22, 23, 24],
      [25, 26, 27], [28, 29, 30], [31, 32, 33], [34, 35, 36]
    ];

    const BetSpot = ({ target, type, className, style }: { target: any, type: string, className: string, style?: React.CSSProperties }) => {
      const amount = getBetAmount(target, type);
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleToggleBet(target, type);
          }}
          style={style}
          className={`absolute flex items-center justify-center transition-all z-40 group hover:z-50 ${className} ${amount > 0 ? '' : 'hover:bg-white/5'}`}
        >
          {amount > 0 && (
            <div className="w-8 h-8 rounded-full bg-white text-black font-black text-[12px] flex items-center justify-center border-2 border-[#c6a34f] shadow-lg pointer-events-none">
               {amount >= 1 ? amount.toFixed(0) : amount.toFixed(1)}
            </div>
          )}
        </button>
      );
    };

    return (
      <AutoScale baseWidth={720}>
        <div className="flex items-start justify-center gap-6 py-6">
          {/* Row 1: Outside Side Bets */}
          <div className="flex flex-col gap-1 mt-[66px]">
            {[
              { label: '1-18', target: 'low', type: 'even_chance' },
              { label: 'EVEN', target: 'even', type: 'even_chance' },
              { label: <div className="w-6 h-6 rounded-full bg-red-600 border border-white/20" />, target: 'red', type: 'color' },
              { label: <div className="w-6 h-6 rounded-full bg-black border border-white/20" />, target: 'black', type: 'color' },
              { label: 'ODD', target: 'odd', type: 'even_chance' },
              { label: '19-36', target: 'high', type: 'even_chance' },
            ].map((b, i) => (
              <button
                key={i}
                onClick={() => handleToggleBet(b.target, b.type)}
                className={`w-16 h-[100px] rounded-xl border transition-all flex items-center justify-center font-black text-xs relative ${
                  getBetAmount(b.target, b.type) > 0 ? 'bg-[#c6a34f] border-white text-black shadow-lg z-10' : 'bg-white/5 border-white/10 text-white/40'
                }`}
              >
                <div className="-rotate-90 whitespace-nowrap uppercase tracking-wider">{b.label}</div>
                <SmallChip amount={getBetAmount(b.target, b.type)} />
              </button>
            ))}
          </div>

          {/* Row 2: Dozens */}
          <div className="flex flex-col gap-1 mt-[66px]">
            {[1, 2, 3].map(d => (
              <button
                key={d}
                onClick={() => handleToggleBet(d, 'dozen')}
                className={`w-16 h-[204px] rounded-xl border transition-all flex items-center justify-center font-black text-xs relative ${
                  getBetAmount(d, 'dozen') > 0 ? 'bg-[#c6a34f] border-white text-black shadow-lg z-10' : 'bg-white/5 border-white/10 text-white/40'
                }`}
              >
                <div className="-rotate-90 whitespace-nowrap uppercase tracking-wider">
                  {{1: '1ST 12', 2: '2ND 12', 3: '3RD 12'}[d as 1|2|3]}
                </div>
                <SmallChip amount={getBetAmount(d, 'dozen')} />
              </button>
            ))}
          </div>

          {/* Row 3: Main Grid */}
          <div className="flex flex-col gap-1">
            {/* Zero */}
            <div className="relative">
               {(() => {
                 const amount = getBetAmount(0, 'number');
                 const profit = calculatePayout(0);
                 const type = getResultType(0);
                 const payout = profit + totalBet;
                 const typeStyles = {
                   jackpot: 'bg-gradient-to-br from-[#c6a34f] via-[#ffd700] to-[#b8953f] border-amber-300 text-black shadow-[0_0_25px_rgba(198,163,79,0.8)] z-10 font-black ring-2 ring-amber-300',
                   profit: 'bg-emerald-600 border-emerald-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)] z-10 ring-1 ring-emerald-300',
                   tie: 'bg-zinc-800 border-zinc-650 text-zinc-300 shadow-[0_0_10px_rgba(255,255,255,0.05)] z-10 ring-1 ring-zinc-500',
                   partial: 'bg-gradient-to-br from-red-900/95 to-red-800/80 border-red-500/85 text-white shadow-[0_0_10px_rgba(239,68,68,0.3)] z-10',
                   loss: 'bg-green-600 border-white/10 text-white opacity-45',
                   none: 'bg-green-900/40 border-green-500/20 text-green-500'
                 }[type];

                 return (
                   <button
                     onClick={() => handleToggleBet(0, 'number')}
                     className={`w-[200px] h-14 flex flex-col items-center justify-center rounded-t-[40px] border-2 transition-all relative ${
                       amount > 0 && type !== 'jackpot' ? 'ring-2 ring-white z-10' : 'hover:brightness-125'
                     } ${typeStyles}`}
                   >
                     <span className="text-lg font-black">0</span>
                     <SmallChip amount={amount} />
                     {totalBet > 0 && payout > 0 && (
                       <div className={`absolute -bottom-2 inset-x-12 px-1.5 py-0.5 rounded-md text-[9px] font-black shadow-lg z-20 border border-white/10 ${
                         type === 'jackpot' ? 'bg-[#c6a34f] text-black border-amber-300' :
                         type === 'profit' ? 'bg-emerald-600 text-white border-emerald-400' :
                         type === 'tie' ? 'bg-zinc-700 text-zinc-100 border-zinc-500' :
                         'bg-red-650 text-white border-red-500'
                       }`}>
                         {profit > 0 ? `+${profit.toFixed(1)} U` : profit === 0 ? '0.0 U' : `${profit.toFixed(1)} U`}
                       </div>
                     )}
                   </button>
                 );
               })()}
              {/* Split between 0 and first row [1,2,3] */}
              <div className="absolute -bottom-2 inset-x-0 h-4 flex justify-around pointer-events-none z-50">
                 {[1, 2, 3].map(n => (
                    <button
                      key={n}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleBet([0, n], 'multi');
                      }}
                      className="w-10 h-4 pointer-events-auto bg-transparent hover:bg-white/10 transition-all flex items-center justify-center"
                    >
                      {getBetAmount([0, n], 'multi') > 0 && (
                        <div className="w-5 h-5 rounded-full bg-white border border-[#c6a34f] flex items-center justify-center text-[8px] font-black text-black">
                           {getBetAmount([0, n], 'multi')}
                        </div>
                      )}
                    </button>
                 ))}
              </div>
            </div>

            {/* Numbers Grid */}
            <div className="relative">
              <div className="grid grid-cols-3 gap-1 relative bg-black/10 p-1 rounded-sm">
                {rows.map((row, rIdx) => (
                  <React.Fragment key={rIdx}>
                     {/* Street Bet (Rua) */}
                     <div className="absolute -left-10 h-10 flex items-center" style={{ top: `${rIdx * 52 + 6}px` }}>
                        <BetSpot target={row} type="multi" className="w-8 h-8 rounded-full border border-white/10 bg-white/5" />
                     </div>
                     
                     {/* Line Bet (Linha) */}
                     {rIdx < rows.length - 1 && (
                       <div className="absolute -left-10 h-4 flex items-center" style={{ top: `${rIdx * 52 + 48}px` }}>
                          <BetSpot target={[...row, ...rows[rIdx+1]]} type="multi" className="w-8 h-4 rounded-full border border-white/10 bg-white/5" />
                       </div>
                     )}

                     {row.map((num, cIdx) => {
                        const amount = getBetAmount(num, 'number');
                        const isRed = COLOR_MAP.ROULETTE.RED.includes(num);
                        const profit = calculatePayout(num);
                        const type = getResultType(num);
                        const payout = profit + totalBet;
                        
                        const typeStyles = {
                          jackpot: 'bg-gradient-to-br from-[#c6a34f] via-[#ffd700] to-[#b8953f] border-amber-300 text-black shadow-[0_0_25px_rgba(198,163,79,0.8)] z-10 font-black ring-2 ring-amber-300',
                          profit: 'bg-emerald-600 border-emerald-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)] z-10 ring-1 ring-emerald-300',
                          tie: 'bg-zinc-800 border-zinc-650 text-zinc-300 shadow-[0_0_10px_rgba(255,255,255,0.05)] z-10 ring-1 ring-zinc-500',
                          partial: 'bg-gradient-to-br from-red-900/95 to-red-800/80 border-red-500/85 text-white shadow-[0_0_10px_rgba(239,68,68,0.3)] z-10',
                          loss: isRed ? 'bg-red-600 border-white/10 text-white opacity-45' : 'bg-zinc-900 border-white/10 text-white opacity-45',
                          none: isRed ? 'bg-red-600 border-white/10 text-white hover:bg-red-500' : 'bg-zinc-900 border-white/10 text-white hover:bg-zinc-850'
                        }[type];

                        return (
                          <div key={num} className="relative group/cell">
                            <button
                              onClick={() => handleToggleBet(num, 'number')}
                              className={`w-16 h-12 flex items-center justify-center rounded-lg border transition-all relative shadow-sm ${typeStyles} ${amount > 0 && type !== 'jackpot' ? 'ring-2 ring-white z-10' : 'hover:brightness-125'}`}
                            >
                              <span className="text-sm font-black">{num}</span>
                              <SmallChip amount={amount} />
                              {totalBet > 0 && payout > 0 && (
                                <div className={`absolute -bottom-2 -right-1 px-1.5 py-0.5 rounded-md text-[9px] font-black shadow-lg z-20 border border-white/10 ${
                                  type === 'jackpot' ? 'bg-[#c6a34f] text-black border-amber-300' :
                                  type === 'profit' ? 'bg-emerald-600 text-white border-emerald-400' :
                                  type === 'tie' ? 'bg-zinc-700 text-zinc-100 border-zinc-500' :
                                  'bg-red-650 text-white border-red-500'
                                }`}>
                                  {profit > 0 ? `+${profit.toFixed(1)} U` : profit === 0 ? '0.0 U' : `${profit.toFixed(1)} U`}
                                </div>
                              )}
                            </button>

                            {/* Split Horizontal (Dividida) */}
                            {cIdx < 2 && (
                              <BetSpot target={[num, row[cIdx+1]]} type="multi" className="absolute -right-[6px] top-1/2 -translate-y-1/2 w-4 h-8" />
                            )}

                            {/* Split Vertical (Dividida) */}
                            {rIdx < rows.length - 1 && (
                              <BetSpot target={[num, rows[rIdx+1][cIdx]]} type="multi" className="absolute -bottom-[6px] left-1/2 -translate-x-1/2 w-8 h-4" />
                            )}

                            {/* Corner (Canto) */}
                            {cIdx < 2 && rIdx < rows.length - 1 && (
                              <BetSpot target={[num, row[cIdx+1], rows[rIdx+1][cIdx], rows[rIdx+1][cIdx+1]]} type="multi" className="absolute -right-[6px] -bottom-[6px] w-5 h-5 rounded-full bg-white/5 border border-white/10 z-[60]" />
                            )}
                          </div>
                        );
                     })}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Columns */}
            <div className="grid grid-cols-3 gap-1 mt-1">
               {[1, 2, 3].map(colId => (
                 <button
                    key={colId}
                    onClick={() => handleToggleBet(colId, 'column')}
                    className={`h-11 rounded-b-xl border transition-all flex items-center justify-center font-black text-xs relative ${
                      getBetAmount(colId, 'column') > 0 ? 'bg-[#c6a34f] border-white text-black shadow-lg scale-105 z-10' : 'bg-white/5 border-white/10 text-white/40'
                    }`}
                 >
                    2 TO 1
                    <SmallChip amount={getBetAmount(colId, 'column')} />
                 </button>
               ))}
            </div>
          </div>
        </div>
      </AutoScale>
    );
  };

  const renderRace = () => {
    // Sequence from image (clockwise starting from left peak)
    const leftPeak = 23;
    const topRow = [10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3];
    const rightPeak = 26;
    const bottomRow = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8];
    const vStats = getVolatilityStats();

    const NumberCell = ({ num, className = '' }: { num: number, className?: string, key?: React.Key }) => {
      const amount = getBetAmount(num, 'number');
      const isRed = COLOR_MAP.ROULETTE.RED.includes(num);
      const profit = calculatePayout(num);
      const type = getResultType(num);
      const payout = profit + totalBet;
      
      const typeStyles = {
        jackpot: 'bg-gradient-to-br from-[#c6a34f] via-[#ffd700] to-[#b8953f] border-amber-300 text-black shadow-[0_0_25px_rgba(198,163,79,0.8)] z-20 font-black ring-2 ring-amber-300',
        profit: 'bg-emerald-600 border-emerald-400 text-white z-10 shadow-[0_0_15px_rgba(16,185,129,0.5)] ring-1 ring-emerald-300',
        tie: 'bg-zinc-800 border-zinc-650 text-zinc-300 shadow-[0_0_10px_rgba(255,255,255,0.05)] z-10 ring-1 ring-zinc-500',
        partial: 'bg-gradient-to-br from-red-900/95 to-red-800/80 border-red-500/85 text-white shadow-[0_0_10px_rgba(239,68,68,0.3)] z-10',
        loss: num === 0 ? 'bg-[#00a651] border-white/10 text-white opacity-45' : isRed ? 'bg-[#e30613] border-white/10 text-white opacity-45' : 'bg-[#1a1a1a] border-white/10 text-white/95 opacity-45',
        none: num === 0 ? 'bg-[#00a651] border-white/10 text-white hover:bg-[#00c862]' : isRed ? 'bg-[#e30613] border-white/10 text-white hover:bg-[#f51c2a]' : 'bg-[#1a1a1a] border-white/10 text-white/95 hover:bg-[#2a2a2a]'
      }[type];

      const isPeak = num === leftPeak || num === rightPeak;
      const width = isPeak ? '75px' : '48px';
      const height = isPeak ? '310px' : '75px';

      let isCoveredNeighbor = false;
      let isHoveredCenter = false;
      let isGhostExpanded = false;
      let isGhostReduced = false;

      if (hoveredNumber !== null) {
        if (hoveredNumber === num) {
          isHoveredCenter = true;
        } else {
          const hoveredIndex = ROULETTE_RACE_SEQUENCE.indexOf(hoveredNumber);
          const cellIndex = ROULETTE_RACE_SEQUENCE.indexOf(num);
          if (hoveredIndex !== -1 && cellIndex !== -1) {
            const activeNeighborsByHover = autoAdjustNeighbors 
              ? getDynamicNeighbors(hoveredNumber).count 
              : neighborCount;
            const projectedNeighborsByHover = getDynamicNeighbors(hoveredNumber, true).count;

            const diff = Math.abs(cellIndex - hoveredIndex);
            const distance = Math.min(diff, 37 - diff);
            
            if (distance > 0 && distance <= activeNeighborsByHover) {
              isCoveredNeighbor = true;
            }

            if (ghostCoverage) {
              if (distance > 0 && distance <= projectedNeighborsByHover && !isCoveredNeighbor) {
                isGhostExpanded = true;
              }
              if (distance > 0 && distance > projectedNeighborsByHover && isCoveredNeighbor) {
                isGhostReduced = true;
              }
            }
          }
        }
      }

      const highlightClass = isHoveredCenter
        ? '!ring-4 !ring-[#c6a34f] !z-30 shadow-[0_0_25px_rgba(198,163,79,0.9)] brightness-125'
        : isCoveredNeighbor
          ? '!ring-2 !ring-[#c6a34f]/90 !bg-[#c6a34f]/35 !border-[#c6a34f]/60 !text-white !z-25 shadow-[0_0_15px_rgba(198,163,79,0.65)] brightness-110'
          : '';

       return (
         <button
           onClick={() => handleRaceClick(num)}
           onMouseEnter={() => setHoveredNumber(num)}
           onMouseLeave={() => setHoveredNumber(null)}
           className={`relative flex items-center justify-center font-black text-xs md:text-sm transition-colors border ${typeStyles} ${className} ${amount > 0 ? 'ring-2 ring-white z-20 shadow-2xl' : 'hover:brightness-125 z-10'} ${highlightClass}`}
           style={{ width, height }}
         >
          <span className="z-10">{num}</span>
          <SmallChip amount={amount} />
          
          {/* Ghost Expanded Overlay (Adds Coverage under Auto-Adjust) */}
          {isGhostExpanded && (
            <div className="absolute inset-0 pointer-events-none rounded-lg border-2 border-dashed border-amber-500 bg-amber-500/15 z-20 flex flex-col items-center justify-center">
              <span className="text-[7.5px] font-black text-amber-300 absolute bottom-1 uppercase tracking-tighter leading-none px-1 py-0.5 rounded bg-black/90 border border-amber-500/30">
                +Proj
              </span>
            </div>
          )}

          {/* Ghost Reduced Overlay (Removes Coverage under Auto-Adjust) */}
          {isGhostReduced && (
            <div className="absolute inset-0 pointer-events-none rounded-lg border-2 border-dashed border-red-500/60 bg-red-950/40 z-20 flex flex-col items-center justify-center">
              <span className="text-[7.5px] font-black text-red-400 absolute bottom-1 uppercase tracking-tighter leading-none px-1 py-0.5 rounded bg-black/85 border border-red-500/30">
                -Proj
              </span>
            </div>
          )}

          {totalBet > 0 && payout > 0 && (
            <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-md text-[9px] font-black z-30 shadow-lg border border-white/10 ${
              type === 'jackpot' ? 'bg-[#c6a34f] text-black border-amber-300' :
              type === 'profit' ? 'bg-emerald-600 text-white border-emerald-400' :
              type === 'tie' ? 'bg-zinc-700 text-zinc-100 border-zinc-500' :
              'bg-red-650 text-white border-red-500'
            }`}>
              {profit > 0 ? `+${profit.toFixed(1)} U` : profit === 0 ? '0.0 U' : `${profit.toFixed(1)} U`}
            </div>
          )}
        </button>
      );
    };

    return (
      <AutoScale baseWidth={1050}>
        <div className="flex flex-col items-center justify-center py-6 w-full gap-5">
          {/* Neighbors Selector specifically in the racetrack editor */}
          <div className="flex flex-col w-full bg-black/40 border border-white/10 rounded-2xl p-4 gap-4" id="racetrack-editor-neighbors-selector">
            {/* Quick-Reference Terminal Legend & Direct Toggle Panel */}
            <div className="w-full space-y-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-left gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-black uppercase text-[#c6a34f] tracking-widest flex items-center gap-1.5 select-none">
                    <span className="w-2 h-2 rounded-full bg-[#c6a34f] animate-ping" /> Legenda de Terminais Ativos & Atalhos de Monitoramento
                  </span>
                  <span className="text-[9px] text-white/40">
                    Definições físicas de setores de roleta por dígito final. Clique em qualquer terminal para alternar (adicionar/remover) sua cobertura com vizinhos de forma direta.
                  </span>
                </div>
                
                {/* Visual counts indicator */}
                <div className="bg-black/40 border border-white/5 py-1 px-3 rounded-lg text-[9px] font-mono text-stone-400">
                  Terminais Ativos: <strong className="text-[#c6a34f]">
                    {Array.from({ length: 10 }).filter((_, idx) => {
                      const terminalNumbers = Array.from({ length: 37 }, (_, nIdx) => nIdx).filter(n => n % 10 === idx);
                      const currentTerminalNeighborsCount = autoAdjustNeighbors 
                        ? getDynamicNeighbors(terminalNumbers[0]).count 
                        : neighborCount;
                      const coveredNumbers = getTerminalAndNeighbors(idx, currentTerminalNeighborsCount);
                      return coveredNumbers.every(num => bets.some(b => b.target === num && b.type === 'number'));
                    }).length}
                  </strong> / 10
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                {Array.from({ length: 10 }).map((_, i) => {
                  // Get core terminal numbers
                  const terminalNumbers = Array.from({ length: 37 }, (_, index) => index).filter(n => n % 10 === i);
                  
                  // Dynamically discover what neighbors coverage is currently expected for this terminal structure
                  const currentTerminalNeighborsCount = autoAdjustNeighbors 
                    ? getDynamicNeighbors(terminalNumbers[0]).count 
                    : neighborCount;
                    
                  const coveredNumbers = getTerminalAndNeighbors(i, currentTerminalNeighborsCount);
                  
                  // Check if ALL covered numbers have active bets in current bets state
                  const isMonitored = coveredNumbers.every(num => 
                    bets.some(b => b.target === num && b.type === 'number')
                  );

                  // Count how many chips/bets are currently placed in this terminal physical coverage
                  const activeBetsInSector = bets.filter(b => 
                    b.type === 'number' && coveredNumbers.includes(b.target)
                  );
                  const totalSectorAmount = activeBetsInSector.reduce((sum, b) => sum + b.amount, 0);

                  const toggleTerminalMonitor = () => {
                    pushToHistory();
                    
                    if (isMonitored) {
                      // Remove all bets associated with this covered sector
                      const newBets = bets.filter(b => 
                        !(b.type === 'number' && coveredNumbers.includes(b.target))
                      );
                      setBets(newBets);
                      setLastAutoAdjustMsg(`Terminal ${i} desativado (${coveredNumbers.length} números limpos).`);
                    } else {
                      // Add bets for this covered sector (similar to applyTerminalPreset but optimized for toggle)
                      const newBets = cloneBets(bets);
                      coveredNumbers.forEach(num => {
                        const existingIndex = newBets.findIndex(b => b.target === num && b.type === 'number');
                        if (existingIndex === -1) {
                          newBets.push({ target: num, amount: selectedChip, type: 'number' });
                        }
                      });
                      setBets(newBets);
                      setLastAutoAdjustMsg(`Terminal ${i} ativado com ±${currentTerminalNeighborsCount} vizinhos (${coveredNumbers.length} números cobertos).`);
                    }
                  };

                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={toggleTerminalMonitor}
                      className={`p-2 rounded-xl text-left border transition-all active:scale-95 flex flex-col justify-between h-[68px] cursor-pointer group select-none relative overflow-hidden ${
                        isMonitored
                          ? 'bg-gradient-to-br from-emerald-500/10 via-black/40 to-black/60 border-emerald-500/30 hover:border-emerald-500/40 hover:brightness-110 shadow-[inner_0_0_12px_rgba(16,185,129,0.05)]'
                          : 'bg-black/40 border-white/5 hover:border-[#c6a34f]/30 hover:bg-[#c6a34f]/5'
                      }`}
                      title={isMonitored ? `Terminal ${i} Ativo. Clique para remover cobertura.` : `Terminal ${i} Inativo. Clique para monitorar (${coveredNumbers.length} números com ±${currentTerminalNeighborsCount} vizinhos).`}
                    >
                      {/* Top label & indicator glow */}
                      <div className="flex items-center justify-between w-full">
                        <span className={`text-[11px] font-black tracking-wider transition-colors uppercase ${
                          isMonitored ? 'text-emerald-400 font-extrabold' : 'text-stone-300 group-hover:text-[#c6a34f]'
                        }`}>
                          T{i} Def
                        </span>
                        
                        <div className="flex items-center gap-1.5">
                          {isMonitored && (
                            <span className="text-[7px] font-black uppercase text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded-md scale-90">
                              NO AR
                            </span>
                          )}
                          <span className={`w-1.5 h-1.5 rounded-full transition-all ${
                            isMonitored ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-stone-700'
                          }`} />
                        </div>
                      </div>

                      {/* Core Numbers list reference */}
                      <div className="text-[8.5px] font-mono text-zinc-400 tracking-tight flex items-center gap-0.5 mt-1 font-semibold leading-none">
                        Núcleo: <span className="text-stone-200">
                          {terminalNumbers.join(',')}
                        </span>
                      </div>

                      {/* Sub-description detailing chips or state */}
                      <div className="flex justify-between items-end w-full mt-auto leading-none pt-1">
                        <span className="text-[7.5px] font-mono font-bold uppercase tracking-wider text-[#c6a34f]">
                          {coveredNumbers.length} Números
                        </span>
                        <span className="text-[8.5px] font-bold font-mono text-zinc-500 text-right leading-none">
                          {isMonitored ? `${totalSectorAmount.toFixed(0)} U` : 'Vazio'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Backtest Simulation Results Panel */}
            {backtestResult && (
              <div className="w-full bg-[#c6a34f]/5 border border-[#c6a34f]/20 rounded-2xl p-5 flex flex-col gap-4 text-left">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[#c6a34f]/10 pb-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11px] font-black uppercase text-[#c6a34f] tracking-widest flex items-center gap-1.5 select-none animate-pulse">
                      <TrendingUp size={14} className="text-[#c6a34f]" /> Resultado da Simulação do Ajuste Automático (Backtest)
                    </span>
                    <span className="text-[9px] text-zinc-400">
                      Simulado em {backtestResult.totalRounds} giros do histórico da sessão atual com base na volatilidade de cada setor.
                    </span>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => setBacktestResult(null)}
                    className="text-[9px] font-bold text-zinc-500 hover:text-zinc-300 uppercase tracking-widest hover:underline cursor-pointer transition-colors"
                  >
                    Fechar Resultado
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Win-Rate Comparative Card */}
                  <div className="bg-black/40 border border-white/5 p-4 rounded-xl flex flex-col justify-between gap-3 shadow-inner md:col-span-2">
                    <span className="text-[10px] font-black uppercase text-zinc-300 tracking-wider">
                      Taxa de Acertos Comparativa
                    </span>
                    
                    <div className="flex items-center justify-around gap-4 py-2">
                      <div className="text-center">
                        <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block">Estático Padrão</span>
                        <span className="text-2xl font-black font-mono text-zinc-300 block mt-1">
                          {backtestResult.staticWinRate.toFixed(1)}%
                        </span>
                        <span className="text-[9px] text-zinc-400 font-mono mt-1 block font-semibold">
                          {backtestResult.staticWins} acertos / {backtestResult.totalRounds} giros
                        </span>
                      </div>

                      <div className="h-10 w-px bg-white/10" />

                      <div className="text-center">
                        <span className="text-[10px] uppercase font-bold text-amber-500 tracking-wider block">Ajuste Dinâmico</span>
                        <span className="text-2xl font-black font-mono text-amber-400 block mt-1">
                          {backtestResult.dynamicWinRate.toFixed(1)}%
                        </span>
                        <span className="text-[9px] text-amber-300/80 font-mono mt-1 block font-semibold">
                          {backtestResult.dynamicWins} acertos / {backtestResult.totalRounds} giros
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar showing comparison */}
                    <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden border border-white/5 flex">
                      <div 
                        className="bg-zinc-600 h-full transition-all duration-500" 
                        style={{ width: `${backtestResult.staticWinRate}%` }} 
                      />
                      <div 
                        className="bg-amber-400 h-full transition-all duration-500 shadow-[0_0_8px_rgba(251,191,36,0.5)]" 
                        style={{ width: `${Math.max(0, backtestResult.dynamicWinRate - backtestResult.staticWinRate)}%` }} 
                      />
                    </div>
                  </div>

                  {/* Profitability Difference indicator */}
                  <div className={`p-4 rounded-xl border flex flex-col justify-between gap-1 shadow-inner ${
                    backtestResult.difference >= 0
                      ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'
                      : 'bg-rose-500/5 border-rose-500/20 text-rose-400'
                  }`}>
                    <span className="text-[10px] font-black uppercase text-zinc-300 tracking-wider">
                      Desempenho Ajustado
                    </span>

                    <div className="py-1">
                      <span className="text-3xl font-black font-mono block tracking-tight">
                        {backtestResult.difference >= 0 ? '+' : ''}
                        {backtestResult.difference.toFixed(1)}%
                      </span>
                      <span className="text-[9px] text-zinc-400 opacity-80 uppercase font-bold tracking-wider mt-1 block">
                        Diferença de Aproveitamento
                      </span>
                    </div>

                    <p className="text-[9.5px] leading-snug">
                      {backtestResult.difference > 0
                        ? "O Ajuste Automático aumentou a precisão defensiva nos setores de maior volatilidade e expandiu cobertura nos setores frios."
                        : backtestResult.difference < 0
                          ? "A volatilidade do período favoreceu o posicionamento fixo, mas a variação de setores seguiu calibrada."
                          : "Ambos os modos mantiveram a mesma eficácia. Experimente diversificar as zonas clicadas para explorar a volatilidade física."}
                    </p>
                  </div>
                </div>

                <div className="bg-black/50 border border-white/5 p-3 rounded-xl flex flex-col gap-2">
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="text-stone-300">Zonas Primárias Monitoradas no Backtest:</span>
                    <span className="text-zinc-500 font-mono">Total: {backtestResult.analyzedCenters.length}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {backtestResult.analyzedCenters.length === 0 ? (
                      <span className="text-[9.5px] text-zinc-500 font-medium font-sans">
                        Nenhuma zona física/terminal em bets atualmente. Adicione números ou terminais do racetrack para simular.
                      </span>
                    ) : (
                      backtestResult.analyzedCenters.map(center => (
                        <span key={center} className="bg-[#c6a34f]/10 border border-[#c6a34f]/20 text-[#c6a34f] text-[9.5px] font-bold font-mono px-2 py-0.5 rounded-md">
                          Nº {center}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Main Track Container with expanded dimensions for readability */}
          <div 
            className="relative bg-[#003d24] rounded-[180px] border-[10px] border-[#087343] shadow-[0_20px_50px_rgba(0,0,0,0.6)] flex items-center overflow-hidden flex-shrink-0"
            style={{ width: '1050px', height: '340px', padding: '0 25px' }}
          >
            <div className="flex items-center w-full justify-center">
              {/* Left Curve */}
              <div className="flex items-center -mr-[1px] z-20">
                 <NumberCell num={leftPeak} className="rounded-l-[60px] border-r-0" />
              </div>

              {/* Middle Section */}
              <div className="flex flex-col relative z-10">
                {/* Top Numbers */}
                <div className="flex">
                  {topRow.map((num) => (
                    <NumberCell key={`top-${num}`} num={num} className="border-x-0" />
                  ))}
                </div>

                {/* Strategic Labels & Boundaries */}
                <div className="h-[160px] relative bg-[#012b18]/60 flex items-center justify-around px-10 border-x border-white/5 shadow-inner">
                   {/* Boundaries using App's Gold Color */}
                   <div className="absolute inset-x-0 inset-y-[-2px] flex pointer-events-none opacity-60">
                      <div className="w-[32%] border-l-2 border-b-2 border-t-2 border-[#c6a34f] rounded-l-2xl h-full translate-x-[-10px]" />
                      <div className="w-[22%] border-b-2 border-t-2 border-[#c6a34f]/60 h-full translate-x-[-6px]" />
                      <div className="w-[28%] border-b-2 border-t-2 border-[#c6a34f]/40 h-full translate-x-[-2px]" />
                      <div className="w-[22%] border-r-2 border-b-2 border-t-2 border-[#c6a34f]/80 rounded-r-2xl h-full translate-x-[2px]" />
                   </div>

                   {/* Labels with App Font/Color */}
                   <button onClick={() => handleZoneBet([27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33])} className="text-[#c6a34f]/80 font-black text-xs hover:text-[#c6a34f] transition-all uppercase tracking-[0.2em] z-10 hover:brightness-125 hover:border-[#c6a34f]/30 bg-black/30 px-3 py-1.5 rounded-lg border border-white/5">Tiers</button>
                   <button onClick={() => handleZoneBet([1, 20, 14, 31, 9, 17, 34, 6])} className="text-[#c6a34f]/80 font-black text-xs hover:text-[#c6a34f] transition-all uppercase tracking-[0.2em] z-10 hover:brightness-125 hover:border-[#c6a34f]/30 bg-black/30 px-3 py-1.5 rounded-lg border border-white/5">Orphelins</button>
                   <button onClick={() => handleZoneBet([22, 18, 29, 7, 28, 19, 4, 21, 2, 25])} className="text-[#c6a34f]/80 font-black text-xs hover:text-[#c6a34f] transition-all uppercase tracking-[0.2em] z-10 hover:brightness-125 hover:border-[#c6a34f]/30 bg-black/30 px-3 py-1.5 rounded-lg border border-white/5">Voisins</button>
                   <div className="relative">
                      <div className="absolute inset-[-6px] border border-[#c6a34f]/40 rounded-full scale-125 pointer-events-none" />
                      <button onClick={() => handleZoneBet([12, 35, 3, 26, 0, 32, 15])} className="text-[#c6a34f] font-black text-xs hover:brightness-125 transition-all uppercase tracking-[0.2em] z-10 px-4 py-1.5 bg-black/40 rounded-full border border-[#c6a34f]/30">Zero</button>
                   </div>
                </div>

                {/* Bottom Numbers */}
                <div className="flex flex-row-reverse">
                  {bottomRow.map((num) => (
                    <NumberCell key={`bottom-${num}`} num={num} className="border-x-0" />
                  ))}
                </div>
              </div>

              {/* Right Curve */}
              <div className="flex items-center -ml-[1px] z-20">
                 <NumberCell num={rightPeak} className="rounded-r-[60px] border-l-0" />
              </div>
            </div>
          </div>
        </div>
      </AutoScale>
    );
    function handleZoneBet(numbers: number[]) {
      pushToHistory();
      const newBets = cloneBets(bets);
      numbers.forEach(num => {
        const existingIndex = newBets.findIndex(b => b.target === num && b.type === 'number');
        if (existingIndex === -1) {
          newBets.push({ target: num, amount: selectedChip, type: 'number' });
        } else {
          newBets[existingIndex].amount += selectedChip;
          newBets[existingIndex].amount = Number(newBets[existingIndex].amount.toFixed(2));
        }
      });
      setBets(newBets);
    }
  };


  const renderOtherGames = () => {
    const labels = {
      [GameType.BACCARAT]: ['PLAYER', 'TIE', 'BANKER'],
      [GameType.ROULETTE]: []
    }[gameType];

    const colors = {
      [GameType.BACCARAT]: ['bg-blue-600', 'bg-green-600', 'bg-red-600'],
      [GameType.ROULETTE]: []
    }[gameType];

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 min-h-[250px] w-full max-w-4xl mx-auto">
        {labels.map((target, idx) => {
          const amount = getBetAmount(target, 'target');
          const colorClass = colors[idx];
          
          return (
            <button
              key={target}
              onClick={() => handleToggleBet(target, 'target')}
              className={`rounded-[32px] border flex flex-col items-center justify-center gap-4 transition-all relative overflow-hidden group ${
                amount > 0 
                  ? `${colorClass} border-white text-white shadow-2xl scale-105 z-10` 
                  : `${colorClass}/10 border-white/5 text-white/40 hover:bg-white/5`
              }`}
            >
              {amount > 0 && (
                <div className="absolute top-0 right-0 p-4">
                   <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
                      <CheckCircle2 size={16} />
                   </div>
                </div>
              )}
              <span className="font-black text-xl tracking-tight opacity-80 uppercase">{target}</span>
              <span className="text-3xl font-black">{amount > 0 ? `${amount} U` : '0 U'}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Clique para apostar</span>
            </button>
          );
        })}
      </div>
    );
  };

  const handleUndo = () => {
    if (history.length > 0) {
      const prevState = history[history.length - 1];
      if (gameType === GameType.BACCARAT) {
        setBaccaratPattern(prevState as any);
      } else {
        setBets(prevState as any);
      }
      setHistory(prev => prev.slice(0, -1));
    }
  };

  const clearBets = () => {
    if (gameType === GameType.BACCARAT) {
      if (baccaratPattern.length > 0 || bets.length > 0) {
        pushToHistory();
        setBaccaratPattern([]);
        setBets([]);
      }
    } else {
      if (bets.length > 0) {
        pushToHistory();
        setBets([]);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-2 md:p-4 backdrop-blur-md overflow-y-auto">
      <div className="bg-[#0a0a0a] w-full max-w-[1200px] rounded-[24px] md:rounded-[32px] border border-[#c6a34f]/30 shadow-[0_0_50px_rgba(198,163,79,0.15)] overflow-hidden flex flex-col my-auto">
        {/* Header */}
        <div className="p-4 md:p-6 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
          <div className="flex-1">
            <input 
              value={name ?? ''}
              onChange={(e) => setName(e.target.value)}
              className="bg-transparent text-2xl md:text-3xl font-light italic tracking-tight text-[#c6a34f] focus:outline-none border-b border-transparent focus:border-[#c6a34f]/30 w-full"
              placeholder="Nome da Estratégia..."
            />
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <select 
                value={gameType}
                onChange={(e) => {
                  setGameType(e.target.value as GameType);
                  setHistory([]);
                }}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-[10px] uppercase font-bold text-[#c6a34f] outline-none"
              >
                {Object.values(GameType).map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
              <div className="h-4 w-px bg-white/10 hidden sm:block"></div>
              <span className="text-[10px] text-white/40 uppercase tracking-widest flex items-center gap-1">
                 <Calculator size={10} /> Total: <span className="text-[#c6a34f] font-mono font-black">{totalBet} U</span>
              </span>
              <div className="h-4 w-px bg-white/10 hidden sm:block"></div>
              <span className="text-[10px] text-white/40 uppercase tracking-widest flex items-center gap-1">
                 <Gauge size={10} /> Gale: <span className="text-[#c6a34f] font-mono font-bold">G{maxGale}</span>
              </span>
              {toastMessage && (
                <span className="text-[11px] font-bold text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2.5 py-0.5 rounded-full animate-pulse">
                  {toastMessage}
                </span>
              )}
              {copiedToast && (
                <span className="text-[11px] font-bold text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 rounded-full animate-in fade-in">
                  JSON copiado para a área de transferência!
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            {/* Botão Duplicar */}
            <button 
              onClick={handleDuplicate}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white rounded-xl font-bold uppercase tracking-wider text-[11px] transition-all cursor-pointer shadow-sm active:scale-95"
              title="Criar cópia desta estratégia"
            >
              <Copy size={13} className="text-[#c6a34f]" /> 
              <span className="hidden sm:inline">Duplicar</span>
            </button>

            {/* Exportar / Importar JSON */}
            <button 
              onClick={handleExportJson}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white rounded-xl font-bold uppercase tracking-wider text-[11px] transition-all cursor-pointer shadow-sm active:scale-95"
              title="Exportar configuração em JSON"
            >
              <Download size={13} className="text-[#c6a34f]" />
              <span className="hidden sm:inline">Exportar</span>
            </button>

            <button 
              onClick={() => {
                setJsonInput('');
                setJsonError('');
                setShowJsonModal('import');
              }}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white rounded-xl font-bold uppercase tracking-wider text-[11px] transition-all cursor-pointer shadow-sm active:scale-95"
              title="Importar configuração em JSON"
            >
              <Upload size={13} className="text-[#c6a34f]" />
              <span className="hidden sm:inline">Importar</span>
            </button>

            {/* Restaurar Fábrica (para do sistema) */}
            {isSystemStrategy && (
              <button 
                onClick={handleRestoreFactory}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-xl font-bold uppercase tracking-wider text-[11px] transition-all cursor-pointer shadow-sm active:scale-95"
                title="Restaurar parâmetros padrão de fábrica do sistema"
              >
                <RotateCcw size={13} />
                <span className="hidden md:inline">Restaurar Fábrica</span>
              </button>
            )}

            {/* Salvar */}
            <button 
              onClick={() => {
                const updatedStrategy: Strategy = { 
                  ...strategy, 
                  name, 
                  gameType, 
                  rules: { 
                    ...(strategy.rules || {}),
                    bets, 
                    baccaratPattern,
                    maxGale,
                    progressionMode,
                    progressionMultiplier,
                    triggerConfig: {
                      selectedPositions,
                      minDelay,
                      maxDelay,
                      minFrequency,
                      frequencyWindow,
                      statCriterion,
                      analysisWindow,
                      useRacetrackConfluence,
                      confluenceType,
                      confluenceMode,
                      globalNeighborsCount,
                      selectedTerminals,
                      customTerminalsConfig,
                      selectedSectors,
                      customSectorsConfig,
                      confluenceNumbers,
                      customNumbersConfig,
                      selectedExternalBets,
                      selectedDozensColumns,
                      selectedLinesStreets,
                      selectedCornersSplits,
                      useS84Sequence
                    }
                  },
                  management: {
                    ...(strategy.management || {} as any),
                    mode: progressionMode,
                    levels: maxGale,
                    multiplier: progressionMultiplier,
                    initialBet: totalBet > 0 ? totalBet : (strategy.management?.initialBet || 1)
                  }
                };
                onSave(updatedStrategy);
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#c6a34f] text-black rounded-xl font-black uppercase tracking-widest text-xs hover:scale-105 transition-all shadow-lg active:scale-95 cursor-pointer"
            >
              <Save size={15} /> 
              <span>Salvar</span>
            </button>

            {onDelete && (
              confirmDelete ? (
                <div className="flex items-center gap-1.5 bg-red-950/80 border border-red-500/40 p-1.5 rounded-xl animate-in fade-in duration-200">
                  <span className="text-[10px] font-black text-red-300 uppercase tracking-wider px-1">Excluir?</span>
                  <button 
                    onClick={() => onDelete(strategy.id)}
                    className="px-2.5 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-xs uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Sim
                  </button>
                  <button 
                    onClick={() => setConfirmDelete(false)}
                    className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-lg text-xs uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Não
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1.5 px-3 py-2.5 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded-xl font-bold uppercase tracking-widest text-xs transition-all cursor-pointer"
                  title="Apagar Estratégia"
                >
                  <Trash2 size={15} />
                  <span className="hidden sm:inline">Apagar</span>
                </button>
              )
            )}
            <button onClick={onCancel} className="p-2.5 bg-white/5 rounded-xl text-white/50 hover:bg-white/10 transition-colors cursor-pointer">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto custom-scrollbar flex-1">
          {/* Main Editor */}
          <div className="lg:col-span-8 space-y-6 flex flex-col items-center">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-4">
                {gameType === GameType.ROULETTE && (
                    <div className="flex items-center gap-2 bg-[#111111] p-1 rounded-xl border border-white/5">
                      <button 
                        onClick={() => setViewMode('traditional')}
                        className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${viewMode === 'traditional' ? 'bg-[#c6a34f] text-black' : 'text-white/40 hover:text-white'}`}
                      >
                        Tradicional
                      </button>
                      <button 
                        onClick={() => setViewMode('race')}
                        className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${viewMode === 'race' ? 'bg-[#c6a34f] text-black' : 'text-white/40 hover:text-white'}`}
                      >
                        Race (Track)
                      </button>
                    </div>
                )}
                
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleUndo}
                    disabled={history.length === 0}
                    className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase border border-[#c6a34f]/30 text-[#c6a34f] hover:bg-[#c6a34f] hover:text-black transition-all flex items-center gap-2 ${history.length === 0 ? 'opacity-30 cursor-not-allowed' : 'active:scale-95'}`}
                  >
                    <RotateCcw size={14} /> Desfazer
                  </button>
                  {bets.length > 0 && (
                    <button 
                      onClick={clearBets}
                      className="px-4 py-2 rounded-xl text-[10px] font-bold uppercase border border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center gap-2 active:scale-95"
                    >
                      <Trash2 size={14} /> Limpar Mesa
                    </button>
                  )}
                </div>
              </div>
            </div>

            {gameType === GameType.ROULETTE && (
              <div className="flex flex-col gap-2 bg-[#111111] p-4 rounded-3xl border border-white/5 w-full">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-2">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-white">
                      Fichas Rápidas por Racetrack Terminal
                    </h4>
                    <p className="text-[10px] text-white/40 font-medium">Configure a abrangência de vizinhos em tempo real e insira a cobertura física dos terminais no seu preset de estratégia</p>
                  </div>
                  <span className="text-[9px] bg-[#c6a34f]/10 border border-[#c6a34f]/30 text-[#c6a34f] px-2 py-0.5 rounded font-black tracking-widest uppercase self-start sm:self-center">
                    Ficha: {selectedChip} {selectedChip === 1 ? 'Unidade' : 'Unidades'}
                  </span>
                </div>

                {/* Real-time Sector Precision / Neighbors Selector Row */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-black/30 p-3 rounded-2xl border border-white/5 my-1">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-white uppercase tracking-wider">Quantidade de Vizinhos Racetrack</span>
                    <span className="text-[9px] text-white/40">Defina a precisão física da roleta (0 a 9 vizinhos) ao aplicar terminais ou ao clicar no racetrack</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setNeighborCount(prev => Math.max(0, prev - 1))}
                      className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 active:scale-90 border border-white/10 text-[#c6a34f] font-black text-lg flex items-center justify-center transition-all select-none"
                    >
                      -
                    </button>
                    <div className="w-12 text-center">
                      <span className="text-lg font-black text-white font-mono">{neighborCount}</span>
                      <span className="text-[8px] text-[#c6a34f]/80 uppercase block tracking-widest font-bold font-sans">Vizinhos</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNeighborCount(prev => Math.min(9, prev + 1))}
                      className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 active:scale-90 border border-white/10 text-[#c6a34f] font-black text-lg flex items-center justify-center transition-all select-none"
                    >
                      +
                    </button>

                    <div className="h-8 w-px bg-white/10 mx-1"></div>

                    <button
                      type="button"
                      onClick={() => setApplyNeighborsOnClick(!applyNeighborsOnClick)}
                      className={`px-3 py-1.5 rounded-lg border text-[9px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                        applyNeighborsOnClick 
                          ? 'bg-[#c6a34f]/20 border-[#c6a34f]/40 text-[#c6a34f]' 
                          : 'bg-white/5 border-white/10 text-white/40'
                      }`}
                    >
                      {applyNeighborsOnClick ? 'Vizinhos nos Cliques: SIM' : 'Vizinhos nos Cliques: NÃO'}
                    </button>
                  </div>
                </div>


                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => applyTerminalPreset(i)}
                      className="p-2.5 rounded-2xl bg-black/40 hover:bg-[#c6a34f]/15 hover:border-[#c6a34f]/40 border border-white/5 active:scale-95 transition-all text-left flex flex-col justify-between cursor-pointer group"
                    >
                      <span className="text-xs font-black text-white group-hover:text-[#c6a34f] transition-colors">Terminal {i}</span>
                      <span className="text-[9px] text-[#c6a34f] font-mono mt-1">
                        {getTerminalAndNeighbors(i, neighborCount).length} Fichas
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="relative w-full flex justify-center">
              {gameType === GameType.ROULETTE && (
                viewMode === 'traditional' ? renderRouletteGrid() : renderRace()
              )}
              {gameType === GameType.BACCARAT && renderBaccaratPatternBuilder()}
              {gameType !== GameType.ROULETTE && gameType !== GameType.BACCARAT && renderOtherGames()}
            </div>


            {/* Chip Selection - Only for non-pattern games */}
            {gameType !== GameType.BACCARAT && (
              <div className="space-y-4">
                <h4 className="text-[10px] uppercase font-bold text-[#c6a34f] tracking-[0.2em] flex items-center gap-2">
                  <Coins size={14} /> Seleção de Unidades por Aposta
                </h4>
                <div className="flex flex-wrap gap-2">
                  {CHIP_VALUES.map(val => (
                    <button
                      key={val}
                      onClick={() => setSelectedChip(val)}
                      className={`
                        px-6 py-4 rounded-2xl font-black text-sm transition-all border
                        ${selectedChip === val 
                          ? 'bg-[#c6a34f] border-white text-black scale-110 shadow-[0_4px_20px_rgba(198,163,79,0.3)]' 
                          : 'bg-[#111111] border-white/10 text-[#c6a34f] hover:bg-white/5'}
                      `}
                    >
                      {val} {val === 1 ? 'Unidade' : 'Unidades'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Analysis Sidebar */}
          <div className="lg:col-span-4 space-y-4">
            {/* PAINEL DE GESTÃO E PROGRESSÃO RECOMENDADA */}
            <div className="bg-[#111111] p-5 rounded-2xl border border-[#c6a34f]/30 space-y-5 shadow-inner">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#c6a34f] flex items-center gap-2">
                  <Sliders size={14} className="text-[#c6a34f]" /> Gestão & Progressão Recomendada
                </h3>
                <span className="text-[10px] font-mono font-bold bg-[#c6a34f]/10 text-[#c6a34f] px-2 py-0.5 rounded-full border border-[#c6a34f]/30">
                  G{maxGale} • {progressionMode.toUpperCase().replace(/_/g, ' ')}
                </span>
              </div>

              {/* LIMITE MÁXIMO DE GALE SUGERIDO (G0 até G50) */}
              <div className="space-y-3 bg-black/40 p-4 rounded-xl border border-white/5">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs uppercase font-bold text-[#c6a34f] tracking-wider flex items-center gap-1.5">
                      <Gauge size={13} /> Limite Máximo de Gale
                    </span>
                    <span className="text-[10px] text-white/50">
                      {maxGale === 0 
                        ? 'G0: Mão Fixa (Sem Gale / Sem Repetição)' 
                        : maxGale === 1 
                        ? 'G1: 1 tentativa de recuperação'
                        : maxGale === 2 
                        ? 'G2: 2 tentativas (Padrão mais equilibrado)'
                        : `G${maxGale}: Até ${maxGale} tentativas sucessivas`}
                    </span>
                  </div>
                  <span className="text-sm font-black font-mono text-[#c6a34f] bg-black px-3 py-1 rounded-lg border border-[#c6a34f]/40 shadow-inner">
                    G{maxGale}
                  </span>
                </div>

                {/* Controles de Stepper & Input direto de 0 a 50 */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMaxGale(prev => Math.max(0, prev - 1))}
                    disabled={maxGale <= 0}
                    className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed border border-white/10 text-white font-black text-lg flex items-center justify-center transition-all cursor-pointer"
                  >
                    -
                  </button>
                  <input 
                    type="range"
                    min="0"
                    max="50"
                    value={maxGale}
                    onChange={(e) => setMaxGale(Number(e.target.value))}
                    className="flex-1 accent-[#c6a34f] cursor-pointer h-2 bg-white/10 rounded-lg appearance-none"
                  />
                  <button
                    type="button"
                    onClick={() => setMaxGale(prev => Math.min(50, prev + 1))}
                    disabled={maxGale >= 50}
                    className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed border border-white/10 text-white font-black text-lg flex items-center justify-center transition-all cursor-pointer"
                  >
                    +
                  </button>
                  <div className="w-16">
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={maxGale}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val)) setMaxGale(Math.min(50, Math.max(0, val)));
                      }}
                      className="w-full bg-black border border-white/10 focus:border-[#c6a34f] rounded-xl px-2 py-2 text-center text-xs font-mono font-bold text-white outline-none"
                    />
                  </div>
                </div>

                {/* Atalhos Rápidos para Escolha do Gale (G0 a G50) */}
                <div className="space-y-1.5">
                  <span className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Atalhos de Nível:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 30, 50].map(level => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setMaxGale(level)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all border cursor-pointer ${
                          maxGale === level
                            ? 'bg-[#c6a34f] border-[#c6a34f] text-black shadow-md scale-105'
                            : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        G{level}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* TIPO DE PROGRESSÃO PADRÃO (TODAS AS PROGRESSÕES EXISTENTES) */}
              <div className="space-y-3 bg-black/40 p-4 rounded-xl border border-white/5">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs uppercase font-bold text-[#c6a34f] tracking-wider flex items-center gap-1.5">
                      <Zap size={13} /> Tipo de Progressão Padrão
                    </span>
                    <span className="text-[10px] text-white/50">
                      Progressão matemática recomendada para esta estratégia
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <select
                    value={progressionMode}
                    onChange={(e) => setProgressionMode(e.target.value as ManagementMode)}
                    className="w-full bg-black border border-white/10 focus:border-[#c6a34f] text-[#c6a34f] rounded-xl px-3 py-2.5 text-xs font-bold uppercase tracking-wider outline-none cursor-pointer"
                  >
                    <option value={ManagementMode.MARTINGALE}>Martingale (Dobra a cada perda)</option>
                    <option value={ManagementMode.SOROS}>Soros (Alavancagem nos lucros)</option>
                    <option value={ManagementMode.FIBONACCI}>Fibonacci (1, 1, 2, 3, 5, 8, 13...)</option>
                    <option value={ManagementMode.FIXED}>Mão Fixa / Flat Bet (Sem progressão)</option>
                    <option value={ManagementMode.CYCLIC}>Cíclico (Reset periódico após ciclo)</option>
                    <option value={ManagementMode.SISTEMA_2_GANHOS}>Sistema 2 Ganhos (Meta de 2 vitórias seguidas)</option>
                    <option value={ManagementMode.SISTEMA_2U_REC1}>Sistema 2U Rec 1 (Aposta 2U, recupera 1U)</option>
                    <option value={ManagementMode.D_ALEMBERT}>D'Alembert (+1 na perda, -1 no ganho)</option>
                    <option value={ManagementMode.OSCARS_GRIND}>Oscar's Grind (+1 no ganho até +1U)</option>
                    <option value={ManagementMode.LABOUCHERE}>Labouchère (Cancelamento de fila)</option>
                    <option value={ManagementMode.REVERSE_MARTINGALE}>Reverse Martingale / Paroli (Dobra na vitória)</option>
                    <option value={ManagementMode.SYSTEM_1326}>Sistema 1-3-2-6 (Sequência progressiva)</option>
                    <option value={ManagementMode.KELLY_CRITERION}>Critério de Kelly (Fracional ótimo)</option>
                    <option value={ManagementMode.NIVEL_FIXO_RECUPERACAO}>Nível Fixo de Recuperação (Mão segura)</option>
                    <option value={ManagementMode.STAR_2_2}>Star 2-2 (Equilíbrio moderado)</option>
                    <option value={ManagementMode.STAR_2_0}>Star 2-0 (Recuperação agressiva)</option>
                    <option value={ManagementMode.DUTCH}>Dutch (Alavancagem holandesa)</option>
                    <option value={ManagementMode.PADOVAN}>Padovan (Sequência plástica 1,1,1,2,2,3,4,5...)</option>
                  </select>

                  {/* Informação explicativa sobre a progressão selecionada */}
                  <div className="bg-black/60 p-2.5 rounded-lg border border-white/5 text-[11px] text-white/60 leading-relaxed">
                    {progressionMode === ManagementMode.MARTINGALE && "Multiplica a unidade após cada perda para recuperar todo o montante e garantir 1 lucro base no primeiro acerto."}
                    {progressionMode === ManagementMode.SOROS && "Reinveste os lucros obtidos na rodada anterior para alavancar bancas rapidamente com risco limitado ao investimento inicial."}
                    {progressionMode === ManagementMode.FIBONACCI && "Avança um passo na sequência de Fibonacci (1,1,2,3,5,8...) em perdas e recua dois passos em vitórias."}
                    {progressionMode === ManagementMode.FIXED && "Mantém rigorosamente o mesmo valor de aposta em todas as rodadas (gestão conservadora de mão fixa)."}
                    {progressionMode === ManagementMode.CYCLIC && "Executa um ciclo controlado de entradas e reseta imediatamente para o valor base ao completar o ciclo."}
                    {progressionMode === ManagementMode.SISTEMA_2_GANHOS && "Foca em encerrar ciclos assim que conquistar duas vitórias consecutivas."}
                    {progressionMode === ManagementMode.SISTEMA_2U_REC1 && "Inicia com 2 unidades e adota recuperação suave de 1 unidade para mitigar drawdowns."}
                    {progressionMode === ManagementMode.D_ALEMBERT && "Aumenta 1 unidade a cada rodada perdida e reduz 1 unidade a cada rodada ganha."}
                    {progressionMode === ManagementMode.OSCARS_GRIND && "Mantém a aposta em perdas e só aumenta 1 unidade após ganhos, buscando lucro de +1U por ciclo."}
                    {progressionMode === ManagementMode.LABOUCHERE && "Utiliza uma lista numérica somando as extremidades; risca números no acerto e adiciona a aposta no erro."}
                    {progressionMode === ManagementMode.REVERSE_MARTINGALE && "Dobra a aposta apenas quando vence, aproveitando sequências vitoriosas e protegendo a banca em perdas."}
                    {progressionMode === ManagementMode.SYSTEM_1326 && "Progressão de 4 etapas (1, 3, 2, 6 unidades) reiniciando após 4 vitórias ou qualquer perda."}
                    {progressionMode === ManagementMode.KELLY_CRITERION && "Calcula a proporção matemática ótima da banca com base na probabilidade de acerto e payout."}
                    {progressionMode === ManagementMode.NIVEL_FIXO_RECUPERACAO && "Trabalha com patamares fixos de recuperação sem explosão exponencial de fichas."}
                    {progressionMode === ManagementMode.STAR_2_2 && "Sistema intermediário Star de 2 níveis com proteção de capital."}
                    {progressionMode === ManagementMode.STAR_2_0 && "Sistema Star de transição rápida para recuperação dinâmica de perdas."}
                    {progressionMode === ManagementMode.DUTCH && "Agrupa perdas anteriores e divide o valor pelas próximas rodadas para liquidação gradual."}
                    {progressionMode === ManagementMode.PADOVAN && "Sequência matemática de crescimento mais suave que Fibonacci (1, 1, 1, 2, 2, 3, 4, 5, 7, 9...)."}
                  </div>

                  {/* Multiplicador customizado se Martingale ou Soros */}
                  {(progressionMode === ManagementMode.MARTINGALE || progressionMode === ManagementMode.SOROS) && (
                    <div className="pt-2 flex items-center justify-between bg-black/40 p-2.5 rounded-lg border border-white/5">
                      <span className="text-[11px] text-white/70 font-semibold">Multiplicador da Progressão:</span>
                      <div className="flex items-center gap-1">
                        {[1.5, 2.0, 2.5, 3.0].map(mult => (
                          <button
                            key={mult}
                            type="button"
                            onClick={() => setProgressionMultiplier(mult)}
                            className={`px-2 py-1 rounded-md text-[10px] font-mono font-bold transition-all border cursor-pointer ${
                              progressionMultiplier === mult
                                ? 'bg-[#c6a34f] border-[#c6a34f] text-black'
                                : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                            }`}
                          >
                            {mult.toFixed(1)}x
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SIMULADOR INSTANTÂNEO / BACKTEST EM TEMPO REAL */}
            {liveSimulation && (
              <div className="bg-[#111111] p-5 rounded-2xl border border-emerald-500/20 space-y-3 shadow-inner">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                    <Activity size={14} /> Backtest em Tempo Real (Últimos {liveSimulation.totalSpins} giros)
                  </h3>
                  <span className="text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    {liveSimulation.winRate.toFixed(1)}% Assertividade
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-black/50 p-2 rounded-xl border border-white/5">
                    <span className="text-[9px] uppercase font-bold text-white/40 block">G0 (Direto)</span>
                    <span className="text-sm font-mono font-bold text-emerald-400">{liveSimulation.g0Rate.toFixed(1)}%</span>
                    <span className="text-[9px] text-white/40 block font-mono">{liveSimulation.g0Wins} vitórias</span>
                  </div>
                  <div className="bg-black/50 p-2 rounded-xl border border-white/5">
                    <span className="text-[9px] uppercase font-bold text-white/40 block">G1 (Gale 1)</span>
                    <span className="text-sm font-mono font-bold text-yellow-400">{liveSimulation.g1Rate.toFixed(1)}%</span>
                    <span className="text-[9px] text-white/40 block font-mono">{liveSimulation.g1Wins} vitórias</span>
                  </div>
                  <div className="bg-black/50 p-2 rounded-xl border border-white/5">
                    <span className="text-[9px] uppercase font-bold text-white/40 block">G2 (Gale 2)</span>
                    <span className="text-sm font-mono font-bold text-amber-400">{liveSimulation.g2Rate.toFixed(1)}%</span>
                    <span className="text-[9px] text-white/40 block font-mono">{liveSimulation.g2Wins} vitórias</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 px-1">
                  <span className="text-white/50">Lucro Simulado com Gestão:</span>
                  <span className={`font-mono font-bold text-sm ${liveSimulation.totalProfitUnits >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {liveSimulation.totalProfitUnits >= 0 ? `+${liveSimulation.totalProfitUnits.toFixed(0)} U` : `${liveSimulation.totalProfitUnits.toFixed(0)} U`}
                  </span>
                </div>
              </div>
            )}

            {gameType === GameType.ROULETTE && (
              <div className="bg-[#111111] p-5 rounded-2xl border border-[#c6a34f]/10 space-y-5 shadow-inner">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#c6a34f] flex items-center gap-2 border-b border-white/5 pb-3">
                  <Coins size={14} /> Configurações de Gatilho / Confirmação
                </h3>

                {/* Posição do Histórico (Gatilhos ÚLT, PEN, ANT, PRE, APR) */}
                <div className="space-y-2.5 bg-black/40 p-4 rounded-xl border border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase font-bold text-[#c6a34f] tracking-wider">
                      Posição no Histórico (Gatilho)
                    </span>
                    <span className="text-[10px] font-mono text-white/50 uppercase">
                      {selectedPositions.length === 1 
                        ? (selectedPositions[0] === 0 ? 'Último (ÚLT)' :
                           selectedPositions[0] === 1 ? 'Penúltimo (PEN)' :
                           selectedPositions[0] === 2 ? 'Antepenúltimo (ANT)' :
                           selectedPositions[0] === 3 ? 'Pré-Antepenúltimo (PRE)' : 'Antes do Pré-Antep. (APR)')
                        : `${selectedPositions.length} posições ativas`
                      }
                    </span>
                  </div>
                  <p className="text-[11px] text-white/50 leading-relaxed">
                    Selecione qual(is) posição(ões) de rodadas anteriores ativam o gatilho:
                  </p>
                  <div className="grid grid-cols-5 gap-2 bg-black p-2 rounded-xl border border-white/10">
                    {[
                      { pos: 0, acronym: 'ÚLT', label: 'Último', desc: '1ª rodada atrás (t-1)' },
                      { pos: 1, acronym: 'PEN', label: 'Penúltimo', desc: '2ª rodada atrás (t-2)' },
                      { pos: 2, acronym: 'ANT', label: 'Antepenúltimo', desc: '3ª rodada atrás (t-3)' },
                      { pos: 3, acronym: 'PRE', label: 'Pré-Antep.', desc: '4ª rodada atrás (t-4)' },
                      { pos: 4, acronym: 'APR', label: 'Antes Pré-A.', desc: '5ª rodada atrás (t-5)' }
                    ].map(item => {
                      const isSelected = selectedPositions.includes(item.pos);
                      return (
                        <button
                          key={item.pos}
                          type="button"
                          onClick={() => {
                            setSelectedPositions(prev => {
                              if (prev.includes(item.pos)) {
                                return prev.length > 1 ? prev.filter(p => p !== item.pos) : prev;
                              } else {
                                return [...prev, item.pos].sort((a, b) => a - b);
                              }
                            });
                          }}
                          className={`py-3 px-1.5 rounded-xl text-center transition-all border flex flex-col items-center justify-center gap-1 min-h-[52px] cursor-pointer ${
                            isSelected
                              ? 'bg-[#c6a34f]/25 border-[#c6a34f] text-[#c6a34f] shadow-md font-black'
                              : 'bg-white/5 border-white/10 text-white/50 hover:text-white hover:bg-white/10'
                          }`}
                          title={`${item.label} (${item.desc})`}
                        >
                          <span className="text-sm font-black tracking-widest uppercase">{item.acronym}</span>
                          <span className="text-[10px] font-bold opacity-80 whitespace-nowrap tracking-wider hidden sm:inline">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Critério Estatístico & Janela de Análise */}
                <div className="space-y-3 bg-black/40 p-4 rounded-xl border border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase font-bold text-[#c6a34f] tracking-wider">Janela de Análise</span>
                    <span className="text-xs font-mono text-white/50 uppercase">Análise Estatística</span>
                  </div>

                  {/* Janela de Análise (Últimas Rodadas) */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase tracking-wider text-white/60 font-bold">Últimas Rodadas (Janela de Análise)</span>
                      <span className="text-xs font-mono font-bold text-[#c6a34f]">{analysisWindow} rodadas</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {[10, 20, 30, 50, 100].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setAnalysisWindow(val)}
                          className={`flex-1 py-1.5 rounded text-xs font-mono font-bold transition-all border ${
                            analysisWindow === val
                              ? 'bg-[#c6a34f]/20 border-[#c6a34f] text-[#c6a34f]'
                              : 'bg-white/5 border-white/5 text-white/50 hover:bg-white/10'
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                      <input
                        type="number"
                        min="1"
                        max="200"
                        value={analysisWindow}
                        onChange={(e) => setAnalysisWindow(Math.max(1, Math.min(200, Number(e.target.value))))}
                        className="w-14 bg-[#0a0a0a] border border-white/10 rounded-lg px-2 py-1.5 text-xs font-mono text-center text-white outline-none focus:border-[#c6a34f]/50"
                      />
                    </div>
                  </div>
                </div>

                {/* 1. Ausência / Delay Filter */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase font-bold text-white/70 tracking-wider">Filtro de Ausência</span>
                    <span className={`text-xs px-2.5 py-1 rounded-md border font-bold uppercase ${
                      minDelay > 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-white/5 text-white/40 border-white/10'
                    }`}>
                      {minDelay > 0 ? 'Ativado' : 'Inativo'}
                    </span>
                  </div>
                  <p className="text-xs text-white/50 leading-relaxed">Mínimo e máximo de rodadas consecutivas sem bater para disparar o sinal.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className="text-xs uppercase tracking-wider text-white/50 font-medium block">Ausência Mínima</span>
                      <input 
                        type="number" 
                        min="0" 
                        max="50" 
                        value={minDelay}
                        onChange={(e) => setMinDelay(Math.max(0, Math.min(50, Number(e.target.value))))}
                        className="bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-[#c6a34f] w-full text-center outline-none focus:border-[#c6a34f]/50"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs uppercase tracking-wider text-white/50 font-medium block">Ausência Máxima</span>
                      <input 
                        type="number" 
                        min="0" 
                        max="100" 
                        value={maxDelay}
                        onChange={(e) => setMaxDelay(Math.max(0, Math.min(100, Number(e.target.value))))}
                        className="bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white w-full text-center outline-none focus:border-white/20"
                      />
                    </div>
                  </div>
                </div>

                <div className="h-px bg-white/5"></div>

                {/* 2. Frequência Filter */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase font-bold text-white/70 tracking-wider">Filtro de Frequência recente</span>
                    <span className={`text-xs px-2.5 py-1 rounded-md border font-bold uppercase ${
                      minFrequency > 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-white/5 text-white/40 border-white/10'
                    }`}>
                      {minFrequency > 0 ? 'Ativado' : 'Inativo'}
                    </span>
                  </div>
                  <p className="text-xs text-white/50 leading-relaxed">Exige pelo menos N acertos em uma janela recente de rodadas.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className="text-xs uppercase tracking-wider text-white/50 font-medium block">Mínimo de acertos</span>
                      <input 
                        type="number" 
                        min="0" 
                        max="10" 
                        value={minFrequency}
                        onChange={(e) => setMinFrequency(Math.max(0, Math.min(10, Number(e.target.value))))}
                        className="bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-[#c6a34f] w-full text-center outline-none focus:border-[#c6a34f]/50"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs uppercase tracking-wider text-white/50 font-medium block">Janela de rodadas</span>
                      <input 
                        type="number" 
                        min="2" 
                        max="30" 
                        value={frequencyWindow}
                        onChange={(e) => setFrequencyWindow(Math.max(2, Math.min(30, Number(e.target.value))))}
                        className="bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white w-full text-center outline-none focus:border-white/20"
                      />
                    </div>
                  </div>
                </div>

                <div className="h-px bg-white/5"></div>

                {/* 3. Configuração de Alvos & Vizinhos do Gatilho */}
                <div className="space-y-4 bg-black/40 p-4 rounded-xl border border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase font-bold text-[#c6a34f] tracking-wider">
                      Alvos & Vizinhos do Gatilho
                    </span>
                    <span className="text-xs font-mono text-white/50 uppercase">Confirmação</span>
                  </div>

                  {/* Seletor de Tipo de Alvo da Mesa */}
                  <div className="space-y-2">
                    <span className="text-xs uppercase font-bold text-white/70 block tracking-wider">Tipo de Alvo / Aposta da Mesa:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 bg-black p-2 rounded-xl border border-white/10">
                      {[
                        { id: 'terminals', label: 'Terminais (T0-T9)' },
                        { id: 'numbers', label: 'Números (0-36)' },
                        { id: 'external', label: 'Apostas Externas' },
                        { id: 'dozens', label: 'Dúzias (1ª, 2ª, 3ª)' },
                        { id: 'columns', label: 'Colunas (1ª, 2ª, 3ª)' },
                        { id: 'lines', label: 'Ruas Duplas' },
                        { id: 'streets', label: 'Ruas' },
                        { id: 'all', label: 'Todas da Mesa' }
                      ].map(item => (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => {
                            setConfluenceType(item.id as any);
                            setUseRacetrackConfluence(true);
                            if (item.id === 'dozens') {
                              setSelectedDozensColumns(['dozen_1', 'dozen_2', 'dozen_3']);
                            } else if (item.id === 'columns') {
                              setSelectedDozensColumns(['col_1', 'col_2', 'col_3']);
                            } else if (item.id === 'lines') {
                              setSelectedLinesStreets(['line_1_6', 'line_7_12', 'line_13_18', 'line_19_24', 'line_25_30', 'line_31_36']);
                            } else if (item.id === 'streets') {
                              setSelectedLinesStreets(['street_1_3', 'street_4_6', 'street_7_9', 'street_10_12', 'street_13_15', 'street_16_18', 'street_19_21', 'street_22_24', 'street_25_27', 'street_28_30', 'street_31_33', 'street_34_36']);
                            } else if (item.id === 'external') {
                              setSelectedExternalBets(['high', 'low', 'even', 'odd', 'red', 'black']);
                            }
                          }}
                          className={`py-3 px-3 rounded-xl text-xs font-bold transition-all text-center leading-snug cursor-pointer min-h-[42px] flex items-center justify-center ${
                            confluenceType === item.id 
                              ? 'bg-[#c6a34f] text-black shadow-md font-black tracking-wider' 
                              : 'text-white/70 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sub-Seleção de Alvos Específicos por Categoria */}
                  {confluenceType === 'external' && (
                    <div className="space-y-2 bg-[#0a0a0a] p-3 rounded-xl border border-white/5">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs uppercase font-bold text-white/70">Apostas Externas Ativas:</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedExternalBets(['high', 'low', 'even', 'odd', 'red', 'black'])}
                            className="text-xs font-bold text-[#c6a34f] hover:underline"
                          >
                            Todas
                          </button>
                          <span className="text-xs text-white/20">|</span>
                          <button
                            type="button"
                            onClick={() => setSelectedExternalBets([])}
                            className="text-xs font-bold text-red-400 hover:underline"
                          >
                            Limpar
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {[
                          { id: 'high', label: 'Alto (19-36)' },
                          { id: 'low', label: 'Baixo (1-18)' },
                          { id: 'even', label: 'Par' },
                          { id: 'odd', label: 'Ímpar' },
                          { id: 'red', label: 'Vermelho' },
                          { id: 'black', label: 'Preto' }
                        ].map(bet => {
                          const isSelected = selectedExternalBets.includes(bet.id);
                          return (
                            <button
                              type="button"
                              key={bet.id}
                              onClick={() => {
                                setUseRacetrackConfluence(true);
                                setSelectedExternalBets(prev => 
                                  prev.includes(bet.id) ? prev.filter(x => x !== bet.id) : [...prev, bet.id]
                                );
                              }}
                              className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all border leading-normal ${
                                isSelected 
                                  ? 'bg-[#c6a34f]/20 border-[#c6a34f] text-[#c6a34f]' 
                                  : 'bg-black/40 border-white/5 text-white/40 hover:text-white'
                              }`}
                            >
                              {bet.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {confluenceType === 'dozens' && (
                    <div className="space-y-2 bg-[#0a0a0a] p-3 rounded-xl border border-white/5">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs uppercase font-bold text-white/70">Dúzias Ativas (Aplica a Todas as Dúzias por Padrão):</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedDozensColumns(['dozen_1', 'dozen_2', 'dozen_3'])}
                            className="text-xs font-bold text-[#c6a34f] hover:underline"
                          >
                            Todas as Dúzias
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                        {[
                          { id: 'dozen_1', label: '1ª Dúzia (1-12)' },
                          { id: 'dozen_2', label: '2ª Dúzia (13-24)' },
                          { id: 'dozen_3', label: '3ª Dúzia (25-36)' }
                        ].map(bet => {
                          const isSelected = selectedDozensColumns.includes(bet.id);
                          return (
                            <button
                              type="button"
                              key={bet.id}
                              onClick={() => {
                                setUseRacetrackConfluence(true);
                                setSelectedDozensColumns(prev => 
                                  prev.includes(bet.id) ? prev.filter(x => x !== bet.id) : [...prev, bet.id]
                                );
                              }}
                              className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all border leading-normal ${
                                isSelected 
                                  ? 'bg-[#c6a34f]/20 border-[#c6a34f] text-[#c6a34f]' 
                                  : 'bg-black/40 border-white/5 text-white/40 hover:text-white'
                              }`}
                            >
                              {bet.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {confluenceType === 'columns' && (
                    <div className="space-y-2 bg-[#0a0a0a] p-3 rounded-xl border border-white/5">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs uppercase font-bold text-white/70">Colunas Ativas (Aplica a Todas as Colunas por Padrão):</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedDozensColumns(['col_1', 'col_2', 'col_3'])}
                            className="text-xs font-bold text-[#c6a34f] hover:underline"
                          >
                            Todas as Colunas
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                        {[
                          { id: 'col_1', label: '1ª Coluna' },
                          { id: 'col_2', label: '2ª Coluna' },
                          { id: 'col_3', label: '3ª Coluna' }
                        ].map(bet => {
                          const isSelected = selectedDozensColumns.includes(bet.id);
                          return (
                            <button
                              type="button"
                              key={bet.id}
                              onClick={() => {
                                setUseRacetrackConfluence(true);
                                setSelectedDozensColumns(prev => 
                                  prev.includes(bet.id) ? prev.filter(x => x !== bet.id) : [...prev, bet.id]
                                );
                              }}
                              className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all border leading-normal ${
                                isSelected 
                                  ? 'bg-[#c6a34f]/20 border-[#c6a34f] text-[#c6a34f]' 
                                  : 'bg-black/40 border-white/5 text-white/40 hover:text-white'
                              }`}
                            >
                              {bet.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {confluenceType === 'lines' && (
                    <div className="space-y-2 bg-[#0a0a0a] p-3 rounded-xl border border-white/5">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs uppercase font-bold text-white/70">Ruas Duplas Ativas (Aplica a Todas por Padrão):</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedLinesStreets(['line_1_6', 'line_7_12', 'line_13_18', 'line_19_24', 'line_25_30', 'line_31_36'])}
                            className="text-xs font-bold text-[#c6a34f] hover:underline"
                          >
                            Todas as Linhas
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-44 overflow-y-auto p-1 custom-scrollbar">
                        {[
                          { id: 'line_1_6', label: 'Linha 1-6' },
                          { id: 'line_7_12', label: 'Linha 7-12' },
                          { id: 'line_13_18', label: 'Linha 13-18' },
                          { id: 'line_19_24', label: 'Linha 19-24' },
                          { id: 'line_25_30', label: 'Linha 25-30' },
                          { id: 'line_31_36', label: 'Linha 31-36' }
                        ].map(bet => {
                          const isSelected = selectedLinesStreets.includes(bet.id);
                          return (
                            <button
                              type="button"
                              key={bet.id}
                              onClick={() => {
                                setUseRacetrackConfluence(true);
                                setSelectedLinesStreets(prev => 
                                  prev.includes(bet.id) ? prev.filter(x => x !== bet.id) : [...prev, bet.id]
                                );
                              }}
                              className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all border leading-normal ${
                                isSelected 
                                  ? 'bg-[#c6a34f]/20 border-[#c6a34f] text-[#c6a34f]' 
                                  : 'bg-black/40 border-white/5 text-white/40 hover:text-white'
                              }`}
                            >
                              {bet.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {confluenceType === 'streets' && (
                    <div className="space-y-2 bg-[#0a0a0a] p-3 rounded-xl border border-white/5">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs uppercase font-bold text-white/70">Ruas Ativas (Aplica a Todas por Padrão):</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedLinesStreets(['street_1_3', 'street_4_6', 'street_7_9', 'street_10_12', 'street_13_15', 'street_16_18', 'street_19_21', 'street_22_24', 'street_25_27', 'street_28_30', 'street_31_33', 'street_34_36'])}
                            className="text-xs font-bold text-[#c6a34f] hover:underline"
                          >
                            Todas as Ruas
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-44 overflow-y-auto p-1 custom-scrollbar">
                        {[
                          { id: 'street_1_3', label: 'Rua 1-3' },
                          { id: 'street_4_6', label: 'Rua 4-6' },
                          { id: 'street_7_9', label: 'Rua 7-9' },
                          { id: 'street_10_12', label: 'Rua 10-12' },
                          { id: 'street_13_15', label: 'Rua 13-15' },
                          { id: 'street_16_18', label: 'Rua 16-18' },
                          { id: 'street_19_21', label: 'Rua 19-21' },
                          { id: 'street_22_24', label: 'Rua 22-24' },
                          { id: 'street_25_27', label: 'Rua 25-27' },
                          { id: 'street_28_30', label: 'Rua 28-30' },
                          { id: 'street_31_33', label: 'Rua 31-33' },
                          { id: 'street_34_36', label: 'Rua 34-36' }
                        ].map(bet => {
                          const isSelected = selectedLinesStreets.includes(bet.id);
                          return (
                            <button
                              type="button"
                              key={bet.id}
                              onClick={() => {
                                setUseRacetrackConfluence(true);
                                setSelectedLinesStreets(prev => 
                                  prev.includes(bet.id) ? prev.filter(x => x !== bet.id) : [...prev, bet.id]
                                );
                              }}
                              className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all border leading-normal ${
                                isSelected 
                                  ? 'bg-[#c6a34f]/20 border-[#c6a34f] text-[#c6a34f]' 
                                  : 'bg-black/40 border-white/5 text-white/40 hover:text-white'
                              }`}
                            >
                              {bet.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Seletor de Vizinhos (0 a 9) */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs uppercase font-bold text-white/60">Seletor de Vizinhos no Racetrack (0 a 9)</span>
                      <span className="text-xs font-mono font-bold text-[#c6a34f]">{globalNeighborsCount} Vizinhos</span>
                    </div>
                    <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5 bg-[#0a0a0a] p-1.5 rounded-xl border border-white/5">
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                        <button
                          type="button"
                          key={n}
                          onClick={() => {
                            setGlobalNeighborsCount(n);
                            setUseRacetrackConfluence(true);
                          }}
                          className={`h-8 rounded-lg flex items-center justify-center text-xs font-mono font-bold transition-all ${
                            globalNeighborsCount === n 
                              ? 'bg-[#c6a34f] text-black font-extrabold shadow-sm' 
                              : 'text-white/50 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          {n}V
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Card Informativo do Escopo dos Alvos do Gatilho */}
                  <div className="p-3.5 bg-[#0a0a0a] rounded-xl border border-white/5 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#c6a34f] animate-pulse"></div>
                      <span className="text-xs font-bold uppercase text-[#c6a34f]">
                        Gatilho Ativo: {
                          confluenceType === 'terminals' ? 'Terminais (T0 - T9)' :
                          confluenceType === 'numbers' ? 'Números Individuais (0 a 36)' :
                          confluenceType === 'external' ? 'Apostas Externas (Alto/Baixo, Par/Ímpar, Cor)' :
                          confluenceType === 'dozens' ? 'Todas as Dúzias (1ª, 2ª e 3ª Dúzia)' :
                          confluenceType === 'columns' ? 'Todas as Colunas (1ª, 2ª e 3ª Coluna)' :
                          confluenceType === 'lines' ? 'Todas as Ruas Duplas' :
                          confluenceType === 'streets' ? 'Todas as Ruas' :
                          'Todas as Apostas da Mesa'
                        }
                      </span>
                    </div>
                    <p className="text-xs text-white/60 leading-relaxed">
                      O gatilho monitora os alvos configurados da mesa, avaliando dinamicamente a <strong className="text-[#c6a34f]">ausência</strong> ou <strong className="text-[#c6a34f]">frequência</strong> no histórico da roleta com {globalNeighborsCount} vizinhos de expansão.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-[#111111] p-5 rounded-2xl border border-[#c6a34f]/10 shadow-inner">
               <h3 className="text-xs font-bold uppercase tracking-widest text-[#c6a34f] mb-4 flex items-center gap-2">
                 <LayoutIcon size={14} /> Projeção de Retorno
               </h3>
               <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-white/50 uppercase">Investimento</span>
                    <span className="font-mono text-white font-bold">{totalBet} U</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-white/50 uppercase">Cobertura</span>
                    <span className="font-mono text-green-500 font-bold">{((stats.winners / 37) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-px bg-white/5"></div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold uppercase tracking-widest text-[#c6a34f]">Ganho Máximo</span>
                    <span className="text-xl font-black text-green-500">
                      {stats.max > 0 ? `${stats.max} U` : '0 U'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs uppercase font-bold text-red-500">Perda Máxima</span>
                    <span className="text-xs font-mono text-red-500 font-bold">
                      {Math.abs(stats.min)} U
                    </span>
                  </div>
                  <p className="text-xs text-white/40 italic text-center leading-relaxed">
                    {stats.winners > 0 
                      ? `${stats.winners} de 37 possibilidades de lucro.` 
                      : 'Adicione fichas para ver projeção.'}
                  </p>
               </div>
            </div>

            <div className="bg-red-500/5 p-4 rounded-2xl border border-red-500/10">
               <h3 className="text-xs font-bold uppercase tracking-widest text-red-500 mb-3 flex items-center gap-2">
                 <Trash2 size={14} /> Reset Rápido
               </h3>
               <button 
                onClick={clearBets}
                className="w-full py-2.5 rounded-lg bg-red-500/10 text-red-500 text-xs font-bold uppercase tracking-wider hover:bg-red-500/20 transition-all border border-red-500/20"
               >
                 Limpar todas as fichas
               </button>
            </div>
          </div>
        </div>

        {/* Modal de Importação/Exportação JSON */}
        {showJsonModal && (
          <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-[#111111] w-full max-w-[600px] rounded-2xl border border-[#c6a34f]/30 p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#c6a34f] flex items-center gap-2">
                  {showJsonModal === 'export' ? <Download size={16} /> : <Upload size={16} />}
                  {showJsonModal === 'export' ? 'Exportar Estratégia (JSON)' : 'Importar Estratégia (JSON)'}
                </h3>
                <button 
                  onClick={() => {
                    setShowJsonModal(null);
                    setJsonError('');
                  }}
                  className="p-1.5 bg-white/5 rounded-lg text-white/50 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <p className="text-xs text-white/60">
                {showJsonModal === 'export' 
                  ? 'Copie a estrutura JSON abaixo para salvar ou compartilhar suas configurações de apostas e gatilhos:'
                  : 'Cole o código JSON da estratégia que deseja importar para o editor:'}
              </p>

              <textarea
                value={jsonInput}
                onChange={(e) => {
                  setJsonInput(e.target.value);
                  if (jsonError) setJsonError('');
                }}
                readOnly={showJsonModal === 'export'}
                rows={10}
                placeholder='{\n  "name": "Minha Estratégia",\n  "gameType": "roulette",\n  "maxGale": 2,\n  ...\n}'
                className="w-full bg-black border border-white/10 focus:border-[#c6a34f] rounded-xl p-3 text-xs font-mono text-white/90 outline-none resize-none"
              />

              {jsonError && (
                <div className="p-2.5 bg-red-950/80 border border-red-500/40 rounded-xl text-red-300 text-xs font-semibold">
                  {jsonError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                {showJsonModal === 'export' ? (
                  <>
                    <button
                      onClick={() => {
                        if (navigator.clipboard) {
                          navigator.clipboard.writeText(jsonInput);
                          showToast('JSON copiado!');
                          setShowJsonModal(null);
                        }
                      }}
                      className="px-4 py-2 bg-[#c6a34f] text-black font-bold uppercase tracking-wider text-xs rounded-xl hover:scale-105 transition-all shadow cursor-pointer"
                    >
                      Copiar JSON
                    </button>
                    <button
                      onClick={() => setShowJsonModal(null)}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-bold uppercase tracking-wider text-xs rounded-xl transition-all cursor-pointer"
                    >
                      Fechar
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleImportJson}
                      className="px-4 py-2 bg-[#c6a34f] text-black font-bold uppercase tracking-wider text-xs rounded-xl hover:scale-105 transition-all shadow cursor-pointer"
                    >
                      Importar Agora
                    </button>
                    <button
                      onClick={() => {
                        setShowJsonModal(null);
                        setJsonError('');
                      }}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-bold uppercase tracking-wider text-xs rounded-xl transition-all cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StrategyEditor;
