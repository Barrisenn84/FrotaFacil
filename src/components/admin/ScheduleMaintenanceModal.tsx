import React, { useState } from 'react';
import {
  Wrench,
  X,
  Calendar,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  DollarSign,
  Building2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useFleet } from '../../context/FleetContext';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';

interface ScheduleMaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetVehicle: {
    vehicleId: string;
    plate: string;
    model: string;
    currentKm: number;
    nextMaintenanceKm: number;
    description: string;
    isOverdue?: boolean;
    isNear?: boolean;
    kmUntil?: number;
  } | null;
  onSuccess?: () => void;
}

export const ScheduleMaintenanceModal: React.FC<ScheduleMaintenanceModalProps> = ({
  isOpen,
  onClose,
  targetVehicle,
  onSuccess,
}) => {
  const { currentCompany, currentUser, schedulePredictiveMaintenance } = useFleet();

  const [mode, setMode] = useState<'schedule' | 'complete'>('schedule');
  const [scheduledDate, setScheduledDate] = useState(
    new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]
  );
  const [workshopName, setWorkshopName] = useState('Concessionária / Oficina Credenciada');
  const [serviceDescription, setServiceDescription] = useState(
    targetVehicle?.description || 'Revisão Preventiva Geral'
  );
  const [estimatedCost, setEstimatedCost] = useState('1250');
  const [nextIntervalKm, setNextIntervalKm] = useState('20000');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen || !targetVehicle) return null;

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccessMsg(null);

    try {
      if (mode === 'schedule') {
        // Agendar via serviço preditivo / gravar no Firestore
        await schedulePredictiveMaintenance({
          vehicleId: targetVehicle.vehicleId,
          vehiclePlate: targetVehicle.plate,
          maintenanceType: serviceDescription,
          suggestedDate: scheduledDate,
          estimatedKm: targetVehicle.currentKm,
        });

        setSuccessMsg(`Revisão do veículo ${targetVehicle.plate} agendada para ${new Date(scheduledDate).toLocaleDateString('pt-BR')} com sucesso!`);
      } else {
        // Modo 'complete': Concluir a revisão atual e prorrogar o próximo limite de KM
        const newLimit = targetVehicle.currentKm + (parseInt(nextIntervalKm, 10) || 20000);
        if (currentCompany?.id) {
          const vehRef = doc(db, 'companies', currentCompany.id, 'vehicles', targetVehicle.vehicleId);
          await updateDoc(vehRef, {
            next_maintenance_km: newLimit,
            next_maintenance_desc: `Próxima revisão preventiva (${newLimit.toLocaleString('pt-BR')} km)`,
            status: 'ativo',
            updatedAt: new Date().toISOString(),
          });

          // Também registrar o lançamento em maintenance
          const mId = `maint-done-${Date.now().toString(36)}`;
          const mRef = doc(db, 'companies', currentCompany.id, 'maintenance', mId);
          await setDoc(mRef, {
            id: mId,
            empresaId: currentCompany.id,
            veiculoId: targetVehicle.vehicleId,
            data: new Date().toISOString().split('T')[0],
            odometro: targetVehicle.currentKm,
            tipo: 'preventiva',
            oficina: workshopName,
            descricao: serviceDescription,
            custoPecas: parseFloat(estimatedCost) * 0.7 || 0,
            custoMaoDeObra: parseFloat(estimatedCost) * 0.3 || 0,
            valorTotal: parseFloat(estimatedCost) || 0,
            status: 'confirmed',
            created_at: new Date().toISOString(),
          });
        }

        setSuccessMsg(`Manutenção registrada! Próximo limite atualizado para ${newLimit.toLocaleString('pt-BR')} km.`);
      }

      setTimeout(() => {
        setIsSubmitting(false);
        if (onSuccess) onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Erro ao agendar/concluir manutenção:', err);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                targetVehicle.isOverdue
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}
            >
              <Wrench className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Manutenção: {targetVehicle.plate}</span>
                {targetVehicle.isOverdue ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-black">
                    VENCIDA
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-black">
                    PRÓXIMA
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                {targetVehicle.model} • Odômetro Atual: {targetVehicle.currentKm.toLocaleString('pt-BR')} km
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Alert */}
        {successMsg && (
          <div className="m-4 p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Mode Selector */}
        <div className="px-5 pt-4">
          <div className="grid grid-cols-2 p-1 bg-slate-950 border border-slate-800 rounded-2xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setMode('schedule')}
              className={`py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                mode === 'schedule'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>1. Agendar Parada</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('complete')}
              className={`py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                mode === 'complete'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>2. Registrar Conclusão</span>
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSchedule} className="p-5 space-y-4 text-xs">
          {/* Informações da Quilometragem */}
          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Quilometragem Limite</span>
              <span className="text-sm font-black text-white">
                {targetVehicle.nextMaintenanceKm.toLocaleString('pt-BR')} km
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Diferença</span>
              {targetVehicle.isOverdue ? (
                <span className="text-sm font-black text-rose-400">
                  +{Math.abs(targetVehicle.kmUntil || 0).toLocaleString('pt-BR')} km ultrapassados
                </span>
              ) : (
                <span className="text-sm font-black text-amber-400">
                  Faltam {targetVehicle.kmUntil?.toLocaleString('pt-BR')} km
                </span>
              )}
            </div>
          </div>

          {/* Descrição do Serviço */}
          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Descrição do Serviço Preventivo
            </label>
            <input
              type="text"
              value={serviceDescription}
              onChange={(e) => setServiceDescription(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {mode === 'schedule' ? (
            <>
              {/* Data Agendada */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                  <span>Data Programada para Entrada na Oficina</span>
                </label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Oficina */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Oficina / Concessionária Credenciada</span>
                </label>
                <input
                  type="text"
                  value={workshopName}
                  onChange={(e) => setWorkshopName(e.target.value)}
                  placeholder="Ex: Concessionária Volvo / Mecânica Especializada"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </>
          ) : (
            <>
              {/* Modo de Conclusão: Novo Intervalo de KM */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Valor Total Pago (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={estimatedCost}
                    onChange={(e) => setEstimatedCost(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Próxima Revisão em (+KM)
                  </label>
                  <input
                    type="number"
                    step="1000"
                    value={nextIntervalKm}
                    onChange={(e) => setNextIntervalKm(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-400">
                O novo limite será definido automaticamente para{' '}
                <strong className="text-emerald-400">
                  {(targetVehicle.currentKm + (parseInt(nextIntervalKm, 10) || 20000)).toLocaleString('pt-BR')} km
                </strong>
                .
              </p>
            </>
          )}

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-5 py-2 rounded-xl font-black text-xs flex items-center gap-2 transition cursor-pointer disabled:opacity-50 ${
                mode === 'schedule'
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : mode === 'schedule' ? (
                <>
                  <Calendar className="w-4 h-4" />
                  <span>Confirmar Agendamento</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Concluir e Atualizar KM</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
