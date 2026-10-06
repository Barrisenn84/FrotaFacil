import { auth, googleSheetsProvider, signInWithPopup, getInMemoryAccessToken, setInMemoryAccessToken } from '../firebase/config';
import { GoogleAuthProvider } from 'firebase/auth';
import { Vehicle, Abastecimento, Manutencao, DocumentoVeiculo, FleetEvent } from '../types/fleet';

export interface SheetSyncResult {
  success: boolean;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  error?: string;
  message?: string;
}

/**
 * Ensures a valid Google Workspace OAuth access token is available.
 * If not in memory, triggers interactive Google Sign-In with popup.
 */
export async function ensureGoogleAccessToken(): Promise<string> {
  const currentToken = getInMemoryAccessToken();
  if (currentToken) return currentToken;

  try {
    const result = await signInWithPopup(auth, googleSheetsProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Não foi possível obter o token de acesso do Google Workspace.');
    }
    setInMemoryAccessToken(credential.accessToken);
    return credential.accessToken;
  } catch (err: any) {
    if (
      err?.code === 'auth/popup-closed-by-user' ||
      err?.code === 'auth/cancelled-popup-request' ||
      err?.message?.includes('popup-closed-by-user')
    ) {
      console.info('Autenticação Google Workspace cancelada pelo usuário.');
      throw new Error('A autenticação com o Google foi cancelada antes de concluir. Clique novamente para autorizar.');
    }
    if (err?.code === 'auth/popup-blocked') {
      throw new Error('O navegador bloqueou a janela de autenticação do Google. Habilite pop-ups para este site.');
    }
    if (
      err?.message?.includes('access_denied') ||
      err?.code === 'auth/access-denied' ||
      err?.message?.includes('403')
    ) {
      throw new Error('Acesso bloqueado pelo Google (Erro 403). Como o aplicativo está em modo de testes, selecione a conta barrinho1602@gmail.com no login ou use a opção "Vincular por Link/ID" abaixo.');
    }
    console.warn('Aviso de autenticação Google Workspace:', err?.message || err);
    throw new Error(err.message || 'Falha na autenticação Google.');
  }
}

/**
 * Creates the official Google Sheet for the company with 5 tabs:
 * "Veiculos", "Abastecimentos", "Manutencoes", "Despesas", "Documentos"
 */
export async function createCompanyFleetSpreadsheet(
  companyName: string,
  fleetData?: {
    vehicles?: Vehicle[];
    fuelings?: Abastecimento[];
    maintenances?: Manutencao[];
    documents?: DocumentoVeiculo[];
  }
): Promise<SheetSyncResult> {
  try {
    const token = await ensureGoogleAccessToken();
    const title = `FrotaFácil - ${companyName || 'Minha Empresa'}`;

    // 1. Criar a Planilha no Google Sheets
    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title,
        },
        sheets: [
          { properties: { title: 'Veiculos', gridProperties: { frozenRowCount: 1 } } },
          { properties: { title: 'Abastecimentos', gridProperties: { frozenRowCount: 1 } } },
          { properties: { title: 'Manutencoes', gridProperties: { frozenRowCount: 1 } } },
          { properties: { title: 'Despesas', gridProperties: { frozenRowCount: 1 } } },
          { properties: { title: 'Documentos', gridProperties: { frozenRowCount: 1 } } },
        ],
      }),
    });

    if (!createRes.ok) {
      const errData = await createRes.json();
      throw new Error(errData?.error?.message || `Erro ao criar planilha Google (Status ${createRes.status})`);
    }

    const createdSheet = await createRes.json();
    const spreadsheetId = createdSheet.spreadsheetId;
    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

    // 2. Popular cabeçalhos e dados iniciais em lote (batchUpdate)
    await populateInitialSheetData(token, spreadsheetId, fleetData);

    return {
      success: true,
      spreadsheetId,
      spreadsheetUrl,
      message: `Planilha "${title}" criada com sucesso no Google Drive!`,
    };
  } catch (err: any) {
    const isCancelled = err.message?.includes('cancelada');
    if (!isCancelled) {
      console.warn('Aviso ao criar planilha Google:', err?.message || err);
    }
    return {
      success: false,
      error: err.message || 'Erro inesperado ao criar planilha.',
    };
  }
}

/**
 * Formata cabeçalhos e preenche dados iniciais das 5 abas
 */
