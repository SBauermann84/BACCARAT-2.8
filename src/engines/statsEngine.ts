import { ROULETTE_RACE_SEQUENCE, ROULETTE_ZONES, COLOR_MAP } from '../constants';

export const analyzeRouletteResult = (num: number) => {
  const isRed = COLOR_MAP.ROULETTE.RED.includes(num);
  const isBlack = COLOR_MAP.ROULETTE.BLACK.includes(num);
  const color = num === 0 ? 'zero' : isRed ? 'red' : 'black';
  
  const parity = num === 0 ? 'zero' : num % 2 === 0 ? 'even' : 'odd';
  const highLow = num === 0 ? 'zero' : num >= 19 ? 'high' : 'low';
  
  let dozen = 0; // 0 for zero
  if (num >= 1 && num <= 12) dozen = 1;
  else if (num >= 13 && num <= 24) dozen = 2;
  else if (num >= 25 && num <= 36) dozen = 3;

  let column = 0; // 0 for zero
  if (num % 3 === 1) column = 1;
  else if (num % 3 === 2) column = 2;
  else if (num % 3 === 0 && num !== 0) column = 3;

  const terminal = num % 10;
  
  // Neighbours (direct sequence in race)
  const idx = ROULETTE_RACE_SEQUENCE.indexOf(num);
  const prev = ROULETTE_RACE_SEQUENCE[(idx - 1 + 37) % 37];
  const next = ROULETTE_RACE_SEQUENCE[(idx + 1) % 37];
  
  // Zone
  const zones = [];
  if (ROULETTE_ZONES.VOISINS.includes(num)) zones.push('VOISINS');
  if (ROULETTE_ZONES.TIERS.includes(num)) zones.push('TIERS');
  if (ROULETTE_ZONES.ORPHELINS.includes(num)) zones.push('ORPHELINS');
  if (ROULETTE_ZONES.ZERO_SPIEL.includes(num)) zones.push('ZERO_SPIEL');

  return {
    num,
    color,
    parity,
    highLow,
    dozen,
    column,
    terminal,
    neighbours: [prev, next],
    zones
  };
};

