import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TrendingUp, AlertTriangle, CheckCircle2, Zap, Info, HelpCircle, BookOpen, Lightbulb } from 'lucide-react';
import { SignalType, Strategy } from '../types';
import { COLOR_MAP } from '../constants';
import { useAppStore } from '../store/useAppStore';
import { getStrategyExplanation } from '../engines/dynamicStrategyEngine';
import { useTranslation } from '../locales/translations';
import { getPositionCountForSignal } from '../engines/progressionEngine';

interface SignalsPanelProps {
  signals: any[];
  winRate?: number;
  strategies?: Strategy[];
  currentGaleLevel?: number;
  sequenceBaseBet?: number;
}

const getGaleChipMultiplier = (level: number, management: any): number => {
  if (level <= 0) return 1;
  const mode = management?.mode;
  const multiplier = management?.multiplier || 2;
  const manualChips = management?.manualGaleChips;
  if (manualChips && manualChips[level] !== undefined && manualChips[level] !== null && manualChips[level] > 0) {
    return manualChips[level];
  }

  const star22Seq = [1, 1, 2, 2, 3, 4, 5, 7, 9, 12, 16, 21, 28, 37, 49, 65, 86, 114, 151, 200, 265, 351, 465, 616, 816];
  const star20Seq = [1, 1, 1, 1, 1, 1, 1, 1, 2, 3, 4, 5, 7, 9, 12, 16, 21, 28, 37, 49, 65, 86, 114, 151, 200, 265, 351, 465, 616, 816];
  const fibSequence = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765, 10946, 17711, 28657, 46368, 75025, 121393, 196418, 317811, 514229, 832040, 1346269, 2178309];
  const padovanSequence = [1, 1, 1, 2, 2, 3, 4, 5, 7, 9, 12, 16, 21, 28, 37, 49, 65, 86, 114, 151, 200, 265, 351, 465, 616, 816];

  switch (mode) {
    case 'martingale':
    case 'soros':
      return Math.pow(multiplier, level);
    case 'fibonacci':
      return fibSequence[level] || fibSequence[fibSequence.length - 1] || 1;
    case 'cyclic': {
      const cycle = [1, 2, 4, 8, 16];
      return cycle[level % cycle.length] || 1;
    }
    case 'sistema_2_ganhos':
    case 'd_alembert':
    case 'nivel_fixo_recuperacao':
      return 1 + level;
    case 'sistema_2u_rec1':
      return 1 + 2 * level;
    case 'star_2_2':
      return level < star22Seq.length ? star22Seq[level] : star22Seq[star22Seq.length - 1];
    case 'star_2_0':
      return level < star20Seq.length ? star20Seq[level] : star20Seq[star20Seq.length - 1];
    case 'dutch': {
      const dutchIdx = Math.floor(level / 3);
      return 1 + dutchIdx * 2;
    }
    case 'padovan':
      return level < padovanSequence.length ? padovanSequence[level] : padovanSequence[padovanSequence.length - 1];
    case 'fixed':
    default:
      return 1;
  }
};

