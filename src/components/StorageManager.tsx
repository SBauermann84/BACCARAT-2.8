import React, { useRef, useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Download, Upload, Database, Check, AlertTriangle, Sparkles, Trash2 } from 'lucide-react';
import { safeStorage } from '../utils/safeStorage';

export const StorageManager: React.FC = () => {
  const { compactHistory, masterReset } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sizeMB, setSizeMB] = useState<number>(0);
  const [isExported, setIsExported] = useState(false);
  const [isImported, setIsImported] = useState(false);
  const [isCompacted, setIsCompacted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetInputVal, setResetInputVal] = useState('');

  const calculateStorageSize = () => {
    try {
      const data = localStorage.getItem('casino-ai-storage') || '';
      // UTF-16 character is 2 bytes
      const bytes = data.length * 2;
      const mb = bytes / (1024 * 1024);
      setSizeMB(Number(mb.toFixed(3)));
    } catch (e) {
      setSizeMB(0);
    }
  };

  useEffect(() => {
    calculateStorageSize();
    // Re-check size on interval
    const interval = setInterval(calculateStorageSize, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleExport = () => {
    try {
      setErrorMsg(null);
      const data = localStorage.getItem('casino-ai-storage');
      if (!data) {
        setErrorMsg('Nenhum dado encontrado para exportação.');
        return;
      }
      
      // Beautifully formatted JSON
      const formatted = JSON.stringify(JSON.parse(data), null, 2);
      const blob = new Blob([formatted], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `smart-cassino-offline-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setIsExported(true);
      setTimeout(() => setIsExported(false), 3000);
    } catch (e) {
      setErrorMsg('Erro ao gerar arquivo de backup.');
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        
        // Validation: Must contain state key or be standard Zustand structure
        if (!parsed || (typeof parsed !== 'object') || !parsed.state) {
          setErrorMsg('Arquivo inválido. O backup deve ser um JSON válido gerado pelo aplicativo.');
          return;
        }

        safeStorage.setItem('casino-ai-storage', JSON.stringify(parsed));
        setIsImported(true);
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } catch (err) {
        setErrorMsg('Erro ao ler arquivo. Certifique-se de que é um JSON válido.');
      }
    };
    reader.readAsText(file);
  };

  const handleCompact = () => {
    try {
      setErrorMsg(null);
      compactHistory();
      setIsCompacted(true);
      calculateStorageSize();
      setTimeout(() => setIsCompacted(false), 3000);
    } catch (e) {
      setErrorMsg('Erro ao compactar dados de histórico.');
    }
  };

  const percentUsed = Math.min(100, (sizeMB / 10.0) * 100);
  const isHighUsage = percentUsed > 80;

  return (
    <div id="storage-manager-panel" className="bg-[#111111] p-6 rounded-3xl border border-white/5 space-y-6 mt-6">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-[#c6a34f] flex items-center gap-2">
          <Database size={16} /> Armazenamento Local
        </h3>
        <span className="text-[10px] font-mono font-bold bg-[#c6a34f]/10 text-[#c6a34f] px-2 py-0.5 rounded-full">
          Totalmente Offline
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs">
          <span className="text-white/60">Uso do Armazenamento (Limite 10.00 MB)</span>
          <span className={`font-mono font-bold ${isHighUsage ? 'text-red-400 animate-pulse' : 'text-[#c6a34f]'}`}>
            {sizeMB.toFixed(3)} MB ({percentUsed.toFixed(1)}%)
          </span>
        </div>
        
        <div className="w-full bg-black/40 h-2.5 rounded-full overflow-hidden border border-white/5">
          <div 
            className={`h-full rounded-full transition-all duration-500 ${
              isHighUsage 
                ? 'bg-red-500' 
                : percentUsed > 50 
                ? 'bg-yellow-500' 
                : 'bg-[#c6a34f]'
            }`}
            style={{ width: `${percentUsed}%` }}
          />
        </div>

        {isHighUsage && (
          <div className="flex items-start gap-2 bg-red-500/5 border border-red-500/20 p-2.5 rounded-xl text-[10px] text-red-400 mt-1">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>
              <strong>Atenção:</strong> O limite de armazenamento local está quase esgotado. Use a função de <strong>Compactar Histórico</strong> abaixo para limpar rodadas antigas e liberar espaço!
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
        {/* Export/Import Buttons */}
        <button
          type="button"
          onClick={handleExport}
          className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 active:scale-95 text-white/90 border border-white/10 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer"
        >
          {isExported ? (
            <>
              <Check size={14} className="text-emerald-400" />
              <span>Backup Exportado!</span>
            </>
          ) : (
            <>
              <Download size={14} />
              <span>Exportar Backup (JSON)</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleImportClick}
          className="flex items-center justify-center gap-2 bg-[#c6a34f]/10 hover:bg-[#c6a34f]/20 active:scale-95 text-[#c6a34f] border border-[#c6a34f]/20 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer"
        >
          {isImported ? (
            <>
              <Check size={14} className="text-[#c6a34f]" />
              <span>Carregando Backup...</span>
            </>
          ) : (
            <>
              <Upload size={14} />
              <span>Importar Backup (JSON)</span>
            </>
          )}
        </button>

        <input 
          type="file"
          ref={fileInputRef}
          onChange={handleImportFile}
          accept=".json"
          className="hidden"
        />

        {/* Compact History Button */}
        <button
          type="button"
          onClick={handleCompact}
          className="sm:col-span-2 flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 active:scale-95 text-white/70 hover:text-white border border-white/5 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer"
          title="Conserva apenas as últimas 500 rodadas de cada jogo, eliminando o excesso para garantir perfeito funcionamento"
        >
          {isCompacted ? (
            <>
              <Sparkles size={14} className="text-amber-400 animate-spin" />
              <span className="text-amber-400">Armazenamento Compactado com Sucesso!</span>
            </>
          ) : (
            <>
              <Database size={14} className="text-[#c6a34f]" />
              <span>Compactar Histórico (Limpar Antigas)</span>
            </>
          )}
        </button>
      </div>

      {/* Danger Zone: Master Reset */}
      <div className="border-t border-red-500/10 pt-6 mt-4">
        {!showResetConfirm ? (
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className="w-full flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/30 py-3 px-4 rounded-2xl text-xs font-bold transition-all cursor-pointer"
          >
            <Trash2 size={14} />
            <span>Zerar Todos os Dados e Começar do Zero</span>
          </button>
        ) : (
          <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 space-y-4 animate-fade-in">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-red-400 w-5 h-5 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-red-400">Zona de Perigo: Redefinição de Fábrica</h4>
                <p className="text-[11px] text-white/60 leading-relaxed">
                  Esta ação é <strong>irreversível</strong>. Ela apagará definitivamente:
                </p>
                <ul className="list-disc list-inside text-[10px] text-white/50 pl-1 space-y-0.5">
                  <li>Todo o histórico de rodadas (Roleta e Baccarat)</li>
                  <li>Configurações de banca e saldo atual</li>
                  <li>Histórico de fechamentos diários (Local e Nuvem Firestore)</li>
                  <li>Estatísticas de assertividade, vitórias e derrotas de todas as estratégias</li>
                  <li>Estratégias personalizadas (novos padrões serão recriados a partir de novos resultados inseridos)</li>
                </ul>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <label className="text-[10px] uppercase font-bold text-white/40 tracking-wider">
                Para confirmar, digite <span className="text-red-400 font-mono">ZERAR</span> abaixo:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Digite ZERAR"
                  value={resetInputVal}
                  onChange={(e) => setResetInputVal(e.target.value)}
                  className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-white/20 outline-none focus:border-red-500/40 w-32 uppercase"
                />
                <button
                  type="button"
                  disabled={resetInputVal !== 'ZERAR'}
                  onClick={async () => {
                    try {
                      await masterReset();
                      localStorage.removeItem('casino-ai-storage');
                      localStorage.removeItem('casino_patterns');
                      localStorage.removeItem('adaptiveLogs');
                      localStorage.removeItem('casino_opt_records_v1');
                      localStorage.removeItem('heatmap_custom_alerts_v1');
                      window.location.reload();
                    } catch (e) {
                      setErrorMsg('Erro ao reiniciar os dados do aplicativo.');
                    }
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-bold transition-all ${
                    resetInputVal === 'ZERAR'
                      ? 'bg-red-500 hover:bg-red-600 text-white cursor-pointer active:scale-95'
                      : 'bg-zinc-800 text-white/30 cursor-not-allowed border border-white/5'
                  }`}
                >
                  <Trash2 size={13} />
                  <span>Zerar Definitivamente</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowResetConfirm(false);
                    setResetInputVal('');
                  }}
                  className="bg-zinc-900 hover:bg-zinc-800 text-white/60 border border-white/5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="bg-red-500/5 border border-red-500/20 p-3 rounded-xl text-xs text-red-400 text-center">
          {errorMsg}
        </div>
      )}

      <div className="text-[9px] text-white/30 text-center leading-relaxed">
        Seus dados permanecem 100% gravados localmente no seu dispositivo. Excluir dados de navegação ou formatar o computador apagará as configurações; portanto, faça backups periódicos!
      </div>
    </div>
  );
};
