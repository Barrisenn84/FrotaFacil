import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Fuel,
  Wrench,
  Gauge,
  Calendar,
  Building,
  DollarSign,
  ShieldAlert,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Info,
  Check,
} from 'lucide-react';
import { Vehicle, FleetEvent, AiExtraction, AutomaticValidation } from '../types/fleet';

interface OCRConfirmationProps {
  event: FleetEvent;
  extraction?: AiExtraction;
  validations?: AutomaticValidation[];
  vehicle: Vehicle;
  onConfirm: (payload: any) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export const OCRConfirmation: React.FC<OCRConfirmationProps> = ({
  event,
  extraction,
  validations = [],
  vehicle,
  onConfirm,
  onCancel,
  isSubmitting = false,
}) => {
  const isFuel = event.event_type === 'fuel';
  const fieldConfidences = extraction?.field_confidences || {};

  // Form states initialized ONLY with actual event / extraction data (no invented names or figures)
  const [odometer, setOdometer] = useState<number>(event.odometer || 0);
  const [eventDate, setEventDate] = useState<string>(
    event.event_date || new Date().toISOString().split('T')[0]
  );
  const [totalAmount, setTotalAmount] = useState<number>(event.total_amount || 0);
  const [notes, setNotes] = useState<string>(event.notes || '');
  const [correctionJustification, setCorrectionJustification] = useState<string>(
    event.correction_justification || ''
  );

  // Fuel specific
  const [gasStation, setGasStation] = useState<string>(
    event.fuelDetail?.gas_station_name || ''
  );
  const [fuelType, setFuelType] = useState<string>(
    event.fuelDetail?.fuel_type || vehicle.fuel_type || 'Diesel S10'
  );
  const [liters, setLiters] = useState<number>(event.fuelDetail?.liters || 0);
  const [pricePerLiter, setPricePerLiter] = useState<number>(
    event.fuelDetail?.price_per_liter || 0
  );
  const [isFullTank, setIsFullTank] = useState<boolean>(true);

  // Maintenance specific
  const [workshopName, setWorkshopName] = useState<string>(
    event.maintenanceDetail?.workshop_name || ''
  );
  const [maintenanceType, setMaintenanceType] = useState<'preventiva' | 'corretiva'>(
    event.maintenanceDetail?.maintenance_type || 'preventiva'
  );
  const [partsCost, setPartsCost] = useState<number>(event.maintenanceDetail?.parts_cost || 0);
  const [laborCost, setLaborCost] = useState<number>(event.maintenanceDetail?.labor_cost || 0);
  const [itemsDescription, setItemsDescription] = useState<string>(
    event.maintenanceDetail?.items_description || ''
  );
  const [nextSuggestedKm, setNextSuggestedKm] = useState<number | undefined>(
    event.maintenanceDetail?.next_suggested_km || undefined
  );

  // Quick questions answers (NUNCA pré-selecionadas pelo sistema)
  const [quickAnswers, setQuickAnswers] = useState<Record<string, any>>({});
  const [localError, setLocalError] = useState<string | null>(null);

  // Recalculate price per liter if total & liters change
  const handleLitersChange = (val: number) => {
    setLiters(val);
    if (val > 0 && totalAmount > 0) {
      setPricePerLiter(Number((totalAmount / val).toFixed(2)));
    }
  };

  const handleTotalChange = (val: number) => {
    setTotalAmount(val);
    if (liters > 0 && val > 0) {
      setPricePerLiter(Number((val / liters).toFixed(2)));
    }
  };

  // Check if odometer is lower than vehicle current km (validação de odômetro crescente)
  const isOdometerRegressed = odometer > 0 && odometer < vehicle.current_km;
  const isTankExceeded = isFuel && liters > vehicle.tank_capacity_liters * 1.1;

  // Ao tocar em uma opção de pergunta rápida, o motorista confirma manualmente aquele valor
  const handleQuickQuestionAnswer = (qId: string, value: any, fieldName?: string) => {
    setQuickAnswers((prev) => ({ ...prev, [qId]: value }));
    if (fieldName === 'odometro' || fieldName === 'odometer') {
      const num = Number(value);
      if (!isNaN(num)) setOdometer(num);
    } else if (fieldName === 'posto' || fieldName === 'gas_station_name') {
      setGasStation(String(value));
    } else if (fieldName === 'litros' || fieldName === 'liters') {
      const num = Number(value);
      if (!isNaN(num)) handleLitersChange(num);
    } else if (fieldName === 'tipoManutencao' || fieldName === 'maintenance_type') {
      setMaintenanceType(String(value).toLowerCase().includes('prev') ? 'preventiva' : 'corretiva');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    // Validação obrigatória de dados não preenchidos
    if (odometer <= 0) {
      setLocalError('Por favor, informe a quilometragem atual do odômetro lida no painel.');
      return;
    }

    if (isOdometerRegressed && (!correctionJustification || correctionJustification.trim().length < 5)) {
      setLocalError(
        `O odômetro informado (${odometer.toLocaleString()} km) é MENOR que o último odômetro registrado (${vehicle.current_km.toLocaleString()} km). O salvamento foi recusado. Para prosseguir, selecione o valor correto ou preencha a justificativa formal de retificação (ex: troca de painel).`
      );
      return;
    }

    if (totalAmount <= 0) {
      setLocalError('O valor total do comprovante deve ser informado e maior que R$ 0,00.');
      return;
    }

    if (isFuel && (!gasStation || gasStation.trim().length < 2)) {
      setLocalError('Por favor, informe ou confirme o nome do Posto de Combustível.');
      return;
    }

    if (isFuel && liters <= 0) {
      setLocalError('Por favor, informe a quantidade de litros abastecidos.');
      return;
    }

    const payload = {
      event_id: event.id,
      odometer: Number(odometer),
      event_date: eventDate,
      total_amount: Number(totalAmount),
      notes,
      correction_justification: isOdometerRegressed ? correctionJustification : undefined,
      quick_answers: quickAnswers,
      // Fuel
      gas_station_name: gasStation.trim(),
      liters: Number(liters),
      price_per_liter: Number(pricePerLiter),
      fuel_type: fuelType,
      is_full_tank: isFullTank,
      // Maintenance
      workshop_name: workshopName.trim(),
      maintenance_type: maintenanceType,
      parts_cost: Number(partsCost),
      labor_cost: Number(laborCost),
      items_description: itemsDescription.trim(),
      next_suggested_km: nextSuggestedKm ? Number(nextSuggestedKm) : undefined,
    };

    try {
      await onConfirm(payload);
    } catch (err: any) {
      setLocalError(err.message || 'Falha ao confirmar evento.');
    }
  };

  const renderConfidenceBadge = (fieldName: string) => {
    const conf = fieldConfidences[fieldName];
    if (conf === undefined) return null;
    const pct = Math.round(conf * 100);

    if (conf >= 0.85) {
      return (
        <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-bold">
          Alta {pct}%
        </span>
      );
    }
    if (conf >= 0.7) {
      return (
        <span className="text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-bold">
          Média {pct}%
        </span>
      );
    }
    return (
      <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/40 px-1.5 py-0.5 rounded font-bold animate-pulse">
        Baixa {pct}% (Conferir)
      </span>
    );
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
            {isFuel ? <Fuel className="w-5 h-5" /> : <Wrench className="w-5 h-5" />}
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Conferência do Comprovante
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-white">
              {isFuel ? 'Abastecimento' : 'Manutenção'} — {vehicle.plate}
            </h2>
          </div>
        </div>

        <div className="text-right">
          <span className="text-xs text-slate-400 block">Veículo</span>
          <span className="text-xs font-bold text-white">{vehicle.model}</span>
        </div>
      </div>

      {/* Alerta de Odômetro Menor que o Anterior */}
      {isOdometerRegressed && (
        <div className="mb-5 p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-200 space-y-2">
          <div className="flex items-center gap-2 font-bold text-xs">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Atenção: A quilometragem informada é menor que a anterior</span>
          </div>
          <p className="text-xs text-rose-300">
            A quilometragem digitada (<strong>{odometer.toLocaleString()} km</strong>) está menor do que a última registrada para este veículo (<strong>{vehicle.current_km.toLocaleString()} km</strong>).
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => setOdometer(vehicle.current_km)}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition cursor-pointer"
            >
              Usar {vehicle.current_km.toLocaleString()} km
            </button>
            <button
              type="button"
              onClick={() => {
                if (!correctionJustification) {
                  setCorrectionJustification('Troca de painel / Ajuste mecânico autorizado');
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 font-bold text-xs hover:bg-slate-700 transition cursor-pointer"
            >
              Justificar Troca de Painel
            </button>
          </div>
        </div>
      )}

      {/* Automatic Validations Alerts */}
      {validations.length > 0 && (
        <div className="mb-5 space-y-2">
          {validations.map((v, i) => (
            <div
              key={i}
              className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                v.severity === 'BLOCKING'
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-200'
                  : v.severity === 'WARNING'
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              }`}
            >
              {v.severity === 'BLOCKING' ? (
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              ) : v.severity === 'WARNING' ? (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              )}
              <div>
                <span className="font-bold">{v.rule_name}: </span>
                {v.message}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Questions da IA (Aparecem SEM pré-seleção; motorista deve tocar para escolher) */}
      {extraction?.quick_questions && extraction.quick_questions.length > 0 && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider mb-2.5">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Valores Identificados (Toque para confirmar)</span>
          </div>

          <div className="space-y-3">
            {extraction.quick_questions.slice(0, 2).map((q) => (
              <div key={q.id} className="bg-slate-900/90 border border-amber-500/20 rounded-xl p-3">
                <div className="text-xs font-bold text-white mb-1">{q.question}</div>
                <div className="text-[11px] text-slate-400 mb-2">{q.reason}</div>

                <div className="flex flex-wrap gap-2">
                  {q.options && q.options.length > 0 ? (
                    q.options.map((opt, optIdx) => (
                      <button
                        key={optIdx}
                        type="button"
                        onClick={() => handleQuickQuestionAnswer(q.id, opt, q.field)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                          quickAnswers[q.id] === opt
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                        }`}
                      >
                        {quickAnswers[q.id] === opt && <Check className="w-3.5 h-3.5 inline mr-1" />}
                        {opt}
                      </button>
                    ))
                  ) : q.suggestedValue ? (
                    <button
                      type="button"
                      onClick={() => handleQuickQuestionAnswer(q.id, q.suggestedValue, q.field)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                        quickAnswers[q.id] === q.suggestedValue
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                      }`}
                    >
                      {quickAnswers[q.id] === q.suggestedValue && (
                        <Check className="w-3.5 h-3.5 inline mr-1" />
                      )}
                      Usar Valor: {q.suggestedValue}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Extracted Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Odômetro */}
        <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-amber-400" />
              <span>Quilometragem do Painel (KM) *</span>
            </label>
            {renderConfidenceBadge('odometro')}
          </div>
          <div className="grid grid-cols-2 gap-3 items-center">
            <input
              type="number"
              required
              value={odometer || ''}
              onChange={(e) => setOdometer(Number(e.target.value))}
              placeholder="Digite a km do odômetro"
              className={`w-full bg-slate-900 border rounded-xl py-2 px-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                isOdometerRegressed ? 'border-rose-500 text-rose-300' : 'border-slate-700'
              }`}
            />
            <div className="text-xs text-slate-400">
              Último no sistema: <span className="font-bold text-slate-200">{vehicle.current_km.toLocaleString()} km</span>
              {odometer > vehicle.current_km && (
                <div className="text-[11px] text-emerald-400 font-semibold mt-0.5">
                  +{odometer - vehicle.current_km} km rodados
                </div>
              )}
            </div>
          </div>

          {/* Justificativa caso odômetro tenha regredido */}
          {isOdometerRegressed && (
            <div className="mt-3 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl">
              <label className="block text-xs font-bold text-rose-300 mb-1">
                Por que a quilometragem está menor? (Ex: troca de painel ou conserto):
              </label>
              <input
                type="text"
                required
                value={correctionJustification}
                onChange={(e) => setCorrectionJustification(e.target.value)}
                placeholder="Ex: Troca de painel / Ajuste após calibração mecânica"
                className="w-full bg-slate-900 border border-rose-500/50 rounded-lg p-2 text-xs text-white placeholder-slate-500 focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* Data & Valor Total */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                <span>Data do Evento *</span>
              </label>
              {renderConfidenceBadge('data')}
            </div>
            <input
              type="date"
              required
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-3 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                <span>Valor Total (R$) *</span>
              </label>
              {renderConfidenceBadge('valorTotal')}
            </div>
            <input
              type="number"
              step="0.01"
              required
              value={totalAmount || ''}
              onChange={(e) => handleTotalChange(Number(e.target.value))}
              placeholder="0.00"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-3 text-sm font-bold text-emerald-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Fuel Specific Fields */}
        {isFuel && (
          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-amber-400" />
                  <span>Estabelecimento / Posto de Combustível *</span>
                </label>
                {renderConfidenceBadge('estabelecimento')}
              </div>
              <input
                type="text"
                required
                value={gasStation}
                onChange={(e) => setGasStation(e.target.value)}
                placeholder="Ex: Posto Graal / Ipiranga..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Combustível</label>
                <select
                  value={fuelType}
                  onChange={(e) => setFuelType(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-2 text-xs text-white focus:outline-none"
                >
                  <option value="Diesel S10">Diesel S10</option>
                  <option value="Diesel Comum">Diesel Comum</option>
                  <option value="Gasolina Comum">Gasolina Comum</option>
                  <option value="Gasolina Aditivada">Gasolina Aditivada</option>
                  <option value="Etanol">Etanol</option>
                  <option value="GNV">GNV</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Litros *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={liters || ''}
                  onChange={(e) => handleLitersChange(Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-2 text-xs font-bold text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Preço / Litro</label>
                <input
                  type="number"
                  step="0.001"
                  value={pricePerLiter || ''}
                  onChange={(e) => setPricePerLiter(Number(e.target.value))}
                  placeholder="R$ / L"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-2 text-xs font-bold text-amber-400 focus:outline-none"
                />
              </div>
            </div>

            {isTankExceeded && (
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[11px] text-amber-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  O volume informado ({liters}L) supera a capacidade nominal do tanque ({vehicle.tank_capacity_liters}L).
                </span>
              </div>
            )}
          </div>
        )}

        {/* Maintenance Specific Fields */}
        {!isFuel && (
          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Oficina / Prestador de Serviço *</label>
              <input
                type="text"
                required
                value={workshopName}
                onChange={(e) => setWorkshopName(e.target.value)}
                placeholder="Nome da oficina mecânica"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-3 text-xs text-white focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Tipo de Manutenção</label>
                <select
                  value={maintenanceType}
                  onChange={(e) => setMaintenanceType(e.target.value as 'preventiva' | 'corretiva')}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-2 text-xs text-white focus:outline-none"
                >
                  <option value="preventiva">Preventiva (Revisão programada)</option>
                  <option value="corretiva">Corretiva (Conserto emergencial)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Descrição dos Serviços</label>
                <input
                  type="text"
                  value={itemsDescription}
                  onChange={(e) => setItemsDescription(e.target.value)}
                  placeholder="Ex: Troca de pastilhas e óleo..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-2 text-xs text-white focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Error message */}
        {localError && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{localError}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-extrabold text-xs flex items-center gap-2 transition shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>Salvando no Sistema...</span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirmar e Salvar</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
