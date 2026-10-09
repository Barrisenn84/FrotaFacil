import React, { useState, useEffect } from 'react';
import { useFleet } from '../context/FleetContext';
import { CameraCapture } from './CameraCapture';
import { OCRConfirmation } from './OCRConfirmation';
import { CopilotoVoz } from './CopilotoVoz';
import { VehicleInspectionModal } from './VehicleInspectionModal';
import {
  Fuel,
  Wrench,
  History,
  Truck,
  Gauge,
  CheckCircle2,
  AlertCircle,
  WifiOff,
  RefreshCw,
  Sparkles,
  Camera,
  Layers,
  ArrowRight,
  Mic,
  Radio,
  ShieldCheck,
  CloudRain,
} from 'lucide-react';
import { Vehicle, FleetEvent } from '../types/fleet';
import { fetchRouteWeather, RouteWeatherData } from '../services/freePublicApisService';

interface DriverHomeProps {
  onOpenHistory?: () => void;
}

export const DriverHome: React.FC<DriverHomeProps> = ({ onOpenHistory }) => {
  const {
    currentCompany,
    currentUser,
    currentDriver,
    vehicles,
    dailyInsights,
    schedulePredictiveMaintenance,
    extractReceiptAI,
    confirmEvent,
    offlineDrafts,
    saveOfflineDraft,
    syncOfflineDraft,
  } = useFleet();

  // Selected vehicle (defaults to first linked vehicle)
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(vehicles[0]?.id || '');
  const activeVehicle = vehicles.find((v) => v.id === selectedVehicleId) || vehicles[0];

  const [schedulingPredictive, setSchedulingPredictive] = useState<boolean>(false);
  const [scheduledVehicles, setScheduledVehicles] = useState<Record<string, string>>({});

  // Projeção preditiva do Agente Mecânico para o veículo selecionado
  const activePredictive = dailyInsights?.agenteMecanico?.projecoesPreditivas?.find(
    (p) => p.vehicleId === activeVehicle?.id || p.vehiclePlate === activeVehicle?.plate
  ) || dailyInsights?.agenteMecanico?.projecoesPreditivas?.[0];

  // Capture Flow States
  // 'idle' | 'capturing_receipt' | 'capturing_odometer' | 'processing_ai' | 'confirming' | 'voice_copilot' | 'success'
  const [flowState, setFlowState] = useState<string>('idle');
  const [eventType, setEventType] = useState<'abastecimento' | 'manutencao'>('abastecimento');
  const [dualScanActive, setDualScanActive] = useState<boolean>(true);

  // Images in memory
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [odometerImage, setOdometerImage] = useState<string | null>(null);

  // Extracted Event Data & Validations
  const [extractedEvent, setExtractedEvent] = useState<FleetEvent | null>(null);
  const [extractionMetadata, setExtractionMetadata] = useState<any>(null);
  const [eventValidations, setEventValidations] = useState<any[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [routeWeather, setRouteWeather] = useState<RouteWeatherData | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const fallbackCity = currentCompany?.name?.toLowerCase().includes('rio')
      ? 'rio de janeiro'
      : currentCompany?.name?.toLowerCase().includes('sul') || currentCompany?.name?.toLowerCase().includes('curitiba')
      ? 'curitiba'
      : 'sao paulo';

    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (isCancelled) return;
          fetchRouteWeather({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            cityName: 'Sua Rota Atual',
          })
            .then((data) => {
              if (!isCancelled) setRouteWeather(data);
            })
            .catch((err) => console.warn('Erro ao carregar clima por coordenadas:', err));
        },
        () => {
          if (isCancelled) return;
          fetchRouteWeather(fallbackCity)
            .then((data) => {
              if (!isCancelled) setRouteWeather(data);
            })
            .catch((err) => console.warn('Erro ao carregar clima para motorista:', err));
        },
        { timeout: 5000, maximumAge: 600000 }
      );
    } else {
      fetchRouteWeather(fallbackCity)
        .then((data) => {
          if (!isCancelled) setRouteWeather(data);
        })
        .catch((err) => console.warn('Erro ao carregar clima para motorista:', err));
    }

    return () => {
      isCancelled = true;
    };
  }, [currentCompany?.id, currentCompany?.name]);

  // Start registering
  const startRegister = (type: 'abastecimento' | 'manutencao') => {
    setEventType(type);
    setReceiptImage(null);
    setOdometerImage(null);
    setFlowState('capturing_receipt');
  };

  // Callback from CameraCapture for receipt
  const handleReceiptCaptured = (objUrl: string, blob?: Blob, dataUrl?: string) => {
    const finalImg = dataUrl || objUrl;
    setReceiptImage(finalImg);

    if (dualScanActive) {
      setFlowState('capturing_odometer');
    } else {
      processCapturedImages(finalImg, null);
    }
  };

  // Callback from CameraCapture for odometer
  const handleOdometerCaptured = (objUrl: string, blob?: Blob, dataUrl?: string) => {
    const finalOdo = dataUrl || objUrl;
    setOdometerImage(finalOdo);
    processCapturedImages(receiptImage!, finalOdo);
  };

  // Send to AI endpoint
  const processCapturedImages = async (receipt: string, odo: string | null) => {
    setFlowState('processing_ai');

    // Check if browser is offline
    if (!navigator.onLine) {
      saveOfflineDraft({
        companyId: currentCompany?.id || '',
        vehicleId: activeVehicle.id,
        type: eventType,
        receiptImageBase64: receipt,
        odometerImageBase64: odo || undefined,
      });
      setSuccessMessage('Rascunho salvo offline! Será sincronizado automaticamente ao reconectar.');
      setFlowState('idle');
      return;
    }

    const res = await extractReceiptAI({
      receiptImageBase64: receipt,
      odometerImageBase64: odo || undefined,
      type: eventType,
      vehicleId: activeVehicle.id,
    });

    if (res.success && res.data) {
      setExtractedEvent(res.data.event);
      setExtractionMetadata(res.data.extraction);
      setEventValidations(res.data.validations);
      setFlowState('confirming');
    } else {
      setErrorMessage(res.error || 'Não foi possível ler o comprovante. Tente novamente.');
      setFlowState('idle');
    }
  };

  // Final confirmation
  const handleConfirmEvent = async (payload: any) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    const result = await confirmEvent(payload);
    setIsSubmitting(false);

    if (result.success) {
      setSuccessMessage(
        `Registro confirmado com sucesso! Odômetro atualizado para ${payload.odometer.toLocaleString()} km.`
      );
      setFlowState('idle');
      setTimeout(() => setSuccessMessage(null), 5000);
    } else {
      setErrorMessage(result.error || result.message || 'Falha ao confirmar.');
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 text-slate-100 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Offline drafts notification */}
      {offlineDrafts.length > 0 && (
        <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-amber-400" />
            <span>
              Você tem <strong>{offlineDrafts.length} comprovante(s)</strong> gravados em modo offline.
            </span>
          </div>
          <button
            type="button"
            onClick={() => syncOfflineDraft(offlineDrafts[0].localId)}
            className="px-2.5 py-1 bg-amber-500 text-slate-950 font-bold rounded-lg hover:bg-amber-400 transition"
          >
            Sincronizar
          </button>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="mb-4 p-4 bg-rose-500/20 border border-rose-500/40 rounded-2xl flex items-center justify-between text-xs sm:text-sm text-rose-200 animate-in fade-in">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-white p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Success Banner */}
      {successMessage && (
        <div className="mb-4 p-4 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl flex items-center gap-3 text-xs sm:text-sm text-emerald-200 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Active Camera Step: Receipt */}
      {flowState === 'capturing_receipt' && (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col">
          <CameraCapture
            title={eventType === 'abastecimento' ? 'Fotografar Cupom Fiscal' : 'Fotografar Ordem de Serviço'}
            type={eventType}
            onCapture={handleReceiptCaptured}
            onCancel={() => setFlowState('idle')}
            onClose={() => setFlowState('idle')}
          />
        </div>
      )}

      {/* Active Camera Step: Odometer */}
      {flowState === 'capturing_odometer' && (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col">
          <div className="p-3 bg-amber-500/20 border-b border-amber-500/30 text-center text-xs font-bold text-amber-300">
            Foto 2 de 2: Aponte a câmera para o painel do veículo para registrar a quilometragem
          </div>
          <CameraCapture
            title="Fotografar Odômetro no Painel"
            type={eventType}
            onCapture={handleOdometerCaptured}
            onCancel={() => {
              // Permite pular foto do painel e processar apenas o cupom
              processCapturedImages(receiptImage!, null);
            }}
            onClose={() => setFlowState('idle')}
          />
        </div>
      )}

      {/* AI Processing Screen */}
      {flowState === 'processing_ai' && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
          <div className="w-20 h-20 rounded-3xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mb-6 animate-pulse">
            <Sparkles className="w-10 h-10 text-amber-400 animate-spin" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">Lendo o Comprovante com Inteligência Artificial</h2>
          <p className="mt-2 text-sm text-slate-400 max-w-sm">
            O sistema está identificando os valores, quantidade de litros, posto e quilometragem automaticamente...
          </p>
          <div className="mt-6 flex items-center gap-2 text-xs text-amber-400 font-semibold bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/20">
            <Layers className="w-3.5 h-3.5" />
            <span>Conferência Automática da Nota e do Painel</span>
          </div>
        </div>
      )}

      {/* Confirmation Screen */}
      {flowState === 'confirming' && extractedEvent && activeVehicle && (
        <OCRConfirmation
          event={extractedEvent}
          extraction={extractionMetadata}
          validations={eventValidations}
          vehicle={activeVehicle}
          onConfirm={handleConfirmEvent}
          onCancel={() => setFlowState('idle')}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Voice Copilot (Gemini 3.8 Live API) */}
      {flowState === 'voice_copilot' && activeVehicle && (
        <CopilotoVoz
          vehicle={activeVehicle}
          onClose={() => setFlowState('idle')}
          onEventSaved={() => {
            setSuccessMessage('Registro por voz gravado com sucesso na frota!');
          }}
        />
      )}

      {/* Vistoria Visual por IA (4 Cantos + Pneu) */}
      {flowState === 'inspection' && activeVehicle && (
        <VehicleInspectionModal
          vehicle={activeVehicle}
          onClose={() => setFlowState('idle')}
          onInspectionSaved={() => {
            setSuccessMessage('Vistoria visual pericial gravada com sucesso no histórico!');
          }}
        />
      )}

      {/* Main Driver Dashboard (When Idle) */}
      {flowState === 'idle' && (
        <div className="space-y-6">
          {/* Welcome Driver Card */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs uppercase font-bold tracking-wider text-amber-400">
                Painel do Motorista
              </span>
              <h1 className="text-2xl font-black text-white">
                Olá, {currentUser?.name?.split(' ')[0] || 'Motorista'}!
              </h1>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-slate-400 block">{currentCompany?.name}</span>
              <span className="text-xs font-bold text-slate-300">CNH: {currentDriver?.cnh || 'Cat. D'}</span>
            </div>
          </div>

          {/* Open-Meteo Weather & Road Condition Live Banner */}
          {routeWeather && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 flex items-center justify-between text-xs shadow-lg">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400">
                  <CloudRain className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-white text-[11px] sm:text-xs">
                    <span>{routeWeather.city}: {routeWeather.temperature}°C</span>
                    <span className="text-[10px] text-amber-300 font-medium">• {routeWeather.weatherDescription}</span>
                  </div>
                  <p className="text-[10px] text-slate-300 mt-0.5 line-clamp-1">{routeWeather.safetyAdvisory}</p>
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase shrink-0 ${
                  routeWeather.aquaplaningRisk === 'baixo'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
              >
                {routeWeather.aquaplaningRisk === 'baixo' ? 'Pista Segura' : 'Atenção Pista'}
              </span>
            </div>
          )}

          {/* Active Vehicle Selector Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                <Truck className="w-4 h-4 text-amber-400" />
                <span>Veículo sob sua responsabilidade</span>
              </div>
              {vehicles.length > 1 && (
                <span className="text-[10px] text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  {vehicles.length} vinculados
                </span>
              )}
            </div>

            {vehicles.length === 0 ? (
              <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 text-center text-xs text-slate-400">
                Nenhum veículo vinculado ativamente ao seu perfil de motorista. Contate a gestão.
              </div>
            ) : (
              <div>
                {/* Vehicle Switcher if multiple */}
                {vehicles.length > 1 && (
                  <div className="mb-3">
                    <select
                      value={selectedVehicleId}
                      onChange={(e) => setSelectedVehicleId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-xs font-bold text-white focus:outline-none"
                    >
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.plate} — {v.model} ({v.current_km.toLocaleString()} km)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {activeVehicle && (
                  <div className="flex items-center justify-between bg-slate-950/80 border border-slate-800/80 p-4 rounded-2xl">
                    <div>
                      <div className="text-xl font-black text-white tracking-wider flex items-center gap-2">
                        <span>{activeVehicle.plate}</span>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          {activeVehicle.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 font-medium mt-0.5">{activeVehicle.model}</div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Tanque: {activeVehicle.tank_capacity_liters} L • {activeVehicle.fuel_type}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-end gap-1">
                        <Gauge className="w-3 h-3 text-amber-400" />
                        <span>Odômetro Atual</span>
                      </div>
                      <div className="text-lg font-black text-amber-400">
                        {activeVehicle.current_km.toLocaleString()} <span className="text-xs">km</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Dual-Scan Setting Switch */}
          <div className="flex items-center justify-between p-3.5 bg-slate-900/60 border border-slate-800 rounded-2xl">
            <div className="flex items-center gap-2.5">
              <Camera className="w-4 h-4 text-amber-400" />
              <div>
                <div className="text-xs font-bold text-white">Leitura Dupla de Segurança (Nota + Painel)</div>
                <div className="text-[11px] text-slate-400">
                  Lê a nota fiscal e confere com a foto do painel do carro para evitar erros e fraudes
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDualScanActive(!dualScanActive)}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                dualScanActive ? 'bg-amber-500' : 'bg-slate-700'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-slate-950 absolute top-1 transition-transform ${
                  dualScanActive ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>

          {/* Notificação Inteligente Preditiva do Agente Mecânico */}
          {activePredictive && (
            <div className="p-4 bg-gradient-to-r from-cyan-950/80 via-slate-900 to-slate-900 border border-cyan-500/40 rounded-3xl space-y-3 shadow-lg shadow-cyan-950/30 animate-in fade-in">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
                    <Wrench className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-cyan-400 block tracking-wider">
                      Agente Mecânico Preditivo
                    </span>
                    <h4 className="text-xs sm:text-sm font-extrabold text-white">
                      "{activePredictive.scheduledPrompt}"
                    </h4>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                  ~{activePredictive.estimatedDaysToTarget} dias
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-800/80">
                <div className="text-[11px] text-slate-400">
                  {activePredictive.serviceDescription} (Restam {activePredictive.kmRemaining} km)
                </div>

                {scheduledVehicles[activeVehicle?.id || ''] ? (
                  <div className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-extrabold text-xs flex items-center gap-1.5 shadow-sm">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Revisão Agendada</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      setSchedulingPredictive(true);
                      setErrorMessage(null);
                      const res = await schedulePredictiveMaintenance(activePredictive.autoSchedulePayload);
                      setSchedulingPredictive(false);
                      if (res.success) {
                        setScheduledVehicles((prev) => ({
                          ...prev,
                          [activeVehicle?.id || '']: res.message || 'Agendada com sucesso',
                        }));
                        setSuccessMessage(res.message || 'Revisão preditiva agendada com sucesso na oficina credenciada!');
                        setTimeout(() => setSuccessMessage(null), 6000);
                      } else {
                        setErrorMessage(res.error || 'Não foi possível agendar a revisão no momento.');
                      }
                    }}
                    disabled={schedulingPredictive}
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{schedulingPredictive ? 'Agendando...' : 'Aceitar e Agendar'}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Big Action Buttons (Target: Complete in under 60 seconds) */}
          <div className="grid grid-cols-1 gap-4 pt-2">
            {/* 0. Copiloto de Voz Hands-Free (Falar com a frota) */}
            <button
              type="button"
              onClick={() => setFlowState('voice_copilot')}
              disabled={!activeVehicle}
              className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black flex items-center justify-between shadow-xl shadow-emerald-500/20 active:scale-[0.99] transition cursor-pointer group disabled:opacity-50 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-slate-950/20 flex items-center justify-center text-slate-950 group-hover:scale-110 transition relative">
                  <Mic className="w-8 h-8 animate-pulse" />
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-950 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-slate-950"></span>
                  </span>
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-lg sm:text-xl font-extrabold leading-tight">Falar com a frota</span>
                    <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-slate-950 text-emerald-300">
                      Live AI Hands-Free
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-slate-900/90 mt-1">
                    Grave abastecimento ou manutenção 100% por voz e câmera
                  </div>
                </div>
              </div>
              <ArrowRight className="w-6 h-6 stroke-[3] group-hover:translate-x-1 transition" />
            </button>

            {/* 1. Registrar Abastecimento */}
            <button
              type="button"
              onClick={() => startRegister('abastecimento')}
              disabled={!activeVehicle}
              className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black flex items-center justify-between shadow-xl shadow-amber-500/20 active:scale-[0.99] transition cursor-pointer group disabled:opacity-50"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-slate-950/15 flex items-center justify-center text-slate-950 group-hover:scale-105 transition">
                  <Fuel className="w-8 h-8" />
                </div>
                <div className="text-left">
                  <div className="text-lg sm:text-xl font-extrabold leading-tight">Registrar Abastecimento</div>
                  <div className="text-xs font-semibold text-slate-900/80 mt-1">
                    Fotografe a nota fiscal no posto
                  </div>
                </div>
              </div>
              <ArrowRight className="w-6 h-6 stroke-[3] group-hover:translate-x-1 transition" />
            </button>

            {/* 2. Registrar Manutenção */}
            <button
              type="button"
              onClick={() => startRegister('manutencao')}
              disabled={!activeVehicle}
              className="p-5 sm:p-6 rounded-3xl bg-slate-900 hover:bg-slate-850 border border-slate-700 hover:border-amber-500/50 text-white flex items-center justify-between shadow-xl active:scale-[0.99] transition cursor-pointer group disabled:opacity-50"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-105 transition">
                  <Wrench className="w-7 h-7" />
                </div>
                <div className="text-left">
                  <div className="text-lg sm:text-xl font-extrabold leading-tight text-white group-hover:text-amber-300">
                    Registrar Manutenção
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Fotografe a Ordem de Serviço ou Nota de Peças
                  </div>
                </div>
              </div>
              <ArrowRight className="w-6 h-6 stroke-[3] text-slate-400 group-hover:text-amber-400 group-hover:translate-x-1 transition" />
            </button>

            {/* 3. Vistoria Visual com IA (4 Cantos + Pneu) */}
            <button
              type="button"
              onClick={() => setFlowState('inspection')}
              disabled={!activeVehicle}
              className="p-5 sm:p-6 rounded-3xl bg-slate-900 hover:bg-slate-850 border border-slate-700 hover:border-cyan-500/50 text-white flex items-center justify-between shadow-xl active:scale-[0.99] transition cursor-pointer group disabled:opacity-50"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center group-hover:scale-105 transition">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <div className="text-left">
                  <div className="text-lg sm:text-xl font-extrabold leading-tight text-white group-hover:text-cyan-300">
                    Vistoria Visual por IA
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    4 Cantos + Pneu • Laudo Pericial com Nano Banana 2
                  </div>
                </div>
              </div>
              <ArrowRight className="w-6 h-6 stroke-[3] text-slate-400 group-hover:text-cyan-400 group-hover:translate-x-1 transition" />
            </button>

            {/* 4. Ver Histórico do Veículo */}
            <button
              type="button"
              onClick={onOpenHistory}
              disabled={!activeVehicle}
              className="p-4 rounded-2xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800 text-slate-300 hover:text-white flex items-center justify-center gap-2 text-sm font-bold transition cursor-pointer"
            >
              <History className="w-4 h-4 text-amber-400" />
              <span>Ver Histórico e Evidências Salvas</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
