import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  Unsubscribe,
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase/config';
import {
  Company,
  Empresa,
  User,
  Driver,
  Vehicle,
  VehicleDriverLink,
  FleetEvent,
  Abastecimento,
  Manutencao,
  Multa,
  Seguro,
  DocumentoVeiculo,
  Notification,
  VehicleInspection,
  DailyFleetInsights,
} from '../types/fleet';

export const LOCALSTORAGE_PREFIX = 'frotafacil_data_v1_';

export interface CompanyUserProfile {
  uid: string;
  email: string;
  nome: string;
  empresaId: string;
  papel: 'admin' | 'motorista';
  criadoEm: string;
}

// 1. Obter ou Criar Perfil de Usuário e Empresa no Primeiro Login Google
export async function getOrCreateUserProfile(firebaseUser: {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
}): Promise<{ profile: CompanyUserProfile; company: Company; isNewAdmin: boolean }> {
  const empresaId = `emp-${firebaseUser.uid.substring(0, 8)}`;
  const defaultProfile: CompanyUserProfile = {
    uid: firebaseUser.uid,
    email: firebaseUser.email || '',
    nome: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Gestor Corporativo',
    empresaId,
    papel: 'admin',
    criadoEm: new Date().toISOString(),
  };

  const defaultCompany: Company = {
    id: empresaId,
    name: 'TransLog Transportes e Logística S/A',
    cnpj: '12.345.678/0001-90',
    maxTankMarginPercent: 10,
    status: 'active',
    created_at: new Date().toISOString(),
    empresaId,
    dataCriacao: new Date().toISOString(),
    adminUid: firebaseUser.uid,
  };

  const userDocRef = doc(db, 'users', firebaseUser.uid);
  try {
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      const profile = snap.data() as CompanyUserProfile;
      const targetEmpresaId = profile.empresaId || empresaId;
      const companyDocRef = doc(db, 'companies', targetEmpresaId);
      let company: Company;
      try {
        const compSnap = await getDoc(companyDocRef);
        if (compSnap.exists()) {
          const cData = compSnap.data() as any;
          company = {
            id: targetEmpresaId,
            name: cData.nome || cData.name || 'TransLog Transportes',
            cnpj: cData.cnpj || '12.345.678/0001-90',
            maxTankMarginPercent: cData.maxTankMarginPercent || 10,
            status: cData.status || 'active',
            created_at: cData.dataCriacao || cData.created_at || new Date().toISOString(),
            empresaId: targetEmpresaId,
            dataCriacao: cData.dataCriacao,
            adminUid: cData.adminUid,
            sheets_spreadsheet_id: cData.sheets_spreadsheet_id,
            sheets_spreadsheet_url: cData.sheets_spreadsheet_url,
            sheets_synced_at: cData.sheets_synced_at,
          };
        } else {
          company = { ...defaultCompany, id: targetEmpresaId, empresaId: targetEmpresaId };
          setDoc(companyDocRef, {
            id: targetEmpresaId,
            nome: company.name,
            cnpj: company.cnpj,
            dataCriacao: company.created_at,
            adminUid: firebaseUser.uid,
            status: 'active',
          }).catch(() => {});
        }
      } catch {
        company = { ...defaultCompany, id: targetEmpresaId, empresaId: targetEmpresaId };
      }
      return { profile, company, isNewAdmin: false };
    }

    // Primeiro usuário com Google Sign-In vira admin da própria empresa
    // Gravar empresa e perfil de forma não bloqueante
    setDoc(doc(db, 'companies', empresaId), {
      id: empresaId,
      nome: defaultCompany.name,
      cnpj: defaultCompany.cnpj,
      dataCriacao: defaultCompany.created_at,
      adminUid: firebaseUser.uid,
      status: 'active',
      maxTankMarginPercent: 10,
    }).catch((e) => console.warn('Offline/pending write for company:', e));

    setDoc(userDocRef, defaultProfile).catch((e) => console.warn('Offline/pending write for user:', e));

    // Executar migração do localStorage na primeira sessão autenticada em background
    migrateLocalStorageToFirestore(empresaId, firebaseUser.uid).catch(() => {});

    return { profile: defaultProfile, company: defaultCompany, isNewAdmin: true };
  } catch (error: any) {
    console.warn('Recuperação offline para perfil de usuário:', error?.message || error);
    // Em caso de "client is offline" ou erro transitório, retornar perfil e empresa padrão
    return { profile: defaultProfile, company: defaultCompany, isNewAdmin: false };
  }
}

