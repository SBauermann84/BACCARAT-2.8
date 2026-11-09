import { GameType, GameResult } from '../types';
import { COLOR_MAP, ROULETTE_ZONES } from '../constants';
import { safeStorage } from '../utils/safeStorage';

export interface HistoricalRecommendation {
  entry: string;
  patternName: string;
  confidence: number;
  winRate: number;
  count: number;
  dimension: string;
  sequenceLength: number;
  category: string;
  entryNumbers?: number[];
  unitsRequired?: number;
}

interface PatternTransition {
  occurrences: number;
  outcomes: Record<string, number>;
  lastUpdated: number;
}

// In-memory fast pattern graph for sub-millisecond lookups
const inMemoryPatterns: Record<string, PatternTransition> = {};
let isHydrated = false;

// Helper feature extractors for Roulette
const getRouletteFeatures = (num: number) => {
  const n = Number(num);
  if (isNaN(n) || n < 0 || n > 36) return null;

  const isRed = COLOR_MAP.ROULETTE.RED.includes(n);
  const isBlack = COLOR_MAP.ROULETTE.BLACK.includes(n);
  const color = n === 0 ? 'zero' : isRed ? 'red' : isBlack ? 'black' : 'zero';

  const dozen = n === 0 ? 'd0' : n <= 12 ? 'd1' : n <= 24 ? 'd2' : 'd3';
  const column = n === 0 ? 'c0' : n % 3 === 1 ? 'c1' : n % 3 === 2 ? 'c2' : 'c3';
  const parity = n === 0 ? 'zero' : n % 2 === 0 ? 'even' : 'odd';
  const highlow = n === 0 ? 'zero' : n <= 18 ? 'low' : 'high';
  const terminal = `t${n % 10}`;

  let zone = 'none';
  if (ROULETTE_ZONES.ZERO_SPIEL.includes(n)) zone = 'ZERO_SPIEL';
  else if (ROULETTE_ZONES.VOISINS.includes(n)) zone = 'VOISINS';
  else if (ROULETTE_ZONES.TIERS.includes(n)) zone = 'TIERS';
  else if (ROULETTE_ZONES.ORPHELINS.includes(n)) zone = 'ORPHELINS';

  return {
    raw: `num_${n}`,
    dozen,
    column,
    color,
    parity,
    highlow,
    terminal,
    zone
  };
};

// Helper feature extractor for Baccarat
const getBaccaratFeatures = (res: any) => {
  const s = String(res).toUpperCase().trim();
  let outcome = 'P';
  if (s === 'B' || s === 'BANKER' || s === 'BANCA' || s === 'BANQUEIRO') outcome = 'B';
  else if (s === 'T' || s === 'TIE' || s === 'EMPATE' || s === 'E') outcome = 'T';
  else outcome = 'P';

  return {
    outcome
  };
};