export const findMostProbableEntry = (history: any[], type: string) => {
  if (history.length < 5) return null;
  const sampleSize = 5;
  
  if (type === 'roulette') {
    const relevantHistory = history.filter(h => h.gameType === 'roulette');
    if (relevantHistory.length < 5) return null;
    const results = relevantHistory.map(h => h.metadata);
    const recentResults = results.slice(0, sampleSize);

    const calculateFrequency = (checkFn: (m: any) => boolean) => {
       return (recentResults.filter(checkFn).length / sampleSize) * 100;
    };

    const categories = [
      { name: 'Cor: Vermelho', freq: calculateFrequency(m => m.color === 'red'), entry: 'Red' },
      { name: 'Cor: Preto', freq: calculateFrequency(m => m.color === 'black'), entry: 'Black' },
      { name: 'Paridade: Par', freq: calculateFrequency(m => m.parity === 'even'), entry: 'Even' },
      { name: 'Paridade: Ímpar', freq: calculateFrequency(m => m.parity === 'odd'), entry: 'Odd' },
      { name: 'Dúzia 1', freq: calculateFrequency(m => m.dozen === 1), entry: 'Dúzia 1' },
      { name: 'Dúzia 2', freq: calculateFrequency(m => m.dozen === 2), entry: 'Dúzia 2' },
      { name: 'Dúzia 3', freq: calculateFrequency(m => m.dozen === 3), entry: 'Dúzia 3' },
      { name: 'Coluna 1', freq: calculateFrequency(m => m.column === 1), entry: 'Coluna 1' },
      { name: 'Coluna 2', freq: calculateFrequency(m => m.column === 2), entry: 'Coluna 2' },
      { name: 'Coluna 3', freq: calculateFrequency(m => m.column === 3), entry: 'Coluna 3' },
      { name: 'Sinal: Vizinhos de Zero', freq: calculateFrequency(m => m && m.zones && m.zones.includes('VOISINS')), entry: 'Vizinhos de Zero' },
      { name: 'Sinal: Tiers', freq: calculateFrequency(m => m && m.zones && m.zones.includes('TIERS')), entry: 'Tiers' },
      { name: 'Sinal: Orphelins', freq: calculateFrequency(m => m && m.zones && m.zones.includes('ORPHELINS')), entry: 'Orphelins' },
    ];

    // Terminals frequency
    for(let t=0; t<10; t++) {
      categories.push({ name: `Terminal ${t}`, freq: calculateFrequency(m => m.terminal === t), entry: `Terminal ${t}` });
    }

    // Sort by frequency (highest first)
    categories.sort((a, b) => b.freq - a.freq);
    
    const best = categories[0];
    
    // User requested > 75% assertivity based on last 5 results.
    // In a sample of 5, this means 4/5 (80%) or 5/5 (100%).
    if (best.freq >= 80) {
      return {
        patternName: `${best.name} (Assertividade: ${best.freq.toFixed(0)}%)`,
        entry: best.entry,
        confidence: best.freq
      };
    }
  }

  // Other games: Baccarat
  if (type === 'baccarat') {
     const relevantHistory = history.filter(h => h.gameType === type);
     const lastResults = relevantHistory.map(h => h.result).slice(0, sampleSize);
     if (lastResults.length < sampleSize) return null;

     const calculateFreq = (val: string) => {
        return (lastResults.filter(r => r === val).length / sampleSize) * 100;
     };

     const options = [{ id: 'B', label: 'Banker' }, { id: 'P', label: 'Player' }];
     const labelMap: Record<string, string> = { 'P': 'PLAYER', 'B': 'BANKER', 'T': 'TIE' };

     // 1. Frequency Analysis
     const analyzed = options.map(opt => ({
        id: opt.id,
        label: opt.label,
        freq: calculateFreq(opt.id)
     }));
     analyzed.sort((a, b) => b.freq - a.freq);
     const bestFreq = analyzed[0];

     // 2. Streak Analysis (Dragon)
     let currentStreak = 1;
     for (let i = 0; i < lastResults.length - 1; i++) {
       if (lastResults[i] === lastResults[i + 1]) currentStreak++;
       else break;
     }
     
     // 3. Alternation Analysis (Ping-Pong / Chop)
     let isAlternating = true;
     for (let i = 0; i < lastResults.length - 1; i++) {
       if (lastResults[i] === lastResults[i + 1]) {
         isAlternating = false;
         break;
       }
     }

     // Decision Logic
     if (bestFreq.freq >= 80) {
       return {
         patternName: `${bestFreq.label} Dominante (${bestFreq.freq.toFixed(0)}%)`,
         entry: labelMap[bestFreq.id] || bestFreq.id,
         confidence: bestFreq.freq
       };
     }

     if (currentStreak >= 3) {
       return {
         patternName: `Sequência de ${bestFreq.label} (Dragon)`,
         entry: labelMap[lastResults[0]] || lastResults[0],
         confidence: currentStreak === 5 ? 100 : currentStreak === 4 ? 90 : 80
       };
     }

     if (isAlternating && lastResults.length >= 4) {
       const nextEntry = lastResults[0] === 'B' ? 'P' : 'B';
       return {
         patternName: `Padrão de Alternância (Chop)`,
         entry: labelMap[nextEntry] || nextEntry,
         confidence: 85
       };
     }
  }

  return null;
};

export const calculateStats = (history: any[], type: string) => {
  if (history.length === 0) return null;

  // Basic stats like frequency of colors, parity, etc.
  // This is a simplified version of the engine
  const stats: any = {};

  if (type === 'roulette') {
    const numbers = history.map(h => h.result);
    // Count repetitions
    const repeatCount: any = {};
    numbers.forEach(n => {
      repeatCount[n] = (repeatCount[n] || 0) + 1;
    });
    
    // Find delays (atrasos) for each category
    // ... logic for dozen delay, column delay, etc.
  }

  return stats;
};

