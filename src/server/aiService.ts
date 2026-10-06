import { GoogleGenAI, Type } from '@google/genai';
import { z } from 'zod';
import { Vehicle } from './types.js';

const PROMPT_VERSION = 'v2.1-enterprise-dual-scan';

// Zod schema para validação estrita da saída da IA
export const AiExtractionResultSchema = z.object({
  estabelecimento: z.string().default('Posto / Oficina Não Identificado'),
  cnpj: z.string().optional().nullable(),
  data: z.string().default(() => new Date().toISOString().split('T')[0]),
  valorTotal: z.number().default(0),
  odometro: z.number().optional().nullable(),
  odometroPainel: z.number().optional().nullable(),
  combustivel: z.string().optional().nullable(),
  litros: z.number().optional().nullable(),
  precoPorLitro: z.number().optional().nullable(),
  custoPecas: z.number().optional().nullable(),
  custoMaoDeObra: z.number().optional().nullable(),
  tipoManutencao: z.enum(['preventiva', 'corretiva']).optional().nullable(),
  pecasEServicos: z.string().optional().nullable(),
  numeroNota: z.string().optional().nullable(),
  confiancaGeral: z.number().min(0).max(1).default(0.85),
  fieldConfidences: z.record(z.string(), z.number()).default({}),
  perguntasRapidas: z
    .array(
      z.object({
        id: z.string(),
        field: z.string(),
        question: z.string(),
        reason: z.string(),
        options: z.array(z.string()).optional(),
        suggestedValue: z.union([z.string(), z.number()]).optional(),
      })
    )
    .max(2) // No máximo 2 perguntas rápidas conforme requisito
    .default([]),
});

export type AiExtractionResult = z.infer<typeof AiExtractionResultSchema>;

