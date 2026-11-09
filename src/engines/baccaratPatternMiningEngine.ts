import { GameResult, Strategy, GameType } from '../types';
import { 
  parseBaccaratResult, 
  buildBigRoad, 
  computeDerivedRoadSignals, 
  BaccaratOutcome,
  BigRoadCell
} from '../utils/baccaratRoads';

export type RoadSource = 'big_road' | 'big_eye' | 'small_road' | 'cockroach' | 'confluence' | 'bead_plate';

export interface MinedBaccaratPattern {
  id: string;
  name: string;
  roadSource: RoadSource;
  roadSourceLabel: string;
  description: string;
  predictedEntry: 'PLAYER' | 'BANKER' | 'TIE';
  totalOccurrences: number;
  wins: number;
  losses: number;
  ties: number;
  assertiveness: number; // Win rate percentage 0 - 100
  confidence: number;
  isActive: boolean;
  ruleCode: string;
  triggerCondition: (history: GameResult[]) => 'PLAYER' | 'BANKER' | 'TIE' | null;
}

/**
 * Evaluates history up to index `endIdx` (non-inclusive) and determines if a pattern fires.
 * If fired, returns the recommended entry ('PLAYER' | 'BANKER' | 'TIE').
 */
type PatternEvaluator = (
  subHistory: GameResult[],
  bigRoadCells: BigRoadCell[],
  bigEyeSignals: ('RED' | 'BLUE')[],
  smallRoadSignals: ('RED' | 'BLUE')[],
  cockroachSignals: ('RED' | 'BLUE')[]
) => 'PLAYER' | 'BANKER' | 'TIE' | null;

interface CandidatePatternSpec {
  id: string;
  nameTemplate: string;
  roadSource: RoadSource;
  roadSourceLabel: string;
  description: string;
  evaluator: PatternEvaluator;
}

/**
 * Pre-defined candidates covering Big Road, Big Eye Boy, Small Road, Cockroach Road,
 * Multi-Road Confluences, and Bead Plate N-Grams.
 */
