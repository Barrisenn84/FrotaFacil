# 🚛 FrotaFácil - Gestão de Frota e Leitura IA

> **Plataforma Enterprise de Gestão Autônoma de Frotas, Leitura Fiscal com IA Multimodal e Governança Multi-Tenant**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb.svg)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-4.21-lightgrey.svg)](https://expressjs.com/)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore-orange.svg)](https://firebase.google.com/)
[![Gemini AI](https://img.shields.io/badge/Google%20Gemini-3.8%20Flash%20%7C%20Live-8e44ad.svg)](https://ai.google.dev/)
[![License](https://img.shields.io/badge/License-Proprietary-green.svg)]()

---

## 🌟 Visão Geral

O **FrotaFácil** é uma solução completa concebida para erradicar as maiores ineficiências na operação de frotas comerciais e pesadas no Brasil:
- **Fraudes e Desvios em Abastecimentos**: Detecção algorítmica de tanques excedentes, fotos duplicadas e odômetros adulterados.
- **Leitura Fiscal Automatizada por IA**: Processamento instantâneo de cupons fiscais (NFC-e, SAT e Danfe) cruzados com a foto do painel do veículo.
- **Vistoria Computacional 360°**: Mapeamento de avarias de funilaria nos 4 cantos da carroceria e medição de sulco dos pneus em milímetros.
- **Suíte Multiagente Autônoma**: 4 agentes de IA dedicados a auditoria fiscal, mecânica preditiva, consolidação de TCO (R$/km) e compliance regulatório.
- **Copiloto de Voz Hands-Free**: Operação 100% por comando de voz para motoristas em trânsito via Gemini Live API.

---

## 🤖 A Inteligência Artificial em Potência Máxima

Todas as sessões do FrotaFácil operam com inteligência artificial assistida por contingência heurística defensiva contra limites de quota (429/503):

### 1. OCR Dual-Scan Multimodal (`src/server/aiService.ts`)
- Analisa conjuntamente o **cupom fiscal** e a **foto do odômetro no painel do veículo**.
- Extração de odômetro com prioridade para o painel, cruzando com razão social, CNPJ do posto, litros e preço por litro.
- Gera até 2 perguntas rápidas de confirmação se houver baixa nitidez ou manchas.

### 2. Vistoria Computacional 360° (`src/server/inspectionService.ts`)
- Mapeia danos nas 4 quinas (dianteira esquerda/direita, traseira direita/esquerda).
- Estima a profundidade do sulco da banda de rodagem dos pneus em milímetros comparado ao limite legal TWI (1.6 mm).
- Gera foto anotada com círculos de realce e carimbo pericial via Gemini 3.1 Flash Image.

### 3. Suíte Multiagente Autônoma (`src/server/fleetAgents.ts`)
- **Agente Fiscal**: Cruza preços pagos com a série histórica da ANP por município, identificando sobrepreço por litro e economia mensal estimada.
- **Agente Mecânico Preditivo**: Projeta a data exata da próxima revisão preventiva com base no ritmo diário de rodagem e oferece **agendamento em 1-clique**.
- **Agente Financeiro TCO**: Consolida o custo por quilômetro (R$/km), tendências e identifica os maiores ofensores de gastos da frota.
- **Agente de Compliance**: Monitora vencimentos regulatórios de tacógrafo Inmetro, IPVA/licenciamento e CNHs de motoristas.

### 4. Copiloto de Voz Hands-Free & Gestor Falante
- **Copiloto Hands-Free (`src/components/CopilotoVoz.tsx`)**: Registro de abastecimento e ordens mecânicas por comando de voz em tempo real (Gemini 3.8 Live API).
- **Gestor Falante (`src/components/admin/GestorFalanteAudioPlayer.tsx`)**: Síntese matinal em áudio do resumo executivo da frota para diretores e gestores.

---

## 🌐 Conexão com 7 APIs Públicas Gratuitas

O FrotaFácil integra fontes de dados governamentais e cartográficas 100% gratuitas sem exigência de chaves pagas (`src/services/freePublicApisService.ts`):

1. **BrasilAPI Tabela FIPE**: Preço venal oficial de mercado e desvalorização patrimonial.
2. **Open-Meteo API**: Meteorologia ao vivo, alertas de pista molhada e impacto no arrasto de diesel.
3. **BrasilAPI CNPJ**: Consulta e validação cadastral de postos e oficinas na Receita Federal.
4. **BrasilAPI CEP**: Preenchimento automático de logradouro, bairro, cidade e coordenadas.
5. **OSRM Routing Engine**: Roteirização real em malha asfáltica, distância em KM e estimativa de combustível.
6. **Validador SEFAZ NFC-e**: Decodificação da chave de 44 dígitos e conferência algorítmica de dígito verificador via Módulo 11.
7. **BrasilAPI Feriados**: Detecção de abastecimentos e desvios operacionais em feriados nacionais e dias não úteis.

---

## 🔒 Segurança & Persistência Unificada

- **Autenticação Criptográfica Backend**: Assinatura criptográfica HMAC-SHA256 (`generateAuthToken`) com suporte a JWT nativo e Firebase Auth Bearer tokens.
- **Regras de Segurança do Firestore (`firestore.rules`)**: Acesso estritamente restrito a usuários autenticados pertencentes à mesma empresa (`empresaId`).
- **Persistência Unificada em Nuvem**: Espelhamento em tempo real de todas as mutações no Firestore (`companies/{empresaId}/...`), garantindo persistência ininterrupta em hospedagens com disco efêmero (Cloud Run, Vercel, Railway, Docker), com cache local em `fleet_database.json`.

---

## 🚀 Como Executar Localmente

### Pré-requisitos
- **Node.js** (v18 ou superior)
- **npm** ou **bun**

### Instalação

```bash
# 1. Clonar o repositório
git clone https://github.com/Barrisenn84/FrotaFacil.git
cd FrotaFacil

# 2. Instalar as dependências
npm install

# 3. Configurar variáveis de ambiente
cp .env.example .env
# Defina sua GEMINI_API_KEY no arquivo .env
```

### Comandos Disponíveis

```bash
# Iniciar o servidor Express + Vite em desenvolvimento
npm run dev

# Checagem estrita de tipagem TypeScript (zero erros)
npm run lint

# Executar a bateria de testes completa (12 testes automatizados)
npm test

# Gerar o bundle otimizado de produção
npm run build

# Executar servidor em modo produção
npm run start
```

---

## 📁 Estrutura do Projeto

```
├── data/                       # Armazenamento e fallback local
│   ├── fleet_database.json     # Base de dados local com seed multi-empresa
│   └── uploads/                # Diretório de evidências fiscais
├── dist/                       # Bundle compilado de produção (Vite)
├── firestore.rules             # Regras de segurança multi-tenant do Firestore
├── firebase-applet-config.json # Configuração do projeto Firebase
├── src/
│   ├── components/             # Componentes React (Admin, Motorista, Copiloto de Voz)
│   ├── context/                # Contextos globais (FleetContext com JWT integrado)
│   ├── firebase/               # Conexão Firestore com persistência IndexedDB
│   ├── server/                 # Backend Express Enterprise
│   │   ├── aiService.ts        # OCR Dual-Scan Multimodal
│   │   ├── apiRoutes.ts        # Endpoints protegidos por JWT
│   │   ├── authMiddleware.ts   # Middleware de validação criptográfica HMAC-SHA256
│   │   ├── db.ts               # Persistência unificada Firestore + Local
│   │   ├── fleetAgents.ts      # Suíte Multiagente Autônoma (Fiscal, Mecânico, TCO, Compliance)
│   │   ├── inspectionService.ts# Vistoria Computacional 360° e sulco de pneus
│   │   └── validationEngine.ts # Motor de validações de regras de negócio
│   ├── services/               # Serviços (APIs Públicas Gratuitas, Google Sheets, JWT Helper)
│   └── types/                  # Modelos de dados e tipagens TypeScript
├── test_suite_completa.ts      # Bateria de testes automatizados ponta a ponta
└── server.ts                   # Ponto de entrada do servidor Node.js
```

---

## 📄 Licença e Uso

Sistema proprietário desenvolvido para gestão de frotas e automação fiscal por IA.
Todos os direitos reservados © 2026.
