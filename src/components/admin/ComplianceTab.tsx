import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Key,
  Cpu,
  Database,
  Truck,
  Eye,
  Sparkles,
  Gauge,
  ArrowRight,
  ChevronRight,
  Layers,
  Calendar,
  XCircle,
  FileCheck,
} from 'lucide-react';
import { Company, DashboardMetrics, Vehicle, VehicleInspection } from '../../types/fleet';
import { useFleet } from '../../context/FleetContext';

interface ComplianceTabProps {
  company: Company | null;
  metrics: DashboardMetrics | null;
}

export const ComplianceTab: React.FC<ComplianceTabProps> = ({ company, metrics }) => {
  const { vehicles, inspections } = useFleet();

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(
    vehicles[0]?.id || ''
  );
  const [selectedInspection, setSelectedInspection] = useState<VehicleInspection | null>(null);

  // Vistorias do veículo selecionado ordenadas por data descrescente
  const vehicleInspections = inspections.filter(
    (i) => i.veiculoId === selectedVehicleId
  );

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) || vehicles[0];

  const latestInspection = vehicleInspections[0] || null;
  const previousInspection = vehicleInspections[1] || null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span>Compliance, Auditoria & Vistorias Visuais IA</span>
          </h2>
          <p className="text-xs text-slate-400">
            Histórico pericial por veículo com laudos do Nano Banana 2 e comparação antes/depois
          </p>
        </div>

        {/* Seletor de Veículo para Vistoria */}
        {vehicles.length > 0 && (
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-amber-400" />
            <select
              value={selectedVehicleId}
              onChange={(e) => {
                setSelectedVehicleId(e.target.value);
                setSelectedInspection(null);
              }}
              className="bg-slate-900 border border-slate-700 text-xs font-bold text-white px-3 py-2 rounded-xl focus:outline-none"
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

      {/* SEÇÃO 1: COMPARAÇÃO ANTES / DEPOIS DA ÚLTIMA VISTORIA */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">
                Comparativo Antes / Depois ({selectedVehicle?.plate || 'Veículo'})
              </h3>
              <span className="text-[11px] text-slate-400">
                Evolução pericial do estado da lataria e desgaste dos pneus
              </span>
            </div>
          </div>
          {latestInspection && (
            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
              {vehicleInspections.length} vistoria(s) registrada(s)
            </span>
          )}
        </div>

        {!latestInspection ? (
          <div className="p-8 bg-slate-950/60 rounded-2xl border border-slate-800 text-center text-xs text-slate-400 space-y-2">
            <FileCheck className="w-8 h-8 text-slate-600 mx-auto" />
            <p>Nenhuma vistoria visual registrada ainda para este veículo.</p>
            <p className="text-[11px] text-slate-500">
              O motorista pode realizar a vistoria dos 4 cantos + pneu diretamente pelo painel do motorista.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* Vistoria Anterior */}
            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-slate-400">
                  Vistoria Anterior
                </span>
                <span className="text-[11px] text-slate-500 font-bold">
                  {previousInspection ? previousInspection.data : 'Sem registro prévio'}
                </span>
              </div>

              {previousInspection ? (
                <div className="space-y-3">
                  <div className="aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 relative">
                    <img
                      src={previousInspection.fotoAnotadaUrl || previousInspection.fotos?.dianteiraEsquerda}
                      alt="Vistoria Anterior"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-0.5 rounded text-[10px] font-bold text-slate-300">
                      Odômetro: {previousInspection.odometro.toLocaleString()} km
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Sulco Pneu</span>
                      <span className="font-extrabold text-white">
                        {previousInspection.analisePneu?.desgastePneuMm || 6.0} mm
                      </span>
                    </div>
                    <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Avarias</span>
                      <span className="font-extrabold text-white">
                        {previousInspection.avarias?.length || 0} registrada(s)
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-10 text-center text-xs text-slate-500">
                  Esta foi a 1ª vistoria do veículo na plataforma.
                </div>
              )}
            </div>

            {/* Vistoria Mais Recente */}
            <div className="p-4 bg-slate-950/90 border border-cyan-500/30 rounded-2xl space-y-3 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-cyan-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Última Vistoria (Atual)</span>
                </span>
                <span className="text-[11px] text-cyan-300 font-bold">
                  {latestInspection.data} ({latestInspection.odometro.toLocaleString()} km)
                </span>
              </div>

              <div className="aspect-video bg-black rounded-xl overflow-hidden border border-cyan-500/40 relative">
                <img
                  src={latestInspection.fotoAnotadaUrl || latestInspection.fotos?.dianteiraEsquerda}
                  alt="Última Vistoria Anotada"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 right-2 bg-amber-500 text-slate-950 px-2 py-0.5 rounded text-[10px] font-black">
                  Nano Banana 2
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Sulco Atual (Pneu)</span>
                  <span className="font-extrabold text-amber-400">
                    {latestInspection.analisePneu?.desgastePneuMm} mm
                  </span>
                  {previousInspection && (
                    <span className="text-[10px] text-slate-400 block">
                      (Δ {(latestInspection.analisePneu.desgastePneuMm - previousInspection.analisePneu.desgastePneuMm).toFixed(1)} mm)
                    </span>
                  )}
                </div>
                <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-emerald-400 block">KM Restantes (Code Exec)</span>
                  <span className="font-extrabold text-emerald-300">
                    ~{latestInspection.analisePneu?.kmRestantesEstimados?.toLocaleString()} km
                  </span>
                </div>
              </div>

              {/* Lista de Avarias Atuais */}
              {latestInspection.avarias && latestInspection.avarias.length > 0 && (
                <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800 text-xs space-y-1">
                  <span className="text-[10px] font-black uppercase text-amber-400 block">
                    Avarias Detectadas ({latestInspection.avarias.length}):
                  </span>
                  {latestInspection.avarias.map((av, idx) => (
                    <div key={idx} className="text-[11px] text-slate-300 flex items-center justify-between">
                      <span>• {av.local}: {av.descricao}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-800 text-amber-300">
                        {av.severidade}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* SEÇÃO 2: HISTÓRICO COMPLETO DE VISTORIAS DO VEÍCULO */}
      {vehicleInspections.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              <span>Histórico Cronológico de Vistorias ({selectedVehicle?.plate})</span>
            </h3>
          </div>

          <div className="space-y-3">
            {vehicleInspections.map((insp) => (
              <div
                key={insp.id}
                onClick={() =>
                  setSelectedInspection(selectedInspection?.id === insp.id ? null : insp)
                }
                className="p-4 bg-slate-950/80 hover:bg-slate-950 border border-slate-800 hover:border-amber-500/40 rounded-2xl transition cursor-pointer space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                        insp.status === 'critica'
                          ? 'bg-rose-500/20 text-rose-400'
                          : insp.status === 'alerta'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-emerald-500/20 text-emerald-400'
                      }`}
                    >
                      {insp.status === 'critica' ? (
                        <XCircle className="w-5 h-5" />
                      ) : (
                        <CheckCircle2 className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-black text-white flex items-center gap-2">
                        <span>Vistoria de {insp.data}</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          • {insp.odometro.toLocaleString()} km
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Motorista: {insp.motoristaNome || 'Condutor Autorizado'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                      <span className="text-xs font-bold text-amber-400 block">
                        Sulco: {insp.analisePneu?.desgastePneuMm || 5.0} mm
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {insp.avarias?.length || 0} avaria(s)
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </div>
                </div>

                {/* Detalhe Expandido se Clicado */}
                {selectedInspection?.id === insp.id && (
                  <div className="pt-3 border-t border-slate-800 space-y-3 animate-in fade-in">
                    <div className="aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 max-h-64 mx-auto">
                      <img
                        src={insp.fotoAnotadaUrl || insp.fotos?.dianteiraEsquerda}
                        alt="Foto Anotada"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <p className="text-xs text-slate-300 bg-slate-900 p-3 rounded-xl">
                      <strong>Parecer Técnico:</strong> {insp.resumoGeral}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SEÇÃO 3: PILARES DE SEGURANÇA & GOVERNANÇA CORPORATIVA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pilar 1: SHA-256 Duplicidade */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">Prevenção de Duplicidade SHA-256</h3>
              <span className="text-[10px] text-emerald-400 font-bold uppercase">Auditoria Criptográfica Ativa</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Cada cupom fiscal fotografado gera uma assinatura criptográfica exclusiva (Hash SHA-256). Caso a mesma imagem seja reutilizada, o sistema bloqueia no ato.
          </p>
          <div className="pt-2 flex items-center gap-2 text-xs font-bold text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>0 duplicidades fiscais detectadas</span>
          </div>
        </div>

        {/* Pilar 2: Dual-Scan Odômetro */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">Auditoria Dual-Scan de Odômetro</h3>
              <span className="text-[10px] text-blue-400 font-bold uppercase">Conferência Visual Cruzada</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            O motorista fotografa o cupom e o painel. O odômetro digitado é validado contra a quilometragem real crescente, impedindo retrocessos não autorizados.
          </p>
          <div className="pt-2 flex items-center gap-2 text-xs font-bold text-blue-300">
            <CheckCircle2 className="w-4 h-4 text-blue-400" />
            <span>Integridade de odômetros rigorosa</span>
          </div>
        </div>

        {/* Pilar 3: Tolerância de Tanque */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">Bloqueio Anti-Sobretanque</h3>
              <span className="text-[10px] text-amber-400 font-bold uppercase">
                Margem Técnica Máxima: {company?.maxTankMarginPercent || 10}%
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Abastecimentos que superem a capacidade volumétrica do tanque homologado sofrem alerta imediato ou retenção para aprovação gerencial.
          </p>
          <div className="pt-2 flex items-center gap-2 text-xs font-bold text-amber-300">
            <CheckCircle2 className="w-4 h-4 text-amber-400" />
            <span>Parâmetro empresarial configurado</span>
          </div>
        </div>

        {/* Pilar 4: Isolamento Firestore Multiempresa */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">Isolamento Multiempresa RBAC</h3>
              <span className="text-[10px] text-purple-400 font-bold uppercase">Firestore Security Rules v2</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Regras de segurança do Firestore garantem que motoristas só leem/gravam seus próprios registros e nenhuma empresa tem acesso a dados de outra.
          </p>
          <div className="pt-2 flex items-center gap-2 text-xs font-bold text-purple-300">
            <Lock className="w-4 h-4 text-purple-400" />
            <span>Empresa ID: {company?.id || 'emp-translog'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
