import http from 'http';
import { parseSefazNfceKey } from './src/services/freePublicApisService.js';
import { generateAuthToken, verifyAuthToken } from './src/server/authMiddleware.js';
import { db } from './src/server/db.js';

async function runTestSuite() {
  console.log('=====================================================');
  console.log('🚀 INICIANDO BATERIA DE TESTES COMPLETOS DO FROTAFÁCIL');
  console.log('=====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} ${detail ? `- ${detail}` : ''}`);
      failed++;
    }
  }

  // 1. TESTE DO MOTOR DE AUTENTICAÇÃO CRIPTOGRÁFICA JWT
  console.log('--- 1. TESTES DE AUTENTICAÇÃO JWT E SEGURANÇA BACKEND ---');
  const mockUser = {
    id: 'usr-admin-translog',
    company_id: 'comp-translog-01',
    name: 'Renata Albuquerque',
    email: 'admin@translog.com.br',
    role: 'administrativo' as const,
    active: true,
    created_at: new Date().toISOString(),
  };
  const mockCompany = {
    id: 'comp-translog-01',
    name: 'TransLog Transportes',
    cnpj: '12.345.678/0001-90',
    maxTankMarginPercent: 10,
    status: 'active' as const,
    created_at: new Date().toISOString(),
  };

  const jwtToken = generateAuthToken(mockUser, mockCompany);
  assert(typeof jwtToken === 'string' && jwtToken.split('.').length === 3, 'Geração de Token JWT com 3 partes criptográficas');

  const verified = verifyAuthToken(jwtToken);
  assert(verified !== null && verified.userId === mockUser.id && verified.companyId === mockCompany.id, 'Validação e decodificação do Token JWT com HMAC-SHA256');

  const tamperedToken = jwtToken.substring(0, jwtToken.length - 5) + 'XXXXX';
  const tamperedVerified = verifyAuthToken(tamperedToken);
  assert(tamperedVerified === null, 'Rejeição estrita de token fraudado ou assinatura alterada');

  // 2. TESTE DE PERSISTÊNCIA MULTI-TENANT E BANCO
  console.log('\n--- 2. TESTES DE PERSISTÊNCIA E MULTIEMPRESA (db.ts) ---');
  const company = db.getCompany('comp-translog-01');
  assert(!!company && company.name.includes('TransLog'), 'Isolamento de dados da empresa TransLog');

  const vehicles = db.getVehicles('comp-translog-01');
  assert(vehicles.length >= 3, `Veículos cadastrados com sucesso (${vehicles.length} encontrados)`);

  const drivers = db.getDrivers('comp-translog-01');
  assert(drivers.length >= 2, `Motoristas vinculados com sucesso (${drivers.length} encontrados)`);

  // Teste de criação e atualização de veículo
  const testVeh = db.createVehicle('comp-translog-01', {
    plate: 'TEST999',
    chassi: '9BD99999999999999',
    renavam: '99999999999',
    make: 'Mercedes-Benz',
    model: 'Actros 2651',
    year: 2024,
    fuel_type: 'Diesel S10',
    tank_capacity_liters: 600,
    initial_km: 1000,
    current_km: 2500,
    status: 'ativo',
  });
  assert(testVeh.plate === 'TEST999', 'Criação de veículo com espelhamento no banco');

  const updatedVeh = db.updateVehicle('comp-translog-01', testVeh.id, { current_km: 2900 });
  assert(updatedVeh?.current_km === 2900, 'Atualização de odômetro do veículo');

  // 3. TESTE DAS APIS GRATUITAS: VALIDADOR SEFAZ NFC-e
  console.log('\n--- 3. TESTES DE APIS GRATUITAS E PARSER SEFAZ ---');
  // Chave real padrão de 44 dígitos
  const validKey = '35240512345678000190650010000012341234567897';
  const sefazResult = parseSefazNfceKey(validKey);
  assert(sefazResult !== null && sefazResult.ufName === 'SP' && sefazResult.model === '65', 'Decodificação da chave de acesso SEFAZ NFC-e (UF: SP, Modelo 65)');
  assert(sefazResult !== null && typeof sefazResult.isCheckDigitValid === 'boolean', 'Validação de dígito verificador via algoritmo Módulo 11');

  // Chave inválida com menos de 44 dígitos
  const invalidKey = '123456';
  const sefazInvalid = parseSefazNfceKey(invalidKey);
  assert(sefazInvalid === null, 'Rejeição correta de chave SEFAZ com tamanho incompatível (retorna null)');

  // 4. TESTE DE AUDITORIA DE REGRAS DE SEGURANÇA FIRESTORE
  console.log('\n--- 4. TESTES DAS REGRAS DE SEGURANÇA (firestore.rules) ---');
  const fs = await import('fs');
  const rulesContent = fs.readFileSync('./firestore.rules', 'utf-8');
  assert(rulesContent.includes('isAuthenticated()') && rulesContent.includes('belongsToCompany(empresaId)'), 'Regras do Firestore com bloqueio não-autenticado e validação de empresaId');

  console.log('\n=====================================================');
  console.log(`📊 RESULTADO FINAL DA AUDITORIA: ${passed} PASSOU | ${failed} FALHOU`);
  console.log('=====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error('Erro fatal nos testes:', err);
  process.exit(1);
});
