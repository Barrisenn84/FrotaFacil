// Realistic SVG generator for Brazilian fuel receipts & workshop invoices
export function generateSampleReceiptSvg(
  type: 'fuel' | 'maintenance',
  title: string,
  total: number,
  details: string,
  date: string,
  docNumber: string
): string {
  const isFuel = type === 'fuel';
  const headerColor = isFuel ? '#f59e0b' : '#3b82f6';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="640" viewBox="0 0 480 640" style="background:#fffcf2;font-family:'Courier New',monospace;border:1px solid #d4d4d8;">
    <rect width="100%" height="100%" fill="#fffef7"/>
    <path d="M 0,0 L 15,10 L 30,0 L 45,10 L 60,0 L 75,10 L 90,0 L 105,10 L 120,0 L 135,10 L 150,0 L 165,10 L 180,0 L 195,10 L 210,0 L 225,10 L 240,0 L 255,10 L 270,0 L 285,10 L 300,0 L 315,10 L 330,0 L 345,10 L 360,0 L 375,10 L 390,0 L 405,10 L 420,0 L 435,10 L 450,0 L 465,10 L 480,0 L 480,20 L 0,20 Z" fill="#f4f4f5"/>
    
    <text x="240" y="55" font-size="16" font-weight="bold" fill="#18181b" text-anchor="middle">${title.toUpperCase()}</text>
    <text x="240" y="75" font-size="11" fill="#52525b" text-anchor="middle">CNPJ: 14.821.904/0001-45  IE: 114.920.812</text>
    <text x="240" y="92" font-size="11" fill="#71717a" text-anchor="middle">AV. DAS NACOES UNIDAS, 12900 - SP</text>
    <line x1="20" y1="105" x2="460" y2="105" stroke="#71717a" stroke-dasharray="4,4"/>
    
    <text x="25" y="130" font-size="13" font-weight="bold" fill="#27272a">${isFuel ? 'CUPOM FISCAL ELETRONICO (NFC-e)' : 'ORDEM DE SERVICO & DANFE'}</text>
    <text x="25" y="150" font-size="11" fill="#52525b">Doc Nº: ${docNumber} | SERIE: 001</text>
    <text x="25" y="168" font-size="11" fill="#52525b">DATA EMISSAO: ${date} 14:32:10</text>
    <line x1="20" y1="180" x2="460" y2="180" stroke="#71717a" stroke-dasharray="4,4"/>
    
    <text x="25" y="205" font-size="11" font-weight="bold" fill="#3f3f46">ITEM  COD   DESCRICAO      QTD   UN   VL.UN(R$)   TOTAL</text>
    <line x1="20" y1="215" x2="460" y2="215" stroke="#a1a1aa"/>
    
    <text x="25" y="240" font-size="12" fill="#18181b">001   942   ${details}</text>
    <text x="360" y="240" font-size="13" font-weight="bold" fill="#18181b">R$ ${total.toFixed(2)}</text>
    
    <line x1="20" y1="280" x2="460" y2="280" stroke="#71717a" stroke-dasharray="4,4"/>
    
    <text x="25" y="310" font-size="14" font-weight="bold" fill="#18181b">TOTAL BRUTO:</text>
    <text x="455" y="310" font-size="16" font-weight="bold" fill="#18181b" text-anchor="end">R$ ${total.toFixed(2)}</text>
    
    <text x="25" y="335" font-size="14" font-weight="bold" fill="#18181b">VALOR A PAGAR:</text>
    <text x="455" y="335" font-size="18" font-weight="bold" fill="${headerColor}" text-anchor="end">R$ ${total.toFixed(2)}</text>
    
    <text x="25" y="365" font-size="11" fill="#52525b">FORMA PAGTO: CARTAO FROTA EMPRESA</text>
    <text x="25" y="382" font-size="11" fill="#52525b">TRIBUTOS APROX: R$ ${(total * 0.28).toFixed(2)} (IBPT)</text>
    
    <rect x="175" y="415" width="130" height="130" fill="#f4f4f5" stroke="#18181b" stroke-width="2"/>
    <rect x="190" y="430" width="30" height="30" fill="#18181b"/>
    <rect x="260" y="430" width="30" height="30" fill="#18181b"/>
    <rect x="190" y="500" width="30" height="30" fill="#18181b"/>
    <rect x="235" y="470" width="15" height="15" fill="#18181b"/>
    <rect x="255" y="495" width="20" height="20" fill="#18181b"/>
    <text x="240" y="565" font-size="9" fill="#71717a" text-anchor="middle">Consulte pela Chave de Acesso</text>
    <text x="240" y="580" font-size="9" fill="#71717a" text-anchor="middle">3526 0914 8219 0400 0145 6500 1000</text>
    <text x="240" y="610" font-size="10" font-weight="bold" fill="#16a34a" text-anchor="middle">AUTENTICADO COM SUCESSO VIA SEFAZ</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Realistic Dashboard / Odometer SVG for Dual-Scan
export function generateSampleOdometerSvg(kmValue: number, speed = 0): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320" style="background:#09090b;font-family:'Courier New',monospace;">
    <defs>
      <radialGradient id="grad" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
        <stop offset="0%" style="stop-color:#18181b;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#09090b;stop-opacity:1" />
      </radialGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#grad)" rx="16"/>
    <!-- Outer speedometer dial -->
    <circle cx="240" cy="140" r="110" fill="none" stroke="#27272a" stroke-width="8"/>
    <circle cx="240" cy="140" r="110" fill="none" stroke="#3b82f6" stroke-width="8" stroke-dasharray="140 300" stroke-linecap="round"/>
    
    <text x="240" y="85" font-size="12" fill="#71717a" text-anchor="middle" font-family="sans-serif">VELOCIDADE km/h</text>
    <text x="240" y="130" font-size="44" font-weight="bold" fill="#f8fafc" text-anchor="middle" font-family="sans-serif">${speed}</text>
    
    <!-- Digital Odometer box -->
    <rect x="140" y="185" width="200" height="52" fill="#000" rx="8" stroke="#38bdf8" stroke-width="2"/>
    <text x="240" y="202" font-size="10" fill="#38bdf8" text-anchor="middle" font-family="sans-serif" font-weight="bold">ODÔMETRO TOTAL (KM)</text>
    <text x="240" y="228" font-size="24" font-weight="bold" fill="#38bdf8" text-anchor="middle" letter-spacing="4">${kmValue.toLocaleString('pt-BR')}</text>
    
    <!-- Fuel gauge indicator -->
    <path d="M 60,260 Q 90,230 130,240" stroke="#f59e0b" stroke-width="4" fill="none"/>
    <text x="95" y="275" font-size="12" fill="#f59e0b" text-anchor="middle">⛽ 3/4</text>
    
    <text x="385" y="275" font-size="12" fill="#10b981" text-anchor="middle">🌡️ 90°C</text>
    <text x="240" y="300" font-size="11" fill="#64748b" text-anchor="middle">PAINEL DIGITAL VEICULAR INTEGRADO</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const SAMPLE_RECEIPTS = [
  {
    id: 'sample-1',
    label: '⛽ Cupom Posto Ipiranga (R$ 198,00)',
    type: 'abastecimento' as const,
    subtitle: 'Etanol • 45,0L • Dual-Scan Pronto',
    dataUrl: generateSampleReceiptSvg(
      'fuel',
      'Posto Ipiranga Rodoanel Sul',
      198.00,
      'ETANOL COMUM 45.00 L x R$ 4.40',
      '24/09/2026',
      '058190'
    ),
    odometerUrl: generateSampleOdometerSvg(34850),
  },
  {
    id: 'sample-2',
    label: '⛽ Cupom Shell Diesel S10 (R$ 1.547,50)',
    type: 'abastecimento' as const,
    subtitle: 'Diesel S10 • 250L • Scania / Constellation',
    dataUrl: generateSampleReceiptSvg(
      'fuel',
      'Auto Posto Shell Rodovia Anhanguera',
      1547.50,
      'DIESEL S10 250.00 L x R$ 6.19',
      '24/09/2026',
      '049812'
    ),
    odometerUrl: generateSampleOdometerSvg(68200),
  },
  {
    id: 'sample-3',
    label: '🔧 Ordem de Serviço Oficina (R$ 1.030,00)',
    type: 'manutencao' as const,
    subtitle: 'Peças R$ 680 + Mão de Obra R$ 350',
    dataUrl: generateSampleReceiptSvg(
      'maintenance',
      'Centro Automotivo & Diesel Especializado',
      1030.00,
      'PASTILHAS DE FREIO + OLEO SINTETICO',
      '24/09/2026',
      '001890'
    ),
    odometerUrl: generateSampleOdometerSvg(68500),
  },
];
