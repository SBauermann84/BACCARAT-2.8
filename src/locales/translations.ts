import { useAppStore } from '../store/useAppStore';

export const translations: Record<string, Record<string, string>> = {
  'pt-BR': {
    // Menu / Sidebar
    'menu.management': 'Gerenciamento',
    'menu.roulette': 'Roleta AI',
    'menu.baccarat': 'Baccarat AI',
    'menu.strategies': 'Estratégias',
    'menu.backtest': 'Backtest',
    'menu.manual': 'Manual',
    'menu.settings': 'Configurações',
    
    // Header / Layout
    'header.title': 'Casino Pattern',
    'header.subtitle': 'Statistics AI v1.0',
    'header.offline': 'MODO OFFLINE',
    
    // Bankroll Screen
    'bankroll.title': 'Gestão de Banca & Operação',
    'bankroll.subtitle': 'Configure seus limites e estratégias de aposta automática',
    'bankroll.initial': 'Banca Inicial',
    'bankroll.current': 'Saldo Atual',
    'bankroll.stopWin': 'Stop Win',
    'bankroll.stopLoss': 'Stop Loss',
    
    // Stats Cards
    'stats.balance': 'Saldo Total',
    'stats.growth': 'Crescimento',
    'stats.target': 'Meta de Stop Win',
    'stats.limit': 'Redução Máxima (D.D)',
    'stats.netprofit': 'Lucro Líquido',
    'stats.maxdrawdown': 'Drawdown Máximo',
    'stats.sessionassertiveness': 'Assertividade Sessão',
    'stats.precisionscore': 'Score de Precisão',
    
    // Settings Screen
    'settings.title': 'Configurações do Sistema',
    'settings.subtitle': 'Personalize sua experiência e segurança',
    'settings.preferences': 'Preferências',
    'settings.allNotifications': 'Todas as Notificações',
    'settings.allNotifications.desc': 'Controle geral de bipes, alertas de sinais e limites de Stop Win/Loss',
    'settings.notifications': 'Notificações Sonoras',
    'settings.notifications.desc': 'Alertas em novos sinais e entradas fortes',
    'settings.soundAlerts': 'Bip do Mapa de Calor',
    'settings.soundAlerts.desc': 'Sinal sonoro curto quando alertas de frequência atingirem limites',
    'settings.compact': 'Modo Compacto',
    'settings.compact.desc': 'Otimiza a visualização para telas menores',
    'settings.extremeNightMode': 'Modo Noturno Extremo',
    'settings.extremeNightMode.desc': 'Desativa 100% das transições e animações (CSS e Framer Motion). Aplica fundo preto absoluto (OLED) para economizar bateria em celulares.',
    'settings.autoreset': 'Reset Automático',
    'settings.autoreset.desc': 'Limpa histórico ao atingir Stop Loss/Win',
    'settings.fontSize': 'Tamanho da Fonte / Leitura',
    'settings.fontSize.desc': 'Ajuste a escala das letras em todas as abas e painéis do app para evitar desfoque e facilitar a leitura.',
    'settings.fontSize.small': 'Pequeno (14px)',
    'settings.fontSize.normal': 'Padrão (16px)',
    'settings.fontSize.large': 'Grande (18px)',
    'settings.fontSize.xlarge': 'Extra Grande (20px)',
    'settings.autoPause': 'Auto-Pause (Bloqueio)',
    'settings.autoPause.desc': 'Bloqueia novos lançamentos e botões ao atingir Stop Win ou Stop Loss',
    'settings.stopVisualAlerts': 'Efeito Visual de Stop Win / Stop Loss',
    'settings.stopVisualAlerts.desc': 'Muda a coloração frontal e ilumina a tela em verde (Stop Win) ou vermelho (Stop Loss)',
    'settings.sniperMode': 'Modo Sniper (Filtro Superior)',
    'settings.sniperMode.desc': 'Eleva o filtro de assertividade mínima exigida das estratégias IA de 60% para 78% para obter entradas cirúrgicas de alta precisão.',
    'settings.entropyFilter': 'Filtro de Entropia (Estabilidade)',
    'settings.entropyFilter.desc': 'Monitora o nível de ruído e dispersão estatística e bloqueia sinais se a mesa entrar em oscilação aleatória ou caótica.',
    'settings.defaultBacktestInstant': 'Backtest Instantâneo por Padrão',
    'settings.defaultBacktestInstant.desc': 'Executa simulações instantaneamente pulando as animações passo a passo por padrão',
    'settings.backtestRoulette': 'Limite de Backtest (Roleta)',
    'settings.backtestBaccarat': 'Limite de Backtest (Baccarat)',
    'settings.results': 'resultados',
    'settings.currency': 'Moeda Padrão',
    'settings.regional': 'Conectividade & Dados',
    'settings.dbInfo': 'As configurações de banco de dados e autenticação são gerenciadas automaticamente pelo sistema Cloud Run & Supabase.',
    'settings.security': 'Segurança de Dados',
    'settings.security.desc': 'Seus dados de sessão e estratégias são armazenados localmente e criptografados conforme as normas de segurança do Casino Pattern AI.',
    'settings.resetZone': 'Zona de Reset',
    'settings.resetSure': 'Tem Certeza? Clique de Novo',
    'settings.resetBtn': 'Reset App',
    'settings.languageSelect': 'Idioma do Sistema',
    
    // Common terms
    'term.win': 'Vitória',
    'term.loss': 'Derrota',
    'term.gale': 'Gale',
    'term.level': 'Nível',
    'term.profile': 'Perfil',
    'term.currency.brl': 'Real (BRL)',
    'term.currency.usd': 'Dólar (USD)',
    'term.currency.eur': 'Euro (EUR)',

    // Advice translation keys
    'advice.title': 'Painel de Aconselhamento de Risco & Gestão',
    'advice.subtitle': 'Recomendador inteligente baseado no comportamento do seu saldo em tempo real',
    'advice.status.safe': 'SEGURO',
    'advice.status.warning': 'ALERTA',
    'advice.status.danger': 'CRÍTICO',
    'advice.status.action': 'RECOMENDAÇÃO',
    'advice.safe.stable': 'Todas as métricas operacionais estão estáveis e dentro do planejado. Siga à risca os limites de entrada e mantenha a disciplina.',
    'advice.stop_loss.near': 'Stop Loss Próximo: Você está perto de atingir o limite de perdas. Considere pausar a sessão para proteger seu capital e evitar o overtrading emocional.',
    'advice.stop_win.near': 'Meta de Stop Win Próxima! Você está bem perto do seu objetivo de lucro. Considere consolidar seus ganhos e encerrar a sessão vitoriosa hoje.',
    'advice.stop_loss.hit': 'Stop Loss Atingido! Limites de proteção foram ativados. É hora de parar imediatamente e analisar suas estratégias de roleta/baccarat antes de nova sessão.',
    'advice.stop_win.hit': 'Meta de Stop Win Atingida! Desempenho fantástico. Pare a operação por hoje para evitar a devolução de lucros e garantir os dividendos obtidos.',
    'advice.drawdown.high': 'Drawdown Alto Detectado: A redução máxima da banca atingiu {val}%. Reduza o tamanho da aposta para preservar o saldo restante.',
    'advice.profile.high': 'Perfil Agressivo Ativo: Sua margem de oscilação está elevada. Mantenha cautela em sequências longas de Gale.',
  },
  'en': {
    // Menu / Sidebar
    'menu.management': 'Management',
    'menu.roulette': 'Roulette AI',
    'menu.baccarat': 'Baccarat AI',
    'menu.strategies': 'Strategies',
    'menu.backtest': 'Backtest',
    'menu.manual': 'Manual',
    'menu.settings': 'Settings',
    
    // Header / Layout
    'header.title': 'Casino Pattern',
    'header.subtitle': 'Statistics AI v1.0',
    'header.offline': 'OFFLINE MODE',
    
    // Bankroll Screen
    'bankroll.title': 'Bankroll Management & Operations',
    'bankroll.subtitle': 'Configure your thresholds and automatic betting strategies',
    'bankroll.initial': 'Initial Bankroll',
    'bankroll.current': 'Current Balance',
    'bankroll.stopWin': 'Stop Win',
    'bankroll.stopLoss': 'Stop Loss',
    
    // Stats Cards
    'stats.balance': 'Total Balance',
    'stats.growth': 'Growth',
    'stats.target': 'Stop Win Goal',
    'stats.limit': 'Max Drawdown (D.D)',
    'stats.netprofit': 'Net Profit',
    'stats.maxdrawdown': 'Max Drawdown',
    'stats.sessionassertiveness': 'Session Accuracy',
    'stats.precisionscore': 'Precision Score',
    
    // Settings Screen
    'settings.title': 'System Settings',
    'settings.subtitle': 'Customize your experience and security',
    'settings.preferences': 'Preferences',
    'settings.allNotifications': 'All Notifications',
    'settings.allNotifications.desc': 'Global control of sound alerts, signals, and Stop Win/Loss limits',
    'settings.notifications': 'Sound Notifications',
    'settings.notifications.desc': 'Alerts on new signals and high-confidence entries',
    'settings.soundAlerts': 'Heatmap Sound Beep',
    'settings.soundAlerts.desc': 'Short audio signal when frequency limits are reached',
    'settings.compact': 'Compact Mode',
    'settings.compact.desc': 'Optimizes user interface for smaller displays',
    'settings.extremeNightMode': 'Extreme Night Mode',
    'settings.extremeNightMode.desc': 'Disables 100% of CSS/Framer Motion animations & transitions. Applies absolute black (OLED) backgrounds to save battery on mobile devices.',
    'settings.autoreset': 'Auto Reset',
    'settings.autoreset.desc': 'Clears session history upon reaching Stop Loss/Win',
    'settings.fontSize': 'Font Size / Readability',
    'settings.fontSize.desc': 'Adjust text size across all tabs and panels to eliminate blur and enhance legibility.',
    'settings.fontSize.small': 'Small (14px)',
    'settings.fontSize.normal': 'Standard (16px)',
    'settings.fontSize.large': 'Large (18px)',
    'settings.fontSize.xlarge': 'Extra Large (20px)',
    'settings.autoPause': 'Auto-Pause (Lockout)',
    'settings.autoPause.desc': 'Locks new entries and inputs on reaching Stop Win or Stop Loss',
    'settings.stopVisualAlerts': 'Stop Win / Stop Loss Visual Alert Effect',
    'settings.stopVisualAlerts.desc': 'Dynamically illuminates the front screen in green (Stop Win) or red (Stop Loss)',
    'settings.defaultBacktestInstant': 'Default Instant Backtest',
    'settings.defaultBacktestInstant.desc': 'Executes backtests instantly bypassing step-by-step animations by default',
    'settings.backtestRoulette': 'Backtest Limit (Roulette)',
    'settings.backtestBaccarat': 'Backtest Limit (Baccarat)',
    'settings.results': 'results',
    'settings.currency': 'Default Currency',
    'settings.regional': 'Connectivity & Data',
    'settings.dbInfo': 'Database and authentication configurations are managed automatically by Cloud Run & Supabase systems.',
    'settings.security': 'Data Security',
    'settings.security.desc': 'Your session data and strategies are stored locally and encrypted according to Casino Pattern AI compliance.',
    'settings.resetZone': 'Reset Zone',
    'settings.resetSure': 'Are you sure? Click again',
    'settings.resetBtn': 'Reset App',
    'settings.languageSelect': 'System Language',
    
    // Common terms
    'term.win': 'Win',
    'term.loss': 'Loss',
    'term.gale': 'Gale',
    'term.level': 'Level',
    'term.profile': 'Profile',
    'term.currency.brl': 'Real (BRL)',
    'term.currency.usd': 'Dollar (USD)',
    'term.currency.eur': 'Euro (EUR)',

    // Advice translation keys
    'advice.title': 'Risk Assessment & Management Board',
    'advice.subtitle': 'Smart advisory powered by your real-time balance fluctuations',
    'advice.status.safe': 'SAFE',
    'advice.status.warning': 'WARNING',
    'advice.status.danger': 'CRITICAL',
    'advice.status.action': 'ADVICE',
    'advice.safe.stable': 'All performance metrics are stable and on track. Stay strict with your entry criteria and keep your operational discipline.',
    'advice.stop_loss.near': 'Stop Loss Near: You are close to hitting your loss threshold. Consider pausing the session to protect your capital and avoid overtrading.',
    'advice.stop_win.near': 'Stop Win Target Near! You are very close to your profit target. Consider consolidating your gains and ending a winning session today.',
    'advice.stop_loss.hit': 'Stop Loss Reached! Protection margins have been activated. It is time to stop immediately and review your roulette/baccarat rules before resuming.',
    'advice.stop_win.hit': 'Stop Win Target Reached! Fantastic performance. Stop operating for today to prevent profit clawback and guarantee your earnings.',
    'advice.drawdown.high': 'High Drawdown Detected: Your drawdown level reached {val}%. Reduce bet sizing to safeguard your remaining reserves.',
    'advice.profile.high': 'Aggressive Profile Active: Your volatility exposure is high. Keep extreme caution on long Martingale sequences.',
  },
  'es': {
    // Menu / Sidebar
    'menu.management': 'Gestión',
    'menu.roulette': 'Ruleta AI',
    'menu.baccarat': 'Baccarat AI',
    'menu.strategies': 'Estrategias',
    'menu.backtest': 'Backtest',
    'menu.manual': 'Manual',
    'menu.settings': 'Configuraciones',
    
    // Header / Layout
    'header.title': 'Casino Pattern',
    'header.subtitle': 'Statistics AI v1.0',
    'header.offline': 'MODO OFFLINE',
    
    // Bankroll Screen
    'bankroll.title': 'Gestión de Banca y Operaciones',
    'bankroll.subtitle': 'Configure sus límites y estrategias de apuestas automáticas',
    'bankroll.initial': 'Banca Inicial',
    'bankroll.current': 'Saldo Actual',
    'bankroll.stopWin': 'Stop Win',
    'bankroll.stopLoss': 'Stop Loss',
    
    // Stats Cards
    'stats.balance': 'Saldo Total',
    'stats.growth': 'Crecimiento',
    'stats.target': 'Meta de Stop Win',
    'stats.limit': 'Reducción Máxima (D.D)',
    'stats.netprofit': 'Lucro Neto',
    'stats.maxdrawdown': 'Drawdown Máximo',
    'stats.sessionassertiveness': 'Asertividad de Sesión',
    'stats.precisionscore': 'Puntaje de Precisión',
    
    // Settings Screen
    'settings.title': 'Configuración del Sistema',
    'settings.subtitle': 'Personalice su experiencia y seguridad',
    'settings.preferences': 'Preferencias',
    'settings.allNotifications': 'Todas las Notificaciones',
    'settings.allNotifications.desc': 'Control general de alertas sonoras, señales y límites de Stop Win/Loss',
    'settings.notifications': 'Notificaciones Sonoras',
    'settings.notifications.desc': 'Alertas sobre nuevas señales y entradas de confianza',
    'settings.soundAlerts': 'Bip del Mapa de Calor',
    'settings.soundAlerts.desc': 'Señal sonora corta cuando las alertas de frecuencia alcancen límites',
    'settings.compact': 'Modo Compacto',
    'settings.compact.desc': 'Optimiza la visualización para pantallas pequeñas',
    'settings.extremeNightMode': 'Modo Nocturno Extremo',
    'settings.extremeNightMode.desc': 'Desactiva el 100% de las transiciones y animaciones (CSS y Framer Motion). Aplica fondo negro absoluto (OLED) para ahorrar batería.',
    'settings.autoreset': 'Restablecimiento Automático',
    'settings.autoreset.desc': 'Limpia el historial al alcanzar Stop Loss/Win',
    'settings.autoPause': 'Auto-Pausa (Bloqueo)',
    'settings.autoPause.desc': 'Bloquea nuevos lanzamientos y botones al alcanzar Stop Win o Stop Loss',
    'settings.stopVisualAlerts': 'Efecto Visual de Stop Win / Stop Loss',
    'settings.stopVisualAlerts.desc': 'Cambia la coloración frontal e ilumina la pantalla en verde (Stop Win) o rojo (Stop Loss)',
    'settings.defaultBacktestInstant': 'Backtest Instantáneo por Defecto',
    'settings.defaultBacktestInstant.desc': 'Ejecuta simulaciones instantáneamente omitiendo las animaciones paso a paso por defecto',
    'settings.backtestRoulette': 'Límite de Backtest (Ruleta)',
    'settings.backtestBaccarat': 'Límite de Backtest (Baccarat)',
    'settings.results': 'resultados',
    'settings.currency': 'Moneda por Defecto',
    'settings.regional': 'Conectividad y Datos',
    'settings.dbInfo': 'La configuración de la base de datos y la autenticación se administra automáticamente mediante Cloud Run y Supabase.',
    'settings.security': 'Seguridad de Datos',
    'settings.security.desc': 'Sus datos de sesión y estrategias se almacenan localmente y se cifran según las normas de seguridad de Casino Pattern AI.',
    'settings.resetZone': 'Zona de Reset',
    'settings.resetSure': '¿Está seguro? Clic de nuevo',
    'settings.resetBtn': 'Reiniciar App',
    'settings.languageSelect': 'Idioma del Sistema',
    
    // Common terms
    'term.win': 'Victoria',
    'term.loss': 'Derrota',
    'term.gale': 'Gale',
    'term.level': 'Nivel',
    'term.profile': 'Perfil',
    'term.currency.brl': 'Real (BRL)',
    'term.currency.usd': 'Dólar (USD)',
    'term.currency.eur': 'Euro (EUR)',

    // Advice translation keys
    'advice.title': 'Panel de Asesoramiento de Riesgo y Gestión',
    'advice.subtitle': 'Recomenador inteligente basado en el comportamiento de su saldo en tiempo real',
    'advice.status.safe': 'SEGURO',
    'advice.status.warning': 'ALERTA',
    'advice.status.danger': 'CRÍTICO',
    'advice.status.action': 'RECOMENDACIÓN',
    'advice.safe.stable': 'Todas las métricas operativas están estables y dentro de lo previsto. Siga estrictamente los límites de entrada y mantenga la disciplina.',
    'advice.stop_loss.near': 'Stop Loss Cercano: Está cerca de alcanzar el límite de pérdidas. Considere pausar la sesión para proteger su capital y evitar el overtrading emocional.',
    'advice.stop_win.near': '¡Meta de Stop Win de Cerca! Está muy cerca de su objetivo de ganancias. Considere asegurar sus beneficios y terminar esta sesión con éxito hoy.',
    'advice.stop_loss.hit': '¡Stop Loss Alcanzado! Límites de protección activados. Es hora de detenerse de inmediato y analizar los registros de sus estrategias de ruleta/baccarat.',
    'advice.stop_win.hit': '¡Meta de Stop Win Alcanzada! Desempeño fantástico. Detenga la operación hoy para evitar devolver ganancias y asegurar el día.',
    'advice.drawdown.high': 'Drawdown Alto Detectado: La reducción máxima de la banca alcanzó el {val}%. Reduzca el tamaño de la apuesta para proteger el saldo restante.',
    'advice.profile.high': 'Perfil Agresivo Activo: Su margen de volatilidad de banca es alto. Mantenga extrema precaución en rachas largas de Gale.',
  },
  'zh': {
    // Menu / Sidebar
    'menu.management': '资金管理',
    'menu.roulette': 'AI 轮盘',
    'menu.baccarat': 'AI 百家乐',
    'menu.strategies': '策略配置',
    'menu.backtest': '历史回测',
    'menu.manual': '操作手册',
    'menu.settings': '系统设置',
    
    // Header / Layout
    'header.title': 'Casino Pattern',
    'header.subtitle': 'Statistics AI v1.0',
    'header.offline': '离线模式',
    
    // Bankroll Screen
    'bankroll.title': '资金与运营管理',
    'bankroll.subtitle': '配置您的阈值上限和主客观自动投注策略',
    'bankroll.initial': '初始资金',
    'bankroll.current': '当前余额',
    'bankroll.stopWin': '止盈线 (Stop Win)',
    'bankroll.stopLoss': '止损线 (Stop Loss)',
    
    // Stats Cards
    'stats.balance': '总资金余额',
    'stats.growth': '盈亏增长率',
    'stats.target': '止盈目标线',
    'stats.limit': '最大回撤限制',
    'stats.netprofit': '净利润',
    'stats.maxdrawdown': '最大回撤',
    'stats.sessionassertiveness': '会话胜率',
    'stats.precisionscore': '精确度评分',
    
    // Settings Screen
    'settings.title': '系统参数设置',
    'settings.subtitle': '个性化您的操作体验与安全合规',
    'settings.preferences': '偏好设置',
    'settings.allNotifications': '全部通知提醒',
    'settings.allNotifications.desc': '全局控制声音提醒、信号警报及止盈止损限制',
    'settings.notifications': '声音通知提醒',
    'settings.notifications.desc': '在新信号与高置信度进场点时播放音效',
    'settings.soundAlerts': '热力图越界蜂鸣器',
    'settings.soundAlerts.desc': '热力图频次达到预警极限时发出短音',
    'settings.compact': '流线精简模式',
    'settings.compact.desc': '优化小屏幕设备展现密度以提高操作流畅性',
    'settings.extremeNightMode': '极度夜间模式',
    'settings.extremeNightMode.desc': '禁用所有 CSS 和 Framer Motion 动画与过渡。应用纯黑背景（OLED）以节省移动设备电池消耗。',
    'settings.autoreset': '止损止盈全清理',
    'settings.autoreset.desc': '在触发止损线或止盈线上限时自动清空历史',
    'settings.autoPause': '自动暂停 (锁定防护)',
    'settings.autoPause.desc': '触发止盈或止损时，锁定全部输入和按钮操作',
    'settings.defaultBacktestInstant': '默认启动极速回测',
    'settings.defaultBacktestInstant.desc': '默认跳过回测时的步骤动画并直接输出最终分析结果',
    'settings.backtestRoulette': '轮盘回测容量上限',
    'settings.backtestBaccarat': '百家乐回测容量上限',
    'settings.results': '项记录',
    'settings.currency': '基础主结算货币',
    'settings.regional': '云链接与基础层',
    'settings.dbInfo': '数据库存储与用户统一登录态由 Cloud Run 和 Supabase 多高可用底座自动承接支撑。',
    'settings.security': '数据加密与安全说明',
    'settings.security.desc': '您的全部会话策略数据完全脱敏加密存放于浏览器独立物理沙盒中。',
    'settings.resetZone': '全局数据清零',
    'settings.resetSure': '确认操作？请再次双击执行',
    'settings.resetBtn': '重置系统',
    'settings.languageSelect': '系统默认语言',
    
    // Common terms
    'term.win': '胜/赢',
    'term.loss': '负/输',
    'term.gale': '追单 (Gale)',
    'term.level': '阶梯层级',
    'term.profile': '风险偏好',
    'term.currency.brl': '巴西雷亚尔 (BRL)',
    'term.currency.usd': '美元 (USD)',
    'term.currency.eur': '欧元 (EUR)',

    // Advice translation keys
    'advice.title': '风险评估与资金风控面板',
    'advice.subtitle': '基于实时余额波动行为的智能风控建议提示器',
    'advice.status.safe': '安全',
    'advice.status.warning': '警告',
    'advice.status.danger': '危险',
    'advice.status.action': '改善建议',
    'advice.safe.stable': '目前各项财务指标稳健，切合运营预期。请继续恪守入场细则，建立长效风控纪律。',
    'advice.stop_loss.near': '接近止损线：当前亏损幅度即将触底。强烈建议暂停交易以锁定剩余资金，避免陷入过度交易或情绪博弈波折。',
    'advice.stop_win.near': '即将达成止盈！距离本次止盈警戒目标已近在咫尺。强烈建议在盈利高点回收现金，守住已有胜果。',
    'advice.stop_loss.hit': '已触发止损防护！安全防护锁保护功能已启动。请立即停工，审视今日执行漏失并重整策略形态。',
    'advice.stop_win.hit': '止盈警戒达成！日内盘面分析实力展现得淋漓尽致。请立刻收手，以防庄家回噬吐出今日到手的红利。',
    'advice.drawdown.high': '检测到超负重最大回撤：累计最大回撤已冲至 {val}%。建议收缩单笔投入比例，以护卫账户本金安全。',
    'advice.profile.high': '已启用激进型策略配置：当前承受波幅区间显现显著波动，多倍追单（Gale）情景下更需高度审慎。',
  },
  'ru': {
    // Menu / Sidebar
    'menu.management': 'Управление',
    'menu.roulette': 'Рулетка AI',
    'menu.baccarat': 'Баккара AI',
    'menu.strategies': 'Стратегии',
    'menu.backtest': 'Бэктест',
    'menu.manual': 'Инструкция',
    'menu.settings': 'Настройки',
    
    // Header / Layout
    'header.title': 'Casino Pattern',
    'header.subtitle': 'Statistics AI v1.0',
    'header.offline': 'АВТОНОМНЫЙ РЕЖИМ',
    
    // Bankroll Screen
    'bankroll.title': 'Управление балансом и сессиями',
    'bankroll.subtitle': 'Настройте лимиты и схемы автоматических прогнозов',
    'bankroll.initial': 'Стартовый Банк',
    'bankroll.current': 'Текущий Баланс',
    'bankroll.stopWin': 'Стоп-Вин',
    'bankroll.stopLoss': 'Стоп-Лосс',
    
    // Stats Cards
    'stats.balance': 'Общий Баланс',
    'stats.growth': 'Рост баланса',
    'stats.target': 'Целевая прибыль',
    'stats.limit': 'Макс. Просадка (D.D)',
    'stats.netprofit': 'Чистая прибыль',
    'stats.maxdrawdown': 'Макс. просадка',
    'stats.sessionassertiveness': 'Точность сессии',
    'stats.precisionscore': 'Индекс точности',
    
    // Settings Screen
    'settings.title': 'Системные Настройки',
    'settings.subtitle': 'Индивидуальная адаптация интерфейса и безопасности',
    'settings.preferences': 'Параметры',
    'settings.allNotifications': 'Все уведомления',
    'settings.allNotifications.desc': 'Общий контроль звуковых оповещений, сигналов и лимитов Стоп-Вин/Лосс',
    'settings.notifications': 'Звуковые Сигналы',
    'settings.notifications.desc': 'Звуковое оповещение о сильных сигналах',
    'settings.soundAlerts': 'Тон тепловой карты',
    'settings.soundAlerts.desc': 'Звуковая индикация пиков частотности',
    'settings.compact': 'Компактный Вид',
    'settings.compact.desc': 'Оптимизация размеров для мобильных устройств',
    'settings.extremeNightMode': 'Экстремальный Ночной Режим',
    'settings.extremeNightMode.desc': 'Отключает 100% анимаций и переходов (CSS и Framer Motion). Применяет абсолютно черный фон (OLED) для экономии батареи.',
    'settings.autoreset': 'Авто-сброс сессии',
    'settings.autoreset.desc': 'Очищать сессию при фиксации лимитов потерь или побед',
    'settings.autoPause': 'Авто-Пауза (Блокировка)',
    'settings.autoPause.desc': 'Блокирует ввод новых результатов и кнопки при достижении Stop Win или Stop Loss',
    'settings.defaultBacktestInstant': 'Быстрый бэктест по умолчанию',
    'settings.defaultBacktestInstant.desc': 'Мгновенный запуск симуляций без пошаговой анимации по умолчанию',
    'settings.backtestRoulette': 'Лимит бэктеста рулетки',
    'settings.backtestBaccarat': 'Лимит бэктеста баккары',
    'settings.results': 'записей',
    'settings.currency': 'Валюта счета',
    'settings.regional': 'Связь и Синхронизация',
    'settings.dbInfo': 'Конфигурация инфраструктуры БД и токенов сессий обслуживается отказоустойчиво через Cloud Run и Supabase.',
    'settings.security': 'Конфиденциальность',
    'settings.security.desc': 'Все логи заходов и шаблоны хранятся зашифрованными в локальном хранилище песочницы браузера.',
    'settings.resetZone': 'Сброс Базы',
    'settings.resetSure': 'Вы уверены? Нажмите повторно',
    'settings.resetBtn': 'Сбросить базу',
    'settings.languageSelect': 'Язык Интерфейса',
    
    // Common terms
    'term.win': 'Выигрыш',
    'term.loss': 'Проигрыш',
    'term.gale': 'Мартингейл',
    'term.level': 'Транш',
    'term.profile': 'Профиль',
    'term.currency.brl': 'Реал (BRL)',
    'term.currency.usd': 'Доллар (USD)',
    'term.currency.eur': 'Евро (EUR)',

    // Advice translation keys
    'advice.title': 'Панель Контроля Потерь и Риск-Менеджмента',
    'advice.subtitle': 'Интеллектуальный рекомендатель на основе колебания вашего баланса в реальном времени',
    'advice.status.safe': 'БЕЗОПАСНО',
    'advice.status.warning': 'ВНИМАНИЕ',
    'advice.status.danger': 'КРИТИЧНО',
    'advice.status.action': 'РЕКОМЕНДАЦИЯ',
    'advice.safe.stable': 'Все операционные показатели стабильны и идут согласно плану. Строго придерживайтесь лимитов входа и сохраняйте игровую дисциплину.',
    'advice.stop_loss.near': 'Стоп-Лосс Близко: Вы близки к лимиту потерь. Рекомендуем сделать паузу в сессии ради сохранения эмоционального контроля и защиты средств.',
    'advice.stop_win.near': 'Стоп-Вин Близко! Вы очень близки к целевому выигрышу. Подумайте о сохранении прибыли и триумфальном завершении текущей сессии.',
    'advice.stop_loss.hit': 'Стоп-Лосс Достигнут! Защитные лимиты активированы. Настоятельно рекомендуем немедленно прекратить сессию и взвесить погрешности стратегий.',
    'advice.stop_win.hit': 'Целевой Стоп-Вин Достигнут! Отличная игра. Немедленно завершите сессию сегодня во избежание потерь и отката прибыли.',
    'advice.drawdown.high': 'Обнаружена Высокая Просадка: Максимальная просадка баланса составила {val}%. Уменьшите размеры ставок для сбережения резервов.',
    'advice.profile.high': 'Сессия в Агрессивном Профиле: Ваши настройки экспозиции риска высоки. Соблюдайте максимальную осторожность при длинных сериях Мартингейла.',
  },
};

