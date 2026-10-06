import { Router, Response } from 'express';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { db } from './db.js';
import {
  AuthenticatedRequest,
  authMiddleware,
  requireAuth,
  requireAdmin,
  generateAuthToken,
} from './authMiddleware.js';
import { extractReceiptWithAI } from './aiService.js';
import { inspectVehicleWithAI } from './inspectionService.js';
import {
  runNightlyBatchFleetAnalysis,
  runFiscalAgent,
  runMechanicalAgent,
  runFinancialAgent,
  runComplianceAgent,
  getOrBuildFleetContextCache,
  generateGestorDailySpokenSummary,
} from './fleetAgents.js';
import { runBusinessValidations } from './validationEngine.js';
import {
  VehicleInputSchema,
  DriverInputSchema,
  VehicleDriverLinkInputSchema,
  EventConfirmInputSchema,
} from './types.js';

export const apiRouter = Router();

apiRouter.use(authMiddleware);

// --- 1. AUTENTICAÇÃO E MULTIEMPRESA ---
apiRouter.get('/auth/companies', (req, res) => {
  const companies = db.getCompanies();
  res.json({ success: true, companies });
});

apiRouter.get('/auth/users', (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.company!.id;
  const users = db.getUsersByCompany(companyId);
  res.json({ success: true, users });
});

apiRouter.post('/auth/login', (req, res) => {
  const { email, companyId } = req.body;
  const targetCompanyId = companyId || 'comp-translog-01';
  const company = db.getCompany(targetCompanyId);

  if (!company) {
    return res.status(404).json({ error: 'Empresa selecionada não existe.' });
  }

  const user = db.getUserByEmail(email);
  if (!user || user.company_id !== targetCompanyId) {
    return res.status(401).json({ error: 'Credenciais inválidas para a empresa selecionada.' });
  }

  let driverProfile = null;
  if (user.role === 'motorista') {
    driverProfile = db.getDriverByUserId(targetCompanyId, user.id);
  }

  // Geração do token criptográfico assinado (HMAC-SHA256)
  const token = generateAuthToken(user, company);

  db.logAudit(
    targetCompanyId,
    user.id,
    'USER_LOGIN',
    'User',
    user.id,
    { email: user.email, role: user.role },
    req.ip
  );

  return res.json({
    success: true,
    token,
    user,
    company,
    driver: driverProfile,
  });
});

// Endpoint para emissão/troca de token de autenticação (ex: pós Google Sign-In)
apiRouter.post('/auth/token', (req, res) => {
  const { userId, email, companyId, role, name } = req.body;
  const targetCompanyId = companyId || 'comp-translog-01';
  const company = db.getCompany(targetCompanyId) || {
    id: targetCompanyId,
    name: 'Empresa Ativa',
    cnpj: '00.000.000/0001-00',
    maxTankMarginPercent: 10,
    status: 'active' as const,
    created_at: new Date().toISOString(),
  };

  const userObj = {
    id: userId || `usr-${Date.now()}`,
    company_id: company.id,
    email: email || 'usuario@frotafacil.com.br',
    name: name || 'Usuário Autenticado',
    role: (role === 'motorista' ? 'motorista' : 'administrativo') as any,
    active: true,
    created_at: new Date().toISOString(),
  };

  const token = generateAuthToken(userObj, company);
  return res.json({
    success: true,
    token,
    user: userObj,
    company,
  });
});

apiRouter.get('/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const company = req.company!;
  let driverProfile = null;
  let linkedVehicles: any[] = [];

  if (user.role === 'motorista') {
    driverProfile = db.getDriverByUserId(company.id, user.id);
    if (driverProfile) {
      linkedVehicles = db.getVehicles(company.id, driverProfile.id);
    }
  } else {
    linkedVehicles = db.getVehicles(company.id);
  }

  return res.json({
    success: true,
    user,
    company,
    driver: driverProfile,
    linkedVehicles,
  });
});

// --- 2. VEÍCULOS ---
apiRouter.get('/vehicles', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.company!.id;
  const user = req.user!;

  if (user.role === 'motorista') {
    const driver = db.getDriverByUserId(companyId, user.id);
    const vehicles = driver ? db.getVehicles(companyId, driver.id) : [];
    return res.json({ success: true, vehicles });
  }

  const vehicles = db.getVehicles(companyId);
  return res.json({ success: true, vehicles });
});

