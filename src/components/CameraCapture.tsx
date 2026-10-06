import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  RefreshCw,
  X,
  AlertTriangle,
  Zap,
  ZapOff,
  Image as ImageIcon,
  Sparkles,
  RotateCcw,
  FlipHorizontal,
  Info,
  Smartphone,
  CheckCircle2,
} from 'lucide-react';
import { SAMPLE_RECEIPTS } from '../data/mockData';

export interface CameraCaptureProps {
  /**
   * Callback fired when an image is captured.
   * Returns the captured image as an Object URL (URL.createObjectURL) as requested,
   * along with the underlying Blob and an optional dataURL for flexibility.
   */
  onCapture: (objectUrl: string, blob?: Blob, dataUrl?: string) => void;
  /**
   * Callback when the user cancels or closes the camera.
   */
  onCancel?: () => void;
  /**
   * Alias for onCancel
   */
  onClose?: () => void;
  /**
   * Optional custom title (e.g., 'Fotografar Comprovante', 'Comprovante de Abastecimento')
   */
  title?: string;
  /**
   * Type of event being registered
   */
  type?: 'abastecimento' | 'manutencao' | 'vistoria';
  /**
   * Whether to show sample presets for 1-click evaluation
   */
  showPresets?: boolean;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  onCapture,
  onCancel,
  onClose,
  title = 'Fotografar Comprovante',
  type = 'abastecimento',
  showPresets = true,
}) => {
  const handleClose = onCancel || onClose;
  const isFuel = type === 'abastecimento';

  // Video, canvas and stream references
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Camera state
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cameraNotice, setCameraNotice] = useState<string | null>(null);

  // Facing mode state
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [activeCameraLabel, setActiveCameraLabel] = useState<string>('');
  const [isMirrored, setIsMirrored] = useState<boolean>(false);

  // Hardware capabilities
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [isFlashActive, setIsFlashActive] = useState<boolean>(false);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [hasPhysicalBackCam, setHasPhysicalBackCam] = useState<boolean>(false);

  // Audio feedback synthesis for native camera feel
  const playShutterClick = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(900, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch {
      // Audio playback is non-blocking
    }
  }, []);

  // Stop active media stream tracks
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    setStream(null);
  }, []);

  /**
   * Helper to identify if a camera device is likely a back / rear camera
   */
  const isBackCameraDevice = (device: MediaDeviceInfo): boolean => {
    const label = device.label.toLowerCase();
    return (
      label.includes('back') ||
      label.includes('rear') ||
      label.includes('traseir') ||
      label.includes('environment') ||
      label.includes('facing back') ||
      label.includes('camera 0') ||
      label.includes('câmera 0')
    );
  };

  /**
   * Helper to identify if a camera device is likely a front camera / webcam
   */
  const isFrontCameraDevice = (device: MediaDeviceInfo): boolean => {
    const label = device.label.toLowerCase();
    return (
      label.includes('front') ||
      label.includes('user') ||
      label.includes('frontal') ||
      label.includes('webcam') ||
      label.includes('integrated') ||
      label.includes('face') ||
      label.includes('camera 1') ||
      label.includes('câmera 1')
    );
  };

  /**
   * Starts camera with robust fallback across Mobile (prioritizing rear environment camera) and Desktop Webcams
   */
  const startCamera = useCallback(
    async (
      requestedFacing: 'environment' | 'user' = 'environment',
      explicitDeviceId?: string
    ) => {
      setIsInitializing(true);
      setErrorMessage(null);
      setCameraNotice(null);

      // Stop existing stream cleanly
      stopStream();

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setIsInitializing(false);
        setErrorMessage(
          'A API MediaDevices.getUserMedia não está disponível neste navegador. Utilize a seleção por galeria ou os comprovantes de teste.'
        );
        return;
      }

      // Enumerate devices to detect what hardware is available
      let videoDevices: MediaDeviceInfo[] = [];
      try {
        if (navigator.mediaDevices.enumerateDevices) {
          const allDevices = await navigator.mediaDevices.enumerateDevices();
          videoDevices = allDevices.filter((d) => d.kind === 'videoinput');
          setAvailableCameras(videoDevices);
        }
      } catch {
        // enumeration can fail or return empty labels if permissions not yet granted
      }

      const backCam = videoDevices.find(isBackCameraDevice);
      const frontCam = videoDevices.find(isFrontCameraDevice);
      const hasBack = Boolean(backCam);
      setHasPhysicalBackCam(hasBack);

      // Determine target device ID or constraint
      let targetDeviceId = explicitDeviceId;
      let targetFacing = requestedFacing;

      if (!targetDeviceId) {
        if (targetFacing === 'environment') {
          if (backCam) {
            targetDeviceId = backCam.deviceId;
          } else if (videoDevices.length === 1 && isFrontCameraDevice(videoDevices[0])) {
            // Only 1 camera exists and it is a front/integrated webcam
            targetFacing = 'user';
            setCameraNotice(
              'Computador possui apenas Webcam Integrada frontal. Câmera traseira física não detectada.'
            );
          }
        } else {
          if (frontCam) {
            targetDeviceId = frontCam.deviceId;
          }
        }
      }

      // Try multiple constraint strategies
      let mediaStream: MediaStream | null = null;
      let lastError: any = null;

      // Strategy 1: Specific Device ID if explicitly selected by the user or identified
      if (targetDeviceId) {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: { exact: targetDeviceId },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
            audio: false,
          });
        } catch (e) {
          lastError = e;
        }
      }

      // Strategy 2: Explicitly request 'environment' facing mode for rear camera (prioritized on mobile devices)
      if (!mediaStream && targetFacing === 'environment') {
        // Attempt 2A: Exact environment constraint (guarantees rear camera on mobile devices)
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { exact: 'environment' },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
            audio: false,
          });
        } catch (e) {
          lastError = e;
        }

        // Attempt 2B: Explicit facingMode string 'environment'
        if (!mediaStream) {
          try {
            mediaStream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: 'environment',
                width: { ideal: 1920 },
                height: { ideal: 1080 },
              },
              audio: false,
            });
          } catch (e) {
            lastError = e;
          }
        }

        // Attempt 2C: Ideal environment constraint with flexible resolution
        if (!mediaStream) {
          try {
            mediaStream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: { ideal: 'environment' },
              },
              audio: false,
            });
          } catch (e) {
            lastError = e;
          }
        }
      }

      // Strategy 3: Target user facing mode (Frontal / Webcam)
      if (!mediaStream && targetFacing === 'user') {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'user',
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
            audio: false,
          });
        } catch (e) {
          lastError = e;
        }

        if (!mediaStream) {
          try {
            mediaStream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: { ideal: 'user' },
              },
              audio: false,
            });
          } catch (e) {
            lastError = e;
          }
        }
      }

      // Strategy 4: Fallback generic video stream
      if (!mediaStream) {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        } catch (e) {
          lastError = e;
        }
      }

      if (!mediaStream) {
        console.warn('MediaDevices.getUserMedia error:', lastError);
        setIsInitializing(false);

        if (
          lastError?.name === 'NotAllowedError' ||
          lastError?.name === 'PermissionDeniedError'
        ) {
          setErrorMessage(
            'Permissão de acesso à câmera negada. Habilite o acesso à câmera nas configurações do navegador para escanear o comprovante.'
          );
        } else if (
          lastError?.name === 'NotFoundError' ||
          lastError?.name === 'DevicesNotFoundError'
        ) {
          setErrorMessage('Nenhuma câmera encontrada conectada ao dispositivo.');
        } else if (
          lastError?.name === 'NotReadableError' ||
          lastError?.name === 'TrackStartError'
        ) {
          setErrorMessage('A câmera está sendo utilizada por outro aplicativo.');
        } else {
          setErrorMessage(
            'Não foi possível inicializar o vídeo da câmera. Utilize a galeria ou os comprovantes de teste.'
          );
        }
        return;
      }

      // Successfully acquired stream
      streamRef.current = mediaStream;
      setStream(mediaStream);
      setIsInitializing(false);

      const videoTrack = mediaStream.getVideoTracks()[0];
      let actualFacing = targetFacing;

      if (videoTrack) {
        const label = videoTrack.label || '';
        setActiveCameraLabel(label);

        // Re-enumerate to get labeled devices if first time
        if (navigator.mediaDevices.enumerateDevices) {
          navigator.mediaDevices
            .enumerateDevices()
            .then((devs) => {
              const vDevs = devs.filter((d) => d.kind === 'videoinput');
              setAvailableCameras(vDevs);
              setHasPhysicalBackCam(vDevs.some(isBackCameraDevice));
            })
            .catch(() => {});
        }

        // Determine actual facing mode from track settings & label
        const settings: any = videoTrack.getSettings ? videoTrack.getSettings() : {};
        if (settings.facingMode) {
          actualFacing = settings.facingMode as any;
        } else if (
          label.toLowerCase().includes('front') ||
          label.toLowerCase().includes('webcam') ||
          label.toLowerCase().includes('integrated') ||
          label.toLowerCase().includes('user')
        ) {
          actualFacing = 'user';
        } else if (
          label.toLowerCase().includes('back') ||
          label.toLowerCase().includes('rear') ||
          label.toLowerCase().includes('environment')
        ) {
          actualFacing = 'environment';
        }

        // Check for flashlight/torch capability
        const capabilities: any = videoTrack.getCapabilities
          ? videoTrack.getCapabilities()
          : {};
        setHasTorch(Boolean(capabilities && capabilities.torch));
      }

      // Synchronize facing mode state with reality
      setFacingMode(actualFacing);

      // If user camera (webcam), mirror is off by default for document readability
      if (actualFacing === 'user') {
        setIsMirrored(false);
      }

      // Mount into video element
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch(() => {});
      }
    },
    [stopStream]
  );

  // Initialize camera on mount
  useEffect(() => {
    // Prioritize 'environment' facing mode (rear camera) on mobile devices
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          const videoDevs = devices.filter((d) => d.kind === 'videoinput');
          // Only start with 'user' mode if there is strictly 1 single camera AND it is confirmed to be an integrated front webcam
          const isSingleFrontWebcamOnly =
            videoDevs.length === 1 && isFrontCameraDevice(videoDevs[0]);
          const initialFacing = isSingleFrontWebcamOnly ? 'user' : 'environment';
          startCamera(initialFacing);
        })
        .catch(() => {
          startCamera('environment');
        });
    } else {
      startCamera('environment');
    }

    return () => {
      stopStream();
    };
  }, []);

  // Toggle lantern / torch if supported
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    try {
      const nextState = !isTorchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextState }],
      });
      setIsTorchOn(nextState);
    } catch (err) {
      console.warn('Torch constraint error:', err);
    }
  };

  // Switch facing mode (Traseira <-> Frontal)
  const switchFacing = (targetFacing: 'environment' | 'user') => {
    setSelectedDeviceId('');

    // If user requests rear camera but hardware only has front webcam
    if (
      targetFacing === 'environment' &&
      availableCameras.length === 1 &&
      isFrontCameraDevice(availableCameras[0])
    ) {
      setCameraNotice(
        'Este computador possui apenas a Webcam Integrada. Nenhuma câmera traseira física foi detectada. Para fotografar na mesa, aponte para a webcam ou acesse pelo celular.'
      );
      // Still start with available camera
      startCamera('user');
      return;
    }

    startCamera(targetFacing);
  };

  const toggleFacingMode = () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    switchFacing(nextFacing);
  };

  // Switch specific device id
  const handleDeviceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const devId = e.target.value;
    setSelectedDeviceId(devId);
    const chosenDevice = availableCameras.find((d) => d.deviceId === devId);
    const isBack = chosenDevice ? isBackCameraDevice(chosenDevice) : false;
    startCamera(isBack ? 'environment' : 'user', devId);
  };

  /**
   * CAPTURE LOGIC:
   * Uses HTML5 canvas element to capture the current frame of the video stream,
   * handles mirroring correctly, and delivers Blob + Object URL.
   */
  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Visual flash and audio click
    setIsFlashActive(true);
    playShutterClick();
    setTimeout(() => setIsFlashActive(false), 180);

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle horizontal mirroring if user enabled it
    if (isMirrored) {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, width, height);

    // Convert canvas to Blob and create Object URL as requested
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const objectUrl = URL.createObjectURL(blob);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

        // Stop stream before delivering callback
        stopStream();
        onCapture(objectUrl, blob, dataUrl);
      },
      'image/jpeg',
      0.92
    );
  };

  // File gallery fallback
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      stopStream();
      onCapture(objectUrl, file, dataUrl);
    };
    reader.readAsDataURL(file);
  };

  // 1-Click sample preset fallback
  const handleSelectPreset = async (preset: (typeof SAMPLE_RECEIPTS)[0]) => {
    try {
      const response = await fetch(preset.dataUrl);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      stopStream();
      onCapture(objectUrl, blob, preset.dataUrl);
    } catch {
      stopStream();
      onCapture(preset.dataUrl);
    }
  };

  const isFrontMode = facingMode === 'user';

  return (
    <div className="relative flex flex-col w-full h-[calc(100vh-65px)] max-w-md mx-auto bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* Visual Flash effect on shutter */}
      {isFlashActive && (
        <div className="absolute inset-0 z-50 bg-white opacity-95 pointer-events-none transition-opacity duration-200" />
      )}

      {/* Camera Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 z-20 shrink-0">
        <div className="flex items-center gap-2">
          {handleClose && (
            <button
              onClick={() => {
                stopStream();
                handleClose();
              }}
              className="p-1.5 -ml-1 text-slate-400 hover:text-white rounded-full bg-slate-800/80 transition"
              title="Cancelar"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <div className="flex items-center gap-2">
            <span
              className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                isFuel ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
              }`}
            >
              {isFuel ? '⛽' : '🔧'}
            </span>
            <div>
              <h2 className="text-xs sm:text-sm font-extrabold text-white leading-tight">
                {title}
              </h2>
              <span className="text-[10px] text-slate-400 block leading-tight">
                MediaDevices • Captura por Canvas
              </span>
            </div>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1.5">
          {/* Mirror / Unmirror toggle for webcams */}
          {!errorMessage && !isInitializing && (
            <button
              onClick={() => setIsMirrored(!isMirrored)}
              className={`p-2 rounded-full border transition ${
                isMirrored
                  ? 'bg-purple-600 text-white border-purple-400'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
              }`}
              title={isMirrored ? 'Imagem Espelhada' : 'Imagem Normal (Direta)'}
            >
              <FlipHorizontal className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Torch toggle */}
          {hasTorch && !errorMessage && !isInitializing && (
            <button
              onClick={toggleTorch}
              className={`p-2 rounded-full border transition ${
                isTorchOn
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/40'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
              title="Lanterna / Flash"
            >
              {isTorchOn ? <Zap className="w-3.5 h-3.5 fill-current" /> : <ZapOff className="w-3.5 h-3.5" />}
            </button>
          )}

          {/* Quick flip toggle */}
          {!errorMessage && !isInitializing && (
            <button
              onClick={toggleFacingMode}
              className="p-2 rounded-full bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 transition"
              title={facingMode === 'environment' ? 'Alternar para Frontal' : 'Alternar para Traseira'}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Dual Camera Selector Pill Bar */}
      {!errorMessage && (
        <div className="flex flex-col items-center justify-center py-2 px-3 bg-slate-900/80 backdrop-blur-sm border-b border-slate-800/80 z-20 shrink-0 gap-1.5">
          <div className="flex items-center p-0.5 bg-slate-950 rounded-2xl border border-slate-800 shadow-inner">
            {/* Traseira button */}
            <button
              type="button"
              onClick={() => switchFacing('environment')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                facingMode === 'environment'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/25'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>📷 Traseira</span>
              {facingMode === 'environment' && (
                <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-pulse" />
              )}
            </button>

            {/* Frontal button */}
            <button
              type="button"
              onClick={() => switchFacing('user')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                facingMode === 'user'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/25'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>🤳 Frontal / Webcam</span>
              {facingMode === 'user' && (
                <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-pulse" />
              )}
            </button>
          </div>

          {/* Active Device Label / Camera Notice Banner */}
          {cameraNotice && (
            <div className="flex items-center gap-1.5 text-[10px] text-amber-300 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 max-w-sm text-center">
              <Info className="w-3 h-3 shrink-0" />
              <span>{cameraNotice}</span>
            </div>
          )}
        </div>
      )}

      {/* Main View Area */}
      <div className="relative flex-1 bg-black flex flex-col justify-between overflow-hidden">
        {errorMessage ? (
          /* Error State */
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4 max-w-sm mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center text-amber-400 shadow-xl">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-100">Câmera Indisponível</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{errorMessage}</p>
            </div>

            <div className="w-full space-y-2 pt-2">
              <button
                onClick={() => startCamera(facingMode)}
                className="w-full py-3 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition"
              >
                <RotateCcw className="w-4 h-4" /> Tentar Novamente
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs flex items-center justify-center gap-2 active:scale-95 transition"
              >
                <ImageIcon className="w-4 h-4 text-blue-400" /> Escolher Foto da Galeria
              </button>
            </div>

            {/* Presets */}
            {showPresets && (
              <div className="w-full pt-4 border-t border-slate-800/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-2">
                  Ou teste com comprovante pronto em 1 clique:
                </span>
                <div className="space-y-1.5">
                  {SAMPLE_RECEIPTS.filter((s) => (isFuel ? s.type === 'abastecimento' : true)).map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleSelectPreset(s)}
                      className="w-full p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left flex items-center justify-between text-xs transition"
                    >
                      <div>
                        <strong className="text-slate-200 block">{s.label}</strong>
                        <span className="text-[10px] text-slate-400">{s.subtitle}</span>
                      </div>
                      <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Live Camera Stream with HTML5 Video */
          <>
            <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transition-transform duration-200 ${
                  isMirrored ? 'scale-x-[-1]' : ''
                }`}
              />

              {/* Viewfinder Target Guidelines */}
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
                <div className="relative w-full max-w-[280px] h-[360px] border-2 border-dashed border-amber-400/80 rounded-3xl shadow-[0_0_25px_rgba(245,158,11,0.3)] flex flex-col justify-between p-3.5">
                  <div className="absolute -top-1 -left-1 w-7 h-7 border-t-4 border-l-4 border-amber-400 rounded-tl-xl" />
                  <div className="absolute -top-1 -right-1 w-7 h-7 border-t-4 border-r-4 border-amber-400 rounded-tr-xl" />
                  <div className="absolute -bottom-1 -left-1 w-7 h-7 border-b-4 border-l-4 border-amber-400 rounded-bl-xl" />
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 border-b-4 border-r-4 border-amber-400 rounded-br-xl" />

                  <div className="flex justify-center">
                    <span className="bg-black/80 backdrop-blur-md px-3.5 py-1.5 rounded-full text-[11px] font-semibold text-amber-300 border border-amber-500/30 flex items-center gap-1.5 shadow-lg">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                      {facingMode === 'environment'
                        ? '📷 Traseira: Enquadre o documento fiscal'
                        : '🤳 Frontal: Aponte o documento para a webcam'}
                    </span>
                  </div>

                  <div className="text-center">
                    <span className="text-[10px] text-slate-300 bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded-full border border-slate-700/60 font-medium">
                      {facingMode === 'environment'
                        ? 'Mantenha focado e iluminado'
                        : isMirrored
                        ? 'Modo Espelhado • Clique no botão 🪞 para inverter'
                        : 'Texto legível • Aproxime o cupom'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Multiple cameras device switch dropdown */}
              {availableCameras.length > 1 && (
                <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md rounded-xl p-1 border border-slate-700 text-xs shadow-lg">
                  <select
                    value={selectedDeviceId}
                    onChange={handleDeviceChange}
                    className="bg-transparent text-slate-200 text-[10px] font-medium focus:outline-none pr-2 cursor-pointer"
                  >
                    <option value="" className="bg-slate-900 text-white">
                      Dispositivo: Automático
                    </option>
                    {availableCameras.map((cam, idx) => (
                      <option
                        key={cam.deviceId || idx}
                        value={cam.deviceId}
                        className="bg-slate-900 text-white"
                      >
                        {cam.label || `Câmera ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Bottom Controls / Shutter Bar */}
            <div className="p-4 bg-slate-900/95 border-t border-slate-800 space-y-3 shrink-0">
              <div className="flex items-center justify-around">
                {/* Gallery Upload */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-200 transition"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                    <ImageIcon className="w-5 h-5 text-slate-300" />
                  </div>
                  <span className="text-[11px] font-medium">Galeria</span>
                </button>

                {/* BIG SHUTTER BUTTON */}
                <button
                  type="button"
                  onClick={captureFrame}
                  className="relative flex items-center justify-center w-20 h-20 rounded-full border-4 border-amber-300 bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-[0_0_30px_rgba(245,158,11,0.6)] active:scale-95 transition"
                  aria-label="Capturar Foto"
                >
                  <Camera className="w-8 h-8 font-bold" />
                </button>

                {/* Switch Front / Rear Camera */}
                <button
                  type="button"
                  onClick={toggleFacingMode}
                  className="flex flex-col items-center gap-1 text-slate-400 hover:text-amber-300 transition group"
                  title={facingMode === 'environment' ? 'Alternar para Câmera Frontal' : 'Alternar para Câmera Traseira'}
                >
                  <div className="w-12 h-12 rounded-full bg-slate-800 group-hover:bg-slate-750 border border-slate-700 flex items-center justify-center transition">
                    <RefreshCw className="w-5 h-5 text-slate-300 group-hover:text-amber-300 transition" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-300 group-hover:text-amber-300">
                    {facingMode === 'environment' ? 'Para Frontal' : 'Para Traseira'}
                  </span>
                </button>
              </div>

              {/* 1-Click Fast Presets */}
              {showPresets && (
                <div className="pt-2 border-t border-slate-800/80">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      Ou teste em 1 toque com comprovante pronto:
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {SAMPLE_RECEIPTS.filter((s) => (isFuel ? s.type === 'abastecimento' : true))
                      .slice(0, 2)
                      .map((sample) => (
                        <button
                          key={sample.id}
                          type="button"
                          onClick={() => handleSelectPreset(sample)}
                          className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-750 border border-slate-700 text-left transition group"
                        >
                          <span className="text-xs font-semibold text-slate-200 group-hover:text-amber-300 block line-clamp-1">
                            {sample.label}
                          </span>
                          <span className="text-[10px] text-slate-400 block line-clamp-1">
                            {sample.subtitle}
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Hidden Elements for Media Operations */}
        <canvas ref={canvasRef} className="hidden" />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>
    </div>
  );
};

export default CameraCapture;
