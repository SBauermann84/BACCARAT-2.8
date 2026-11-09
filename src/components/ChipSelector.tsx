import React from 'react';
import { Coins, Check } from 'lucide-react';
import { motion } from 'motion/react';

export interface ChipOption {
  value: number;
  label: string;
  colorClass: string;
  borderClass: string;
  glowClass: string;
  textClass: string;
}

export const CHIP_VALUES: ChipOption[] = [
  {
    value: 1.00,
    label: '1,00',
    colorClass: 'bg-gradient-to-b from-stone-100 to-stone-300',
    borderClass: 'border-amber-500/80',
    glowClass: 'shadow-[0_0_12px_rgba(255,255,255,0.25)]',
    textClass: 'text-stone-900 font-black'
  },
  {
    value: 5.00,
    label: '5,00',
    colorClass: 'bg-gradient-to-b from-rose-600 to-rose-800',
    borderClass: 'border-rose-300/80',
    glowClass: 'shadow-[0_0_12px_rgba(225,29,72,0.35)]',
    textClass: 'text-white font-black'
  },
  {
    value: 10.00,
    label: '10,00',
    colorClass: 'bg-gradient-to-b from-blue-600 to-blue-800',
    borderClass: 'border-blue-300/80',
    glowClass: 'shadow-[0_0_12px_rgba(37,99,235,0.35)]',
    textClass: 'text-white font-black'
  },
  {
    value: 25.00,
    label: '25,00',
    colorClass: 'bg-gradient-to-b from-emerald-600 to-emerald-800',
    borderClass: 'border-emerald-300/80',
    glowClass: 'shadow-[0_0_12px_rgba(16,185,129,0.35)]',
    textClass: 'text-white font-black'
  },
  {
    value: 125.00,
    label: '125,00',
    colorClass: 'bg-gradient-to-b from-zinc-800 to-black',
    borderClass: 'border-amber-400',
    glowClass: 'shadow-[0_0_14px_rgba(245,158,11,0.4)]',
    textClass: 'text-amber-400 font-black'
  },
  {
    value: 500.00,
    label: '500,00',
    colorClass: 'bg-gradient-to-b from-purple-700 to-purple-950',
    borderClass: 'border-purple-300',
    glowClass: 'shadow-[0_0_14px_rgba(168,85,247,0.4)]',
    textClass: 'text-purple-200 font-black'
  }
];

interface ChipSelectorProps {
  currentValue: number;
  onSelectChip: (value: number) => void;
  title?: string;
  showIcon?: boolean;
  compact?: boolean;
  className?: string;
}

export const ChipSelector: React.FC<ChipSelectorProps> = ({
  currentValue,
  onSelectChip,
  title = "Selecionar Ficha (Aposta Base)",
  showIcon = true,
  compact = false,
  className = ""
}) => {
  return (
    <div className={`space-y-2.5 ${className}`}>
      {title && (
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-[#c6a34f] flex items-center gap-1.5">
            {showIcon && <Coins size={14} className="text-[#c6a34f]" />}
            {title}
          </label>
          <span className="text-[10px] font-mono font-bold text-white/50">
            Ficha Ativa: <strong className="text-[#c6a34f] font-mono">R$ {(currentValue || 0).toFixed(2).replace('.', ',')}</strong>
          </span>
        </div>
      )}

      {/* Casino Chip Buttons Container */}
      <div className={`grid grid-cols-3 sm:grid-cols-6 gap-2 ${compact ? 'gap-1.5' : 'gap-2.5'}`}>
        {CHIP_VALUES.map((chip) => {
          const isSelected = Math.abs(currentValue - chip.value) < 0.005;

          return (
            <motion.button
              type="button"
              key={chip.value}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.93 }}
              onClick={() => onSelectChip(chip.value)}
              className={`
                relative flex flex-col items-center justify-center
                rounded-full transition-all duration-200 cursor-pointer select-none
                border-2 ${chip.borderClass} ${chip.colorClass}
                ${compact ? 'py-2 px-1 h-12' : 'py-2.5 px-1.5 h-14 md:h-16'}
                ${isSelected 
                  ? `${chip.glowClass} ring-2 ring-white ring-offset-2 ring-offset-[#050505] scale-105 font-black z-10` 
                  : 'opacity-85 hover:opacity-100 hover:shadow-lg'}
              `}
              title={`Selecionar ficha de R$ ${chip.label}`}
            >
              {/* Dashed Inner Casino Ring */}
              <div className="absolute inset-1 rounded-full border border-dashed border-white/40 pointer-events-none" />

              {/* Selected Checkmark Badge */}
              {isSelected && (
                <div className="absolute -top-1 -right-1 bg-[#c6a34f] text-black rounded-full p-0.5 shadow-md">
                  <Check size={10} strokeWidth={3} />
                </div>
              )}

              {/* Currency Symbol */}
              <span className={`text-[8px] uppercase tracking-wider block opacity-70 leading-none ${chip.textClass}`}>
                R$
              </span>

              {/* Value Label */}
              <span className={`font-mono leading-tight tracking-tight ${compact ? 'text-xs' : 'text-xs md:text-sm'} ${chip.textClass}`}>
                {chip.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
