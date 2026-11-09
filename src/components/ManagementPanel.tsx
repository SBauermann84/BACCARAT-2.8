import React, { useMemo, useEffect, useState } from 'react';
import { GameType, ManagementMode, ManagementConfig, RiskProfile, Bankroll } from '../types';
import { Calculator, TrendingUp, ShieldAlert, Target, Info, Sparkles, BookOpen, X, CheckCircle, AlertTriangle, RotateCcw, Plus, Minus, Coins } from 'lucide-react';
import { calculateRecoveryBet, generateFibonacciSequence, generatePadovanSequence, getOptimalChipSize, calculateStopLossForLossSequence } from '../engines/progressionEngine';
import { ChipSelector } from './ChipSelector';

interface ManagementPanelProps {
  config: ManagementConfig;
  bankroll: Bankroll;
  history: any[];
  onChange: (update: Partial<ManagementConfig>) => void;
  onBankrollChange: (update: Partial<Bankroll>) => void;
  positionCount?: number;
}

interface StopLossCalculatorProps {
  config: ManagementConfig;
  bankroll: Bankroll;
  onBankrollChange: (update: Partial<Bankroll>) => void;
  positionCount?: number;
  currentModeLabel: string;
}

const StopLossInteractiveCalculator: React.FC<StopLossCalculatorProps> = ({
  config,
  bankroll,
  onBankrollChange,
  positionCount,
  currentModeLabel
}) => {
  const isBaccarat = config.gameTarget === GameType.BACCARAT;
  const defaultN = positionCount || (isBaccarat ? 1 : 30);
  const defaultChip = config.minChip && config.minChip > 0 ? config.minChip : 1.00;

  const [simBaseChip, setSimBaseChip] = useState<number>(defaultChip);
  const [simPositions, setSimPositions] = useState<number>(defaultN);
  const [simLossCount, setSimLossCount] = useState<number>(() => {
    return (config.levels !== undefined ? config.levels : 2) + 1;
  });
  const [showTable, setShowTable] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (positionCount && positionCount > 0) {
      setSimPositions(positionCount);
    }
  }, [positionCount]);

  const calculation = useMemo(() => {
    return calculateStopLossForLossSequence(config, simBaseChip, simPositions, simLossCount);
  }, [config, simBaseChip, simPositions, simLossCount]);

  const bankrollTotal = bankroll.initial || 1000;
  const stopLossValue = calculation.totalStopLossRequired;
  const bankrollPercent = bankrollTotal > 0 ? (stopLossValue / bankrollTotal) * 100 : 0;

  const isSafe = bankrollPercent <= 50;
  const isModerate = bankrollPercent > 50 && bankrollPercent <= 100;
  const isExceeded = bankrollPercent > 100;

  const handleApplyStopLoss = () => {
    onBankrollChange({ stopLoss: stopLossValue });
    setToastMessage(`Stop Loss de R$ ${stopLossValue.toFixed(2).replace('.', ',')} aplicado à sua banca!`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const chipPresets = [1.00, 5.00, 10.00, 25.00, 125.00, 500.00];
  const positionPresets = isBaccarat ? [1, 2, 3] : [30, 24, 18, 12, 11, 6, 1];
  const lossPresets = [3, 4, 5, 6, 7, 8, 10, 12];

  return (
    <div className="bg-[#111111] p-6 rounded-3xl border border-[#c6a34f]/30 space-y-6 shadow-[0_0_30px_rgba(198,163,79,0.05)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#c6a34f]/15 rounded-2xl border border-[#c6a34f]/30 text-[#c6a34f]">
            <ShieldAlert size={22} />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2 flex-wrap">
              Calculadora Interativa de Stop Loss para N Perdas
              <span className="text-[9px] px-2.5 py-0.5 rounded-full bg-[#c6a34f]/20 text-[#c6a34f] font-mono uppercase font-black border border-[#c6a34f]/30">
                Gestão Ativa: {currentModeLabel}
              </span>
            </h3>
            <p className="text-xs text-white/50">
              Simule a resistência necessária para suportar sequências de derrotas consecutivas na sua estratégia.
            </p>
          </div>
        </div>

        {toastMessage && (
          <div className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold animate-in fade-in duration-300 flex items-center gap-1.5 shrink-0">
            <CheckCircle size={14} /> {toastMessage}
          </div>
        )}
      </div>

      {/* Input controls grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 1. Ficha Base */}
        <div className="space-y-3 bg-black/30 p-4 rounded-2xl border border-white/5">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold uppercase text-[#c6a34f] tracking-wider flex items-center gap-1.5">
              <Calculator size={14} /> Ficha Base (R$)
            </label>
            <span className="text-[10px] font-mono text-zinc-400">por posição</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.05"
              min="0.05"
              value={simBaseChip}
              onChange={(e) => setSimBaseChip(Math.max(0.01, parseFloat(e.target.value) || 0.1))}
              className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-sm font-mono text-white font-bold focus:border-[#c6a34f] outline-none"
            />
            <span className="text-xs font-bold font-mono text-[#c6a34f]">R$</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {chipPresets.map(val => (
              <button
                type="button"
                key={val}
                onClick={() => setSimBaseChip(val)}
                className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold border transition-all cursor-pointer ${
                  Math.abs(simBaseChip - val) < 0.001
                    ? 'bg-[#c6a34f] text-black border-[#c6a34f]'
                    : 'bg-white/5 text-white/60 border-white/5 hover:bg-white/10'
                }`}
              >
                R$ {val.toFixed(2).replace('.', ',')}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Posições Apostadas */}
        <div className="space-y-3 bg-black/30 p-4 rounded-2xl border border-white/5">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold uppercase text-[#c6a34f] tracking-wider flex items-center gap-1.5">
              <Target size={14} /> Posições / Números
            </label>
            <span className="text-[10px] font-mono text-zinc-400">
              {isBaccarat ? 'Apostas' : 'Números cobertos'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              max="37"
              value={simPositions}
              onChange={(e) => setSimPositions(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-sm font-mono text-white font-bold focus:border-[#c6a34f] outline-none"
            />
            <span className="text-xs font-bold font-mono text-white/60">pos.</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {positionPresets.map(val => (
              <button
                type="button"
                key={val}
                onClick={() => setSimPositions(val)}
                className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold border transition-all cursor-pointer ${
                  simPositions === val
                    ? 'bg-[#c6a34f] text-black border-[#c6a34f]'
                    : 'bg-white/5 text-white/60 border-white/5 hover:bg-white/10'
                }`}
              >
                {val} {val === 1 ? 'Núm' : 'Números'}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Sequência de Perdas (N) */}
        <div className="space-y-3 bg-black/30 p-4 rounded-2xl border border-white/5">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold uppercase text-[#c6a34f] tracking-wider flex items-center gap-1.5">
              <AlertTriangle size={14} /> Sequência de Perdas (N)
            </label>
            <span className="text-[10px] font-mono text-zinc-400">derrotas seguidas</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              max="25"
              value={simLossCount}
              onChange={(e) => setSimLossCount(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-sm font-mono text-white font-bold focus:border-[#c6a34f] outline-none"
            />
            <span className="text-xs font-bold font-mono text-red-400">Perdas</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {lossPresets.map(val => (
              <button
                type="button"
                key={val}
                onClick={() => setSimLossCount(val)}
                className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold border transition-all cursor-pointer ${
                  simLossCount === val
                    ? 'bg-red-500 text-white border-red-500'
                    : 'bg-white/5 text-white/60 border-white/5 hover:bg-white/10'
                }`}
              >
                {val} Perdas
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Results */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Stop Loss Needed */}
        <div className="p-5 rounded-2xl bg-black/40 border border-[#c6a34f]/20 flex flex-col justify-between space-y-2">
          <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">
            Stop Loss Necessário ({simLossCount} Perdas)
          </span>
          <div className="text-2xl font-black font-mono text-[#c6a34f]">
            R$ {stopLossValue.toFixed(2).replace('.', ',')}
          </div>
          <span className="text-[9px] text-white/40 font-mono">
            {simPositions} posições × R$ {simBaseChip.toFixed(2).replace('.', ',')} base × progressão
          </span>
        </div>

        {/* Bankroll Impact % */}
        <div className="p-5 rounded-2xl bg-black/40 border border-white/5 flex flex-col justify-between space-y-2">
          <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">
            Uso da Banca Total (R$ {bankrollTotal.toFixed(2).replace('.', ',')})
          </span>
          <div className={`text-2xl font-black font-mono ${
            isSafe ? 'text-emerald-400' : isModerate ? 'text-yellow-400' : 'text-red-500'
          }`}>
            {bankrollPercent.toFixed(1).replace('.', ',')}%
          </div>
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                isSafe ? 'bg-emerald-500' : isModerate ? 'bg-yellow-400' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(100, bankrollPercent)}%` }}
            />
          </div>
        </div>

        {/* Risk Diagnosis & Apply Action */}
        <div className="p-5 rounded-2xl bg-black/40 border border-white/5 flex flex-col justify-between space-y-3">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${
              isSafe ? 'bg-emerald-500 animate-pulse' : isModerate ? 'bg-yellow-400 animate-pulse' : 'bg-red-500 animate-bounce'
            }`} />
            <span className={`text-xs font-black uppercase tracking-wider ${
              isSafe ? 'text-emerald-400' : isModerate ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {isSafe ? 'Banca Segura' : isModerate ? 'Risco Moderado' : 'Banca Insuficiente'}
            </span>
          </div>

          <p className="text-[10px] text-zinc-300 leading-relaxed font-medium">
            {isSafe && 'Sua banca atual cobre esta sequência de perdas com excelente margem de segurança.'}
            {isModerate && 'Sua banca cobre o valor, mas compromete mais de 50% do capital total.'}
            {isExceeded && `A banca de R$ ${bankrollTotal.toFixed(2)} é insuficiente para suportar ${simLossCount} perdas com esta ficha.`}
          </p>

          <button
            type="button"
            onClick={handleApplyStopLoss}
            className="w-full py-2.5 px-4 rounded-xl bg-[#c6a34f] hover:bg-[#c6a34f]/90 text-black text-xs font-black uppercase tracking-wider transition-all shadow-[0_4px_15px_rgba(198,163,79,0.3)] flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <CheckCircle size={14} /> Definir como meu Stop Loss
          </button>
        </div>
      </div>

      {/* Collapsible Step Detail Table */}
      <div className="space-y-3 pt-2 border-t border-white/5">
        <button
          type="button"
          onClick={() => setShowTable(!showTable)}
          className="flex items-center justify-between w-full p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/5 text-left transition-all cursor-pointer"
        >
          <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
            <TrendingUp size={14} className="text-[#c6a34f]" />
            Detalhamento Passo a Passo ({simLossCount} Rodadas)
          </div>
          <span className="text-[10px] font-mono font-bold text-[#c6a34f] uppercase">
            {showTable ? 'Ocultar Tabela ▲' : 'Expandir Tabela ▼'}
          </span>
        </button>

        {showTable && (
          <div className="overflow-x-auto rounded-2xl border border-white/5 bg-black/40 animate-in fade-in duration-300 custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-white/5 border-b border-white/5 text-[9px] uppercase tracking-widest text-white/50 font-bold">
                  <th className="p-3">Rodada</th>
                  <th className="p-3">Unidades (u)</th>
                  <th className="p-3">Ficha p/ Posição</th>
                  <th className="p-3">Aposta na Mesa</th>
                  {config.coverZero || config.coverTie ? <th className="p-3">Proteção</th> : null}
                  <th className="p-3">Total Rodada</th>
                  <th className="p-3 text-right">Prejuízo Acumulado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {calculation.steps.map((step) => (
                  <tr key={step.step} className="hover:bg-white/[0.02] transition-all">
                    <td className="p-3 font-bold text-[#c6a34f]">
                      Perda #{step.step}
                    </td>
                    <td className="p-3 text-white/80 font-bold">
                      {step.units} u
                    </td>
                    <td className="p-3 text-zinc-300">
                      R$ {step.chipValue.toFixed(2).replace('.', ',')}
                    </td>
                    <td className="p-3 text-zinc-200 font-semibold">
                      R$ {step.mainBet.toFixed(2).replace('.', ',')}
                    </td>
                    {config.coverZero || config.coverTie ? (
                      <td className="p-3 text-amber-400">
                        R$ {step.protectionBet.toFixed(2).replace('.', ',')}
                      </td>
                    ) : null}
                    <td className="p-3 font-bold text-white">
                      R$ {step.totalStepBet.toFixed(2).replace('.', ',')}
                    </td>
                    <td className="p-3 font-black text-red-400 text-right">
                      R$ {step.accumulatedLoss.toFixed(2).replace('.', ',')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export const ManagementPanel: React.FC<ManagementPanelProps> = ({ config, bankroll, history, onChange, onBankrollChange, positionCount }) => {
  const [showGuide, setShowGuide] = useState(false);
  const [selectedGuideMode, setSelectedGuideMode] = useState<ManagementMode>(config.mode);

  const isRoulette = false;

  const handleChipValueChange = (levelIdx: number, valStr: string) => {
    const cleanStr = valStr.replace(',', '.');
    const val = parseFloat(cleanStr);
    
    const currentManualChips = config.manualGaleChips ? [...config.manualGaleChips] : [];
    
    while (currentManualChips.length <= levelIdx) {
      currentManualChips.push(null as any);
    }
    
    if (isNaN(val) || val <= 0) {
      currentManualChips[levelIdx] = null as any;
    } else {
      currentManualChips[levelIdx] = Number(val.toFixed(2));
    }
    
    while (currentManualChips.length > 0 && currentManualChips[currentManualChips.length - 1] === null) {
      currentManualChips.pop();
    }
    
    onChange({
      manualGaleChips: currentManualChips.length > 0 ? currentManualChips : undefined,
      profile: RiskProfile.CUSTOM
    });
  };

  const handleAdjustChipValue = (levelIdx: number, delta: number) => {
    const currentProg = progressions[levelIdx];
    if (!currentProg) return;
    
    const currentValue = currentProg.chipValue;
    const newValue = Math.max(0.10, Number((currentValue + delta).toFixed(2)));
    
    handleChipValueChange(levelIdx, newValue.toString());
  };

  const handleResetChip = (levelIdx: number) => {
    if (!config.manualGaleChips) return;
    const currentManualChips = [...config.manualGaleChips];
    if (levelIdx < currentManualChips.length) {
      currentManualChips[levelIdx] = null as any;
    }
    
    while (currentManualChips.length > 0 && currentManualChips[currentManualChips.length - 1] === null) {
      currentManualChips.pop();
    }
    
    onChange({
      manualGaleChips: currentManualChips.length > 0 ? currentManualChips : undefined
    });
  };

  const handleResetAllChips = () => {
    onChange({
      manualGaleChips: undefined
    });
  };

  const progressions = useMemo(() => {
    if (!config) return [];
    const levels = [];
    
    const levelsCount = config.levels !== undefined ? config.levels : 10;
    const multiplier = config.multiplier || 2;
    const isRoulette = false;
    const isBaccarat = config.gameTarget === GameType.BACCARAT;

    const N = positionCount || (isBaccarat ? 1 : 11);
    
    // In units (u): Base chip size per number is 1 u
    const baseUnitChip = 1.0;
    const initialBetInUnits = Number((baseUnitChip * N).toFixed(1));
    
    let currentBetInUnits = initialBetInUnits;
    let totalInvestedUnits = 0;

    const fibSequence = generateFibonacciSequence(Math.max(30, levelsCount + 5));
    const padovanSequence = generatePadovanSequence(Math.max(30, levelsCount + 5));
    const star22Seq = [1, 1, 2, 2, 3, 4, 5, 7, 9, 12, 16, 21, 28, 37, 49, 65, 86, 114, 151, 200, 265, 351, 465, 616, 816];
    const star20Seq = [1, 1, 1, 1, 1, 1, 1, 1, 2, 3, 4, 5, 7, 9, 12, 16, 21, 28, 37, 49, 65, 86, 114, 151, 200, 265, 351, 465, 616, 816];

    for (let i = 1; i <= levelsCount + 1; i++) {
        let defaultLevelUnitChip = 1.0;

        if (config.mode === ManagementMode.MARTINGALE) {
          defaultLevelUnitChip = Math.pow(multiplier, i - 1);
        } else if (config.mode === ManagementMode.FIBONACCI) {
          defaultLevelUnitChip = fibSequence[i - 1] || fibSequence[fibSequence.length - 1];
        } else if (config.mode === ManagementMode.FIXED) {
          defaultLevelUnitChip = 1.0;
        } else if (config.mode === ManagementMode.CYCLIC) {
          const cycle = [1, 2, 4, 8, 16];
          defaultLevelUnitChip = cycle[(i - 1) % cycle.length] || 1;
        } else if (config.mode === ManagementMode.SISTEMA_2_GANHOS) {
          defaultLevelUnitChip = i;
        } else if (config.mode === ManagementMode.SISTEMA_2U_REC1) {
          defaultLevelUnitChip = 1 + 2 * (i - 1);
        } else if (config.mode === ManagementMode.D_ALEMBERT) {
          defaultLevelUnitChip = i;
        } else if (config.mode === ManagementMode.NIVEL_FIXO_RECUPERACAO) {
          defaultLevelUnitChip = i;
        } else if (config.mode === ManagementMode.STAR_2_2) {
          defaultLevelUnitChip = (i - 1) < star22Seq.length ? star22Seq[i - 1] : star22Seq[star22Seq.length - 1];
        } else if (config.mode === ManagementMode.STAR_2_0) {
          defaultLevelUnitChip = (i - 1) < star20Seq.length ? star20Seq[i - 1] : star20Seq[star20Seq.length - 1];
        } else if (config.mode === ManagementMode.DUTCH) {
          const dutchIdx = Math.floor((i - 1) / 3);
          defaultLevelUnitChip = 1 + dutchIdx * 2;
        } else if (config.mode === ManagementMode.PADOVAN) {
          defaultLevelUnitChip = (i - 1) < padovanSequence.length ? padovanSequence[i - 1] : padovanSequence[padovanSequence.length - 1];
        } else {
          defaultLevelUnitChip = Number((currentBetInUnits / N).toFixed(1));
        }

        let levelUnitChip = defaultLevelUnitChip;
        const hasManualOverride = config.manualGaleChips && config.manualGaleChips[i-1] !== undefined && config.manualGaleChips[i-1] !== null && config.manualGaleChips[i-1] > 0;
        if (hasManualOverride) {
          levelUnitChip = config.manualGaleChips![i-1];
        }

        let mainBetInUnits = Number((levelUnitChip * N).toFixed(1));
        let protectionBetInUnits = 0;
        
        if (isRoulette) {
          if (config.coverZero) {
            protectionBetInUnits = (config.unitsZero !== undefined ? config.unitsZero : 1.0) * levelUnitChip;
          }
        } else if (isBaccarat && config.coverTie) {
          protectionBetInUnits = (config.unitsTier !== undefined ? config.unitsTier : 1.0) * levelUnitChip;
        }

        const totalBetInUnits = mainBetInUnits + protectionBetInUnits;
        totalInvestedUnits += totalBetInUnits;
        
        const payoutUnits = isBaccarat ? (mainBetInUnits * 2) : Number((levelUnitChip * 36).toFixed(1));
        const protectionPayoutUnits = protectionBetInUnits * (isRoulette ? 36 : (isBaccarat ? 9 : 0));

        levels.push({
          level: i,
          bet: mainBetInUnits,
          chipValue: levelUnitChip,
          isManual: hasManualOverride,
          defaultChipValue: defaultLevelUnitChip,
          protection: protectionBetInUnits,
          totalBet: totalBetInUnits,
          accumulated: totalInvestedUnits,
          profit: payoutUnits - totalInvestedUnits,
          protectionProfit: protectionPayoutUnits > 0 ? protectionPayoutUnits - totalInvestedUnits : 0
        });

        if (config.mode === ManagementMode.MARTINGALE) {
          currentBetInUnits = initialBetInUnits * Math.pow(multiplier, i);
        } else if (config.mode === ManagementMode.FIBONACCI) {
          currentBetInUnits = initialBetInUnits * (fibSequence[i] || fibSequence[fibSequence.length - 1]);
        } else if (config.mode === ManagementMode.STAR_2_2) {
          currentBetInUnits = initialBetInUnits * (i < star22Seq.length ? star22Seq[i] : star22Seq[star22Seq.length - 1]);
        } else if (config.mode === ManagementMode.STAR_2_0) {
          currentBetInUnits = initialBetInUnits * (i < star20Seq.length ? star20Seq[i] : star20Seq[star20Seq.length - 1]);
        } else if (config.mode === ManagementMode.DUTCH) {
          const dutchIdx = Math.floor(i / 3);
          currentBetInUnits = initialBetInUnits * (1 + dutchIdx * 2);
        } else if (config.mode === ManagementMode.PADOVAN) {
          currentBetInUnits = initialBetInUnits * (i < padovanSequence.length ? padovanSequence[i] : padovanSequence[padovanSequence.length - 1]);
        } else {
          currentBetInUnits = initialBetInUnits * (i + 1);
        }
    }
    return levels;
  }, [config, positionCount]);

  const modes = [
    { id: ManagementMode.MARTINGALE, label: 'Martingale', desc: 'Recuperação agressiva.' },
    { id: ManagementMode.STAR_2_2, label: 'Star 2.2', desc: 'Escala [1,1,2,2,3,4,5,7,9,12]U para 2 vitórias seguidas.' },
    { id: ManagementMode.STAR_2_0, label: 'Star 2.0', desc: 'Estágio 1 (1U com parlay) e Estágio 2 [1,2,3,4,5,7,9,12]U. Busca 2 vitórias seguidas.' },
    { id: ManagementMode.DUTCH, label: 'Gerenciamento Holandês', desc: 'Blocos de 3 apostas na escala [1,3,5,7,9,11...]U.' },
    { id: ManagementMode.PADOVAN, label: 'Sequência de Padovan', desc: 'Progressão suave [1,1,1,2,2,3,4,5,7,9,12...]U.' },
    { id: ManagementMode.SOROS, label: 'Soros', desc: 'Alavancagem de lucros.' },
    { id: ManagementMode.FIBONACCI, label: 'Fibonacci', desc: 'Progressão matemática suave.' },
    { id: ManagementMode.FIXED, label: 'Mão Fixa', desc: 'Consistência linear.' },
    { id: ManagementMode.CYCLIC, label: 'Sistema de Ciclos (Cyclic)', desc: 'Ciclos sequenciais de multiplicadores.' },
    { id: ManagementMode.SISTEMA_2_GANHOS, label: 'Sistema 2 Ganhos', desc: 'Win 2 seguidas recua -1U | Loss +1U.' },
    { id: ManagementMode.SISTEMA_2U_REC1, label: 'Sistema +2U / -1U', desc: 'Loss +2U | Win no gale -1U.' },
    { id: ManagementMode.D_ALEMBERT, label: 'D\'Alembert', desc: 'Perda +1U | Ganho -1U.' },
    { id: ManagementMode.OSCARS_GRIND, label: 'Oscar\'s Grind', desc: 'Soma +1U no Win (limite +1U de ciclo) | Loss mantém.' },
    { id: ManagementMode.LABOUCHERE, label: 'Labouchere', desc: 'Soma pontas. Win elimina | Loss adiciona perda à lista.' },
    { id: ManagementMode.REVERSE_MARTINGALE, label: 'Martingale Reverso', desc: 'Dobra no Win até limite de níveis | Loss reseta.' },
    { id: ManagementMode.SYSTEM_1326, label: 'Sistema 1-3-2-6', desc: 'Ciclo positivo [1, 3, 2, 6] no Win | Loss reseta.' },
    { id: ManagementMode.KELLY_CRITERION, label: 'Critério de Kelly', desc: 'Fração dinâmica (2%) baseada na banca atual.' },
    { id: ManagementMode.NIVEL_FIXO_RECUPERACAO, label: 'NFR84', desc: 'Sobe nível no Loss. Mantém nível no Win se saldo for negativo. Reseta ao recuperar.' }
  ];

  const guideData = {
    [ManagementMode.FIXED]: {
      name: 'Mão Fixa (Fixed Bet)',
      risk: 'Baixo',
      riskColor: 'text-green-400 bg-green-400/10 border-green-400/20',
      objective: 'Consistência linear e proteção absoluta do capital.',
      howItWorks: 'Todas as apostas têm exatamente o mesmo valor, independentemente se você ganhou ou perdeu a rodada anterior. Não há progressões ou aumentos.',
      pros: 'Mínimo risco de quebrar a banca rapidamente, fácil de executar e ideal para iniciantes ou estratégias de alta assertividade.',
      contras: 'Recuperação lenta de prejuízos. Exige uma taxa de acerto estritamente superior a 50% (em apostas de 1:1) para gerar lucro a longo prazo.',
      example: 'Você aposta R$ 10. Se vencer, ganha R$ 10 e aposta R$ 10 na próxima. Se perder, perde R$ 10 e continua apostando R$ 10.'
    },
    [ManagementMode.MARTINGALE]: {
      name: 'Martingale (Dobro)',
      risk: 'Extremo',
      riskColor: 'text-red-500 bg-red-500/10 border-red-500/20',
      objective: 'Garantir lucro de 1 unidade após qualquer sequência de perdas.',
      howItWorks: 'Após cada derrota, você multiplica o valor da aposta anterior pelo fator multiplicador (geralmente 2x). Ao vencer, você recupera todas as perdas anteriores acumuladas e obtém exatamente 1 unidade de lucro inicial, resetando a aposta para o valor base.',
      pros: 'Garante lucro constante no curto prazo, pois basta uma única vitória em qualquer nível para apagar todo o prejuízo anterior.',
      contras: 'Altamente perigoso. Sequências longas de derrotas consecutivas exigem capitais astronômicos e atingem rapidamente os limites máximos de aposta permitidos pelas mesas.',
      example: 'Aposta R$ 10 (perde) -> Aposta R$ 20 (perde) -> Aposta R$ 40 (perde) -> Aposta R$ 80 (vence). Você recupera os R$ 70 perdidos e ganha R$ 10 de lucro líquido.'
    },
    [ManagementMode.SOROS]: {
      name: 'Soros',
      risk: 'Médio',
      riskColor: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
      objective: 'Maximizar lucros aproveitando sequências de vitórias sucessivas.',
      howItWorks: 'Consiste em reinvestir o lucro da aposta vencedora na rodada seguinte (Aposta Base + Lucro Obtido). Você define um limite de níveis (ex: 3 níveis de Soros). Ao atingir a meta consecutiva, você guarda o lucro e reinicia com a aposta base. Se perder em qualquer etapa, perde apenas a unidade inicial.',
      pros: 'Risco controlado (você só arrisca perder o valor da primeira aposta base, os aumentos usam o dinheiro do cassino) com potencial de retornos exponenciais.',
      contras: 'Exige sequências ininterruptas de acertos para alcançar o objetivo. Uma única perda zera o progresso e consome a aposta base original.',
      example: 'Aposta R$ 10 (ganha R$ 10, total R$ 20) -> Aposta R$ 20 (ganha R$ 20, total R$ 40) -> Aposta R$ 40 (ganha R$ 40, total R$ 80). Ciclo completo: lucro de R$ 70 arriscando apenas R$ 10.'
    },
    [ManagementMode.FIBONACCI]: {
      name: 'Fibonacci',
      risk: 'Médio-Alto',
      riskColor: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
      objective: 'Recuperação progressiva menos agressiva que o Martingale.',
      howItWorks: 'Aposta seguindo os termos da famosa sequência matemática de Fibonacci [1, 1, 2, 3, 5, 8, 13, 21, 34, 55...]. Se perder, você avança 1 número na sequência para definir o multiplicador da próxima aposta. Se ganhar, você retrocede 2 números na sequência (ou reseta ao início se voltar abaixo de zero).',
      pros: 'Crescimento de aposta muito mais lento e controlado do que dobrar com Martingale, permitindo suportar sequências maiores de perdas consecutivas.',
      contras: 'Uma única vitória não zera todo o prejuízo acumulado; em sequências longas de derrotas, são necessárias múltiplas vitórias para retornar ao ponto de equilíbrio.',
      example: 'Aposta R$ 10 (perde) -> Aposta R$ 10 (perde) -> Aposta R$ 20 (perde) -> Aposta R$ 30 (perde) -> Aposta R$ 50 (ganha). Após a vitória, a próxima aposta retrocede 2 casas, voltando para R$ 20.'
    },
    [ManagementMode.D_ALEMBERT]: {
      name: "D'Alembert",
      risk: 'Baixo-Médio',
      riskColor: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
      objective: 'Equilíbrio matemático baseado na teoria da compensação.',
      howItWorks: 'Você define um valor de unidade fixa (geralmente igual à aposta base). Após cada derrota, você aumenta o valor da aposta em exatamente 1 unidade. Após cada vitória, você reduz o valor da aposta em exatamente 1 unidade (nunca caindo abaixo da aposta base).',
      pros: 'Extremamente seguro e equilibrado. Excelente para sessões longas onde o número de vitórias e derrotas tende a se igualar (50/50).',
      contras: 'Se você sofrer uma sequência inicial massiva de derrotas, as apostas se tornam altas e pode ser difícil recuperá-las quando as vitórias começarem de forma espaçada.',
      example: 'Aposta R$ 10 (perde) -> Aposta R$ 20 (perde) -> Aposta R$ 30 (ganha) -> Aposta R$ 20 (ganha) -> Aposta R$ 10.'
    },
    [ManagementMode.CYCLIC]: {
      name: 'Sistema de Ciclos (Cyclic)',
      risk: 'Alto',
      riskColor: 'text-red-400 bg-red-400/10 border-red-400/20',
      objective: 'Estabelecer limites fixos de tentativas de recuperação para evitar quebras.',
      howItWorks: 'Define-se um ciclo de multiplicadores sequenciais fixos (ex: 1x, 2x, 4x, 8x, 16x). Se perder, você avança para o próximo número do ciclo. Se vencer, reseta ao primeiro passo do ciclo. Caso complete todo o ciclo sem vitórias, você aceita a perda máxima daquela etapa e reinicia para proteger o restante da banca.',
      pros: 'Evita a ruína total da banca ao impor um freio automático (Stop Loss embutido) ao final de cada ciclo.',
      contras: 'Se você perder todas as etapas de um ciclo completo, aceita um prejuízo consolidado considerável que exigirá novos ciclos vencedores para recuperar.',
      example: 'Ciclo [10, 20, 40, 80]. Se perder as 3 primeiras e ganhar na de R$ 80, recupera as perdas e reseta para R$ 10. Se perder todas as 4, encerra com perda de R$ 150 e reinicia da base.'
    },
    [ManagementMode.SISTEMA_2_GANHOS]: {
      name: 'Sistema 2 Ganhos (Two Wins System)',
      risk: 'Médio',
      riskColor: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
      objective: 'Garantir lucros acumulados reduzindo apostas após sequências de vitória.',
      howItWorks: 'Se você perder, aumenta a aposta em 1 unidade (+1U). Se ganhar, você mantém o mesmo valor apostado. Se conseguir engatar duas vitórias consecutivas com esse mesmo valor elevado, o sistema reduz a aposta em 1 unidade (-1U) para travar os lucros obtidos na subida.',
      pros: 'Aproveita mini-tendências e oscilações do mercado sem rebaixar a aposta imediatamente na primeira vitória, otimizando o retorno médio.',
      contras: 'Em cenários com vitórias e derrotas alternadas (mão a mão), a aposta tende a subir gradativamente, exigindo 2 acertos seguidos para aliviar a carga.',
      example: 'Aposta R$ 10 (perde) -> Aposta R$ 20 (ganha, mantém) -> Aposta R$ 20 (ganha, duas seguidas!). O lucro é acumulado e a próxima aposta reduz para R$ 10.'
    },
    [ManagementMode.SISTEMA_2U_REC1]: {
      name: 'Sistema +2U / -1U (Recuperação Rápida)',
      risk: 'Alto',
      riskColor: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
      objective: 'Recuperação acelerada de saldo com poucas vitórias alternadas.',
      howItWorks: 'Focado em recuperar perdas de maneira veloz: se perder, aumenta a aposta em 2 unidades (+2U) de uma vez. Se ganhar, em vez de resetar tudo, reduz o valor em apenas 1 unidade (-1U). Isso garante que, mesmo que você perca uma rodada e ganhe outra, o saldo final suba rapidamente.',
      pros: 'Recupera o prejuízo de várias perdas com apenas uma ou duas rodadas vencedoras, sem a necessidade de vitórias consecutivas perfeitas.',
      contras: 'O aumento de +2U nas perdas expõe a banca de forma rápida e agressiva. Não recomendado para bancas pequenas ou sem stop-loss estrito.',
      example: 'Aposta R$ 10 (perde) -> Aposta R$ 30 (perde) -> Aposta R$ 50 (ganha). Reduz 1 unidade para a próxima aposta, indo para R$ 40.'
    },
    [ManagementMode.OSCARS_GRIND]: {
      name: "Oscar's Grind (Moagem de Oscar)",
      risk: 'Baixo-Médio',
      riskColor: 'text-green-400 bg-green-400/10 border-green-400/20',
      objective: 'Obter lucro estável de exatamente 1 unidade por ciclo de jogo.',
      howItWorks: 'O jogo é dividido em mini-ciclos focados em ganhar exatamente 1 unidade (+1U) de lucro líquido. Se você perder, o valor da aposta seguinte permanece IGUAL. Se ganhar, você aumenta o valor da aposta seguinte em exatamente 1 unidade (+1U), limitando o aumento para que o lucro final do ciclo não ultrapasse +1U.',
      pros: 'Extremamente seguro contra sequências de perdas, pois as apostas não aumentam enquanto você estiver perdendo, apenas quando as vitórias começam.',
      contras: 'Pode demorar muitas rodadas para encerrar um ciclo caso as vitórias fiquem muito dispersas, gerando sessões de moagem longas.',
      example: 'Aposta R$ 10 (perde, ciclo: -10) -> Aposta R$ 10 (perde, ciclo: -20) -> Aposta R$ 10 (ganha, ciclo: -10) -> Aposta R$ 20 (ganha, ciclo: +10). Meta de +10 atingida, o ciclo fecha positivo e reinicia em R$ 10.'
    },
    [ManagementMode.LABOUCHERE]: {
      name: 'Labouchere (Sistema de Cancelamento)',
      risk: 'Alto',
      riskColor: 'text-orange-500 bg-orange-500/10 border-orange-500/20',
      objective: 'Concluir uma meta de lucro fatiada em pequenas frações.',
      howItWorks: 'Você inicia com uma sequência numérica, por exemplo: [1, 2, 3] (representando unidades da aposta). Sua aposta será sempre a soma do primeiro com o último número da lista (1+3 = 4 unidades). Se vencer, você risca os dois números usados. Se perder, você adiciona o valor total perdido ao final da lista. O ciclo termina quando todos os números forem riscados.',
      pros: 'Altamente matemático e personalizável. Você obtém lucro completo da meta mesmo se perder mais de 50% das rodadas (cerca de 33% de taxa de acerto é suficiente).',
      contras: 'Sequências ruins iniciais esticam muito a sequência, fazendo com que as somas das pontas aumentem rapidamente de valor.',
      example: 'Lista [10, 20, 30] -> Aposta R$ 40. Se perder, a lista vira [10, 20, 30, 40] e a próxima aposta é R$ 50. Se ganhar, a lista reduz para [20] e a próxima aposta é R$ 20.'
    },
    [ManagementMode.REVERSE_MARTINGALE]: {
      name: 'Martingale Reverso (Parlay)',
      risk: 'Médio',
      riskColor: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
      objective: 'Explorar sequências de sorte (streaks) com o mínimo risco possível.',
      howItWorks: 'O oposto do Martingale tradicional. Nas derrotas, você mantém a aposta sempre no mínimo (aposta base), protegendo sua banca. Quando você vence, você dobra o valor da aposta na rodada seguinte. Você determina um limite de vitórias consecutivas (ex: 3 passos). Se atingir esse limite, recolhe todo o lucro acumulado e reinicia na base.',
      pros: 'Risco extremamente baixo por tentativa (você só perde 1 unidade inicial da própria banca, o resto é lucro reinvestido). Retornos altíssimos em rodadas de sorte consecutiva.',
      contras: 'Uma única derrota em qualquer nível da progressão apaga todo o lucro acumulado no ciclo atual, devolvendo você ao início.',
      example: 'Aposta R$ 10 (vence) -> Aposta R$ 20 (vence) -> Aposta R$ 40 (vence). Você acumulou R$ 70 de lucro arriscando apenas R$ 10 da sua própria banca.'
    },
    [ManagementMode.SYSTEM_1326]: {
      name: 'Sistema 1-3-2-6',
      risk: 'Baixo-Médio',
      riskColor: 'text-green-400 bg-green-400/10 border-green-400/20',
      objective: 'Potencializar ganhos em sequências vitoriosas com trava de segurança de lucro.',
      howItWorks: 'Progressão positiva que dita multiplicadores específicos nas vitórias seguidas: 1x, 3x, 2x e finalmente 6x. Se perder em qualquer uma das etapas, reinicia imediatamente no 1x. Ao completar a quarta rodada vitoriosa consecutiva, você embolsa o lucro máximo de 12 unidades e reinicia.',
      pros: 'Altíssima segurança. Assim que você vence as duas primeiras rodadas (1x e 3x), você garante lucro líquido na rodada mesmo que perca o terceiro passo.',
      contras: 'Exige uma sequência de exatamente 4 vitórias seguidas para atingir o prêmio máximo planejado do ciclo.',
      example: 'Aposta R$ 10 (ganha, lucro +10) -> Aposta R$ 30 (ganha, lucro +40). Próxima aposta cai para R$ 20. Se ganhar, lucro vai para +60 e aposta R$ 60. Se perder a de R$ 20, você ainda sai do ciclo com R$ 20 de lucro positivo!'
    },
    [ManagementMode.KELLY_CRITERION]: {
      name: 'Critério de Kelly Dinâmico',
      risk: 'Médio',
      riskColor: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
      objective: 'Crescimento de banca matematicamente maximizado a longo prazo.',
      howItWorks: 'Ajusta o tamanho das apostas de forma contínua com base em uma porcentagem fixa (nesta versão configurada em 2% Fractional Kelly) do saldo atual da sua banca. Se a sua banca cresce, o valor da aposta sobe proporcionalmente. Se a banca diminui, as apostas encolhem para blindar seu capital remanescente contra a quebra.',
      pros: 'Matematicamente provado como o método mais eficiente para crescimento de capital no longo prazo. Mitiga riscos de falência completa dinamicamente.',
      contras: 'O valor das apostas oscila a cada rodada, exigindo cálculos frequentes e podendo desacelerar a velocidade de recuperação rápida de perdas.',
      example: 'Banca de R$ 1.000 -> Aposta de R$ 20. Se vencer, a banca sobe para R$ 1.020 e a próxima aposta é R$ 20,40. Se perder, a banca cai para R$ 980 e a próxima aposta cai para R$ 19,60.'
    },
    [ManagementMode.NIVEL_FIXO_RECUPERACAO]: {
      name: 'NFR84',
      risk: 'Médio-Alto',
      riskColor: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
      objective: 'Recuperar prejuízos acumulados de forma controlada sem progressão imediata nas vitórias.',
      howItWorks: 'Cada nível (Entrada Base, G1, G2, etc.) possui um valor fixo pré-definido. Se perder, avança para o próximo nível. Se ganhar, mas o saldo da sessão continuar negativo, mantém exatamente o mesmo nível e o mesmo valor na próxima operação. Só sobe de nível no LOSS do nível atual. Reseta para a Entrada Base no momento em que o prejuízo é totalmente recuperado.',
      pros: 'Evita a escalada exponencial rápida do Martingale tradicional, pois as vitórias consolidam saldo sem aumentar o nível, facilitando a recuperação gradual.',
      contras: 'Requer paciência e vitórias consistentes no mesmo nível para recuperar o saldo acumulado antes de voltar ao valor base.',
      example: 'Entrada Base R$ 10 (perde) -> G1 R$ 20 (perde) -> G2 R$ 30 (ganha, saldo negativo) -> Repete G2 R$ 30 (ganha, saldo recuperado!) -> Reseta para Entrada Base R$ 10.'
    },
    [ManagementMode.STAR_2_2]: {
      name: 'Star 2.2',
      risk: 'Médio',
      riskColor: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
      objective: 'Buscar vitórias duplas (2 acertos seguidos) em uma escala progressiva suave com trava de segurança.',
      howItWorks: 'Utiliza uma sequência fixa de 10 degraus de unidades [1, 1, 2, 2, 3, 4, 5, 7, 9, 12]U (46U totais). Ao perder, avança 1 degrau. Ao obter o 1º acerto, ajusta a 2ª mão no mesmo degrau (1.5x) para travar o lucro. Ao obter a 2ª vitória seguida (Back-to-Back Win), o ciclo é concluído com lucro e reseta ao início.',
      pros: 'Suporta sequências longas de oscilação com baixo consumo de banca e exige apenas 2 acertos seguidos em qualquer degrau para fechar o ciclo no positivo.',
      contras: 'Necessita de 2 acertos consecutivos em algum momento do ciclo para concretizar o encerramento do ciclo.',
      example: 'Aposta 1U (perde) -> Aposta 1U (perde) -> Aposta 2U (ganha 1ª mão) -> Aposta 3U (ganha 2ª mão consecutiva!). Ciclo vitorioso encerrado e reseta para 1U.'
    },
    [ManagementMode.STAR_2_0]: {
      name: 'Star 2.0',
      risk: 'Médio-Alto',
      riskColor: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
      objective: 'Buscar duas vitórias consecutivas com transição dinâmica entre Estágio 1 (unidade de 1U) e Estágio 2 (recuperação).',
      howItWorks: 'Dividido em dois Estágios. Estágio 1 usa apostas de 1U com parlay (dobra) no acerto. Se o déficit atingir 7U, passa para o Estágio 2. No Estágio 2, usa apostas progressivas [1, 2, 3, 4, 5, 7, 9, 12]U com parlay de 2x na vitória. Duas vitórias seguidas em qualquer momento zeram o déficit e resetam o ciclo para o Estágio 1.',
      pros: 'Inicia com uma unidade cheia de 1U de forma simples e intuitiva, mantendo um teto de controle contra oscilação com transição para o Estágio 2.',
      contras: 'Estágio 2 exige que se obtenha 2 vitórias consecutivas para liquidar o déficit acumulado.',
      example: 'Estágio 1: aposta 1U (perde) -> aposta 1U (ganha 1ª) -> parlay de 2U (vence a 2ª, ciclo limpo!). Se o déficit acumulado passar de 7U, vai ao Estágio 2 e inicia apostando 1U.'
    },
    [ManagementMode.DUTCH]: {
      name: 'Gerenciamento Holandês (Dutch System)',
      risk: 'Médio',
      riskColor: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
      objective: 'Progressão negativa estruturada em blocos de 3 rodadas para controle de oscilação.',
      howItWorks: 'Aposta em mini-ciclos de 3 rodadas utilizando uma progressão de números ímpares [1, 3, 5, 7, 9, 11, 13, 15, 17, 19]U. Mantém o mesmo valor de aposta durante todas as 3 rodadas do bloco. Ao final de cada bloco de 3 rodadas: se houver prejuízo no bloco (mais perdas que ganhos), avança para o próximo nível ímpar do ciclo. Se houver lucro ou recuperação, reseta para 1U.',
      pros: 'Evita aumentos impulsivos rodada a rodada, dando margem para variabilidade natural e reduzindo o impacto de perdas isoladas.',
      contras: 'Sequências de blocos perdedores acumulados elevam o valor da aposta para 7U, 9U ou mais, exigindo disciplina.',
      example: 'Bloco 1 (1U): Perde 3 vezes -> Bloco 2 (3U): Perde 2, Ganha 1 -> Bloco 3 (5U): Ganha 2, Perde 1 -> Saldo recuperado e reseta para 1U.'
    },
    [ManagementMode.PADOVAN]: {
      name: 'Sequência de Padovan',
      risk: 'Baixo-Médio',
      riskColor: 'text-green-400 bg-green-400/10 border-green-400/20',
      objective: 'Progressão matemática ultra-suave baseada na arquitetura dos triângulos de Padovan.',
      howItWorks: 'Utiliza os termos da sequência de Padovan P(n) = P(n-2) + P(n-3): [1, 1, 1, 2, 2, 3, 4, 5, 7, 9, 12, 16, 21, 28, 37, 49]U. A cada derrota, avança 1 passo na sequência. A cada vitória, reseta para o valor inicial de 1U ou recupera o ciclo.',
      pros: 'A taxa de crescimento da sequência de Padovan (limite radiante ~1,32) é significativamente menor que a de Fibonacci (~1,618) e Martingale (2,0), protegendo a banca muito mais tempo.',
      contras: 'Por subir de forma mais lenta, exige vitórias consistentes para absorver sequências muito longas de derrotas acumuladas.',
      example: 'Aposta 1U (perde) -> 1U (perde) -> 1U (perde) -> 2U (perde) -> 2U (perde) -> 3U (ganha!). O risco do aumento por derrota é extremamente baixo.'
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Management Selection */}
        <div className="space-y-6">
          {/* Selecionador Oficial de Fichas (1,00; 5,00; 10,00; 25,00; 125,00; 500,00) */}
          <div className="bg-[#111111] p-6 rounded-3xl border border-[#c6a34f]/30 space-y-4 shadow-[0_0_25px_rgba(198,163,79,0.06)]">
            <ChipSelector
              currentValue={config.minChip || config.initialBet || 1.00}
              onSelectChip={(val) => {
                onChange({
                  minChip: val,
                  initialBet: val
                });
              }}
              title="Selecionador de Fichas de Aposta Base"
            />
          </div>

          {/* Seleção do Jogo & Coberturas de Proteção */}
          <div className="bg-[#111111] p-6 rounded-3xl border border-white/5 space-y-4">
             <h3 className="text-sm font-bold uppercase tracking-widest text-[#c6a34f] flex items-center gap-2">
               <Target size={18} /> Aplicativo Vinculado
             </h3>
             <div className="p-4 rounded-2xl border border-[#c6a34f]/30 bg-[#c6a34f]/5 flex flex-col justify-center items-center text-center animate-in fade-in duration-300">
               <span className="text-[10px] text-zinc-400 uppercase tracking-[0.2em] font-bold block mb-1">Aplicação Ativa</span>
               <span className="text-sm font-black text-white uppercase tracking-wider block">
                 {isRoulette ? '🎰 ROLETA AI' : '🃏 BACCARAT AI'}
               </span>
               <div className="h-px w-1/2 bg-[#c6a34f]/20 my-2" />
               <span className="text-[9px] font-mono text-[#c6a34f] font-bold uppercase leading-none">
                 {isRoulette ? 'Ficha Mínima: R$ 0,10 | Cobertura do Zero Habilitada' : 'Ficha Mínima: R$ 0,20 | Cobertura do Empate Habilitada'}
               </span>
             </div>

             {/* Protection Coverage Toggle */}
             <div className="pt-2 border-t border-white/5">
                {isRoulette ? (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-black/25 border border-white/10">
                    <div>
                      <span className="text-[10px] text-zinc-100 font-bold uppercase block">Cobrir o Zero</span>
                      <span className="text-[8px] text-zinc-400 block">Ativa proteção no zero (Roleta)</span>
                    </div>
                    <button
                      onClick={() => onChange({ coverZero: !config.coverZero })}
                      className={`w-12 h-6 rounded-full p-1 transition-all ${config.coverZero ? 'bg-emerald-600' : 'bg-zinc-800'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white transition-all ${config.coverZero ? 'translate-x-[22px]' : 'translate-x-0'}`} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-black/25 border border-white/10">
                    <div>
                      <span className="text-[10px] text-zinc-100 font-bold uppercase block">Cobrir o Empate (Tie)</span>
                      <span className="text-[8px] text-zinc-400 block">Ativa proteção no empate (Baccarat)</span>
                    </div>
                    <button
                      onClick={() => onChange({ coverTie: !config.coverTie })}
                      className={`w-12 h-6 rounded-full p-1 transition-all ${config.coverTie ? 'bg-emerald-600' : 'bg-zinc-800'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white transition-all ${config.coverTie ? 'translate-x-[22px]' : 'translate-x-0'}`} />
                    </button>
                  </div>
                )}
             </div>
          </div>

          <div className="bg-[#111111] p-6 rounded-3xl border border-white/5 space-y-6">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-[#c6a34f] flex items-center gap-2">
                <Calculator size={18} /> Modo de Jogo
              </h3>
              <button
                type="button"
                onClick={() => {
                  setSelectedGuideMode(config.mode);
                  setShowGuide(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#c6a34f]/10 text-[#c6a34f] text-[10px] font-black uppercase tracking-wider border border-[#c6a34f]/20 hover:bg-[#c6a34f]/20 transition-all cursor-pointer"
              >
                <BookOpen size={12} /> Guia de Gestões
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="col-span-2">
                  <div className="grid grid-cols-2 gap-2 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                     {modes.map(m => (
                       <div
                         key={m.id}
                         className={`p-3 rounded-xl border flex justify-between items-center transition-all ${config.mode === m.id ? 'bg-[#c6a34f]/15 border-[#c6a34f] text-[#c6a34f]' : 'bg-black/20 border-white/5 text-white/60 hover:border-white/20'}`}
                       >
                          <button
                            type="button"
                            onClick={() => onChange({ mode: m.id })}
                            className="flex-1 text-left focus:outline-none cursor-pointer"
                          >
                             <div className="font-bold text-xs">{m.label}</div>
                             <div className="text-[8px] opacity-40 mt-0.5 line-clamp-1">{m.desc}</div>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedGuideMode(m.id);
                              setShowGuide(true);
                            }}
                            className="p-1.5 rounded bg-white/5 hover:bg-white/10 hover:text-white transition-all text-white/40 cursor-pointer ml-1.5 shrink-0"
                            title={`Ver explicação de ${m.label}`}
                          >
                            <Info size={12} />
                          </button>
                       </div>
                     ))}
                  </div>
               </div>
            </div>

            {config.mode === ManagementMode.LABOUCHERE && (
              <div className="bg-black/40 p-4 rounded-2xl border border-[#c6a34f]/30 space-y-3 mt-4 animate-in fade-in duration-300">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#c6a34f] uppercase tracking-wider">Sequência Inicial Labouchere</span>
                  <span className="text-[9px] text-zinc-400 font-mono">Valores em Unidades</span>
                </div>
                
                <input
                  type="text"
                  value={config.customLabouchereSequence ? config.customLabouchereSequence.join(', ') : '1, 2, 3'}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const parsed = raw
                      .split(',')
                      .map(s => parseFloat(s.trim()))
                      .filter(n => !isNaN(n) && n > 0);
                    onChange({ customLabouchereSequence: parsed.length > 0 ? parsed : [1, 2, 3] });
                  }}
                  placeholder="ex: 1, 2, 3"
                  className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 text-xs font-mono text-white focus:border-[#c6a34f] focus:outline-none"
                />

                {/* Pre-defined presets */}
                <div className="space-y-1">
                  <span className="text-[8px] uppercase font-bold text-white/30 block">Configurações Rápidas:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: 'Suave [1, 1, 1]', seq: [1, 1, 1] },
                      { label: 'Clássico [1, 2, 3]', seq: [1, 2, 3] },
                      { label: 'Padrão [1, 2, 3, 4]', seq: [1, 2, 3, 4] },
                      { label: 'Agressivo [1, 3, 5, 7]', seq: [1, 3, 5, 7] },
                      { label: 'Fibonacci [1, 1, 2, 3]', seq: [1, 1, 2, 3] }
                    ].map((preset, pIdx) => (
                      <button
                        key={pIdx}
                        type="button"
                        onClick={() => onChange({ customLabouchereSequence: preset.seq })}
                        className="px-2 py-1 text-[8px] font-bold uppercase rounded-lg bg-white/5 border border-white/5 hover:border-[#c6a34f]/40 hover:bg-[#c6a34f]/5 text-white/60 hover:text-white transition-all cursor-pointer"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <p className="text-[9px] text-zinc-400 leading-normal border-t border-white/5 pt-2 mt-2">
                  A estratégia Labouchere soma a primeira e a última pontas da sequência para calcular a aposta atual. Vitórias riscam os dois números da sequência. Derrotas inserem o valor perdido no final.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Calculations and Info */}
        <div className="bg-[#111111] p-6 rounded-3xl border border-white/5 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-[#c6a34f] flex items-center gap-2">
              <TrendingUp size={18} /> Plano de Ação (Unidades)
            </h3>
            <div className="flex items-center gap-2">
              {config.manualGaleChips && config.manualGaleChips.length > 0 && (
                <button
                  type="button"
                  onClick={handleResetAllChips}
                  className="px-2.5 py-1 text-[9px] font-black uppercase text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-xl border border-red-500/10 flex items-center gap-1 transition-all cursor-pointer"
                  title="Restaurar todos os valores para automático"
                >
                  <RotateCcw size={10} /> Resetar Todos
                </button>
              )}
              <span className="px-2 py-0.5 rounded-full bg-[#c6a34f]/10 text-[8px] font-black uppercase text-[#c6a34f] border border-[#c6a34f]/20 flex items-center gap-1">
                <Sparkles size={8} /> Em Unidades (u)
              </span>
            </div>
          </div>

          {/* Configuração de Coberturas Independentes */}
          {/* Configuração de Coberturas Independentes */}
          <div id="coberturas-config-panel" className="mb-4 p-4 rounded-2xl bg-black/40 border border-[#c6a34f]/20 flex flex-col gap-3">
            <span className="text-[10px] font-extrabold uppercase text-[#c6a34f] tracking-widest flex items-center gap-1.5">
              <Sparkles size={12} /> Configurar Coberturas
            </span>
            <div className="grid grid-cols-1 gap-3">
              {isRoulette ? (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] uppercase font-black text-zinc-400 tracking-wider">Unidades Zero</label>
                  <div className="flex items-center gap-1.5 bg-black/50 border border-white/10 rounded-xl px-2.5 py-1.5 focus-within:border-[#c6a34f] transition-all">
                    <input 
                      id="input-units-zero"
                      type="number"
                      step="0.1"
                      min="0"
                      value={config.unitsZero !== undefined ? config.unitsZero : 1.0}
                      onChange={(e) => onChange({ unitsZero: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-transparent border-none p-0 font-mono text-sm text-white focus:outline-none focus:ring-0"
                    />
                    <span className="text-[10px] text-zinc-500 font-bold font-mono">u</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] uppercase font-black text-zinc-400 tracking-wider">Unidades Tier (Empate)</label>
                  <div className="flex items-center gap-1.5 bg-black/50 border border-white/10 rounded-xl px-2.5 py-1.5 focus-within:border-[#c6a34f] transition-all">
                    <input 
                      id="input-units-tier"
                      type="number"
                      step="0.1"
                      min="0"
                      value={config.unitsTier !== undefined ? config.unitsTier : 0.0}
                      onChange={(e) => onChange({ unitsTier: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-transparent border-none p-0 font-mono text-sm text-white focus:outline-none focus:ring-0"
                    />
                    <span className="text-[10px] text-zinc-500 font-bold font-mono">u</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex-1 space-y-2.5 overflow-y-auto min-h-[600px] max-h-[850px] custom-scrollbar pr-2 mb-4">
             {progressions.map((p, idx) => {
                const isManual = p.isManual;
                const levelIdx = idx;
                
                return (
                 <div key={idx} className={`bg-black/40 border p-3 rounded-xl flex flex-col gap-2.5 group transition-all duration-300 ${isManual ? 'border-[#c6a34f]/40 bg-[#c6a34f]/5' : 'border-white/5 hover:border-[#c6a34f]/30'}`}>
                   
                   {/* Level Title and Exposure */}
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                       <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold transition-all border ${
                         isManual 
                           ? 'bg-[#c6a34f]/20 border-[#c6a34f]/30 text-[#c6a34f]' 
                           : 'bg-white/5 border-white/5 text-white/40'
                       }`}>
                         G{idx}
                       </div>
                       <div>
                         <span className="text-[10px] font-bold uppercase text-white/30 tracking-wider">
                           {idx === 0 ? 'Entrada Principal' : `Gale Nível ${idx}`}
                         </span>
                         {isManual && (
                           <span className="ml-1 text-[8px] bg-[#c6a34f]/20 text-[#c6a34f] px-1 py-0.5 rounded uppercase font-black">
                             Ajustado
                           </span>
                         )}
                       </div>
                     </div>
                     
                     <div className="text-right">
                       <span className="text-[8px] uppercase text-white/20 font-bold tracking-wider block mb-0.5">Máx. Exposição</span>
                       <span className="text-xs font-mono font-bold text-red-500/80">{(p.accumulated || 0).toFixed(1)} u</span>
                     </div>
                   </div>

                   {/* Chip/Bet Interactive Controls */}
                   <div className="grid grid-cols-12 gap-2 items-center bg-black/30 border border-white/5 p-1.5 rounded-lg">
                     
                     {/* Chip Field */}
                     <div className="col-span-7 flex flex-col gap-0.5">
                       <span className="text-[8px] uppercase font-bold tracking-wider text-white/40">Ficha p/ Número</span>
                       <div className="flex items-center gap-1">
                         <input 
                           type="number"
                           step="0.5"
                           min="0.1"
                           value={p.chipValue || ''}
                           onChange={(e) => handleChipValueChange(levelIdx, e.target.value)}
                           className="w-full bg-black/50 border border-white/10 rounded px-1.5 py-0.5 text-xs font-mono text-white focus:border-[#c6a34f] focus:ring-1 focus:ring-[#c6a34f] outline-none"
                         />
                         <span className="text-[10px] font-mono text-white/60 font-bold">u</span>
                       </div>
                     </div>

                     {/* Adjustment buttons */}
                     <div className="col-span-5 flex items-center justify-end gap-1">
                       <button
                         type="button"
                         onClick={() => handleAdjustChipValue(levelIdx, -0.5)}
                         className="p-1 rounded bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 hover:border-white/20 active:scale-95 transition-all cursor-pointer text-[9px] font-mono"
                         title="Diminuir 0,5 u"
                       >
                         -0.5u
                       </button>
                       <button
                         type="button"
                         onClick={() => handleAdjustChipValue(levelIdx, 0.5)}
                         className="p-1 rounded bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 hover:border-white/20 active:scale-95 transition-all cursor-pointer text-[9px] font-mono"
                         title="Aumentar 0,5 u"
                       >
                         +0.5u
                       </button>
                       {isManual && (
                         <button
                           type="button"
                           onClick={() => handleResetChip(levelIdx)}
                           className="p-1 rounded bg-red-500/10 border border-red-500/20 text-red-400 hover:text-red-300 hover:bg-red-500/20 active:scale-95 transition-all cursor-pointer"
                           title="Restaurar Progressão Automática"
                         >
                           <RotateCcw size={10} />
                         </button>
                       )}
                     </div>
                   </div>

                   {/* Sub-summaries: Total Bet & Profit */}
                   <div className="flex items-center justify-between text-[10px] px-1 text-white/40 border-t border-white/5 pt-2">
                     <span className="font-medium">Aposta Total: <strong className="text-white font-mono">{p.bet.toFixed(1)} u</strong></span>
                     <span className={`font-mono font-semibold ${p.profit >= 0 ? 'text-green-500' : 'text-red-500/70'}`}>
                       Retorno: {p.profit >= 0 ? '+' : ''}{p.profit.toFixed(1)} u
                     </span>
                   </div>

                   {p.protection > 0 && (
                     <div className="flex items-center justify-between border-t border-white/5 pt-2 text-[10px]">
                       <div className="flex items-center gap-1.5 text-amber-500/80 font-medium">
                         <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                         <span>Proteção ({isRoulette ? 'Zero / Tier' : 'Empate'}):</span>
                       </div>
                       <div className="font-mono text-amber-400">{p.protection.toFixed(1)} u</div>
                     </div>
                   )}

                   {p.protection > 0 && (
                     <div className="flex items-center justify-between text-[10px] text-white/40 border-t border-white/5 pt-1.5 px-2 bg-white/[0.01] rounded">
                       <span>Total do Nível: <strong className="text-white font-mono">{p.totalBet.toFixed(1)} u</strong></span>
                       {p.protectionProfit > 0 && (
                         <span className="text-green-500/80 font-semibold">Lucro Prot.: <strong className="font-mono text-green-400">+{p.protectionProfit.toFixed(1)} u</strong></span>
                       )}
                     </div>
                   )}
                 </div>
               );
             })}
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
             <div className="flex justify-between items-center text-[10px] uppercase font-bold text-white/40">
                <span>Metas Calculadas</span>
                <span className="text-white/20">{config.profile === RiskProfile.CUSTOM ? 'Manual' : 'Automático'}</span>
             </div>
             <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded-lg bg-black/40 border border-white/5">
                   <div className="text-[8px] text-green-500/60 uppercase font-bold">Stop Win</div>
                   <div className="text-lg font-mono text-green-500">R$ {(bankroll.stopWin || 0).toFixed(2).replace('.', ',')}</div>
                </div>
                <div className="p-2 rounded-lg bg-black/40 border border-white/5">
                   <div className="text-[8px] text-red-500/60 uppercase font-bold">Stop Loss</div>
                   <div className="text-lg font-mono text-red-500">R$ {(bankroll.stopLoss || 0).toFixed(2).replace('.', ',')}</div>
                </div>
             </div>
             <p className="text-[9px] text-white/30 italic text-center leading-relaxed">
               As progressões de gestão são calculadas em <strong className="text-[#c6a34f]">Unidades (u)</strong>. Ao operar na mesa do baccarat, os valores em R$ de cada nível serão automaticamente calculados multiplicando as unidades pelo valor da ficha base selecionada por você.
             </p>
          </div>

          
        </div>
      </div>

      {/* Interactive Stop Loss Calculator for N Losses (Background calculations active) */}

      {/* Guide overlay modal */}
      {showGuide && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-white/10 w-full max-w-5xl h-[85vh] rounded-3xl flex flex-col overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)]">
            {/* Modal Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-black/20">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#c6a34f]/10 rounded-2xl text-[#c6a34f]">
                  <BookOpen size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">Manual Completo de Gestão de Banca</h3>
                  <p className="text-white/40 text-xs uppercase tracking-wider">Aprenda a matemática e os riscos por trás de cada sistema de aposta</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="p-2 rounded-xl bg-white/5 border border-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 flex overflow-hidden">
              {/* Sidebar: List of Systems */}
              <div className="w-1/3 border-r border-white/5 overflow-y-auto bg-black/10 p-4 space-y-2 custom-scrollbar">
                {modes.map(m => {
                  const active = selectedGuideMode === m.id;
                  const gInfo = (guideData as any)[m.id];
                  return (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => setSelectedGuideMode(m.id)}
                      className={`w-full p-3.5 rounded-2xl text-left border transition-all flex flex-col gap-1 cursor-pointer ${
                        active
                          ? 'bg-[#c6a34f]/15 border-[#c6a34f] text-[#c6a34f] shadow-[0_0_15px_rgba(198,163,79,0.1)]'
                          : 'bg-transparent border-transparent text-white/60 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <div className="font-bold text-xs flex items-center justify-between">
                        <span>{m.label}</span>
                        {gInfo && (
                          <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${gInfo.riskColor}`}>
                            {gInfo.risk}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] opacity-50 line-clamp-1">{m.desc}</div>
                    </button>
                  );
                })}
              </div>

              {/* Main Content: Explanation Detail */}
              <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar bg-[#111111]">
                {(() => {
                  const info = (guideData as any)[selectedGuideMode];
                  if (!info) return null;
                  return (
                    <div className="space-y-6 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xl font-extrabold text-[#c6a34f] tracking-tight">{info.name}</h4>
                        <span className={`px-3 py-1 rounded-full text-xs font-black uppercase border ${info.riskColor}`}>
                          Risco: {info.risk}
                        </span>
                      </div>

                      {/* Objective */}
                      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                        <div className="text-white/30 text-[10px] uppercase font-bold tracking-widest flex items-center gap-1.5">
                          <Target size={12} className="text-[#c6a34f]" /> Objetivo do Sistema
                        </div>
                        <p className="text-sm text-zinc-100 font-semibold">{info.objective}</p>
                      </div>

                      {/* How it Works */}
                      <div className="space-y-2">
                        <div className="text-white/30 text-[10px] uppercase font-bold tracking-widest flex items-center gap-1.5">
                          <Calculator size={12} className="text-[#c6a34f]" /> Como Funciona na Prática
                        </div>
                        <p className="text-sm text-zinc-300 leading-relaxed">{info.howItWorks}</p>
                      </div>

                      {/* Pros & Cons Grid */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 space-y-2">
                          <div className="text-emerald-400 text-[10px] uppercase font-bold tracking-widest flex items-center gap-1.5">
                            <CheckCircle size={12} /> Vantagens (Prós)
                          </div>
                          <p className="text-xs text-emerald-100/90 leading-relaxed font-medium">{info.pros}</p>
                        </div>
                        <div className="p-5 rounded-2xl bg-rose-500/5 border border-rose-500/10 space-y-2">
                          <div className="text-rose-400 text-[10px] uppercase font-bold tracking-widest flex items-center gap-1.5">
                            <AlertTriangle size={12} /> Desvantagens (Contras)
                          </div>
                          <p className="text-xs text-rose-100/90 leading-relaxed font-medium">{info.contras}</p>
                        </div>
                      </div>

                      {/* Practical Example */}
                      <div className="p-5 rounded-2xl bg-white/[0.01] border border-white/5 border-dashed space-y-2">
                        <div className="text-white/30 text-[10px] uppercase font-bold tracking-widest flex items-center gap-1.5">
                          <Info size={12} className="text-[#c6a34f]" /> Exemplo Prático de Apostas
                        </div>
                        <p className="text-xs text-zinc-400 italic leading-relaxed font-medium">{info.example}</p>
                      </div>

                      {/* Apply Button */}
                      <div className="pt-4 border-t border-white/5 flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            onChange({ mode: selectedGuideMode });
                            setShowGuide(false);
                          }}
                          className="px-6 py-3 rounded-xl bg-[#c6a34f] text-black text-xs font-black uppercase tracking-wider hover:bg-[#c6a34f]/90 transition-all shadow-[0_4px_20px_rgba(198,163,79,0.3)] cursor-pointer"
                        >
                          Ativar esta Gestão no Jogo
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
