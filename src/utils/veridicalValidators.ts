/**
 * Utilitários de validação rigorosa de dados verídicos para ambiente corporativo de produção.
 * Garante que nomes, e-mails, celulares e CNPJs correspondam a dados humanos reais e válidos.
 */

// Lista oficial de DDDs ativos no Brasil conforme ANATEL
const VALID_BRAZILIAN_DDDS = new Set([
  '11', '12', '13', '14', '15', '16', '17', '18', '19', // SP
  '21', '22', '24', // RJ
  '27', '28', // ES
  '31', '32', '33', '34', '35', '37', '38', // MG
  '41', '42', '43', '44', '45', '46', // PR
  '47', '48', '49', // SC
  '51', '53', '54', '55', // RS
  '61', // DF
  '62', '64', // GO
  '63', // TO
  '65', '66', // MT
  '67', // MS
  '68', // AC
  '69', // RO
  '71', '73', '74', '75', '77', // BA
  '79', // SE
  '81', '87', // PE
  '82', // AL
  '83', // PB
  '84', // RN
  '85', '88', // CE
  '86', '89', // PI
  '91', '93', '94', // PA
  '92', '97', // AM
  '95', // RR
  '96', // AP
  '98', '99', // MA
]);

// Termos fictícios / testes rejeitados
const BLACKLIST_TEST_WORDS = [
  'teste', 'test', 'tester', 'testing', 'asdf', 'qwerty', 'fake', 'admin',
  'administrador', 'usuario', 'user', 'qualquer', 'nenhum', 'fulano',
  'ciclano', 'beltrano', 'anonimo', 'nobody', 'sistema', 'system',
];

/**
 * Validação rigorosa de Nome Completo Verídico:
 * - Mínimo de 2 palavras (Nome e Sobrenome)
 * - Mínimo de 2 caracteres por palavra
 * - Apenas letras válidas e acentuações da língua portuguesa
 * - Rejeita números, símbolos e termos de teste
 */
export function validateVeridicalFullName(name: string): { isValid: boolean; error?: string } {
  const clean = name.trim();
  if (!clean) {
    return { isValid: false, error: 'O nome completo é obrigatório.' };
  }

  // Verificar se contém números ou símbolos impróprios
  if (/[0-9!@#$%^&*()_+=[\]{};:"\\|,.<>/?~`]/.test(clean)) {
    return { isValid: false, error: 'O nome não deve conter números ou caracteres especiais.' };
  }

  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length < 2) {
    return { isValid: false, error: 'Informe nome e sobrenome completos (mínimo de 2 palavras).' };
  }

  for (const part of parts) {
    if (part.length < 2) {
      return { isValid: false, error: 'Cada parte do nome deve ter pelo menos 2 letras.' };
    }
    const lower = part.toLowerCase();
    if (BLACKLIST_TEST_WORDS.includes(lower)) {
      return { isValid: false, error: `O termo "${part}" não é aceito como nome verídico de cadastro.` };
    }
  }

  // Rejeitar sequências repetitivas (ex: aaaaa, bbbbb)
  if (/(.)\1{3,}/.test(clean.toLowerCase())) {
    return { isValid: false, error: 'O nome contém letras repetidas de forma inválida.' };
  }

  return { isValid: true };
}

/**
 * Validação rigorosa de E-mail Corporativo Verídico:
 * - Formato RFC padrão
 * - Domínio com extensão válida (mínimo 2 letras no TLD)
 * - Rejeita e-mails descartáveis ou de teste conhecidos
 */
