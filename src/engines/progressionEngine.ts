import { GameResult, ManagementConfig, ManagementMode, GameType } from '../types';
import { detectRegionalSector, REGIONAL_SECTOR_UNITS } from '../constants';

export const ALLOWED_CHIPS = [0.10, 0.20, 0.50, 1.00, 2.00, 2.50, 5.00, 10.00, 20.00, 25.00, 50.00, 100.00, 125.00, 200.00, 250.00, 500.00];

export const getOptimalChipSize = (
  targetBaseBet: number,
  positionCount: number,
  isBaccarat: boolean = false,
  minBet?: number,
  maxBet?: number,
  minChip?: number
): number => {
  const N = Math.max(1, positionCount);
  if (isBaccarat) {
    let bet = targetBaseBet && targetBaseBet > 0 ? targetBaseBet : 1.0;
    if (minBet !== undefined && minBet > 0 && bet < minBet) bet = minBet;
    if (maxBet !== undefined && maxBet > 0 && bet > maxBet) bet = maxBet;
    return Number(bet.toFixed(2));
  }

  // For Roulette, minChip (the base chip selected in Ultra-Fast Keyboard Entry, e.g. R$ 1.00) is the unit value per number/position.
  let chip = minChip !== undefined && minChip > 0 
    ? minChip 
    : (targetBaseBet && targetBaseBet > 0 ? targetBaseBet : 0.10);
    
  if (minBet !== undefined && minBet > 0 && (chip * N) < minBet) {
    chip = Number((minBet / N).toFixed(2));
  }
  return Number(chip.toFixed(2));
};

export const generateFibonacciSequence = (length: number): number[] => {
  const seq = [1, 1];
  for (let i = 2; i < length; i++) {
    seq.push(seq[i - 1] + seq[i - 2]);
  }
  return seq;
};

export const generatePadovanSequence = (length: number): number[] => {
  const seq = [1, 1, 1];
  for (let i = 3; i < length; i++) {
    seq.push(seq[i - 2] + seq[i - 3]);
  }
  return seq;
};

export interface ProgressionState {
  currentBetSize: number;
  consecutiveWins: number;
  currentLevel: number;
  fibIndex?: number;
  runningProfit?: number;
  maxRunningProfit?: number;
  labouchereList?: number[];
  cycleProfit?: number;
  cycleLoss?: number;
  sequenceBaseBet?: number;
}

export const getInitialProgressionState = (config: ManagementConfig, positionCount?: number): Required<ProgressionState> => {
  const isBaccarat = config.gameTarget === GameType.BACCARAT;
  const N = positionCount || (isBaccarat ? 1 : 11);
  const initialChip = getOptimalChipSize(
    config.initialBet || (isBaccarat ? 0.20 : 0.10),
    N,
    isBaccarat,
    config.minBet,
    config.maxBet,
    config.minChip
  );
  let initialBet = Number((initialChip * N).toFixed(2));
  const startBet = initialBet;

  const defaultLabSequence = (config.customLabouchereSequence && config.customLabouchereSequence.length > 0)
    ? config.customLabouchereSequence.map(v => v * (isBaccarat ? 1 : initialChip))
    : [initialBet, initialBet * 2, initialBet * 3];

  return {
    currentBetSize: startBet,
    consecutiveWins: 0,
    currentLevel: 0,
    fibIndex: 0,
    runningProfit: 0,
    maxRunningProfit: 0,
    labouchereList: defaultLabSequence,
    cycleProfit: 0,
    cycleLoss: 0,
    sequenceBaseBet: startBet
  };
};

/**
 * Calculates the total cumulative loss across all configured Gale levels based on the starting conditions.
 */
export const calculateCumulativeGaleLoss = (
  config: ManagementConfig,
  initialBalance: number = 1000,
  positionCount?: number
): number => {
  const isBaccarat = config.gameTarget === GameType.BACCARAT;
  const baseChip = config.minChip && config.minChip > 0 ? config.minChip : (config.initialBet && config.initialBet > 0 ? config.initialBet : (isBaccarat ? 1.00 : 0.10));
  
  let N = 1;
  if (positionCount !== undefined && positionCount > 0) {
    N = positionCount;
  } else if (isBaccarat) {
    N = 1;
  } else if (config.initialBet && config.initialBet > baseChip) {
    N = Math.max(1, Math.round(config.initialBet / baseChip));
  } else {
    N = 24; // Default to 24 numbers for roulette coverage
  }

  const levelsCount = config.levels !== undefined && !isNaN(Number(config.levels)) && Number(config.levels) >= 0 ? Number(config.levels) : 10;
  const multiplier = config.multiplier || 2;
  const fibSequence = generateFibonacciSequence(Math.max(30, levelsCount + 5));
  const padovanSequence = generatePadovanSequence(Math.max(30, levelsCount + 5));
  const star22Seq = [1, 1, 2, 2, 3, 4, 5, 7, 9, 12, 16, 21, 28, 37, 49, 65, 86, 114, 151, 200, 265, 351, 465, 616, 816];
  const star20Seq = [1, 1, 1, 1, 1, 1, 1, 1, 2, 3, 4, 5, 7, 9, 12, 16, 21, 28, 37, 49, 65, 86, 114, 151, 200, 265, 351, 465, 616, 816];

  let totalInvested = 0;
  let labList = [1, 2, 3];

  // Sum from level 0 (Base Entry) up to levelsCount (Gales)
  for (let i = 0; i <= levelsCount; i++) {
    let units = 1.0;

    const hasManual = config.manualGaleChips && config.manualGaleChips[i] !== undefined && config.manualGaleChips[i] !== null && config.manualGaleChips[i] > 0;

    if (hasManual) {
      units = config.manualGaleChips![i];
    } else {
      switch (config.mode) {
        case ManagementMode.MARTINGALE:
        case ManagementMode.SOROS:
          units = Math.pow(multiplier, i);
          break;
        case ManagementMode.FIBONACCI:
          units = fibSequence[i] || fibSequence[fibSequence.length - 1];
          break;
        case ManagementMode.FIXED:
        case ManagementMode.OSCARS_GRIND:
        case ManagementMode.REVERSE_MARTINGALE:
        case ManagementMode.SYSTEM_1326:
        case ManagementMode.KELLY_CRITERION:
          units = 1.0;
          break;
        case ManagementMode.CYCLIC: {
          const cycle = [1, 2, 4, 8, 16];
          units = cycle[i % cycle.length] || 1;
          break;
        }
        case ManagementMode.SISTEMA_2_GANHOS:
        case ManagementMode.D_ALEMBERT:
        case ManagementMode.NIVEL_FIXO_RECUPERACAO:
          units = 1 + i;
          break;
        case ManagementMode.SISTEMA_2U_REC1:
          units = 1 + 2 * i;
          break;
        case ManagementMode.STAR_2_2: {
          units = i < star22Seq.length ? star22Seq[i] : star22Seq[star22Seq.length - 1];
          break;
        }
        case ManagementMode.STAR_2_0: {
          units = i < star20Seq.length ? star20Seq[i] : star20Seq[star20Seq.length - 1];
          break;
        }
        case ManagementMode.DUTCH: {
          const dutchIdx = Math.floor(i / 3);
          units = 1 + dutchIdx * 2;
          break;
        }
        case ManagementMode.PADOVAN: {
          units = i < padovanSequence.length ? padovanSequence[i] : padovanSequence[padovanSequence.length - 1];
          break;
        }
        case ManagementMode.LABOUCHERE: {
          if (labList.length === 0) labList = [1, 2, 3];
          units = labList.length === 1 ? labList[0] : labList[0] + labList[labList.length - 1];
          labList.push(units);
          break;
        }
        default:
          units = 1 + i;
          break;
      }
    }

    const levelChipValue = Number((baseChip * units).toFixed(2));
    let mainBet = Number((levelChipValue * N).toFixed(2));

    if (config.minBet !== undefined && config.minBet > 0) {
      mainBet = Math.max(config.minBet, mainBet);
    }
    if (config.maxBet !== undefined && config.maxBet > 0) {
      mainBet = Math.min(config.maxBet, mainBet);
    }

    let protectionBet = 0;
    if (!isBaccarat && config.coverZero) {
      protectionBet = Number((levelChipValue * (config.unitsZero !== undefined ? config.unitsZero : 1.0)).toFixed(2));
    } else if (isBaccarat && config.coverTie) {
      protectionBet = Number((levelChipValue * (config.unitsTier !== undefined ? config.unitsTier : 1.0)).toFixed(2));
    }

    const totalStepBet = mainBet + protectionBet;
    totalInvested += totalStepBet;
  }

  return Number(totalInvested.toFixed(2));
};