apiRouter.post('/vehicles', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.company!.id;
  const parsed = VehicleInputSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: 'Dados do veículo inválidos.', issues: parsed.error.issues });
  }

  // Verificar placa duplicada na empresa
  const existing = db.getVehicleByPlate(companyId, parsed.data.plate);
  if (existing) {
    return res.status(409).json({ error: `Veículo com a placa ${parsed.data.plate} já está cadastrado nesta empresa.` });
  }

  const newVehicle = db.createVehicle(companyId, parsed.data);

  db.logAudit(
    companyId,
    req.user!.id,
    'VEHICLE_CREATED',
    'Vehicle',
    newVehicle.id,
    { plate: newVehicle.plate, model: newVehicle.model, current_km: newVehicle.current_km },
    req.ip
  );

  return res.status(201).json({ success: true, vehicle: newVehicle });
});

apiRouter.put('/vehicles/:id', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.company!.id;
  const vehicleId = req.params.id;

  const updated = db.updateVehicle(companyId, vehicleId, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'Veículo não encontrado.' });
  }

  db.logAudit(
    companyId,
    req.user!.id,
    'VEHICLE_UPDATED',
    'Vehicle',
    vehicleId,
    req.body,
    req.ip
  );

  return res.json({ success: true, vehicle: updated });
});

apiRouter.get('/vehicles/:id/history', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.company!.id;
  const vehicleId = req.params.id;

  const vehicle = db.getVehicle(companyId, vehicleId);
  if (!vehicle) {
    return res.status(404).json({ error: 'Veículo não encontrado.' });
  }

  const events = db.getFleetEvents(companyId, { vehicleId });
  const links = db.getLinks(companyId, vehicleId);

  return res.json({
    success: true,
    vehicle,
    events,
    driverLinks: links,
  });
});

// --- 3. MOTORISTAS ---
apiRouter.get('/drivers', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.company!.id;
  const drivers = db.getDrivers(companyId);
  return res.json({ success: true, drivers });
});

apiRouter.post('/drivers', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.company!.id;
  const parsed = DriverInputSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: 'Dados do motorista inválidos.', issues: parsed.error.issues });
  }

  // Criar usuário para acesso se solicitado
  let linkedUserId: string | undefined = undefined;
  if (parsed.data.create_user_account) {
    const rawData = db.getRawData();
    linkedUserId = `usr-drv-${Date.now().toString(36)}`;
    rawData.users.push({
      id: linkedUserId,
      company_id: companyId,
      name: parsed.data.name,
      email: parsed.data.email,
      role: 'motorista',
      active: true,
      created_at: new Date().toISOString(),
    });
  }

  const newDriver = db.createDriver(companyId, {
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    cnh: parsed.data.cnh,
    cnh_category: parsed.data.cnh_category,
    cnh_expiration: parsed.data.cnh_expiration,
    status: parsed.data.status,
    user_id: linkedUserId,
  });

  db.logAudit(
    companyId,
    req.user!.id,
    'DRIVER_CREATED',
    'Driver',
    newDriver.id,
    { name: newDriver.name, cnh: newDriver.cnh },
    req.ip
  );

  return res.status(201).json({ success: true, driver: newDriver });
});

apiRouter.put('/drivers/:id', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.company!.id;
  const driverId = req.params.id;

  const updated = db.updateDriver(companyId, driverId, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'Motorista não encontrado.' });
  }

  db.logAudit(
    companyId,
    req.user!.id,
    'DRIVER_UPDATED',
    'Driver',
    driverId,
    req.body,
    req.ip
  );

  return res.json({ success: true, driver: updated });
});

// --- 4. VÍNCULOS MANY-TO-MANY (VEÍCULOS <-> MOTORISTAS) ---
apiRouter.get('/links', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.company!.id;
  const { vehicleId, driverId } = req.query as { vehicleId?: string; driverId?: string };

  const rawLinks = db.getLinks(companyId, vehicleId, driverId);
  const vehicles = db.getVehicles(companyId);
  const drivers = db.getDrivers(companyId);

  const enriched = rawLinks.map((link) => ({
    ...link,
    vehicle: vehicles.find((v) => v.id === link.vehicle_id),
    driver: drivers.find((d) => d.id === link.driver_id),
  }));

  return res.json({ success: true, links: enriched });
});

apiRouter.post('/links', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.company!.id;
  const parsed = VehicleDriverLinkInputSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: 'Dados do vínculo inválidos.', issues: parsed.error.issues });
  }

  const link = db.linkVehicleDriver(
    companyId,
    parsed.data.vehicle_id,
    parsed.data.driver_id,
    parsed.data.notes,
    req.user!.id
  );

  db.logAudit(
    companyId,
    req.user!.id,
    'VEHICLE_DRIVER_LINKED',
    'VehicleDriverLink',
    link.id,
    { vehicleId: link.vehicle_id, driverId: link.driver_id },
    req.ip
  );

  return res.status(201).json({ success: true, link });
});