export const checkWin = (result: any, entry: string | undefined): boolean => {
  if (!entry) return false;
  
  const resStr = String(result).toLowerCase();
  const entStr = String(entry).toLowerCase();

  // Roulette numeric checks
  if (typeof result === 'number' || !isNaN(Number(result))) {
    const num = Number(result);
    if (entStr === 'red' || entStr === 'vermelho') return COLOR_MAP.ROULETTE.RED.includes(num);
    if (entStr === 'black' || entStr === 'preto') return COLOR_MAP.ROULETTE.BLACK.includes(num);
    if (entStr === 'even' || entStr === 'par') return num !== 0 && num % 2 === 0;
    if (entStr === 'odd' || entStr === 'ímpar' || entStr === 'impar') return num % 2 !== 0;
    if (entStr === 'dúzia 1' || entStr === '1ª dúzia' || entStr === 'duzia 1' || entStr === '1-12') return num >= 1 && num <= 12;
    if (entStr === 'dúzia 2' || entStr === '2ª dúzia' || entStr === 'duzia 2' || entStr === '13-24') return num >= 13 && num <= 24;
    if (entStr === 'dúzia 3' || entStr === '3ª dúzia' || entStr === 'duzia 3' || entStr === '25-36') return num >= 25 && num <= 36;
    if (entStr === 'coluna 1' || entStr === '1ª coluna') return num !== 0 && num % 3 === 1;
    if (entStr === 'coluna 2' || entStr === '2ª coluna') return num !== 0 && num % 3 === 2;
    if (entStr === 'coluna 3' || entStr === '3ª coluna') return num !== 0 && num % 3 === 0;
    if (entStr === 'high' || entStr === 'maior' || entStr === 'alta' || entStr === 'alto' || entStr === '19-36') return num >= 19 && num <= 36;
    if (entStr === 'low' || entStr === 'menor' || entStr === 'baixa' || entStr === 'baixo' || entStr === '1-18') return num >= 1 && num <= 18;
    
    // Sectors
    if (entStr.includes('vizinhos') || entStr.includes('voisins')) return ROULETTE_ZONES.VOISINS.includes(num);
    if (entStr.includes('tiers')) return ROULETTE_ZONES.TIERS.includes(num);
    if (entStr.includes('orphelins')) return ROULETTE_ZONES.ORPHELINS.includes(num);
    if (entStr.includes('zero spell') || entStr.includes('zero game') || entStr.includes('jeu zero')) return ROULETTE_ZONES.ZERO_SPIEL.includes(num);

    // Specialized bet patterns
    if (entStr.startsWith('pleno') || !isNaN(Number(entStr))) {
      let targetStr = entStr;
      if (entStr.startsWith('pleno')) {
        targetStr = entStr.replace('pleno', '').trim();
      }
      const targetNum = Number(targetStr);
      if (isNaN(targetNum)) return false;
      const index = ROULETTE_RACE_SEQUENCE.indexOf(targetNum);
      if (index === -1) return num === targetNum;
      
      const covered = new Set<number>();
      covered.add(targetNum);
      for (let k = 1; k <= 5; k++) {
        covered.add(ROULETTE_RACE_SEQUENCE[(index - k + 37) % 37]);
        covered.add(ROULETTE_RACE_SEQUENCE[(index + k) % 37]);
      }
      return covered.has(num);
    }
    if (entStr.startsWith('dividida')) {
      const numbers = entStr.replace('dividida:', '').split('-').map(n => Number(n.trim()));
      return numbers.includes(num);
    }
    if (entStr.startsWith('rua')) {
      const numbers = entStr.replace('rua:', '').split('-').map(n => Number(n.trim()));
      return numbers.includes(num);
    }
    if (entStr.startsWith('canto')) {
      const numbers = entStr.replace('canto:', '').split('-').map(n => Number(n.trim()));
      return numbers.includes(num);
    }
    if (entStr.startsWith('linha')) {
      const numbers = entStr.replace('linha:', '').split('-').map(n => Number(n.trim()));
      return numbers.includes(num);
    }

    if (entStr.includes('terminal')) {
       const match = entStr.match(/terminal\s+(\d+)/);
       if (match) {
         const t = parseInt(match[1], 10);
         return num % 10 === t;
       }
    }

    // Support for complex patterns from strategies (JSON strings or formatted labels)
    if (entStr.startsWith('[') && entStr.endsWith(']')) {
      try {
        const numbers = JSON.parse(entStr);
        if (Array.isArray(numbers)) return numbers.includes(num);
      } catch (e) { /* Not JSON */ }
    }
  }
  
  // Game mappings (Baccarat)
  const mappings: Record<string, string[]> = {
    'banker': ['b', 'banker'],
    'player': ['p', 'player'],
    'tie': ['t', 'tie', 'empate'],
    'b': ['b', 'banker'],
    'p': ['p', 'player'],
    't': ['t', 'tie', 'empate']
  };

  if (mappings[entStr]) {
    return mappings[entStr].includes(resStr);
  }
  
  // Exact match or numeric match
  return resStr === entStr;
};
