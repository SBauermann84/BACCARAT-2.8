export const ROULETTE_RACE_SEQUENCE = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13,
  36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20,
  14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

export const ROULETTE_ZONES = {
  VOISINS: [22, 18, 29, 7, 28, 12, 35, 3, 26, 0, 32, 15, 19, 4, 21, 2, 25],
  TIERS: [27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33],
  ORPHELINS: [1, 20, 14, 31, 9, 17, 34, 6],
  ZERO_SPIEL: [12, 35, 3, 26, 0, 32, 15]
};

export const COLOR_MAP = {
  ROULETTE: {
    RED: [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36],
    BLACK: [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35],
    ZERO: [0]
  },
  BACCARAT: {
    BANKER: '#e11d48', // Red
    PLAYER: '#2563eb', // Blue
    TIE: '#10b981'    // Green
  }
};

export const SCORE_WEIGHTS = {
  REPETITION: 10,
  ATRASO: 10,
  ZONA: 15,
  VIZINHOS: 15,
  TERMINAL: 10,
  VOLATILIDADE: 10,
  BACKTEST: 20,
  DRAWDOWN: 10
};

export interface RegionalBetItem {
  type: string;
  target: number | number[];
  amount: number;
  label: string;
}

export const REGIONAL_BETS_DEFINITIONS: Record<'VOISINS' | 'TIERS' | 'ORPHELINS' | 'ZERO_SPIEL', RegionalBetItem[]> = {
  VOISINS: [
    { type: 'multi', target: [0, 2, 3], amount: 2, label: 'Trio 0/2/3' },
    { type: 'multi', target: [25, 26, 28, 29], amount: 2, label: 'Quadra 25-29' },
    { type: 'multi', target: [4, 7], amount: 1, label: 'Cavalo 4/7' },
    { type: 'multi', target: [12, 15], amount: 1, label: 'Cavalo 12/15' },
    { type: 'multi', target: [18, 21], amount: 1, label: 'Cavalo 18/21' },
    { type: 'multi', target: [19, 22], amount: 1, label: 'Cavalo 19/22' },
    { type: 'multi', target: [32, 35], amount: 1, label: 'Cavalo 32/35' }
  ],
  TIERS: [
    { type: 'multi', target: [5, 8], amount: 1, label: 'Cavalo 5/8' },
    { type: 'multi', target: [10, 11], amount: 1, label: 'Cavalo 10/11' },
    { type: 'multi', target: [13, 16], amount: 1, label: 'Cavalo 13/16' },
    { type: 'multi', target: [23, 24], amount: 1, label: 'Cavalo 23/24' },
    { type: 'multi', target: [27, 30], amount: 1, label: 'Cavalo 27/30' },
    { type: 'multi', target: [33, 36], amount: 1, label: 'Cavalo 33/36' }
  ],
  ORPHELINS: [
    { type: 'number', target: 1, amount: 1, label: 'Pleno 1' },
    { type: 'multi', target: [6, 9], amount: 1, label: 'Cavalo 6/9' },
    { type: 'multi', target: [14, 17], amount: 1, label: 'Cavalo 14/17' },
    { type: 'multi', target: [17, 20], amount: 1, label: 'Cavalo 17/20' },
    { type: 'multi', target: [31, 34], amount: 1, label: 'Cavalo 31/34' }
  ],
  ZERO_SPIEL: [
    { type: 'number', target: 26, amount: 1, label: 'Pleno 26' },
    { type: 'multi', target: [0, 3], amount: 1, label: 'Cavalo 0/3' },
    { type: 'multi', target: [12, 15], amount: 1, label: 'Cavalo 12/15' },
    { type: 'multi', target: [32, 35], amount: 1, label: 'Cavalo 32/35' }
  ]
};

export const REGIONAL_SECTOR_UNITS: Record<'VOISINS' | 'TIERS' | 'ORPHELINS' | 'ZERO_SPIEL', number> = {
  VOISINS: 9,
  TIERS: 6,
  ORPHELINS: 5,
  ZERO_SPIEL: 4
};

export function detectRegionalSector(target: any): 'VOISINS' | 'TIERS' | 'ORPHELINS' | 'ZERO_SPIEL' | null {
  if (!target) return null;

  // PRIORITY EXCLUSIONS: Terminal S84, TPA84, Angel84, and Pleno/Terminal strategies are NOT regional sector bets
  if (
    target?.isRacetrack || 
    target?.isTpa84 || 
    target?.isAngel84 ||
    target?.strategyId === 'system-roulette-racetrack' ||
    target?.strategyId === 'system-roulette-tpa84' ||
    target?.strategyId === 'system-roulette-angel84'
  ) {
    return null;
  }
  
  const text = [
    typeof target === 'string' ? target : '',
    target?.entry || '',
    target?.patternName || '',
    target?.description || '',
    target?.strategyId || '',
    target?.strategyName || '',
    target?.sector || '',
    target?.name || '',
    target?.rules?.triggerConfig?.selectedSectors?.[0] || '',
    target?.rules?.minedId || ''
  ].join(' ').toLowerCase();

  // If text contains terminal references, ignore regional sector match
  if (
    text.includes('terminal') ||
    text.includes('s84') ||
    text.includes('tpa84') ||
    text.includes('angel84')
  ) {
    return null;
  }

  // Check Zero Spiel first
  if (
    text.includes('zero spiel') || text.includes('zero_spiel') ||
    text.includes('jeu zéro') || text.includes('jeu zero') ||
    text.includes('jogo do zero') || text.includes('jogo de zero')
  ) {
    return 'ZERO_SPIEL';
  }

  // Check Voisins
  if (
    text.includes('voisins') || text.includes('vizinhos do zero') || 
    text.includes('vizinhos de zero') || text.includes('roulette_voisins')
  ) {
    return 'VOISINS';
  }

  // Check Tiers
  if (
    text.includes('tiers') || text.includes('terço do cilindro') || 
    text.includes('terco do cilindro') || text.includes('terço da roleta') ||
    text.includes('terco da roleta') || text.includes('roulette_tiers')
  ) {
    return 'TIERS';
  }

  // Check Orphelins
  if (
    text.includes('orphelins') || text.includes('órfãos') || 
    text.includes('orfaos') || text.includes('roulette_orphelins')
  ) {
    return 'ORPHELINS';
  }

  // Check by exact covered numbers set
  const nums: number[] = Array.isArray(target?.entryNumbers) 
    ? target.entryNumbers 
    : Array.isArray(target?.targetNumbers)
    ? target.targetNumbers
    : Array.isArray(target?.rules?.bets) && target.rules.bets.every((b: any) => typeof b?.target === 'number')
    ? target.rules.bets.map((b: any) => b.target)
    : [];

  if (nums.length > 0) {
    const isExactMatch = (zone: number[]) => zone.length === nums.length && zone.every(n => nums.includes(n));
    if (isExactMatch(ROULETTE_ZONES.VOISINS)) return 'VOISINS';
    if (isExactMatch(ROULETTE_ZONES.TIERS)) return 'TIERS';
    if (isExactMatch(ROULETTE_ZONES.ORPHELINS)) return 'ORPHELINS';
    if (isExactMatch(ROULETTE_ZONES.ZERO_SPIEL)) return 'ZERO_SPIEL';
  }

  return null;
}
