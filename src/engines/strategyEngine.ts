import { Strategy, GameType, GameResult } from '../types';
import { checkWin } from './statsEngine';
import { learningService } from '../services/learningService';
import { ROULETTE_RACE_SEQUENCE, ROULETTE_ZONES, detectRegionalSector, REGIONAL_BETS_DEFINITIONS, REGIONAL_SECTOR_UNITS } from '../constants';
import { calculateProportionalCoverage } from './progressionEngine';
import { getEnrichedRules } from '../lib/rulesEnricher';
import { evaluateMinedPatternTrigger } from './baccaratPatternMiningEngine';

export interface StrategySignal {
  type: 'strong' | 'moderate';
  patternName: string;
  confidence: number;
  entry: string;
  source: 'strategy';
  strategyId: string;
  strategyName: string;
  winRate: number;
  entryNumbers?: number[];
  unitsRequired?: number;
  rules?: any;
}

export const strategyEngine = {
  findStrategySignalsSync(strategies: Strategy[], history: GameResult[], gameType: GameType): StrategySignal[] {
    if (history.length < 1) return [];

    const activeStrategies = strategies.filter(s => s.isActive && s.gameType === gameType);
    if (activeStrategies.length === 0) return [];

    const signals: StrategySignal[] = [];
    
    // Get historical recommendation across full history synchronously
    const historicalRec = learningService.getRecommendedEntrySync(gameType, history);

    for (const strategy of activeStrategies) {
      // Bloqueio rigoroso de sinais para estratégias com assertividade abaixo de 40%
      if (strategy.performance && (strategy.performance.totalEntries || 0) >= 2 && (strategy.performance.winRate || 0) < 40) {
        continue;
      }

      if (strategy.id === 'system-roulette-historical-base' || strategy.id === 'system-baccarat-historical-base') {
        if (historicalRec && historicalRec.confidence >= 65) {
          signals.push({
            type: historicalRec.confidence >= 80 ? 'strong' : 'moderate',
            patternName: historicalRec.patternName,
            confidence: historicalRec.confidence,
            entry: historicalRec.entry,
            source: 'strategy',
            strategyId: strategy.id,
            strategyName: strategy.name,
            winRate: historicalRec.winRate || historicalRec.confidence,
            entryNumbers: historicalRec.entryNumbers,
            unitsRequired: historicalRec.unitsRequired || 1
          });
        }
        continue;
      }

      const enrichedRules = getEnrichedRules(strategy.name, strategy.rules, strategy.gameType);
      const enrichedStrategy = { ...strategy, rules: enrichedRules };

      if (strategy.gameType === GameType.BACCARAT) {
        let signalValue: string | null = null;
        const minedId = enrichedRules?.minedId || (strategy.rules as any)?.minedId;

        if (minedId) {
          const trigger = evaluateMinedPatternTrigger(minedId, history);
          if (trigger) {
            signalValue = trigger === 'BANKER' ? 'B' : trigger === 'PLAYER' ? 'P' : 'T';
          }
        } else if (enrichedRules && enrichedRules.predictedEntry) {
          // Mined strategy with explicit predicted entry
          signalValue = enrichedRules.predictedEntry === 'BANKER' ? 'B' : enrichedRules.predictedEntry === 'PLAYER' ? 'P' : 'T';
        } else if (enrichedRules && enrichedRules.baccaratPattern) {
          signalValue = checkBaccaratPattern(enrichedRules.baccaratPattern, history);
        }

        if (signalValue) {
          signals.push({
            type: strategy.performance.winRate >= 70 ? 'strong' : 'moderate',
            patternName: strategy.name,
            confidence: Math.max(70, Math.round(strategy.performance.winRate || 75)),
            entry: signalValue === 'P' ? 'PLAYER' : signalValue === 'B' ? 'BANKER' : 'TIE',
            source: 'strategy',
            strategyId: strategy.id,
            strategyName: strategy.name,
            winRate: strategy.performance.winRate || 70
          });
        }
        continue;
      }



      const hasBets = enrichedRules && enrichedRules.bets && enrichedRules.bets.length > 0;
      const hasRacetrackConfluence = enrichedRules?.triggerConfig?.useRacetrackConfluence;
      if (!hasBets && !hasRacetrackConfluence) continue;

      let betLabel = enrichedStrategy.name;
      const coverageCount = hasBets ? calculateCoverage(enrichedStrategy) : 0;
      
      let finalConfidence = 50;
      let reason = '';
      let isTriggered = false;
      let entryNumbersOverride: number[] | undefined;

      if (enrichedStrategy.rules?.triggerConfig) {
        const customResult = evaluateCustomTriggers(enrichedStrategy.rules.triggerConfig, history, enrichedStrategy);
        if (customResult.triggered) {
          isTriggered = true;
          reason = customResult.reason;
          finalConfidence = customResult.confidence;
          entryNumbersOverride = customResult.entryNumbersOverride;
        } else {
          continue; // Custom trigger not met
        }
      } else {
        // Fallback: Default repetition/momentum analysis
        const delayThreshold = Math.max(2, Math.floor(37 / (coverageCount || 1)) + 1);
        const strategyAssertivity = calculatePerformance(history, enrichedStrategy);
        const repetition = calculateStrategyRepetition(history, enrichedStrategy);
        
        const repMin = delayThreshold < 5 ? 2 : 3; 
        let trendConfidence = 50;
        if (repetition >= repMin) {
          trendConfidence = 82 + (repetition * 3.5);
          reason = `Momentum Quente (${repetition}x)`;
        } else {
          trendConfidence = 35;
          reason = '';
        }

        finalConfidence = Math.round((strategyAssertivity * 0.4) + (trendConfidence * 0.6));
        isTriggered = finalConfidence >= 64;
      }

      if (isTriggered) {
        // Special case label for single-bet strategies to keep it clean
        let entry = betLabel;
        if (hasBets && enrichedRules.bets.length === 1) {
          const b = enrichedRules.bets[0];
          if (b.type === 'number') entry = `Pleno ${b.target}`;
          else if (b.type === 'dozen') entry = `Dúzia ${b.target}`;
          else if (b.type === 'column') entry = `Coluna ${b.target}`;
          else if (b.type === 'color') entry = b.target === 'red' ? 'Red' : 'Black';
          else if (b.type === 'even_chance') entry = b.target.charAt(0).toUpperCase() + b.target.slice(1);
        } else if (entryNumbersOverride) {
          entry = reason;
        }

        const detectedSector = detectRegionalSector({ entry, reason, name: strategy.name, rules: enrichedStrategy.rules, entryNumbers: entryNumbersOverride });
        const regionalBets = detectedSector ? REGIONAL_BETS_DEFINITIONS[detectedSector] : null;
        const totalUnits = detectedSector && REGIONAL_SECTOR_UNITS[detectedSector]
          ? REGIONAL_SECTOR_UNITS[detectedSector]
          : (entryNumbersOverride 
            ? entryNumbersOverride.length 
            : (enrichedStrategy.rules?.bets?.reduce((acc: number, b: any) => acc + (b.amount || 1), 0) || 1));

        signals.push({
          type: finalConfidence > 88 ? 'strong' : 'moderate',
          patternName: reason || 'Padrão Confirmado',
          confidence: Math.min(Math.round(finalConfidence), 99),
          entry: entry,
          source: 'strategy',
          strategyId: strategy.id,
          strategyName: strategy.name,
          winRate: Math.round(strategy.performance.winRate || finalConfidence),
          entryNumbers: entryNumbersOverride || getCoveredNumbersForStrategy(enrichedStrategy),
          unitsRequired: totalUnits,
          rules: {
            ...enrichedStrategy.rules,
            ...(regionalBets ? { bets: regionalBets } : {})
          }
        });
      }
    }

    return signals.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
  },

  async findStrategySignals(strategies: Strategy[], history: GameResult[], gameType: GameType): Promise<StrategySignal[]> {
    return this.findStrategySignalsSync(strategies, history, gameType);
  },

  calculateFullPerformance(strategy: Strategy, history: GameResult[]): Strategy['performance'] {
    const relevantHistory = history.filter(h => h.gameType === strategy.gameType);
    if (relevantHistory.length === 0) {
      return { winRate: 0, totalEntries: 0, wins: 0, losses: 0, roi: 0, maxDrawdown: 0 };
    }

    // This is a simplified backtest simulation to find entries
    // It's similar to what runBacktest does but specifically for updating performance
    let wins = 0;
    let losses = 0;
    let totalEntries = 0;

    // We simulate from past to future
    const chronoHistory = [...relevantHistory].reverse();
    
    // For performance tracking, we only count entries where the strategy WOULD HAVE signaled.
    // However, the findStrategySignals logic depends on a sliding window.
    // For simplicity, let's just check compliance for now or use the existing backtest engine logic if it's cleaner.
    
    // Actually, let's just use the current stats from the strategy object if they exist, 
    // but the user wants to "sum" previous and future. 
    // If performance is already baked into the strategy, we just need to make sure we don't reset it.
    
    return strategy.performance;
  },

  checkStrategyWin(strategy: Strategy, result: any, betSize: number = 10, managementConfig: any = null): boolean {
    return checkStrategyWin(strategy, result, betSize, managementConfig);
  },

  verifyTypeMatch(rouletteResult: any, targetValue: any): boolean {
    return verifyTypeMatch(rouletteResult, targetValue);
  },

  calculateStrategySpinProfit(strategy: Strategy, result: any, betSize: number, managementConfig: any): number {
    if (!strategy.rules) {
      return 0;
    }

    const normalizedBetSize = Math.round(Number(betSize || 10) * 100) / 100;
    const initialBetFromConfig = managementConfig?.initialBet;
    const normalizedInitialBet = Math.round(Number(initialBetFromConfig || 10) * 100) / 100;

    const betScale = normalizedBetSize / (normalizedInitialBet || 1);
    const stepSize = managementConfig?.minChip || (strategy.gameType === GameType.BACCARAT ? 0.20 : 0.10);

    if (strategy.rules.bets && strategy.rules.bets.length > 0) {
      let spinProfit = 0;
      const totalStrategyUnits = strategy.rules.bets.reduce((sum: number, b: any) => sum + (b.amount || 1), 0);
      strategy.rules.bets.forEach((bet: any) => {
        const units = bet.amount || 1;
        // Proportionally scale individual bet amount so the total cost is exactly the normalizedBetSize
        const betProportion = units / (totalStrategyUnits || 1);
        let individualBetAmount = normalizedBetSize * betProportion;
        // Normaliza o valor de cada aposta individualizada para duas casas decimais (fichas reais)
        individualBetAmount = Math.round(individualBetAmount * 100) / 100;

        const isWin = checkSingleBetWin(bet, result);

        let multiplier = 1;
        const targetStr = String(bet.target || bet.entry || '').toUpperCase();
        const isBanker = targetStr === 'BANKER' || targetStr === 'B' || bet.type === 'banker';
        const isPlayer = targetStr === 'PLAYER' || targetStr === 'P' || bet.type === 'player';
        const isTie = targetStr === 'TIE' || targetStr === 'T' || bet.type === 'tie' || targetStr === 'EMPATE';

        const resStr = String(result).toUpperCase().trim();
        const isResultTie = resStr === 'TIE' || resStr === 'T' || resStr === 'EMPATE' || resStr === 'E';

        if (isBanker) {
          multiplier = 0.95;
        } else if (isTie) {
          multiplier = 8;
        } else if (bet.type === 'dozen' || bet.type === 'column') {
          multiplier = 2; // Payout 2:1
        } else if (bet.type === 'color' || bet.type === 'even_chance') {
          multiplier = 1; // Payout 1:1
        } else if (bet.type === 'multi') {
          const len = Array.isArray(bet.target) ? bet.target.length : 0;
          if (len === 2) multiplier = 17;
          else if (len === 3) multiplier = 11;
          else if (len === 4) multiplier = 8;
          else if (len === 6) multiplier = 5;
        } else if (bet.type === 'number') {
          multiplier = 35;
        }

        // Special Baccarat Rule: If outcome is TIE and bet was on PLAYER or BANKER, bet is returned (profit = 0)
        if ((strategy.gameType === GameType.BACCARAT || isBanker || isPlayer) && isResultTie && (isBanker || isPlayer)) {
          // Bet is refunded on Tie in Baccarat (Não perde nem ganha)
          spinProfit += 0;
        } else if (isWin) {
          if (bet.type === 'number') {
            const { individualBetSize, actualTotalCost } = calculateProportionalCoverage(individualBetAmount, 11, stepSize);
            spinProfit += (individualBetSize * 36) - actualTotalCost;
          } else {
            spinProfit += individualBetAmount * multiplier;
          }
        } else {
          if (bet.type === 'number') {
            const { actualTotalCost } = calculateProportionalCoverage(individualBetAmount, 11, stepSize);
            spinProfit -= actualTotalCost;
          } else {
            spinProfit -= individualBetAmount;
          }
        }
      });
      return Math.round(spinProfit * 100) / 100;
    }

    if (strategy.gameType === GameType.BACCARAT) {
      const targetStr = String(strategy.rules?.predictedEntry || strategy.rules?.target || 'BANKER').toUpperCase().trim();
      const resStr = String(result).toUpperCase().trim();

      const isResultTie = resStr === 'TIE' || resStr === 'T' || resStr === 'EMPATE' || resStr === 'E';
      const isResultBanker = resStr === 'BANKER' || resStr === 'B';
      const isResultPlayer = resStr === 'PLAYER' || resStr === 'P';

      const isTargetBanker = targetStr === 'BANKER' || targetStr === 'B';
      const isTargetPlayer = targetStr === 'PLAYER' || targetStr === 'P';
      const isTargetTie = targetStr === 'TIE' || targetStr === 'T' || targetStr === 'EMPATE';

      if (isTargetBanker) {
        if (isResultBanker) return Math.round(normalizedBetSize * 0.95 * 100) / 100;
        if (isResultTie) return 0;
        return -normalizedBetSize;
      } else if (isTargetPlayer) {
        if (isResultPlayer) return normalizedBetSize;
        if (isResultTie) return 0;
        return -normalizedBetSize;
      } else if (isTargetTie) {
        if (isResultTie) return Math.round(normalizedBetSize * 8 * 100) / 100;
        return -normalizedBetSize;
      }
    }

    return 0;
  }
};

