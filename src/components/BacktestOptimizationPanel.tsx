import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { GameType, GameResult, ManagementMode, RiskProfile, ManagementConfig } from '../types';
import { updateProgressionState, getInitialProgressionState } from '../engines/progressionEngine';
import { analyzeRouletteResult } from '../engines/statsEngine';
import { safeStorage } from '../utils/safeStorage';
import { 
  Sparkles, ShieldCheck, TrendingUp, Target, Percent, DollarSign, 
  Trash2, Play, RefreshCw, AlertCircle, Calendar, ArrowRight, Clock,
  PlayCircle, Award, Zap, AlertTriangle, HelpCircle, History, X
} from 'lucide-react';

// Interfaces
export interface SimStrategyResult {
  id: string;
  name: string;
  winRate: number;
  wins: number;
  losses: number;
  totalProfit: number; // in units (R$ 1,00)
  maxDrawdown: number; // in units (R$ 1,00)
  maxConsecutiveLosses: number;
  recommendedBankroll: number; // in units (R$ 1,00)
}

interface SavedOptimizationRecord {
  id: string;
  timestamp: number;
  gameType: GameType;
  managementMode: ManagementMode;
  bestStrategy: string;
  bestWinRate: number;
  bestProfit: number;
  recommendedBankroll: number;
  sampleSize: number;
}