export function useTranslation() {
  const { settings } = useAppStore();
  const lang = settings?.language || 'pt-BR';
  
  const t = (key: string, defaultValue?: string): string => {
    const langDict = translations[lang] || translations['pt-BR'];
    const text = langDict[key] || translations['pt-BR'][key] || defaultValue || key;
    return text;
  };

  const tEntry = (entry: string | undefined | null): string => {
    if (!entry) return '';
    const cleanEntry = entry.trim();
    
    const entryTranslations: Record<string, Record<string, string>> = {
      'pt-BR': {
        'odd': 'Ímpar',
        'even': 'Par',
        'red': 'Vermelho',
        'black': 'Preto',
        'high': 'Maior',
        'low': 'Menor',
        'player': 'Player',
        'banker': 'Banker',
        'tie': 'Empate',
        'p-pair': 'Par Player',
        'b-pair': 'Par Banker'
      },
      'en': {
        'odd': 'Odd',
        'even': 'Even',
        'red': 'Red',
        'black': 'Black',
        'high': 'High',
        'low': 'Low',
        'player': 'Player',
        'banker': 'Banker',
        'tie': 'Tie',
        'p-pair': 'P-Pair',
        'b-pair': 'B-Pair'
      },
      'es': {
        'odd': 'Impar',
        'even': 'Par',
        'red': 'Rojo',
        'black': 'Negro',
        'high': 'Alto',
        'low': 'Bajo',
        'player': 'Player',
        'banker': 'Banker',
        'tie': 'Empate',
        'p-pair': 'Pareja P',
        'b-pair': 'Pareja B'
      },
      'ru': {
        'odd': 'Нечетное',
        'even': 'Четное',
        'red': 'Красное',
        'black': 'Черное',
        'high': 'Больше',
        'low': 'Меньше',
        'player': 'Игрок',
        'banker': 'Банкир',
        'tie': 'Ничья',
        'p-pair': 'Пара Игрока',
        'b-pair': 'Пара Банкира'
      },
      'zh': {
        'odd': '单',
        'even': '双',
        'red': '红',
        'black': '黑',
        'high': '大',
        'low': '小',
        'player': '闲',
        'banker': '庄',
        'tie': '和',
        'p-pair': '闲对',
        'b-pair': '庄对'
      }
    };

    const targetLang = lang === 'pt-BR' || lang === 'en' || lang === 'es' || lang === 'ru' || lang === 'zh' ? lang : 'pt-BR';
    const dict = entryTranslations[targetLang] || entryTranslations['pt-BR'];
    
    const lowerKey = cleanEntry.toLowerCase();
    if (dict[lowerKey]) {
      return dict[lowerKey];
    }
    
    let translated = cleanEntry;
    Object.keys(entryTranslations['en']).forEach((enWord) => {
      const regex = new RegExp(`\\b${enWord}\\b`, 'gi');
      if (regex.test(translated)) {
        const replacement = dict[enWord] || enWord;
        translated = translated.replace(regex, replacement);
      }
    });

    return translated;
  };
  
  return { t, tEntry, lang };
}