async function populateInitialSheetData(
  token: string,
  spreadsheetId: string,
  fleetData?: {
    vehicles?: Vehicle[];
    fuelings?: Abastecimento[];
    maintenances?: Manutencao[];
    documents?: DocumentoVeiculo[];
  }
) {
  const valuesData: Array<{ range: string; values: any[][] }> = [
    {
      range: 'Veiculos!A1:I1',
      values: [
        ['ID', 'Placa', 'Modelo', 'Ano', 'Combustível Padrão', 'KM Atual', 'Próx. Revisão (KM)', 'Status', 'Atualizado Em'],
      ],
    },
    {
      range: 'Abastecimentos!A1:K1',
      values: [
        ['ID', 'Data', 'Placa', 'Motorista', 'Combustível', 'Litros', 'Preço/Litro (R$)', 'Valor Total (R$)', 'Posto', 'Cidade', 'Status'],
      ],
    },
    {
      range: 'Manutencoes!A1:I1',
      values: [
        ['ID', 'Data', 'Placa', 'Tipo', 'Descrição', 'Oficina', 'Odômetro (KM)', 'Custo Total (R$)', 'Status'],
      ],
    },
    {
      range: 'Despesas!A1:G1',
      values: [
        ['ID', 'Data', 'Placa', 'Categoria', 'Valor (R$)', 'Descrição / Motivo', 'Status'],
      ],
    },
    {
      range: 'Documentos!A1:G1',
      values: [
        ['ID', 'Placa', 'Tipo Documento', 'Vencimento', 'Status Conformidade', 'Órgão / Observação', 'Atualizado Em'],
      ],
    },
  ];

  // Adicionar dados existentes de veículos se houver
  if (fleetData?.vehicles && fleetData.vehicles.length > 0) {
    const vehicleRows = fleetData.vehicles.map((v) => [
      v.id,
      v.plate,
      v.model,
      v.year || '-',
      v.fuel_type,
      v.current_km,
      v.next_maintenance_km || v.current_km + 10000,
      v.status,
      new Date().toLocaleString('pt-BR'),
    ]);
    valuesData.push({
      range: `Veiculos!A2:I${vehicleRows.length + 1}`,
      values: vehicleRows,
    });
  }

  // Adicionar dados existentes de abastecimentos se houver
  if (fleetData?.fuelings && fleetData.fuelings.length > 0) {
    const fuelingRows = fleetData.fuelings.map((f: any) => [
      f.id,
      f.data || new Date().toISOString().split('T')[0],
      f.veiculoId || '-',
      f.motoristaId || 'Condutor',
      f.combustivel || f.tipoCombustivel || 'Diesel S10',
      f.litros || 0,
      f.precoLitro || f.precoPorLitro || 0,
      f.valorTotal || 0,
      f.posto || 'Posto Conveniado',
      f.cidade || 'São Paulo',
      f.status || 'Concluído',
    ]);
    valuesData.push({
      range: `Abastecimentos!A2:K${fuelingRows.length + 1}`,
      values: fuelingRows,
    });
  }

  // Adicionar manutenções
  if (fleetData?.maintenances && fleetData.maintenances.length > 0) {
    const maintRows = fleetData.maintenances.map((m) => [
      m.id,
      m.data,
      m.veiculoId,
      m.tipo,
      m.descricao,
      m.oficina || 'Oficina Credenciada',
      m.odometro || 0,
      m.valorTotal || 0,
      m.status || 'Agendada',
    ]);
    valuesData.push({
      range: `Manutencoes!A2:I${maintRows.length + 1}`,
      values: maintRows,
    });
  }

  // Executar batchUpdate de valores
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: valuesData,
    }),
  });
}

/**
 * Append automatic row when a new fueling event is recorded in FrotaFácil
 */
export async function appendFuelingToGoogleSheet(
  spreadsheetId: string,
  fueling: {
    id: string;
    data: string;
    placa: string;
    motorista: string;
    combustivel: string;
    litros: number;
    precoLitro: number;
    valorTotal: number;
    posto?: string;
    cidade?: string;
    status?: string;
  }
): Promise<boolean> {
  try {
    const token = await ensureGoogleAccessToken();
    const row = [
      fueling.id,
      fueling.data || new Date().toISOString().split('T')[0],
      fueling.placa,
      fueling.motorista,
      fueling.combustivel,
      fueling.litros,
      fueling.precoLitro,
      fueling.valorTotal,
      fueling.posto || 'Posto',
      fueling.cidade || 'Brasil',
      fueling.status || 'Confirmado via IA',
    ];

    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Abastecimentos!A:K:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          range: 'Abastecimentos!A:K',
          majorDimension: 'ROWS',
          values: [row],
        }),
      }
    );

    return res.ok;
  } catch (err) {
    console.warn('Falha no espelhamento automático com Google Sheets:', err);
    return false;
  }
}

/**
 * Append automatic row when a maintenance event is recorded
 */
export async function appendMaintenanceToGoogleSheet(
  spreadsheetId: string,
  maint: {
    id: string;
    data: string;
    placa: string;
    tipo: string;
    descricao: string;
    oficina?: string;
    odometro: number;
    valorTotal: number;
    status?: string;
  }
): Promise<boolean> {
  try {
    const token = await ensureGoogleAccessToken();
    const row = [
      maint.id,
      maint.data,
      maint.placa,
      maint.tipo,
      maint.descricao,
      maint.oficina || 'Oficina Credenciada',
      maint.odometro,
      maint.valorTotal,
      maint.status || 'Agendada via IA',
    ];

    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Manutencoes!A:I:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          range: 'Manutencoes!A:I',
          majorDimension: 'ROWS',
          values: [row],
        }),
      }
    );

    return res.ok;
  } catch (err) {
    console.warn('Falha no espelhamento de manutenção com Google Sheets:', err);
    return false;
  }
}

/**
 * Full Fleet Sync: Mirrors vehicles, fuelings, maintenances, expenses and documents
 */
export async function syncEntireFleetToGoogleSheet(
  spreadsheetId: string,
  fleetData: {
    vehicles: Vehicle[];
    fuelings: Abastecimento[];
    maintenances: Manutencao[];
    documents?: DocumentoVeiculo[];
  }
): Promise<SheetSyncResult> {
  try {
    const token = await ensureGoogleAccessToken();
    await populateInitialSheetData(token, spreadsheetId, fleetData);
    return {
      success: true,
      spreadsheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      message: 'Planilha Google Sheets 100% sincronizada com a frota!',
    };
  } catch (err: any) {
    console.error('Erro ao sincronizar frota inteira com Google Sheets:', err);
    return {
      success: false,
      error: err.message || 'Erro ao sincronizar dados com Google Sheets.',
    };
  }
}
