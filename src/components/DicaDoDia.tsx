import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Lightbulb, 
  TrendingUp, 
  AlertTriangle, 
  TrendingDown, 
  DollarSign, 
  Zap, 
  ShieldCheck, 
  ChevronRight,
  Sparkles,
  RefreshCw,
  Gauge
} from 'lucide-react';
import { useTranslation } from '../locales/translations';
import { Bankroll } from '../types';

interface DicaDoDiaProps {
  bankroll: Bankroll & {
    management: {
      initialBet: number;
      mode: string;
    };
  };
  derivedStats: {
    drawdown: number;
    winRate: number;
    profit: number;
    profitPercentage: number;
  };
}

export const DicaDoDia: React.FC<DicaDoDiaProps> = ({ bankroll, derivedStats }) => {
  const { t, lang } = useTranslation();
  const [activeTab, setActiveTab] = React.useState<'gestao' | 'estrategia' | 'psicologia'>('gestao');
  
  const winRate = derivedStats?.winRate ?? 0;
  const drawdown = derivedStats?.drawdown ?? 0;
  const profit = derivedStats?.profit ?? 0;
  
  // Dynamic recommendations based on metrics
  const getGestaoTip = () => {
    if (winRate === 0) {
      return {
        title: lang === 'pt-BR' ? "Inicie com Cautela" : "Start with Caution",
        description: lang === 'pt-BR' 
          ? `Nenhum resultado registrado nesta sessão. Recomendamos manter a aposta inicial em no máximo 1% a 2% do seu saldo total (R$ ${(bankroll.balance * 0.01).toFixed(2)}) para validar os sinais iniciais.`
          : `No results registered in this session. We recommend keeping the initial bet at a maximum of 1% to 2% of your total balance ($ ${(bankroll.balance * 0.01).toFixed(2)}) to validate the initial signals.`,
        badge: lang === 'pt-BR' ? "Ajuste Recomendado" : "Recommended Adjustment",
        color: "text-amber-400",
        bg: "bg-amber-400/10",
        border: "border-amber-400/20"
      };
    }
    
    if (winRate < 60) {
      const currentInitial = bankroll.management.initialBet;
      const proposedBet = Math.max(1, Math.round(currentInitial * 0.5));
      return {
        title: lang === 'pt-BR' ? "Reduzir Exposição" : "Reduce Exposure",
        description: lang === 'pt-BR'
          ? `Sua assertividade atual caiu para ${winRate.toFixed(1)}% (abaixo do patamar seguro de 60%). Reduza o valor da aposta inicial de R$ ${currentInitial.toFixed(2)} para R$ ${proposedBet.toFixed(2)} para mitigar o risco de quebra.`
          : `Your current assertiveness fell to ${winRate.toFixed(1)}% (below the 60% safe threshold). Reduce initial bet from $ ${currentInitial.toFixed(2)} to $ ${proposedBet.toFixed(2)} to mitigate the risk of ruin.`,
        badge: lang === 'pt-BR' ? "Alerta de Assertividade" : "Assertiveness Alert",
        color: "text-red-400",
        bg: "bg-red-400/10",
        border: "border-red-400/20"
      };
    }
    
    if (drawdown > 15) {
      return {
        title: lang === 'pt-BR' ? "Controle de Perda" : "Loss Control",
        description: lang === 'pt-BR'
          ? `O drawdown máximo atingiu ${drawdown.toFixed(1)}%. Sob alta oscilação, mude para o modo de operação defensiva ou virtual por alguns ciclos para reajustar seus motores de IA.`
          : `The maximum drawdown reached ${drawdown.toFixed(1)}%. Under high fluctuation, switch to defensive or virtual operations for a few cycles to readjust your AI engines.`,
        badge: lang === 'pt-BR' ? "Alerta de Drawdown" : "Drawdown Alert",
        color: "text-orange-400",
        bg: "bg-orange-400/10",
        border: "border-orange-400/20"
      };
    }
    
    if (winRate >= 75 && profit > 0) {
      return {
        title: lang === 'pt-BR' ? "Preservação de Lucro" : "Profit Preservation",
        description: lang === 'pt-BR'
          ? `Sua assertividade está excelente em ${winRate.toFixed(1)}% com lucro de R$ ${profit.toFixed(2)}. Proteja seus dividendos! Não tente "forçar" entradas extras se estiver próximo do Stop Win.`
          : `Your assertiveness is excellent at ${winRate.toFixed(1)}% with a profit of $ ${profit.toFixed(2)}. Protect your dividends! Do not try to "force" extra entries if you are close to Stop Win.`,
        badge: lang === 'pt-BR' ? "Lucro Premium" : "Premium Profit",
        color: "text-emerald-400",
        bg: "bg-emerald-400/10",
        border: "border-emerald-400/20"
      };
    }
    
    // Stable default tip
    return {
      title: lang === 'pt-BR' ? "Consistência de Unidade" : "Unit Consistency",
      description: lang === 'pt-BR'
        ? `Sua assertividade está saudável em ${winRate.toFixed(1)}% e drawdown controlado em ${drawdown.toFixed(1)}%. Mantenha os valores fixos de ficha e continue seguindo rigorosamente os filtros dinâmicos.`
        : `Your assertiveness is healthy at ${winRate.toFixed(1)}% and drawdown is controlled at ${drawdown.toFixed(1)}%. Keep chip values fixed and continue strictly following the dynamic filters.`,
      badge: lang === 'pt-BR' ? "Foco no Plano" : "Focus on Plan",
      color: "text-yellow-400",
      bg: "bg-yellow-400/10",
      border: "border-yellow-400/20"
    };
  };

  const getEstrategiaTip = () => {
    if (winRate === 0) {
      return {
        title: lang === 'pt-BR' ? "Configuração de Filtros" : "Filters Configuration",
        description: lang === 'pt-BR'
          ? "Antes de iniciar os registros do sapato, ative o 'Baccarat Pattern Miner' e as 'Confluências de Estradas' na aba de Estratégias. Eles dão cobertura robusta identificando repetições e desvios nas estradas secundárias."
          : "Before starting shoe records, enable 'Baccarat Pattern Miner' and 'Roadmap Confluences' on the Strategies tab. They provide robust coverage by identifying repetitions and deviations on secondary roads.",
        badge: lang === 'pt-BR' ? "Recomendação IA" : "AI Recommendation"
      };
    }
    if (winRate < 60) {
      return {
        title: lang === 'pt-BR' ? "Saturação de Padrões" : "Pattern Saturation",
        description: lang === 'pt-BR'
          ? "O sapato atual pode estar em um momento de transição caótica ou alternância rápida (pingu-pongu). Recomendamos desativar as estratégias agressivas e focar em entradas curtas ou esperar o corte do sapato."
          : "The current shoe might be in a chaotic transition phase or fast alternation (ping-pong). We recommend disabling aggressive strategies and focusing on short entries or waiting for the shoe cut.",
        badge: lang === 'pt-BR' ? "Estratégia Defensiva" : "Defensive Strategy"
      };
    }
    return {
      title: lang === 'pt-BR' ? "Sincronia com Roadmaps" : "Roadmaps Sync",
      description: lang === 'pt-BR'
        ? "As estradas secundárias (Big Eye Boy, Small Road, Cockroach Pig) estão se repetindo de forma altamente linear. Utilize a confluência de sinais para identificar sequências longas de Player/Banker."
        : "Secondary roads (Big Eye Boy, Small Road, Cockroach Pig) are repeating in a highly linear pattern. Use signal confluence to identify long streaks of Player or Banker.",
      badge: lang === 'pt-BR' ? "Otimização de Estradas" : "Roadmaps Optimization"
    };
  };

  const getPsicologiaTip = () => {
    if (winRate > 0 && winRate < 60) {
      return {
        title: lang === 'pt-BR' ? "Evite a Ganância de Recuperação" : "Avoid Recovery Greed",
        description: lang === 'pt-BR'
          ? "A mente humana tende a tentar recuperar perdas aumentando o lote de forma descontrolada (Tilt). Respeite os limites matemáticos configurados e não adicione apostas manuais impulsivas."
          : "The human mind tends to try to recover losses by uncontrolled increase of bet sizing (Tilt). Respect the configured mathematical limits and do not add impulsive manual bets.",
        badge: lang === 'pt-BR' ? "Blindagem Mental" : "Mental Armor"
      };
    }
    if (profit > 100) {
      return {
        title: lang === 'pt-BR' ? "Síndrome da Invencibilidade" : "Invincibility Syndrome",
        description: lang === 'pt-BR'
          ? "Após uma sequência vitoriosa de lucros, é comum nos sentirmos invencíveis e subirmos a mão. Lembre-se: o mercado é cíclico. Proteja seu lucro real e encerre a sapatilha de cartas."
          : "After a winning streak, it is common to feel invincible and increase sizing. Remember: the market is cyclical. Protect your real profits and close the card shoe.",
        badge: lang === 'pt-BR' ? "Inteligência Emocional" : "Emotional Intelligence"
      };
    }
    return {
      title: lang === 'pt-BR' ? "A Regra dos 10 Minutos" : "The 10-Minute Rule",
      description: lang === 'pt-BR'
        ? "Faça pequenas pausas a cada 30 minutos de sessão. Descansar os olhos e a mente reduz o cansaço analítico e previne erros operacionais bobos de digitação ou digito-pressão."
        : "Take small breaks every 30 minutes of session. Resting eyes and mind reduces analytical fatigue and prevents silly typing or click entry mistakes.",
      badge: lang === 'pt-BR' ? "Higiene Mental" : "Mental Hygiene"
    };
  };

  const gestao = getGestaoTip();
  const estrategia = getEstrategiaTip();
  const psicologia = getPsicologiaTip();

  const getActiveTip = () => {
    switch (activeTab) {
      case 'estrategia': return { ...estrategia, color: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/20", icon: Zap };
      case 'psicologia': return { ...psicologia, color: "text-purple-400", bg: "bg-purple-400/10", border: "border-purple-400/20", icon: Gauge };
      default: return { ...gestao, icon: Lightbulb };
    }
  };

  const currentTip = getActiveTip();
  const IconComponent = currentTip.icon;

  return (
    <div id="dica-do-dia-card" className="bg-[#111111] p-5 rounded-3xl border border-white/5 relative overflow-hidden transition-all duration-500 hover:border-[#c6a34f]/30">
      {/* Absolute decorative gradient */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-[#c6a34f]/5 rounded-full blur-3xl pointer-events-none" />
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-3.5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#c6a34f]/10 text-[#c6a34f] rounded-xl">
            <Sparkles size={18} className="animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-white">
              {lang === 'pt-BR' ? "Conselheiro IA: Dica do Dia" : "AI Advisor: Tip of the Day"}
            </h3>
            <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest mt-0.5">
              {lang === 'pt-BR' ? "Análise de ciclo dinâmico" : "Dynamic cycle analysis"}
            </p>
          </div>
        </div>
        
        {/* Metric Pill */}
        <div className="flex items-center gap-1.5 bg-black/40 px-3 py-1.5 rounded-xl border border-white/5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-[9px] font-black text-zinc-400 tracking-wider uppercase">
            {lang === 'pt-BR' ? `Assertividade: ${winRate.toFixed(1)}%` : `Win Rate: ${winRate.toFixed(1)}%`}
          </span>
        </div>
      </div>

      {/* Tabs to select which advice */}
      <div className="grid grid-cols-3 gap-1.5 bg-black/40 p-1.5 rounded-xl border border-white/5 mb-4">
        <button
          onClick={() => setActiveTab('gestao')}
          className={`w-full py-2.5 px-2 text-xs font-extrabold uppercase tracking-wider rounded-lg transition-all truncate text-center cursor-pointer ${
            activeTab === 'gestao' 
              ? 'bg-[#c6a34f] text-black shadow-lg shadow-[#c6a34f]/10 font-black' 
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          {lang === 'pt-BR' ? "📊 Gestão" : "📊 Mgmt"}
        </button>
        <button
          onClick={() => setActiveTab('estrategia')}
          className={`w-full py-2.5 px-2 text-xs font-extrabold uppercase tracking-wider rounded-lg transition-all truncate text-center cursor-pointer ${
            activeTab === 'estrategia' 
              ? 'bg-[#c6a34f] text-black shadow-lg shadow-[#c6a34f]/10 font-black' 
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          {lang === 'pt-BR' ? "⚡ Estratégia" : "⚡ Strategy"}
        </button>
        <button
          onClick={() => setActiveTab('psicologia')}
          className={`w-full py-2.5 px-2 text-xs font-extrabold uppercase tracking-wider rounded-lg transition-all truncate text-center cursor-pointer ${
            activeTab === 'psicologia' 
              ? 'bg-[#c6a34f] text-black shadow-lg shadow-[#c6a34f]/10 font-black' 
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          {lang === 'pt-BR' ? "🧠 Mindset" : "🧠 Mindset"}
        </button>
      </div>

      {/* Display Card for active tip */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className={`p-4 rounded-2xl ${currentTip.bg} border ${currentTip.border || 'border-white/5'} flex gap-4 items-start`}
        >
          <div className={`p-2.5 rounded-xl bg-black/50 ${currentTip.color}`}>
            <IconComponent size={20} />
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
              <span className="text-xs font-black text-white uppercase tracking-wider">
                {currentTip.title}
              </span>
              <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${currentTip.color} bg-black/40 uppercase tracking-widest border border-white/5 self-start sm:self-auto`}>
                {currentTip.badge}
              </span>
            </div>
            <p className="text-[11px] text-zinc-300 font-medium leading-relaxed">
              {currentTip.description}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Live Advice Footer summary of state */}
      <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px] font-medium text-zinc-500 bg-black/20 p-3 rounded-xl border border-white/5">
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <div className="w-1.5 h-1.5 rounded-full bg-[#c6a34f]" />
          <span>
            {lang === 'pt-BR' 
              ? `Limite de perda residual: R$ ${Math.max(0, bankroll.stopLoss - (bankroll.initialBalance - bankroll.balance)).toFixed(2)}`
              : `Remaining loss limit: $ ${Math.max(0, bankroll.stopLoss - (bankroll.initialBalance - bankroll.balance)).toFixed(2)}`}
          </span>
        </div>
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <span>
            {lang === 'pt-BR' 
              ? `Rebaixamento Máximo: ${drawdown.toFixed(1)}% / ${bankroll.drawdownLimit}%`
              : `Max Drawdown: ${drawdown.toFixed(1)}% / ${bankroll.drawdownLimit}%`}
          </span>
        </div>
      </div>
    </div>
  );
};
