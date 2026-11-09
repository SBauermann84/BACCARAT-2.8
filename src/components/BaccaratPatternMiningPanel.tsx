import React, { useState, useEffect } from 'react';
import { GameResult, Strategy } from '../types';
import { 
  mineBaccaratPatterns, 
  MinedBaccaratPattern, 
  RoadSource,
  convertMinedPatternsToStrategies
} from '../engines/baccaratPatternMiningEngine';
import { 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  Filter, 
  Zap, 
  TrendingUp, 
  Layers, 
  ShieldCheck,
  Power,
  BarChart3,
  RefreshCw,
  PlusCircle
} from 'lucide-react';

interface BaccaratPatternMiningPanelProps {
  history: GameResult[];
  onApplyMinedStrategies?: (strategies: Strategy[]) => void;
  existingStrategies?: Strategy[];
}

export const BaccaratPatternMiningPanel: React.FC<BaccaratPatternMiningPanelProps> = ({
  history,
  onApplyMinedStrategies,
  existingStrategies = []
}) => {
  const [minedPatterns, setMinedPatterns] = useState<MinedBaccaratPattern[]>([]);
  const [filterRoad, setFilterRoad] = useState<RoadSource | 'all'>('all');
  const [isMining, setIsMining] = useState<boolean>(false);
  const [minAssertiveness, setMinAssertiveness] = useState<number>(50);

  // Auto-run mining asynchronously to prevent UI freeze
  useEffect(() => {
    if (history) {
      setIsMining(true);
      const timer = setTimeout(() => {
        const mined = mineBaccaratPatterns(history);
        setMinedPatterns(mined);
        setIsMining(false);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [history]);

  const handleManualMining = () => {
    setIsMining(true);
    setTimeout(() => {
      const mined = mineBaccaratPatterns(history);
      setMinedPatterns(mined);
      setIsMining(false);
    }, 300);
  };

  const togglePatternActive = (id: string) => {
    const updated = minedPatterns.map(p => {
      if (p.id === id) {
        return { ...p, isActive: !p.isActive };
      }
      return p;
    });
    setMinedPatterns(updated);

    if (onApplyMinedStrategies) {
      const activeStrategies = convertMinedPatternsToStrategies(updated.filter(p => p.isActive));
      onApplyMinedStrategies(activeStrategies);
    }
  };

  const activateTopAssertive = (topCount = 3) => {
    const updated = minedPatterns.map((p, idx) => ({
      ...p,
      isActive: idx < topCount && p.assertiveness >= 60
    }));
    setMinedPatterns(updated);

    if (onApplyMinedStrategies) {
      const activeStrategies = convertMinedPatternsToStrategies(updated.filter(p => p.isActive));
      onApplyMinedStrategies(activeStrategies);
    }
  };

  const deactivateAll = () => {
    const updated = minedPatterns.map(p => ({ ...p, isActive: false }));
    setMinedPatterns(updated);

    if (onApplyMinedStrategies) {
      onApplyMinedStrategies([]);
    }
  };

  // Filtering
  const filteredPatterns = minedPatterns.filter(p => {
    if (p.assertiveness < minAssertiveness) return false;
    if (filterRoad === 'all') return true;
    return p.roadSource === filterRoad;
  });

  const activeCount = minedPatterns.filter(p => p.isActive).length;
  const bestPattern = minedPatterns[0];

  return (
    <div className="bg-[#111111] rounded-3xl border border-[#c6a34f]/20 p-5 md:p-6 space-y-6 shadow-2xl relative overflow-hidden">
      {/* Background Subtle Accent */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-[#c6a34f]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[#c6a34f]/15 text-[#c6a34f] rounded-2xl border border-[#c6a34f]/30">
              <Sparkles size={20} className="animate-pulse" />
            </div>
            <div>
              <h3 className="text-base md:text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
                Mineração Inteligente de Padrões Baccarat
              </h3>
              <p className="text-xs text-zinc-400">
                O próprio sistema analisa o histórico de resultados, extrai padrões da Grande Estrada, Olho Grande, Pequeno Caminho e Cockroach, e testa a assertividade em tempo real.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleManualMining}
          disabled={isMining}
          className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#c6a34f] to-amber-600 text-black font-black text-xs uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 shadow-lg shadow-[#c6a34f]/20 disabled:opacity-50 cursor-pointer shrink-0"
        >
          <RefreshCw size={15} className={isMining ? 'animate-spin' : ''} />
          <span>{isMining ? 'Analisando...' : 'Minar & Testar Padrões'}</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-3.5 space-y-1">
          <p className="text-[10px] text-zinc-400 uppercase font-black tracking-wider">Padrões Identificados</p>
          <p className="text-xl md:text-2xl font-black text-white font-mono">{minedPatterns.length}</p>
          <p className="text-[10px] text-zinc-500">Varredura de 5 estradas</p>
        </div>

        <div className="bg-emerald-500/[0.03] border border-emerald-500/20 rounded-2xl p-3.5 space-y-1">
          <p className="text-[10px] text-emerald-400/80 uppercase font-black tracking-wider">Maior Assertividade</p>
          <p className="text-xl md:text-2xl font-black text-emerald-400 font-mono">
            {bestPattern ? `${bestPattern.assertiveness}%` : 'N/A'}
          </p>
          <p className="text-[10px] text-emerald-500/70 truncate">
            {bestPattern ? bestPattern.roadSourceLabel : 'Aguardando dados'}
          </p>
        </div>

        <div className="bg-blue-500/[0.03] border border-blue-500/20 rounded-2xl p-3.5 space-y-1">
          <p className="text-[10px] text-blue-400/80 uppercase font-black tracking-wider">Ativos nos Sinais</p>
          <p className="text-xl md:text-2xl font-black text-blue-400 font-mono">{activeCount}</p>
          <p className="text-[10px] text-blue-300/60">Alimentam a IA em tempo real</p>
        </div>

        <div className="bg-amber-500/[0.03] border border-amber-500/20 rounded-2xl p-3.5 flex flex-col justify-between">
          <p className="text-[10px] text-amber-400/80 uppercase font-black tracking-wider">Ações Rápidas</p>
          <div className="flex items-center gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => activateTopAssertive(3)}
              className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex-1"
            >
              Top 3 Ativos
            </button>
            <button
              type="button"
              onClick={deactivateAll}
              className="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
            >
              Zero
            </button>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Threshold selector */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white/[0.02] p-2 rounded-2xl border border-white/5">
        <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setFilterRoad('all')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
              filterRoad === 'all'
                ? 'bg-[#c6a34f] text-black shadow'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Todas ({minedPatterns.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterRoad('confluence')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
              filterRoad === 'confluence'
                ? 'bg-[#c6a34f] text-black shadow'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Confluências
          </button>
          <button
            type="button"
            onClick={() => setFilterRoad('big_road')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
              filterRoad === 'big_road'
                ? 'bg-[#c6a34f] text-black shadow'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Grande Estrada
          </button>
          <button
            type="button"
            onClick={() => setFilterRoad('big_eye')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
              filterRoad === 'big_eye'
                ? 'bg-[#c6a34f] text-black shadow'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Olho Grande
          </button>
          <button
            type="button"
            onClick={() => setFilterRoad('small_road')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
              filterRoad === 'small_road'
                ? 'bg-[#c6a34f] text-black shadow'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Pequeno Caminho
          </button>
          <button
            type="button"
            onClick={() => setFilterRoad('cockroach')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
              filterRoad === 'cockroach'
                ? 'bg-[#c6a34f] text-black shadow'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Cockroach
          </button>
        </div>

        {/* Minimum Assertiveness Filter */}
        <div className="flex items-center gap-2 px-3 py-1 bg-black/40 rounded-xl border border-white/10 text-xs text-zinc-400 shrink-0">
          <Filter size={13} className="text-[#c6a34f]" />
          <span>Mínimo:</span>
          <select
            value={minAssertiveness}
            onChange={(e) => setMinAssertiveness(Number(e.target.value))}
            className="bg-transparent text-white font-bold border-none focus:outline-none cursor-pointer"
          >
            <option value={0} className="bg-zinc-900">0% (Todas)</option>
            <option value={50} className="bg-zinc-900">&ge; 50%</option>
            <option value={60} className="bg-zinc-900">&ge; 60%</option>
            <option value={70} className="bg-zinc-900">&ge; 70%</option>
            <option value={80} className="bg-zinc-900">&ge; 80%</option>
          </select>
        </div>
      </div>

      {/* Patterns Grid */}
      {filteredPatterns.length === 0 ? (
        <div className="text-center py-10 px-4 bg-white/[0.01] rounded-2xl border border-white/5 space-y-2">
          <Layers size={32} className="mx-auto text-zinc-600" />
          <p className="text-sm font-bold text-zinc-300">
            {history.length < 5 ? 'Lance pelo menos 5 rodadas para iniciar a mineração automática de padrões.' : 'Nenhum padrão encontrado com os filtros selecionados.'}
          </p>
          <p className="text-xs text-zinc-500">
            O sistema varre a matriz de cartas e calcula automaticamente o resultado estatístico de cada combinação.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPatterns.map((pattern, index) => {
            const isHighWin = pattern.assertiveness >= 75;
            const isMediumWin = pattern.assertiveness >= 60 && pattern.assertiveness < 75;

            return (
              <div
                key={pattern.id}
                className={`p-4 rounded-2xl border transition-all relative flex flex-col justify-between space-y-3 ${
                  pattern.isActive
                    ? 'bg-gradient-to-b from-[#18181b] to-black border-[#c6a34f]/40 shadow-lg shadow-[#c6a34f]/5'
                    : 'bg-zinc-950/60 border-white/5 opacity-80 hover:opacity-100'
                }`}
              >
                {/* Card Top: Rank Badge & Toggle */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-white/10 text-white font-mono text-[10px] font-black">
                      #{index + 1}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-[#c6a34f]/15 border border-[#c6a34f]/30 text-[#c6a34f] text-[10px] font-black uppercase">
                      {pattern.roadSourceLabel}
                    </span>
                    {pattern.assertiveness >= 80 && (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-extrabold flex items-center gap-1">
                        <Zap size={10} /> Alta Assertividade
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => togglePatternActive(pattern.id)}
                    className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                      pattern.isActive
                        ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                        : 'bg-white/10 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Power size={12} />
                    <span>{pattern.isActive ? 'Ativa' : 'Inativa'}</span>
                  </button>
                </div>

                {/* Strategy Title & Description */}
                <div className="space-y-1">
                  <h4 className="text-sm font-black text-white leading-snug">
                    {pattern.name}
                  </h4>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {pattern.description}
                  </p>
                </div>

                {/* Progress Bar for Assertiveness */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-bold">
                    <span className="text-zinc-400 uppercase">Assertividade Testada</span>
                    <span className={isHighWin ? 'text-emerald-400 font-mono font-black' : isMediumWin ? 'text-amber-400 font-mono font-black' : 'text-zinc-400 font-mono font-black'}>
                      {pattern.assertiveness}%
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        isHighWin ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : isMediumWin ? 'bg-gradient-to-r from-amber-500 to-yellow-400' : 'bg-zinc-600'
                      }`}
                      style={{ width: `${Math.min(100, pattern.assertiveness)}%` }}
                    />
                  </div>
                </div>

                {/* Bottom Stats Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px] text-zinc-300">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-emerald-400 font-bold">
                      <CheckCircle2 size={13} /> {pattern.wins}v
                    </span>
                    <span className="flex items-center gap-1 text-red-400 font-bold">
                      <XCircle size={13} /> {pattern.losses}d
                    </span>
                    <span className="text-zinc-500">
                      ({pattern.totalOccurrences} rodadas)
                    </span>
                  </div>

                  <div className="flex items-center gap-1 font-bold">
                    <span className="text-zinc-400">Entrada:</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                      pattern.predictedEntry === 'BANKER' 
                        ? 'bg-red-600 text-white' 
                        : pattern.predictedEntry === 'PLAYER'
                        ? 'bg-blue-600 text-white'
                        : 'bg-emerald-600 text-white'
                    }`}>
                      {pattern.predictedEntry === 'BANKER' ? 'BANKER' : pattern.predictedEntry === 'PLAYER' ? 'PLAYER' : 'TIE'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BaccaratPatternMiningPanel;
