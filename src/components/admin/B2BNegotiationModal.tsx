import React, { useState } from 'react';
import {
  FileText,
  X,
  Copy,
  Check,
  Building2,
  DollarSign,
  TrendingDown,
  Sparkles,
} from 'lucide-react';
import { generateB2BFuelNegotiationLetter } from '../../services/deepFleetAiService';

interface B2BNegotiationModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyName: string;
}

export const B2BNegotiationModal: React.FC<B2BNegotiationModalProps> = ({
  isOpen,
  onClose,
  companyName,
}) => {
  if (!isOpen) return null;

  const [gasStationName, setGasStationName] = useState('Auto Posto RodoRede Express');
  const [fuelType, setFuelType] = useState('Diesel S10');
  const [monthlyLiters, setMonthlyLiters] = useState(8500);
  const [currentPrice, setCurrentPrice] = useState(6.29);
  const [targetDiscount, setTargetDiscount] = useState(0.25);
  const [copied, setCopied] = useState(false);

  const { letterText, estimatedMonthlySavingsBrl } = generateB2BFuelNegotiationLetter({
    companyName,
    gasStationName,
    fuelType,
    estimatedMonthlyLiters: Number(monthlyLiters) || 5000,
    currentAvgPrice: Number(currentPrice) || 6.0,
    targetDiscountPerLiter: Number(targetDiscount) || 0.2,
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(letterText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-amber-500/40 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-amber-950/30 to-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">
                  Proposta de Desconto em Postos de Combustível
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                  Parceria Comercial
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Crie uma carta profissional para negociar desconto por quantidade de litros com postos parceiros
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Inputs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-400 font-bold mb-1">Nome da Rede ou Posto Alvo:</label>
              <input
                type="text"
                value={gasStationName}
                onChange={(e) => setGasStationName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-bold mb-1">Combustível Principal:</label>
              <select
                value={fuelType}
                onChange={(e) => setFuelType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-400"
              >
                <option value="Diesel S10">Diesel S10</option>
                <option value="Gasolina Comum">Gasolina Comum</option>
                <option value="Etanol">Etanol</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-bold mb-1">Volume Mensal da Frota (Litros):</label>
              <input
                type="number"
                value={monthlyLiters}
                onChange={(e) => setMonthlyLiters(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-bold mb-1">Desconto Alvo por Litro (R$):</label>
              <input
                type="number"
                step="0.05"
                value={targetDiscount}
                onChange={(e) => setTargetDiscount(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {/* Economia Estimada Banner */}
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                  Economia Projetada com o Desconto
                </span>
                <span className="text-base font-black text-emerald-300">
                  R$ {estimatedMonthlySavingsBrl.toLocaleString('pt-BR')}/mês
                </span>
              </div>
            </div>

            <span className="text-xs text-emerald-400 font-bold">
              R$ {(estimatedMonthlySavingsBrl * 12).toLocaleString('pt-BR')}/ano
            </span>
          </div>

          {/* Letter Preview Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300">Minuta da Proposta Pronta para Envio:</span>
              <button
                type="button"
                onClick={handleCopy}
                className="text-amber-400 hover:text-amber-300 flex items-center gap-1 font-bold cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copiado!' : 'Copiar Texto'}</span>
              </button>
            </div>

            <textarea
              readOnly
              value={letterText}
              rows={10}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 font-mono leading-relaxed outline-none resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/60">
          <span className="text-[11px] text-slate-400">
            Pode ser enviada via WhatsApp Comercial ou e-mail corporativo.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-amber-500/20"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copiado para a Área de Transferência' : 'Copiar Proposta'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
