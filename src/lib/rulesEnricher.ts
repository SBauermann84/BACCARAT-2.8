import { GameType } from '../types';
import { REGIONAL_BETS_DEFINITIONS, detectRegionalSector } from '../constants';

export const getEnrichedRules = (sName: string, sRules: any, itemGameType: GameType) => {
  const hasBac = sRules && sRules.baccaratPattern && sRules.baccaratPattern.length > 0;
  const hasTrigger = sRules && sRules.triggerConfig;
  const hasMined = sRules && sRules.minedId;
  const hasPredicted = sRules && sRules.predictedEntry;

  // Check if strategy corresponds to a regional sector
  const detectedSector = detectRegionalSector({ name: sName, entry: sName, rules: sRules });
  if (detectedSector && REGIONAL_BETS_DEFINITIONS[detectedSector]) {
    return {
      ...(sRules || {}),
      bets: REGIONAL_BETS_DEFINITIONS[detectedSector]
    };
  }

  const hasBets = sRules && sRules.bets && sRules.bets.length > 0;
  if (hasBets || hasBac || hasTrigger || hasMined || hasPredicted) return sRules;

  const sNameLower = sName.toLowerCase();
  if (itemGameType === GameType.ROULETTE) {
    if (sNameLower.includes('voisins') || sNameLower.includes('vizinhos')) {
      return { bets: REGIONAL_BETS_DEFINITIONS.VOISINS };
    }
    if (sNameLower.includes('tiers') || sNameLower.includes('terço') || sNameLower.includes('terco')) {
      return { bets: REGIONAL_BETS_DEFINITIONS.TIERS };
    }
    if (sNameLower.includes('orphelins') || sNameLower.includes('órfãos') || sNameLower.includes('orfaos')) {
      return { bets: REGIONAL_BETS_DEFINITIONS.ORPHELINS };
    }
    if (sNameLower.includes('zero spiel') || sNameLower.includes('jeu zero') || sNameLower.includes('jogo do zero')) {
      return { bets: REGIONAL_BETS_DEFINITIONS.ZERO_SPIEL };
    }
    if (sNameLower.includes('dúzia 1') || sNameLower.includes('duzia 1') || sNameLower.includes('1ª dúzia')) {
      return { bets: [{ type: 'dozen', target: '1', amount: 10 }] };
    }
    if (sNameLower.includes('dúzia 2') || sNameLower.includes('duzia 2') || sNameLower.includes('2ª dúzia')) {
      return { bets: [{ type: 'dozen', target: '2', amount: 10 }] };
    }
    if (sNameLower.includes('dúzia 3') || sNameLower.includes('duzia 3') || sNameLower.includes('3ª dúzia')) {
      return { bets: [{ type: 'dozen', target: '3', amount: 10 }] };
    }
    if (sNameLower.includes('coluna 1') || sNameLower.includes('1ª coluna')) {
      return { bets: [{ type: 'column', target: '1', amount: 10 }] };
    }
    if (sNameLower.includes('coluna 2') || sNameLower.includes('2ª coluna')) {
      return { bets: [{ type: 'column', target: '2', amount: 10 }] };
    }
    if (sNameLower.includes('coluna 3') || sNameLower.includes('3ª coluna')) {
      return { bets: [{ type: 'column', target: '3', amount: 10 }] };
    }
    if (sNameLower.includes('preto') || sNameLower.includes('black')) {
      return { bets: [{ type: 'color', target: 'black', amount: 10 }] };
    }
    if (sNameLower.includes('vermelho') || sNameLower.includes('red')) {
      return { bets: [{ type: 'color', target: 'red', amount: 10 }] };
    }
    if (sNameLower.includes('par') || sNameLower.includes('even')) {
      return { bets: [{ type: 'even_chance', target: 'even', amount: 10 }] };
    }
    if (sNameLower.includes('impar') || sNameLower.includes('ímpar') || sNameLower.includes('odd')) {
      return { bets: [{ type: 'even_chance', target: 'odd', amount: 10 }] };
    }
    if (sNameLower.includes('alto') || sNameLower.includes('maior') || sNameLower.includes('high')) {
      return { bets: [{ type: 'even_chance', target: 'high', amount: 10 }] };
    }
    if (sNameLower.includes('baixo') || sNameLower.includes('menor') || sNameLower.includes('low')) {
      return { bets: [{ type: 'even_chance', target: 'low', amount: 10 }] };
    }
    if (sNameLower.includes('terminais de alta precisão') || sNameLower.includes('terminais ímpares') || sNameLower.includes('terminais gêmeos')) {
      return {
        bets: [
          { type: 'number', target: 1, amount: 10 },
          { type: 'number', target: 11, amount: 10 },
          { type: 'number', target: 21, amount: 10 },
          { type: 'number', target: 31, amount: 10 },
          { type: 'number', target: 3, amount: 10 },
          { type: 'number', target: 13, amount: 10 },
          { type: 'number', target: 23, amount: 10 },
          { type: 'number', target: 33, amount: 10 },
          { type: 'number', target: 7, amount: 10 },
          { type: 'number', target: 17, amount: 10 },
          { type: 'number', target: 27, amount: 10 },
          { type: 'number', target: 9, amount: 10 },
          { type: 'number', target: 19, amount: 10 },
          { type: 'number', target: 29, amount: 10 }
        ]
      };
    }
    if (sNameLower.includes('ruas') || sNameLower.includes('street')) {
      return { bets: [{ type: 'multi', target: [13, 14, 15], amount: 10 }, { type: 'multi', target: [16, 17, 18], amount: 10 }] };
    }
    return sRules || { bets: [] };
  } else {
    if (sNameLower.includes('banker') || sNameLower.includes('banca')) {
      return { baccaratPattern: [{ r: 0, c: 0, type: 'B' }, { r: 1, c: 0, type: '?' }] };
    }
    if (sNameLower.includes('zig') || sNameLower.includes('zag')) {
      return { baccaratPattern: [{ r: 0, c: 0, type: 'P' }, { r: 0, c: 1, type: 'B' }, { r: 0, c: 2, type: '?' }] };
    }
    return sRules || { baccaratPattern: [{ r: 0, c: 0, type: 'P' }, { r: 1, c: 0, type: '?' }] };
  }
};