// 2. Migração de dados do localStorage para o Firestore
export async function migrateLocalStorageToFirestore(empresaId: string, adminUid: string): Promise<void> {
  try {
    // 1. Procurar chaves com prefixo frotafacil_data_v1_
    const rawVehicles = localStorage.getItem(`${LOCALSTORAGE_PREFIX}vehicles`);
    const rawDrivers = localStorage.getItem(`${LOCALSTORAGE_PREFIX}drivers`);
    const rawFuelings = localStorage.getItem(`${LOCALSTORAGE_PREFIX}fuelings`);
    const rawEvents = localStorage.getItem(`${LOCALSTORAGE_PREFIX}events`);

    let vehiclesToSeed: Vehicle[] = [];
    if (rawVehicles) {
      try {
        vehiclesToSeed = JSON.parse(rawVehicles);
      } catch (e) {
        console.warn('Erro ao decodificar veículos do localStorage:', e);
      }
    }

    // Se o localStorage estava vazio, não semear dados falsos - manter banco 100% real
    if (!vehiclesToSeed || vehiclesToSeed.length === 0) {
      return;
    }

    // Gravar veículos no Firestore
    for (const v of vehiclesToSeed) {
      const vRef = doc(db, 'companies', empresaId, 'vehicles', v.id);
      await setDoc(vRef, {
        ...v,
        empresaId,
        company_id: empresaId,
        kmInicial: v.kmInicial ?? v.initial_km ?? 0,
        initial_km: v.kmInicial ?? v.initial_km ?? 0,
        kmAtual: v.kmAtual ?? v.current_km ?? 0,
        current_km: v.kmAtual ?? v.current_km ?? 0,
        updatedAt: new Date().toISOString(),
      });
    }

    // 2. Motoristas
    let driversToSeed: Driver[] = [];
    if (rawDrivers) {
      try {
        driversToSeed = JSON.parse(rawDrivers);
      } catch (e) {
        console.warn('Erro ao decodificar motoristas do localStorage:', e);
      }
    }

    if (driversToSeed && driversToSeed.length > 0) {
      for (const d of driversToSeed) {
        const dRef = doc(db, 'companies', empresaId, 'drivers', d.id);
        await setDoc(dRef, {
          ...d,
          empresaId,
          company_id: empresaId,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    // Limpar chaves antigas do localStorage conforme requisito estrito:
    // "Depois disso o localStorage deixa de ser fonte de verdade."
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(LOCALSTORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    console.log(`✅ Migração multi-empresa concluída para Firestore da empresa: ${empresaId}`);
  } catch (error) {
    console.error('Erro na migração de dados para Firestore:', error);
  }
}

// 3. Assinatura em Tempo Real das Subcoleções da Empresa
export function subscribeToCompanyFleet(
  empresaId: string,
  callbacks: {
    onVehicles: (vehicles: Vehicle[]) => void;
    onDrivers: (drivers: Driver[]) => void;
    onFuelings: (fuelings: any[]) => void;
    onMaintenance: (maint: any[]) => void;
    onFines?: (fines: Multa[]) => void;
    onInsurances?: (insurances: Seguro[]) => void;
    onDocuments?: (docs: DocumentoVeiculo[]) => void;
    onInspections?: (inspections: VehicleInspection[]) => void;
    onDailyInsights?: (insights: DailyFleetInsights[]) => void;
  }
): Unsubscribe[] {
  const unsubs: Unsubscribe[] = [];

  // Veículos em tempo real
  const vehCol = collection(db, 'companies', empresaId, 'vehicles');
  unsubs.push(
    onSnapshot(
      vehCol,
      (snapshot) => {
        const vehicles: Vehicle[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            empresaId: data.empresaId || empresaId,
            company_id: data.company_id || empresaId,
            plate: data.plate || data.placa || '',
            chassi: data.chassi || '',
            renavam: data.renavam || '',
            make: data.make || data.marca || '',
            model: data.model || data.modelo || '',
            year: data.year || data.ano || 2023,
            fuel_type: data.fuel_type || data.combustivel || 'Diesel S10',
            tank_capacity_liters: data.tank_capacity_liters || data.capacidadeTanque || 500,
            kmInicial: data.kmInicial ?? data.initial_km ?? 0,
            initial_km: data.kmInicial ?? data.initial_km ?? 0,
            kmAtual: data.kmAtual ?? data.current_km ?? 0,
            current_km: data.kmAtual ?? data.current_km ?? 0,
            status: data.status || 'ativo',
            motoristaAtualId: data.motoristaAtualId,
            next_maintenance_km: data.next_maintenance_km,
            next_maintenance_desc: data.next_maintenance_desc,
            created_at: data.created_at || data.criadoEm || new Date().toISOString(),
          } as Vehicle;
        });
        callbacks.onVehicles(vehicles);
      },
      (error) => handleFirestoreError(error, OperationType.GET, `companies/${empresaId}/vehicles`)
    )
  );

  // Motoristas em tempo real
  const drvCol = collection(db, 'companies', empresaId, 'drivers');
  unsubs.push(
    onSnapshot(
      drvCol,
      (snapshot) => {
        const drivers: Driver[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            empresaId: data.empresaId || empresaId,
            company_id: data.company_id || empresaId,
            uid: data.uid,
            user_id: data.user_id,
            name: data.name || data.nome || '',
            email: data.email || '',
            phone: data.phone || data.telefone || '',
            cnh: data.cnh || '',
            cnh_category: data.cnh_category || data.categoriaCnh || 'D',
            cnh_expiration: data.cnh_expiration || data.validadeCnh || '',
            status: data.status || 'ativo',
            veiculosAutorizados: data.veiculosAutorizados || [],
            created_at: data.created_at || data.criadoEm || new Date().toISOString(),
          } as Driver;
        });
        callbacks.onDrivers(drivers);
      },
      (error) => handleFirestoreError(error, OperationType.GET, `companies/${empresaId}/drivers`)
    )
  );

  // Abastecimentos em tempo real (fuelings)
  const fuelCol = collection(db, 'companies', empresaId, 'fuelings');
  unsubs.push(
    onSnapshot(
      fuelCol,
      (snapshot) => {
        const fuelings = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        callbacks.onFuelings(fuelings);
      },
      (error) => handleFirestoreError(error, OperationType.GET, `companies/${empresaId}/fuelings`)
    )
  );

  // Manutenções em tempo real (maintenance)
  const maintCol = collection(db, 'companies', empresaId, 'maintenance');
  unsubs.push(
    onSnapshot(
      maintCol,
      (snapshot) => {
        const maint = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        callbacks.onMaintenance(maint);
      },
      (error) => handleFirestoreError(error, OperationType.GET, `companies/${empresaId}/maintenance`)
    )
  );

  // Multas
  if (callbacks.onFines) {
    const finesCol = collection(db, 'companies', empresaId, 'fines');
    unsubs.push(
      onSnapshot(
        finesCol,
        (snapshot) => {
          const fines = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          })) as Multa[];
          callbacks.onFines!(fines);
        },
        (error) => handleFirestoreError(error, OperationType.GET, `companies/${empresaId}/fines`)
      )
    );
  }

  // Seguros
  if (callbacks.onInsurances) {
    const insurancesCol = collection(db, 'companies', empresaId, 'insurances');
    unsubs.push(
      onSnapshot(
        insurancesCol,
        (snapshot) => {
          const ins = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          })) as Seguro[];
          callbacks.onInsurances!(ins);
        },
        (error) => handleFirestoreError(error, OperationType.GET, `companies/${empresaId}/insurances`)
      )
    );
  }

  // Documentos
  if (callbacks.onDocuments) {
    const docsCol = collection(db, 'companies', empresaId, 'documents');
    unsubs.push(
      onSnapshot(
        docsCol,
        (snapshot) => {
          const docs = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          })) as DocumentoVeiculo[];
          callbacks.onDocuments!(docs);
        },
        (error) => handleFirestoreError(error, OperationType.GET, `companies/${empresaId}/documents`)
      )
    );
  }

  // Vistorias Visuais com IA (inspections)
  if (callbacks.onInspections) {
    const inspCol = collection(db, 'companies', empresaId, 'inspections');
    unsubs.push(
      onSnapshot(
        inspCol,
        (snapshot) => {
          const inspections = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          })) as VehicleInspection[];
          // Ordenar pelas mais recentes primeiro
          inspections.sort(
            (a, b) => new Date(b.created_at || b.data).getTime() - new Date(a.created_at || a.data).getTime()
          );
          callbacks.onInspections!(inspections);
        },
        (error) => handleFirestoreError(error, OperationType.GET, `companies/${empresaId}/inspections`)
      )
    );
  }

  // Insights Noturnos Multiagente (dailyInsights)
  if (callbacks.onDailyInsights) {
    const insightsCol = collection(db, 'companies', empresaId, 'dailyInsights');
    unsubs.push(
      onSnapshot(
        insightsCol,
        (snapshot) => {
          const insightsList = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          })) as DailyFleetInsights[];
          insightsList.sort(
            (a, b) => new Date(b.generatedAt || b.date).getTime() - new Date(a.generatedAt || a.date).getTime()
          );
          callbacks.onDailyInsights!(insightsList);
        },
        (error) => handleFirestoreError(error, OperationType.GET, `companies/${empresaId}/dailyInsights`)
      )
    );
  }

  return unsubs;
}