apiRouter.delete('/links/:id', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.company!.id;
  const linkId = req.params.id;

  const unlinked = db.unlinkVehicleDriver(companyId, linkId);
  if (!unlinked) {
    return res.status(404).json({ error: 'Vínculo não localizado.' });
  }

  db.logAudit(
    companyId,
    req.user!.id,
    'VEHICLE_DRIVER_UNLINKED',
    'VehicleDriverLink',
    linkId,
    {},
    req.ip
  );

  return res.json({ success: true, message: 'Vínculo encerrado com sucesso.' });
});

// --- 5. UPLOAD DE EVIDÊNCIA E VERIFICAÇÃO DE DUPLICIDADE ---
apiRouter.post('/evidence/upload', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.company!.id;
  const { imageBase64, originalName = 'evidencia.jpg', uploadType = 'receipt' } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ error: 'Imagem em base64 não fornecida.' });
  }

  const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
  const sha256Hash = crypto.createHash('sha256').update(cleanBase64).digest('hex');

  // Verificar se há duplicidade imediata
  const existing = db.findEvidenceByHash(companyId, sha256Hash);

  const evidence = db.saveEvidenceFile({
    company_id: companyId,
    file_path: imageBase64, // armazenamento seguro da evidência
    original_name: originalName,
    mime_type: 'image/jpeg',
    file_size: Math.round(cleanBase64.length * 0.75),
    sha256_hash: sha256Hash,
    upload_type: uploadType,
  });

  return res.json({
    success: true,
    evidence,
    isDuplicate: Boolean(existing),
    existingEvidenceId: existing?.id,
  });
});

