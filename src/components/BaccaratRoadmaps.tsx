import React, { useRef, useEffect } from 'react';
import { 
  buildBeadPlate, 
  buildBigRoad, 
  computeDerivedRoadSignals, 
  buildDerivedRoadGrid, 
  BaccaratHistoryItem
} from '../utils/baccaratRoads';
import { ChevronLeft, ChevronRight, Grid, Layers, ShieldCheck } from 'lucide-react';

interface BaccaratRoadmapsProps {
  history: BaccaratHistoryItem[];
  onScrollLeft?: () => void;
  onScrollRight?: () => void;
}

export const BaccaratRoadmaps: React.FC<BaccaratRoadmapsProps> = ({ history }) => {
  const [activeTab, setActiveTab] = React.useState<'all' | 'bead' | 'big' | 'bigeye' | 'small' | 'cockroach'>('all');

  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate Bead Plate (shows ALL history results)
  const { grid: beadGrid, maxCols: beadMaxCols } = buildBeadPlate(history, 6, 13);

  // Calculate Big Road
  const { cells: bigRoadCells, maxColReached: bigMaxCol } = buildBigRoad(history, 6);

  // Calculate Derived Roads
  const bigRoadOccupied: boolean[][] = Array.from({ length: 100 }, () => Array(100).fill(false));
  bigRoadCells.forEach(c => {
    if (c.row < 100 && c.col < 100) bigRoadOccupied[c.row][c.col] = true;
  });

  const bigEyeSignals = computeDerivedRoadSignals(bigRoadCells, bigRoadOccupied, 1);
  const bigEyeGrid = buildDerivedRoadGrid(bigEyeSignals, 6);

  const smallRoadSignals = computeDerivedRoadSignals(bigRoadCells, bigRoadOccupied, 2);
  const smallRoadGrid = buildDerivedRoadGrid(smallRoadSignals, 6);

  const cockroachSignals = computeDerivedRoadSignals(bigRoadCells, bigRoadOccupied, 3);
  const cockroachGrid = buildDerivedRoadGrid(cockroachSignals, 6);

  // Latest results for quick header summary & visual highlights
  const lastBigCell = bigRoadCells[bigRoadCells.length - 1];
  const lastBigEyeCell = bigEyeGrid.cells[bigEyeGrid.cells.length - 1];
  const lastSmallCell = smallRoadGrid.cells[smallRoadGrid.cells.length - 1];
  const lastCockroachCell = cockroachGrid.cells[cockroachGrid.cells.length - 1];

  // Helper function to scroll container to show active results dynamically from start to end
  const scrollToActiveResult = (el: HTMLDivElement | null, lastCol: number, colWidth: number) => {
    if (!el) return;
    // Right edge of the latest occupied column (+ 3 extra buffer columns)
    const targetRightEdge = (lastCol + 3) * colWidth;
    const clientWidth = el.clientWidth;
    
    if (targetRightEdge <= clientWidth) {
      el.scrollLeft = 0;
    } else {
      const desiredScrollLeft = targetRightEdge - clientWidth;
      const maxScrollLeft = el.scrollWidth - clientWidth;
      el.scrollLeft = Math.min(maxScrollLeft, Math.max(0, desiredScrollLeft));
    }
  };

  // Sync scroll on history or activeTab updates
  useEffect(() => {
    const syncScrolls = () => {
      if (containerRef.current) {
        const beadLastCol = history.length > 0 ? Math.floor((history.length - 1) / 6) : 0;
        const bigLastCol = bigRoadCells.length > 0 ? bigMaxCol : 0;
        const bigEyeLastCol = bigEyeGrid.cells.length > 0 ? bigEyeGrid.maxCol : 0;
        const smallLastCol = smallRoadGrid.cells.length > 0 ? smallRoadGrid.maxCol : 0;
        const cockroachLastCol = cockroachGrid.cells.length > 0 ? cockroachGrid.maxCol : 0;

        const scrollables = containerRef.current.querySelectorAll<HTMLDivElement>('.overflow-x-auto');
        scrollables.forEach(el => {
          const roadType = el.getAttribute('data-road-type');
          if (roadType === 'bead') {
            scrollToActiveResult(el, beadLastCol, 34);
          } else if (roadType === 'big') {
            scrollToActiveResult(el, bigLastCol, 28);
          } else if (roadType === 'bigeye') {
            scrollToActiveResult(el, bigEyeLastCol, 24);
          } else if (roadType === 'small') {
            scrollToActiveResult(el, smallLastCol, 24);
          } else if (roadType === 'cockroach') {
            scrollToActiveResult(el, cockroachLastCol, 24);
          }
        });

        const maxCol = Math.max(beadLastCol, bigLastCol);
        scrollToActiveResult(containerRef.current, maxCol, 34);
      }
    };

    syncScrolls();
    const t1 = setTimeout(syncScrolls, 50);
    const t2 = setTimeout(syncScrolls, 150);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [history, activeTab, bigMaxCol, bigEyeGrid.maxCol, smallRoadGrid.maxCol, cockroachGrid.maxCol]);

  // Overall counts
  const totalRounds = history.length;
  let pCount = 0;
  let bCount = 0;
  let tCount = 0;

  history.forEach(h => {
    const char = String(h.result).toUpperCase().trim().charAt(0);
    if (char === 'B' || char === '2') bCount++;
    else if (char === 'T' || char === 'E' || char === '3') tCount++;
    else pCount++;
  });

  const scrollLeft = () => {
    if (containerRef.current) {
      containerRef.current.scrollBy({ left: -200, behavior: 'smooth' });
      const scrollables = containerRef.current.querySelectorAll('.overflow-x-auto');
      scrollables.forEach(el => el.scrollBy({ left: -200, behavior: 'smooth' }));
    }
  };

  const scrollRight = () => {
    if (containerRef.current) {
      containerRef.current.scrollBy({ left: 200, behavior: 'smooth' });
      const scrollables = containerRef.current.querySelectorAll('.overflow-x-auto');
      scrollables.forEach(el => el.scrollBy({ left: 200, behavior: 'smooth' }));
    }
  };

  // Helper to render Bead Plate grid (guarantees ALL items are shown and last item is highlighted)
  const renderBeadPlateGrid = (minCols = 13) => {
    const totalCols = Math.max(minCols, beadMaxCols);
    const lastIdx = history.length - 1;
    const lastR = lastIdx >= 0 ? lastIdx % 6 : -1;
    const lastC = lastIdx >= 0 ? Math.floor(lastIdx / 6) : -1;
    const beadLastCol = history.length > 0 ? Math.floor((history.length - 1) / 6) : 0;

    return (
      <div 
        ref={el => scrollToActiveResult(el, beadLastCol, 34)}
        data-road-type="bead"
        className="w-full overflow-x-auto custom-scrollbar pb-1"
      >
        <div className="grid grid-rows-6 grid-flow-col gap-1.5 justify-start min-w-max">
          {Array.from({ length: totalCols * 6 }).map((_, i) => {
            const r = i % 6;
            const c = Math.floor(i / 6);
            const cell = beadGrid[r][c];
            const isLast = cell && r === lastR && c === lastC;

            return (
              <div 
                key={`bead-${r}-${c}`} 
                className={`w-7 h-7 rounded flex items-center justify-center text-xs font-black transition-all ${
                  cell === 'P' ? 'bg-blue-600 text-white shadow-[0_1.5px_6px_rgba(37,99,235,0.3)]' :
                  cell === 'B' ? 'bg-red-600 text-white shadow-[0_1.5px_6px_rgba(220,38,38,0.3)]' :
                  cell === 'T' ? 'bg-green-600 text-white shadow-[0_1.5px_6px_rgba(22,163,74,0.3)]' :
                  'bg-white/[0.02] border border-white/[0.04]'
                } ${isLast ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-black animate-pulse' : ''}`}
              >
                {cell || ''}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Helper to render Big Road grid with latest cell highlighted
  const renderBigRoadGrid = (minCols = 20) => {
    const totalCols = Math.max(minCols, bigMaxCol + 4);
    const gridMap = new Map<string, typeof bigRoadCells[0]>();
    bigRoadCells.forEach(cell => {
      gridMap.set(`${cell.row},${cell.col}`, cell);
    });
    const bigLastCol = bigRoadCells.length > 0 ? bigMaxCol : 0;

    return (
      <div 
        ref={el => scrollToActiveResult(el, bigLastCol, 28)}
        data-road-type="big"
        className="w-full overflow-x-auto custom-scrollbar pb-1"
      >
        <div className="grid grid-rows-6 grid-flow-col gap-1 justify-start min-w-max">
          {Array.from({ length: totalCols * 6 }).map((_, idx) => {
            const r = idx % 6;
            const c = Math.floor(idx / 6);
            const cell = gridMap.get(`${r},${c}`);
            const isLast = lastBigCell && cell && lastBigCell.row === r && lastBigCell.col === c;

            return (
              <div 
                key={`big-${r}-${c}`} 
                className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-black bg-white/[0.02] border border-white/[0.04] relative shrink-0"
              >
                {cell && (
                  <div 
                    className={`w-5 h-5 rounded-full flex items-center justify-center border-2 text-[9px] font-black transition-all ${
                      cell.winner === 'B' 
                        ? 'border-red-500 text-red-400 bg-red-950/40 shadow-[0_0_8px_rgba(239,68,68,0.3)]' 
                        : 'border-blue-500 text-blue-400 bg-blue-950/40 shadow-[0_0_8px_rgba(59,130,246,0.3)]'
                    } ${isLast ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-black animate-pulse' : ''}`}
                  >
                    {cell.winner}
                    {/* Tie indicator on Big Road */}
                    {cell.tieCount > 0 && (
                      <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 text-black text-[8px] font-bold rounded-full flex items-center justify-center border border-black shadow">
                        {cell.tieCount > 1 ? cell.tieCount : ''}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Helper to render Derived Road grid with latest cell highlighted
  const renderDerivedRoadGrid = (
    gridData: { cells: typeof bigEyeGrid.cells; maxCol: number }, 
    type: 'bigeye' | 'small' | 'cockroach',
    minCols = 16
  ) => {
    const totalCols = Math.max(minCols, gridData.maxCol + 4);
    const cellMap = new Map<string, typeof gridData.cells[0]>();
    gridData.cells.forEach(cell => {
      cellMap.set(`${cell.row},${cell.col}`, cell);
    });

    const lastCell = gridData.cells[gridData.cells.length - 1];
    const derivedLastCol = gridData.cells.length > 0 ? gridData.maxCol : 0;

    return (
      <div 
        ref={el => scrollToActiveResult(el, derivedLastCol, 24)}
        data-road-type={type}
        className="w-full overflow-x-auto custom-scrollbar pb-1"
      >
        <div className="grid grid-rows-6 grid-flow-col gap-1 justify-start min-w-max">
          {Array.from({ length: totalCols * 6 }).map((_, idx) => {
            const r = idx % 6;
            const c = Math.floor(idx / 6);
            const cell = cellMap.get(`${r},${c}`);
            const isLast = lastCell && cell && lastCell.row === r && lastCell.col === c;

            return (
              <div 
                key={`${type}-${r}-${c}`} 
                className={`w-5 h-5 rounded flex items-center justify-center bg-white/[0.02] border border-white/[0.04] shrink-0 ${
                  isLast ? 'ring-1 ring-amber-400 bg-amber-400/10' : ''
                }`}
              >
                {cell && (
                  <>
                    {type === 'bigeye' && (
                      <div 
                        className={`w-3.5 h-3.5 rounded-full border-[1.8px] ${
                          cell.color === 'RED' 
                            ? 'border-red-500 shadow-[0_0_4px_rgba(239,68,68,0.4)]' 
                            : 'border-blue-500 shadow-[0_0_4px_rgba(59,130,246,0.4)]'
                        } ${isLast ? 'ring-2 ring-amber-400 animate-pulse' : ''}`}
                      />
                    )}
                    {type === 'small' && (
                      <div 
                        className={`w-2.5 h-2.5 rounded-full ${
                          cell.color === 'RED' 
                            ? 'bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.5)]' 
                            : 'bg-blue-500 shadow-[0_0_4px_rgba(59,130,246,0.5)]'
                        } ${isLast ? 'ring-2 ring-amber-400 animate-pulse' : ''}`}
                      />
                    )}
                    {type === 'cockroach' && (
                      <span 
                        className={`text-[12px] font-black leading-none ${
                          cell.color === 'RED' ? 'text-red-500' : 'text-blue-500'
                        } ${isLast ? 'ring-1 ring-amber-400 px-0.5 rounded animate-pulse' : ''}`}
                      >
                        {cell.color === 'RED' ? '/' : '\\'}
                      </span>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full bg-black/60 rounded-3xl border border-[#c6a34f]/20 p-4 space-y-4 shadow-xl">
      {/* Top Header & Quick Stats */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-[#c6a34f]/10 text-[#c6a34f] rounded-xl border border-[#c6a34f]/20">
            <Grid size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs md:text-sm font-black text-white uppercase tracking-wider">
                Placa de Estradas Baccarat (Roadmaps)
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                Oficial
              </span>
            </div>
            <p className="text-[11px] text-white/50">
              Bead Plate completo, Grande Estrada e Padrões Derivados (Últimos resultados sempre visíveis)
            </p>
          </div>
        </div>

        {/* Quick Stats Badges */}
        <div className="flex items-center gap-2 text-xs font-bold shrink-0">
          <div className="px-2.5 py-1 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span>P: {pCount}</span>
            <span className="text-[10px] text-blue-300/60">({totalRounds > 0 ? ((pCount/totalRounds)*100).toFixed(0) : 0}%)</span>
          </div>
          <div className="px-2.5 py-1 rounded-xl bg-red-600/20 border border-red-500/30 text-red-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span>B: {bCount}</span>
            <span className="text-[10px] text-red-300/60">({totalRounds > 0 ? ((bCount/totalRounds)*100).toFixed(0) : 0}%)</span>
          </div>
          <div className="px-2.5 py-1 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>T: {tCount}</span>
            <span className="text-[10px] text-emerald-300/60">({totalRounds > 0 ? ((tCount/totalRounds)*100).toFixed(0) : 0}%)</span>
          </div>
        </div>
      </div>

      {/* Responsive Tabs Bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 max-w-full">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'bg-[#c6a34f] text-black shadow-md shadow-[#c6a34f]/20'
                : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            <Layers size={13} />
            <span>Visão Completa</span>
          </button>
          
          <button
            type="button"
            onClick={() => setActiveTab('bead')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'bead'
                ? 'bg-[#c6a34f] text-black shadow-md shadow-[#c6a34f]/20'
                : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            Bead Plate ({beadMaxCols * 6})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('big')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'big'
                ? 'bg-[#c6a34f] text-black shadow-md shadow-[#c6a34f]/20'
                : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            Grande Estrada (Big Road)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bigeye')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'bigeye'
                ? 'bg-[#c6a34f] text-black shadow-md shadow-[#c6a34f]/20'
                : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            Olho Grande
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('small')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'small'
                ? 'bg-[#c6a34f] text-black shadow-md shadow-[#c6a34f]/20'
                : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            Pequeno Caminho
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cockroach')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'cockroach'
                ? 'bg-[#c6a34f] text-black shadow-md shadow-[#c6a34f]/20'
                : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            Cockroach Road
          </button>
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={scrollLeft}
            className="p-1.5 bg-zinc-900/90 hover:bg-zinc-800 text-white hover:text-[#c6a34f] rounded-lg border border-white/10 transition-all cursor-pointer"
            title="Rolar Esquerda"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            onClick={scrollRight}
            className="p-1.5 bg-zinc-900/90 hover:bg-zinc-800 text-white hover:text-[#c6a34f] rounded-lg border border-white/10 transition-all cursor-pointer"
            title="Rolar Direita"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Main Display Container */}
      <div 
        ref={containerRef}
        className="w-full overflow-x-auto custom-scrollbar p-3 bg-black/40 rounded-2xl border border-white/5 max-w-full"
      >
        {/* Visão Completa Tab */}
        {activeTab === 'all' && (
          <div className="space-y-4 min-w-[620px]">
            {/* Row 1: Bead Plate + Big Road */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              {/* Bead Plate */}
              <div className="lg:col-span-5 bg-zinc-950/80 p-3 rounded-2xl border border-white/5 space-y-2 overflow-hidden">
                <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-[#c6a34f]">
                  <span>Bead Plate Completo</span>
                  <span className="text-[10px] text-white/40 font-normal">{history.length} registradas</span>
                </div>
                {renderBeadPlateGrid(13)}
              </div>

              {/* Big Road */}
              <div className="lg:col-span-7 bg-zinc-950/80 p-3 rounded-2xl border border-white/5 space-y-2 overflow-hidden">
                <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-[#c6a34f]">
                  <span>Grande Estrada (Big Road)</span>
                  {lastBigCell ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-white/5 border border-white/10">
                      <span className="text-white/60">Último:</span>
                      <span className={lastBigCell.winner === 'B' ? 'text-red-400 font-black' : 'text-blue-400 font-black'}>
                        {lastBigCell.winner === 'B' ? 'Banker' : 'Player'}
                      </span>
                    </span>
                  ) : (
                    <span className="text-[10px] text-white/40 font-normal">Sequência Principal</span>
                  )}
                </div>
                {renderBigRoadGrid(20)}
              </div>
            </div>

            {/* Row 2: Derived Roads (Olho Grande, Pequeno Caminho, Cockroach) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Big Eye Boy */}
              <div className="bg-zinc-950/80 p-3 rounded-2xl border border-white/5 space-y-2 overflow-hidden">
                <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-[#c6a34f]">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full border-2 border-red-500 inline-block" />
                    Olho Grande (Big Eye)
                  </span>
                  {lastBigEyeCell ? (
                    <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
                      <span className={lastBigEyeCell.color === 'RED' ? 'text-red-400 font-black' : 'text-blue-400 font-black'}>
                        {lastBigEyeCell.color === 'RED' ? 'Vermelho' : 'Azul'}
                      </span>
                    </span>
                  ) : (
                    <span className="text-[9px] text-white/40">Gap 1</span>
                  )}
                </div>
                {renderDerivedRoadGrid(bigEyeGrid, 'bigeye', 14)}
              </div>

              {/* Small Road */}
              <div className="bg-zinc-950/80 p-3 rounded-2xl border border-white/5 space-y-2 overflow-hidden">
                <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-[#c6a34f]">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                    Pequeno Caminho
                  </span>
                  {lastSmallCell ? (
                    <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
                      <span className={lastSmallCell.color === 'RED' ? 'text-red-400 font-black' : 'text-blue-400 font-black'}>
                        {lastSmallCell.color === 'RED' ? 'Vermelho' : 'Azul'}
                      </span>
                    </span>
                  ) : (
                    <span className="text-[9px] text-white/40">Gap 2</span>
                  )}
                </div>
                {renderDerivedRoadGrid(smallRoadGrid, 'small', 14)}
              </div>

              {/* Cockroach Road */}
              <div className="bg-zinc-950/80 p-3 rounded-2xl border border-white/5 space-y-2 overflow-hidden">
                <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-[#c6a34f]">
                  <span className="flex items-center gap-1">
                    <span className="text-red-500 font-bold leading-none text-xs">/</span>
                    Cockroach Road
                  </span>
                  {lastCockroachCell ? (
                    <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
                      <span className={lastCockroachCell.color === 'RED' ? 'text-red-400 font-black' : 'text-blue-400 font-black'}>
                        {lastCockroachCell.color === 'RED' ? 'Vermelho' : 'Azul'}
                      </span>
                    </span>
                  ) : (
                    <span className="text-[9px] text-white/40">Gap 3</span>
                  )}
                </div>
                {renderDerivedRoadGrid(cockroachGrid, 'cockroach', 14)}
              </div>
            </div>
          </div>
        )}

        {/* Individual Tabs */}
        {activeTab === 'bead' && (
          <div className="space-y-2 w-full">
            <div className="text-xs font-black text-[#c6a34f] uppercase tracking-wider">
              Bead Plate Histórico Completo ({history.length} rodadas)
            </div>
            {renderBeadPlateGrid(26)}
          </div>
        )}

        {activeTab === 'big' && (
          <div className="space-y-2 w-full">
            <div className="flex items-center justify-between text-xs font-black text-[#c6a34f] uppercase tracking-wider">
              <span>Grande Estrada (Big Road)</span>
              {lastBigCell && (
                <span className="text-xs font-bold text-white/80">
                  Último: <strong className={lastBigCell.winner === 'B' ? 'text-red-400' : 'text-blue-400'}>{lastBigCell.winner === 'B' ? 'Banker' : 'Player'}</strong>
                </span>
              )}
            </div>
            {renderBigRoadGrid(32)}
          </div>
        )}

        {activeTab === 'bigeye' && (
          <div className="space-y-2 w-full">
            <div className="flex items-center justify-between text-xs font-black text-[#c6a34f] uppercase tracking-wider">
              <span>Olho Grande (Big Eye Boy)</span>
              {lastBigEyeCell && (
                <span className="text-xs font-bold text-white/80">
                  Último: <strong className={lastBigEyeCell.color === 'RED' ? 'text-red-400' : 'text-blue-400'}>{lastBigEyeCell.color === 'RED' ? 'Vermelho' : 'Azul'}</strong>
                </span>
              )}
            </div>
            {renderDerivedRoadGrid(bigEyeGrid, 'bigeye', 32)}
          </div>
        )}

        {activeTab === 'small' && (
          <div className="space-y-2 w-full">
            <div className="flex items-center justify-between text-xs font-black text-[#c6a34f] uppercase tracking-wider">
              <span>Pequeno Caminho (Small Road)</span>
              {lastSmallCell && (
                <span className="text-xs font-bold text-white/80">
                  Último: <strong className={lastSmallCell.color === 'RED' ? 'text-red-400' : 'text-blue-400'}>{lastSmallCell.color === 'RED' ? 'Vermelho' : 'Azul'}</strong>
                </span>
              )}
            </div>
            {renderDerivedRoadGrid(smallRoadGrid, 'small', 32)}
          </div>
        )}

        {activeTab === 'cockroach' && (
          <div className="space-y-2 w-full">
            <div className="flex items-center justify-between text-xs font-black text-[#c6a34f] uppercase tracking-wider">
              <span>Cockroach Road (Barata)</span>
              {lastCockroachCell && (
                <span className="text-xs font-bold text-white/80">
                  Último: <strong className={lastCockroachCell.color === 'RED' ? 'text-red-400' : 'text-blue-400'}>{lastCockroachCell.color === 'RED' ? 'Vermelho' : 'Azul'}</strong>
                </span>
              )}
            </div>
            {renderDerivedRoadGrid(cockroachGrid, 'cockroach', 32)}
          </div>
        )}
      </div>

      {/* Footer Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-white/50 bg-white/[0.02] p-2.5 rounded-xl border border-white/5">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full border-2 border-red-500" />
            <span className="text-white/80">Círculo Vazado = Olho Grande</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="text-white/80">Ponto Sólido = Pequeno Caminho</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-red-500 font-bold leading-none text-xs">/</span>
            <span className="text-white/80">Barra Diagonal = Cockroach Road</span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[#c6a34f]">
          <ShieldCheck size={13} />
          <span className="font-bold">Leitura Oficial: Vermelho = Repetição/Padrão | Azul = Quebra</span>
        </div>
      </div>
    </div>
  );
};

export default BaccaratRoadmaps;
