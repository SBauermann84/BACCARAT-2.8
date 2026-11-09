import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { GameType } from '../types';
import { DailyStatsRecord } from '../services/dailyStatsService';
import { 
  TrendingUp, TrendingDown, Clock, Activity, Award, Edit3, Save, CheckCircle, 
  ChevronDown, ChevronUp, Calendar, AlertTriangle, Layers, BarChart3, RefreshCw, Trash2, Download 
} from 'lucide-react';

export const DailyStatsHistoryPanel: React.FC = () => {
  const { 
    dailyHistory, 
    loadDailyStats, 
    closeOperationalDay, 
    activeOperationalDateRoulette,
    activeOperationalDateBaccarat,
    historyRoulette,
    historyBaccarat,
    bankrollRoulette,
    bankrollBaccarat,
    saveDailyStatsRecord,
    deleteDailyStatsRecord,
    clearDailyHistory
  } = useAppStore();

  const [selectedGameTypeFilter, setSelectedGameTypeFilter] = useState<'all' | GameType>(GameType.BACCARAT);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month' | 'all' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const [isClosingDayModalOpen, setIsClosingDayModalOpen] = useState(false);
  const [closingGameType, setClosingGameType] = useState<GameType>(GameType.BACCARAT);
  const [closingNotes, setClosingNotes] = useState('');
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [editedNotesValue, setEditedNotesValue] = useState('');
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);
  const [deletingEntryKey, setDeletingEntryKey] = useState<string | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');

  useEffect(() => {
    loadDailyStats();
  }, []);

  const handleManualCloseDay = async () => {
    await closeOperationalDay(closingGameType, closingNotes);
    setIsClosingDayModalOpen(false);
    setClosingNotes('');
  };

  const handleStartEditingNotes = (record: DailyStatsRecord) => {
    setEditingNotesId(record.id);
    setEditedNotesValue(record.notes || '');
  };

  const handleSaveNotes = async (record: DailyStatsRecord) => {
    const updatedRecord = {
      ...record,
      notes: editedNotesValue,
      lastUpdated: Date.now()
    };
    await saveDailyStatsRecord(updatedRecord);
    setEditingNotesId(null);
  };

  // Filter records based on filters
  const filteredRecords = React.useMemo(() => {
    let list = [...dailyHistory];

    // Filter by Game Type
    if (selectedGameTypeFilter !== 'all') {
      list = list.filter(r => r.gameType === selectedGameTypeFilter);
    }

    // Filter by Period
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    if (selectedPeriod === 'today') {
      const todayStr = now.toLocaleDateString('sv-SE');
      list = list.filter(r => r.date === todayStr);
    } else if (selectedPeriod === 'week') {
      // Last 7 days
      const sevenDaysAgo = startOfDay - 7 * 24 * 60 * 60 * 1000;
      list = list.filter(r => new Date(r.date).getTime() >= sevenDaysAgo);
    } else if (selectedPeriod === 'month') {
      // Last 30 days
      const thirtyDaysAgo = startOfDay - 30 * 24 * 60 * 60 * 1000;
      list = list.filter(r => new Date(r.date).getTime() >= thirtyDaysAgo);
    } else if (selectedPeriod === 'custom') {
      if (customStartDate) {
        const start = new Date(customStartDate).getTime();
        list = list.filter(r => new Date(r.date).getTime() >= start);
      }
      if (customEndDate) {
        const end = new Date(customEndDate).getTime() + 24 * 60 * 60 * 1000 - 1; // end of that day
        list = list.filter(r => new Date(r.date).getTime() <= end);
      }
    }

    // Sort newest first: first by date, then by operationNumber (highest first)
    return list.sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return (b.operationNumber || 0) - (a.operationNumber || 0);
    });
  }, [dailyHistory, selectedGameTypeFilter, selectedPeriod, customStartDate, customEndDate]);

  const handleExportCSV = () => {
    if (filteredRecords.length === 0) return;

    const headers = [
      'Data',
      'Operação',
      'Mercado',
      'Banca Inicial (R$)',
      'Banca Final (R$)',
      'Lucro Líquido (R$)',
      'Prejuízo Líquido (R$)',
      'Total Entradas',
      'Vitórias',
      'Derrotas',
      'Assertividade (%)',
      'Máx Gale Usado',
      'Reds Registrados',
      'Duração',
      'Anotações'
    ];

    const rows = filteredRecords.map(r => [
      r.date,
      r.operationNumber || 1,
      r.gameType === GameType.ROULETTE ? 'Roleta' : 'Baccarat',
      r.initialBalance.toFixed(2),
      r.finalBalance.toFixed(2),
      r.netProfit.toFixed(2),
      r.netLoss.toFixed(2),
      r.totalOperations,
      r.winsCount,
      r.lossesCount,
      r.winPercentage.toFixed(1),
      r.maxGaleUsed,
      r.redsCount,
      `"${r.formattedDuration || '0m'}"`,
      `"${(r.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' 
      + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `relatorio_estatisticas_diarias_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Aggregate metrics for cards
  const summaryMetrics = React.useMemo(() => {
    const count = filteredRecords.length;
    if (count === 0) return {
      totalProfit: 0,
      totalLoss: 0,
      netBalance: 0,
      totalOps: 0,
      avgWinRate: 0,
      maxGale: 0,
      reds: 0
    };

    let totalProfit = 0;
    let totalLoss = 0;
    let totalOps = 0;
    let totalWins = 0;
    let maxGale = 0;
    let reds = 0;

    filteredRecords.forEach(r => {
      totalProfit += r.netProfit || 0;
      totalLoss += r.netLoss || 0;
      totalOps += r.totalOperations || 0;
      totalWins += r.winsCount || 0;
      if (r.maxGaleUsed > maxGale) maxGale = r.maxGaleUsed;
      reds += r.redsCount || 0;
    });

    const netBalance = totalProfit - totalLoss;
    const avgWinRate = totalOps > 0 ? (totalWins / totalOps) * 100 : 0;

    return {
      totalProfit,
      totalLoss,
      netBalance,
      totalOps,
      avgWinRate,
      maxGale,
      reds
    };
  }, [filteredRecords]);

  const handleExportPDF = () => {
    if (filteredRecords.length === 0) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const recordRows = filteredRecords.map(r => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px; font-size: 11px;">${r.date}</td>
        <td style="padding: 10px; font-size: 11px;">#${r.operationNumber || 1}</td>
        <td style="padding: 10px; font-size: 11px; font-weight: bold;">${r.gameType === GameType.ROULETTE ? 'Roleta' : 'Baccarat'}</td>
        <td style="padding: 10px; font-size: 11px; font-family: monospace;">R$ ${r.initialBalance.toFixed(2)}</td>
        <td style="padding: 10px; font-size: 11px; font-family: monospace;">R$ ${r.finalBalance.toFixed(2)}</td>
        <td style="padding: 10px; font-size: 11px; font-family: monospace; color: ${r.netProfit >= r.netLoss ? '#10b981' : '#ef4444'}; font-weight: bold;">
          R$ ${(r.netProfit - r.netLoss).toFixed(2)}
        </td>
        <td style="padding: 10px; font-size: 11px; text-align: center;">${r.totalOperations}</td>
        <td style="padding: 10px; font-size: 11px; text-align: center; color: #10b981;">${r.winsCount}</td>
        <td style="padding: 10px; font-size: 11px; text-align: center; color: #ef4444;">${r.lossesCount}</td>
        <td style="padding: 10px; font-size: 11px; text-align: center; font-weight: bold;">${r.winPercentage.toFixed(1)}%</td>
        <td style="padding: 10px; font-size: 11px; text-align: center; font-family: monospace;">G${r.maxGaleUsed}</td>
        <td style="padding: 10px; font-size: 11px;">${r.formattedDuration || '0m'}</td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Relatório de Estatísticas - Casino Pattern AI</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1e293b; padding: 40px; background-color: #ffffff; }
          h1 { font-size: 22px; color: #0f172a; margin: 0 0 5px 0; }
          .subtitle { font-size: 11px; color: #64748b; margin-bottom: 30px; }
          .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
          .summary-card { padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; }
          .summary-label { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: bold; }
          .summary-value { font-size: 16px; font-weight: bold; margin-top: 5px; font-family: monospace; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #f1f5f9; text-align: left; padding: 10px; font-size: 10px; text-transform: uppercase; color: #475569; border-bottom: 2px solid #cbd5e1; }
          footer { margin-top: 50px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; }
          @media print {
            body { padding: 0; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px;">
          <div>
            <h1>Relatório de Estatísticas Operacionais</h1>
            <div class="subtitle">Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</div>
          </div>
          <button class="no-print" onclick="window.print()" style="padding: 10px 18px; background: #10b981; color: white; border: none; border-radius: 6px; font-size: 12px; font-weight: bold; cursor: pointer;">
            Imprimir / Salvar PDF
          </button>
        </div>

        <div class="summary-grid">
          <div class="summary-card">
            <div class="summary-label">Saldo Líquido Total</div>
            <div class="summary-value" style="color: ${summaryMetrics.netBalance >= 0 ? '#10b981' : '#ef4444'};">
              R$ ${summaryMetrics.netBalance.toFixed(2)}
            </div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Total de Operações</div>
            <div class="summary-value">${filteredRecords.length}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Assertividade Média</div>
            <div class="summary-value">${summaryMetrics.avgWinRate.toFixed(1)}%</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Reds Totais</div>
            <div class="summary-value" style="color: #ef4444;">${summaryMetrics.reds}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Op.</th>
              <th>Mercado</th>
              <th>Banca Inicial</th>
              <th>Banca Final</th>
              <th>Resultado</th>
              <th>Operações</th>
              <th>W</th>
              <th>L</th>
              <th>Assertividade</th>
              <th>Máx Gale</th>
              <th>Duração</th>
            </tr>
          </thead>
          <tbody>
            ${recordRows}
          </tbody>
        </table>

        <footer>
          Casino Pattern AI - Plataforma de Análise de Padrões de Cassino 100% Offline
        </footer>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-slate-100" id="daily-stats-panel">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-800 pb-5 mb-6 gap-4">
        <div>
          <h2 className="text-xl font-semibold font-sans tracking-tight text-white flex items-center gap-2">
            <BarChart3 className="text-emerald-500 w-5 h-5" />
            Histórico Estatístico por Operação
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Resumos consolidados por operação de forma permanente e individual.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              setIsResetConfirmOpen(true);
              setResetConfirmText('');
            }}
            className="px-4 py-2 bg-red-950/20 hover:bg-red-950/40 text-red-400 rounded-lg text-xs font-medium transition flex items-center gap-1.5 border border-red-900/30"
            title="Excluir de forma definitiva todo o histórico de estatísticas gravadas"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
            Limpar Estatísticas
          </button>

          <button
            onClick={handleExportCSV}
            disabled={filteredRecords.length === 0}
            className="px-4 py-2 bg-emerald-950/30 hover:bg-emerald-900/50 disabled:opacity-40 disabled:cursor-not-allowed text-emerald-400 rounded-lg text-xs font-medium transition flex items-center gap-1.5 border border-emerald-800/40 cursor-pointer"
            title="Exportar histórico filtrado em planilha CSV"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            Exportar CSV
          </button>

          <button
            onClick={handleExportPDF}
            disabled={filteredRecords.length === 0}
            className="px-4 py-2 bg-blue-950/30 hover:bg-blue-900/50 disabled:opacity-40 disabled:cursor-not-allowed text-blue-400 rounded-lg text-xs font-medium transition flex items-center gap-1.5 border border-blue-800/40 cursor-pointer"
            title="Exportar histórico filtrado em relatório PDF"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            Exportar PDF
          </button>

          <button
            onClick={() => {
              setClosingGameType(GameType.ROULETTE);
              setIsClosingDayModalOpen(true);
            }}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-white rounded-lg text-xs font-medium transition flex items-center gap-1.5 border border-slate-700"
            title="Encerrar a operação atual manualmente e calcular estatísticas"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Encerrar Operação
          </button>

          <button
            onClick={loadDailyStats}
            className="p-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 rounded-lg border border-slate-700 text-slate-300 transition"
            title="Recarregar"
          >
            <Clock className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Control Filter Bar */}
      <div className="bg-slate-950/40 p-4 rounded-lg border border-slate-800/80 mb-6 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Period Selector */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider">Período</span>
            <div className="flex bg-slate-900 p-1 rounded-md border border-slate-800">
              <button
                onClick={() => setSelectedPeriod('all')}
                className={`px-3 py-1 text-xs font-medium rounded transition ${selectedPeriod === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Tudo
              </button>
              <button
                onClick={() => setSelectedPeriod('today')}
                className={`px-3 py-1 text-xs font-medium rounded transition ${selectedPeriod === 'today' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Hoje
              </button>
              <button
                onClick={() => setSelectedPeriod('week')}
                className={`px-3 py-1 text-xs font-medium rounded transition ${selectedPeriod === 'week' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Últimos 7 dias
              </button>
              <button
                onClick={() => setSelectedPeriod('month')}
                className={`px-3 py-1 text-xs font-medium rounded transition ${selectedPeriod === 'month' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Últimos 30 dias
              </button>
              <button
                onClick={() => setSelectedPeriod('custom')}
                className={`px-3 py-1 text-xs font-medium rounded transition ${selectedPeriod === 'custom' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Personalizado
              </button>
            </div>
          </div>

          {/* Custom Date Inputs */}
          {selectedPeriod === 'custom' && (
            <div className="flex items-end gap-2 animate-fade-in">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-400">De:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-xs rounded-md p-1.5 text-white outline-none focus:border-slate-600"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-400">Até:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-xs rounded-md p-1.5 text-white outline-none focus:border-slate-600"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-slate-400 uppercase">Resultado Acumulado</span>
            {summaryMetrics.netBalance >= 0 ? (
              <TrendingUp className="text-emerald-500 w-4 h-4" />
            ) : (
              <TrendingDown className="text-rose-500 w-4 h-4" />
            )}
          </div>
          <div className={`text-xl font-bold font-mono ${summaryMetrics.netBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {summaryMetrics.netBalance >= 0 ? '+' : ''}
            {summaryMetrics.netBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            Lucro: {summaryMetrics.totalProfit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} | Perda: {summaryMetrics.totalLoss.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-slate-400 uppercase">Aproveitamento Médio</span>
            <Award className="text-blue-500 w-4 h-4" />
          </div>
          <div className="text-xl font-bold text-white font-mono">
            {summaryMetrics.avgWinRate.toFixed(1)}%
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            Total de {summaryMetrics.totalOps} operações fechadas no período.
          </div>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-slate-400 uppercase">Pico de Gale</span>
            <Layers className="text-amber-500 w-4 h-4" />
          </div>
          <div className="text-xl font-bold text-amber-400 font-mono">
            Gale {summaryMetrics.maxGale}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            Maior nível de progressão exigido para recuperação.
          </div>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-slate-400 uppercase">Reds Registrados</span>
            <AlertTriangle className="text-rose-500 w-4 h-4" />
          </div>
          <div className="text-xl font-bold text-rose-500 font-mono">
            {summaryMetrics.reds}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            Quantidade de sequências que falharam e atingiram o limite.
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {filteredRecords.length === 0 ? (
        <div className="bg-slate-950 p-12 text-center rounded-xl border border-slate-800 text-slate-400">
          <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-medium">Nenhum registro encontrado para os filtros selecionados.</p>
          <p className="text-xs text-slate-500 mt-1">Inicie suas operações e quando encerrar a operação, os resumos serão salvos aqui.</p>
        </div>
      ) : (
        /* Records List View */
        <div className="space-y-4">
          {filteredRecords.map((record) => {
            const isExpanded = expandedRecordId === record.id;
            const isEditingNotes = editingNotesId === record.id;
            const totalWinsLosses = record.winsCount + record.lossesCount;

            return (
              <div 
                key={record.id} 
                className={`bg-slate-950 rounded-xl border border-slate-800 hover:border-slate-700 transition overflow-hidden`}
              >
                {/* Accordion Trigger */}
                <div 
                  onClick={() => setExpandedRecordId(isExpanded ? null : record.id)}
                  className="p-5 flex items-center justify-between cursor-pointer select-none"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 self-start uppercase">
                        {record.gameType === GameType.ROULETTE ? 'Roleta' : 'Baccarat'}
                      </span>
                      <span className="text-base font-semibold text-white mt-1.5 flex items-center gap-1.5 font-mono">
                        Operação #{record.operationNumber || 1} - {record.date.split('-').reverse().join('/')}
                      </span>
                    </div>

                    <div className="hidden sm:flex flex-col border-l border-slate-800 pl-4">
                      <span className="text-[10px] font-mono text-slate-500 uppercase">Resultado Líquido</span>
                      <span className={`text-sm font-bold font-mono ${record.netProfit > 0 ? 'text-emerald-400' : record.netLoss > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                        {record.netProfit > 0 ? `+${record.netProfit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : record.netLoss > 0 ? `-${record.netLoss.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : 'R$ 0,00'}
                      </span>
                    </div>

                    <div className="hidden md:flex flex-col border-l border-slate-800 pl-4">
                      <span className="text-[10px] font-mono text-slate-500 uppercase">Banca</span>
                      <span className="text-xs text-slate-300 font-mono">
                        {record.initialBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} ➜ {record.finalBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>

                    <div className="hidden lg:flex flex-col border-l border-slate-800 pl-4">
                      <span className="text-[10px] font-mono text-slate-500 uppercase">Desempenho</span>
                      <span className="text-xs text-slate-300">
                        {record.winsCount}W - {record.lossesCount}L ({record.winPercentage}%)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {record.notes && (
                      <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-medium max-w-[120px] truncate hidden sm:inline-block">
                        Com Observação
                      </span>
                    )}

                    {deletingRecordId === record.id ? (
                      <div className="flex items-center gap-1 bg-rose-950/90 p-1 rounded-lg border border-rose-500/50 shadow-lg" onClick={(e) => e.stopPropagation()}>
                        <span className="text-[9px] font-bold text-rose-200 px-1 whitespace-nowrap">Excluir?</span>
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            await deleteDailyStatsRecord(record.id);
                            setDeletingRecordId(null);
                          }}
                          className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-[9px] font-bold transition active:scale-95"
                        >
                          Sim
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingRecordId(null);
                          }}
                          className="px-2 py-0.5 bg-white/10 hover:bg-white/20 text-white/80 rounded text-[9px] font-bold transition"
                        >
                          Não
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingRecordId(record.id);
                        }}
                        className="p-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 hover:text-rose-300 rounded-lg border border-rose-800/50 transition-all active:scale-95 flex items-center gap-1 text-[10px] font-bold"
                        title="Apagar esta estatística de operação individualmente"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Apagar</span>
                      </button>
                    )}

                    {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                  </div>
                </div>

                {/* Accordion Content */}
                {isExpanded && (
                  <div className="border-t border-slate-900 bg-slate-950/80 p-5 space-y-6 animate-fade-in">
                    
                    {/* Grid of the 25+ exact metrics */}
                    <div>
                      <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5 border-b border-slate-800 pb-1.5">
                        <Activity className="w-3.5 h-3.5 text-emerald-500" />
                        Métricas Operacionais Completas
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {/* 1 */}
                        <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                          <div className="text-[9px] font-mono text-slate-500 uppercase">Saldo Inicial</div>
                          <div className="text-xs font-semibold text-white font-mono mt-0.5">{record.initialBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                        </div>
                        {/* 2 */}
                        <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                          <div className="text-[9px] font-mono text-slate-500 uppercase">Saldo Final</div>
                          <div className="text-xs font-semibold text-white font-mono mt-0.5">{record.finalBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                        </div>
                        {/* 3 */}
                        <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                          <div className="text-[9px] font-mono text-slate-500 uppercase">Lucro Líquido</div>
                          <div className="text-xs font-semibold text-emerald-400 font-mono mt-0.5">{record.netProfit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                        </div>
                        {/* 4 */}
                        <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                          <div className="text-[9px] font-mono text-slate-500 uppercase">Prejuízo Líquido</div>
                          <div className="text-xs font-semibold text-rose-400 font-mono mt-0.5">{record.netLoss.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                        </div>
                        {/* 5 */}
                        <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                          <div className="text-[9px] font-mono text-slate-500 uppercase">Operações Totais</div>
                          <div className="text-xs font-semibold text-white font-mono mt-0.5">{record.totalOperations}</div>
                        </div>
                        {/* 6 */}
                        <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                          <div className="text-[9px] font-mono text-slate-500 uppercase">Aproveitamento</div>
                          <div className="text-xs font-semibold text-white font-mono mt-0.5">{record.winPercentage}%</div>
                        </div>
                        {/* 7 */}
                        <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                          <div className="text-[9px] font-mono text-slate-500 uppercase">Vitórias Totais</div>
                          <div className="text-xs font-semibold text-emerald-400 font-mono mt-0.5">{record.winsCount}</div>
                        </div>
                        {/* 8 */}
                        <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                          <div className="text-[9px] font-mono text-slate-500 uppercase">Derrotas Totais</div>
                          <div className="text-xs font-semibold text-rose-400 font-mono mt-0.5">{record.lossesCount}</div>
                        </div>
                        {/* 9 */}
                        <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                          <div className="text-[9px] font-mono text-slate-500 uppercase">Pico de Vitórias</div>
                          <div className="text-xs font-semibold text-white font-mono mt-0.5">{record.maxWinStreak} seguidas</div>
                        </div>
                        {/* 10 */}
                        <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                          <div className="text-[9px] font-mono text-slate-500 uppercase">Pico de Derrotas</div>
                          <div className="text-xs font-semibold text-white font-mono mt-0.5">{record.maxLossStreak} seguidas</div>
                        </div>
                        {/* 11 */}
                        <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                          <div className="text-[9px] font-mono text-slate-500 uppercase">Sem Gale</div>
                          <div className="text-xs font-semibold text-emerald-400 font-mono mt-0.5">{record.winsNoGale} ops</div>
                        </div>
                        {/* 12 */}
                        <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                          <div className="text-[9px] font-mono text-slate-500 uppercase">Reds no Gale</div>
                          <div className="text-xs font-semibold text-rose-400 font-mono mt-0.5">{record.redsCount} reds</div>
                        </div>
                        {/* 13 */}
                        <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                          <div className="text-[9px] font-mono text-slate-500 uppercase">Maior Gale</div>
                          <div className="text-xs font-semibold text-amber-400 font-mono mt-0.5">Nível {record.maxGaleUsed}</div>
                        </div>
                        {/* 14 */}
                        <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                          <div className="text-[9px] font-mono text-slate-500 uppercase">Gale Médio</div>
                          <div className="text-xs font-semibold text-slate-300 font-mono mt-0.5">{record.avgGalePerOperation} / op</div>
                        </div>
                        {/* 15 */}
                        <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                          <div className="text-[9px] font-mono text-slate-500 uppercase">Tempo de Operação</div>
                          <div className="text-xs font-semibold text-white mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {record.formattedDuration}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Gale Level Details */}
                    <div>
                      <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5 border-b border-slate-800 pb-1.5">
                        <Layers className="w-3.5 h-3.5 text-amber-500" />
                        Distribuição Detalhada de Recuperações (Gales)
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                        <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-center">
                          <span className="text-[10px] font-mono text-slate-400 uppercase">Gale 1</span>
                          <div className="text-base font-bold font-mono text-slate-100 mt-1">{record.recoveriesGale1 || 0}</div>
                        </div>
                        <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-center">
                          <span className="text-[10px] font-mono text-slate-400 uppercase">Gale 2</span>
                          <div className="text-base font-bold font-mono text-slate-100 mt-1">{record.recoveriesGale2 || 0}</div>
                        </div>
                        <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-center">
                          <span className="text-[10px] font-mono text-slate-400 uppercase">Gale 3</span>
                          <div className="text-base font-bold font-mono text-slate-100 mt-1">{record.recoveriesGale3 || 0}</div>
                        </div>
                        <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-center">
                          <span className="text-[10px] font-mono text-slate-400 uppercase">Gale 4</span>
                          <div className="text-base font-bold font-mono text-slate-100 mt-1">{record.recoveriesGale4 || 0}</div>
                        </div>
                        <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-center">
                          <span className="text-[10px] font-mono text-slate-400 uppercase">Gale 5</span>
                          <div className="text-base font-bold font-mono text-slate-100 mt-1">{record.recoveriesGale5 || 0}</div>
                        </div>
                        <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-center">
                          <span className="text-[10px] font-mono text-slate-400 uppercase">Gale Superior</span>
                          <div className="text-base font-bold font-mono text-slate-100 mt-1">{record.recoveriesUpperLevels || 0}</div>
                        </div>
                      </div>
                    </div>

                    {/* Archived Individual Operations */}
                    <div className="border-t border-slate-900 pt-4">
                      <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5 pb-1.5 border-b border-slate-900">
                        <Activity className="w-3.5 h-3.5 text-blue-400" />
                        Histórico de Entradas Arquivadas ({record.archivedOperations?.length || 0})
                      </h4>
                      {record.archivedOperations && record.archivedOperations.length > 0 ? (
                        <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-900 bg-black/40 custom-scrollbar">
                          <table className="w-full text-left border-collapse text-[11px] font-mono">
                            <thead>
                              <tr className="bg-slate-950/60 border-b border-slate-900 text-slate-500 uppercase text-[9px]">
                                <th className="p-2 pl-3">Hora</th>
                                <th className="p-2">Sinal/Direção</th>
                                <th className="p-2">Resultado</th>
                                <th className="p-2 text-right">Retorno</th>
                                <th className="p-2 text-center pr-3">Ação</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-900/60">
                              {record.archivedOperations.map((op, idx) => {
                                const isWin = op.isWin;
                                const isProfit = (op.profit ?? 0) > 0;
                                const isLoss = (op.profit ?? 0) < 0;
                                return (
                                  <tr key={op.id || idx} className="hover:bg-slate-900/40 text-slate-300">
                                    <td className="p-2 pl-3 text-slate-500">
                                      {new Date(op.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                    </td>
                                    <td className="p-2 font-semibold">
                                      {op.signal || op.metadata?.patternName || 'Entrada Manual'}
                                    </td>
                                    <td className="p-2">
                                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${isWin === true ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : isWin === false ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                                        {isWin === true ? 'WIN' : isWin === false ? 'LOSS' : 'EMPATE'} {op.result !== undefined ? `(${op.result})` : ''}
                                      </span>
                                    </td>
                                    <td className={`p-2 text-right font-semibold font-mono ${isProfit ? 'text-emerald-400' : isLoss ? 'text-rose-400' : 'text-slate-500'}`}>
                                      {op.profit !== undefined ? (op.profit > 0 ? `+${op.profit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : op.profit < 0 ? `${op.profit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : 'R$ 0,00') : '-'}
                                    </td>
                                    <td className="p-2 text-center pr-3">
                                      {deletingEntryKey === `${record.id}_${idx}` ? (
                                        <div className="flex items-center justify-center gap-1">
                                          <button
                                            type="button"
                                            onClick={async () => {
                                              const updatedArchived = [...(record.archivedOperations || [])];
                                              updatedArchived.splice(idx, 1);
                                              const updatedRecord = {
                                                ...record,
                                                archivedOperations: updatedArchived,
                                                totalOperations: Math.max(0, record.totalOperations - 1),
                                                lastUpdated: Date.now()
                                              };
                                              await saveDailyStatsRecord(updatedRecord);
                                              setDeletingEntryKey(null);
                                            }}
                                            className="px-1.5 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-[8px] font-bold transition active:scale-95"
                                          >
                                            Excluir
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setDeletingEntryKey(null)}
                                            className="px-1 py-0.5 bg-white/10 text-white/60 hover:text-white rounded text-[8px]"
                                          >
                                            X
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => setDeletingEntryKey(`${record.id}_${idx}`)}
                                          className="p-1 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 rounded transition"
                                          title="Apagar esta entrada individualmente"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="bg-slate-900/40 p-4 rounded-lg border border-slate-900/60 text-center">
                          <p className="text-xs text-slate-500 italic">Nenhum registro de entradas individuais arquivado para este dia operacional.</p>
                        </div>
                      )}
                    </div>

                    {/* User Observations Notes section */}
                    <div className="border-t border-slate-900 pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                          <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                          Observações do Operador
                        </span>
                        
                        {!isEditingNotes && (
                          <button
                            onClick={() => handleStartEditingNotes(record)}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded text-xs transition border border-slate-800 flex items-center gap-1"
                          >
                            <Edit3 className="w-3 h-3" />
                            Editar notas
                          </button>
                        )}
                      </div>

                      {isEditingNotes ? (
                        <div className="space-y-3">
                          <textarea
                            value={editedNotesValue}
                            onChange={(e) => setEditedNotesValue(e.target.value)}
                            placeholder="Adicione observações sobre a sessão (ex: 'Respeitei gerenciamento', 'Dia de overtrading')"
                            rows={3}
                            className="w-full bg-slate-900 border border-slate-800 focus:border-slate-700 outline-none text-xs rounded-lg p-3 text-white font-sans"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setEditingNotesId(null)}
                              className="px-3 py-1.5 bg-slate-900 text-slate-400 hover:text-white rounded text-xs font-medium border border-slate-800 transition"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => handleSaveNotes(record)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium flex items-center gap-1 transition"
                            >
                              <Save className="w-3 h-3" />
                              Salvar Notas
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-slate-900/60 p-4 rounded-lg border border-slate-850/60">
                          {record.notes ? (
                            <p className="text-xs text-slate-300 leading-relaxed italic">"{record.notes}"</p>
                          ) : (
                            <p className="text-xs text-slate-500 leading-relaxed italic">Nenhuma observação cadastrada para este dia. Clique em editar notas para adicionar.</p>
                          )}
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Close Operational Day Modal */}
      {isClosingDayModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-slate-950 border border-slate-800 max-w-md w-full rounded-2xl p-6 shadow-2xl animate-fade-in">
            <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
              <AlertTriangle className="text-amber-500 w-5 h-5" />
              Encerrar Operação
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Ao encerrar, calcularemos o resumo estatístico completo desta operação. O saldo atual será transferido como Saldo Inicial da próxima operação. Os contadores operacionais da banca atual serão reiniciados de forma limpa.
            </p>

            <div className="space-y-4">
              {/* Input for Notes */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono font-bold uppercase text-slate-400">Observações Finais da Operação</label>
                <textarea
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  placeholder="Ex: 'Respeitei a meta de stop win', 'Instabilidade de sinal à noite'"
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-800 focus:border-slate-700 outline-none text-xs rounded-lg p-3 text-white font-sans"
                />
              </div>

              {/* Dynamic current status indicator */}
              <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800">
                <span className="text-[10px] font-mono text-slate-400 uppercase">Valores que serão gravados</span>
                <div className="grid grid-cols-2 gap-3 mt-1.5 border-t border-slate-800/60 pt-2">
                  <div>
                    <span className="text-[9px] text-slate-500 block uppercase">Saldo Inicial</span>
                    <span className="text-xs font-mono font-bold text-white">
                      {bankrollBaccarat.initialBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block uppercase">Saldo Final (Atual)</span>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      {bankrollBaccarat.balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block uppercase">Total de Entradas</span>
                    <span className="text-xs font-mono font-bold text-white">
                      {historyBaccarat.length}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block uppercase">Data Registrada</span>
                    <span className="text-xs font-mono font-bold text-white">
                      {new Date().toLocaleDateString('sv-SE')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setIsClosingDayModalOpen(false)}
                className="w-1/2 py-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg text-xs font-medium transition border border-slate-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleManualCloseDay}
                className="w-1/2 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" />
                Gravar e Fechar Operação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Stats Confirmation Modal */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-slate-950 border border-slate-800 max-w-md w-full rounded-2xl p-6 shadow-2xl animate-fade-in">
            <h3 className="text-lg font-semibold text-red-400 mb-2 flex items-center gap-2">
              <AlertTriangle className="text-red-500 w-5 h-5" />
              Limpar Todo Histórico Estatístico
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Esta ação apagará <strong>permanentemente</strong> todos os registros consolidados de operações anteriores salvos no seu painel (do localStorage e da nuvem Firestore). Suas bancas atuais, estratégias e sessões ativas <strong>não</strong> serão alteradas.
            </p>

            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-white/40 tracking-wider">
                  Para confirmar e excluir permanentemente as estatísticas, digite <span className="text-red-400 font-mono">ZERAR</span> abaixo:
                </label>
                <input
                  type="text"
                  placeholder="Digite ZERAR"
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs font-mono text-white placeholder-white/20 outline-none focus:border-red-500/40 w-full uppercase"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setIsResetConfirmOpen(false);
                  setResetConfirmText('');
                }}
                className="w-1/2 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg text-xs font-medium transition border border-slate-800"
              >
                Cancelar
              </button>
              <button
                disabled={resetConfirmText !== 'ZERAR'}
                onClick={async () => {
                  await clearDailyHistory();
                  setIsResetConfirmOpen(false);
                  setResetConfirmText('');
                }}
                className={`w-1/2 py-2.5 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 ${
                  resetConfirmText === 'ZERAR'
                    ? 'bg-red-600 hover:bg-red-500 text-white cursor-pointer'
                    : 'bg-zinc-800 text-white/30 cursor-not-allowed border border-white/5'
                }`}
              >
                <Trash2 className="w-4 h-4" />
                Zerar Estatísticas
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
