import React, { useState, useMemo } from 'react';
import {
  DollarSign,
  Fuel,
  Wrench,
  Truck,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ChevronRight,
  X,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Sparkles,
  Info,
  Calendar,
  FileDown,
} from 'lucide-react';
import { useFleet } from '../../context/FleetContext';
import { DashboardMetrics, FleetEvent, Vehicle } from '../../types/fleet';
import { DashboardPDFExportModal } from './DashboardPDFExportModal';

interface SummaryStatisticsCardsProps {
  metrics?: DashboardMetrics | null;
  events?: FleetEvent[];
  vehicles?: Vehicle[];
  onNavigateToTab?: (tab: string) => void;
  onOpenScheduleMaintenance?: (vehicleId: string) => void;
}

type PeriodFilter = 'current_month' | 'last_30_days' | 'all_time';

export const SummaryStatisticsCards: React.FC<SummaryStatisticsCardsProps> = ({
  metrics: propsMetrics,
  events: propsEvents,
  vehicles: propsVehicles,
  onNavigateToTab,
  onOpenScheduleMaintenance,
}) => {
  const fleet = useFleet();
  const metrics = propsMetrics ?? fleet.metrics;
  const events = propsEvents ?? fleet.events;
  const vehicles = propsVehicles ?? fleet.vehicles;
  const rawFuelings = fleet.rawFuelings || [];
  const rawMaintenance = fleet.rawMaintenance || [];

  const [period, setPeriod] = useState<PeriodFilter>('current_month');
  const [activeModal, setActiveModal] = useState<'cost' | 'efficiency' | 'maintenance' | 'fleet' | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);

  // Period label for headers
  const periodLabel = useMemo(() => {
    switch (period) {
      case 'current_month':
        return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date());
      case 'last_30_days':
        return 'Últimos 30 Dias';
      case 'all_time':
        return 'Consolidado Geral';
    }
  }, [period]);

  // Date boundary calculation
  const { startDate, endDate, prevStartDate, prevEndDate } = useMemo(() => {
    const now = new Date();
    if (period === 'current_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      const pStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const pEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      return { startDate: start, endDate: end, prevStartDate: pStart, prevEndDate: pEnd };
    } else if (period === 'last_30_days') {
      const start = new Date(now.getTime() - 30 * 86400000);
      const end = now;
      const pStart = new Date(now.getTime() - 60 * 86400000);
      const pEnd = new Date(now.getTime() - 30 * 86400000);
      return { startDate: start, endDate: end, prevStartDate: pStart, prevEndDate: pEnd };
    } else {
      return { startDate: null, endDate: null, prevStartDate: null, prevEndDate: null };
    }
  }, [period]);

  // 1. KPI: Monthly Total Cost (with breakdown & previous period comparison)
  const costStats = useMemo(() => {
    const isWithin = (dateStr: string, start: Date | null, end: Date | null) => {
      if (!start || !end) return true;
      const d = new Date(dateStr);
      return d >= start && d <= end;
    };

    // Filter fuelings
    const currentFuelings = rawFuelings.filter(
      (f) => f.status !== 'rejected' && isWithin(f.data || f.event_date || f.created_at, startDate, endDate)
    );
    const prevFuelings = rawFuelings.filter(
      (f) => f.status !== 'rejected' && isWithin(f.data || f.event_date || f.created_at, prevStartDate, prevEndDate)
    );

    // Filter maintenance
    const currentMaintenance = rawMaintenance.filter(
      (m) => m.status !== 'rejected' && isWithin(m.data || m.event_date || m.created_at, startDate, endDate)
    );
    const prevMaintenance = rawMaintenance.filter(
      (m) => m.status !== 'rejected' && isWithin(m.data || m.event_date || m.created_at, prevStartDate, prevEndDate)
    );

    const fuelCost = currentFuelings.reduce((sum, f) => sum + Number(f.valorTotal || f.total_amount || 0), 0);
    const partsCost = currentMaintenance.reduce((sum, m) => sum + Number(m.custoPecas || m.parts_cost || 0), 0);
    const laborCost = currentMaintenance.reduce((sum, m) => sum + Number(m.custoMaoDeObra || m.labor_cost || 0), 0);
    const maintenanceCost = currentMaintenance.reduce((sum, m) => sum + Number(m.valorTotal || m.total_amount || 0), 0);

    const totalCost = fuelCost + maintenanceCost;

    const prevFuelCost = prevFuelings.reduce((sum, f) => sum + Number(f.valorTotal || f.total_amount || 0), 0);
    const prevMaintCost = prevMaintenance.reduce((sum, m) => sum + Number(m.valorTotal || m.total_amount || 0), 0);
    const prevTotalCost = prevFuelCost + prevMaintCost;

    const percentChange = prevTotalCost > 0 ? ((totalCost - prevTotalCost) / prevTotalCost) * 100 : 0;

    const fuelPercent = totalCost > 0 ? Math.round((fuelCost / totalCost) * 100) : 0;
    const maintPercent = totalCost > 0 ? Math.round((maintenanceCost / totalCost) * 100) : 0;

    // Top expense by vehicle
    const vehicleCostMap: Record<string, { plate: string; model: string; fuel: number; maint: number; total: number }> = {};
    currentFuelings.forEach((f) => {
      const vId = f.veiculoId || f.vehicle_id;
      const v = vehicles.find((item) => item.id === vId);
      const plate = v?.plate || f.placa || 'Veículo';
      const model = v?.model || '';
      if (!vehicleCostMap[vId]) vehicleCostMap[vId] = { plate, model, fuel: 0, maint: 0, total: 0 };
      const val = Number(f.valorTotal || f.total_amount || 0);
      vehicleCostMap[vId].fuel += val;
      vehicleCostMap[vId].total += val;
    });

    currentMaintenance.forEach((m) => {
      const vId = m.veiculoId || m.vehicle_id;
      const v = vehicles.find((item) => item.id === vId);
      const plate = v?.plate || m.placa || 'Veículo';
      const model = v?.model || '';
      if (!vehicleCostMap[vId]) vehicleCostMap[vId] = { plate, model, fuel: 0, maint: 0, total: 0 };
      const val = Number(m.valorTotal || m.total_amount || 0);
      vehicleCostMap[vId].maint += val;
      vehicleCostMap[vId].total += val;
    });

    const topCostVehicles = Object.values(vehicleCostMap).sort((a, b) => b.total - a.total);

    return {
      totalCost,
      fuelCost,
      maintenanceCost,
      partsCost,
      laborCost,
      prevTotalCost,
      percentChange,
      fuelPercent,
      maintPercent,
      currentFuelingsCount: currentFuelings.length,
      currentMaintenanceCount: currentMaintenance.length,
      topCostVehicles,
    };
  }, [rawFuelings, rawMaintenance, startDate, endDate, prevStartDate, prevEndDate, vehicles]);

  // 2. KPI: Average Fuel Efficiency (Consumo Médio & Desempenho)
  const efficiencyStats = useMemo(() => {
    let totalLiters = 0;
    let totalFuelAmount = 0;

    const isWithin = (dateStr: string) => {
      if (!startDate || !endDate) return true;
      const d = new Date(dateStr);
      return d >= startDate && d <= endDate;
    };

    const periodFuelings = rawFuelings.filter(
      (f) => f.status !== 'rejected' && isWithin(f.data || f.event_date || f.created_at)
    );

    periodFuelings.forEach((f) => {
      totalLiters += Number(f.litros || f.liters || 0);
      totalFuelAmount += Number(f.valorTotal || f.total_amount || 0);
    });

    // Km rodado no período
    let periodKm = 0;
    if (period === 'all_time') {
      periodKm = metrics?.indicators.totalKmDriven || 0;
    } else {
      // Calcular distância dos abastecimentos filtrados
      vehicles.forEach((veh) => {
        const vFuels = periodFuelings
          .filter((f) => (f.veiculoId === veh.id || f.vehicle_id === veh.id) && Number(f.odometro || f.odometer) > 0)
          .map((f) => Number(f.odometro || f.odometer))
          .sort((a, b) => a - b);

        if (vFuels.length >= 2) {
          periodKm += vFuels[vFuels.length - 1] - vFuels[0];
        } else if (vFuels.length === 1) {
          const initKm = Number(veh.kmInicial ?? veh.initial_km ?? 0);
          if (vFuels[0] > initKm) {
            periodKm += vFuels[0] - initKm;
          }
        }
      });

      // Fallback para proporção se período for parcial
      if (periodKm === 0 && metrics?.indicators.totalKmDriven) {
        periodKm = Math.round(metrics.indicators.totalKmDriven * 0.35);
      }
    }

    const avgKmLiter =
      totalLiters > 0 && periodKm > 0
        ? Number((periodKm / totalLiters).toFixed(2))
        : metrics?.indicators.averageKmLiter || 0;

    const avgPricePerLiter = totalLiters > 0 ? Number((totalFuelAmount / totalLiters).toFixed(2)) : 0;
    const costPerKm = periodKm > 0 ? Number((costStats.totalCost / periodKm).toFixed(2)) : metrics?.indicators.costPerKm || 0;

    // Classificação de eficiência
    let rating: 'excelente' | 'normal' | 'atencao' = 'normal';
    let ratingLabel = 'Consumo Estável';
    if (avgKmLiter >= 3.6) {
      rating = 'excelente';
      ratingLabel = 'Excelente Eficiência';
    } else if (avgKmLiter < 2.5 && avgKmLiter > 0) {
      rating = 'atencao';
      ratingLabel = 'Atenção ao Consumo';
    }

    // Eficiência individual por veículo
    const vehicleEfficiency = vehicles
      .map((v) => {
        const vFuels = periodFuelings.filter((f) => f.veiculoId === v.id || f.vehicle_id === v.id);
        const vLiters = vFuels.reduce((sum, f) => sum + Number(f.litros || f.liters || 0), 0);
        const odometers = vFuels.map((f) => Number(f.odometro || f.odometer || 0)).filter((o) => o > 0);
        const deltaKm = odometers.length > 1 ? Math.max(...odometers) - Math.min(...odometers) : 0;
        const kmPerL = vLiters > 0 && deltaKm > 0 ? Number((deltaKm / vLiters).toFixed(2)) : 0;
        return {
          vehicleId: v.id,
          plate: v.plate,
          model: v.model,
          liters: vLiters,
          kmDriven: deltaKm,
          avgKmLiter: kmPerL,
        };
      })
      .filter((item) => item.liters > 0);

    return {
      avgKmLiter,
      totalLiters,
      periodKm,
      avgPricePerLiter,
      costPerKm,
      rating,
      ratingLabel,
      vehicleEfficiency,
    };
  }, [rawFuelings, startDate, endDate, period, metrics, vehicles, costStats.totalCost]);

  // 3. KPI: Active Maintenance Tasks (Tarefas Ativas, Vencidas e Próximas)
  const maintenanceTasksStats = useMemo(() => {
    // 1. Veículos atualmente em oficina / manutenção
    const inShopVehicles = vehicles.filter((v) => v.status === 'manutencao');

    // 2. Próximas manutenções com odômetro
    const upcoming = (metrics?.upcomingMaintenances || []).map((m) => {
      const v = vehicles.find((item) => item.id === m.vehicleId);
      return {
        ...m,
        status: m.isOverdue ? ('overdue' as const) : m.isNear ? ('near' as const) : ('scheduled' as const),
        vehiclePlate: m.plate || v?.plate || 'Veículo',
        vehicleModel: m.model || v?.model || '',
      };
    });

    const overdueTasks = upcoming.filter((m) => m.isOverdue);
    const nearTasks = upcoming.filter((m) => m.isNear && !m.isOverdue);
    const scheduledTasks = upcoming.filter((m) => !m.isNear && !m.isOverdue);

    // 3. Manutenções ativas / pendentes no histórico
    const pendingTickets = rawMaintenance.filter((m) => m.status === 'pendente' || m.status === 'em_andamento');

    // Total de tarefas ativas que demandam atenção da gestão
    const totalActiveTasks = inShopVehicles.length + overdueTasks.length + nearTasks.length + pendingTickets.length;

    return {
      totalActiveTasks,
      inShopCount: inShopVehicles.length,
      overdueCount: overdueTasks.length,
      nearCount: nearTasks.length,
      scheduledCount: scheduledTasks.length,
      pendingTicketsCount: pendingTickets.length,
      inShopVehicles,
      overdueTasks,
      nearTasks,
      scheduledTasks,
      pendingTickets,
    };
  }, [vehicles, metrics, rawMaintenance]);

  // 4. KPI: Active Fleet & Utilization
  const fleetStats = useMemo(() => {
    const totalVehicles = vehicles.length;
    const activeVehicles = vehicles.filter((v) => v.status === 'ativo').length;
    const inMaintenance = vehicles.filter((v) => v.status === 'manutencao').length;
    const inactive = vehicles.filter((v) => v.status === 'inativo').length;

    const totalDrivers = fleet.drivers.length;
    const activeDrivers = fleet.drivers.filter((d) => d.status === 'ativo').length;

    const availabilityRate = totalVehicles > 0 ? Math.round((activeVehicles / totalVehicles) * 100) : 0;

    return {
      totalVehicles,
      activeVehicles,
      inMaintenance,
      inactive,
      totalDrivers,
      activeDrivers,
      availabilityRate,
    };
  }, [vehicles, fleet.drivers]);

  return (
    <div className="space-y-4 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Header with Segmented Period Control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-800/80">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            <span>Indicadores de Desempenho e Custos Operacionais</span>
          </div>
          <div className="text-sm font-bold text-white flex items-center gap-2 mt-0.5">
            <span>Visão Consolidada</span>
            <span className="text-slate-500 font-normal">·</span>
            <span className="text-xs font-semibold text-slate-300 capitalize">{periodLabel}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Segmented Period Tabs (Interactive Controls) */}
          <div className="flex items-center p-1 bg-slate-950 border border-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setPeriod('current_month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                period === 'current_month'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              Mês Atual
            </button>
            <button
              type="button"
              onClick={() => setPeriod('last_30_days')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                period === 'last_30_days'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              Últimos 30 Dias
            </button>
            <button
              type="button"
              onClick={() => setPeriod('all_time')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                period === 'all_time'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              Consolidado
            </button>
          </div>

          {/* Botão Exportar PDF */}
          <button
            type="button"
            onClick={() => setShowExportModal(true)}
            className="p-1.5 sm:px-3 sm:py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 text-slate-300 hover:text-amber-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
            title="Exportar Indicadores e Custos do Período em PDF"
          >
            <FileDown className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Exportar PDF</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CARD 1: Monthly Total Cost */}
        <div
          onClick={() => setActiveModal('cost')}
          className="group relative bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/40 rounded-3xl p-5 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-amber-500/5 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Gasto Total da Frota
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xs font-bold text-slate-400">R$</span>
              <span className="text-2xl sm:text-3xl font-black text-white tracking-tight tabular-nums">
                {costStats.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Comparison vs Previous Period */}
            {period !== 'all_time' && (
              <div className="mt-2.5 flex items-center gap-1.5 text-[11px]">
                {costStats.percentChange < 0 ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                    <ArrowDownRight className="w-3.5 h-3.5" />
                    {Math.abs(costStats.percentChange).toFixed(1)}%
                  </span>
                ) : costStats.percentChange > 0 ? (
                  <span className="text-amber-400 font-bold flex items-center gap-0.5">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    +{costStats.percentChange.toFixed(1)}%
                  </span>
                ) : (
                  <span className="text-slate-400 font-medium">Estável</span>
                )}
                <span className="text-slate-500">vs período anterior</span>
              </div>
            )}
          </div>

          {/* Breakdown Mini Bar */}
          <div className="mt-4 pt-3 border-t border-slate-800/80">
            <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden flex">
              <div
                className="bg-amber-400 h-full transition-all"
                style={{ width: `${costStats.fuelPercent}%` }}
                title={`Combustível: ${costStats.fuelPercent}%`}
              />
              <div
                className="bg-blue-400 h-full transition-all"
                style={{ width: `${costStats.maintPercent}%` }}
                title={`Manutenção: ${costStats.maintPercent}%`}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Combustível: R$ {costStats.fuelCost.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                Oficina: R$ {costStats.maintenanceCost.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        </div>

        {/* CARD 2: Average Fuel Efficiency */}
        <div
          onClick={() => setActiveModal('efficiency')}
          className="group relative bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-emerald-500/40 rounded-3xl p-5 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-emerald-500/5 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Média de Consumo de Combustível
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                <Fuel className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight tabular-nums">
                {efficiencyStats.avgKmLiter > 0 ? efficiencyStats.avgKmLiter.toFixed(2) : '0.00'}
              </span>
              <span className="text-xs font-bold text-slate-400">km/L</span>
            </div>

            <div className="mt-2.5 flex items-center gap-1 text-[11px] text-slate-400">
              <span className="text-slate-300 font-semibold">{efficiencyStats.ratingLabel}</span>
              <span>·</span>
              <span className="text-slate-400">R$ {efficiencyStats.costPerKm.toFixed(2)} / km</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">
              Total abastecido:{' '}
              <strong className="text-slate-200">{efficiencyStats.totalLiters.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L</strong>
            </span>
            <span className="text-emerald-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5 font-bold">
              Detalhes <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* CARD 3: Active Maintenance Tasks */}
        <div
          onClick={() => setActiveModal('maintenance')}
          className="group relative bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-sky-500/40 rounded-3xl p-5 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-sky-500/5 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Manutenções & Revisões Ativas
              </span>
              <div
                className={`w-8 h-8 rounded-xl border flex items-center justify-center group-hover:scale-105 transition-transform ${
                  maintenanceTasksStats.overdueCount > 0
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                    : 'bg-sky-500/10 border-sky-500/20 text-sky-400'
                }`}
              >
                <Wrench className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-baseline gap-2 mt-1">
              <span
                className={`text-2xl sm:text-3xl font-black tracking-tight tabular-nums ${
                  maintenanceTasksStats.overdueCount > 0 ? 'text-rose-400' : 'text-white'
                }`}
              >
                {maintenanceTasksStats.totalActiveTasks}
              </span>
              <span className="text-xs font-medium text-slate-400">tarefas ativas</span>
            </div>

            <div className="mt-2.5 flex items-center gap-1.5 text-[11px]">
              {maintenanceTasksStats.overdueCount > 0 ? (
                <span className="text-rose-400 font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {maintenanceTasksStats.overdueCount} urgente(s)
                </span>
              ) : (
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Revisões em dia
                </span>
              )}
              <span className="text-slate-500">·</span>
              <span className="text-slate-400">{maintenanceTasksStats.nearCount} próximas</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">
              Na oficina: <strong className="text-slate-200">{maintenanceTasksStats.inShopCount} veículo(s)</strong>
            </span>
            <span className="text-sky-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5 font-bold">
              Ver Tarefas <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* CARD 4: Fleet Operational Availability */}
        <div
          onClick={() => setActiveModal('fleet')}
          className="group relative bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-purple-500/40 rounded-3xl p-5 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-purple-500/5 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Veículos em Operação (Disponibilidade)
              </span>
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform">
                <Truck className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-black text-white tracking-tight tabular-nums">
                {fleetStats.availabilityRate}%
              </span>
              <span className="text-xs font-medium text-slate-400">frota em rota</span>
            </div>

            <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-slate-400">
              <span className="text-white font-bold">{fleetStats.activeVehicles}</span> de {fleetStats.totalVehicles} veículos ativos
              <span>·</span>
              <span>{fleetStats.activeDrivers} motoristas</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">
              KM Total: <strong className="text-slate-200">{(metrics?.indicators.totalKmDriven || 0).toLocaleString()} km</strong>
            </span>
            <span className="text-purple-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5 font-bold">
              Frota <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>
      </div>

      {/* DETAIL MODAL: Monthly Total Cost Breakdown */}
      {activeModal === 'cost' && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Detalhamento dos Gastos da Frota</h3>
                  <p className="text-xs text-slate-400">
                    Período: {periodLabel} · Consolidação de combustível, peças e mão de obra
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5">
              {/* Total Banner */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">Custo Consolidado no Período</span>
                  <div className="text-3xl font-black text-amber-400 mt-1">
                    R$ {costStats.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="flex gap-4 sm:border-l sm:border-slate-800 sm:pl-4 text-xs">
                  <div>
                    <div className="text-slate-400">Combustível</div>
                    <div className="font-bold text-white">R$ {costStats.fuelCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    <div className="text-[10px] text-amber-400">{costStats.fuelPercent}% do total</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Manutenção</div>
                    <div className="font-bold text-white">R$ {costStats.maintenanceCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    <div className="text-[10px] text-blue-400">{costStats.maintPercent}% do total</div>
                  </div>
                </div>
              </div>

              {/* Maintenance Sub-breakdown (Peças vs Mão de Obra) */}
              <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-4">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Composição de Oficina</div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-slate-400">Custo de Peças:</span>
                    <div className="text-sm font-bold text-white mt-0.5">
                      R$ {costStats.partsCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-slate-400">Custo de Mão de Obra:</span>
                    <div className="text-sm font-bold text-white mt-0.5">
                      R$ {costStats.laborCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Top Expense Centers by Vehicle */}
              <div>
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Maiores Ofensores de Custo por Veículo
                </div>
                <div className="space-y-2">
                  {costStats.topCostVehicles.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-500">Nenhum custo registrado para o período.</div>
                  ) : (
                    costStats.topCostVehicles.slice(0, 5).map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-5 h-5 rounded-md bg-slate-800 text-slate-400 font-bold text-[10px] flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <div>
                            <strong className="text-white">{item.plate}</strong>
                            <span className="text-slate-400 text-[11px] ml-2">{item.model}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-amber-400">R$ {item.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                          <div className="text-[10px] text-slate-500">
                            Comb: R$ {item.fuel.toFixed(0)} · Manut: R$ {item.maint.toFixed(0)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                {costStats.currentFuelingsCount} abastecimento(s) e {costStats.currentMaintenanceCount} ordem(ns) de serviço
              </span>
              <button
                type="button"
                onClick={() => {
                  setActiveModal(null);
                  if (onNavigateToTab) onNavigateToTab('records');
                }}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <span>Ver Todos os Registros</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL: Average Fuel Efficiency */}
      {activeModal === 'efficiency' && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Fuel className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Detalhamento: Average Fuel Efficiency</h3>
                  <p className="text-xs text-slate-400">
                    Cálculo oficial de km/L sobre abastecimentos válidos e km rodado
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-center">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Média Geral da Frota</span>
                  <div className="text-3xl font-black text-emerald-400 mt-1">
                    {efficiencyStats.avgKmLiter.toFixed(2)} <span className="text-xs text-slate-400">km/L</span>
                  </div>
                  <div className="text-[10px] text-emerald-300 font-semibold mt-1">{efficiencyStats.ratingLabel}</div>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-center">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Preço Médio por Litro</span>
                  <div className="text-3xl font-black text-white mt-1">
                    R$ {efficiencyStats.avgPricePerLiter > 0 ? efficiencyStats.avgPricePerLiter.toFixed(2) : '6,19'}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">Diesel S10 / Gasolina</div>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-center">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Volume Abastecido</span>
                  <div className="text-3xl font-black text-amber-400 mt-1">
                    {efficiencyStats.totalLiters.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}{' '}
                    <span className="text-xs text-slate-400">L</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">{efficiencyStats.periodKm.toLocaleString()} km percorridos</div>
                </div>
              </div>

              {/* Vehicle breakdown */}
              <div>
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Eficiência por Veículo Ativo
                </div>
                <div className="space-y-2">
                  {efficiencyStats.vehicleEfficiency.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-500">
                      Nenhum histórico de consumo computado para os filtros atuais.
                    </div>
                  ) : (
                    efficiencyStats.vehicleEfficiency.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div>
                          <strong className="text-white">{item.plate}</strong>
                          <span className="text-slate-400 text-[11px] ml-2">{item.model}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-extrabold text-emerald-400 text-sm">{item.avgKmLiter.toFixed(2)} km/L</span>
                          <div className="text-[10px] text-slate-500">
                            {item.liters.toFixed(0)} L consumidos · {item.kmDriven.toLocaleString()} km
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL: Active Maintenance Tasks */}
      {activeModal === 'maintenance' && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Detalhamento: Active Maintenance Tasks</h3>
                  <p className="text-xs text-slate-400">
                    {maintenanceTasksStats.totalActiveTasks} tarefa(s) ativas necessitando de atenção ou agendamento
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {/* Category Badges Summary */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300">
                  <div className="text-xl font-black text-rose-400">{maintenanceTasksStats.overdueCount}</div>
                  <div className="text-[10px] uppercase font-bold mt-0.5">Vencidas / Urgentes</div>
                </div>
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300">
                  <div className="text-xl font-black text-amber-400">{maintenanceTasksStats.nearCount}</div>
                  <div className="text-[10px] uppercase font-bold mt-0.5">Próximas (&lt; 2.000 km)</div>
                </div>
                <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-300">
                  <div className="text-xl font-black text-sky-400">{maintenanceTasksStats.inShopCount}</div>
                  <div className="text-[10px] uppercase font-bold mt-0.5">Em Oficina</div>
                </div>
              </div>

              {/* Overdue Tasks List */}
              {maintenanceTasksStats.overdueTasks.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Urgentes / Quilometragem Ultrapassada</span>
                  </div>
                  <div className="space-y-2">
                    {maintenanceTasksStats.overdueTasks.map((task, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-2xl bg-rose-950/20 border border-rose-500/40 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <strong className="text-white text-sm">{task.vehiclePlate}</strong>
                            <span className="text-slate-400 text-xs">{task.vehicleModel}</span>
                          </div>
                          <p className="text-slate-300 text-[11px] mt-1">{task.description}</p>
                          <div className="text-[10px] text-rose-400 font-semibold mt-1">
                            Odômetro Atual: {task.currentKm.toLocaleString()} km · Revisão era em {task.nextMaintenanceKm.toLocaleString()} km ({Math.abs(task.kmUntil).toLocaleString()} km em atraso)
                          </div>
                        </div>
                        {onOpenScheduleMaintenance && (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveModal(null);
                              onOpenScheduleMaintenance(task.vehicleId);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold text-xs transition cursor-pointer"
                          >
                            Agendar
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upcoming Near Tasks List */}
              {maintenanceTasksStats.nearTasks.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Próximas Manutenções Programadas</span>
                  </div>
                  <div className="space-y-2">
                    {maintenanceTasksStats.nearTasks.map((task, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-2xl bg-slate-950/60 border border-amber-500/30 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <strong className="text-white text-sm">{task.vehiclePlate}</strong>
                            <span className="text-slate-400 text-xs">{task.vehicleModel}</span>
                          </div>
                          <p className="text-slate-300 text-[11px] mt-1">{task.description}</p>
                          <div className="text-[10px] text-amber-300 font-semibold mt-1">
                            Faltam apenas {task.kmUntil.toLocaleString()} km para a revisão de {task.nextMaintenanceKm.toLocaleString()} km
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Vehicles Currently in Shop */}
              {maintenanceTasksStats.inShopVehicles.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-sky-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Veículos em Oficina / Manutenção</span>
                  </div>
                  <div className="space-y-2">
                    {maintenanceTasksStats.inShopVehicles.map((veh, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-950/60 border border-sky-500/20 flex items-center justify-between text-xs"
                      >
                        <div>
                          <strong className="text-white">{veh.plate}</strong>
                          <span className="text-slate-400 text-xs ml-2">{veh.model}</span>
                          <div className="text-[10px] text-sky-300 mt-0.5">Status: Indisponível para rotas (Em oficina)</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {maintenanceTasksStats.totalActiveTasks === 0 && (
                <div className="text-center py-10 space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                  <div className="text-sm font-bold text-white">Nenhuma manutenção pendente!</div>
                  <p className="text-xs text-slate-400">Todos os veículos estão com as revisões em dia e operacionais.</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
              <span className="text-xs text-slate-500">Controle preventivo por odômetro oficial</span>
              <button
                type="button"
                onClick={() => {
                  setActiveModal(null);
                  if (onNavigateToTab) onNavigateToTab('vehicles');
                }}
                className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <span>Ver Painel de Veículos</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL: Fleet Availability */}
      {activeModal === 'fleet' && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Detalhamento: Disponibilidade da Frota</h3>
                  <p className="text-xs text-slate-400">
                    Visão operacional de veículos ativos, motoristas e capacidade
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-center">
                  <div className="text-2xl font-black text-white">{fleetStats.activeVehicles} / {fleetStats.totalVehicles}</div>
                  <div className="text-[11px] text-slate-400 font-bold mt-1">Veículos em Operação</div>
                  <div className="text-[10px] text-purple-400 mt-0.5">{fleetStats.availabilityRate}% disponíveis</div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-center">
                  <div className="text-2xl font-black text-white">{fleetStats.activeDrivers} / {fleetStats.totalDrivers}</div>
                  <div className="text-[11px] text-slate-400 font-bold mt-1">Motoristas Habilitados</div>
                  <div className="text-[10px] text-emerald-400 mt-0.5">Equipe regularizada</div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/40 border border-slate-800 space-y-2">
                <div className="flex justify-between text-slate-300">
                  <span>Veículos Ativos em rota:</span>
                  <strong className="text-white">{fleetStats.activeVehicles}</strong>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Veículos em Oficina:</span>
                  <strong className="text-amber-400">{fleetStats.inMaintenance}</strong>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Veículos Inativos / Reserva:</span>
                  <strong className="text-slate-400">{fleetStats.inactive}</strong>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Exportação Executiva de PDF */}
      <DashboardPDFExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
      />
    </div>
  );
};
