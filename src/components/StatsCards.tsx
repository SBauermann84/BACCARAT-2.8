import React from 'react';
import { 
  BarChart3, 
  ArrowUpRight, 
  ArrowDownRight, 
  Percent, 
  Target,
  ShieldCheck,
  Zap,
  Activity,
  TrendingUp
} from 'lucide-react';
import { useTranslation } from '../locales/translations';
import { useAppStore } from '../store/useAppStore';

interface StatsCardsProps {
  bankroll: any;
  sessions: any[];
}

const StatsCards: React.FC<StatsCardsProps> = ({ bankroll, sessions }) => {
  const { t } = useTranslation();
  const { settings } = useAppStore();
  
  const getCurrencySymbol = (currencyCode: string) => {
    switch (currencyCode) {
      case 'USD': return '$';
      case 'EUR': return '€';
      default: return 'R$';
    }
  };

  const currencySymbol = getCurrencySymbol(settings?.currency || 'BRL');

  const stats = [
    { 
      label: t('stats.netprofit'), 
      value: `${currencySymbol} ${(bankroll?.profit || 0).toFixed(2).replace('.', ',')}`, 
      trend: `${(bankroll?.profitPercentage || 0).toFixed(1)}%`,
      trendColor: (bankroll?.profit || 0) >= 0 ? 'text-green-500' : 'text-red-500',
      trendIcon: (bankroll?.profit || 0) >= 0 ? ArrowUpRight : ArrowDownRight,
      icon: TrendingUp, 
      color: 'text-green-500', 
      bg: 'bg-green-500/10' 
    },
    { 
      label: t('stats.maxdrawdown'), 
      value: `${(bankroll?.drawdown || 0).toFixed(1)}%`, 
      trend: (bankroll?.drawdown || 0) > 15 ? 'ALTO' : 'OK',
      trendColor: (bankroll?.drawdown || 0) > 15 ? 'text-red-500' : 'text-green-500',
      trendIcon: Activity,
      icon: ArrowDownRight, 
      color: 'text-red-500', 
      bg: 'bg-red-500/10' 
    },
    { 
      label: t('stats.sessionassertiveness'), 
      value: `${(bankroll?.winRate || 0).toFixed(1)}%`, 
      trend: (bankroll?.winRate || 0) >= 70 ? 'BOA' : 'BAIXA',
      trendColor: (bankroll?.winRate || 0) >= 70 ? 'text-green-500' : 'text-red-500',
      trendIcon: Zap,
      icon: Percent, 
      color: 'text-[#c6a34f]', 
      bg: 'bg-[#c6a34f]/10' 
    },
    { 
      label: t('stats.precisionscore'), 
      value: `${(bankroll?.precisionScore || 0).toFixed(1)}%`, 
      trend: (bankroll?.precisionScore || 0) >= 80 ? 'EXCELENTE' : 'REGULAR',
      trendColor: (bankroll?.precisionScore || 0) >= 80 ? 'text-blue-500' : 'text-yellow-500',
      trendIcon: Target,
      icon: Target, 
      color: 'text-blue-500', 
      bg: 'bg-blue-500/10' 
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, idx) => (
        <div key={idx} className="bg-[#111111] p-5 rounded-2xl border border-white/5 group hover:border-[#c6a34f]/30 transition-all duration-500">
          <div className="flex justify-between items-start mb-4">
            <div className={`p-2.5 rounded-xl ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform`}>
              <stat.icon size={22} />
            </div>
            <span className="text-xs font-black text-white/30 uppercase tracking-[0.2em]">SESSÃO</span>
          </div>
          <div>
            <h4 className="text-xs md:text-[13px] uppercase tracking-widest text-zinc-400 mb-1.5 font-bold">{stat.label}</h4>
            <div className="flex items-baseline gap-2">
               <span className="text-2xl md:text-3xl font-black tracking-tight text-white">{stat.value}</span>
               <div className={`flex items-center ${stat.trendColor} text-xs font-black uppercase tracking-tighter`}>
                  <stat.trendIcon size={12} className="mr-1" /> {stat.trend}
               </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatsCards;
