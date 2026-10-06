import { db } from './db.js';
import { AutomaticValidation, FleetEvent, Vehicle } from './types.js';

export interface ValidationCheckResult {
  passed: boolean;
  hasBlockingError: boolean;
  validations: Omit<AutomaticValidation, 'id' | 'created_at'>[];
}

export function runBusinessValidations(params: {
  companyId: string;
  vehicle: Vehicle;
  driverId: string;
  odometer: number;
  eventDate: string;
  eventType: 'fuel' | 'maintenance';
  liters?: number;
  imageHash?: string;
  correctionJustification?: string;
  fieldConfidences?: Record<string, number>;
}): ValidationCheckResult {
  const {
    companyId,
    vehicle,
    driverId,
    odometer,
    eventDate,
    eventType,
    liters,
    imageHash,
    correctionJustification,
    fieldConfidences,
  } = params;

  const validations: Omit<AutomaticValidation, 'id' | 'created_at'>[] = [];
  let hasBlockingError = false;

  const company = db.getCompany(companyId);
  const maxMargin = company?.maxTankMarginPercent || 10;

  // 1. Validação de Vínculo Motorista <-> Veículo
  const activeLinks = db.getLinks(companyId, vehicle.id, driverId).filter((l) => l.is_active);
  if (activeLinks.length === 0) {
    validations.push({
      company_id: companyId,
      fleet_event_id: '',
      rule_name: 'AUTHORIZED_DRIVER_CHECK',
      passed: false,
      severity: 'WARNING',
      message: `Motorista não possui vínculo formal ativo cadastrado com o veículo ${vehicle.plate}. Operação permitida sob auditoria especial.`,
      details: { vehicleId: vehicle.id, driverId },
    });
  } else {
    validations.push({
      company_id: companyId,
      fleet_event_id: '',
      rule_name: 'AUTHORIZED_DRIVER_CHECK',
      passed: true,
      severity: 'INFO',
      message: `Vínculo ativo regular confirmado entre motorista e veículo ${vehicle.plate}.`,
      details: { linkId: activeLinks[0].id },
    });
  }

  // 2. Validação de Data Futura
  const eventDateTime = new Date(`${eventDate}T23:59:59`).getTime();
  const now = new Date().getTime();
  const isFuture = eventDateTime > now + 24 * 60 * 60 * 1000; // tolerância de fuso de 24h

  if (isFuture) {
    hasBlockingError = true;
    validations.push({
      company_id: companyId,
      fleet_event_id: '',
      rule_name: 'FUTURE_DATE_CHECK',
      passed: false,
      severity: 'BLOCKING',
      message: `Data do evento (${eventDate}) é posterior à data atual. Registros com datas futuras são estritamente bloqueados.`,
      details: { eventDate, currentDate: new Date().toISOString().split('T')[0] },
    });
  } else {
    validations.push({
      company_id: companyId,
      fleet_event_id: '',
      rule_name: 'FUTURE_DATE_CHECK',
      passed: true,
      severity: 'INFO',
      message: `Data (${eventDate}) compatível com o calendário fiscal.`,
      details: { eventDate },
    });
  }

  // 3. Validação de Odômetro (não pode ser menor que current_km sem justificativa)
  const currentKm = vehicle.current_km || 0;
  if (odometer < currentKm) {
    if (!correctionJustification || correctionJustification.trim().length < 5) {
      hasBlockingError = true;
      validations.push({
        company_id: companyId,
        fleet_event_id: '',
        rule_name: 'ODOMETER_CHECK',
        passed: false,
        severity: 'BLOCKING',
        message: `Odômetro informado (${odometer.toLocaleString()} km) é INFERIOR à quilometragem atual do veículo (${currentKm.toLocaleString()} km). Exige justificativa formal de troca de painel ou retificação.`,
        details: { odometer, currentKm, deficit: currentKm - odometer },
      });
    } else {
      validations.push({
        company_id: companyId,
        fleet_event_id: '',
        rule_name: 'ODOMETER_CHECK',
        passed: false,
        severity: 'WARNING',
        message: `Odômetro regrediu de ${currentKm.toLocaleString()} km para ${odometer.toLocaleString()} km com justificativa aprovada: "${correctionJustification}".`,
        details: { odometer, currentKm, justification: correctionJustification },
      });
    }
  } else {
    const kmDelta = odometer - currentKm;
    if (kmDelta > 2500) {
      validations.push({
        company_id: companyId,
        fleet_event_id: '',
        rule_name: 'ODOMETER_CHECK',
        passed: true,
        severity: 'WARNING',
        message: `Salto expressivo de quilometragem (+${kmDelta.toLocaleString()} km em relação aos ${currentKm.toLocaleString()} km anteriores). Verifique se o valor não possui dígito a mais.`,
        details: { odometer, currentKm, delta: kmDelta },
      });
    } else {
      validations.push({
        company_id: companyId,
        fleet_event_id: '',
        rule_name: 'ODOMETER_CHECK',
        passed: true,
        severity: 'INFO',
        message: `Odômetro consistente: avanço de +${kmDelta.toLocaleString()} km sobre a marca anterior (${currentKm.toLocaleString()} km).`,
        details: { odometer, currentKm, delta: kmDelta },
      });
    }
  }

  // 4. Validação de Capacidade de Tanque (para eventos de abastecimento)
  if (eventType === 'fuel' && liters !== undefined && liters > 0) {
    const tankCapacity = vehicle.tank_capacity_liters || 55;
    const maxAllowedLiters = tankCapacity * (1 + maxMargin / 100);

    if (liters > maxAllowedLiters) {
      hasBlockingError = true;
      validations.push({
        company_id: companyId,
        fleet_event_id: '',
        rule_name: 'TANK_CAPACITY_CHECK',
        passed: false,
        severity: 'BLOCKING',
        message: `Volume abastecido (${liters.toFixed(2)} L) excede a capacidade máxima do tanque do veículo ${vehicle.plate} (${tankCapacity} L + margem ${maxMargin}% = máx ${maxAllowedLiters.toFixed(2)} L). Risco de fraude ou desvio.`,
        details: { liters, tankCapacity, maxAllowedLiters, excess: liters - maxAllowedLiters },
      });
    } else {
      const percentage = (liters / tankCapacity) * 100;
      validations.push({
        company_id: companyId,
        fleet_event_id: '',
        rule_name: 'TANK_CAPACITY_CHECK',
        passed: true,
        severity: 'INFO',
        message: `Volume de ${liters.toFixed(2)} L compatível com a capacidade do tanque de ${tankCapacity} L (${percentage.toFixed(1)}%).`,
        details: { liters, tankCapacity, percentage },
      });
    }
  }

  // 5. Validação de Imagem Duplicada (Detecção por Hash SHA-256)
  if (imageHash) {
    const existing = db.findEvidenceByHash(companyId, imageHash);
    if (existing) {
      validations.push({
        company_id: companyId,
        fleet_event_id: '',
        rule_name: 'DUPLICATE_IMAGE_CHECK',
        passed: false,
        severity: 'WARNING',
        message: `ALERTA DE DUPLICIDADE: A fotografia enviada possui hash SHA-256 idêntico a um comprovante já registrado anteriormente (Evidência #${existing.id}).`,
        details: { existingEvidenceId: existing.id, hash: imageHash },
      });
    } else {
      validations.push({
        company_id: companyId,
        fleet_event_id: '',
        rule_name: 'DUPLICATE_IMAGE_CHECK',
        passed: true,
        severity: 'INFO',
        message: 'Comprovante único. Nenhuma duplicidade de hash detectada na base corporativa.',
        details: { hash: imageHash },
      });
    }
  }

  // 6. Validação de Confiança de Campos Críticos da IA
  if (fieldConfidences) {
    const criticalFields = ['valorTotal', 'odometro', 'litros', 'data'];
    const lowConfidenceFields: string[] = [];

    criticalFields.forEach((field) => {
      const conf = fieldConfidences[field];
      if (conf !== undefined && conf < 0.70) {
        lowConfidenceFields.push(`${field} (${Math.round(conf * 100)}%)`);
      }
    });

    if (lowConfidenceFields.length > 0) {
      validations.push({
        company_id: companyId,
        fleet_event_id: '',
        rule_name: 'CONFIDENCE_THRESHOLD',
        passed: false,
        severity: 'WARNING',
        message: `Campos críticos com baixa confiança de leitura na foto: ${lowConfidenceFields.join(', ')}. Confirmação humana obrigatória antes da finalização.`,
        details: { lowConfidenceFields },
      });
    } else {
      validations.push({
        company_id: companyId,
        fleet_event_id: '',
        rule_name: 'CONFIDENCE_THRESHOLD',
        passed: true,
        severity: 'INFO',
        message: 'Todos os campos críticos foram extraídos com índice de confiança seguro (≥ 70%).',
        details: { fieldConfidences },
      });
    }
  }

  const allPassed = validations.every((v) => v.passed);

  return {
    passed: allPassed,
    hasBlockingError,
    validations,
  };
}
