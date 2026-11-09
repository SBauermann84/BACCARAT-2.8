import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X, History, Sparkles, MessageCircleWarning, Check } from 'lucide-react';
import { GameType } from '../types';

export interface BacktestAlert {
  id: string;
  strategyName: string;
  winRate: number;
  gameType: GameType;
  timestamp: string;
  type?: 'danger' | 'success' | 'signal';
  message?: string;
}

interface NotificationAlertsProps {
  alerts: BacktestAlert[];
  onDismiss: (id: string) => void;
  onClearAll: () => void;
}

export const NotificationAlerts: React.FC<NotificationAlertsProps> = ({
  alerts,
  onDismiss,
  onClearAll
}) => {
  return (
    <div className="fixed top-24 right-6 z-55 max-w-sm w-full pointer-events-none flex flex-col gap-3">
      <AnimatePresence>
        {alerts.map((alert) => {
          const isSuccess = alert.type === 'success';
          const isSignal = alert.type === 'signal';
          
          let cardBgBorderClass = 'bg-[#1b0b0b]/95 border-red-500/35 shadow-[0_10px_25px_rgba(239,68,68,0.15)]';
          if (isSuccess) {
            cardBgBorderClass = 'bg-[#0b1b11]/95 border-emerald-500/35 shadow-[0_10px_25px_rgba(16,185,129,0.15)]';
          } else if (isSignal) {
            cardBgBorderClass = 'bg-[#1b150b]/95 border-[#c6a34f]/35 shadow-[0_10px_25px_rgba(198,163,79,0.15)]';
          }
          
          let barGradientClass = 'from-red-600 to-red-500';
          if (isSuccess) {
            barGradientClass = 'from-emerald-600 to-emerald-500';
          } else if (isSignal) {
            barGradientClass = 'from-[#c6a34f] to-[#e6c36f]';
          }

          let iconContainerClass = 'bg-red-500/10 border-red-500/20 text-red-500';
          if (isSuccess) {
            iconContainerClass = 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500';
          } else if (isSignal) {
            iconContainerClass = 'bg-[#c6a34f]/10 border-[#c6a34f]/20 text-[#c6a34f]';
          }

          let headerTextClass = 'text-red-400';
          if (isSuccess) {
            headerTextClass = 'text-emerald-400';
          } else if (isSignal) {
            headerTextClass = 'text-[#c6a34f]';
          }

          let headerLabel = 'Alerta de Backtest';
          if (isSuccess) {
            headerLabel = 'Recuperação Ativa';
          } else if (isSignal) {
            headerLabel = 'Gatilho Confirmado';
          }

          let indicatorDotClass = 'bg-red-500/50';
          if (isSuccess) {
            indicatorDotClass = 'bg-emerald-500/50';
          } else if (isSignal) {
            indicatorDotClass = 'bg-[#c6a34f]/50';
          }

          return (
            <motion.div
              key={alert.id}
              layout
              initial={{ opacity: 0, y: -20, scale: 0.9, x: 50 }}
              animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.8, x: 100, transition: { duration: 0.2 } }}
              className={`pointer-events-auto backdrop-blur-md border p-4 rounded-2xl flex gap-3 relative overflow-hidden ${cardBgBorderClass}`}
            >
              {/* Urgent Warning, Success or Signal side highlight bar */}
              <div className={`absolute top-0 bottom-0 left-0 w-1 bg-gradient-to-b ${barGradientClass}`} />
              
              <div className={`p-2 rounded-xl border shrink-0 h-9 w-9 flex items-center justify-center ${iconContainerClass}`}>
                {isSuccess ? (
                  <Check size={18} className="animate-pulse" />
                ) : isSignal ? (
                  <Sparkles size={18} className="animate-pulse" />
                ) : (
                  <AlertTriangle size={18} className="animate-pulse" />
                )}
              </div>

              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[9px] uppercase tracking-wider font-extrabold ${headerTextClass}`}>
                    {headerLabel}
                  </span>
                  <span className={`h-1 w-1 rounded-full ${indicatorDotClass}`} />
                  <span className="text-[8px] uppercase tracking-wider text-white/40 font-mono">{alert.timestamp}</span>
                </div>
                <h4 className="text-[11px] font-black text-white uppercase truncate mt-0.5">{alert.strategyName}</h4>
                {isSuccess ? (
                  <p className="text-[10px] text-white/70 leading-relaxed mt-1">
                    {alert.message || `O saldo atingiu o ponto de recuperação. Aposta recomendada restaurada com sucesso!`}
                  </p>
                ) : isSignal ? (
                  <p className="text-[10px] text-white/70 leading-relaxed mt-1">
                    {alert.message}
                  </p>
                ) : (
                  <p className="text-[10px] text-white/60 leading-relaxed mt-1">
                    A assertividade caiu para <span className="text-red-400 font-black">{(alert.winRate ?? 0).toFixed(1)}% WR</span>, expondo a banca a risco extremo nas gales!
                  </p>
                )}
                
                <div className="mt-2 flex gap-1.5 items-center">
                  <span className={`px-1.5 py-0.5 rounded-md bg-black/40 border border-white/5 text-[8px] text-white/50 uppercase font-bold`}>
                    {alert.gameType === GameType.ROULETTE ? 'Roleta AI' : 'Baccarat AI'}
                  </span>
                  <span className={`text-[9px] font-mono font-bold flex items-center gap-0.5 ${
                    isSuccess ? 'text-emerald-400' : isSignal ? 'text-[#c6a34f]' : 'text-red-400'
                  }`}>
                    <Sparkles size={8} /> {isSuccess ? 'Gestão: Ciclo Reiniciado' : isSignal ? 'Sinal Ativo: Entrada Forte' : 'Recomendado: Modo Conservador'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => onDismiss(alert.id)}
                className="text-white/30 hover:text-white transition-colors absolute top-3 right-3 p-1 rounded-lg hover:bg-white/5"
              >
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

// Also export a small Alerts center tab interface inside the backtest page for high visibility persistence
interface AlertsHistoryPanelProps {
  alerts: BacktestAlert[];
  onClearAll: () => void;
}

export const AlertsHistoryPanel: React.FC<AlertsHistoryPanelProps> = ({
  alerts,
  onClearAll
}) => {
  const criticalAlerts = alerts.filter(alert => alert.type !== 'success' && alert.type !== 'signal');
  if (criticalAlerts.length === 0) return null;

  return (
    <div className="bg-[#1b0b0b]/35 border border-red-500/20 p-6 rounded-3xl text-left space-y-4 animate-in fade-in duration-300">
      <div className="flex justify-between items-center pb-2 border-b border-red-500/10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-red-500/10 rounded-lg text-red-500">
            <MessageCircleWarning size={15} />
          </div>
          <div>
            <h4 className="text-xs font-black text-white uppercase tracking-widest">
              NOTIFICAÇÕES DE RISCO CRÍTICO ({criticalAlerts.length})
            </h4>
            <p className="text-[9px] text-white/40 mt-0.5">
              Estratégias abaixo da margem segura de 60.0% detectadas no simulador de estresse.
            </p>
          </div>
        </div>
        <button
          onClick={onClearAll}
          className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 font-extrabold text-[8px] uppercase tracking-wider rounded-lg transition-all active:scale-95 cursor-pointer"
        >
          Limpar Central
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-56 overflow-y-auto pr-1">
        {criticalAlerts.map((alert) => (
          <div
            key={alert.id}
            className="p-3 bg-black/40 border border-red-500/10 rounded-2xl flex items-start gap-2.5 relative"
          >
            <div className="h-2 w-2 rounded-full bg-red-500 animate-ping absolute top-4 right-4" />
            <AlertTriangle className="text-red-500 mt-0.5 shrink-0" size={14} />
            <div className="min-w-0 flex-1">
              <div className="flex justify-between items-center gap-2">
                <span className="text-[10px] font-black text-white uppercase truncate">{alert.strategyName}</span>
                <span className="text-[9px] font-mono text-red-400 font-black shrink-0">{(alert.winRate ?? 0).toFixed(1)}% WR</span>
              </div>
              <p className="text-[9px] text-white/50 leading-relaxed mt-1">
                Exposição máxima detectada no histórico. Risco severo de quebra imediata sob ciclos de martingale consecutivos.
              </p>
              <div className="mt-1.5 flex items-center gap-2 text-[8px] font-bold">
                <span className="text-[#c6a34f]">Modalidade: {alert.gameType === GameType.ROULETTE ? 'Roleta' : 'Baccarat'}</span>
                <span className="text-white/30">•</span>
                <span className="text-white/40">{alert.timestamp}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
