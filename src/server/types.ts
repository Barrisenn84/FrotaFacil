import { z } from 'zod';

export type UserRole = 'motorista' | 'administrativo';
export type VehicleStatus = 'ativo' | 'manutencao' | 'inativo';
export type FuelType = 'Gasolina Comum' | 'Gasolina Aditivada' | 'Etanol' | 'Diesel S10' | 'Diesel Comum' | 'GNV' | 'Outro';
export type MaintenanceType = 'preventiva' | 'corretiva';
export type EventType = 'fuel' | 'maintenance';
export type EventStatus = 'draft' | 'processing' | 'pending_confirmation' | 'confirmed' | 'corrected' | 'rejected';
export type ValidationSeverity = 'INFO' | 'WARNING' | 'BLOCKING';

// 1. Company
export interface Company {
  id: string;
  name: string;
  cnpj: string;
  maxTankMarginPercent: number; // default 10%
  status: 'active' | 'suspended';
  created_at: string;
}

// 2. User
export interface User {
  id: string;
  company_id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar_url?: string;
  active: boolean;
  created_at: string;
}

// 3. Driver
export interface Driver {
  id: string;
  company_id: string;
  user_id?: string;
  name: string;
  email: string;
  phone: string;
  cnh: string;
  cnh_category: string;
  cnh_expiration: string;
  status: 'ativo' | 'inativo';
  created_at: string;
}

// 4. Vehicle
export interface Vehicle {
  id: string;
  company_id: string;
  plate: string;
  chassi: string;
  renavam: string;
  make: string;
  model: string;
  year: number;
  fuel_type: FuelType;
  tank_capacity_liters: number;
  initial_km: number;
  kmInicial?: number;
  current_km: number;
  kmAtual?: number;
  status: VehicleStatus;
  next_maintenance_km?: number;
  next_maintenance_desc?: string;
  created_at: string;
}

// 5. VehicleDriverLink (Many-to-many relationship with history)
export interface VehicleDriverLink {
  id: string;
  company_id: string;
  vehicle_id: string;
  driver_id: string;
  started_at: string;
  ended_at?: string | null;
  is_active: boolean;
  notes?: string;
  created_by?: string;
  created_at: string;
}

// 6. EvidenceFile
export interface EvidenceFile {
  id: string;
  company_id: string;
  fleet_event_id?: string;
  file_path: string; // or base64 / data url / local upload path
  original_name: string;
  mime_type: string;
  file_size: number;
  sha256_hash: string;
  upload_type: 'receipt' | 'odometer' | 'other';
  created_at: string;
}

// 7. FleetEvent
export interface FleetEvent {
  id: string;
  company_id: string;
  vehicle_id: string;
  driver_id: string;
  event_type: EventType;
  status: EventStatus;
  event_date: string; // YYYY-MM-DD
  odometer: number;
  total_amount: number;
  evidence_file_id?: string;
  evidence_secondary_id?: string; // odometer photo
  notes?: string;
  correction_justification?: string;
  rejection_reason?: string;
  created_by: string;
  confirmed_by?: string;
  confirmed_at?: string;
  created_at: string;
  updated_at: string;
}

// 8. FuelEvent
export interface FuelEvent {
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

// 9. MaintenanceEvent
export interface MaintenanceEvent {
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

// 10. AiExtraction
export interface FieldConfidence {
  field: string;
  confidence: number; // 0.0 to 1.0
  isLow: boolean;
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

// 11. AutomaticValidation
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

// 12. AuditLog
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

// 13. Notification
export interface Notification {
  id: string;
  company_id: string;
  user_id?: string; // if null, broadcasts to company admins
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  read: boolean;
  link_event_id?: string;
  created_at: string;
}

// Zod schemas for input validation
export const VehicleInputSchema = z.object({
  plate: z.string().min(7).max(8).toUpperCase(),
  chassi: z.string().min(5),
  renavam: z.string().min(5),
  make: z.string().min(2),
  model: z.string().min(2),
  year: z.number().int().min(1980).max(2035),
  fuel_type: z.enum(['Gasolina Comum', 'Gasolina Aditivada', 'Etanol', 'Diesel S10', 'Diesel Comum', 'GNV', 'Outro']),
  tank_capacity_liters: z.number().positive(),
  initial_km: z.number().nonnegative(),
  current_km: z.number().nonnegative(),
  status: z.enum(['ativo', 'manutencao', 'inativo']).default('ativo'),
  next_maintenance_km: z.number().optional(),
  next_maintenance_desc: z.string().optional(),
});

export const DriverInputSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(8),
  cnh: z.string().min(5),
  cnh_category: z.string().min(1).max(3),
  cnh_expiration: z.string().min(8),
  status: z.enum(['ativo', 'inativo']).default('ativo'),
  create_user_account: z.boolean().optional(),
});

export const VehicleDriverLinkInputSchema = z.object({
  vehicle_id: z.string().min(1),
  driver_id: z.string().min(1),
  notes: z.string().optional(),
});

export const EventConfirmInputSchema = z.object({
  event_id: z.string().min(1),
  odometer: z.number().positive(),
  event_date: z.string().min(8),
  total_amount: z.number().nonnegative(),
  notes: z.string().optional(),
  correction_justification: z.string().optional(),
  // For fuel
  gas_station_name: z.string().optional(),
  liters: z.number().positive().optional(),
  price_per_liter: z.number().positive().optional(),
  fuel_type: z.string().optional(),
  is_full_tank: z.boolean().optional(),
  // For maintenance
  workshop_name: z.string().optional(),
  maintenance_type: z.enum(['preventiva', 'corretiva']).optional(),
  parts_cost: z.number().nonnegative().optional(),
  labor_cost: z.number().nonnegative().optional(),
  items_description: z.string().optional(),
  next_suggested_km: z.number().optional(),
  // Answered questions
  quick_answers: z.record(z.string(), z.any()).optional(),
});
