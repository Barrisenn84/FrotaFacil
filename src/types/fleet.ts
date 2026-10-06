export type UserRole = 'motorista' | 'administrativo';
export type VehicleStatus = 'ativo' | 'manutencao' | 'inativo';
export type FuelType = 'Gasolina Comum' | 'Gasolina Aditivada' | 'Etanol' | 'Diesel S10' | 'Diesel Comum' | 'GNV' | 'Outro';
export type MaintenanceType = 'preventiva' | 'corretiva';
export type EventType = 'fuel' | 'maintenance';
export type EventStatus = 'draft' | 'processing' | 'pending_confirmation' | 'confirmed' | 'corrected' | 'rejected';
export type ValidationSeverity = 'INFO' | 'WARNING' | 'BLOCKING';

export interface Empresa {
  id: string;
  nome: string;
  cnpj: string;
  dataCriacao: string;
  adminUid?: string;
  maxTankMarginPercent?: number;
  status?: 'active' | 'suspended';
  sheets_spreadsheet_id?: string;
  sheets_spreadsheet_url?: string;
  sheets_synced_at?: string;
  sheets_auto_sync?: boolean;
}

export interface Company {
  id: string;
  name: string;
  cnpj: string;
  maxTankMarginPercent: number;
  status: 'active' | 'suspended';
  created_at: string;
  empresaId?: string;
  dataCriacao?: string;
  adminUid?: string;
  sheets_spreadsheet_id?: string;
  sheets_spreadsheet_url?: string;
  sheets_synced_at?: string;
  sheets_auto_sync?: boolean;
}

export interface User {
  id: string;
  empresaId?: string;
  company_id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar_url?: string;
  active: boolean;
  created_at: string;
}

export interface Driver {
  id: string;
  empresaId?: string;
  company_id: string;
  user_id?: string;
  uid?: string;
  name: string;
  email: string;
  phone: string;
  cnh: string;
  cnh_category: string;
  cnh_expiration: string;
  status: 'ativo' | 'inativo';
  veiculosAutorizados?: string[];
  created_at: string;
}

export interface Vehicle {
  id: string;
  empresaId?: string;
  company_id: string;
  plate: string;
  chassi: string;
  renavam: string;
  make: string;
  model: string;
  year: number;
  fuel_type: FuelType;
  tank_capacity_liters: number;
  kmInicial?: number;
  initial_km: number;
  kmAtual?: number;
  current_km: number;
  status: VehicleStatus;
  motoristaAtualId?: string;
  next_maintenance_km?: number;
  next_maintenance_desc?: string;
  created_at: string;
}

export interface Abastecimento {
  id: string;
  empresaId: string;
  veiculoId: string;
  motoristaId: string;
  motoristaUid?: string;
  data: string;
  odometro: number;
  posto: string;
  cnpjPosto?: string;
  combustivel: FuelType;
  litros: number;
  precoLitro: number;
  valorTotal: number;
  tanqueCheio?: boolean;
  comprovanteUrl?: string;
  comprovanteHash?: string;
  odometroFotoUrl?: string;
  status: string;
  created_at?: string;
}

export interface Manutencao {
  id: string;
  empresaId: string;
  veiculoId: string;
  motoristaId?: string;
  motoristaUid?: string;
  data: string;
  odometro: number;
  tipo: MaintenanceType;
  oficina: string;
  descricao: string;
  custoPecas: number;
  custoMaoDeObra: number;
  valorTotal: number;
  status: string;
  created_at?: string;
}

export interface Multa {
  id: string;
  empresaId: string;
  veiculoId: string;
  motoristaId?: string;
  data: string;
  codigoInfracao: string;
  descricao: string;
  valor: number;
  pontos: number;
  status: 'pendente' | 'pago' | 'recorrido';
  created_at?: string;
}

export interface Seguro {
  id: string;
  empresaId: string;
  veiculoId: string;
  seguradora: string;
  apoliceNumero: string;
  inicioVigencia: string;
  fimVigencia: string;
  valorFranquia: number;
  valorPremio: number;
  status?: 'ativo' | 'vencido';
  created_at?: string;
}

export interface DocumentoVeiculo {
  id: string;
  empresaId: string;
  veiculoId: string;
  tipo: 'CRLV' | 'Laudo' | 'Tacógrafo' | 'Outro';
  exercicio: number;
  dataEmissao: string;
  dataVencimento?: string;
  arquivoUrl?: string;
  created_at?: string;
}

export interface VehicleDriverLink {
  id: string;
  empresaId?: string;
  company_id: string;
  vehicle_id: string;
  driver_id: string;
  started_at: string;
  ended_at?: string | null;
  is_active: boolean;
  notes?: string;
  created_by?: string;
  created_at: string;
  vehicle?: Vehicle;
  driver?: Driver;
}

