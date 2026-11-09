export enum GameType {
  ROULETTE = 'roulette',
  BACCARAT = 'baccarat'
}

export interface GameResult {
  id: string;
  gameType: GameType;
  result: any; // string for Baccarat/FB/BacBo, number for Roulette
  timestamp: number;
  sessionId: string;
  strategyId?: string;
  metadata: any;
  analysis?: any;
  score?: number;
  profit?: number;
  volatility?: number;
  risk?: number;
  signal?: string;
  signalType?: string;
  isWin?: boolean;
  isSimulation?: boolean;
  betSize?: number;
  positionCount?: number;
}

export interface Bankroll {
  balance: number;
  initialBalance: number;
  currency: string;
  profit: number;
  drawdown: number;
  drawdownLimit: number;
  stopWin: number;
  stopLoss: number;
  maxDailyRounds?: number;
}

export enum ManagementMode {
  MARTINGALE = 'martingale',
  SOROS = 'soros',
  FIBONACCI = 'fibonacci',
  FIXED = 'fixed',
  CYCLIC = 'cyclic',
  SISTEMA_2_GANHOS = 'sistema_2_ganhos',
  SISTEMA_2U_REC1 = 'sistema_2u_rec1',
  D_ALEMBERT = 'd_alembert',
  OSCARS_GRIND = 'oscars_grind',
  LABOUCHERE = 'labouchere',
  REVERSE_MARTINGALE = 'reverse_martingale',
  SYSTEM_1326 = 'system_1326',
  KELLY_CRITERION = 'kelly_criterion',
  NIVEL_FIXO_RECUPERACAO = 'nivel_fixo_recuperacao',
  STAR_2_2 = 'star_2_2',
  STAR_2_0 = 'star_2_0',
  DUTCH = 'dutch',
  PADOVAN = 'padovan'
}

export enum RiskProfile {
  CONSERVATIVE = 'conservative',
  MODERATE = 'moderate',
  AGGRESSIVE = 'aggressive',
  CUSTOM = 'custom'
}

export interface ManagementConfig {
  mode: ManagementMode;
  profile: RiskProfile;
  initialBet: number;
  levels: number;
  multiplier: number;
  targetProfit?: number;
  stopLoss?: number;
  gameTarget?: GameType;
  coverZero?: boolean;
  coverTie?: boolean;
  minBet?: number;
  maxBet?: number;
  minChip?: number;
  chipS84?: number;
  chipTpa84?: number;
  chipRegions?: number;
  chipSectors?: number;
  chipRacetrack?: number;
  useCategoryChips?: boolean;
  manualGaleChips?: number[];
  customLabouchereSequence?: number[];
  unitsZero?: number;
  unitsTier?: number;
  keepAtMaxGale?: boolean;
  sniperModeEnabled?: boolean;
  entropyFilterEnabled?: boolean;
}

export interface Session {
  id: string;
  gameType: GameType;
  startTime: number;
  endTime?: number;
  initialBalance: number;
  currentBalance: number;
  profit: number;
  history: GameResult[];
  status: 'active' | 'finished';
}

export interface Strategy {
  id: string;
  name: string;
  gameType: GameType;
  rules: any;
  isActive: boolean;
  isSystem?: boolean;
  management?: ManagementConfig;
  performance: {
    winRate: number;
    totalEntries: number;
    wins: number;
    losses: number;
    roi: number;
    maxDrawdown: number;
  };
}

export enum VolatilityLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  EXTREME = 'extreme'
}

export enum SignalType {
  STRONG = 'strong',
  MODERATE = 'moderate',
  RISKY = 'risky',
  NO_ENTRY = 'no_entry'
}
