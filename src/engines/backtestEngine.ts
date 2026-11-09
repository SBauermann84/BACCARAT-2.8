import { GameResult, Strategy, GameType, ManagementConfig, ManagementMode } from '../types';
import { checkWin, findMostProbableEntry } from './statsEngine';
import { checkBaccaratPattern, strategyEngine, getCoveredNumbersForStrategy, evaluateCustomTriggers, calculateCoverage, calculateStrategyRepetition, calculatePerformance, calculateStrategyDelay } from './strategyEngine';
import { evaluateMinedPatternTrigger } from './baccaratPatternMiningEngine';
import { trendAnalysisEngine } from './trendAnalysisEngine';
import { calculateProportionalCoverage, getInitialProgressionState, updateProgressionState, calculateCumulativeGaleLoss, calculatePayoutRatioForEntry, getPositionCountForSignal, calculateRacetrackPayoutMultiplier } from './progressionEngine';
import { getEnrichedRules } from '../lib/rulesEnricher';

const defaultBankrollMetrics = {
  maxGaleNeeded: 0,
  safeBankrollConservative: 0,
  safeBankrollModerate: 0,
  safeBankrollAggressive: 0
};

/**
 * Runs a single backtest simulation for a specific strategy under a given gale limit.
 */
export const runSingleBacktestSimulation = (
  history: GameResult[],
  strategy: Strategy,
  originalManagementConfig?: ManagementConfig,
  stopWin?: number,
  stopLoss?: number,
  gales?: number
) => {
  let managementConfig = originalManagementConfig;
  if (gales !== undefined && originalManagementConfig) {
    managementConfig = {
      ...originalManagementConfig,
      mode: gales > 0 ? ManagementMode.MARTINGALE : ManagementMode.FIXED,
      levels: gales
    };
  }

  // Set gales to default limit from managementConfig if it is undefined (to prevent fallback to 0)
  gales = gales !== undefined ? gales : (managementConfig ? Math.max(0, managementConfig.levels) : 2);

  const isMartingale = managementConfig && managementConfig.mode === ManagementMode.MARTINGALE;

  let wins = 0;
  let losses = 0;
  let totalProfit = 0;
  let maxDrawdown = 0;

  // Dynamic realistic starting balance for the simulation
  const baseBet = managementConfig?.initialBet || 10;
  const positionCount = getStrategyPositionCount(strategy);
  const minChip = managementConfig?.minChip || (strategy.gameType === GameType.BACCARAT ? 0.20 : 0.10);
  
  // Calculate total cost of single initial entry
  let initialEntryCost = baseBet;
  if (strategy.gameType === GameType.ROULETTE && positionCount > 1) {
    // For systemic or multi-position roulette strategy
    const { actualTotalCost } = calculateProportionalCoverage(baseBet, positionCount, minChip);
    initialEntryCost = actualTotalCost;
  }
  
  // The simulated bankroll scales dynamically with the entry cost and selected management config
  let simulatedBankroll = 1000;
  if (managementConfig) {
    const galeCost = calculateCumulativeGaleLoss(managementConfig, 10000);
    // Standard starting bankroll: Gale Cost + 30 units of initial entry cost to provide a safe buffer
    simulatedBankroll = Math.max(galeCost + (initialEntryCost * 30), initialEntryCost * 50);
  } else {
    simulatedBankroll = initialEntryCost * 100;
  }
  
  simulatedBankroll = Math.round(simulatedBankroll);
  
  let currentBalance = simulatedBankroll;
  let peak = simulatedBankroll;
  let maxConsecutiveLosses = 0;
  let currentConsecutiveLosses = 0;

  let stopWinVal = stopWin ?? 200;
  let stopLossVal = stopLoss ?? 100;
  if (stopWinVal <= 0) stopWinVal = 200;
  if (stopLossVal <= 0) stopLossVal = 100;

  let winsWithPause = 0;
  let lossesWithPause = 0;
  let profitWithPause = 0;
  let withPauseHasStopped = false;
  let withPauseTriggerType: 'stop_win' | 'stop_loss' | null = null;
  let withPauseRoundsCount = 0;
  let totalRoundsCount = 0;

  const enrichedRules = getEnrichedRules(strategy.name, strategy.rules, strategy.gameType);
  const enrichedStrategy = { ...strategy, rules: enrichedRules };

  // Normalize history so relevantHistory is ALWAYS strictly chronological (oldest at index 0, newest at index N-1)
  const filteredHistory = history.filter(h => h.gameType === strategy.gameType);
  let relevantHistory: GameResult[] = [];

  if (filteredHistory.length > 0) {
    const hasTimestamps = filteredHistory.some(h => (h.timestamp || 0) > 0);
    if (hasTimestamps) {
      relevantHistory = [...filteredHistory].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    } else {
      // If no timestamps, assume default list is newest-first, so reverse to make oldest-first
      relevantHistory = [...filteredHistory].reverse();
    }
  }
  
  // Determine minimum history required dynamically based on the strategy type
  let minHistoryRequired = 2;
  if (strategy.id === 'system-roulette-tpa84') {
    minHistoryRequired = 3;
  } else if (strategy.id === 'system-roulette-racetrack') {
    minHistoryRequired = 4;
  } else if (strategy.id === 'system-roulette-angel84') {
    minHistoryRequired = 12;
  } else if (strategy.id.includes('historical-base') || strategy.id.includes('delay') || strategy.id.includes('probability')) {
    minHistoryRequired = 10;
  }

  if (relevantHistory.length < minHistoryRequired) {
    return {
      winRate: 0, wins: 0, losses: 0, totalProfit: 0, maxDrawdown: 0, maxConsecutiveLosses: 0,
      absoluteMaxGaleNeeded: 0,
      autoPauseSim: { totalProfit: 0, wins: 0, losses: 0, isTriggered: false, triggerType: null, preservedCapital: 0, roundsPlayed: 0 }
    };
  }

  let progState = managementConfig ? getInitialProgressionState(managementConfig) : null;
  
  // For Martingale gale cycle tracking:
  const maxGalesAllowed = gales ?? 0;
  let currentGaleIndex = 0;
  let maxGaleReached = 0;

  // Uncapped / absolute gale tracking to recover the session:
  let absoluteMaxGaleNeeded = 0;
  let currentGaleStreak = 0;

  // Local helper stats for historical-base strategies
  const sequenceStats: Record<string, Record<string, number>> = {};

  const startIndex = minHistoryRequired;

  for (let i = startIndex; i < relevantHistory.length; i++) {
    const startIdx = Math.max(0, i - 30);
    const subHistory = relevantHistory.slice(startIdx, i).reverse(); // newest to oldest for most engines
    const actualResult = relevantHistory[i].result;

    let shouldBet = false;
    let win = false;
    let spinProfit = 0;
    let roundPositionCount = positionCount;
    let multiplier = 1;
    let roundPayoutRatio: number | undefined = undefined;

    let betAmount = 10;
    if (managementConfig && progState) {
      betAmount = progState.currentBetSize;
    }

    // 1. SIGNAL GENERATION BASED ON STRATEGY ID
    if (strategy.id === 'trend-assertive') {
      const trends = trendAnalysisEngine.getRouletteTrends(subHistory);
      const mostAssertive = trends?.mostAssertive;
      if (mostAssertive && mostAssertive.confidence >= 70) {
        shouldBet = true;
        win = mostAssertive.entry ? checkWin(actualResult, mostAssertive.entry) : false;
        const entLower = (mostAssertive.entry || '').toLowerCase();
        roundPayoutRatio = calculatePayoutRatioForEntry(mostAssertive.entry);
        
        if (entLower.includes('dúzia') || entLower.includes('coluna')) {
          multiplier = 2;
        } else if (entLower.includes('terminal')) {
          multiplier = 8;
        } else if (entLower.includes('pleno')) {
          multiplier = 35;
        } else if (entLower.includes('dividida')) {
          multiplier = 17;
        } else if (entLower.includes('rua')) {
          multiplier = 11;
        } else if (entLower.includes('canto')) {
          multiplier = 8;
        } else if (entLower.includes('linha')) {
          multiplier = 5;
        }

        roundPositionCount = entLower.includes('pleno') ? 11 : 1;
        if (entLower.includes('pleno')) {
          const { individualBetSize, actualTotalCost } = calculateProportionalCoverage(betAmount, 11, minChip);
          spinProfit = win ? (individualBetSize * 36) - actualTotalCost : -actualTotalCost;
        } else {
          spinProfit = win ? betAmount * multiplier : -betAmount;
        }
      }
    }
    else if (strategy.id === 'system-roulette-trends') {
      const trends = trendAnalysisEngine.getRouletteTrends(subHistory);
      const mostAssertive = trends?.mostAssertive;
      if (mostAssertive && mostAssertive.confidence >= 70) {
        shouldBet = true;
        win = mostAssertive.entry ? checkWin(actualResult, mostAssertive.entry) : false;
        const entLower = (mostAssertive.entry || '').toLowerCase();
        multiplier = entLower.includes('dúzia') || entLower.includes('coluna') ? 2 : 1;
        roundPositionCount = entLower.includes('dúzia') || entLower.includes('coluna') ? 12 : 18;
        spinProfit = win ? betAmount * multiplier : -betAmount;
        roundPayoutRatio = calculatePayoutRatioForEntry(mostAssertive.entry);
      }
    }
    else if (strategy.id === 'system-baccarat-trends') {
      const trends = trendAnalysisEngine.getBaccaratTrends(subHistory);
      const mostAssertive = trends?.mostAssertive;
      if (mostAssertive && mostAssertive.confidence >= 70) {
        shouldBet = true;
        roundPositionCount = 1;
        roundPayoutRatio = 1;
        const actualStr = String(actualResult).toUpperCase();
        const entryUpper = mostAssertive.entry.toUpperCase();
        const isActualTie = actualStr === 'TIE' || actualStr === 'T' || actualStr === 'EMPATE' || actualStr === 'E';
        const isEntryTie = entryUpper === 'TIE' || entryUpper === 'T' || entryUpper === 'EMPATE';
        
        win = (entryUpper === 'PLAYER' || entryUpper === 'P') && (actualStr === 'PLAYER' || actualStr === 'P') ||
              (entryUpper === 'BANKER' || entryUpper === 'B') && (actualStr === 'BANKER' || actualStr === 'B') ||
              isEntryTie && isActualTie;
        
        if (win) {
          if (isEntryTie) spinProfit = betAmount * 8;
          else if (entryUpper === 'BANKER' || entryUpper === 'B') spinProfit = betAmount * 0.95;
          else spinProfit = betAmount;
        } else if (isActualTie && !isEntryTie) {
          win = undefined as any;
          spinProfit = 0;
        } else {
          spinProfit = -betAmount;
        }
      }
    }
    else if (strategy.id === 'system-roulette-probability') {
      const bestProbability = findMostProbableEntry(subHistory, 'roulette');
      
      if (bestProbability && bestProbability.confidence > 64) {
        shouldBet = true;
        roundPayoutRatio = calculatePayoutRatioForEntry(bestProbability.entry);
        const entryUpper = bestProbability.entry.toUpperCase();
        const actualItem = relevantHistory[i];
        
        if (actualItem.metadata) {
          const meta = actualItem.metadata;
          if (entryUpper === 'RED' || entryUpper === 'VERMELHO') win = meta.color === 'red';
          else if (entryUpper === 'BLACK' || entryUpper === 'PRETO') win = meta.color === 'black';
          else if (entryUpper === 'EVEN' || entryUpper === 'PAR') win = meta.parity === 'even';
          else if (entryUpper === 'ODD' || entryUpper === 'ÍMPAR') win = meta.parity === 'odd';
          else if (entryUpper.includes('DÚZIA 1')) win = meta.dozen === 1;
          else if (entryUpper.includes('DÚZIA 2')) win = meta.dozen === 2;
          else if (entryUpper.includes('DÚZIA 3')) win = meta.dozen === 3;
          else if (entryUpper.includes('COLUNA 1')) win = meta.column === 1;
          else if (entryUpper.includes('COLUNA 2')) win = meta.column === 2;
          else if (entryUpper.includes('COLUNA 3')) win = meta.column === 3;
          else if (entryUpper.includes('VIZINHOS DE ZERO')) win = meta.zones ? meta.zones.includes('VOISINS') : false;
          else if (entryUpper.includes('TIERS')) win = meta.zones ? meta.zones.includes('TIERS') : false;
          else if (entryUpper.includes('ORPHELINS')) win = meta.zones ? meta.zones.includes('ORPHELINS') : false;
          else if (entryUpper.includes('TERMINAL')) {
             const terminalNum = parseInt(entryUpper.replace(/[^0-9]/g, ''), 10);
             win = meta.terminal === terminalNum;
          }
        }
        
        const mockSig = { entry: bestProbability.entry };
        const racetrackInfo = calculateRacetrackPayoutMultiplier(Number(actualResult), mockSig);
        
        if (racetrackInfo.isRacetrack) {
          roundPositionCount = getPositionCountForSignal(mockSig);
          const { individualBetSize, actualTotalCost } = calculateProportionalCoverage(betAmount, roundPositionCount, minChip);
          spinProfit = (racetrackInfo.multiplier * individualBetSize) - actualTotalCost;
        } else {
          if (entryUpper.includes('DÚZIA') || entryUpper.includes('COLUNA')) {
            multiplier = 2;
            roundPositionCount = 12;
          } else if (entryUpper.includes('TERMINAL')) {
            multiplier = 35;
            roundPositionCount = 4;
          } else {
            multiplier = 1;
            roundPositionCount = 18;
          }
          spinProfit = win ? betAmount * multiplier : -betAmount;
        }
      }
    }
    else if (strategy.id === 'system-baccarat-probability') {
      const bestProbability = findMostProbableEntry(subHistory, 'baccarat');
      
      if (bestProbability && bestProbability.confidence > 64) {
        shouldBet = true;
        roundPositionCount = 1;
        roundPayoutRatio = 1;
        const entryUpper = bestProbability.entry.toUpperCase();
        const actualStr = String(actualResult).toUpperCase();
        const isActualTie = actualStr === 'TIE' || actualStr === 'T' || actualStr === 'EMPATE' || actualStr === 'E';
        const isEntryTie = entryUpper === 'TIE' || entryUpper === 'T' || entryUpper === 'EMPATE';
        
        win = (entryUpper === 'PLAYER' || entryUpper === 'P') && (actualStr === 'PLAYER' || actualStr === 'P') ||
              (entryUpper === 'BANKER' || entryUpper === 'B') && (actualStr === 'BANKER' || actualStr === 'B') ||
              isEntryTie && isActualTie;
              
        if (win) {
          spinProfit = isEntryTie ? betAmount * 8 : (entryUpper === 'BANKER' || entryUpper === 'B') ? betAmount * 0.95 : betAmount;
        } else if (isActualTie && !isEntryTie) {
          win = undefined as any;
          spinProfit = 0;
        } else {
          spinProfit = -betAmount;
        }
      }
    }
    else if (strategy.id === 'system-roulette-historical-base') {
      const getRFeatures = (n: number) => {
        if (isNaN(n) || n < 0 || n > 36) return null;
        const isRed = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(n);
        const isBlack = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35].includes(n);
        const col = n === 0 ? 'zero' : isRed ? 'red' : isBlack ? 'black' : 'zero';
        const doz = n === 0 ? 'd0' : n <= 12 ? 'd1' : n <= 24 ? 'd2' : 'd3';
        const colm = n === 0 ? 'c0' : n % 3 === 1 ? 'c1' : n % 3 === 2 ? 'c2' : 'c3';
        const par = n === 0 ? 'zero' : n % 2 === 0 ? 'even' : 'odd';
        const hl = n === 0 ? 'zero' : n <= 18 ? 'low' : 'high';
        const term = `t${n % 10}`;
        return { dozen: doz, column: colm, color: col, parity: par, highlow: hl, terminal: term };
      };

      const pastFeatures = relevantHistory.slice(Math.max(0, i - 15), i).map(h => getRFeatures(Number(h.result))).filter(Boolean);
      const actualFeatures = getRFeatures(Number(actualResult));

      let bestCand: { dim: string; target: string; winRate: number; count: number } | null = null;
      const dims = ['dozen', 'column', 'color', 'parity', 'highlow', 'terminal'] as const;

      for (const d of dims) {
        for (let k = 3; k >= 2; k--) {
          if (pastFeatures.length < k) continue;
          const seq = pastFeatures.slice(pastFeatures.length - k).map(f => (f as any)[d]);
          if (seq.includes('zero') || seq.includes('d0') || seq.includes('c0')) continue;
          const seqKey = `${d}_${seq.join('-')}`;
          const outcomes = sequenceStats[seqKey];
          if (outcomes) {
            let total = 0;
            let bestOut = '';
            let maxC = 0;
            for (const out of Object.keys(outcomes)) {
              total += outcomes[out];
              if (outcomes[out] > maxC) {
                maxC = outcomes[out];
                bestOut = out;
              }
            }
            const wr = total > 0 ? (maxC / total) * 100 : 0;
            if (total >= 2 && wr >= 65) {
              if (!bestCand || wr > bestCand.winRate || (wr === bestCand.winRate && maxC > bestCand.count)) {
                bestCand = { dim: d, target: bestOut, winRate: wr, count: maxC };
              }
            }
          }
        }
      }

      if (bestCand && actualFeatures) {
        shouldBet = true;
        const actualVal = (actualFeatures as any)[bestCand.dim];
        win = actualVal === bestCand.target && actualVal !== 'zero' && actualVal !== 'd0' && actualVal !== 'c0';

        if (bestCand.dim === 'dozen' || bestCand.dim === 'column') {
          multiplier = 2;
          roundPositionCount = 12;
          roundPayoutRatio = 2;
        } else if (bestCand.dim === 'terminal') {
          multiplier = 35;
          roundPositionCount = 4;
          roundPayoutRatio = 8;
        } else {
          multiplier = 1;
          roundPositionCount = 18;
          roundPayoutRatio = 1;
        }

        if (bestCand.dim === 'terminal') {
          const { individualBetSize, actualTotalCost } = calculateProportionalCoverage(betAmount, 4, minChip);
          spinProfit = win ? (individualBetSize * 36) - actualTotalCost : -actualTotalCost;
        } else {
          spinProfit = win ? betAmount * multiplier : -betAmount;
        }
      }

      // Record transitions
      if (actualFeatures) {
        for (const d of dims) {
          for (let k = 3; k >= 2; k--) {
            if (pastFeatures.length < k) continue;
            const seq = pastFeatures.slice(pastFeatures.length - k).map(f => (f as any)[d]);
            const nextVal = (actualFeatures as any)[d];
            if (!seq.includes('zero') && !seq.includes('d0') && !seq.includes('c0') && nextVal !== 'zero' && nextVal !== 'd0' && nextVal !== 'c0') {
              const seqKey = `${d}_${seq.join('-')}`;
              if (!sequenceStats[seqKey]) sequenceStats[seqKey] = {};
              sequenceStats[seqKey][nextVal] = (sequenceStats[seqKey][nextVal] || 0) + 1;
            }
          }
        }
      }
    }
    else if (strategy.id === 'system-baccarat-historical-base') {
      const getBOutcome = (res: any) => {
        const s = String(res).toUpperCase().trim();
        if (s === 'B' || s === 'BANKER' || s === 'BANCA' || s === 'BANQUEIRO') return 'B';
        if (s === 'T' || s === 'TIE' || s === 'EMPATE' || s === 'E') return 'T';
        return 'P';
      };

      const pastOutcomes = relevantHistory.slice(Math.max(0, i - 15), i).map(h => getBOutcome(h.result));
      const actualOutcome = getBOutcome(actualResult);

      let targetOutcome: string | null = null;
      for (let k = 4; k >= 2; k--) {
        if (pastOutcomes.length < k) continue;
        const seq = pastOutcomes.slice(pastOutcomes.length - k).join('-');
        const outcomes = sequenceStats[`bacc_${seq}`];
        if (outcomes) {
          let total = 0;
          let bestOut = '';
          let maxC = 0;
          for (const out of Object.keys(outcomes)) {
            total += outcomes[out];
            if (outcomes[out] > maxC) {
              maxC = outcomes[out];
              bestOut = out;
            }
          }
          if (total >= 2 && (maxC / total) >= 0.65) {
            targetOutcome = bestOut;
            break;
          }
        }
      }

      if (targetOutcome !== null) {
        shouldBet = true;
        roundPositionCount = 1;
        roundPayoutRatio = 1;
        const actualStr = actualOutcome;
        const entryUpper = targetOutcome;
        const isActualTie = actualStr === 'T';
        const isEntryTie = entryUpper === 'T';

        win = (entryUpper === 'P' && actualStr === 'P') ||
              (entryUpper === 'B' && actualStr === 'B') ||
              (isEntryTie && isActualTie);
              
        if (win) {
          spinProfit = isEntryTie ? betAmount * 8 : entryUpper === 'B' ? betAmount * 0.95 : betAmount;
        } else if (isActualTie && !isEntryTie) {
          win = undefined as any;
          spinProfit = 0;
        } else {
          spinProfit = -betAmount;
        }
      }

      for (let k = 4; k >= 2; k--) {
        if (pastOutcomes.length < k) continue;
        const seq = pastOutcomes.slice(pastOutcomes.length - k).join('-');
        const seqKey = `bacc_${seq}`;
        if (!sequenceStats[seqKey]) sequenceStats[seqKey] = {};
        sequenceStats[seqKey][actualOutcome] = (sequenceStats[seqKey][actualOutcome] || 0) + 1;
      }
    }
    else if (strategy.id === 'system-roulette-delay') {
      const delayThreshold = 6;
      const counts: Record<string, number> = {
        red: 0, black: 0, even: 0, odd: 0, high: 0, low: 0,
        dozen_1: 0, dozen_2: 0, dozen_3: 0,
        column_1: 0, column_2: 0, column_3: 0
      };
      for (const item of subHistory) {
         if (item.metadata) {
            const m = item.metadata;
            if (m.color !== 'red') counts.red++; else break;
         }
      }
      for (const item of subHistory) {
         if (item.metadata) {
            const m = item.metadata;
            if (m.color !== 'black') counts.black++; else break;
         }
      }
      for (const item of subHistory) {
         if (item.metadata) {
            const m = item.metadata;
            if (m.parity !== 'even') counts.even++; else break;
         }
      }
      for (const item of subHistory) {
         if (item.metadata) {
            const m = item.metadata;
            if (m.parity !== 'odd') counts.odd++; else break;
         }
      }
      for (const item of subHistory) {
         if (item.metadata) {
            const m = item.metadata;
            if (m.highLow !== 'high') counts.high++; else break;
         }
      }
      for (const item of subHistory) {
         if (item.metadata) {
            const m = item.metadata;
            if (m.highLow !== 'low') counts.low++; else break;
         }
      }
      for (const item of subHistory) {
         if (item.metadata) {
            const m = item.metadata;
            if (m.dozen !== 1) counts.dozen_1++; else break;
         }
      }
      for (const item of subHistory) {
         if (item.metadata) {
            const m = item.metadata;
            if (m.dozen !== 2) counts.dozen_2++; else break;
         }
      }
      for (const item of subHistory) {
         if (item.metadata) {
            const m = item.metadata;
            if (m.dozen !== 3) counts.dozen_3++; else break;
         }
      }
      for (const item of subHistory) {
         if (item.metadata) {
            const m = item.metadata;
            if (m.column !== 1) counts.column_1++; else break;
         }
      }
      for (const item of subHistory) {
         if (item.metadata) {
            const m = item.metadata;
            if (m.column !== 2) counts.column_2++; else break;
         }
      }
      for (const item of subHistory) {
         if (item.metadata) {
            const m = item.metadata;
            if (m.column !== 3) counts.column_3++; else break;
         }
      }

      let bestTrigger: string | null = null;
      let maxDelay = 0;
      for (const key of Object.keys(counts)) {
         const requiredThreshold = key.startsWith('dozen') || key.startsWith('column') ? 8 : delayThreshold;
         if (counts[key] >= requiredThreshold && counts[key] > maxDelay) {
            maxDelay = counts[key];
            bestTrigger = key;
         }
      }

      if (bestTrigger !== null) {
         shouldBet = true;
         const actualItem = relevantHistory[i];
         if (bestTrigger.startsWith('dozen') || bestTrigger.startsWith('column')) {
           multiplier = 2;
           roundPositionCount = 12;
           roundPayoutRatio = 2;
         } else {
           multiplier = 1;
           roundPositionCount = 18;
           roundPayoutRatio = 1;
         }

         if (actualItem.metadata) {
            const m = actualItem.metadata;
            if (bestTrigger === 'red') win = m.color === 'red';
            else if (bestTrigger === 'black') win = m.color === 'black';
            else if (bestTrigger === 'even') win = m.parity === 'even';
            else if (bestTrigger === 'odd') win = m.parity === 'odd';
            else if (bestTrigger === 'high') win = m.highLow === 'high';
            else if (bestTrigger === 'low') win = m.highLow === 'low';
            else if (bestTrigger === 'dozen_1') win = m.dozen === 1;
            else if (bestTrigger === 'dozen_2') win = m.dozen === 2;
            else if (bestTrigger === 'dozen_3') win = m.dozen === 3;
            else if (bestTrigger === 'column_1') win = m.column === 1;
            else if (bestTrigger === 'column_2') win = m.column === 2;
            else if (bestTrigger === 'column_3') win = m.column === 3;
         }
         spinProfit = win ? betAmount * multiplier : -betAmount;
      }
    }
    else if (strategy.id === 'system-baccarat-delay') {
      const delayThreshold = 6;
      let pDelay = 0;
      let bDelay = 0;
      for (const h of subHistory) {
         const res = String(h.result).toUpperCase();
         if (res !== 'PLAYER' && res !== 'P') pDelay++; else break;
      }
      for (const h of subHistory) {
         const res = String(h.result).toUpperCase();
         if (res !== 'BANKER' && res !== 'B') bDelay++; else break;
      }

      let bestTrigger: string | null = null;
      if (pDelay >= delayThreshold && pDelay >= bDelay) bestTrigger = 'PLAYER';
      else if (bDelay >= delayThreshold && bDelay > pDelay) bestTrigger = 'BANKER';

      if (bestTrigger !== null) {
         shouldBet = true;
         roundPositionCount = 1;
         roundPayoutRatio = 1;
         const actualStr = String(actualResult).toUpperCase();
         const isActualTie = actualStr === 'TIE' || actualStr === 'T' || actualStr === 'EMPATE' || actualStr === 'E';
         win = (bestTrigger === 'PLAYER' && (actualStr === 'PLAYER' || actualStr === 'P')) ||
               (bestTrigger === 'BANKER' && (actualStr === 'BANKER' || actualStr === 'B'));
         if (win) {
           spinProfit = (bestTrigger === 'BANKER' ? betAmount * 0.95 : betAmount);
         } else if (isActualTie) {
           win = undefined as any;
           spinProfit = 0;
         } else {
           spinProfit = -betAmount;
         }
      }
    }
    else {
      // -------------------------------------------------------------
      // CUSTOM / GENERIC STRATEGIES (WORKS FOR ANY USER DEFINED RULES)
      // -------------------------------------------------------------
      if (strategy.gameType === GameType.BACCARAT) {
        let signal: string | null = null;
        const minedId = enrichedRules?.minedId || (strategy.rules as any)?.minedId;
        if (minedId) {
          const trigger = evaluateMinedPatternTrigger(minedId, subHistory);
          if (trigger) {
            signal = trigger === 'BANKER' ? 'B' : trigger === 'PLAYER' ? 'P' : 'T';
          }
        } else if (enrichedRules?.predictedEntry) {
          const pEntry = String(enrichedRules.predictedEntry).toUpperCase();
          signal = pEntry === 'BANKER' || pEntry === 'B' ? 'B' : pEntry === 'PLAYER' || pEntry === 'P' ? 'P' : 'T';
        } else if (enrichedRules?.baccaratPattern) {
          signal = checkBaccaratPattern(enrichedRules.baccaratPattern, subHistory);
        }

        if (signal) {
          shouldBet = true;
          roundPositionCount = 1;
          roundPayoutRatio = 1;
          const actualStr = String(actualResult).toUpperCase();
          const isActualTie = actualStr === 'TIE' || actualStr === 'T' || actualStr === 'EMPATE' || actualStr === 'E';
          win = (signal === 'P' && (actualStr === 'PLAYER' || actualStr === 'P')) ||
                (signal === 'B' && (actualStr === 'BANKER' || actualStr === 'B')) ||
                (signal === 'T' && isActualTie);
                
          if (win) {
            spinProfit = (signal === 'T') ? betAmount * 8 : (signal === 'B') ? betAmount * 0.95 : betAmount;
          } else if (isActualTie && signal !== 'T') {
            win = undefined as any;
            spinProfit = 0;
          } else {
            spinProfit = -betAmount;
          }
        }
      } else {
        // Roulette custom or adaptive strategies
        if (enrichedStrategy.rules?.triggerConfig) {
          const customResult = evaluateCustomTriggers(enrichedStrategy.rules.triggerConfig, subHistory, enrichedStrategy);
          if (customResult.triggered) {
            shouldBet = true;
            const entryNumbers = customResult.entryNumbersOverride || getCoveredNumbersForStrategy(enrichedStrategy);
            roundPositionCount = Math.max(1, entryNumbers.length);
            roundPayoutRatio = roundPositionCount < 36 ? (36 - roundPositionCount) / roundPositionCount : 1;
            const actualNum = Number(actualResult);
            win = !isNaN(actualNum) && entryNumbers.includes(actualNum);
            const { individualBetSize, actualTotalCost } = calculateProportionalCoverage(betAmount, roundPositionCount, minChip);
            spinProfit = win ? (individualBetSize * 36) - actualTotalCost : -actualTotalCost;
          }
        } else if (enrichedRules && enrichedRules.bets && enrichedRules.bets.length > 0) {
          // Dynamic trigger evaluation based on strategy historical assertivity & pattern repetition
          const coverageCount = calculateCoverage(enrichedStrategy);
          const delayThreshold = Math.max(2, Math.floor(37 / (coverageCount || 1)) + 1);
          const strategyAssertivity = calculatePerformance(subHistory, enrichedStrategy);
          const repetition = calculateStrategyRepetition(subHistory, enrichedStrategy);
          
          const repMin = delayThreshold < 5 ? 2 : 3; 
          let trendConfidence = 50;
          if (repetition >= repMin) {
            trendConfidence = 82 + (repetition * 3.5);
          } else {
            trendConfidence = 35;
          }

          const finalConfidence = (strategyAssertivity * 0.4) + (trendConfidence * 0.6);
          const isTriggered = finalConfidence >= 64;

          if (isTriggered) {
            shouldBet = true;
            roundPositionCount = getStrategyPositionCount(enrichedStrategy);
            roundPayoutRatio = roundPositionCount < 36 ? (36 - roundPositionCount) / roundPositionCount : 1;
            spinProfit = strategyEngine.calculateStrategySpinProfit(enrichedStrategy, actualResult, betAmount, managementConfig);
            win = spinProfit > 0;
          }
        }
      }
    }

    // 2. UNIFIED SIMULATION AND METRICS PROCESSING (APPLIES TO ALL STRATEGIES)
    if (shouldBet) {
      totalRoundsCount++;

      // Track the uncapped consecutive losses (gales) needed to turn a streak into a win
      if (win) {
        absoluteMaxGaleNeeded = Math.max(absoluteMaxGaleNeeded, currentGaleStreak);
        currentGaleStreak = 0;
      } else {
        currentGaleStreak++;
        absoluteMaxGaleNeeded = Math.max(absoluteMaxGaleNeeded, currentGaleStreak);
      }

      // A. Update Win/Loss stats flatly for every individual bet operation (matches roulette panel)
      if (win) {
        wins++;
        currentConsecutiveLosses = 0;
        if (!withPauseHasStopped) {
          winsWithPause++;
        }
      } else {
        losses++;
        currentConsecutiveLosses++;
        maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentConsecutiveLosses);
        if (!withPauseHasStopped) {
          lossesWithPause++;
        }
      }

      // Track Martingale levels separately for progression and maximum gale analysis in background
      if (isMartingale) {
        if (win) {
          currentGaleIndex = 0; // Reset Martingale cycle
        } else {
          if (currentGaleIndex < maxGalesAllowed) {
            currentGaleIndex++;
            maxGaleReached = Math.max(maxGaleReached, currentGaleIndex);
          } else {
            currentGaleIndex = 0; // Reset martingale to level 0 (Gales exceeded)
          }
        }
      }

      // B. Update balances & Drawdown
      totalProfit += spinProfit;
      currentBalance += spinProfit;

      if (currentBalance > peak) peak = currentBalance;
      const drop = peak > 0 ? ((peak - currentBalance) / peak) * 100 : 0;
      if (drop > maxDrawdown) maxDrawdown = drop;

      // C. Update auto-pause / stop-win / stop-loss tracking
      if (!withPauseHasStopped) {
        withPauseRoundsCount++;
        profitWithPause += spinProfit;

        if (profitWithPause >= stopWinVal) {
          withPauseHasStopped = true;
          withPauseTriggerType = 'stop_win';
        } else if (profitWithPause <= -stopLossVal) {
          withPauseHasStopped = true;
          withPauseTriggerType = 'stop_loss';
        }
      }

      // E. Update progression state engine
      if (managementConfig && progState) {
        // For martingale, we pass the levels override to avoid early force-reset from progressionEngine itself,
        // since our master loop authoritatively handles gale limits and cycles.
        const activeConfig = isMartingale ? { ...managementConfig, levels: 999 } : managementConfig;
        progState = updateProgressionState(progState, win, spinProfit, activeConfig, roundPositionCount, undefined, roundPayoutRatio);
        
        // If we reset our gale cycle, we must reset progState bet size back to initial bet size
        if (isMartingale && currentGaleIndex === 0) {
          const freshState = getInitialProgressionState(managementConfig);
          progState.currentBetSize = freshState.currentBetSize;
          progState.currentLevel = 0;
        }
      }
    }
  }

  // Since each individual bet loss is now counted flatly during the loop,
  // we do not need to add an extra loss for outstanding gales at the end of the history.

  return {
    winRate: (wins / (wins + losses || 1)) * 100,
    wins,
    losses,
    totalProfit,
    maxDrawdown,
    maxConsecutiveLosses: isMartingale ? maxGaleReached : maxConsecutiveLosses,
    absoluteMaxGaleNeeded,
    autoPauseSim: {
      totalProfit: profitWithPause,
      wins: winsWithPause,
      losses: lossesWithPause,
      isTriggered: withPauseHasStopped,
      triggerType: withPauseTriggerType,
      preservedCapital: profitWithPause - totalProfit,
      roundsPlayed: withPauseHasStopped ? withPauseRoundsCount : totalRoundsCount
    }
  };
};