export interface EvidenceFile {
  id: string;
  company_id: string;
  fleet_event_id?: string;
  file_path: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  sha256_hash: string;
  upload_type: 'receipt' | 'odometer' | 'other';
  created_at: string;
}

export interface QuickQuestion {
  id: string;
  field: string;
  question: string;
  reason: string;
  options?: string[];
  suggestedValue?: string | number;
  answeredValue?: string | number;
}

export interface AiExtraction {
  id: string;
  company_id: string;
  fleet_event_id: string;
  model: string;
  prompt_version: string;
  latency_ms: number;
  overall_confidence: number;
  field_confidences: Record<string, number>;
  raw_response: any;
  normalized_data: any;
  quick_questions: QuickQuestion[];
  created_at: string;
}

export interface AutomaticValidation {
  id: string;
  company_id: string;
  fleet_event_id: string;
  rule_name: 'ODOMETER_CHECK' | 'TANK_CAPACITY_CHECK' | 'FUTURE_DATE_CHECK' | 'DUPLICATE_IMAGE_CHECK' | 'AUTHORIZED_DRIVER_CHECK' | 'CONFIDENCE_THRESHOLD';
  passed: boolean;
  severity: ValidationSeverity;
  message: string;
  details?: Record<string, any>;
  created_at: string;
}

export interface FuelDetail {
  id: string;
  fleet_event_id: string;
  company_id: string;
  gas_station_name: string;
  cnpj?: string;
  fuel_type: FuelType;
  liters: number;
  price_per_liter: number;
  is_full_tank: boolean;
  calculated_km_delta?: number;
  calculated_km_per_liter?: number;
  calculated_cost_per_km?: number;
}

export interface MaintenanceDetail {
  id: string;
  fleet_event_id: string;
  company_id: string;
  workshop_name: string;
  cnpj?: string;
  maintenance_type: MaintenanceType;
  parts_cost: number;
  labor_cost: number;
  items_description: string;
  next_suggested_km?: number;
}

export interface FleetEvent {
  id: string;
  empresaId?: string;
  company_id: string;
  vehicle_id: string;
  driver_id: string;
  event_type: EventType;
  status: EventStatus;
  event_date: string;
  odometer: number;
  total_amount: number;
  evidence_file_id?: string;
  evidence_secondary_id?: string;
  notes?: string;
  correction_justification?: string;
  rejection_reason?: string;
  created_by: string;
  confirmed_by?: string;
  confirmed_at?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  vehicle?: Vehicle;
  driver?: Driver;
  evidence?: EvidenceFile;
  secondaryEvidence?: EvidenceFile;
  fuelDetail?: FuelDetail;
  maintenanceDetail?: MaintenanceDetail;
  validations?: AutomaticValidation[];
  extraction?: AiExtraction;
}

export interface AuditLog {
  id: string;
  company_id: string;
  user_id: string;
  user_name?: string;
  action: string;
  entity: string;
  entity_id: string;
  details?: Record<string, any>;
  ip?: string;
  created_at: string;
}

export interface Notification {
  id: string;
  company_id: string;
  user_id?: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  read: boolean;
  link_event_id?: string;
  created_at: string;
}

export interface DashboardMetrics {
  fleetSummary: {
    totalVehicles: number;
    activeVehicles: number;
    maintenanceVehicles: number;
    totalDrivers: number;
    activeDrivers: number;
  };
  indicators: {
    totalKmDriven: number;
    averageKmLiter: number;
    costPerKm: number;
    totalFleetSpend: number;
    totalFuelSpend: number;
    totalMaintenanceSpend: number;
    totalPartsSpend: number;
    totalLaborSpend: number;
    totalLiters: number;
  };
  upcomingMaintenances: Array<{
    vehicleId: string;
    plate: string;
    model: string;
    currentKm: number;
    nextMaintenanceKm: number;
    kmUntil: number;
    isOverdue: boolean;
    isNear: boolean;
    description: string;
  }>;
  pendingEventsCount: number;
  pendingEvents: FleetEvent[];
}

export interface VehicleDamage {
  id: string;
  local: string; // ex: 'Parachoque Dianteiro Esquerdo', 'Porta Traseira Direita'
  severidade: 'baixa' | 'media' | 'alta';
  descricao: string;
  recomendacao: string;
}

export interface TireAnalysis {
  desgastePneuMm: number; // Profundidade do sulco em milímetros
  condicao: 'excelente' | 'bom' | 'alerta' | 'critico';
  limiteLegalMm: number; // 1.6 mm padrão TWI Brasil
  kmRestantesEstimados: number; // Calculado via Code Execution
  calculoExplicacao?: string;
  recomendacao: string;
}

