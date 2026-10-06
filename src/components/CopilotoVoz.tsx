import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  Video,
  VideoOff,
  X,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Fuel,
  Wrench,
  Gauge,
  Radio,
  Camera,
} from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';
import { Vehicle, FleetEvent } from '../types/fleet';
import { float32ToPcmBase64, pcmBase64ToFloat32 } from '../utils/audioUtils';
import { useFleet } from '../context/FleetContext';

interface CopilotoVozProps {
  vehicle: Vehicle;
  onClose: () => void;
  onEventSaved?: (event: any) => void;
}

export const CopilotoVoz: React.FC<CopilotoVozProps> = ({
  vehicle,
  onClose,
  onEventSaved,
}) => {
  const { currentCompany, currentUser, currentDriver, confirmEvent } = useFleet();

  const [sessionState, setSessionState] = useState<
    'connecting' | 'listening' | 'speaking' | 'processing' | 'error' | 'closed'
  >('connecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transcription, setTranscription] = useState<string>('');
  const [aiSpeechText, setAiSpeechText] = useState<string>('');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [lastActionSaved, setLastActionSaved] = useState<string | null>(null);

  // Audio Context & Streaming Refs
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const activeAudioNodesRef = useRef<AudioBufferSourceNode[]>([]);
  const nextStartTimeRef = useRef<number>(0);
  const liveSessionRef = useRef<any>(null);

  // Video Streaming Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoIntervalRef = useRef<any>(null);

  // 1. Iniciar sessão do Gemini Live ao montar o componente
  useEffect(() => {
    let isMounted = true;

    async function initLiveSession() {
      try {
        setSessionState('connecting');
        setErrorMessage(null);

        // Obter Ephemeral Token do backend
        const tokenRes = await fetch('/api/live/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const tokenData = await tokenRes.json();

        if (!tokenRes.ok || !tokenData.token) {
          throw new Error(tokenData.error || 'Não foi possível obter o token efêmero da Live API.');
        }

        const ephemeralToken = tokenData.token;

        // Inicializar SDK do Gemini no cliente com o token efêmero
        const clientAi = new GoogleGenAI({ apiKey: ephemeralToken });

        // Inicializar Audio Contexts
        const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 16000,
        });
        const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 24000,
        });
        inputAudioCtxRef.current = inputCtx;
        outputAudioCtxRef.current = outputCtx;

        // Obter permissão do microfone
        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        mediaStreamRef.current = micStream;

        // Declaração de Ferramentas (Function Calling)
        const registrarAbastecimentoDecl: FunctionDeclaration = {
          name: 'registrarAbastecimento',
          description:
            'Salva um abastecimento completo. Chame esta função APENAS quando tiver todos os dados necessários (litros, valorTotal, posto, combustível e odômetro) E após confirmação verbal do motorista.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              litros: { type: Type.NUMBER, description: 'Litros abastecidos (número)' },
              valorTotal: { type: Type.NUMBER, description: 'Valor total em reais R$ (número)' },
              posto: { type: Type.STRING, description: 'Nome do posto de combustível' },
              combustivel: { type: Type.STRING, description: 'Tipo do combustível (ex: Diesel S10, Gasolina, Etanol)' },
              odometro: { type: Type.NUMBER, description: 'Quilometragem atual do odômetro do veículo' },
            },
            required: ['litros', 'valorTotal', 'posto', 'combustivel', 'odometro'],
          },
        };

        const registrarManutencaoDecl: FunctionDeclaration = {
          name: 'registrarManutencao',
          description:
            'Salva uma manutenção ou serviço mecânico. Chame APENAS com todos os dados e confirmação do motorista.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              oficina: { type: Type.STRING, description: 'Nome da oficina mecânica' },
              valor: { type: Type.NUMBER, description: 'Valor total do serviço/peças' },
              tipoManutencao: { type: Type.STRING, description: '"preventiva" ou "corretiva"' },
              pecasEServicos: { type: Type.STRING, description: 'Descrição das peças/serviços realizados' },
              odometro: { type: Type.NUMBER, description: 'Quilometragem do veículo no momento do serviço' },
            },
            required: ['oficina', 'valor', 'tipoManutencao', 'odometro'],
          },
        };

        const consultarHistoricoDecl: FunctionDeclaration = {
          name: 'consultarHistorico',
          description: 'Consulta odômetro atual e dados do veículo.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              placa: { type: Type.STRING, description: 'Placa do veículo' },
            },
            required: ['placa'],
          },
        };

        const systemInstruction = `Você é o Copiloto de Voz Hands-Free do 'FrotaFácil AI'.
Você atende o motorista enquanto ele está no posto de combustível ou dirigindo.
Fale SEMPRE em português do Brasil com respostas CURTAS e DIRETAS (máximo 1 a 2 frases por vez).

Contexto Atual:
- Veículo Selecionado: Placa ${vehicle.plate}, Modelo ${vehicle.model}
- Tanque: ${vehicle.tank_capacity_liters} Litros | Combustível padrão: ${vehicle.fuel_type}
- Odômetro anterior registrado no sistema: ${vehicle.kmAtual ?? vehicle.current_km ?? 0} km.

Fluxo Obrigatório Mãos Livres:
1. Quando o motorista falar sobre um abastecimento (ex: 'Abasteci 40 litros, R$ 240 no Posto Shell'), confira se informou:
   - Litros
   - Valor Total
   - Posto
   - Combustível
   - Odômetro (KM)
2. Se faltar qualquer dado (por exemplo, o odômetro), PERGUNTE DE VOLTA EM VOZ ALTA: "Faltou o quilômetro, qual é o odômetro?".
3. Quando tiver todos os dados, confirme em voz alta no formato: "Salvando: [litros] litros, R$ [valor], km [odometro], [combustivel] no [posto]. Confirmo?".
4. APENAS quando o motorista confirmar por voz (ex: 'Sim', 'Confirma', 'Pode salvar', 'Isso'), chame a função registrarAbastecimento.
5. Se o motorista apontar a câmera para o cupom, você receberá frames de vídeo ao vivo e poderá ler os dados da nota diretamente para preencher os campos.`;

        // Conectar na Gemini Live API
        const session = await clientAi.live.connect({
          model: 'gemini-3.8-live',
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Puck' },
              },
            },
            systemInstruction,
            tools: [
              {
                functionDeclarations: [
                  registrarAbastecimentoDecl,
                  registrarManutencaoDecl,
                  consultarHistoricoDecl,
                ],
              },
            ],
          },
          callbacks: {
            onmessage: async (message: LiveServerMessage) => {
              if (!isMounted) return;

              // 1. Tratar Interrupção (Barge-in): parar reprodução imediatamente
              if (message.serverContent?.interrupted) {
                activeAudioNodesRef.current.forEach((node) => {
                  try {
                    node.stop();
                  } catch (e) {}
                });
                activeAudioNodesRef.current = [];
                nextStartTimeRef.current = 0;
                setSessionState('listening');
                return;
              }

              // 2. Tratar Áudio de Resposta da IA (24kHz PCM)
              const audioPart = message.serverContent?.modelTurn?.parts?.find(
                (p) => p.inlineData?.data
              );
              if (audioPart?.inlineData?.data) {
                setSessionState('speaking');
                const base64Audio = audioPart.inlineData.data;
                const float32Array = pcmBase64ToFloat32(base64Audio);

                const outCtx = outputAudioCtxRef.current;
                if (outCtx && outCtx.state !== 'closed') {
                  if (outCtx.state === 'suspended') {
                    await outCtx.resume();
                  }
                  const audioBuffer = outCtx.createBuffer(1, float32Array.length, 24000);
                  audioBuffer.getChannelData(0).set(float32Array);

                  const sourceNode = outCtx.createBufferSource();
                  sourceNode.buffer = audioBuffer;
                  sourceNode.connect(outCtx.destination);

                  const scheduledTime = Math.max(outCtx.currentTime, nextStartTimeRef.current);
                  sourceNode.start(scheduledTime);
                  nextStartTimeRef.current = scheduledTime + audioBuffer.duration;
                  activeAudioNodesRef.current.push(sourceNode);

                  sourceNode.onended = () => {
                    activeAudioNodesRef.current = activeAudioNodesRef.current.filter((n) => n !== sourceNode);
                    if (activeAudioNodesRef.current.length === 0) {
                      setSessionState('listening');
                    }
                  };
                }
              }

              // 3. Tratar Chamadas de Função (Tool Call / Function Calling)
              if (message.toolCall?.functionCalls) {
                setSessionState('processing');
                for (const call of message.toolCall.functionCalls) {
                  let functionResult: any = { status: 'sucesso' };

                  if (call.name === 'registrarAbastecimento') {
                    const args: any = call.args || {};
                    try {
                      const res = await confirmEvent({
                        vehicle_id: vehicle.id,
                        odometer: Number(args.odometro),
                        event_date: new Date().toISOString().split('T')[0],
                        total_amount: Number(args.valorTotal),
                        gas_station_name: args.posto,
                        fuel_type: args.combustivel || vehicle.fuel_type,
                        liters: Number(args.litros),
                        price_per_liter:
                          args.litros > 0 ? Number((args.valorTotal / args.litros).toFixed(2)) : 0,
                        notes: 'Registrado via Copiloto de Voz Hands-Free (Live API)',
                      });

                      if (res.success) {
                        setLastActionSaved(
                          `Abastecimento salvo: ${args.litros}L (R$ ${args.valorTotal}) - Odômetro ${args.odometro} km`
                        );
                        if (onEventSaved) onEventSaved(res);
                        functionResult = {
                          status: 'sucesso',
                          mensagem: 'Abastecimento gravado no banco de dados da frota com sucesso!',
                          odometroSalvo: args.odometro,
                        };
                      } else {
                        functionResult = { status: 'erro', mensagem: res.error || 'Falha ao salvar.' };
                      }
                    } catch (err: any) {
                      functionResult = { status: 'erro', mensagem: err.message };
                    }
                  } else if (call.name === 'registrarManutencao') {
                    const args: any = call.args || {};
                    try {
                      const res = await confirmEvent({
                        vehicle_id: vehicle.id,
                        odometer: Number(args.odometro || vehicle.current_km),
                        event_date: new Date().toISOString().split('T')[0],
                        total_amount: Number(args.valor),
                        workshop_name: args.oficina,
                        maintenance_type: args.tipoManutencao || 'preventiva',
                        items_description: args.pecasEServicos || 'Serviço de manutenção por voz',
                        parts_cost: Number(args.valor),
                        labor_cost: 0,
                        notes: 'Registrado via Copiloto de Voz Hands-Free (Live API)',
                      });

                      if (res.success) {
                        setLastActionSaved(`Manutenção salva: ${args.oficina} (R$ ${args.valor})`);
                        if (onEventSaved) onEventSaved(res);
                        functionResult = {
                          status: 'sucesso',
                          mensagem: 'Manutenção registrada na frota com sucesso!',
                        };
                      } else {
                        functionResult = { status: 'erro', mensagem: res.error || 'Erro ao salvar manutenção.' };
                      }
                    } catch (err: any) {
                      functionResult = { status: 'erro', mensagem: err.message };
                    }
                  } else if (call.name === 'consultarHistorico') {
                    functionResult = {
                      placa: vehicle.plate,
                      modelo: vehicle.model,
                      kmAtual: vehicle.kmAtual ?? vehicle.current_km,
                      combustivel: vehicle.fuel_type,
                    };
                  }

                  // Enviar resposta da ferramenta de volta para a sessão Live
                  session.sendToolResponse({
                    functionResponses: [
                      {
                        response: { output: functionResult },
                        id: call.id,
                      },
                    ],
                  });
                }
              }
            },
          },
        });

        liveSessionRef.current = session;

        // Iniciar captura e envio de áudio do microfone em tempo real (16kHz PCM)
        const source = inputCtx.createMediaStreamSource(micStream);
        const processor = inputCtx.createScriptProcessor(2048, 1, 1);
        audioProcessorRef.current = processor;
        source.connect(processor);
        processor.connect(inputCtx.destination);

        processor.onaudioprocess = (e) => {
          if (!isMounted || !liveSessionRef.current) return;
          const inputData = e.inputBuffer.getChannelData(0);
          const base64Pcm = float32ToPcmBase64(inputData);
          try {
            liveSessionRef.current.sendRealtimeInput({
              audio: {
                data: base64Pcm,
                mimeType: 'audio/pcm;rate=16000',
              },
            });
          } catch (err) {
            // Ignorar frames durante desconexão
          }
        };

        if (isMounted) {
          setSessionState('listening');
        }
      } catch (err: any) {
        console.error('Erro ao iniciar sessão Gemini Live:', err);
        if (isMounted) {
          setSessionState('error');
          setErrorMessage(err.message || 'Falha ao conectar com o Copiloto de Voz da Frota.');
        }
      }
    }

    initLiveSession();

    return () => {
      isMounted = false;
      // Parar stream de vídeo se ativo
      if (videoIntervalRef.current) {
        clearInterval(videoIntervalRef.current);
      }
      // Fechar sessão Live
      if (liveSessionRef.current) {
        try {
          liveSessionRef.current.close();
        } catch (e) {}
      }
      // Parar microfone
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioProcessorRef.current) {
        audioProcessorRef.current.disconnect();
      }
      if (inputAudioCtxRef.current && inputAudioCtxRef.current.state !== 'closed') {
        inputAudioCtxRef.current.close();
      }
      if (outputAudioCtxRef.current && outputAudioCtxRef.current.state !== 'closed') {
        outputAudioCtxRef.current.close();
      }
    };
  }, [vehicle, confirmEvent, onEventSaved]);

  // 2. Controle do Modo Câmera ao Vivo durante a conversa
  const toggleLiveCamera = async () => {
    if (isCameraActive) {
      if (videoIntervalRef.current) {
        clearInterval(videoIntervalRef.current);
        videoIntervalRef.current = null;
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((t) => t.stop());
        videoRef.current.srcObject = null;
      }
      setIsCameraActive(false);
    } else {
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = camStream;
          videoRef.current.play();
        }
        setIsCameraActive(true);

        // Enviar 1 frame de imagem por segundo (1 FPS) para a sessão Live
        videoIntervalRef.current = setInterval(() => {
          if (!videoRef.current || !videoCanvasRef.current || !liveSessionRef.current) return;
          const canvas = videoCanvasRef.current;
          const video = videoRef.current;
          if (video.videoWidth === 0) return;

          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
            const cleanBase64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '');
            try {
              liveSessionRef.current.sendRealtimeInput({
                video: {
                  data: cleanBase64,
                  mimeType: 'image/jpeg',
                },
              });
            } catch (e) {}
          }
        }, 1000);
      } catch (err: any) {
        console.warn('Erro ao acessar câmera para Live API:', err);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xl flex flex-col items-center justify-between p-4 sm:p-6 text-slate-100 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Top Header */}
      <div className="w-full max-w-lg flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-amber-400">
              Gemini 3.8 Live • Hands-Free
            </div>
            <div className="text-sm font-extrabold text-white">
              {vehicle.plate} • {vehicle.model}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Interactive Center Area */}
      <div className="w-full max-w-lg my-auto flex flex-col items-center text-center space-y-6">
        {/* Live Camera View (se ativado) */}
        {isCameraActive && (
          <div className="w-full relative rounded-3xl overflow-hidden border border-amber-500/40 bg-black aspect-video shadow-2xl">
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <canvas ref={videoCanvasRef} className="hidden" />
            <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-bold text-amber-300 flex items-center gap-1.5 border border-amber-500/30">
              <Camera className="w-3 h-3 text-amber-400" />
              <span>Vídeo ao Vivo (1 FPS para IA)</span>
            </div>
          </div>
        )}

        {/* Pulsing Visual Waveform / Microphone Orb */}
        <div className="relative">
          <div
            className={`w-32 h-32 sm:w-40 sm:h-40 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl ${
              sessionState === 'speaking'
                ? 'bg-gradient-to-tr from-amber-500 to-orange-500 scale-105 shadow-amber-500/40'
                : sessionState === 'listening'
                ? 'bg-gradient-to-tr from-blue-600 to-emerald-500 shadow-blue-500/30 animate-pulse'
                : sessionState === 'processing'
                ? 'bg-gradient-to-tr from-purple-600 to-pink-600 shadow-purple-500/30 animate-spin'
                : 'bg-slate-800 border border-slate-700'
            }`}
          >
            {sessionState === 'speaking' ? (
              <Volume2 className="w-14 h-14 text-slate-950 animate-bounce" />
            ) : sessionState === 'listening' ? (
              <Mic className="w-14 h-14 text-white" />
            ) : sessionState === 'processing' ? (
              <Sparkles className="w-14 h-14 text-white" />
            ) : (
              <MicOff className="w-14 h-14 text-slate-400" />
            )}
          </div>

          {/* Halo rings */}
          {sessionState === 'listening' && (
            <div className="absolute inset-0 -m-3 rounded-full border-2 border-emerald-400/40 animate-ping pointer-events-none" />
          )}
        </div>

        {/* Status Text and Instruction Guide */}
        <div className="space-y-1.5 max-w-sm">
          <div className="text-base font-extrabold text-white">
            {sessionState === 'connecting'
              ? 'Conectando ao Gemini Live...'
              : sessionState === 'listening'
              ? 'Ouvindo você em tempo real...'
              : sessionState === 'speaking'
              ? 'Copiloto falando...'
              : sessionState === 'processing'
              ? 'Salvando registro no banco de dados...'
              : 'Sessão encerrada'}
          </div>
          <p className="text-xs text-slate-400">
            Fale naturalmente: <em>"Abasteci 45 litros, R$ 260 no Posto Graal"</em>. A IA pedirá o odômetro e confirmará antes de salvar.
          </p>
        </div>

        {/* Confirmation Card de Ação Executada */}
        {lastActionSaved && (
          <div className="w-full p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-left flex items-start gap-3 shadow-lg">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-black uppercase text-emerald-400">
                Registro Salvo na Frota em Tempo Real
              </div>
              <div className="text-xs font-bold text-white mt-0.5">{lastActionSaved}</div>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="w-full p-3 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Bottom Controls Bar */}
      <div className="w-full max-w-lg flex items-center justify-center gap-4 pt-4 border-t border-slate-800">
        <button
          type="button"
          onClick={toggleLiveCamera}
          className={`px-4 py-3 rounded-2xl text-xs font-extrabold flex items-center gap-2 transition cursor-pointer border ${
            isCameraActive
              ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20'
              : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700'
          }`}
        >
          {isCameraActive ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
          <span>{isCameraActive ? 'Câmera Ativa (Apontar para Cupom)' : 'Ativar Câmera ao Vivo'}</span>
        </button>

        <button
          type="button"
          onClick={onClose}
          className="px-6 py-3 rounded-2xl bg-slate-800 hover:bg-rose-500/20 hover:text-rose-300 text-slate-300 font-extrabold text-xs transition cursor-pointer"
        >
          Encerrar Conversa
        </button>
      </div>
    </div>
  );
};
