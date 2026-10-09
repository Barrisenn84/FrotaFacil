import React, { useState } from 'react';
import {
  Camera,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Gauge,
  Layers,
  X,
  RefreshCw,
  Eye,
  AlertCircle,
  FileCheck,
} from 'lucide-react';
import { CameraCapture } from './CameraCapture';
import { Vehicle, VehicleInspection, VehicleDamage, TireAnalysis } from '../types/fleet';
import { useFleet } from '../context/FleetContext';

interface VehicleInspectionModalProps {
  vehicle: Vehicle;
  onClose: () => void;
  onInspectionSaved?: (inspection: VehicleInspection) => void;
}

type InspectionStep =
  | 'guide'
  | 'photo_dianteira_esq'
  | 'photo_dianteira_dir'
  | 'photo_traseira_dir'
  | 'photo_traseira_esq'
  | 'photo_pneu'
  | 'processing'
  | 'report';

const STEPS_CONFIG: Array<{
  key: 'dianteiraEsquerda' | 'dianteiraDireita' | 'traseiraDireita' | 'traseiraEsquerda' | 'pneu';
  stepName: InspectionStep;
  title: string;
  subtitle: string;
  guideTip: string;
  stepNum: number;
}> = [
  {
    key: 'dianteiraEsquerda',
    stepName: 'photo_dianteira_esq',
    title: '1/5: Dianteira Esquerda',
    subtitle: 'Fotografe o canto dianteiro esquerdo (farol, para-choque e para-lama)',
    guideTip: 'Enquadre o para-choque e lateral dianteira esquerda com boa iluminação.',
    stepNum: 1,
  },
  {
    key: 'dianteiraDireita',
    stepName: 'photo_dianteira_dir',
    title: '2/5: Dianteira Direita',
    subtitle: 'Fotografe o canto dianteiro direito (farol, para-choque e para-lama)',
    guideTip: 'Capture possíveis mossas ou arranhões do lado direito.',
    stepNum: 2,
  },
  {
    key: 'traseiraDireita',
    stepName: 'photo_traseira_dir',
    title: '3/5: Traseira Direita',
    subtitle: 'Fotografe o canto traseiro direito (lanterna, para-choque e tampa)',
    guideTip: 'Verifique trincas na lanterna traseira e para-choque.',
    stepNum: 3,
  },
  {
    key: 'traseiraEsquerda',
    stepName: 'photo_traseira_esq',
    title: '4/5: Traseira Esquerda',
    subtitle: 'Fotografe o canto traseiro esquerdo (lanterna e lateral traseira)',
    guideTip: 'Enquadre a lateral traseira esquerda do veículo.',
    stepNum: 4,
  },
  {
    key: 'pneu',
    stepName: 'photo_pneu',
    title: '5/5: Pneu e Banda de Rodagem',
    subtitle: 'Fotografe de perto o sulco do pneu dianteiro ou mais desgastado',
    guideTip: 'Aproxime a câmera a ~20 cm do pneu para que a IA meça os sulcos em mm.',
    stepNum: 5,
  },
];

