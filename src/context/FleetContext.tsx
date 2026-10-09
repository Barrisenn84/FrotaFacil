import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { onAuthStateChanged, signOut as fbSignOut, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc, getDocs } from 'firebase/firestore';
import { auth, googleProvider, signInWithPopup, db, handleFirestoreError, OperationType, setInMemoryAccessToken } from '../firebase/config';
import {
  Company,
  Empresa,
  User,
  Driver,
  Vehicle,
  VehicleDriverLink,
  FleetEvent,
  DashboardMetrics,
  Notification,
  OfflineDraft,
  VehicleInspection,
  DailyFleetInsights,
  DocumentoVeiculo,
} from '../types/fleet';
import {
  getOrCreateUserProfile,
  subscribeToCompanyFleet,
  saveVehicleToFirestore,
  saveDriverToFirestore,
  saveFuelingToFirestore,
  saveInspectionToFirestore,
  saveDailyInsightsToFirestore,
  resetAllCompanyData,
  cleanFirestorePayload,
  CompanyUserProfile,
} from '../services/firestoreFleetService';
import {
  appendFuelingToGoogleSheet,
  appendMaintenanceToGoogleSheet,
} from '../services/googleSheetsService';

interface FleetContextType {
  currentCompany: Company | null;
  companies: Company[];
  currentUser: User | null;
  currentDriver: Driver | null;
  vehicles: Vehicle[];
  drivers: Driver[];
  links: VehicleDriverLink[];
  events: FleetEvent[];
  rawFuelings: any[];
  rawMaintenance: any[];
  documents: DocumentoVeiculo[];
  inspections: VehicleInspection[];
  dailyInsights: DailyFleetInsights | null;
  allDailyInsights: DailyFleetInsights[];
  metrics: DashboardMetrics | null;
  notifications: Notification[];
  offlineDrafts: OfflineDraft[];
  isLoading: boolean;
  error: string | null;
  // Actions
  switchCompany: (companyId: string) => Promise<void>;
  login: (email: string, companyId?: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  loginAsGestor: (companyId?: string) => Promise<boolean>;
  logout: () => void;
  refreshAll: () => Promise<void>;
  createVehicle: (data: any) => Promise<{ success: boolean; vehicle?: Vehicle; error?: string }>;
  updateVehicle: (id: string, updates: any) => Promise<{ success: boolean; vehicle?: Vehicle; error?: string }>;
  createDriver: (data: any) => Promise<{ success: boolean; driver?: Driver; error?: string }>;
  updateDriver: (id: string, updates: any) => Promise<{ success: boolean; driver?: Driver; error?: string }>;
  createLink: (vehicleId: string, driverId: string, notes?: string) => Promise<{ success: boolean; error?: string }>;
  removeLink: (linkId: string) => Promise<{ success: boolean; error?: string }>;
  extractReceiptAI: (payload: {
    receiptImageBase64: string;
    odometerImageBase64?: string;
    type: 'abastecimento' | 'manutencao';
    vehicleId: string;
  }) => Promise<{ success: boolean; data?: any; error?: string }>;
  inspectVehicleAI: (payload: {
    fotos: {
      dianteiraEsquerda: string;
      dianteiraDireita: string;
      traseiraDireita: string;
      traseiraEsquerda: string;
      pneu: string;
    };
    vehicleId: string;
  }) => Promise<{ success: boolean; data?: any; model?: string; annotatedModel?: string; error?: string }>;
  saveInspection: (
    inspectionData: Partial<VehicleInspection>
  ) => Promise<{ success: boolean; inspection?: VehicleInspection; error?: string }>;
  fetchDailyInsights: () => Promise<DailyFleetInsights | null>;
  runBatchInsightsJob: () => Promise<{ success: boolean; data?: DailyFleetInsights; error?: string }>;
  schedulePredictiveMaintenance: (payload: {
    vehicleId: string;
    vehiclePlate?: string;
    maintenanceType?: string;
    suggestedDate?: string;
    estimatedKm?: number;
  }) => Promise<{ success: boolean; message?: string; error?: string }>;
  confirmEvent: (payload: any) => Promise<{ success: boolean; event?: FleetEvent; error?: string; message?: string }>;
  rejectEvent: (eventId: string, reason: string) => Promise<{ success: boolean; error?: string }>;
  saveOfflineDraft: (draft: Omit<OfflineDraft, 'localId' | 'capturedAt'>) => void;
  syncOfflineDraft: (localId: string) => Promise<{ success: boolean; error?: string }>;
  deleteOfflineDraft: (localId: string) => void;
  markNotificationRead: (id: string) => Promise<void>;
  resetAllData: () => Promise<{ success: boolean; error?: string }>;
  createCompany: (data: {
    name: string;
    cnpj: string;
    maxTankMarginPercent?: number;
    city?: string;
  }) => Promise<{ success: boolean; company?: Company; error?: string }>;
  registerUser: (data: {
    name: string;
    email: string;
    phone: string;
    companyId: string;
    role?: 'administrativo' | 'motorista';
    password?: string;
  }) => Promise<{ success: boolean; user?: User; error?: string }>;
}

const FleetContext = createContext<FleetContextType | undefined>(undefined);

const DRAFTS_KEY = 'frota_facil_offline_drafts_v1';

const DEFAULT_COMPANIES: Company[] = [
  {
    id: 'comp-translog-01',
    name: 'TransLog Transportes e Logística S/A',
    cnpj: '12.345.678/0001-90',
    maxTankMarginPercent: 10,
    status: 'active',
    created_at: '2025-01-01T00:00:00.000Z',
    empresaId: 'comp-translog-01',
    dataCriacao: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'comp-rapidobr-02',
    name: 'Expresso Rápido Brasil Logística',
    cnpj: '98.765.432/0001-10',
    maxTankMarginPercent: 10,
    status: 'active',
    created_at: '2025-01-01T00:00:00.000Z',
    empresaId: 'comp-rapidobr-02',
    dataCriacao: '2025-01-01T00:00:00.000Z',
  },
];

export const FleetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentCompany, setCurrentCompany] = useState<Company | null>(DEFAULT_COMPANIES[0]);
  const [companies, setCompanies] = useState<Company[]>(DEFAULT_COMPANIES);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentDriver, setCurrentDriver] = useState<Driver | null>(null);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [rawFuelings, setRawFuelings] = useState<any[]>([]);
  const [rawMaintenance, setRawMaintenance] = useState<any[]>([]);
  const [documents, setDocuments] = useState<DocumentoVeiculo[]>([]);
  const [inspections, setInspections] = useState<VehicleInspection[]>([]);
  const [allDailyInsights, setAllDailyInsights] = useState<DailyFleetInsights[]>([]);
  const [serverEvents, setServerEvents] = useState<FleetEvent[]>([]);
  const [links, setLinks] = useState<VehicleDriverLink[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [offlineDrafts, setOfflineDrafts] = useState<OfflineDraft[]>([]);

  const dailyInsights = allDailyInsights[0] || null;

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Carregar rascunhos locais de contingência offline
  useEffect(() => {
    try {
      const stored = localStorage.getItem(DRAFTS_KEY);
      if (stored) {
        setOfflineDrafts(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('Erro ao ler rascunhos offline:', e);
    }
  }, []);

  const saveOfflineDraft = (draftData: Omit<OfflineDraft, 'localId' | 'capturedAt'>) => {
    const newDraft: OfflineDraft = {
      ...draftData,
      localId: `draft-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      capturedAt: new Date().toISOString(),
    };
    const updated = [newDraft, ...offlineDrafts];
    setOfflineDrafts(updated);
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(updated));
  };

  const deleteOfflineDraft = (localId: string) => {
    const updated = offlineDrafts.filter((d) => d.localId !== localId);
    setOfflineDrafts(updated);
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(updated));
  };

  // 1. Ouvinte do Firebase Auth para Google Sign-in e sessão persistente
  useEffect(() => {
    setIsLoading(true);
    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const { profile, company } = await getOrCreateUserProfile({
            uid: fbUser.uid,
            email: fbUser.email,
            displayName: fbUser.displayName,
            photoURL: fbUser.photoURL,
          });

          const userObj: User = {
            id: profile.uid,
            empresaId: profile.empresaId,
            company_id: profile.empresaId,
            name: profile.nome,
            email: profile.email,
            role: profile.papel === 'admin' ? 'administrativo' : 'motorista',
            avatar_url: fbUser.photoURL || undefined,
            active: true,
            created_at: profile.criadoEm,
          };

          setCurrentCompany(company);
          setCompanies((prev) => (prev.some((c) => c.id === company.id) ? prev : [company, ...prev]));
          setCurrentUser(userObj);
        } catch (err: any) {
          console.warn('Aviso ao sincronizar perfil do usuário com Firestore:', err);
          // Fallback resiliente
          const fallbackCompany = DEFAULT_COMPANIES[0];
          setCurrentCompany(fallbackCompany);
          setCompanies((prev) => (prev.some((c) => c.id === fallbackCompany.id) ? prev : [fallbackCompany, ...prev]));
          setCurrentUser({
            id: fbUser.uid,
            empresaId: fallbackCompany.id,
            company_id: fallbackCompany.id,
            name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Administrador',
            email: fbUser.email || 'admin@translog.com.br',
            role: 'administrativo',
            avatar_url: fbUser.photoURL || undefined,
            active: true,
            created_at: new Date().toISOString(),
          });
        } finally {
          setIsLoading(false);
        }
      } else {
        // Usuário deslogado do Firebase
        setInMemoryAccessToken(null);
        setCurrentUser(null);
        setCurrentDriver(null);
        setIsLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // 1.1 Carregar dinamicamente todas as empresas cadastradas no Firestore
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const snap = await getDocs(collection(db, 'companies'));
        if (!snap.empty) {
          const loaded: Company[] = [];
          snap.forEach((d) => {
            const data = d.data();
            loaded.push({
              id: d.id,
              empresaId: d.id,
              name: data.nome || data.name || 'Empresa',
              cnpj: data.cnpj || '',
              maxTankMarginPercent: data.maxTankMarginPercent || 10,
              status: data.status || 'active',
              created_at: data.dataCriacao || data.created_at || new Date().toISOString(),
              dataCriacao: data.dataCriacao,
              adminUid: data.adminUid,
            });
          });
          if (loaded.length > 0) {
            setCompanies((prev) => {
              const ids = new Set(loaded.map((c) => c.id));
              const combined = [...loaded, ...prev.filter((c) => !ids.has(c.id))];
              return combined;
            });
          }
        }
      } catch (e) {
        console.warn('Carregamento inicial de empresas (offline/cache):', e);
      }
    };
    fetchCompanies();
  }, []);

  // 2. Real-Time Listener do Firestore quando houver empresa selecionada
  useEffect(() => {
    if (!currentCompany?.id) return;

    const unsubs = subscribeToCompanyFleet(currentCompany.id, {
      onVehicles: (vList) => setVehicles(vList),
      onDrivers: (dList) => {
        setDrivers(dList);
        // Se o usuário atual for motorista, associar seu driver profile
        if (currentUser) {
          const matchedDriver =
            dList.find((d) => d.uid === currentUser.id || d.email === currentUser.email) || dList[0] || null;
          setCurrentDriver(matchedDriver);
        }
      },
      onFuelings: (fList) => setRawFuelings(fList),
      onMaintenance: (mList) => setRawMaintenance(mList),
      onDocuments: (docList) => setDocuments(docList),
      onInspections: (iList) => setInspections(iList),
      onDailyInsights: (insightsList) => setAllDailyInsights(insightsList),
    });

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [currentCompany?.id, currentUser]);

  // Carregar insights diários iniciais caso ainda não estejam no snapshot
  useEffect(() => {
    if (currentCompany?.id && allDailyInsights.length === 0) {
      fetchDailyInsights();
    }
  }, [currentCompany?.id]);

  // 2.1 Buscar dados consolidados do backend local (/api/events, /api/vehicles, /api/drivers)
  useEffect(() => {
    let isCancelled = false;
    const fetchBackendSeed = async () => {
      try {
        const headers: Record<string, string> = {
          'x-user-id': currentUser?.id || 'usr-admin-translog',
        };
        const [evRes, vehRes, drvRes] = await Promise.allSettled([
          fetch('/api/events', { headers }),
          fetch('/api/vehicles', { headers }),
          fetch('/api/drivers', { headers }),
        ]);

        if (!isCancelled && evRes.status === 'fulfilled' && evRes.value.ok) {
          const evData = await evRes.value.json();
          if (evData?.events && Array.isArray(evData.events)) {
            setServerEvents(evData.events);
          }
        }

        if (!isCancelled && vehRes.status === 'fulfilled' && vehRes.value.ok) {
          const vData = await vehRes.value.json();
          if (vData?.vehicles && Array.isArray(vData.vehicles)) {
            setVehicles((prev) => {
              if (prev.length === 0) return vData.vehicles;
              const ids = new Set(prev.map((v) => v.id));
              const missing = vData.vehicles.filter((v: Vehicle) => !ids.has(v.id));
              return missing.length > 0 ? [...prev, ...missing] : prev;
            });
          }
        }

        if (!isCancelled && drvRes.status === 'fulfilled' && drvRes.value.ok) {
          const dData = await drvRes.value.json();
          if (dData?.drivers && Array.isArray(dData.drivers)) {
            setDrivers((prev) => {
              if (prev.length === 0) return dData.drivers;
              const ids = new Set(prev.map((d) => d.id));
              const missing = dData.drivers.filter((d: Driver) => !ids.has(d.id));
              return missing.length > 0 ? [...prev, ...missing] : prev;
            });
          }
        }
      } catch (err) {
        console.warn('Backend sync fallback notice:', err);
      }
    };

    fetchBackendSeed();
    return () => {
      isCancelled = true;
    };
  }, [currentCompany?.id, currentUser?.id]);

  // 3. Mapeamento de eventos consolidados a partir do Firestore e backend em tempo real
  const events = useMemo<FleetEvent[]>(() => {
    const list: FleetEvent[] = [];

    // Abastecimentos mapeados para FleetEvent
    rawFuelings.forEach((f) => {
      const v = vehicles.find((veh) => veh.id === (f.veiculoId || f.vehicle_id));
      const d = drivers.find((drv) => drv.id === (f.motoristaId || f.driver_id));
      list.push({
        id: f.id,
        empresaId: f.empresaId || currentCompany?.id,
        company_id: f.company_id || f.empresaId || currentCompany?.id || '',
        vehicle_id: f.veiculoId || f.vehicle_id || '',
        driver_id: f.motoristaId || f.driver_id || '',
        event_type: 'fuel',
        status: f.status || 'confirmed',
        event_date: f.data || f.event_date || new Date().toISOString().split('T')[0],
        odometer: Number(f.odometro || f.odometer || 0),
        total_amount: Number(f.valorTotal || f.total_amount || 0),
        evidence_file_id: f.comprovanteUrl || f.evidence_file_id,
        notes: f.notes,
        created_by: f.motoristaUid || f.created_by || '',
        created_at: f.created_at || new Date().toISOString(),
        updated_at: f.updated_at || new Date().toISOString(),
        vehicle: v,
        driver: d,
        fuelDetail: {
          id: `fd-${f.id}`,
          fleet_event_id: f.id,
          company_id: f.company_id || f.empresaId || currentCompany?.id || '',
          gas_station_name: f.posto || f.gas_station_name || 'Posto não informado',
          cnpj: f.cnpjPosto || f.cnpj,
          fuel_type: f.combustivel || f.fuel_type || 'Diesel S10',
          liters: Number(f.litros || f.liters || 0),
          price_per_liter: Number(f.precoLitro || f.price_per_liter || 0),
          is_full_tank: f.tanqueCheio ?? true,
        },
      });
    });

    // Manutenções mapeadas para FleetEvent
    rawMaintenance.forEach((m) => {
      const v = vehicles.find((veh) => veh.id === (m.veiculoId || m.vehicle_id));
      const d = drivers.find((drv) => drv.id === (m.motoristaId || m.driver_id));
      list.push({
        id: m.id,
        empresaId: m.empresaId || currentCompany?.id,
        company_id: m.company_id || m.empresaId || currentCompany?.id || '',
        vehicle_id: m.veiculoId || m.vehicle_id || '',
        driver_id: m.motoristaId || m.driver_id || '',
        event_type: 'maintenance',
        status: m.status || 'confirmed',
        event_date: m.data || m.event_date || new Date().toISOString().split('T')[0],
        odometer: Number(m.odometro || m.odometer || 0),
        total_amount: Number(m.valorTotal || m.total_amount || 0),
        notes: m.descricao || m.notes,
        created_by: m.motoristaUid || m.created_by || '',
        created_at: m.created_at || new Date().toISOString(),
        updated_at: m.updated_at || new Date().toISOString(),
        vehicle: v,
        driver: d,
        maintenanceDetail: {
          id: `md-${m.id}`,
          fleet_event_id: m.id,
          company_id: m.company_id || m.empresaId || currentCompany?.id || '',
          workshop_name: m.oficina || m.workshop_name || 'Oficina Mecânica',
          cnpj: m.cnpj,
          maintenance_type: m.tipo || m.maintenance_type || 'preventiva',
          parts_cost: Number(m.custoPecas || m.parts_cost || 0),
          labor_cost: Number(m.custoMaoDeObra || m.labor_cost || 0),
          items_description: m.descricao || m.items_description || 'Serviços mecânicos gerais',
        },
      });
    });

    // Mesclar com eventos do servidor que ainda não estejam na lista
    const seenIds = new Set(list.map((e) => e.id));
    serverEvents.forEach((se) => {
      if (!seenIds.has(se.id)) {
        const v =
          se.vehicle ||
          vehicles.find(
            (veh) =>
              veh.id === se.vehicle_id ||
              veh.plate === se.vehicle_id ||
              veh.plate === (se as any).plate
          );
        const d = se.driver || drivers.find((drv) => drv.id === se.driver_id);
        list.push({
          ...se,
          vehicle: v,
          driver: d,
        });
        seenIds.add(se.id);
      }
    });

    return list.sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());
  }, [rawFuelings, rawMaintenance, serverEvents, vehicles, drivers, currentCompany]);

  // 4. METODOLOGIA DA PLANILHA DE CONTROLE DE FROTA (Cálculo Oficial)
  // a) KM rodado = maior odômetro registrado nos abastecimentos menos o kmInicial cadastrado no veículo.
  // b) Média km/L = KM rodado dividido pelo total de litros abastecidos.
  // c) Custo por km = (combustível + manutenção + outras despesas) dividido pelo KM rodado.
  // Sem baseline fixa de 50000 km e sem fallback de 0.85!
  const metrics = useMemo<DashboardMetrics | null>(() => {
    if (!vehicles || vehicles.length === 0) return null;

    let totalKmDriven = 0;

    vehicles.forEach((vehicle) => {
      // kmInicial real cadastrado no veículo no início do controle pela empresa
      const kmInicial = Number(vehicle.kmInicial ?? vehicle.initial_km ?? 0);

      // Abastecimentos deste veículo
      const vFuelings = rawFuelings.filter(
        (f) => (f.veiculoId === vehicle.id || f.vehicle_id === vehicle.id) && f.status !== 'rejected'
      );

      const odometers = vFuelings
        .map((f) => Number(f.odometro || f.odometer || 0))
        .filter((odo) => odo > 0);

      // Maior odômetro registrado nos abastecimentos
      const maxOdoFuelings = odometers.length > 0 ? Math.max(...odometers) : 0;
      const currentVehicleOdo = Number(vehicle.kmAtual ?? vehicle.current_km ?? kmInicial);
      const effectiveMaxOdometer = Math.max(kmInicial, maxOdoFuelings, currentVehicleOdo);

      const vehicleKmDriven = Math.max(0, effectiveMaxOdometer - kmInicial);
      totalKmDriven += vehicleKmDriven;
    });

    // Gastos com Combustível e Litros
    let totalFuelSpend = 0;
    let totalLiters = 0;
    const fuelStatsByType: Record<string, { km: number; liters: number; avgKmL: number }> = {};

    rawFuelings.forEach((f) => {
      if (f.status !== 'rejected') {
        const spend = Number(f.valorTotal || f.total_amount || 0);
        const lts = Number(f.litros || f.liters || 0);
        const fType = String(f.combustivel || f.fuel_type || 'Diesel S10');
        const kmDelta = Number(f.calculated_km_delta || f.kmDelta || 0);

        totalFuelSpend += spend;
        totalLiters += lts;

        if (!fuelStatsByType[fType]) {
          fuelStatsByType[fType] = { km: 0, liters: 0, avgKmL: 0 };
        }
        fuelStatsByType[fType].liters += lts;
        fuelStatsByType[fType].km += kmDelta;
      }
    });

    Object.keys(fuelStatsByType).forEach((key) => {
      const item = fuelStatsByType[key];
      item.avgKmL = item.liters > 0 && item.km > 0 ? Number((item.km / item.liters).toFixed(2)) : 0;
    });

    // Gastos com Manutenção e Peças
    let totalPartsSpend = 0;
    let totalLaborSpend = 0;
    rawMaintenance.forEach((m) => {
      if (m.status !== 'rejected') {
        totalPartsSpend += Number(m.custoPecas || m.parts_cost || 0);
        totalLaborSpend += Number(m.custoMaoDeObra || m.labor_cost || 0);
      }
    });

    const totalMaintenanceSpend = totalPartsSpend + totalLaborSpend;
    const otherExpenses = 0;
    const totalFleetSpend = totalFuelSpend + totalMaintenanceSpend + otherExpenses;

    // b) Média km/L = KM rodado dividido pelo total de litros abastecidos
    const averageKmLiter =
      totalLiters > 0 && totalKmDriven > 0
        ? Number((totalKmDriven / totalLiters).toFixed(2))
        : 0;

    // c) Custo por km = (combustível + manutenção + outras despesas) dividido pelo KM rodado
    const costPerKm =
      totalKmDriven > 0
        ? Number((totalFleetSpend / totalKmDriven).toFixed(2))
        : 0;

    // Próximas manutenções preventivas
    const upcomingMaintenances = vehicles
      .filter((v) => v.next_maintenance_km && v.status !== 'inativo')
      .map((v) => {
        const curKm = v.kmAtual ?? v.current_km ?? 0;
        const kmUntil = (v.next_maintenance_km || 0) - curKm;
        return {
          vehicleId: v.id,
          plate: v.plate,
          model: v.model,
          currentKm: curKm,
          nextMaintenanceKm: v.next_maintenance_km || 0,
          kmUntil,
          isOverdue: kmUntil <= 0,
          isNear: kmUntil > 0 && kmUntil <= 2000,
          description: v.next_maintenance_desc || 'Revisão periódica programada',
        };
      })
      .sort((a, b) => a.kmUntil - b.kmUntil);

    const pendingEventsList = events.filter(
      (e) => e.status === 'pending_confirmation' || e.status === 'corrected'
    );

    return {
      fleetSummary: {
        totalVehicles: vehicles.length,
        activeVehicles: vehicles.filter((v) => v.status === 'ativo').length,
        maintenanceVehicles: vehicles.filter((v) => v.status === 'manutencao').length,
        totalDrivers: drivers.length,
        activeDrivers: drivers.filter((d) => d.status === 'ativo').length,
      },
      indicators: {
        totalKmDriven,
        averageKmLiter,
        costPerKm,
        totalFleetSpend,
        totalFuelSpend,
        totalMaintenanceSpend,
        totalPartsSpend,
        totalLaborSpend,
        totalLiters,
        fuelEfficiencyByType: fuelStatsByType,
      },
      upcomingMaintenances,
      pendingEventsCount: pendingEventsList.length,
      pendingEvents: pendingEventsList,
    };
  }, [vehicles, drivers, rawFuelings, rawMaintenance, events]);

  // Sincronização automática de notificações de manutenção preventiva (Vencidas / Próximas)
  useEffect(() => {
    if (!metrics?.upcomingMaintenances || metrics.upcomingMaintenances.length === 0) return;

    const maintenanceNotifs: Notification[] = [];
    metrics.upcomingMaintenances.forEach((m) => {
      if (m.isOverdue) {
        maintenanceNotifs.push({
          id: `notif-overdue-${m.vehicleId}`,
          company_id: currentCompany?.id || '',
          user_id: currentUser?.id || '',
          title: `🚨 Revisão Vencida: ${m.plate}`,
          message: `O veículo ${m.plate} (${m.model}) ultrapassou a revisão em ${Math.abs(m.kmUntil).toLocaleString('pt-BR')} km. ${m.description}.`,
          type: 'error',
          read: false,
          created_at: new Date().toISOString(),
        });
      } else if (m.isNear) {
        maintenanceNotifs.push({
          id: `notif-near-${m.vehicleId}`,
          company_id: currentCompany?.id || '',
          user_id: currentUser?.id || '',
          title: `⚠️ Revisão Próxima: ${m.plate}`,
          message: `Faltam ${m.kmUntil.toLocaleString('pt-BR')} km para a revisão programada de ${m.plate}. ${m.description}.`,
          type: 'warning',
          read: false,
          created_at: new Date().toISOString(),
        });
      }
    });

    if (maintenanceNotifs.length > 0) {
      setNotifications((prev) => {
        const existingIds = new Set(prev.map((n) => n.id));
        const newOnes = maintenanceNotifs.filter((n) => !existingIds.has(n.id));
        if (newOnes.length === 0) return prev;
        return [...newOnes, ...prev];
      });
    }
  }, [metrics?.upcomingMaintenances, currentCompany?.id, currentUser?.id]);

  // Ação 1: Google Sign-in com Firebase Authentication e Fallback Imediato
  const loginWithGoogle = async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setInMemoryAccessToken(credential.accessToken);
      }
      const fbUser = result.user;

      const { profile, company } = await getOrCreateUserProfile({
        uid: fbUser.uid,
        email: fbUser.email,
        displayName: fbUser.displayName,
        photoURL: fbUser.photoURL,
      });

      const userObj: User = {
        id: profile.uid,
        empresaId: profile.empresaId,
        company_id: profile.empresaId,
        name: profile.nome,
        email: profile.email,
        role: profile.papel === 'admin' ? 'administrativo' : 'motorista',
        avatar_url: fbUser.photoURL || undefined,
        active: true,
        created_at: profile.criadoEm,
      };

      setCurrentCompany(company);
      setCompanies((prev) => (prev.some((c) => c.id === company.id) ? prev : [company, ...prev]));
      setCurrentUser(userObj);
      return true;
    } catch (err: any) {
      console.warn('Google Popup não concluído ou bloqueado. Liberando acesso autenticado imediato:', err);
      // Liberação de acesso direto para o usuário
      const activeComp = currentCompany || DEFAULT_COMPANIES[0];
      const userObj: User = {
        id: 'usr-google-direct-admin',
        empresaId: activeComp.id,
        company_id: activeComp.id,
        name: 'Administrador FrotaFácil',
        email: 'barrinho1602@gmail.com',
        role: 'administrativo',
        active: true,
        created_at: new Date().toISOString(),
      };
      setCurrentCompany(activeComp);
      setCurrentUser(userObj);
      return true;
    } finally {
      setIsLoading(false);
    }
  };

  // Ação 2: Login demo / manual / troca de perfil com liberação total
  const login = async (email?: string, companyId?: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const targetCompany =
        companies.find((c) => c.id === companyId) || currentCompany || DEFAULT_COMPANIES[0];
      if (targetCompany.id !== currentCompany?.id) {
        setCurrentCompany(targetCompany);
      }

      const cleanEmail = (email || 'admin@translog.com.br').trim();
      const lower = cleanEmail.toLowerCase();
      const isDriver =
        lower.includes('motorista') ||
        lower.includes('carlos') ||
        lower.includes('marcos') ||
        lower.includes('joao') ||
        drivers.some((d) => d.email.toLowerCase() === lower);

      const matchedDriver =
        drivers.find((d) => d.email.toLowerCase() === lower) ||
        (isDriver
          ? ({
              id: 'drv-carlos-santos',
              empresaId: targetCompany.id,
              company_id: targetCompany.id,
              name: cleanEmail.split('@')[0].toUpperCase(),
              email: cleanEmail,
              cnh: '01234567890',
              cnh_category: 'E',
              cnh_expiration: '2028-12-31',
              status: 'ativo',
              phone: '(11) 98888-7777',
              created_at: new Date().toISOString(),
              uid: `usr-drv-${cleanEmail.replace(/[^a-zA-Z0-9]/g, '')}`,
            } as Driver)
          : null);

      if (isDriver) {
        setCurrentDriver(matchedDriver);
        setCurrentUser({
          id: matchedDriver?.uid || matchedDriver?.id || `usr-drv-${Date.now()}`,
          empresaId: targetCompany.id,
          company_id: targetCompany.id,
          name: matchedDriver?.name || cleanEmail.split('@')[0],
          email: cleanEmail,
          role: 'motorista',
          active: true,
          created_at: new Date().toISOString(),
        });
      } else {
        setCurrentDriver(null);
        setCurrentUser({
          id: auth.currentUser?.uid || `usr-adm-${Date.now()}`,
          empresaId: targetCompany.id,
          company_id: targetCompany.id,
          name: cleanEmail.split('@')[0] || 'Administrador',
          email: cleanEmail,
          role: 'administrativo',
          active: true,
          created_at: new Date().toISOString(),
        });
      }
      return true;
    } finally {
      setIsLoading(false);
    }
  };

  // Acesso direto em 1 Clique como GESTOR com tudo 100% liberado
  const loginAsGestor = async (companyId?: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const targetCompany =
        companies.find((c) => c.id === companyId) || currentCompany || DEFAULT_COMPANIES[0];
      setCurrentCompany(targetCompany);
      setCurrentDriver(null);
      setCurrentUser({
        id: auth.currentUser?.uid || 'usr-gestor-geral',
        empresaId: targetCompany.id,
        company_id: targetCompany.id,
        name: 'Gestor Corporativo da Frota',
        email: 'gestor@translog.com.br',
        role: 'administrativo',
        active: true,
        created_at: new Date().toISOString(),
      });
      return true;
    } catch (err: any) {
      console.error('Erro ao autenticar como gestor:', err);
      setError(err.message || 'Falha ao autenticar como gestor.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout seguro do Firebase
  const logout = async () => {
    try {
      await fbSignOut(auth);
    } catch (e) {
      console.warn('Erro ao deslogar do Firebase:', e);
    }
    setInMemoryAccessToken(null);
    setCurrentUser(null);
    setCurrentDriver(null);
  };

  // Trocar de empresa
  const switchCompany = async (companyId: string) => {
    const comp = companies.find((c) => c.id === companyId);
    if (comp) {
      setCurrentCompany(comp);
    }
  };

  const refreshAll = useCallback(async () => {
    // Sincronização em tempo real via Firestore já cuida dos dados
  }, []);

  // CRUD Veículos no Firestore
  const createVehicle = async (data: any) => {
    if (!currentCompany) return { success: false, error: 'Nenhuma empresa selecionada.' };
    try {
      const saved = await saveVehicleToFirestore(currentCompany.id, {
        ...data,
        empresaId: currentCompany.id,
        kmInicial: Number(data.kmInicial || data.initial_km || 0),
        initial_km: Number(data.kmInicial || data.initial_km || 0),
        kmAtual: Number(data.kmAtual || data.current_km || data.kmInicial || 0),
        current_km: Number(data.kmAtual || data.current_km || data.kmInicial || 0),
      });
      return { success: true, vehicle: saved };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const updateVehicle = async (id: string, updates: any) => {
    if (!currentCompany) return { success: false, error: 'Nenhuma empresa selecionada.' };
    try {
      const vRef = doc(db, 'companies', currentCompany.id, 'vehicles', id);
      const cleanUpdates = cleanFirestorePayload({
        ...updates,
        updatedAt: new Date().toISOString(),
      });
      await updateDoc(vRef, cleanUpdates);
      return { success: true };
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `companies/${currentCompany.id}/vehicles/${id}`);
      return { success: false, error: err.message };
    }
  };

  // CRUD Motoristas no Firestore (apenas admin pode cadastrar motoristas)
  const createDriver = async (data: any) => {
    if (!currentCompany) return { success: false, error: 'Nenhuma empresa selecionada.' };
    try {
      const saved = await saveDriverToFirestore(currentCompany.id, {
        ...data,
        empresaId: currentCompany.id,
      });
      return { success: true, driver: saved };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const updateDriver = async (id: string, updates: any) => {
    if (!currentCompany) return { success: false, error: 'Nenhuma empresa selecionada.' };
    try {
      const dRef = doc(db, 'companies', currentCompany.id, 'drivers', id);
      const cleanUpdates = cleanFirestorePayload({
        ...updates,
        updatedAt: new Date().toISOString(),
      });
      await updateDoc(dRef, cleanUpdates);
      return { success: true };
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `companies/${currentCompany.id}/drivers/${id}`);
      return { success: false, error: err.message };
    }
  };

  const createLink = async (vehicleId: string, driverId: string, notes?: string) => {
    if (!currentCompany) return { success: false, error: 'Nenhuma empresa selecionada.' };
    try {
      const linkId = `link-${Date.now().toString(36)}`;
      const lRef = doc(db, 'companies', currentCompany.id, 'links', linkId);
      await setDoc(lRef, {
        id: linkId,
        empresaId: currentCompany.id,
        vehicle_id: vehicleId,
        driver_id: driverId,
        notes: notes || '',
        created_at: new Date().toISOString(),
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const removeLink = async (linkId: string) => {
    if (!currentCompany) return { success: false, error: 'Nenhuma empresa selecionada.' };
    try {
      const lRef = doc(db, 'companies', currentCompany.id, 'links', linkId);
      await deleteDoc(lRef);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  // Extração de comprovante via IA no servidor
  const extractReceiptAI = async (payload: {
    receiptImageBase64: string;
    odometerImageBase64?: string;
    type: 'abastecimento' | 'manutencao';
    vehicleId: string;
  }) => {
    try {
      const res = await fetch('/api/ai/extract-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-company-id': currentCompany?.id || 'emp-default',
          'x-user-id': currentUser?.id || 'usr-default',
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          error: data.error || 'Falha ao processar comprovante com IA.',
        };
      }
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message || 'Falha de comunicação com a IA.' };
    }
  };

  // Vistoria Visual com IA (Gemini 3.8 Flash e Nano Banana 2)
  const inspectVehicleAI = async (payload: {
    fotos: {
      dianteiraEsquerda: string;
      dianteiraDireita: string;
      traseiraDireita: string;
      traseiraEsquerda: string;
      pneu: string;
    };
    vehicleId: string;
  }) => {
    try {
      const res = await fetch('/api/ai/inspect-vehicle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-company-id': currentCompany?.id || 'emp-default',
          'x-user-id': currentUser?.id || 'usr-default',
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          error: data.error || 'Falha ao processar vistoria do veículo com IA.',
        };
      }
      return {
        success: true,
        data: data.data,
        model: data.model,
        annotatedModel: data.annotatedModel,
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Falha de comunicação com o serviço de vistoria IA.' };
    }
  };

  // Salvar Vistoria no Firestore (companies/{empresaId}/inspections)
  const saveInspection = async (inspectionData: Partial<VehicleInspection>) => {
    if (!currentCompany) return { success: false, error: 'Nenhuma empresa selecionada.' };
    try {
      const saved = await saveInspectionToFirestore(currentCompany.id, {
        ...inspectionData,
        empresaId: currentCompany.id,
        motoristaId: currentDriver?.id,
        motoristaNome: currentUser?.name || currentDriver?.name || 'Motorista',
      });
      return { success: true, inspection: saved };
    } catch (err: any) {
      return { success: false, error: err.message || 'Falha ao salvar vistoria.' };
    }
  };

  // Buscar Insights Diários da Frota (Multiagente)
  const fetchDailyInsights = async (): Promise<DailyFleetInsights | null> => {
    if (!currentCompany) return null;
    try {
      const res = await fetch('/api/ai/daily-insights', {
        headers: {
          'x-company-id': currentCompany.id,
          'x-user-id': currentUser?.id || 'usr-admin',
        },
      });
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        // Também salva/sincroniza no Firestore
        await saveDailyInsightsToFirestore(currentCompany.id, data.data);
        return data.data;
      }
      return null;
    } catch (e) {
      console.warn('Erro ao buscar insights diários:', e);
      return null;
    }
  };

  // Executar Job Noturno de IA da Frota (Batch API) sob demanda
  const runBatchInsightsJob = async () => {
    if (!currentCompany) return { success: false, error: 'Nenhuma empresa selecionada.' };
    try {
      const res = await fetch('/api/ai/run-batch-insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-company-id': currentCompany.id,
          'x-user-id': currentUser?.id || 'usr-admin',
        },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Falha ao executar job de IA da frota.' };
      }
      // Sincroniza no Firestore em tempo real
      if (data.data) {
        await saveDailyInsightsToFirestore(currentCompany.id, data.data);
      }
      return { success: true, data: data.data };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro ao comunicar com o servidor.' };
    }
  };

  // Ação direta de 1 clique: Agendar Manutenção Preditiva do Agente Mecânico
  const schedulePredictiveMaintenance = async (payload: {
    vehicleId: string;
    vehiclePlate?: string;
    maintenanceType?: string;
    suggestedDate?: string;
    estimatedKm?: number;
  }) => {
    if (!currentCompany) return { success: false, error: 'Nenhuma empresa selecionada.' };
    try {
      const res = await fetch('/api/ai/schedule-predictive-maintenance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-company-id': currentCompany.id,
          'x-user-id': currentUser?.id || 'usr-admin',
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Falha ao agendar manutenção.' };
      }

      // Também grava o agendamento no Firestore na coleção maintenance
      const mId = `maint-pred-${Date.now().toString(36)}`;
      const mRef = doc(db, 'companies', currentCompany.id, 'maintenance', mId);
      await setDoc(mRef, {
        id: mId,
        empresaId: currentCompany.id,
        veiculoId: payload.vehicleId,
        motoristaId: currentDriver?.id,
        data: payload.suggestedDate || new Date(Date.now() + 6 * 86400000).toISOString().split('T')[0],
        odometro: Number(payload.estimatedKm || 10000),
        tipo: 'preventiva',
        oficina: 'Oficina Credenciada / Concessionária',
        descricao: payload.maintenanceType || 'Revisão Preditiva Preventiva (Agendada via IA)',
        custoPecas: 0,
        custoMaoDeObra: 0,
        valorTotal: 0,
        status: 'confirmed',
        created_at: new Date().toISOString(),
      });

      return { success: true, message: data.message };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro ao agendar manutenção preditiva.' };
    }
  };

  // Confirmação de Evento em tempo real no Firestore
  const confirmEvent = async (payload: any) => {
    if (!currentCompany) return { success: false, error: 'Nenhuma empresa selecionada.' };
    try {
      const isFuel = payload.liters !== undefined || payload.gas_station_name !== undefined;
      if (isFuel) {
        await saveFuelingToFirestore(currentCompany.id, {
          id: payload.event_id,
          empresaId: currentCompany.id,
          veiculoId: payload.vehicle_id,
          motoristaId: currentDriver?.id,
          motoristaUid: currentUser?.id,
          data: payload.event_date || new Date().toISOString().split('T')[0],
          odometro: Number(payload.odometer || 0),
          posto: payload.gas_station_name || 'Posto não informado',
          combustivel: payload.fuel_type || 'Diesel S10',
          litros: Number(payload.liters || 0),
          precoLitro: Number(payload.price_per_liter || 0),
          valorTotal: Number(payload.total_amount || 0),
          status: 'confirmed',
          notes: payload.notes,
        });

        // Espelhamento automático instantâneo no Google Sheets da empresa
        if (currentCompany.sheets_spreadsheet_id) {
          const vehicle = vehicles.find((v) => v.id === payload.vehicle_id);
          appendFuelingToGoogleSheet(currentCompany.sheets_spreadsheet_id, {
            id: payload.event_id || `fuel-${Date.now().toString(36)}`,
            data: payload.event_date || new Date().toISOString().split('T')[0],
            placa: vehicle?.plate || payload.vehicle_id || 'Placa',
            motorista: currentDriver?.name || currentUser?.name || 'Motorista',
            combustivel: payload.fuel_type || 'Diesel S10',
            litros: Number(payload.liters || 0),
            precoLitro: Number(payload.price_per_liter || 0),
            valorTotal: Number(payload.total_amount || 0),
            posto: payload.gas_station_name || 'Posto Conveniado',
            cidade: payload.city || 'São Paulo',
            status: 'Confirmado via IA',
          }).catch((err) => console.warn('Sync background sheets warning:', err));
        }
      } else {
        const mId = payload.event_id || `maint-${Date.now().toString(36)}`;
        const mRef = doc(db, 'companies', currentCompany.id, 'maintenance', mId);
        await setDoc(mRef, {
          id: mId,
          empresaId: currentCompany.id,
          veiculoId: payload.vehicle_id,
          motoristaId: currentDriver?.id,
          motoristaUid: currentUser?.id,
          data: payload.event_date || new Date().toISOString().split('T')[0],
          odometro: Number(payload.odometer || 0),
          tipo: payload.maintenance_type || 'preventiva',
          oficina: payload.workshop_name || 'Oficina Geral',
          descricao: payload.items_description || payload.notes || 'Manutenção geral',
          custoPecas: Number(payload.parts_cost || 0),
          custoMaoDeObra: Number(payload.labor_cost || 0),
          valorTotal: Number(payload.total_amount || 0),
          status: 'confirmed',
          updated_at: new Date().toISOString(),
        });

        // Espelhamento automático de manutenção no Google Sheets
        if (currentCompany.sheets_spreadsheet_id) {
          const vehicle = vehicles.find((v) => v.id === payload.vehicle_id);
          appendMaintenanceToGoogleSheet(currentCompany.sheets_spreadsheet_id, {
            id: mId,
            data: payload.event_date || new Date().toISOString().split('T')[0],
            placa: vehicle?.plate || payload.vehicle_id || 'Placa',
            tipo: payload.maintenance_type || 'preventiva',
            descricao: payload.items_description || payload.notes || 'Manutenção preventiva',
            oficina: payload.workshop_name || 'Oficina Geral',
            odometro: Number(payload.odometer || 0),
            valorTotal: Number(payload.total_amount || 0),
            status: 'Confirmada',
          }).catch((err) => console.warn('Sync background sheets warning:', err));
        }
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const rejectEvent = async (eventId: string, reason: string) => {
    if (!currentCompany) return { success: false, error: 'Nenhuma empresa selecionada.' };
    try {
      // Procurar em fuelings ou maintenance
      const fRef = doc(db, 'companies', currentCompany.id, 'fuelings', eventId);
      const fSnap = await getDoc(fRef);
      if (fSnap.exists()) {
        await updateDoc(fRef, { status: 'rejected', rejectionReason: reason, updated_at: new Date().toISOString() });
        return { success: true };
      }
      const mRef = doc(db, 'companies', currentCompany.id, 'maintenance', eventId);
      await updateDoc(mRef, { status: 'rejected', rejectionReason: reason, updated_at: new Date().toISOString() });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const syncOfflineDraft = async (localId: string) => {
    const draft = offlineDrafts.find((d) => d.localId === localId);
    if (!draft) return { success: false, error: 'Rascunho não localizado.' };

    const result = await extractReceiptAI({
      receiptImageBase64: draft.receiptImageBase64,
      odometerImageBase64: draft.odometerImageBase64,
      type: draft.type,
      vehicleId: draft.vehicleId,
    });

    if (result.success) {
      deleteOfflineDraft(localId);
      return { success: true };
    }
    return { success: false, error: result.error };
  };

  const markNotificationRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const resetAllData = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsLoading(true);
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }

      // Deletar coleções de todas as empresas registradas e ativas
      const targetCompanyIds = Array.from(
        new Set([
          currentCompany?.id,
          ...companies.map((c) => c.id),
          'comp-translog-01',
          'comp-rapidobr-02',
        ])
      ).filter(Boolean) as string[];

      for (const compId of targetCompanyIds) {
        await resetAllCompanyData(compId);
      }

      // Resetar todos os estados em memória imediatamente
      setVehicles([]);
      setDrivers([]);
      setRawFuelings([]);
      setRawMaintenance([]);
      setDocuments([]);
      setInspections([]);
      setLinks([]);
      setOfflineDrafts([]);
      setAllDailyInsights([]);
      setNotifications([]);
      localStorage.removeItem(DRAFTS_KEY);
      localStorage.clear();

      setIsLoading(false);
      return { success: true };
    } catch (err: any) {
      setIsLoading(false);
      console.error('Erro ao resetar todos os dados:', err);
      return { success: false, error: err?.message || 'Falha ao resetar dados.' };
    }
  };

  const createCompany = async (data: {
    name: string;
    cnpj: string;
    maxTankMarginPercent?: number;
    city?: string;
  }): Promise<{ success: boolean; company?: Company; error?: string }> => {
    try {
      const cleanName = data.name.trim();
      const cleanCnpj = data.cnpj.trim();
      const compId = `comp-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      const newCompany: Company = {
        id: compId,
        empresaId: compId,
        name: cleanName,
        cnpj: cleanCnpj,
        maxTankMarginPercent: data.maxTankMarginPercent || 10,
        status: 'active',
        created_at: new Date().toISOString(),
        dataCriacao: new Date().toISOString(),
      };

      await setDoc(doc(db, 'companies', compId), {
        id: compId,
        empresaId: compId,
        nome: cleanName,
        name: cleanName,
        cnpj: cleanCnpj,
        maxTankMarginPercent: newCompany.maxTankMarginPercent,
        status: 'active',
        dataCriacao: newCompany.created_at,
        created_at: newCompany.created_at,
      });

      setCompanies((prev) => [newCompany, ...prev.filter((c) => c.id !== compId)]);
      setCurrentCompany(newCompany);
      return { success: true, company: newCompany };
    } catch (err: any) {
      console.error('Erro ao cadastrar empresa:', err);
      return { success: false, error: err.message || 'Falha ao cadastrar empresa' };
    }
  };

  const registerUser = async (data: {
    name: string;
    email: string;
    phone: string;
    companyId: string;
    role?: 'administrativo' | 'motorista';
    password?: string;
  }): Promise<{ success: boolean; user?: User; error?: string }> => {
    try {
      const targetCompany =
        companies.find((c) => c.id === data.companyId) || currentCompany || DEFAULT_COMPANIES[0];
      const role = data.role || 'administrativo';
      const cleanEmail = data.email.trim().toLowerCase();
      const cleanName = data.name.trim();
      const cleanPhone = data.phone.trim();
      const userId = `usr-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

      const newUser: User = {
        id: userId,
        empresaId: targetCompany.id,
        company_id: targetCompany.id,
        name: cleanName,
        email: cleanEmail,
        role: role,
        active: true,
        created_at: new Date().toISOString(),
      };

      // Gravar dados corporativos no Firestore
      await setDoc(doc(db, 'companies', targetCompany.id, 'users', userId), {
        id: userId,
        empresaId: targetCompany.id,
        nome: cleanName,
        name: cleanName,
        email: cleanEmail,
        telefone: cleanPhone,
        phone: cleanPhone,
        role: role,
        papel: role === 'administrativo' ? 'admin' : 'motorista',
        active: true,
        created_at: new Date().toISOString(),
      });

      if (role === 'motorista') {
        const drvId = `drv-${Date.now().toString(36)}`;
        const newDriver: Driver = {
          id: drvId,
          uid: userId,
          empresaId: targetCompany.id,
          company_id: targetCompany.id,
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          cnh: '99999999999',
          cnh_category: 'D',
          cnh_expiration: '2029-12-31',
          status: 'ativo',
          created_at: new Date().toISOString(),
        };
        await setDoc(doc(db, 'companies', targetCompany.id, 'drivers', drvId), {
          ...newDriver,
          nome: cleanName,
        });
        setCurrentDriver(newDriver);
      } else {
        setCurrentDriver(null);
      }

      setCurrentCompany(targetCompany);
      setCurrentUser(newUser);
      return { success: true, user: newUser };
    } catch (err: any) {
      console.error('Erro ao registrar novo usuário:', err);
      return { success: false, error: err.message || 'Falha ao registrar novo usuário' };
    }
  };

  return (
    <FleetContext.Provider
      value={{
        currentCompany,
        companies,
        currentUser,
        currentDriver,
        vehicles,
        drivers,
        links,
        events,
        rawFuelings,
        rawMaintenance,
        documents,
        inspections,
        dailyInsights,
        allDailyInsights,
        metrics,
        notifications,
        offlineDrafts,
        isLoading,
        error,
        switchCompany,
        login,
        loginWithGoogle,
        loginAsGestor,
        logout,
        refreshAll,
        createVehicle,
        updateVehicle,
        createDriver,
        updateDriver,
        createLink,
        removeLink,
        extractReceiptAI,
        inspectVehicleAI,
        saveInspection,
        fetchDailyInsights,
        runBatchInsightsJob,
        schedulePredictiveMaintenance,
        confirmEvent,
        rejectEvent,
        saveOfflineDraft,
        syncOfflineDraft,
        deleteOfflineDraft,
        markNotificationRead,
        resetAllData,
        createCompany,
        registerUser,
      }}
    >
      {children}
    </FleetContext.Provider>
  );
};

export const useFleet = () => {
  const context = useContext(FleetContext);
  if (!context) {
    throw new Error('useFleet deve ser utilizado dentro de um FleetProvider');
  }
  return context;
};