/**
 * Remove recursivamente todas as propriedades com valor 'undefined' de qualquer objeto
 * para evitar rejeição estrita do Firebase Firestore ("Unsupported field value: undefined").
 */
export function cleanFirestorePayload<T extends Record<string, any>>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) =>
        typeof item === 'object' && item !== null && !(item instanceof Date)
          ? cleanFirestorePayload(item)
          : item
      ) as any;
  }
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue;
    }
    if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
      cleaned[key] = cleanFirestorePayload(value);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned as T;
}

// 4. Operações de Escrita no Firestore por Empresa
export async function saveVehicleToFirestore(empresaId: string, vehicle: Partial<Vehicle>): Promise<Vehicle> {
  const vId = vehicle.id || `veh-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  const kmInit = Number(vehicle.kmInicial ?? vehicle.initial_km ?? 0);
  const kmNow = Number(vehicle.kmAtual ?? vehicle.current_km ?? kmInit);

  const rawPayload: Record<string, any> = {
    id: vId,
    empresaId,
    company_id: empresaId,
    plate: (vehicle.plate || '').trim().toUpperCase(),
    chassi: (vehicle.chassi || '').trim(),
    renavam: (vehicle.renavam || '').trim(),
    make: (vehicle.make || '').trim(),
    model: (vehicle.model || '').trim(),
    year: Number(vehicle.year || new Date().getFullYear()),
    fuel_type: vehicle.fuel_type || 'Diesel S10',
    tank_capacity_liters: Number(vehicle.tank_capacity_liters || 500),
    kmInicial: kmInit,
    initial_km: kmInit,
    kmAtual: kmNow,
    current_km: kmNow,
    status: vehicle.status || 'ativo',
    created_at: vehicle.created_at || new Date().toISOString(),
  };

  if (vehicle.motoristaAtualId) {
    rawPayload.motoristaAtualId = vehicle.motoristaAtualId;
  }
  if (vehicle.next_maintenance_km !== undefined && vehicle.next_maintenance_km !== null) {
    rawPayload.next_maintenance_km = Number(vehicle.next_maintenance_km);
  }
  if (vehicle.next_maintenance_desc) {
    rawPayload.next_maintenance_desc = vehicle.next_maintenance_desc;
  }

  const payload = cleanFirestorePayload(rawPayload) as Vehicle;
  const vRef = doc(db, 'companies', empresaId, 'vehicles', vId);
  try {
    await setDoc(vRef, payload, { merge: true });
    return payload;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `companies/${empresaId}/vehicles/${vId}`);
    throw err;
  }
}

export async function saveDriverToFirestore(empresaId: string, driver: Partial<Driver>): Promise<Driver> {
  const dId = driver.id || `drv-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  const rawPayload: Record<string, any> = {
    id: dId,
    empresaId,
    company_id: empresaId,
    name: (driver.name || '').trim(),
    email: (driver.email || '').trim().toLowerCase(),
    phone: (driver.phone || '').trim(),
    cnh: (driver.cnh || '').trim(),
    cnh_category: driver.cnh_category || 'D',
    cnh_expiration: driver.cnh_expiration || '',
    status: driver.status || 'ativo',
    veiculosAutorizados: driver.veiculosAutorizados || [],
    created_at: driver.created_at || new Date().toISOString(),
  };

  if (driver.uid) rawPayload.uid = driver.uid;
  if (driver.user_id) rawPayload.user_id = driver.user_id;

  const payload = cleanFirestorePayload(rawPayload) as Driver;
  const dRef = doc(db, 'companies', empresaId, 'drivers', dId);
  try {
    await setDoc(dRef, payload, { merge: true });
    return payload;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `companies/${empresaId}/drivers/${dId}`);
    throw err;
  }
}

