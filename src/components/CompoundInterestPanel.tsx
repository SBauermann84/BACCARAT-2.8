import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  Download, 
  HelpCircle, 
  Calculator, 
  DollarSign, 
  Percent, 
  Calendar, 
  ArrowRight,
  Sparkles,
  Search,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Activity
} from 'lucide-react';

interface CompoundRow {
  day: number;
  investment: number;
  rate: number;
  profit: number;
  goal: number;
  betValue: number;
}

export const CompoundInterestPanel: React.FC = () => {
  const tableScrollRef = React.useRef<HTMLDivElement>(null);

  const scrollTable = (direction: 'left' | 'right') => {
    if (tableScrollRef.current) {
      const scrollAmount = direction === 'left' ? -180 : 180;
      tableScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const [initialInvestment, setInitialInvestment] = useState<number>(1000);
  const [dailyRate, setDailyRate] = useState<number>(5);
  const [totalDays, setTotalDays] = useState<number>(30);
  const [divisor, setDivisor] = useState<number>(100);
  
  // Local input state with comma formatting
  const [localInvestment, setLocalInvestment] = useState<string>('1.000,00');
  const [localRate, setLocalRate] = useState<string>('5,00');
  const [localDays, setLocalDays] = useState<string>('30');
  const [localDivisor, setLocalDivisor] = useState<string>('100');

  // Search filter for days
  const [searchDay, setSearchDay] = useState<string>('');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(15);

  // Sync inputs on blur or changes
  const parsePortugueseFloat = (val: string): number => {
    const clean = val.replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  };

  const formatBRL = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Generate Compound rows with full floating-point precision
  const rows = useMemo<CompoundRow[]>(() => {
    const data: CompoundRow[] = [];
    let currentBalance = initialInvestment;

    for (let day = 1; day <= totalDays; day++) {
      const investment = currentBalance;
      const profit = investment * (dailyRate / 100);
      const goal = investment + profit;
      const betValue = investment / divisor;

      data.push({
        day,
        investment,
        rate: dailyRate,
        profit,
        goal,
        betValue
      });

      // Next day starts with the goal of today
      currentBalance = goal;
    }
    return data;
  }, [initialInvestment, dailyRate, totalDays, divisor]);

  // Filtered rows by search day
  const filteredRows = useMemo(() => {
    if (!searchDay.trim()) return rows;
    const dayNum = parseInt(searchDay);
    if (isNaN(dayNum)) return rows;
    return rows.filter(r => r.day === dayNum);
  }, [rows, searchDay]);

  // Paginated rows
  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredRows.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredRows, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(filteredRows.length / rowsPerPage) || 1;

  // Chart data (taking a subset if days is very large, to keep chart elegant)
  const chartData = useMemo(() => {
    if (rows.length <= 100) return rows;
    // Sample rows for big datasets
    const step = Math.ceil(rows.length / 100);
    const sampled = rows.filter((_, idx) => idx % step === 0);
    if (sampled[sampled.length - 1]?.day !== rows[rows.length - 1].day) {
      sampled.push(rows[rows.length - 1]);
    }
    return sampled;
  }, [rows]);

  // Totals calculations
  const totalProfit = useMemo(() => {
    if (rows.length === 0) return 0;
    const finalGoal = rows[rows.length - 1].goal;
    return finalGoal - initialInvestment;
  }, [rows, initialInvestment]);

  const finalBalance = useMemo(() => {
    if (rows.length === 0) return initialInvestment;
    return rows[rows.length - 1].goal;
  }, [rows, initialInvestment]);

  const totalGrowthPercent = useMemo(() => {
    if (initialInvestment === 0) return 0;
    return (totalProfit / initialInvestment) * 100;
  }, [totalProfit, initialInvestment]);

  // Export to Excel-compatible CSV (Brazilian Portuguese system settings)
  const handleExportCSV = () => {
    // Semicolon separator, UTF-8 BOM, comma for decimals - opens perfectly in Brazilian Excel
    let csvContent = '\uFEFF'; // BOM
    csvContent += 'Dia;Investimento (R$);Retorno Diário (%);Lucro do Dia (R$);Meta do Dia (R$);Valor Apostar (Unidades)\n';

    rows.forEach(r => {
      const fInv = r.investment.toFixed(4).replace('.', ',');
      const fRate = r.rate.toFixed(2).replace('.', ',');
      const fProf = r.profit.toFixed(4).replace('.', ',');
      const fGoal = r.goal.toFixed(4).replace('.', ',');
      const fBet = r.betValue.toFixed(4).replace('.', ',');
      csvContent += `${r.day};${fInv};${fRate};${fProf};${fGoal};${fBet}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `simulador_juros_compostos_${totalDays}dias.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Safe handlers for blur
  const handleInvestmentBlur = () => {
    const val = parsePortugueseFloat(localInvestment);
    const finalVal = val > 0 ? val : 1000;
    setInitialInvestment(finalVal);
    setLocalInvestment(finalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setCurrentPage(1);
  };

  const handleRateBlur = () => {
    const val = parsePortugueseFloat(localRate);
    const finalVal = val > 0 ? val : 5;
    setDailyRate(finalVal);
    setLocalRate(finalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setCurrentPage(1);
  };

  const handleDaysBlur = () => {
    const val = parseInt(localDays);
    const finalVal = !isNaN(val) && val > 0 ? Math.min(val, 2000) : 30; // Limit to 2000 days for performance safety
    setTotalDays(finalVal);
    setLocalDays(finalVal.toString());
    setCurrentPage(1);
  };

  const handleDivisorBlur = () => {
    const val = parseInt(localDivisor);
    const finalVal = !isNaN(val) && val > 0 ? val : 100;
    setDivisor(finalVal);
    setLocalDivisor(finalVal.toString());
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-600/5 to-transparent border border-amber-500/15 p-6 rounded-3xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <Calculator size={180} className="text-amber-500" />
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-full text-[10px] font-black uppercase tracking-wider">
                Ferramenta de Planejamento
              </span>
              <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                <Activity size={10} className="animate-pulse" /> Offline Seguro
              </span>
            </div>
            <h2 className="text-2xl font-light tracking-tight text-white">Simulador de Juros Compostos</h2>
            <p className="text-xs text-white/50 max-w-2xl leading-relaxed">
              Defina seu investimento de partida, projete seus objetivos de retorno diário e planeje o crescimento gradativo de sua banca. Cada dia calcula automaticamente a meta e sugere um valor prudente para apostas com base em unidades de divisão.
            </p>
          </div>
          <button
            onClick={handleExportCSV}
            className="px-5 py-3 bg-[#c6a34f] hover:bg-[#b08e3b] text-black font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 tracking-wider transition-all cursor-pointer shadow-[0_4px_12px_rgba(198,163,79,0.15)] active:scale-95 shrink-0 self-start md:self-center"
          >
            <Download size={14} />
            <span>EXPORTAR EXCEL / GOOGLE SHEETS</span>
          </button>
        </div>
      </div>

      {/* Main Parameters Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Investimento Inicial */}
        <div className="bg-[#111111]/80 border border-white/5 p-4 rounded-2xl flex flex-col justify-between transition hover:border-[#c6a34f]/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase text-white/40 tracking-wider">Investimento Inicial</span>
            <DollarSign size={14} className="text-[#c6a34f]" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xs font-mono text-white/40">R$</span>
            <input
              type="text"
              value={localInvestment}
              onChange={(e) => setLocalInvestment(e.target.value.replace(/[^0-9.,-]/g, ''))}
              onBlur={handleInvestmentBlur}
              className="bg-transparent border-none p-0 text-2xl font-mono text-white outline-none w-full font-bold focus:ring-0"
              placeholder="1.000,00"
            />
          </div>
          <span className="text-[9px] text-white/30 mt-1">Valor de partida da operação</span>
        </div>

        {/* Retorno Diário % */}
        <div className="bg-[#111111]/80 border border-white/5 p-4 rounded-2xl flex flex-col justify-between transition hover:border-[#c6a34f]/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase text-white/40 tracking-wider">Meta Diária (%)</span>
            <Percent size={14} className="text-[#c6a34f]" />
          </div>
          <div className="flex items-baseline gap-1">
            <input
              type="text"
              value={localRate}
              onChange={(e) => setLocalRate(e.target.value.replace(/[^0-9.,-]/g, ''))}
              onBlur={handleRateBlur}
              className="bg-transparent border-none p-0 text-2xl font-mono text-white outline-none w-full font-bold focus:ring-0"
              placeholder="5,00"
            />
            <span className="text-xs font-mono text-white/40">%</span>
          </div>
          <span className="text-[9px] text-white/30 mt-1">Porcentagem de lucro por dia</span>
        </div>

        {/* Quantidade de Dias */}
        <div className="bg-[#111111]/80 border border-white/5 p-4 rounded-2xl flex flex-col justify-between transition hover:border-[#c6a34f]/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase text-white/40 tracking-wider">Período (Dias)</span>
            <Calendar size={14} className="text-[#c6a34f]" />
          </div>
          <div className="flex items-baseline gap-1">
            <input
              type="number"
              value={localDays}
              onChange={(e) => setLocalDays(e.target.value)}
              onBlur={handleDaysBlur}
              min="1"
              max="2000"
              className="bg-transparent border-none p-0 text-2xl font-mono text-white outline-none w-full font-bold focus:ring-0"
              placeholder="30"
            />
            <span className="text-xs font-mono text-white/40">dias</span>
          </div>
          <span className="text-[9px] text-white/30 mt-1">Máximo de 2000 dias</span>
        </div>

        {/* Divisor de Apostas (Unidades de Gestão) */}
        <div className="bg-[#111111]/80 border border-white/5 p-4 rounded-2xl flex flex-col justify-between transition hover:border-[#c6a34f]/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase text-white/40 tracking-wider">Divisor de Unidade</span>
            <Calculator size={14} className="text-[#c6a34f]" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xs font-mono text-white/40">1 /</span>
            <select
              value={divisor}
              onChange={(e) => {
                const val = Number(e.target.value);
                setDivisor(val);
                setLocalDivisor(val.toString());
                setCurrentPage(1);
              }}
              className="bg-transparent border-none p-0 text-xl font-mono text-white outline-none font-bold focus:ring-0 cursor-pointer"
            >
              <option value="20" className="bg-[#111111]">20 (Agressivo - 5%)</option>
              <option value="50" className="bg-[#111111]">50 (Moderado - 2%)</option>
              <option value="100" className="bg-[#111111]">100 (Conservador - 1%)</option>
              <option value="200" className="bg-[#111111]">200 (Muito Seguro - 0.5%)</option>
            </select>
          </div>
          <span className="text-[9px] text-white/30 mt-1">Tamanho sugerido da unidade</span>
        </div>
      </div>

      {/* Recommended Sizing & Guidelines Alert */}
      <div className="bg-[#111111]/40 border border-white/5 p-5 rounded-2xl grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
        <div className="lg:col-span-2 space-y-2">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <BookOpen size={16} className="text-[#c6a34f]" />
            Gerenciamento de Banca Sugerido (Informativo)
          </h4>
          <p className="text-[11px] text-white/60 leading-relaxed">
            Uma unidade de aposta segura é de <strong>{(100 / divisor).toFixed(1)}% ({formatBRL(initialInvestment / divisor)})</strong> do saldo inicial. Para atingir um lucro de <strong>{dailyRate}%</strong> com juros compostos, recomenda-se buscar no máximo de 3 a 5 vitórias líquidas (unidades) ao dia, minimizando a exposição.
          </p>
        </div>
        <div className="bg-[#050505] border border-white/5 p-4 rounded-xl flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[9px] uppercase font-bold text-white/40 block">Meta diária sugerida</span>
            <span className="text-base font-mono text-[#c6a34f] font-bold">
              {formatBRL(initialInvestment * (dailyRate / 100))}
            </span>
          </div>
          <div className="h-8 w-px bg-white/10" />
          <div className="space-y-1 text-right">
            <span className="text-[9px] uppercase font-bold text-white/40 block">Unidade Recomendada</span>
            <span className="text-base font-mono text-[#c6a34f] font-bold">
              {formatBRL(initialInvestment / divisor)}
            </span>
          </div>
        </div>
      </div>

      {/* Projection Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card Total Lucro Projetado */}
        <div className="bg-gradient-to-b from-[#111111] to-[#0d0d0d] border border-white/5 p-6 rounded-2xl flex items-center justify-between">
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase text-white/40 block tracking-wider">Lucro Líquido Projetado</span>
            <span className="text-2xl font-mono text-emerald-400 font-extrabold block">
              +{formatBRL(totalProfit)}
            </span>
            <span className="text-[10px] text-emerald-400/80 font-mono font-bold">
              Ganho Real sobre o inicial
            </span>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <TrendingUp size={24} />
          </div>
        </div>

        {/* Card Saldo Final Projetado */}
        <div className="bg-gradient-to-b from-[#111111] to-[#0d0d0d] border border-white/5 p-6 rounded-2xl flex items-center justify-between">
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase text-white/40 block tracking-wider">Saldo Final Previsto</span>
            <span className="text-2xl font-mono text-[#c6a34f] font-extrabold block">
              {formatBRL(finalBalance)}
            </span>
            <span className="text-[10px] text-[#c6a34f]/80 font-mono font-bold">
              Ao final de {totalDays} dias
            </span>
          </div>
          <div className="p-3 bg-[#c6a34f]/10 text-[#c6a34f] rounded-xl">
            <DollarSign size={24} />
          </div>
        </div>

        {/* Card Multiplicador de Crescimento */}
        <div className="bg-gradient-to-b from-[#111111] to-[#0d0d0d] border border-white/5 p-6 rounded-2xl flex items-center justify-between">
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase text-white/40 block tracking-wider">Crescimento de Banca</span>
            <span className="text-2xl font-mono text-blue-400 font-extrabold block">
              {totalGrowthPercent.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
            </span>
            <span className="text-[10px] text-blue-400/80 font-mono font-bold">
              Multiplicou por {(finalBalance / (initialInvestment || 1)).toFixed(1)}x
            </span>
          </div>
          <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl">
            <Sparkles size={24} />
          </div>
        </div>
      </div>

      {/* Projection Table Grid */}
      <div className="bg-[#111111]/80 border border-white/5 rounded-3xl overflow-hidden">
        {/* Table Controls */}
        <div className="p-5 border-b border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-950/20">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2 shrink-0">
              Tabela Operacional Diária
            </h3>
            <span className="text-[10px] text-white/40 font-mono bg-[#111111] px-2.5 py-1 rounded-lg border border-white/5">
              {filteredRows.length} {filteredRows.length === 1 ? 'dia' : 'dias'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
            {/* Search Day */}
            <div className="relative w-full sm:w-36">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                placeholder="Filtrar Dia..."
                value={searchDay}
                onChange={(e) => {
                  setSearchDay(e.target.value.replace(/\D/g, ''));
                  setCurrentPage(1);
                }}
                className="w-full pl-8 pr-3 py-1.5 bg-[#050505] border border-white/5 rounded-xl text-xs text-white placeholder-white/20 outline-none focus:border-[#c6a34f]/30 font-mono"
              />
            </div>

            {/* Rows Per Page */}
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-[#050505] border border-white/5 rounded-xl px-3 py-1.5 text-xs text-white outline-none cursor-pointer focus:border-[#c6a34f]/30"
            >
              <option value="10">10 linhas</option>
              <option value="15">15 linhas</option>
              <option value="30">30 linhas</option>
              <option value="50">50 linhas</option>
              <option value="100">100 linhas</option>
            </select>
          </div>
        </div>

        {/* Dynamic Interactive Table */}
        <div className="flex items-center gap-1.5 w-full">
          <button
            type="button"
            onClick={() => scrollTable('left')}
            className="p-1.5 bg-zinc-900/85 hover:bg-zinc-800 text-white hover:text-[#c6a34f] rounded-lg border border-white/5 transition-all shadow-md shrink-0 flex items-center justify-center cursor-pointer active:scale-95"
            title="Rolar Esquerda"
          >
            <ChevronLeft size={14} />
          </button>
          <div ref={tableScrollRef} className="flex-1 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="bg-slate-950/60 border-b border-white/5 text-white/40 uppercase text-[9px] tracking-wider">
                <th className="p-4 pl-6 text-center w-20">Dia</th>
                <th className="p-4">Investimento do Dia</th>
                <th className="p-4">Retorno Diário (%)</th>
                <th className="p-4">Lucro Estimado</th>
                <th className="p-4">Meta Diária (Acumulado)</th>
                <th className="p-4 pr-6 text-right">Valor Apostar / Unidade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {paginatedRows.length > 0 ? (
                paginatedRows.map((r) => {
                  const isFirstRow = r.day === 1;
                  return (
                    <tr 
                      key={r.day} 
                      className={`hover:bg-white/[0.02] text-white/80 transition-all ${
                        r.day % 2 === 0 ? 'bg-white/[0.005]' : ''
                      }`}
                    >
                      <td className="p-4 pl-6 text-center font-bold text-white">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-[10px]">
                          {r.day}
                        </span>
                      </td>
                      <td className="p-4 font-semibold text-white/90">
                        {formatBRL(r.investment)}
                        {isFirstRow && (
                          <span className="ml-1.5 text-[8px] bg-amber-500/10 text-amber-500 px-1 py-0.5 rounded uppercase font-bold tracking-wider">
                            Inicial
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-white/50">
                        {r.rate.toFixed(2).replace('.', ',')}%
                      </td>
                      <td className="p-4 text-emerald-400 font-semibold">
                        +{formatBRL(r.profit)}
                      </td>
                      <td className="p-4 text-[#c6a34f] font-bold">
                        {formatBRL(r.goal)}
                      </td>
                      <td className="p-4 pr-6 text-right text-blue-400 font-bold">
                        {formatBRL(r.betValue)}
                        <span className="text-[9px] text-white/30 ml-1 font-normal">
                          (1/{divisor})
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-white/30 italic">
                    Nenhum dia operacional encontrado para o filtro digitado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={() => scrollTable('right')}
          className="p-1.5 bg-zinc-900/85 hover:bg-zinc-800 text-white hover:text-[#c6a34f] rounded-lg border border-white/5 transition-all shadow-md shrink-0 flex items-center justify-center cursor-pointer active:scale-95"
          title="Rolar Direita"
        >
          <ChevronRight size={14} />
        </button>
      </div>

        {/* Table Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-white/5 flex items-center justify-between bg-slate-950/10 text-xs font-mono text-white/40">
            <span>
              Mostrando página <strong className="text-white">{currentPage}</strong> de <strong className="text-white">{totalPages}</strong> (Dias {(currentPage - 1) * rowsPerPage + 1} a {Math.min(currentPage * rowsPerPage, filteredRows.length)} de {filteredRows.length})
            </span>
            <div className="flex gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className={`p-2 rounded-xl border border-white/5 transition flex items-center gap-1 ${
                  currentPage === 1 
                    ? 'text-white/10 border-white/5 cursor-not-allowed' 
                    : 'text-white/60 hover:text-white hover:bg-white/5 cursor-pointer'
                }`}
              >
                <ChevronLeft size={14} />
                <span>Anterior</span>
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className={`p-2 rounded-xl border border-white/5 transition flex items-center gap-1 ${
                  currentPage === totalPages 
                    ? 'text-white/10 border-white/5 cursor-not-allowed' 
                    : 'text-white/60 hover:text-white hover:bg-white/5 cursor-pointer'
                }`}
              >
                <span>Próximo</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
