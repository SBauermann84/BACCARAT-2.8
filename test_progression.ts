import { getDynamicBetAndState } from './src/engines/progressionEngine';
import { GameType, ManagementMode, RiskProfile } from './src/types';

const config = {
  mode: ManagementMode.NIVEL_FIXO_RECUPERACAO,
  profile: RiskProfile.CUSTOM,
  initialBet: 11,
  levels: 40,
  multiplier: 2,
  targetProfit: 1000,
  stopLoss: 5000,
  gameTarget: GameType.ROULETTE,
  coverZero: false,
  coverTie: false,
  minBet: 0.10,
  maxBet: 5000,
  minChip: 1.00
};

const history: any[] = [];

console.log("Starting simulation of 10 losses:");
for (let i = 1; i <= 10; i++) {
  // Push a loss
  history.push({
    id: `loss-${i}`,
    gameType: GameType.ROULETTE,
    result: 1,
    timestamp: Date.now() - (10 - i) * 1000,
    isWin: false,
    profit: -config.initialBet * (i) // arbitrary negative profit
  });

  const state = getDynamicBetAndState(history, config, 11);
  console.log(`Step ${i} (G${state.currentLevel}): bet size = ${state.currentBetSize}, individual chip = ${state.currentBetSize / 11}`);
}