export const VehicleInspectionModal: React.FC<VehicleInspectionModalProps> = ({
  vehicle,
  onClose,
  onInspectionSaved,
}) => {
  const { inspectVehicleAI, saveInspection, currentUser, currentDriver } = useFleet();

  const [currentStep, setCurrentStep] = useState<InspectionStep>('guide');
  const [currentPhotoIdx, setCurrentPhotoIdx] = useState<number>(0);

  const [fotos, setFotos] = useState<{
    dianteiraEsquerda: string;
    dianteiraDireita: string;
    traseiraDireita: string;
    traseiraEsquerda: string;
    pneu: string;
  }>({
    dianteiraEsquerda: '',
    dianteiraDireita: '',
    traseiraDireita: '',
    traseiraEsquerda: '',
    pneu: '',
  });

  const [inspectionResult, setInspectionResult] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'annotated' | 'damages' | 'tire' | 'photos'>('annotated');

  // Callback de captura de foto
  const handlePhotoCaptured = (objUrl: string, blob?: Blob, dataUrl?: string) => {
    const finalImg = dataUrl || objUrl;
    const config = STEPS_CONFIG[currentPhotoIdx];

    const updatedFotos = {
      ...fotos,
      [config.key]: finalImg,
    };
    setFotos(updatedFotos);

    if (currentPhotoIdx < STEPS_CONFIG.length - 1) {
      const nextIdx = currentPhotoIdx + 1;
      setCurrentPhotoIdx(nextIdx);
      setCurrentStep(STEPS_CONFIG[nextIdx].stepName);
    } else {
      // Todas as 5 fotos coletadas -> Iniciar análise IA
      processInspection(updatedFotos);
    }
  };

  // Enviar para o endpoint de IA
  const processInspection = async (capturedFotos: typeof fotos) => {
    setCurrentStep('processing');
    setErrorMessage(null);

    const res = await inspectVehicleAI({
      fotos: capturedFotos,
      vehicleId: vehicle.id,
    });

    if (res.success && res.data) {
      setInspectionResult(res.data);
      setCurrentStep('report');
    } else {
      setErrorMessage(res.error || 'Falha ao processar a vistoria visual com IA. Tente novamente.');
      setCurrentStep('guide');
    }
  };

  // Salvar no Firestore
  const handleSaveToHistory = async () => {
    if (!inspectionResult) return;
    setIsSaving(true);
    setErrorMessage(null);

    const payload: Partial<VehicleInspection> = {
      veiculoId: vehicle.id,
      motoristaId: currentDriver?.id,
      motoristaNome: currentUser?.name || currentDriver?.name || 'Motorista',
      data: new Date().toISOString().split('T')[0],
      odometro: vehicle.kmAtual ?? vehicle.current_km ?? 0,
      status: inspectionResult.status || 'concluida',
      fotos,
      fotoAnotadaUrl: inspectionResult.fotoAnotadaUrl,
      avarias: inspectionResult.avarias || [],
      analisePneu: inspectionResult.analisePneu,
      resumoGeral: inspectionResult.resumoGeral,
      aprovado: inspectionResult.aprovado,
    };

    const res = await saveInspection(payload);
    setIsSaving(false);

    if (res.success && res.inspection) {
      if (onInspectionSaved) onInspectionSaved(res.inspection);
      onClose();
    } else {
      setErrorMessage(res.error || 'Erro ao gravar vistoria no banco de dados.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-3 sm:p-6 text-slate-100 font-['Plus_Jakarta_Sans',sans-serif] overflow-y-auto">
      {/* 1. TELA GUIA INICIAL */}
      {currentStep === 'guide' && (
        <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">Vistoria com Fotos e Inteligência Artificial</h2>
                <p className="text-xs text-slate-400">
                  {vehicle.plate} • {vehicle.model}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {errorMessage && (
            <div className="p-3.5 bg-rose-500/15 border border-rose-500/40 rounded-2xl text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="space-y-3 text-xs text-slate-300">
            <p className="font-semibold text-slate-200">
              Sem papelada! Basta fotografar os <strong>4 lados do veículo</strong> e a <strong>banda do pneu</strong>:
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800 flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-black text-xs flex items-center justify-center">1</span>
                <span>Dianteira Esquerda</span>
              </div>
              <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800 flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-black text-xs flex items-center justify-center">2</span>
                <span>Dianteira Direita</span>
              </div>
              <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800 flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-black text-xs flex items-center justify-center">3</span>
                <span>Traseira Direita</span>
              </div>
              <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800 flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-black text-xs flex items-center justify-center">4</span>
                <span>Traseira Esquerda</span>
              </div>
              <div className="col-span-2 p-3 bg-slate-950/80 rounded-2xl border border-emerald-500/30 flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-black text-xs flex items-center justify-center">5</span>
                <span className="font-bold text-emerald-300">Pneu do Veículo (Medição dos Sulcos em mm)</span>
              </div>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-2 text-[11px] text-amber-300">
              <Sparkles className="w-4 h-4 shrink-0 text-amber-400" />
              <span>
                A inteligência artificial analisa as fotos na hora, aponta arranhões ou amassados e calcula quantos quilômetros o pneu ainda pode rodar.
              </span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl text-xs transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                setCurrentPhotoIdx(0);
                setCurrentStep(STEPS_CONFIG[0].stepName);
              }}
              className="flex-1 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>Iniciar Vistoria (5 Fotos)</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. ETAPAS DE CAPTURA DE FOTOS (1 A 5) */}
      {currentStep !== 'guide' && currentStep !== 'processing' && currentStep !== 'report' && (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col">
          {/* Progress bar superior */}
          <div className="bg-slate-900 border-b border-slate-800 p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                {STEPS_CONFIG[currentPhotoIdx].title}
              </span>
              <span className="text-xs font-bold text-white hidden sm:inline">
                {STEPS_CONFIG[currentPhotoIdx].subtitle}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setCurrentStep('guide')}
              className="text-xs font-bold text-slate-400 hover:text-white px-2.5 py-1 bg-slate-800 rounded-lg"
            >
              Cancelar
            </button>
          </div>

          <div className="flex-1 relative">
            <CameraCapture
              title={STEPS_CONFIG[currentPhotoIdx].title}
              type="vistoria"
              onCapture={handlePhotoCaptured}
              onCancel={() => setCurrentStep('guide')}
              onClose={() => setCurrentStep('guide')}
            />
          </div>
        </div>
      )}

      {/* 3. TELA DE PROCESSAMENTO IA */}
      {currentStep === 'processing' && (
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-6">
          <div className="w-20 h-20 rounded-3xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto animate-pulse">
            <Sparkles className="w-10 h-10 text-amber-400 animate-spin" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Analisando as Fotos da Vistoria</h2>
            <p className="text-xs text-slate-400 mt-2">
              Estamos analisando as 5 fotos, verificando o desgaste dos pneus e marcando possíveis arranhões ou amassados no veículo...
            </p>
          </div>

          <div className="space-y-2 text-left text-xs bg-slate-950/60 p-4 rounded-2xl border border-slate-800 font-mono text-slate-300">
            <div className="flex items-center gap-2 text-amber-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>5 fotos enviadas com sucesso</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400 animate-pulse">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Verificando lataria e identificando avarias</span>
            </div>
            <div className="flex items-center gap-2 text-cyan-400 animate-pulse">
              <Gauge className="w-3.5 h-3.5" />
              <span>Calculando quanto tempo o pneu ainda pode rodar</span>
            </div>
            <div className="flex items-center gap-2 text-purple-400 animate-pulse">
              <Layers className="w-3.5 h-3.5" />
              <span>Gerando foto com marcação visual dos detalhes</span>
            </div>
          </div>
        </div>
      )}

      {/* 4. LAUDO PERICIAL DA VISTORIA (RELATÓRIO VISUAL) */}
      {currentStep === 'report' && inspectionResult && (
        <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black ${
                  inspectionResult.status === 'critica'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : inspectionResult.status === 'alerta'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                }`}
              >
                {inspectionResult.status === 'critica' ? (
                  <XCircle className="w-6 h-6" />
                ) : inspectionResult.status === 'alerta' ? (
                  <AlertTriangle className="w-6 h-6" />
                ) : (
                  <CheckCircle2 className="w-6 h-6" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black text-white">Relatório de Vistoria IA</h2>
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                      inspectionResult.status === 'critica'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : inspectionResult.status === 'alerta'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {inspectionResult.status === 'critica'
                      ? 'Crítico / Reprovado'
                      : inspectionResult.status === 'alerta'
                      ? 'Atenção Requerida'
                      : 'Aprovado para Rodar'}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Veículo {vehicle.plate} • {vehicle.model} • Odômetro: {vehicle.current_km.toLocaleString()} km
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-800 text-xs font-bold gap-1 pb-1">
            <button
              type="button"
              onClick={() => setActiveTab('annotated')}
              className={`px-3 py-2 rounded-xl transition cursor-pointer ${
                activeTab === 'annotated'
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Foto com Marcações
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('damages')}
              className={`px-3 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'damages'
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span>Avarias</span>
              <span className="px-1.5 py-0.2 rounded-full bg-slate-950/30 text-[10px]">
                {inspectionResult.avarias?.length || 0}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tire')}
              className={`px-3 py-2 rounded-xl transition cursor-pointer ${
                activeTab === 'tire'
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Análise do Pneu
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('photos')}
              className={`px-3 py-2 rounded-xl transition cursor-pointer ${
                activeTab === 'photos'
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Fotos Originais (5)
            </button>
          </div>

          {/* Tab 1: FOTO COM MARCAÇÕES */}
          {activeTab === 'annotated' && (
            <div className="space-y-3">
              <div className="relative rounded-2xl overflow-hidden border border-amber-500/30 bg-black aspect-video flex items-center justify-center shadow-xl">
                {inspectionResult.fotoAnotadaUrl ? (
                  <img
                    src={inspectionResult.fotoAnotadaUrl}
                    alt="Foto Anotada com Avarias"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-xs text-slate-500">Foto anotada não disponível</div>
                )}
                <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Marcação Visual Automática</span>
                </div>
              </div>
              <p className="text-xs text-slate-300 bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
                <strong>Resumo da IA:</strong> {inspectionResult.resumoGeral}
              </p>
            </div>
          )}

          {/* Tab 2: LISTA DE AVARIAS IDENTIFICADAS */}
          {activeTab === 'damages' && (
            <div className="space-y-3">
              {(!inspectionResult.avarias || inspectionResult.avarias.length === 0) ? (
                <div className="p-6 bg-slate-950/60 rounded-2xl border border-slate-800 text-center text-xs text-emerald-400 flex flex-col items-center gap-2">
                  <CheckCircle2 className="w-8 h-8" />
                  <span>Nenhuma avaria estrutural ou dano grave detectado na lataria.</span>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {inspectionResult.avarias.map((avaria: VehicleDamage, idx: number) => (
                    <div
                      key={avaria.id || idx}
                      className="p-3.5 bg-slate-950/80 rounded-2xl border border-slate-800 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-white text-sm">{avaria.local}</span>
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                            avaria.severidade === 'alta'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : avaria.severidade === 'media'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          }`}
                        >
                          Severidade {avaria.severidade}
                        </span>
                      </div>
                      <p className="text-slate-300">{avaria.descricao}</p>
                      <div className="text-[11px] text-amber-300 font-semibold flex items-center gap-1.5 pt-1">
                        <span>Recomendação:</span>
                        <span>{avaria.recomendacao}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: ANÁLISE DE PNEU & CODE EXECUTION */}
          {activeTab === 'tire' && inspectionResult.analisePneu && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 text-center">
                  <span className="text-[11px] text-slate-400 font-bold block">Sulco Medido</span>
                  <span className="text-2xl font-black text-amber-400">
                    {inspectionResult.analisePneu.desgastePneuMm} <span className="text-xs">mm</span>
                  </span>
                </div>
                <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 text-center">
                  <span className="text-[11px] text-slate-400 font-bold block">Limite Legal TWI</span>
                  <span className="text-2xl font-black text-slate-300">
                    {inspectionResult.analisePneu.limiteLegalMm} <span className="text-xs">mm</span>
                  </span>
                </div>
                <div className="col-span-2 sm:col-span-1 p-4 bg-slate-950/80 rounded-2xl border border-emerald-500/30 text-center">
                  <span className="text-[11px] text-emerald-400 font-bold block">KM Restantes Estimados</span>
                  <span className="text-2xl font-black text-emerald-300">
                    {inspectionResult.analisePneu.kmRestantesEstimados?.toLocaleString()}{' '}
                    <span className="text-xs">km</span>
                  </span>
                </div>
              </div>

              {/* Explicação do Code Execution */}
              <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl text-xs space-y-1 text-cyan-200">
                <div className="font-bold flex items-center gap-1.5 text-cyan-300">
                  <Gauge className="w-4 h-4" />
                  <span>Como o cálculo do pneu foi feito:</span>
                </div>
                <p className="font-mono text-[11px] pt-1">
                  {inspectionResult.analisePneu.calculoExplicacao}
                </p>
              </div>

              <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl text-xs space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase">
                  Recomendação Técnica de Manutenção:
                </span>
                <p className="text-white font-medium">{inspectionResult.analisePneu.recomendacao}</p>
              </div>
            </div>
          )}

          {/* Tab 4: 5 FOTOS ORIGINAIS */}
          {activeTab === 'photos' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {STEPS_CONFIG.map((cfg) => (
                <div key={cfg.key} className="space-y-1">
                  <div className="aspect-video bg-black rounded-xl overflow-hidden border border-slate-800">
                    {fotos[cfg.key] ? (
                      <img
                        src={fotos[cfg.key]}
                        alt={cfg.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">
                        Sem foto
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 block text-center">
                    {cfg.title}
                  </span>
                </div>
              ))}
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-rose-500/15 border border-rose-500/40 rounded-2xl text-xs text-rose-300">
              {errorMessage}
            </div>
          )}

          {/* Footer Save Action */}
          <div className="flex gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl text-xs transition cursor-pointer"
            >
              Descartar
            </button>
            <button
              type="button"
              onClick={handleSaveToHistory}
              disabled={isSaving}
              className="flex-1 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <FileCheck className="w-4 h-4" />
              )}
              <span>{isSaving ? 'Gravando no Histórico...' : 'Salvar Vistoria no Histórico'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
