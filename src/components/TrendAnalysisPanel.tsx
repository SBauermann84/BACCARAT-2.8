import React from 'react';
import { motion } from 'motion/react';
import { Flame, Sparkles, TrendingUp, HelpCircle, Swords, Zap, TableProperties } from 'lucide-react';
import { TrendRecommendation, trendAnalysisEngine } from '../engines/trendAnalysisEngine';
import { GameResult, GameType } from '../types';
import { useTranslation } from '../locales/translations';

interface TrendAnalysisPanelProps {
  gameType: GameType;
  history: GameResult[];
  onApplyEntry?: (entry: string) => void;
  compact?: boolean;
}

export const TrendAnalysisPanel: React.FC<TrendAnalysisPanelProps> = ({ gameType, history, onApplyEntry, compact = false }) => {
  const { tEntry } = useTranslation();
  const isRoulette = gameType === GameType.ROULETTE;
  
  const { recommendations, mostAssertive, streakStats, categoryDetails } = React.useMemo(() => {
    if (isRoulette) {
      const stats = trendAnalysisEngine.getRouletteTrends(history);
      return {
        recommendations: stats.recommendations,
        mostAssertive: stats.mostAssertive,
        streakStats: null,
        categoryDetails: stats.categoryDetails
      };
    } else {
      const stats = trendAnalysisEngine.getBaccaratTrends(history);
      return {
        recommendations: stats.recommendations,
        mostAssertive: stats.mostAssertive,
        streakStats: stats.streakStats,
        categoryDetails: null
      };
    }
  }, [gameType, history, isRoulette]);

  if (history.length < 5) {
    return (
      <div className="bg-[#111111] p-8 rounded-3xl border border-white/5 flex flex-col items-center justify-center text-center">
        <Sparkles className="text-[#c6a34f] opacity-35 mb-2 animate-pulse" size={32} />
        <h4 className="text-xs uppercase tracking-widest font-bold text-[#c6a34f]/80">Aguardando Coleta de Dados</h4>
        <p className="text-[10px] text-white/30 max-w-xs mt-1">
          Insira pelo menos 5 resultados históricos para ativar as análises avançadas de confluência por padrões e setores quentes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest text-[#c6a34f] flex items-center gap-2">
            <TrendingUp size={16} /> 🔥 Análise Avançada de Tendências
          </h3>
          <p className="text-[9px] text-white/40 uppercase tracking-tight mt-0.5">
            {isRoulette ? 'Análise Multi-Escala por Confluência de Padrões e Setores Quentes' : 'Rastreamento de Sequência de Casas 3, 4 e 5 Vertical/Horizontal'}
          </p>
        </div>
        <span className="px-2 py-0.5 rounded bg-zinc-800 text-[8px] font-bold text-zinc-400 border border-white/5 uppercase tracking-wider">
          Tempo Real
        </span>
      </div>

      {mostAssertive && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-3xl p-5 border overflow-hidden bg-gradient-to-br from-[#c6a34f]/15 via-black/40 to-black/65 border-[#c6a34f]/40 shadow-[0_4px_30px_rgba(198,163,79,0.15)]"
        >
          {/* Decorative background pulse */}
          <div className="absolute -right-16 -top-16 w-36 h-36 bg-[#c6a34f]/10 rounded-full blur-2xl animate-pulse" />
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative z-10">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-[#c6a34f] text-black tracking-widest animate-pulse">
                  CONFLUÊNCIA MÁXIMA
                </span>
                <span className="text-[10px] text-white/40 font-mono">• {mostAssertive.category}</span>
              </div>
              <h4 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                <Flame className="text-amber-500 fill-amber-500" size={16} />
                {mostAssertive.name} 
              </h4>
              <p className="text-[10px] text-white/60 leading-relaxed max-w-md">
                {mostAssertive.description}
              </p>
            </div>

            <div className="flex items-center gap-4 self-stretch sm:self-auto justify-between border-t border-white/5 pt-3 sm:border-0 sm:pt-0">
              <div className="text-left sm:text-right">
                <div className="text-[10px] font-bold text-[#c6a34f] uppercase tracking-widest">Entrada de Alta Probabilidade</div>
                <div className="text-2xl font-black text-white uppercase tracking-tighter mt-1">{tEntry(mostAssertive.entry)}</div>
                <div className="text-[9px] font-mono text-zinc-500">Confiança: <span className="text-green-500 font-bold">{mostAssertive.confidence.toFixed(0)}%</span></div>
              </div>
              
              {onApplyEntry && (
                <button
                  onClick={() => onApplyEntry(mostAssertive.entry)}
                  className="px-4 py-2 text-[9px] font-black uppercase tracking-widest bg-[#c6a34f] text-black rounded-xl hover:scale-105 active:scale-95 transition-transform"
                >
                  Usar Entrada
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Main Analysis Sections */}
      {!compact && isRoulette && categoryDetails && (
        <div className="grid gap-4">
          {/* External bets details */}
          <div className="bg-[#111111] p-4 rounded-2xl border border-white/5 space-y-3">
             <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-[#c6a34f] flex items-center gap-1.5">
                   <Zap size={12} /> Apostas Externas (Altos/Baixos, Par/Ímpar, Cor)
                </span>
                <span className="text-[8px] font-mono text-white/30 lowercase">período: 6 rodadas</span>
             </div>
             <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {categoryDetails.external?.map((ext: any, i: number) => (
                  <div key={i} className="bg-black/40 p-3 rounded-xl border border-white/[0.03] space-y-1 relative group hover:border-white/10 transition-colors">
                     <span className="text-[9px] font-bold text-white/50 block">{ext.name}</span>
                     <div className="flex items-baseline gap-1.5">
                       <span className="text-xs font-black text-white">{ext.freq}/6</span>
                       <span className="text-[8px] text-white/40 uppercase">saídas</span>
                     </div>
                     <div className="flex items-center justify-between text-[8px] pt-1.5 border-t border-white/5 mt-1.5">
                       <span className="text-zinc-500">Acertivos: <strong className="text-[#c6a34f] font-mono">{ext.assertiveness}%</strong></span>
                       {ext.streak >= 2 && <span className="text-amber-500 font-bold font-mono">+{ext.streak}x</span>}
                     </div>
                  </div>
                ))}
             </div>
          </div>

          {/* Dozens and Columns */}
          <div className="bg-[#111111] p-4 rounded-2xl border border-white/5 space-y-3">
             <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-[#c6a34f] flex items-center gap-1.5">
                   <Zap size={12} /> Dúzias & Colunas
                </span>
                <span className="text-[8px] font-mono text-white/30 lowercase">período: 12 rodadas</span>
             </div>
             <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {categoryDetails.dozensColumns?.map((item: any, i: number) => (
                  <div key={i} className="bg-black/40 p-3 rounded-xl border border-white/[0.03] space-y-1 relative group hover:border-white/10 transition-colors">
                     <span className="text-[9px] font-bold text-white/50 block">{item.name}</span>
                     <div className="flex items-baseline gap-1.5">
                       <span className="text-xs font-black text-white">{item.freq}/12</span>
                       <span className="text-[8px] text-white/40 uppercase">saídas</span>
                     </div>
                     <div className="flex items-center justify-between text-[8px] pt-1.5 border-t border-white/5 mt-1.5">
                       <span className="text-zinc-500">Acertivos: <strong className="text-[#c6a34f] font-mono">{item.assertiveness}%</strong></span>
                     </div>
                  </div>
                ))}
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Streets & Corners Top Hot list */}
            <div className="bg-[#111111] p-4 rounded-2xl border border-white/5 space-y-3">
               <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-[#c6a34f]">Ruas (18rd) & Cantos (24rd) Quentes</span>
                  <span className="text-[8px] text-white/30 uppercase font-mono">Mais Frequentes</span>
               </div>
               <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                  {categoryDetails.streetsCorners?.slice(0, 10).sort((a: any, b: any) => b.freq - a.freq || b.assertiveness - a.assertiveness).map((item: any, i: number) => (
                    <div key={i} className="bg-black/30 p-2 rounded-lg flex items-center justify-between text-[9px] border border-white/[0.02]">
                       <span className="font-bold text-white/70">{item.name}</span>
                       <div className="flex gap-4 font-mono">
                         <span className="text-green-500 font-bold">Freq: {item.freq}x</span>
                         <span className="text-[#c6a34f] font-bold">Acertivos: {item.assertiveness}%</span>
                       </div>
                    </div>
                  ))}
               </div>
            </div>

            {/* Plenos Top lists */}
            <div className="bg-[#111111] p-4 rounded-2xl border border-white/5 space-y-3">
               <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-[#c6a34f]">Plenos Quentes (37 Rodadas)</span>
                  <span className="text-[8px] text-white/30 uppercase font-mono">Melhores</span>
               </div>
               <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar font-mono">
                  {categoryDetails.numbers?.filter((n: any) => n.freq > 0).sort((a: any, b: any) => b.freq - a.freq).slice(0, 10).map((item: any, i: number) => (
                    <div key={i} className="bg-black/30 p-2 rounded-lg flex items-center justify-between text-[9px] border border-white/[0.02]">
                       <span className="font-bold text-white/70">Pleno {item.val}</span>
                       <div className="flex gap-4">
                         <span className="text-amber-500 font-bold">Sorteadas: {item.freq}x</span>
                         <span className="text-[#c6a34f] font-bold">Acertivos: {item.assertiveness}%</span>
                       </div>
                    </div>
                  ))}
                  {categoryDetails.numbers?.filter((n: any) => n.freq > 0).length === 0 && (
                    <span className="text-[9px] text-white/30 text-center block py-6">Nenhuma repetição nas últimas 37 rodadas</span>
                  )}
               </div>
            </div>
          </div>
        </div>
      )}

      {!compact && !isRoulette && streakStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Vertical Streaks Count Card */}
          <div className="bg-[#111111] p-5 rounded-2xl border border-white/5 space-y-4">
             <div className="flex items-center gap-2">
                <TableProperties className="text-blue-400" size={16} />
                <h4 className="text-[10px] font-black uppercase tracking-wider text-white">Análise Vertical (Colunas)</h4>
             </div>
             
             <div className="space-y-3">
                {['P', 'B', 'T'].map((outcome) => {
                  const label = outcome === 'P' ? 'Player (P)' : outcome === 'B' ? 'Banker (B)' : 'Tie (T)';
                  const total = (streakStats.vertical[`${outcome}3`] || 0) + (streakStats.vertical[`${outcome}4`] || 0) + (streakStats.vertical[`${outcome}5`] || 0);
                  
                  return (
                    <div key={outcome} className="bg-black/30 p-3 rounded-xl border border-white/[0.03]">
                      <div className="flex justify-between items-center mb-1.5 text-[9px] font-bold">
                         <span className="text-white/60">{label}</span>
                         <span className="text-[#c6a34f] font-mono">{total} seqs.</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 font-mono text-[8px] text-zinc-400">
                         <div className="bg-white/5 p-1 rounded text-center">R3: {streakStats.vertical[`${outcome}3`] || 0}</div>
                         <div className="bg-white/5 p-1 rounded text-center">R4: {streakStats.vertical[`${outcome}4`] || 0}</div>
                         <div className="bg-white/5 p-1 rounded text-center">R5: {streakStats.vertical[`${outcome}5`] || 0}</div>
                      </div>
                    </div>
                  );
                })}
             </div>
          </div>

          {/* Horizontal Streaks Count Card */}
          <div className="bg-[#111111] p-5 rounded-2xl border border-white/5 space-y-4">
             <div className="flex items-center gap-2">
                <Swords className="text-red-400" size={16} />
                <h4 className="text-[10px] font-black uppercase tracking-wider text-white">Análise Horizontal (Linhas)</h4>
             </div>
             
             <div className="space-y-3">
                {['P', 'B', 'T'].map((outcome) => {
                  const label = outcome === 'P' ? 'Player (P)' : outcome === 'B' ? 'Banker (B)' : 'Tie (T)';
                  const total = (streakStats.horizontal[`${outcome}3`] || 0) + (streakStats.horizontal[`${outcome}4`] || 0) + (streakStats.horizontal[`${outcome}5`] || 0);
                  
                  return (
                    <div key={outcome} className="bg-black/30 p-3 rounded-xl border border-white/[0.03]">
                      <div className="flex justify-between items-center mb-1.5 text-[9px] font-bold">
                         <span className="text-white/60">{label}</span>
                         <span className="text-[#c6a34f] font-mono">{total} seqs.</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 font-mono text-[8px] text-zinc-400">
                         <div className="bg-white/5 p-1 rounded text-center">R3: {streakStats.horizontal[`${outcome}3`] || 0}</div>
                         <div className="bg-white/5 p-1 rounded text-center">R4: {streakStats.horizontal[`${outcome}4`] || 0}</div>
                         <div className="bg-white/5 p-1 rounded text-center">R5: {streakStats.horizontal[`${outcome}5`] || 0}</div>
                      </div>
                    </div>
                  );
                })}
             </div>
          </div>
        </div>
      )}
      
      <div className="flex items-center gap-1 text-[8px] text-white/30 uppercase tracking-widest justify-center">
         <HelpCircle size={10} /> O sistema prioriza e projeta o padrão com maior significância estatística no momento.
      </div>
    </div>
  );
};
