import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Download, 
  Smartphone, 
  Laptop, 
  CheckCircle2, 
  Share2, 
  Plus, 
  ShieldCheck, 
  HardDrive, 
  Zap,
  HelpCircle,
  ChevronDown,
  Info
} from 'lucide-react';
import { useTranslation } from '../locales/translations';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const PwaInstallWidget: React.FC = () => {
  const { t, lang } = useTranslation();
  
  const [deferredPrompt, setDeferredPrompt] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = React.useState<boolean>(false);
  const [installSuccess, setInstallSuccess] = React.useState<boolean>(false);
  const [activePlatformGuide, setActivePlatformGuide] = React.useState<'ios' | 'android' | 'desktop' | null>(null);

  React.useEffect(() => {
    // Detect if running as a standalone installed app
    const checkStandalone = () => {
      const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches 
        || (navigator as any).standalone 
        || document.referrer.includes('android-app://');
      setIsStandalone(isStandaloneMode);
    };

    checkStandalone();

    // Listen to standard PWA installation prompt hook
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    try {
      // Trigger prompt
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        console.log('[PWA] Usuário aceitou a instalação do aplicativo.');
        setInstallSuccess(true);
        setDeferredPrompt(null);
      } else {
        console.log('[PWA] Usuário cancelou a instalação do aplicativo.');
      }
    } catch (err) {
      console.error('[PWA] Erro ao disparar o prompt de instalação:', err);
    }
  };

  // Safe localized labels
  const getLabel = (key: string): string => {
    const labels: Record<string, Record<string, string>> = {
      pt: {
        title: 'Central de Instalação Offline',
        desc: 'Instale o Casino Pattern AI no seu dispositivo e opere com 100% de privacidade, ultra-velocidade e sem consumir dados de internet.',
        runningApp: 'Aplicativo Ativo & Instalado',
        runningDesc: 'Você está navegando pelo aplicativo oficial dedicado. O sistema está isolado na memória física do seu dispositivo.',
        localDb: 'Banco de Dados Local',
        localDbDesc: 'Sua banca e estratégias são salvas e calculadas localmente na memória Flash/SSD do seu aparelho.',
        offlineReady: 'Zero Consumo / 100% Offline',
        offlineReadyDesc: 'Todos os motores estatísticos de IA e simuladores de backtest rodam diretamente no processador local.',
        btnInstall: 'Instalar Aplicativo Oficial (1-Clique)',
        guideTitle: 'Seu navegador não suporta instalação automática?',
        guideDesc: 'Siga os guias rápidos de 5 segundos abaixo para instalar em qualquer dispositivo:',
        iosTitle: 'Instalar no iPhone / iPad (iOS)',
        iosStep1: 'Abra o menu de Compartilhamento do Safari (ícone 📤 na barra inferior).',
        iosStep2: 'Desça as opções e toque em "Adicionar à Tela de Início" (ícone ➕).',
        iosStep3: 'Clique em "Adicionar" no canto superior direito para finalizar.',
        androidTitle: 'Instalar no Android (Chrome / Samsung)',
        androidStep1: 'Toque nos 3 pontinhos verticalmente alinhados no canto superior direito.',
        androidStep2: 'Selecione "Adicionar à tela inicial" ou "Instalar aplicativo".',
        androidStep3: 'Confirme o download local na tela pop-up.',
        desktopTitle: 'Instalar no Computador (Windows / macOS)',
        desktopStep1: 'Clique no ícone de computador com seta de download ([🖥️↓]) na barra de URL superior.',
        desktopStep2: 'Ou abra o menu de 3 pontos do navegador e escolha "Instalar Casino Pattern AI".',
        verified: 'Instalação Concluída!',
        verifiedDesc: 'Agora você pode abrir o app diretamente pela sua Tela de Início ou Área de Trabalho.',
      },
      en: {
        title: 'Offline Installation Hub',
        desc: 'Install Casino Pattern AI on your device and operate with 100% privacy, ultra-speed, and without consuming internet data.',
        runningApp: 'App Active & Installed',
        runningDesc: 'You are browsing through the dedicated official app. The system is isolated within your device\'s physical memory.',
        localDb: 'Local Database',
        localDbDesc: 'Your bankroll and strategies are saved and calculated locally on your device\'s Flash/SSD storage.',
        offlineReady: 'Zero Data / 100% Offline',
        offlineReadyDesc: 'All statistical AI engines and backtest simulators run directly on your local CPU.',
        btnInstall: 'Install Official App (1-Click)',
        guideTitle: 'Browser doesn\'t support automatic installation?',
        guideDesc: 'Follow our 5-second quick guides below to install on any device:',
        iosTitle: 'Install on iPhone / iPad (iOS)',
        iosStep1: 'Open Safari\'s Share menu (📤 icon in the bottom bar).',
        iosStep2: 'Scroll down and tap "Add to Home Screen" (➕ icon).',
        iosStep3: 'Click "Add" in the top right corner to complete.',
        androidTitle: 'Install on Android (Chrome / Samsung)',
        androidStep1: 'Tap the 3 vertical dots in the top right corner of Chrome.',
        androidStep2: 'Select "Add to Home Screen" or "Install App".',
        androidStep3: 'Confirm the local download in the pop-up window.',
        desktopTitle: 'Install on PC / macOS (Chrome / Edge)',
        desktopStep1: 'Click the computer icon with a download arrow ([🖥️↓]) in the top URL bar.',
        desktopStep2: 'Or open the browser\'s 3-dot menu and select "Install Casino Pattern AI".',
        verified: 'Installation Completed!',
        verifiedDesc: 'You can now launch the app directly from your Home Screen or Desktop.',
      }
    };

    const isPt = lang === 'pt-BR' || lang === 'pt';
    const langKey = isPt ? 'pt' : 'en';
    return labels[langKey][key] || labels['en'][key] || key;
  };

  return (
    <div className="bg-[#0a0a0a] border border-[#c6a34f]/15 rounded-3xl p-6 lg:p-8 space-y-6 shadow-2xl overflow-hidden relative" id="pwa-install-container">
      {/* Golden Glowing Highlight Pattern */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#c6a34f]/5 rounded-full blur-[80px] -z-10 pointer-events-none"></div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-white/5">
        <div className="space-y-2 max-w-xl text-left">
          <div className="inline-flex items-center gap-2 bg-[#c6a34f]/10 text-[#c6a34f] px-3.5 py-1.5 rounded-full border border-[#c6a34f]/25 text-xs font-black uppercase tracking-wider">
            <ShieldCheck size={14} />
            <span>100% Offline & Local Storage</span>
          </div>
          <h3 className="text-xl lg:text-2xl font-black text-white tracking-tight">{getLabel('title')}</h3>
          <p className="text-zinc-400 text-xs lg:text-sm leading-relaxed">{getLabel('desc')}</p>
        </div>

        {/* Dynamic Status Badges */}
        <div className="flex flex-wrap gap-2 lg:flex-col lg:items-end shrink-0">
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold ${
            isStandalone 
              ? 'bg-green-500/10 border-green-500/30 text-green-400' 
              : 'bg-amber-500/10 border-amber-500/20 text-amber-500'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isStandalone ? 'bg-green-500 animate-pulse' : 'bg-amber-500 animate-pulse'}`}></span>
            <span>{isStandalone ? getLabel('runningApp') : 'Rodando em Navegador Web'}</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {isStandalone || installSuccess ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[#c6a34f]/5 border border-[#c6a34f]/20 rounded-2xl p-6 flex flex-col items-center text-center space-y-4"
        >
          <div className="w-16 h-16 bg-[#c6a34f]/10 border-2 border-[#c6a34f] rounded-full flex items-center justify-center text-[#c6a34f]">
            <CheckCircle2 size={36} className="animate-bounce" />
          </div>
          <div className="space-y-1">
            <h4 className="text-lg font-black text-white">{getLabel('verified')}</h4>
            <p className="text-zinc-300 text-xs max-w-md">{getLabel('runningDesc')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full pt-4 border-t border-[#c6a34f]/15 max-w-lg">
            <div className="flex items-start gap-3 text-left p-3.5 bg-black/40 rounded-xl border border-white/5">
              <HardDrive className="text-[#c6a34f] shrink-0 mt-0.5" size={16} />
              <div>
                <h5 className="text-xs font-bold text-white">{getLabel('localDb')}</h5>
                <p className="text-[10px] text-zinc-400 mt-1">{getLabel('localDbDesc')}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 text-left p-3.5 bg-black/40 rounded-xl border border-white/5">
              <Zap className="text-[#c6a34f] shrink-0 mt-0.5" size={16} />
              <div>
                <h5 className="text-xs font-bold text-white">{getLabel('offlineReady')}</h5>
                <p className="text-[10px] text-zinc-400 mt-1">{getLabel('offlineReadyDesc')}</p>
              </div>
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-6 text-left">
          {/* Direct Install Button (Visible on Chrome, Android, Edge, etc.) */}
          {deferredPrompt && (
            <div className="bg-gradient-to-r from-[#c6a34f]/15 to-[#a68233]/5 border border-[#c6a34f]/30 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
              <div className="space-y-1 text-center sm:text-left">
                <h4 className="text-sm font-black uppercase tracking-wider text-[#c6a34f] flex items-center gap-1.5 justify-center sm:justify-start">
                  <Download size={14} /> Instalação Automática Disponível
                </h4>
                <p className="text-xs text-zinc-300">Seu navegador permite salvar o aplicativo diretamente na sua área de trabalho com apenas 1 clique.</p>
              </div>
              <button
                onClick={handleInstallClick}
                className="w-full sm:w-auto px-6 py-3 bg-[#c6a34f] hover:bg-[#a68233] text-black font-black uppercase text-xs tracking-widest rounded-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-95 shadow-[0_0_20px_rgba(198,163,79,0.3)] flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download size={16} />
                <span>{getLabel('btnInstall')}</span>
              </button>
            </div>
          )}

          {/* Quick Step Guides Accordion */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-white/80">
              <HelpCircle size={16} className="text-[#c6a34f]" />
              <div className="text-xs font-black uppercase tracking-widest">{getLabel('guideTitle')}</div>
            </div>
            <p className="text-zinc-400 text-xs leading-relaxed">{getLabel('guideDesc')}</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* iOS Safari Guide Card */}
              <div 
                onClick={() => setActivePlatformGuide(activePlatformGuide === 'ios' ? null : 'ios')}
                className={`group border rounded-2xl p-4 transition-all duration-300 cursor-pointer ${
                  activePlatformGuide === 'ios' 
                    ? 'bg-[#c6a34f]/10 border-[#c6a34f]/50 shadow-md' 
                    : 'bg-zinc-900/40 border-white/5 hover:border-white/10 hover:bg-zinc-900/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-zinc-950 flex items-center justify-center text-zinc-400 group-hover:text-[#c6a34f] transition-colors">
                      <Smartphone size={16} />
                    </div>
                    <span className="text-xs font-bold text-white group-hover:text-[#c6a34f] transition-colors">{getLabel('iosTitle')}</span>
                  </div>
                  <ChevronDown size={14} className={`text-zinc-500 transition-transform duration-300 ${activePlatformGuide === 'ios' ? 'rotate-180 text-[#c6a34f]' : ''}`} />
                </div>
                
                <AnimatePresence initial={false}>
                  {activePlatformGuide === 'ios' && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden mt-3.5 pt-3.5 border-t border-white/5 space-y-2.5 text-xs text-zinc-300"
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-zinc-950 flex items-center justify-center text-[10px] font-mono font-bold text-[#c6a34f] shrink-0">1</span>
                        <p className="leading-relaxed">{getLabel('iosStep1')}</p>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-zinc-950 flex items-center justify-center text-[10px] font-mono font-bold text-[#c6a34f] shrink-0">2</span>
                        <p className="leading-relaxed">{getLabel('iosStep2')}</p>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-zinc-950 flex items-center justify-center text-[10px] font-mono font-bold text-[#c6a34f] shrink-0">3</span>
                        <p className="leading-relaxed">{getLabel('iosStep3')}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Android Guide Card */}
              <div 
                onClick={() => setActivePlatformGuide(activePlatformGuide === 'android' ? null : 'android')}
                className={`group border rounded-2xl p-4 transition-all duration-300 cursor-pointer ${
                  activePlatformGuide === 'android' 
                    ? 'bg-[#c6a34f]/10 border-[#c6a34f]/50 shadow-md' 
                    : 'bg-zinc-900/40 border-white/5 hover:border-white/10 hover:bg-zinc-900/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-zinc-950 flex items-center justify-center text-zinc-400 group-hover:text-[#c6a34f] transition-colors">
                      <Smartphone size={16} />
                    </div>
                    <span className="text-xs font-bold text-white group-hover:text-[#c6a34f] transition-colors">{getLabel('androidTitle')}</span>
                  </div>
                  <ChevronDown size={14} className={`text-zinc-500 transition-transform duration-300 ${activePlatformGuide === 'android' ? 'rotate-180 text-[#c6a34f]' : ''}`} />
                </div>
                
                <AnimatePresence initial={false}>
                  {activePlatformGuide === 'android' && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden mt-3.5 pt-3.5 border-t border-white/5 space-y-2.5 text-xs text-zinc-300"
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-zinc-950 flex items-center justify-center text-[10px] font-mono font-bold text-[#c6a34f] shrink-0">1</span>
                        <p className="leading-relaxed">{getLabel('androidStep1')}</p>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-zinc-950 flex items-center justify-center text-[10px] font-mono font-bold text-[#c6a34f] shrink-0">2</span>
                        <p className="leading-relaxed">{getLabel('androidStep2')}</p>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-zinc-950 flex items-center justify-center text-[10px] font-mono font-bold text-[#c6a34f] shrink-0">3</span>
                        <p className="leading-relaxed">{getLabel('androidStep3')}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Desktop / Computer Guide Card */}
              <div 
                onClick={() => setActivePlatformGuide(activePlatformGuide === 'desktop' ? null : 'desktop')}
                className={`group border rounded-2xl p-4 transition-all duration-300 cursor-pointer ${
                  activePlatformGuide === 'desktop' 
                    ? 'bg-[#c6a34f]/10 border-[#c6a34f]/50 shadow-md' 
                    : 'bg-zinc-900/40 border-white/5 hover:border-white/10 hover:bg-zinc-900/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-zinc-950 flex items-center justify-center text-zinc-400 group-hover:text-[#c6a34f] transition-colors">
                      <Laptop size={16} />
                    </div>
                    <span className="text-xs font-bold text-white group-hover:text-[#c6a34f] transition-colors">{getLabel('desktopTitle')}</span>
                  </div>
                  <ChevronDown size={14} className={`text-zinc-500 transition-transform duration-300 ${activePlatformGuide === 'desktop' ? 'rotate-180 text-[#c6a34f]' : ''}`} />
                </div>
                
                <AnimatePresence initial={false}>
                  {activePlatformGuide === 'desktop' && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden mt-3.5 pt-3.5 border-t border-white/5 space-y-2.5 text-xs text-zinc-300"
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-zinc-950 flex items-center justify-center text-[10px] font-mono font-bold text-[#c6a34f] shrink-0">1</span>
                        <p className="leading-relaxed">{getLabel('desktopStep1')}</p>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-zinc-950 flex items-center justify-center text-[10px] font-mono font-bold text-[#c6a34f] shrink-0">2</span>
                        <p className="leading-relaxed">{getLabel('desktopStep2')}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tech Note */}
      <div className="bg-[#111] p-3.5 rounded-2xl border border-white/5 flex items-start gap-2.5 text-left">
        <Info size={14} className="text-[#c6a34f] shrink-0 mt-0.5" />
        <p className="text-[10px] text-zinc-400 leading-normal">
          <strong>Isolamento de Memória Local</strong>: Este sistema roda totalmente em arquitetura Client-Side Sandbox. Seus dados e preferências nunca deixam o dispositivo. Ao instalar como aplicativo, seu navegador aloca uma quota permanente de armazenamento físico seguro no disco rígido do aparelho, eliminando o risco de perda por limpeza automática de caches temporários.
        </p>
      </div>
    </div>
  );
};