export const getStrategyPositionCount = (strategy: Strategy): number => {
  if (!strategy) return 1;
  if (strategy.id === 'system-roulette-tpa84') return 24;
  if (strategy.id === 'system-roulette-racetrack') return 6; // Physical chip average/base (Tiers is 6, Voisins is 9, Orphelins is 5)
  if (strategy.id === 'system-roulette-angel84') return 25;
  
  if (strategy.rules?.triggerConfig?.useRacetrackConfluence) {
    const sector = strategy.rules.triggerConfig.confluenceType;
    if (sector) {
      return getPositionCountForSignal({ entry: sector });
    }
  }
  
  if (strategy.rules?.bets && Array.isArray(strategy.rules.bets)) {
    let count = 0;
    strategy.rules.bets.forEach((bet: any) => {
      if (bet.type === 'number') {
        count += 1;
      } else if (bet.type === 'multi' && Array.isArray(bet.target)) {
        count += bet.target.length;
      } else if (bet.type === 'dozen' || bet.type === 'column' || bet.type === 'color' || bet.type === 'even_chance') {
        count += 1;
      } else {
        count += 1;
      }
    });
    if (count > 0) return count;
  }

  if (strategy.gameType === GameType.ROULETTE) {
    const coveredNumbers = getCoveredNumbersForStrategy(strategy);
    if (coveredNumbers && coveredNumbers.length > 0) {
      return coveredNumbers.length;
    }
  }
  return 1;
};