export async function saveFuelingToFirestore(empresaId: string, fueling: any): Promise<any> {
  const fId = fueling.id || `fuel-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  const odoNumber = Number(fueling.odometer || fueling.odometro || 0);

  // Validação estrita de odômetro crescente
  if (fueling.veiculoId || fueling.vehicle_id) {
    const vId = fueling.veiculoId || fueling.vehicle_id;
    const vRef = doc(db, 'companies', empresaId, 'vehicles', vId);
    const vSnap = await getDoc(vRef);
    if (vSnap.exists()) {
      const vData = vSnap.data();
      const currentKm = Number(vData.kmAtual || vData.current_km || 0);
      const justification = fueling.correction_justification || fueling.justification;
      if (odoNumber > 0 && odoNumber < currentKm && (!justification || justification.trim().length < 5)) {
        throw new Error(
          `Odômetro decrescente recusado: ${odoNumber.toLocaleString()} km é menor que o último registro (${currentKm.toLocaleString()} km). É obrigatório confirmar o valor ou fornecer justificativa formal.`
        );
      }
    }
  }

  const rawPayload: Record<string, any> = {
    id: fId,
    empresaId,
    company_id: empresaId,
    veiculoId: fueling.vehicle_id || fueling.veiculoId || '',
    vehicle_id: fueling.vehicle_id || fueling.veiculoId || '',
    motoristaId: fueling.driver_id || fueling.motoristaId || '',
    driver_id: fueling.driver_id || fueling.motoristaId || '',
    data: fueling.event_date || fueling.data || new Date().toISOString().split('T')[0],
    event_date: fueling.event_date || fueling.data || new Date().toISOString().split('T')[0],
    odometro: odoNumber,
    posto: fueling.gas_station_name || fueling.posto || 'Posto não informado',
    cnpjPosto: fueling.cnpj || fueling.cnpjPosto || '',
    combustivel: fueling.fuel_type || fueling.combustivel || 'Diesel S10',
    litros: Number(fueling.liters || fueling.litros || 0),
    precoLitro: Number(fueling.price_per_liter || fueling.precoLitro || 0),
    valorTotal: Number(fueling.total_amount || fueling.valorTotal || 0),
    total_amount: Number(fueling.total_amount || fueling.valorTotal || 0),
    status: fueling.status || 'pending_confirmation',
    event_type: 'fuel',
    created_at: fueling.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    notes: fueling.notes || '',
  };

  if (fueling.motoristaUid || auth.currentUser?.uid) {
    rawPayload.motoristaUid = fueling.motoristaUid || auth.currentUser?.uid;
  }
  if (fueling.created_by || auth.currentUser?.uid) {
    rawPayload.created_by = fueling.created_by || auth.currentUser?.uid;
  }
  if (fueling.correction_justification) {
    rawPayload.correction_justification = fueling.correction_justification;
  }

  const payload = cleanFirestorePayload(rawPayload);

  const fRef = doc(db, 'companies', empresaId, 'fuelings', fId);
  try {
    await setDoc(fRef, payload, { merge: true });

    // Atualizar odômetro atual do veículo se for maior
    if (payload.veiculoId && payload.odometro > 0) {
      const vRef = doc(db, 'companies', empresaId, 'vehicles', payload.veiculoId);
      const vSnap = await getDoc(vRef);
      if (vSnap.exists()) {
        const vData = vSnap.data();
        if ((vData.kmAtual || vData.current_km || 0) < payload.odometro) {
          await updateDoc(vRef, {
            kmAtual: payload.odometro,
            current_km: payload.odometro,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }
    return payload;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `companies/${empresaId}/fuelings/${fId}`);
    throw err;
  }
}

export async function saveInspectionToFirestore(
  empresaId: string,
  inspection: Partial<VehicleInspection>
): Promise<VehicleInspection> {
  const iId = inspection.id || `insp-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  const rawPayload: Record<string, any> = {
    id: iId,
    empresaId,
    veiculoId: inspection.veiculoId || '',
    motoristaNome: inspection.motoristaNome || '',
    data: inspection.data || new Date().toISOString().split('T')[0],
    odometro: Number(inspection.odometro || 0),
    status: inspection.status || 'concluida',
    fotos: inspection.fotos || {
      dianteiraEsquerda: '',
      dianteiraDireita: '',
      traseiraDireita: '',
      traseiraEsquerda: '',
      pneu: '',
    },
    avarias: inspection.avarias || [],
    analisePneu: inspection.analisePneu || {
      desgastePneuMm: 5.0,
      condicao: 'bom',
      limiteLegalMm: 1.6,
      kmRestantesEstimados: 28900,
      recomendacao: 'Pneus em conformidade.',
    },
    resumoGeral: inspection.resumoGeral || 'Vistoria visual documentada.',
    aprovado: inspection.aprovado ?? true,
    created_at: inspection.created_at || new Date().toISOString(),
  };

  if (inspection.motoristaId) rawPayload.motoristaId = inspection.motoristaId;
  if (inspection.fotoAnotadaUrl) rawPayload.fotoAnotadaUrl = inspection.fotoAnotadaUrl;

  const payload = cleanFirestorePayload(rawPayload) as VehicleInspection;
  const iRef = doc(db, 'companies', empresaId, 'inspections', iId);
  try {
    await setDoc(iRef, payload, { merge: true });
    return payload;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `companies/${empresaId}/inspections/${iId}`);
    throw err;
  }
}