export const calculatePayoutRatioForEntry = (entry: string | undefined, sig?: any): number | undefined => {
  if (!entry && !sig) return undefined;
  const ent = String(entry || '').toLowerCase();

  // 1. Structured Bets (rules.bets) - applicable to any multi-bet strategy (e.g. Mesa Híbrida, 2 Dúzias, etc.)
  if (sig && sig.rules?.bets && Array.isArray(sig.rules.bets) && sig.rules.bets.length > 0) {
    const bets = sig.rules.bets;
    const totalCost = bets.reduce((acc: number, b: any) => acc + (b.amount || 1), 0);
    if (totalCost > 0) {
      // Helper to dynamically get return multiplier of a roulette bet type
      const getPayoutMultiplierForType = (type: string, target?: any): number => {
        const t = String(type).toLowerCase().trim();
        if (t === 'dozen' || t === 'coluna' || t === 'column' || t === 'dúzia' || t === 'duzia') return 3;
        if (t === 'line' || t === 'lines' || t === 'linha' || t === 'seisena' || t === 'double_street' || t === 'double_streets') return 6;
        if (t === 'street' || t === 'rua') return 12;
        if (t === 'corner' || t === 'canto') return 9;
        if (t === 'split' || t === 'dividida' || t === 'cavalo') return 18;
        if (t === 'number' || t === 'pleno') return 36;
        if (t === 'color' || t === 'even_chance' || t === 'par' || t === 'ímpar' || t === 'impar' || t === 'red' || t === 'black' || t === 'high' || t === 'low') return 2;
        
        // Multi handles dynamic array coverages
        if (t === 'multi' && Array.isArray(target)) {
          if (target.length === 6) return 6;    // Rua Dupla
          if (target.length === 12) return 3;   // Dúzia / Coluna
          if (target.length === 3) return 12;   // Rua
          if (target.length === 4) return 9;    // Canto
          if (target.length === 2) return 18;   // Split
          if (target.length === 1) return 36;   // Pleno
        }
        return 3; // Standard fallback
      };

      // In a balanced/hedged strategy, we evaluate the minimum net return profile across all bet spots
      const minNetProfit = bets.reduce((min: number, b: any) => {
        const mult = getPayoutMultiplierForType(b.type, b.target);
        const grossReturn = (b.amount || 1) * mult;
        const net = grossReturn - totalCost;
        return net < min ? net : min;
      }, Infinity);

      if (minNetProfit > 0 && minNetProfit !== Infinity) {
        return Math.max(0.1, Number((minNetProfit / totalCost).toFixed(4)));
      }
    }
  }

  // 2. Terminal / S84 / TPA84 / Angel84 / Plenos strategies
  const isTerminalOrPleno = 
    sig?.isRacetrack || 
    sig?.isTpa84 || 
    sig?.isAngel84 ||
    ent.includes('terminal') ||
    (sig?.patternName && String(sig.patternName).toLowerCase().includes('terminal')) ||
    (sig?.strategyId && String(sig.strategyId).toLowerCase().includes('s84')) ||
    (sig?.strategyId && String(sig.strategyId).toLowerCase().includes('angel84')) ||
    (sig?.strategyId && String(sig.strategyId).toLowerCase().includes('tpa84'));

  if (isTerminalOrPleno) {
    const N = sig?.entryNumbers?.length || sig?.unitsRequired || 11;
    if (N > 0 && N < 36) {
      return (36 - N) / N;
    }
  }

  // 3. Regional Sectors (European racetrack bets)
  const sector = detectRegionalSector(sig || entry);
  if (sector === 'VOISINS') return 1.0;
  if (sector === 'TIERS') return 2.0;
  if (sector === 'ORPHELINS') return 2.6;
  if (sector === 'ZERO_SPIEL') return 3.5;

  if (ent.includes('híbrida') || ent.includes('hybrid') || ent.includes('hibrida')) {
    return 0.5; // Direct fallback to 0.5 ratio
  }

  // 4. Double Dozens or Double Columns (covert 24 numbers -> 0.5 net profit ratio)
  if (
    ent.includes('2 dúzia') || ent.includes('2 duzia') || ent.includes('2 coluna') ||
    ent.includes('1ª e 2ª') || ent.includes('2ª e 3ª') || ent.includes('1ª e 3ª') ||
    ent.includes('1ª e 2ª coluna') || ent.includes('2ª e 3ª coluna') || ent.includes('1ª e 3ª coluna')
  ) {
    return 0.5;
  }

  // 5. Single Dozens and Columns (2:1 payoff)
  if (ent.includes('dúzia') || ent.includes('duzia') || ent.includes('coluna') || ent.includes('1-12') || ent.includes('13-24') || ent.includes('25-36')) {
    return 2.0;
  }

  // 6. 1:1 simple chances
  if (
    ent === 'odd' || ent === 'even' || ent === 'red' || ent === 'black' || ent === 'high' || ent === 'low' ||
    ent === 'ímpar' || ent === 'impar' || ent === 'par' || ent === 'vermelho' || ent === 'preto' || ent === 'maior' || ent === 'menor'
  ) {
    return 1.0;
  }

  // 7. General fallback for Plenos / Numbers list
  if (sig && sig.entryNumbers && Array.isArray(sig.entryNumbers) && sig.entryNumbers.length > 0 && isTerminalOrPleno) {
    const N = sig.entryNumbers.length;
    if (N > 0 && N < 36) {
      return (36 - N) / N;
    }
  }

  return undefined;
};

/**
 * Calculates the exact recovery bet based specifically on the 'total initial strategy entry value'
 * (the sum of all chips bet on entry) and the accumulated loss, ensuring the payout covers the total loss.
 */
export const calculateStrategyTotalRecoveryBet = (
  cycleLoss: number,
  positionCount: number,
  initialBet: number, // Total initial bet of the strategy (sum of all chips)
  step: number,       // Passed as minimum chip/step or initialChip
  isBaccarat: boolean,
  multiplier: number = 2,
  level: number = 1,
  targetPayoutRatio?: number
): number => {
  if (cycleLoss <= 0) return initialBet;

  const N = Math.max(1, positionCount);
  const initialChip = step > 0 ? step : 0.10;

  if (isBaccarat) {
    // Baccarat pays 1:1, so RequiredBet = cycleLoss + initialBet (desired profit)
    const requiredBet = cycleLoss + initialBet;
    return Math.max(initialBet, Math.ceil(requiredBet / initialChip) * initialChip);
  } else {
    // Determine payout ratio
    let payoutRatio = 1;
    if (targetPayoutRatio !== undefined) {
      payoutRatio = targetPayoutRatio;
    } else {
      payoutRatio = N < 36 ? (36 - N) / N : 1;
    }

    const requiredBet = (cycleLoss + initialBet) / payoutRatio;
    const rawTarget = Math.max(initialBet, requiredBet);
    return Number(rawTarget.toFixed(2));
  }
};

/**
 * Calculates the exact recommended bet size to recover previous losses,
 * completely independent of the selected strategy, based on the accumulated loss
 * and the number of chips (positionCount) covered by the current strategy.
 */
export const calculateRecoveryBet = (
  cycleLoss: number,
  positionCount: number,
  initialBet: number,
  step: number,
  isBaccarat: boolean,
  multiplier: number = 2,
  level: number = 1,
  targetPayoutRatio?: number
): number => {
  return calculateStrategyTotalRecoveryBet(cycleLoss, positionCount, initialBet, step, isBaccarat, multiplier, level, targetPayoutRatio);
};

