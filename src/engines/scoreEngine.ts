import { SignalType } from '../types';
import { SCORE_WEIGHTS } from '../constants';

export const calculateScore = (analysis: any, history: any[]) => {
  if (history.length < 5) return 60; // Baseline score
  
  const sample = history.slice(0, 5);
  if (sample.length === 0) return 0;

  let alignmentPoints = 0;
  
  // Generic result frequency check (works for any game)
  if (analysis.result || analysis.num !== undefined) {
    const targetResult = analysis.result || analysis.num;
    const freq = sample.filter(h => h.result === targetResult).length;
    alignmentPoints += (freq / sample.length) * 50;
  }

  // Roulette specific fields
  if (analysis.color) {
    const colorFreq = sample.filter(h => h.metadata?.color === analysis.color).length;
    alignmentPoints += (colorFreq / sample.length) * 20;
  }
  
  if (analysis.dozen) {
    const dozenFreq = sample.filter(h => h.metadata?.dozen === analysis.dozen).length;
    alignmentPoints += (dozenFreq / sample.length) * 15;
  }

  if (analysis.terminal !== undefined) {
    const terminalFreq = sample.filter(h => h.metadata?.terminal === analysis.terminal).length;
    alignmentPoints += (terminalFreq / sample.length) * 15;
  }
  
  // Baseline + alignment
  const finalScore = Math.min(Math.floor(alignmentPoints + 50), 99);
  
  return finalScore;
};

export const generateSignal = (score: number, confidence: number) => {
  if (score > 85) return { type: SignalType.STRONG, message: "Entrada Forte" };
  if (score > 65) return { type: SignalType.MODERATE, message: "Entrada Moderada" };
  if (score > 40) return { type: SignalType.RISKY, message: "Entrada Arriscada" };
  return { type: SignalType.NO_ENTRY, message: "Não Entrar" };
};
