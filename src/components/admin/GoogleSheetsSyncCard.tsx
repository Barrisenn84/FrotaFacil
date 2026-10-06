import React, { useState } from 'react';
import {
  FileSpreadsheet,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Layers,
  Sparkles,
  Table,
  Fuel,
  Wrench,
  DollarSign,
  FileText,
  Truck,
  Download,
  Link2,
  Unlink,
  PlusCircle,
  HelpCircle,
} from 'lucide-react';
import { useFleet } from '../../context/FleetContext';
import {
  createCompanyFleetSpreadsheet,
  syncEntireFleetToGoogleSheet,
} from '../../services/googleSheetsService';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';

export const GoogleSheetsSyncCard: React.FC = () => {
  const { currentCompany, vehicles, rawFuelings, rawMaintenance, documents } = useFleet();

  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [showManualInput, setShowManualInput] = useState<boolean>(false);
  const [manualSheetInput, setManualSheetInput] = useState<string>('');

  const spreadsheetId = currentCompany?.sheets_spreadsheet_id;
  const spreadsheetUrl =
    currentCompany?.sheets_spreadsheet_url ||
    (spreadsheetId ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` : null);

  // Helper para extrair o ID de qualquer URL de planilha do Google Sheets
  const extractSpreadsheetId = (input: string): string => {
    const trimmed = input.trim();
    const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      return match[1];
    }
    return trimmed;
  };

  const handleSaveManualSheet = async () => {
    if (!currentCompany) return;
    const extractedId = extractSpreadsheetId(manualSheetInput);
    if (!extractedId || extractedId.length < 5) {
      setFeedback({
        type: 'error',
        message: 'Por favor, insira um link válido ou ID da planilha do Google Sheets.',
      });
      return;
    }

    try {
      const url = `https://docs.google.com/spreadsheets/d/${extractedId}/edit`;
      const compRef = doc(db, 'companies', currentCompany.id);
      await updateDoc(compRef, {
        sheets_spreadsheet_id: extractedId,
        sheets_spreadsheet_url: url,
        sheets_synced_at: new Date().toISOString(),
        sheets_auto_sync: true,
      });

      setFeedback({
        type: 'success',
        message: 'Planilha vinculada com sucesso à empresa!',
      });
      setShowManualInput(false);
      setManualSheetInput('');
      setTimeout(() => setFeedback(null), 6000);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Erro ao vincular planilha.',
      });
    }
  };

  const handleUnlinkSheet = async () => {
    if (!currentCompany) return;
    try {
      const compRef = doc(db, 'companies', currentCompany.id);
      await updateDoc(compRef, {
        sheets_spreadsheet_id: null,
        sheets_spreadsheet_url: null,
        sheets_synced_at: null,
      });
      setFeedback({
        type: 'info',
        message: 'Planilha desvinculada. Você pode criar ou vincular outra quando desejar.',
      });
      setTimeout(() => setFeedback(null), 5000);
    } catch (e: any) {
      setFeedback({
        type: 'error',
        message: 'Erro ao desvincular planilha.',
      });
    }
  };

  const handleDownloadCSV = () => {
    try {
      const companyName = currentCompany?.name || 'FrotaFacil';
      // Construir CSV combinado com seções claras
      let csvContent = '\uFEFF'; // UTF-8 BOM para abrir acentos perfeitamente no Excel

      // 1. Veículos
      csvContent += '=== VEÍCULOS ===\n';
      csvContent += 'Placa;Modelo;Marca;Ano;Combustível;KM Inicial;KM Atual;Tanque (L);Status\n';
      vehicles.forEach((v) => {
        csvContent += `"${v.plate}";"${v.model}";"${v.make || ''}";"${v.year || ''}";"${v.fuel_type}";"${v.initial_km || 0}";"${v.current_km}";"${v.tank_capacity_liters}";"${v.status}"\n`;
      });
      csvContent += '\n';

      // 2. Abastecimentos
      csvContent += '=== ABASTECIMENTOS ===\n';
      csvContent += 'Data;Placa;Odômetro;Litros;Preço/Litro;Valor Total;Posto;Motorista;Tanque Cheio;Origem IA\n';
      rawFuelings.forEach((f) => {
        csvContent += `"${f.data || f.dataHora || ''}";"${f.placa || ''}";"${f.odometro || ''}";"${f.litros || ''}";"${f.precoLitro || ''}";"${f.valorTotal || ''}";"${f.posto || ''}";"${f.motoristaNome || ''}";"${f.tanqueCheio ? 'Sim' : 'Não'}";"${f.comprovanteUrl ? 'Foto OCR' : 'Manual'}"\n`;
      });
      csvContent += '\n';

      // 3. Manutenções
      csvContent += '=== MANUTENÇÕES ===\n';
      csvContent += 'Data;Placa;Tipo;Descrição;Oficina;Odômetro;Peças;Mão de Obra;Valor Total;Status\n';
      rawMaintenance.forEach((m) => {
        csvContent += `"${m.data || ''}";"${m.placa || ''}";"${m.tipo || ''}";"${m.descricao || ''}";"${m.oficina || ''}";"${m.odometro || ''}";"${m.custoPecas || 0}";"${m.custoMaoDeObra || 0}";"${m.valorTotal || 0}";"${m.status || 'Concluída'}"\n`;
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Planilha_Frota_${companyName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setFeedback({
        type: 'success',
        message: 'Planilha oficial da frota baixada com sucesso no formato CSV/Excel!',
      });
      setTimeout(() => setFeedback(null), 5000);
    } catch (e: any) {
      setFeedback({
        type: 'error',
        message: 'Erro ao gerar arquivo de planilha.',
      });
    }
  };

  const handleCreateOrConnectSheet = async () => {
    if (!currentCompany) return;
    setIsCreating(true);
    setFeedback(null);

    const res = await createCompanyFleetSpreadsheet(currentCompany.name, {
      vehicles,
      fuelings: rawFuelings,
      maintenances: rawMaintenance,
      documents,
    });

    setIsCreating(false);

    if (res.success && res.spreadsheetId) {
      // Salvar no Firestore na empresa
      try {
        const compRef = doc(db, 'companies', currentCompany.id);
        await updateDoc(compRef, {
          sheets_spreadsheet_id: res.spreadsheetId,
          sheets_spreadsheet_url: res.spreadsheetUrl,
          sheets_synced_at: new Date().toISOString(),
          sheets_auto_sync: true,
        });
      } catch (err) {
        console.warn('Erro ao atualizar empresa com ID da planilha:', err);
      }

      setFeedback({
        type: 'success',
        message: `Planilha "FrotaFácil - ${currentCompany.name}" criada e conectada com sucesso no seu Google Drive!`,
      });
      setTimeout(() => setFeedback(null), 6000);
    } else {
      const isCancelled = res.error?.includes('cancelada');
      const isAccessDenied = res.error?.includes('Erro 403') || res.error?.includes('bloqueado');
      setFeedback({
        type: isCancelled ? 'info' : 'error',
        message: res.error || 'Falha ao criar planilha no Google Workspace.',
      });
      if (isAccessDenied) {
        setShowManualInput(true);
      }
    }
  };

  const handleSyncNow = async () => {
    if (!currentCompany || !spreadsheetId) return;
    setIsSyncing(true);
    setFeedback(null);

    const res = await syncEntireFleetToGoogleSheet(spreadsheetId, {
      vehicles,
      fuelings: rawFuelings,
      maintenances: rawMaintenance,
      documents,
    });

    setIsSyncing(false);

    if (res.success) {
      try {
        const compRef = doc(db, 'companies', currentCompany.id);
        await updateDoc(compRef, {
          sheets_synced_at: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('Erro ao atualizar timestamp de sync:', e);
      }
      setFeedback({
        type: 'success',
        message: 'Planilha Google Sheets 100% sincronizada com todos os dados da frota!',
      });
      setTimeout(() => setFeedback(null), 5000);
    } else {
      const isCancelled = res.error?.includes('cancelada');
      setFeedback({
        type: isCancelled ? 'info' : 'error',
        message: res.error || 'Erro ao sincronizar dados com a planilha.',
      });
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5 relative overflow-hidden font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shadow-lg shadow-emerald-500/10">
            <FileSpreadsheet className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-white">
                Espelho Google Sheets da Empresa
              </h3>
              <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Google Workspace • 5 Abas
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Planilha "FrotaFácil - {currentCompany?.name}" atualizada em tempo real para a equipe administrativa
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadCSV}
            className="px-3.5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs flex items-center gap-2 transition cursor-pointer active:scale-95"
            title="Baixar planilha completa compatível com Microsoft Excel e LibreOffice"
          >
            <Download className="w-4 h-4 text-slate-300" />
            <span>Baixar (Excel/CSV)</span>
          </button>

          {spreadsheetUrl ? (
            <>
              <button
                type="button"
                onClick={handleSyncNow}
                disabled={isSyncing}
                className="px-3.5 py-2.5 rounded-2xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-xs flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar'}</span>
              </button>

              <a
                href={spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition cursor-pointer"
              >
                <span>Abrir Google Sheets</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                type="button"
                onClick={handleUnlinkSheet}
                className="p-2.5 rounded-2xl bg-slate-950 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-500/30 transition cursor-pointer"
                title="Desvincular planilha atual"
              >
                <Unlink className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCreateOrConnectSheet}
                disabled={isCreating}
                className="px-4 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition cursor-pointer active:scale-95 disabled:opacity-50"
                title="Criar automaticamente via conta Google de desenvolvedor (barrinho1602@gmail.com)"
              >
                <FileSpreadsheet className={`w-4 h-4 ${isCreating ? 'animate-spin' : ''}`} />
                <span>{isCreating ? 'Criando no Drive...' : 'Criar Automaticamente'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowManualInput(!showManualInput)}
                className="px-3 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer active:scale-95"
                title="Vincular qualquer link de planilha existente do Google Sheets"
              >
                <Link2 className="w-4 h-4 text-emerald-400" />
                <span>Vincular Link/ID</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Opção Manual: Vincular Link do Google Sheets (Zero Bloqueio Google OAuth) */}
      {showManualInput && !spreadsheetUrl && (
        <div className="p-4 bg-slate-950/90 border border-emerald-500/30 rounded-2xl space-y-3 animate-in fade-in">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <Link2 className="w-4 h-4 text-emerald-400" />
                <span>Vincular Planilha de Qualquer Conta Google (Sem Erro 403)</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Se você usa uma conta diferente (ex: <em>nuncaparedelutar1988@gmail.com</em>), crie uma nova planilha no seu Google Drive, copie o link e cole aqui:
              </p>
            </div>
            <a
              href="https://sheets.new"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-400 text-xs font-bold flex items-center gap-1.5"
            >
              <span>Criar Nova Planilha</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={manualSheetInput}
              onChange={(e) => setManualSheetInput(e.target.value)}
              placeholder="Cole o link completo ou ID da sua planilha Google..."
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={handleSaveManualSheet}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition cursor-pointer"
            >
              Conectar Planilha
            </button>
          </div>
        </div>
      )}

      {feedback && (
        <div
          className={`p-3.5 rounded-2xl text-xs flex items-center gap-2 animate-in fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
              : feedback.type === 'info'
              ? 'bg-blue-500/15 border border-blue-500/30 text-blue-300'
              : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : feedback.type === 'info' ? (
            <AlertCircle className="w-4 h-4 shrink-0 text-blue-400" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Grid das 5 Abas Espelhadas */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
            <Truck className="w-3.5 h-3.5" />
            <span>Veiculos</span>
          </div>
          <p className="text-[10px] text-slate-400">{vehicles.length} veículo(s) cadastrado(s)</p>
        </div>

        <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
            <Fuel className="w-3.5 h-3.5" />
            <span>Abastecimentos</span>
          </div>
          <p className="text-[10px] text-slate-400">{rawFuelings.length} lançamento(s)</p>
        </div>

        <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-400">
            <Wrench className="w-3.5 h-3.5" />
            <span>Manutencoes</span>
          </div>
          <p className="text-[10px] text-slate-400">{rawMaintenance.length} registro(s)</p>
        </div>

        <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-purple-400">
            <DollarSign className="w-3.5 h-3.5" />
            <span>Despesas</span>
          </div>
          <p className="text-[10px] text-slate-400">Consolidação TCO</p>
        </div>

        <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-1 col-span-2 sm:col-span-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-blue-400">
            <FileText className="w-3.5 h-3.5" />
            <span>Documentos</span>
          </div>
          <p className="text-[10px] text-slate-400">CRLV, Seguro, IPVA</p>
        </div>
      </div>

      {/* Real-time sync guarantee badge */}
      <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-emerald-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            <strong>Espelhamento Instantâneo Ativo:</strong> Cada novo abastecimento ou comprovante fotografado no app é gravado na aba <em>Abastecimentos</em> em segundos.
          </span>
        </div>
        {currentCompany?.sheets_synced_at && (
          <span className="text-[10px] text-slate-400 hidden sm:inline whitespace-nowrap">
            Último sync: {new Date(currentCompany.sheets_synced_at).toLocaleTimeString('pt-BR')}
          </span>
        )}
      </div>
    </div>
  );
};