export const updateProgressionState = (
  state: Required<ProgressionState>,
  win: boolean | undefined,
  profit: number,
  config: ManagementConfig,
  positionCount?: number,
  overrideInitialChip?: number,
  targetPayoutRatio?: number
): Required<ProgressionState> => {
  const isBaccarat = config.gameTarget === GameType.BACCARAT;
  const N = positionCount || (isBaccarat ? 1 : 11);
  const initialChip = overrideInitialChip !== undefined 
    ? overrideInitialChip 
    : getOptimalChipSize(
        config.initialBet || (isBaccarat ? 0.20 : 0.10),
        N,
        isBaccarat,
        config.minBet,
        config.maxBet,
        config.minChip
      );
  let initialBet = Number((initialChip * N).toFixed(2));
  const levelsCount = config.levels !== undefined && !isNaN(Number(config.levels)) && Number(config.levels) >= 0 ? Number(config.levels) : 10;
  const fibSequence = generateFibonacciSequence(Math.max(30, levelsCount + 5));
  const padovanSequence = generatePadovanSequence(Math.max(30, levelsCount + 5));
  const star22Seq = [1, 1, 2, 2, 3, 4, 5, 7, 9, 12, 16, 21, 28, 37, 49, 65, 86, 114, 151, 200, 265, 351, 465, 616, 816];
  const star20Seq = [1, 1, 1, 1, 1, 1, 1, 1, 2, 3, 4, 5, 7, 9, 12, 16, 21, 28, 37, 49, 65, 86, 114, 151, 200, 265, 351, 465, 616, 816];

  let currentBet = state.currentBetSize;
  let consecutiveWins = state.consecutiveWins;
  let currentLevel = state.currentLevel;
  let fibIndex = state.fibIndex;
  let runningProfit = state.runningProfit + profit;
  let maxRunningProfit = state.maxRunningProfit;
  const defaultLabSequence = (config.customLabouchereSequence && config.customLabouchereSequence.length > 0)
    ? config.customLabouchereSequence.map(v => v * (isBaccarat ? 1 : initialChip))
    : [initialBet, initialBet * 2, initialBet * 3];

  let labouchereList = (state.labouchereList && state.labouchereList.length > 0) 
    ? [...state.labouchereList] 
    : defaultLabSequence;
  let cycleProfit = state.cycleProfit !== undefined ? state.cycleProfit : 0;
  let cycleLoss = state.cycleLoss !== undefined ? state.cycleLoss : 0;

  let sequenceBaseBet = state.sequenceBaseBet !== undefined ? state.sequenceBaseBet : state.currentBetSize;
  if (state.currentLevel === 0) {
    sequenceBaseBet = state.currentBetSize;
  }

  const prevMaxRunningProfit = maxRunningProfit;
  if (runningProfit > maxRunningProfit) {
    maxRunningProfit = runningProfit;
  }

  // Handle Tie / Push (bet refunded, no win and no loss)
  if (win === undefined || (profit === 0 && isBaccarat)) {
    return {
      currentBetSize: currentBet,
      consecutiveWins,
      currentLevel,
      fibIndex,
      runningProfit,
      maxRunningProfit,
      labouchereList,
      cycleProfit,
      cycleLoss,
      sequenceBaseBet
    };
  }

  // Track loss sequences
  if (win === false) {
    const lostAmount = profit < 0 ? Math.abs(profit) : currentBet;
    cycleLoss += lostAmount;
    currentLevel += 1;
  } else if (win === true) {
    const wonAmount = profit > 0 ? profit : 0;
    if (config.mode === ManagementMode.MARTINGALE) {
      cycleLoss = 0;
      currentLevel = 0;
    } else {
      cycleLoss = Math.max(0, cycleLoss - wonAmount);
      if (cycleLoss === 0) {
        currentLevel = 0;
      }
    }
  }

  // Detect recovery: if a recovery/defensive progression mode has achieved/exceeded the previous session peak
  // or is in net positive territory for the session, reset the progression to its safe starting parameters.
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
    ManagementMode.STAR_2_0,
    ManagementMode.DUTCH,
    ManagementMode.PADOVAN
  ].includes(config.mode);

  const hasRecovered = isRecoveryMode && (runningProfit >= maxRunningProfit || cycleLoss === 0);

  if (hasRecovered) {
    currentBet = initialBet;
    currentLevel = 0;
    consecutiveWins = 0;
    fibIndex = 0;
    cycleLoss = 0;
    cycleProfit = 0;
    labouchereList = [initialBet, initialBet * 2, initialBet * 3];
  } else {
    if (config.mode === ManagementMode.FIXED) {
      currentBet = initialBet;
      currentLevel = 0;
      consecutiveWins = 0;
      cycleLoss = 0;
    }
    else if (config.mode === ManagementMode.NIVEL_FIXO_RECUPERACAO) {
      const incrementUnits = 1;
      currentBet = sequenceBaseBet * (1 + currentLevel * incrementUnits);
      consecutiveWins = 0;
    }
    else if (config.mode === ManagementMode.SOROS) {
      if (win === true) {
        currentLevel += 1;
        if (currentLevel >= levelsCount) {
          currentBet = initialBet;
          currentLevel = 0;
        } else {
          currentBet = Math.round((currentBet * 2) / initialChip) * initialChip;
        }
      } else {
        currentBet = initialBet;
        currentLevel = 0;
      }
      consecutiveWins = 0;
      cycleLoss = 0;
    }
    else if (config.mode === ManagementMode.MARTINGALE) {
      if (cycleLoss > 0) {
        if (currentLevel > levelsCount) {
          currentBet = initialBet;
          currentLevel = 0;
          cycleLoss = 0;
        } else {
          const standardMartingaleBet = sequenceBaseBet * Math.pow(config.multiplier || 2, currentLevel);
          const mathematicalRecoveryBet = calculateStrategyTotalRecoveryBet(cycleLoss, N, initialBet, initialChip, isBaccarat, config.multiplier || 2, currentLevel, targetPayoutRatio);
          let finalRecBet = Math.max(standardMartingaleBet, mathematicalRecoveryBet);
          
          if (!isBaccarat && N > 1) {
            const rawChip = finalRecBet / N;
            const roundedUpChip = Math.ceil(Number((rawChip - 0.001).toFixed(4)) / initialChip) * initialChip;
            finalRecBet = Number((roundedUpChip * N).toFixed(2));
          }
          currentBet = finalRecBet;
        }
      } else {
        currentBet = initialBet;
        currentLevel = 0;
      }
      consecutiveWins = 0;
    }
    else if (config.mode === ManagementMode.FIBONACCI) {
      if (win === false) {
        fibIndex = (fibIndex || 0) + 1;
        if (fibIndex > levelsCount || fibIndex >= fibSequence.length) {
          fibIndex = 0;
          currentBet = initialBet;
          currentLevel = 0;
        } else {
          currentBet = sequenceBaseBet * fibSequence[fibIndex];
          currentLevel = fibIndex;
        }
      } else {
        fibIndex = Math.max(0, (fibIndex || 0) - 2);
        currentBet = sequenceBaseBet * fibSequence[fibIndex];
        currentLevel = fibIndex;
      }
      consecutiveWins = 0;
    }
    else if (config.mode === ManagementMode.D_ALEMBERT) {
      if (win === false) {
        if (currentLevel > levelsCount) {
          currentBet = initialBet;
          currentLevel = 0;
        } else {
          currentBet = sequenceBaseBet * (1 + currentLevel);
        }
      } else {
        currentLevel = Math.max(0, currentLevel - 1);
        currentBet = sequenceBaseBet * (1 + currentLevel);
      }
      consecutiveWins = 0;
    }
    else if (config.mode === ManagementMode.CYCLIC) {
      const cycle = [1, 2, 4, 8, 16];
      if (win === false) {
        if (currentLevel > levelsCount) {
          currentLevel = 0;
          currentBet = initialBet;
        } else {
          currentBet = sequenceBaseBet * (cycle[currentLevel % cycle.length] || 1);
        }
      } else {
        currentLevel = 0;
        currentBet = initialBet;
      }
      consecutiveWins = 0;
    }
    else if (config.mode === ManagementMode.SISTEMA_2_GANHOS) {
      if (win === false) {
        if (currentLevel > levelsCount) {
          currentBet = initialBet;
          currentLevel = 0;
        } else {
          currentBet = sequenceBaseBet * (1 + currentLevel);
        }
        consecutiveWins = 0;
      } else {
        consecutiveWins += 1;
        if (consecutiveWins >= 2) {
          currentLevel = Math.max(0, currentLevel - 1);
          currentBet = sequenceBaseBet * (1 + currentLevel);
          consecutiveWins = 0;
        }
      }
    }
    else if (config.mode === ManagementMode.SISTEMA_2U_REC1) {
      if (win === false) {
        if (currentLevel > levelsCount) {
          currentBet = initialBet;
          currentLevel = 0;
        } else {
          currentBet = sequenceBaseBet * (1 + 2 * currentLevel);
        }
      } else {
        currentLevel = Math.max(0, currentLevel - 1);
        currentBet = sequenceBaseBet * (1 + 2 * currentLevel);
      }
      consecutiveWins = 0;
    }
    else if (config.mode === ManagementMode.OSCARS_GRIND) {
      const unit = sequenceBaseBet;
      if (win === false) {
        cycleProfit -= currentBet;
      } else {
        cycleProfit += profit;
        if (cycleProfit >= unit) {
          currentBet = unit;
          cycleProfit = 0;
        } else {
          let nextBet = currentBet + unit;
          if (cycleProfit + nextBet > unit) {
            nextBet = Math.max(unit, unit - cycleProfit);
          }
          currentBet = Math.round(nextBet / initialChip) * initialChip;
        }
      }
      currentLevel = Math.max(0, Math.round((currentBet - sequenceBaseBet) / unit));
      consecutiveWins = 0;
    }
    else if (config.mode === ManagementMode.LABOUCHERE) {
      if (labouchereList.length === 0) {
        labouchereList = [sequenceBaseBet, sequenceBaseBet * 2, sequenceBaseBet * 3];
      }
      if (win === true) {
        const expectedWin = labouchereList.length === 1 ? labouchereList[0] : (labouchereList[0] + labouchereList[labouchereList.length - 1]);
        const actualProfit = profit > 0 ? profit : expectedWin;
        
        if (actualProfit >= expectedWin) {
          if (labouchereList.length >= 2) {
            labouchereList.shift();
            labouchereList.pop();
          } else {
            labouchereList = [];
          }
        } else {
          // Partial recovery: reduce outstanding debt elements by actual profit
          let remainingProfit = actualProfit;
          if (labouchereList.length > 0) {
            labouchereList[labouchereList.length - 1] -= remainingProfit;
            if (labouchereList[labouchereList.length - 1] <= 0) {
              const remainder = Math.abs(labouchereList[labouchereList.length - 1]);
              labouchereList.pop();
              if (labouchereList.length > 0) {
                labouchereList[0] -= remainder;
                if (labouchereList[0] <= 0) {
                  labouchereList.shift();
                }
              }
            }
          }
        }
        
        if (labouchereList.length === 0) {
          labouchereList = [sequenceBaseBet, sequenceBaseBet * 2, sequenceBaseBet * 3];
          currentBet = labouchereList[0] + (labouchereList[labouchereList.length - 1] || 0);
        } else {
          currentBet = labouchereList.length === 1 ? labouchereList[0] : (labouchereList[0] + labouchereList[labouchereList.length - 1]);
        }
      } else {
        labouchereList.push(currentBet);
        currentBet = labouchereList[0] + labouchereList[labouchereList.length - 1];
      }
      currentLevel = labouchereList.length;
      consecutiveWins = 0;
    }
    else if (config.mode === ManagementMode.REVERSE_MARTINGALE) {
      if (win === true) {
        consecutiveWins += 1;
        if (consecutiveWins >= levelsCount) {
          currentBet = initialBet;
          consecutiveWins = 0;
          currentLevel = 0;
        } else {
          currentBet = Math.round((currentBet * 2) / initialChip) * initialChip;
          currentLevel = consecutiveWins;
        }
      } else {
        currentBet = initialBet;
        consecutiveWins = 0;
        currentLevel = 0;
      }
    }
    else if (config.mode === ManagementMode.SYSTEM_1326) {
      const cycle = [1, 3, 2, 6];
      if (win === true) {
        consecutiveWins += 1;
        if (consecutiveWins >= 4) {
          consecutiveWins = 0;
          currentBet = sequenceBaseBet * cycle[0];
          currentLevel = 0;
        } else {
          currentBet = sequenceBaseBet * cycle[consecutiveWins];
          currentLevel = consecutiveWins;
        }
      } else {
        consecutiveWins = 0;
        currentBet = sequenceBaseBet * cycle[0];
        currentLevel = 0;
      }
    }
    else if (config.mode === ManagementMode.KELLY_CRITERION) {
      const startingBankroll = (config as any).initialBalance || (sequenceBaseBet * 100);
      const bankrollVal = Math.max(sequenceBaseBet * 10, startingBankroll + runningProfit);
      const f = 0.02;
      currentBet = Math.round((bankrollVal * f) / initialChip) * initialChip;
      currentLevel = 0;
      consecutiveWins = 0;
    }
    else if (config.mode === ManagementMode.STAR_2_2) {
      if (win === false) {
        consecutiveWins = 0;
        currentLevel += 1;
        if (currentLevel > levelsCount) {
          currentLevel = 0;
          currentBet = sequenceBaseBet * star22Seq[0];
          cycleLoss = 0;
        } else {
          currentBet = sequenceBaseBet * (star22Seq[currentLevel] || star22Seq[star22Seq.length - 1]);
        }
      } else {
        if (consecutiveWins === 0) {
          consecutiveWins = 1;
          const seqVal = star22Seq[Math.min(currentLevel, star22Seq.length - 1)] || 1;
          currentBet = sequenceBaseBet * Math.max(1, Math.round(seqVal * 1.5));
        } else {
          consecutiveWins = 0;
          currentLevel = 0;
          currentBet = sequenceBaseBet * star22Seq[0];
          cycleLoss = 0;
        }
      }
    }
    else if (config.mode === ManagementMode.STAR_2_0) {
      const U = sequenceBaseBet;
      
      const prevLevel = state.currentLevel;
      const prevConsecutiveWins = state.consecutiveWins;
      
      if (prevLevel === 0) {
        // Stage 1
        if (win === false) {
          consecutiveWins = 0;
          if (cycleLoss >= 7 * U) {
            currentLevel = 1;
            currentBet = U * (star20Seq[0] || 1);
          } else {
            currentLevel = 0;
            currentBet = U;
          }
        } else {
          if (prevConsecutiveWins === 0) {
            consecutiveWins = 1;
            currentLevel = 0;
            currentBet = U * 2;
          } else {
            consecutiveWins = 0;
            currentLevel = 0;
            currentBet = U;
            cycleLoss = 0;
          }
        }
      } else {
        // Stage 2
        if (win === false) {
          consecutiveWins = 0;
          currentLevel = prevLevel + 1;
          if (currentLevel > levelsCount) {
            currentLevel = 0;
            currentBet = U;
            cycleLoss = 0;
          } else {
            currentBet = U * (star20Seq[currentLevel - 1] || star20Seq[star20Seq.length - 1]);
          }
        } else {
          if (prevConsecutiveWins === 0) {
            consecutiveWins = 1;
            currentLevel = prevLevel;
            const seqVal = star20Seq[Math.min(prevLevel - 1, star20Seq.length - 1)] || 1;
            currentBet = U * seqVal * 2;
          } else {
            consecutiveWins = 0;
            currentLevel = 0;
            currentBet = U;
            cycleLoss = 0;
          }
        }
      }
    }
    else if (config.mode === ManagementMode.DUTCH) {
      if (win === false) {
        currentLevel += 1;
        const levelIdx = Math.floor(currentLevel / 3);
        if (currentLevel > levelsCount) {
          currentLevel = 0;
          currentBet = sequenceBaseBet;
          cycleLoss = 0;
        } else {
          const dutchUnit = 1 + levelIdx * 2;
          currentBet = sequenceBaseBet * dutchUnit;
        }
      } else {
        // Continuous recovery: do not reset level here. 
        // We bet the corresponding amount for the current level until hasRecovered resets us.
        const levelIdx = Math.floor(currentLevel / 3);
        const dutchUnit = 1 + levelIdx * 2;
        currentBet = sequenceBaseBet * dutchUnit;
      }
      consecutiveWins = 0;
    }
    else if (config.mode === ManagementMode.PADOVAN) {
      if (win === false) {
        currentLevel += 1;
        if (currentLevel > levelsCount) {
          currentLevel = 0;
          currentBet = sequenceBaseBet * padovanSequence[0];
          cycleLoss = 0;
        } else {
          const padovanUnit = padovanSequence[currentLevel] || padovanSequence[padovanSequence.length - 1];
          currentBet = sequenceBaseBet * padovanUnit;
        }
      } else {
        // Continuous recovery: do not reset level here.
        const padovanUnit = padovanSequence[Math.min(currentLevel, padovanSequence.length - 1)];
        currentBet = sequenceBaseBet * padovanUnit;
      }
      consecutiveWins = 0;
    }
  }

  const targetProfit = config.targetProfit || 0;
  const stopLoss = config.stopLoss || 0;
  const exceededAllLevels = config.mode !== ManagementMode.NIVEL_FIXO_RECUPERACAO && 
    (currentLevel > levelsCount || (config.mode === ManagementMode.FIBONACCI && (fibIndex || 0) > levelsCount));
  const isAtBaseLevel = currentLevel === 0 && fibIndex === 0;
  if ((targetProfit > 0 && runningProfit >= targetProfit) || exceededAllLevels || (isAtBaseLevel && stopLoss > 0 && runningProfit <= -stopLoss)) {
    currentBet = initialBet;
    currentLevel = 0;
    fibIndex = 0;
    consecutiveWins = 0;
    runningProfit = 0;
    maxRunningProfit = 0;
    labouchereList = [initialBet, initialBet * 2, initialBet * 3];
    cycleProfit = 0;
    cycleLoss = 0;
  }

  // For roulette strategies with multiple positions (N > 1), we must ensure the total bet size is a multiple of initialBet (initialChip * N)
  // to guarantee that the individual position chip sizes are exact multiples of initialChip.
  const roundingUnit = (isBaccarat || N === 1) ? initialChip : initialBet;
  currentBet = Math.max(roundingUnit, Math.round(currentBet / roundingUnit) * roundingUnit);
  if (config.minBet !== undefined && config.minBet > 0) {
    currentBet = Math.max(config.minBet, currentBet);
  }
  if (config.maxBet !== undefined && config.maxBet > 0) {
    currentBet = Math.min(config.maxBet, currentBet);
  }
  currentBet = Number(currentBet.toFixed(2));

  if (config.manualGaleChips && config.manualGaleChips[currentLevel] !== undefined && config.manualGaleChips[currentLevel] !== null && config.manualGaleChips[currentLevel] > 0) {
    currentBet = Number((config.manualGaleChips[currentLevel] * initialChip * N).toFixed(2));
  }

  return {
    currentBetSize: currentBet,
    consecutiveWins,
    currentLevel,
    fibIndex,
    runningProfit,
    maxRunningProfit,
    labouchereList,
    cycleProfit,
    cycleLoss,
    sequenceBaseBet
  };
};

