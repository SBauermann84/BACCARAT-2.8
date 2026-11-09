import { GameResult, GameType } from '../types';
import { COLOR_MAP, ROULETTE_ZONES } from '../constants';

export interface TrendRecommendation {
  type: 'quente';
  category: string;
  name: string;
  entry: string;
  rounds: number;
  confidence: number;
  description: string;
}

// Helper to determine if a roulette number matches a category
export function matchesRouletteCategory(num: number, category: string, target: string): boolean {
  if (num === 0) return false;
  const isRed = COLOR_MAP.ROULETTE.RED.includes(num);
  const isBlack = COLOR_MAP.ROULETTE.BLACK.includes(num);

  switch (category) {
    case 'color':
      return target === 'red' ? isRed : isBlack;
    case 'parity':
      return target === 'even' ? num % 2 === 0 : num % 2 !== 0;
    case 'highLow':
      return target === 'high' ? num >= 19 : num <= 18;
    case 'dozen':
      const d = num >= 1 && num <= 12 ? '1' : num >= 13 && num <= 24 ? '2' : '3';
      return d === target;
    case 'column':
      const col = num % 3 === 1 ? '1' : num % 3 === 2 ? '2' : '3';
      return col === target;
    default:
      return false;
  }
}

// Standard Categories & Bets for Roulette
const ROULETTE_STREETS = Array.from({ length: 12 }, (_, i) => {
  const start = i * 3 + 1;
  return { name: `Rua ${start}-${start+2}`, numbers: [start, start+1, start+2] };
});

const ROULETTE_CORNERS = [
  { name: 'Canto 1-2-4-5', numbers: [1, 2, 4, 5] },
  { name: 'Canto 2-3-5-6', numbers: [2, 3, 5, 6] },
  { name: 'Canto 4-5-7-8', numbers: [4, 5, 7, 8] },
  { name: 'Canto 5-6-8-9', numbers: [5, 6, 8, 9] },
  { name: 'Canto 7-8-10-11', numbers: [7, 8, 10, 11] },
  { name: 'Canto 8-9-11-12', numbers: [8, 9, 11, 12] },
  { name: 'Canto 10-11-13-14', numbers: [10, 11, 13, 14] },
  { name: 'Canto 11-12-14-15', numbers: [11, 12, 14, 15] },
  { name: 'Canto 13-14-16-17', numbers: [13, 14, 16, 17] },
  { name: 'Canto 14-15-17-18', numbers: [14, 15, 17, 18] },
  { name: 'Canto 16-17-19-20', numbers: [16, 17, 19, 20] },
  { name: 'Canto 17-18-20-21', numbers: [17, 18, 20, 21] },
  { name: 'Canto 19-20-22-23', numbers: [19, 20, 22, 23] },
  { name: 'Canto 20-21-23-24', numbers: [20, 21, 23, 24] },
  { name: 'Canto 22-23-25-26', numbers: [22, 23, 25, 26] },
  { name: 'Canto 23-24-26-27', numbers: [23, 24, 26, 27] },
  { name: 'Canto 25-26-28-29', numbers: [25, 26, 28, 29] },
  { name: 'Canto 26-27-29-30', numbers: [26, 27, 29, 30] },
  { name: 'Canto 28-29-31-32', numbers: [28, 29, 31, 32] },
  { name: 'Canto 29-30-32-33', numbers: [29, 30, 32, 33] },
  { name: 'Canto 31-32-34-35', numbers: [31, 32, 34, 35] },
  { name: 'Canto 32-33-35-36', numbers: [32, 33, 35, 36] }
];

const ROULETTE_SPLITS = Array.from({ length: 12 }, (_, i) => {
  const start = i * 3 + 1;
  return [
    { name: `Dividida ${start}-${start+1}`, numbers: [start, start+1] },
    { name: `Dividida ${start+1}-${start+2}`, numbers: [start+1, start+2] }
  ];
}).flat();

