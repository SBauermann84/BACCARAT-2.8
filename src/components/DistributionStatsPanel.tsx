import React, { useMemo, useState } from 'react';
import { GameType, GameResult } from '../types';
import { BarChart3, Percent, Layers, Columns, Grid, Shuffle, Sparkles, Table } from 'lucide-react';
import { COLOR_MAP } from '../constants';

interface DistributionStatsPanelProps {
  gameType: GameType;
  history: GameResult[];
  compact?: boolean;
}

type RouletteCategory = 'color' | 'parity' | 'highLow' | 'dozen' | 'column';

export const DistributionStatsPanel: React.FC<DistributionStatsPanelProps> = ({ 
  gameType, 
  history,
  compact = false 
}) => {
  const [selectedRouletteTab, setSelectedRouletteTab] = useState<RouletteCategory>('color');
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const [periodLimit, setPeriodLimit] = useState<number | 'all'>('all');
  const [analysisType, setAnalysisType] = useState<'results' | 'gales'>('results');

  const unfilteredHistory = useMemo(() => {
    return history.filter(h => h.gameType === gameType);
  }, [history, gameType]);

  const unfilteredCount = unfilteredHistory.length;

  // Filter history to ensure we only analyze results for the current game type within selected window
  const relevantHistory = useMemo(() => {
    if (periodLimit === 'all') return unfilteredHistory;
    return unfilteredHistory.slice(0, periodLimit);
  }, [unfilteredHistory, periodLimit]);

  const totalCount = relevantHistory.length;

  // 1. Process Roulette stats
  const rouletteData = useMemo(() => {
    if (gameType !== GameType.ROULETTE || totalCount === 0) return [];

    const numbers = relevantHistory.map(h => Number(h.result)).filter(n => !isNaN(n));
    const totalNumbers = numbers.length;

    if (totalNumbers === 0) return [];

    const counts: Record<string, number> = {};

    if (selectedRouletteTab === 'color') {
      counts['Preto'] = 0;
      counts['Vermelho'] = 0;
      counts['Zero'] = 0;

      numbers.forEach(num => {
        if (num === 0) counts['Zero']++;
        else if (COLOR_MAP.ROULETTE.RED.includes(num)) counts['Vermelho']++;
        else counts['Preto']++;
      });

      return [
        { name: 'Vermelho', value: counts['Vermelho'], percentage: totalNumbers > 0 ? (counts['Vermelho'] / totalNumbers) * 100 : 0, color: '#ef4444' },
        { name: 'Preto', value: counts['Preto'], percentage: totalNumbers > 0 ? (counts['Preto'] / totalNumbers) * 100 : 0, color: '#18181b' },
        { name: 'Zero', value: counts['Zero'], percentage: totalNumbers > 0 ? (counts['Zero'] / totalNumbers) * 100 : 0, color: '#10b981' }
      ];
    }

    if (selectedRouletteTab === 'parity') {
      counts['Par'] = 0;
      counts['Ímpar'] = 0;
      counts['Zero'] = 0;

      numbers.forEach(num => {
        if (num === 0) counts['Zero']++;
        else if (num % 2 === 0) counts['Par']++;
        else counts['Ímpar']++;
      });

      return [
        { name: 'Pares', value: counts['Par'], percentage: totalNumbers > 0 ? (counts['Par'] / totalNumbers) * 100 : 0, color: '#3b82f6' },
        { name: 'Ímpares', value: counts['Ímpar'], percentage: totalNumbers > 0 ? (counts['Ímpar'] / totalNumbers) * 100 : 0, color: '#f59e0b' },
        { name: 'Zero', value: counts['Zero'], percentage: totalNumbers > 0 ? (counts['Zero'] / totalNumbers) * 100 : 0, color: '#10b981' }
      ];
    }

    if (selectedRouletteTab === 'highLow') {
      counts['Baixo'] = 0;
      counts['Alto'] = 0;
      counts['Zero'] = 0;

      numbers.forEach(num => {
        if (num === 0) counts['Zero']++;
        else if (num >= 1 && num <= 18) counts['Baixo']++;
        else counts['Alto']++;
      });

      return [
        { name: 'Baixos (1-18)', value: counts['Baixo'], percentage: totalNumbers > 0 ? (counts['Baixo'] / totalNumbers) * 100 : 0, color: '#ec4899' },
        { name: 'Altos (19-36)', value: counts['Alto'], percentage: totalNumbers > 0 ? (counts['Alto'] / totalNumbers) * 100 : 0, color: '#8b5cf6' },
        { name: 'Zero', value: counts['Zero'], percentage: totalNumbers > 0 ? (counts['Zero'] / totalNumbers) * 100 : 0, color: '#10b981' }
      ];
    }

    if (selectedRouletteTab === 'dozen') {
      counts['Dúzia 1'] = 0;
      counts['Dúzia 2'] = 0;
      counts['Dúzia 3'] = 0;
      counts['Zero'] = 0;

      numbers.forEach(num => {
        if (num === 0) counts['Zero']++;
        else if (num >= 1 && num <= 12) counts['Dúzia 1']++;
        else if (num >= 13 && num <= 24) counts['Dúzia 2']++;
        else counts['Dúzia 3']++;
      });

      return [
        { name: '1ª Dúzia (1-12)', value: counts['Dúzia 1'], percentage: totalNumbers > 0 ? (counts['Dúzia 1'] / totalNumbers) * 100 : 0, color: '#06b6d4' },
        { name: '2ª Dúzia (13-24)', value: counts['Dúzia 2'], percentage: totalNumbers > 0 ? (counts['Dúzia 2'] / totalNumbers) * 100 : 0, color: '#3b82f6' },
        { name: '3ª Dúzia (25-36)', value: counts['Dúzia 3'], percentage: totalNumbers > 0 ? (counts['Dúzia 3'] / totalNumbers) * 100 : 0, color: '#6366f1' },
        { name: 'Zero', value: counts['Zero'], percentage: totalNumbers > 0 ? (counts['Zero'] / totalNumbers) * 100 : 0, color: '#10b981' }
      ];
    }

    if (selectedRouletteTab === 'column') {
      counts['Coluna 1'] = 0;
      counts['Coluna 2'] = 0;
      counts['Coluna 3'] = 0;
      counts['Zero'] = 0;

      numbers.forEach(num => {
        if (num === 0) counts['Zero']++;
        else if (num % 3 === 1) counts['Coluna 1']++;
        else if (num % 3 === 2) counts['Coluna 2']++;
        else counts['Coluna 3']++;
      });

      return [
        { name: '1ª Coluna', value: counts['Coluna 1'], percentage: totalNumbers > 0 ? (counts['Coluna 1'] / totalNumbers) * 100 : 0, color: '#f43f5e' },
        { name: '2ª Coluna', value: counts['Coluna 2'], percentage: totalNumbers > 0 ? (counts['Coluna 2'] / totalNumbers) * 100 : 0, color: '#14b8a6' },
        { name: '3ª Coluna', value: counts['Coluna 3'], percentage: totalNumbers > 0 ? (counts['Coluna 3'] / totalNumbers) * 100 : 0, color: '#fb7185' },
        { name: 'Zero', value: counts['Zero'], percentage: totalNumbers > 0 ? (counts['Zero'] / totalNumbers) * 100 : 0, color: '#10b981' }
      ];
    }

    return [];
  }, [relevantHistory, gameType, selectedRouletteTab, totalCount]);

  // 2. Process Baccarat stats
  const baccaratData = useMemo(() => {
    if (gameType !== GameType.BACCARAT || totalCount === 0) return [];

    const results = relevantHistory.map(h => String(h.result).toUpperCase().trim());
    const totalResults = results.length;

    if (totalResults === 0) return [];

    const counts = {
      player: 0,
      banker: 0,
      tie: 0
    };

    results.forEach(res => {
      if (res === 'P' || res === 'PLAYER' || res.startsWith('P')) counts.player++;
      else if (res === 'B' || res === 'BANKER' || res.startsWith('B')) counts.banker++;
      else if (res === 'T' || res === 'TIE' || res === 'EMPATE' || res.startsWith('T') || res.startsWith('E')) counts.tie++;
    });

    return [
      { name: 'Player (Jogador)', value: counts.player, percentage: totalResults > 0 ? (counts.player / totalResults) * 100 : 0, color: '#2563eb' },
      { name: 'Banker (Banca)', value: counts.banker, percentage: totalResults > 0 ? (counts.banker / totalResults) * 100 : 0, color: '#dc2626' },
      { name: 'Tie (Empate)', value: counts.tie, percentage: totalResults > 0 ? (counts.tie / totalResults) * 100 : 0, color: '#10b981' }
    ];
  }, [relevantHistory, gameType, totalCount]);

  const activeData = gameType === GameType.ROULETTE ? rouletteData : baccaratData;

  const galeStats = useMemo(() => {
    const chronological = [...relevantHistory]
      .reverse()
      .filter(h => h.isWin !== undefined);

    let currentLosses = 0;
    const counts: Record<number, number> = {};
    let totalWinsWithGale = 0;

    for (const h of chronological) {
      if (h.isWin) {
        counts[currentLosses] = (counts[currentLosses] || 0) + 1;
        totalWinsWithGale++;
        currentLosses = 0; // reset on win
      } else {
        currentLosses++;
      }
    }

    const maxLevelReached = Object.keys(counts).length > 0 
      ? Math.max(...Object.keys(counts).map(Number)) 
      : 0;

    const chartData = [];
    const maxToRender = Math.max(maxLevelReached, 3);

    for (let i = 0; i <= maxToRender; i++) {
      const val = counts[i] || 0;
      const pct = totalWinsWithGale > 0 ? (val / totalWinsWithGale) * 100 : 0;
      
      let color = '#10b981'; // G0 (Green)
      if (i === 1) color = '#3b82f6'; // G1 (Blue)
      else if (i === 2) color = '#f59e0b'; // G2 (Amber)
      else if (i >= 3) color = '#ef4444'; // G3+ (Red)

      chartData.push({
        level: i,
        name: i === 0 ? 'Sem Gale (G0)' : `Gale ${i} (G${i})`,
        value: val,
        percentage: pct,
        color
      });
    }

    return {
      chartData,
      totalWinsWithGale,
      maxLevelReached
    };
  }, [relevantHistory]);

  const currentData = analysisType === 'results' ? activeData : galeStats.chartData;

  const rouletteTabItems: { id: RouletteCategory; label: string; icon: React.ReactNode }[] = [
    { id: 'color', label: 'Cores', icon: <Sparkles size={13} /> },
    { id: 'parity', label: 'Paridade', icon: <Shuffle size={13} /> },
    { id: 'highLow', label: 'Altos / Baixos', icon: <Layers size={13} /> },
    { id: 'dozen', label: 'Dúzias', icon: <Grid size={13} /> },
    { id: 'column', label: 'Colunas', icon: <Columns size={13} /> },
  ];

  return (
    <div id="distribution-stats-panel" className="p-5 rounded-3xl border border-white/10 bg-[#111111]/90 shadow-2xl backdrop-blur-xl relative overflow-hidden flex flex-col h-full">
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#c6a34f]/5 rounded-full filter blur-2xl pointer-events-none" />
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4 z-10">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-[#c6a34f]/10 border border-[#c6a34f]/20">
            <BarChart3 className="text-[#c6a34f]" size={18} />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-[#c6a34f]">
              {analysisType === 'results' ? 'Estatísticas de Distribuição' : 'Distribuição de Gales (Martingale)'}
            </h3>
            <span className="text-[10px] text-white/40 uppercase font-bold">
              {analysisType === 'results' 
                ? `Análise em tempo real (${totalCount} ${totalCount !== unfilteredCount ? `de ${unfilteredCount}` : ''} rodadas)`
                : `Frequência de Gales (${galeStats.totalWinsWithGale} vitórias analisadas)`
              }
            </span>
          </div>
        </div>

        {unfilteredCount > 0 && (
          <div className="flex flex-wrap items-center gap-3 self-end lg:self-auto">
            {/* Analysis Mode selector */}
            <div className="flex items-center gap-1 p-1 bg-white/[0.03] border border-white/5 rounded-2xl">
              <button
                onClick={() => setAnalysisType('results')}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                  analysisType === 'results'
                    ? 'bg-[#c6a34f] text-black shadow-lg shadow-[#c6a34f]/10 font-extrabold'
                    : 'text-white/60 hover:text-white border border-transparent hover:bg-white/5'
                }`}
              >
                Resultados
              </button>
              <button
                onClick={() => setAnalysisType('gales')}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                  analysisType === 'gales'
                    ? 'bg-[#c6a34f] text-black shadow-lg shadow-[#c6a34f]/10 font-extrabold'
                    : 'text-white/60 hover:text-white border border-transparent hover:bg-white/5'
                }`}
              >
                Gales (Martingale)
              </button>
            </div>

            {/* Period selector */}
            <div className="flex items-center gap-1 p-1 bg-white/[0.03] border border-white/5 rounded-2xl">
              <span className="text-[10px] font-black uppercase text-white/40 px-2 tracking-wider">Janela:</span>
              {([50, 100, 500, 'all'] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setPeriodLimit(opt)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                    periodLimit === opt
                      ? 'bg-amber-500/15 border border-amber-500/40 text-amber-400 font-extrabold shadow-sm'
                      : 'text-white/50 hover:text-white border border-transparent hover:bg-white/5'
                  }`}
                >
                  {opt === 'all' ? 'Tudo' : `${opt}`}
                </button>
              ))}
            </div>

            {/* View Mode */}
            <div className="flex items-center gap-1 p-1 bg-white/[0.03] border border-white/5 rounded-2xl">
              <button
                onClick={() => setViewMode('chart')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                  viewMode === 'chart'
                    ? 'bg-[#c6a34f] text-black shadow-lg shadow-[#c6a34f]/10 font-extrabold'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <BarChart3 size={13} />
                Visual
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-[#c6a34f] text-black shadow-lg shadow-[#c6a34f]/10 font-extrabold'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <Table size={13} />
                Tabela
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Selector Tabs for Roulette */}
      {gameType === GameType.ROULETTE && totalCount > 0 && analysisType === 'results' && (
        <div className="flex flex-wrap gap-1.5 p-1.5 bg-white/[0.03] border border-white/5 rounded-2xl mb-4 z-10">
          {rouletteTabItems.map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedRouletteTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                selectedRouletteTab === tab.id
                  ? 'bg-[#c6a34f] text-black shadow-lg shadow-[#c6a34f]/10 font-extrabold'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Main Content & Chart */}
      <div className="flex-1 min-h-[220px] flex flex-col justify-center z-10">
        {totalCount === 0 ? (
          <div className="text-center py-10 px-4">
            <Percent className="mx-auto text-white/10 mb-2 animate-pulse" size={32} />
            <p className="text-xs text-white/40 uppercase font-black tracking-wider">
              Nenhum resultado registrado ainda
            </p>
            <p className="text-[10px] text-white/20 uppercase font-semibold mt-1">
              Insira rodadas para gerar os gráficos de distribuição em tempo real
            </p>
          </div>
        ) : analysisType === 'gales' && galeStats.totalWinsWithGale === 0 ? (
          <div className="text-center py-10 px-4">
            <Layers className="mx-auto text-white/10 mb-2 animate-pulse" size={32} />
            <p className="text-xs text-white/40 uppercase font-black tracking-wider">
              Nenhuma vitória registrada no histórico
            </p>
            <p className="text-[10px] text-white/20 uppercase font-semibold mt-1">
              Insira rodadas com resultados positivos para gerar o gráfico de profundidade do martingale
            </p>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col justify-between">
            {viewMode === 'chart' ? (
              <div className="w-full space-y-4 py-2">
                {currentData.map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5 font-bold text-white/80">
                        <span className="w-2.5 h-2.5 rounded-full border border-white/10" style={{ backgroundColor: item.color }} />
                        <span>{item.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 font-mono">
                        <span className="text-white/40">({item.value}x)</span>
                        <span className="font-extrabold text-[#c6a34f]">{item.percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="w-full h-3 bg-white/[0.03] rounded-full overflow-hidden border border-white/5">
                      <div 
                        className="h-full rounded-full transition-all duration-300"
                        style={{ 
                          width: `${item.percentage}%`,
                          backgroundColor: item.color 
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Table Area */
              <div className="w-full h-[230px] overflow-y-auto pr-1">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-[9px] uppercase tracking-wider text-white/40 font-black">
                      <th className="py-2.5 px-2">Categoria / Item</th>
                      <th className="py-2.5 px-2 text-right">Ocorrências</th>
                      <th className="py-2.5 px-2 text-right">Frequência</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {currentData.map((item, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="py-3 px-2 text-xs font-black text-white flex items-center gap-2">
                          <span 
                            className="w-2.5 h-2.5 rounded-full border border-white/10 flex-shrink-0" 
                            style={{ backgroundColor: item.color }} 
                          />
                          {item.name}
                        </td>
                        <td className="py-3 px-2 text-xs font-mono font-bold text-white/80 text-right">
                          {item.value}x
                        </td>
                        <td className="py-3 px-2 text-xs font-mono font-black text-[#c6a34f] text-right">
                          {item.percentage.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {analysisType === 'gales' && (
              <div className="mt-4 p-3 bg-white/[0.02] border border-white/5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#c6a34f] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#c6a34f]"></span>
                  </span>
                  <div>
                    <span className="text-white/40 uppercase font-black text-[9px] block">Profundidade Máxima de Gale</span>
                    <span className="text-white font-bold">
                      {galeStats.maxLevelReached === 0 
                        ? 'Nenhum Gale (G0 cobriu tudo)' 
                        : `Gale ${galeStats.maxLevelReached} (G${galeStats.maxLevelReached})`}
                    </span>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-white/40 uppercase font-black text-[9px] block">Configuração Recomendada</span>
                  <span className="text-[#c6a34f] font-black">
                    {galeStats.maxLevelReached === 0 
                      ? 'G0 ou G1 para segurança' 
                      : `Mínimo G${galeStats.maxLevelReached} (G${galeStats.maxLevelReached} Martingales)`}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
