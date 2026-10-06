import React, { useState } from 'react';
import { Truck, Plus, Search, Fuel, Gauge, Edit2, AlertTriangle, CheckCircle2, Sparkles, Activity } from 'lucide-react';
import { Vehicle } from '../../types/fleet';
import { VehicleModal } from './VehicleModal';
import { VehicleAiHealthModal } from './VehicleAiHealthModal';
import { getVehicleFipeValuation } from '../../services/freePublicApisService';
import { generateVehicleHealthDiagnostic } from '../../services/deepFleetAiService';

interface VehiclesTabProps {
  vehicles: Vehicle[];
  onCreateVehicle: (data: Partial<Vehicle>) => Promise<{ success: boolean; error?: string }>;
  onUpdateVehicle: (id: string, data: Partial<Vehicle>) => Promise<{ success: boolean; error?: string }>;
}

export const VehiclesTab: React.FC<VehiclesTabProps> = ({
  vehicles,
  onCreateVehicle,
  onUpdateVehicle,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [healthModalVehicle, setHealthModalVehicle] = useState<Vehicle | null>(null);

  const filtered = vehicles.filter(
    (v) =>
      v.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.make.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenCreate = () => {
    setSelectedVehicle(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (v: Vehicle) => {
    setSelectedVehicle(v);
    setIsModalOpen(true);
  };

  const handleSave = async (data: Partial<Vehicle>) => {
    if (selectedVehicle) {
      return await onUpdateVehicle(selectedVehicle.id, data);
    } else {
      return await onCreateVehicle(data);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Search and Add button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <Truck className="w-5 h-5 text-amber-400" />
            <span>Gestão de Veículos da Frota ({vehicles.length})</span>
          </h2>
          <p className="text-xs text-slate-400">
            Controle de placas, capacidade de tanques, km inicial cadastrado e metas de manutenção preventiva
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por placa ou modelo..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition shadow-lg shadow-amber-500/10 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Cadastrar Veículo</span>
          </button>
        </div>
      </div>

      {/* Vehicles Grid */}
      {filtered.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-500 bg-slate-900/60 border border-slate-800 rounded-2xl">
          Nenhum veículo localizado com os termos informados.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((v) => {
            const kmInit = v.kmInicial ?? v.initial_km ?? 0;
            const kmCur = v.kmAtual ?? v.current_km ?? kmInit;
            const kmDriven = Math.max(0, kmCur - kmInit);
            const isNearMaintenance =
              v.next_maintenance_km && v.next_maintenance_km - kmCur <= 2000;
            const isOverdue =
              v.next_maintenance_km && v.next_maintenance_km - kmCur <= 0;

            return (
              <div
                key={v.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 transition shadow-lg flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 pb-3 mb-3 border-b border-slate-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-black text-white tracking-wider font-mono">
                          {v.plate}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            v.status === 'ativo'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : v.status === 'manutencao'
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {v.status}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-300 mt-0.5">
                        {v.make} {v.model} ({v.year})
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenEdit(v)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                      title="Editar Veículo"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                    </button>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Fuel className="w-3.5 h-3.5 text-amber-400" />
                        <span>Tanque & Combustível:</span>
                      </span>
                      <span className="font-bold text-slate-200">
                        {v.tank_capacity_liters}L ({v.fuel_type})
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                        <span>KM Inicial Empresa:</span>
                      </span>
                      <span className="font-bold text-emerald-400">
                        {kmInit.toLocaleString()} km
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Gauge className="w-3.5 h-3.5 text-amber-400" />
                        <span>Odômetro Atual:</span>
                      </span>
                      <span className="font-extrabold text-white">
                        {kmCur.toLocaleString()} km
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-400 pt-1 border-t border-slate-800/80">
                      <span>Total Rodado no Controle:</span>
                      <span className="font-bold text-blue-400">
                        +{kmDriven.toLocaleString()} km
                      </span>
                    </div>

                    {/* AI Health & FIPE Badges */}
                    {(() => {
                      const fipe = getVehicleFipeValuation(v.make, v.model, v.year, kmCur);
                      const health = generateVehicleHealthDiagnostic(v, []);
                      return (
                        <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="flex items-center gap-1 text-slate-400">
                              <Sparkles className="w-3 h-3 text-indigo-400" />
                              <span>Health Score IA:</span>
                            </span>
                            <span className="font-black text-emerald-400">
                              {health.healthScore}/100 • {health.statusTremDeForca}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">Valor FIPE Est.:</span>
                            <span className="font-bold text-amber-300">
                              R$ {fipe.valorEstimadoBrl.toLocaleString('pt-BR')}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => setHealthModalVehicle(v)}
                            className="w-full mt-1.5 py-1 px-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 hover:text-white font-bold text-[10px] rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer"
                          >
                            <Sparkles className="w-3 h-3 text-indigo-400" />
                            <span>Diagnóstico IA 360° & TCO</span>
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {v.next_maintenance_km && (
                  <div
                    className={`mt-3 p-2.5 rounded-xl border text-[11px] flex items-center justify-between ${
                      isOverdue
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                        : isNearMaintenance
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {isOverdue || isNearMaintenance ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      )}
                      <span className="truncate max-w-[150px]">
                        {v.next_maintenance_desc || 'Revisão periódica'}
                      </span>
                    </div>
                    <span className="font-bold shrink-0">
                      Meta: {v.next_maintenance_km.toLocaleString()} km
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Veículo */}
      <VehicleModal
        isOpen={isModalOpen}
        vehicle={selectedVehicle}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
      />

      {/* Modal Diagnóstico de IA 360° & FIPE */}
      <VehicleAiHealthModal
        isOpen={!!healthModalVehicle}
        vehicle={healthModalVehicle}
        onClose={() => setHealthModalVehicle(null)}
      />
    </div>
  );
};