// --- 6. EXTRAÇÃO POR IA E VALIDAÇÕES AUTOMÁTICAS ---
apiRouter.post('/ai/extract-receipt', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const companyId = req.company!.id;
    const user = req.user!;
    const {
      imageBase64,
      receiptImageBase64,
      odometerImageBase64,
      type = 'abastecimento',
      vehicleId,
    } = req.body;

    const receiptImg = receiptImageBase64 || imageBase64;
    if (!receiptImg) {
      return res.status(400).json({ error: 'Nenhuma foto do comprovante foi enviada.' });
    }

    // Identificar veículo
    let vehicle = vehicleId ? db.getVehicle(companyId, vehicleId) : undefined;
    if (!vehicle) {
      // Se não especificado, pega o primeiro veículo ativo
      const vehicles = db.getVehicles(companyId);
      if (vehicles.length === 0) {
        return res.status(400).json({ error: 'Nenhum veículo cadastrado na empresa.' });
      }
      vehicle = vehicles[0];
    }

    // Identificar motorista
    let driverId = '';
    if (user.role === 'motorista') {
      const drv = db.getDriverByUserId(companyId, user.id);
      driverId = drv?.id || '';
    } else {
      const allDrivers = db.getDrivers(companyId);
      driverId = allDrivers[0]?.id || '';
    }

    // Calcular Hash SHA-256 para detecção de duplicidade
    const cleanReceipt = receiptImg.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
    const receiptHash = crypto.createHash('sha256').update(cleanReceipt).digest('hex');

    // Salvar evidência primária (cupom)
    const primaryEvidence = db.saveEvidenceFile({
      company_id: companyId,
      file_path: receiptImg,
      original_name: `comprovante_${type}_${Date.now()}.jpg`,
      mime_type: 'image/jpeg',
      file_size: Math.round(cleanReceipt.length * 0.75),
      sha256_hash: receiptHash,
      upload_type: 'receipt',
    });

    let secondaryEvidenceId: string | undefined = undefined;
    if (odometerImageBase64) {
      const cleanOdo = odometerImageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
      const odoHash = crypto.createHash('sha256').update(cleanOdo).digest('hex');
      const secEvidence = db.saveEvidenceFile({
        company_id: companyId,
        file_path: odometerImageBase64,
        original_name: `painel_odometro_${Date.now()}.jpg`,
        mime_type: 'image/jpeg',
        file_size: Math.round(cleanOdo.length * 0.75),
        sha256_hash: odoHash,
        upload_type: 'odometer',
      });
      secondaryEvidenceId = secEvidence.id;
    }

    // Executar Extração com Gemini AI
    const extractionResult = await extractReceiptWithAI({
      receiptImageBase64: receiptImg,
      odometerImageBase64,
      type,
      vehicle,
    });

    if (!extractionResult.success || !extractionResult.data) {
      return res.status(422).json({
        success: false,
        source: 'simulated_fallback',
        error:
          extractionResult.error ||
          'Não foi possível extrair os dados do comprovante via IA. Verifique a chave da API ou preencha manualmente.',
      });
    }

    const aiData = extractionResult.data;
    const extractedOdometer = aiData.odometroPainel || aiData.odometro || vehicle.current_km + 150;
    const eventType = type === 'abastecimento' ? 'fuel' : 'maintenance';

    // Executar Validações Automáticas de Regras de Negócio
    const validationCheck = runBusinessValidations({
      companyId,
      vehicle,
      driverId,
      odometer: extractedOdometer,
      eventDate: aiData.data,
      eventType,
      liters: aiData.litros || undefined,
      imageHash: receiptHash,
      fieldConfidences: aiData.fieldConfidences,
    });

    // Criar evento no status "pending_confirmation"
    const newEvent = db.createFleetEvent(
      companyId,
      {
        vehicle_id: vehicle.id,
        driver_id: driverId,
        event_type: eventType,
        status: 'pending_confirmation',
        event_date: aiData.data,
        odometer: extractedOdometer,
        total_amount: aiData.valorTotal || 0,
        evidence_file_id: primaryEvidence.id,
        evidence_secondary_id: secondaryEvidenceId,
        notes: `Extração IA via ${extractionResult.model} (${extractionResult.promptVersion})`,
        created_by: user.id,
      },
      eventType === 'fuel'
        ? {
            gas_station_name: aiData.estabelecimento,
            cnpj: aiData.cnpj || undefined,
            fuel_type: (aiData.combustivel as any) || vehicle.fuel_type,
            liters: aiData.litros || 0,
            price_per_liter: aiData.precoPorLitro || 0,
            is_full_tank: true,
          }
        : undefined,
      eventType === 'maintenance'
        ? {
            workshop_name: aiData.estabelecimento,
            cnpj: aiData.cnpj || undefined,
            maintenance_type: aiData.tipoManutencao || 'preventiva',
            parts_cost: aiData.custoPecas || 0,
            labor_cost: aiData.custoMaoDeObra || 0,
            items_description: aiData.pecasEServicos || 'Revisão geral',
          }
        : undefined
    );

    // Salvar Registro de Extração IA
    const savedExtraction = db.saveAiExtraction({
      company_id: companyId,
      fleet_event_id: newEvent.id,
      model: extractionResult.model,
      prompt_version: extractionResult.promptVersion,
      latency_ms: extractionResult.latencyMs,
      overall_confidence: aiData.confiancaGeral,
      field_confidences: aiData.fieldConfidences,
      raw_response: extractionResult.rawJson,
      normalized_data: aiData,
      quick_questions: aiData.perguntasRapidas.map((q) => ({
        id: q.id,
        field: q.field,
        question: q.question,
        reason: q.reason,
        options: q.options,
        suggestedValue: q.suggestedValue,
      })),
    });

    // Salvar Validações Automáticas vinculadas ao evento
    const savedValidations = db.saveValidations(
      validationCheck.validations.map((v) => ({
        ...v,
        fleet_event_id: newEvent.id,
      }))
    );

    db.logAudit(
      companyId,
      user.id,
      'AI_EXTRACTION_COMPLETED',
      'FleetEvent',
      newEvent.id,
      {
        model: extractionResult.model,
        latencyMs: extractionResult.latencyMs,
        hasBlockingError: validationCheck.hasBlockingError,
      },
      req.ip
    );

    return res.json({
      success: true,
      event: {
        ...newEvent,
        vehicle,
        evidence: primaryEvidence,
        secondaryEvidence: secondaryEvidenceId ? db.getEvidenceFile(companyId, secondaryEvidenceId) : undefined,
      },
      extraction: savedExtraction,
      validations: savedValidations,
      hasBlockingError: validationCheck.hasBlockingError,
    });
  } catch (error: any) {
    console.error('Erro na extração IA:', error);
    return res.status(500).json({
      error: 'Falha durante o processamento do comprovante.',
      details: error.message,
    });
  }
});

