import React, { useState } from 'react';
import {
  Sparkles,
  Moon,
  RefreshCw,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  DollarSign,
  Wrench,
  ShieldAlert,
  Search,
  ExternalLink,
  ChevronRight,
  Clock,
  Cpu,
  Truck,
  ArrowUpRight,
  Layers,
  Fuel,
} from 'lucide-react';
import { useFleet } from '../../context/FleetContext';
import { CityFuelComparison, PredictiveMaintenanceInsight } from '../../types/fleet';

export const NightlyFleetInsightsPanel: React.FC = () => {
  const { dailyInsights, runBatchInsightsJob, schedulePredictiveMaintenance } = useFleet();

  const [isRunningBatch, setIsRunningBatch] = useState<boolean>(false);
  const [schedulingVehicleId, setSchedulingVehicleId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'fiscal' | 'mecanico' | 'financeiro' | 'compliance'>('fiscal');

  const handleRunBatch = async () => {
    setIsRunningBatch(true);
    setSuccessMessage(null);
    const res = await runBatchInsightsJob();
    setIsRunningBatch(false);
    if (res.success) {
      setSuccessMessage('Job noturno da frota executado com sucesso e sincronizado!');
      setTimeout(() => setSuccessMessage(null), 5000);
    }
  };

  const handleAcceptSchedule = async (proj: PredictiveMaintenanceInsight) => {
    setSchedulingVehicleId(proj.vehicleId);
    const res = await schedulePredictiveMaintenance(proj.autoSchedulePayload);
    setSchedulingVehicleId(null);
    if (res.success) {
      setSuccessMessage(res.message || 'Revisão preventiva agendada com sucesso!');
      setTimeout(() => setSuccessMessage(null), 5000);
    }
  };

  const insights = dailyInsights;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-6 relative overflow-hidden font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-indigo-500/10 via-cyan-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

      {/* Header com Status do Job Noturno & Botão Batch API */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-cyan-500 flex items-center justify-center text-slate-950 shadow-lg shadow-indigo-500/25">
            <Moon className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white">Auditoria Inteligente da Frota</h2>
              <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                <Cpu className="w-3 h-3" />
                Análise Automática Noturna
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              4 verificações automáticas (Preços de Combustível, Manutenções, Gastos e Regras) cuidando da sua frota
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRunBatch}
          disabled={isRunningBatch}
          className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 transition cursor-pointer active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRunningBatch ? 'animate-spin' : ''}`} />
          <span>{isRunningBatch ? 'Executando Análise da Frota...' : 'Executar Análise Completa da Frota Agora'}</span>
        </button>
      </div>

      {successMessage && (
        <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Resumo Executivo Headline */}
      {insights && (
        <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-slate-300 font-medium">
              <strong>Síntese do Dia:</strong> {insights.summaryHeadline}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 hidden md:block whitespace-nowrap">
            Atualizado em: {new Date(insights.generatedAt).toLocaleTimeString('pt-BR')}
          </span>
        </div>
      )}

      {/* Tabs dos 4 Agentes Especializados */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border-b border-slate-800 pb-3">
        {/* Tab 1: Agente Fiscal */}
        <button
          type="button"
          onClick={() => setActiveTab('fiscal')}
          className={`p-3 rounded-2xl transition cursor-pointer text-left flex items-center gap-2.5 ${
            activeTab === 'fiscal'
              ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
              : 'bg-slate-950/60 text-slate-400 hover:text-white hover:bg-slate-950 border border-slate-800'
          }`}
        >
          <Search className="w-4 h-4 shrink-0" />
          <div>
            <span className="text-xs font-bold block">1. Auditoria de Preços</span>
            <span className="text-[10px] opacity-80 block">Preços Oficiais ANP</span>
          </div>
        </button>

        {/* Tab 2: Agente Mecânico */}
        <button
          type="button"
          onClick={() => setActiveTab('mecanico')}
          className={`p-3 rounded-2xl transition cursor-pointer text-left flex items-center gap-2.5 ${
            activeTab === 'mecanico'
              ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
              : 'bg-slate-950/60 text-slate-400 hover:text-white hover:bg-slate-950 border border-slate-800'
          }`}
        >
          <Wrench className="w-4 h-4 shrink-0" />
          <div>
            <span className="text-xs font-bold block">2. Agente Mecânico</span>
            <span className="text-[10px] opacity-80 block">Preditivo 1-Clique</span>
          </div>
        </button>

        {/* Tab 3: Agente Financeiro */}
        <button
          type="button"
          onClick={() => setActiveTab('financeiro')}
          className={`p-3 rounded-2xl transition cursor-pointer text-left flex items-center gap-2.5 ${
            activeTab === 'financeiro'
              ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
              : 'bg-slate-950/60 text-slate-400 hover:text-white hover:bg-slate-950 border border-slate-800'
          }`}
        >
          <DollarSign className="w-4 h-4 shrink-0" />
          <div>
            <span className="text-xs font-bold block">3. Agente Financeiro</span>
            <span className="text-[10px] opacity-80 block">TCO & R$/KM</span>
          </div>
        </button>

        {/* Tab 4: Agente Compliance */}
        <button
          type="button"
          onClick={() => setActiveTab('compliance')}
          className={`p-3 rounded-2xl transition cursor-pointer text-left flex items-center gap-2.5 ${
            activeTab === 'compliance'
              ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
              : 'bg-slate-950/60 text-slate-400 hover:text-white hover:bg-slate-950 border border-slate-800'
          }`}
        >
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <div>
            <span className="text-xs font-bold block">4. Compliance</span>
            <span className="text-[10px] opacity-80 block">Docs & Multas</span>
          </div>
        </button>
      </div>

      {/* CONTEÚDO 1: AGENTE FISCAL COM GOOGLE SEARCH GROUNDING */}
      {activeTab === 'fiscal' && insights && (
        <div className="space-y-4 animate-in fade-in">
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between text-xs">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-amber-400">
                Pesquisa Oficial de Preços de Combustíveis da ANP no Brasil
              </span>
              <p className="text-slate-200">
                O sistema pesquisou os preços médios praticados na cidade e identificou abastecimentos acima da curva de mercado.
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block font-bold">Economia Potencial Estimada</span>
              <span className="text-lg font-black text-emerald-400">
                + R$ {insights.agenteFiscal.economiaPotencialMensalBrl?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {insights.agenteFiscal.comparativosPrecoCidade.map((comp: CityFuelComparison, idx: number) => (
              <div
                key={idx}
                className="p-4 bg-slate-950/90 border border-slate-800 hover:border-amber-500/40 rounded-2xl transition space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">
                      <Fuel className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-white flex items-center gap-2">
                        <span>{comp.vehiclePlate} ({comp.vehicleModel})</span>
                        <span className="text-[10px] text-slate-400 font-normal">• {comp.city}</span>
                      </div>
                      <span className="text-[11px] text-slate-400">{comp.fuelType}</span>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full ${
                      comp.status === 'muito_acima'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : comp.status === 'acima_da_media'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {comp.status === 'muito_acima'
                      ? 'Preço Fora da Curva'
                      : comp.status === 'acima_da_media'
                      ? 'Acima da Média ANP'
                      : 'Preço Alinhado'}
                  </span>
                </div>

                {/* Mensagem de Comparativo Exigida */}
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs text-amber-300 font-semibold flex items-center justify-between">
                  <span>{comp.message}</span>
                  <span className="text-[10px] text-rose-400 font-black">
                    (+ R$ {comp.totalOverpaid?.toFixed(2)} a mais no tanque)
                  </span>
                </div>

                {/* Grounding Source */}
                {comp.sourceUri && (
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-1">
                    <Search className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Fonte Oficial de Consulta:</span>
                    <a
                      href={comp.sourceUri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-300 hover:underline flex items-center gap-1 font-bold"
                    >
                      <span>{comp.sourceTitle || 'Pesquisa Oficial ANP'}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CONTEÚDO 2: AGENTE MECÂNICO PREDITIVO COM 1-CLIQUE */}
      {activeTab === 'mecanico' && insights && (
        <div className="space-y-4 animate-in fade-in">
          <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl text-xs space-y-1 text-cyan-200">
            <span className="text-[10px] font-black uppercase text-cyan-400 block">
              Notificação Preditiva Proativa & Ação de 1-Clique
            </span>
            <p>
              O Agente Mecânico calcula a taxa de rodagem diária e antecipa a data em que o veículo baterá a quilometragem da próxima revisão.
            </p>
          </div>

          <div className="space-y-3">
            {insights.agenteMecanico.projecoesPreditivas.map((proj: PredictiveMaintenanceInsight, idx: number) => (
              <div
                key={idx}
                className="p-5 bg-slate-950/90 border border-slate-800 rounded-2xl space-y-4 shadow-md"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-black">
                      <Wrench className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-white">
                        {proj.vehicleModel} ({proj.vehiclePlate})
                      </h4>
                      <p className="text-xs text-slate-400">
                        {proj.serviceDescription} • Odômetro atual: {proj.currentKm?.toLocaleString()} km
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-amber-400 bg-amber-500/10 px-3 py-1 rounded-xl border border-amber-500/20">
                      Restam {proj.kmRemaining} km (~{proj.estimatedDaysToTarget} dias)
                    </span>
                  </div>
                </div>

                {/* Notificação Inteligente em Destaque */}
                <div className="p-4 bg-gradient-to-r from-slate-900 to-slate-950 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-amber-400 shrink-0 animate-pulse" />
                    <div>
                      <span className="text-xs font-black text-white block">
                        "{proj.scheduledPrompt}"
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Previsão de alcance: {new Date(proj.targetDateEstimated).toLocaleDateString('pt-BR')} ({proj.targetKm?.toLocaleString()} km)
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAcceptSchedule(proj)}
                    disabled={schedulingVehicleId === proj.vehicleId}
                    className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    {schedulingVehicleId === proj.vehicleId ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>Aceitar & Agendar Revisão</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CONTEÚDO 3: AGENTE FINANCEIRO (TCO & R$/KM) */}
      {activeTab === 'financeiro' && insights && (
        <div className="space-y-4 animate-in fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Custo Total da Frota</span>
              <span className="text-xl font-black text-white">
                R$ {insights.agenteFinanceiro.custoTotalFrotaBrl?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Custo Médio por KM</span>
              <span className="text-xl font-black text-amber-400">
                R$ {insights.agenteFinanceiro.custoMedioPorKm?.toFixed(2)} <span className="text-xs">/km</span>
              </span>
            </div>
            <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Tendência Mensal</span>
              <span className="text-xl font-black text-emerald-400">
                {insights.agenteFinanceiro.tendenciaMensalPercent > 0 ? '+' : ''}
                {insights.agenteFinanceiro.tendenciaMensalPercent?.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="space-y-2.5">
            {insights.agenteFinanceiro.veiculosConsolidacao.map((v: any, idx: number) => (
              <div
                key={idx}
                className="p-4 bg-slate-950/90 border border-slate-800 rounded-2xl flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="font-extrabold text-white text-sm">
                    {v.vehiclePlate} ({v.vehicleModel})
                  </div>
                  <div className="text-slate-400 text-[11px] mt-0.5">{v.tcoInsight}</div>
                </div>
                <div className="text-right">
                  <span className="font-black text-amber-400 block">R$ {v.costPerKm?.toFixed(2)}/km</span>
                  <span className="text-[10px] font-bold uppercase text-slate-500">
                    TCO: {v.tcoScore}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CONTEÚDO 4: AGENTE DE COMPLIANCE */}
      {activeTab === 'compliance' && insights && (
        <div className="space-y-4 animate-in fade-in">
          <div className="p-3.5 bg-slate-950/80 rounded-2xl border border-slate-800 text-xs text-slate-300">
            <strong>Parecer Regulatório:</strong> {insights.agenteCompliance.parecerExecutivo}
          </div>

          <div className="space-y-2.5">
            {insights.agenteCompliance.alertasDocumentos.map((doc: any, idx: number) => (
              <div
                key={doc.id || idx}
                className="p-4 bg-slate-950/90 border border-slate-800 rounded-2xl flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-extrabold text-white block">{doc.title}</span>
                    <span className="text-[11px] text-slate-400">
                      Placa: {doc.vehiclePlate || 'Frota Geral'} • Vence em: {doc.dueDate} ({doc.daysRemaining} dias restantes)
                    </span>
                  </div>
                </div>
                <span className="text-[11px] text-amber-300 font-bold bg-amber-500/10 px-2.5 py-1 rounded-xl border border-amber-500/20">
                  {doc.recommendation}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State quando o sistema estiver zerado */}
      {!insights && (
        <div className="p-8 text-center bg-slate-950/40 border border-dashed border-slate-800 rounded-2xl space-y-3 animate-in fade-in">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mx-auto flex items-center justify-center">
            <Moon className="w-6 h-6" />
          </div>
          <div className="text-sm font-bold text-white">Nenhum insight noturno gerado para a empresa</div>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Assim que veículos e abastecimentos forem registrados ou a planilha for espelhada, clique em <strong className="text-slate-200">Executar Análise Noturna</strong> acima para ativar os 4 agentes de IA.
          </p>
        </div>
      )}
    </div>
  );
};