export async function saveDailyInsightsToFirestore(
  empresaId: string,
  insights: DailyFleetInsights
): Promise<DailyFleetInsights> {
  const insightId = insights.id || `insight-${insights.date || new Date().toISOString().split('T')[0]}-${empresaId}`;
  const docRef = doc(db, 'companies', empresaId, 'dailyInsights', insightId);
  try {
    await setDoc(docRef, { ...insights, id: insightId }, { merge: true });
    return insights;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `companies/${empresaId}/dailyInsights/${insightId}`);
    throw err;
  }
}

// 7. ZERAR TUDO: Exclui permanentemente todos os registros, veículos, motoristas, despesas e auditorias
export async function resetAllCompanyData(empresaId: string): Promise<void> {
  const subcollections = [
    'vehicles',
    'drivers',
    'fuelings',
    'maintenance',
    'inspections',
    'dailyInsights',
    'documents',
    'links',
    'events',
    'notifications',
  ];

  for (const subcol of subcollections) {
    try {
      const colRef = collection(db, 'companies', empresaId, subcol);
      const snap = await getDocs(colRef);
      for (const d of snap.docs) {
        await deleteDoc(d.ref).catch((e) => console.warn(`Erro ao excluir doc em ${subcol}:`, e));
      }
    } catch (err) {
      console.warn(`Erro ao limpar coleção ${subcol}:`, err);
    }
  }

  // Limpar dados e vínculos da empresa
  try {
    const compRef = doc(db, 'companies', empresaId);
    await updateDoc(compRef, {
      sheets_spreadsheet_id: null,
      sheets_spreadsheet_url: null,
      sheets_synced_at: null,
      sheets_auto_sync: false,
    });
  } catch (err) {
    console.warn('Erro ao resetar empresa:', err);
  }

  // Limpar todas as chaves locais no localStorage
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.startsWith('frotafacil') ||
          key.startsWith('frota_facil') ||
          key.startsWith('gestor_falante') ||
          key.includes('draft') ||
          key.includes('v1_'))
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (err) {
    console.warn('Erro ao limpar localStorage:', err);
  }
}