export const BacktestOptimizationPanel: React.FC = () => {
  const { 
    backtestHistoryRoulette, 
    backtestHistoryBaccarat, 
    seedHistory,
    resetBacktestHistory
  } = useAppStore();

  const [selectedGame, setSelectedGame] = React.useState<GameType>(GameType.BACCARAT);
  const [selectedManagement, setSelectedManagement] = React.useState<ManagementMode>(ManagementMode.MARTINGALE);
  const [simulationResults, setSimulationResults] = React.useState<SimStrategyResult[] | null>(null);
  const [isSimulating, setIsSimulating] = React.useState(false);
  const [savedRecords, setSavedRecords] = React.useState<SavedOptimizationRecord[]>([]);
  const [showSeedSuccess, setShowSeedSuccess] = React.useState(false);

  // States for bulk import
  const [isImportOpen, setIsImportOpen] = React.useState(false);
  const [importText, setImportText] = React.useState('');
  const [importOrderAsc, setImportOrderAsc] = React.useState(true);
  const [clearBeforeImport, setClearBeforeImport] = React.useState(true);
  const [importErrorMsg, setImportErrorMsg] = React.useState<string | null>(null);
  const [importSuccessMsg, setImportSuccessMsg] = React.useState<string | null>(null);

  // Load saved runs from localStorage on mount
  React.useEffect(() => {
    try {
      const stored = safeStorage.getItem('casino_opt_records_v1');
      if (stored) {
        setSavedRecords(JSON.parse(stored));
      }
    } catch (e) {
      console.error('[Load Optimization Records Error]:', e);
    }
  }, []);

  // Save records to localStorage
  const saveRecordsToStorage = (records: SavedOptimizationRecord[]) => {
    try {
      safeStorage.setItem('casino_opt_records_v1', JSON.stringify(records));
      setSavedRecords(records);
    } catch (e) {
      console.error('[Save Optimization Records Error]:', e);
    }
  };

  // Get current game's history (use dedicated backtest arrays)
  const activeHistory = selectedGame === GameType.ROULETTE 
    ? (backtestHistoryRoulette || []) 
    : (backtestHistoryBaccarat || []);

  // Seeding high-fidelity results
  const handleSeedHistory = () => {
    seedHistory(selectedGame, 500);
    setShowSeedSuccess(true);
    setTimeout(() => setShowSeedSuccess(false), 4000);
  };

  // Clear current active table history (Limpar Resultados)
  const handleClearHistory = () => {
    resetBacktestHistory(selectedGame);
    setSimulationResults(null);
  };

  const handleConfirmImport = () => {
    if (!importText.trim()) {
      setImportErrorMsg('Insira dados para importar.');
      return;
    }

    try {
      const rawTokens = importText.split(/[,\s;\t\r\n]+/).map(t => t.trim()).filter(Boolean);
      
      const parsedResults: any[] = [];
      if (selectedGame === GameType.ROULETTE) {
        for (const token of rawTokens) {
          const num = parseInt(token, 10);
          if (!isNaN(num) && num >= 0 && num <= 36) {
            parsedResults.push(num);
          }
        }
      } else {
        for (const token of rawTokens) {
          const upper = token.toUpperCase();
          if (upper === 'P' || upper === 'PLAYER' || upper === 'JOGADOR' || upper === 'J' || upper === 'AZUL') {
            parsedResults.push('P');
          } else if (upper === 'B' || upper === 'BANKER' || upper === 'BANCA' || upper === 'BANCO' || upper === 'VERMELHO') {
            parsedResults.push('B');
          } else if (upper === 'T' || upper === 'TIE' || upper === 'EMPATE' || upper === 'E' || upper === 'VERDE') {
            parsedResults.push('T');
          }
        }
      }

      if (parsedResults.length === 0) {
        setImportErrorMsg('Nenhum resultado válido pôde ser parseado no texto colado.');
        return;
      }

      const itemsToSequence = [...parsedResults];
      if (!importOrderAsc) {
        itemsToSequence.reverse();
      }

      const generatedResults: GameResult[] = itemsToSequence.map((resVal, idx) => ({
        id: `import-${Math.random().toString(36).substring(2, 9)}-${Date.now()}-${idx}`,
        gameType: selectedGame,
        result: resVal,
        timestamp: Date.now() - (itemsToSequence.length - 1 - idx) * 1000,
        sessionId: 'bulk-import',
        metadata: {}
      }));

      if (clearBeforeImport) {
        resetBacktestHistory(selectedGame);
      }

      // Seed directly!
      useAppStore.getState().seedGameHistory(selectedGame, generatedResults);

      setImportSuccessMsg(`${generatedResults.length} rodadas importadas com sucesso!`);
      setImportText('');
      setImportErrorMsg(null);
      setSimulationResults(null);
      
      setTimeout(() => {
        setImportSuccessMsg(null);
        setIsImportOpen(false);
      }, 3000);
    } catch (err: any) {
      setImportErrorMsg(`Erro ao importar: ${err?.message || err}`);
    }
  };

  // Clear current active simulation view (Limpar Seleção)
  const handleResetSimulation = () => {
    setSimulationResults(null);
  };

  // Delete all simulation history runs (Apagar tudo)
  const handleEraseAllSavedRecords = () => {
    saveRecordsToStorage([]);
    setSimulationResults(null);
  };

  // Remove a single saved record
  const handleDeleteSingleRecord = (id: string) => {
    const updated = savedRecords.filter(r => r.id !== id);
    saveRecordsToStorage(updated);
  };

  // Execute optimization backtest
  const handleRunOptimization = () => {
    if (activeHistory.length < 10) return;
    setIsSimulating(true);

    // Short timeout to let the browser draw the spinner
    setTimeout(() => {
      try {
        let results: SimStrategyResult[] = [];
        if (selectedGame === GameType.ROULETTE) {
          results = runRouletteSimulations(activeHistory, selectedManagement);
        } else {
          results = runBaccaratSimulations(activeHistory, selectedManagement);
        }

        setSimulationResults(results);

        // Find the best strategy based on win rate and profit
        const sorted = [...results].sort((a, b) => b.winRate - a.winRate);
        const best = sorted[0];

        if (best) {
          // Auto save the run in our list of records (Registro)
          const newRecord: SavedOptimizationRecord = {
            id: Math.random().toString(36).substring(2, 11),
            timestamp: Date.now(),
            gameType: selectedGame,
            managementMode: selectedManagement,
            bestStrategy: best.name,
            bestWinRate: best.winRate,
            bestProfit: best.totalProfit,
            recommendedBankroll: best.recommendedBankroll,
            sampleSize: activeHistory.length
          };

          const updated = [newRecord, ...savedRecords].slice(0, 50); // limit to 50 entries
          saveRecordsToStorage(updated);
        }
      } catch (e) {
        console.error('[Run Simulation Error]:', e);
      } finally {
        setIsSimulating(false);
      }
    }, 300);
  };

  // Find best simulation result for the dashboard
  const bestResult = React.useMemo(() => {
    if (!simulationResults || simulationResults.length === 0) return null;
    return [...simulationResults].sort((a, b) => b.winRate - a.winRate)[0];
  }, [simulationResults]);

  return (
    <div className="space-y-6 text-left animate-in fade-in duration-500">
      {/* Tab Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <h2 className="text-xl font-bold text-[#c6a34f] uppercase tracking-widest flex items-center gap-2">
            <Sparkles size={18} /> Backtest Otimizador de Estratégias
          </h2>
          <p className="text-[9px] text-white/40 uppercase tracking-wider">
            Simule progressões em tempo real com base nos resultados reais de sua mesa e descubra a gestão perfeita
          </p>
        </div>
      </div>

      {/* Inputs & Simulation Controller Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Setup Column */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-[#111111] p-5 rounded-3xl border border-white/5 space-y-4">
            <span className="text-[9px] font-black text-[#c6a34f] uppercase tracking-widest block border-b border-white/5 pb-2">
              ⚙️ Configurar Parâmetros
            </span>

            {/* Selected Management */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-white/60 tracking-wider">Gerenciamento Desejado</label>
              <select
                value={selectedManagement}
                onChange={(e) => { setSelectedManagement(e.target.value as ManagementMode); setSimulationResults(null); }}
                className="w-full bg-black/45 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#c6a34f] transition-all cursor-pointer"
              >
                <option value={ManagementMode.MARTINGALE}>Martingale (Gale Padrão)</option>
                <option value={ManagementMode.SOROS}>Soros (Níveis Acumulados)</option>
                <option value={ManagementMode.FIBONACCI}>Progressão Fibonacci</option>
                <option value={ManagementMode.NIVEL_FIXO_RECUPERACAO}>NFR84 (Nível Fixo de Recuperação)</option>
                <option value={ManagementMode.CYCLIC}>Ciclo de Apostas [1-2-4-8-16]</option>
                <option value={ManagementMode.FIXED}>Aposta Fixa (Sem Progressão)</option>
                <option value={ManagementMode.SISTEMA_2_GANHOS}>Sistema de 2 Ganhos (Masmielo)</option>
                <option value={ManagementMode.SISTEMA_2U_REC1}>Sistema 2U / Recuperação 1</option>
                <option value={ManagementMode.D_ALEMBERT}>D'Alembert</option>
                <option value={ManagementMode.OSCARS_GRIND}>Oscar's Grind</option>
                <option value={ManagementMode.LABOUCHERE}>Labouchere (Cancelamento)</option>
                <option value={ManagementMode.REVERSE_MARTINGALE}>Martingale Reverso</option>
                <option value={ManagementMode.SYSTEM_1326}>Sistema 1-3-2-6</option>
                <option value={ManagementMode.KELLY_CRITERION}>Critério de Kelly</option>
                <option value={ManagementMode.STAR_2_2}>Estrela 2-2 (Star 2-2)</option>
                <option value={ManagementMode.STAR_2_0}>Estrela 2-0 (Star 2-0)</option>
                <option value={ManagementMode.DUTCH}>Dutch (Holandesa)</option>
                <option value={ManagementMode.PADOVAN}>Progressão Padovan</option>
              </select>
            </div>

            {/* Information about calculation units */}
            <div className="bg-black/30 p-3 rounded-2xl border border-white/[0.03] space-y-2">
              <div className="flex gap-2 text-[10px] text-white/60">
                <Percent size={14} className="text-[#c6a34f] shrink-0" />
                <div>
                  <p className="font-extrabold text-[#c6a34f] uppercase tracking-wide mb-0.5">Base Unidade de Valor</p>
                  <p className="leading-relaxed text-[9px]">
                    Todas as estratégias são simuladas utilizando <strong>1 unidade = R$ 1,00</strong>. A progressão de Gale é ajustada automaticamente.
                  </p>
                </div>
              </div>
            </div>

            {/* Play Button */}
            <button
              onClick={handleRunOptimization}
              disabled={isSimulating || activeHistory.length < 10}
              className={`w-full py-3.5 rounded-xl font-extrabold uppercase text-[10px] tracking-wider transition-all duration-300 flex items-center justify-center gap-2 ${
                activeHistory.length < 10
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-white/5'
                  : 'bg-[#c6a34f] hover:bg-amber-400 text-black shadow-lg shadow-[#c6a34f]/10 cursor-pointer active:scale-[0.98]'
              }`}
            >
              {isSimulating ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  Simulando Progressão...
                </>
              ) : (
                <>
                  <Play size={13} fill="currentColor" />
                  Rodar Backtest Otimizado
                </>
              )}
            </button>
          </div>

          {/* Database History Control Card */}
          <div className="bg-[#111111] p-5 rounded-3xl border border-white/5 space-y-4">
            <span className="text-[9px] font-black text-white/40 uppercase tracking-widest block border-b border-white/5 pb-2">
              📂 Amostragem de Dados
            </span>

            <div className="flex items-center justify-between text-xs">
              <span className="text-white/50">Histórico da Mesa:</span>
              <span className="font-mono font-bold text-[#c6a34f]">{activeHistory.length} / 10.000 rodadas</span>
            </div>

            <div className="p-3 bg-black/20 border border-white/[0.03] rounded-2xl space-y-1.5 text-[9px] text-white/50">
              <div className="flex items-center justify-between font-bold text-white/70">
                <span>Capacidade do Histórico:</span>
                <span className="text-[#c6a34f] font-mono">{((activeHistory.length / 10000) * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-black/60 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-[#c6a34f] h-full rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(198,163,79,0.4)]" 
                  style={{ width: `${Math.min(100, (activeHistory.length / 10000) * 100)}%` }}
                />
              </div>
              <p className="leading-relaxed mt-1">
                O simulador suporta até <strong>10.000 lances</strong> na memória para análises retrospectivas. Ao atingir o limite, as rodadas antigas são eliminadas continuamente para a entrada de novos resultados (Renovação FIFO inteligente ativa).
              </p>
            </div>

            {/* Alerts & Seed helper */}
            {activeHistory.length < 10 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex gap-2 text-[10px] text-amber-300 leading-relaxed animate-in fade-in duration-300">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>
                  <strong>Poucos dados!</strong> Mínimo de 10 jogadas recomendado para um backtest confiável. Insira lances no painel principal ou clique em um dos botões abaixo.
                </span>
              </div>
            )}

            {activeHistory.length >= 10 && (
              <div className="p-2.5 bg-green-500/10 border border-green-500/20 rounded-xl flex gap-2 text-[9px] text-green-400 animate-in fade-in duration-300">
                <ShieldCheck size={13} className="shrink-0 mt-0.5" />
                <span>Amostragem ativa saudável com {activeHistory.length} lances reais registrados.</span>
              </div>
            )}

            {/* Action buttons (always visible) */}
            <div className="space-y-2 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={handleSeedHistory}
                  className="py-2 bg-[#c6a34f]/10 hover:bg-[#c6a34f]/20 border border-[#c6a34f]/25 text-[#c6a34f] font-bold rounded-xl text-[9px] uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  ⚡ Gerar 500 Rodadas
                </button>
                <button
                  onClick={() => setIsImportOpen(true)}
                  className="py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-xl text-[9px] uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  📥 Importar em Massa
                </button>
              </div>

              <button
                onClick={handleClearHistory}
                disabled={activeHistory.length === 0}
                className={`w-full py-2.5 rounded-xl text-[9px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  activeHistory.length === 0
                    ? 'bg-zinc-800/50 text-zinc-600 border border-white/5 cursor-not-allowed'
                    : 'bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400'
                }`}
              >
                <Trash2 size={11} />
                Limpar Rodadas Inseridas
              </button>
            </div>

            {showSeedSuccess && (
              <div className="p-2 bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 rounded-xl text-[9px] font-bold text-center uppercase tracking-wider animate-in fade-in duration-300">
                Amostragem de 500 rodadas semeada com sucesso!
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Results Display */}
        <div className="lg:col-span-8 space-y-6">
          {!simulationResults ? (
            <div className="bg-[#111111]/40 border-2 border-dashed border-white/5 rounded-3xl p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
              <div className="p-4 bg-white/5 rounded-full mb-4 text-white/20">
                <History size={32} />
              </div>
              <h3 className="text-sm font-black text-white/70 uppercase tracking-widest">Nenhum backtest rodado na sessão</h3>
              <p className="text-xs text-white/40 mt-1 max-w-sm mx-auto leading-relaxed">
                Configure o gerenciamento de banca no menu lateral e clique em <strong>Rodar Backtest Otimizado</strong> para testar a performance das estratégias em suas rodadas.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Highlight best option and bankroll required */}
              {bestResult && (
                <div className="bg-gradient-to-br from-zinc-950 to-[#181612] p-6 rounded-3xl border-2 border-[#c6a34f]/35 space-y-6 shadow-[0_4px_30px_rgba(198,163,79,0.15)] animate-in zoom-in duration-300">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-[#c6a34f]/10 rounded-2xl border border-[#c6a34f]/30 shrink-0">
                        <Award size={20} className="text-[#c6a34f]" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-1.5 leading-none">
                          Melhor Estratégia Recomendada
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[8px] font-black tracking-normal border border-emerald-500/20 uppercase">
                            Alta Assertividade
                          </span>
                        </h4>
                        <p className="text-[10px] text-white/40 mt-1">
                          Esta é a estratégia que apresentou a melhor regressão probabilística com o gerenciamento selecionado
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleResetSimulation}
                        className="px-3.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white rounded-xl text-[9px] font-extrabold uppercase tracking-wider transition-all cursor-pointer"
                      >
                        Limpar Resultados
                      </button>
                    </div>
                  </div>

                  {/* Highlight Cards Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Best Name & WR */}
                    <div className="bg-black/45 p-4 rounded-2xl border border-white/5 space-y-2 flex flex-col justify-between">
                      <div>
                        <span className="text-[8px] text-white/40 uppercase font-bold tracking-widest block mb-1">Estratégia</span>
                        <p className="text-sm font-black text-[#c6a34f] tracking-tight truncate leading-tight uppercase">
                          {bestResult.name}
                        </p>
                      </div>
                      <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono font-bold">
                        <span className="text-white/40">Win Rate:</span>
                        <span className="text-emerald-400">{bestResult.winRate}%</span>
                      </div>
                    </div>

                    {/* Total Profit */}
                    <div className="bg-black/45 p-4 rounded-2xl border border-white/5 space-y-2 flex flex-col justify-between">
                      <div>
                        <span className="text-[8px] text-white/40 uppercase font-bold tracking-widest block mb-1">Lucro Líquido</span>
                        <p className={`text-lg font-black tracking-tight leading-tight ${bestResult.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {bestResult.totalProfit >= 0 ? '+' : ''}R$ {bestResult.totalProfit.toFixed(2)}
                        </p>
                      </div>
                      <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono font-bold">
                        <span className="text-white/40">Drawdown Max:</span>
                        <span className="text-red-400">R$ {bestResult.maxDrawdown.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* RECOMMENDED BANKROLL TO SUPPORT - CRITICAL REQUEST */}
                    <div className="bg-gradient-to-r from-amber-950/40 to-yellow-950/20 p-4 rounded-2xl border border-[#c6a34f]/30 space-y-2 flex flex-col justify-between">
                      <div>
                        <span className="text-[8px] text-[#c6a34f] uppercase font-bold tracking-widest block mb-1">Banca Recomendada</span>
                        <p className="text-lg font-black text-yellow-400 tracking-tight leading-tight font-mono">
                          R$ {bestResult.recommendedBankroll.toFixed(2)}
                        </p>
                      </div>
                      <div className="pt-2 border-t border-[#c6a34f]/20 flex items-center justify-between text-[9px] font-mono font-extrabold text-[#c6a34f]">
                        <span>Sequência Máx Perdas:</span>
                        <span>{bestResult.maxConsecutiveLosses}x</span>
                      </div>
                    </div>
                  </div>

                  {/* Math explanation for bankroll support */}
                  <div className="p-4 bg-black/40 rounded-2xl border border-white/5 flex gap-2 text-[10px] leading-relaxed text-white/70">
                    <AlertTriangle size={15} className="text-[#c6a34f] shrink-0 mt-0.5 animate-pulse" />
                    <div>
                      <span className="font-extrabold uppercase text-[#c6a34f] block mb-1">Cálculo de Margem de Integridade</span>
                      <p>
                        A banca recomendada de <strong className="text-white">R$ {bestResult.recommendedBankroll.toFixed(2)}</strong> foi calculada matematicamente baseando-se na pior sequência de perdas consecutivas (<strong className="text-white">{bestResult.maxConsecutiveLosses} rodadas seguidas</strong>) que ocorreu na simulação. Com esse valor de saldo, você possui resiliência total para passar pelo pior ciclo sem quebrar sua banca com lances de 1 unidade.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Grid of all strategies results */}
              <div className="space-y-3">
                <span className="text-[9px] uppercase font-black text-white/50 tracking-widest block">
                  📈 Performance de Todas as Diretrizes Simuladas (1 Unidade base)
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {simulationResults.map((res) => (
                    <div key={res.id} className="bg-[#111111] p-4 rounded-2xl border border-white/5 hover:border-white/10 transition-all space-y-3">
                      <div className="flex items-start justify-between gap-2 border-b border-white/5 pb-2">
                        <div className="flex-1 min-w-0">
                          <h5 className="text-[11px] font-black text-white uppercase tracking-wide truncate max-w-[180px]">
                            {res.name}
                          </h5>
                          <span className="text-[8px] text-white/40 font-mono">Simulado em {res.wins + res.losses} jogadas</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`text-[9px] font-black font-mono leading-none px-2 py-1 rounded-md ${
                            res.winRate >= 70 ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 
                            res.winRate >= 50 ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' : 
                            'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>
                            {res.winRate}% WR
                          </span>
                          <button
                            onClick={() => {
                              setSimulationResults(prev => prev ? prev.filter(item => item.id !== res.id) : null);
                            }}
                            className="p-1 text-white/35 hover:text-red-400 rounded transition-all cursor-pointer hover:bg-white/5"
                            title="Limpar este backtest"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        {/* profit */}
                        <div className="bg-black/45 p-1.5 rounded-xl border border-white/[0.03] text-center">
                          <span className="text-[7px] text-white/40 uppercase block mb-0.5">Retorno</span>
                          <span className={`text-[10px] font-black font-mono ${res.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            R$ {res.totalProfit.toFixed(0)}
                          </span>
                        </div>
                        {/* worst loss streak */}
                        <div className="bg-black/45 p-1.5 rounded-xl border border-white/[0.03] text-center">
                          <span className="text-[7px] text-white/40 uppercase block mb-0.5">Seq. Loss</span>
                          <span className="text-[10px] font-black text-white/80 font-mono">{res.maxConsecutiveLosses}x</span>
                        </div>
                        {/* recommended bankroll */}
                        <div className="bg-black/45 p-1.5 rounded-xl border border-white/[0.03] text-center">
                          <span className="text-[7px] text-white/40 uppercase block mb-0.5">Banca Rec.</span>
                          <span className="text-[10px] font-black text-yellow-400 font-mono">R$ {res.recommendedBankroll}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Persistent Saved Runs Table (O Registro que fica guardado) */}
      <div className="bg-[#111111] p-6 rounded-3xl border border-white/5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-4 gap-4">
          <div>
            <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-1.5">
              <History size={14} className="text-[#c6a34f]" /> REGISTRO DE SIMULAÇÕES E HISTÓRICOS SALVOS
            </h4>
            <p className="text-[10px] text-white/40 mt-1">
              Registro histórico persistente das otimizações executadas. Fica salvo no navegador.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleEraseAllSavedRecords}
              disabled={savedRecords.length === 0}
              className={`px-3 py-1.5 rounded-xl text-[9px] font-extrabold uppercase tracking-wider transition-all border flex items-center gap-1 cursor-pointer ${
                savedRecords.length === 0
                  ? 'border-white/5 text-white/20 cursor-not-allowed'
                  : 'border-red-500/30 text-red-400 hover:bg-red-500/10 active:scale-[0.98]'
              }`}
            >
              <Trash2 size={11} />
              Apagar Tudo (Excluir Registros)
            </button>
          </div>
        </div>

        {savedRecords.length === 0 ? (
          <div className="py-12 text-center text-white/30 text-xs">
            Nenhum registro de backtest armazenado ainda. Execute uma otimização no botão acima para salvar automaticamente.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/5">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-black/50 text-[9px] uppercase font-black text-white/40 border-b border-white/5">
                  <th className="p-4">Data/Hora</th>
                  <th className="p-4">Jogo</th>
                  <th className="p-4">Gestão</th>
                  <th className="p-4">Melhor Estratégia</th>
                  <th className="p-4 text-center">Win Rate</th>
                  <th className="p-4 text-center">Lucro Líquido</th>
                  <th className="p-4 text-center">Banca de Suporte</th>
                  <th className="p-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {savedRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-white/[0.02] transition-colors font-mono">
                    <td className="p-4 text-[10px] text-white/50">
                      {new Date(rec.timestamp).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                    </td>
                    <td className="p-4 font-bold text-white uppercase text-[10px]">
                      {rec.gameType === GameType.ROULETTE ? 'Roleta 🎰' : 'Baccarat 🃏'}
                    </td>
                    <td className="p-4 text-white/80 text-[10px] uppercase">
                      {rec.managementMode.replace('_', ' ')}
                    </td>
                    <td className="p-4 font-black text-[#c6a34f] text-[10px] uppercase">
                      {rec.bestStrategy}
                    </td>
                    <td className="p-4 text-center font-bold text-green-400 text-[11px]">
                      {rec.bestWinRate}%
                    </td>
                    <td className={`p-4 text-center font-bold text-[11px] ${rec.bestProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      R$ {rec.bestProfit.toFixed(0)}
                    </td>
                    <td className="p-4 text-center font-bold text-yellow-400 text-[11px]">
                      R$ {rec.recommendedBankroll}
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => handleDeleteSingleRecord(rec.id)}
                        className="p-1 text-white/35 hover:text-red-400 rounded transition-colors cursor-pointer"
                        title="Deletar este registro"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Importação */}
      {isImportOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111111] border border-white/10 rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-2xl relative animate-in zoom-in duration-200">
            <button
              onClick={() => { setIsImportOpen(false); setImportErrorMsg(null); }}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-white/5 text-white/50 hover:text-white transition-all cursor-pointer"
            >
              <X size={16} />
            </button>

            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
              <History size={18} className="text-[#c6a34f]" />
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Importar Histórico em Massa</h3>
            </div>

            <p className="text-[10px] text-white/60 uppercase leading-relaxed">
              Cole abaixo uma sequência de resultados separados por espaço, vírgula, ponto e vírgula ou quebras de linha.
            </p>

            <div className="p-3 bg-black/40 border border-white/5 rounded-xl text-[9px] text-white/40 space-y-1">
              <span className="font-extrabold text-[#c6a34f] block uppercase tracking-wider">Formatos de entrada aceitos:</span>
              <p>● Letras representativas. Exemplo: <strong className="font-mono text-white">P, B, T, P, P, B, T</strong> (P = Player, B = Banker, T = Tie/Empate)</p>
            </div>

            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Cole os resultados aqui (ex: P, B, T, P...)"
              rows={6}
              className="w-full bg-black border border-white/10 focus:border-[#c6a34f] outline-none text-xs rounded-xl p-3 text-white font-mono leading-relaxed"
            />

            {/* Checkbox settings */}
            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-[10px] uppercase font-bold text-white/60">
                <input
                  type="checkbox"
                  checked={clearBeforeImport}
                  onChange={(e) => setClearBeforeImport(e.target.checked)}
                  className="rounded border-white/10 text-[#c6a34f] bg-black focus:ring-[#c6a34f] w-3.5 h-3.5"
                />
                Limpar dados anteriores
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-[10px] uppercase font-bold text-white/60">
                <input
                  type="checkbox"
                  checked={importOrderAsc}
                  onChange={(e) => setImportOrderAsc(e.target.checked)}
                  className="rounded border-white/10 text-[#c6a34f] bg-black focus:ring-[#c6a34f] w-3.5 h-3.5"
                />
                Da esquerda para direita = Antigo p/ Novo
              </label>
            </div>

            {importErrorMsg && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-[10px] font-bold uppercase tracking-wide">
                ⚠️ {importErrorMsg}
              </div>
            )}

            {importSuccessMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-[10px] font-bold uppercase tracking-wide text-center">
                ✅ {importSuccessMsg}
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-white/5 pt-3">
              <button
                type="button"
                onClick={() => { setIsImportOpen(false); setImportErrorMsg(null); }}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                className="px-4 py-2 bg-[#c6a34f] hover:bg-amber-400 text-black rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
              >
                Importar Resultados
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// SIMULATION ENGINES FOR ROULETTE & BACCARAT
// ============================================================================

// Simulation list for Roulette
function runRouletteSimulations(history: GameResult[], mode: ManagementMode): SimStrategyResult[] {
  const strategyIds = [
    'repeat_color',
    'alternate_color',
    'absence_column',
    'absence_dozen',
    'absence_terminal',
    'absence_sector',
    'sequence_break'
  ];

  return strategyIds.map(id => simulateRouletteStrategy(history, id, mode));
}

function simulateRouletteStrategy(history: GameResult[], strategyId: string, mode: ManagementMode): SimStrategyResult {
  const strategies = [
    { id: 'repeat_color', name: 'Repetir Última Cor' },
    { id: 'alternate_color', name: 'Alternar Cor' },
    { id: 'absence_column', name: 'Colunas por Ausência (Favoritos)' },
    { id: 'absence_dozen', name: 'Dúzias por Ausência (Favoritos)' },
    { id: 'absence_terminal', name: 'Terminais por Ausência' },
    { id: 'absence_sector', name: 'Setores por Ausência (Vizinhos/Orfãos)' },
    { id: 'sequence_break', name: 'Quebra de Sequência (3x Cores)' }
  ];

  let wins = 0;
  let losses = 0;
  let maxDrawdown = 0;
  let peakProfit = 0;
  let consecutiveLosses = 0;
  let maxConsecutiveLosses = 0;

  // Initialize progression configuration with 10 levels to support martingale and others fully
  const config: ManagementConfig = {
    mode: mode,
    profile: RiskProfile.CONSERVATIVE,
    initialBet: 1.0, // 1 unit base bet
    levels: 10,
    multiplier: 2.0,
    gameTarget: GameType.ROULETTE
  };

  let state = getInitialProgressionState(config, 1);

  // Simulate starting from index 10 (needs background history for pattern analysis)
  for (let i = 10; i < history.length; i++) {
    const prevSpins = history.slice(0, i);
    const lastSpin = prevSpins[prevSpins.length - 1];

    let betTarget: any = null;
    let betType: 'color' | 'dozen' | 'column' | 'terminal' | 'sector' = 'color';
    let profitMultiplier = 1.0;

    if (strategyId === 'repeat_color') {
      const color = lastSpin.metadata?.color;
      if (color === 'red' || color === 'black') {
        betTarget = color;
        betType = 'color';
        profitMultiplier = 1.0;
      }
    } 
    else if (strategyId === 'alternate_color') {
      const color = lastSpin.metadata?.color;
      if (color === 'red') {
        betTarget = 'black';
        betType = 'color';
      } else if (color === 'black') {
        betTarget = 'red';
        betType = 'color';
      }
    } 
    else if (strategyId === 'absence_column') {
      const counts = { 1: 0, 2: 0, 3: 0 };
      for (let j = i - 10; j < i; j++) {
        const col = history[j].metadata?.column;
        if (col === 1 || col === 2 || col === 3) counts[col]++;
      }
      let minCol: 1 | 2 | 3 = 1;
      let minCount = counts[1];
      if (counts[2] < minCount) { minCol = 2; minCount = counts[2]; }
      if (counts[3] < minCount) { minCol = 3; minCount = counts[3]; }

      betTarget = minCol;
      betType = 'column';
      profitMultiplier = 2.0; // 2:1 profit payout
    } 
    else if (strategyId === 'absence_dozen') {
      const counts = { 1: 0, 2: 0, 3: 0 };
      for (let j = i - 10; j < i; j++) {
        const doz = history[j].metadata?.dozen;
        if (doz === 1 || doz === 2 || doz === 3) counts[doz]++;
      }
      let minDoz: 1 | 2 | 3 = 1;
      let minCount = counts[1];
      if (counts[2] < minCount) { minDoz = 2; minCount = counts[2]; }
      if (counts[3] < minCount) { minDoz = 3; minCount = counts[3]; }

      betTarget = minDoz;
      betType = 'dozen';
      profitMultiplier = 2.0;
    } 
    else if (strategyId === 'absence_terminal') {
      const counts: Record<number, number> = {};
      for (let t = 0; t <= 9; t++) counts[t] = 0;
      for (let j = i - 15; j < i; j++) {
        const term = history[j].metadata?.terminal;
        if (term !== undefined && term !== null) counts[term]++;
      }
      let minTerm = 0;
      let minCount = counts[0];
      for (let t = 1; t <= 9; t++) {
        if (counts[t] < minCount) {
          minTerm = t;
          minCount = counts[t];
        }
      }
      betTarget = minTerm;
      betType = 'terminal';
      profitMultiplier = 8.0; // placed on 4 numbers = 8x total stake profit
    } 
    else if (strategyId === 'absence_sector') {
      const counts = { VOISINS: 0, TIERS: 0, ORPHELINS: 0, ZERO_SPIEL: 0 };
      for (let j = i - 15; j < i; j++) {
        const zones = history[j].metadata?.zones || [];
        if (zones.includes('VOISINS')) counts.VOISINS++;
        if (zones.includes('TIERS')) counts.TIERS++;
        if (zones.includes('ORPHELINS')) counts.ORPHELINS++;
        if (zones.includes('ZERO_SPIEL')) counts.ZERO_SPIEL++;
      }
      let minSec: 'VOISINS' | 'TIERS' | 'ORPHELINS' | 'ZERO_SPIEL' = 'VOISINS';
      let minCount = counts.VOISINS;
      if (counts.TIERS < minCount) { minSec = 'TIERS'; minCount = counts.TIERS; }
      if (counts.ORPHELINS < minCount) { minSec = 'ORPHELINS'; minCount = counts.ORPHELINS; }
      if (counts.ZERO_SPIEL < minCount) { minSec = 'ZERO_SPIEL'; minCount = counts.ZERO_SPIEL; }

      betTarget = minSec;
      betType = 'sector';

      if (minSec === 'VOISINS') profitMultiplier = 1.11;
      else if (minSec === 'TIERS') profitMultiplier = 2.0;
      else if (minSec === 'ORPHELINS') profitMultiplier = 3.5;
      else profitMultiplier = 4.14;
    } 
    else if (strategyId === 'sequence_break') {
      const last3 = prevSpins.slice(-3);
      if (last3.length === 3) {
        const allRed = last3.every(s => s.metadata?.color === 'red');
        const allBlack = last3.every(s => s.metadata?.color === 'black');
        if (allRed) {
          betTarget = 'black';
          betType = 'color';
        } else if (allBlack) {
          betTarget = 'red';
          betType = 'color';
        }
      }
    }

    if (betTarget === null) continue;

    // Check spin result
    const actualSpin = history[i];
    let isWin = false;

    if (betType === 'color') {
      isWin = actualSpin.metadata?.color === betTarget;
    } else if (betType === 'column') {
      isWin = actualSpin.metadata?.column === betTarget;
    } else if (betType === 'dozen') {
      isWin = actualSpin.metadata?.dozen === betTarget;
    } else if (betType === 'terminal') {
      isWin = actualSpin.metadata?.terminal === betTarget;
    } else if (betType === 'sector') {
      isWin = actualSpin.metadata?.zones?.includes(betTarget) || false;
    }

    // Calculate profit of the round
    const betSize = state.currentBetSize;
    const roundProfit = isWin ? (betSize * profitMultiplier) : -betSize;

    // Call progressionEngine logic to compute new bet and track variables
    state = updateProgressionState(state, isWin, roundProfit, config, 1, undefined, profitMultiplier);

    if (isWin) {
      wins++;
      consecutiveLosses = 0;
    } else {
      losses++;
      consecutiveLosses++;
      if (consecutiveLosses > maxConsecutiveLosses) {
        maxConsecutiveLosses = consecutiveLosses;
      }
    }

    const currentProfit = state.runningProfit;
    if (currentProfit > peakProfit) {
      peakProfit = currentProfit;
    }
    const currentDrawdown = peakProfit - currentProfit;
    if (currentDrawdown > maxDrawdown) {
      maxDrawdown = currentDrawdown;
    }
  }

  // Recommended bankroll safety logic
  let recommendedBankroll = 30;
  if (mode === ManagementMode.MARTINGALE) {
    const levelsNeeded = Math.max(2, maxConsecutiveLosses);
    recommendedBankroll = Math.pow(2, levelsNeeded + 1) - 1 + 25;
  } else {
    recommendedBankroll = Math.max(30, Math.ceil(maxDrawdown * 1.5 + 20));
  }

  const total = wins + losses;
  return {
    id: strategyId,
    name: strategies.find(s => s.id === strategyId)?.name || strategyId,
    winRate: total > 0 ? Number(((wins / total) * 100).toFixed(1)) : 0,
    wins,
    losses,
    totalProfit: Number(state.runningProfit.toFixed(1)),
    maxDrawdown: Number(maxDrawdown.toFixed(1)),
    maxConsecutiveLosses,
    recommendedBankroll: Math.ceil(recommendedBankroll)
  };
}

// Simulation list for Baccarat
function runBaccaratSimulations(history: GameResult[], mode: ManagementMode): SimStrategyResult[] {
  const strategyIds = [
    'follow_streak',
    'break_streak',
    'streak_break_3',
    'doublet_chop',
    'big_eye_boy',
    'small_road',
    'cockroach_pig'
  ];

  return strategyIds.map(id => simulateBaccaratStrategy(history, id, mode));
}

function simulateBaccaratStrategy(history: GameResult[], strategyId: string, mode: ManagementMode): SimStrategyResult {
  const strategies = [
    { id: 'follow_streak', name: 'Seguir o Fluxo (Streak)' },
    { id: 'break_streak', name: 'Cortar Sequência (Chop)' },
    { id: 'streak_break_3', name: 'Quebra de Sequência de 3' },
    { id: 'doublet_chop', name: 'Padrão de Duplas (Doublets Chop)' },
    { id: 'big_eye_boy', name: 'Alinhamento Big Eye Boy (Olho de Peixe)' },
    { id: 'small_road', name: 'Simetria Pequena Estrada (Small Road)' },
    { id: 'cockroach_pig', name: 'Variação Estrada Barata (Cockroach Pig)' }
  ];

  let wins = 0;
  let losses = 0;
  let maxDrawdown = 0;
  let peakProfit = 0;
  let consecutiveLosses = 0;
  let maxConsecutiveLosses = 0;

  // Initialize progression configuration
  const config: ManagementConfig = {
    mode: mode,
    profile: RiskProfile.CONSERVATIVE,
    initialBet: 1.0, // 1 unit base bet
    levels: 10,
    multiplier: 2.0,
    gameTarget: GameType.BACCARAT
  };

  let state = getInitialProgressionState(config, 1);

  for (let i = 10; i < history.length; i++) {
    const prevRounds = history.slice(0, i);
    // filter ties out of past decisions for pattern analysis
    const prevDecisions = prevRounds.filter(r => r.result === 'P' || r.result === 'B');
    if (prevDecisions.length < 5) continue;

    const lastWinner = prevDecisions[prevDecisions.length - 1].result; // 'P' or 'B'
    const penultWinner = prevDecisions[prevDecisions.length - 2].result;

    let betTarget: 'P' | 'B' | null = null;
    let profitMultiplier = 1.0; // Payout is 1:1 for Player. For Banker it is 0.95:1 (house 5% commission)

    if (strategyId === 'follow_streak') {
      betTarget = lastWinner;
    } 
    else if (strategyId === 'break_streak') {
      betTarget = lastWinner === 'P' ? 'B' : 'P';
    } 
    else if (strategyId === 'streak_break_3') {
      if (prevDecisions.length >= 3) {
        const last3 = prevDecisions.slice(-3);
        const allPlayer = last3.every(r => r.result === 'P');
        const allBanker = last3.every(r => r.result === 'B');
        if (allPlayer) betTarget = 'B';
        else if (allBanker) betTarget = 'P';
      }
    } 
    else if (strategyId === 'doublet_chop') {
      // PP or BB then chops
      if (lastWinner === penultWinner) {
        betTarget = lastWinner === 'P' ? 'B' : 'P';
      }
    } 
    else if (strategyId === 'big_eye_boy') {
      const last4 = prevDecisions.slice(-4);
      if (last4.length === 4) {
        const isAlternating = last4[0].result !== last4[1].result && last4[1].result !== last4[2].result;
        if (isAlternating) {
          betTarget = lastWinner === 'P' ? 'B' : 'P';
        } else {
          betTarget = lastWinner;
        }
      }
    } 
    else if (strategyId === 'small_road') {
      const last5 = prevDecisions.slice(-5).map(r => r.result).join('');
      if (last5.includes('PBPB') || last5.includes('BPBP')) {
        betTarget = lastWinner === 'P' ? 'B' : 'P';
      } else {
        betTarget = lastWinner;
      }
    } 
    else if (strategyId === 'cockroach_pig') {
      const last5 = prevDecisions.slice(-5);
      const playerWins = last5.filter(r => r.result === 'P').length;
      betTarget = playerWins >= 3 ? 'P' : 'B';
    }

    if (betTarget === null) continue;

    // Check round winner
    const actualResult = history[i].result; // 'P', 'B' or 'T'

    if (actualResult === 'T') {
      // Tie: bet is returned. No gain, no loss. Level doesn't change!
      continue;
    }

    const isWin = actualResult === betTarget;
    profitMultiplier = betTarget === 'B' ? 0.95 : 1.0;

    const betSize = state.currentBetSize;
    const roundProfit = isWin ? (betSize * profitMultiplier) : -betSize;

    // Call core progressionEngine
    state = updateProgressionState(state, isWin, roundProfit, config, 1, undefined, profitMultiplier);

    if (isWin) {
      wins++;
      consecutiveLosses = 0;
    } else {
      losses++;
      consecutiveLosses++;
      if (consecutiveLosses > maxConsecutiveLosses) {
        maxConsecutiveLosses = consecutiveLosses;
      }
    }

    const currentProfit = state.runningProfit;
    if (currentProfit > peakProfit) {
      peakProfit = currentProfit;
    }
    const currentDrawdown = peakProfit - currentProfit;
    if (currentDrawdown > maxDrawdown) {
      maxDrawdown = currentDrawdown;
    }
  }

  // Recommended bankroll safety
  let recommendedBankroll = 30;
  if (mode === ManagementMode.MARTINGALE) {
    const levelsNeeded = Math.max(2, maxConsecutiveLosses);
    recommendedBankroll = Math.pow(2, levelsNeeded + 1) - 1 + 25;
  } else {
    recommendedBankroll = Math.max(30, Math.ceil(maxDrawdown * 1.5 + 20));
  }

  const total = wins + losses;
  return {
    id: strategyId,
    name: strategies.find(s => s.id === strategyId)?.name || strategyId,
    winRate: total > 0 ? Number(((wins / total) * 100).toFixed(1)) : 0,
    wins,
    losses,
    totalProfit: Number(state.runningProfit.toFixed(1)),
    maxDrawdown: Number(maxDrawdown.toFixed(1)),
    maxConsecutiveLosses,
    recommendedBankroll: Math.ceil(recommendedBankroll)
  };
}
