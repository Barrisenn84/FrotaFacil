import React, { useState } from 'react';
import { AlertTriangle, Trash2, X, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useFleet } from '../../context/FleetContext';

interface ResetAllDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ResetAllDataModal: React.FC<ResetAllDataModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { resetAllData, currentCompany } = useFleet();
  const [confirmInput, setConfirmInput] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const isConfirmed = confirmInput.trim().toUpperCase() === 'ZERAR';

  const handleReset = async () => {
    if (!isConfirmed) return;
    setIsResetting(true);
    setError(null);

    const result = await resetAllData();
    setIsResetting(false);

    if (result.success) {
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setConfirmInput('');
        onClose();
        if (onSuccess) onSuccess();
      }, 1800);
    } else {
      setError(result.error || 'Erro ao zerar dados do sistema.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="bg-slate-900 border border-rose-500/40 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl shadow-rose-950/40 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-rose-950/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Zerar Tudo e Limpar Campos</h3>
              <p className="text-xs text-rose-300">
                Empresa: {currentCompany?.name || 'TransLog'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isResetting}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs">
          {isSuccess ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="text-lg font-bold text-white">Sistema Zerado com Sucesso!</div>
              <p className="text-slate-400">
                Todos os dados, veículos, motoristas, abastecimentos e campos foram completamente limpos.
              </p>
            </div>
          ) : (
            <>
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-200 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-rose-300">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Atenção: Ação irreversível!</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-300">
                  Esta ação excluirá permanentemente todos os registros do banco na nuvem e do cache local:
                </p>
                <ul className="list-disc list-inside text-[11px] text-slate-400 space-y-0.5 ml-1">
                  <li>Todos os veículos cadastrados e seus odômetros</li>
                  <li>Todos os motoristas e vínculos de condutores</li>
                  <li>Todos os abastecimentos, notas e comprovantes</li>
                  <li>Todas as ordens de serviço e manutenções mecânicas</li>
                  <li>Inspeções veiculares e laudos periciais de IA</li>
                  <li>Rascunhos offline e espelho de planilhas</li>
                </ul>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                  Para confirmar a exclusão total, digite <strong className="text-rose-400 tracking-wider">ZERAR</strong> abaixo:
                </label>
                <input
                  type="text"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder="Digite ZERAR para confirmar..."
                  disabled={isResetting}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 font-mono"
                />
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!isSuccess && (
          <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isResetting}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={!isConfirmed || isResetting}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-lg shadow-rose-600/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isResetting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Zerando tudo...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Zerar Tudo e Limpar Campos</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