// Endpoint de Vistoria Visual com Gemini 3.8 Flash e Nano Banana 2 (gemini-3.1-flash-image)
apiRouter.post('/ai/inspect-vehicle', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { fotos, vehicleId } = req.body;
    const companyId = req.company?.id || 'comp-translog-01';

    if (!fotos || !fotos.dianteiraEsquerda || !fotos.pneu) {
      return res.status(400).json({
        error: 'Fotos obrigatórias não fornecidas (4 cantos + pneu).',
      });
    }

    const vehicle = db.getVehicle(companyId, vehicleId) || {
      id: vehicleId || 'veh-default',
      plate: 'BRA-2E19',
      model: 'Caminhão / Veículo Frota',
      current_km: 142850,
      fuel_type: 'Diesel S10',
      tank_capacity_liters: 600,
    } as any;

    const result = await inspectVehicleWithAI({
      fotos,
      vehicle,
      driverName: req.user?.name,
    });

    if (!result.success) {
      return res.status(422).json({
        success: false,
        error: result.error || 'Falha ao processar vistoria do veículo.',
      });
    }

    db.logAudit(
      companyId,
      req.user?.id || 'anonymous',
      'VEHICLE_INSPECTION_COMPLETED',
      'VehicleInspection',
      vehicle.id,
      {
        avariasCount: result.data.avarias.length,
        sulcoPneuMm: result.data.analisePneu.desgastePneuMm,
        kmRestantes: result.data.analisePneu.kmRestantesEstimados,
        status: result.data.status,
      },
      req.ip
    );

    return res.json({
      success: true,
      data: result.data,
      model: result.model,
      annotatedModel: result.annotatedModel,
    });
  } catch (err: any) {
    console.error('Erro ao executar vistoria veicular:', err);
    return res.status(500).json({
      error: 'Falha interna durante a vistoria veicular com IA.',
      details: err.message,
    });
  }
});

// --- 6.1. MULTI-AGENT INTELLIGENCE & NIGHTLY BATCH INSIGHTS ---

// Obter insights diários consolidados da frota (leitura instantânea ou geração rápida)
apiRouter.get('/ai/daily-insights', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const companyId = req.company?.id || (req.headers['x-company-id'] as string) || 'comp-translog-01';
    let insights = db.getLatestDailyInsights(companyId);

    if (!insights) {
      // Se ainda não houver batch noturno gravado, executa on-demand com Context Caching
      insights = await runNightlyBatchFleetAnalysis(companyId, 'on_demand');
    }

    return res.json({
      success: true,
      data: insights,
    });
  } catch (err: any) {
    console.error('Erro ao obter insights diários da frota:', err);
    return res.status(500).json({
      error: 'Falha ao recuperar insights da frota.',
      details: err.message,
    });
  }
});

// Executar Job Noturno de IA da Frota (Batch API) sob demanda
apiRouter.post('/ai/run-batch-insights', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const companyId = req.company?.id || (req.headers['x-company-id'] as string) || 'comp-translog-01';
    const insights = await runNightlyBatchFleetAnalysis(companyId, 'batch_job_nightly');

    db.logAudit(
      companyId,
      req.user?.id || 'system-batch-job',
      'NIGHTLY_BATCH_AI_ANALYSIS_COMPLETED',
      'DailyFleetInsights',
      insights.id,
      {
        vehiclesCount: insights.totalVehiclesAnalyzed,
        fiscalAlerts: insights.agenteFiscal.inconsistenciasDetectadas,
        predictiveCount: insights.agenteMecanico.projecoesPreditivas.length,
      },
      req.ip
    );

    return res.json({
      success: true,
      data: insights,
      message: 'Job noturno de inteligência multiagente executado com sucesso!',
    });
  } catch (err: any) {
    console.error('Erro ao executar job noturno da frota:', err);
    return res.status(500).json({
      error: 'Falha ao executar job de inteligência multiagente da frota.',
      details: err.message,
    });
  }
});

// Resumo falado do Gestor ("Gestor Falante")
apiRouter.get('/ai/tts-summary', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const companyId = req.company?.id || (req.headers['x-company-id'] as string) || 'comp-translog-01';
    const summary = await generateGestorDailySpokenSummary(companyId);
    return res.json({
      success: true,
      data: summary,
    });
  } catch (err: any) {
    console.error('Erro ao gerar resumo falado do gestor:', err);
    return res.status(500).json({
      error: 'Falha ao sintetizar resumo de voz da frota.',
      details: err.message,
    });
  }
});

