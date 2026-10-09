import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { GoogleGenAI, Type } from '@google/genai';
import { apiRouter } from './src/server/apiRoutes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Configurar proxy reverso para contêiner Cloud Run / AI Studio
app.set('trust proxy', 1);

// Configuração de porta dinâmica (Railway / Cloud Run injetam process.env.PORT)
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProd = process.env.NODE_ENV === 'production';

// Endpoint de integridade (Health Check) imediato para Railway e balanceadores de carga
app.get(['/health', '/api/health'], (req, res) => {
  res.status(200).json({
    status: 'ok',
    environment: isProd ? 'production' : 'development',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// 1. Segurança com Helmet e CORS (configurados para permitir carregamento fluido no iframe do AI Studio)
app.use(
  helmet({
    contentSecurityPolicy: false, // Permite blobs, fotos de comprovantes e media streams
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    frameguard: false, // OBRIGATÓRIO: Permite renderização dentro do iframe do AI Studio
  })
);

// Garantir explicitamente que X-Frame-Options não bloqueie o iframe
app.use((req, res, next) => {
  res.removeHeader('X-Frame-Options');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  next();
});

app.use(cors());

// 2. Rate Limiting corporativo para prevenção de abusos com suporte a proxy
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 300, // limite de 300 requisições por janela
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => {
    return (req.headers['x-user-id'] as string) || req.ip || 'anonymous';
  },
  message: {
    error: 'Limite de requisições excedido. Por favor, aguarde alguns instantes.',
  },
});
app.use('/api', apiLimiter);

// 3. Parser JSON com limite para imagens de alta resolução
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 4. Logs estruturados com latência e status HTTP
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const company = req.headers['x-company-id'] || 'no-company';
    const user = req.headers['x-user-id'] || 'anonymous';
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: duration,
        company,
        user,
        ip: req.ip,
      })
    );
  });
  next();
});

const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build-frota-facil',
      },
    },
  });
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    system: 'FrotaFácil AI Enterprise v2.0',
    hasGeminiKey: Boolean(apiKey && apiKey.length > 5),
    model: 'gemini-3.8-flash',
    time: new Date().toISOString(),
  });
});

// Endpoint de geração de Ephemeral Tokens do Gemini Live API
app.post('/api/live/token', async (req, res) => {
  try {
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY não configurada no servidor.' });
    }
    const tokenAi = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build-frota-facil',
        },
      },
    });
    const tokenObj = await tokenAi.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        liveConnectConstraints: {
          model: 'gemini-3.8-live',
        },
      },
    });
    return res.json({
      success: true,
      token: tokenObj.name,
      model: 'gemini-3.8-live',
    });
  } catch (err: any) {
    console.error('Erro ao gerar ephemeral token Gemini Live:', err);
    return res.status(500).json({
      error: 'Falha ao gerar token efêmero da Live API.',
      details: err.message,
    });
  }
});

// Endpoint Copiloto de Voz Hands-Free (mantido para motoristas em trânsito)
app.post('/api/ai/voice-command', async (req, res) => {
  try {
    const { voiceText, audioBase64, vehicleInfo } = req.body;

    if (!voiceText && !audioBase64) {
      return res.status(400).json({ error: 'Nenhum comando de voz ou texto fornecido.' });
    }

    if (!ai) {
      return res.json({
        success: true,
        data: {
          transcription: voiceText || 'Abasteci 45 litros no Posto Ipiranga a 4,40',
          tipoAcao: 'abastecimento',
          dadosExtraidos: {
            posto: 'Auto Posto Ipiranga',
            valor: 198.0,
            litros: 45.0,
            precoPorLitro: 4.4,
            combustivel: vehicleInfo?.fuel_type || 'Etanol',
            odometro: (vehicleInfo?.current_km || 34500) + 380,
          },
          calculos: {
            kmTrecho: 380,
            consumoKmL: 8.44,
            odometroAnterior: vehicleInfo?.current_km || 34500,
          },
          audioSpeechText: 'Abastecimento registrado com sucesso! Você rodou 380 km com média de 8,4 km por litro.',
        },
        source: 'simulated_fallback',
      });
    }

    const currentKm = vehicleInfo?.current_km || 34500;
    const systemInstruction = `Você é o Copiloto de Voz Hands-Free do 'FrotaFácil AI'.
Interprete o comando falado do motorista.
Veículo: Placa ${vehicleInfo?.plate || 'ABC1D23'}, Odômetro anterior: ${currentKm} km.
Calcule o trecho e o consumo, e responda com JSON estruturado.`;

    const parts: any[] = [];
    if (audioBase64) {
      const cleanAudio = audioBase64.replace(/^data:audio\/[a-zA-Z0-9+.-]+;base64,/, '');
      parts.push({
        inlineData: {
          mimeType: req.body.audioMimeType || 'audio/webm',
          data: cleanAudio,
        },
      });
    }
    parts.push({ text: voiceText ? `Comando: "${voiceText}"` : 'Analise o áudio e extraia os dados.' });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: { parts },
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transcription: { type: Type.STRING },
            tipoAcao: { type: Type.STRING },
            dadosExtraidos: {
              type: Type.OBJECT,
              properties: {
                posto: { type: Type.STRING },
                valor: { type: Type.NUMBER },
                litros: { type: Type.NUMBER },
                precoPorLitro: { type: Type.NUMBER },
                combustivel: { type: Type.STRING },
                odometro: { type: Type.NUMBER },
              },
            },
            calculos: {
              type: Type.OBJECT,
              properties: {
                kmTrecho: { type: Type.NUMBER },
                consumoKmL: { type: Type.NUMBER },
                odometroAnterior: { type: Type.NUMBER },
              },
            },
            audioSpeechText: { type: Type.STRING },
          },
          required: ['transcription', 'tipoAcao', 'dadosExtraidos', 'audioSpeechText'],
        },
      },
    });

    const parsedData = JSON.parse(response.text || '{}');
    return res.json({
      success: true,
      data: parsedData,
      source: 'gemini-3.8-flash',
    });
  } catch (error: any) {
    console.error('Erro no copiloto de voz:', error);
    return res.status(500).json({ error: 'Falha ao processar comando de voz.', details: error.message });
  }
});

// 5. Montar roteador corporativo REST da frota em /api
app.use('/api', apiRouter);

// 6. Tratamento global de erros da API
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    error: 'Ocorreu um erro interno no servidor.',
    message: err.message,
  });
});

async function startServer() {
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 FrotaFácil AI Enterprise Server running at http://0.0.0.0:${PORT} [env: ${isProd ? 'production' : 'development'}]`);
  });

  const shutdown = () => {
    console.log('Finalizando servidor HTTP graciosamente...');
    server.close(() => {
      console.log('Servidor HTTP encerrado com sucesso.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer();