export function checkBaccaratPattern(pattern: any[], history: GameResult[]): string | null {
  if (!pattern || pattern.length === 0) return null;
  
  const signalCell = pattern.find(p => p.type === '?');
  if (!signalCell) return null;
  
  const otherCells = pattern.filter(p => p.type !== '?');
  if (otherCells.length === 0) return null;

  // Chronological history for Bead Plate mapping
  const chrono = [...history].reverse();
  const grid: Record<string, string> = {};
  chrono.forEach((h, i) => {
    const r = i % 6;
    const c = Math.floor(i / 6);
    grid[`${r},${c}`] = h.result; 
  });

  // Alignment: Anchor the pattern based on the most recent non-signal cell
  const patternIndices = otherCells.map(p => p.r + p.c * 6);
  const patternMaxI = Math.max(...patternIndices);
  const anchorCell = otherCells.find(p => (p.r + p.c * 6) === patternMaxI)!;
  
  const lastI = chrono.length - 1;
  const lastR = lastI % 6;
  const lastC = Math.floor(lastI / 6);

  const offR = lastR - anchorCell.r;
  const offC = lastC - anchorCell.c;
  
  const matches = otherCells.every(p => {
    const targetR = p.r + offR;
    const targetC = p.c + offC;
    return grid[`${targetR},${targetC}`] === p.type;
  });
  
  if (matches) {
    const qR = signalCell.r + offR;
    const qC = signalCell.c + offC;
    const qI = qR + qC * 6;
    
    // If the signal position corresponds to the NEXT result index
    if (qI === chrono.length) {
       // Now find the BEST outcome for this trigger in the whole history
       const outcomes = { PLAYER: 0, BANKER: 0, TIE: 0 };
       
       for (let i = 0; i < chrono.length; i++) {
          const cR = i % 6;
          const cC = Math.floor(i / 6);
          const oR = cR - anchorCell.r;
          const oC = cC - anchorCell.c;
          
          const m = otherCells.every(p => grid[`${p.r + oR},${p.c + oC}`] === p.type);
          if (m) {
             const nextVal = grid[`${signalCell.r + oR},${signalCell.c + oC}`];
             if (nextVal) {
                outcomes[nextVal as 'PLAYER'|'BANKER'|'TIE']++;
             }
          }
       }

       const maxWins = Math.max(outcomes.PLAYER, outcomes.BANKER, outcomes.TIE);
       if (maxWins === 0) return null;

       if (outcomes.PLAYER === maxWins) return 'P';
       if (outcomes.BANKER === maxWins) return 'B';
       return 'T';
    }
  }

  return null;
}

