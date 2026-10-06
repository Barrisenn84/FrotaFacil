import React, { useState, useEffect, useRef } from 'react';
import {
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Radio,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { useFleet } from '../../context/FleetContext';
import { getApiAuthHeaders } from '../../services/apiAuthHelper';

export const GestorFalanteAudioPlayer: React.FC = () => {
  const { currentCompany, currentUser, dailyInsights } = useFleet();

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState<boolean>(false);
  const [spokenText, setSpokenText] = useState<string>('');
  const [bullets, setBullets] = useState<string[]>([]);
  const [speechRate, setSpeechRate] = useState<number>(1.0);
  const [audioProgress, setAudioProgress] = useState<number>(0);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const progressIntervalRef = useRef<any>(null);

  // Monta o texto de resumo com base nos insights diários reais
  const buildSummaryTextFromInsights = () => {
    if (!dailyInsights) {
      return `Olá, gestor da ${currentCompany?.name || 'sua empresa'}. O sistema está pronto e totalmente limpo para novos lançamentos. Conecte sua planilha Google Sheets ou cadastre novos veículos e motoristas para iniciar a governança com inteligência artificial.`;
    }

    const revisionsCount = dailyInsights?.agenteMecanico?.projecoesPreditivas?.length || 0;
    const trendPercent = dailyInsights?.agenteFinanceiro?.tendenciaMensalPercent || 0;
    const docsCount = dailyInsights?.agenteCompliance?.alertasDocumentos?.length || 0;
    const savings = dailyInsights?.agenteFiscal?.economiaPotencialMensalBrl || 0;

    return `Olá, gestor da ${currentCompany?.name || 'Frota'}. Aqui está o resumo executivo do dia: ${revisionsCount} veículos estão perto da revisão preventiva, o gasto total está ${Math.abs(trendPercent).toFixed(0)}% ${trendPercent >= 0 ? 'acima' : 'abaixo'} da média do mês, e temos ${docsCount} documento regulatório vencendo esta semana. A auditoria fiscal identificou oportunidade de economizar até R$ ${savings.toFixed(0)} em postos conveniados alinhados com a média oficial ANP.`;
  };

  const loadSummary = async () => {
    setIsLoadingAudio(true);
    try {
      const authHeaders = await getApiAuthHeaders(
        currentCompany?.id || 'comp-translog-01',
        currentUser?.id || 'usr-admin',
        'administrativo'
      );
      const res = await fetch('/api/ai/tts-summary', {
        headers: {
          ...authHeaders,
        },
      });
      const data = await res.json();
      if (res.ok && data.success && data.data?.spokenText) {
        setSpokenText(data.data.spokenText);
        setBullets(data.data.summaryBullets || []);
        return data.data.spokenText;
      }
    } catch (e) {
      console.warn('Fallback para resumo local de voz:', e);
    } finally {
      setIsLoadingAudio(false);
    }
    const fallbackText = buildSummaryTextFromInsights();
    setSpokenText(fallbackText);
    return fallbackText;
  };

  const handleTogglePlay = async () => {
    if (isPlaying) {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setIsPlaying(false);
      clearInterval(progressIntervalRef.current);
      return;
    }

    let textToSpeak = spokenText;
    if (!textToSpeak) {
      textToSpeak = await loadSummary();
    }

    if (!('speechSynthesis' in window)) {
      alert('Seu navegador não suporta reprodução de voz nativa.');
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'pt-BR';
    utterance.rate = speechRate;
    utterance.pitch = 1.0;

    // Tentar selecionar voz em Português do Brasil com tom natural
    const voices = window.speechSynthesis.getVoices();
    const ptBrVoice =
      voices.find((v) => v.lang === 'pt-BR' && (v.name.includes('Google') || v.name.includes('Luciana') || v.name.includes('Natural') || v.name.includes('Brazil'))) ||
      voices.find((v) => v.lang === 'pt-BR') ||
      voices.find((v) => v.lang.startsWith('pt'));

    if (ptBrVoice) {
      utterance.voice = ptBrVoice;
    }

    const estimatedDurationMs = (textToSpeak.length * 75) / speechRate;
    const startTime = Date.now();

    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / estimatedDurationMs) * 100));
      setAudioProgress(pct);
    }, 100);

    utterance.onend = () => {
      setIsPlaying(false);
      setAudioProgress(100);
      clearInterval(progressIntervalRef.current);
      setTimeout(() => setAudioProgress(0), 1000);
    };

    utterance.onerror = () => {
      setIsPlaying(false);
      clearInterval(progressIntervalRef.current);
    };

    utteranceRef.current = utterance;
    setIsPlaying(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleRestart = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setAudioProgress(0);
    clearInterval(progressIntervalRef.current);
    setTimeout(() => handleTogglePlay(), 100);
  };

  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      clearInterval(progressIntervalRef.current);
    };
  }, []);

  return (
    <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-500/10 via-slate-900 to-indigo-950/40 border border-amber-500/30 rounded-3xl space-y-4 shadow-xl relative overflow-hidden font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Title & Micro Tag */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-400 to-orange-500 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/25">
            <Volume2 className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-white">Gestor Falante</h3>
              <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Voz Natural IA • gemini-3.8-flash-tts
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Síntese executiva diária: manutenções iminentes, custos vs média e vencimentos
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Speed Selector */}
          <button
            type="button"
            onClick={() => {
              const newRate = speechRate === 1.0 ? 1.25 : speechRate === 1.25 ? 1.5 : 1.0;
              setSpeechRate(newRate);
              if (isPlaying) handleRestart();
            }}
            className="px-2.5 py-2 rounded-xl bg-slate-950/80 hover:bg-slate-900 border border-slate-800 text-[11px] font-black text-amber-300 transition cursor-pointer"
            title="Velocidade da voz"
          >
            {speechRate}x
          </button>

          {isPlaying && (
            <button
              type="button"
              onClick={handleRestart}
              className="p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-900 border border-slate-800 text-slate-300 transition cursor-pointer"
              title="Reiniciar áudio"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          {/* Main "Ouvir resumo do dia" Button */}
          <button
            type="button"
            onClick={handleTogglePlay}
            disabled={isLoadingAudio}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition cursor-pointer active:scale-95 disabled:opacity-50"
          >
            {isLoadingAudio ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current" />
            )}
            <span>{isLoadingAudio ? 'Sintetizando...' : isPlaying ? 'Pausar Resumo' : 'Ouvir resumo do dia'}</span>
          </button>
        </div>
      </div>

      {/* Progress Bar & Equalizer while Playing */}
      {isPlaying && (
        <div className="space-y-2 pt-1 animate-in fade-in">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5 text-amber-300 font-bold">
              <Radio className="w-3.5 h-3.5 animate-pulse text-amber-400" />
              <span>Reproduzindo síntese executiva da frota...</span>
            </div>
            <span>{audioProgress}%</span>
          </div>

          <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-100 rounded-full"
              style={{ width: `${audioProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Caption Preview Bubble */}
      <div className="p-3.5 bg-slate-950/80 rounded-2xl border border-slate-800/80 text-xs text-slate-300 flex items-start gap-2.5">
        <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="text-[11px] font-bold text-amber-300/90 block mb-0.5">
            Transcrição do Resumo Executivo:
          </span>
          <p className="leading-relaxed text-slate-300">
            "{spokenText || buildSummaryTextFromInsights()}"
          </p>
        </div>
      </div>
    </div>
  );
};
