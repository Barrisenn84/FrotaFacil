import React, { useState } from 'react';
import { useFleet } from '../context/FleetContext';
import {
  Car,
  Plus,
  Search,
  Fuel,
  Gauge,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  X,
  Truck,
} from 'lucide-react';
import { Vehicle, FuelType } from '../types/fleet';

export const VehicleManagement: React.FC = () => {
  const { vehicles, createVehicle, updateVehicle, currentCompany } = useFleet();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form Fields
  const [plate, setPlate] = useState('');
  const [chassi, setChassi] = useState('');
  const [renavam, setRenavam] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [fuelType, setFuelType] = useState<FuelType>('Diesel S10');
  const [tankCapacity, setTankCapacity] = useState<number>(100);
  const [initialKm, setInitialKm] = useState<number>(0);
  const [currentKm, setCurrentKm] = useState<number>(0);
  const [nextMaintKm, setNextMaintKm] = useState<number>(10000);
  const [nextMaintDesc, setNextMaintDesc] = useState('Revisão Preventiva');

  const openCreateModal = () => {
    setEditingVehicle(null);
    setPlate('');
    setChassi('');
    setRenavam('');
    setMake('');
    setModel('');
    setYear(new Date().getFullYear());
    setFuelType('Diesel S10');
    setTankCapacity(250);
    setInitialKm(0);
    setCurrentKm(0);
    setNextMaintKm(10000);
    setNextMaintDesc('Revisão Periódica');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (veh: Vehicle) => {
    setEditingVehicle(veh);
    setPlate(veh.plate);
    setChassi(veh.chassi);
    setRenavam(veh.renavam);
    setMake(veh.make);
    setModel(veh.model);
    setYear(veh.year);
    setFuelType(veh.fuel_type);
    setTankCapacity(veh.tank_capacity_liters);
    setInitialKm(veh.initial_km);
    setCurrentKm(veh.current_km);
    setNextMaintKm(veh.next_maintenance_km || veh.current_km + 10000);
    setNextMaintDesc(veh.next_maintenance_desc || 'Revisão Periódica');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    const vehicleData = {
      plate: plate.toUpperCase().trim(),
      chassi: chassi.trim(),
      renavam: renavam.trim(),
      make: make.trim(),
      model: model.trim(),
      year: Number(year),
      fuel_type: fuelType,
      tank_capacity_liters: Number(tankCapacity),
      kmInicial: Number(initialKm),
      initial_km: Number(initialKm),
      kmAtual: Number(currentKm),
      current_km: Number(currentKm),
      next_maintenance_km: Number(nextMaintKm),
      next_maintenance_desc: nextMaintDesc,
      status: 'ativo',
    };

    let result;
    if (editingVehicle) {
      result = await updateVehicle(editingVehicle.id, vehicleData);
    } else {
      result = await createVehicle(vehicleData);
    }

    setIsSubmitting(false);

    if (result.success) {
      setIsModalOpen(false);
    } else {
      setFormError(result.error || 'Erro ao salvar veículo.');
    }
  };

  const filteredVehicles = vehicles.filter((v) => {
    const q = searchTerm.toLowerCase();
    return (
      v.plate.toLowerCase().includes(q) ||
      v.model.toLowerCase().includes(q) ||
      v.make.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 text-slate-100 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-6 border-b border-slate-800">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
            Frota Corporativa ({currentCompany?.name})
          </span>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Car className="w-6 h-6 text-amber-400" />
            <span>Gestão de Veículos</span>
          </h1>
          <p className="text-xs text-slate-400">
            Cadastro de frota, capacidade de tanque, controle de odômetro e metas de preventiva
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-extrabold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Cadastrar Veículo</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="mb-6 relative">
        <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por placa, modelo ou montadora..."
          className="w-full bg-slate-900 border border-slate-700 rounded-2xl py-3 pl-10 pr-4 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      {/* Vehicles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredVehicles.map((v) => (
          <div
            key={v.id}
            className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-3xl p-5 shadow-lg relative flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="text-xs text-slate-400 uppercase font-bold">{v.make}</span>
                  <h3 className="text-lg font-black text-white">{v.model}</h3>
                </div>
                <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono font-bold text-sm rounded-xl">
                  {v.plate}
                </span>
              </div>

              <div className="space-y-2 py-3 border-y border-slate-800/80 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5 text-amber-400" />
                    Odômetro Atual
                  </span>
                  <span className="font-extrabold text-white">{v.current_km.toLocaleString()} km</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Fuel className="w-3.5 h-3.5 text-emerald-400" />
                    Tanque / Combustível
                  </span>
                  <span className="font-bold text-slate-200">
                    {v.tank_capacity_liters} L • {v.fuel_type}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Ano de Fabricação</span>
                  <span className="font-bold text-slate-300">{v.year}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Próxima Revisão</span>
                  <span className="font-bold text-amber-300">
                    {v.next_maintenance_km ? `${v.next_maintenance_km.toLocaleString()} km` : 'Não definida'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4">
              <span
                className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                  v.status === 'ativo'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                {v.status}
              </span>

              <button
                type="button"
                onClick={() => openEditModal(v)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Edit2 className="w-3 h-3 text-amber-400" />
                <span>Editar</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Cadastrar / Editar Veículo */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-xl w-full p-6 text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-extrabold text-white">
                  {editingVehicle ? 'Editar Veículo' : 'Cadastrar Novo Veículo na Frota'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Placa (Mercosul/Antiga)</label>
                  <input
                    type="text"
                    required
                    value={plate}
                    onChange={(e) => setPlate(e.target.value.toUpperCase())}
                    placeholder="Ex: BRA2E19"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Ano</label>
                  <input
                    type="number"
                    required
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Marca / Montadora</label>
                  <input
                    type="text"
                    required
                    value={make}
                    onChange={(e) => setMake(e.target.value)}
                    placeholder="Ex: Scania / Fiat / Mercedes"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Modelo Comercial</label>
                  <input
                    type="text"
                    required
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="Ex: R450 6x2 / Fiorino 1.4"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Chassi</label>
                  <input
                    type="text"
                    required
                    value={chassi}
                    onChange={(e) => setChassi(e.target.value.toUpperCase())}
                    placeholder="17 caracteres"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Renavam</label>
                  <input
                    type="text"
                    required
                    value={renavam}
                    onChange={(e) => setRenavam(e.target.value)}
                    placeholder="11 dígitos"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Combustível Padrão</label>
                  <select
                    value={fuelType}
                    onChange={(e) => setFuelType(e.target.value as FuelType)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                  >
                    <option value="Diesel S10">Diesel S10</option>
                    <option value="Diesel Comum">Diesel Comum</option>
                    <option value="Gasolina Comum">Gasolina Comum</option>
                    <option value="Gasolina Aditivada">Gasolina Aditivada</option>
                    <option value="Etanol">Etanol</option>
                    <option value="GNV">GNV</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Capacidade Tanque (Litros)
                  </label>
                  <input
                    type="number"
                    required
                    value={tankCapacity}
                    onChange={(e) => setTankCapacity(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-emerald-400 mb-1">
                    KM Inicial na Empresa
                  </label>
                  <input
                    type="number"
                    required
                    value={initialKm}
                    onChange={(e) => setInitialKm(Number(e.target.value))}
                    placeholder="Odômetro no início do controle"
                    className="w-full bg-slate-950 border border-emerald-500/40 rounded-xl p-2.5 text-xs text-emerald-400 font-bold focus:outline-none"
                    title="Odômetro do veículo no dia em que a empresa começou a controlar, não o km de fábrica"
                  />
                  <span className="text-[10px] text-slate-500 block mt-0.5">Início do controle</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-amber-400 mb-1">Odômetro Atual (KM)</label>
                  <input
                    type="number"
                    required
                    value={currentKm}
                    onChange={(e) => setCurrentKm(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-amber-500/40 rounded-xl p-2.5 text-xs text-amber-400 font-bold focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500 block mt-0.5">Odômetro atual</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Próxima Revisão (KM)</label>
                  <input
                    type="number"
                    value={nextMaintKm}
                    onChange={(e) => setNextMaintKm(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500 block mt-0.5">Alerta preventivo</span>
                </div>
              </div>

              {formError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
                  {formError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-xs font-bold text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold transition cursor-pointer"
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar Veículo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