const SignalsPanel: React.FC<SignalsPanelProps> = ({ signals, winRate = 0, strategies: propStrategies, currentGaleLevel = 0, sequenceBaseBet }) => {
  const { tEntry } = useTranslation();
  const storeStrategies = useAppStore(state => state.strategies);
  const bankroll = useAppStore(state => state.bankroll);
  const currentBaseChip = bankroll?.management?.minChip && bankroll?.management?.minChip > 0 
    ? bankroll.management.minChip 
    : (bankroll?.management?.initialBet && bankroll?.management?.initialBet > 0 ? bankroll.management.initialBet : 0.10);

  const strategies = propStrategies || storeStrategies;
  const [expandedSignals, setExpandedSignals] = React.useState<Record<number, boolean>>({});

  const galeMultiplier = getGaleChipMultiplier(currentGaleLevel, bankroll?.management);

  const getSignalBetAndChip = (signal: any) => {
    const positions = getPositionCountForSignal(signal);
    const management = bankroll?.management;
    
    if (currentGaleLevel === 0) {
      const totalCost = positions * currentBaseChip;
      return {
        totalCost,
        chipSize: currentBaseChip
      };
    } else {
      const hasManual = management?.manualGaleChips && management?.manualGaleChips[currentGaleLevel] !== undefined && management?.manualGaleChips[currentGaleLevel] !== null && management?.manualGaleChips[currentGaleLevel] > 0;
      if (hasManual) {
        const manualChip = management.manualGaleChips[currentGaleLevel];
        return {
          totalCost: manualChip * currentBaseChip * positions,
          chipSize: manualChip * currentBaseChip
        };
      }
      
      const seqBase = sequenceBaseBet !== undefined && sequenceBaseBet > 0 ? sequenceBaseBet : (currentBaseChip * positions);
      const targetTotal = seqBase * galeMultiplier;
      const chipSize = targetTotal / positions;
      const roundedChipSize = Math.max(currentBaseChip, Math.round(chipSize / currentBaseChip) * currentBaseChip);
      const totalCost = roundedChipSize * positions;
      
      return {
        totalCost,
        chipSize: roundedChipSize
      };
    }
  };

  const toggleExplanation = (idx: number) => {
    setExpandedSignals(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const findStrategyForSignal = (signal: any): Strategy => {
    const matched = strategies.find(s => s.id === signal.strategyId);
    if (matched) return matched;
    
    // Return a generic/fallback strategy matching the signal info
    return {
      id: signal.strategyId || 'dynamic-signal',
      name: signal.patternName || 'Padrão Estatístico',
      gameType: signal.gameType || 'roulette',
      rules: {},
      isActive: true,
      isSystem: true,
      performance: {
        winRate: signal.confidence || signal.winRate || 80,
        totalEntries: 10,
        wins: 8,
        losses: 2,
        roi: 15,
        maxDrawdown: 1
      }
    };
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-extrabold uppercase tracking-widest text-[#c6a34f]">Sinais Ativos</h3>
        <span className="flex items-center gap-1.5 text-xs text-green-500 font-extrabold animate-pulse">
           <Zap size={12} /> LIVE
         </span>
      </div>

      {currentGaleLevel > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-red-950/20 border border-red-500/20 rounded-2xl text-xs font-bold text-red-200 flex items-center justify-between shadow-[0_0_12px_rgba(239,68,68,0.05)]"
        >
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping shrink-0" />
            <span className="uppercase tracking-wide font-black text-[10px] text-red-400">Modo de Recuperação Ativo</span>
          </div>
          <span className="px-2.5 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 font-black rounded-lg text-[10px] uppercase tracking-wider animate-pulse">
            GALE G{currentGaleLevel}
          </span>
        </motion.div>
      )}

      {signals.length === 0 ? (
        <div className="bg-[#111111] p-8 rounded-2xl border border-white/5 flex flex-col items-center justify-center text-center opacity-40">
           <Zap className="mb-2 text-[#c6a34f]" size={26} />
           <p className="text-sm font-bold uppercase tracking-tighter">Aguardando padrões estatísticos...</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {signals.map((signal, idx) => (
            <motion.div
              key={idx}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`
                p-5 rounded-2xl border flex flex-col gap-4
                ${signal.type === SignalType.STRONG 
                  ? 'bg-gradient-to-r from-green-600/20 to-transparent border-green-500/20' 
                  : signal.type === SignalType.MODERATE
                  ? 'bg-gradient-to-r from-[#c6a34f]/10 to-transparent border-[#c6a34f]/20'
                  : signal.type === SignalType.RISKY
                  ? 'bg-gradient-to-r from-yellow-600/20 to-transparent border-yellow-500/20'
                  : 'bg-[#111111] border-white/5'}
              `}
            >
              {/* Main row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`
                    w-12 h-12 rounded-xl flex items-center justify-center shrink-0
                    ${signal.type === SignalType.STRONG 
                      ? 'bg-green-600 text-white' 
                      : signal.type === SignalType.MODERATE 
                      ? 'bg-[#c6a34f]/20 text-[#c6a34f]' 
                      : 'bg-zinc-800 text-[#c6a34f]'}
                  `}>
                    {signal.type === SignalType.STRONG 
                      ? <CheckCircle2 size={24} /> 
                      : signal.type === SignalType.MODERATE 
                      ? <Zap size={22} /> 
                      : <AlertTriangle size={24} />}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h4 className="font-bold text-base tracking-tight text-white">{signal.patternName}</h4>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExplanation(idx);
                        }}
                        className={`p-1 rounded-lg transition-all cursor-pointer flex items-center justify-center shrink-0 border ${
                          expandedSignals[idx]
                            ? 'bg-[#c6a34f]/25 border-[#c6a34f]/50 text-[#c6a34f] scale-105'
                            : 'bg-white/5 border-white/5 text-[#c6a34f]/80 hover:text-white hover:bg-white/10'
                        }`}
                        title="Ver detalhes e fundamento analítico"
                      >
                        <Info size={14} className={expandedSignals[idx] ? "animate-pulse" : ""} />
                      </button>
                      {signal.source === 'database' && (
                        <span className="bg-blue-500/20 text-blue-400 text-[8px] px-1.5 py-0.5 rounded font-black tracking-widest uppercase">Database</span>
                      )}
                      {signal.source === 'strategy' && (
                        <div className="flex items-center gap-1.5">
                          <span className="bg-yellow-500/20 text-yellow-400 text-[8px] px-1.5 py-0.5 rounded font-black tracking-widest uppercase">Estratégia</span>
                          <span className="text-xs font-black text-white/50">{typeof signal.strategyWinRate === 'number' ? signal.strategyWinRate : signal.winRate}% WR</span>
                        </div>
                      )}
                      {currentGaleLevel > 0 && (
                        <span className="bg-red-500/20 text-red-400 text-[8px] px-1.5 py-0.5 rounded font-black tracking-widest uppercase border border-red-500/30 animate-pulse">
                          Recuperação G{currentGaleLevel}
                        </span>
                      )}
                      {signals.length > 1 && idx === 0 && (
                        <span className="bg-amber-500/25 text-amber-300 text-[8px] px-1.5 py-0.5 rounded font-black tracking-widest uppercase border border-amber-500/30 animate-pulse">
                          ⭐ PRIORITÁRIO (MAIOR ASSERTIVIDADE)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/55 uppercase font-medium tracking-widest">Confiança: {(typeof signal.strategyWinRate === 'number' ? signal.strategyWinRate : (signal.confidence || 0)).toFixed(0)}%</p>
                    
                    {/* Unified Real-time Backtest Stats Badge Row */}
                    {(() => {
                      const winRateVal = typeof signal.strategyWinRate === 'number' ? signal.strategyWinRate : signal.winRate;
                      const winsVal = signal.strategyWins ?? signal.tpaDetails?.stats?.wins ?? signal.angelDetails?.stats?.wins;
                      const lossesVal = signal.strategyLosses ?? signal.tpaDetails?.stats?.losses ?? signal.angelDetails?.stats?.losses;
                      const roiVal = signal.strategyRoi ?? signal.tpaDetails?.stats?.roi ?? signal.angelDetails?.stats?.roi;
                      const samplesVal = signal.strategyTotalEntries ?? signal.tpaDetails?.stats?.totalOperations ?? signal.angelDetails?.stats?.totalOperations;
                      
                      if (typeof winRateVal !== 'number' && typeof winsVal !== 'number') return null;
                      
                      return (
                        <div className="flex flex-wrap gap-2 mt-2 text-[9.5px] font-mono text-stone-300">
                          <span className="bg-white/5 px-2 py-0.5 rounded-lg border border-white/5">
                            Assertividade: <strong className="text-emerald-400 font-bold">{(winRateVal ?? 0).toFixed(1)}%</strong>
                          </span>
                          {typeof samplesVal === 'number' && (
                            <span className="bg-white/5 px-2 py-0.5 rounded-lg border border-white/5">
                              Amostras: <strong className="text-zinc-350 font-bold">{samplesVal}</strong>
                            </span>
                          )}
                          {typeof roiVal === 'number' && (
                            <span className="bg-white/5 px-2 py-0.5 rounded-lg border border-white/5">
                              ROI: <strong className={roiVal >= 0 ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>{roiVal.toFixed(1)}%</strong>
                            </span>
                          )}
                          {typeof winsVal === 'number' && typeof lossesVal === 'number' && (
                            <span className="bg-white/5 px-2 py-0.5 rounded-lg border border-white/5">
                              Placar: <strong className="text-[#c6a34f] font-bold">{winsVal}W - {lossesVal}L</strong>
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
                
                <div className="text-left sm:text-right">
                  <div className={`
                    font-black text-[#c6a34f] leading-none mb-1
                    ${(tEntry(signal.entry) || '').length > 6 ? 'text-base' : 'text-xl'}
                  `}>
                    {tEntry(signal.entry) || ''}
                  </div>
                  {(signal.unitsRequired || (signal.entryNumbers && signal.entryNumbers.length > 0)) ? (() => {
                    const { totalCost, chipSize } = getSignalBetAndChip(signal);
                    return (
                      <div className="text-[11px] text-emerald-400 font-mono font-black mb-0.5">
                        R$ {totalCost.toFixed(2)} total <span className="text-zinc-400 font-normal">(R$ {chipSize.toFixed(2)}/un)</span>
                      </div>
                    );
                  })() : null}
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[#c6a34f]/70 font-black flex items-center justify-start sm:justify-end gap-1.5">
                    <span>Sugestão de Entrada</span>
                    {currentGaleLevel > 0 && (
                      <span className="text-red-400 font-extrabold animate-pulse">G{currentGaleLevel}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Expandable Explanation Block */}
              <AnimatePresence>
                {expandedSignals[idx] && (() => {
                  const strategy = findStrategyForSignal(signal);
                  const explanation = getStrategyExplanation(strategy);
                  
                  return (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="overflow-hidden border-t border-white/10 pt-4 mt-1"
                    >
                      <div className="p-4 bg-zinc-950/65 rounded-2xl border border-[#c6a34f]/20 space-y-3.5 text-left">
                        {/* Header */}
                        <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[#c6a34f]">
                          <BookOpen size={13} className="text-[#c6a34f]" />
                          <span>Fundamento Analítico da IA</span>
                        </div>

                        {/* Instruções de Entrada & Divisão de Fichas */}
                        {explanation.betSpots && (
                          <div className="space-y-2 bg-[#0d0a05] p-3.5 rounded-xl border border-[#c6a34f]/20">
                            <span className="text-[10px] text-[#c6a34f] uppercase font-black tracking-widest block">🎯 Distribuição Dinâmica de Fichas</span>
                            <div className="text-xs space-y-1 font-mono text-zinc-300">
                              <p className="font-bold text-white uppercase">{strategy.name}</p>
                              <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1.5 border-t border-white/5">
                                {strategy.rules?.bets?.map((bet: any, bIdx: number) => {
                                  const spotAmount = bet.amount * currentBaseChip * galeMultiplier;
                                  const spotLabel = bet.type === 'dozen' ? `${bet.target}ª Dúzia` : (bet.label ? String(bet.label).replace(/Rua Dupla/gi, 'Linha') : 'Linha');
                                  return (
                                    <span key={bIdx} className="bg-white/5 px-2 py-1 rounded-md border border-white/5 text-zinc-300">
                                      {spotLabel}: <strong className="text-[#c6a34f]">R$ {spotAmount.toFixed(2)}</strong>
                                    </span>
                                  );
                                })}
                              </div>
                              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pt-2 mt-1.5 border-t border-white/10 text-[11px] gap-1">
                                <div>
                                  Aposta Total: <strong className="text-white">R$ {(getSignalBetAndChip(signal).totalCost).toFixed(2)}</strong>
                                </div>
                                <div className="text-[#c6a34f] font-black uppercase tracking-wider">
                                  {(() => {
                                    const baseMultiplier = currentBaseChip * galeMultiplier;
                                    const totalCost = (getSignalBetAndChip(signal).totalCost);
                                    const firstBet = strategy.rules?.bets?.[0];
                                    if (firstBet) {
                                      const t = String(firstBet.type || '').toLowerCase();
                                      const mult = (t === 'dozen' || t === 'coluna' || t === 'column' || t === 'dúzia' || t === 'duzia') ? 3
                                        : (t === 'line' || t === 'linha' || t === 'seisena') ? 6
                                        : (t === 'street' || t === 'rua') ? 12
                                        : (t === 'corner' || t === 'canto') ? 9
                                        : (t === 'split' || t === 'dividida' || t === 'cavalo') ? 18
                                        : (t === 'number' || t === 'pleno') ? 36
                                        : (t === 'color' || t === 'even_chance' || t === 'par' || t === 'ímpar') ? 2
                                        : 3;
                                      const netProfit = ((firstBet.amount || 1) * baseMultiplier * mult) - totalCost;
                                      return `LUCRO LÍQUIDO: R$ ${Math.max(0, netProfit).toFixed(2).replace('.', ',')}`;
                                    }
                                    return `LUCRO LÍQUIDO: R$ ${(totalCost * 0.5).toFixed(2).replace('.', ',')}`;
                                  })()}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Objective */}
                        <div className="space-y-1">
                          <span className="text-[10px] text-white/50 uppercase font-black tracking-widest block">🎯 Objetivo Estratégico</span>
                          <p className="text-xs text-stone-200 leading-relaxed font-sans bg-black/40 p-3 rounded-xl border border-white/5">
                            {explanation.objective}
                          </p>
                        </div>

                        {/* How it works */}
                        <div className="space-y-1">
                          <span className="text-[10px] text-white/50 uppercase font-black tracking-widest block">⚙️ Funcionamento do Algoritmo</span>
                          <p className="text-xs text-stone-200 leading-relaxed font-sans bg-black/40 p-3 rounded-xl border border-white/5">
                            {explanation.howItWorks}
                          </p>
                        </div>

                        {/* Patterns analyzed */}
                        {explanation.patternsAnalyzed && explanation.patternsAnalyzed.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[10px] text-white/50 uppercase font-black tracking-widest block">📊 Parâmetros & Padrões Monitorados</span>
                            <div className="flex flex-wrap gap-1.5">
                              {explanation.patternsAnalyzed.map((pattern, pIdx) => (
                                <span key={pIdx} className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] font-mono text-zinc-300 font-bold">
                                  {pattern}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Advice/Tips */}
                        {explanation.tips && (
                          <div className="space-y-1 bg-yellow-500/5 p-3.5 rounded-xl border border-yellow-500/10">
                            <span className="text-[10px] text-yellow-400 uppercase font-black tracking-widest flex items-center gap-1">
                              <Lightbulb size={12} /> Diretriz IA / Dica Operacional
                            </span>
                            <p className="text-xs text-yellow-200/90 font-medium italic leading-relaxed mt-1">
                              {explanation.tips}
                            </p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })()}
              </AnimatePresence>

              {/* Racetrack engine details, confirmations and chips */}
              {signal.isRacetrack && (
                <div className="border-t border-white/5 pt-3.5 space-y-4">
                  
                  {/* Validation confirmation steps */}
                  <div className="space-y-1.5">
                    <span className="text-[9px] text-[#c6a34f]/70 uppercase font-black tracking-widest block">
                      Validação Dos Passos & Confirmação Realizada:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <div className="p-2 bg-black/40 rounded-xl border border-white/5 text-[9px] text-stone-300">
                        <span className="text-white/40 block text-[8px] font-bold uppercase tracking-wider">Passo 1 (Saída)</span>
                        <p className="font-mono mt-0.5 truncate">{signal.sequenceSteps?.step1 || 'Sorteado'}</p>
                      </div>
                      <div className="p-2 bg-black/40 rounded-xl border border-white/5 text-[9px] text-stone-300">
                        <span className="text-white/40 block text-[8px] font-bold uppercase tracking-wider">Passo 2 (Ausência)</span>
                        <p className="font-mono mt-0.5 truncate">{signal.sequenceSteps?.step2 || 'Ausência'}</p>
                      </div>
                      <div className="p-2 bg-black/40 rounded-xl border border-white/5 text-[9px] text-stone-300">
                        <span className="text-white/40 block text-[8px] font-bold uppercase tracking-wider">Passo 3 (Ausência)</span>
                        <p className="font-mono mt-0.5 truncate">{signal.sequenceSteps?.step3 || 'Ausência'}</p>
                      </div>
                      <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/30 text-[9px] text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.1)]">
                        <span className="text-emerald-400 block text-[8px] font-bold uppercase tracking-wider">Passo 4 (Confirmação) 🎯</span>
                        <p className="font-mono mt-0.5 font-bold truncate">{signal.sequenceSteps?.step4 || 'Confirmado'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Target numbers */}
                  {signal.entryNumbers && signal.entryNumbers.length > 0 && (
                    <div className="space-y-2 bg-black/20 p-3.5 rounded-xl border border-white/5">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-white/40 uppercase font-black tracking-widest block">
                          Fichas Reais para Cobrir no Racetrack:
                        </span>
                        <span className="text-[9px] text-[#c6a34f] font-mono font-bold">
                          {signal.entryNumbers.length} Números Cobertos • R$ {getSignalBetAndChip(signal).totalCost.toFixed(2)} (R$ {getSignalBetAndChip(signal).chipSize.toFixed(2)}/núm)
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {signal.entryNumbers.map((n: number, i: number) => {
                          const isRed = COLOR_MAP.ROULETTE.RED.includes(n);
                          const getChipBg = (num: number) => {
                            if (num === 0) return 'bg-[#10b981] text-white';
                            return isRed ? 'bg-[#ef4444] text-white' : 'bg-zinc-900 border border-white/10 text-stone-200';
                          };
                          return (
                            <span 
                              key={i} 
                              className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 select-none ${getChipBg(n)} shadow-sm`}
                            >
                              {n}
                            </span>
                          );
                        })}
                      </div>
                      {signal.sectorAnalysis && (
                        <p className="text-[10px] text-stone-300 font-medium pt-1.5 leading-relaxed border-t border-white/5 mt-2">
                          <span className="text-[#c6a34f] font-black uppercase tracking-wider block text-[8px] mb-0.5">Análise Física do Setor:</span>
                          {signal.sectorAnalysis}
                        </p>
                      )}
                      {signal.persistencePotential && (
                        <p className="text-[10px] text-stone-300 font-medium pt-1.5 leading-relaxed border-t border-white/5 mt-1.5">
                          <span className="text-[#c6a34f] font-black uppercase tracking-wider block text-[8px] mb-0.5">Persistência da Região:</span>
                          {signal.persistencePotential}
                        </p>
                      )}
                      {signal.riskAnalysis && (
                        <p className="text-[10px] text-amber-300 font-medium pt-1.5 leading-relaxed border-t border-white/5 mt-1.5">
                          <span className="text-amber-500 font-black uppercase tracking-wider block text-[8px] mb-0.5">Análise de Risco & Recomendações:</span>
                          ⚠️ {signal.riskAnalysis}
                        </p>
                      )}
                    </div>
                  )}

                </div>
              )}

              {/* TPA84 detailed technical presentation */}
              {signal.isTpa84 && signal.tpaDetails && (() => {
                const det = signal.tpaDetails;
                return (
                  <div className="border-t border-white/5 pt-3.5 space-y-4 text-stone-200">
                    
                    {/* Selected Terminals & Classification */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-black/40 p-3.5 rounded-xl border border-white/5">
                      <div>
                        <span className="text-white/40 block text-[8px] font-bold uppercase tracking-wider">Terminais Selecionados:</span>
                        <div className="text-sm font-black text-white mt-1">
                          Terminal <span className="text-[#c6a34f]">{det.terminalA}</span> e Terminal <span className="text-[#c6a34f]">{det.terminalB}</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-white/40 block text-[8px] font-bold uppercase tracking-wider">Classificação da Entrada:</span>
                        <div className="text-sm font-extrabold text-amber-400 mt-1">
                          {det.classification}
                        </div>
                      </div>
                    </div>

                    {/* Racetrack Physical Analysis */}
                    <div className="space-y-1.5">
                      <span className="text-[9px] text-[#c6a34f]/70 uppercase font-black tracking-widest block">
                        Análise Física Racetrack (Roda Europeia):
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="p-2.5 bg-black/40 rounded-xl border border-white/5 text-[9px]">
                          <span className="text-white/40 block text-[7px] font-bold uppercase tracking-wider">Distância</span>
                          <p className="font-mono mt-0.5 font-bold text-white">{det.distance.toFixed(1)} slots</p>
                        </div>
                        <div className="p-2.5 bg-black/40 rounded-xl border border-white/5 text-[9px]">
                          <span className="text-white/40 block text-[7px] font-bold uppercase tracking-wider">Mesmo Setor?</span>
                          <p className="font-mono mt-0.5 font-bold text-white">{det.sameSector ? 'Sim ✅' : 'Não ❌'}</p>
                        </div>
                        <div className="p-2.5 bg-black/40 rounded-xl border border-white/5 text-[9px]">
                          <span className="text-white/40 block text-[7px] font-bold uppercase tracking-wider">Conc. Regional</span>
                          <p className="font-mono mt-0.5 font-bold text-white">{det.regionalConcentration ? 'Sim ✅' : 'Não ❌'}</p>
                        </div>
                        <div className="p-2.5 bg-black/40 rounded-xl border border-white/5 text-[9px]">
                          <span className="text-white/40 block text-[7px] font-bold uppercase tracking-wider">Repet. Recente</span>
                          <p className="font-mono mt-0.5 font-bold text-white">{det.recentRepetition ? 'Sim ✅' : 'Não ❌'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Dominance and Motivo Técnico */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-stone-300 font-medium leading-relaxed bg-black/25 p-3 rounded-xl border border-white/5">
                        <span className="text-[#c6a34f] font-black uppercase tracking-wider block text-[8px] mb-0.5">Motivo Técnico da Entrada:</span>
                        {det.reason}
                      </p>
                      {det.dominanceArea !== 'Nenhuma' && (
                        <p className="text-[10px] text-amber-300 font-medium leading-relaxed bg-amber-500/5 p-3 rounded-xl border border-amber-500/15">
                          <span className="text-amber-500 font-black uppercase tracking-wider block text-[8px] mb-0.5">Área Dominante da Roda:</span>
                          🎯 Há dominância ativa do setor <strong className="text-white">{det.dominanceArea}</strong> detectada no histórico recente de giros.
                        </p>
                      )}
                    </div>

                    {/* Target numbers chips */}
                    {det.entryNumbers && det.entryNumbers.length > 0 && (
                      <div className="space-y-2 bg-black/20 p-3.5 rounded-xl border border-white/5">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-white/40 uppercase font-black tracking-widest block">
                            Cobertura de Entrada ({det.coveredCount} Números):
                          </span>
                          <span className="text-[9px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                            {det.unitsRequired} Unidades Necessárias • R$ {getSignalBetAndChip({ ...signal, unitsRequired: det.unitsRequired }).totalCost.toFixed(2)} (R$ {getSignalBetAndChip({ ...signal, unitsRequired: det.unitsRequired }).chipSize.toFixed(2)}/núm)
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {det.entryNumbers.map((n: number, i: number) => {
                            const isRed = COLOR_MAP.ROULETTE.RED.includes(n);
                            const getChipBg = (num: number) => {
                              if (num === 0) return 'bg-[#10b981] text-white';
                              return isRed ? 'bg-[#ef4444] text-white' : 'bg-zinc-900 border border-white/10 text-stone-200';
                            };
                            return (
                              <span 
                                key={i} 
                                className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 select-none ${getChipBg(n)} shadow-sm`}
                              >
                                {n}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Retrospective continuous statistical performance metrics */}
                    <div className="space-y-2 bg-gradient-to-r from-zinc-950 to-[#181612] p-4 rounded-xl border border-[#c6a34f]/25">
                      <span className="text-[9px] text-[#c6a34f] uppercase font-black tracking-widest block border-b border-white/10 pb-1.5 flex items-center justify-between">
                        <span>Estatísticas de Desempenho TPA84:</span>
                        {typeof signal.strategyWinRate === 'number' && (
                          <span className="text-[8px] bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2 py-0.5 rounded uppercase font-bold tracking-wider">
                            Simulação Backtest Ativa
                          </span>
                        )}
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-[10px]">
                        <div>
                          <span className="text-white/40 block text-[7px] font-bold uppercase tracking-wider">Operações:</span>
                          <strong className="text-white font-mono">{typeof signal.strategyTotalEntries === 'number' ? signal.strategyTotalEntries : det.stats.totalOperations}</strong>
                        </div>
                        <div>
                          <span className="text-white/40 block text-[7px] font-bold uppercase tracking-wider">Assertividade:</span>
                          <strong className="text-emerald-400 font-mono">{typeof signal.strategyWinRate === 'number' ? signal.strategyWinRate.toFixed(1) : det.stats.winRate.toFixed(1)}%</strong>
                        </div>
                        <div>
                          <span className="text-white/40 block text-[7px] font-bold uppercase tracking-wider">ROI / EV:</span>
                          <strong className="text-white font-mono">+{typeof signal.strategyRoi === 'number' ? signal.strategyRoi.toFixed(1) : det.stats.roi.toFixed(1)}% / {det.stats.ev.toFixed(2)}u</strong>
                        </div>
                        <div>
                          <span className="text-white/40 block text-[7px] font-bold uppercase tracking-wider">Max Drawdown:</span>
                          <strong className="text-red-400 font-mono">{typeof signal.strategyMaxDrawdown === 'number' ? `${signal.strategyMaxDrawdown.toFixed(1)} u` : `${det.stats.maxDrawdown} u`}</strong>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[10px] pt-1">
                        <div>
                          <span className="text-white/40 block text-[7px] font-bold uppercase tracking-wider">WIN / LOSS:</span>
                          <strong className="text-white font-mono">
                            {typeof signal.strategyWins === 'number' && typeof signal.strategyLosses === 'number' 
                              ? `${signal.strategyWins}W / ${signal.strategyLosses}L` 
                              : `${det.stats.wins}W / ${det.stats.losses}L`}
                          </strong>
                        </div>
                        <div>
                          <span className="text-white/40 block text-[7px] font-bold uppercase tracking-wider">Profit Factor:</span>
                          <strong className="text-emerald-400 font-mono">{det.stats.profitFactor.toFixed(2)}</strong>
                        </div>
                        <div>
                          <span className="text-white/40 block text-[7px] font-bold uppercase tracking-wider">Max Seq. WIN:</span>
                          <strong className="text-emerald-400 font-mono">{det.stats.maxWinsSeq}</strong>
                        </div>
                        <div>
                          <span className="text-white/40 block text-[7px] font-bold uppercase tracking-wider">Max Seq. LOSS:</span>
                          <strong className="text-red-400 font-mono">{det.stats.maxLossesSeq}</strong>
                        </div>
                      </div>
                    </div>

                  </div>
                );
              })()}

              {/* Angel84 detailed technical presentation */}
              {signal.isAngel84 && signal.angelDetails && (() => {
                const det = signal.angelDetails;
                return (
                  <div className="border-t border-white/5 pt-3.5 space-y-4 text-stone-200">
                    
                    {/* Selected Terminals & Classification */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-black/40 p-3.5 rounded-xl border border-white/5">
                      <div>
                        <span className="text-white/40 block text-[8px] font-bold uppercase tracking-wider">Terminais de Entrada:</span>
                        <div className="text-sm font-black text-white mt-1">
                          Terminais <span className="text-[#c6a34f]">{det.selectedTerminals.join(', ')}</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-white/40 block text-[8px] font-bold uppercase tracking-wider">Classificação / Repetição:</span>
                        <div className="text-sm font-extrabold text-amber-400 mt-1 flex items-center gap-1.5">
                          <span>Estratégia Ativa</span>
                          {det.hasRepeatedTerminals && (
                            <span className="bg-red-500/20 border border-red-500/30 text-red-400 text-[8px] px-1.5 py-0.5 rounded uppercase tracking-wider font-mono">
                              Repetição Ativa ⚠️
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Motivo Técnico */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-stone-300 font-medium leading-relaxed bg-black/25 p-3 rounded-xl border border-white/5">
                        <span className="text-[#c6a34f] font-black uppercase tracking-wider block text-[8px] mb-0.5">Fundamentação Analítica:</span>
                        {det.reason}
                      </p>
                    </div>

                    {/* Target numbers chips */}
                    {det.entryNumbers && det.entryNumbers.length > 0 && (
                      <div className="space-y-2 bg-black/20 p-3.5 rounded-xl border border-white/5">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-white/40 uppercase font-black tracking-widest block">
                            Cobertura de Entrada ({det.coveredCount} Números):
                          </span>
                          <span className="text-[9px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                            {det.unitsRequired} Unidades Necessárias • R$ {getSignalBetAndChip({ ...signal, unitsRequired: det.unitsRequired }).totalCost.toFixed(2)} (R$ {getSignalBetAndChip({ ...signal, unitsRequired: det.unitsRequired }).chipSize.toFixed(2)}/núm)
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {det.entryNumbers.map((n: number, i: number) => {
                            const isRed = COLOR_MAP.ROULETTE.RED.includes(n);
                            const getChipBg = (num: number) => {
                              if (num === 0) return 'bg-[#10b981] text-white';
                              return isRed ? 'bg-[#ef4444] text-white' : 'bg-zinc-900 border border-white/10 text-stone-200';
                            };
                            return (
                              <span 
                                key={i} 
                                className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 select-none ${getChipBg(n)} shadow-sm`}
                              >
                                {n}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Retrospective continuous statistical performance metrics */}
                    <div className="space-y-2 bg-gradient-to-r from-zinc-950 to-[#181612] p-4 rounded-xl border border-[#c6a34f]/25">
                      <span className="text-[9px] text-[#c6a34f] uppercase font-black tracking-widest block border-b border-white/10 pb-1.5 flex items-center justify-between">
                        <span>Estatísticas de Desempenho Angel84:</span>
                        {typeof signal.strategyWinRate === 'number' && (
                          <span className="text-[8px] bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2 py-0.5 rounded uppercase font-bold tracking-wider">
                            Simulação Backtest Ativa
                          </span>
                        )}
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-[10px]">
                        <div>
                          <span className="text-white/40 block text-[7px] font-bold uppercase tracking-wider">Operações:</span>
                          <strong className="text-white font-mono">{typeof signal.strategyTotalEntries === 'number' ? signal.strategyTotalEntries : det.stats.totalOperations}</strong>
                        </div>
                        <div>
                          <span className="text-white/40 block text-[7px] font-bold uppercase tracking-wider">Assertividade:</span>
                          <strong className="text-emerald-400 font-mono">{typeof signal.strategyWinRate === 'number' ? signal.strategyWinRate.toFixed(1) : det.stats.winRate.toFixed(1)}%</strong>
                        </div>
                        <div>
                          <span className="text-white/40 block text-[7px] font-bold uppercase tracking-wider">ROI / EV:</span>
                          <strong className="text-white font-mono">+{typeof signal.strategyRoi === 'number' ? signal.strategyRoi.toFixed(1) : det.stats.roi.toFixed(1)}% / {det.stats.ev.toFixed(2)}u</strong>
                        </div>
                        <div>
                          <span className="text-white/40 block text-[7px] font-bold uppercase tracking-wider">Max Drawdown:</span>
                          <strong className="text-red-400 font-mono">{typeof signal.strategyMaxDrawdown === 'number' ? `${signal.strategyMaxDrawdown.toFixed(1)} u` : `${det.stats.maxDrawdown} u`}</strong>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[10px] pt-1">
                        <div>
                          <span className="text-white/40 block text-[7px] font-bold uppercase tracking-wider">WIN / LOSS:</span>
                          <strong className="text-white font-mono">
                            {typeof signal.strategyWins === 'number' && typeof signal.strategyLosses === 'number' 
                              ? `${signal.strategyWins}W / ${signal.strategyLosses}L` 
                              : `${det.stats.wins}W / ${det.stats.losses}L`}
                          </strong>
                        </div>
                        <div>
                          <span className="text-white/40 block text-[7px] font-bold uppercase tracking-wider">Profit Factor:</span>
                          <strong className="text-emerald-400 font-mono">{det.stats.profitFactor.toFixed(2)}</strong>
                        </div>
                        <div>
                          <span className="text-white/40 block text-[7px] font-bold uppercase tracking-wider">Max Seq. WIN:</span>
                          <strong className="text-emerald-400 font-mono">{det.stats.maxWinsSeq}</strong>
                        </div>
                        <div>
                          <span className="text-white/40 block text-[7px] font-bold uppercase tracking-wider">Max Seq. LOSS:</span>
                          <strong className="text-red-400 font-mono">{det.stats.maxLossesSeq}</strong>
                        </div>
                      </div>
                    </div>

                  </div>
                );
              })()}
            </motion.div>
          ))}
        </div>
      )}

    </div>
  );
};

export default SignalsPanel;