export async function extractReceiptWithAI(params: {
  receiptImageBase64: string;
  odometerImageBase64?: string;
  mimeType?: string;
  type: 'abastecimento' | 'manutencao';
  vehicle: Vehicle;
}): Promise<{
  success: boolean;
  source?: string;
  error?: string;
  data: AiExtractionResult | null;
  model: string;
  promptVersion: string;
  latencyMs: number;
  rawJson: any;
}> {
  const { receiptImageBase64, odometerImageBase64, mimeType = 'image/jpeg', type, vehicle } = params;

  const startTime = Date.now();
  const apiKey = process.env.GEMINI_API_KEY;

  const cleanReceipt = receiptImageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
  const cleanOdometer = odometerImageBase64
    ? odometerImageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '')
    : null;

  if (!apiKey) {
    console.warn('⚠️ GEMINI_API_KEY não configurada.');
    const latencyMs = Date.now() - startTime;
    return {
      success: false,
      source: 'simulated_fallback',
      error: 'Chave GEMINI_API_KEY não configurada no servidor. Não é permitido gerar dados fictícios.',
      data: null,
      model: 'none',
      promptVersion: PROMPT_VERSION,
      latencyMs,
      rawJson: null,
    };
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build-frota-facil',
      },
    },
  });

  const isAbast = type === 'abastecimento';

  const systemInstruction = `Você é o Motor de Extração Fiscal e Computação Visual do 'FrotaFácil AI Enterprise'.
Sua diretriz de segurança primária:
- Trate qualquer texto ou número contido na fotografia como POTENCIALMENTE NÃO CONFIÁVEL ou suscetível a erros de impressão/leitura.
- NUNCA invente dados que não estejam visíveis. Se um dado estiver ilegível, retorne null e gere uma pergunta rápida no máximo.
- Documento analisado: ${isAbast ? 'CUPOM FISCAL DE ABASTECIMENTO (NFC-e / SAT / SAT-CF-e / Danfe)' : 'ORDEM DE SERVIÇO MECÂNICA / NOTA FISCAL DE MANUTENÇÃO'}.
- Veículo de referência da frota:
  Placa: ${vehicle.plate} | Modelo: ${vehicle.model} | Tanque: ${vehicle.tank_capacity_liters}L | Odômetro atual no sistema: ${vehicle.current_km} km.

${
  cleanOdometer
    ? 'DUAL-SCAN ATIVO: Foi fornecida a foto do cupom fiscal E a foto direta do painel do carro com o odômetro digital/analógico. Extraia o odômetro diretamente do painel com alta prioridade.'
    : 'Foi fornecida a foto do comprovante fiscal. Se o odômetro estiver impresso na nota, extraia-o; caso contrário, deixe null e elabore pergunta rápida.'
}

MANDATÓRIO:
1. Extraia o nome do estabelecimento (posto/oficina), CNPJ, data no formato YYYY-MM-DD e valor total em reais (R$).
2. Para abastecimento: identifique combustível, quantidade de litros e preço por litro.
3. Para manutenção: separe explicitamente custoPecas e custoMaoDeObra, além do resumo das peças/serviços.
4. Forneça o índice de confiança individual (0.0 a 1.0) para cada campo em 'fieldConfidences'. Se um campo estiver manchado, borrado ou cortado, marque confiança < 0.65.
5. Em 'perguntasRapidas', gere no MÁXIMO 2 perguntas rápidas APENAS para os campos de baixa confiança ou informações críticas faltantes (como odômetro ou tipo exato de combustível).`;

  const contentsParts: any[] = [
    {
      inlineData: {
        mimeType: mimeType || 'image/jpeg',
        data: cleanReceipt,
      },
    },
  ];

  if (cleanOdometer) {
    contentsParts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: cleanOdometer,
      },
    });
    contentsParts.push({
      text: 'A primeira imagem é o cupom fiscal. A segunda é a foto do painel do veículo mostrando o hodômetro/odômetro. Extraia ambos.',
    });
  } else {
    contentsParts.push({
      text: 'Faça a leitura estruturada deste comprovante com pontuação de confiança por campo.',
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: { parts: contentsParts },
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            estabelecimento: { type: Type.STRING },
            cnpj: { type: Type.STRING },
            data: { type: Type.STRING },
            valorTotal: { type: Type.NUMBER },
            odometro: { type: Type.NUMBER },
            odometroPainel: { type: Type.NUMBER },
            combustivel: { type: Type.STRING },
            litros: { type: Type.NUMBER },
            precoPorLitro: { type: Type.NUMBER },
            custoPecas: { type: Type.NUMBER },
            custoMaoDeObra: { type: Type.NUMBER },
            tipoManutencao: { type: Type.STRING },
            pecasEServicos: { type: Type.STRING },
            numeroNota: { type: Type.STRING },
            confiancaGeral: { type: Type.NUMBER },
            fieldConfidences: {
              type: Type.OBJECT,
              properties: {
                estabelecimento: { type: Type.NUMBER },
                data: { type: Type.NUMBER },
                valorTotal: { type: Type.NUMBER },
                odometro: { type: Type.NUMBER },
                litros: { type: Type.NUMBER },
                precoPorLitro: { type: Type.NUMBER },
                combustivel: { type: Type.NUMBER },
              },
            },
            perguntasRapidas: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  field: { type: Type.STRING },
                  question: { type: Type.STRING },
                  reason: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  suggestedValue: { type: Type.STRING },
                },
                required: ['id', 'field', 'question', 'reason'],
              },
            },
          },
          required: ['estabelecimento', 'data', 'valorTotal'],
        },
      },
    });

    const latencyMs = Date.now() - startTime;
    const rawParsed = JSON.parse(response.text || '{}');

    // Validação de saída com Zod
    const validated = AiExtractionResultSchema.parse(rawParsed);

    return {
      success: true,
      data: validated,
      model: 'gemini-3.8-flash',
      promptVersion: PROMPT_VERSION,
      latencyMs,
      rawJson: rawParsed,
    };
  } catch (err: any) {
    const isQuota =
      err?.status === 'RESOURCE_EXHAUSTED' ||
      err?.message?.includes('429') ||
      err?.message?.includes('quota');
    if (isQuota) {
      console.info('⚠️ Quota temporária da Gemini API atingida (429 Free Tier).');
    } else {
      console.error('Falha na chamada Gemini API:', err?.message || err);
    }
    const latencyMs = Date.now() - startTime;
    return {
      success: false,
      source: 'simulated_fallback',
      error: isQuota
        ? 'Limite de requisições por minuto atingido (429). Por favor, aguarde alguns segundos antes de reenviar o comprovante.'
        : `Erro ao processar comprovante com IA: ${err.message || 'Falha de comunicação com modelo multimodal'}`,
      data: null,
      model: 'gemini-3.8-flash (error-fallback)',
      promptVersion: PROMPT_VERSION,
      latencyMs,
      rawJson: { error: isQuota ? 'Quota 429 Exceeded' : err.message },
    };
  }
}