const CANDIDATE_PATTERNS: CandidatePatternSpec[] = [
  // 1. GRANDE ESTRADA (BIG ROAD) PATTERNS
  {
    id: 'bigroad_dragon_banker',
    nameTemplate: 'Grande Estrada: Sequência Dragão Banker (Repetição)',
    roadSource: 'big_road',
    roadSourceLabel: 'Grande Estrada',
    description: 'Detecta sequência contínua de Banker (3+ seguidos) na Grande Estrada e projeta continuação do Dragão.',
    evaluator: (subHist) => {
      if (subHist.length < 3) return null;
      const recent = subHist.slice(-3).map(h => parseBaccaratResult(h.result));
      if (recent.every(r => r === 'B')) return 'BANKER';
      return null;
    }
  },
  {
    id: 'bigroad_dragon_player',
    nameTemplate: 'Grande Estrada: Sequência Dragão Player (Repetição)',
    roadSource: 'big_road',
    roadSourceLabel: 'Grande Estrada',
    description: 'Detecta sequência contínua de Player (3+ seguidos) na Grande Estrada e projeta continuação do Dragão.',
    evaluator: (subHist) => {
      if (subHist.length < 3) return null;
      const recent = subHist.slice(-3).map(h => parseBaccaratResult(h.result));
      if (recent.every(r => r === 'P')) return 'PLAYER';
      return null;
    }
  },
  {
    id: 'bigroad_ping_pong',
    nameTemplate: 'Grande Estrada: Alternância Ping-Pong (P-B-P-B)',
    roadSource: 'big_road',
    roadSourceLabel: 'Grande Estrada',
    description: 'Identifica ciclos de alternância perfeita entre Player e Banker e projeta a inversão na próxima mão.',
    evaluator: (subHist) => {
      if (subHist.length < 4) return null;
      const r = subHist.slice(-4).map(h => parseBaccaratResult(h.result)).filter(x => x !== 'T');
      if (r.length < 4) return null;
      if (r[0] === 'P' && r[1] === 'B' && r[2] === 'P' && r[3] === 'B') return 'PLAYER';
      if (r[0] === 'B' && r[1] === 'P' && r[2] === 'B' && r[3] === 'P') return 'BANKER';
      return null;
    }
  },
  {
    id: 'bigroad_double_cut',
    nameTemplate: 'Grande Estrada: Padrão Duplo Corte (P-P-B-B)',
    roadSource: 'big_road',
    roadSourceLabel: 'Grande Estrada',
    description: 'Identifica colunas de altura 2 seguidas (Duplo Corte) e projeta o fechamento do segundo par.',
    evaluator: (subHist) => {
      if (subHist.length < 4) return null;
      const r = subHist.slice(-4).map(h => parseBaccaratResult(h.result)).filter(x => x !== 'T');
      if (r.length < 4) return null;
      if (r[0] === 'P' && r[1] === 'P' && r[2] === 'B' && r[3] === 'B') return 'PLAYER';
      if (r[0] === 'B' && r[1] === 'B' && r[2] === 'P' && r[3] === 'P') return 'BANKER';
      return null;
    }
  },

  // 2. OLHO GRANDE (BIG EYE BOY) PATTERNS
  {
    id: 'bigeye_red_dominance',
    nameTemplate: 'Olho Grande: Domínio de Círculos Vermelhos (Simetria)',
    roadSource: 'big_eye',
    roadSourceLabel: 'Olho Grande',
    description: 'Quando o Olho Grande gera 2 ou mais círculos vermelhos seguidos, indica estabilidade do padrão.',
    evaluator: (subHist, _br, bigEye) => {
      if (bigEye.length < 2) return null;
      const lastTwo = bigEye.slice(-2);
      if (lastTwo.every(s => s === 'RED')) {
        const lastRes = parseBaccaratResult(subHist[subHist.length - 1]?.result);
        return lastRes === 'B' ? 'BANKER' : 'PLAYER';
      }
      return null;
    }
  },
  {
    id: 'bigeye_blue_break',
    nameTemplate: 'Olho Grande: Círculos Azuis de Ruptura (Corte de Tendência)',
    roadSource: 'big_eye',
    roadSourceLabel: 'Olho Grande',
    description: 'Identifica acúmulo de círculos azuis no Olho Grande projetando a quebra de padrão atual.',
    evaluator: (subHist, _br, bigEye) => {
      if (bigEye.length < 2) return null;
      const lastTwo = bigEye.slice(-2);
      if (lastTwo.every(s => s === 'BLUE')) {
        const lastRes = parseBaccaratResult(subHist[subHist.length - 1]?.result);
        return lastRes === 'B' ? 'PLAYER' : 'BANKER'; // Invert
      }
      return null;
    }
  },

  // 3. PEQUENO CAMINHO (SMALL ROAD) PATTERNS
  {
    id: 'smallroad_red_symmetry',
    nameTemplate: 'Pequeno Caminho: Pontos Vermelhos de Consistência',
    roadSource: 'small_road',
    roadSourceLabel: 'Pequeno Caminho',
    description: 'Analisa o Pequeno Caminho (Gap 2) para detectar repetição do comportamento de colunas anteriores.',
    evaluator: (subHist, _br, _be, smallRoad) => {
      if (smallRoad.length < 2) return null;
      const lastTwo = smallRoad.slice(-2);
      if (lastTwo.every(s => s === 'RED')) {
        const lastRes = parseBaccaratResult(subHist[subHist.length - 1]?.result);
        return lastRes === 'B' ? 'BANKER' : 'PLAYER';
      }
      return null;
    }
  },

  // 4. COCKROACH ROAD PATTERNS
  {
    id: 'cockroach_red_bar',
    nameTemplate: 'Cockroach Road: Sequência de Barras Vermelhas',
    roadSource: 'cockroach',
    roadSourceLabel: 'Cockroach Road',
    description: 'Analisa a Cockroach Road (Gap 3) quando atinge padrão de simetria pelas barras inclinadas vermelhas.',
    evaluator: (subHist, _br, _be, _sm, cockroach) => {
      if (cockroach.length < 2) return null;
      const lastTwo = cockroach.slice(-2);
      if (lastTwo.every(s => s === 'RED')) {
        const lastRes = parseBaccaratResult(subHist[subHist.length - 1]?.result);
        return lastRes === 'B' ? 'BANKER' : 'PLAYER';
      }
      return null;
    }
  },

  // 5. CONFLUÊNCIAS MULTI-ESTRADAS (TRI-ROAD & BI-ROAD CONFLUENCES)
  {
    id: 'confluence_triple_red',
    nameTemplate: 'Confluência Máxima: Tríplice Vermelho (Olho Grande + Pequeno + Cockroach)',
    roadSource: 'confluence',
    roadSourceLabel: 'Confluência Máxima',
    description: 'Sinal de altíssima probabilidade: Olho Grande, Pequeno Caminho e Cockroach Road confirmam Vermelho juntas!',
    evaluator: (subHist, _br, bigEye, smallRoad, cockroach) => {
      if (bigEye.length < 1 || smallRoad.length < 1 || cockroach.length < 1) return null;
      const lastBE = bigEye[bigEye.length - 1];
      const lastSR = smallRoad[smallRoad.length - 1];
      const lastCR = cockroach[cockroach.length - 1];

      if (lastBE === 'RED' && lastSR === 'RED' && lastCR === 'RED') {
        const lastRes = parseBaccaratResult(subHist[subHist.length - 1]?.result);
        return lastRes === 'B' ? 'BANKER' : 'PLAYER';
      }
      return null;
    },
  },
  {
    id: 'confluence_double_red_bigroad',
    nameTemplate: 'Confluência Mestre: Grande Estrada + Olho Grande (Simetria Dupla)',
    roadSource: 'confluence',
    roadSourceLabel: 'Confluência Dupla',
    description: 'Valida a tendência de alta da Grande Estrada confirmada simultaneamente pelo Olho Grande em Vermelho.',
    evaluator: (subHist, _br, bigEye) => {
      if (subHist.length < 2 || bigEye.length < 1) return null;
      const lastRes = parseBaccaratResult(subHist[subHist.length - 1]?.result);
      const prevRes = parseBaccaratResult(subHist[subHist.length - 2]?.result);
      const lastBE = bigEye[bigEye.length - 1];

      if (lastRes === prevRes && lastBE === 'RED') {
        return lastRes === 'B' ? 'BANKER' : 'PLAYER';
      }
      return null;
    }
  },

  // 6. BEAD PLATE N-GRAMS
  {
    id: 'bead_ppb_break',
    nameTemplate: 'Bead Plate: Micro-Padrão P-P-B -> Entrada Banker',
    roadSource: 'bead_plate',
    roadSourceLabel: 'Bead Plate',
    description: 'Micro-sequência do Bead Plate: após dois Players seguidos de um Banker, projeta consolidação de Banker.',
    evaluator: (subHist) => {
      if (subHist.length < 3) return null;
      const r = subHist.slice(-3).map(h => parseBaccaratResult(h.result));
      if (r[0] === 'P' && r[1] === 'P' && r[2] === 'B') return 'BANKER';
      return null;
    }
  },
  {
    id: 'bead_bbp_break',
    nameTemplate: 'Bead Plate: Micro-Padrão B-B-P -> Entrada Player',
    roadSource: 'bead_plate',
    roadSourceLabel: 'Bead Plate',
    description: 'Micro-sequência do Bead Plate: após dois Bankers seguidos de um Player, projeta consolidação de Player.',
    evaluator: (subHist) => {
      if (subHist.length < 3) return null;
      const r = subHist.slice(-3).map(h => parseBaccaratResult(h.result));
      if (r[0] === 'B' && r[1] === 'B' && r[2] === 'P') return 'PLAYER';
      return null;
    }
  },
  // 7. ADVANCED MARKOV CHAIN PREDICTOR (2nd-Order State Transitions)
  {
    id: 'baccarat_markov_chain_predictor',
    nameTemplate: 'Cadeia de Markov de 2ª Ordem (Transição Estatística)',
    roadSource: 'bead_plate',
    roadSourceLabel: 'Transições',
    description: 'Calcula a probabilidade de transição de estados de 2 rodadas (ex: P-P, B-B) para o próximo resultado baseado no histórico recente e prevê a transição dominante (>65% confluência).',
    evaluator: (subHist) => {
      if (subHist.length < 15) return null;
      // Use recent sliding window of up to 60 elements to build the transitions matrix
      const windowData = subHist.slice(-60).map(h => parseBaccaratResult(h.result)).filter(x => x === 'P' || x === 'B');
      if (windowData.length < 5) return null;

      // Identify last state of 2 rounds (e.g. PP, PB, BP, BB)
      const lastState = windowData.slice(-2).join('-');
      if (lastState.length < 3) return null;

      // Map transitions
      const transitionsCount: Record<string, { P: number; B: number }> = {};
      for (let i = 0; i < windowData.length - 2; i++) {
        const state = `${windowData[i]}-${windowData[i+1]}`;
        const next = windowData[i+2];
        if (next === 'P' || next === 'B') {
          if (!transitionsCount[state]) transitionsCount[state] = { P: 0, B: 0 };
          transitionsCount[state][next]++;
        }
      }

      const stats = transitionsCount[lastState];
      if (stats) {
        const total = stats.P + stats.B;
        if (total >= 3) {
          const pProb = stats.P / total;
          const bProb = stats.B / total;
          if (pProb >= 0.65) return 'PLAYER';
          if (bProb >= 0.65) return 'BANKER';
        }
      }
      return null;
    }
  }
];

