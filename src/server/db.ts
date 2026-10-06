import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  Firestore,
} from 'firebase/firestore';
import {
  Company,
  User,
  Driver,
  Vehicle,
  VehicleDriverLink,
  FleetEvent,
  FuelEvent,
  MaintenanceEvent,
  EvidenceFile,
  AiExtraction,
  AutomaticValidation,
  AuditLog,
  Notification,
} from './types.js';

interface DatabaseSchema {
  companies: Company[];
  users: User[];
  drivers: Driver[];
  vehicles: Vehicle[];
  vehicle_driver_links: VehicleDriverLink[];
  fleet_events: FleetEvent[];
  fuel_events: FuelEvent[];
  maintenance_events: MaintenanceEvent[];
  evidence_files: EvidenceFile[];
  ai_extractions: AiExtraction[];
  automatic_validations: AutomaticValidation[];
  audit_logs: AuditLog[];
  notifications: Notification[];
}

const DB_FILE = path.join(process.cwd(), 'data', 'fleet_database.json');
const UPLOADS_DIR = path.join(process.cwd(), 'data', 'uploads');

// Ensure directories exist
if (!fs.existsSync(path.dirname(DB_FILE))) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Inicialização resiliente da conexão com Firestore no backend
let firestoreBackendDb: Firestore | null = null;
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    firestoreBackendDb = firebaseConfig.firestoreDatabaseId
      ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
      : getFirestore(app);
    console.log('🔥 [Firestore Backend] Instância Firestore conectada para persistência multi-tenant permanente.');
  }
} catch (e: any) {
  console.warn('⚠️ [Firestore Backend] Aviso na inicialização do Firestore:', e?.message || e);
}