export const trendAnalysisEngine = {
  /**
   * Calculates comprehensive roulette trends based on the requested rules
   * ONLY registers Hot Trends (Frequência/Sequências) with highly assertive triggers
   * completely removing cold/absence statistics to prevent losing streaks
   */
  getRouletteTrends(history: GameResult[], onlyRecommendations = false): {
    recommendations: TrendRecommendation[];
    mostAssertive: TrendRecommendation | null;
    categoryDetails: Record<string, any>;
  } {
    const rouletteHistory = history.filter(h => h.gameType === GameType.ROULETTE);
    if (rouletteHistory.length === 0) {
      return { recommendations: [], mostAssertive: null, categoryDetails: {} };
    }

    const recs: TrendRecommendation[] = [];
    const details: Record<string, any> = {};

    const extResults = rouletteHistory.map(h => Number(h.result)).filter(n => !isNaN(n));
    const len = extResults.length;

    // Count arrays for different windows to do O(1) lookups:
    const extRecentCounts = Array(37).fill(0);
    const dozRecentCounts = Array(37).fill(0);
    const sectorCounts = Array(37).fill(0);
    const streetCounts = Array(37).fill(0);
    const cornerCounts = Array(37).fill(0);
    const splitCounts = Array(37).fill(0);
    const numRecentCounts = Array(37).fill(0);

    const limit = Math.min(37, len);
    for (let i = 0; i < limit; i++) {
      const val = extResults[i];
      if (val >= 0 && val <= 36) {
        if (i < 6) extRecentCounts[val]++;
        if (i < 12) dozRecentCounts[val]++;
        if (i < 15) sectorCounts[val]++;
        if (i < 18) streetCounts[val]++;
        if (i < 24) {
          cornerCounts[val]++;
          splitCounts[val]++;
        }
        if (i < 37) numRecentCounts[val]++;
      }
    }
    
    // 1. EXTERNAL BETS - 6 rounds window
    const externalDefs = [
      { name: 'Vermelho', key: 'red', category: 'Cor', check: (n: number) => n !== 0 && COLOR_MAP.ROULETTE.RED.includes(n), opposed: 'Preto', opposedKey: 'black' },
      { name: 'Preto', key: 'black', category: 'Cor', check: (n: number) => n !== 0 && COLOR_MAP.ROULETTE.BLACK.includes(n), opposed: 'Vermelho', opposedKey: 'red' },
      { name: 'Par', key: 'even', category: 'Paridade', check: (n: number) => n !== 0 && n % 2 === 0, opposed: 'Ímpar', opposedKey: 'odd' },
      { name: 'Ímpar', key: 'odd', category: 'Paridade', check: (n: number) => n !== 0 && n % 2 !== 0, opposed: 'Par', opposedKey: 'even' },
      { name: 'Altos (19-36)', key: 'high', category: 'Altos / Baixos', check: (n: number) => n >= 19 && n <= 36, opposed: 'Baixos (1-18)', opposedKey: 'low' },
      { name: 'Baixos (1-18)', key: 'low', category: 'Altos / Baixos', check: (n: number) => n >= 1 && n <= 18, opposed: 'Altos (19-36)', opposedKey: 'high' }
    ];

    if (!onlyRecommendations) {
      details['external'] = externalDefs.map(def => {
        let streak = 0;
        for (const num of extResults) {
          if (!def.check(num)) break;
          streak++;
        }

        let freq = 0;
        for (let n = 0; n <= 36; n++) {
          if (extRecentCounts[n] > 0 && def.check(n)) {
            freq += extRecentCounts[n];
          }
        }
        
        const assertiveness = Number(((freq / 6) * 100).toFixed(1));
        return { ...def, streak, freq, assertiveness };
      });

      details['external'].forEach((item: any) => {
        if (item.streak >= 4 || item.freq >= 5) {
          const confidence = Math.round(Math.min(80 + (Math.max(item.streak, item.freq) * 3.5), 99));
          recs.push({
            type: 'quente',
            category: item.category,
            name: item.name,
            entry: item.key,
            rounds: 6,
            confidence,
            description: `Tendência de Convecção! ${item.freq} saídas nas últimas 6 rodadas (Sequência de ${item.streak}x). Força estatística comprovada.`
          });
        }
      });
    } else {
      for (const def of externalDefs) {
        let streak = 0;
        for (const num of extResults) {
          if (!def.check(num)) break;
          streak++;
        }
        let freq = 0;
        for (let n = 0; n <= 36; n++) {
          if (extRecentCounts[n] > 0 && def.check(n)) {
            freq += extRecentCounts[n];
          }
        }
        if (streak >= 4 || freq >= 5) {
          const confidence = Math.round(Math.min(80 + (Math.max(streak, freq) * 3.5), 99));
          recs.push({
            type: 'quente',
            category: def.category,
            name: def.name,
            entry: def.key,
            rounds: 6,
            confidence,
            description: `Tendência de Convecção! ${freq} saídas nas últimas 6 rodadas (Sequência de ${streak}x). Força estatística comprovada.`
          });
        }
      }
    }

    // 2. DOZENS & COLUMNS - 12 rounds window
    const dozensDefs = [
      { name: 'Dúzia 1', key: 'Dúzia 1', category: 'Dúzias', check: (n: number) => n >= 1 && n <= 12 },
      { name: 'Dúzia 2', key: 'Dúzia 2', category: 'Dúzias', check: (n: number) => n >= 13 && n <= 24 },
      { name: 'Dúzia 3', key: 'Dúzia 3', category: 'Dúzias', check: (n: number) => n >= 25 && n <= 36 }
    ];
    const columnsDefs = [
      { name: 'Coluna 1', key: 'Coluna 1', category: 'Colunas', check: (n: number) => n !== 0 && n % 3 === 1 },
      { name: 'Coluna 2', key: 'Coluna 2', category: 'Coluna 2', check: (n: number) => n !== 0 && n % 3 === 2 },
      { name: 'Coluna 3', key: 'Coluna 3', category: 'Coluna 3', check: (n: number) => n !== 0 && n % 3 === 0 }
    ];

    const dozColList = [...dozensDefs, ...columnsDefs];

    if (!onlyRecommendations) {
      details['dozensColumns'] = dozColList.map(def => {
        let streak = 0;
        for (const num of extResults) {
          if (!def.check(num)) break;
          streak++;
        }
        
        let freq = 0;
        for (let n = 0; n <= 36; n++) {
          if (dozRecentCounts[n] > 0 && def.check(n)) {
            freq += dozRecentCounts[n];
          }
        }
        const assertiveness = Number(((freq / 12) * 100).toFixed(1));
        return { ...def, streak, freq, assertiveness };
      });

      details['dozensColumns'].forEach((item: any) => {
        if (item.freq >= 7 || item.streak >= 3) {
          const confidence = Math.round(Math.min(78 + (item.freq * 2.5) + (item.streak * 2), 98));
          recs.push({
            type: 'quente',
            category: item.category,
            name: item.name,
            entry: item.key,
            rounds: 12,
            confidence,
            description: `Dúzia/Coluna em Alta! Frequência ultra consolidada com ${item.freq} repetições em 12 rodadas.`
          });
        }
      });
    } else {
      for (const def of dozColList) {
        let streak = 0;
        for (const num of extResults) {
          if (!def.check(num)) break;
          streak++;
        }
        let freq = 0;
        for (let n = 0; n <= 36; n++) {
          if (dozRecentCounts[n] > 0 && def.check(n)) {
            freq += dozRecentCounts[n];
          }
        }
        if (freq >= 7 || streak >= 3) {
          const confidence = Math.round(Math.min(78 + (freq * 2.5) + (streak * 2), 98));
          recs.push({
            type: 'quente',
            category: def.category,
            name: def.name,
            entry: def.key,
            rounds: 12,
            confidence,
            description: `Dúzia/Coluna em Alta! Frequência ultra consolidada com ${freq} repetições em 12 rodadas.`
          });
        }
      }
    }

    // 3. SECTORS ANALYSIS (New Extremely Assertive Strategy)
    const sectorsList = [
      { name: 'Vizinhos do Zero', key: 'VOISINS', zone: ROULETTE_ZONES.VOISINS, minTrigger: 10, pct: 46.0, desc: 'VOISINS DU ZÉRO (17 números)' },
      { name: 'Terço do Cilindro', key: 'TIERS', zone: ROULETTE_ZONES.TIERS, minTrigger: 8, pct: 32.4, desc: 'TIERS DU CYLINDRE (12 números)' },
      { name: 'Órfãos', key: 'ORPHELINS', zone: ROULETTE_ZONES.ORPHELINS, minTrigger: 6, pct: 21.6, desc: 'ORPHELINS (8 números)' },
      { name: 'Jogo do Zero', key: 'ZERO_SPIEL', zone: ROULETTE_ZONES.ZERO_SPIEL, minTrigger: 5, pct: 18.9, desc: 'ZERO SPIEL (7 números)' }
    ];

    sectorsList.forEach(sec => {
      let hits = 0;
      for (const num of sec.zone) {
        hits += sectorCounts[num];
      }
      if (hits >= sec.minTrigger) {
        const confidence = Math.round(Math.min(80 + ((hits - sec.minTrigger) * 4) + (sec.pct / 5), 99));
        recs.push({
          type: 'quente',
          category: 'Setores da Roleta',
          name: sec.name,
          entry: sec.key,
          rounds: 15,
          confidence,
          description: `Confluência de Setor! ${sec.desc} registrou ${hits} acertos nas últimas 15 jogadas. Cobertura ampla e alta taxa de ganho.`
        });
      }
    });

    // 4. STREETS & CORNERS - Streets: 18 rd; Corners: 24 rd
    if (!onlyRecommendations) {
      const streetDetails = ROULETTE_STREETS.map(st => {
        let freq = 0;
        for (const num of st.numbers) {
          freq += streetCounts[num];
        }
        const assertiveness = Number(((freq / 18) * 100).toFixed(1));
        return { name: st.name, key: `rua: ${st.numbers.join('-')}`, category: 'Ruas', freq, assertiveness, type: 'street' };
      });

      const cornerDetails = ROULETTE_CORNERS.map(co => {
        let freq = 0;
        for (const num of co.numbers) {
          freq += cornerCounts[num];
        }
        const assertiveness = Number(((freq / 24) * 100).toFixed(1));
        return { name: co.name, key: `canto: ${co.numbers.join('-')}`, category: 'Cantos', freq, assertiveness, type: 'corner' };
      });

      details['streetsCorners'] = [...streetDetails, ...cornerDetails];

      details['streetsCorners'].forEach((item: any) => {
        const isStreet = item.type === 'street';
        const roundsUsed = isStreet ? 18 : 24;
        
        // Hot trigger: streets expect >= 4 hits (avg is 1.5). Corners expect >= 6 hits (avg is 2.6).
        const minFreqTrigger = isStreet ? 4 : 6;
        if (item.freq >= minFreqTrigger) {
          const confidence = Math.round(Math.min(76 + (item.freq * (isStreet ? 5.5 : 3.5)), 96));
          recs.push({
            type: 'quente',
            category: item.category,
            name: item.name,
            entry: item.key,
            rounds: roundsUsed,
            confidence,
            description: `Confluência em ${item.category}! Frequência de ${item.freq} saídas com alta propensão de repetição imediata.`
          });
        }
      });
    } else {
      // Streets
      for (const st of ROULETTE_STREETS) {
        let freq = 0;
        for (const num of st.numbers) {
          freq += streetCounts[num];
        }
        if (freq >= 4) {
          const confidence = Math.round(Math.min(76 + (freq * 5.5), 96));
          recs.push({
            type: 'quente',
            category: 'Ruas',
            name: st.name,
            entry: `rua: ${st.numbers.join('-')}`,
            rounds: 18,
            confidence,
            description: `Confluência em Ruas! Frequência de ${freq} saídas com alta propensão de repetição imediata.`
          });
        }
      }
      // Corners
      for (const co of ROULETTE_CORNERS) {
        let freq = 0;
        for (const num of co.numbers) {
          freq += cornerCounts[num];
        }
        if (freq >= 6) {
          const confidence = Math.round(Math.min(76 + (freq * 3.5), 96));
          recs.push({
            type: 'quente',
            category: 'Cantos',
            name: co.name,
            entry: `canto: ${co.numbers.join('-')}`,
            rounds: 24,
            confidence,
            description: `Confluência em Cantos! Frequência de ${freq} saídas com alta propensão de repetição imediata.`
          });
        }
      }
    }

    // 5. SPLITS (Divididas) - 24 rounds window
    if (!onlyRecommendations) {
      details['splits'] = ROULETTE_SPLITS.map(sp => {
        let freq = 0;
        for (const num of sp.numbers) {
          freq += splitCounts[num];
        }
        const assertiveness = Number(((freq / 24) * 100).toFixed(1));
        return { name: sp.name, key: `dividida: ${sp.numbers.join('-')}`, category: 'Divididas', freq, assertiveness };
      });

      details['splits'].forEach((item: any) => {
        // Hot trigger: splits expect >= 5 hits (avg is 1.3).
        if (item.freq >= 5) {
          const confidence = Math.round(Math.min(80 + (item.freq * 3.5), 95));
          recs.push({
            type: 'quente',
            category: item.category,
            name: item.name,
            entry: item.key,
            rounds: 24,
            confidence,
            description: `Dividida Ativa! Frequência anômala de ${item.freq} acertos, indicando tendência em setores vizinhos do cilindro.`
          });
        }
      });
    } else {
      for (const sp of ROULETTE_SPLITS) {
        let freq = 0;
        for (const num of sp.numbers) {
          freq += splitCounts[num];
        }
        if (freq >= 5) {
          const confidence = Math.round(Math.min(80 + (freq * 3.5), 95));
          recs.push({
            type: 'quente',
            category: 'Divididas',
            name: sp.name,
            entry: `dividida: ${sp.numbers.join('-')}`,
            rounds: 24,
            confidence,
            description: `Dividida Ativa! Frequência anômala de ${freq} acertos, indicando tendência em setores vizinhos do cilindro.`
          });
        }
      }
    }

    // 6. INDIVIDUAL NUMBERS - 37 rounds window
    if (!onlyRecommendations) {
      const numList = Array.from({ length: 37 }, (_, i) => i);
      details['numbers'] = numList.map(v => {
        const freq = numRecentCounts[v];
        const assertiveness = Number(((freq / 37) * 100).toFixed(1));
        return { name: `Pleno ${v} + 5 Vizinhos`, key: `pleno ${v}`, category: 'Números Plenos', freq, assertiveness, val: v };
      });

      details['numbers'].forEach((item: any) => {
        // Upgraded trigger: requires Pleno to hit >= 3 times in 37 rounds (previously 2) to trigger a signals trend.
        if (item.freq >= 3) {
          const confidence = Math.round(Math.min(82 + (item.freq * 5.0), 97));
          recs.push({
            type: 'quente',
            category: item.category,
            name: item.name,
            entry: item.key,
            rounds: 37,
            confidence,
            description: `Estratégia Especial: Cobrindo o Pleno ${item.val} e seus 5 vizinhos adjacentes de cada lado na roda (11 números no total). O pleno alvo registrou ${item.freq} acertos de alta confluência.`
          });
        }
      });
    } else {
      for (let v = 0; v <= 36; v++) {
        const freq = numRecentCounts[v];
        if (freq >= 3) {
          const confidence = Math.round(Math.min(82 + (freq * 5.0), 97));
          recs.push({
            type: 'quente',
            category: 'Números Plenos',
            name: `Pleno ${v} + 5 Vizinhos`,
            entry: `pleno ${v}`,
            rounds: 37,
            confidence,
            description: `Estratégia Especial: Cobrindo o Pleno ${v} e seus 5 vizinhos adjacentes de cada lado na roda (11 números no total). O pleno alvo registrou ${freq} acertos de alta confluência.`
          });
        }
      }
    }

    // Sort recommended entries by highest confidence
    recs.sort((a, b) => b.confidence - a.confidence);

    return {
      recommendations: recs.slice(0, 6),
      mostAssertive: recs[0] || null,
      categoryDetails: details
    };
  },

  /**
   * Calculates comprehensive baccarat trends with high-density sequence tracking
   * completely shields investor against "Dragon Tail" Martingale trap by removing
   * dry/absence statistics.
   */
  getBaccaratTrends(history: GameResult[]): {
    recommendations: TrendRecommendation[];
    mostAssertive: TrendRecommendation | null;
    streakStats: {
      vertical: Record<string, number>;
      horizontal: Record<string, number>;
    };
  } {
    const bacHistory = history.filter(h => h.gameType === GameType.BACCARAT);
    if (bacHistory.length === 0) {
      return { recommendations: [], mostAssertive: null, streakStats: { vertical: {}, horizontal: {} } };
    }

    const rows = 6;
    const cols = 13;
    const totalCells = rows * cols;
    
    const chronoHistory = [...bacHistory].reverse().slice(-totalCells);
    const grid: Record<string, string> = {};
    
    chronoHistory.forEach((h, i) => {
      const r = i % rows;
      const c = Math.floor(i / rows);
      const resChar = String(h.result).toUpperCase().trim().charAt(0);
      let standardized = 'P';
      if (resChar === 'B') standardized = 'B';
      else if (resChar === 'T' || resChar === 'E') standardized = 'T'; // Tie / Empate
      grid[`${r},${c}`] = standardized;
    });

    const vertStreaks: Record<string, number> = { P: 0, B: 0, T: 0 };
    const horizStreaks: Record<string, number> = { P: 0, B: 0, T: 0 };

    const vertLenStats: Record<string, number> = { P3: 0, P4: 0, P5: 0, B3: 0, B4: 0, B5: 0, T3: 0, T4: 0, T5: 0 };
    const horizLenStats: Record<string, number> = { P3: 0, P4: 0, P5: 0, B3: 0, B4: 0, B5: 0, T3: 0, T4: 0, T5: 0 };

    // 1. Check Vertical Streaks of size 3, 4, 5
    for (let c = 0; c < cols; c++) {
      for (const len of [3, 4, 5]) {
         for (let r = 0; r <= rows - len; r++) {
            const vals = Array.from({ length: len }, (_, offset) => grid[`${r + offset},${c}`]);
            const first = vals[0];
            if (first && vals.every(v => v === first)) {
               vertStreaks[first] = (vertStreaks[first] || 0) + 1;
               vertLenStats[`${first}${len}`]++;
            }
         }
      }
    }

    // 2. Check Horizontal Streaks of size 3, 4, 5
    for (let r = 0; r < rows; r++) {
      for (const len of [3, 4, 5]) {
         for (let c = 0; c <= cols - len; c++) {
            const vals = Array.from({ length: len }, (_, offset) => grid[`${r},${c + offset}`]);
            const first = vals[0];
            if (first && vals.every(v => v === first)) {
               horizStreaks[first] = (horizStreaks[first] || 0) + 1;
               horizLenStats[`${first}${len}`]++;
            }
         }
      }
    }

    const recs: TrendRecommendation[] = [];
    const outcomes: ('P' | 'B' | 'T')[] = ['P', 'B', 'T'];
    const labelMapping = { P: 'PLAYER', B: 'BANKER', T: 'TIE' };
    const descMapping = { P: 'Player', B: 'Banker', T: 'Tie (Empate)' };

    outcomes.forEach(v => {
      const vTotalStreaks = (vertStreaks[v] || 0) + (horizStreaks[v] || 0);
      const label = labelMapping[v];
      const desc = descMapping[v];

      // Strengthened hot recommendation threshold (at least 3 repetitive signals)
      if (vTotalStreaks >= 3) {
        const confidence = Math.round(Math.min(75 + (vTotalStreaks * 4.5), 99));
        recs.push({
          type: 'quente',
          category: `Tendência Baccarat`,
          name: `Sequências de ${desc}`,
          entry: label,
          rounds: 5,
          confidence,
          description: `Sapato Altamente Confluente! Registrou ${vertStreaks[v] || 0} sequências verticais e ${horizStreaks[v] || 0} horizontais consecutivas. Siga a força dominante.`
        });
      }
    });

    recs.sort((a, b) => b.confidence - a.confidence);

    return {
      recommendations: recs.slice(0, 4),
      mostAssertive: recs[0] || null,
      streakStats: {
        vertical: vertLenStats,
        horizontal: horizLenStats
      }
    };
  }
}