export const runBacktest = (
  history: GameResult[],
  strategy: Strategy,
  originalManagementConfig?: ManagementConfig,
  stopWin?: number,
  stopLoss?: number,
  maxGalesForBacktest?: number
) => {
  try {
    // Run the main simulation with the original management config directly (no forced mode override)
    const mainSim = runSingleBacktestSimulation(
      history,
      strategy,
      originalManagementConfig,
      stopWin,
      stopLoss,
      undefined
    );

    // 2. Compute bankroll requirements based on the actual maximum consecutive losses (maxGaleReached)
    const getSafeBankrollMetrics = (maxG: number) => {
      const positionCount = getStrategyPositionCount(strategy);
      const baseBet = originalManagementConfig?.initialBet || 10;
      const levelsCount = originalManagementConfig?.levels || 3;
      const configuredGales = Math.max(0, levelsCount);

      const getCost = (galesCount: number) => {
        if (!originalManagementConfig) {
          return baseBet * positionCount * (galesCount + 1);
        }
        
        const config = {
          ...originalManagementConfig,
          gameTarget: strategy.gameType
        };
        let state = getInitialProgressionState(config);
        let total = 0;
        
        const strategyPayoutRatio = strategy.gameType === GameType.BACCARAT
          ? 1
          : positionCount < 36
            ? (36 - positionCount) / positionCount
            : 1;
        
        for (let i = 0; i <= galesCount; i++) {
          const bet = state.currentBetSize;
          total += bet;
          
          const isWinBased = config.mode === ManagementMode.SOROS;
          const win = isWinBased ? true : false;
          let spinProfit = 0;
          if (win) {
            if (strategy.gameType === GameType.ROULETTE) {
              spinProfit = bet * (36 - positionCount) / positionCount;
            } else {
              spinProfit = bet;
            }
          } else {
            spinProfit = -bet;
          }
          
          state = updateProgressionState(state, win, spinProfit, config, positionCount, undefined, strategyPayoutRatio);
        }
        return total;
      };
      
      const safeGalesForBankroll = Math.max(configuredGales, maxG);
      const realBankrollNeeded = getCost(safeGalesForBankroll);

      return {
        maxGaleNeeded: maxG,
        realBankrollNeeded,
        safeBankrollConservative: getCost(safeGalesForBankroll + 2),
        safeBankrollModerate: getCost(safeGalesForBankroll + 1),
        safeBankrollAggressive: realBankrollNeeded
      };
    };

    const bankrollMetrics = getSafeBankrollMetrics(mainSim.absoluteMaxGaleNeeded);

    return {
      winRate: mainSim.winRate,
      wins: mainSim.wins,
      losses: mainSim.losses,
      totalProfit: mainSim.totalProfit,
      maxDrawdown: mainSim.maxDrawdown,
      roi: (mainSim.totalProfit / Math.max(1, bankrollMetrics.realBankrollNeeded)) * 100,
      ...bankrollMetrics,
      autoPauseSim: mainSim.autoPauseSim
    };
  } catch (err: any) {
    console.error(`[Backtest Engine Error] Erro ao processar estratégia "${strategy.name}" (ID: ${strategy.id}):`, err);
    return {
      winRate: 0, wins: 0, losses: 0, totalProfit: 0, maxDrawdown: 0, roi: 0, ...defaultBankrollMetrics,
      error: err instanceof Error ? err.message : String(err),
      autoPauseSim: {
        totalProfit: 0,
        wins: 0,
        losses: 0,
        isTriggered: false,
        triggerType: null,
        preservedCapital: 0,
        roundsPlayed: 0
      }
    };
  }
};

/**
 * Executes a backtest asynchronously, using a Web Worker if available,
 * or falling back to synchronous execution on the main thread.
 */
export const runBacktestAsync = (
  history: GameResult[],
  strategy: Strategy,
  managementConfig?: ManagementConfig,
  stopWin?: number,
  stopLoss?: number,
  maxGalesForBacktest?: number
): Promise<any> => {
  return new Promise((resolve) => {
    // We execute in a setTimeout to avoid blocking the main thread during execution,
    // which prevents the browser UI from freezing and is 100% reliable in iframes where Workers hang.
    setTimeout(() => {
      try {
        const res = runBacktest(history, strategy, managementConfig, stopWin, stopLoss, maxGalesForBacktest);
        resolve(res);
      } catch (err: any) {
        console.error(`[Backtest Async Error] ${strategy.name}:`, err);
        resolve({
          winRate: 0, wins: 0, losses: 0, totalProfit: 0, maxDrawdown: 0, roi: 0, ...defaultBankrollMetrics,
          error: err instanceof Error ? err.message : String(err),
          autoPauseSim: { totalProfit: 0, wins: 0, losses: 0, isTriggered: false, triggerType: null, preservedCapital: 0, roundsPlayed: 0 }
        });
      }
    }, 10);
  });
};
