import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import { 
  Maximize2, 
  Minus, 
  X, 
  Layout, 
  Settings, 
  Compass, 
  DollarSign, 
  Sparkles, 
  RotateCcw, 
  Layers, 
  Volume2, 
  Play, 
  AlertCircle, 
  Plus, 
  Check, 
  Scale as ScaleIcon,
  MousePointer,
  Tv,
  HelpCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { GameType } from '../types';
import { useAppStore } from '../store/useAppStore';
import { useTranslation } from '../locales/translations';

interface OverlayWidgetProps {
  activeSignals: any[];
  onAddResult: (numOrSymbol: string | number) => void;
  currentGameType: GameType;
  setGameType: (type: GameType) => void;
  derivedStats: any;
}

export const OverlayWidget: React.FC<OverlayWidgetProps> = ({
  activeSignals,
  onAddResult,
  currentGameType,
  setGameType,
  derivedStats
}) => {
  const { tEntry } = useTranslation();
  const { 
    historyRoulette, 
    historyBaccarat, 
    bankroll, 
    removeLastResult, 
    resetHistory 
  } = useAppStore();

  // Mini state control
  const hudSeqScrollRef = useRef<HTMLDivElement>(null);
  const scrollHudSeq = (direction: 'left' | 'right') => {
    if (hudSeqScrollRef.current) {
      const scrollAmount = direction === 'left' ? -120 : 120;
      hudSeqScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [showInAppHud, setShowInAppHud] = useState(false);
  const [hudPosition, setHudPosition] = useState({ x: 80, y: 120 });
  const [hudSize, setHudSize] = useState({ width: 340, height: 480 });
  const [hudScale, setHudScale] = useState(1.0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [selectedGameInHud, setSelectedGameInHud] = useState<GameType>(currentGameType);

  // Keyboard rapid input state for quick addition in HUD
  const [quickInput, setQuickInput] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync selected game type with main app state
  useEffect(() => {
    setSelectedGameInHud(currentGameType);
  }, [currentGameType]);

  // Support checking for Document Picture in Picture
  const isDocumentPipSupported = typeof window !== 'undefined' && 'documentPictureInPicture' in window;

  // Active signals filtering based on Hud selected game
  const hudFilteredHistory = useMemo(() => {
    return selectedGameInHud === GameType.ROULETTE ? (historyRoulette || []) : (historyBaccarat || []);
  }, [selectedGameInHud, historyRoulette, historyBaccarat]);

  const hudSignals = useMemo(() => {
    if (selectedGameInHud === currentGameType) {
      return activeSignals;
    }
    return [];
  }, [selectedGameInHud, currentGameType, activeSignals]);

  // Auto scroll to top of signal feed on new signal
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [hudSignals.length]);

  // Copy style tags from parent window to Picture in Picture document
  const copyStyles = (targetDoc: Document) => {
    // 1. Copy general CSS stylesheets
    Array.from(document.styleSheets).forEach((styleSheet) => {
      try {
        if (styleSheet.href) {
          const link = targetDoc.createElement('link');
          link.rel = 'stylesheet';
          link.href = styleSheet.href;
          targetDoc.head.appendChild(link);
        } else if (styleSheet.cssRules) {
          const newStyle = targetDoc.createElement('style');
          Array.from(styleSheet.cssRules).forEach((rule) => {
            newStyle.appendChild(targetDoc.createTextNode(rule.cssText));
          });
          targetDoc.head.appendChild(newStyle);
        }
      } catch (e) {
        // Fallback for CORS restricted stylesheets
        const cssRules = [];
        try {
          for (let i = 0; i < styleSheet.cssRules.length; i++) {
            cssRules.push(styleSheet.cssRules[i].cssText);
          }
          const style = targetDoc.createElement('style');
          style.textContent = cssRules.join('\n');
          targetDoc.head.appendChild(style);
        } catch (err) {
          // ignore securely
        }
      }
    });

    // 2. Inject basic resets for dark transparent HUD style in the PiP window
    const customStyle = targetDoc.createElement('style');
    customStyle.textContent = `
      body {
        margin: 0;
        padding: 0;
        background-color: #060606 !important;
        color: white;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
        overflow: hidden;
      }
      /* Custom scrollbar */
      ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      ::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
      }
      ::-webkit-scrollbar-thumb {
        background: rgba(198, 163, 79, 0.4);
        border-radius: 999px;
      }
      ::-webkit-scrollbar-thumb:hover {
        background: rgba(198, 163, 79, 0.6);
      }
    `;
    targetDoc.head.appendChild(customStyle);
  };

  // Launch True Always-On-Top Browser Window (Picture-in-Picture)
  const handleOpenDocumentPip = async () => {
    if (!isDocumentPipSupported) {
      console.warn("Seu navegador não oferece suporte nativo à Picture-in-Picture para Documentos. Experimente usar o Google Chrome ou Microsoft Edge de Versão atualizada, ou ative o nosso 'Painel Flutuante Virtual V1.0' no botão abaixo.");
      return;
    }

    try {
      // If already open, close it
      if (pipWindow) {
        pipWindow.close();
        setPipWindow(null);
        return;
      }

      // Request Picture in Picture Window
      const pipW = await (window as any).documentPictureInPicture.requestWindow({
        width: 380,
        height: 560,
      });

      // Handle close callbacks
      pipW.addEventListener('pagehide', () => {
        setPipWindow(null);
      });

      // Synchronize styles
      copyStyles(pipW.document);
      pipW.document.title = "Overlay Hub - Casino Pattern AI";

      setPipWindow(pipW);
    } catch (error: any) {
      console.error("Erro ao iniciar Picture-in-Picture:", error);
    }
  };

  // Trigger close PIP
  useEffect(() => {
    return () => {
      if (pipWindow) {
        pipWindow.close();
      }
    };
  }, [pipWindow]);

  // Drag listeners for In-App HUD
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.hud-header-handle')) {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - hudPosition.x,
        y: e.clientY - hudPosition.y
      });
      e.preventDefault();
    }
  };

  // Handle Resize triggers for In-App HUD
  const handleResizeStart = (e: React.MouseEvent) => {
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      w: hudSize.width,
      h: hudSize.height
    });
    e.preventDefault();
    e.stopPropagation();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setHudPosition({
          x: Math.max(10, Math.min(window.innerWidth - hudSize.width * hudScale - 10, e.clientX - dragOffset.x)),
          y: Math.max(10, Math.min(window.innerHeight - hudSize.height * hudScale - 10, e.clientY - dragOffset.y))
        });
      }
      if (isResizing) {
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;
        setHudSize({
          width: Math.max(260, Math.min(600, resizeStart.w + deltaX / hudScale)),
          height: Math.max(340, Math.min(900, resizeStart.h + deltaY / hudScale))
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragOffset, resizeStart, hudSize, hudScale]);

  // Handle instant inputs
  const handleHudNumberSubmit = (val: string) => {
    if (!val) return;
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 0 && num <= 36) {
      onAddResult(num);
      setQuickInput('');
    } else {
      console.warn("Número inválido. Use um número de 0 a 36.");
    }
  };

  // Shared inner HUD content render
  const renderHUDContent = (isPipContext = false) => {
    return (
      <div className="flex flex-col h-full bg-[#0a0a0a]/95 text-white overflow-hidden text-left relative select-none">
        {/* Glow header border */}
        <div className="h-[2px] w-full bg-gradient-to-r from-[#c6a34f]/30 via-[#ffd700]/70 to-[#c6a34f]/30"></div>
        
        {/* Header HUD */}
        <div className="hud-header-handle flex justify-between items-center p-3.5 bg-black/55 border-b border-white/5 cursor-move">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#c6a34f] animate-pulse"></span>
            <div>
              <span className="text-[10px] uppercase font-black tracking-widest text-[#c6a34f] block leading-none">
                Sinalizador HUD Live
              </span>
              <span className="text-[8px] uppercase tracking-wider text-white/40 font-mono mt-0.5 block leading-none">
                Sempre visível para jogos
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Quick Game Switch */}
            <div className="bg-zinc-950/80 border border-white/10 rounded-lg p-0.5 flex">
              <button
                onClick={() => {
                  setSelectedGameInHud(GameType.ROULETTE);
                  setGameType(GameType.ROULETTE);
                }}
                className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider transition-colors duration-150 ${
                  selectedGameInHud === GameType.ROULETTE 
                    ? 'bg-[#c6a34f] text-black font-extrabold' 
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Roleta
              </button>
              <button
                onClick={() => {
                  setSelectedGameInHud(GameType.BACCARAT);
                  setGameType(GameType.BACCARAT);
                }}
                className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider transition-colors duration-150 ${
                  selectedGameInHud === GameType.BACCARAT 
                    ? 'bg-[#c6a34f] text-black font-extrabold' 
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Baccarat
              </button>
            </div>

            {/* Custom Close / Minimizer */}
            {!isPipContext && (
              <button 
                onClick={() => setShowInAppHud(false)} 
                className="text-white/40 hover:text-[#c6a34f] transition-colors p-1 rounded hover:bg-white/5 active:scale-95"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Signal HUD List */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3.5 space-y-3.5 custom-scrollbar min-h-0 bg-gradient-to-b from-[#0a0a0a] to-[#040404]">
          
          {/* Quick Bankroll HUD status */}
          <div className="bg-black/50 border border-[#c6a34f]/15 rounded-xl p-2.5 flex justify-between items-center bg-gradient-to-r from-black/60 to-zinc-950/40">
            <div className="flex flex-col">
              <span className="text-[7.5px] uppercase font-bold tracking-widest text-zinc-400">
                Lançador Ativo
              </span>
              <span className="text-xs font-black font-mono text-[#c6a34f] tracking-tighter mt-0.5">
                R$ {(bankroll.balance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="h-5 w-px bg-white/10" />
            <div className="flex flex-col text-right">
              <span className="text-[7.5px] uppercase font-bold tracking-widest text-zinc-400">
                Meta do Dia
              </span>
              <span className="text-xs font-semibold font-mono text-emerald-400 tracking-tighter mt-0.5">
                R$ {((bankroll.balance || 0) + (bankroll.stopWin || 100)).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
              </span>
            </div>
          </div>

          {/* Core HUD Signals Feed */}
          <div className="space-y-2">
            <span className="text-[8px] font-black uppercase tracking-widest text-[#c6a34f] flex items-center gap-1">
              <Sparkles size={8} /> Sinais de Confluência Atual ({hudSignals.length})
            </span>

            {hudSignals.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-white/5 bg-black/30 text-center">
                <p className="text-[9px] text-white/35 uppercase tracking-wider leading-snug">
                  Nenhuma confluência detectada nos giros anteriores.<br />
                  Insira dados do painel rápido abaixo para gerar previsões!
                </p>
              </div>
            ) : (
              hudSignals.map((sig, i) => (
                <div key={i} className={`p-3 rounded-lg border flex flex-col gap-1.5 transition-all relative overflow-hidden bg-gradient-to-b ${
                  sig.type === 'strong' 
                    ? 'border-emerald-500/30 bg-emerald-950/15' 
                    : 'border-amber-500/20 bg-amber-950/10'
                }`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[9px] font-bold text-white tracking-tight flex items-center gap-1">
                        {sig.patternName}
                      </span>
                    </div>
                    <span className={`text-[10px] font-black font-mono tracking-tighter shrink-0 ${
                      sig.type === 'strong' ? 'text-emerald-400' : 'text-amber-400'
                    }`}>
                      {sig.confidence}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t border-white/5 pt-1.5">
                    <span className="text-[7.5px] text-white/45 uppercase tracking-wider">RECOMENDAÇÃO:</span>
                    <span className="text-[10px] font-black font-mono text-[#c6a34f] border border-[#c6a34f]/30 px-1.5 py-0.5 rounded bg-[#c6a34f]/10 shrink-0">
                      {tEntry(sig.entry)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Quick Result addition keys inside the popup overlay */}
          <div className="space-y-2.5">
            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400 block">
              Inserir Novo Resultado da Rodada (Teclado HUD)
            </span>

            {selectedGameInHud === GameType.ROULETTE ? (
              <div className="space-y-2">
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleHudNumberSubmit(quickInput);
                  }}
                  className="flex gap-1.5"
                >
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={2}
                    placeholder="Número (0-36)"
                    value={quickInput}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      const parsed = parseInt(val, 10);
                      if (parsed > 36) return; // Prevent invalid inputs above 36

                      if (val.length === 2) {
                        if (parsed >= 0 && parsed <= 36) {
                          onAddResult(parsed);
                          setQuickInput('');
                          return;
                        }
                      }
                      setQuickInput(val);
                    }}
                    className="flex-1 px-2.5 py-1.5 text-xs bg-zinc-950 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#c6a34f] font-mono text-center"
                  />
                  <button
                    type="submit"
                    className="px-3 bg-[#c6a34f] text-black text-[10px] font-extrabold uppercase rounded-lg hover:brightness-110 active:scale-95 transition-all shrink-0 cursor-pointer"
                  >
                    Lançar
                  </button>
                </form>

                {/* Grid of most common quick-click numbers for lazy entry */}
                <div className="bg-black/40 border border-white/5 rounded-xl p-2.5 grid grid-cols-6 gap-1 bg-gradient-to-b from-black/40 to-black/60">
                  {[0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27].map((num) => {
                    const isRed = [32, 19, 21, 25, 34, 27].includes(num);
                    return (
                      <button
                        key={num}
                        onClick={() => onAddResult(num)}
                        className={`py-1 rounded font-black text-[9px] border hover:brightness-135 transition-all cursor-pointer ${
                          num === 0 
                            ? 'bg-[#00a651] border-green-500/20 text-white' 
                            : isRed 
                              ? 'bg-[#e30613] border-red-500/10 text-white' 
                              : 'bg-zinc-900 border-zinc-800 text-white'
                        }`}
                      >
                        {num}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Baccarat shortcut keys */
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => onAddResult('P')}
                  className="bg-blue-600 hover:bg-blue-500 border border-blue-400/20 text-white py-2 rounded-xl text-center flex flex-col items-center justify-center cursor-pointer transition-all active:scale-95 shadow-lg"
                >
                  <span className="text-xs font-black">PLAYER</span>
                  <span className="text-[7px] font-bold text-blue-200 mt-0.5">X2.00</span>
                </button>
                <button
                  onClick={() => onAddResult('B')}
                  className="bg-red-600 hover:bg-red-500 border border-red-400/20 text-white py-2 rounded-xl text-center flex flex-col items-center justify-center cursor-pointer transition-all active:scale-95 shadow-lg"
                >
                  <span className="text-xs font-black">BANKER</span>
                  <span className="text-[7px] font-bold text-red-200 mt-0.5">X1.95</span>
                </button>
                <button
                  onClick={() => onAddResult('T')}
                  className="bg-emerald-600 hover:bg-emerald-500 border border-emerald-400/20 text-white py-2 rounded-xl text-center flex flex-col items-center justify-center cursor-pointer transition-all active:scale-95 shadow-lg"
                >
                  <span className="text-xs font-black">TIE</span>
                  <span className="text-[7px] font-bold text-emerald-200 mt-0.5">X9.00</span>
                </button>
              </div>
            )}
          </div>

          {/* Last results sequence feed inside HUD */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-[8px] font-black uppercase text-zinc-400 tracking-widest">
              <span>Sequência Recente ({hudFilteredHistory.length})</span>
              <button 
                onClick={() => removeLastResult()} 
                disabled={hudFilteredHistory.length === 0}
                className="text-[7.5px] text-[#c6a34f] hover:underline hover:text-[#e4be63] flex items-center gap-0.5 disabled:opacity-40"
              >
                Voltar Último
              </button>
            </div>
            
            <div className="flex items-center gap-1 w-full">
              <button
                type="button"
                onClick={() => scrollHudSeq('left')}
                className="p-1 bg-zinc-900/85 hover:bg-zinc-800 text-white hover:text-[#c6a34f] rounded-lg border border-white/5 transition-all shadow-md shrink-0 flex items-center justify-center cursor-pointer active:scale-95"
                title="Rolar Esquerda"
              >
                <ChevronLeft size={10} />
              </button>
              <div ref={hudSeqScrollRef} className="flex-1 flex gap-1 overflow-x-auto py-1 pr-1 custom-scrollbar min-h-[36px] bg-black/45 border border-white/5 rounded-xl px-2 items-center">
                {hudFilteredHistory.length === 0 ? (
                  <span className="text-[8px] text-white/20 uppercase tracking-widest font-mono text-center w-full">Vazio</span>
                ) : (
                  hudFilteredHistory.slice(0, 15).map((h, i) => (
                    <div 
                      key={h.id || i} 
                      className={`w-6 h-6 rounded-lg font-black text-[9px] flex items-center justify-center shrink-0 border uppercase font-mono ${
                        selectedGameInHud === GameType.ROULETTE
                          ? h.result === 0
                            ? 'bg-[#00a651] border-green-500/20 text-white'
                            : [32, 19, 21, 25, 34, 27, 10, 16, 14, 22, 18, 7, 12, 3, 15, 4, 2, 6, 13, 11, 30, 8].includes(Number(h.result))
                              ? 'bg-[#e30613] border-red-500/15 text-white'
                              : 'bg-zinc-950 border-white/5 text-[#c6a34f]'
                          : h.result === 'P'
                            ? 'bg-blue-600 border-blue-400/20 text-white'
                            : h.result === 'B'
                              ? 'bg-red-600 border-red-400/20 text-white'
                              : 'bg-emerald-600 border-emerald-400/20 text-white'
                      }`}
                    >
                      {h.result}
                    </div>
                  ))
                )}
              </div>
              <button
                type="button"
                onClick={() => scrollHudSeq('right')}
                className="p-1 bg-zinc-900/85 hover:bg-zinc-800 text-white hover:text-[#c6a34f] rounded-lg border border-white/5 transition-all shadow-md shrink-0 flex items-center justify-center cursor-pointer active:scale-95"
                title="Rolar Direita"
              >
                <ChevronRight size={10} />
              </button>
            </div>
          </div>
          
        </div>

        {/* Dynamic adjust instructions for perfect custom utility */}
        <div className="bg-black/85 p-3 border-t border-white/5 text-[8.5px] text-stone-400 leading-snug font-sans flex flex-col gap-1 bg-gradient-to-b from-black/80 to-zinc-950">
          <p className="font-bold text-[#c6a34f] text-[9px] flex items-center gap-1 uppercase tracking-widest">
            <HelpCircle size={9} /> Dica de Operação
          </p>
          <p>
            {isPipContext 
              ? "Janela flutuante mantida automaticamente no topo do sistema. Posicione-a sobre a roleta do cassino de sua escolha e arraste as bordas desta janela para redefinir o tamanho."
              : "Arraste pelo cabeçalho superior para mover este HUD virtual. Redimensione arrastando o ícone no canto inferior direito."}
          </p>
        </div>

        {/* Resizing grip handle (Only for in-app floating window) */}
        {!isPipContext && (
          <div 
            onMouseDown={handleResizeStart}
            className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-gradient-to-br from-transparent to-[#c6a34f] cursor-se-resize flex items-end justify-end p-0.5"
            title="Arraste para redimensionar"
          >
            <div className="w-1.5 h-1.5 bg-black rounded-tl-sm"></div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex items-center gap-1.5">
      {/* 1. Toggle Button for Document Picture-in-Picture always-on-top window */}
      <button
        type="button"
        id="trigger-document-pip-btn"
        onClick={handleOpenDocumentPip}
        className={`w-8 h-8 rounded-xl border transition-all cursor-pointer flex items-center justify-center shadow-md shrink-0 ${
          pipWindow 
            ? 'bg-amber-400 text-black border-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.4)]' 
            : 'bg-zinc-900/90 hover:bg-zinc-800 border-stone-800 text-[#c6a34f] hover:border-[#c6a34f]/35 hover:scale-105 active:scale-95'
        }`}
        title="Janela Sempre no Topo (PiP): Abre uma janela flutuante nativa do sistema para colocar onde desejar."
      >
        <Tv size={14} className={pipWindow ? "text-black animate-pulse" : "text-[#c6a34f]"} />
      </button>

      {/* 2. Toggle Button for beautiful inside HUD Drag & Drop layout */}
      <button
        type="button"
        id="trigger-inapp-hud-btn"
        onClick={() => setShowInAppHud(!showInAppHud)}
        className={`w-8 h-8 rounded-xl border transition-all cursor-pointer flex items-center justify-center shadow-md shrink-0 ${
          showInAppHud 
            ? 'bg-[#c6a34f] text-black border-amber-300 shadow-[0_0_12px_rgba(198,163,79,0.4)]' 
            : 'bg-zinc-900/90 hover:bg-zinc-800 border-stone-800 text-stone-300 hover:border-stone-700 hover:scale-105 active:scale-95'
        }`}
        title="Painel Flutuante Virtual: Abre um HUD flutuante translúcido arrastável dentro do próprio sistema."
      >
        <Layers size={14} className={showInAppHud ? "text-black" : "text-stone-300"} />
      </button>

      {/* RENDER NATIVE PIP WINDOW VIA REACT PORTAL */}
      {pipWindow && ReactDOM.createPortal(
        renderHUDContent(true),
        pipWindow.document.body
      )}

      {/* RENDER IN-APP BEAUTIFUL DRAGGABLE AND RESIZABLE GLASS WINDOW */}
      {showInAppHud && (
        <div 
          className="fixed z-50 bg-[#0a0a0a]/95 border border-[#c6a34f]/30 rounded-2xl shadow-[0_10px_50px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden select-none transition-shadow hover:shadow-[0_10px_60px_rgba(198,163,79,0.15)]"
          style={{
            left: `${hudPosition.x}px`,
            top: `${hudPosition.y}px`,
            width: `${hudSize.width}px`,
            height: `${hudSize.height}px`,
            transform: `scale(${hudScale})`,
            transformOrigin: 'top left',
          }}
          onMouseDown={handleMouseDown}
        >
          {renderHUDContent(false)}

          {/* Quick scale slider on bottom of in-app HUD */}
          <div className="absolute top-14 right-3 bg-black/80 border border-white/10 rounded-lg p-1.5 flex flex-col gap-1 items-center z-40 shadow-xl opacity-0 hover:opacity-100 transition-opacity">
            <span className="text-[7px] text-white/50 uppercase font-bold">Ajuste de Zoom</span>
            <input 
              type="range" 
              min="0.7" 
              max="1.4" 
              step="0.05"
              value={hudScale}
              onChange={(e) => setHudScale(parseFloat(e.target.value))}
              className="w-16 h-1 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-[#c6a34f]"
            />
            <span className="text-[8px] text-[#c6a34f] font-mono font-bold">{(hudScale * 100).toFixed(0)}%</span>
          </div>
        </div>
      )}
    </div>
  );
};
