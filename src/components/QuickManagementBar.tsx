import React from 'react';
import { Shield, TrendingUp, DollarSign, Target, Layers, Sliders, ChevronDown, FlaskConical, RotateCcw, Lock } from 'lucide-react';
import { Bankroll, ManagementConfig, ManagementMode, GameType } from '../types';
import { useAppStore } from '../store/useAppStore';

interface DecimalCommaInputProps {
  className?: string;
  value: number;
  onChange: (val: number) => void;
}

const DecimalCommaInput: React.FC<DecimalCommaInputProps> = ({ className, value, onChange }) => {
  const [localVal, setLocalVal] = React.useState<string>(() => 
    (value || 0).toFixed(2).replace('.', ',')
  );

  React.useEffect(() => {
    const parsed = parseFloat(localVal.replace(',', '.'));
    if (!isNaN(parsed)) {
      if (Math.abs(parsed - value) > 0.001) {
        setLocalVal((value || 0).toFixed(2).replace('.', ','));
      }
    } else {
      setLocalVal((value || 0).toFixed(2).replace('.', ','));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const clean = raw.replace(/[^0-9.,-]/g, '');
    setLocalVal(clean);
    
    const parsed = parseFloat(clean.replace(',', '.'));
    if (!isNaN(parsed)) {
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    const parsed = parseFloat(localVal.replace(',', '.'));
    const finalVal = !isNaN(parsed) ? parsed : 0;
    const formatted = finalVal.toFixed(2).replace('.', ',');
    setLocalVal(formatted);
    onChange(finalVal);
  };

  return (
    <input
      type="text"
      className={className}
      value={localVal}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
};

interface QuickManagementBarProps {
  bankroll: Bankroll;
  updateBankroll: (update: Partial<Bankroll>) => void;
  management: ManagementConfig;
  updateManagement: (update: Partial<ManagementConfig>) => void;
  gameType: GameType;
}

export const QuickManagementBar: React.FC<QuickManagementBarProps> = ({
  bankroll,
  updateBankroll,
  management,
  updateManagement,
  gameType
}) => {
  const historyRoulette = useAppStore((state) => state.historyRoulette);
  const historyBaccarat = useAppStore((state) => state.historyBaccarat);

  const realHistory = (gameType === GameType.ROULETTE ? historyRoulette : historyBaccarat) || [];

  const maxGaleUsed = React.useMemo(() => {
    let maxGaleLevelReached = 0;
    let currentGale = 0;
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
    ].includes(management?.mode);

    let runningProfitForGale = 0;
    let maxRunningProfitForGale = 0;

    // We need history in chronological order (oldest first)
    const chronoHistory = [...(realHistory || [])].reverse();
    chronoHistory.forEach(h => {
      const win = h.isWin;
      const resStr = String(h.result).toUpperCase().trim();
      const isTie = resStr === 'TIE' || resStr === 'T' || resStr === 'EMPATE' || resStr === 'E';
      const isPush = win === undefined || (h.profit === 0 && (win === undefined || isTie || h.gameType === GameType.BACCARAT));

      if (isPush) return;

      runningProfitForGale += h.profit || 0;
      if (runningProfitForGale > maxRunningProfitForGale) {
        maxRunningProfitForGale = runningProfitForGale;
      }

      if (win === false) {
        currentGale += 1;
        if (currentGale > maxGaleLevelReached) {
          maxGaleLevelReached = currentGale;
        }
      }

      const hasRecovered = isRecoveryMode && (runningProfitForGale >= maxRunningProfitForGale);
      if (hasRecovered) {
        currentGale = 0;
      } else if (management?.mode === ManagementMode.FIXED) {
        currentGale = 0;
      }
    });

    return maxGaleLevelReached;
  }, [realHistory, management?.mode]);

  return (
    <div className="backdrop-blur-md border rounded-2xl p-3 shadow-lg transition-all bg-[#111111]/90 border-[#c6a34f]/15">
      
      <div className="flex flex-col xl:flex-row gap-3 items-stretch xl:items-center justify-between">
        
        {/* Bankroll Values Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 flex-1 min-w-0">
          
          {/* Banca Inicial */}
          <div className="bg-black/40 border border-white/5 hover:border-[#c6a34f]/15 p-2 rounded-xl transition-all flex items-center gap-2">
            <div className="p-1.5 bg-white/5 text-white/50 rounded-lg">
              <DollarSign size={13} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[8px] text-white/30 uppercase font-bold block leading-none mb-1">
                Banca Inicial
              </span>
              <DecimalCommaInput
                className="w-full bg-transparent border-none p-0 font-mono text-xs font-black text-white/60 outline-none focus:text-white"
                value={bankroll.initialBalance}
                onChange={(val) => updateBankroll({ initialBalance: val })}
              />
            </div>
          </div>

          {/* Banca Atual */}
          <div className="bg-black/40 border border-white/5 hover:border-[#c6a34f]/15 p-2 rounded-xl transition-all flex items-center gap-2 border">
            <div className="p-1.5 rounded-lg bg-[#c6a34f]/10 text-[#c6a34f]">
              <TrendingUp size={13} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[8px] uppercase font-black block leading-none mb-1 text-[#c6a34f]/80">
                Banca Atual
              </span>
              <DecimalCommaInput
                className="w-full bg-transparent border-none p-0 font-mono text-xs font-black outline-none text-[#c6a34f]"
                value={bankroll.balance}
                onChange={(val) => updateBankroll({ balance: val })}
              />
            </div>
          </div>

          {/* Stop Win */}
          <div className="bg-black/40 border border-emerald-500/10 hover:border-emerald-500/25 p-2 rounded-xl transition-all flex items-center gap-2">
            <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <Shield size={13} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[8px] text-emerald-500/80 uppercase font-black block leading-none mb-1">Stop Win</span>
              <DecimalCommaInput
                className="w-full bg-transparent border-none p-0 font-mono text-xs font-black text-emerald-400 outline-none"
                value={bankroll.stopWin}
                onChange={(val) => updateBankroll({ stopWin: val })}
              />
            </div>
          </div>

          {/* Stop Loss (Calculado) */}
          <div className="bg-black/40 border border-red-500/10 hover:border-red-500/25 p-2 rounded-xl transition-all flex items-center gap-2" title="Stop Loss calculado automaticamente pelo tipo de gerenciamento e níveis de Gale">
            <div className="p-1.5 bg-red-500/10 text-red-400 rounded-lg">
              <Shield size={13} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[8px] text-red-500/80 uppercase font-black block leading-none mb-1">Stop Loss (Calc.)</span>
              <div className="font-mono text-xs font-black text-red-400 select-none">
                R$ {(bankroll.stopLoss || 0).toFixed(2).replace('.', ',')}
              </div>
            </div>
          </div>

        </div>

        {/* Divider for XL screens */}
        <div className="hidden xl:block w-px h-8 bg-white/5" />

        {/* Management Config Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 flex-1 min-w-0">
          
          {/* Modo de Gerenciamento */}
          <div className="bg-black/40 border border-white/5 hover:border-[#c6a34f]/15 p-2 rounded-xl transition-all flex items-center gap-2">
            <div className="p-1.5 bg-white/5 text-white/50 rounded-lg shrink-0">
              <Sliders size={13} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[8px] text-white/30 uppercase font-bold block leading-none mb-0.5">Modo de Gestão</span>
              <div className="relative">
                <select
                  value={management.mode}
                  onChange={(e) => updateManagement({ mode: e.target.value as ManagementMode })}
                  className="w-full bg-transparent border-none p-0 font-bold text-[10px] md:text-xs text-stone-200 outline-none cursor-pointer focus:ring-0 pr-4 appearance-none font-sans uppercase tracking-tight"
                >
                  <option value={ManagementMode.FIXED} className="bg-neutral-900 text-stone-300">Aposta Fixa</option>
                  <option value={ManagementMode.STAR_2_2} className="bg-neutral-900 text-stone-300">Star 2.2</option>
                  <option value={ManagementMode.STAR_2_0} className="bg-neutral-900 text-stone-300">Star 2.0</option>
                  <option value={ManagementMode.DUTCH} className="bg-neutral-900 text-stone-300">Holandês</option>
                  <option value={ManagementMode.PADOVAN} className="bg-neutral-900 text-stone-300">Padovan</option>
                  <option value={ManagementMode.MARTINGALE} className="bg-neutral-900 text-stone-300">Martingale</option>
                  <option value={ManagementMode.SOROS} className="bg-neutral-900 text-stone-300">Soros</option>
                  <option value={ManagementMode.FIBONACCI} className="bg-neutral-900 text-stone-300">Fibonacci</option>
                  <option value={ManagementMode.D_ALEMBERT} className="bg-neutral-900 text-stone-300">D'Alembert</option>
                  <option value={ManagementMode.CYCLIC} className="bg-neutral-900 text-stone-300">Ciclos</option>
                  <option value={ManagementMode.LABOUCHERE} className="bg-neutral-900 text-stone-300">Labouchere</option>
                  <option value={ManagementMode.KELLY_CRITERION} className="bg-neutral-900 text-stone-300">Kelly Criterion</option>
                  <option value={ManagementMode.SISTEMA_2_GANHOS} className="bg-neutral-900 text-stone-300">2 Ganhos</option>
                  <option value={ManagementMode.SISTEMA_2U_REC1} className="bg-neutral-900 text-stone-300">2U Rec1</option>
                  <option value={ManagementMode.NIVEL_FIXO_RECUPERACAO} className="bg-neutral-900 text-stone-300">NFR84</option>
                </select>
                <ChevronDown size={10} className="text-white/35 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Níveis Máximos */}
          <div className="bg-black/40 border border-white/5 hover:border-[#c6a34f]/15 p-2 rounded-xl transition-all flex items-center gap-2">
            <div className="p-1.5 bg-white/5 text-white/50 rounded-lg shrink-0">
              <Layers size={13} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[8px] text-white/30 uppercase font-bold block leading-none mb-1">Níveis Máx</span>
              <input
                type="number"
                min="0"
                max="1000"
                className="w-full bg-transparent border-none p-0 font-mono text-xs font-black text-white/80 outline-none focus:ring-0"
                value={management.levels}
                onChange={(e) => updateManagement({ levels: Math.max(0, Number(e.target.value)) })}
              />
            </div>
          </div>

          {/* Travar no Nível Máximo (keepAtMaxGale) */}
          <div className="bg-black/40 border border-white/5 hover:border-[#c6a34f]/15 p-2 rounded-xl transition-all flex items-center gap-2 select-none cursor-pointer" onClick={() => updateManagement({ keepAtMaxGale: !management.keepAtMaxGale })}>
            <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${management.keepAtMaxGale ? 'bg-[#c6a34f]/10 text-[#c6a34f]' : 'bg-white/5 text-white/30'}`}>
              <Lock size={13} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[8px] text-white/30 uppercase font-bold block leading-none mb-1">Gale Máximo</span>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-black transition-colors ${management.keepAtMaxGale ? 'text-[#c6a34f]' : 'text-white/60'}`}>
                  {management.keepAtMaxGale ? 'TRAVAR VALOR' : 'RESETAR VALOR'}
                </span>
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-amber-600 focus:ring-amber-500 h-3 w-3 bg-transparent shrink-0 accent-[#c6a34f] cursor-pointer"
                  checked={!!management.keepAtMaxGale}
                  onChange={() => {}} // handled by parent div click
                />
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
