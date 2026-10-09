import React, { useState } from 'react';
import {
  Building2,
  X,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  MapPin,
  Percent,
} from 'lucide-react';
import { useFleet } from '../../context/FleetContext';
import { validateVeridicalCnpj, formatCnpj } from '../../utils/veridicalValidators';
import { Company } from '../../types/fleet';

interface CreateCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (company: Company) => void;
}

export const CreateCompanyModal: React.FC<CreateCompanyModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { createCompany } = useFleet();

  const [name, setName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [city, setCity] = useState('');
  const [margin, setMargin] = useState('10');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCnpj(formatCnpj(e.target.value));
    setErrorMsg(null);
  };

  const cnpjValidation = validateVeridicalCnpj(cnpj);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Validação de Razão Social
    if (name.trim().length < 3) {
      setErrorMsg('A Razão Social ou Nome da Empresa deve ter no mínimo 3 caracteres.');
      return;
    }

    // Validação de CNPJ
    if (!cnpjValidation.isValid) {
      setErrorMsg(cnpjValidation.error || 'CNPJ inválido pela Receita Federal.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createCompany({
        name: name.trim(),
        cnpj: cnpj.trim(),
        maxTankMarginPercent: parseInt(margin, 10) || 10,
        city: city.trim(),
      });

      if (!res.success || !res.company) {
        setErrorMsg(res.error || 'Erro ao registrar empresa.');
        setIsSubmitting(false);
        return;
      }

      setSuccessMsg(`Empresa "${res.company.name}" cadastrada com sucesso! Dados protegidos e ativos.`);
      setTimeout(() => {
        setIsSubmitting(false);
        if (onSuccess && res.company) {
          onSuccess(res.company);
        }
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Erro ao cadastrar empresa:', err);
      setErrorMsg(err.message || 'Falha ao salvar dados corporativos.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Building2 className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Cadastrar Nova Empresa ou Filial</h3>
              <p className="text-xs text-slate-400">
                Crie uma área exclusiva e protegida para gerenciar sua frota
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Messages */}
        {errorMsg && (
          <div className="m-4 p-3 bg-rose-500/20 border border-rose-500/40 rounded-2xl flex items-center gap-2.5 text-xs text-rose-200">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="m-4 p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Razão Social */}
          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Razão Social / Nome da Operação *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErrorMsg(null);
              }}
              placeholder="Ex: Expresso Paulista Logística Ltda"
              required
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* CNPJ */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                CNPJ (Validação da Receita Federal) *
              </label>
              {cnpj.replace(/\D/g, '').length === 14 && (
                <span
                  className={`text-[10px] font-bold ${
                    cnpjValidation.isValid ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {cnpjValidation.isValid ? '✓ CNPJ Oficial Válido' : '✕ CNPJ Inválido'}
                </span>
              )}
            </div>
            <input
              type="text"
              value={cnpj}
              onChange={handleCnpjChange}
              placeholder="00.000.000/0000-00"
              maxLength={18}
              required
              className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none font-mono ${
                cnpj.replace(/\D/g, '').length === 14
                  ? cnpjValidation.isValid
                    ? 'border-emerald-500/60 focus:border-emerald-500'
                    : 'border-rose-500/60 focus:border-rose-500'
                  : 'border-slate-700 focus:border-amber-500'
              }`}
            />
          </div>

          {/* Cidade/UF e Margem de Tanque */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                <span>Cidade - UF</span>
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ex: São Paulo - SP"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Percent className="w-3.5 h-3.5 text-amber-400" />
                <span>Margem de Sobretanque (%)</span>
              </label>
              <input
                type="number"
                min="0"
                max="25"
                value={margin}
                onChange={(e) => setMargin(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-2xl flex items-center gap-2.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Ao criar a nova empresa, um tenant seguro e isolado será provisionado no Firestore.
            </span>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (cnpj.replace(/\D/g, '').length === 14 && !cnpjValidation.isValid)}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs flex items-center gap-2 transition cursor-pointer shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Cadastrando Empresa...</span>
                </>
              ) : (
                <>
                  <Building2 className="w-4 h-4" />
                  <span>Cadastrar e Ativar Empresa</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