const DOZEN_NUMBERS: Record<string, number[]> = {
  d1: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  d2: [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
  d3: [25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36]
};

const COLUMN_NUMBERS: Record<string, number[]> = {
  c1: [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
  c2: [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
  c3: [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36]
};

export const learningService = {
  /**
   * Ensure pattern graph is loaded from localStorage safely
   */
  hydrate() {
    if (isHydrated) return;
    try {
      const cached = safeStorage.getItem('casino_historical_patterns_v2');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object') {
          Object.assign(inMemoryPatterns, parsed);
        }
      }
      isHydrated = true;
    } catch (e) {
      console.warn('[learningService] Hydration error (recovering with fresh graph):', e);
      isHydrated = true;
    }
  },

  /**
   * Save compact pattern graph to localStorage with safe size budgeting
   */
  persist() {
    try {
      // 1. Prune in-memory pattern graph to keep only top 200 most reliable / frequent patterns
      const entries = Object.entries(inMemoryPatterns);
      if (entries.length === 0) return;

      // Filter out single-occurrence noise and sort by occurrences desc & recent timestamp
      const ranked = entries
        .filter(([_, node]) => (node.occurrences || 0) >= 2)
        .sort((a, b) => (b[1].occurrences || 0) - (a[1].occurrences || 0) || (b[1].lastUpdated || 0) - (a[1].lastUpdated || 0))
        .slice(0, 200);

      const compactPatterns: Record<string, PatternTransition> = {};
      ranked.forEach(([key, val]) => {
        compactPatterns[key] = val;
      });

      safeStorage.setItem('casino_historical_patterns_v2', JSON.stringify(compactPatterns));
    } catch (e) {
      console.warn('[learningService] Persist warning:', e);
    }
  },

  /**
   * Record a transition from past sequences to the outcome for all dimensions
   */
  recordTransition(gameType: string, dimension: string, sequence: string[], nextOutcome: string) {
    if (!sequence || sequence.length < 2 || !nextOutcome) return;
    const seqKey = sequence.join('-');
    const patternKey = `${gameType}_${dimension}_${seqKey}`;

    if (!inMemoryPatterns[patternKey]) {
      // Prevent in-memory unbounded heap bloat: if exceeds 1500 keys, prune lowest occurrence patterns
      const keys = Object.keys(inMemoryPatterns);
      if (keys.length > 1500) {
        const sortedKeys = keys.sort((a, b) => (inMemoryPatterns[a]?.occurrences || 0) - (inMemoryPatterns[b]?.occurrences || 0));
        // Delete bottom 400 keys
        for (let i = 0; i < 400; i++) {
          delete inMemoryPatterns[sortedKeys[i]];
        }
      }

      inMemoryPatterns[patternKey] = {
        occurrences: 1,
        outcomes: { [nextOutcome]: 1 },
        lastUpdated: Date.now()
      };
    } else {
      const node = inMemoryPatterns[patternKey];
      node.occurrences += 1;
      node.outcomes[nextOutcome] = (node.outcomes[nextOutcome] || 0) + 1;
      node.lastUpdated = Date.now();
    }
  },

  /**
   * Ingest and index an entire dataset of game results across all dimensions
   */
  indexResults(results: GameResult[], gameType: GameType) {
    if (!results || results.length < 3) return;
    this.hydrate();

    // Ensure chronological order (oldest to newest)
    const sorted = [...results].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    if (gameType === GameType.ROULETTE) {
      const featureList: Array<ReturnType<typeof getRouletteFeatures>> = [];
      for (const r of sorted) {
        const f = getRouletteFeatures(Number(r.result));
        if (f) featureList.push(f);
      }

      const dimensions = ['dozen', 'column', 'color', 'parity', 'highlow', 'terminal', 'zone', 'raw'] as const;

      for (const dim of dimensions) {
        // Slide windows of lengths 2, 3, 4
        for (let k = 2; k <= 4; k++) {
          for (let i = k; i < featureList.length; i++) {
            const seq = featureList.slice(i - k, i).map(item => item ? item[dim] : '');
            const nextItem = featureList[i];
            if (nextItem && !seq.includes('zero') && !seq.includes('d0') && !seq.includes('c0') && !seq.includes('none')) {
              const nextVal = nextItem[dim];
              if (nextVal !== 'zero' && nextVal !== 'd0' && nextVal !== 'c0' && nextVal !== 'none') {
                this.recordTransition(gameType, dim, seq, nextVal);
              }
            }
          }
        }
      }
    } else {
      // Baccarat
      const baccOutcomes: string[] = [];
      for (const r of sorted) {
        const f = getBaccaratFeatures(r.result);
        if (f) baccOutcomes.push(f.outcome);
      }

      for (let k = 2; k <= 5; k++) {
        for (let i = k; i < baccOutcomes.length; i++) {
          const seq = baccOutcomes.slice(i - k, i);
          const nextVal = baccOutcomes[i];
          this.recordTransition(gameType, 'outcome', seq, nextVal);
        }
      }
    }

    this.persist();
  },

  /**
   * Sync all available historical data (current session, past days, backtest data)
   */
  syncAllHistoricalData(
    historyRoulette: GameResult[] = [],
    historyBaccarat: GameResult[] = [],
    dailyHistory: any[] = [],
    backtestHistoryRoulette: GameResult[] = [],
    backtestHistoryBaccarat: GameResult[] = []
  ) {
    this.hydrate();

    // Collect all roulette results
    const pastRouletteOps = (dailyHistory || [])
      .filter(record => record.gameType === GameType.ROULETTE)
      .flatMap(record => record.archivedOperations || []);

    const allRoulette = [...pastRouletteOps, ...backtestHistoryRoulette, ...historyRoulette];
    const uniqueRouletteMap = new Map<string, GameResult>();
    allRoulette.forEach((r, idx) => {
      const key = r.id || `${r.timestamp}_${r.result}_${idx}`;
      uniqueRouletteMap.set(key, r);
    });
    this.indexResults(Array.from(uniqueRouletteMap.values()), GameType.ROULETTE);

    // Collect all baccarat results
    const pastBaccaratOps = (dailyHistory || [])
      .filter(record => record.gameType === GameType.BACCARAT)
      .flatMap(record => record.archivedOperations || []);

    const allBaccarat = [...pastBaccaratOps, ...backtestHistoryBaccarat, ...historyBaccarat];
    const uniqueBaccaratMap = new Map<string, GameResult>();
    allBaccarat.forEach((r, idx) => {
      const key = r.id || `${r.timestamp}_${r.result}_${idx}`;
      uniqueBaccaratMap.set(key, r);
    });
    this.indexResults(Array.from(uniqueBaccaratMap.values()), GameType.BACCARAT);
  },

  /**
   * Record a single live pattern when a new result is added
   */
  async recordPattern(gameType: string, sequence: string[], outcome: string, _isWin?: boolean) {
    this.hydrate();
    if (!sequence || sequence.length < 2 || !outcome) return;

    if (gameType === GameType.ROULETTE) {
      const fullNumbers = [...sequence.map(Number), Number(outcome)].filter(n => !isNaN(n));
      if (fullNumbers.length >= 3) {
        const featureList = fullNumbers.map(n => getRouletteFeatures(n)).filter(Boolean);
        const dimensions = ['dozen', 'column', 'color', 'parity', 'highlow', 'terminal', 'zone', 'raw'] as const;

        for (const dim of dimensions) {
          for (let k = 2; k <= Math.min(4, featureList.length - 1); k++) {
            const seq = featureList.slice(featureList.length - 1 - k, featureList.length - 1).map(f => f![dim]);
            const nextVal = featureList[featureList.length - 1]![dim];
            if (!seq.includes('zero') && !seq.includes('d0') && !seq.includes('c0') && !seq.includes('none')) {
              if (nextVal !== 'zero' && nextVal !== 'd0' && nextVal !== 'c0' && nextVal !== 'none') {
                this.recordTransition(gameType, dim, seq, nextVal);
              }
            }
          }
        }
      }
    } else {
      const baccOutcomes = [...sequence.map(s => getBaccaratFeatures(s).outcome), getBaccaratFeatures(outcome).outcome];
      for (let k = 2; k <= Math.min(5, baccOutcomes.length - 1); k++) {
        const seq = baccOutcomes.slice(baccOutcomes.length - 1 - k, baccOutcomes.length - 1);
        const nextVal = baccOutcomes[baccOutcomes.length - 1];
        this.recordTransition(gameType, 'outcome', seq, nextVal);
      }
    }

    this.persist();
  },

  /**
   * Find the most assertive historical pattern for the current history synchronously (0ms latency)
   */
  getRecommendedEntrySync(gameType: string, historyOrSequence: any[]): HistoricalRecommendation | null {
    this.hydrate();
    if (!historyOrSequence || historyOrSequence.length < 2) return null;

    const candidates: HistoricalRecommendation[] = [];

    if (gameType === GameType.ROULETTE) {
      // Normalize history to numbers (most recent first)
      const numList: number[] = historyOrSequence.map(item => {
        if (typeof item === 'object' && item !== null && 'result' in item) {
          return Number(item.result);
        }
        return Number(item);
      }).filter(n => !isNaN(n));

      if (numList.length < 2) return null;

      // Extract features for the recent numbers (chronological: oldest to latest in the window)
      const recentSpins = numList.slice(0, 8).reverse();
      const features = recentSpins.map(n => getRouletteFeatures(n)).filter(Boolean);

      const dimensions: Array<{ dim: string; label: string }> = [
        { dim: 'dozen', label: 'Dúzias' },
        { dim: 'column', label: 'Colunas' },
        { dim: 'color', label: 'Cores' },
        { dim: 'parity', label: 'Paridade' },
        { dim: 'highlow', label: 'Altos/Baixos' },
        { dim: 'terminal', label: 'Terminais' },
        { dim: 'zone', label: 'Zonas da Roda' }
      ];

      for (const { dim, label } of dimensions) {
        for (let k = 4; k >= 2; k--) {
          if (features.length < k) continue;
          const seq = features.slice(features.length - k).map(f => (f as any)[dim]);
          if (seq.includes('zero') || seq.includes('d0') || seq.includes('c0') || seq.includes('none')) continue;

          const seqKey = seq.join('-');
          const patternKey = `${gameType}_${dim}_${seqKey}`;
          const node = inMemoryPatterns[patternKey];

          if (node && node.occurrences >= 2) {
            // Find most frequent next outcome
            let bestOutcome = '';
            let bestCount = 0;
            let total = 0;

            for (const [out, count] of Object.entries(node.outcomes)) {
              total += count;
              if (count > bestCount) {
                bestCount = count;
                bestOutcome = out;
              }
            }

            const winRate = total > 0 ? (bestCount / total) * 100 : 0;

            if (winRate >= 65 && bestCount >= 2) {
              const mapped = mapRouletteOutcomeToEntry(dim, bestOutcome, seq, label, winRate, bestCount, k);
              if (mapped) {
                candidates.push(mapped);
              }
            }
          }
        }
      }
    } else {
      // Baccarat
      const baccOutcomes: string[] = historyOrSequence.map(item => {
        if (typeof item === 'object' && item !== null && 'result' in item) {
          return getBaccaratFeatures(item.result).outcome;
        }
        return getBaccaratFeatures(item).outcome;
      });

      if (baccOutcomes.length < 2) return null;

      const recentHands = baccOutcomes.slice(0, 8).reverse();

      for (let k = 5; k >= 2; k--) {
        if (recentHands.length < k) continue;
        const seq = recentHands.slice(recentHands.length - k);
        const seqKey = seq.join('-');
        const patternKey = `${gameType}_outcome_${seqKey}`;
        const node = inMemoryPatterns[patternKey];

        if (node && node.occurrences >= 2) {
          let bestOutcome = '';
          let bestCount = 0;
          let total = 0;

          for (const [out, count] of Object.entries(node.outcomes)) {
            total += count;
            if (count > bestCount) {
              bestCount = count;
              bestOutcome = out;
            }
          }

          const winRate = total > 0 ? (bestCount / total) * 100 : 0;

          if (winRate >= 65 && bestCount >= 2) {
            const entry = bestOutcome === 'B' ? 'BANKER' : bestOutcome === 'P' ? 'PLAYER' : 'TIE';
            const displaySeq = seq.map(s => s === 'B' ? 'Banca' : s === 'P' ? 'Player' : 'Empate').join(' ➔ ');
            candidates.push({
              entry,
              patternName: `Base Histórica: [${displaySeq}] ➔ ${entry} (${bestCount}x)`,
              confidence: Math.round(winRate),
              winRate: Math.round(winRate),
              count: bestCount,
              dimension: 'outcome',
              sequenceLength: k,
              category: 'baccarat',
              unitsRequired: 1
            });
          }
        }
      }
    }

    if (candidates.length === 0) return null;

    // Rank candidates by composite score: winRate * (1 + 0.2 * log2(count)) * (1 + 0.1 * sequenceLength)
    candidates.sort((a, b) => {
      const scoreA = a.winRate * (1 + 0.2 * Math.log2(a.count)) * (1 + 0.1 * a.sequenceLength);
      const scoreB = b.winRate * (1 + 0.2 * Math.log2(b.count)) * (1 + 0.1 * b.sequenceLength);
      return scoreB - scoreA;
    });

    return candidates[0];
  },

  /**
   * Find the most assertive historical pattern for the current history (Async wrapper)
   */
  async getRecommendedEntry(gameType: string, historyOrSequence: any[]): Promise<HistoricalRecommendation | null> {
    return this.getRecommendedEntrySync(gameType, historyOrSequence);
  }
};

function mapRouletteOutcomeToEntry(
  dim: string,
  outcome: string,
  seq: string[],
  categoryLabel: string,
  winRate: number,
  count: number,
  k: number
): HistoricalRecommendation | null {
  let entry = '';
  let entryNumbers: number[] = [];
  let unitsRequired = 1;
  let cleanSeq = seq.join(' ➔ ');

  if (dim === 'dozen') {
    if (outcome === 'd1') {
      entry = 'Dúzia 1';
      entryNumbers = DOZEN_NUMBERS.d1;
    } else if (outcome === 'd2') {
      entry = 'Dúzia 2';
      entryNumbers = DOZEN_NUMBERS.d2;
    } else if (outcome === 'd3') {
      entry = 'Dúzia 3';
      entryNumbers = DOZEN_NUMBERS.d3;
    } else return null;
    cleanSeq = seq.map(s => s === 'd1' ? '1ª Dúzia' : s === 'd2' ? '2ª Dúzia' : '3ª Dúzia').join(' ➔ ');
    unitsRequired = 1;
  } else if (dim === 'column') {
    if (outcome === 'c1') {
      entry = 'Coluna 1';
      entryNumbers = COLUMN_NUMBERS.c1;
    } else if (outcome === 'c2') {
      entry = 'Coluna 2';
      entryNumbers = COLUMN_NUMBERS.c2;
    } else if (outcome === 'c3') {
      entry = 'Coluna 3';
      entryNumbers = COLUMN_NUMBERS.c3;
    } else return null;
    cleanSeq = seq.map(s => s === 'c1' ? '1ª Coluna' : s === 'c2' ? '2ª Coluna' : '3ª Coluna').join(' ➔ ');
    unitsRequired = 1;
  } else if (dim === 'color') {
    if (outcome === 'red') {
      entry = 'Red';
      entryNumbers = COLOR_MAP.ROULETTE.RED;
    } else if (outcome === 'black') {
      entry = 'Black';
      entryNumbers = COLOR_MAP.ROULETTE.BLACK;
    } else return null;
    cleanSeq = seq.map(s => s === 'red' ? 'Vermelho' : 'Preto').join(' ➔ ');
    unitsRequired = 1;
  } else if (dim === 'parity') {
    if (outcome === 'even') {
      entry = 'Par';
      entryNumbers = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36];
    } else if (outcome === 'odd') {
      entry = 'Ímpar';
      entryNumbers = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35];
    } else return null;
    cleanSeq = seq.map(s => s === 'even' ? 'Par' : 'Ímpar').join(' ➔ ');
    unitsRequired = 1;
  } else if (dim === 'highlow') {
    if (outcome === 'low') {
      entry = 'Menor (1-18)';
      entryNumbers = Array.from({ length: 18 }, (_, i) => i + 1);
    } else if (outcome === 'high') {
      entry = 'Maior (19-36)';
      entryNumbers = Array.from({ length: 18 }, (_, i) => i + 19);
    } else return null;
    cleanSeq = seq.map(s => s === 'low' ? '1-18' : '19-36').join(' ➔ ');
    unitsRequired = 1;
  } else if (dim === 'terminal') {
    const termNum = parseInt(outcome.replace('t', ''), 10);
    if (isNaN(termNum)) return null;
    entry = `Terminal ${termNum}`;
    entryNumbers = Array.from({ length: 37 }, (_, i) => i).filter(n => n % 10 === termNum);
    unitsRequired = entryNumbers.length;
    cleanSeq = seq.map(s => `T${s.replace('t', '')}`).join(' ➔ ');
  } else if (dim === 'zone') {
    if (outcome === 'VOISINS') {
      entry = 'Vizinhos de Zero';
      entryNumbers = ROULETTE_ZONES.VOISINS;
      unitsRequired = 9;
    } else if (outcome === 'TIERS') {
      entry = 'Tiers do Cilindro';
      entryNumbers = ROULETTE_ZONES.TIERS;
      unitsRequired = 6;
    } else if (outcome === 'ORPHELINS') {
      entry = 'Orphelins';
      entryNumbers = ROULETTE_ZONES.ORPHELINS;
      unitsRequired = 5;
    } else if (outcome === 'ZERO_SPIEL') {
      entry = 'Zero Spiel';
      entryNumbers = ROULETTE_ZONES.ZERO_SPIEL;
      unitsRequired = 4;
    } else return null;
    cleanSeq = seq.join(' ➔ ');
  } else {
    return null;
  }

  return {
    entry,
    patternName: `Base Histórica (${categoryLabel}): [${cleanSeq}] ➔ ${entry} (${count}x)`,
    confidence: Math.round(winRate),
    winRate: Math.round(winRate),
    count,
    dimension: dim,
    sequenceLength: k,
    category: dim,
    entryNumbers,
    unitsRequired
  };
}