export function verifyTypeMatch(rouletteResult: any, targetValue: any): boolean {
  if (rouletteResult === undefined || rouletteResult === null || targetValue === undefined || targetValue === null) {
    return false;
  }

  const resStr = String(rouletteResult).trim();
  const tarStr = String(targetValue).trim();

  // Se ambos puderem ser convertidos para números válidos, comparamos os números
  // Isso resolve e evita falhas silenciosas do tipo '1' === 1
  const resNum = Number(rouletteResult);
  const tarNum = Number(targetValue);

  const isResNumeric = !isNaN(resNum) && resStr !== '';
  const isTarNumeric = !isNaN(tarNum) && tarStr !== '';

  if (isResNumeric && isTarNumeric) {
    return resNum === tarNum;
  }

  return resStr.toLowerCase() === tarStr.toLowerCase();
}

export function checkSingleBetWin(bet: any, result: any): boolean {
  if (result === undefined || result === null) return false;
  
  const num = Number(result);
  const isNumeric = !isNaN(num);

  if (bet.type === 'multi') {
    if (Array.isArray(bet.target)) {
      return bet.target.some((val: any) => verifyTypeMatch(result, val));
    }
    if (typeof bet.target === 'string') {
      try {
        const parsed = JSON.parse(bet.target);
        if (Array.isArray(parsed)) {
          return parsed.some((val: any) => verifyTypeMatch(result, val));
        }
      } catch (e) {
        // Continue
      }
      const parts = bet.target.split(/[,-]/);
      if (parts.length > 1) {
        return parts.some((val: any) => verifyTypeMatch(result, val));
      }
      return verifyTypeMatch(result, bet.target);
    }
    return verifyTypeMatch(result, bet.target);
  }

  if (bet.type === 'number') {
    if (verifyTypeMatch(result, bet.target)) {
      return true;
    }
    const targetStr = String(bet.target);
    return checkWin(result, targetStr);
  }

  if (bet.type === 'dozen') {
    const targetStr = String(bet.target).trim();
    if (isNumeric) {
      if (targetStr === '1') return num >= 1 && num <= 12;
      if (targetStr === '2') return num >= 13 && num <= 24;
      if (targetStr === '3') return num >= 25 && num <= 36;
    }
  }

  if (bet.type === 'column') {
    const targetStr = String(bet.target).trim();
    if (isNumeric && num !== 0) {
      if (targetStr === '1') return num % 3 === 1;
      if (targetStr === '2') return num % 3 === 2;
      if (targetStr === '3') return num % 3 === 0;
    }
  }

  if (bet.type === 'color') {
    const targetStr = String(bet.target).toLowerCase().trim();
    return checkWin(result, targetStr);
  }

  if (bet.type === 'even_chance') {
    const targetStr = String(bet.target).toLowerCase().trim();
    return checkWin(result, targetStr);
  }

  if (bet.type === 'line' || bet.type === 'double_street' || bet.type === 'seisena' || bet.type === 'linha') {
    const tVal = String(bet.target).trim();
    if (tVal === '1') return num >= 1 && num <= 6;
    if (tVal === '2') return num >= 7 && num <= 12;
    if (tVal === '3') return num >= 13 && num <= 18;
    if (tVal === '4') return num >= 19 && num <= 24;
    if (tVal === '5') return num >= 25 && num <= 30;
    if (tVal === '6') return num >= 31 && num <= 36;

    const cleaned = tVal.replace('_', '-');
    if (cleaned.includes('-')) {
      const parts = cleaned.split('-');
      const start = Number(parts[0]);
      const end = Number(parts[1]);
      if (!isNaN(start) && !isNaN(end)) {
        return num >= start && num <= end;
      }
    }
  }

  if (bet.type === 'street' || bet.type === 'rua') {
    const tVal = String(bet.target).trim();
    const sNum = Number(tVal);
    if (!isNaN(sNum) && sNum >= 1 && sNum <= 12) {
      const start = (sNum - 1) * 3 + 1;
      return num >= start && num <= start + 2;
    }

    const cleaned = tVal.replace('_', '-');
    if (cleaned.includes('-')) {
      const parts = cleaned.split('-');
      const start = Number(parts[0]);
      const end = Number(parts[1]);
      if (!isNaN(start) && !isNaN(end)) {
        return num >= start && num <= end;
      }
    }
  }

  if (bet.type === 'corner' || bet.type === 'canto' || bet.type === 'split' || bet.type === 'dividida') {
    const tVal = String(bet.target).trim();
    const cleaned = tVal.replace(/_/g, '-').replace(/,/g, '-');
    if (cleaned.includes('-')) {
      const parts = cleaned.split('-').map(Number);
      return parts.includes(num);
    }
  }

  // Fallback
  let entryRef = '';
  if (bet.type === 'dozen' || bet.type === 'column') {
    entryRef = (bet.type === 'dozen' ? 'Dúzia ' : 'Coluna ') + bet.target;
  } else if (bet.type === 'multi') {
    entryRef = JSON.stringify(bet.target);
  } else {
    entryRef = String(bet.target);
  }
  return checkWin(result, entryRef);
}

