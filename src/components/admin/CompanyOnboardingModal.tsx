import React, { useState } from 'react';
import {
  Building2,
  Truck,
  FileSpreadsheet,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  X,
  Plus,
  Trash2,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { useFleet } from '../../context/FleetContext';
import { createCompanyFleetSpreadsheet } from '../../services/googleSheetsService';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';

interface CompanyOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CompanyOnboardingModal: React.FC<CompanyOnboardingModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { currentCompany, vehicles, createVehicle } = useFleet();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [companyName, setCompanyName] = useState<string>(currentCompany?.name || 'Minha Transportadora');
  const [cnpj, setCnpj] = useState<string>(currentCompany?.cnpj || '12.345.678/0001-90');
  const [tankMargin, setTankMargin] = useState<number>(currentCompany?.maxTankMarginPercent || 10);

  // Initial Vehicles to add
  const [initialVehicles, setInitialVehicles] = useState<
    Array<{ plate: string; model: string; fuel_type: string; current_km: number }>
  >([
    { plate: 'ABC-1D23', model: 'VW Saveiro Robust 1.6', fuel_type: 'Gasolina Comum', current_km: 9420 },
  ]);

  // Optional Sheets state
  const [enableSheets, setEnableSheets] = useState<boolean>(true);
  const [isCreatingSheets, setIsCreatingSheets] = useState<boolean>(false);
  const [createdSheetUrl, setCreatedSheetUrl] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddVehicleRow = () => {
    setInitialVehicles([
      ...initialVehicles,
      { plate: '', model: '', fuel_type: 'Diesel S10', current_km: 0 },
    ]);
  };

  const handleRemoveVehicleRow = (index: number) => {
    setInitialVehicles(initialVehicles.filter((_, idx) => idx !== index));
  };

  const handleFinishOnboarding = async () => {
    if (!currentCompany) return;

    // 1. Atualizar dados da empresa no Firestore
    try {
      const compRef = doc(db, 'companies', currentCompany.id);
      await updateDoc(compRef, {
        name: companyName,
        cnpj,
        maxTankMarginPercent: tankMargin,
      });
    } catch (e) {
      console.warn('Erro ao atualizar empresa:', e);
    }

    // 2. Se marcado para criar o espelho em Google Sheets
    if (enableSheets && !createdSheetUrl) {
      setIsCreatingSheets(true);
      const res = await createCompanyFleetSpreadsheet(companyName, {
        vehicles: vehicles,
      });
      setIsCreatingSheets(false);

      if (res.success && res.spreadsheetId) {
        setCreatedSheetUrl(res.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${res.spreadsheetId}/edit`);
        try {
          const compRef = doc(db, 'companies', currentCompany.id);
          await updateDoc(compRef, {
            sheets_spreadsheet_id: res.spreadsheetId,
            sheets_spreadsheet_url: res.spreadsheetUrl,
            sheets_synced_at: new Date().toISOString(),
            sheets_auto_sync: true,
          });
        } catch (e) {
          console.warn('Erro ao salvar ID da planilha:', e);
        }
      }
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl relative text-slate-100 font-['Plus_Jakarta_Sans',sans-serif] space-y-6">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Step Header */}
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-400 mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Onboarding da Empresa • Passo {step} de 3</span>
          </div>
          <h2 className="text-xl font-black text-white">
            {step === 1 && 'Configurações Principais da Empresa'}
            {step === 2 && 'Frota Inicial de Veículos'}
            {step === 3 && 'Espelho em Planilha Google Sheets (Opcional)'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {step === 1 && 'Personalize a razão social, CNPJ e parâmetros de auditoria antifraude.'}
            {step === 2 && 'Cadastre os primeiros veículos que serão operados pela equipe.'}
            {step === 3 && 'Espelhe automaticamente Veículos, Abastecimentos, Manutenções e Documentos.'}
          </p>
        </div>

        {/* Step Indicators */}
        <div className="flex items-center gap-2">
          <div className={`h-1.5 flex-1 rounded-full ${step >= 1 ? 'bg-amber-400' : 'bg-slate-800'}`} />
          <div className={`h-1.5 flex-1 rounded-full ${step >= 2 ? 'bg-amber-400' : 'bg-slate-800'}`} />
          <div className={`h-1.5 flex-1 rounded-full ${step >= 3 ? 'bg-amber-400' : 'bg-slate-800'}`} />
        </div>

        {/* STEP 1: DADOS DA EMPRESA */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Nome da Empresa / Razão Social
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Ex: TransLog Transportes e Logística Ltda"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">CNPJ</label>
                <input
                  type="text"
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="00.000.000/0001-00"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Tolerância do Tanque (%)
                </label>
                <input
                  type="number"
                  value={tankMargin}
                  onChange={(e) => setTankMargin(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  min={0}
                  max={25}
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: FROTA INICIAL */}
        {step === 2 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Veículos a serem vinculados na operação:</span>
              <button
                type="button"
                onClick={handleAddVehicleRow}
                className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar outro</span>
              </button>
            </div>

            <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
              {initialVehicles.map((row, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-950 border border-slate-800 rounded-2xl grid grid-cols-1 sm:grid-cols-4 gap-2 items-center"
                >
                  <input
                    type="text"
                    placeholder="Placa (ex: ABC-1D23)"
                    value={row.plate}
                    onChange={(e) => {
                      const updated = [...initialVehicles];
                      updated[idx].plate = e.target.value.toUpperCase();
                      setInitialVehicles(updated);
                    }}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white uppercase font-mono"
                  />
                  <input
                    type="text"
                    placeholder="Modelo (ex: Fiorino 1.4)"
                    value={row.model}
                    onChange={(e) => {
                      const updated = [...initialVehicles];
                      updated[idx].model = e.target.value;
                      setInitialVehicles(updated);
                    }}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                  <select
                    value={row.fuel_type}
                    onChange={(e) => {
                      const updated = [...initialVehicles];
                      updated[idx].fuel_type = e.target.value;
                      setInitialVehicles(updated);
                    }}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="Diesel S10">Diesel S10</option>
                    <option value="Gasolina Comum">Gasolina</option>
                    <option value="Etanol">Etanol</option>
                  </select>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="KM Atual"
                      value={row.current_km || ''}
                      onChange={(e) => {
                        const updated = [...initialVehicles];
                        updated[idx].current_km = Number(e.target.value);
                        setInitialVehicles(updated);
                      }}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white w-full"
                    />
                    {initialVehicles.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveVehicleRow(idx)}
                        className="p-1.5 text-rose-400 hover:text-rose-300"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3: ESPELHO NO GOOGLE SHEETS (OPCIONAL) */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-extrabold text-white">
                  Espelho Automático no Google Sheets (Google Workspace)
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Crie uma planilha no Google Drive chamada <strong>"FrotaFácil - {companyName}"</strong> com 5 abas (<em>Veiculos, Abastecimentos, Manutencoes, Despesas, Documentos</em>). Cada novo comprovante entra nela automaticamente!
                </p>
              </div>
            </div>

            <label className="flex items-center gap-3 p-4 bg-slate-950 border border-slate-800 rounded-2xl cursor-pointer hover:border-emerald-500/50 transition">
              <input
                type="checkbox"
                checked={enableSheets}
                onChange={(e) => setEnableSheets(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500"
              />
              <div className="text-xs">
                <span className="font-extrabold text-white block">
                  Sim, criar o espelho no Google Sheets da empresa agora (Recomendado)
                </span>
                <span className="text-slate-400">
                  A assistente administrativa continua com o Excel/Sheets que já domina, sem retrabalho.
                </span>
              </div>
            </label>
          </div>
        )}

        {/* Navigation Actions */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-5">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as any)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar</span>
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s + 1) as any)}
              className="px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
            >
              <span>Avançar</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinishOnboarding}
              disabled={isCreatingSheets}
              className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isCreatingSheets ? 'Criando Planilha...' : 'Concluir Onboarding & Salvar'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
