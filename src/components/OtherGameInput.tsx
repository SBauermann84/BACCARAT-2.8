import React from 'react';
import { GameType, GameResult, ManagementConfig, ManagementMode, RiskProfile } from '../types';
import { getDynamicBetAndState } from '../engines/progressionEngine';
import { Sparkles, ArrowRight, Shield, ShieldAlert, Undo2, RefreshCw, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import BaccaratRoadmaps from './BaccaratRoadmaps';
import { useTranslation } from '../locales/translations';
import { useAppStore } from '../store/useAppStore';

interface OtherGameInputProps {
  gameType: GameType;
  history: GameResult[];
  onResultClick: (result: string) => void;
  onUndo: () => void;
  onReset: () => void;
  config: ManagementConfig;
  activeSignal?: any;
  isAutoPaused?: boolean;
}

const OtherGameInput: React.FC<OtherGameInputProps> = ({ 
  gameType, 
  history, 
  onResultClick, 
  onUndo, 
  onReset,
  config,
  activeSignal,
  isAutoPaused = false
}) => {
  const { tEntry } = useTranslation();
  const beadScrollRef = React.useRef<HTMLDivElement>(null);
  const updateBankroll = useAppStore(state => state.updateBankroll);

  const scrollBead = (direction: 'left' | 'right') => {
    if (beadScrollRef.current) {
      const scrollAmount = direction === 'left' ? -150 : 150;
      beadScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const getOptions = () => {
    switch (gameType) {
      case GameType.BACCARAT:
        return [
          { label: 'PLAYER', value: 'P', color: 'bg-gradient-to-br from-blue-600 to-blue-800 border-blue-500/20 text-white hover:from-blue-500 hover:to-blue-700' },
          { label: 'TIE', value: 'T', color: 'bg-gradient-to-br from-green-600 to-green-800 border-green-500/20 text-white hover:from-green-500 hover:to-green-700' },
          { label: 'BANKER', value: 'B', color: 'bg-gradient-to-br from-red-600 to-red-800 border-red-500/20 text-white hover:from-red-500 hover:to-red-700' },
        ];
      default:
        return [];
    }
  };

  const options = getOptions();

  // Dynamic progression calculations for Baccarat (positionCount is 1)
  const currentState = getDynamicBetAndState(history, config, 1);
  const currentBet = currentState.currentBetSize;
  const initialBet = config.initialBet || 1.0;

  // Let's calculate simulated next steps in line
  // Simulate WIN
  const simulatedWinHistory: GameResult[] = [
    {
      id: 'sim_win',
      gameType,
      result: 'PLAYER',
      timestamp: Date.now(),
      sessionId: 'sim',
      metadata: {},
      isWin: true
    },
    ...history
  ];
  const nextBetOnWin = getDynamicBetAndState(simulatedWinHistory, config, 1).currentBetSize;

  // Simulate LOSS
  const simulatedLossHistory: GameResult[] = [
    {
      id: 'sim_loss',
      gameType,
      result: 'PLAYER',
      timestamp: Date.now(),
      sessionId: 'sim',
      metadata: {},
      isWin: false
    },
    ...history
  ];
  const nextBetOnLoss = getDynamicBetAndState(simulatedLossHistory, config, 1).currentBetSize;

  const getRiskLabel = (profile: RiskProfile) => {
    switch (profile) {
      case RiskProfile.CONSERVATIVE: return 'Conservador';
      case RiskProfile.MODERATE: return 'Moderado';
      case RiskProfile.AGGRESSIVE: return 'Agressivo';
      default: return 'Personalizado';
    }
  };

  const getModeLabel = (mode: ManagementMode) => {
    switch (mode) {
      case ManagementMode.MARTINGALE: return 'Martingale';
      case ManagementMode.STAR_2_2: return 'Star 2.2';
      case ManagementMode.STAR_2_0: return 'Star 2.0';
      case ManagementMode.DUTCH: return 'Holandês';
      case ManagementMode.PADOVAN: return 'Padovan';
      case ManagementMode.SOROS: return 'Soros';
      case ManagementMode.FIBONACCI: return 'Fibonacci';
      case ManagementMode.CYCLIC: return 'Cíclico';
      case ManagementMode.FIXED: return 'Mão Fixa';
      case ManagementMode.SISTEMA_2_GANHOS: return 'Sistema 2 Ganhos';
      case ManagementMode.SISTEMA_2U_REC1: return 'Sistema +2U / -1U';
      case ManagementMode.D_ALEMBERT: return 'D\'Alembert';
      case ManagementMode.NIVEL_FIXO_RECUPERACAO: return 'NFR84';
      default: return 'Gestão de Mão';
    }
  };

  // Cover tie protection (Baccarat specific)
  const tieCoverAmount = config.coverTie ? Math.max(1, Math.round(currentBet * 0.1)) : 0;

  const renderBaccaratGrid = () => {
    const chronoHistory = [...history].reverse();
    return (
      <div className="w-full mb-4">
        <BaccaratRoadmaps history={chronoHistory} />
      </div>
    );
  };

  return (
    <div className="bg-[#111111] relative overflow-hidden p-6 rounded-3xl border border-[#c6a34f]/10 shadow-[0_4px_24px_rgba(0,0,0,0.5)] space-y-6">
      
      {isAutoPaused && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-md rounded-3xl z-40 flex flex-col items-center justify-center text-center p-6 space-y-4 animate-fade-in">
          <div className="p-4 bg-red-500/15 rounded-full text-red-500 border border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
            <ShieldAlert size={40} className="animate-pulse" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg md:text-xl font-bold uppercase tracking-wider text-red-400">Auto-Pause Ativo</h3>
            <p className="text-xs md:text-sm text-zinc-300 max-w-md px-4 leading-relaxed">
              As operações foram bloqueadas preventivamente para proteção de patrimônio pois seu limite de <strong>Stop Win</strong> ou <strong>Stop Loss</strong> da banca foi atingido.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={onReset}
              className="px-5 py-2.5 rounded-xl bg-red-600 border border-red-500/20 text-white text-xs font-black uppercase tracking-wider hover:bg-red-500 transition-all cursor-pointer shadow-lg shadow-red-500/10 active:scale-95"
            >
              Resetar Histórico (Começar de Novo)
            </button>
          </div>
          <div className="text-[10px] text-white/45">
            Nota: É possível habilitar/desabilitar o Auto-Pause nas Configurações.
          </div>
        </div>
      )}

      {/* Dynamic Grid for Baccarat */}
      {gameType === GameType.BACCARAT && renderBaccaratGrid()}

      {/* ACTIVE RECOMMENDATION ALERT */}
      {activeSignal ? (
        <div className="bg-[#c6a34f]/5 border border-[#c6a34f]/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 self-start sm:self-center">
            <div className="w-10 h-10 rounded-xl bg-[#c6a34f]/10 flex items-center justify-center text-[#c6a34f] shrink-0">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-1.5 leading-none mb-1">
                <p className="text-[10px] text-white/40 uppercase font-black tracking-widest">
                  {currentState.currentLevel > 0 ? `MODO RECUPERAÇÃO` : 'SINAL CONFIRMADO - ENTRADA ATIVA'}
                </p>
                {currentState.currentLevel > 0 && (
                  <span className="bg-red-500/20 text-red-400 text-[8px] px-1.5 py-0.5 rounded font-black tracking-widest uppercase border border-red-500/30 animate-pulse">
                    GALE G{currentState.currentLevel}
                  </span>
                )}
              </div>
              <h5 className="text-sm font-black text-white uppercase tracking-wide mt-0.5">
                {activeSignal.patternName}
              </h5>
              <p className="text-xs md:text-[13px] text-zinc-300 mt-1 font-medium">
                {currentState.currentLevel === 0 ? (
                  <>
                    Entrada G0: Entrada Inicial: Apostar{' '}
                    <strong className="text-[#c6a34f] font-mono font-black text-base">R$ {currentBet.toFixed(2)}</strong> na casa:{' '}
                  </>
                ) : (
                  <>
                    GALE G{currentState.currentLevel}: Apostar{' '}
                    <strong className="text-[#c6a34f] font-mono font-black text-base">R$ {currentBet.toFixed(2)}</strong> na casa:{' '}
                  </>
                )}
                <strong className="text-white uppercase underline decoration-amber-500/40 font-black">{tEntry(activeSignal.entry)}</strong>
              </p>
            </div>
          </div>

          <div className="px-4 py-2 rounded-xl bg-black/60 border border-white/5 text-center font-bold self-stretch sm:self-auto flex sm:flex-col justify-between items-center sm:justify-center">
            <span className="text-[10px] text-zinc-400 font-black uppercase tracking-wider block leading-none mb-1">Confiabilidade</span>
            <span className="text-lg font-mono font-black text-emerald-400">{activeSignal.confidence}%</span>
          </div>
        </div>
      ) : (
        <div className="bg-zinc-900/50 border border-zinc-800/40 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-zinc-800/40 flex items-center justify-center text-zinc-400 shrink-0">
            <ShieldAlert size={16} />
          </div>
          <p className="text-xs text-zinc-400 font-medium">
            Aguardando padrão confluente do analisador. O teclado de registro manual de rodadas abaixo atualizará sua sequência de gestão.
          </p>
        </div>
      )}



      {/* INPUT PANEL KEYBOARD */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-[#c6a34f]">Entrada Rápida de Rodadas</h3>
          <span className="text-[11px] text-zinc-400 font-bold uppercase">Selecione o resultado</span>
        </div>
        
        <div className="grid grid-cols-3 gap-3">
          {options.map((opt) => {
            // Is this option currently recommended?
            const isTarget = activeSignal && activeSignal.entry && (
              activeSignal.entry.toLowerCase() === opt.label.toLowerCase() ||
              (opt.value === 'P' && activeSignal.entry.toLowerCase() === 'player') ||
              (opt.value === 'B' && activeSignal.entry.toLowerCase() === 'banker') ||
              (opt.value === 'T' && (activeSignal.entry.toLowerCase() === 'tie' || activeSignal.entry.toLowerCase() === 'empate'))
            );

            return (
              <button
                key={opt.value}
                onClick={() => onResultClick(opt.value)}
                className={`${opt.color} ${isTarget ? 'ring-2 ring-[#c6a34f] ring-offset-2 ring-offset-[#111111] shadow-[0_0_15px_rgba(198,163,79,0.3)] scale-[1.02]' : ''} py-3 px-2 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all duration-200 active:scale-95 shadow-md border border-white/10 relative overflow-hidden group cursor-pointer`}
              >
                {isTarget && (
                  <div className="absolute top-1 right-1 flex items-center gap-0.5 bg-black/70 px-1.5 py-0.2 rounded text-[9px] font-black text-[#c6a34f] border border-[#c6a34f]/30">
                    <Sparkles size={8} /> SINAL
                  </div>
                )}
                
                <span className="text-white font-black text-sm md:text-base tracking-tight group-hover:scale-105 transition-transform">{opt.label}</span>
                <span className="text-white/80 font-mono text-[11px] font-bold">
                  {isTarget ? `R$ ${currentBet.toFixed(0)}` : 'Registrar'}
                </span>
                {isTarget && tieCoverAmount > 0 && opt.value !== 'T' && (
                  <span className="text-[9px] text-green-300 font-black opacity-90 block leading-tight">
                    +R$ {tieCoverAmount.toFixed(0)} TIE
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* QUICK PREVIEW AT HOME ROAD OF PROGRESSION TRANSITIONS */}
      <div className="pt-2 border-t border-white/5 space-y-4">
        {/* OPERATIONS ACTIONS */}
        <div className="flex gap-2.5">
          <button 
            type="button"
            onClick={onUndo}
            className="flex-1 py-3.5 rounded-xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-wider text-zinc-300 hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Undo2 size={14} />
            Corrigir Último
          </button>
          
          <button 
            type="button"
            onClick={onReset}
            className="flex-1 py-3.5 rounded-xl bg-red-600/5 border border-red-500/15 text-xs font-black uppercase tracking-wider text-red-400 hover:bg-red-600/10 hover:text-red-300 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw size={14} />
            Resetar Rodadas
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-emerald-500/[0.02] border border-emerald-500/10 rounded-xl p-3.5">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[9px] md:text-xs text-emerald-500 font-extrabold uppercase tracking-widest">SE GANHAR (WIN)</span>
              <span className="text-xs md:text-sm font-mono font-black text-emerald-400">➔ R$ {nextBetOnWin.toFixed(2)}</span>
            </div>
            <p className="text-xs text-zinc-400 leading-normal">
              {config.mode === ManagementMode.FIXED && 'Mão fixa mantida.'}
              {config.mode === ManagementMode.MARTINGALE && 'Retorna à mão inicial.'}
              {config.mode === ManagementMode.SOROS && 'Incorpora lucro na aposta.'}
              {config.mode === ManagementMode.FIBONACCI && 'Recua 2 graus na progressão.'}
              {config.mode === ManagementMode.CYCLIC && 'Reseta nível de aposta.'}
              {config.mode === ManagementMode.SISTEMA_2_GANHOS && currentState.consecutiveWins === 1 ? 'Vitória dupla reduz 1 unidade base.' : 'Aposta mantida ou aguardando rodada.'}
              {config.mode === ManagementMode.STAR_2_2 && (currentState.consecutiveWins === 1 ? 'Vitória consecutiva fecha ciclo em lucro!' : 'Prepara 2ª mão no mesmo degrau (1.5x).')}
              {config.mode === ManagementMode.STAR_2_0 && (currentState.consecutiveWins === 1 ? 'Vitória consecutiva fecha ciclo em lucro!' : 'Prepara 2ª mão do ciclo (dobra).')}
              {config.mode === ManagementMode.DUTCH && 'Ao fechar o bloco de 3: reseta se lucrativo.'}
              {config.mode === ManagementMode.PADOVAN && 'Reseta ao início da sequência.'}
              {config.mode === ManagementMode.SISTEMA_2U_REC1 && 'Reduz uma unidade da entrada.'}
              {config.mode === ManagementMode.D_ALEMBERT && 'Desce 1 unidade base.'}
              {config.mode === ManagementMode.NIVEL_FIXO_RECUPERACAO && 'Se o saldo estiver positivo, reseta para a Entrada Base. Caso contrário, repete o mesmo nível (NFR84).'}
            </p>
          </div>

          <div className="bg-red-500/[0.02] border border-red-500/10 rounded-xl p-3.5">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[9px] md:text-xs text-red-500 font-extrabold uppercase tracking-widest">SE PERDER (LOSS)</span>
              <span className="text-xs md:text-sm font-mono font-black text-red-400">➔ R$ {nextBetOnLoss.toFixed(2)}</span>
            </div>
            <p className="text-xs text-zinc-400 leading-normal">
              {config.mode === ManagementMode.FIXED && 'Mão preserva valor plano.'}
              {config.mode === ManagementMode.MARTINGALE && 'Dobra valor atual de Gale.'}
              {config.mode === ManagementMode.SOROS && 'Reseta para nível base.'}
              {config.mode === ManagementMode.FIBONACCI && 'Sobe 1 degrau na sequência.'}
              {config.mode === ManagementMode.CYCLIC && 'Passa de nível no ciclo.'}
              {config.mode === ManagementMode.SISTEMA_2_GANHOS && 'Sobe 1 unidade na escala.'}
              {config.mode === ManagementMode.STAR_2_2 && 'Avança 1 degrau na escala Star 2.2 [1,1,2,2,3,4,5,7,9,12]U.'}
              {config.mode === ManagementMode.STAR_2_0 && 'Avança 1 degrau na escala Star 2.0.'}
              {config.mode === ManagementMode.DUTCH && 'Mantém dentro do bloco de 3 rodadas; avança 1 degrau ao fechar bloco em prejuízo.'}
              {config.mode === ManagementMode.PADOVAN && 'Avança 1 degrau na sequência de Padovan [1,1,1,2,2,3,4,5,7,9,12...]U.'}
              {config.mode === ManagementMode.SISTEMA_2U_REC1 && 'Sobe +2 unidades na escala.'}
              {config.mode === ManagementMode.D_ALEMBERT && 'Sobe 1 unidade base.'}
              {config.mode === ManagementMode.NIVEL_FIXO_RECUPERACAO && 'Avança para o próximo nível (Entrada Base ➔ G1 ➔ G2 ➔ ... de acordo com NFR84).'}
            </p>
          </div>
        </div>
      </div>

    </div>
  );
};

export default OtherGameInput;