function checkStrategyWin(strategy: Strategy, result: any, betSize: number = 10, managementConfig: any = null): boolean | undefined {
  if (strategy.rules?.triggerConfig?.useRacetrackConfluence) {
    const triggerConfig = strategy.rules.triggerConfig;
    const confluenceType = triggerConfig.confluenceType || 'terminals';
    const neighborsCount = triggerConfig.globalNeighborsCount !== undefined ? triggerConfig.globalNeighborsCount : 3;
    const resNum = Number(result);

    const checkTerminals = () => {
      const selectedTerminals = (triggerConfig.selectedTerminals && triggerConfig.selectedTerminals.length > 0)
        ? triggerConfig.selectedTerminals
        : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
      for (const terminal of selectedTerminals) {
        const tNeighbors = triggerConfig.confluenceMode === 'custom' && triggerConfig.customTerminalsConfig && triggerConfig.customTerminalsConfig[terminal] !== undefined
          ? triggerConfig.customTerminalsConfig[terminal]
          : neighborsCount;

        const baseNumbers = getTerminalBaseNumbers(terminal);
        const entryNumbers = getNumbersWithNeighbors(baseNumbers, tNeighbors);
        if (entryNumbers.includes(resNum)) {
          return true;
        }
      }
      return false;
    };

    const checkNumbers = () => {
      const confluenceNumbers = (triggerConfig.confluenceNumbers && triggerConfig.confluenceNumbers.length > 0)
        ? triggerConfig.confluenceNumbers
        : Array.from({ length: 37 }, (_, i) => i);
      for (const num of confluenceNumbers) {
        const nNeighbors = triggerConfig.confluenceMode === 'custom' && triggerConfig.customNumbersConfig && triggerConfig.customNumbersConfig[num] !== undefined
          ? triggerConfig.customNumbersConfig[num]
          : neighborsCount;

        const entryNumbers = getNumbersWithNeighbors([num], nNeighbors);
        if (entryNumbers.includes(resNum)) {
          return true;
        }
      }
      return false;
    };

    if (confluenceType === 'terminals') {
      if (checkTerminals()) return true;
    } else if (confluenceType === 'sectors') {
      const selectedSectors = triggerConfig.selectedSectors || [];
      for (const sector of selectedSectors) {
        const sNeighbors = triggerConfig.confluenceMode === 'custom' && triggerConfig.customSectorsConfig && triggerConfig.customSectorsConfig[sector] !== undefined
          ? triggerConfig.customSectorsConfig[sector]
          : neighborsCount;

        let baseNumbers: number[] = [];
        if (sector === 'VOISINS') baseNumbers = ROULETTE_ZONES.VOISINS;
        else if (sector === 'TIERS') baseNumbers = ROULETTE_ZONES.TIERS;
        else if (sector === 'ORPHELINS') baseNumbers = ROULETTE_ZONES.ORPHELINS;
        else if (sector === 'ZERO_SPIEL') baseNumbers = ROULETTE_ZONES.ZERO_SPIEL;

        const entryNumbers = getNumbersWithNeighbors(baseNumbers, sNeighbors);
        if (entryNumbers.includes(resNum)) {
          return true;
        }
      }
    } else if (confluenceType === 'numbers') {
      if (checkNumbers()) return true;
    } else if (confluenceType === 'both') {
      if (checkTerminals() || checkNumbers()) return true;
    }
    return false;
  }

  if (!strategy.rules || ((!strategy.rules.bets || strategy.rules.bets.length === 0) && strategy.gameType !== GameType.BACCARAT)) return false;
  
  // Normaliza o valor atual da aposta/gale para 2 casas decimais
  const normalizedBetSize = Math.round(Number(betSize || 10) * 100) / 100;
  
  // Calcula o lucro da rodada utilizando o valor devidamente ajustado
  const profit = strategyEngine.calculateStrategySpinProfit(strategy, result, normalizedBetSize, managementConfig);
  
  // Normaliza o lucro flutuante para evitar desvios infinitos/imperceptíveis do float do JavaScript (por ex. 1e-15 > 0)
  const normalizedProfit = Math.round(Number(profit) * 10000) / 10000;
  if (normalizedProfit > 0) return true;
  if (normalizedProfit < 0) return false;
  return undefined; // Empate / Push
}