// Ação direta de 1 clique: Aceitar e Agendar Manutenção Preditiva do Agente Mecânico
apiRouter.post('/ai/schedule-predictive-maintenance', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const companyId = req.company?.id || (req.headers['x-company-id'] as string) || 'comp-translog-01';
    const { vehicleId, vehiclePlate, maintenanceType, suggestedDate, estimatedKm } = req.body;

    if (!vehicleId) {
      return res.status(400).json({ error: 'Veículo obrigatório para agendamento preditivo.' });
    }

    const vehicle = db.getVehicle(companyId, vehicleId);
    if (vehicle) {
      db.updateVehicle(companyId, vehicleId, {
        next_maintenance_km: Number(estimatedKm || vehicle.current_km + 10000),
        next_maintenance_desc: maintenanceType || 'Revisão Preventiva Agendada',
      });
    }

    // Criar evento ou notificação de agendamento confirmado
    db.createNotification({
      company_id: companyId,
      title: 'Revisão Preditiva Confirmada',
      message: `Revisão preventiva para o veículo ${vehiclePlate || vehicle?.plate} agendada com sucesso para ${suggestedDate || 'próximos dias'} com base no ritmo de rodagem projetado pela IA.`,
      type: 'info',
      read: false,
    });

    return res.json({
      success: true,
      message: `Revisão preventiva do veículo ${vehiclePlate || vehicleId} agendada com sucesso!`,
      scheduledMaintenance: {
        vehicleId,
        vehiclePlate: vehiclePlate || vehicle?.plate,
        date: suggestedDate,
        targetKm: estimatedKm,
      },
    });
  } catch (err: any) {
    console.error('Erro ao agendar manutenção preditiva:', err);
    return res.status(500).json({
      error: 'Falha ao agendar manutenção preditiva.',
      details: err.message,
    });
  }
});

// Copiloto Estratégico Executivo da Frota com Gemini 3.8 Flash
apiRouter.post('/ai/strategic-copilot', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { question, contextData } = req.body;
    if (!question) {
      return res.status(400).json({ error: 'Pergunta obrigatória.' });
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || '',
      httpOptions: { headers: { 'User-Agent': 'aistudio-build-frota-facil' } },
    });

    const prompt = `Você é o CONSULTOR ESTRATÉGICO EXECUTIVO DE FROTAS E LOGÍSTICA do sistema FrotaFácil AI.
Responda à pergunta do gestor em português com base nos dados da frota fornecidos abaixo:
Pergunta do Gestor: "${question}"

Dados da Frota:
${JSON.stringify(contextData || {}, null, 2)}

Responda em formato JSON com a seguinte estrutura:
{
  "answer": string,
  "keyMetrics": [
    { "label": string, "value": string, "color": "text-amber-400" | "text-emerald-400" | "text-red-400" | "text-blue-400" }
  ],
  "actionRecommendation": string,
  "sourceBadge": "FrotaFácil AI Strategic Copilot • Gemini 3.8 Flash"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({
      success: true,
      data: parsed,
    });
  } catch (err: any) {
    const isQuota =
      err?.status === 'RESOURCE_EXHAUSTED' ||
      err?.message?.includes('429') ||
      err?.message?.includes('quota');
    if (isQuota) {
      console.info('[Copiloto Estratégico] Quota temporária atingida (429). Ativando inferência local.');
    } else {
      console.info('[Copiloto Estratégico] Modo local ativado.');
    }
    return res.json({
      success: false,
      message: 'Fallback local ativado',
    });
  }
});

// Análise Avançada de Dados de Consumo e Gastos com Gemini 3.8 Flash
apiRouter.post('/ai/analytics-insights', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { analyticsPayload } = req.body;

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || '',
      httpOptions: { headers: { 'User-Agent': 'aistudio-build-frota-facil' } },
    });

    const prompt = `Você é o ANALISTA SÊNIOR DE DADOS E EFICIÊNCIA DE FROTAS do sistema FrotaFácil AI.
Analise com rigor estatístico os dados de consumo médio de combustível e gastos mensais da frota:
${JSON.stringify(analyticsPayload || {}, null, 2)}

Seu objetivo é gerar um parecer executivo de alto impacto com foco primordial em ECONOMIA DE CUSTOS, detectando desvios de consumo, veículos de maior gasto e oportunidades práticas para economizar no mês.

