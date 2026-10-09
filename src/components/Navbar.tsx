import React, { useState } from 'react';
import { useFleet } from '../context/FleetContext';
import {
  Truck,
  Building2,
  LogOut,
  Bell,
  Smartphone,
  Monitor,
  LayoutDashboard,
  Car,
  Users,
  Link as LinkIcon,
  FileText,
  WifiOff,
  RefreshCw,
  CheckCircle,
  FileSpreadsheet,
  PlusCircle,
  Trash2,
} from 'lucide-react';
import { CompanyOnboardingModal } from './admin/CompanyOnboardingModal';
import { ResetAllDataModal } from './admin/ResetAllDataModal';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  isMobileFramed: boolean;
  onToggleMobileFramed: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  isMobileFramed,
  onToggleMobileFramed,
  onLogout,
}) => {
  const {
    currentCompany,
    companies,
    switchCompany,
    currentUser,
    currentDriver,
    login,
    notifications,
    markNotificationRead,
    offlineDrafts,
    syncOfflineDraft,
    isLoading,
  } = useFleet();

  const [showCompanyMenu, setShowCompanyMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [syncingDraftId, setSyncingDraftId] = useState<string | null>(null);

  const isAdmin = currentUser?.role === 'administrativo';
  const unreadCount = notifications.filter((n) => !n.read).length;
  const hasCriticalUnread = notifications.some((n) => !n.read && n.type === 'error');

  const handleSyncAllDrafts = async () => {
    for (const draft of offlineDrafts) {
      setSyncingDraftId(draft.localId);
      await syncOfflineDraft(draft.localId);
    }
    setSyncingDraftId(null);
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        {/* Brand & Company Switcher */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center shadow-md shadow-amber-500/20">
              <Truck className="w-6 h-6 text-slate-950 font-bold" />
            </div>
            <div>
              <div className="font-extrabold text-base tracking-tight flex items-center gap-1.5">
                <span>FrotaFácil</span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30">
                  IA v2.0
                </span>
              </div>
              {/* Active Company Pill */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowCompanyMenu(!showCompanyMenu)}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-amber-300 font-medium transition cursor-pointer"
                >
                  <Building2 className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="truncate max-w-[140px] sm:max-w-[200px]">
                    {currentCompany?.name || 'TransLog'}
                  </span>
                  <span className="text-[9px] bg-slate-800 px-1 rounded text-slate-400">Trocar</span>
                </button>

                {showCompanyMenu && (
                  <div className="absolute left-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-2 z-50">
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                      Selecionar Empresa (Multiempresa)
                    </div>
                    {companies.map((comp) => (
                      <button
                        key={comp.id}
                        type="button"
                        onClick={async () => {
                          setShowCompanyMenu(false);
                          await switchCompany(comp.id);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-800 flex items-center justify-between ${
                          currentCompany?.id === comp.id ? 'text-amber-400 font-bold bg-amber-500/10' : 'text-slate-300'
                        }`}
                      >
                        <div className="truncate">
                          <div>{comp.name}</div>
                          <div className="text-[10px] text-slate-500">{comp.cnpj}</div>
                        </div>
                        {currentCompany?.id === comp.id && <CheckCircle className="w-4 h-4 text-amber-400 shrink-0" />}
                      </button>
                    ))}

                    <div className="border-t border-slate-800 mt-2 pt-2 px-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowCompanyMenu(false);
                          setShowOnboardingModal(true);
                        }}
                        className="w-full py-2 px-3 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-bold flex items-center gap-2 transition cursor-pointer"
                      >
                        <PlusCircle className="w-3.5 h-3.5 text-amber-400" />
                        <span>Cadastrar Empresa & Planilha</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Navigation Tabs (Desktop / Tablets) */}
          <nav className="hidden md:flex items-center gap-1 ml-4 pl-4 border-l border-slate-800">
            {isAdmin ? (
              <>
                <button
                  type="button"
                  onClick={() => onSelectTab('dashboard')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                    currentTab === 'dashboard'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span>Painel Geral</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectTab('vehicles')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                    currentTab === 'vehicles'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Car className="w-3.5 h-3.5" />
                  <span>Veículos</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectTab('drivers')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                    currentTab === 'drivers'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Motoristas</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectTab('links')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                    currentTab === 'links'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                  <span>Vínculos</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectTab('audit')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                    currentTab === 'audit'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Auditoria & Notas</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onSelectTab('driver-home')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                    currentTab === 'driver-home'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>Lançar Comprovante</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectTab('driver-history')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                    currentTab === 'driver-history'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Histórico do Veículo</span>
                </button>
              </>
            )}
          </nav>
        </div>

        {/* Right Actions: Offline pill, Mobile Framed toggle, Notifications, User Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Offline Drafts Banner Pill */}
          {offlineDrafts.length > 0 && (
            <button
              type="button"
              onClick={handleSyncAllDrafts}
              title="Clique para sincronizar comprovantes gravados sem internet"
              className="flex items-center gap-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 px-2.5 py-1 rounded-full text-xs font-semibold transition"
            >
              <WifiOff className="w-3.5 h-3.5 text-amber-400" />
              <span>{offlineDrafts.length} comprovante(s) sem internet</span>
              <RefreshCw className={`w-3 h-3 ${syncingDraftId ? 'animate-spin' : ''}`} />
            </button>
          )}

          {/* Toggle Simulator Device Frame */}
          <button
            type="button"
            onClick={onToggleMobileFramed}
            title={isMobileFramed ? 'Ver em Tela Inteira de Computador' : 'Ver como Celular do Motorista'}
            className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              isMobileFramed
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {isMobileFramed ? <Monitor className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
            <span className="hidden sm:inline">{isMobileFramed ? 'Computador' : 'Modo Celular'}</span>
          </button>

          {/* Notifications Bell */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowNotifMenu(!showNotifMenu)}
              className="relative p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span
                  className={`absolute -top-1 -right-1 w-4 h-4 rounded-full font-bold text-[10px] flex items-center justify-center ${
                    hasCriticalUnread
                      ? 'bg-rose-500 text-white animate-pulse'
                      : 'bg-amber-500 text-slate-950'
                  }`}
                >
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifMenu && (
              <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-3 z-50">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                  <span className="text-xs font-bold text-slate-200">Alertas e Notificações</span>
                  <span className="text-[10px] text-slate-400">{notifications.length} registros</span>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {notifications.length === 0 ? (
                    <div className="text-center py-4 text-xs text-slate-500">Nenhuma notificação no momento</div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => markNotificationRead(n.id)}
                        className={`p-2.5 rounded-xl border text-left cursor-pointer transition ${
                          n.read
                            ? 'bg-slate-950/40 border-slate-800 text-slate-400'
                            : n.type === 'error'
                            ? 'bg-rose-500/15 border-rose-500/40 text-rose-200 font-medium'
                            : 'bg-amber-500/10 border-amber-500/30 text-amber-200 font-medium'
                        }`}
                      >
                        <div className="text-xs font-bold text-white flex items-center justify-between">
                          <span>{n.title}</span>
                          {!n.read && (
                            <span
                              className={`w-2 h-2 rounded-full ${
                                n.type === 'error' ? 'bg-rose-500 animate-ping' : 'bg-amber-500'
                              }`}
                            />
                          )}
                        </div>
                        <div className="text-[11px] text-slate-300 mt-0.5">{n.message}</div>
                        <div className="text-[9px] text-slate-500 mt-1">
                          {new Date(n.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quick Role Switcher Button */}
          <button
            type="button"
            onClick={async () => {
              if (isAdmin) {
                const targetEmail = currentCompany?.id === 'comp-rapidobr-02' ? 'joao@rapidobrasil.com.br' : 'carlos@translog.com.br';
                await login(targetEmail, currentCompany?.id);
                onSelectTab('driver-home');
              } else {
                const targetEmail = currentCompany?.id === 'comp-rapidobr-02' ? 'danilo@rapidobrasil.com.br' : 'admin@translog.com.br';
                await login(targetEmail, currentCompany?.id);
                onSelectTab('dashboard');
              }
            }}
            title={isAdmin ? 'Mudar para Visão do Motorista' : 'Mudar para Painel do Gestor'}
            className="px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            {isAdmin ? <Truck className="w-3.5 h-3.5 text-amber-400" /> : <LayoutDashboard className="w-3.5 h-3.5 text-amber-400" />}
            <span className="hidden sm:inline">{isAdmin ? 'Ver como Motorista' : 'Painel do Gestor'}</span>
          </button>

          {/* User Profile & Role */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-white leading-tight">
                {currentUser?.name || 'Usuário'}
              </div>
              <div className="text-[10px] text-amber-400 capitalize font-medium">
                {currentUser?.role === 'administrativo' ? 'Administrador da Frota' : 'Motorista'}
              </div>
            </div>

            {/* Botão Limpar Tudo */}
            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              title="Limpar todos os dados e campos do sistema"
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 text-slate-400 transition cursor-pointer flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4 text-rose-400" />
              <span className="hidden xl:inline text-xs font-bold text-rose-300">Limpar Tudo</span>
            </button>

            <button
              type="button"
              onClick={onLogout}
              title="Sair da Conta"
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 text-slate-400 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Sub-Navigation Bar */}
      <div className="flex md:hidden items-center justify-around bg-slate-950/90 border-t border-slate-800/80 py-2 px-1">
        {isAdmin ? (
          <>
            <button
              type="button"
              onClick={() => onSelectTab('dashboard')}
              className={`px-2 py-1 text-xs font-semibold ${currentTab === 'dashboard' ? 'text-amber-400' : 'text-slate-400'}`}
            >
              Painel Geral
            </button>
            <button
              type="button"
              onClick={() => onSelectTab('vehicles')}
              className={`px-2 py-1 text-xs font-semibold ${currentTab === 'vehicles' ? 'text-amber-400' : 'text-slate-400'}`}
            >
              Veículos
            </button>
            <button
              type="button"
              onClick={() => onSelectTab('drivers')}
              className={`px-2 py-1 text-xs font-semibold ${currentTab === 'drivers' ? 'text-amber-400' : 'text-slate-400'}`}
            >
              Motoristas
            </button>
            <button
              type="button"
              onClick={() => onSelectTab('links')}
              className={`px-2 py-1 text-xs font-semibold ${currentTab === 'links' ? 'text-amber-400' : 'text-slate-400'}`}
            >
              Vínculos
            </button>
            <button
              type="button"
              onClick={() => onSelectTab('audit')}
              className={`px-2 py-1 text-xs font-semibold ${currentTab === 'audit' ? 'text-amber-400' : 'text-slate-400'}`}
            >
              Auditoria & Notas
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onSelectTab('driver-home')}
              className={`px-4 py-1 text-xs font-semibold ${currentTab === 'driver-home' ? 'text-amber-400' : 'text-slate-400'}`}
            >
              Lançar Comprovante
            </button>
            <button
              type="button"
              onClick={() => onSelectTab('driver-history')}
              className={`px-4 py-1 text-xs font-semibold ${currentTab === 'driver-history' ? 'text-amber-400' : 'text-slate-400'}`}
            >
              Histórico
            </button>
          </>
        )}
      </div>

      {/* Modal de Onboarding da Empresa & Espelho Google Sheets */}
      <CompanyOnboardingModal
        isOpen={showOnboardingModal}
        onClose={() => setShowOnboardingModal(false)}
      />

      {/* Modal Zerar Tudo e Limpar Campos */}
      <ResetAllDataModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
      />
    </header>
  );
};
