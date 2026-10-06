import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ReportDataPoint {
  month: string;
  monthShort?: string;
  fuelSpend: number;
  maintenanceSpend: number;
  totalSpend: number;
  projectedWithoutAI?: number;
  savingsGenerated?: number;
  litersSaved?: number;
  avgKmL: number;
}

export interface VehicleReportItem {
  plate: string;
  model: string;
  driverName?: string;
  odometer: number;
  kmDriven: number;
  fuelSpend: number;
  maintSpend: number;
  liters: number;
  avgKmL: number;
  status: string;
}

export interface ExecutiveDashboardPDFOptions {
  companyName: string;
  companyCnpj?: string;
  generatedBy?: string;
  periodLabel: string;
  chartData?: ReportDataPoint[];
  vehicles?: VehicleReportItem[];
  totals: {
    totalSpent: number;
    totalFuel: number;
    totalParts?: number;
    totalLabor?: number;
    totalSavings: number;
    totalLitersSaved: number;
    totalLiters?: number;
    avgEfficiency: string;
    costPerKm?: number;
    savingsPercent: string;
  };
  fleetSummary?: {
    totalVehicles: number;
    activeVehicles: number;
    maintenanceVehicles?: number;
    totalDrivers: number;
    activeDrivers?: number;
    totalKmDriven: number;
  };
  upcomingMaintenances?: Array<{
    plate: string;
    model: string;
    description: string;
    kmUntil: number;
    isOverdue: boolean;
  }>;
  sections?: {
    kpis?: boolean;
    vehicles?: boolean;
    monthly?: boolean;
    governance?: boolean;
    signatures?: boolean;
  };
}