/**
 * Recalculates the recommended bet size dynamically based on the chronological sequence of results in a session.
 * This guarantees offline safety, undo capability, and synchronization between components.
 */
export const getDynamicBetAndState = (
  history: GameResult[],
  config: ManagementConfig,
  positionCount?: number,
  overrideInitialChip?: number,
  targetPayoutRatio?: number
): ProgressionState => {
  const isBaccarat = config.gameTarget === GameType.BACCARAT;
  const N = positionCount || (isBaccarat ? 1 : 11);
  const initialChip = overrideInitialChip !== undefined 
    ? overrideInitialChip 
    : getOptimalChipSize(
        config.initialBet || (isBaccarat ? 0.20 : 0.10),
        N,
        isBaccarat,
        config.minBet,
        config.maxBet,
        config.minChip
      );
  let initialBet = Number((initialChip * N).toFixed(2));
  const levelsCount = config.levels !== undefined && !isNaN(Number(config.levels)) && Number(config.levels) >= 0 ? Number(config.levels) : 10;

  // Include all history items in chronological order (oldest first)
  const chronologicalResults = [...history].reverse();

  // Default state at the start of a session
  let currentBet = initialBet;
  let consecutiveWins = 0;
  let currentLevel = 0; // level/gale index (0 = base bet, 1 = Gale 1, and so on)
  let sequenceBaseBet = initialBet;
  let lastLostBetInActiveSequence = 0;
  let maxBaseBetInActiveSequence = initialBet;

  const fibSequence = generateFibonacciSequence(Math.max(30, levelsCount + 5));
  const padovanSequence = generatePadovanSequence(Math.max(30, levelsCount + 5));
  const star22Seq = [1, 1, 2, 2, 3, 4, 5, 7, 9, 12, 16, 21, 28, 37, 49, 65, 86, 114, 151, 200, 265, 351, 465, 616, 816];
  const star20Seq = [1, 1, 1, 1, 1, 1, 1, 1, 2, 3, 4, 5, 7, 9, 12, 16, 21, 28, 37, 49, 65, 86, 114, 151, 200, 265, 351, 465, 616, 816];
  let fibIndex = 0;
  let runningProfit = 0;
  let maxRunningProfit = 0;
  let labouchereList = [initialBet, initialBet * 2, initialBet * 3];
  let cycleProfit = 0;
  let cycleLoss = 0;

  for (const h of chronologicalResults) {
    let win = h.isWin;
    if (win === undefined && h.profit !== undefined && h.profit < 0) {
      win = false;
    }
    const resStr = String(h.result).toUpperCase().trim();
    const isTie = resStr === 'TIE' || resStr === 'T' || resStr === 'EMPATE' || resStr === 'E';
    const isPush = win === undefined || (h.profit === 0 && (win === undefined || isTie || h.gameType === GameType.BACCARAT));

    if (isPush) {
      // In Baccarat push (Tie on Player/Banker bet), bet is refunded.
      // Progression level and bet size remain unchanged.
      continue;
    }

    const prevLevel = currentLevel;
    if (prevLevel === 0) {
      sequenceBaseBet = h.betSize !== undefined ? h.betSize : currentBet;
      maxBaseBetInActiveSequence = Math.max(maxBaseBetInActiveSequence, h.betSize !== undefined ? h.betSize : currentBet);
      lastLostBetInActiveSequence = 0;
    }
    const prevConsecutiveWins = consecutiveWins;

    runningProfit += h.profit || 0;

    const prevMaxRunningProfit = maxRunningProfit;
    if (runningProfit > maxRunningProfit) {
      maxRunningProfit = runningProfit;
    }

    if (win === false) {
      const lostAmount = h.profit !== undefined && h.profit < 0 ? Math.abs(h.profit) : currentBet;
      cycleLoss += lostAmount;
      if (config.keepAtMaxGale && currentLevel >= levelsCount) {
        currentLevel = levelsCount;
      } else {
        currentLevel += 1;
      }
      lastLostBetInActiveSequence = h.betSize !== undefined ? h.betSize : currentBet;
    } else {
      const wonAmount = h.profit !== undefined && h.profit > 0 ? h.profit : 0;
      if (config.mode === ManagementMode.MARTINGALE) {
        cycleLoss = 0;
        currentLevel = 0;
      } else {
        cycleLoss = Math.max(0, cycleLoss - wonAmount);
        if (cycleLoss === 0) {
          currentLevel = 0;
        }
      }
    }

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
      ManagementMode.STAR_2_0,
      ManagementMode.DUTCH,
      ManagementMode.PADOVAN
    ].includes(config.mode);

    const hasRecovered = isRecoveryMode && (runningProfit >= maxRunningProfit || cycleLoss === 0);

    if (hasRecovered) {
      currentBet = initialBet;
      currentLevel = 0;
      consecutiveWins = 0;
      fibIndex = 0;
      cycleLoss = 0;
      cycleProfit = 0;
      labouchereList = [initialBet, initialBet * 2, initialBet * 3];
      lastLostBetInActiveSequence = 0;
      maxBaseBetInActiveSequence = initialBet;
    } else {
      if (config.mode === ManagementMode.FIXED) {
        currentBet = initialBet;
        currentLevel = 0;
        consecutiveWins = 0;
        cycleLoss = 0;
      }
      
      else if (config.mode === ManagementMode.NIVEL_FIXO_RECUPERACAO) {
        const incrementUnits = 1;
        currentBet = sequenceBaseBet * (1 + currentLevel * incrementUnits);
        consecutiveWins = 0;
      }
      
      else if (config.mode === ManagementMode.SOROS) {
        if (win === true) {
          currentLevel += 1;
          if (currentLevel >= levelsCount) {
            // Soros level target achieved, reset to base
            currentBet = initialBet;
            currentLevel = 0;
          } else {
            // Soros compounds the previous bet with the standard 1:1 profit
            currentBet = Math.round((currentBet * 2) / initialChip) * initialChip;
          }
        } else {
          currentBet = initialBet;
          currentLevel = 0;
        }
        consecutiveWins = 0;
        cycleLoss = 0;
      }
      
      else if (config.mode === ManagementMode.MARTINGALE) {
        if (cycleLoss > 0) {
          if (currentLevel > levelsCount) {
            currentBet = initialBet;
            currentLevel = 0;
            cycleLoss = 0;
          } else {
            const standardMartingaleBet = sequenceBaseBet * Math.pow(config.multiplier || 2, currentLevel);
            const mathematicalRecoveryBet = calculateStrategyTotalRecoveryBet(cycleLoss, N, initialBet, initialChip, isBaccarat, config.multiplier || 2, currentLevel, targetPayoutRatio);
            let finalRecBet = Math.max(standardMartingaleBet, mathematicalRecoveryBet);
            
            if (!isBaccarat && N > 1) {
              const rawChip = finalRecBet / N;
              const roundedUpChip = Math.ceil(Number((rawChip - 0.001).toFixed(4)) / initialChip) * initialChip;
              finalRecBet = Number((roundedUpChip * N).toFixed(2));
            }
            currentBet = finalRecBet;
          }
        } else {
          currentBet = initialBet;
          currentLevel = 0;
        }
        consecutiveWins = 0;
      }
      else if (config.mode === ManagementMode.FIBONACCI) {
        if (win === false) {
          fibIndex = (fibIndex || 0) + 1;
          if (fibIndex > levelsCount || fibIndex >= fibSequence.length) {
            if (config.keepAtMaxGale) {
              fibIndex = Math.min(levelsCount, fibSequence.length - 1);
              currentBet = sequenceBaseBet * fibSequence[fibIndex];
              currentLevel = fibIndex;
            } else {
              fibIndex = 0;
              currentBet = initialBet;
              currentLevel = 0;
            }
          } else {
            currentBet = sequenceBaseBet * fibSequence[fibIndex];
            currentLevel = fibIndex;
          }
        } else {
          fibIndex = Math.max(0, (fibIndex || 0) - 2);
          currentBet = sequenceBaseBet * fibSequence[fibIndex];
          currentLevel = fibIndex;
        }
        consecutiveWins = 0;
      }
      else if (config.mode === ManagementMode.D_ALEMBERT) {
        if (win === false) {
          if (currentLevel > levelsCount) {
            currentBet = initialBet;
            currentLevel = 0;
          } else {
            currentBet = sequenceBaseBet * (1 + currentLevel);
          }
        } else {
          currentLevel = Math.max(0, currentLevel - 1);
          currentBet = sequenceBaseBet * (1 + currentLevel);
        }
        consecutiveWins = 0;
      }
      else if (config.mode === ManagementMode.CYCLIC) {
        const cycle = [1, 2, 4, 8, 16];
        if (win === false) {
          if (currentLevel > levelsCount) {
            currentLevel = 0;
            currentBet = initialBet;
          } else {
            currentBet = sequenceBaseBet * (cycle[currentLevel % cycle.length] || 1);
          }
        } else {
          currentLevel = 0;
          currentBet = initialBet;
        }
        consecutiveWins = 0;
      }
      else if (config.mode === ManagementMode.SISTEMA_2_GANHOS) {
        if (win === false) {
          if (currentLevel > levelsCount) {
            currentBet = initialBet;
            currentLevel = 0;
          } else {
            currentBet = sequenceBaseBet * (1 + currentLevel);
          }
          consecutiveWins = 0;
        } else {
          consecutiveWins += 1;
          if (consecutiveWins >= 2) {
            currentLevel = Math.max(0, currentLevel - 1);
            currentBet = sequenceBaseBet * (1 + currentLevel);
            consecutiveWins = 0;
          }
        }
      }
      else if (config.mode === ManagementMode.SISTEMA_2U_REC1) {
        if (win === false) {
          if (currentLevel > levelsCount) {
            currentBet = initialBet;
            currentLevel = 0;
          } else {
            currentBet = sequenceBaseBet * (1 + 2 * currentLevel);
          }
        } else {
          currentLevel = Math.max(0, currentLevel - 1);
          currentBet = sequenceBaseBet * (1 + 2 * currentLevel);
        }
        consecutiveWins = 0;
      }
      
      else if (config.mode === ManagementMode.OSCARS_GRIND) {
        const unit = sequenceBaseBet;
        if (win === false) {
          cycleProfit -= currentBet;
        } else {
          cycleProfit += h.profit || 0;
          if (cycleProfit >= unit) {
            currentBet = unit;
            cycleProfit = 0;
          } else {
            let nextBet = currentBet + unit;
            if (cycleProfit + nextBet > unit) {
              nextBet = Math.max(unit, unit - cycleProfit);
            }
            currentBet = Math.round(nextBet / initialChip) * initialChip;
          }
        }
        currentLevel = Math.max(0, Math.round((currentBet - sequenceBaseBet) / unit));
        consecutiveWins = 0;
      }
      
      else if (config.mode === ManagementMode.LABOUCHERE) {
        if (labouchereList.length === 0) {
          labouchereList = [sequenceBaseBet, sequenceBaseBet * 2, sequenceBaseBet * 3];
        }
        if (win === true) {
          const expectedWin = labouchereList.length === 1 ? labouchereList[0] : (labouchereList[0] + labouchereList[labouchereList.length - 1]);
          const actualProfit = h.profit !== undefined && h.profit > 0 ? h.profit : expectedWin;
          
          if (actualProfit >= expectedWin) {
            if (labouchereList.length >= 2) {
              labouchereList.shift();
              labouchereList.pop();
            } else {
              labouchereList = [];
            }
          } else {
            // Partial recovery: reduce outstanding debt elements by actual profit
            let remainingProfit = actualProfit;
            if (labouchereList.length > 0) {
              labouchereList[labouchereList.length - 1] -= remainingProfit;
              if (labouchereList[labouchereList.length - 1] <= 0) {
                const remainder = Math.abs(labouchereList[labouchereList.length - 1]);
                labouchereList.pop();
                if (labouchereList.length > 0) {
                  labouchereList[0] -= remainder;
                  if (labouchereList[0] <= 0) {
                    labouchereList.shift();
                  }
                }
              }
            }
          }
          
          if (labouchereList.length === 0) {
            labouchereList = [sequenceBaseBet, sequenceBaseBet * 2, sequenceBaseBet * 3];
            currentBet = labouchereList[0] + (labouchereList[labouchereList.length - 1] || 0);
          } else {
            currentBet = labouchereList.length === 1 ? labouchereList[0] : (labouchereList[0] + labouchereList[labouchereList.length - 1]);
          }
        } else {
          labouchereList.push(currentBet);
          currentBet = labouchereList[0] + labouchereList[labouchereList.length - 1];
        }
        currentLevel = labouchereList.length;
        consecutiveWins = 0;
      }
      
      else if (config.mode === ManagementMode.REVERSE_MARTINGALE) {
        if (win === true) {
          consecutiveWins += 1;
          if (consecutiveWins >= levelsCount) {
            currentBet = initialBet;
            consecutiveWins = 0;
            currentLevel = 0;
          } else {
            currentBet = Math.round((currentBet * 2) / initialChip) * initialChip;
            currentLevel = consecutiveWins;
          }
        } else {
          currentBet = initialBet;
          consecutiveWins = 0;
          currentLevel = 0;
        }
      }
      
      else if (config.mode === ManagementMode.SYSTEM_1326) {
        const cycle = [1, 3, 2, 6];
        if (win === true) {
          consecutiveWins += 1;
          if (consecutiveWins >= 4) {
            consecutiveWins = 0;
            currentBet = sequenceBaseBet * cycle[0];
            currentLevel = 0;
          } else {
            currentBet = sequenceBaseBet * cycle[consecutiveWins];
            currentLevel = consecutiveWins;
          }
        } else {
          consecutiveWins = 0;
          currentBet = sequenceBaseBet * cycle[0];
          currentLevel = 0;
        }
      }
  
      else if (config.mode === ManagementMode.KELLY_CRITERION) {
        const startingBankroll = (config as any).initialBalance || (sequenceBaseBet * 100);
        const bankrollVal = Math.max(sequenceBaseBet * 10, startingBankroll + runningProfit);
        const f = 0.02;
        currentBet = Math.round((bankrollVal * f) / initialChip) * initialChip;
        currentLevel = 0;
        consecutiveWins = 0;
      }
      else if (config.mode === ManagementMode.STAR_2_2) {
        if (win === false) {
          consecutiveWins = 0;
          if (config.keepAtMaxGale && currentLevel >= levelsCount) {
            currentLevel = levelsCount;
            currentBet = sequenceBaseBet * (star22Seq[currentLevel] || star22Seq[star22Seq.length - 1]);
          } else {
            currentLevel += 1;
            if (currentLevel > levelsCount) {
              currentLevel = 0;
              currentBet = sequenceBaseBet * star22Seq[0];
              cycleLoss = 0;
            } else {
              currentBet = sequenceBaseBet * (star22Seq[currentLevel] || star22Seq[star22Seq.length - 1]);
            }
          }
        } else {
          if (consecutiveWins === 0) {
            consecutiveWins = 1;
            const seqVal = star22Seq[Math.min(currentLevel, star22Seq.length - 1)] || 1;
            currentBet = sequenceBaseBet * Math.max(1, Math.round(seqVal * 1.5));
          } else {
            consecutiveWins = 0;
            currentLevel = 0;
            currentBet = sequenceBaseBet * star22Seq[0];
            cycleLoss = 0;
          }
        }
      }
      else if (config.mode === ManagementMode.STAR_2_0) {
        const U = sequenceBaseBet;
        
        if (prevLevel === 0) {
          // Stage 1
          if (win === false) {
            consecutiveWins = 0;
            if (cycleLoss >= 7 * U) {
              currentLevel = 1;
              currentBet = U * (star20Seq[0] || 1);
            } else {
              currentLevel = 0;
              currentBet = U;
            }
          } else {
            if (prevConsecutiveWins === 0) {
              consecutiveWins = 1;
              currentLevel = 0;
              currentBet = U * 2;
            } else {
              consecutiveWins = 0;
              currentLevel = 0;
              currentBet = U;
              cycleLoss = 0;
            }
          }
        } else {
          // Stage 2
          if (win === false) {
            consecutiveWins = 0;
            currentLevel = prevLevel + 1;
            if (currentLevel > levelsCount) {
              if (config.keepAtMaxGale) {
                currentLevel = levelsCount;
                currentBet = U * (star20Seq[currentLevel - 1] || star20Seq[star20Seq.length - 1]);
              } else {
                currentLevel = 0;
                currentBet = U;
                cycleLoss = 0;
              }
            } else {
              currentBet = U * (star20Seq[currentLevel - 1] || star20Seq[star20Seq.length - 1]);
            }
          } else {
            if (prevConsecutiveWins === 0) {
              consecutiveWins = 1;
              currentLevel = prevLevel;
              const seqVal = star20Seq[Math.min(prevLevel - 1, star20Seq.length - 1)] || 1;
              currentBet = U * seqVal * 2;
            } else {
              consecutiveWins = 0;
              currentLevel = 0;
              currentBet = U;
              cycleLoss = 0;
            }
          }
        }
      }
      else if (config.mode === ManagementMode.DUTCH) {
        if (win === false) {
          currentLevel += 1;
          const levelIdx = Math.floor(currentLevel / 3);
          if (currentLevel > levelsCount) {
            if (config.keepAtMaxGale) {
              currentLevel = levelsCount;
              const dutchUnit = 1 + Math.floor(currentLevel / 3) * 2;
              currentBet = sequenceBaseBet * dutchUnit;
            } else {
              currentLevel = 0;
              currentBet = sequenceBaseBet;
              cycleLoss = 0;
            }
          } else {
            const dutchUnit = 1 + levelIdx * 2;
            currentBet = sequenceBaseBet * dutchUnit;
          }
        } else {
          // Continuous recovery: do not reset level here.
          const levelIdx = Math.floor(currentLevel / 3);
          const dutchUnit = 1 + levelIdx * 2;
          currentBet = sequenceBaseBet * dutchUnit;
        }
        consecutiveWins = 0;
      }
      else if (config.mode === ManagementMode.PADOVAN) {
        if (win === false) {
          currentLevel += 1;
          if (currentLevel > levelsCount) {
            if (config.keepAtMaxGale) {
              currentLevel = levelsCount;
              currentBet = sequenceBaseBet * (padovanSequence[currentLevel] || padovanSequence[padovanSequence.length - 1]);
            } else {
              currentLevel = 0;
              currentBet = sequenceBaseBet * padovanSequence[0];
              cycleLoss = 0;
            }
          } else {
            const padovanUnit = padovanSequence[currentLevel] || padovanSequence[padovanSequence.length - 1];
            currentBet = sequenceBaseBet * padovanUnit;
          }
        } else {
          // Continuous recovery: do not reset level here.
          const padovanUnit = padovanSequence[Math.min(currentLevel, padovanSequence.length - 1)];
          currentBet = sequenceBaseBet * padovanUnit;
        }
        consecutiveWins = 0;
      }
    }

    // Session Boundaries (Stop Win / Stop Loss): If the running profit of the active session meets or exceeds
    // the target Profit (Stop Win) or falls to/below the Stop Loss, the session ends.
    // The next result in the chronological history will start a completely fresh session.
    const targetProfit = config.targetProfit || 0;
    const stopLoss = config.stopLoss || 0;
    const shouldResetOnMaxLevel = !config.keepAtMaxGale;
    const exceededAllLevels = shouldResetOnMaxLevel && config.mode !== ManagementMode.NIVEL_FIXO_RECUPERACAO && 
      (currentLevel > levelsCount || (config.mode === ManagementMode.FIBONACCI && (fibIndex || 0) > levelsCount));
    const isAtBaseLevel = currentLevel === 0 && fibIndex === 0;
    if ((targetProfit > 0 && runningProfit >= targetProfit) || exceededAllLevels || (isAtBaseLevel && stopLoss > 0 && runningProfit <= -stopLoss)) {
      currentBet = initialBet;
      currentLevel = 0;
      fibIndex = 0;
      consecutiveWins = 0;
      runningProfit = 0;
      maxRunningProfit = 0;
      labouchereList = [initialBet, initialBet * 2, initialBet * 3];
      cycleProfit = 0;
      cycleLoss = 0;
    }
  }

  // For Labouchere and Oscar's Grind, the bet size is handled via state list manipulation.
  // For all other modes, calculate progression relative to the sequence base bet or manual chip override.
  if (config.mode !== ManagementMode.LABOUCHERE && config.mode !== ManagementMode.OSCARS_GRIND) {
    const hasManual = config.manualGaleChips && config.manualGaleChips[currentLevel] !== undefined && config.manualGaleChips[currentLevel] !== null && config.manualGaleChips[currentLevel] > 0;
    if (hasManual) {
      currentBet = config.manualGaleChips![currentLevel] * initialChip * N;
    } else if (currentLevel === 0) {
      currentBet = initialBet;
    } else if (history.length > 0) {
      // If we have history, we MUST preserve the currentBet calculated inside the loop!
      // This is essential to respect the precise mathematical recovery (mathematicalRecoveryBet),
      // consecutive win modifiers, and other custom progression states.
      // If the loop-calculated currentBet is invalid or missing, we fall back to standard calculation.
      if (currentBet <= 0) {
        sequenceBaseBet = Math.max(sequenceBaseBet, maxBaseBetInActiveSequence);
        let finalUnits = 1.0;
        const mult = config.multiplier || 2;
        switch (config.mode) {
          case ManagementMode.MARTINGALE:
          case ManagementMode.SOROS:
            finalUnits = Math.pow(mult, currentLevel);
            break;
          case ManagementMode.FIBONACCI:
            finalUnits = fibSequence[currentLevel] || fibSequence[fibSequence.length - 1] || 1;
            break;
          case ManagementMode.CYCLIC: {
            const cycle = [1, 2, 4, 8, 16];
            finalUnits = cycle[currentLevel % cycle.length] || 1;
            break;
          }
          case ManagementMode.SISTEMA_2_GANHOS:
          case ManagementMode.D_ALEMBERT:
          case ManagementMode.NIVEL_FIXO_RECUPERACAO:
            finalUnits = 1 + currentLevel;
            break;
          case ManagementMode.SISTEMA_2U_REC1:
            finalUnits = 1 + 2 * currentLevel;
            break;
          case ManagementMode.STAR_2_2:
            finalUnits = currentLevel < star22Seq.length ? star22Seq[currentLevel] : star22Seq[star22Seq.length - 1];
            break;
          case ManagementMode.STAR_2_0:
            finalUnits = currentLevel < star20Seq.length ? star20Seq[currentLevel] : star20Seq[star20Seq.length - 1];
            break;
          case ManagementMode.DUTCH: {
            const dutchIdx = Math.floor(currentLevel / 3);
            finalUnits = 1 + dutchIdx * 2;
            break;
          }
          case ManagementMode.PADOVAN:
            finalUnits = currentLevel < padovanSequence.length ? padovanSequence[currentLevel] : padovanSequence[padovanSequence.length - 1];
            break;
          case ManagementMode.FIXED:
          default:
            finalUnits = 1.0;
            break;
        }

        if (config.mode === ManagementMode.MARTINGALE && lastLostBetInActiveSequence > 0) {
          currentBet = lastLostBetInActiveSequence * mult;
        } else {
          currentBet = sequenceBaseBet * finalUnits;
        }
      }
    } else {
      // Keep sequence base bet at least at the highest base bet seen in the active sequence
      sequenceBaseBet = Math.max(sequenceBaseBet, maxBaseBetInActiveSequence);

      let finalUnits = 1.0;
      const mult = config.multiplier || 2;
      switch (config.mode) {
        case ManagementMode.MARTINGALE:
        case ManagementMode.SOROS:
          finalUnits = Math.pow(mult, currentLevel);
          break;
        case ManagementMode.FIBONACCI:
          finalUnits = fibSequence[currentLevel] || fibSequence[fibSequence.length - 1] || 1;
          break;
        case ManagementMode.CYCLIC: {
          const cycle = [1, 2, 4, 8, 16];
          finalUnits = cycle[currentLevel % cycle.length] || 1;
          break;
        }
        case ManagementMode.SISTEMA_2_GANHOS:
        case ManagementMode.D_ALEMBERT:
        case ManagementMode.NIVEL_FIXO_RECUPERACAO:
          finalUnits = 1 + currentLevel;
          break;
        case ManagementMode.SISTEMA_2U_REC1:
          finalUnits = 1 + 2 * currentLevel;
          break;
        case ManagementMode.STAR_2_2:
          finalUnits = currentLevel < star22Seq.length ? star22Seq[currentLevel] : star22Seq[star22Seq.length - 1];
          break;
        case ManagementMode.STAR_2_0:
          finalUnits = currentLevel < star20Seq.length ? star20Seq[currentLevel] : star20Seq[star20Seq.length - 1];
          break;
        case ManagementMode.DUTCH: {
          const dutchIdx = Math.floor(currentLevel / 3);
          finalUnits = 1 + dutchIdx * 2;
          break;
        }
        case ManagementMode.PADOVAN:
          finalUnits = currentLevel < padovanSequence.length ? padovanSequence[currentLevel] : padovanSequence[padovanSequence.length - 1];
          break;
        case ManagementMode.FIXED:
        default:
          finalUnits = 1.0;
          break;
      }

      // Martingale specifically: always double the previous bet size in the active sequence to guarantee correct recovery
      if (config.mode === ManagementMode.MARTINGALE && lastLostBetInActiveSequence > 0) {
        currentBet = lastLostBetInActiveSequence * mult;
      } else {
        currentBet = sequenceBaseBet * finalUnits;
      }
    }
  }

  // Ensure correct rounding relative to active layout
  // Improvement: If N > 1, the base rounding unit should be initialChip rather than initialBet
  // for all recovery modes, so we don't cause progression stagnation.
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
    ManagementMode.STAR_2_0,
    ManagementMode.DUTCH,
    ManagementMode.PADOVAN
  ].includes(config.mode);

  const roundingUnit = (isBaccarat || N === 1 || isRecoveryMode) ? initialChip : initialBet;
  currentBet = Math.max(roundingUnit, Math.round(currentBet / roundingUnit) * roundingUnit);

  if (isRecoveryMode && currentLevel > 0 && N > 1) {
    const chipStep = overrideInitialChip !== undefined ? overrideInitialChip : (config.minChip || 0.10);
    const rawIndividualBet = currentBet / N;
    // Round UP the individual chip to ensure it covers the recovery requirement or matches approximately
    const individualChip = Math.ceil(Number(rawIndividualBet.toFixed(4)) / chipStep) * chipStep;
    currentBet = Number((individualChip * N).toFixed(2));
  }

  if (config.minBet !== undefined && config.minBet > 0) {
    currentBet = Math.max(config.minBet, currentBet);
  }
  if (config.maxBet !== undefined && config.maxBet > 0) {
    currentBet = Math.min(config.maxBet, currentBet);
  }
  currentBet = Number(currentBet.toFixed(2));

  return {
    currentBetSize: currentBet,
    consecutiveWins,
    currentLevel,
    fibIndex,
    runningProfit,
    maxRunningProfit,
    labouchereList,
    cycleProfit,
    cycleLoss,
    sequenceBaseBet
  };
};

