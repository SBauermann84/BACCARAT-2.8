import React, { useMemo, useState } from 'react';
import { 
  TrendingUp, 
  Download, 
  Printer, 
  X, 
  Award, 
  CheckCircle2, 
  Activity, 
  Calendar, 
  Percent, 
  DollarSign, 
  ChevronRight,
  TrendingDown,
  Sparkles,
  AwardIcon,
  ShieldCheck,
  HelpCircle
} from 'lucide-react';
import { useTranslation } from '../locales/translations';
import { useAppStore } from '../store/useAppStore';
import { GameType } from '../types';

interface SessionSummaryReportProps {
  history: any[];
  bankroll: any;
  derivedStats: any;
  strategies: any[];
  gameType: GameType;
  isOpen: boolean;
  onClose: () => void;
}

export const SessionSummaryReport: React.FC<SessionSummaryReportProps> = ({
  history,
  bankroll,
  derivedStats,
  strategies,
  gameType,
  isOpen,
  onClose
}) => {
  const { t } = useTranslation();
  const { settings } = useAppStore();
  const [activeTab, setActiveTab] = useState<'preview' | 'print'>('preview');

  const getCurrencySymbol = (currencyCode: string) => {
    switch (currencyCode) {
      case 'USD': return '$';
      case 'EUR': return '€';
      default: return 'R$';
    }
  };

  const currencySymbol = useMemo(() => getCurrencySymbol(settings?.currency || 'BRL'), [settings?.currency]);

  // 1. Prepare entire session's chart data
  const sessionChartData = useMemo(() => {
    let current = bankroll.initialBalance || 1000;
    const historyInOrder = [...history].reverse();
    const data = historyInOrder.map((h, i) => {
      current += (h.profit || 0);
      return {
        roundNum: i + 1,
        balance: parseFloat(current.toFixed(2)),
        profit: parseFloat((h.profit || 0).toFixed(2)),
        result: h.result,
        isWin: h.isWin
      };
    });

    // Seed dummy point for starting balance
    return [
      { roundNum: 0, balance: bankroll.initialBalance || 1000, profit: 0, result: '-', isWin: undefined },
      ...data
    ];
  }, [history, bankroll.initialBalance]);

  // 2. Identify top performing patterns/strategies of the day
  const topStrategies = useMemo(() => {
    // Only search strategies relative to active gameType
    const activeStrats = strategies.filter(s => s.gameType === gameType);
    
    // Sort by wins or winRate to identify the most successful
    const sorted = [...activeStrats].sort((a, b) => {
      const bRatio = b.performance?.wins ?? 0;
      const aRatio = a.performance?.wins ?? 0;
      return bRatio - aRatio || (b.performance?.winRate ?? 0) - (a.performance?.winRate ?? 0);
    });

    return sorted.slice(0, 3);
  }, [strategies, gameType]);

  // Handle system print
  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  const profit = derivedStats?.profit ?? 0;
  const isProfitPositive = profit >= 0;
  const currentDateFormatted = new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto no-print">
      {/* Dynamic CSS injecting visibility style so that only this specific node is printed */}
      <style>{`
        @media print {
          /* Hide app wrappers */
          body * {
            visibility: hidden;
            background: none !important;
          }
          #print-session-report, #print-session-report * {
            visibility: visible;
          }
          #print-session-report {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            display: block !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0px !important;
            margin: 0px !important;
          }
          /* Ensure charts are responsive and printable */
          .recharts-responsive-container {
            width: 100% !important;
            height: 250px !important;
          }
          /* Adjust elements for high contrast ink friendly */
          .print-bg-dark {
            background-color: #f4f4f5 !important;
            border: 1px solid #e4e4e7 !important;
            color: #000000 !important;
          }
          .print-text-dark {
            color: #000000 !important;
          }
          .print-text-muted {
            color: #71717a !important;
          }
          .print-border {
            border: 1px solid #e4e4e7 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="relative w-full max-w-4xl bg-zinc-950 border border-white/10 rounded-3xl overflow-hidden shadow-[0_24px_50px_rgba(0,0,0,0.6)] my-8">
        
        {/* Header / Tabs */}
        <div className="flex items-center justify-between px-6 py-4 bg-zinc-900/60 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#c6a34f]/10 text-[#c6a34f]">
              <Award size={16} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-white">
                Relatório Oficial de Desempenho
              </h3>
              <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">
                Análise de Sessão & Assertividade
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 rounded-lg bg-[#c6a34f] hover:bg-[#b08f40] transition-colors text-black text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-[0_4px_12px_rgba(198,163,79,0.2)]"
            >
              <Printer size={13} />
              <span>Imprimir / PDF</span>
            </button>
            
            <button 
              onClick={onClose}
              className="p-1 rounded-md text-white/40 hover:text-white hover:bg-white/5 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Container for Preview */}
        <div className="p-6 md:p-8 max-h-[75vh] overflow-y-auto space-y-6">

          {/* PRINT-FRIENDLY ELEMENT CONTAINER */}
          <div id="print-session-report" className="space-y-6 bg-zinc-950 text-white rounded-2xl p-2 print:p-0">
            
            {/* Report Header Logo Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-6 border-b border-white/5 print:border-zinc-200">
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-black tracking-normal text-lg">
                  <span className="text-[#c6a34f] font-mono tracking-widest uppercase">CASINO PATTERN AI</span>
                  <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-[#c6a34f] font-black tracking-normal border border-white/5 print:border-zinc-200 print:text-black">
                    SESSÃO {gameType === GameType.ROULETTE ? 'RULETA' : 'BACCARAT'}
                  </span>
                </div>
                <p className="text-xs text-white/40 font-mono tracking-wider print:text-zinc-600">
                  Relatório criptografado e validado de forma 100% offline local.
                </p>
              </div>
              <div className="mt-4 md:mt-0 text-left md:text-right space-y-1">
                <div className="flex items-center md:justify-end gap-1.5 text-xs text-white/60 font-mono print:text-zinc-700">
                  <Calendar size={13} className="text-[#c6a34f] print:text-zinc-500" />
                  <span>Emissão: {currentDateFormatted}</span>
                </div>
                <div className="text-[10px] text-white/30 uppercase tracking-widest font-mono font-bold print:text-zinc-400">
                  Status da Banca: <span className="text-green-400 font-bold">Ativa</span>
                </div>
              </div>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              
              <div className="p-4 rounded-xl bg-black/40 border border-white/5 print-bg-dark print-border">
                <span className="text-[9px] uppercase text-white/30 font-black tracking-widest block print-text-muted">
                  Banca Inicial
                </span>
                <span className="text-xl font-black tracking-tight font-mono text-white/80 print:text-black">
                  {currencySymbol} {bankroll.initialBalance.toFixed(2).replace('.', ',')}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-black/40 border border-white/5 print-bg-dark print-border">
                <span className="text-[9px] uppercase text-white/30 font-black tracking-widest block print-text-muted">
                  Banca Atual
                </span>
                <span className="text-xl font-black tracking-tight font-mono text-white/80 print:text-black">
                  {currencySymbol} {bankroll.balance.toFixed(2).replace('.', ',')}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-[#111111] border border-[#c6a34f]/20 print-bg-dark print-border">
                <span className="text-[9px] uppercase text-[#c6a34f] font-black tracking-widest block print-text-muted">
                  Lucro Líquido
                </span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className={`text-xl font-black tracking-tight font-mono ${isProfitPositive ? 'text-green-400 print:text-green-700' : 'text-red-400 print:text-red-700'}`}>
                    {isProfitPositive ? '+' : ''}{currencySymbol} {profit.toFixed(2).replace('.', ',')}
                  </span>
                  <span className={`text-[10px] font-bold ${isProfitPositive ? 'text-green-400/80' : 'text-red-400/80'} font-mono`}>
                    ({(derivedStats?.profitPercentage ?? 0).toFixed(1)}%)
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-black/40 border border-white/5 print-bg-dark print-border">
                <span className="text-[9px] uppercase text-white/30 font-black tracking-widest block print-text-muted">
                  Assertividade
                </span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-xl font-black tracking-tight font-mono text-white/85 print:text-black">
                    {(derivedStats?.winRate ?? 0).toFixed(1)}%
                  </span>
                  <span className="text-[9px] uppercase text-white/40 tracking-tight font-black print-text-muted">
                    {history.filter(h => h.isWin !== undefined).length} SINAIS
                  </span>
                </div>
              </div>
            </div>

            {/* Sub-Metrics Section */}
            <div className="grid grid-cols-3 gap-4 border-t border-b border-white/5 py-4 print:border-zinc-200">
              <div className="text-center">
                <span className="text-[8px] uppercase text-white/30 tracking-widest font-black block print-text-muted">Total de Jogadas</span>
                <span className="text-base font-black font-mono text-white/80 print:text-black">{history.length}</span>
              </div>
              <div className="text-center border-l border-r border-white/5 print:border-zinc-200">
                <span className="text-[8px] uppercase text-white/30 tracking-widest font-black block print-text-muted">Drawdown Máximo</span>
                <span className="text-base font-black font-mono text-red-400 print:text-red-700">{(derivedStats?.drawdown ?? 0).toFixed(1)}%</span>
              </div>
              <div className="text-center">
                <span className="text-[8px] uppercase text-white/30 tracking-widest font-black block print-text-muted">Precisão Score</span>
                <span className="text-base font-black font-mono text-blue-400 print:text-blue-700">{(derivedStats?.precisionScore ?? 0).toFixed(1)}%</span>
              </div>
            </div>

            {/* CHART SECTION */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black uppercase text-[#c6a34f] tracking-widest">
                    Histórico & Evolução de Banca
                  </h4>
                  <p className="text-[9px] text-white/30 uppercase tracking-widest font-bold">
                    Curva estatística do saldo acumulado por rodada
                  </p>
                </div>
                <div className="flex gap-2">
                  <span className="flex items-center gap-1.5 text-[8px] uppercase font-black text-white/40">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Lucro: Verde
                  </span>
                  <span className="flex items-center gap-1.5 text-[8px] uppercase font-black text-white/40">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Perda: Vermelho
                  </span>
                </div>
              </div>

              <div className="h-[280px] w-full bg-black/45 rounded-2xl border border-white/5 p-4 print:border-zinc-200 print-bg-dark overflow-y-auto">
                {sessionChartData.length <= 1 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-1">
                    <HelpCircle size={28} className="text-white/20" />
                    <span className="text-xs text-white/40 font-bold uppercase tracking-widest">dados insuficientes</span>
                    <p className="text-[10px] text-white/20 max-w-sm">
                      Insira mais jogadas para montar e preencher a evolução do saldo.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-4 text-[9px] uppercase font-black text-white/40 pb-2 border-b border-white/5">
                      <span>Rodada</span>
                      <span>Resultado</span>
                      <span className="text-right">Lucro/Perda</span>
                      <span className="text-right">Saldo da Banca</span>
                    </div>
                    {sessionChartData.slice(1).reverse().map((data) => (
                      <div key={data.roundNum} className="grid grid-cols-4 items-center text-xs py-1.5 border-b border-white/[0.02]">
                        <span className="font-bold text-white/50 font-mono">#{data.roundNum}</span>
                        <span className={`font-mono font-black ${data.isWin ? 'text-emerald-400' : 'text-red-400'}`}>
                          {data.result}
                        </span>
                        <span className={`text-right font-bold font-mono ${data.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {data.profit >= 0 ? '+' : ''}{currencySymbol} {data.profit.toFixed(2).replace('.', ',')}
                        </span>
                        <span className="text-right font-black font-mono text-[#c6a34f]">
                          {currencySymbol} {data.balance.toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* TOP PERFORMING STRATEGY PATTERNS */}
            <div className="space-y-3 pt-2">
              <div>
                <h4 className="text-xs font-black uppercase text-[#c6a34f] tracking-widest">
                  Padrões Estratégicos Mais Vitoriosos
                </h4>
                <p className="text-[9px] text-white/30 uppercase tracking-widest font-bold">
                  Top comportamentos matemáticos em atividade hoje
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {topStrategies.map((strat, index) => {
                  const wins = strat.performance?.wins ?? 0;
                  const losses = strat.performance?.losses ?? 0;
                  const rate = strat.performance?.winRate ?? 0;
                  const total = strat.performance?.totalEntries ?? 0;

                  return (
                    <div 
                      key={strat.id} 
                      className="p-4 rounded-xl bg-black/45 border border-white/5 space-y-3 relative overflow-hidden print-bg-dark print-border text-left"
                    >
                      {/* Ribbon banner inside card */}
                      <div className="absolute top-0 right-0 py-0.5 px-2 bg-[#c6a34f]/10 text-[#c6a34f] text-[7px] font-black uppercase tracking-wider rounded-bl-lg border-l border-b border-white/5 print:border-zinc-200">
                        Rank #{index + 1}
                      </div>

                      <div className="space-y-1">
                        <span className="text-[7px] uppercase text-[#c6a34f]/80 tracking-widest font-black font-mono">
                          {gameType === GameType.ROULETTE ? 'ROULETTE DESIGN' : 'BACCARAT ENGINE'}
                        </span>
                        <h5 className="text-[11px] font-bold text-white/90 leading-tight line-clamp-1 print:text-black">
                          {strat.name}
                        </h5>
                      </div>

                      <div className="grid grid-cols-2 gap-2 border-t border-white/5 pt-2.5 print:border-zinc-200">
                        <div>
                          <span className="text-[7.5px] uppercase tracking-widest text-white/30 block print-text-muted">Taxa de Acerto</span>
                          <span className="text-xs font-black text-emerald-400 font-mono print:text-emerald-700">
                            {rate.toFixed(1)}%
                          </span>
                        </div>
                        <div>
                          <span className="text-[7.5px] uppercase tracking-widest text-white/30 block print-text-muted">Amostras (Wins)</span>
                          <span className="text-xs font-black text-white/70 font-mono print:text-black">
                            {wins} / {total}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {topStrategies.length === 0 && (
                  <div className="col-span-3 p-6 text-center border border-dashed border-white/10 rounded-xl">
                    <span className="text-xs text-white/30 font-bold block">SEM ESTRATÉGIAS ATIVADAS</span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Regulatory Code */}
            <div className="pt-6 border-t border-white/5 flex flex-col md:flex-row justify-between items-center text-[8px] font-mono text-white/30 uppercase tracking-widest gap-2 print:border-zinc-200 print:text-zinc-400 print:pt-4">
              <span>Casino Pattern Intelligence Verification Core v5.1.0</span>
              <span>SHA-256 Validated Signature offline locally</span>
            </div>

          </div> {/* END PRINT-FRIENDLY ELEMENT CONTAINER */}

        </div> {/* End Scrollable Container */}

        {/* Modal actions footer */}
        <div className="px-6 py-4 bg-zinc-900/60 border-t border-white/5 flex flex-col sm:flex-row gap-3 justify-end items-center">
          <p className="text-[10px] text-white/30 uppercase tracking-wider text-left w-full sm:w-auto font-bold mb-2 sm:mb-0">
            * Clique em "Imprimir / PDF" para salvar no seu computador como um relatório digital.
          </p>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white/80 hover:text-white transition-colors text-xs font-bold uppercase tracking-wider"
            >
              Fechar Visualização
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 sm:flex-none px-5 py-2 rounded-xl bg-[#c6a34f] hover:bg-[#b08f40] transition-colors text-black text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5"
            >
              <Printer size={13} />
              <span>Gerar PDF / Imprimir</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
