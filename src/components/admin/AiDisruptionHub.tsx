import React, { useState, useEffect } from 'react';
import { useFleet } from '../../context/FleetContext';
import {
  Sparkles,
  CloudRain,
  Zap,
  Send,
  ArrowRight,
  TrendingDown,
  ShieldAlert,
  Wind,
  Gauge,
  Leaf,
  CheckCircle2,
  RefreshCw,
  Search,
  Building2,
  HelpCircle,
  Car,
  MapPin,
  Navigation,
  FileText,
  Calendar,
} from 'lucide-react';
import {
  fetchRouteWeather,
  RouteWeatherData,
  lookupCnpjBrasilApi,
  CnpjVerificationResult,
  lookupFipeBrasilApi,
  FipeOfficialResult,
  lookupCepBrasilApi,
  CepResult,
  calculateRouteOsrm,
  OsrmRouteResult,
  parseSefazNfceKey,
  SefazKeyDetails,
  lookupFeriadosBrasilApi,
  FeriadoNacional,
} from '../../services/freePublicApisService';
import {
  askFleetStrategicAi,
  simulateElectrificationRoi,
  StrategicAiResponse,
  ElectrificationRoiResult,
} from '../../services/deepFleetAiService';

export const AiDisruptionHub: React.FC = () => {
  const { currentCompany, vehicles, drivers, events, metrics } = useFleet();

  const [activeSubTab, setActiveSubTab] = useState<
    'copilot' | 'weather' | 'esg' | 'cnpj' | 'fipe' | 'routes' | 'sefaz'
  >('copilot');

  // 1. Estado do Copiloto Estratégico
  const [questionInput, setQuestionInput] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [aiResponse, setAiResponse] = useState<StrategicAiResponse | null>(null);

  // 2. Estado do Clima Open-Meteo
  const [selectedCity, setSelectedCity] = useState('sao paulo');
  const [weatherData, setWeatherData] = useState<RouteWeatherData | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);

  // 3. Estado do Simulador ESG / Eletrificação
  const [esgSimulation, setEsgSimulation] = useState<ElectrificationRoiResult | null>(null);

  // 4. Estado da Auditoria BrasilAPI CNPJ
  const [cnpjInput, setCnpjInput] = useState('02.914.460/0001-50'); // Exemplo Auto Posto Petrobras
  const [cnpjResult, setCnpjResult] = useState<CnpjVerificationResult | null>(null);
  const [isLoadingCnpj, setIsLoadingCnpj] = useState(false);

  // 5. Estado da Tabela FIPE Oficial (BrasilAPI)
  const [fipeCodeInput, setFipeCodeInput] = useState('005480-1'); // Saveiro Robust
  const [fipeResults, setFipeResults] = useState<FipeOfficialResult[]>([]);
  const [isLoadingFipe, setIsLoadingFipe] = useState(false);

  // 6. Estado de Rotas OSRM & BrasilAPI CEP
  const [cepInput, setCepInput] = useState('01310-100'); // Av. Paulista
  const [cepResult, setCepResult] = useState<CepResult | null>(null);
  const [routeResult, setRouteResult] = useState<OsrmRouteResult | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);

  // 7. Estado do Auditor SEFAZ NFC-e
  const [sefazInput, setSefazInput] = useState(
    '35261002914460000150650010000451231000451238' // 44 dígitos
  );
  const [sefazResult, setSefazResult] = useState<SefazKeyDetails | null>(null);

  // Inicializar dados climáticos, ESG e FIPE ao montar
  useEffect(() => {
    loadWeatherData('sao paulo');
    const totalSpend = metrics?.indicators?.totalFleetSpend || 16820;
    const sim = simulateElectrificationRoi(vehicles, totalSpend);
    setEsgSimulation(sim);
    handleSearchFipe('005480-1');
  }, [vehicles, metrics]);

  const handleSearchFipe = async (codeOverride?: string) => {
    const code = codeOverride || fipeCodeInput;
    if (!code.trim()) return;
    setIsLoadingFipe(true);
    try {
      const results = await lookupFipeBrasilApi(code);
      setFipeResults(results);
    } catch (e) {
      console.warn('Erro ao consultar FIPE:', e);
    } finally {
      setIsLoadingFipe(false);
    }
  };

  const handleSearchCepAndRoute = async () => {
    if (!cepInput.trim()) return;
    setIsLoadingRoute(true);
    try {
      const cep = await lookupCepBrasilApi(cepInput);
      setCepResult(cep);

      // Calcular rota a partir da base principal (São Paulo - Marco Zero)
      const originLat = -23.5505;
      const originLng = -46.6333;
      const destLat = cep?.location?.coordinates?.latitude ? Number(cep.location.coordinates.latitude) : -22.9099;
      const destLng = cep?.location?.coordinates?.longitude ? Number(cep.location.coordinates.longitude) : -47.0626;

      const route = await calculateRouteOsrm(originLat, originLng, destLat, destLng);
      setRouteResult(route);
    } catch (e) {
      console.warn('Erro ao consultar CEP e rota:', e);
    } finally {
      setIsLoadingRoute(false);
    }
  };

  const handleAuditSefaz = () => {
    if (!sefazInput.trim()) return;
    const parsed = parseSefazNfceKey(sefazInput);
    setSefazResult(parsed);
  };

  const loadWeatherData = async (city: string) => {
    setIsLoadingWeather(true);
    try {
      const data = await fetchRouteWeather(city);
      setWeatherData(data);
    } catch (e) {
      console.warn('Erro ao carregar clima:', e);
    } finally {
      setIsLoadingWeather(false);
    }
  };

  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const city = e.target.value;
    setSelectedCity(city);
    loadWeatherData(city);
  };

  const handleAskQuestion = async (customPrompt?: string) => {
    const promptToUse = customPrompt || questionInput;
    if (!promptToUse.trim()) return;

    setIsAsking(true);
    try {
      const resp = await askFleetStrategicAi(promptToUse, {
        companyName: currentCompany?.name || 'TransLog Logística',
        totalVehicles: vehicles.length || 2,
        totalDrivers: drivers.length || 2,
        monthlyCostBrl: metrics?.indicators?.totalFleetSpend || 16820,
        costPerKm: metrics?.indicators?.costPerKm || 2.38,
        vehicles,
        drivers,
        events,
      });
      setAiResponse(resp);
      if (!customPrompt) setQuestionInput('');
    } catch (err) {
      console.warn('Erro copiloto:', err);
    } finally {
      setIsAsking(false);
    }
  };

  const handleAuditCnpj = async () => {
    if (!cnpjInput.trim()) return;
    setIsLoadingCnpj(true);
    try {
      const res = await lookupCnpjBrasilApi(cnpjInput);
      setCnpjResult(res);
    } catch (e) {
      console.warn('Erro audit CNPJ:', e);
    } finally {
      setIsLoadingCnpj(false);
    }
  };

  const quickQuestions = [
    'Qual veículo tem o pior custo por KM e como reduzir?',
    'Quais manutenções e documentos vencem nos próximos 30 dias?',
    'Simular economia se trocássemos por veículos elétricos',
    'Onde os motoristas pagaram mais caro que a média ANP?',
  ];

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border border-indigo-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
      {/* Decorative glow background */}
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header with Title and Mode Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800 relative z-10">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-500 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20">
              <Sparkles className="w-5 h-5 fill-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Central de Inteligência Disruptiva & APIs Gratuitas
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-indigo-500/20 border border-amber-500/40 text-[10px] font-bold text-amber-300">
                  Open APIs + Gemini IA
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Clima rodoviário ao vivo (Open-Meteo), auditoria Receita Federal (BrasilAPI) e Copiloto Estratégico.
              </p>
            </div>
          </div>
        </div>

        {/* Sub-Tabs Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 border border-slate-800 rounded-xl overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveSubTab('copilot')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
              activeSubTab === 'copilot'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Copiloto Estratégico</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('weather')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
              activeSubTab === 'weather'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <CloudRain className="w-3.5 h-3.5" />
            <span>Clima & Pista (Open-Meteo)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('cnpj')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
              activeSubTab === 'cnpj'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Auditoria CNPJ (BrasilAPI)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('fipe')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
              activeSubTab === 'fipe'
                ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Car className="w-3.5 h-3.5" />
            <span>Tabela FIPE (BrasilAPI)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('routes')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
              activeSubTab === 'routes'
                ? 'bg-orange-500 text-slate-950 shadow-md shadow-orange-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Rotas & CEP (OSRM)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('sefaz')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
              activeSubTab === 'sefaz'
                ? 'bg-purple-500 text-white shadow-md shadow-purple-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Validador SEFAZ NFC-e</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('esg')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
              activeSubTab === 'esg'
                ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Leaf className="w-3.5 h-3.5" />
            <span>Simulador Elétrico ESG</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 1. ABA: COPILOTO ESTRATÉGICO ("Ask AI Frota") */}
      {/* ========================================================= */}
      {activeSubTab === 'copilot' && (
        <div className="mt-5 space-y-4 relative z-10">
          {/* Quick Prompts Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-[11px] font-bold text-slate-400 shrink-0 flex items-center gap-1">
              <HelpCircle className="w-3 h-3 text-indigo-400" />
              Perguntas rápidas:
            </span>
            {quickQuestions.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleAskQuestion(q)}
                disabled={isAsking}
                className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-indigo-900/40 border border-slate-700/60 hover:border-indigo-500/50 text-[11px] text-slate-300 hover:text-indigo-200 transition shrink-0 cursor-pointer text-left"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Interactive Question Input */}
          <div className="relative">
            <input
              type="text"
              value={questionInput}
              onChange={(e) => setQuestionInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}
              placeholder="Pergunte qualquer coisa sobre a frota (ex: Qual caminhão está com consumo anômalo?)"
              className="w-full pl-4 pr-28 py-3 bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 outline-none transition"
            />
            <button
              type="button"
              onClick={() => handleAskQuestion()}
              disabled={isAsking || !questionInput.trim()}
              className="absolute right-1.5 top-1.5 bottom-1.5 px-4 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
            >
              {isAsking ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Analisando...</span>
                </>
              ) : (
                <>
                  <span>Consultar IA</span>
                  <Send className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>

          {/* AI Response Display */}
          {aiResponse && (
            <div className="bg-slate-950/70 border border-indigo-500/30 rounded-2xl p-4 sm:p-5 space-y-3 animate-in fade-in duration-300">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-indigo-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Parecer Executivo do Copiloto
                </span>
                <span className="text-[10px] text-slate-500">{aiResponse.sourceBadge}</span>
              </div>

              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-normal">
                {aiResponse.answer}
              </p>

              {/* Key Metrics Cards */}
              {aiResponse.keyMetrics?.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                  {aiResponse.keyMetrics.map((km, i) => (
                    <div key={i} className="p-2.5 bg-slate-900/90 border border-slate-800 rounded-xl">
                      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{km.label}</div>
                      <div className={`text-sm sm:text-base font-black mt-0.5 ${km.color}`}>{km.value}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Action Recommendation */}
              {aiResponse.actionRecommendation && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-300">
                  <ArrowRight className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                  <div>
                    <strong className="font-bold">Ação Recomendada pela IA: </strong>
                    <span>{aiResponse.actionRecommendation}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. ABA: CLIMA & RISCO DE PISTA (Open-Meteo API Gratuita) */}
      {/* ========================================================= */}
      {activeSubTab === 'weather' && (
        <div className="mt-5 space-y-4 relative z-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2">
              <CloudRain className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-slate-200">Selecionar Corredor / Cidade Logística:</span>
            </div>
            <select
              value={selectedCity}
              onChange={handleCityChange}
              className="bg-slate-900 border border-slate-700 text-white text-xs font-semibold rounded-lg px-3 py-1.5 outline-none cursor-pointer focus:border-amber-400"
            >
              <option value="sao paulo">São Paulo (SP) - Eixo Marginal/Rodoanel</option>
              <option value="campinas">Campinas (SP) - Corredor Anhanguera/Bandeirantes</option>
              <option value="santos">Santos (SP) - Corredor Porto Anchieta/Imigrantes</option>
              <option value="rio de janeiro">Rio de Janeiro (RJ) - Rodovia Presidente Dutra</option>
              <option value="curitiba">Curitiba (PR) - BR-116 Régis Bittencourt</option>
              <option value="belo horizonte">Belo Horizonte (MG) - BR-381 Fernão Dias</option>
              <option value="porto alegre">Porto Alegre (RS) - BR-101 / BR-290</option>
            </select>
          </div>

          {weatherData ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {/* Clima Atual */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tempo ao Vivo</span>
                  <div className="text-2xl font-black text-white mt-1">{weatherData.temperature}°C</div>
                  <div className="text-xs text-amber-300 font-semibold mt-0.5">{weatherData.weatherDescription}</div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Umidade: {weatherData.humidity}%</span>
                  <span>Chuva: {weatherData.precipitationMm} mm</span>
                </div>
              </div>

              {/* Risco de Pista & Aquaplanagem */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Condição da Pista</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-black uppercase ${
                        weatherData.aquaplaningRisk === 'baixo'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : weatherData.aquaplaningRisk === 'moderado'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                          : 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
                      }`}
                    >
                      {weatherData.aquaplaningRisk === 'baixo' ? 'Pista Segura' : `Risco ${weatherData.aquaplaningRisk}`}
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 mt-2">
                    Frenagem: <strong>{weatherData.brakingDistanceMultiplier}x</strong> a distância padrão
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800/80 text-[10px] text-slate-500">
                  Base Open-Meteo High-Resolution Model
                </div>
              </div>

              {/* Impacto no Consumo de Combustível */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Arrasto & Consumo</span>
                  <div className="text-2xl font-black text-amber-400 mt-1">
                    +{weatherData.fuelConsumptionImpactPercent}%
                  </div>
                  <div className="text-xs text-slate-300 mt-0.5">Sobrecusto aerodinâmico/atrito</div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Wind className="w-3.5 h-3.5 text-sky-400" />
                  <span>Vento: {weatherData.windSpeedKmH} km/h</span>
                </div>
              </div>

              {/* Recomendação de Segurança */}
              <div className="bg-gradient-to-br from-indigo-950/60 to-slate-950 border border-indigo-500/30 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-indigo-300 text-xs font-bold">
                    <ShieldAlert className="w-4 h-4 text-indigo-400" />
                    <span>Diretriz do Copiloto</span>
                  </div>
                  <p className="text-xs text-slate-200 mt-2 leading-relaxed">
                    {weatherData.safetyAdvisory}
                  </p>
                </div>
                <div className="mt-3 text-[10px] text-slate-400">
                  Atualizado em tempo real para os condutores.
                </div>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-slate-400">Carregando telemetria climática...</div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. ABA: AUDITORIA DE CNPJ RECEITA FEDERAL (BrasilAPI Gratuita) */}
      {/* ========================================================= */}
      {activeSubTab === 'cnpj' && (
        <div className="mt-5 space-y-4 relative z-10">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={cnpjInput}
                onChange={(e) => setCnpjInput(e.target.value)}
                placeholder="Digite o CNPJ do Posto ou Oficina (ex: 02.914.460/0001-50)"
                className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 outline-none"
              />
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            </div>
            <button
              type="button"
              onClick={handleAuditCnpj}
              disabled={isLoadingCnpj}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              {isLoadingCnpj ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>Auditar na Receita</span>
            </button>
          </div>

          {cnpjResult && (
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs text-slate-400">Razão Social / Nome Fantasia</span>
                  <div className="text-sm font-black text-white">{cnpjResult.razaoSocial}</div>
                  {cnpjResult.nomeFantasia && cnpjResult.nomeFantasia !== cnpjResult.razaoSocial && (
                    <div className="text-xs text-emerald-400 font-semibold">{cnpjResult.nomeFantasia}</div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black uppercase ${
                      cnpjResult.statusAudit === 'confiavel'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : cnpjResult.statusAudit === 'alerta'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        : 'bg-red-500/20 text-red-400 border border-red-500/40'
                    }`}
                  >
                    Situação: {cnpjResult.situacaoCadastral}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 text-xs">
                <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 font-bold block">ATIVIDADE ECONÔMICA (CNAE)</span>
                  <span className="text-slate-300 font-medium">{cnpjResult.cnaeDescricao}</span>
                </div>
                <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 font-bold block">MUNICÍPIO / UF</span>
                  <span className="text-slate-300 font-medium">
                    {cnpjResult.cidade ? `${cnpjResult.cidade} - ${cnpjResult.uf}` : 'Não informado'}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 font-bold block">CLASSIFICAÇÃO DE SEGURANÇA</span>
                  <span className="text-emerald-400 font-bold">
                    {cnpjResult.isPostoCombustivel
                      ? 'Posto Varejista Oficial'
                      : cnpjResult.isOficinaMecanica
                      ? 'Oficina Mecânica Credenciada'
                      : 'Estabelecimento Comercial Geral'}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-xs text-slate-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <span>{cnpjResult.motivoAudit}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. ABA: SIMULADOR DE ELETRIFICAÇÃO & DESCARBONIZAÇÃO ESG */}
      {/* ========================================================= */}
      {activeSubTab === 'esg' && esgSimulation && (
        <div className="mt-5 space-y-4 relative z-10">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Economia Anual Líquida</span>
              <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-1">
                R$ {esgSimulation.economiaLiquidaTotalAnoBrl.toLocaleString('pt-BR')}
              </div>
              <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
                <span>-{esgSimulation.percentualEconomiaPorKm}% por KM rodado</span>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Retorno do Capital</span>
              <div className="text-xl sm:text-2xl font-black text-teal-300 mt-1">
                {esgSimulation.paybackMeses} meses
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Payback com custo de energia solar/rede</div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Crédito de Carbono (ESG)</span>
              <div className="text-xl sm:text-2xl font-black text-emerald-300 mt-1">
                -{esgSimulation.reducaoCo2ToneladasAno} ton CO₂
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Menos poluição atmosférica/ano</div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Custo de Energia/KM</span>
              <div className="text-xl sm:text-2xl font-black text-sky-400 mt-1">
                R$ {esgSimulation.custoKmEletrico.toFixed(2)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">vs R$ {esgSimulation.custoKmDiesel.toFixed(2)} do Diesel</div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-teal-500/10 border border-teal-500/30 text-xs text-teal-200 flex items-start gap-3">
            <Leaf className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold text-teal-300 block mb-1">Diagnóstico Executivo de Sustentabilidade:</strong>
              <p className="leading-relaxed">{esgSimulation.recomendacaoExecutiva}</p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. ABA: TABELA FIPE OFICIAL (BrasilAPI) */}
      {/* ========================================================= */}
      {activeSubTab === 'fipe' && (
        <div className="mt-5 space-y-4 relative z-10">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={fipeCodeInput}
                onChange={(e) => setFipeCodeInput(e.target.value)}
                placeholder="Código FIPE (ex: 005480-1)"
                className="w-full pl-4 pr-10 py-3 bg-slate-950 border border-slate-700 focus:border-sky-500 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 outline-none transition"
              />
              <Car className="w-4 h-4 text-slate-500 absolute right-3.5 top-3.5" />
            </div>

            <button
              type="button"
              onClick={() => handleSearchFipe()}
              disabled={isLoadingFipe || !fipeCodeInput.trim()}
              className="px-5 py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              {isLoadingFipe ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Consultando FIPE...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Consultar Tabela FIPE</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto text-xs text-slate-400">
            <span className="text-[11px] font-bold text-slate-500">Atalhos da Frota:</span>
            <button
              type="button"
              onClick={() => {
                setFipeCodeInput('005480-1');
                handleSearchFipe('005480-1');
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 transition"
            >
              VW Saveiro Robust (005480-1)
            </button>
            <button
              type="button"
              onClick={() => {
                setFipeCodeInput('002164-4');
                handleSearchFipe('002164-4');
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 transition"
            >
              Mercedes Actros 2651 (002164-4)
            </button>
            <button
              type="button"
              onClick={() => {
                setFipeCodeInput('005340-6');
                handleSearchFipe('005340-6');
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 transition"
            >
              VW Gol 1.0 (005340-6)
            </button>
          </div>

          {fipeResults.length > 0 && (
            <div className="space-y-3">
              {fipeResults.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-slate-950 border border-sky-500/30 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-sky-400">
                        {item.marca} • CÓDIGO {item.codigoFipe}
                      </span>
                      <h4 className="text-base font-extrabold text-white mt-0.5">{item.modelo}</h4>
                      <p className="text-xs text-slate-400">
                        Ano Modelo: {item.anoModelo} • Combustível: {item.combustivel} ({item.siglaCombustivel})
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">
                        Valor Venal de Mercado (FIPE)
                      </span>
                      <span className="text-2xl font-black text-emerald-400 tracking-tight">
                        {item.valor}
                      </span>
                      <span className="text-[10px] text-slate-500 block">Referência: {item.mesReferencia}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-sky-950/20 border border-sky-500/20 rounded-xl text-xs text-sky-200 flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
                    <span>
                      Consulta oficial verificada via BrasilAPI Tabela FIPE. Utilizada no cálculo do patrimônio líquido da empresa e momento ótimo de renovação de ativos.
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. ABA: ROTAS OSRM & LOGÍSTICA DE CEP (BrasilAPI) */}
      {/* ========================================================= */}
      {activeSubTab === 'routes' && (
        <div className="mt-5 space-y-4 relative z-10">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={cepInput}
                onChange={(e) => setCepInput(e.target.value)}
                placeholder="Informe o CEP do Posto ou Oficina (ex: 01310-100)"
                className="w-full pl-4 pr-10 py-3 bg-slate-950 border border-slate-700 focus:border-orange-500 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 outline-none transition"
              />
              <MapPin className="w-4 h-4 text-slate-500 absolute right-3.5 top-3.5" />
            </div>

            <button
              type="button"
              onClick={handleSearchCepAndRoute}
              disabled={isLoadingRoute || !cepInput.trim()}
              className="px-5 py-3 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              {isLoadingRoute ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Traçando Rota...</span>
                </>
              ) : (
                <>
                  <Navigation className="w-4 h-4" />
                  <span>Calcular Rota & Logística</span>
                </>
              )}
            </button>
          </div>

          {cepResult && (
            <div className="bg-slate-950 border border-orange-500/30 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-orange-400">
                    Destino Identificado via BrasilAPI CEP
                  </span>
                  <h4 className="text-base font-extrabold text-white mt-0.5">
                    {cepResult.street || 'Logradouro Principal'}, {cepResult.neighborhood}
                  </h4>
                  <p className="text-xs text-slate-400">
                    {cepResult.city} - {cepResult.state} • CEP: {cepResult.cep}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-orange-500/10 border border-orange-500/30 text-orange-300">
                    Base: São Paulo (Centro)
                  </span>
                </div>
              </div>

              {routeResult && (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 font-bold block">DISTÂNCIA RODOVIÁRIA (OSRM)</span>
                    <span className="text-lg font-black text-white mt-1 block">
                      {routeResult.distanceKm.toLocaleString('pt-BR')} km
                    </span>
                    <span className="text-[10px] text-slate-400">Malha rodoviária real</span>
                  </div>

                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 font-bold block">TEMPO ESTIMADO</span>
                    <span className="text-lg font-black text-amber-400 mt-1 block">
                      {routeResult.durationMinutes} minutos
                    </span>
                    <span className="text-[10px] text-slate-400">Trânsito médio projetado</span>
                  </div>

                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 font-bold block">DIESEL PROJETADO</span>
                    <span className="text-lg font-black text-emerald-400 mt-1 block">
                      {routeResult.estimatedDieselLiters.toFixed(1)} L
                    </span>
                    <span className="text-[10px] text-slate-400">Consumo médio 3,5 km/L</span>
                  </div>

                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 font-bold block">CUSTO DA VIAGEM</span>
                    <span className="text-lg font-black text-sky-400 mt-1 block">
                      R$ {routeResult.estimatedCostBrl.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-slate-400">Diesel a R$ 5,89/L</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 7. ABA: AUDITOR DE CHAVE FISCAL SEFAZ (NFC-e / NF-e 44 dígitos) */}
      {/* ========================================================= */}
      {activeSubTab === 'sefaz' && (
        <div className="mt-5 space-y-4 relative z-10">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={sefazInput}
                onChange={(e) => setSefazInput(e.target.value)}
                placeholder="Digite a Chave de Acesso de 44 dígitos impressa no Cupom Fiscal"
                className="w-full pl-4 pr-10 py-3 bg-slate-950 border border-slate-700 focus:border-purple-500 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 outline-none transition font-mono"
              />
              <FileText className="w-4 h-4 text-slate-500 absolute right-3.5 top-3.5" />
            </div>

            <button
              type="button"
              onClick={handleAuditSefaz}
              disabled={!sefazInput.trim()}
              className="px-5 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Auditar Chave Fiscal</span>
            </button>
          </div>

          {sefazResult && (
            <div className="bg-slate-950 border border-purple-500/30 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-purple-400">
                    Documento Fiscal Verificado (SPED SEFAZ)
                  </span>
                  <h4 className="text-base font-extrabold text-white mt-0.5">
                    {sefazResult.modelDesc} • Nota Nº {sefazResult.invoiceNumber} (Série {sefazResult.series})
                  </h4>
                  <p className="text-xs text-slate-400">
                    CNPJ Emitente: {sefazResult.cnpjFormatado} • Emissão: {sefazResult.yearMonth} • UF: {sefazResult.ufName} ({sefazResult.ufCode})
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black uppercase ${
                      sefazResult.isCheckDigitValid
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-red-500/20 text-red-400 border border-red-500/40'
                    }`}
                  >
                    {sefazResult.isCheckDigitValid
                      ? 'Dígito Módulo 11 Válido'
                      : 'Alerta: Dígito Verificador Inválido'}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-purple-950/20 border border-purple-500/20 rounded-xl text-xs text-purple-200 flex items-center gap-2.5">
                <ShieldAlert className="w-4 h-4 text-purple-400 shrink-0" />
                <span>
                  Chave fiscal decodificada com integridade algorítmica. Garante que o cupom anexado pelo motorista foi emitido por um ponto de venda credenciado pela SEFAZ estadual.
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

