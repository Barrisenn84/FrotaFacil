import React, { useState, useEffect } from 'react';
import { Truck, X } from 'lucide-react';
import { Vehicle, FuelType } from '../../types/fleet';

interface VehicleModalProps {
  isOpen: boolean;
  vehicle: Vehicle | null;
  onClose: () => void;
  onSave: (vehicleData: Partial<Vehicle>) => Promise<{ success: boolean; error?: string }>;
}

export const VehicleModal: React.FC<VehicleModalProps> = ({
  isOpen,
  vehicle,
  onClose,
  onSave,
}) => {
  const [plate, setPlate] = useState('');
  const [chassi, setChassi] = useState('');
  const [renavam, setRenavam] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [fuelType, setFuelType] = useState<FuelType>('Diesel S10');
  const [tankCapacity, setTankCapacity] = useState<number>(500);
  const [initialKm, setInitialKm] = useState<number>(0);
  const [currentKm, setCurrentKm] = useState<number>(0);
  const [nextMaintKm, setNextMaintKm] = useState<number>(10000);
  const [nextMaintDesc, setNextMaintDesc] = useState('Revisão Preventiva');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (vehicle) {
      setPlate(vehicle.plate || '');
      setChassi(vehicle.chassi || '');
      setRenavam(vehicle.renavam || '');
      setMake(vehicle.make || '');
      setModel(vehicle.model || '');
      setYear(vehicle.year || new Date().getFullYear());
      setFuelType(vehicle.fuel_type || 'Diesel S10');
      setTankCapacity(vehicle.tank_capacity_liters || 500);
      setInitialKm(vehicle.kmInicial ?? vehicle.initial_km ?? 0);
      setCurrentKm(vehicle.kmAtual ?? vehicle.current_km ?? 0);
      setNextMaintKm(vehicle.next_maintenance_km || (vehicle.current_km || 0) + 10000);
      setNextMaintDesc(vehicle.next_maintenance_desc || 'Revisão Preventiva');
    } else {
      setPlate('');
      setChassi('');
      setRenavam('');
      setMake('');
      setModel('');
      setYear(new Date().getFullYear());
      setFuelType('Diesel S10');
      setTankCapacity(500);
      setInitialKm(0);
      setCurrentKm(0);
      setNextMaintKm(10000);
      setNextMaintDesc('Revisão Preventiva');
    }
    setFormError(null);
  }, [vehicle, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    const data: Partial<Vehicle> = {
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
      next_maintenance_desc: nextMaintDesc.trim(),
      status: 'ativo',
    };

    const result = await onSave(data);
    setIsSubmitting(false);

    if (result.success) {
      onClose();
    } else {
      setFormError(result.error || 'Erro ao salvar veículo.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-xl w-full p-6 text-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-extrabold text-white">
              {vehicle ? 'Editar Veículo' : 'Cadastrar Novo Veículo na Frota'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Placa *</label>
              <input
                type="text"
                required
                value={plate}
                onChange={(e) => setPlate(e.target.value.toUpperCase())}
                placeholder="Ex: BRA2E19"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-mono uppercase focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Ano Fabricação *</label>
              <input
                type="number"
                required
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Marca / Montadora *</label>
              <input
                type="text"
                required
                value={make}
                onChange={(e) => setMake(e.target.value)}
                placeholder="Ex: Scania / Volvo / Mercedes"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Modelo / Versão *</label>
              <input
                type="text"
                required
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Ex: R450 6x2 / FH 540"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Combustível</label>
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
              <label className="block text-xs font-bold text-slate-300 mb-1">Capacidade Tanque (Litros) *</label>
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
                KM Inicial Empresa *
              </label>
              <input
                type="number"
                required
                value={initialKm}
                onChange={(e) => setInitialKm(Number(e.target.value))}
                className="w-full bg-slate-950 border border-emerald-500/40 rounded-xl p-2.5 text-xs text-emerald-400 font-bold focus:outline-none"
                title="Odômetro no dia em que a empresa começou a controlar"
              />
              <span className="text-[10px] text-slate-500 block mt-0.5">Início do controle</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-amber-400 mb-1">Odômetro Atual (KM) *</label>
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
              <span className="text-[10px] text-slate-500 block mt-0.5">Meta preventiva</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Descrição da Próxima Revisão</label>
            <input
              type="text"
              value={nextMaintDesc}
              onChange={(e) => setNextMaintDesc(e.target.value)}
              placeholder="Ex: Troca de óleo sintético + Filtros de ar"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none"
            />
          </div>

          {formError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
              {formError}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-xs font-bold text-slate-950 transition disabled:opacity-50"
            >
              {isSubmitting ? 'Salvando...' : vehicle ? 'Atualizar Veículo' : 'Cadastrar Veículo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