/**
 * Evaluates whether a specific mined pattern ID triggers on the current history state.
 */
export function evaluateMinedPatternTrigger(minedId: string, history: GameResult[]): 'PLAYER' | 'BANKER' | 'TIE' | null {
  const candidate = CANDIDATE_PATTERNS.find(c => c.id === minedId);
  if (!candidate || !history || history.length < 3) return null;

  const chrono = [...history].reverse();
  const baccItems = chrono.map(h => ({ result: h.result }));
  const { cells: br } = buildBigRoad(baccItems);
  const occ: boolean[][] = Array.from({ length: 100 }, () => Array(100).fill(false));
  br.forEach(c => { if (c.row < 100 && c.col < 100) occ[c.row][c.col] = true; });
  const be = computeDerivedRoadSignals(br, occ, 1);
  const sm = computeDerivedRoadSignals(br, occ, 2);
  const cr = computeDerivedRoadSignals(br, occ, 3);

  return candidate.evaluator(chrono, br, be, sm, cr);
}

/**
 * Provides baseline strategy instances for all candidate patterns before history is populated.
 */
export function getInitialMinedBaccaratStrategies(): Strategy[] {
  return CANDIDATE_PATTERNS.map((candidate, index) => {
    return {
      id: `mined-baccarat-${candidate.id}`,
      name: `${candidate.nameTemplate} (Monitorando)`,
      gameType: GameType.BACCARAT,
      isActive: true,
      isSystem: true,
      isCustom: true,
      createdAt: Date.now() - index * 1000,
      rules: {
        baccaratPattern: [
          { r: 0, c: 0, type: 'B' },
          { r: 0, c: 1, type: '?' }
        ],
        minedId: candidate.id,
        roadSource: candidate.roadSource,
        predictedEntry: 'BANKER'
      },
      performance: {
        totalEntries: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        roi: 0,
        maxDrawdown: 0
      }
    };
  });
}