export function validateVeridicalEmail(email: string): { isValid: boolean; error?: string } {
  const clean = email.trim().toLowerCase();
  if (!clean) {
    return { isValid: false, error: 'O e-mail é obrigatório.' };
  }

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(clean)) {
    return { isValid: false, error: 'Formato de e-mail inválido (ex: nome@empresa.com.br).' };
  }

  const [localPart, domain] = clean.split('@');
  if (BLACKLIST_TEST_WORDS.includes(localPart)) {
    return { isValid: false, error: 'E-mails contendo termos genéricos de teste não são permitidos.' };
  }

  const fakeDomains = ['test.com', 'teste.com', 'example.com', 'email.com', 'fake.com', 'asdf.com', 'tempmail.com'];
  if (fakeDomains.includes(domain)) {
    return { isValid: false, error: 'Por favor, informe um endereço de e-mail corporativo autêntico.' };
  }

  return { isValid: true };
}

/**
 * Formata celular brasileiro para o padrão (XX) 9XXXX-XXXX
 */
export function formatBrazilianPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

/**
 * Validação rigorosa de Celular / WhatsApp Brasileiro:
 * - Deve ter 11 dígitos com DDD válido (ANATEL)
 * - 9º dígito obrigatório (o celular deve iniciar com 9)
 * - Rejeita números repetitivos falsos (ex: 99999-9999)
 */
export function validateVeridicalBrazilianPhone(phone: string): { isValid: boolean; error?: string; formatted?: string } {
  const digits = phone.replace(/\D/g, '');
  if (!digits) {
    return { isValid: false, error: 'O celular / WhatsApp é obrigatório.' };
  }

  if (digits.length !== 11) {
    return {
      isValid: false,
      error: `O celular deve ter 11 dígitos com DDD (atualmente possui ${digits.length}). Ex: (11) 98765-4321`,
    };
  }

  const ddd = digits.slice(0, 2);
  if (!VALID_BRAZILIAN_DDDS.has(ddd)) {
    return { isValid: false, error: `O DDD (${ddd}) informado não corresponde a uma região válida no Brasil.` };
  }

  const firstMobileDigit = digits.charAt(2);
  if (firstMobileDigit !== '9') {
    return { isValid: false, error: 'Celulares e WhatsApps brasileiros devem obrigatoriamente iniciar com 9 após o DDD.' };
  }

  // Rejeitar dígitos todos repetidos
  const body = digits.slice(2);
  if (/^(\d)\1+$/.test(body)) {
    return { isValid: false, error: 'Número de telefone inválido (sequência de números repetidos).' };
  }

  return { isValid: true, formatted: formatBrazilianPhone(digits) };
}

/**
 * Formata CNPJ para o padrão 00.000.000/0000-00
 */
export function formatCnpj(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (!digits) return '';
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
}

/**
 * Validação do algoritmo matemático oficial do CNPJ da Receita Federal
 */
export function validateVeridicalCnpj(cnpj: string): { isValid: boolean; error?: string; formatted?: string } {
  const digits = cnpj.replace(/\D/g, '');
  if (!digits) {
    return { isValid: false, error: 'O CNPJ é obrigatório.' };
  }

  if (digits.length !== 14) {
    return { isValid: false, error: 'O CNPJ deve conter exatamente 14 dígitos numéricos.' };
  }

  // Rejeitar sequências conhecidas de dígitos iguais
  if (/^(\d)\1{13}$/.test(digits)) {
    return { isValid: false, error: 'CNPJ inválido (dígitos repetidos).' };
  }

  // 1º dígito verificador
  let size = 12;
  let numbers = digits.substring(0, size);
  let pos = size - 7;
  let sum = 0;
  for (let i = size; i >= 1; i--) {
    sum += Number(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== Number(digits.charAt(12))) {
    return { isValid: false, error: 'Dígito verificador do CNPJ inválido pela Receita Federal.' };
  }

  // 2º dígito verificador
  size = 13;
  numbers = digits.substring(0, size);
  pos = size - 7;
  sum = 0;
  for (let i = size; i >= 1; i--) {
    sum += Number(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== Number(digits.charAt(13))) {
    return { isValid: false, error: 'CNPJ não aprovado na validação de dígitos verificadores.' };
  }

  return { isValid: true, formatted: formatCnpj(digits) };
}