/**
 * Calculates the proportional coverage bet size for individual positions in a group (e.g. Pleno + neighbors).
 * It divides the total current bet size (stake) by the number of selected positions (e.g., 11 for Pleno + 5 vizinhos),
 * and ensures that the total cost of all individual bets does not exceed the calculated stake.
 *
 * @param currentBetSize - The total calculated stake for the round.
 * @param positionCount - The number of selected positions.
 * @param step - The minimum chip value/step size (default: 0.10).
 * @returns An object with the individual bet size and the actual total cost.
 */
export const calculateProportionalCoverage = (
  currentBetSize: number,
  positionCount: number,
  step: number = 0.10
): { individualBetSize: number; actualTotalCost: number } => {
  if (positionCount <= 0) {
    return { individualBetSize: currentBetSize, actualTotalCost: currentBetSize };
  }

  // Ensure step is positive and non-zero to avoid division by zero or infinite decrement loop
  const safeStep = step <= 0 || isNaN(step) ? 0.10 : step;

  // Raw division of stake by positions count
  const rawIndividualBet = currentBetSize / positionCount;

  // Round down to the nearest step/chip increment with a tiny epsilon (0.005) 
  // to prevent float precision division errors from flooring a correct bet down (e.g. 4.9999 to 4.00)
  let individualBetSize = Math.floor((rawIndividualBet + 0.005) / safeStep) * safeStep;

  // Format to 2 decimal places to avoid floating point precision issues
  individualBetSize = Number(individualBetSize.toFixed(2));

  // Ensure individual bet is at least the step size (safeStep). If the calculated total bet is too small to cover 
  // all positions with at least 1 minimum chip, we must still bet at least 1 minimum chip per position.
  if (individualBetSize < safeStep) {
    individualBetSize = safeStep;
  }

  // Calculate actual total cost
  let actualTotalCost = individualBetSize * positionCount;

  // Strict fallback loop: if actualTotalCost still exceeds currentBetSize (due to float precision or edge cases),
  // we decrement individualBetSize by step until the total cost is strictly less than or equal to currentBetSize,
  // but we never go below the minimum chip size (safeStep) if positionCount > 0.
  while (Number(actualTotalCost.toFixed(2)) > currentBetSize && individualBetSize > safeStep) {
    individualBetSize = Math.max(safeStep, individualBetSize - safeStep);
    actualTotalCost = individualBetSize * positionCount;
  }

  // Final formatting to 2 decimal places
  individualBetSize = Number(individualBetSize.toFixed(2));
  actualTotalCost = Number(actualTotalCost.toFixed(2));

  return {
    individualBetSize,
    actualTotalCost
  };
};