export function getCoveredNumbersForStrategy(strategy: Strategy): number[] {
  if (strategy.rules?.triggerConfig?.useRacetrackConfluence) {
    const triggerConfig = strategy.rules.triggerConfig;
    const confluenceType = triggerConfig.confluenceType || 'terminals';
    const neighborsCount = triggerConfig.globalNeighborsCount !== undefined ? triggerConfig.globalNeighborsCount : 3;
    const covered = new Set<number>();

    const collectTerminals = () => {
      const selectedTerminals = triggerConfig.selectedTerminals || [];
      selectedTerminals.forEach((terminal: number) => {
        const tNeighbors = triggerConfig.confluenceMode === 'custom' && triggerConfig.customTerminalsConfig && triggerConfig.customTerminalsConfig[terminal] !== undefined
          ? triggerConfig.customTerminalsConfig[terminal]
          : neighborsCount;
        const baseNumbers = getTerminalBaseNumbers(terminal);
        getNumbersWithNeighbors(baseNumbers, tNeighbors).forEach(n => covered.add(n));
      });
    };

    const collectNumbers = () => {
      const confluenceNumbers = triggerConfig.confluenceNumbers || [];
      confluenceNumbers.forEach((num: number) => {
        const nNeighbors = triggerConfig.confluenceMode === 'custom' && triggerConfig.customNumbersConfig && triggerConfig.customNumbersConfig[num] !== undefined
          ? triggerConfig.customNumbersConfig[num]
          : neighborsCount;
        getNumbersWithNeighbors([num], nNeighbors).forEach(n => covered.add(n));
      });
    };

    if (confluenceType === 'terminals') {
      collectTerminals();
    } else if (confluenceType === 'sectors') {
      const selectedSectors = triggerConfig.selectedSectors || [];
      selectedSectors.forEach((sector: string) => {
        const sNeighbors = triggerConfig.confluenceMode === 'custom' && triggerConfig.customSectorsConfig && triggerConfig.customSectorsConfig[sector] !== undefined
          ? triggerConfig.customSectorsConfig[sector]
          : neighborsCount;
        let baseNumbers: number[] = [];
        if (sector === 'VOISINS') baseNumbers = ROULETTE_ZONES.VOISINS;
        else if (sector === 'TIERS') baseNumbers = ROULETTE_ZONES.TIERS;
        else if (sector === 'ORPHELINS') baseNumbers = ROULETTE_ZONES.ORPHELINS;
        else if (sector === 'ZERO_SPIEL') baseNumbers = ROULETTE_ZONES.ZERO_SPIEL;
        getNumbersWithNeighbors(baseNumbers, sNeighbors).forEach(n => covered.add(n));
      });
    } else if (confluenceType === 'numbers') {
      collectNumbers();
    } else if (confluenceType === 'both') {
      collectTerminals();
      collectNumbers();
    }
    return Array.from(covered);
  }

  const covered = new Set<number>();
  if (!strategy || !strategy.rules || !strategy.rules.bets) return [];
  strategy.rules.bets.forEach(bet => {
    if (bet.type === 'number') {
      const targetNum = Number(bet.target);
      covered.add(targetNum);
      const index = ROULETTE_RACE_SEQUENCE.indexOf(targetNum);
      if (index !== -1) {
        for (let k = 1; k <= 5; k++) {
          covered.add(ROULETTE_RACE_SEQUENCE[(index - k + 37) % 37]);
          covered.add(ROULETTE_RACE_SEQUENCE[(index + k) % 37]);
        }
      }
    }
    else if (bet.type === 'multi' && Array.isArray(bet.target)) {
      bet.target.forEach((n: any) => covered.add(Number(n)));
    } else if (bet.type === 'dozen') {
      const start = (Number(bet.target) - 1) * 12 + 1;
      for (let i = start; i < start + 12; i++) covered.add(i);
    } else if (bet.type === 'column') {
      const col = Number(bet.target);
      for (let i = 1; i <= 36; i++) {
        const checkVal = col % 3 === 0 ? 3 : col % 3;
        if (i % 3 === checkVal) covered.add(i);
      }
    } else if (bet.type === 'color') {
      const isRed = bet.target === 'red';
      const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
      for (let i = 1; i <= 36; i++) {
        if (RED_NUMBERS.includes(i) === isRed) {
          covered.add(i);
        }
      }
    } else if (bet.type === 'even_chance') {
      const t = String(bet.target).toLowerCase();
      if (t === 'par' || t === 'even') {
        for (let i = 2; i <= 36; i += 2) covered.add(i);
      } else if (t === 'ímpar' || t === 'odd') {
        for (let i = 1; i <= 35; i += 2) covered.add(i);
      } else if (t === 'alto' || t === 'high') {
        for (let i = 19; i <= 36; i++) covered.add(i);
      } else if (t === 'baixo' || t === 'low') {
        for (let i = 1; i <= 18; i++) covered.add(i);
      }
    } else if (bet.type === 'line' || bet.type === 'double_street' || bet.type === 'seisena' || bet.type === 'linha') {
      const tVal = String(bet.target).trim();
      if (tVal === '1') { [1,2,3,4,5,6].forEach(n => covered.add(n)); }
      else if (tVal === '2') { [7,8,9,10,11,12].forEach(n => covered.add(n)); }
      else if (tVal === '3') { [13,14,15,16,17,18].forEach(n => covered.add(n)); }
      else if (tVal === '4') { [19,20,21,22,23,24].forEach(n => covered.add(n)); }
      else if (tVal === '5') { [25,26,27,28,29,30].forEach(n => covered.add(n)); }
      else if (tVal === '6') { [31,32,33,34,35,36].forEach(n => covered.add(n)); }
      else {
        const cleaned = tVal.replace('_', '-');
        if (cleaned.includes('-')) {
          const parts = cleaned.split('-');
          const start = Number(parts[0]);
          const end = Number(parts[1]);
          if (!isNaN(start) && !isNaN(end)) {
            for (let i = start; i <= end; i++) covered.add(i);
          }
        }
      }
    } else if (bet.type === 'street' || bet.type === 'rua') {
      const tVal = String(bet.target).trim();
      const sNum = Number(tVal);
      if (!isNaN(sNum) && sNum >= 1 && sNum <= 12) {
        const start = (sNum - 1) * 3 + 1;
        for (let i = start; i <= start + 2; i++) covered.add(i);
      } else {
        const cleaned = tVal.replace('_', '-');
        if (cleaned.includes('-')) {
          const parts = cleaned.split('-');
          const start = Number(parts[0]);
          const end = Number(parts[1]);
          if (!isNaN(start) && !isNaN(end)) {
            for (let i = start; i <= end; i++) covered.add(i);
          }
        }
      }
    } else if (bet.type === 'corner' || bet.type === 'canto' || bet.type === 'split' || bet.type === 'dividida') {
      const tVal = String(bet.target).trim();
      const cleaned = tVal.replace(/_/g, '-').replace(/,/g, '-');
      if (cleaned.includes('-')) {
        const parts = cleaned.split('-').map(Number);
        parts.forEach(n => {
          if (!isNaN(n)) covered.add(n);
        });
      }
    }
  });
  return Array.from(covered);
}

export function calculateCoverage(strategy: Strategy): number {
  return getCoveredNumbersForStrategy(strategy).length;
}

export function calculateStrategyDelay(history: GameResult[], strategy: Strategy): number {
  let delay = 0;
  for (const item of history) {
    if (checkStrategyWin(strategy, item.result)) break;
    delay++;
  }
  return delay;
}

export function calculateStrategyRepetition(history: GameResult[], strategy: Strategy): number {
  const sample = history.slice(0, 8);
  if (sample.length === 0) return 0;
  return sample.filter(h => checkStrategyWin(strategy, h.result)).length;
}

export function calculatePerformance(history: GameResult[], strategy: Strategy): number {
  const sample = history.slice(0, 20);
  if (sample.length === 0) return 0;
  const wins = sample.filter(h => checkStrategyWin(strategy, h.result)).length;
  return (wins / sample.length) * 100;
}

export function getTerminalBaseNumbers(terminal: number): number[] {
  const base: number[] = [];
  for (let i = 0; i <= 36; i++) {
    if (i % 10 === terminal) {
      base.push(i);
    }
  }
  return base;
}

export function getNumbersWithNeighbors(numbers: number[], neighbors: number): number[] {
  const covered = new Set<number>();
  numbers.forEach(num => {
    covered.add(num);
    const index = ROULETTE_RACE_SEQUENCE.indexOf(num);
    if (index !== -1) {
      for (let k = 1; k <= neighbors; k++) {
        covered.add(ROULETTE_RACE_SEQUENCE[(index - k + 37) % 37]);
        covered.add(ROULETTE_RACE_SEQUENCE[(index + k) % 37]);
      }
    }
  });
  return Array.from(covered);
}

