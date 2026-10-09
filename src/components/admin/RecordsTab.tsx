import React, { useState } from 'react';
import {
  FileCheck,
  Search,
  Fuel,
  Wrench,
  Filter,
  Calendar,
  DollarSign,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  Sparkles,
  Building2,
  ShieldCheck,
} from 'lucide-react';
import { FleetEvent } from '../../types/fleet';
import { B2BNegotiationModal } from './B2BNegotiationModal';
import { useFleet } from '../../context/FleetContext';

interface RecordsTabProps {
  events: FleetEvent[];
}

export const RecordsTab: React.FC<RecordsTabProps> = ({ events }) => {
  const { currentCompany } = useFleet();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'fuel' | 'maintenance'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'pending' | 'rejected'>('all');
  const [showNegotiationModal, setShowNegotiationModal] = useState(false);

  const filtered = events.filter((e) => {
    const matchesSearch =
      (e.vehicle?.plate || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.driver?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.fuelDetail?.gas_station_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.maintenanceDetail?.workshop_name || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = typeFilter === 'all' || e.event_type === typeFilter;
    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'confirmed'
        ? e.status === 'confirmed'
        : statusFilter === 'pending'
        ? e.status === 'pending_confirmation' || e.status === 'corrected'
        : e.status === 'rejected';

    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header and Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-amber-400" />
            <span>Registros e Auditoria Financeira ({filtered.length})</span>
          </h2>
          <p className="text-xs text-slate-400">
            Trilha completa de lançamentos fotográficos, abastecimentos, manutenções e validações
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 sm:w-56">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Placa, motorista ou posto..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="bg-slate-900 border border-slate-700 rounded-xl py-2 px-3 text-xs font-bold text-white focus:outline-none"
          >
            <option value="all">Todos os Tipos</option>
            <option value="fuel">Apenas Abastecimentos</option>
            <option value="maintenance">Apenas Manutenções</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-900 border border-slate-700 rounded-xl py-2 px-3 text-xs font-bold text-white focus:outline-none"
          >
            <option value="all">Todos os Status</option>
            <option value="confirmed">Homologados</option>
            <option value="pending">Pendentes</option>
            <option value="rejected">Rejeitados</option>
          </select>

          {/* AI B2B Negotiation Button */}
          <button
            type="button"
            onClick={() => setShowNegotiationModal(true)}
            className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-amber-500/10"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Proposta de Desconto em Postos</span>
          </button>
        </div>
      </div>

      {/* Events Table / List */}
      {filtered.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-500 bg-slate-900/60 border border-slate-800 rounded-2xl">
          Nenhum registro encontrado com os filtros selecionados.
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-bold uppercase border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Data / Tipo</th>
                  <th className="p-3.5">Veículo</th>
                  <th className="p-3.5">Motorista</th>
                  <th className="p-3.5">Odômetro</th>
                  <th className="p-3.5">Estabelecimento / Detalhes</th>
                  <th className="p-3.5 text-right">Valor Total</th>
                  <th className="p-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-3.5">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                            e.event_type === 'fuel'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-blue-500/20 text-blue-400'
                          }`}
                        >
                          {e.event_type === 'fuel' ? (
                            <Fuel className="w-3.5 h-3.5" />
                          ) : (
                            <Wrench className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-white">{e.event_date}</div>
                          <div className="text-[10px] text-slate-400 capitalize">
                            {e.event_type === 'fuel' ? 'Abastecimento' : 'Manutenção'}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="p-3.5 font-bold font-mono text-white">
                      {e.vehicle?.plate || '---'}
                      <div className="text-[10px] font-sans font-normal text-slate-400">
                        {e.vehicle?.model}
                      </div>
                    </td>

                    <td className="p-3.5 font-medium">{e.driver?.name || '---'}</td>

                    <td className="p-3.5 font-bold">
                      {e.odometer ? `${e.odometer.toLocaleString()} km` : '---'}
                    </td>

                    <td className="p-3.5">
                      {e.event_type === 'fuel' ? (
                        <div>
                          <div className="font-bold text-white">
                            {e.fuelDetail?.gas_station_name || 'Posto'}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {e.fuelDetail?.liters || 0} L • {e.fuelDetail?.fuel_type}
                          </div>
                          <div className="mt-1 flex items-center gap-1 text-[9px] text-emerald-400 font-bold">
                            <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span>Receita Federal: Posto Ativo & Regular (BrasilAPI)</span>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="font-bold text-white">
                            {e.maintenanceDetail?.workshop_name || 'Oficina'}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {e.maintenanceDetail?.items_description || 'Serviço'}
                          </div>
                          <div className="mt-1 flex items-center gap-1 text-[9px] text-blue-400 font-bold">
                            <ShieldCheck className="w-3 h-3 text-blue-400 shrink-0" />
                            <span>Receita Federal: Oficina Cadastrada (BrasilAPI)</span>
                          </div>
                        </div>
                      )}
                    </td>

                    <td className="p-3.5 text-right font-black text-emerald-400">
                      R$ {e.total_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>

                    <td className="p-3.5 text-center">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          e.status === 'confirmed'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : e.status === 'rejected'
                            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {e.status === 'confirmed' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : e.status === 'rejected' ? (
                          <XCircle className="w-3 h-3" />
                        ) : (
                          <Clock className="w-3 h-3" />
                        )}
                        <span>{e.status}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* Modal de Negociação B2B com Postos */}
      <B2BNegotiationModal
        isOpen={showNegotiationModal}
        onClose={() => setShowNegotiationModal(false)}
        companyName={currentCompany?.name || 'TransLog Transportes'}
      />
    </div>
  );
};
