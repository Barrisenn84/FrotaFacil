import React, { useState } from 'react';
import { useFleet } from '../context/FleetContext';
import {
  History,
  Fuel,
  Wrench,
  Gauge,
  Calendar,
  DollarSign,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  X,
  ShieldCheck,
  Building,
} from 'lucide-react';
import { FleetEvent } from '../types/fleet';

interface DriverVehicleHistoryProps {
  vehicleId?: string;
  onBack?: () => void;
}

export const DriverVehicleHistory: React.FC<DriverVehicleHistoryProps> = ({ vehicleId, onBack }) => {
  const { vehicles, events, inspections, currentCompany } = useFleet();

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(vehicleId || vehicles[0]?.id || '');
  const [filterType, setFilterType] = useState<string>('all');
  const [viewingEvidenceEvent, setViewingEvidenceEvent] = useState<FleetEvent | null>(null);

  const activeVehicle = vehicles.find((v) => v.id === selectedVehicleId) || vehicles[0];

  const isVehicleMatch = (vId?: string, plate?: string) => {
    if (!activeVehicle) return true;
    const cleanActivePlate = (activeVehicle.plate || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const cleanTestPlate = (plate || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return (
      vId === activeVehicle.id ||
      vId === activeVehicle.plate ||
      (cleanTestPlate && cleanTestPlate === cleanActivePlate)
    );
  };

  const vehicleInspections = inspections.filter(
    (i) => isVehicleMatch(i.veiculoId, (i as any).placa || (i as any).vehiclePlate)
  );

  const vehicleEventsAll = events.filter((e) =>
    isVehicleMatch(e.vehicle_id, e.vehicle?.plate)
  );

  const fuelEventsCount = vehicleEventsAll.filter((e) => e.event_type === 'fuel').length;
  const maintEventsCount = vehicleEventsAll.filter((e) => e.event_type === 'maintenance').length;

  const vehicleEvents = vehicleEventsAll.filter((e) => {
    if (filterType !== 'all' && e.event_type !== filterType) return false;
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return (
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Confirmado
          </span>
        );
      case 'corrected':
        return (
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Corrigido
          </span>
        );
      case 'pending_confirmation':
        return (
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
            Pendente
          </span>
        );
      case 'rejected':
        return (
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            Rejeitado
          </span>
        );
      default:
        return <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">{status}</span>;
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 text-slate-100 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-6 border-b border-slate-800">
        <div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="text-xs font-bold text-amber-400 hover:text-amber-300 mb-1 flex items-center gap-1 cursor-pointer"
            >
              ← Voltar ao Início
            </button>
          )}
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <History className="w-6 h-6 text-amber-400" />
            <span>Histórico do Veículo e Evidências</span>
          </h1>
          <p className="text-xs text-slate-400">
            Linha do tempo auditável de abastecimentos, manutenções e fotos de comprovantes ({currentCompany?.name})
          </p>
        </div>

        {/* Vehicle Switcher */}
        {vehicles.length > 1 && (
          <div className="w-full sm:w-64">
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Selecionar Veículo</label>
            <select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs font-bold text-white focus:outline-none"
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate} — {v.model}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Vehicle Summary Bar */}
      {activeVehicle && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Placa / Modelo</span>
            <span className="text-sm font-extrabold text-white">{activeVehicle.plate}</span>
            <span className="text-xs text-slate-400 block truncate">{activeVehicle.model}</span>
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Odômetro Atual</span>
            <span className="text-sm font-extrabold text-amber-400">
              {activeVehicle.current_km.toLocaleString()} km
            </span>
            <span className="text-[10px] text-slate-500 block">Inicial: {activeVehicle.initial_km.toLocaleString()} km</span>
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Tanque / Combustível</span>
            <span className="text-sm font-bold text-slate-200">{activeVehicle.tank_capacity_liters} Litros</span>
            <span className="text-xs text-slate-400 block">{activeVehicle.fuel_type}</span>
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Próxima Manutenção</span>
            <span className="text-sm font-bold text-slate-200">
              {activeVehicle.next_maintenance_km ? `${activeVehicle.next_maintenance_km.toLocaleString()} km` : 'Não definida'}
            </span>
            <span className="text-[10px] text-slate-400 block truncate">
              {activeVehicle.next_maintenance_desc || 'Revisão periódica'}
            </span>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-6">
        <button
          type="button"
          onClick={() => setFilterType('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            filterType === 'all'
              ? 'bg-amber-500 text-slate-950 font-extrabold shadow-md'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          Todos ({vehicleEventsAll.length})
        </button>

        <button
          type="button"
          onClick={() => setFilterType('fuel')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
            filterType === 'fuel'
              ? 'bg-amber-500 text-slate-950 font-extrabold shadow-md'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Fuel className="w-3.5 h-3.5" />
          <span>Abastecimentos ({fuelEventsCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setFilterType('maintenance')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
            filterType === 'maintenance'
              ? 'bg-amber-500 text-slate-950 font-extrabold shadow-md'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Wrench className="w-3.5 h-3.5" />
          <span>Manutenções ({maintEventsCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setFilterType('vistoria')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
            filterType === 'vistoria'
              ? 'bg-amber-500 text-slate-950 font-extrabold shadow-md'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Vistorias IA ({vehicleInspections.length})</span>
        </button>
      </div>

      {/* Vistorias View if filterType is 'vistoria' */}
      {filterType === 'vistoria' ? (
        vehicleInspections.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/50 border border-slate-800 rounded-3xl text-slate-400 text-sm">
            Nenhuma vistoria visual gravada ainda para este veículo.
          </div>
        ) : (
          <div className="space-y-4">
            {vehicleInspections.map((insp) => (
              <div
                key={insp.id}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-extrabold text-white flex items-center gap-2">
                        <span>Vistoria de {insp.data}</span>
                        <span className="text-xs font-normal text-slate-400">
                          • {insp.odometro.toLocaleString()} km
                        </span>
                      </div>
                      <div className="text-xs text-slate-400">
                        Condutor: {insp.motoristaNome || 'Motorista Autorizado'}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${
                      insp.status === 'critica'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : insp.status === 'alerta'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {insp.status === 'critica'
                      ? 'Crítico'
                      : insp.status === 'alerta'
                      ? 'Alerta'
                      : 'Aprovado'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
                  <div className="aspect-video bg-black rounded-2xl overflow-hidden border border-slate-800 relative">
                    <img
                      src={insp.fotoAnotadaUrl || insp.fotos?.dianteiraEsquerda}
                      alt="Foto Anotada da Vistoria"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 left-2 bg-black/80 px-2 py-0.5 rounded text-[10px] font-bold text-amber-400">
                      Nano Banana 2
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-bold">Diagnóstico do Pneu</span>
                      <div className="text-amber-400 font-extrabold text-sm mt-0.5">
                        Sulco: {insp.analisePneu?.desgastePneuMm} mm • ~{insp.analisePneu?.kmRestantesEstimados?.toLocaleString()} km restantes
                      </div>
                    </div>

                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-bold">
                        Avarias Detectadas ({insp.avarias?.length || 0})
                      </span>
                      <p className="text-slate-300 mt-1">
                        {insp.avarias && insp.avarias.length > 0
                          ? insp.avarias.map((a) => a.local).join(', ')
                          : 'Nenhum dano grave identificado.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : vehicleEvents.length === 0 ? (
        <div className="p-8 text-center bg-slate-900/50 border border-slate-800 rounded-3xl text-slate-400 text-sm">
          Nenhum evento registrado para este filtro.
        </div>
      ) : (
        <div className="space-y-4">
          {vehicleEvents.map((evt) => {
            const isFuel = evt.event_type === 'fuel';
            return (
              <div
                key={evt.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-3xl p-5 shadow-lg transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold ${
                        isFuel
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      }`}
                    >
                      {isFuel ? <Fuel className="w-5 h-5" /> : <Wrench className="w-5 h-5" />}
                    </div>

                    <div>
                      <div className="text-sm font-extrabold text-white flex items-center gap-2">
                        <span>{isFuel ? 'Abastecimento' : 'Manutenção'}</span>
                        {getStatusBadge(evt.status)}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          {evt.event_date}
                        </span>
                        <span>•</span>
                        <span>Motorista: {evt.driver?.name || 'Não identificado'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4">
                    <div className="text-left sm:text-right">
                      <div className="text-xs text-slate-400">Valor Total</div>
                      <div className="text-base font-black text-emerald-400">
                        R$ {evt.total_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>

                    {evt.evidence && (
                      <button
                        type="button"
                        onClick={() => setViewingEvidenceEvent(evt)}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-amber-400" />
                        <span>Ver Foto</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Event Details Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Odômetro Registrado</span>
                    <span className="font-bold text-amber-400">{evt.odometer.toLocaleString()} km</span>
                  </div>

                  {isFuel && evt.fuelDetail && (
                    <>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">Volume / Preço</span>
                        <span className="font-bold text-white">
                          {evt.fuelDetail.liters.toFixed(2)} L (R$ {evt.fuelDetail.price_per_liter.toFixed(2)}/L)
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">Consumo do Trecho</span>
                        <span className="font-bold text-emerald-400">
                          {evt.fuelDetail.calculated_km_per_liter
                            ? `${evt.fuelDetail.calculated_km_per_liter} km/L`
                            : 'Trecho em cálculo'}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">Custo por KM</span>
                        <span className="font-bold text-slate-200">
                          {evt.fuelDetail.calculated_cost_per_km
                            ? `R$ ${evt.fuelDetail.calculated_cost_per_km}/km`
                            : 'N/A'}
                        </span>
                      </div>
                    </>
                  )}

                  {!isFuel && evt.maintenanceDetail && (
                    <>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">Tipo</span>
                        <span className="font-bold text-white capitalize">{evt.maintenanceDetail.maintenance_type}</span>
                      </div>

                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">Peças / Mão de Obra</span>
                        <span className="font-bold text-white">
                          R$ {evt.maintenanceDetail.parts_cost.toFixed(2)} + R$ {evt.maintenanceDetail.labor_cost.toFixed(2)}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">Oficina</span>
                        <span className="font-bold text-slate-200 truncate block">
                          {evt.maintenanceDetail.workshop_name}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Justification note if any */}
                {evt.correction_justification && (
                  <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200">
                    <strong>Justificativa de correção:</strong> {evt.correction_justification}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal for viewing evidence photo */}
      {viewingEvidenceEvent && viewingEvidenceEvent.evidence && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-xl w-full p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Evidência Fotográfica do Comprovante</h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingEvidenceEvent(null)}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 flex items-center justify-center mb-4">
              <img
                src={viewingEvidenceEvent.evidence.file_path}
                alt="Comprovante"
                className="max-h-[420px] w-auto object-contain"
                onError={(e) => {
                  (e.target as any).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" fill="%23334155"><rect width="100%" height="100%" fill="%231e293b"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%2394a3b8" font-size="14">Foto Armazenada com Hash Seguro</text></svg>';
                }}
              />
            </div>

            {/* Evidence Audit Details */}
            <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800/80 text-xs space-y-1.5 text-slate-300">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Hash SHA-256 (Detecção Antifraude):</span>
                <span className="font-mono text-[11px] text-amber-400 truncate max-w-[220px]">
                  {viewingEvidenceEvent.evidence.sha256_hash}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Arquivo Original:</span>
                <span>{viewingEvidenceEvent.evidence.original_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Tamanho:</span>
                <span>{(viewingEvidenceEvent.evidence.file_size / 1024).toFixed(1)} KB</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Data de Armazenamento:</span>
                <span>{new Date(viewingEvidenceEvent.evidence.created_at).toLocaleString('pt-BR')}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
