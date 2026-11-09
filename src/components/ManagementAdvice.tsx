import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AlertTriangle, 
  TrendingUp, 
  CheckCircle2, 
  Activity, 
  ShieldAlert, 
  Sparkles,
  Info,
  Brain,
  RefreshCw,
  Zap,
  CloudOff,
  Check
} from 'lucide-react';
import { useTranslation } from '../locales/translations';
import { Bankroll, RiskProfile } from '../types';
import { analyzeSessionOffline, SessionMetrics } from '../engines/advisorEngine';

interface ManagementAdviceProps {
  bankroll: Bankroll & {
    management: {
      profile: RiskProfile;
      mode: string;
      initialBet: number;
    };
  };
  derivedStats?: {
    drawdown: number;
    winRate: number;
    profit: number;
    profitPercentage: number;
  };
  history: any[];
  gameType: string;
}

export const ManagementAdvice: React.FC<ManagementAdviceProps> = ({ 
  bankroll, 
  derivedStats,
  history = [],
  gameType 
}) => {
  const { t } = useTranslation();

  const initialBalance = bankroll?.initialBalance ?? 1000;
  const balance = bankroll?.balance ?? 1000;
  const stopLoss = bankroll?.stopLoss ?? 100;
  const stopWin = bankroll?.stopWin ?? 200;
  const profile = bankroll?.management?.profile;

  const currentLoss = initialBalance - balance;
  const currentProfit = balance - initialBalance;
  const drawdown = derivedStats?.drawdown ?? bankroll?.drawdown ?? 0;

  // AI & Local Fallback States
  const [adviceResult, setAdviceResult] = React.useState<SessionMetrics | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [isOffline, setIsOffline] = React.useState(false);

  const fetchAdvancedAdvice = async (forceOffline: boolean = false) => {
    setLoading(true);
    setIsOffline(false);

    // Filter and format the last 15 rounds to keep payloads lightweight
    const recentResults = history.slice(-15).map(h => ({
      id: h.id,
      isWin: h.isWin,
      profit: h.profit,
      result: h.result,
      timestamp: h.timestamp
    }));

    if (forceOffline) {
      // Direct local analysis fallback
      const localResult = analyzeSessionOffline(history, bankroll);
      setAdviceResult(localResult);
      setIsOffline(true);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/gemini/advice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          gameType,
          bankroll,
          recentResults,
          currentLevel: 0
        })
      });

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const data = await response.json();

      if (data.error === 'no-key' || data.error === 'api-unavailable' || data.error === 'overloaded') {
        // Falling back to rule-based engine due to lack of API Key or Service Unavailability
        const localResult = analyzeSessionOffline(history, bankroll);
        setAdviceResult(localResult);
        setIsOffline(true);
      } else {
        setAdviceResult({
          volatilityScore: data.volatilityScore,
          volatilityLabel: data.volatilityLabel,
          recoveryStress: data.recoveryStress,
          analysis: data.analysis,
          recommendations: data.recommendations,
          lossStreak: 0,
          winStreak: 0,
          winRate: derivedStats?.winRate ?? 0,
          drawdown
        });
        setIsOffline(false);
      }
    } catch (error) {
      console.warn("API Error. Activating local mathematical advisor fallback:", error);
      const localResult = analyzeSessionOffline(history, bankroll);
      setAdviceResult(localResult);
      setIsOffline(true);
    } finally {
      setLoading(false);
    }
  };

  // Re-run advice calculation on history updates
  React.useEffect(() => {
    fetchAdvancedAdvice();
  }, [history?.length, gameType]);

  // Classic protection alerts calculation
  interface AlertItem {
    id: string;
    type: 'danger' | 'warning' | 'info' | 'success';
    icon: React.ComponentType<{ size?: number; className?: string }>;
    titleKey: string;
    description: string;
  }

  const alerts: AlertItem[] = [];

  if (currentLoss > 0 && currentLoss >= stopLoss) {
    alerts.push({
      id: 'stop-loss-hit',
      type: 'danger',
      icon: ShieldAlert,
      titleKey: 'advice.status.danger',
      description: t('advice.stop_loss.hit'),
    });
  } else if (currentLoss > 0 && currentLoss >= stopLoss * 0.75) {
    alerts.push({
      id: 'stop-loss-near',
      type: 'warning',
      icon: AlertTriangle,
      titleKey: 'advice.status.warning',
      description: t('advice.stop_loss.near'),
    });
  }

  if (currentProfit > 0 && currentProfit >= stopWin) {
    alerts.push({
      id: 'stop-win-hit',
      type: 'success',
      icon: Sparkles,
      titleKey: 'advice.status.safe',
      description: t('advice.stop_win.hit'),
    });
  } else if (currentProfit > 0 && currentProfit >= stopWin * 0.75) {
    alerts.push({
      id: 'stop-win-near',
      type: 'warning',
      icon: TrendingUp,
      titleKey: 'advice.status.warning',
      description: t('advice.stop_win.near'),
    });
  }

  if (drawdown >= 12) {
    alerts.push({
      id: 'drawdown-high',
      type: 'danger',
      icon: Activity,
      titleKey: 'advice.status.danger',
      description: t('advice.drawdown.high').replace('{val}', drawdown.toFixed(1)),
    });
  }

  if (profile === RiskProfile.AGGRESSIVE) {
    alerts.push({
      id: 'profile-aggressive',
      type: 'info',
      icon: Info,
      titleKey: 'advice.status.action',
      description: t('advice.profile.high'),
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      id: 'all-systems-healthy',
      type: 'success',
      icon: CheckCircle2,
      titleKey: 'advice.status.safe',
      description: t('advice.safe.stable'),
    });
  }

  const typeStyles = {
    danger: {
      border: 'border-red-500/20 bg-red-500/5',
      text: 'text-red-400',
      badge: 'bg-red-500/10 text-red-400 border border-red-500/20',
      glow: 'shadow-[0_0_15px_-3px_rgba(239,68,68,0.1)]',
    },
    warning: {
      border: 'border-yellow-500/20 bg-yellow-500/5',
      text: 'text-yellow-500',
      badge: 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20',
      glow: 'shadow-[0_0_15px_-3px_rgba(234,179,8,0.1)]',
    },
    success: {
      border: 'border-green-500/20 bg-green-500/5',
      text: 'text-green-400',
      badge: 'bg-green-500/10 text-green-400 border border-green-500/20',
      glow: 'shadow-[0_0_15px_-3px_rgba(34,197,94,0.1)]',
    },
    info: {
      border: 'border-[#c6a34f]/20 bg-[#c6a34f]/5',
      text: 'text-[#c6a34f]',
      badge: 'bg-[#c6a34f]/10 text-[#c6a34f] border border-[#c6a34f]/20',
      glow: 'shadow-[0_0_15px_-3px_rgba(198,163,79,0.1)]',
    }
  };

  return (
    <div id="management-advice-panel" className="bg-[#111111] p-6 rounded-3xl border border-white/5 space-y-6">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-widest text-[#c6a34f] flex items-center gap-2">
            <Brain size={16} className="text-[#c6a34f]" />
            {t('advice.title')}
          </h3>
          <p className="text-[10px] text-white/40 uppercase tracking-wider mt-1">
            {t('advice.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchAdvancedAdvice()}
            disabled={loading}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 text-white/60 hover:text-white transition-all disabled:opacity-50 cursor-pointer"
            title="Recalcular Conselhos"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#c6a34f]/10 text-[#c6a34f] text-[10px] font-black uppercase tracking-widest">
            <Activity size={12} className="animate-pulse" />
            <span>AI RISK VISOR v2</span>
          </div>
        </div>
      </div>

      {/* Primary Section: Real-time Advisor Insights */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-[#1c1a14] to-[#12110e] border border-[#c6a34f]/15 relative overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <Brain size={120} />
        </div>

        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center gap-3">
            <RefreshCw size={24} className="text-[#c6a34f] animate-spin" />
            <span className="text-xs text-white/50 uppercase font-bold tracking-widest animate-pulse">
              Analisando Sessão com Inteligência...
            </span>
          </div>
        ) : adviceResult ? (
          <div className="space-y-4">
            {/* Status indicators */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Volatility Badge */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/40 border border-white/5 text-[11px] font-bold">
                <span className="text-white/40">Volatilidade:</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                  adviceResult.volatilityLabel === 'Extrema' || adviceResult.volatilityLabel === 'Alta'
                    ? 'bg-red-500/10 text-red-400 border border-red-500/25'
                    : 'bg-green-500/10 text-green-400 border border-green-500/25'
                }`}>
                  {adviceResult.volatilityScore}% - {adviceResult.volatilityLabel}
                </span>
              </div>

              {/* Stress Badge */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/40 border border-white/5 text-[11px] font-bold">
                <span className="text-white/40">Estresse de Recuperação:</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                  adviceResult.recoveryStress === 'Crítico' || adviceResult.recoveryStress === 'Alto'
                    ? 'bg-orange-500/10 text-orange-400 border border-orange-500/25'
                    : 'bg-green-500/10 text-green-400 border border-green-500/25'
                }`}>
                  {adviceResult.recoveryStress}
                </span>
              </div>

              {/* Offline Badge */}
              <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/40 border border-white/5 text-[11px] font-bold">
                {isOffline ? (
                  <>
                    <CloudOff size={12} className="text-yellow-500" />
                    <span className="text-yellow-500 font-extrabold text-[10px] tracking-widest uppercase flex items-center gap-1">
                      MOTOR LOCAL <span className="text-white/30 font-medium">(100% Offline)</span>
                    </span>
                  </>
                ) : (
                  <>
                    <Zap size={12} className="text-[#c6a34f]" />
                    <span className="text-[#c6a34f] font-extrabold text-[10px] tracking-widest uppercase">
                      ONLINE (GEMINI AI)
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Analysis Paragraph */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-[#c6a34f] tracking-wider flex items-center gap-1.5">
                <Zap size={10} />
                Diagnóstico de Comportamento
              </span>
              <p className="text-xs text-white/80 leading-relaxed font-medium">
                {adviceResult.analysis || (
                  isOffline 
                    ? "O motor analítico local concluiu o mapeamento matemático da sua sequência de rodadas. Veja as recomendações de segurança abaixo."
                    : "Sua análise foi calculada com sucesso com base no comportamento recente do mercado."
                )}
              </p>
            </div>

            {/* Recommendations bullets */}
            {adviceResult.recommendations && adviceResult.recommendations.length > 0 && (
              <div className="space-y-2 border-t border-white/5 pt-3">
                <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">
                  Conselhos de Risco & Gerenciamento
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {adviceResult.recommendations.map((rec, idx) => (
                    <div 
                      key={idx} 
                      className="p-3 rounded-xl bg-black/30 border border-white/5 flex gap-2.5 items-start"
                    >
                      <div className="p-1 rounded bg-[#c6a34f]/10 text-[#c6a34f] shrink-0 mt-0.5">
                        <Check size={10} className="stroke-[3]" />
                      </div>
                      <span className="text-[11px] text-white/80 leading-snug font-medium">
                        {rec}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-white/40 italic">
            Insira resultados para ativar o consultor avançado de risco.
          </div>
        )}
      </div>

      {/* Secondary Section: Classic Protection Alerts */}
      <div className="space-y-2.5">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/30">
          Alertas de Proteção da Banca (Métricas Fixas)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence mode="popLayout">
            {alerts.map((alert) => {
              const style = typeStyles[alert.type];
              const AlertIcon = alert.icon;

              return (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className={`p-4 rounded-2xl border ${style.border} ${style.glow} flex gap-4 items-start transition-all duration-300`}
                >
                  <div className={`p-2.5 rounded-xl bg-black/40 ${style.text} shrink-0`}>
                    <AlertIcon size={20} />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-extrabold tracking-widest px-2 py-0.5 rounded-md ${style.badge}`}>
                        {t(alert.titleKey)}
                      </span>
                    </div>
                    <p className="text-xs text-white/80 leading-relaxed font-medium">
                      {alert.description}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