export interface StopLossStepDetail {
  step: number;
  units: number;
  chipValue: number;
  mainBet: number;
  protectionBet: number;
  totalStepBet: number;
  accumulatedLoss: number;
}

export interface StopLossSequenceCalculation {
  baseChip: number;
  positionCount: number;
  lossCount: number;
  totalStopLossRequired: number;
  steps: StopLossStepDetail[];
}

export const calculateStopLossForLossSequence = (
  config: ManagementConfig,
  baseChip: number,
  positionCount: number,
  lossCount: number
): StopLossSequenceCalculation => {
  const isBaccarat = config.gameTarget === GameType.BACCARAT;
  const N = Math.max(1, positionCount);
  const chip = baseChip > 0 ? baseChip : 0.10;
  const multiplier = config.multiplier || 2;
  const N_losses = Math.max(1, lossCount);

  const fibSequence = generateFibonacciSequence(Math.max(30, N_losses + 5));
  const padovanSequence = generatePadovanSequence(Math.max(30, N_losses + 5));
  const star22Seq = [1, 1, 2, 2, 3, 4, 5, 7, 9, 12, 16, 21, 28, 37, 49, 65, 86, 114, 151, 200, 265, 351, 465, 616, 816];
  const star20Seq = [1, 1, 1, 1, 1, 1, 1, 1, 2, 3, 4, 5, 7, 9, 12, 16, 21, 28, 37, 49, 65, 86, 114, 151, 200, 265, 351, 465, 616, 816];
  let labList = (config.customLabouchereSequence && config.customLabouchereSequence.length > 0)
    ? [...config.customLabouchereSequence]
    : [1, 2, 3];

  let accumulatedLoss = 0;
  const steps: StopLossStepDetail[] = [];

  for (let i = 1; i <= N_losses; i++) {
    let units = 1.0;

    const hasManual = config.manualGaleChips && config.manualGaleChips[i - 1] !== undefined && config.manualGaleChips[i - 1] !== null && config.manualGaleChips[i - 1] > 0;

    if (hasManual) {
      units = config.manualGaleChips![i - 1];
    } else {
      switch (config.mode) {
        case ManagementMode.MARTINGALE:
          units = Math.pow(multiplier, i - 1);
          break;
        case ManagementMode.FIBONACCI:
          units = fibSequence[i - 1] || fibSequence[fibSequence.length - 1];
          break;
        case ManagementMode.FIXED:
        case ManagementMode.OSCARS_GRIND:
        case ManagementMode.REVERSE_MARTINGALE:
        case ManagementMode.SYSTEM_1326:
        case ManagementMode.KELLY_CRITERION:
          units = 1.0;
          break;
        case ManagementMode.CYCLIC: {
          const cycle = [1, 2, 4, 8, 16];
          units = cycle[(i - 1) % cycle.length] || 1;
          break;
        }
        case ManagementMode.SISTEMA_2_GANHOS:
        case ManagementMode.D_ALEMBERT:
        case ManagementMode.NIVEL_FIXO_RECUPERACAO:
          units = i;
          break;
        case ManagementMode.SISTEMA_2U_REC1:
          units = 1 + 2 * (i - 1);
          break;
        case ManagementMode.STAR_2_2: {
          units = (i - 1) < star22Seq.length ? star22Seq[i - 1] : star22Seq[star22Seq.length - 1];
          break;
        }
        case ManagementMode.STAR_2_0: {
          units = (i - 1) < star20Seq.length ? star20Seq[i - 1] : star20Seq[star20Seq.length - 1];
          break;
        }
        case ManagementMode.DUTCH: {
          const dutchIdx = Math.floor((i - 1) / 3);
          units = 1 + dutchIdx * 2;
          break;
        }
        case ManagementMode.PADOVAN: {
          units = (i - 1) < padovanSequence.length ? padovanSequence[i - 1] : padovanSequence[padovanSequence.length - 1];
          break;
        }
        case ManagementMode.SOROS:
          units = Math.pow(multiplier, i - 1);
          break;
        case ManagementMode.LABOUCHERE: {
          if (labList.length === 0) labList = [1, 2, 3];
          units = labList.length === 1 ? labList[0] : labList[0] + labList[labList.length - 1];
          labList.push(units);
          break;
        }
        default:
          units = i;
          break;
      }
    }

    const levelChipValue = Number((chip * units).toFixed(2));
    const mainBet = Number((levelChipValue * N).toFixed(2));
    
    let protectionBet = 0;
    if (!isBaccarat) {
      if (config.coverZero) {
        protectionBet = Number((levelChipValue * (config.unitsZero !== undefined ? config.unitsZero : 1.0)).toFixed(2));
      }
    } else if (isBaccarat && config.coverTie) {
      protectionBet = Number((levelChipValue * (config.unitsTier !== undefined ? config.unitsTier : 1.0)).toFixed(2));
    }

    const totalStepBet = Number((mainBet + protectionBet).toFixed(2));
    accumulatedLoss = Number((accumulatedLoss + totalStepBet).toFixed(2));

    steps.push({
      step: i,
      units: Number(units.toFixed(2)),
      chipValue: levelChipValue,
      mainBet,
      protectionBet,
      totalStepBet,
      accumulatedLoss
    });
  }

  return {
    baseChip: chip,
    positionCount: N,
    lossCount: N_losses,
    totalStopLossRequired: accumulatedLoss,
    steps
  };
};

