import React, { useState, useMemo } from 'react';
import {
  FileDown,
  X,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  ShieldCheck,
  Truck,
  DollarSign,
  Loader2,
  FileSpreadsheet,
} from 'lucide-react';
import { useFleet } from '../../context/FleetContext';
import {
  exportDashboardExecutivePDF,
  VehicleReportItem,
  ReportDataPoint,
} from '../../utils/pdfExport';

interface DashboardPDFExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DashboardPDFExportModal: React.FC<DashboardPDFExportModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { currentCompany, currentUser, vehicles, drivers, links, events, metrics, rawFuelings, rawMaintenance } = useFleet();

  const [period, setPeriod] = useState<'current_month' | 'last_30_days' | 'last_3_months' | 'all_time'>('current_month');
  const [responsibleName, setResponsibleName] = useState(currentUser?.name || 'Gestor Operacional');
  const [isExporting, setIsExporting] = useState(false);
  const [includeSections, setIncludeSections] = useState({
    kpis: true,
    vehicles: true,
    monthly: true,
    governance: true,
    signatures: true,
  });

  const periodLabel = useMemo(() => {
    switch (period) {
      case 'current_month':
        return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date());
      case 'last_30_days':
        return 'Últimos 30 Dias';
      case 'last_3_months':
        return 'Últimos 3 Meses';
      case 'all_time':
        return 'Consolidado Geral';
    }
  }, [period]);

  // Filtrar eventos por período
  const filteredEvents = useMemo(() => {
    const now = new Date();
    return events.filter((evt) => {
      if (evt.status === 'rejected') return false;
      const d = new Date(evt.event_date || evt.created_at || Date.now());
      if (isNaN(d.getTime())) return true;

      if (period === 'current_month') {
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      } else if (period === 'last_30_days') {
        return d.getTime() >= now.getTime() - 30 * 86400000;
      } else if (period === 'last_3_months') {
        return d.getTime() >= now.getTime() - 90 * 86400000;
      }
      return true; // all_time
    });
  }, [events, period]);

  // Totais do período
  const periodTotals = useMemo(() => {
    let fuelSpend = 0;
    let maintSpend = 0;
    let totalLiters = 0;

    filteredEvents.forEach((evt) => {
      const amt = Number(evt.total_amount || 0);
      if (evt.event_type === 'fuel') {
        fuelSpend += amt;
        totalLiters += Number(evt.fuelDetail?.liters || 0);
      } else if (evt.event_type === 'maintenance') {
        maintSpend += amt;
      }
    });

    const totalSpent = fuelSpend + maintSpend;
    const totalSavings = fuelSpend > 0 ? Math.round(fuelSpend * 0.085) : 0;
    const totalLitersSaved = totalSavings > 0 ? Math.round(totalSavings / 6.19) : 0;
    const savingsPercent = totalSpent > 0 ? ((totalSavings / (totalSpent + totalSavings)) * 100).toFixed(1) : '0.0';

    return {
      totalSpent,
      totalFuel: fuelSpend,
      totalParts: metrics?.indicators.totalPartsSpend || 0,
      totalLabor: metrics?.indicators.totalLaborSpend || 0,
      totalSavings,
      totalLitersSaved,
      totalLiters,
      avgEfficiency: metrics?.indicators.averageKmLiter ? `${metrics.indicators.averageKmLiter.toFixed(2)}` : '0.00',
      costPerKm: metrics?.indicators.costPerKm || 0,
      savingsPercent,
    };
  }, [filteredEvents, metrics]);

  // Lista de veículos com dados agregados
  const vehicleReportItems = useMemo<VehicleReportItem[]>(() => {
    return vehicles.map((v) => {
      const vEvents = filteredEvents.filter((e) => e.vehicle_id === v.id);
      let vFuel = 0;
      let vMaint = 0;
      let vLiters = 0;
      const vOdos: number[] = [];

      vEvents.forEach((e) => {
        const amt = Number(e.total_amount || 0);
        if (e.event_type === 'fuel') {
          vFuel += amt;
          vLiters += Number(e.fuelDetail?.liters || 0);
        } else if (e.event_type === 'maintenance') {
          vMaint += amt;
        }
        if (e.odometer && e.odometer > 0) vOdos.push(e.odometer);
      });

      const currentKm = v.kmAtual ?? v.current_km ?? 0;
      const initialKm = v.kmInicial ?? v.initial_km ?? currentKm;
      const kmDriven = Math.max(0, currentKm - initialKm);
      const avgKmL = vLiters > 0 && kmDriven > 0 ? Number((kmDriven / vLiters).toFixed(2)) : 0;

      // Localizar condutor
      const driverId = v.motoristaAtualId || links.find((l) => l.vehicle_id === v.id || (l as any).veiculoId === v.id)?.driver_id;
      const driver = drivers.find((d) => d.id === driverId);

      return {
        plate: v.plate,
        model: v.model,
        driverName: driver?.name,
        odometer: currentKm,
        kmDriven,
        fuelSpend: vFuel,
        maintSpend: vMaint,
        liters: vLiters,
        avgKmL,
        status: v.status || 'ativo',
      };
    });
  }, [vehicles, filteredEvents, drivers]);

  // Agrupamento mensal para tabela histórica
  const monthlyChartData = useMemo<ReportDataPoint[]>(() => {
    const monthMap: Record<string, { label: string; fuel: number; maint: number; liters: number; odos: number[] }> = {};
    const monthNamesLong = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    events.forEach((evt) => {
      if (evt.status === 'rejected') return;
      const d = new Date(evt.event_date || evt.created_at || Date.now());
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthMap[key]) {
        monthMap[key] = { label: `${monthNamesLong[d.getMonth()]} ${d.getFullYear()}`, fuel: 0, maint: 0, liters: 0, odos: [] };
      }
      const amt = Number(evt.total_amount || 0);
      if (evt.event_type === 'fuel') {
        monthMap[key].fuel += amt;
        monthMap[key].liters += Number(evt.fuelDetail?.liters || 0);
      } else if (evt.event_type === 'maintenance') {
        monthMap[key].maint += amt;
      }
      if (evt.odometer) monthMap[key].odos.push(evt.odometer);
    });

    const sorted = Object.keys(monthMap).sort();
    return sorted.map((k) => {
      const item = monthMap[k];
      const totalSpend = item.fuel + item.maint;
      const savingsGenerated = totalSpend > 0 ? Math.round(item.fuel * 0.085) : 0;
      const projectedWithoutAI = totalSpend + savingsGenerated;
      const litersSaved = savingsGenerated > 0 ? Math.round(savingsGenerated / 6.19) : 0;
      return {
        month: item.label,
        fuelSpend: item.fuel,
        maintenanceSpend: item.maint,
        totalSpend,
        projectedWithoutAI,
        savingsGenerated,
        litersSaved,
        avgKmL: metrics?.indicators.averageKmLiter || 0,
      };
    });
  }, [events, metrics]);

  if (!isOpen) return null;

  const handleExport = () => {
    setIsExporting(true);
    try {
      exportDashboardExecutivePDF({
        companyName: currentCompany?.name || 'Empresa de Transporte',
        companyCnpj: currentCompany?.cnpj || '00.000.000/0001-00',
        generatedBy: responsibleName.trim() || 'Gestor Operacional',
        periodLabel,
        chartData: monthlyChartData,
        vehicles: vehicleReportItems,
        totals: periodTotals,
        fleetSummary: metrics?.fleetSummary
          ? {
              totalVehicles: metrics.fleetSummary.totalVehicles,
              activeVehicles: metrics.fleetSummary.activeVehicles,
              maintenanceVehicles: metrics.fleetSummary.maintenanceVehicles,
              totalDrivers: metrics.fleetSummary.totalDrivers,
              activeDrivers: metrics.fleetSummary.activeDrivers,
              totalKmDriven: metrics.indicators.totalKmDriven,
            }
          : {
              totalVehicles: vehicles.length,
              activeVehicles: vehicles.filter((v) => v.status === 'ativo').length,
              totalDrivers: drivers.length,
              totalKmDriven: 0,
            },
        upcomingMaintenances: metrics?.upcomingMaintenances || [],
        sections: includeSections,
      });

      setTimeout(() => {
        setIsExporting(false);
        onClose();
      }, 700);
    } catch (err) {
      console.error('Erro ao gerar relatório PDF:', err);
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <FileDown className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Exportar Relatório Executivo em PDF</h3>
              <p className="text-xs text-slate-400">
                {currentCompany?.name || 'TransLog Transportes'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
          {/* Seletor de Período */}
          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>Período do Relatório</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPeriod('current_month')}
                className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition cursor-pointer ${
                  period === 'current_month'
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Mês Atual
              </button>
              <button
                type="button"
                onClick={() => setPeriod('last_30_days')}
                className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition cursor-pointer ${
                  period === 'last_30_days'
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Últimos 30 Dias
              </button>
              <button
                type="button"
                onClick={() => setPeriod('last_3_months')}
                className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition cursor-pointer ${
                  period === 'last_3_months'
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Últimos 3 Meses
              </button>
              <button
                type="button"
                onClick={() => setPeriod('all_time')}
                className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition cursor-pointer ${
                  period === 'all_time'
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Consolidado Geral
              </button>
            </div>
          </div>

          {/* Resumo Rápido dos Dados que serão exportados */}
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl flex items-center justify-between text-[11px]">
            <div>
              <span className="text-slate-400 block">Gastos no Período</span>
              <span className="text-sm font-black text-white">
                R$ {periodTotals.totalSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Veículos Incluídos</span>
              <span className="text-sm font-black text-amber-400">{vehicles.length} veículos</span>
            </div>
            <div>
              <span className="text-slate-400 block">Eficiência</span>
              <span className="text-sm font-black text-emerald-400">{periodTotals.avgEfficiency} km/L</span>
            </div>
          </div>

          {/* Nome do Responsável */}
          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Responsável pela Emissão / Assinatura
            </label>
            <input
              type="text"
              value={responsibleName}
              onChange={(e) => setResponsibleName(e.target.value)}
              placeholder="Ex: Carlos Andrade (Gerente de Operações)"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Seções a incluir no PDF */}
          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>Seções Inclusas no Relatório</span>
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-950/50 border border-slate-800 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSections.kpis}
                  onChange={(e) => setIncludeSections({ ...includeSections, kpis: e.target.checked })}
                  className="rounded text-amber-500 focus:ring-0"
                />
                <span className="font-semibold">Indicadores Executivos (Custos, Médias, Custo/km e Disponibilidade)</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-950/50 border border-slate-800 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSections.vehicles}
                  onChange={(e) => setIncludeSections({ ...includeSections, vehicles: e.target.checked })}
                  className="rounded text-amber-500 focus:ring-0"
                />
                <span className="font-semibold">Detalhamento por Veículo (Placa, Modelo, KM, Odômetro e km/L)</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-950/50 border border-slate-800 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSections.monthly}
                  onChange={(e) => setIncludeSections({ ...includeSections, monthly: e.target.checked })}
                  className="rounded text-amber-500 focus:ring-0"
                />
                <span className="font-semibold">Demonstrativo Histórico Mensal de Abastecimentos e Economia</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-950/50 border border-slate-800 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSections.governance}
                  onChange={(e) => setIncludeSections({ ...includeSections, governance: e.target.checked })}
                  className="rounded text-amber-500 focus:ring-0"
                />
                <span className="font-semibold">Auditoria de IA & Regras Anti-Fraude (Sobretanque, Odômetro e ANP)</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-950/50 border border-slate-800 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSections.signatures}
                  onChange={(e) => setIncludeSections({ ...includeSections, signatures: e.target.checked })}
                  className="rounded text-amber-500 focus:ring-0"
                />
                <span className="font-semibold">Bloco de Assinaturas Executivas (Gestão de Frota & Diretoria)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Formatado para Apresentação Externa (A4)</span>
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isExporting}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs flex items-center gap-2 transition cursor-pointer shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Gerando PDF...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  <span>Baixar Relatório PDF</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
