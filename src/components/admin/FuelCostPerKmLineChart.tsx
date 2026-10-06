import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  TrendingUp,
  Fuel,
  Truck,
  DollarSign,
  Gauge,
  Sparkles,
  Layers,
  Info,
  ChevronDown,
  CheckCircle2,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { FleetEvent, DashboardMetrics, Vehicle } from '../../types/fleet';
import { useFleet } from '../../context/FleetContext';

interface FuelCostPerKmLineChartProps {
  events?: FleetEvent[];
  metrics?: DashboardMetrics | null;
  vehicles?: Vehicle[];
}

interface ChartDayPoint {
  dateKey: string; // YYYY-MM-DD
  dateLabel: string; // DD/MM
  fullDate: string; // DD de MMM
  costPerKm: number; // R$/km
  pricePerLiter: number; // R$/L
  avgKmL: number; // km/L
  totalSpent: number; // R$
  totalLiters: number;
  totalKm: number;
  hasEvent: boolean;
  eventCount: number;
  vehiclePlates: string[];
}

export const FuelCostPerKmLineChart: React.FC<FuelCostPerKmLineChartProps> = ({
  events: propEvents,
  metrics: propMetrics,
  vehicles: propVehicles,
}) => {
  const fleet = useFleet();
  const events = propEvents ?? fleet.events;
  const metrics = propMetrics ?? fleet.metrics;
  const vehicles = propVehicles ?? fleet.vehicles;

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('all');
  const [showPricePerLiter, setShowPricePerLiter] = useState<boolean>(true);
  const [showKmLiter, setShowKmLiter] = useState<boolean>(false);

  // 1. Filtrar eventos de combustível dos últimos 30 dias
  const last30DaysFuelData = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    // Filtrar apenas eventos de combustível confirmados/válidos
    const fuelEvents = events.filter((e) => {
      if (e.status === 'rejected') return false;
      if (e.event_type !== 'fuel') return false;
      const d = new Date(e.event_date || e.created_at || Date.now());
      if (isNaN(d.getTime())) return false;
      if (d < thirtyDaysAgo) return false;
      if (selectedVehicleId !== 'all' && e.vehicle_id !== selectedVehicleId) return false;
      return true;
    });

    return fuelEvents;
  }, [events, selectedVehicleId]);

  // 2. Construir mapa diário contínuo dos últimos 30 dias
  const { chartData, kpiStats, totalFuelingsCount } = useMemo(() => {
    const now = new Date();
    const daysMap = new Map<string, {
      dateKey: string;
      dateLabel: string;
      fullDate: string;
      fuelEvents: FleetEvent[];
    }>();

    // Inicializar os 30 dias contínuos
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;
      const dateLabel = `${day}/${month}`;
      const fullDate = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

      daysMap.set(dateKey, {
        dateKey,
        dateLabel,
        fullDate,
        fuelEvents: [],
      });
    }

    // Distribuir eventos pelos dias
    last30DaysFuelData.forEach((evt) => {
      const d = new Date(evt.event_date || evt.created_at || Date.now());
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;

      if (daysMap.has(dateKey)) {
        daysMap.get(dateKey)!.fuelEvents.push(evt);
      }
    });

    // Calcular custos e médias por dia
    const points: ChartDayPoint[] = [];
    let cumulativeCostPerKmSum = 0;
    let validDaysWithCostCount = 0;
    let minCost = Infinity;
    let maxCost = -Infinity;
    let totalSpentIn30d = 0;
    let totalLitersIn30d = 0;
    let totalKmIn30d = 0;
    let lastKnownCostPerKm = 0;
    let lastKnownPricePerLiter = 0;
    let lastKnownKmL = 0;

    const fallbackAvgPrice = metrics?.indicators.totalLiters && metrics.indicators.totalLiters > 0
      ? Number((metrics.indicators.totalFuelSpend / metrics.indicators.totalLiters).toFixed(2))
      : 0;

    // Calcular valores por dia
    Array.from(daysMap.values()).forEach((day) => {
      const evts = day.fuelEvents;
      let daySpent = 0;
      let dayLiters = 0;
      let dayCostPerKm = 0;
      let dayPricePerLiter = 0;
      let dayKmL = 0;
      const vehiclePlates: string[] = [];

      if (evts.length > 0) {
        let dayKmSum = 0;
        let dayCostPerKmWeightedSum = 0;

        evts.forEach((e) => {
          const amt = Number(e.total_amount || 0);
          const liters = Number(e.fuelDetail?.liters || 0);
          const priceLit = Number(e.fuelDetail?.price_per_liter || (liters > 0 ? amt / liters : 0));
          const calculatedCostKm = Number(e.fuelDetail?.calculated_cost_per_km || 0);
          const calculatedKmL = Number(e.fuelDetail?.calculated_km_per_liter || 0);
          const deltaKm = Number(e.fuelDetail?.calculated_km_delta || 0);

          daySpent += amt;
          dayLiters += liters;
          dayKmSum += deltaKm;

          // Localizar veículo
          const veh = vehicles.find((v) => v.id === e.vehicle_id);
          if (veh && !vehiclePlates.includes(veh.plate)) {
            vehiclePlates.push(veh.plate);
          }

          // Custo por km do abastecimento
          let singleCostKm = calculatedCostKm;
          if (!singleCostKm || singleCostKm <= 0) {
            if (deltaKm > 0 && amt > 0) {
              singleCostKm = amt / deltaKm;
            } else if (calculatedKmL > 0 && priceLit > 0) {
              singleCostKm = priceLit / calculatedKmL;
            } else if (metrics?.indicators.averageKmLiter && metrics.indicators.averageKmLiter > 0 && priceLit > 0) {
              singleCostKm = priceLit / metrics.indicators.averageKmLiter;
            } else {
              singleCostKm = priceLit > 0 ? priceLit / 2.5 : 0;
            }
          }

          dayCostPerKmWeightedSum += singleCostKm * (amt || 1);
        });

        dayCostPerKm = Number((dayCostPerKmWeightedSum / (daySpent || 1)).toFixed(2));
        dayPricePerLiter = dayLiters > 0 ? Number((daySpent / dayLiters).toFixed(2)) : 0;
        dayKmL = dayLiters > 0 && dayKmSum > 0 ? Number((dayKmSum / dayLiters).toFixed(2)) : (dayPricePerLiter > 0 && dayCostPerKm > 0 ? Number((dayPricePerLiter / dayCostPerKm).toFixed(2)) : 0);

        lastKnownCostPerKm = dayCostPerKm;
        lastKnownPricePerLiter = dayPricePerLiter;
        lastKnownKmL = dayKmL;

        cumulativeCostPerKmSum += dayCostPerKm;
        validDaysWithCostCount++;

        if (dayCostPerKm < minCost) minCost = dayCostPerKm;
        if (dayCostPerKm > maxCost) maxCost = dayCostPerKm;

        totalSpentIn30d += daySpent;
        totalLitersIn30d += dayLiters;
        totalKmIn30d += dayKmSum;

        points.push({
          dateKey: day.dateKey,
          dateLabel: day.dateLabel,
          fullDate: day.fullDate,
          costPerKm: dayCostPerKm,
          pricePerLiter: dayPricePerLiter,
          avgKmL: dayKmL,
          totalSpent: daySpent,
          totalLiters: dayLiters,
          totalKm: dayKmSum,
          hasEvent: true,
          eventCount: evts.length,
          vehiclePlates,
        });
      } else {
        // Dia sem abastecimento registrado:
        // Mantém a última cotação conhecida de custo/km para continuidade suave da curva
        points.push({
          dateKey: day.dateKey,
          dateLabel: day.dateLabel,
          fullDate: day.fullDate,
          costPerKm: lastKnownCostPerKm > 0 ? lastKnownCostPerKm : (metrics?.indicators.costPerKm || 0),
          pricePerLiter: lastKnownPricePerLiter > 0 ? lastKnownPricePerLiter : fallbackAvgPrice,
          avgKmL: lastKnownKmL > 0 ? lastKnownKmL : (metrics?.indicators.averageKmLiter || 0),
          totalSpent: 0,
          totalLiters: 0,
          totalKm: 0,
          hasEvent: false,
          eventCount: 0,
          vehiclePlates: [],
        });
      }
    });

    const averageCostPerKm = validDaysWithCostCount > 0
      ? Number((cumulativeCostPerKmSum / validDaysWithCostCount).toFixed(2))
      : (metrics?.indicators.costPerKm || 0);

    const averagePricePerLiter = totalLitersIn30d > 0
      ? Number((totalSpentIn30d / totalLitersIn30d).toFixed(2))
      : fallbackAvgPrice;

    return {
      chartData: points,
      totalFuelingsCount: last30DaysFuelData.length,
      kpiStats: {
        averageCostPerKm,
        minCost: minCost !== Infinity ? minCost : averageCostPerKm,
        maxCost: maxCost !== -Infinity ? maxCost : averageCostPerKm,
        totalSpentIn30d,
        totalLitersIn30d,
        totalKmIn30d,
        averagePricePerLiter,
      },
    };
  }, [last30DaysFuelData, vehicles, metrics]);

  // Formatação de Moeda
  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    }).format(val || 0);
  };

  // Tooltip customizado do Recharts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data: ChartDayPoint = payload[0].payload;
      return (
        <div className="bg-slate-950/95 border border-slate-700/80 p-3.5 rounded-2xl shadow-2xl backdrop-blur-md text-xs font-['Plus_Jakarta_Sans',sans-serif] min-w-[210px] space-y-2">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
            <span className="font-extrabold text-white flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>{data.fullDate}</span>
            </span>
            {data.hasEvent ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                {data.eventCount} abastecimento(s)
              </span>
            ) : (
              <span className="text-[10px] text-slate-500">Sem lançamentos</span>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Custo por KM:</span>
              </span>
              <strong className="text-sm font-black text-amber-400">
                {data.costPerKm > 0 ? `R$ ${data.costPerKm.toFixed(2)} /km` : 'R$ 0,00 /km'}
              </strong>
            </div>

            {showPricePerLiter && (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span>Preço do Litro:</span>
                </span>
                <span className="font-bold text-blue-300">
                  {data.pricePerLiter > 0 ? `R$ ${data.pricePerLiter.toFixed(2)} /L` : 'R$ 0,00 /L'}
                </span>
              </div>
            )}

            {showKmLiter && (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Rendimento:</span>
                </span>
                <span className="font-bold text-emerald-300">
                  {data.avgKmL > 0 ? `${data.avgKmL.toFixed(2)} km/L` : '0.00 km/L'}
                </span>
              </div>
            )}

            {data.hasEvent && (
              <div className="pt-1.5 border-t border-slate-800/80 text-[10px] text-slate-400 space-y-0.5">
                <div className="flex justify-between">
                  <span>Total Abastecido:</span>
                  <span className="font-semibold text-slate-200">{formatBRL(data.totalSpent)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Volume:</span>
                  <span className="font-semibold text-slate-200">
                    {data.totalLiters.toLocaleString('pt-BR')} Litros
                  </span>
                </div>
                {data.vehiclePlates.length > 0 && (
                  <div className="flex justify-between text-[9px] pt-0.5">
                    <span>Veículo(s):</span>
                    <span className="font-mono text-amber-300">{data.vehiclePlates.join(', ')}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl font-['Plus_Jakarta_Sans',sans-serif] space-y-5">
      {/* Header com Título e Filtro de Veículos */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-slate-950 flex items-center justify-center shadow-md shadow-amber-500/20">
              <TrendingUp className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
                <span>Variação de Custo de Combustível por KM (R$/km)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 font-bold">
                  Últimos 30 Dias
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Acompanhamento temporal diário com auditoria de cupons fiscais e odômetros
              </p>
            </div>
          </div>
        </div>

        {/* Controles: Seletor de Veículo & Toggles de Linha */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Seletor de Veículo */}
          <div className="relative">
            <select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-200 focus:outline-none focus:border-amber-500 transition cursor-pointer pr-8"
            >
              <option value="all">Frota Toda (Consolidado)</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate} - {v.model}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Toggle Preço por Litro */}
          <button
            type="button"
            onClick={() => setShowPricePerLiter(!showPricePerLiter)}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              showPricePerLiter
                ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
            }`}
            title="Alternar exibição da linha de preço do litro (R$/L)"
          >
            <span className={`w-2 h-2 rounded-full ${showPricePerLiter ? 'bg-blue-400' : 'bg-slate-600'}`} />
            <span>Preço/L</span>
          </button>

          {/* Toggle Rendimento km/L */}
          <button
            type="button"
            onClick={() => setShowKmLiter(!showKmLiter)}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              showKmLiter
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
            }`}
            title="Alternar exibição da linha de rendimento (km/L)"
          >
            <span className={`w-2 h-2 rounded-full ${showKmLiter ? 'bg-emerald-400' : 'bg-slate-600'}`} />
            <span>km/L</span>
          </button>
        </div>
      </div>

      {/* Cards de KPIs Rápidos dos Últimos 30 Dias */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* KPI 1: Custo Médio por KM */}
        <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>Custo Médio (30d)</span>
          </div>
          <div className="text-lg font-black text-amber-400">
            R$ {kpiStats.averageCostPerKm.toFixed(2)}{' '}
            <span className="text-xs font-normal text-slate-400">/km</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Meta corporativa: ~R$ 2,50/km
          </div>
        </div>

        {/* KPI 2: Menor Custo Registrado */}
        <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Melhor Eficiência</span>
          </div>
          <div className="text-lg font-black text-emerald-400">
            R$ {kpiStats.minCost.toFixed(2)}{' '}
            <span className="text-xs font-normal text-slate-400">/km</span>
          </div>
          <div className="text-[10px] text-emerald-500/80 mt-0.5">
            Menor custo registrado
          </div>
        </div>

        {/* KPI 3: Preço Médio do Litro */}
        <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span>Preço Médio / Litro</span>
          </div>
          <div className="text-lg font-black text-blue-400">
            R$ {kpiStats.averagePricePerLiter.toFixed(2)}{' '}
            <span className="text-xs font-normal text-slate-400">/L</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {kpiStats.totalLitersIn30d.toLocaleString('pt-BR')} L abastecidos
          </div>
        </div>

        {/* KPI 4: Total Gasto */}
        <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
            <span>Gasto Total (30d)</span>
          </div>
          <div className="text-lg font-black text-white">
            {formatBRL(kpiStats.totalSpentIn30d)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {totalFuelingsCount} abastecimento(s) auditado(s)
          </div>
        </div>
      </div>

      {/* Área do Gráfico Recharts */}
      {totalFuelingsCount === 0 && kpiStats.averageCostPerKm === 0 ? (
        /* Empty State Real e Limpo quando não há dados */
        <div className="p-8 rounded-2xl bg-slate-950/60 border border-slate-800 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
            <Fuel className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-sm font-bold text-white">
              Nenhum abastecimento registrado nos últimos 30 dias
            </h3>
            <p className="text-xs text-slate-400">
              O gráfico de linhas de variação de custo de combustível por quilômetro (R$/km) será
              traçado automaticamente assim que novos abastecimentos com foto de nota e odômetro forem confirmados.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-400">
            <Info className="w-3.5 h-3.5 text-amber-400" />
            <span>Fórmula: Custo/KM = Valor Total Pago ÷ Distância Percorrida entre Abastecimentos</span>
          </div>
        </div>
      ) : (
        <div className="w-full h-80 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 15, right: 20, left: -10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              
              <XAxis
                dataKey="dateLabel"
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: '#334155' }}
              />

              {/* Eixo Y Esquerdo: Custo por KM (R$/km) */}
              <YAxis
                yAxisId="left"
                stroke="#f59e0b"
                tick={{ fill: '#f59e0b', fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: '#f59e0b', strokeOpacity: 0.3 }}
                domain={['auto', 'auto']}
                tickFormatter={(val) => `R$ ${Number(val).toFixed(2)}`}
              />

              {/* Eixo Y Direito: Preço do Litro ou Rendimento */}
              {(showPricePerLiter || showKmLiter) && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#3b82f6"
                  tick={{ fill: '#3b82f6', fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: '#3b82f6', strokeOpacity: 0.3 }}
                  domain={['auto', 'auto']}
                  tickFormatter={(val) => `R$ ${Number(val).toFixed(2)}`}
                />
              )}

              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: 10, fontSize: 11 }}
              />

              {/* Linha de Referência da Média dos 30 dias */}
              {kpiStats.averageCostPerKm > 0 && (
                <ReferenceLine
                  yAxisId="left"
                  y={kpiStats.averageCostPerKm}
                  stroke="#f59e0b"
                  strokeDasharray="4 4"
                  strokeOpacity={0.6}
                  label={{
                    value: `Média 30d: R$ ${kpiStats.averageCostPerKm.toFixed(2)}/km`,
                    fill: '#f59e0b',
                    fontSize: 10,
                    position: 'insideTopRight',
                  }}
                />
              )}

              {/* Linha 1 Principal: Custo de Combustível por KM */}
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="costPerKm"
                name="Custo Combustível (R$/km)"
                stroke="#f59e0b"
                strokeWidth={3}
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  if (!payload.hasEvent) return null;
                  return (
                    <circle
                      key={`dot-${payload.dateKey}`}
                      cx={cx}
                      cy={cy}
                      r={4.5}
                      fill="#f59e0b"
                      stroke="#0f172a"
                      strokeWidth={2}
                    />
                  );
                }}
                activeDot={{
                  r: 7,
                  fill: '#fbbf24',
                  stroke: '#ffffff',
                  strokeWidth: 2,
                }}
              />

              {/* Linha 2 Secundária (Opcional): Preço do Litro */}
              {showPricePerLiter && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="pricePerLiter"
                  name="Preço do Litro (R$/L)"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                />
              )}

              {/* Linha 3 Secundária (Opcional): Rendimento Médio km/L */}
              {showKmLiter && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="avgKmL"
                  name="Rendimento (km/L)"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