export const getOverrideChipForSignal = (sig: any, config: ManagementConfig): number | undefined => {
  if (!config) return undefined;
  if (!sig) return undefined;
  if (config.gameTarget === GameType.BACCARAT || sig.gameType === GameType.BACCARAT) return undefined;
  
  const baseChip = config.minChip && config.minChip > 0 ? config.minChip : (config.initialBet && config.initialBet > 0 ? config.initialBet : 0.10);

  if (!config.useCategoryChips) {
    return baseChip;
  }

  // 1. TPA84
  if (sig.isTpa84) {
    return config.chipTpa84 || baseChip;
  }
  
  // 2. S84 / Terminals (usually 11 numbers)
  if (sig.isRacetrack || sig.strategyId?.toLowerCase().includes('s84') || (sig.entryNumbers && sig.entryNumbers.length === 11)) {
    return config.chipS84 || baseChip;
  }
  
  // 3. Regions (Voisins, Orphelins, Tiers, Zero)
  const regions = ['voisins', 'tiers', 'orphelins', 'zero_spiel'];
  if (regions.some(r => sig.patternName?.toLowerCase().includes(r) || sig.entry?.toLowerCase().includes(r))) {
    return config.chipRegions || baseChip;
  }
  
  // 4. Sectors of the table (Dúzias, Colunas, High/Low, Even/Odd, Red/Black)
  const sectors = ['duzia', 'coluna', 'vermelho', 'preto', 'par', 'impar', 'high', 'low', 'maior', 'menor'];
  if (sectors.some(s => sig.patternName?.toLowerCase().includes(s) || sig.entry?.toLowerCase().includes(s))) {
    return config.chipSectors || baseChip;
  }
  
  // 5. Custom Racetrack Neighbors
  if (sig.isRacetrackNeighbor || sig.patternName?.toLowerCase().includes('vizinho') || sig.patternName?.toLowerCase().includes('neighbor')) {
    return config.chipRacetrack || baseChip;
  }
  
  return baseChip;
};

