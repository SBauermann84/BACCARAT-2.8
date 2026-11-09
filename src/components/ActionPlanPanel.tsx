import React from 'react';
import { GameResult, ManagementConfig, ManagementMode, GameType } from '../types';
import { getDynamicBetAndState } from '../engines/progressionEngine';
import { Check, X, ArrowRight, HelpCircle, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';

interface ActionPlanPanelProps {
  gameType: GameType;
  history: GameResult[];
  config: ManagementConfig;
  compact?: boolean;
  positionCount?: number;
}

export const ActionPlanPanel: React.FC<ActionPlanPanelProps> = ({ gameType, history, config, compact = false, positionCount }) => {
  const initialBet = config.initialBet || 10;
  const activePositions = positionCount || (gameType === GameType.ROULETTE ? 11 : 1);
  
  const baseChip = config.minChip && config.minChip > 0 ? config.minChip : (config.initialBet && config.initialBet > 0 ? config.initialBet : 0.10);

  const getChipOverrideByPositions = (positions: number) => {
    if (!config.useCategoryChips) return baseChip;
    if (gameType !== GameType.ROULETTE) return undefined;
    
    if (positions === 11) {
      return config.chipS84 || baseChip;
    }
    if (positions === 24) {
      return config.chipTpa84 || baseChip;
    }
    if ([7, 8, 12, 17].includes(positions)) {
      return config.chipRegions || baseChip;
    }
    if ([18].includes(positions)) {
      return config.chipSectors || baseChip;
    }
    if (positions > 1 && positions !== 11 && positions !== 24) {
      return config.chipRacetrack || baseChip;
    }
    return baseChip;
  };

  const chipOverride = getChipOverrideByPositions(activePositions);

  // Calculate current state
  const currentState = getDynamicBetAndState(history, config, activePositions, chipOverride);
  const currentBet = currentState.currentBetSize;

  // Simulate WIN on the next game
  const simulatedWinResult: GameResult = {
    id: 'sim_win',
    gameType,
    result: gameType === GameType.ROULETTE ? 0 : 'PLAYER',
    timestamp: Date.now(),
    sessionId: 'simulation',
    metadata: {},
    isWin: true
  };
  const winState = getDynamicBetAndState([simulatedWinResult, ...history], config, activePositions, chipOverride);
  const nextBetOnWin = winState.currentBetSize;

  // Simulate LOSS on the next game
  const simulatedLossResult: GameResult = {
    id: 'sim_loss',
    gameType,
    result: gameType === GameType.ROULETTE ? 0 : 'PLAYER',
    timestamp: Date.now(),
    sessionId: 'simulation',
    metadata: {},
    isWin: false
  };
  const lossState = getDynamicBetAndState([simulatedLossResult, ...history], config, activePositions, chipOverride);
  const nextBetOnLoss = lossState.currentBetSize;

  // Simulate consecutive losses projection (up to 10 steps) to show future requirements
  const lossProjection: { step: number; betSize: number; level: number }[] = [];
  let simulatedHistoryPointer = [...history];
  for (let step = 1; step <= 10; step++) {
    const simResult: GameResult = {
      id: `sim_loss_proj_${step}`,
      gameType,
      result: gameType === GameType.ROULETTE ? 0 : 'PLAYER',
      timestamp: Date.now(),
      sessionId: 'simulation',
      metadata: {},
      isWin: false
    };
    simulatedHistoryPointer = [simResult, ...simulatedHistoryPointer];
    const projState = getDynamicBetAndState(simulatedHistoryPointer, config, activePositions, chipOverride);
    lossProjection.push({
      step,
      betSize: projState.currentBetSize,
      level: projState.currentLevel
    });
  }

  // Text descriptions for current management rules
  const getModeTitle = () => {
    switch (config.mode) {
      case ManagementMode.MARTINGALE: return 'Martingale';
      case ManagementMode.SOROS: return 'Soros';
      case ManagementMode.FIBONACCI: return 'Sequência Fibonacci';
      case ManagementMode.FIXED: return 'Mão Fixa';
      case ManagementMode.CYCLIC: return 'Ciclo Progressivo';
      case ManagementMode.SISTEMA_2_GANHOS: return 'Sistema 2 Ganhos (Linear)';
      case ManagementMode.SISTEMA_2U_REC1: return 'Sistema +2U / -1U';
      case ManagementMode.D_ALEMBERT: return 'D\'Alembert (+1U / -1U)';
      case ManagementMode.NIVEL_FIXO_RECUPERACAO: return 'NFR84';
      case ManagementMode.STAR_2_2: return 'Star 2.2';
      case ManagementMode.STAR_2_0: return 'Star 2.0';
      case ManagementMode.DUTCH: return 'Gerenciamento Holandês';
      case ManagementMode.PADOVAN: return 'Sequência de Padovan';
      default: return 'Gestão de Banca';
    }
  };

  const getStatusBadge = () => {
    if (config.mode === ManagementMode.SISTEMA_2_GANHOS) {
      const unitsAbove = Math.max(0, (currentBet - initialBet) / initialBet);
      return (
        <div className="flex gap-2 items-center flex-wrap">
          <span className="px-2.5 py-1 rounded text-xs font-mono font-bold bg-[#c6a34f]/10 text-[#c6a34f] border border-[#c6a34f]/20">
            Nível: +{unitsAbove.toFixed(0)}u
          </span>
          <span className="px-2.5 py-1 rounded text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            VPs Seguidas: {currentState.consecutiveWins}/2
          </span>
        </div>
      );
    }
    if (config.mode === ManagementMode.SISTEMA_2U_REC1) {
      const unitsAbove = Math.max(0, (currentBet - initialBet) / initialBet);
      return (
        <span className="px-2.5 py-1 rounded text-xs font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
          Aposta: +{unitsAbove.toFixed(1)}u
        </span>
      );
    }
    if (config.mode === ManagementMode.D_ALEMBERT) {
      const unitsAbove = Math.max(0, (currentBet - initialBet) / initialBet);
      return (
        <span className="px-2.5 py-1 rounded text-xs font-mono font-bold bg-[#c6a34f]/10 text-[#c6a34f] border border-[#c6a34f]/20">
          D'Alembert: +{unitsAbove.toFixed(0)}u
        </span>
      );
    }
    if (config.mode === ManagementMode.MARTINGALE) {
      return (
        <span className="px-2.5 py-1 rounded text-xs font-mono font-bold bg-red-500/10 text-red-400 border border-red-500/20">
          Nível Gale: {currentState.currentLevel} / {config.levels}
        </span>
      );
    }
    if (config.mode === ManagementMode.NIVEL_FIXO_RECUPERACAO) {
      return (
        <span className="px-2.5 py-1 rounded text-xs font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
          NFR84: Nível {currentState.currentLevel} / {config.levels}
        </span>
      );
    }
    if (config.mode === ManagementMode.DUTCH) {
      return (
        <span className="px-2.5 py-1 rounded text-xs font-mono font-bold bg-[#c6a34f]/10 text-[#c6a34f] border border-[#c6a34f]/20">
          Holandês: Bloco {Math.floor(currentState.currentLevel / 3) + 1} (Rodada {(currentState.currentLevel % 3) + 1}/3)
        </span>
      );
    }
    if (config.mode === ManagementMode.PADOVAN) {
      return (
        <span className="px-2.5 py-1 rounded text-xs font-mono font-bold bg-[#c6a34f]/10 text-[#c6a34f] border border-[#c6a34f]/20">
          Padovan: Degrau {currentState.currentLevel + 1}/16
        </span>
      );
    }
    if (config.mode === ManagementMode.STAR_2_2) {
      return (
        <div className="flex gap-2 items-center flex-wrap">
          <span className="px-2.5 py-1 rounded text-xs font-mono font-bold bg-[#c6a34f]/10 text-[#c6a34f] border border-[#c6a34f]/20">
            Degrau Star 2.2: {currentState.currentLevel + 1}/10
          </span>
          <span className="px-2.5 py-1 rounded text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Vitória Dupla: {currentState.consecutiveWins}/2
          </span>
        </div>
      );
    }
    if (config.mode === ManagementMode.STAR_2_0) {
      return (
        <div className="flex gap-2 items-center flex-wrap">
          <span className="px-2.5 py-1 rounded text-xs font-mono font-bold bg-[#c6a34f]/10 text-[#c6a34f] border border-[#c6a34f]/20">
            Estágio Star 2.0: {currentState.currentLevel === 0 ? '1 (Base)' : `2 (Degrau ${currentState.currentLevel}/8)`}
          </span>
          <span className="px-2.5 py-1 rounded text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Vitórias: {currentState.consecutiveWins}/2
          </span>
        </div>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded text-xs font-mono font-bold bg-zinc-800 text-zinc-300">
        Nível: {currentState.currentLevel}
      </span>
    );
  };

  return (
    <div id="action-plan-container" className="bg-[#111111] p-5 md:p-6 rounded-3xl border border-[#c6a34f]/10 shadow-[0_4px_24px_rgba(0,0,0,0.5)] min-h-[400px] flex-grow flex-1 flex flex-col justify-between overflow-visible">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-base font-extrabold uppercase tracking-widest text-[#c6a34f]">Plano de Ação</h3>
          <p className="text-xs text-zinc-400 font-medium mt-0.5 uppercase tracking-tighter">Rotas de progressão em tempo real</p>
        </div>
        {getStatusBadge()}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* GREEN ROUTE - ON WIN */}
        <div className="p-4 rounded-2xl bg-emerald-500/[0.02] border border-emerald-500/10 hover:border-emerald-500/25 transition-all">
          <div className="flex items-center gap-2 text-emerald-400 mb-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Check size={16} />
            </div>
            <span className="text-sm uppercase font-black tracking-wider">Se a Entrada GANHAR:</span>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-zinc-400">Próximo valor da aposta:</span>
              <span className="text-2xl font-mono font-black text-emerald-400">R$ {nextBetOnWin.toFixed(2)}</span>
            </div>

            {!compact && (
              <div className="pt-2 border-t border-emerald-500/5 text-xs text-zinc-300 leading-relaxed font-medium">
                {config.mode === ManagementMode.SISTEMA_2_GANHOS && (
                  currentBet <= initialBet 
                    ? "Banca no patamar inicial. Aposta se manterá em 1U (Base)." 
                    : currentState.consecutiveWins === 1 
                      ? `Ir para 2ª vitória seguida no mesmo valor de R$ ${currentBet.toFixed(2)}. Conseguindo reduziria para R$ ${(currentBet - initialBet).toFixed(2)}.`
                      : `Gostaria de vitória inicial. Próxima entrada aguarda 2ª vitória seguida ou repete patamar.`
                )}
                {config.mode === ManagementMode.SISTEMA_2U_REC1 && (
                  `Aposta reduzirá 1 unidade base (-R$ ${initialBet.toFixed(2)}), tornando-se R$ ${nextBetOnWin.toFixed(2)}, até retornar à mão base.`
                )}
                {config.mode === ManagementMode.D_ALEMBERT && (
                  `Aposta reduzirá em 1 Unidade (-R$ ${initialBet.toFixed(2)}), tornando-se R$ ${nextBetOnWin.toFixed(2)}, até retornar à mão base.`
                )}
                {config.mode === ManagementMode.MARTINGALE && (
                  "Excelente! O Martingale reseta de imediato para a mão inicial, garantindo o lucro da sequência."
                )}
                {config.mode === ManagementMode.SOROS && (
                  `Aposta avança para R$ ${nextBetOnWin.toFixed(2)} acumulando o lucro da rodada anterior (Nível ${winState.currentLevel}).`
                )}
                {config.mode === ManagementMode.FIBONACCI && (
                  `Recua 2 passos na sequência matemática para R$ ${nextBetOnWin.toFixed(2)} visando reduzir risco.`
                )}
                {config.mode === ManagementMode.FIXED && (
                  "Aposta fixa mantida no valor inicial."
                )}
                {config.mode === ManagementMode.CYCLIC && (
                  "Reseta e retorna ao primeiro passo do ciclo ativo."
                )}
                {config.mode === ManagementMode.STAR_2_2 && (
                  currentState.consecutiveWins === 1
                    ? `Vitória dupla concluída com sucesso! O ciclo foi encerrado no lucro e a aposta reseta para R$ ${nextBetOnWin.toFixed(2)} (1U).`
                    : `1º acerto conquistado! A 2ª mão será ajustada para R$ ${nextBetOnWin.toFixed(2)} para buscar o encerramento do ciclo no lucro.`
                )}
                {config.mode === ManagementMode.STAR_2_0 && (
                  currentState.consecutiveWins === 1
                    ? `Vitória dupla concluída! O ciclo foi limpo com sucesso e a aposta reseta para R$ ${nextBetOnWin.toFixed(2)} (1U).`
                    : `1º acerto conquistado! A 2ª mão será de parlay para R$ ${nextBetOnWin.toFixed(2)} para buscar o encerramento do ciclo no lucro.`
                )}
                {config.mode === ManagementMode.DUTCH && (
                  "Progresso registrado. Se ao término das 3 rodadas do bloco o saldo estiver positivo, o ciclo reseta para 1U."
                )}
                {config.mode === ManagementMode.PADOVAN && (
                  "Vitória conquistada! A aposta reseta para o início da sequência de Padovan (1U)."
                )}
              </div>
            )}
          </div>
        </div>

        {/* RED ROUTE - ON LOSS */}
        <div className="p-4 rounded-2xl bg-red-500/[0.02] border border-red-500/10 hover:border-red-500/25 transition-all">
          <div className="flex items-center gap-2 text-red-400 mb-3">
            <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center">
              <X size={16} />
            </div>
            <span className="text-sm uppercase font-black tracking-wider">Se a Entrada PERDER:</span>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-zinc-400">Próximo valor da aposta:</span>
              <span className="text-2xl font-mono font-black text-red-400">R$ {nextBetOnLoss.toFixed(2)}</span>
            </div>

            {!compact && (
              <div className="pt-2 border-t border-red-500/5 text-xs text-zinc-300 leading-relaxed font-medium">
                {config.mode === ManagementMode.SISTEMA_2_GANHOS && (
                  `Aposta sobe 1 unidade (+R$ ${initialBet.toFixed(2)}) tornando-se R$ ${nextBetOnLoss.toFixed(2)}. Vitória seguidas necessárias serão resetadas.`
                )}
                {config.mode === ManagementMode.SISTEMA_2U_REC1 && (
                  `Aposta sobe 2 unidades (+R$ ${(2 * initialBet).toFixed(2)}) tornando-se R$ ${nextBetOnLoss.toFixed(2)}.`
                )}
                {config.mode === ManagementMode.D_ALEMBERT && (
                  `Aposta sobe 1 unidade (+R$ ${initialBet.toFixed(2)}) tornando-se R$ ${nextBetOnLoss.toFixed(2)}.`
                )}
                {config.mode === ManagementMode.MARTINGALE && (
                  `Dobra o valor apostado atual para R$ ${nextBetOnLoss.toFixed(2)} (Nível ${lossState.currentLevel}) buscando focar na recuperação.`
                )}
                {config.mode === ManagementMode.SOROS && (
                  "Aposta reseta imediatamente para a unidade base após a derrota."
                )}
                {config.mode === ManagementMode.FIBONACCI && (
                  `Avança 1 passo na tabela Fibonacci de forma a aumentar ligeiramente a aposta para R$ ${nextBetOnLoss.toFixed(2)}.`
                )}
                {config.mode === ManagementMode.FIXED && (
                  "Mão de aposta conservadora de valor fixo mantida."
                )}
                {config.mode === ManagementMode.CYCLIC && (
                  `Avança para o próximo multiplicador do ciclo de apostas (R$ ${nextBetOnLoss.toFixed(2)}).`
                )}
                {config.mode === ManagementMode.STAR_2_2 && (
                  `Avança para o Degrau ${lossState.currentLevel + 1} da escala Star 2.2 (R$ ${nextBetOnLoss.toFixed(2)}).`
                )}
                {config.mode === ManagementMode.STAR_2_0 && (
                  lossState.currentLevel === 0
                    ? `Mantém aposta de 1U em R$ ${nextBetOnLoss.toFixed(2)} no Estágio 1 (ou inicia Estágio 2 de recuperação se o déficit ultrapassar 7U).`
                    : `Avança para o Degrau ${lossState.currentLevel} do Estágio 2 da escala Star 2.0 (R$ ${nextBetOnLoss.toFixed(2)}).`
                )}
                {config.mode === ManagementMode.DUTCH && (
                  `Rodada registrada no bloco. Se o bloco de 3 fechar em prejuízo, avança para o próximo bloco (R$ ${nextBetOnLoss.toFixed(2)}).`
                )}
                {config.mode === ManagementMode.PADOVAN && (
                  `Avança para o Degrau ${lossState.currentLevel + 1} da sequência de Padovan (R$ ${nextBetOnLoss.toFixed(2)}).`
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* STREAK LOSS PROJECTION TABLE */}
      <div className="bg-[#18181b]/50 border border-white/5 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={14} className="text-amber-500" />
          <span className="text-xs uppercase font-black tracking-widest text-[#c6a34f] opacity-90">Projeção de Perdas Consecutivas</span>
        </div>
        
        {!compact && (
          <p className="text-xs text-zinc-400 mb-3 leading-relaxed">
            Simulação se as próximas rodadas forem derrotas seguidas. Útil para verificar se o saldo de sua banca de <strong className="text-white">R$ {initialBet * 20}</strong> está adequado para suportar a sequência de progressão escolhida:
          </p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2">
          {lossProjection.map((proj) => (
            <div key={proj.step} className="flex flex-col items-center bg-black/40 border border-white/[0.03] p-2.5 rounded-xl text-center">
              <span className="text-[10px] md:text-xs text-zinc-400 font-extrabold uppercase leading-none mb-1.5">Loss +{proj.step}</span>
              <span className="text-xs md:text-sm font-mono font-black text-[#c6a34f] leading-none mb-1.5">R$ {proj.betSize.toFixed(1)}</span>
              {config.mode === ManagementMode.SISTEMA_2_GANHOS && (
                <span className="text-[9px] md:text-xs text-zinc-500 font-bold leading-none">
                  +{Math.round((proj.betSize - initialBet) / initialBet)}u
                </span>
              )}
              {config.mode === ManagementMode.SISTEMA_2U_REC1 && (
                <span className="text-[9px] md:text-xs text-zinc-500 font-bold leading-none">
                  +{Math.round((proj.betSize - initialBet) / initialBet)}u
                </span>
              )}
              {config.mode === ManagementMode.D_ALEMBERT && (
                <span className="text-[9px] md:text-xs text-zinc-500 font-bold leading-none">
                  +{Math.round((proj.betSize - initialBet) / initialBet)}u
                </span>
              )}
              {config.mode === ManagementMode.MARTINGALE && (
                <span className="text-[9px] md:text-xs text-zinc-500 font-bold leading-none">
                  Gale {proj.level}
                </span>
              )}
              {![ManagementMode.SISTEMA_2_GANHOS, ManagementMode.SISTEMA_2U_REC1, ManagementMode.MARTINGALE, ManagementMode.D_ALEMBERT].includes(config.mode) && (
                <span className="text-[9px] md:text-xs text-zinc-500 font-bold leading-none">
                  Nível {proj.level}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