class FleetDatabase {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.loadDatabase();
    if (this.data.companies.length === 0) {
      this.seedInitialData();
      this.saveDatabase();
    }
    // Hidratação assíncrona do Firestore se ativo
    this.hydrateFromFirestore().catch((err) => {
      console.warn('[Firestore] Aviso na hidratação em background:', err?.message || err);
    });
  }

  /**
   * Sanitiza recursivamente objetos removendo propriedades undefined
   */
  private sanitizeForFirestore(obj: any): any {
    if (obj === null || obj === undefined) return null;
    if (Array.isArray(obj)) {
      return obj
        .filter((item) => item !== undefined)
        .map((item) => (typeof item === 'object' && item !== null ? this.sanitizeForFirestore(item) : item));
    }
    if (typeof obj === 'object') {
      const cleaned: Record<string, any> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (v !== undefined) {
          cleaned[k] = typeof v === 'object' && v !== null ? this.sanitizeForFirestore(v) : v;
        }
      }
      return cleaned;
    }
    return obj;
  }

  /**
   * Sincroniza documento diretamente com o Firestore em nuvem
   */
  private async syncDocToFirestore(pathSegments: string[], payload: any): Promise<void> {
    if (!firestoreBackendDb || pathSegments.length < 2) return;
    try {
      const sanitized = this.sanitizeForFirestore(payload);
      const [col, docId, ...subPath] = pathSegments;
      const docRef = doc(firestoreBackendDb, col, docId, ...subPath);
      await setDoc(docRef, sanitized, { merge: true });
    } catch (err: any) {
      console.warn(`[Firestore Sync] Aviso ao sincronizar ${pathSegments.join('/')}:`, err?.message || err);
    }
  }

  /**
   * Hidrata dados em memória a partir do Firestore ao iniciar em disco efêmero
   */
  public async hydrateFromFirestore(): Promise<void> {
    if (!firestoreBackendDb) return;
    try {
      // 1. Hidratar empresas
      const compSnap = await getDocs(collection(firestoreBackendDb, 'companies'));
      if (!compSnap.empty) {
        for (const docSnap of compSnap.docs) {
          const compData = docSnap.data() as any;
          const compId = docSnap.id;
          const exists = this.data.companies.some((c) => c.id === compId);
          if (!exists) {
            this.data.companies.push({
              id: compId,
              name: compData.name || compData.nome || 'Empresa FrotaFácil',
              cnpj: compData.cnpj || '00.000.000/0001-00',
              maxTankMarginPercent: compData.maxTankMarginPercent || 10,
              status: compData.status || 'active',
              created_at: compData.dataCriacao || compData.created_at || new Date().toISOString(),
            });
          }

          // 2. Hidratar veículos da empresa
          const vehCol = collection(firestoreBackendDb, 'companies', compId, 'vehicles');
          const vehSnap = await getDocs(vehCol);
          for (const vDoc of vehSnap.docs) {
            const vData = vDoc.data() as any;
            const existingIdx = this.data.vehicles.findIndex((v) => v.id === vDoc.id);
            const vehObj: Vehicle = {
              id: vDoc.id,
              company_id: compId,
              plate: vData.plate || vData.placa || '',
              chassi: vData.chassi || '',
              renavam: vData.renavam || '',
              make: vData.make || vData.marca || '',
              model: vData.model || vData.modelo || '',
              year: vData.year || vData.ano || 2023,
              fuel_type: vData.fuel_type || vData.combustivel || 'Diesel S10',
              tank_capacity_liters: vData.tank_capacity_liters || vData.capacidadeTanque || 500,
              initial_km: vData.initial_km ?? vData.kmInicial ?? 0,
              current_km: vData.current_km ?? vData.kmAtual ?? 0,
              status: vData.status || 'ativo',
              next_maintenance_km: vData.next_maintenance_km,
              next_maintenance_desc: vData.next_maintenance_desc,
              created_at: vData.created_at || new Date().toISOString(),
            };
            if (existingIdx >= 0) {
              this.data.vehicles[existingIdx] = vehObj;
            } else {
              this.data.vehicles.push(vehObj);
            }
          }

          // 3. Hidratar motoristas da empresa
          const drvCol = collection(firestoreBackendDb, 'companies', compId, 'drivers');
          const drvSnap = await getDocs(drvCol);
          for (const dDoc of drvSnap.docs) {
            const dData = dDoc.data() as any;
            const existingIdx = this.data.drivers.findIndex((d) => d.id === dDoc.id);
            const drvObj: Driver = {
              id: dDoc.id,
              company_id: compId,
              user_id: dData.user_id || `usr-${dDoc.id}`,
              name: dData.name || dData.nome || 'Motorista',
              email: dData.email || '',
              phone: dData.phone || dData.telefone || '',
              cnh: dData.cnh || '',
              cnh_category: dData.cnh_category || dData.categoriaCnh || 'D',
              cnh_expiration: dData.cnh_expiration || dData.validadeCnh || '',
              status: dData.status || 'ativo',
              created_at: dData.created_at || new Date().toISOString(),
            };
            if (existingIdx >= 0) {
              this.data.drivers[existingIdx] = drvObj;
            } else {
              this.data.drivers.push(drvObj);
            }
          }
        }
        this.saveDatabase();
        console.log(`✅ [Firestore Backend] Hidratação concluída: ${this.data.companies.length} empresas, ${this.data.vehicles.length} veículos, ${this.data.drivers.length} motoristas sincronizados.`);
      }
    } catch (e: any) {
      console.warn('⚠️ [Firestore Backend] Hidratação não disponível offline:', e?.message || e);
    }
  }

  private loadDatabase(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('Falha ao ler database.json, iniciando schema novo:', err);
    }

    return {
      companies: [],
      users: [],
      drivers: [],
      vehicles: [],
      vehicle_driver_links: [],
      fleet_events: [],
      fuel_events: [],
      maintenance_events: [],
      evidence_files: [],
      ai_extractions: [],
      automatic_validations: [],
      audit_logs: [],
      notifications: [],
    };
  }

  public saveDatabase(): void {
    try {
      const tempPath = `${DB_FILE}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tempPath, DB_FILE);
    } catch (err) {
      console.error('Erro ao persistir database.json:', err);
    }
  }

  public getRawData(): DatabaseSchema {
    return this.data;
  }

  /**
   * Seed inicial com 2 empresas isoladas para validação do escopo multiempresa
   */
  private seedInitialData(): void {
    console.log('🌱 Semeando dados empresariais iniciais (TransLog + Rápido Brasil)...');

    // 1. Empresas
    const company1: Company = {
      id: 'comp-translog-01',
      name: 'TransLog Transportes e Logística S/A',
      cnpj: '12.345.678/0001-90',
      maxTankMarginPercent: 10,
      status: 'active',
      created_at: '2025-01-10T08:00:00.000Z',
    };

    const company2: Company = {
      id: 'comp-rapidobr-02',
      name: 'Expresso Rápido Brasil Ltda',
      cnpj: '98.765.432/0001-11',
      maxTankMarginPercent: 8,
      status: 'active',
      created_at: '2025-02-01T09:00:00.000Z',
    };

    this.data.companies = [company1, company2];

    // 2. Usuários
    const userAdmin1: User = {
      id: 'usr-admin-translog',
      company_id: company1.id,
      name: 'Renata Albuquerque (Gestora de Frota)',
      email: 'admin@translog.com.br',
      role: 'administrativo',
      active: true,
      created_at: '2025-01-10T08:30:00.000Z',
    };

    const userDriver1: User = {
      id: 'usr-driver-carlos',
      company_id: company1.id,
      name: 'Carlos Eduardo Santos',
      email: 'carlos@translog.com.br',
      role: 'motorista',
      active: true,
      created_at: '2025-01-15T09:00:00.000Z',
    };

    const userDriver2: User = {
      id: 'usr-driver-marcos',
      company_id: company1.id,
      name: 'Marcos Silveira Lima',
      email: 'marcos@translog.com.br',
      role: 'motorista',
      active: true,
      created_at: '2025-01-20T10:00:00.000Z',
    };

    // Empresa 2
    const userAdmin2: User = {
      id: 'usr-admin-rapido',
      company_id: company2.id,
      name: 'Danilo Pacheco (Gerente Operacional)',
      email: 'danilo@rapidobrasil.com.br',
      role: 'administrativo',
      active: true,
      created_at: '2025-02-01T09:30:00.000Z',
    };

    const userDriver3: User = {
      id: 'usr-driver-joao',
      company_id: company2.id,
      name: 'João Batista Ferreira',
      email: 'joao@rapidobrasil.com.br',
      role: 'motorista',
      active: true,
      created_at: '2025-02-05T11:00:00.000Z',
    };

    this.data.users = [userAdmin1, userDriver1, userDriver2, userAdmin2, userDriver3];

    // 3. Motoristas
    const driver1: Driver = {
      id: 'drv-carlos-01',
      company_id: company1.id,
      user_id: userDriver1.id,
      name: 'Carlos Eduardo Santos',
      email: 'carlos@translog.com.br',
      phone: '(11) 98765-4321',
      cnh: '04918273645',
      cnh_category: 'D',
      cnh_expiration: '2027-11-20',
      status: 'ativo',
      created_at: '2025-01-15T09:00:00.000Z',
    };

    const driver2: Driver = {
      id: 'drv-marcos-02',
      company_id: company1.id,
      user_id: userDriver2.id,
      name: 'Marcos Silveira Lima',
      email: 'marcos@translog.com.br',
      phone: '(11) 97654-3210',
      cnh: '08372615243',
      cnh_category: 'E',
      cnh_expiration: '2026-08-15',
      status: 'ativo',
      created_at: '2025-01-20T10:00:00.000Z',
    };

    const driver3: Driver = {
      id: 'drv-joao-03',
      company_id: company2.id,
      user_id: userDriver3.id,
      name: 'João Batista Ferreira',
      email: 'joao@rapidobrasil.com.br',
      phone: '(21) 99123-4567',
      cnh: '01928374650',
      cnh_category: 'E',
      cnh_expiration: '2026-05-10',
      status: 'ativo',
      created_at: '2025-02-05T11:00:00.000Z',
    };

    this.data.drivers = [driver1, driver2, driver3];

    // 4. Veículos
    const vehicle1: Vehicle = {
      id: 'veh-fiorino-01',
      company_id: company1.id,
      plate: 'FLT3B11',
      chassi: '9BD23849182371928',
      renavam: '18273645019',
      make: 'Fiat',
      model: 'Fiorino Endurance 1.4 EVO',
      year: 2023,
      fuel_type: 'Etanol',
      tank_capacity_liters: 55,
      initial_km: 12000,
      current_km: 34850,
      status: 'ativo',
      next_maintenance_km: 40000,
      next_maintenance_desc: 'Troca de óleo sintético 5W30 + Filtros de ar e combustível',
      created_at: '2025-01-10T10:00:00.000Z',
    };

    const vehicle2: Vehicle = {
      id: 'veh-vw-02',
      company_id: company1.id,
      plate: 'SPX9A88',
      chassi: '9BW83746281920394',
      renavam: '82736450192',
      make: 'Volkswagen',
      model: 'Constellation 24.280 V-Tronic',
      year: 2022,
      fuel_type: 'Diesel S10',
      tank_capacity_liters: 275,
      initial_km: 45000,
      current_km: 67900,
      status: 'ativo',
      next_maintenance_km: 70000,
      next_maintenance_desc: 'Revisão preventiva de freios e suspensão pneumática',
      created_at: '2025-01-10T11:00:00.000Z',
    };

    const vehicle3: Vehicle = {
      id: 'veh-scania-03',
      company_id: company1.id,
      plate: 'BRA2E19',
      chassi: '9BS72635481920394',
      renavam: '73645019283',
      make: 'Scania',
      model: 'R450 Highline 6x2',
      year: 2021,
      fuel_type: 'Diesel S10',
      tank_capacity_liters: 400,
      initial_km: 110000,
      current_km: 142500,
      status: 'manutencao',
      next_maintenance_km: 140000,
      next_maintenance_desc: 'Regulagem de válvulas e substituição correia poly-V',
      created_at: '2025-01-12T14:00:00.000Z',
    };

    // Veículo Empresa 2
    const vehicle4: Vehicle = {
      id: 'veh-volvo-04',
      company_id: company2.id,
      plate: 'RAP1A01',
      chassi: '9BV82736451029384',
      renavam: '62534102938',
      make: 'Volvo',
      model: 'FH 540 Globetrotter 6x4',
      year: 2023,
      fuel_type: 'Diesel S10',
      tank_capacity_liters: 450,
      initial_km: 160000,
      current_km: 210000,
      status: 'ativo',
      next_maintenance_km: 215000,
      next_maintenance_desc: 'Troca de filtros de arla 32 e regulagem injetores',
      created_at: '2025-02-01T12:00:00.000Z',
    };

    this.data.vehicles = [vehicle1, vehicle2, vehicle3, vehicle4];

    // 5. Vínculos Veículo <-> Motorista (Many-to-many com histórico)
    const link1: VehicleDriverLink = {
      id: 'link-carlos-fiorino',
      company_id: company1.id,
      vehicle_id: vehicle1.id,
      driver_id: driver1.id,
      started_at: '2025-01-15T00:00:00.000Z',
      ended_at: null,
      is_active: true,
      notes: 'Entregas expressas urbanas Grande SP',
      created_by: userAdmin1.id,
      created_at: '2025-01-15T09:15:00.000Z',
    };

    const link2: VehicleDriverLink = {
      id: 'link-carlos-vw',
      company_id: company1.id,
      vehicle_id: vehicle2.id,
      driver_id: driver1.id,
      started_at: '2025-02-01T00:00:00.000Z',
      ended_at: null,
      is_active: true,
      notes: 'Rotas intermunicipais secundárias',
      created_by: userAdmin1.id,
      created_at: '2025-02-01T10:00:00.000Z',
    };

    const link3: VehicleDriverLink = {
      id: 'link-marcos-scania',
      company_id: company1.id,
      vehicle_id: vehicle3.id,
      driver_id: driver2.id,
      started_at: '2025-01-20T00:00:00.000Z',
      ended_at: null,
      is_active: true,
      notes: 'Linha interestadual SP - PR',
      created_by: userAdmin1.id,
      created_at: '2025-01-20T10:30:00.000Z',
    };

    const link4: VehicleDriverLink = {
      id: 'link-joao-volvo',
      company_id: company2.id,
      vehicle_id: vehicle4.id,
      driver_id: driver3.id,
      started_at: '2025-02-05T00:00:00.000Z',
      ended_at: null,
      is_active: true,
      notes: 'Transporte de grãos safra Centro-Oeste',
      created_by: userAdmin2.id,
      created_at: '2025-02-05T11:15:00.000Z',
    };

    this.data.vehicle_driver_links = [link1, link2, link3, link4];

    // 6. Evidência inicial
    const evidence1: EvidenceFile = {
      id: 'ev-seed-01',
      company_id: company1.id,
      file_path: '/placeholder-receipt-01.jpg',
      original_name: 'cupom_posto_graal_55l.jpg',
      mime_type: 'image/jpeg',
      file_size: 245100,
      sha256_hash: crypto.createHash('sha256').update('seed-image-graal-01').digest('hex'),
      upload_type: 'receipt',
      created_at: '2025-05-10T14:30:00.000Z',
    };

    const evidence2: EvidenceFile = {
      id: 'ev-seed-02',
      company_id: company1.id,
      file_path: '/placeholder-os-02.jpg',
      original_name: 'os_mecanica_revisao_vw.jpg',
      mime_type: 'image/jpeg',
      file_size: 382400,
      sha256_hash: crypto.createHash('sha256').update('seed-image-mecanica-02').digest('hex'),
      upload_type: 'receipt',
      created_at: '2025-05-02T16:00:00.000Z',
    };

    this.data.evidence_files = [evidence1, evidence2];

    // 7. Eventos de Frota
    const eventFuel1: FleetEvent = {
      id: 'evt-fuel-01',
      company_id: company1.id,
      vehicle_id: vehicle1.id,
      driver_id: driver1.id,
      event_type: 'fuel',
      status: 'confirmed',
      event_date: '2025-05-10',
      odometer: 34850,
      total_amount: 198.00,
      evidence_file_id: evidence1.id,
      notes: 'Abastecimento tanque cheio Posto Graal KM 56',
      created_by: userDriver1.id,
      confirmed_by: userDriver1.id,
      confirmed_at: '2025-05-10T14:35:00.000Z',
      created_at: '2025-05-10T14:32:00.000Z',
      updated_at: '2025-05-10T14:35:00.000Z',
    };

    const fuelDetail1: FuelEvent = {
      id: 'fdet-01',
      fleet_event_id: eventFuel1.id,
      company_id: company1.id,
      gas_station_name: 'Auto Posto Graal Turmalina Ltda',
      cnpj: '53.123.456/0001-88',
      fuel_type: 'Etanol',
      liters: 45.00,
      price_per_liter: 4.40,
      is_full_tank: true,
      calculated_km_delta: 420,
      calculated_km_per_liter: 9.33,
      calculated_cost_per_km: 0.47,
    };

    const eventMaint1: FleetEvent = {
      id: 'evt-maint-02',
      company_id: company1.id,
      vehicle_id: vehicle2.id,
      driver_id: driver1.id,
      event_type: 'maintenance',
      status: 'confirmed',
      event_date: '2025-05-02',
      odometer: 67200,
      total_amount: 1450.00,
      evidence_file_id: evidence2.id,
      notes: 'Substituição lonas de freio traseiras e sangria do sistema',
      created_by: userAdmin1.id,
      confirmed_by: userAdmin1.id,
      confirmed_at: '2025-05-02T16:15:00.000Z',
      created_at: '2025-05-02T16:05:00.000Z',
      updated_at: '2025-05-02T16:15:00.000Z',
    };

    const maintDetail1: MaintenanceEvent = {
      id: 'mdet-01',
      fleet_event_id: eventMaint1.id,
      company_id: company1.id,
      workshop_name: 'Mecânica Diesel Pesados Bandeirantes',
      cnpj: '11.222.333/0001-44',
      maintenance_type: 'corretiva',
      parts_cost: 950.00,
      labor_cost: 500.00,
      items_description: 'Jogo de lonas de freio Fras-le + 2 cilindros de roda + mão de obra regulagem',
      next_suggested_km: 70000,
    };

    this.data.fleet_events = [eventFuel1, eventMaint1];
    this.data.fuel_events = [fuelDetail1];
    this.data.maintenance_events = [maintDetail1];

    // 8. Validações automáticas
    const val1: AutomaticValidation = {
      id: 'val-01',
      company_id: company1.id,
      fleet_event_id: eventFuel1.id,
      rule_name: 'ODOMETER_CHECK',
      passed: true,
      severity: 'INFO',
      message: 'Odômetro 34.850 km válido (avanço de 420 km em relação ao anterior 34.430 km).',
      details: { previousKm: 34430, newKm: 34850, deltaKm: 420 },
      created_at: '2025-05-10T14:33:00.000Z',
    };

    const val2: AutomaticValidation = {
      id: 'val-02',
      company_id: company1.id,
      fleet_event_id: eventFuel1.id,
      rule_name: 'TANK_CAPACITY_CHECK',
      passed: true,
      severity: 'INFO',
      message: 'Volume de 45.00 L está dentro do limite do tanque de 55.0 L (81.8% da capacidade).',
      details: { liters: 45.00, tankCapacity: 55, percent: 81.8 },
      created_at: '2025-05-10T14:33:00.000Z',
    };

    this.data.automatic_validations = [val1, val2];

    // 9. Auditoria
    const audit1: AuditLog = {
      id: 'aud-01',
      company_id: company1.id,
      user_id: userDriver1.id,
      user_name: userDriver1.name,
      action: 'EVENT_CONFIRMED',
      entity: 'FleetEvent',
      entity_id: eventFuel1.id,
      details: { vehicle: 'FLT3B11', type: 'fuel', amount: 198.00, odometer: 34850 },
      ip: '189.120.44.12',
      created_at: '2025-05-10T14:35:00.000Z',
    };

    this.data.audit_logs = [audit1];

    // 10. Notificações
    const notif1: Notification = {
      id: 'notif-01',
      company_id: company1.id,
      title: 'Revisão Preventiva Próxima',
      message: 'O caminhão Scania R450 (BRA2E19) atingiu 142.500 km e ultrapassou a meta de preventiva (140.000 km).',
      type: 'warning',
      read: false,
      created_at: '2025-05-11T08:00:00.000Z',
    };

    this.data.notifications = [notif1];
  }

  // --- MÉTODOS DE CONSULTA E MUTACAO COM ISOLAMENTO POR COMPANY_ID ---

  // Companies & Users
  public getCompany(id: string): Company | undefined {
    return this.data.companies.find((c) => c.id === id);
  }

  public getCompanies(): Company[] {
    return this.data.companies;
  }

  public getUser(id: string): User | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  public getUserByEmail(email: string): User | undefined {
    return this.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  public getUsersByCompany(companyId: string): User[] {
    return this.data.users.filter((u) => u.company_id === companyId);
  }

  // Drivers
  public getDrivers(companyId: string): Driver[] {
    return this.data.drivers.filter((d) => d.company_id === companyId);
  }

  public getDriver(companyId: string, driverId: string): Driver | undefined {
    return this.data.drivers.find((d) => d.company_id === companyId && d.id === driverId);
  }

  public getDriverByUserId(companyId: string, userId: string): Driver | undefined {
    return this.data.drivers.find((d) => d.company_id === companyId && d.user_id === userId);
  }

  public createDriver(companyId: string, driverData: Omit<Driver, 'id' | 'company_id' | 'created_at'>): Driver {
    const id = `drv-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const newDriver: Driver = {
      ...driverData,
      id,
      company_id: companyId,
      created_at: new Date().toISOString(),
    };
    this.data.drivers.push(newDriver);
    this.saveDatabase();
    this.syncDocToFirestore(['companies', companyId, 'drivers', id], newDriver);
    return newDriver;
  }

  public updateDriver(companyId: string, driverId: string, updates: Partial<Driver>): Driver | null {
    const idx = this.data.drivers.findIndex((d) => d.company_id === companyId && d.id === driverId);
    if (idx === -1) return null;
    this.data.drivers[idx] = { ...this.data.drivers[idx], ...updates };
    this.saveDatabase();
    this.syncDocToFirestore(['companies', companyId, 'drivers', driverId], this.data.drivers[idx]);
    return this.data.drivers[idx];
  }

  // Vehicles
  public getVehicles(companyId: string, driverId?: string): Vehicle[] {
    let vehicles = this.data.vehicles.filter((v) => v.company_id === companyId);

    // Se motorista informado, filtrar estritamente pelos vínculos ativos
    if (driverId) {
      const activeLinks = this.data.vehicle_driver_links.filter(
        (l) => l.company_id === companyId && l.driver_id === driverId && l.is_active
      );
      const linkedVehicleIds = new Set(activeLinks.map((l) => l.vehicle_id));
      vehicles = vehicles.filter((v) => linkedVehicleIds.has(v.id));
    }

    return vehicles;
  }

  public getVehicle(companyId: string, vehicleId: string): Vehicle | undefined {
    return this.data.vehicles.find((v) => v.company_id === companyId && v.id === vehicleId);
  }

  public getVehicleByPlate(companyId: string, plate: string): Vehicle | undefined {
    const clean = plate.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    return this.data.vehicles.find(
      (v) => v.company_id === companyId && v.plate.replace(/[^A-Za-z0-9]/g, '').toUpperCase() === clean
    );
  }

  public createVehicle(companyId: string, vehicleData: Omit<Vehicle, 'id' | 'company_id' | 'created_at'>): Vehicle {
    const id = `veh-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const newVehicle: Vehicle = {
      ...vehicleData,
      id,
      company_id: companyId,
      created_at: new Date().toISOString(),
    };
    this.data.vehicles.push(newVehicle);
    this.saveDatabase();
    this.syncDocToFirestore(['companies', companyId, 'vehicles', id], newVehicle);
    return newVehicle;
  }

  public updateVehicle(companyId: string, vehicleId: string, updates: Partial<Vehicle>): Vehicle | null {
    const idx = this.data.vehicles.findIndex((v) => v.company_id === companyId && v.id === vehicleId);
    if (idx === -1) return null;
    this.data.vehicles[idx] = { ...this.data.vehicles[idx], ...updates };
    this.saveDatabase();
    this.syncDocToFirestore(['companies', companyId, 'vehicles', vehicleId], this.data.vehicles[idx]);
    return this.data.vehicles[idx];
  }

  // Vehicle-Driver Links (Many-to-Many com histórico)
  public getLinks(companyId: string, vehicleId?: string, driverId?: string): VehicleDriverLink[] {
    return this.data.vehicle_driver_links.filter((l) => {
      if (l.company_id !== companyId) return false;
      if (vehicleId && l.vehicle_id !== vehicleId) return false;
      if (driverId && l.driver_id !== driverId) return false;
      return true;
    });
  }

  public linkVehicleDriver(
    companyId: string,
    vehicleId: string,
    driverId: string,
    notes?: string,
    createdBy?: string
  ): VehicleDriverLink {
    // Desativa vínculo anterior duplicado ativo se existir
    this.data.vehicle_driver_links.forEach((l) => {
      if (l.company_id === companyId && l.vehicle_id === vehicleId && l.driver_id === driverId && l.is_active) {
        l.is_active = false;
        l.ended_at = new Date().toISOString();
      }
    });

    const newLink: VehicleDriverLink = {
      id: `link-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      company_id: companyId,
      vehicle_id: vehicleId,
      driver_id: driverId,
      started_at: new Date().toISOString(),
      ended_at: null,
      is_active: true,
      notes: notes || 'Vínculo operacional registrado',
      created_by: createdBy,
      created_at: new Date().toISOString(),
    };

    this.data.vehicle_driver_links.push(newLink);
    this.saveDatabase();
    return newLink;
  }

  public unlinkVehicleDriver(companyId: string, linkId: string): boolean {
    const link = this.data.vehicle_driver_links.find((l) => l.company_id === companyId && l.id === linkId);
    if (!link) return false;
    link.is_active = false;
    link.ended_at = new Date().toISOString();
    this.saveDatabase();
    return true;
  }

  // Evidence Files
  public saveEvidenceFile(fileData: Omit<EvidenceFile, 'id' | 'created_at'>): EvidenceFile {
    const id = `ev-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const newFile: EvidenceFile = {
      ...fileData,
      id,
      created_at: new Date().toISOString(),
    };
    this.data.evidence_files.push(newFile);
    this.saveDatabase();
    return newFile;
  }

  public getEvidenceFile(companyId: string, fileId: string): EvidenceFile | undefined {
    return this.data.evidence_files.find((f) => f.company_id === companyId && f.id === fileId);
  }

  public findEvidenceByHash(companyId: string, hash: string): EvidenceFile | undefined {
    return this.data.evidence_files.find((f) => f.company_id === companyId && f.sha256_hash === hash);
  }

  // Fleet Events
  public getFleetEvents(companyId: string, filters?: { vehicleId?: string; driverId?: string; status?: string; type?: string }): any[] {
    let events = this.data.fleet_events.filter((e) => e.company_id === companyId);

    if (filters?.vehicleId) {
      events = events.filter((e) => e.vehicle_id === filters.vehicleId);
    }
    if (filters?.driverId) {
      events = events.filter((e) => e.driver_id === filters.driverId);
    }
    if (filters?.status) {
      events = events.filter((e) => e.status === filters.status);
    }
    if (filters?.type) {
      events = events.filter((e) => e.event_type === filters.type);
    }

    // Join with fuel/maintenance details, vehicle, driver, evidence, and validations
    return events
      .sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime())
      .map((ev) => this.enrichFleetEvent(companyId, ev));
  }

  public getFleetEvent(companyId: string, eventId: string): any | undefined {
    const ev = this.data.fleet_events.find((e) => e.company_id === companyId && e.id === eventId);
    if (!ev) return undefined;
    return this.enrichFleetEvent(companyId, ev);
  }

  private enrichFleetEvent(companyId: string, ev: FleetEvent): any {
    const vehicle = this.data.vehicles.find((v) => v.id === ev.vehicle_id);
    const driver = this.data.drivers.find((d) => d.id === ev.driver_id);
    const evidence = ev.evidence_file_id ? this.data.evidence_files.find((f) => f.id === ev.evidence_file_id) : undefined;
    const secondaryEvidence = ev.evidence_secondary_id ? this.data.evidence_files.find((f) => f.id === ev.evidence_secondary_id) : undefined;
    const fuelDetail = ev.event_type === 'fuel' ? this.data.fuel_events.find((f) => f.fleet_event_id === ev.id) : undefined;
    const maintenanceDetail = ev.event_type === 'maintenance' ? this.data.maintenance_events.find((m) => m.fleet_event_id === ev.id) : undefined;
    const validations = this.data.automatic_validations.filter((v) => v.company_id === companyId && v.fleet_event_id === ev.id);
    const extraction = this.data.ai_extractions.find((x) => x.company_id === companyId && x.fleet_event_id === ev.id);

    return {
      ...ev,
      vehicle,
      driver,
      evidence,
      secondaryEvidence,
      fuelDetail,
      maintenanceDetail,
      validations,
      extraction,
    };
  }

  public createFleetEvent(
    companyId: string,
    eventData: Omit<FleetEvent, 'id' | 'company_id' | 'created_at' | 'updated_at'>,
    fuelData?: Omit<FuelEvent, 'id' | 'fleet_event_id' | 'company_id'>,
    maintData?: Omit<MaintenanceEvent, 'id' | 'fleet_event_id' | 'company_id'>
  ): FleetEvent {
    const eventId = `evt-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const newEvent: FleetEvent = {
      ...eventData,
      id: eventId,
      company_id: companyId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.data.fleet_events.push(newEvent);

    if (fuelData && eventData.event_type === 'fuel') {
      const fuelId = `fdet-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      this.data.fuel_events.push({
        ...fuelData,
        id: fuelId,
        fleet_event_id: eventId,
        company_id: companyId,
      });
    }

    if (maintData && eventData.event_type === 'maintenance') {
      const maintId = `mdet-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      this.data.maintenance_events.push({
        ...maintData,
        id: maintId,
        fleet_event_id: eventId,
        company_id: companyId,
      });
    }

    this.saveDatabase();
    this.syncDocToFirestore(['companies', companyId, 'events', eventId], newEvent);
    if (fuelData && eventData.event_type === 'fuel') {
      this.syncDocToFirestore(['companies', companyId, 'fuelings', eventId], { ...newEvent, ...fuelData });
    }
    if (maintData && eventData.event_type === 'maintenance') {
      this.syncDocToFirestore(['companies', companyId, 'maintenance', eventId], { ...newEvent, ...maintData });
    }
    return newEvent;
  }

  public updateFleetEvent(
    companyId: string,
    eventId: string,
    updates: Partial<FleetEvent>,
    fuelUpdates?: Partial<FuelEvent>,
    maintUpdates?: Partial<MaintenanceEvent>
  ): FleetEvent | null {
    const idx = this.data.fleet_events.findIndex((e) => e.company_id === companyId && e.id === eventId);
    if (idx === -1) return null;

    this.data.fleet_events[idx] = {
      ...this.data.fleet_events[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    if (fuelUpdates) {
      const fIdx = this.data.fuel_events.findIndex((f) => f.fleet_event_id === eventId);
      if (fIdx !== -1) {
        this.data.fuel_events[fIdx] = { ...this.data.fuel_events[fIdx], ...fuelUpdates };
      }
    }

    if (maintUpdates) {
      const mIdx = this.data.maintenance_events.findIndex((m) => m.fleet_event_id === eventId);
      if (mIdx !== -1) {
        this.data.maintenance_events[mIdx] = { ...this.data.maintenance_events[mIdx], ...maintUpdates };
      }
    }

    this.saveDatabase();
    this.syncDocToFirestore(['companies', companyId, 'events', eventId], this.data.fleet_events[idx]);
    return this.data.fleet_events[idx];
  }

  // AI Extraction
  public saveAiExtraction(extractionData: Omit<AiExtraction, 'id' | 'created_at'>): AiExtraction {
    const id = `aix-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const newExtraction: AiExtraction = {
      ...extractionData,
      id,
      created_at: new Date().toISOString(),
    };
    this.data.ai_extractions.push(newExtraction);
    this.saveDatabase();
    return newExtraction;
  }

  // Automatic Validations
  public saveValidations(validations: Omit<AutomaticValidation, 'id' | 'created_at'>[]): AutomaticValidation[] {
    const saved: AutomaticValidation[] = validations.map((v) => ({
      ...v,
      id: `val-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      created_at: new Date().toISOString(),
    }));
    this.data.automatic_validations.push(...saved);
    this.saveDatabase();
    return saved;
  }

  // Audit Logs
  public logAudit(
    companyId: string,
    userId: string,
    action: string,
    entity: string,
    entityId: string,
    details?: Record<string, any>,
    ip?: string
  ): AuditLog {
    const user = this.getUser(userId);
    const newLog: AuditLog = {
      id: `aud-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      company_id: companyId,
      user_id: userId,
      user_name: user?.name || 'Sistema',
      action,
      entity,
      entity_id: entityId,
      details,
      ip: ip || '127.0.0.1',
      created_at: new Date().toISOString(),
    };
    this.data.audit_logs.push(newLog);
    this.saveDatabase();
    return newLog;
  }

  public getAuditLogs(companyId: string, limit = 50): AuditLog[] {
    return this.data.audit_logs
      .filter((a) => a.company_id === companyId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);
  }

  // Notifications
  public createNotification(notification: Omit<Notification, 'id' | 'created_at'>): Notification {
    const newNotif: Notification = {
      ...notification,
      id: `notif-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      created_at: new Date().toISOString(),
    };
    this.data.notifications.push(newNotif);
    this.saveDatabase();
    return newNotif;
  }

  public getNotifications(companyId: string, userId?: string): Notification[] {
    return this.data.notifications
      .filter((n) => n.company_id === companyId && (!n.user_id || n.user_id === userId))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public markNotificationRead(companyId: string, notifId: string): boolean {
    const notif = this.data.notifications.find((n) => n.company_id === companyId && n.id === notifId);
    if (!notif) return false;
    notif.read = true;
    this.saveDatabase();
    return true;
  }

  // Dashboard Metrics & Indicators
  public getDashboardMetrics(companyId: string) {
    const vehicles = this.data.vehicles.filter((v) => v.company_id === companyId);
    const drivers = this.data.drivers.filter((d) => d.company_id === companyId);
    const events = this.data.fleet_events.filter((e) => e.company_id === companyId && e.status === 'confirmed');
    const fuelEvents = this.data.fuel_events.filter((f) => f.company_id === companyId);
    const maintEvents = this.data.maintenance_events.filter((m) => m.company_id === companyId);

    // 1. Resumo Frota
    const totalVehicles = vehicles.length;
    const activeVehicles = vehicles.filter((v) => v.status === 'ativo').length;
    const maintenanceVehicles = vehicles.filter((v) => v.status === 'manutencao').length;
    const totalDrivers = drivers.length;
    const activeDrivers = drivers.filter((d) => d.status === 'ativo').length;

    // 2. Km rodado total acumulado na frota
    const totalKmDriven = vehicles.reduce((sum, v) => sum + Math.max(0, v.current_km - v.initial_km), 0);

    // 3. Gastos totais e por categoria
    let totalFuelSpend = 0;
    let totalLiters = 0;
    fuelEvents.forEach((f) => {
      const parent = events.find((e) => e.id === f.fleet_event_id);
      if (parent) {
        totalFuelSpend += parent.total_amount;
        totalLiters += f.liters || 0;
      }
    });

    let totalPartsSpend = 0;
    let totalLaborSpend = 0;
    maintEvents.forEach((m) => {
      totalPartsSpend += m.parts_cost || 0;
      totalLaborSpend += m.labor_cost || 0;
    });

    const totalMaintenanceSpend = totalPartsSpend + totalLaborSpend;
    const totalFleetSpend = totalFuelSpend + totalMaintenanceSpend;

    // 4. Indicadores de eficiência
    // Consumo médio km/L da frota (considerando apenas trechos calculados)
    const validFuelWithDelta = fuelEvents.filter((f) => f.calculated_km_delta && f.liters && f.calculated_km_delta > 0);
    const totalDeltaKm = validFuelWithDelta.reduce((sum, f) => sum + (f.calculated_km_delta || 0), 0);
    const totalDeltaLiters = validFuelWithDelta.reduce((sum, f) => sum + (f.liters || 0), 0);
    const averageKmLiter = totalDeltaLiters > 0 ? Number((totalDeltaKm / totalDeltaLiters).toFixed(2)) : 0;

    // Custo por km (R$/km)
    const costPerKm = totalKmDriven > 0 ? Number((totalFleetSpend / totalKmDriven).toFixed(2)) : 0;

    // 5. Alertas de Próximas Manutenções
    const upcomingMaintenances = vehicles
      .filter((v) => v.next_maintenance_km && v.status !== 'inativo')
      .map((v) => {
        const kmUntil = (v.next_maintenance_km || 0) - v.current_km;
        const isOverdue = kmUntil <= 0;
        const isNear = kmUntil > 0 && kmUntil <= 2000;
        return {
          vehicleId: v.id,
          plate: v.plate,
          model: v.model,
          currentKm: v.current_km,
          nextMaintenanceKm: v.next_maintenance_km,
          kmUntil,
          isOverdue,
          isNear,
          description: v.next_maintenance_desc || 'Revisão periódica',
        };
      })
      .filter((m) => m.isOverdue || m.isNear)
      .sort((a, b) => a.kmUntil - b.kmUntil);

    // 6. Eventos pendentes de revisão/aprovação
    const pendingEvents = this.data.fleet_events
      .filter((e) => e.company_id === companyId && (e.status === 'pending_confirmation' || e.status === 'corrected'))
      .map((e) => this.enrichFleetEvent(companyId, e));

    return {
      fleetSummary: {
        totalVehicles,
        activeVehicles,
        maintenanceVehicles,
        totalDrivers,
        activeDrivers,
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
      },
      upcomingMaintenances,
      pendingEventsCount: pendingEvents.length,
      pendingEvents,
    };
  }
  public saveDailyInsights(companyId: string, insights: any): void {
    if (!(this.data as any).daily_insights) {
      (this.data as any).daily_insights = [];
    }
    const list = (this.data as any).daily_insights;
    const existingIndex = list.findIndex(
      (i: any) => i.empresaId === companyId && i.date === insights.date
    );
    if (existingIndex >= 0) {
      list[existingIndex] = insights;
    } else {
      list.unshift(insights);
    }
    this.saveDatabase();
    const docKey = insights.id || insights.date || `insight-${Date.now()}`;
    this.syncDocToFirestore(['companies', companyId, 'dailyInsights', docKey], insights);
  }

  public getLatestDailyInsights(companyId: string): any | null {
    const list = (this.data as any).daily_insights || [];
    return list.find((i: any) => i.empresaId === companyId) || null;
  }

  public listDailyInsights(companyId: string): any[] {
    const list = (this.data as any).daily_insights || [];
    return list.filter((i: any) => i.empresaId === companyId);
  }
}

export const db = new FleetDatabase();
