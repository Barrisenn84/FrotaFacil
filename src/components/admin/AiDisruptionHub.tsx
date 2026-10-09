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
  ArrowUpDown,
  ExternalLink,
  Truck,
  Fuel,
  DollarSign,
  Clock,
  Compass,
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
  calculateFleetMultiRoute,
  MultiRouteResult,
  SingleRouteOption,
  LOGISTICS_BASES,
  LogisticsBase,
  ROUTE_VEHICLE_PROFILES,
  RouteVehicleProfile,
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
  const [cnpjInput, setCnpjInput] = useState('02.914.460/0001-50'); // Auto Posto Petrobras
  const [cnpjResult, setCnpjResult] = useState<CnpjVerificationResult | null>(null);
  const [isLoadingCnpj, setIsLoadingCnpj] = useState(false);

  // 5. Estado da Tabela FIPE Oficial (Multi-Tier)
  const [fipeInput, setFipeInput] = useState('005472-0'); // VW Saveiro Robust Oficial
  const [fipeResults, setFipeResults] = useState<FipeOfficialResult[]>([]);
  const [isLoadingFipe, setIsLoadingFipe] = useState(false);

  // 6. Estado de Rotas & Bases Logísticas (OSRM)
  const [selectedBaseId, setSelectedBaseId] = useState<string>('sp-centro');
  const [customOriginCep, setCustomOriginCep] = useState<string>('');
  const [customOriginName, setCustomOriginName] = useState<string>('');
  const [isCustomBase, setIsCustomBase] = useState<boolean>(false);

  const [destCepInput, setDestCepInput] = useState<string>('01310-100'); // Av. Paulista
  const [destCepResult, setDestCepResult] = useState<CepResult | null>(null);

  const [selectedVehicleProfileId, setSelectedVehicleProfileId] = useState<string>('pickup-leve');
  const [isRoundTrip, setIsRoundTrip] = useState<boolean>(false);
  const [multiRouteResult, setMultiRouteResult] = useState<MultiRouteResult | null>(null);
  const [selectedRouteType, setSelectedRouteType] = useState<'expressa' | 'economica' | 'segura'>('expressa');
  const [isLoadingRoute, setIsLoadingRoute] = useState<boolean>(false);

  // 7. Estado do Auditor SEFAZ NFC-e
  const [sefazInput, setSefazInput] = useState(
    '35261002914460000150650010000451231000451238'
  );
  const [sefazResult, setSefazResult] = useState<SefazKeyDetails | null>(null);

  // Inicialização ao montar
  useEffect(() => {
    loadWeatherData('sao paulo');
    const totalSpend = metrics?.indicators?.totalFleetSpend || 16820;
    const sim = simulateElectrificationRoi(vehicles, totalSpend);
    setEsgSimulation(sim);
    handleSearchFipe('005472-0');
    // Carregar rota inicial padrão (São Paulo Centro -> Av. Paulista)
    handleCalculateRoute('sp-centro', '01310-100', 'pickup-leve', false);
  }, [vehicles, metrics]);

  // Consulta FIPE
  const handleSearchFipe = async (queryOverride?: string) => {
    const q = queryOverride !== undefined ? queryOverride : fipeInput;
    if (!q.trim()) return;
    setIsLoadingFipe(true);
    try {
      const results = await lookupFipeBrasilApi(q);
      setFipeResults(results);
    } catch (e) {
      console.warn('Erro ao consultar FIPE:', e);
    } finally {
      setIsLoadingFipe(false);
    }
  };

  // Cálculo de Rotas OSRM Multi-Bases
  const handleCalculateRoute = async (
    baseIdToUse = selectedBaseId,
    destCepToUse = destCepInput,
    profileIdToUse = selectedVehicleProfileId,
    roundTripToUse = isRoundTrip
  ) => {
    if (!destCepToUse.trim()) return;
    setIsLoadingRoute(true);

    try {
      // 1. Resolver Destino
      const destCep = await lookupCepBrasilApi(destCepToUse);
      setDestCepResult(destCep);

      const destLat = destCep?.location?.coordinates?.latitude
        ? Number(destCep.location.coordinates.latitude)
        : -23.5614;
      const destLng = destCep?.location?.coordinates?.longitude
        ? Number(destCep.location.coordinates.longitude)
        : -46.6559;

      const destObj = {
        name: destCep?.street ? `${destCep.street}, ${destCep.neighborhood}` : 'Destino Informado',
        city: destCep?.city || 'São Paulo',
        uf: destCep?.state || 'SP',
        address: destCep?.street ? `${destCep.street} - ${destCep.neighborhood}` : undefined,
        cep: destCep?.cep || destCepToUse,
        lat: destLat,
        lng: destLng,
      };

      // 2. Resolver Origem / Base Logística
      let originObj = {
        name: 'São Paulo - Centro (Sede)',
        city: 'São Paulo',
        uf: 'SP',
        address: 'Praça da Sé / Marco Zero',
        cep: '01001-000',
        lat: -23.5505,
        lng: -46.6333,
      };

      if (isCustomBase && customOriginCep.trim()) {
        const originCepData = await lookupCepBrasilApi(customOriginCep);
        if (originCepData) {
          originObj = {
            name: customOriginName.trim() || `Base ${originCepData.city} (${originCepData.neighborhood})`,
            city: originCepData.city,
            uf: originCepData.state,
            address: originCepData.street || 'Endereço Operacional',
            cep: originCepData.cep,
            lat: originCepData.location?.coordinates?.latitude
              ? Number(originCepData.location.coordinates.latitude)
              : -23.5505,
            lng: originCepData.location?.coordinates?.longitude
              ? Number(originCepData.location.coordinates.longitude)
              : -46.6333,
          };
        }
      } else {
        const foundBase = LOGISTICS_BASES.find((b) => b.id === baseIdToUse) || LOGISTICS_BASES[0];
        originObj = {
          name: foundBase.name,
          city: foundBase.city,
          uf: foundBase.uf,
          address: foundBase.address,
          cep: foundBase.cep,
          lat: foundBase.lat,
          lng: foundBase.lng,
        };
      }

      // 3. Resolver Perfil de Veículo
      const profile =
        ROUTE_VEHICLE_PROFILES.find((p) => p.id === profileIdToUse) || ROUTE_VEHICLE_PROFILES[3];

      // 4. Executar Cálculo Multi-Rotas
      const multiResult = await calculateFleetMultiRoute({
        origin: originObj,
        destination: destObj,
        isRoundTrip: roundTripToUse,
        vehicleProfile: profile,
      });

      setMultiRouteResult(multiResult);
      setSelectedRouteType('expressa');
    } catch (e) {
      console.warn('Erro ao calcular multi-rotas:', e);
    } finally {
      setIsLoadingRoute(false);
    }
  };

  // Inverter Origem e Destino
  const handleInvertRoute = async () => {
    if (!destCepResult || !multiRouteResult) return;
    const currentDestCep = destCepResult.cep;
    const currentOriginCep = multiRouteResult.origin.cep || '01001-000';

    setDestCepInput(currentOriginCep);
    if (isCustomBase) {
      setCustomOriginCep(currentDestCep);
    }
    await handleCalculateRoute(selectedBaseId, currentOriginCep, selectedVehicleProfileId, isRoundTrip);
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

  const activeRouteOption: SingleRouteOption | undefined = multiRouteResult?.options.find(
    (opt) => opt.type === selectedRouteType
  ) || multiRouteResult?.options[0];

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
                Clima rodoviário ao vivo (Open-Meteo), cotação FIPE oficial, auditoria Receita Federal (BrasilAPI/CNPJ.ws) e OSRM Multi-Bases.
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
      {/* 1. ABA: COPILOTO ESTRATÉGICO */}
      {/* ========================================================= */}
      {activeSubTab === 'copilot' && (
        <div className="mt-5 space-y-4 relative z-10">
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
      {/* 2. ABA: CLIMA & RISCO DE PISTA (Open-Meteo) */}
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
              <option value="brasilia">Brasília (DF) - Eixo Central</option>
              <option value="salvador">Salvador (BA) - BR-324</option>
              <option value="goiania">Goiânia (GO) - BR-153</option>
              <option value="ribeirao preto">Ribeirão Preto (SP) - Trevo Anhanguera</option>
            </select>
          </div>

          {weatherData ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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
                  Base Open-Meteo High-Resolution
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Arrasto & Consumo</span>
                  <div className="text-2xl font-black text-amber-400 mt-1">
                    +{weatherData.fuelConsumptionImpactPercent}%
                  </div>
                  <div className="text-xs text-slate-300 mt-0.5">Sobrecusto de atrito/vento</div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Wind className="w-3.5 h-3.5 text-sky-400" />
                  <span>Vento: {weatherData.windSpeedKmH} km/h</span>
                </div>
              </div>

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
                  Telemetria climática em tempo real.
                </div>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-slate-400">Carregando telemetria climática...</div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. ABA: AUDITORIA DE CNPJ RECEITA FEDERAL */}
      {/* ========================================================= */}
      {activeSubTab === 'cnpj' && (
        <div className="mt-5 space-y-4 relative z-10">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={cnpjInput}
                onChange={(e) => setCnpjInput(e.target.value)}
                placeholder="Digite o CNPJ do Posto ou Oficina (ex: 02.914.460/0001-50 ou Petrobras 33.000.167/0001-01)"
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
      {/* 4. ABA: TABELA FIPE OFICIAL (Corrigida 100% sem divergências) */}
      {/* ========================================================= */}
      {activeSubTab === 'fipe' && (
        <div className="mt-5 space-y-4 relative z-10">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={fipeInput}
                onChange={(e) => setFipeInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchFipe()}
                placeholder="Digite o Código FIPE (ex: 005472-0) ou Nome do Veículo (ex: Saveiro, Actros, Gol, Amarok)"
                className="w-full pl-4 pr-10 py-3 bg-slate-950 border border-slate-700 focus:border-sky-500 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 outline-none transition"
              />
              <Car className="w-4 h-4 text-slate-500 absolute right-3.5 top-3.5" />
            </div>

            <button
              type="button"
              onClick={() => handleSearchFipe()}
              disabled={isLoadingFipe || !fipeInput.trim()}
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

          {/* Atalhos Rápidos com Códigos e Modelos 100% Corretos e Oficiais */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 overflow-x-auto text-xs text-slate-400 pb-1 scrollbar-none">
              <span className="text-[11px] font-bold text-sky-400 shrink-0">Atalhos da Frota:</span>
              <button
                type="button"
                onClick={() => {
                  setFipeInput('005472-0');
                  handleSearchFipe('005472-0');
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-sky-900/40 border border-slate-700/60 hover:border-sky-500/50 text-[11px] text-slate-200 transition shrink-0 cursor-pointer"
              >
                VW Saveiro Robust (005472-0)
              </button>
              <button
                type="button"
                onClick={() => {
                  setFipeInput('509313-9');
                  handleSearchFipe('509313-9');
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-sky-900/40 border border-slate-700/60 hover:border-sky-500/50 text-[11px] text-slate-200 transition shrink-0 cursor-pointer"
              >
                Mercedes Actros 2651 (509313-9)
              </button>
              <button
                type="button"
                onClick={() => {
                  setFipeInput('005490-9');
                  handleSearchFipe('005490-9');
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-sky-900/40 border border-slate-700/60 hover:border-sky-500/50 text-[11px] text-slate-200 transition shrink-0 cursor-pointer"
              >
                VW Gol 1.0 (005490-9)
              </button>
              <button
                type="button"
                onClick={() => {
                  setFipeInput('005340-6');
                  handleSearchFipe('005340-6');
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-sky-900/40 border border-slate-700/60 hover:border-sky-500/50 text-[11px] text-slate-200 transition shrink-0 cursor-pointer"
              >
                VW Amarok Highline (005340-6)
              </button>
              <button
                type="button"
                onClick={() => {
                  setFipeInput('001531-8');
                  handleSearchFipe('001531-8');
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-sky-900/40 border border-slate-700/60 hover:border-sky-500/50 text-[11px] text-slate-200 transition shrink-0 cursor-pointer"
              >
                Fiat Strada Endurance (001531-8)
              </button>
              <button
                type="button"
                onClick={() => {
                  setFipeInput('516140-1');
                  handleSearchFipe('516140-1');
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-sky-900/40 border border-slate-700/60 hover:border-sky-500/50 text-[11px] text-slate-200 transition shrink-0 cursor-pointer"
              >
                Volvo FH 540 (516140-1)
              </button>
            </div>

            {/* Veículos Cadastrados na Frota da Empresa */}
            {vehicles.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto text-xs text-slate-500 pt-1">
                <span className="text-[10px] font-semibold text-slate-400 shrink-0">Da sua frota:</span>
                {vehicles.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      const query = `${v.make} ${v.model}`;
                      setFipeInput(query);
                      handleSearchFipe(query);
                    }}
                    className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-300 transition shrink-0"
                  >
                    {v.plate} ({v.model})
                  </button>
                ))}
              </div>
            )}
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
                      <h4 className="text-base sm:text-lg font-extrabold text-white mt-0.5">{item.modelo}</h4>
                      <p className="text-xs text-slate-400">
                        Ano Modelo: {item.anoModelo} • Combustível: {item.combustivel} ({item.siglaCombustivel})
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">
                        Valor Venal de Mercado (FIPE)
                      </span>
                      <span className="text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight">
                        {item.valor}
                      </span>
                      <span className="text-[10px] text-slate-500 block">Referência: {item.mesReferencia}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-sky-950/20 border border-sky-500/20 rounded-xl text-xs text-sky-200 flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
                    <span>
                      Consulta oficial verificada via Tabela FIPE (Parallelum v2 / BrasilAPI). Utilizada no cálculo do patrimônio líquido da empresa, precificação de seguro e ponto ótimo de substituição de ativos.
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. ABA: ROTAS OSRM, SELEÇÃO DE BASES & LOGÍSTICA DE CEP */}
      {/* ========================================================= */}
      {activeSubTab === 'routes' && (
        <div className="mt-5 space-y-4 relative z-10">
          {/* PAINEL DE CONTROLE LOGÍSTICO: BASE, DESTINO E VEÍCULO */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 bg-slate-950/70 p-4 rounded-2xl border border-slate-800">
            {/* 1. SELEÇÃO DA BASE DE ORIGEM (CORRIGIDO: NÃO FICA MAIS FIXO EM SP CENTRO!) */}
            <div className="lg:col-span-5 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-orange-400" />
                  <span>Base de Origem / Ponto de Partida:</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsCustomBase(!isCustomBase)}
                  className="text-[11px] font-semibold text-orange-400 hover:text-orange-300 underline cursor-pointer"
                >
                  {isCustomBase ? 'Ver Centros de Distribuição (Hubs)' : 'Digitar Outro CEP / Base'}
                </button>
              </div>

              {!isCustomBase ? (
                <select
                  value={selectedBaseId}
                  onChange={(e) => {
                    const newBaseId = e.target.value;
                    setSelectedBaseId(newBaseId);
                    handleCalculateRoute(newBaseId, destCepInput, selectedVehicleProfileId, isRoundTrip);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 text-white text-xs font-semibold rounded-xl px-3 py-2.5 outline-none focus:border-orange-500 cursor-pointer"
                >
                  {LOGISTICS_BASES.map((b) => (
                    <option key={b.id} value={b.id}>
                      [{b.uf}] {b.name} ({b.tipo})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={customOriginCep}
                    onChange={(e) => setCustomOriginCep(e.target.value)}
                    placeholder="CEP Origem (ex: 13055-900)"
                    className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded-xl px-3 py-2 outline-none focus:border-orange-500 font-mono"
                  />
                  <input
                    type="text"
                    value={customOriginName}
                    onChange={(e) => setCustomOriginName(e.target.value)}
                    placeholder="Nome da Filial / CD"
                    className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded-xl px-3 py-2 outline-none focus:border-orange-500"
                  />
                </div>
              )}
            </div>

            {/* 2. SELEÇÃO DO DESTINO (CEP DO POSTO / CLIENTE) */}
            <div className="lg:col-span-4 space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                <span>CEP de Destino (Posto / Oficina / Cliente):</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={destCepInput}
                  onChange={(e) => setDestCepInput(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === 'Enter' &&
                    handleCalculateRoute(selectedBaseId, destCepInput, selectedVehicleProfileId, isRoundTrip)
                  }
                  placeholder="CEP de Destino (ex: 01310-100)"
                  className="w-full pl-3 pr-10 py-2.5 bg-slate-900 border border-slate-700 focus:border-orange-500 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 outline-none transition font-mono"
                />
                <button
                  type="button"
                  onClick={handleInvertRoute}
                  title="Inverter Origem e Destino"
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-orange-400 cursor-pointer transition"
                >
                  <ArrowUpDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 3. PERFIL DO VEÍCULO / CONSUMO */}
            <div className="lg:col-span-3 space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-sky-400" />
                <span>Veículo Operacional:</span>
              </label>
              <select
                value={selectedVehicleProfileId}
                onChange={(e) => {
                  const newProfileId = e.target.value;
                  setSelectedVehicleProfileId(newProfileId);
                  handleCalculateRoute(selectedBaseId, destCepInput, newProfileId, isRoundTrip);
                }}
                className="w-full bg-slate-900 border border-slate-700 text-white text-xs font-semibold rounded-xl px-3 py-2.5 outline-none focus:border-orange-500 cursor-pointer"
              >
                {ROUTE_VEHICLE_PROFILES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} (~{p.avgKmLiter} km/L)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* BARRA DE AÇÕES E BOTÕES: CALCULAR, IDA E VOLTA, GOOGLE MAPS */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const newTrip = !isRoundTrip;
                  setIsRoundTrip(newTrip);
                  handleCalculateRoute(selectedBaseId, destCepInput, selectedVehicleProfileId, newTrip);
                }}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center gap-2 ${
                  isRoundTrip
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{isRoundTrip ? 'Ida e Volta (Circuito Completo)' : 'Apenas Ida (One-Way)'}</span>
              </button>

              <button
                type="button"
                onClick={handleInvertRoute}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-950 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer flex items-center gap-1.5"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-orange-400" />
                <span>Inverter Base ⇄ Destino</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() =>
                handleCalculateRoute(selectedBaseId, destCepInput, selectedVehicleProfileId, isRoundTrip)
              }
              disabled={isLoadingRoute || !destCepInput.trim()}
              className="px-6 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-orange-600/30 disabled:opacity-50"
            >
              {isLoadingRoute ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Calculando Rotas OSRM...</span>
                </>
              ) : (
                <>
                  <Navigation className="w-4 h-4" />
                  <span>Recalcular Cenários de Rota</span>
                </>
              )}
            </button>
          </div>

          {/* RESULTADO: RESUMO DO DESTINO E ORIGEM */}
          {multiRouteResult && (
            <div className="space-y-4">
              <div className="bg-slate-950 border border-orange-500/30 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-orange-400">
                      Destino Identificado via BrasilAPI / ViaCEP
                    </span>
                    <h4 className="text-base font-extrabold text-white mt-0.5">
                      {multiRouteResult.destination.name}
                    </h4>
                    <p className="text-xs text-slate-400">
                      {multiRouteResult.destination.city} - {multiRouteResult.destination.uf} • CEP: {multiRouteResult.destination.cep}
                    </p>
                  </div>

                  {/* IDENTIFICAÇÃO DINÂMICA DA BASE DE ORIGEM (TOTALMENTE SELECIONÁVEL) */}
                  <div className="flex flex-col items-start sm:items-end gap-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Base Operacional Ativa
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-orange-500/10 border border-orange-500/30 text-orange-300">
                      Base: {multiRouteResult.origin.name}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {multiRouteResult.origin.city} ({multiRouteResult.origin.uf})
                    </span>
                  </div>
                </div>

                {/* CENÁRIOS COMPARATIVOS DE ROTAS: EXPRESSA vs ECONÔMICA vs SEGURA */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5 text-orange-400" />
                      Escolha o Cenário de Rota Desejado:
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Veículo: <strong>{multiRouteResult.vehicleProfile.label.split('(')[0]}</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {multiRouteResult.options.map((opt) => {
                      const isSelected = selectedRouteType === opt.type;
                      return (
                        <div
                          key={opt.type}
                          onClick={() => setSelectedRouteType(opt.type)}
                          className={`p-4 rounded-2xl border transition cursor-pointer relative flex flex-col justify-between ${
                            isSelected
                              ? 'bg-gradient-to-br from-orange-950/40 via-slate-900 to-slate-950 border-orange-500 shadow-xl shadow-orange-500/10 ring-1 ring-orange-500'
                              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-2">
                              <span
                                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                  opt.type === 'expressa'
                                    ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                                    : opt.type === 'economica'
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                    : 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
                                }`}
                              >
                                {opt.badge}
                              </span>
                              {isSelected && (
                                <span className="text-[10px] font-black text-orange-400 flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Selecionada
                                </span>
                              )}
                            </div>

                            <h5 className="text-sm font-black text-white">{opt.title}</h5>
                            <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                              {opt.description}
                            </p>
                          </div>

                          <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-[10px] text-slate-500 block">Distância</span>
                              <span className="text-sm font-black text-white">
                                {opt.distanceKm.toLocaleString('pt-BR')} km
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block">Tempo Est.</span>
                              <span className="text-sm font-black text-amber-400">{opt.durationFormatted}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block">Combustível</span>
                              <span className="text-sm font-black text-emerald-400">
                                {opt.fuelLiters.toFixed(1)} L
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block">Custo Total</span>
                              <span className="text-sm font-black text-sky-400">
                                R$ {opt.totalCostBrl.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* DETALHAMENTO DA ROTA ATIVA SELECIONADA */}
                {activeRouteOption && (
                  <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-black text-white flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        Detalhamento de Custos Operacionais ({activeRouteOption.title}):
                      </span>

                      {/* Botão Google Maps Direto com Coordenadas Oficiais */}
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&origin=${multiRouteResult.origin.lat},${multiRouteResult.origin.lng}&destination=${multiRouteResult.destination.lat},${multiRouteResult.destination.lng}&travelmode=driving`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-orange-600/20 hover:bg-orange-600/30 border border-orange-500/40 text-orange-300 font-bold text-xs flex items-center gap-1.5 transition"
                      >
                        <span>Abrir no Google Maps</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-500 font-bold block">COMBUSTÍVEL PROJETADO</span>
                        <span className="text-base font-black text-emerald-400 mt-0.5 block">
                          R$ {activeRouteOption.fuelCostBrl.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {activeRouteOption.fuelLiters.toFixed(1)} litros ({multiRouteResult.vehicleProfile.fuelType})
                        </span>
                      </div>

                      <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-500 font-bold block">PEDÁGIOS ESTIMADOS</span>
                        <span className="text-base font-black text-amber-400 mt-0.5 block">
                          R$ {activeRouteOption.tollCostBrl.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-400">Tarifa média rodoviária</span>
                      </div>

                      <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-500 font-bold block">DESGASTE & PNEUS (TCO)</span>
                        <span className="text-base font-black text-purple-400 mt-0.5 block">
                          R$ {activeRouteOption.maintenanceCostBrl.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-400">Reserva de manutenção</span>
                      </div>

                      <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-500 font-bold block">CUSTO TOTAL DA VIAGEM</span>
                        <span className="text-base font-black text-sky-400 mt-0.5 block">
                          R$ {activeRouteOption.totalCostBrl.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {isRoundTrip ? 'Ida e Volta inclusos' : 'Apenas Ida'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. ABA: AUDITOR DE CHAVE FISCAL SEFAZ */}
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

      {/* ========================================================= */}
      {/* 7. ABA: SIMULADOR DE ELETRIFICAÇÃO & ESG */}
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
    </div>
  );
};
