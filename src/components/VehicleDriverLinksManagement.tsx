import React, { useState } from 'react';
import { useFleet } from '../context/FleetContext';
import {
  Link as LinkIcon,
  Plus,
  Truck,
  Users,
  Calendar,
  CheckCircle2,
  XCircle,
  Unlink,
  X,
  History,
} from 'lucide-react';

export const VehicleDriverLinksManagement: React.FC = () => {
  const { vehicles, drivers, links, createLink, removeLink, currentCompany } = useFleet();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState(vehicles[0]?.id || '');
  const [selectedDriverId, setSelectedDriverId] = useState(drivers[0]?.id || '');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const activeLinks = links.filter((l) => l.is_active);
  const inactiveLinks = links.filter((l) => !l.is_active);

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicleId || !selectedDriverId) {
      setFormError('Selecione o veículo e o motorista.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    const result = await createLink(selectedVehicleId, selectedDriverId, notes);
    setIsSubmitting(false);

    if (result.success) {
      setIsModalOpen(false);
      setNotes('');
    } else {
      setFormError(result.error || 'Erro ao vincular.');
    }
  };

  const handleUnlink = async (linkId: string) => {
    await removeLink(linkId);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 text-slate-100 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-6 border-b border-slate-800">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
            Relacionamentos Operacionais ({currentCompany?.name})
          </span>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <LinkIcon className="w-6 h-6 text-amber-400" />
            <span>Vínculos Many-to-Many: Veículo ↔ Motorista</span>
          </h1>
          <p className="text-xs text-slate-400">
            Associação de motoristas a múltiplos veículos da frota com trilha histórica de responsabilidade
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setSelectedVehicleId(vehicles[0]?.id || '');
            setSelectedDriverId(drivers[0]?.id || '');
            setIsModalOpen(true);
          }}
          className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-extrabold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Novo Vínculo Operacional</span>
        </button>
      </div>

      {/* Active Links Section */}
      <div className="mb-8">
        <h2 className="text-sm font-extrabold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Vínculos Ativos no Momento ({activeLinks.length})</span>
        </h2>

        {activeLinks.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 bg-slate-900/40 border border-slate-800 rounded-2xl">
            Nenhum vínculo ativo registrado no momento.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeLinks.map((link) => (
              <div
                key={link.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-3xl p-5 shadow-lg relative flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Operando Atualmente
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Desde {new Date(link.started_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>

                  {/* Vehicle */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-black text-white">{link.vehicle?.plate || 'Veículo'}</div>
                      <div className="text-xs text-slate-400">{link.vehicle?.model || 'Modelo'}</div>
                    </div>
                  </div>

                  {/* Driver */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-black text-white">{link.driver?.name || 'Motorista'}</div>
                      <div className="text-xs text-slate-400">CNH: {link.driver?.cnh || 'Cat. D'}</div>
                    </div>
                  </div>

                  {link.notes && (
                    <div className="p-2.5 rounded-xl bg-slate-950/60 text-xs text-slate-300 border border-slate-800/80 mb-3">
                      <strong>Rota/Nota:</strong> {link.notes}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-800 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleUnlink(link.id)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                    <span>Desvincular</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Historical Inactive Links */}
      {inactiveLinks.length > 0 && (
        <div>
          <h2 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            <span>Histórico de Vínculos Encerrados ({inactiveLinks.length})</span>
          </h2>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Veículo</th>
                    <th className="py-3 px-4">Motorista</th>
                    <th className="py-3 px-4">Período de Atuação</th>
                    <th className="py-3 px-4">Observações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {inactiveLinks.map((link) => (
                    <tr key={link.id} className="hover:bg-slate-850/50">
                      <td className="py-3 px-4 font-mono font-bold text-white">
                        {link.vehicle?.plate || link.vehicle_id} ({link.vehicle?.model})
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-200">
                        {link.driver?.name || link.driver_id}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {new Date(link.started_at).toLocaleDateString('pt-BR')} até{' '}
                        {link.ended_at ? new Date(link.ended_at).toLocaleDateString('pt-BR') : 'Encerrado'}
                      </td>
                      <td className="py-3 px-4 text-slate-400">{link.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Novo Vínculo */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 text-slate-100">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-extrabold text-white">Criar Vínculo Veículo ↔ Motorista</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateLink} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Selecionar Veículo da Frota</label>
                <select
                  value={selectedVehicleId}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plate} — {v.model} ({v.current_km.toLocaleString()} km)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Selecionar Condutor / Motorista</label>
                <select
                  value={selectedDriverId}
                  onChange={(e) => setSelectedDriverId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                >
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} (CNH: {d.cnh} • Cat. {d.cnh_category})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Rota ou Observações Operacionais</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Escala semanal Centro-Oeste / Linha SP-Campinas"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                />
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
                  className="px-4 py-2 bg-slate-800 text-xs font-bold text-slate-300 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold rounded-xl transition cursor-pointer"
                >
                  {isSubmitting ? 'Salvando...' : 'Registrar Vínculo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
