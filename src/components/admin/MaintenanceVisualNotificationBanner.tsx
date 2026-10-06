import React, { useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Wrench,
  ChevronDown,
  ChevronUp,
  Calendar,
  CheckCircle2,
  X,
  ArrowRight,
  ShieldAlert,
  Gauge,
  Sparkles,
} from 'lucide-react';
import { useFleet } from '../../context/FleetContext';
import { ScheduleMaintenanceModal } from './ScheduleMaintenanceModal';

export const MaintenanceVisualNotificationBanner: React.FC = () => {
  const { metrics, vehicles } = useFleet();

  const [isExpanded, setIsExpanded] = useState(true);
  const [filter, setFilter] = useState<'all' | 'overdue' | 'near'>('all');
  const [isDismissed, setIsDismissed] = useState(false);
  const [selectedVehicleForModal, setSelectedVehicleForModal] = useState<any | null>(null);

  // Obter lista consolidada de manutenções
  const allMaintenances = metrics?.upcomingMaintenances || [];
  const overdueVehicles = allMaintenances.filter((m) => m.isOverdue);
  const nearVehicles = allMaintenances.filter((m) => m.isNear);
  const totalAlerts = overdueVehicles.length + nearVehicles.length;

  if (totalAlerts === 0) {
    return null;
  }

  // Filtrar de acordo com a aba selecionada
  const displayedVehicles = allMaintenances.filter((m) => {
    if (filter === 'overdue') return m.isOverdue;
    if (filter === 'near') return m.isNear;
    return m.isOverdue || m.isNear;
  });

  const hasCritical = overdueVehicles.length > 0;

  // Se o gestor minimizou, exibir apenas uma pílula sutil no topo
  if (isDismissed) {
    return (
      <div className="mb-4 flex items-center justify-between p-3 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg text-xs font-['Plus_Jakarta_Sans',sans-serif]">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-3 h-3 rounded-full ${
              hasCritical ? 'bg-rose-500 animate-pulse' : 'bg-amber-500 animate-pulse'
            }`}
          />
          <span className="font-bold text-white flex items-center gap-1.5">
            {hasCritical ? (
              <span className="text-rose-400">🚨 {overdueVehicles.length} manutenção(ões) vencida(s)</span>
            ) : (
              <span className="text-amber-400">⚠️ {nearVehicles.length} veículo(s) perto da revisão</span>
            )}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setIsDismissed(false);
            setIsExpanded(true);
          }}
          className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
        >
          Expandir Alerta
        </button>
      </div>
    );
  }

  return (
    <>
      <div
        className={`mb-6 rounded-3xl overflow-hidden shadow-2xl transition-all font-['Plus_Jakarta_Sans',sans-serif] ${
          hasCritical
            ? 'bg-gradient-to-r from-rose-950/80 via-slate-900 to-slate-900 border-2 border-rose-500/50 shadow-rose-950/40'
            : 'bg-gradient-to-r from-amber-950/80 via-slate-900 to-slate-900 border-2 border-amber-500/50 shadow-amber-950/40'
        }`}
      >
        {/* Banner Bar Principal */}
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            {/* Ícone Pulsante */}
            <div className="relative shrink-0">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${
                  hasCritical
                    ? 'bg-rose-500 text-slate-950 shadow-rose-500/30'
                    : 'bg-amber-500 text-slate-950 shadow-amber-500/30'
                }`}
              >
                {hasCritical ? (
                  <AlertOctagon className="w-6 h-6 stroke-[2.5]" />
                ) : (
                  <AlertTriangle className="w-6 h-6 stroke-[2.5]" />
                )}
              </div>
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    hasCritical ? 'bg-rose-400' : 'bg-amber-400'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-3.5 w-3.5 ${
                    hasCritical ? 'bg-rose-500' : 'bg-amber-500'
                  }`}
                />
              </span>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                  {hasCritical
                    ? `ALERTA CRÍTICO: ${overdueVehicles.length} Veículo(s) com Manutenção Vencida!`
                    : `ATENÇÃO: ${nearVehicles.length} Veículo(s) Próximo(s) do Limite de KM`}
                </h3>

                {hasCritical && (
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-black uppercase tracking-wider animate-pulse">
                    Ação Imediata Necessária
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                {hasCritical
                  ? 'Veículos ultrapassaram o odômetro de revisão periódica. Risco iminente de quebra de componentes e perda de garantia da montadora.'
                  : 'Veículos com menos de 2.000 km para o limite preventivo. Planeje a parada da frota para evitar despesas mecânicas corretivas.'}
              </p>
            </div>
          </div>

          {/* Botões de Controle do Banner */}
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="px-3.5 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
            >
              {isExpanded ? (
                <>
                  <span>Recolher</span>
                  <ChevronUp className="w-4 h-4" />
                </>
              ) : (
                <>
                  <span>Ver Veículos ({totalAlerts})</span>
                  <ChevronDown className="w-4 h-4" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsDismissed(true)}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
              title="Minimizar Alerta"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Gaveta Expandida com Cards Interativos dos Veículos */}
        {isExpanded && (
          <div className="border-t border-slate-800/80 bg-slate-950/60 p-4 sm:p-5 space-y-4 animate-in slide-in-from-top-3 duration-200">
            {/* Filtros Internos por Gravidade */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-800/60">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    filter === 'all'
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  Todos ({totalAlerts})
                </button>

                {overdueVehicles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilter('overdue')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      filter === 'overdue'
                        ? 'bg-rose-500 text-slate-950 shadow-md shadow-rose-500/20'
                        : 'text-rose-400 hover:text-rose-200 hover:bg-rose-950/40 border border-rose-500/20'
                    }`}
                  >
                    <span>Vencidas ({overdueVehicles.length})</span>
                  </button>
                )}

                {nearVehicles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilter('near')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      filter === 'near'
                        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                        : 'text-amber-400 hover:text-amber-200 hover:bg-amber-950/40 border border-amber-500/20'
                    }`}
                  >
                    <span>Próximas ({nearVehicles.length})</span>
                  </button>
                )}
              </div>

              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Auditoria Automática de Odômetro Ativa</span>
              </span>
            </div>

            {/* Grid de Cards dos Veículos */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {displayedVehicles.map((item) => {
                const isOverdue = item.isOverdue;
                const kmDiff = Math.abs(item.kmUntil);
                const progressPct = Math.min(
                  100,
                  Math.round((item.currentKm / item.nextMaintenanceKm) * 100)
                );

                return (
                  <div
                    key={item.vehicleId}
                    className={`p-4 rounded-2xl border transition relative overflow-hidden flex flex-col justify-between ${
                      isOverdue
                        ? 'bg-slate-900/90 border-rose-500/40 hover:border-rose-500 shadow-lg shadow-rose-950/20'
                        : 'bg-slate-900/90 border-amber-500/40 hover:border-amber-500 shadow-lg shadow-amber-950/20'
                    }`}
                  >
                    {/* Badge de Gravidade Superior */}
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2">
                        {/* Placa Padrão Mercosul */}
                        <div className="px-2 py-0.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-black text-white font-mono tracking-wider flex items-center gap-1">
                          <span className="text-[9px] text-blue-400">BR</span>
                          <span>{item.plate}</span>
                        </div>
                        <span className="text-xs font-semibold text-slate-300 truncate max-w-[140px]">
                          {item.model}
                        </span>
                      </div>

                      {isOverdue ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-black uppercase tracking-wider">
                          Vencida
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase tracking-wider">
                          Próxima
                        </span>
                      )}
                    </div>

                    {/* Descrição da Revisão */}
                    <div className="text-xs font-medium text-slate-200 mb-3 line-clamp-2">
                      {item.description}
                    </div>

                    {/* Barra de Progresso de Quilometragem */}
                    <div className="space-y-1.5 mb-3.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Odômetro Atual</span>
                        <span className="font-bold text-white">
                          {item.currentKm.toLocaleString('pt-BR')} km
                        </span>
                      </div>

                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isOverdue ? 'bg-rose-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-500">
                          Limite: {item.nextMaintenanceKm.toLocaleString('pt-BR')} km
                        </span>
                        {isOverdue ? (
                          <span className="font-bold text-rose-400">
                            +{kmDiff.toLocaleString('pt-BR')} km ultrapassados
                          </span>
                        ) : (
                          <span className="font-bold text-amber-400">
                            Faltam {kmDiff.toLocaleString('pt-BR')} km
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Botão de Ação: Agendar ou Concluir */}
                    <button
                      type="button"
                      onClick={() => setSelectedVehicleForModal(item)}
                      className={`w-full py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        isOverdue
                          ? 'bg-rose-500 hover:bg-rose-400 text-slate-950 shadow-md shadow-rose-500/20'
                          : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
                      }`}
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>Agendar ou Concluir Revisão</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modal Interativo de Agendamento/Conclusão de Manutenção */}
      <ScheduleMaintenanceModal
        isOpen={Boolean(selectedVehicleForModal)}
        onClose={() => setSelectedVehicleForModal(null)}
        targetVehicle={selectedVehicleForModal}
      />
    </>
  );
};