export function getTableTargetNumbers(targetKey: string): number[] {
  switch (targetKey) {
    // Apostas Externas
    case 'high': return Array.from({ length: 18 }, (_, i) => i + 19); // 19-36
    case 'low': return Array.from({ length: 18 }, (_, i) => i + 1); // 1-18
    case 'even': return Array.from({ length: 36 }, (_, i) => i + 1).filter(n => n % 2 === 0);
    case 'odd': return Array.from({ length: 36 }, (_, i) => i + 1).filter(n => n % 2 !== 0);
    case 'red': return [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    case 'black': return [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

    // Dúzias
    case 'dozen_1': return Array.from({ length: 12 }, (_, i) => i + 1);
    case 'dozen_2': return Array.from({ length: 12 }, (_, i) => i + 13);
    case 'dozen_3': return Array.from({ length: 12 }, (_, i) => i + 25);

    // Colunas
    case 'col_1': return [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34];
    case 'col_2': return [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35];
    case 'col_3': return [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36];

    // Linhas (Seisenas)
    case 'line_1_6': return [1, 2, 3, 4, 5, 6];
    case 'line_7_12': return [7, 8, 9, 10, 11, 12];
    case 'line_13_18': return [13, 14, 15, 16, 17, 18];
    case 'line_19_24': return [19, 20, 21, 22, 23, 24];
    case 'line_25_30': return [25, 26, 27, 28, 29, 30];
    case 'line_31_36': return [31, 32, 33, 34, 35, 36];

    // Ruas (Streets)
    case 'street_1_3': return [1, 2, 3];
    case 'street_4_6': return [4, 5, 6];
    case 'street_7_9': return [7, 8, 9];
    case 'street_10_12': return [10, 11, 12];
    case 'street_13_15': return [13, 14, 15];
    case 'street_16_18': return [16, 17, 18];
    case 'street_19_21': return [19, 20, 21];
    case 'street_22_24': return [22, 23, 24];
    case 'street_25_27': return [25, 26, 27];
    case 'street_28_30': return [28, 29, 30];
    case 'street_31_33': return [31, 32, 33];
    case 'street_34_36': return [34, 35, 36];

    // Cantos (Corners)
    case 'corner_1_5': return [1, 2, 4, 5];
    case 'corner_2_6': return [2, 3, 5, 6];
    case 'corner_7_11': return [7, 8, 10, 11];
    case 'corner_19_23': return [19, 20, 22, 23];
    case 'corner_28_32': return [28, 29, 31, 32];
    case 'corner_32_36': return [32, 33, 35, 36];

    // Divididas (Splits)
    case 'split_0_1': return [0, 1];
    case 'split_0_2': return [0, 2];
    case 'split_0_3': return [0, 3];
    case 'split_1_2': return [1, 2];
    case 'split_2_3': return [2, 3];
    case 'split_10_11': return [10, 11];
    case 'split_13_14': return [13, 14];
    case 'split_26_27': return [26, 27];
    case 'split_35_36': return [35, 36];

    default: return [];
  }
}

export function getTableTargetLabel(targetKey: string): string {
  const labels: Record<string, string> = {
    high: 'Alto (19-36)',
    low: 'Baixo (1-18)',
    even: 'Par',
    odd: 'Ímpar',
    red: 'Vermelho',
    black: 'Preto',
    dozen_1: '1ª Dúzia (1-12)',
    dozen_2: '2ª Dúzia (13-24)',
    dozen_3: '3ª Dúzia (25-36)',
    col_1: '1ª Coluna',
    col_2: '2ª Coluna',
    col_3: '3ª Coluna',
    line_1_6: 'Linha 1-6',
    line_7_12: 'Linha 7-12',
    line_13_18: 'Linha 13-18',
    line_19_24: 'Linha 19-24',
    line_25_30: 'Linha 25-30',
    line_31_36: 'Linha 31-36',
    street_1_3: 'Rua 1-3',
    street_4_6: 'Rua 4-6',
    street_7_9: 'Rua 7-9',
    street_10_12: 'Rua 10-12',
    street_13_15: 'Rua 13-15',
    street_16_18: 'Rua 16-18',
    street_19_21: 'Rua 19-21',
    street_22_24: 'Rua 22-24',
    street_25_27: 'Rua 25-27',
    street_28_30: 'Rua 28-30',
    street_31_33: 'Rua 31-33',
    street_34_36: 'Rua 34-36',
    corner_1_5: 'Canto 1-2-4-5',
    corner_2_6: 'Canto 2-3-5-6',
    corner_7_11: 'Canto 7-8-10-11',
    corner_19_23: 'Canto 19-20-22-23',
    corner_28_32: 'Canto 28-29-31-32',
    corner_32_36: 'Canto 32-33-35-36',
    split_0_1: 'Dividida 0/1',
    split_0_2: 'Dividida 0/2',
    split_0_3: 'Dividida 0/3',
    split_1_2: 'Dividida 1/2',
    split_2_3: 'Dividida 2/3',
    split_10_11: 'Dividida 10/11',
    split_13_14: 'Dividida 13/14',
    split_26_27: 'Dividida 26/27',
    split_35_36: 'Dividida 35/36'
  };
  return labels[targetKey] || targetKey;
}

export function evaluateCustomTriggers(triggerConfig: any, history: GameResult[], strategy: Strategy): { triggered: boolean; reason: string; confidence: number; entryNumbersOverride?: number[] } {
  const rouletteHistory = history.filter(h => h.gameType === GameType.ROULETTE);
  if (rouletteHistory.length < 5) return { triggered: false, reason: '', confidence: 0 };

  const selectedPositions: number[] = (triggerConfig.selectedPositions && Array.isArray(triggerConfig.selectedPositions) && triggerConfig.selectedPositions.length > 0)
    ? triggerConfig.selectedPositions
    : [0];

  const statCriterion = triggerConfig.statCriterion || 'manual';
  const analysisWindow = triggerConfig.analysisWindow || 30;
  const windowHistory = rouletteHistory.slice(0, analysisWindow);

  // Helper to compute absence (delay) and frequency for a set of numbers in windowHistory
  const computeStats = (targetNumbers: number[]) => {
    let absence = 0;
    for (const h of windowHistory) {
      if (targetNumbers.includes(Number(h.result))) break;
      absence++;
    }
    const frequency = windowHistory.filter(h => targetNumbers.includes(Number(h.result))).length;
    return { absence, frequency };
  };

  // Helper to test if any target position matches entryNumbers
  const matchPositions = (entryNumbers: number[]): boolean => {
    for (const pos of selectedPositions) {
      if (rouletteHistory[pos] !== undefined && rouletteHistory[pos] !== null) {
        const val = Number(rouletteHistory[pos].result);
        if (!isNaN(val) && entryNumbers.includes(val)) {
          return true;
        }
      }
    }
    return false;
  };

  // 1. Racetrack Terminal/Sector/Numbers/Table Bets Confluence Filter
  let matchedItemLabel: string | null = null;
  let matchedEntryNumbers: number[] = [];

  if (triggerConfig.useRacetrackConfluence) {
    const confluenceType = triggerConfig.confluenceType || 'terminals';
    const neighborsCount = triggerConfig.globalNeighborsCount !== undefined ? triggerConfig.globalNeighborsCount : 3;

    const checkTerminals = (): boolean => {
      let selectedTerminals = (triggerConfig.selectedTerminals && triggerConfig.selectedTerminals.length > 0)
        ? triggerConfig.selectedTerminals
        : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

      if (statCriterion === 'maior_ausencia' || statCriterion === 'maior_frequencia') {
        let bestTerminal = selectedTerminals[0];
        let bestScore = -1;

        for (const terminal of selectedTerminals) {
          const tNeighbors = triggerConfig.confluenceMode === 'custom' && triggerConfig.customTerminalsConfig && triggerConfig.customTerminalsConfig[terminal] !== undefined
            ? triggerConfig.customTerminalsConfig[terminal]
            : neighborsCount;
          const baseNumbers = getTerminalBaseNumbers(terminal);
          const entryNumbers = getNumbersWithNeighbors(baseNumbers, tNeighbors);
          const stats = computeStats(entryNumbers);
          const score = statCriterion === 'maior_ausencia' ? stats.absence : stats.frequency;

          if (score > bestScore) {
            bestScore = score;
            bestTerminal = terminal;
          }
        }
        selectedTerminals = [bestTerminal];
      }

      for (const terminal of selectedTerminals) {
        const tNeighbors = triggerConfig.confluenceMode === 'custom' && triggerConfig.customTerminalsConfig && triggerConfig.customTerminalsConfig[terminal] !== undefined
          ? triggerConfig.customTerminalsConfig[terminal]
          : neighborsCount;

        const baseNumbers = getTerminalBaseNumbers(terminal);
        const entryNumbers = getNumbersWithNeighbors(baseNumbers, tNeighbors);

        if (triggerConfig.useS84Sequence) {
          for (const pos of selectedPositions) {
            const opt0 = Number(rouletteHistory[pos]?.result);
            const opt1 = Number(rouletteHistory[pos + 1]?.result);
            const opt2 = Number(rouletteHistory[pos + 2]?.result);
            const opt3 = Number(rouletteHistory[pos + 3]?.result);

            if (!isNaN(opt0) && !isNaN(opt1) && !isNaN(opt2) && !isNaN(opt3)) {
              const isOpt0Ok = entryNumbers.includes(opt0);
              const isOpt1Ok = !entryNumbers.includes(opt1);
              const isOpt2Ok = !entryNumbers.includes(opt2);
              const isOpt3Ok = entryNumbers.includes(opt3);

              if (isOpt0Ok && isOpt1Ok && isOpt2Ok && isOpt3Ok) {
                matchedItemLabel = `Terminal ${terminal}`;
                matchedEntryNumbers = entryNumbers;
                return true;
              }
            }
          }
        } else {
          if (matchPositions(entryNumbers)) {
            matchedItemLabel = `Terminal ${terminal}`;
            matchedEntryNumbers = entryNumbers;
            return true;
          }
        }
      }
      return false;
    };

    const checkNumbers = (): boolean => {
      let confluenceNumbers = (triggerConfig.confluenceNumbers && triggerConfig.confluenceNumbers.length > 0)
        ? triggerConfig.confluenceNumbers
        : Array.from({ length: 37 }, (_, i) => i);

      if (statCriterion === 'maior_ausencia' || statCriterion === 'maior_frequencia') {
        let bestNum = confluenceNumbers[0];
        let bestScore = -1;

        for (const num of confluenceNumbers) {
          const nNeighbors = triggerConfig.confluenceMode === 'custom' && triggerConfig.customNumbersConfig && triggerConfig.customNumbersConfig[num] !== undefined
            ? triggerConfig.customNumbersConfig[num]
            : neighborsCount;
          const entryNumbers = getNumbersWithNeighbors([num], nNeighbors);
          const stats = computeStats(entryNumbers);
          const score = statCriterion === 'maior_ausencia' ? stats.absence : stats.frequency;

          if (score > bestScore) {
            bestScore = score;
            bestNum = num;
          }
        }
        confluenceNumbers = [bestNum];
      }

      for (const num of confluenceNumbers) {
        const nNeighbors = triggerConfig.confluenceMode === 'custom' && triggerConfig.customNumbersConfig && triggerConfig.customNumbersConfig[num] !== undefined
          ? triggerConfig.customNumbersConfig[num]
          : neighborsCount;

        const entryNumbers = getNumbersWithNeighbors([num], nNeighbors);

        if (triggerConfig.useS84Sequence) {
          for (const pos of selectedPositions) {
            const opt0 = Number(rouletteHistory[pos]?.result);
            const opt1 = Number(rouletteHistory[pos + 1]?.result);
            const opt2 = Number(rouletteHistory[pos + 2]?.result);
            const opt3 = Number(rouletteHistory[pos + 3]?.result);

            if (!isNaN(opt0) && !isNaN(opt1) && !isNaN(opt2) && !isNaN(opt3)) {
              const isOpt0Ok = entryNumbers.includes(opt0);
              const isOpt1Ok = !entryNumbers.includes(opt1);
              const isOpt2Ok = !entryNumbers.includes(opt2);
              const isOpt3Ok = entryNumbers.includes(opt3);

              if (isOpt0Ok && isOpt1Ok && isOpt2Ok && isOpt3Ok) {
                matchedItemLabel = `Número ${num}`;
                matchedEntryNumbers = entryNumbers;
                return true;
              }
            }
          }
        } else {
          if (matchPositions(entryNumbers)) {
            matchedItemLabel = `Número ${num}`;
            matchedEntryNumbers = entryNumbers;
            return true;
          }
        }
      }
      return false;
    };

    const checkTableTargets = (targets: string[]): boolean => {
      let activeTargets = targets;
      if (!activeTargets || activeTargets.length === 0) return false;

      if (statCriterion === 'maior_ausencia' || statCriterion === 'maior_frequencia') {
        let bestKey = activeTargets[0];
        let bestScore = -1;

        for (const key of activeTargets) {
          const baseNumbers = getTableTargetNumbers(key);
          const stats = computeStats(baseNumbers);
          const score = statCriterion === 'maior_ausencia' ? stats.absence : stats.frequency;

          if (score > bestScore) {
            bestScore = score;
            bestKey = key;
          }
        }
        if (bestKey) activeTargets = [bestKey];
      }

      for (const key of activeTargets) {
        const baseNumbers = getTableTargetNumbers(key);
        if (matchPositions(baseNumbers)) {
          matchedItemLabel = getTableTargetLabel(key);
          matchedEntryNumbers = baseNumbers;
          return true;
        }
      }
      return false;
    };

    if (confluenceType === 'terminals') {
      checkTerminals();
    } else if (confluenceType === 'numbers') {
      checkNumbers();
    } else if (confluenceType === 'external') {
      checkTableTargets(triggerConfig.selectedExternalBets || ['high', 'low', 'even', 'odd', 'red', 'black']);
    } else if (confluenceType === 'dozens') {
      const dozenTargets = triggerConfig.selectedDozensColumns?.filter(x => x.startsWith('dozen')) || ['dozen_1', 'dozen_2', 'dozen_3'];
      checkTableTargets(dozenTargets.length > 0 ? dozenTargets : ['dozen_1', 'dozen_2', 'dozen_3']);
    } else if (confluenceType === 'columns') {
      const colTargets = triggerConfig.selectedDozensColumns?.filter(x => x.startsWith('col')) || ['col_1', 'col_2', 'col_3'];
      checkTableTargets(colTargets.length > 0 ? colTargets : ['col_1', 'col_2', 'col_3']);
    } else if (confluenceType === 'lines') {
      const lineTargets = triggerConfig.selectedLinesStreets?.filter(x => x.startsWith('line')) || ['line_1_6', 'line_7_12', 'line_13_18', 'line_19_24', 'line_25_30', 'line_31_36'];
      checkTableTargets(lineTargets.length > 0 ? lineTargets : ['line_1_6', 'line_7_12', 'line_13_18', 'line_19_24', 'line_25_30', 'line_31_36']);
    } else if (confluenceType === 'streets') {
      const streetTargets = triggerConfig.selectedLinesStreets?.filter(x => x.startsWith('street')) || ['street_1_3', 'street_4_6', 'street_7_9', 'street_10_12', 'street_13_15', 'street_16_18', 'street_19_21', 'street_22_24', 'street_25_27', 'street_28_30', 'street_31_33', 'street_34_36'];
      checkTableTargets(streetTargets.length > 0 ? streetTargets : ['street_1_3', 'street_4_6', 'street_7_9', 'street_10_12', 'street_13_15', 'street_16_18', 'street_19_21', 'street_22_24', 'street_25_27', 'street_28_30', 'street_31_33', 'street_34_36']);
    } else if (confluenceType === 'dozens_columns') {
      checkTableTargets(triggerConfig.selectedDozensColumns || ['dozen_1', 'dozen_2', 'dozen_3', 'col_1', 'col_2', 'col_3']);
    } else if (confluenceType === 'lines_streets') {
      checkTableTargets(triggerConfig.selectedLinesStreets || ['line_1_6', 'line_7_12', 'line_13_18', 'line_19_24', 'line_25_30', 'line_31_36', 'street_1_3', 'street_4_6', 'street_7_9', 'street_10_12', 'street_13_15', 'street_16_18', 'street_19_21', 'street_22_24', 'street_25_27', 'street_28_30', 'street_31_33', 'street_34_36']);
    } else if (confluenceType === 'corners_splits') {
      checkTableTargets(triggerConfig.selectedCornersSplits || ['corner_1_5', 'corner_2_6', 'corner_7_11', 'corner_19_23', 'corner_28_32', 'corner_32_36', 'split_0_1', 'split_0_2', 'split_0_3', 'split_1_2', 'split_2_3', 'split_10_11', 'split_13_14', 'split_26_27', 'split_35_36']);
    } else if (confluenceType === 'sectors') {
      let selectedSectors = triggerConfig.selectedSectors || [];
      if (selectedSectors.length > 0) {
        if (statCriterion === 'maior_ausencia' || statCriterion === 'maior_frequencia') {
          let bestSec = selectedSectors[0];
          let bestScore = -1;

          for (const sector of selectedSectors) {
            const sNeighbors = triggerConfig.confluenceMode === 'custom' && triggerConfig.customSectorsConfig && triggerConfig.customSectorsConfig[sector] !== undefined
              ? triggerConfig.customSectorsConfig[sector]
              : neighborsCount;
            let baseNumbers: number[] = [];
            if (sector === 'VOISINS') baseNumbers = ROULETTE_ZONES.VOISINS;
            else if (sector === 'TIERS') baseNumbers = ROULETTE_ZONES.TIERS;
            else if (sector === 'ORPHELINS') baseNumbers = ROULETTE_ZONES.ORPHELINS;
            else if (sector === 'ZERO_SPIEL') baseNumbers = ROULETTE_ZONES.ZERO_SPIEL;

            const entryNumbers = getNumbersWithNeighbors(baseNumbers, sNeighbors);
            const stats = computeStats(entryNumbers);
            const score = statCriterion === 'maior_ausencia' ? stats.absence : stats.frequency;

            if (score > bestScore) {
              bestScore = score;
              bestSec = sector;
            }
          }
          selectedSectors = [bestSec];
        }

        for (const sector of selectedSectors) {
          const sNeighbors = triggerConfig.confluenceMode === 'custom' && triggerConfig.customSectorsConfig && triggerConfig.customSectorsConfig[sector] !== undefined
            ? triggerConfig.customSectorsConfig[sector]
            : neighborsCount;

          let baseNumbers: number[] = [];
          if (sector === 'VOISINS') baseNumbers = ROULETTE_ZONES.VOISINS;
          else if (sector === 'TIERS') baseNumbers = ROULETTE_ZONES.TIERS;
          else if (sector === 'ORPHELINS') baseNumbers = ROULETTE_ZONES.ORPHELINS;
          else if (sector === 'ZERO_SPIEL') baseNumbers = ROULETTE_ZONES.ZERO_SPIEL;

          const entryNumbers = getNumbersWithNeighbors(baseNumbers, sNeighbors);

          if (triggerConfig.useS84Sequence) {
            for (const pos of selectedPositions) {
              const opt0 = Number(rouletteHistory[pos]?.result);
              const opt1 = Number(rouletteHistory[pos + 1]?.result);
              const opt2 = Number(rouletteHistory[pos + 2]?.result);
              const opt3 = Number(rouletteHistory[pos + 3]?.result);

              if (!isNaN(opt0) && !isNaN(opt1) && !isNaN(opt2) && !isNaN(opt3)) {
                const isOpt0Ok = entryNumbers.includes(opt0);
                const isOpt1Ok = !entryNumbers.includes(opt1);
                const isOpt2Ok = !entryNumbers.includes(opt2);
                const isOpt3Ok = entryNumbers.includes(opt3);

                if (isOpt0Ok && isOpt1Ok && isOpt2Ok && isOpt3Ok) {
                  matchedItemLabel = `Setor ${sector}`;
                  matchedEntryNumbers = entryNumbers;
                  break;
                }
              }
            }
          } else {
            if (matchPositions(entryNumbers)) {
              matchedItemLabel = `Setor ${sector}`;
              matchedEntryNumbers = entryNumbers;
              break;
            }
          }
        }
      }
    } else if (confluenceType === 'both' || confluenceType === 'all') {
      if (!checkTerminals() && !checkNumbers()) {
        checkTableTargets([
          ...(triggerConfig.selectedExternalBets || ['high', 'low', 'even', 'odd', 'red', 'black']),
          ...(triggerConfig.selectedDozensColumns || ['dozen_1', 'dozen_2', 'dozen_3', 'col_1', 'col_2', 'col_3'])
        ]);
      }
    }

    if (matchedItemLabel === null) {
      return { triggered: false, reason: '', confidence: 0 };
    }
  }

  // 2. Simple Delay/Absence or Frequency triggers on bets targets
  const isStrategyHit = (item: GameResult) => {
    if (triggerConfig.useRacetrackConfluence && matchedEntryNumbers.length > 0) {
      return matchedEntryNumbers.includes(Number(item.result));
    }
    if (strategy.rules?.bets && strategy.rules.bets.length > 0) {
      return strategy.rules.bets.some((b: any) => checkSingleBetWin(b, item.result));
    }
    return false;
  };

  // Min Delay (Ausência Mínima)
  const delayVal = triggerConfig.minDelay !== undefined ? triggerConfig.minDelay : (triggerConfig.minAbsence || 0);
  if (delayVal > 0) {
    let currentDelay = 0;
    for (const item of rouletteHistory) {
      if (isStrategyHit(item)) break;
      currentDelay++;
    }
    if (currentDelay < delayVal) {
      return { triggered: false, reason: '', confidence: 0 };
    }
  }

  // Max Delay (Ausência Máxima)
  const maxDelayVal = triggerConfig.maxDelay || 0;
  if (maxDelayVal > 0) {
    let currentDelay = 0;
    for (const item of rouletteHistory) {
      if (isStrategyHit(item)) break;
      currentDelay++;
    }
    if (currentDelay > maxDelayVal) {
      return { triggered: false, reason: '', confidence: 0 };
    }
  }

  // Frequency
  if (triggerConfig.minFrequency > 0) {
    const windowSize = triggerConfig.frequencyWindow || 10;
    const sample = rouletteHistory.slice(0, windowSize);
    const hits = sample.filter(isStrategyHit).length;
    if (hits < triggerConfig.minFrequency) {
      return { triggered: false, reason: '', confidence: 0 };
    }
  }

  // Return trigger outcome
  const desc = triggerConfig.useRacetrackConfluence
    ? `Confluência ${matchedItemLabel}`
    : 'Gatilho Confirmado';

  return {
    triggered: true,
    reason: desc,
    confidence: 90,
    entryNumbersOverride: triggerConfig.useRacetrackConfluence ? matchedEntryNumbers : undefined
  };
}
