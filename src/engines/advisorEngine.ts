import { GameResult, Bankroll, ManagementMode } from '../types';

export interface SessionMetrics {
  volatilityScore: number; // 0 to 100
  volatilityLabel: 'Baixa' | 'Média' | 'Alta' | 'Extrema';
  lossStreak: number;
  winStreak: number;
  winRate: number;
  drawdown: number;
  recoveryStress: 'Baixo' | 'Moderado' | 'Alto' | 'Crítico';
  recommendations: string[];
}

/**
 * Calculates current session metrics and generates intelligent rule-based suggestions.
 * This runs 100% offline inside the client browser.
 */
export function analyzeSessionOffline(
  history: GameResult[],
  bankroll: Bankroll & { management?: { mode: ManagementMode; initialBet: number } },
  currentLevel: number = 0
): SessionMetrics {
  const safeHistory = Array.isArray(history) ? history : [];
  const initialBalance = bankroll?.initialBalance || 1000;
  const balance = bankroll?.balance || 1000;
  const stopLoss = bankroll?.stopLoss || 100;
  const stopWin = bankroll?.stopWin || 200;
  const drawdown = bankroll?.drawdown || 0;
  
  // Calculate win rate of the active history
  const totalRounds = safeHistory.length;
  const wins = safeHistory.filter(h => h.isWin === true).length;
  const winRate = totalRounds > 0 ? (wins / totalRounds) * 100 : 0;

  // Calculate loss/win streaks
  let lossStreak = 0;
  let winStreak = 0;
  
  // We scan the history backwards to find current running streaks
  let currentLossStreak = 0;
  let currentWinStreak = 0;
  let lossBroken = false;
  let winBroken = false;

  for (let i = safeHistory.length - 1; i >= 0; i--) {
    const r = safeHistory[i];
    if (r.isWin === false) {
      if (!lossBroken) currentLossStreak++;
      winBroken = true;
    } else if (r.isWin === true) {
      if (!winBroken) currentWinStreak++;
      lossBroken = true;
    }
  }
  lossStreak = currentLossStreak;
  winStreak = currentWinStreak;

  // Calculate Volatility Score (based on result switches and drawdown changes in last 12 rounds)
  let volatilityScore = 0;
  const recentRounds = safeHistory.slice(-12);
  if (recentRounds.length >= 4) {
    let switches = 0;
    for (let i = 1; i < recentRounds.length; i++) {
      if (recentRounds[i].isWin !== recentRounds[i - 1].isWin) {
        switches++;
      }
    }
    const switchRatio = switches / (recentRounds.length - 1);
    
    // Switch ratio translates directly into a baseline volatility (high alternation = high volatility)
    volatilityScore = switchRatio * 70;

    // Add factor for high stakes or drawdown acceleration
    if (drawdown > 10) volatilityScore += 15;
    if (lossStreak >= 3) volatilityScore += 15;
    
    volatilityScore = Math.min(100, Math.max(0, Math.round(volatilityScore)));
  } else {
    // Low history, default to baseline
    volatilityScore = drawdown > 5 ? 35 : 15;
  }

  let volatilityLabel: 'Baixa' | 'Média' | 'Alta' | 'Extrema' = 'Baixa';
  if (volatilityScore >= 75) volatilityLabel = 'Extrema';
  else if (volatilityScore >= 50) volatilityLabel = 'Alta';
  else if (volatilityScore >= 25) volatilityLabel = 'Média';

  // Recovery Stress Level
  let recoveryStress: 'Baixo' | 'Moderado' | 'Alto' | 'Crítico' = 'Baixo';
  if (currentLevel >= 4 || drawdown >= 15) {
    recoveryStress = 'Crítico';
  } else if (currentLevel >= 2 || drawdown >= 8) {
    recoveryStress = 'Alto';
  } else if (currentLevel >= 1 || drawdown >= 4) {
    recoveryStress = 'Moderado';
  }

  // Generate contextual recommendations
  const recommendations: string[] = [];

  // General Status Check
  const netProfit = balance - initialBalance;
  
  if (netProfit >= stopWin) {
    recommendations.push("Meta de Stop Win atingida! Pare imediatamente para garantir seus lucros e evitar a devolução emocional.");
  } else if (initialBalance - balance >= stopLoss) {
    recommendations.push("Limite de Stop Loss atingido! Desligue os motores de apostas, analise o histórico com calma e retorne em outra sessão.");
  }

  // 1. Volatility Tips
  if (volatilityLabel === 'Extrema' || volatilityLabel === 'Alta') {
    recommendations.push("ALTA VOLATILIDADE DETECTADA: O mercado está alternando resultados muito rapidamente. Evite novas entradas agressivas agora para conter a exposição desnecessária.");
    recommendations.push("Ajuste suas estratégias de cobertura ou reduza a aposta inicial para o mínimo possível para absorver oscilações.");
  } else if (volatilityLabel === 'Baixa' && totalRounds >= 8) {
    recommendations.push("Volatilidade Baixa/Estável: Tendências consistentes detectadas. É um ótimo momento para seguir estratégias de ciclos ou de mão fixa moderada.");
  }

  // 2. Streaks Tips
  if (lossStreak >= 3) {
    recommendations.push(`Sequência de ${lossStreak} derrotas seguidas. Cuidado com o efeito de 'tilt' emocional. Se estiver usando Martingale, limite as dobras.`);
    recommendations.push("Considere pausar por 2 rodadas completas para 'limpar' o histórico mental antes de nova entrada.");
  }
  if (winStreak >= 4) {
    recommendations.push(`Sequência fantástica de ${winStreak} vitórias! Seus lucros estão protegidos. Mantenha a cautela: não aumente a aposta base motivado por falsa autoconfiança.`);
  }

  // 3. Recovery Stress Tips
  if (recoveryStress === 'Crítico' || recoveryStress === 'Alto') {
    recommendations.push(`Nível de recuperação elevado (Nível ${currentLevel}). O risco de quebra parcial por sequências prolongadas aumentou significativamente.`);
    recommendations.push("Redefina o ciclo de progressão de perdas caso a próxima rodada não resulte em vitória, salvaguardando a banca remanescente.");
  }

  // 4. Drawdown Tips
  if (drawdown >= 12) {
    recommendations.push(`Drawdown de ${drawdown.toFixed(1)}% é preocupante. Reduza o valor das suas entradas para 50% ou mude para o perfil Conservador.`);
  }

  // 5. REGRESSÃO À MÉDIA (Mean Reversion) - Análise de Sustentabilidade de Amostragem
  if (totalRounds >= 15) {
    if (winRate > 83) {
      recommendations.push(`REGRESSÃO À MÉDIA ALERTA: Sua taxa de acerto atual de ${winRate.toFixed(1)}% está excepcionalmente alta. Estatisticamente, essa taxa tende a convergir para a média natural em sessões longas. Considere fechar a sessão com lucro agora para garantir a meta superior a 80%.`);
    } else if (winRate < 45) {
      recommendations.push(`Regressão à Média (Recuperação): A assertividade atual de ${winRate.toFixed(1)}% está muito abaixo do esperado. A Lei dos Grandes Números sugere uma fase de compensação e recuperação em breve. Mantenha a calma, use o MODO SNIPER, e entre apenas em sinais de confluência ★★★★★.`);
    }
  }

  // 6. CRITÉRIO DE KELLY (Kelly Criterion) - Dimensionamento de Lote Científico
  if (totalRounds >= 10 && winRate > 50) {
    const p = winRate / 100;
    // Para chances simples (Payout 1:1), Fração de Kelly = 2p - 1. Usamos Kelly Fracionário (Half-Kelly) para ser ultra seguro
    const kellyFraction = (2 * p - 1) * 0.5;
    if (kellyFraction > 0) {
      const suggestedStake = Math.round(balance * kellyFraction * 0.1); // 10% do limite de Kelly para segurança absoluta
      const formattedStake = suggestedStake > 0 ? suggestedStake : bankroll.management?.initialBet || 10;
      recommendations.push(`CRITÉRIO DE KELLY: Com base na sua assertividade de ${winRate.toFixed(1)}%, a fração ótima de aporte científico para chances simples (Half-Kelly) seria de ${(kellyFraction * 100).toFixed(1)}% do seu limite de perda. Sugestão de entrada segura calculada: R$ ${formattedStake} por sinal.`);
    }
  }

  // If no negative recommendations, add positive reinforcement
  if (recommendations.length === 0) {
    recommendations.push("Sua sessão está extremamente estável. Continue operando com disciplina, seguindo estritamente a aposta base programada.");
    recommendations.push("Monitore a proximidade do seu Stop Win para realizar lucros de forma profissional.");
  }

  return {
    volatilityScore,
    volatilityLabel,
    lossStreak,
    winStreak,
    winRate,
    drawdown,
    recoveryStress,
    recommendations
  };
}