/**
 * Mines and backtests patterns against history.
 * Returns ranked mined patterns with full stats and high assertiveness filtering.
 */
export function mineBaccaratPatterns(history: GameResult[]): MinedBaccaratPattern[] {
  if (!history) return [];

  // If history is less than 3, return candidates with baseline template values
  if (history.length < 3) {
    return CANDIDATE_PATTERNS.map((candidate) => ({
      id: candidate.id,
      name: `${candidate.nameTemplate} (Monitorando)`,
      roadSource: candidate.roadSource,
      roadSourceLabel: candidate.roadSourceLabel,
      description: candidate.description,
      predictedEntry: 'BANKER',
      totalOccurrences: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      assertiveness: 0,
      confidence: 0,
      isActive: true,
      ruleCode: candidate.id,
      triggerCondition: (hist: GameResult[]) => evaluateMinedPatternTrigger(candidate.id, hist)
    }));
  }

  // Chronological order: index 0 is oldest, index N-1 is newest
  const chrono = [...history].reverse();
  const minedResults: MinedBaccaratPattern[] = [];

  for (const candidate of CANDIDATE_PATTERNS) {
    let totalOccurrences = 0;
    let wins = 0;
    let losses = 0;
    let ties = 0;
    let lastPredictedEntry: 'PLAYER' | 'BANKER' | 'TIE' = 'BANKER';

    // Walk history incrementally using a sliding window limit of the last 60 rounds to prevent O(N^2) lag on massive databases
    const maxEvaluationRounds = 60;
    const minStep = Math.min(2, chrono.length - 1);
    const startIdx = Math.max(minStep, chrono.length - maxEvaluationRounds);

    for (let i = startIdx; i < chrono.length; i++) {
      const subHist = chrono.slice(0, i);
      
      // Calculate roads for this sub-history window
      const baccHistItems = subHist.map(h => ({ result: h.result }));
      const { cells: bigRoadCells } = buildBigRoad(baccHistItems);
      
      const bigRoadOccupied: boolean[][] = Array.from({ length: 6 }, () => Array(Math.max(12, bigRoadCells.length + 2)).fill(false));
      bigRoadCells.forEach(c => {
        if (c.row < 6 && c.col < bigRoadOccupied[0].length) bigRoadOccupied[c.row][c.col] = true;
      });

      const bigEyeSignals = computeDerivedRoadSignals(bigRoadCells, bigRoadOccupied, 1);
      const smallRoadSignals = computeDerivedRoadSignals(bigRoadCells, bigRoadOccupied, 2);
      const cockroachSignals = computeDerivedRoadSignals(bigRoadCells, bigRoadOccupied, 3);

      const prediction = candidate.evaluator(
        subHist, 
        bigRoadCells, 
        bigEyeSignals, 
        smallRoadSignals, 
        cockroachSignals
      );

      if (prediction) {
        totalOccurrences++;
        lastPredictedEntry = prediction;

        // Check actual next outcome at index `i`
        const actualResult = parseBaccaratResult(chrono[i].result);
        
        if (actualResult === ('T' as BaccaratOutcome)) {
          ties++;
        } else if (
          (prediction === 'BANKER' && actualResult === 'B') ||
          (prediction === 'PLAYER' && actualResult === 'P') ||
          (prediction === 'TIE' && actualResult === ('T' as BaccaratOutcome))
        ) {
          wins++;
        } else {
          losses++;
        }
      }
    }

    const decisiveGames = wins + losses;
    const assertiveness = decisiveGames > 0 ? Number(((wins / decisiveGames) * 100).toFixed(1)) : 0;

    minedResults.push({
      id: candidate.id,
      name: totalOccurrences > 0 
        ? `${candidate.nameTemplate} (${assertiveness}% - ${wins}v/${losses}d)`
        : `${candidate.nameTemplate} (Monitorando)`,
      roadSource: candidate.roadSource,
      roadSourceLabel: candidate.roadSourceLabel,
      description: candidate.description,
      predictedEntry: lastPredictedEntry,
      totalOccurrences,
      wins,
      losses,
      ties,
      assertiveness,
      confidence: totalOccurrences > 0 ? Math.min(95, Math.max(0, Math.round(assertiveness))) : 0,
      isActive: totalOccurrences === 0 || assertiveness > 60, // Auto-activate strategies only with assertiveness > 60%
      ruleCode: candidate.id,
      triggerCondition: (hist: GameResult[]) => evaluateMinedPatternTrigger(candidate.id, hist)
    });
  }

  // Rank by total occurrences (descending) then assertiveness (descending)
  minedResults.sort((a, b) => {
    if (b.assertiveness !== a.assertiveness) {
      return b.assertiveness - a.assertiveness;
    }
    return b.totalOccurrences - a.totalOccurrences;
  });

  return minedResults;
}

