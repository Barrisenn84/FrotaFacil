import React, { useState } from 'react';
import { Users, Plus, Search, Phone, Mail, Award, Calendar, Edit2, CheckCircle2, Sparkles, ShieldCheck, Leaf } from 'lucide-react';
import { Driver } from '../../types/fleet';
import { DriverModal } from './DriverModal';
import { generateDriverAiCoach } from '../../services/deepFleetAiService';

interface DriversTabProps {
  drivers: Driver[];
  onCreateDriver: (data: Partial<Driver>) => Promise<{ success: boolean; error?: string }>;
  onUpdateDriver: (id: string, data: Partial<Driver>) => Promise<{ success: boolean; error?: string }>;
}

export const DriversTab: React.FC<DriversTabProps> = ({
  drivers,
  onCreateDriver,
  onUpdateDriver,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);

  const filtered = drivers.filter(
    (d) =>
      d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.cnh.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenCreate = () => {
    setSelectedDriver(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (d: Driver) => {
    setSelectedDriver(d);
    setIsModalOpen(true);
  };

  const handleSave = async (data: Partial<Driver>) => {
    if (selectedDriver) {
      return await onUpdateDriver(selectedDriver.id, data);
    } else {
      return await onCreateDriver(data);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Search and Add button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            <span>Equipe de Motoristas Autorizados ({drivers.length})</span>
          </h2>
          <p className="text-xs text-slate-400">
            Cadastro de CNH, controle de vigência e habilitação de acesso para registro fotográfico
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome, e-mail ou CNH..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition shadow-lg shadow-blue-600/10 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Cadastrar Motorista</span>
          </button>
        </div>
      </div>

      {/* Drivers Grid */}
      {filtered.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-500 bg-slate-900/60 border border-slate-800 rounded-2xl">
          Nenhum motorista localizado com os termos informados.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((d) => (
            <div
              key={d.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 transition shadow-lg flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 pb-3 mb-3 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-extrabold text-white">{d.name}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          d.status === 'ativo'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {d.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-1">
                      <Mail className="w-3 h-3 text-slate-500" />
                      <span>{d.email}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenEdit(d)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                    title="Editar Motorista"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                  </button>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-500" />
                      <span>Telefone:</span>
                    </span>
                    <span className="font-bold text-slate-200">{d.phone || 'Não informado'}</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-amber-400" />
                      <span>CNH (Categoria {d.cnh_category}):</span>
                    </span>
                    <span className="font-mono font-bold text-white">{d.cnh || '---'}</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-blue-400" />
                      <span>Validade CNH:</span>
                    </span>
                    <span className="font-bold text-slate-200">{d.cnh_expiration || '---'}</span>
                  </div>

                  {/* AI Eco-Driving & Coaching Section */}
                  {(() => {
                    const coach = generateDriverAiCoach(d, []);
                    return (
                      <div className="pt-2 border-t border-slate-800/80 space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="flex items-center gap-1 text-slate-400">
                            <Leaf className="w-3 h-3 text-emerald-400" />
                            <span>Direção Econômica:</span>
                          </span>
                          <span className="font-black text-emerald-400">
                            {coach.ecoDrivingScore}/100 • {coach.nivelEficiencia}
                          </span>
                        </div>

                        <div className="p-2 rounded-lg bg-indigo-950/30 border border-indigo-500/20 text-[10px] text-indigo-200">
                          <div className="font-bold text-indigo-300 flex items-center gap-1 mb-0.5">
                            <Sparkles className="w-2.5 h-2.5" />
                            Dica para Economizar Combustível:
                          </div>
                          <p className="line-clamp-2 leading-relaxed text-slate-300">
                            {coach.dicasComportamentais[0]}
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Acesso app habilitado</span>
                </span>
                <span>ID: {d.id.substring(0, 10)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Motorista */}
      <DriverModal
        isOpen={isModalOpen}
        driver={selectedDriver}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
};