export interface VehicleInspection {
  id: string;
  empresaId: string;
  veiculoId: string;
  motoristaId?: string;
  motoristaNome?: string;
  data: string;
  odometro: number;
  status: 'concluida' | 'alerta' | 'critica';
  fotos: {
    dianteiraEsquerda: string;
    dianteiraDireita: string;
    traseiraDireita: string;
    traseiraEsquerda: string;
    pneu: string;
  };
  fotoAnotadaUrl?: string; // Gerada via Nano Banana 2 (gemini-3.1-flash-image)
  avarias: VehicleDamage[];
  analisePneu: TireAnalysis;
  resumoGeral: string;
  aprovado: boolean;
  created_at: string;
}

export interface OfflineDraft {
  localId: string;
  companyId: string;
  vehicleId: string;
  type: 'abastecimento' | 'manutencao';
  receiptImageBase64: string;
  odometerImageBase64?: string;
  capturedAt: string;
  odometerTyped?: number;
  notes?: string;
}

// --- MULTI-AGENT FLEET INTELLIGENCE & NIGHTLY BATCH INSIGHTS ---

export interface CityFuelComparison {
  vehiclePlate: string;
  vehicleModel: string;
  city: string;
  fuelType: string;
  paidPricePerLiter: number;
  cityAvgPricePerLiter: number;
  differencePerLiter: number; // positive = paid more than average
  totalOverpaid: number;
  date: string;
  status: 'normal' | 'acima_da_media' | 'muito_acima';
  message: string;
  sourceUri?: string;
  sourceTitle?: string;
}

export interface PredictiveMaintenanceInsight {
  vehicleId: string;
  vehiclePlate: string;
  vehicleModel: string;
  currentKm: number;
  targetKm: number;
  kmRemaining: number;
  estimatedDaysToTarget: number;
  targetDateEstimated: string;
  serviceDescription: string;
  urgency: 'baixa' | 'media' | 'alta' | 'critica';
  suggestedActionText: string;
  scheduledPrompt: string; // ex: "A Saveiro ABC1D23 bate 10.000 km em 6 dias — agendo a revisão?"
  autoSchedulePayload: {
    vehicleId: string;
    vehiclePlate: string;
    maintenanceType: string;
    suggestedDate: string;
    estimatedKm: number;
  };
}

export interface VehicleFinancialConsolidation {
  vehicleId: string;
  vehiclePlate: string;
  vehicleModel: string;
  totalCostBrl: number;
  fuelCostBrl: number;
  maintenanceCostBrl: number;
  finesCostBrl: number;
  totalKmDriven: number;
  costPerKm: number; // R$/km
  monthlyTrendPercent: number; // ex: +4.2% vs previous month
  tcoScore: 'otimo' | 'moderado' | 'alto_risco';
  tcoInsight: string;
}

export interface ComplianceDocumentAlert {
  id: string;
  vehiclePlate?: string;
  driverName?: string;
  type: 'crlv' | 'seguro' | 'ipva' | 'tacografo' | 'cnh' | 'multa';
  title: string;
  dueDate: string;
  daysRemaining: number;
  isExpired: boolean;
  fineAmount?: number;
  recommendation: string;
}

export interface DailyFleetInsights {
  id: string;
  empresaId: string;
  date: string; // YYYY-MM-DD
  generatedAt: string;
  executionMode: 'batch_job_nightly' | 'on_demand';
  contextCacheUsed: boolean;
  totalVehiclesAnalyzed: number;
  totalEventsAnalyzed: number;
  summaryHeadline: string;
  // 1. Agente Fiscal
  agenteFiscal: {
    status: 'ok' | 'alerta' | 'divergencias_encontradas';
    inconsistenciasDetectadas: number;
    comparativosPrecoCidade: CityFuelComparison[];
    economiaPotencialMensalBrl: number;
    parecerExecutivo: string;
  };
  // 2. Agente Mecânico
  agenteMecanico: {
    status: 'ok' | 'alerta' | 'manutencoes_urgentes';
    projecoesPreditivas: PredictiveMaintenanceInsight[];
    veiculosEmRiscoKm: number;
    parecerExecutivo: string;
  };
  // 3. Agente Financeiro
  agenteFinanceiro: {
    custoTotalFrotaBrl: number;
    custoMedioPorKm: number;
    tendenciaMensalPercent: number;
    veiculosConsolidacao: VehicleFinancialConsolidation[];
    maiorOfensorCustoPlaca: string;
    parecerExecutivo: string;
  };
  // 4. Agente de Compliance
  agenteCompliance: {
    status: 'conforme' | 'alerta' | 'irregularidades';
    alertasDocumentos: ComplianceDocumentAlert[];
    multasPendentesValorTotal: number;
    parecerExecutivo: string;
  };
}



