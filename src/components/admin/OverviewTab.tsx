import React, { useState } from 'react';
import {
  Gauge,
  Fuel,
  TrendingUp,
  DollarSign,
  Truck,
  Wrench,
  AlertTriangle,
  FileCheck,
  CheckCircle2,
  Check,
  Plus,
} from 'lucide-react';
import { FleetEvent, DashboardMetrics, Company } from '../../types/fleet';
import { FleetAnalyticsCharts } from '../FleetAnalyticsCharts';
import { NightlyFleetInsightsPanel } from './NightlyFleetInsightsPanel';
import { AiDisruptionHub } from './AiDisruptionHub';
import { GestorFalanteAudioPlayer } from './GestorFalanteAudioPlayer';
import { GoogleSheetsSyncCard } from './GoogleSheetsSyncCard';
import { CompanyOnboardingModal } from './CompanyOnboardingModal';
import { SummaryStatisticsCards } from './SummaryStatisticsCards';
import { ResetAllDataModal } from './ResetAllDataModal';
import { DashboardPDFExportModal } from './DashboardPDFExportModal';
import { MaintenanceVisualNotificationBanner } from './MaintenanceVisualNotificationBanner';
import { FuelCostPerKmLineChart } from './FuelCostPerKmLineChart';
import { Sparkles, Trash2, FileDown, BarChart3 } from 'lucide-react';