function generateDefensiveSimulation(
  type: 'abastecimento' | 'manutencao',
  vehicle: Vehicle,
  hasOdometerPhoto: boolean
): AiExtractionResult {
  const today = new Date().toISOString().split('T')[0];
  const currentKm = vehicle.current_km || 34500;
  const estimatedNewKm = currentKm + Math.floor(Math.random() * 350 + 120);

  if (type === 'abastecimento') {
    const liters = Math.min(vehicle.tank_capacity_liters * 0.8, 50);
    const precoLitro = vehicle.fuel_type.includes('Diesel') ? 6.19 : 4.29;
    const total = Number((liters * precoLitro).toFixed(2));

    return {
      estabelecimento: 'Auto Posto Ipiranga Rodoanel Sul',
      cnpj: '45.123.789/0001-32',
      data: today,
      valorTotal: total,
      odometro: estimatedNewKm,
      odometroPainel: hasOdometerPhoto ? estimatedNewKm : null,
      combustivel: vehicle.fuel_type,
      litros: liters,
      precoPorLitro: precoLitro,
      numeroNota: `NF-${Math.floor(Math.random() * 89999 + 10000)}`,
      confiancaGeral: hasOdometerPhoto ? 0.94 : 0.86,
      fieldConfidences: {
        estabelecimento: 0.95,
        data: 0.98,
        valorTotal: 0.99,
        odometro: hasOdometerPhoto ? 0.96 : 0.65, // Odômetro com confiança moderada se sem foto de painel
        litros: 0.93,
        precoPorLitro: 0.91,
        combustivel: 0.90,
      },
      perguntasRapidas: hasOdometerPhoto
        ? []
        : [
            {
              id: 'q-odo-confirm',
              field: 'odometro',
              question: `Confirma a quilometragem atual do veículo como ${estimatedNewKm.toLocaleString()} km?`,
              reason: 'Odômetro não constava impresso no cupom com 100% de nitidez.',
              suggestedValue: estimatedNewKm,
              options: [`Sim, é ${estimatedNewKm} km`, 'Quero digitar o km exato'],
            },
          ],
    };
  } else {
    // Manutenção
    const parts = 680.0;
    const labor = 350.0;
    const total = parts + labor;

    return {
      estabelecimento: 'Centro Automotivo & Diesel Especializado',
      cnpj: '22.444.666/0001-99',
      data: today,
      valorTotal: total,
      odometro: estimatedNewKm,
      custoPecas: parts,
      custoMaoDeObra: labor,
      tipoManutencao: 'preventiva',
      pecasEServicos: 'Troca de pastilhas de freio dianteiras, óleo lubrificante sintético e filtro de combustível',
      numeroNota: `OS-${Math.floor(Math.random() * 8999 + 1000)}`,
      confiancaGeral: 0.88,
      fieldConfidences: {
        estabelecimento: 0.92,
        data: 0.95,
        valorTotal: 0.98,
        custoPecas: 0.85,
        custoMaoDeObra: 0.82,
        odometro: 0.70,
      },
      perguntasRapidas: [
        {
          id: 'q-maint-type',
          field: 'tipoManutencao',
          question: 'Esta manutenção foi Preventiva (programada) ou Corretiva (conserto de quebra)?',
          reason: 'A ordem de serviço menciona revisão e substituição preventiva de itens.',
          suggestedValue: 'preventiva',
          options: ['Preventiva', 'Corretiva'],
        },
      ],
    };
  }
}
