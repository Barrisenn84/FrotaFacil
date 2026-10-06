import React, { useState, useEffect } from 'react';
import { Users, X } from 'lucide-react';
import { Driver } from '../../types/fleet';

interface DriverModalProps {
  isOpen: boolean;
  driver: Driver | null;
  onClose: () => void;
  onSave: (driverData: Partial<Driver>) => Promise<{ success: boolean; error?: string }>;
}

export const DriverModal: React.FC<DriverModalProps> = ({
  isOpen,
  driver,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [cnh, setCnh] = useState('');
  const [cnhCategory, setCnhCategory] = useState('D');
  const [cnhExpiration, setCnhExpiration] = useState('2028-12-31');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (driver) {
      setName(driver.name || '');
      setEmail(driver.email || '');
      setPhone(driver.phone || '');
      setCnh(driver.cnh || '');
      setCnhCategory(driver.cnh_category || 'D');
      setCnhExpiration(driver.cnh_expiration || '2028-12-31');
    } else {
      setName('');
      setEmail('');
      setPhone('');
      setCnh('');
      setCnhCategory('D');
      setCnhExpiration('2028-12-31');
    }
    setFormError(null);
  }, [driver, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    const data: Partial<Driver> = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      cnh: cnh.trim(),
      cnh_category: cnhCategory,
      cnh_expiration: cnhExpiration,
      status: 'ativo',
    };

    const result = await onSave(data);
    setIsSubmitting(false);

    if (result.success) {
      onClose();
    } else {
      setFormError(result.error || 'Erro ao salvar motorista.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 text-slate-100">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            <h3 className="text-base font-extrabold text-white">
              {driver ? 'Editar Motorista' : 'Cadastrar Novo Motorista'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Nome Completo *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Carlos Eduardo Santos"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">E-mail Corporativo *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="carlos@empresa.com.br"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Telefone / WhatsApp *</label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 98765-4321"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Número CNH *</label>
              <input
                type="text"
                required
                value={cnh}
                onChange={(e) => setCnh(e.target.value)}
                placeholder="11 dígitos"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Categoria *</label>
              <select
                value={cnhCategory}
                onChange={(e) => setCnhCategory(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none"
              >
                <option value="B">B (Carros)</option>
                <option value="C">C (Caminhões leves)</option>
                <option value="D">D (Vans e Ônibus)</option>
                <option value="E">E (Carretas/Articulados)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Validade CNH *</label>
              <input
                type="date"
                required
                value={cnhExpiration}
                onChange={(e) => setCnhExpiration(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none"
              />
            </div>
          </div>

          {formError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
              {formError}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-xs font-bold text-white transition disabled:opacity-50"
            >
              {isSubmitting ? 'Salvando...' : driver ? 'Atualizar Motorista' : 'Cadastrar Motorista'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