export const getPositionCountForSignal = (sig: any): number => {
  if (!sig) return 11;

  if (sig.gameType === GameType.BACCARAT) {
    return 1;
  }

  const ent = sig.entry ? String(sig.entry).toLowerCase().trim() : '';
  const pat = sig.patternName ? String(sig.patternName).toLowerCase().trim() : '';
  const cat = sig.category ? String(sig.category).toLowerCase().trim() : '';
  const desc = sig.description ? String(sig.description).toLowerCase().trim() : '';
  const stratId = sig.strategyId ? String(sig.strategyId).toLowerCase().trim() : '';

  // Prioridade Absoluta: Estratégias de Terminais (S84, TPA84, Angel84, Plenos)
  if (sig.isTpa84 || stratId.includes('tpa84') || pat.includes('tpa84')) {
    return sig.unitsRequired || (sig.entryNumbers && sig.entryNumbers.length) || 24;
  }
  if (sig.isAngel84 || stratId.includes('angel84') || pat.includes('angel84')) {
    return sig.unitsRequired || (sig.entryNumbers && sig.entryNumbers.length) || 24;
  }
  if (
    sig.isRacetrack || 
    stratId.includes('s84') || 
    pat.includes('s84') || 
    ent.includes('terminal') || 
    pat.includes('terminal') || 
    cat.includes('terminal')
  ) {
    if (sig.entryNumbers && sig.entryNumbers.length > 0) {
      return sig.entryNumbers.length;
    }
    return sig.unitsRequired || 11;
  }

  // Generic dynamic position count for any Hybrid strategy (Mesa Híbrida)
  const isHybrid = ent.includes('híbrida') || ent.includes('hybrid') || ent.includes('hibrida') ||
                   stratId.includes('hybrid') || stratId.includes('híbrida') || stratId.includes('hibrida');

  if (isHybrid) {
    if (sig.unitsRequired !== undefined && sig.unitsRequired > 0) {
      return sig.unitsRequired;
    }
    if (sig.rules?.bets && Array.isArray(sig.rules.bets)) {
      return sig.rules.bets.reduce((acc: number, b: any) => acc + (b.amount || 1), 0);
    }
    return 8; // fallback
  }

  // 1. Regional Sectors (European racetrack bets: Voisins = 9 chips, Tiers = 6 chips, Orphelins = 5 chips, Zero Spiel = 4 chips)
  const sector = detectRegionalSector(sig);
  if (sector && REGIONAL_SECTOR_UNITS[sector]) {
    return REGIONAL_SECTOR_UNITS[sector];
  }

  // 1. Racetrack Regions / Sectors (French bets: Voisins, Tiers, Orphelins, Zero Spiel)
  // Voisins du Zéro covers 17 numbers with 9 chips
  // Tiers du Cylindre covers 12 numbers with 6 chips
  // Orphelins covers 8 numbers with 5 chips
  // Zero Spiel covers 7 numbers with 4 chips
  const isVoisins = ent.includes('voisins') || ent.includes('vizinhos de zero') || ent.includes('vizinhos do zero') || pat.includes('voisins') || pat.includes('vizinhos de zero') || pat.includes('vizinhos do zero') || desc.includes('voisins') || desc.includes('vizinhos de zero') || desc.includes('vizinhos do zero');
  const isTiers = ent.includes('tiers') || ent.includes('terço') || ent.includes('terco') || pat.includes('tiers') || pat.includes('terço') || pat.includes('terco') || desc.includes('tiers') || desc.includes('terço') || desc.includes('terco');
  const isOrphelins = ent.includes('orphelins') || ent.includes('órfãos') || ent.includes('orfaos') || pat.includes('orphelins') || pat.includes('órfãos') || pat.includes('orfaos') || desc.includes('orphelins') || desc.includes('órfãos') || desc.includes('orfaos');
  const isZeroSpiel = ent.includes('zero spiel') || ent.includes('jogo do zero') || ent.includes('jogo de zero') || ent.includes('du zero') || pat.includes('zero spiel') || pat.includes('jogo do zero') || pat.includes('jogo de zero') || pat.includes('du zero') || desc.includes('zero spiel') || desc.includes('jogo do zero') || desc.includes('jogo de zero') || desc.includes('du zero');

  if (isVoisins) {
    return 9;
  }
  if (isTiers) {
    return 6;
  }
  if (isOrphelins) {
    return 5;
  }
  if (isZeroSpiel) {
    return 4;
  }

  // 2. External Bets / Traditional Table Bets (Red, Black, Even, Odd, High, Low, Dozens, Columns, etc.)
  // These are single bet spots on the layout, costing exactly 1 chip.
  const isExternalOrSimple = 
    ent === 'odd' || ent === 'even' || ent === 'red' || ent === 'black' || ent === 'high' || ent === 'low' ||
    ent === 'ímpar' || ent === 'impar' || ent === 'par' || ent === 'vermelho' || ent === 'preto' ||
    ent === 'maior' || ent === 'menor' || ent === 'player' || ent === 'banker' ||
    ent === 'jogador' || ent === 'banca' || ent === 'empate' ||
    ent.includes('red') || ent.includes('black') ||
    ent.includes('vermelho') || ent.includes('preto') || 
    ent.includes('par') || ent.includes('impar') || ent.includes('ímpar') || 
    ent.includes('even') || ent.includes('odd') || 
    ent.includes('high') || ent.includes('low') || 
    ent.includes('maior') || ent.includes('menor') ||
    ent.includes('dúzia') || ent.includes('duzia') || 
    ent.includes('coluna') || ent.includes('1-12') || ent.includes('13-24') || ent.includes('25-36') ||
    ent.includes('player') || ent.includes('banker') ||
    ent.includes('jogador') || ent.includes('banca') || ent.includes('empate') ||
    cat.includes('externa') || cat.includes('dozen') || cat.includes('coluna') || cat.includes('dúzia');

  if (isExternalOrSimple) {
    return 1;
  }

  // 3. Numbers and Neighbors / Terminals and Neighbors / Racetrack Neighbors
  // Pleno and neighbors (e.g. Pleno 19 + 5 Vizinhos = 11 numbers covered, costing 11 chips)
  if (ent.includes('pleno')) {
    if (sig.entryNumbers && sig.entryNumbers.length > 0) {
      return sig.entryNumbers.length;
    }
    return 11; // Standard "Pleno + 5 neighbors" = 11 numbers/chips
  }

  // Terminals (Terminais) and neighbors
  if (ent.includes('terminal') || pat.includes('terminal') || cat.includes('terminal')) {
    if (sig.entryNumbers && sig.entryNumbers.length > 0) {
      return sig.entryNumbers.length;
    }
    if (stratId.includes('s84') || pat.includes('s84')) {
      return 11; // Terminal S84 covers 11 numbers
    }
    return 4; // Standard terminal covers 4 numbers on average (e.g. 3, 13, 23, 33)
  }

  // Racetrack neighbors
  if (sig.isRacetrackNeighbor || pat.includes('neighbor') || pat.includes('vizinho')) {
    if (sig.entryNumbers && sig.entryNumbers.length > 0) {
      return sig.entryNumbers.length;
    }
    return 5;
  }

  if (sig.entryNumbers && sig.entryNumbers.length > 0) {
    return sig.entryNumbers.length;
  }

  if (sig.unitsRequired !== undefined && sig.unitsRequired > 0) {
    return sig.unitsRequired;
  }

  // Fallbacks for layout positions (Split, Street, Corner, Line) costing 1 chip
  if (ent.includes('dividida') || ent.includes('split')) {
    return 1;
  }
  if (ent.includes('rua') || ent.includes('street')) {
    return 1;
  }
  if (ent.includes('canto') || ent.includes('corner')) {
    return 1;
  }
  if (ent.includes('linha') || ent.includes('line') || ent.includes('seisena')) {
    return 1;
  }

  return 11;
};

export const calculateRacetrackPayoutMultiplier = (numberDrawn: number, sig: any): { isRacetrack: boolean; multiplier: number } => {
  if (!sig || sig.gameType === GameType.BACCARAT) {
    return { isRacetrack: false, multiplier: 0 };
  }

  const ent = sig.entry ? String(sig.entry).toLowerCase().trim() : '';
  const pat = sig.patternName ? String(sig.patternName).toLowerCase().trim() : '';
  const desc = sig.description ? String(sig.description).toLowerCase().trim() : '';

  const isVoisins = ent.includes('voisins') || ent.includes('vizinhos de zero') || ent.includes('vizinhos do zero') || pat.includes('voisins') || pat.includes('vizinhos de zero') || pat.includes('vizinhos do zero') || desc.includes('voisins') || desc.includes('vizinhos de zero') || desc.includes('vizinhos do zero');
  const isTiers = ent.includes('tiers') || ent.includes('terço') || ent.includes('terco') || pat.includes('tiers') || pat.includes('terço') || pat.includes('terco') || desc.includes('tiers') || desc.includes('terço') || desc.includes('terco');
  const isOrphelins = ent.includes('orphelins') || ent.includes('órfãos') || ent.includes('orfaos') || pat.includes('orphelins') || pat.includes('órfãos') || pat.includes('orfaos') || desc.includes('orphelins') || desc.includes('órfãos') || desc.includes('orfaos');
  const isZeroSpiel = ent.includes('zero spiel') || ent.includes('jogo do zero') || ent.includes('jogo de zero') || ent.includes('du zero') || pat.includes('zero spiel') || pat.includes('jogo do zero') || pat.includes('jogo de zero') || pat.includes('du zero') || desc.includes('zero spiel') || desc.includes('jogo do zero') || desc.includes('jogo de zero') || desc.includes('du zero');

  if (isVoisins) {
    const voisinsNumbers = [0, 2, 3, 4, 7, 12, 15, 18, 19, 21, 22, 25, 26, 28, 29, 32, 35];
    if (!voisinsNumbers.includes(numberDrawn)) {
      return { isRacetrack: true, multiplier: 0 };
    }
    // Trio 0, 2, 3 pays 11:1 (returning 12x per chip, we put 2 chips here, so total payout is 24x the individual bet size)
    if ([0, 2, 3].includes(numberDrawn)) {
      return { isRacetrack: true, multiplier: 24 };
    }
    // Corner 25, 26, 28, 29 pays 8:1 (returning 9x per chip, we put 2 chips here, so total payout is 18x)
    if ([25, 26, 28, 29].includes(numberDrawn)) {
      return { isRacetrack: true, multiplier: 18 };
    }
    // Splits 4/7, 12/15, 18/21, 19/22, 32/35 pay 17:1 (returning 18x)
    return { isRacetrack: true, multiplier: 18 };
  }

  if (isTiers) {
    const voisinsTiers = [27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33];
    if (!voisinsTiers.includes(numberDrawn)) {
      return { isRacetrack: true, multiplier: 0 };
    }
    // All bets are split bets (cavalos), returning 18x
    return { isRacetrack: true, multiplier: 18 };
  }

  if (isOrphelins) {
    const orphelinsNumbers = [1, 6, 9, 14, 17, 20, 31, 34];
    if (!orphelinsNumbers.includes(numberDrawn)) {
      return { isRacetrack: true, multiplier: 0 };
    }
    // Pleno 1 pays 35:1 (returning 36x)
    if (numberDrawn === 1) {
      return { isRacetrack: true, multiplier: 36 };
    }
    // Number 17 is in both splits (14/17 and 17/20), paying 18x twice (returning 36x)
    if (numberDrawn === 17) {
      return { isRacetrack: true, multiplier: 36 };
    }
    // Splits 6/9, 14/17, 17/20, 31/34 pay 17:1 (returning 18x)
    return { isRacetrack: true, multiplier: 18 };
  }

  if (isZeroSpiel) {
    const zeroSpielNumbers = [12, 35, 3, 26, 0, 32, 15];
    if (!zeroSpielNumbers.includes(numberDrawn)) {
      return { isRacetrack: true, multiplier: 0 };
    }
    // Pleno 26 pays 35:1 (returning 36x)
    if (numberDrawn === 26) {
      return { isRacetrack: true, multiplier: 36 };
    }
    // Splits 0/3, 12/15, 32/35 pay 17:1 (returning 18x)
    return { isRacetrack: true, multiplier: 18 };
  }

  return { isRacetrack: false, multiplier: 0 };
};