Responda ESTRITAMENTE em formato JSON com esta estrutura:
{
  "resumoExecutivo": string,
  "diagnosticoConsumo": string,
  "diagnosticoGastos": string,
  "economiaPotencialEstimadaBrl": number,
  "economiaPercentual": number,
  "veiculoMaisEficiente": string,
  "veiculoMaiorAtencao": string,
  "acoesRecomendadas": [
    {
      "titulo": string,
      "descricao": string,
      "impactoEstimadoBrl": number,
      "prioridade": "alta" | "media" | "baixa"
    }
  ],
  "conclusaoTCO": string
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({
      success: true,
      data: {
        ...parsed,
        generatedAt: new Date().toISOString(),
        modelBadge: 'Gemini 3.8 Flash • IA Generativa Ativa',
      },
    });
  } catch (err: any) {
    const isQuota =
      err?.status === 'RESOURCE_EXHAUSTED' ||
      err?.message?.includes('429') ||
      err?.message?.includes('quota');
    if (isQuota) {
      console.info('[Gemini Analytics] Quota temporária atingida (429). Ativando inferência local.');
    } else {
      console.info('[Gemini Analytics] Modo local ativado.');
    }
    return res.json({
      success: false,
      message: 'Fallback local ativado',
    });
  }
});

// --- 7. CONFIRMAÇÃO / CORREÇÃO / REJEIÇÃO DE EVENTOS ---
apiRouter.post('/events/confirm', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.company!.id;
  const user = req.user!;
  const parsed = EventConfirmInputSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: 'Dados de confirmação inválidos.', issues: parsed.error.issues });
  }

  const {
    event_id,
    odometer,
    event_date,
    total_amount,
    notes,
    correction_justification,
    gas_station_name,
    liters,
    price_per_liter,
    fuel_type,
    is_full_tank,
    workshop_name,
    maintenance_type,
    parts_cost,
    labor_cost,
    items_description,
    next_suggested_km,
  } = parsed.data;

  const currentEvent = db.getFleetEvent(companyId, event_id);
  if (!currentEvent) {
    return res.status(404).json({ error: 'Evento não localizado.' });
  }

  const vehicle = db.getVehicle(companyId, currentEvent.vehicle_id);
  if (!vehicle) {
    return res.status(404).json({ error: 'Veículo associado ao evento não existe.' });
  }

  // Executar validações de negócio com os valores finais
  const validationCheck = runBusinessValidations({
    companyId,
    vehicle,
    driverId: currentEvent.driver_id,
    odometer,
    eventDate: event_date,
    eventType: currentEvent.event_type,
    liters,
    correctionJustification: correction_justification,
  });

  if (validationCheck.hasBlockingError) {
    const blocking = validationCheck.validations.find((v) => v.severity === 'BLOCKING');
    return res.status(422).json({
      error: 'Evento bloqueado pelas regras de negócio da frota.',
      message: blocking?.message || 'Verifique as pendências apontadas.',
      validations: validationCheck.validations,
    });
  }

  // Calcular métricas de eficiência para abastecimento
  let kmDelta = 0;
  let kmPerLiter = 0;
  let costPerKm = 0;

  if (currentEvent.event_type === 'fuel' && liters && liters > 0) {
    kmDelta = Math.max(0, odometer - vehicle.current_km);
    if (kmDelta > 0) {
      kmPerLiter = Number((kmDelta / liters).toFixed(2));
      costPerKm = Number((total_amount / kmDelta).toFixed(2));
    }
  }

  // Determinar status: se houve correção de valores, marcar 'corrected', senão 'confirmed'
  const isCorrected =
    currentEvent.odometer !== odometer ||
    currentEvent.total_amount !== total_amount ||
    Boolean(correction_justification);

  const newStatus = isCorrected ? 'corrected' : 'confirmed';

  // Atualizar Evento
  const updatedEvent = db.updateFleetEvent(
    companyId,
    event_id,
    {
      odometer,
      event_date,
      total_amount,
      status: newStatus,
      notes: notes || currentEvent.notes,
      correction_justification,
      confirmed_by: user.id,
      confirmed_at: new Date().toISOString(),
    },
    currentEvent.event_type === 'fuel'
      ? {
          gas_station_name: gas_station_name || currentEvent.fuelDetail?.gas_station_name,
          fuel_type: (fuel_type as any) || currentEvent.fuelDetail?.fuel_type,
          liters: liters || currentEvent.fuelDetail?.liters,
          price_per_liter: price_per_liter || currentEvent.fuelDetail?.price_per_liter,
          is_full_tank: is_full_tank !== undefined ? is_full_tank : true,
          calculated_km_delta: kmDelta,
          calculated_km_per_liter: kmPerLiter,
          calculated_cost_per_km: costPerKm,
        }
      : undefined,
    currentEvent.event_type === 'maintenance'
      ? {
          workshop_name: workshop_name || currentEvent.maintenanceDetail?.workshop_name,
          maintenance_type: maintenance_type || currentEvent.maintenanceDetail?.maintenance_type,
          parts_cost: parts_cost !== undefined ? parts_cost : currentEvent.maintenanceDetail?.parts_cost,
          labor_cost: labor_cost !== undefined ? labor_cost : currentEvent.maintenanceDetail?.labor_cost,
          items_description: items_description || currentEvent.maintenanceDetail?.items_description,
          next_suggested_km: next_suggested_km || currentEvent.maintenanceDetail?.next_suggested_km,
        }
      : undefined
  );

  // REGRA DE NEGÓCIO MANDATÓRIA: Ao confirmar evento, atualizar current_km do veículo!
  if (odometer > vehicle.current_km || (odometer < vehicle.current_km && correction_justification)) {
    db.updateVehicle(companyId, vehicle.id, {
      current_km: odometer,
      // Se for manutenção com próximo km sugerido
      ...(next_suggested_km ? { next_maintenance_km: next_suggested_km } : {}),
    });
  }

  // Salvar novas validações finais
  db.saveValidations(
    validationCheck.validations.map((v) => ({
      ...v,
      fleet_event_id: event_id,
    }))
  );

  // Registrar auditoria
  db.logAudit(
    companyId,
    user.id,
    isCorrected ? 'EVENT_CORRECTED_CONFIRMED' : 'EVENT_CONFIRMED',
    'FleetEvent',
    event_id,
    {
      odometer,
      previousKm: vehicle.current_km,
      totalAmount: total_amount,
      status: newStatus,
      kmDelta,
      kmPerLiter,
    },
    req.ip
  );

  // Notificar se atingiu marco de revisão preventiva
  if (vehicle.next_maintenance_km && odometer >= vehicle.next_maintenance_km - 1000) {
    db.createNotification({
      company_id: companyId,
      title: `Alerta Preventiva: ${vehicle.plate}`,
      message: `O veículo ${vehicle.plate} atingiu ${odometer.toLocaleString()} km e se aproxima da meta de revisão (${vehicle.next_maintenance_km.toLocaleString()} km).`,
      type: 'warning',
      read: false,
      link_event_id: event_id,
    });
  }

  const enrichedFinal = db.getFleetEvent(companyId, event_id);
  return res.json({ success: true, event: enrichedFinal });
});