interface OverviewTabProps {
  company: Company | null;
  metrics: DashboardMetrics | null;
  events: FleetEvent[];
  onConfirmEvent: (payload: any) => Promise<{ success: boolean; error?: string }>;
  onRejectEvent: (eventId: string, reason: string) => Promise<{ success: boolean; error?: string }>;
  onNavigateTo?: (tab: string) => void;
  onOpenNewVehicle?: () => void;
  onOpenNewDriver?: () => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  company,
  metrics,
  events,
  onConfirmEvent,
  onRejectEvent,
  onNavigateTo,
  onOpenNewVehicle,
  onOpenNewDriver,
}) => {
  const [selectedPendingEvent, setSelectedPendingEvent] = useState<FleetEvent | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showPDFExportModal, setShowPDFExportModal] = useState(false);

  const summary = metrics?.fleetSummary || {
    totalVehicles: 0,
    activeVehicles: 0,
    maintenanceVehicles: 0,
    totalDrivers: 0,
    activeDrivers: 0,
  };

  const indicators = metrics?.indicators || {
    totalKmDriven: 0,
    averageKmLiter: 0,
    costPerKm: 0,
    totalFleetSpend: 0,
    totalFuelSpend: 0,
    totalMaintenanceSpend: 0,
    totalPartsSpend: 0,
    totalLaborSpend: 0,
    totalLiters: 0,
  };

  const upcoming = metrics?.upcomingMaintenances || [];
  const pendingEvents = events.filter(
    (e) => e.status === 'pending_confirmation' || e.status === 'corrected'
  );

  const handleQuickApprove = async (event: FleetEvent) => {
    await onConfirmEvent({
      event_id: event.id,
      odometer: event.odometer,
      event_date: event.event_date,
      total_amount: event.total_amount,
      notes: event.notes,
      correction_justification: event.correction_justification,
      gas_station_name: event.fuelDetail?.gas_station_name,
      liters: event.fuelDetail?.liters,
      price_per_liter: event.fuelDetail?.price_per_liter,
      fuel_type: event.fuelDetail?.fuel_type,
      workshop_name: event.maintenanceDetail?.workshop_name,
      maintenance_type: event.maintenanceDetail?.maintenance_type,
      parts_cost: event.maintenanceDetail?.parts_cost,
      labor_cost: event.maintenanceDetail?.labor_cost,
      items_description: event.maintenanceDetail?.items_description,
    });
  };

  const handleQuickReject = async () => {
    if (!selectedPendingEvent) return;
    await onRejectEvent(selectedPendingEvent.id, rejectionReason || 'Reprovado pela auditoria administrativa.');
    setShowRejectModal(false);
    setSelectedPendingEvent(null);
    setRejectionReason('');
  };

  return (
    <div className="space-y-6">
      {/* Fast Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
            Painel de Gestão Corporativa
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {company?.name || 'TransLog Transportes'}
          </h1>
          <p className="text-xs text-slate-400">
            Indicadores consolidados, controle de custos e integridade de odômetros
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowOnboardingModal(true)}
            className="px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-xs font-bold text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 transition cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Onboarding & Espelho</span>
          </button>
          {onOpenNewVehicle && (
            <button
              type="button"
              onClick={onOpenNewVehicle}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              <span>Novo Veículo</span>
            </button>
          )}
          {onOpenNewDriver && (
            <button
              type="button"
              onClick={onOpenNewDriver}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-blue-400" />
              <span>Novo Motorista</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onNavigateTo?.('analytics')}
            className="px-3.5 py-2 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-xs font-bold text-indigo-300 border border-indigo-500/40 flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-indigo-500/10"
            title="Abrir tela dedicada de Análise de Dados e Recharts com Gemini IA"
          >
            <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
            <span>Análise de Dados Recharts</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPDFExportModal(true)}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-xs font-bold text-amber-300 border border-amber-500/40 flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-amber-500/10"
            title="Exportar dados do dashboard para PDF executivo para apresentações externas"
          >
            <FileDown className="w-3.5 h-3.5 text-amber-400" />
            <span>Exportar PDF</span>
          </button>

          <button
            type="button"
            onClick={() => setShowResetModal(true)}
            className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-xs font-bold text-rose-300 border border-rose-500/30 flex items-center gap-1.5 transition cursor-pointer"
            title="Exclui todos os dados e zera todos os campos do sistema"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Zerar Tudo</span>
          </button>
        </div>
      </div>

      {/* Sistema de Notificações Visuais de Manutenções Preventivas (Vencidas / Próximas) */}
      <MaintenanceVisualNotificationBanner />

      {/* Summary Statistics Component: Key Performance Indicators */}
      <SummaryStatisticsCards
        metrics={metrics}
        events={events}
        onNavigateToTab={onNavigateTo}
      />

      {/* Gestor Falante: Áudio executivo diário */}
      <GestorFalanteAudioPlayer />

      {/* Espelho Google Sheets da Empresa (Google Workspace) */}
      <GoogleSheetsSyncCard />

      {/* Inteligência Multiagente da Frota & Job Noturno (Batch API) */}
      <NightlyFleetInsightsPanel />

      {/* Central de Inteligência Disruptiva & APIs Gratuitas (Open-Meteo, BrasilAPI, Copiloto IA, ESG) */}
      <AiDisruptionHub />

      {/* Recharts Analytics: Gastos Mensais & Economia Gerada */}
      <FleetAnalyticsCharts
        events={events}
        metrics={metrics}
        companyName={company?.name}
        companyCnpj={company?.cnpj}
      />

      {/* Recharts Analytics: Variação de Custo de Combustível por KM (Últimos 30 Dias) */}
      <FuelCostPerKmLineChart
        events={events}
        metrics={metrics}
      />

      {/* Row: Gastos por Categoria & Alertas de Manutenção */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gastos por Categoria */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
          <h2 className="text-sm font-extrabold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-amber-400" />
            <span>Gastos por Categoria</span>
          </h2>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs font-bold mb-1">
                <span className="text-slate-300">Combustível</span>
                <span className="text-amber-400">
                  R$ {indicators.totalFuelSpend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{
                    width: `${
                      indicators.totalFleetSpend > 0
                        ? (indicators.totalFuelSpend / indicators.totalFleetSpend) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-bold mb-1">
                <span className="text-slate-300">Peças Mecânicas</span>
                <span className="text-blue-400">
                  R$ {indicators.totalPartsSpend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{
                    width: `${
                      indicators.totalFleetSpend > 0
                        ? (indicators.totalPartsSpend / indicators.totalFleetSpend) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-bold mb-1">
                <span className="text-slate-300">Mão de Obra de Oficina</span>
                <span className="text-purple-400">
                  R$ {indicators.totalLaborSpend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full"
                  style={{
                    width: `${
                      indicators.totalFleetSpend > 0
                        ? (indicators.totalLaborSpend / indicators.totalFleetSpend) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Próximas Manutenções Preventivas */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <Wrench className="w-4 h-4 text-amber-400" />
              <span>Próximas Manutenções Preventivas</span>
            </h2>
            <span className="text-xs text-slate-400">{upcoming.length} veículo(s) sob atenção</span>
          </div>

          {upcoming.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 bg-slate-950/40 rounded-2xl">
              Todos os veículos estão em dia com o plano de revisão preventiva.
            </div>
          ) : (
            <div className="space-y-2.5">
              {upcoming.map((m) => (
                <div
                  key={m.vehicleId}
                  className={`p-3 rounded-2xl border flex items-center justify-between text-xs ${
                    m.isOverdue
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        m.isOverdue ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-extrabold text-white flex items-center gap-2">
                        <span>{m.plate}</span>
                        <span className="text-[10px] text-slate-400">{m.model}</span>
                      </div>
                      <div className="text-[11px] text-slate-300 mt-0.5">{m.description}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-bold">
                      {m.isOverdue ? (
                        <span className="text-rose-400">Vencida em {Math.abs(m.kmUntil)} km</span>
                      ) : (
                        <span className="text-amber-400">Faltam {m.kmUntil.toLocaleString()} km</span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Atual: {m.currentKm.toLocaleString()} / Meta: {m.nextMaintenanceKm.toLocaleString()} km
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pending Events Review Queue */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-amber-400" />
              <span>Fila de Auditoria e Aprovação de Comprovantes</span>
            </h2>
            <p className="text-xs text-slate-400">
              Registros enviados por foto aguardando homologação ou com justificativas de ajuste
            </p>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
            {pendingEvents.length} pendente(s)
          </span>
        </div>

        {pendingEvents.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 bg-slate-950/40 rounded-2xl">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-60" />
            Nenhum evento pendente. Todos os comprovantes fotográficos foram confirmados e auditados.
          </div>
        ) : (
          <div className="space-y-3">
            {pendingEvents.map((pe) => (
              <div
                key={pe.id}
                className="bg-slate-950/60 border border-slate-800 hover:border-slate-700 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                    {pe.event_type === 'fuel' ? <Fuel className="w-5 h-5" /> : <Wrench className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-white">{pe.vehicle?.plate || 'Veículo'}</span>
                      <span className="text-xs text-slate-400">• {pe.driver?.name || 'Motorista'}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">
                        {pe.status}
                      </span>
                    </div>

                    <div className="text-xs text-slate-300 mt-1">
                      {pe.event_type === 'fuel'
                        ? `${pe.fuelDetail?.gas_station_name || 'Posto'} • ${pe.fuelDetail?.liters || 0} L`
                        : `${pe.maintenanceDetail?.workshop_name || 'Oficina'} • ${pe.maintenanceDetail?.items_description || 'Serviço'}`}
                    </div>

                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Odômetro: <strong>{pe.odometer.toLocaleString()} km</strong> • Data: {pe.event_date}
                    </div>

                    {pe.correction_justification && (
                      <div className="mt-1 text-xs text-amber-300">
                        <strong>Justificativa do motorista:</strong> {pe.correction_justification}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] text-slate-400 block uppercase font-semibold">Valor Total</span>
                    <span className="text-base font-black text-emerald-400">
                      R$ {pe.total_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleQuickApprove(pe)}
                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1 transition cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Homologar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPendingEvent(pe);
                        setShowRejectModal(true);
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-rose-500/20 hover:text-rose-300 text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      Rejeitar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && selectedPendingEvent && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 text-slate-100">
            <h3 className="text-base font-bold text-white mb-2">Rejeitar Comprovante da Frota</h3>
            <p className="text-xs text-slate-400 mb-4">
              Informe o motivo da não aprovação deste comprovante para registro na trilha de auditoria:
            </p>
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Ex: Foto ilegível / Valor diverge da nota fiscal anexada..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500 mb-4"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 bg-slate-800 text-xs font-bold text-slate-300 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleQuickReject}
                className="px-4 py-2 bg-rose-500 hover:bg-rose-400 text-xs font-bold text-white rounded-xl"
              >
                Confirmar Rejeição
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Company Onboarding Modal */}
      <CompanyOnboardingModal
        isOpen={showOnboardingModal}
        onClose={() => setShowOnboardingModal(false)}
      />

      {/* Reset All Data Modal */}
      <ResetAllDataModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
      />

      {/* Dashboard PDF Export Modal */}
      <DashboardPDFExportModal
        isOpen={showPDFExportModal}
        onClose={() => setShowPDFExportModal(false)}
      />
    </div>
  );
};
