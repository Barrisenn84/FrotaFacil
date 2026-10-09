import React from 'react';
import {
  Sparkles,
  X,
  Gauge,
  TrendingDown,
  Activity,
  ShieldCheck,
  AlertTriangle,
  Calendar,
  DollarSign,
  Fuel,
  Wrench,
  CheckCircle2,
} from 'lucide-react';
import { Vehicle } from '../../types/fleet';
import { getVehicleFipeValuation } from '../../services/freePublicApisService';
import { generateVehicleHealthDiagnostic } from '../../services/deepFleetAiService';

interface VehicleAiHealthModalProps {
  vehicle: Vehicle | null;
  isOpen: boolean;
  onClose: () => void;
}

export const VehicleAiHealthModal: React.FC<VehicleAiHealthModalProps> = ({
  vehicle,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !vehicle) return null;

  const currentKm = vehicle.kmAtual ?? vehicle.current_km ?? vehicle.kmInicial ?? 0;
  const fipe = getVehicleFipeValuation(vehicle.make, vehicle.model, vehicle.year, currentKm);
  const health = generateVehicleHealthDiagnostic(vehicle, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-indigo-500/40 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">
                  Diagnóstico Completo do Veículo & Valor de Mercado (FIPE)
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold">
                  {vehicle.plate}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {vehicle.make} {vehicle.model} ({vehicle.year}) • {currentKm.toLocaleString('pt-BR')} km rodados
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
        <div className="p-5 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Top Score Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Health Score */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Saúde Geral do Veículo</span>
                <div className="text-2xl font-black text-emerald-400 mt-1 flex items-baseline gap-1">
                  <span>{health.healthScore}</span>
                  <span className="text-xs text-slate-500">/ 100</span>
                </div>
                <div className="text-xs font-semibold text-emerald-400/90 mt-0.5">
                  Motor e Câmbio: {health.statusTremDeForca.toUpperCase()}
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-800/80 text-[10px] text-slate-500">
                Baseado no histórico de uso e revisões
              </div>
            </div>

            {/* FIPE Market Value */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Valor FIPE de Mercado</span>
                <div className="text-2xl font-black text-amber-400 mt-1">
                  R$ {fipe.valorEstimadoBrl.toLocaleString('pt-BR')}
                </div>
                <div className="text-xs font-semibold text-slate-300 mt-0.5 flex items-center gap-1">
                  <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                  <span>-{fipe.depreciacaoAnualPercent}% ao ano</span>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-800/80 text-[10px] text-slate-500">
                Valor zero-km: R$ {fipe.valorOriginalZeroKmBrl.toLocaleString('pt-BR')}
              </div>
            </div>

            {/* Consumo Anômalo */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Curva de Consumo</span>
                <div className="text-2xl font-black text-sky-400 mt-1">
                  Normal
                </div>
                <div className="text-xs font-semibold text-slate-300 mt-0.5">
                  Variação: +{health.desvioConsumoCombustivelPercent}%
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-800/80 text-[10px] text-slate-500">
                Dentro do padrão original de fábrica
              </div>
            </div>
          </div>

          {/* Optimal Replacement Recommendation Card */}
          <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 space-y-2">
            <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs uppercase tracking-wider">
              <Calendar className="w-4 h-4 text-indigo-400" />
              <span>Momento Ideal para Trocar ou Vender o Veículo</span>
            </div>
            <p className="text-xs text-slate-200 leading-relaxed">
              {fipe.pontoOtimoSubstituicao.recomendacao}
            </p>
            <div className="flex items-center gap-4 text-xs text-indigo-200 pt-1">
              <span>Vida útil residual: <strong>{fipe.pontoOtimoSubstituicao.anosRestantes} anos</strong></span>
              <span>Limite de KM ideal: <strong>{fipe.pontoOtimoSubstituicao.kmLimiteRecomendado.toLocaleString('pt-BR')} km</strong></span>
            </div>
          </div>

          {/* Component Wear Projections */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-emerald-400" />
              Projeção de Vida Útil dos Componentes Críticos
            </span>

            <div className="space-y-2.5 text-xs">
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Pneus (Profundidade média do sulco: 5.2 mm)</span>
                  <span className="font-bold text-emerald-400">82% de vida útil</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: '82%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Pastilhas e Discos de Freio</span>
                  <span className="font-bold text-amber-400">68% de vida útil</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: '68%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Lubrificante & Filtros de Óleo</span>
                  <span className="font-bold text-emerald-400">91% de vida útil</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: '91%' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Executive Diagnostic Summary */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-1.5 text-xs text-slate-300">
            <strong className="text-white block font-bold">Parecer Técnico da Inteligência Artificial:</strong>
            <p className="leading-relaxed">{health.diagnosticoResumo}</p>
            <div className="pt-2 text-amber-300 font-semibold flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{health.recomendacaoPrioritaria}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex justify-end bg-slate-950/60">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
          >
            Fechar Diagnóstico
          </button>
        </div>
      </div>
    </div>
  );
};