/**
 * Converts mined Baccarat patterns into standard `Strategy` objects for the store/engine.
 */
export function convertMinedPatternsToStrategies(mined: MinedBaccaratPattern[]): Strategy[] {
  // Exclui automaticamente padrões minerados com assertividade abaixo de 40% (quando testados com 2+ ocorrências)
  const filtered = mined.filter(m => m.totalOccurrences < 2 || m.assertiveness >= 40);
  return filtered.map(m => ({
    id: `mined-baccarat-${m.id}`,
    name: m.name,
    gameType: GameType.BACCARAT,
    rules: {
      baccaratPattern: [
        { r: 0, c: 0, type: m.predictedEntry === 'BANKER' ? 'B' : 'P' },
        { r: 0, c: 1, type: '?' }
      ],
      minedId: m.id,
      roadSource: m.roadSource,
      predictedEntry: m.predictedEntry
    },
    isActive: m.isActive,
    isCustom: true,
    createdAt: Date.now(),
    performance: {
      totalEntries: m.totalOccurrences,
      wins: m.wins,
      losses: m.losses,
      winRate: m.assertiveness,
      roi: m.totalOccurrences > 0 ? Number((((m.wins * 0.95 - m.losses) / m.totalOccurrences) * 100).toFixed(1)) : 0,
      maxDrawdown: m.losses * 1.5
    }
  }));
}