apiRouter.post('/events/:id/reject', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.company!.id;
  const eventId = req.params.id;
  const { reason = 'Comprovante reprovado pela gestão' } = req.body;

  const updated = db.updateFleetEvent(companyId, eventId, {
    status: 'rejected',
    rejection_reason: reason,
  });

  if (!updated) {
    return res.status(404).json({ error: 'Evento não encontrado.' });
  }

  db.logAudit(
    companyId,
    req.user!.id,
    'EVENT_REJECTED',
    'FleetEvent',
    eventId,
    { reason },
    req.ip
  );

  return res.json({ success: true, event: updated });
});

apiRouter.get('/events', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.company!.id;
  const user = req.user!;
  const { vehicleId, status, type } = req.query as { vehicleId?: string; status?: string; type?: string };

  let driverId: string | undefined = undefined;
  if (user.role === 'motorista') {
    const driver = db.getDriverByUserId(companyId, user.id);
    driverId = driver?.id;
  }

  const events = db.getFleetEvents(companyId, { vehicleId, driverId, status, type });
  return res.json({ success: true, events });
});

apiRouter.get('/events/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.company!.id;
  const event = db.getFleetEvent(companyId, req.params.id);

  if (!event) {
    return res.status(404).json({ error: 'Evento não encontrado.' });
  }

  return res.json({ success: true, event });
});

// --- 8. DASHBOARD INDICADORES & AUDITORIA ---
apiRouter.get('/dashboard/metrics', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.company!.id;
  const metrics = db.getDashboardMetrics(companyId);
  return res.json({ success: true, metrics });
});

apiRouter.get('/audit-logs', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.company!.id;
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  const logs = db.getAuditLogs(companyId, limit);
  return res.json({ success: true, logs });
});

apiRouter.get('/notifications', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.company!.id;
  const notifs = db.getNotifications(companyId, req.user?.id);
  return res.json({ success: true, notifications: notifs });
});

apiRouter.put('/notifications/:id/read', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.company!.id;
  const success = db.markNotificationRead(companyId, req.params.id);
  return res.json({ success });
});