export function exportDashboardExecutivePDF(options: ExecutiveDashboardPDFOptions): void {
  const {
    companyName,
    companyCnpj = '12.345.678/0001-90',
    generatedBy = 'Gestor de Frota',
    periodLabel,
    chartData = [],
    vehicles = [],
    totals,
    fleetSummary,
    upcomingMaintenances = [],
    sections = {
      kpis: true,
      vehicles: true,
      monthly: true,
      governance: true,
      signatures: true,
    },
  } = options;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const authCode = `FF-EXP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    }).format(val || 0);
  };

  const drawHeader = () => {
    // 1. Cabeçalho Corporativo Superior (Banner Slate Escuro)
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageWidth, 36, 'F');

    // Linha de Destaque Âmbar Corporativo
    doc.setFillColor(245, 158, 11); // amber-500
    doc.rect(0, 36, pageWidth, 2, 'F');

    // Logotipo / Tag Superior
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(245, 158, 11); // amber-500
    doc.text('FROTAFÁCIL AI ENTERPRISE  •  RELATÓRIO EXECUTIVO DE CUSTOS & EFICIÊNCIA', 14, 11);

    // Título do Relatório
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text('Relatório Gerencial de Desempenho e Governança da Frota', 14, 20);

    // Subtítulo Empresa e Período
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(203, 213, 225); // slate-300
    doc.text(`Empresa: ${companyName}   |   CNPJ: ${companyCnpj}   |   Período: ${periodLabel}`, 14, 28);

    // Informações de Emissão no canto direito
    const todayStr = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(`Emissão: ${todayStr}`, pageWidth - 14, 12, { align: 'right' });
    doc.text(`Responsável: ${generatedBy}`, pageWidth - 14, 18, { align: 'right' });
    doc.text(`Autenticação: ${authCode}`, pageWidth - 14, 24, { align: 'right' });
  };

  drawHeader();

  let currentY = 44;

  // 1. Quadro Resumo dos Indicadores Principais (KPIs)
  if (sections.kpis !== false) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('1. Indicadores Financeiros e Eficiência Operacional Consolidada', 14, currentY);
    currentY += 4;

    const cardWidth = (pageWidth - 28 - 9) / 4; // 4 colunas com 3mm de gap
    const cardHeight = 22;

    // Card 1: Gastos Totais da Frota
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, currentY, cardWidth, cardHeight, 2, 2, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('GASTO TOTAL DA FROTA', 14 + 3, currentY + 5.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(formatBRL(totals.totalSpent), 14 + 3, currentY + 12);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Combustível: ${formatBRL(totals.totalFuel)}`, 14 + 3, currentY + 17.5);

    // Card 2: Consumo Médio (km/L)
    const card2X = 14 + cardWidth + 3;
    doc.setFillColor(240, 253, 244); // emerald-50
    doc.setDrawColor(187, 247, 208); // emerald-200
    doc.roundedRect(card2X, currentY, cardWidth, cardHeight, 2, 2, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(21, 128, 61); // emerald-700
    doc.text('CONSUMO MÉDIO DA FROTA', card2X + 3, currentY + 5.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(22, 101, 52); // emerald-800
    doc.text(`${totals.avgEfficiency} km/L`, card2X + 3, currentY + 12);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(21, 128, 61);
    const litVal = totals.totalLiters || totals.totalLitersSaved || 0;
    doc.text(litVal > 0 ? `${litVal.toLocaleString('pt-BR')} L auditados` : 'Sem registros no período', card2X + 3, currentY + 17.5);

    // Card 3: Custo por KM (R$/km)
    const card3X = card2X + cardWidth + 3;
    doc.setFillColor(239, 246, 255); // blue-50
    doc.setDrawColor(191, 219, 254); // blue-200
    doc.roundedRect(card3X, currentY, cardWidth, cardHeight, 2, 2, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(29, 78, 216); // blue-700
    doc.text('CUSTO POR KM RODADO', card3X + 3, currentY + 5.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(30, 64, 175); // blue-800
    const cKm = totals.costPerKm ?? (totals.totalSpent > 0 && (fleetSummary?.totalKmDriven || 0) > 0 ? totals.totalSpent / (fleetSummary?.totalKmDriven || 1) : 0);
    doc.text(`R$ ${cKm.toFixed(2)} /km`, card3X + 3, currentY + 12);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(29, 78, 216);
    doc.text(`KM Total: ${(fleetSummary?.totalKmDriven || 0).toLocaleString('pt-BR')} km`, card3X + 3, currentY + 17.5);

    // Card 4: Economia Gerada IA / Governança
    const card4X = card3X + cardWidth + 3;
    doc.setFillColor(254, 252, 232); // amber-50
    doc.setDrawColor(254, 240, 138); // amber-200
    doc.roundedRect(card4X, currentY, cardWidth, cardHeight, 2, 2, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(180, 83, 9); // amber-700
    doc.text('ECONOMIA AUDITADA IA', card4X + 3, currentY + 5.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(146, 64, 14); // amber-800
    doc.text(formatBRL(totals.totalSavings), card4X + 3, currentY + 12);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 83, 9);
    doc.text(
      totals.totalSavings > 0
        ? `+${totals.savingsPercent}% de eficiência`
        : 'Governança ativa sem desvios',
      card4X + 3,
      currentY + 17.5
    );

    currentY += cardHeight + 6;

    // Resumo de Categorias e Frota Operacional (Linha Compacta)
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, currentY, pageWidth - 28, 12, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text('DISTRIBUIÇÃO DE DESPESAS:', 18, currentY + 5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    const partsVal = totals.totalParts || 0;
    const laborVal = totals.totalLabor || 0;
    doc.text(
      `Combustível: ${formatBRL(totals.totalFuel)}   |   Peças Mecânicas: ${formatBRL(partsVal)}   |   Oficina/Mão de Obra: ${formatBRL(laborVal)}`,
      18,
      currentY + 9
    );

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text(
      `FROTA: ${fleetSummary?.totalVehicles || 0} veículos (${fleetSummary?.activeVehicles || 0} ativos)  •  ${fleetSummary?.totalDrivers || 0} motoristas`,
      pageWidth - 18,
      currentY + 7,
      { align: 'right' }
    );

    currentY += 17;
  }

  // 2. Tabela de Detalhamento por Veículo
  if (sections.vehicles !== false && vehicles.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('2. Detalhamento e Desempenho por Veículo Operacional', 14, currentY);
    currentY += 3;

    const vehicleRows = vehicles.map((v) => [
      v.plate,
      v.model,
      v.driverName || 'Não escalado',
      `${(v.odometer || 0).toLocaleString('pt-BR')} km`,
      `${(v.kmDriven || 0).toLocaleString('pt-BR')} km`,
      formatBRL(v.fuelSpend || 0),
      formatBRL(v.maintSpend || 0),
      formatBRL((v.fuelSpend || 0) + (v.maintSpend || 0)),
      v.avgKmL > 0 ? `${v.avgKmL.toFixed(2)} km/L` : '0.00 km/L',
      v.status === 'ativo' ? 'Ativo' : 'Manutenção',
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [
        [
          'Placa',
          'Modelo do Veículo',
          'Condutor',
          'Odômetro',
          'KM Rodado',
          'Combustível',
          'Manutenção',
          'Custo Total',
          'Média km/L',
          'Status',
        ],
      ],
      body: vehicleRows,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: 'bold',
        halign: 'center',
      },
      bodyStyles: {
        fontSize: 7,
        textColor: [51, 65, 85],
        halign: 'right',
      },
      columnStyles: {
        0: { halign: 'center', fontStyle: 'bold', textColor: [15, 23, 42], cellWidth: 18 },
        1: { halign: 'left', cellWidth: 32 },
        2: { halign: 'left', cellWidth: 26 },
        3: { halign: 'right', cellWidth: 18 },
        4: { halign: 'right', cellWidth: 16 },
        5: { textColor: [180, 83, 9], cellWidth: 18 },
        6: { textColor: [29, 78, 216], cellWidth: 18 },
        7: { fontStyle: 'bold', textColor: [15, 23, 42], cellWidth: 18 },
        8: { halign: 'center', fontStyle: 'bold', textColor: [22, 101, 52], cellWidth: 16 },
        9: { halign: 'center', cellWidth: 14 },
      },
      margin: { left: 14, right: 14 },
    });

    // @ts-ignore
    currentY = doc.lastAutoTable.finalY + 7;
  } else if (sections.vehicles !== false && vehicles.length === 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('2. Detalhamento por Veículo Operacional', 14, currentY);
    currentY += 4;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, currentY, pageWidth - 28, 12, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Nenhum veículo individual cadastrado no momento.', 18, currentY + 7);
    currentY += 18;
  }

  // 3. Tabela de Demonstrativo Mensal (se houver dados históricos)
  if (sections.monthly !== false && chartData.length > 0) {
    if (currentY > pageHeight - 65) {
      doc.addPage();
      drawHeader();
      currentY = 44;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('3. Demonstrativo Mensal Histórico de Custos e Economia IA', 14, currentY);
    currentY += 3;

    const monthlyRows = chartData.map((item) => [
      item.month,
      formatBRL(item.fuelSpend),
      formatBRL(item.maintenanceSpend),
      formatBRL(item.totalSpend),
      formatBRL(item.projectedWithoutAI || item.totalSpend),
      formatBRL(item.savingsGenerated || 0),
      `${(item.litersSaved || 0).toLocaleString('pt-BR')} L`,
      `${item.avgKmL.toFixed(2)} km/L`,
    ]);

    // Linha de Totais da Tabela
    monthlyRows.push([
      'TOTAIS / MÉDIAS',
      formatBRL(totals.totalFuel),
      formatBRL(totals.totalSpent - totals.totalFuel),
      formatBRL(totals.totalSpent),
      formatBRL(totals.totalSpent + totals.totalSavings),
      formatBRL(totals.totalSavings),
      `${totals.totalLitersSaved.toLocaleString('pt-BR')} L`,
      `${totals.avgEfficiency} km/L`,
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [
        [
          'Mês / Período',
          'Combustível (R$)',
          'Oficina & Peças',
          'Gasto Auditado',
          'Custo Proj. s/ IA',
          'Economia Gerada',
          'Diesel Poupado',
          'Rendimento',
        ],
      ],
      body: monthlyRows,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: 'bold',
        halign: 'center',
      },
      bodyStyles: {
        fontSize: 7,
        textColor: [51, 65, 85],
        halign: 'right',
      },
      columnStyles: {
        0: { halign: 'left', fontStyle: 'bold', cellWidth: 26 },
        1: { textColor: [180, 83, 9] },
        2: { textColor: [29, 78, 216] },
        3: { fontStyle: 'bold', textColor: [15, 23, 42] },
        4: { textColor: [100, 116, 139] },
        5: { fontStyle: 'bold', textColor: [21, 128, 61] },
        6: { textColor: [5, 150, 105] },
        7: { halign: 'center', fontStyle: 'bold' },
      },
      didParseCell: (data) => {
        if (data.row.index === monthlyRows.length - 1) {
          data.cell.styles.fillColor = [241, 245, 249];
          data.cell.styles.fontStyle = 'bold';
        }
      },
      margin: { left: 14, right: 14 },
    });

    // @ts-ignore
    currentY = doc.lastAutoTable.finalY + 7;
  }

  // 4. Manutenções Preventivas e Alertas Críticos (se houver)
  if (upcomingMaintenances.length > 0) {
    if (currentY > pageHeight - 55) {
      doc.addPage();
      drawHeader();
      currentY = 44;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('4. Próximas Manutenções Preventivas Programadas', 14, currentY);
    currentY += 3;

    const maintRows = upcomingMaintenances.map((m) => [
      m.plate,
      m.model,
      m.description,
      m.isOverdue ? `ATRASADA (${Math.abs(m.kmUntil).toLocaleString('pt-BR')} km ultrapassados)` : `Faltam ${m.kmUntil.toLocaleString('pt-BR')} km`,
      m.isOverdue ? 'CRÍTICO' : 'ATENÇÃO',
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Placa', 'Veículo', 'Serviço Programado', 'Status de Quilometragem', 'Urgência']],
      body: maintRows,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: 'bold',
        halign: 'center',
      },
      bodyStyles: { fontSize: 7, textColor: [51, 65, 85] },
      columnStyles: {
        0: { halign: 'center', fontStyle: 'bold', cellWidth: 20 },
        1: { cellWidth: 35 },
        2: { cellWidth: 60 },
        3: { halign: 'right', fontStyle: 'bold', cellWidth: 40 },
        4: { halign: 'center', fontStyle: 'bold', cellWidth: 25 },
      },
      margin: { left: 14, right: 14 },
    });

    // @ts-ignore
    currentY = doc.lastAutoTable.finalY + 7;
  }

  // 5. Governança, Anti-Fraude e Metodologia de IA
  if (sections.governance !== false) {
    if (currentY > pageHeight - 60) {
      doc.addPage();
      drawHeader();
      currentY = 44;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('Mecanismos de Governança, Auditoria Fiscal e Prevenção de Fraude (FrotaFácil AI)', 14, currentY);
    currentY += 3.5;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, currentY, pageWidth - 28, 24, 1.5, 1.5, 'FD');

    const bullets = [
      '• Anti-Sobretanque com Validação Nominal: Bloqueia qualquer abastecimento com litragem superior à capacidade física do modelo.',
      '• Auditoria Dual-Scan de Odômetro: Exige fotografia do painel do veículo cruzada com a nota fiscal para cálculo auditado de km/L.',
      '• Proteção Criptográfica Anti-Duplicação: Gera hash digital de cada cupom fiscal para impedir duplicidades ou reembolsos indevidos.',
      '• Grounding com Preços Oficiais ANP: Compara os valores pagos nos postos com as médias de mercado na rota do veículo.',
    ];

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);

    bullets.forEach((b, index) => {
      doc.text(b, 17, currentY + 4.5 + index * 4.5);
    });

    currentY += 31;
  }

  // 6. Bloco de Assinaturas Executivas
  if (sections.signatures !== false) {
    if (currentY > pageHeight - 35) {
      doc.addPage();
      drawHeader();
      currentY = 48;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Conformidade e Aprovação Executiva', 14, currentY);
    currentY += 12;

    const sigWidth = 72;
    // Assinatura 1
    doc.setDrawColor(148, 163, 184);
    doc.line(18, currentY, 18 + sigWidth, currentY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Gestor Operacional de Frota', 18 + sigWidth / 2, currentY + 3.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`${companyName}  •  ${generatedBy}`, 18 + sigWidth / 2, currentY + 7, { align: 'center' });

    // Assinatura 2
    const sig2X = pageWidth - 18 - sigWidth;
    doc.line(sig2X, currentY, sig2X + sigWidth, currentY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Diretoria Executiva / Controladoria', sig2X + sigWidth / 2, currentY + 3.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Aprovado para Auditoria e Fins Contábeis', sig2X + sigWidth / 2, currentY + 7, { align: 'center' });
  }

  // 7. Rodapés em todas as páginas
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Documento oficial emitido por FrotaFácil AI Enterprise v2.0  •  Autenticação: ${authCode}  •  Válido para apresentações corporativas e auditoria`,
      14,
      pageHeight - 6
    );
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - 14, pageHeight - 6, { align: 'right' });
  }

  // Download do PDF
  const cleanName = companyName.replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `Relatorio_Executivo_Frota_${cleanName}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}

// Manter compatibilidade com chamadas anteriores de exportFleetAnalyticsPDF
export interface PDFExportOptions {
  companyName: string;
  companyCnpj?: string;
  generatedBy?: string;
  periodLabel: string;
  chartData: ReportDataPoint[];
  totals: {
    totalSpent: number;
    totalFuel: number;
    totalSavings: number;
    totalLitersSaved: number;
    avgEfficiency: string;
    savingsPercent: string;
  };
  fleetSummary?: {
    totalVehicles: number;
    activeVehicles: number;
    totalDrivers: number;
    totalKmDriven: number;
  };
}

export function exportFleetAnalyticsPDF(options: PDFExportOptions): void {
  exportDashboardExecutivePDF({
    companyName: options.companyName,
    companyCnpj: options.companyCnpj,
    generatedBy: options.generatedBy,
    periodLabel: options.periodLabel,
    chartData: options.chartData,
    totals: options.totals,
    fleetSummary: options.fleetSummary,
  });
}
