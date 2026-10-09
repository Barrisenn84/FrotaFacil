import React, { useState } from 'react';
import { useFleet } from '../context/FleetContext';
import {
  ShieldCheck,
  Truck,
  Building2,
  Lock,
  Mail,
  ArrowRight,
  UserCheck,
  CheckCircle2,
  Sparkles,
  Phone,
  User,
  PlusCircle,
  AlertCircle,
  Loader2,
  Briefcase,
} from 'lucide-react';
import {
  validateVeridicalFullName,
  validateVeridicalEmail,
  validateVeridicalBrazilianPhone,
  formatBrazilianPhone,
} from '../utils/veridicalValidators';
import { CreateCompanyModal } from './admin/CreateCompanyModal';
import { Company } from '../types/fleet';

interface LoginScreenProps {
  onLoginSuccess?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const {
    companies,
    currentCompany,
    switchCompany,
    login,
    loginWithGoogle,
    loginAsGestor,
    registerUser,
    isLoading,
    error,
  } = useFleet();

  // Modo: 'login' (Acessar Plataforma) ou 'register' (Novo Registro Corporativo)
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // Estado do Formulário de Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  // Estado do Formulário de Novo Registro
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regCompanyId, setRegCompanyId] = useState(currentCompany?.id || companies[0]?.id || '');
  const [regRole, setRegRole] = useState<'administrativo' | 'motorista'>('administrativo');
  const [regPin, setRegPin] = useState('');
  const [regSuccessMsg, setRegSuccessMsg] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  // Controle do Modal de Cadastro de Nova Empresa
  const [showCreateCompanyModal, setShowCreateCompanyModal] = useState(false);

  // Validações em Tempo Real de Dados Verídicos
  const nameValidation = validateVeridicalFullName(regName);
  const emailValidation = validateVeridicalEmail(regEmail);
  const phoneValidation = validateVeridicalBrazilianPhone(regPhone);

  const isRegistrationFormValid =
    nameValidation.isValid &&
    emailValidation.isValid &&
    phoneValidation.isValid &&
    regPin.length >= 4 &&
    Boolean(regCompanyId);

  // Handlers de Login
  const handleGoogleLogin = async () => {
    setLocalError(null);
    const success = await loginWithGoogle();
    if (success && onLoginSuccess) {
      onLoginSuccess();
    }
  };

  const handleGestorOneClick = async () => {
    setLocalError(null);
    const success = await loginAsGestor(currentCompany?.id);
    if (success && onLoginSuccess) {
      onLoginSuccess();
    }
  };

  const handleCompanySelectChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === '__NEW_COMPANY__') {
      setShowCreateCompanyModal(true);
      return;
    }
    await switchCompany(val);
    setRegCompanyId(val);
    setLocalError(null);
  };

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!loginEmail.trim()) {
      setLocalError('Por favor, informe seu e-mail corporativo cadastrado.');
      return;
    }
    const success = await login(loginEmail.trim(), currentCompany?.id);
    if (success && onLoginSuccess) {
      onLoginSuccess();
    }
  };

  // Handler de Novo Registro Corporativo com Validação Verídica
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setRegSuccessMsg(null);

    // Verificação estrita das funções de dados verídicos
    if (!nameValidation.isValid) {
      setLocalError(nameValidation.error || 'Nome completo inválido.');
      return;
    }
    if (!emailValidation.isValid) {
      setLocalError(emailValidation.error || 'E-mail corporativo inválido.');
      return;
    }
    if (!phoneValidation.isValid) {
      setLocalError(phoneValidation.error || 'Celular / WhatsApp brasileiro inválido.');
      return;
    }
    if (!regCompanyId) {
      setLocalError('Selecione ou cadastre uma empresa para vincular o acesso.');
      return;
    }

    setIsRegistering(true);
    try {
      const res = await registerUser({
        name: regName.trim(),
        email: regEmail.trim().toLowerCase(),
        phone: regPhone.trim(),
        companyId: regCompanyId,
        role: regRole,
        password: regPin,
      });

      if (!res.success || !res.user) {
        setLocalError(res.error || 'Falha ao registrar novo usuário corporativo.');
        setIsRegistering(false);
        return;
      }

      setRegSuccessMsg(
        `Cadastro verídico aprovado com sucesso para ${res.user.name}! Acessando o painel de produção...`
      );

      setTimeout(() => {
        setIsRegistering(false);
        if (onLoginSuccess) {
          onLoginSuccess();
        }
      }, 1200);
    } catch (err: any) {
      console.error('Erro no registro corporativo:', err);
      setLocalError(err.message || 'Falha ao processar novo registro.');
      setIsRegistering(false);
    }
  };

  const handleCompanyCreatedSuccess = (newCompany: Company) => {
    setRegCompanyId(newCompany.id);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-100 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Background glow corporativo */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px]" />
      </div>

      <div className="w-full max-w-xl relative z-10">
        {/* Header Branding Executivo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2.5 bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/10 border border-amber-500/30 px-4 py-1.5 rounded-2xl mb-3 backdrop-blur-md">
            <Truck className="w-5 h-5 text-amber-400" />
            <span className="text-xs font-black tracking-wider uppercase text-amber-300">
              FrotaFácil • Gestão Inteligente
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Gestão de Frotas com Leitura Inteligente
          </h1>
          <p className="mt-1 text-slate-400 text-xs sm:text-sm">
            Fotografe comprovantes e painéis, aprove abastecimentos e controle custos da sua frota com facilidade.
          </p>
        </div>

        {/* Corporate Multi-Tenant Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl mb-6">
          {/* Tabs: Acessar Plataforma vs Novo Registro Corporativo */}
          <div className="grid grid-cols-2 p-1 bg-slate-950 border border-slate-800 rounded-2xl mb-6 text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setLocalError(null);
              }}
              className={`py-2.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-2 ${
                activeTab === 'login'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Entrar no Sistema</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('register');
                setLocalError(null);
              }}
              className={`py-2.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-2 ${
                activeTab === 'register'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Criar Nova Conta</span>
            </button>
          </div>

          {/* Feedback Messages */}
          {(error || localError) && (
            <div className="mb-4 p-3 bg-rose-500/20 border border-rose-500/40 rounded-2xl flex items-center gap-2.5 text-xs text-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error || localError}</span>
            </div>
          )}

          {regSuccessMsg && (
            <div className="mb-4 p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{regSuccessMsg}</span>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 1: ACESSO À PLATAFORMA (LOGIN)                      */}
          {/* ======================================================== */}
          {activeTab === 'login' && (
            <div className="space-y-5">
              {/* BOTÃO EXECUTIVO 1-CLIQUE: ENTRAR COMO GESTOR (TUDO LIBERADO) */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-amber-600/20 border-2 border-amber-500/60 p-4 shadow-xl shadow-amber-500/15">
                <div className="flex items-center justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                    </span>
                    <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">
                      Acesso Rápido de Demonstração
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] tracking-wide uppercase">
                    1 Clique
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleGestorOneClick}
                  disabled={isLoading}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 hover:from-amber-400 hover:via-amber-300 hover:to-orange-400 active:scale-[0.99] text-slate-950 font-black text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2.5 shadow-lg shadow-amber-500/25 transition cursor-pointer disabled:opacity-50"
                >
                  <ShieldCheck className="w-5 h-5 stroke-[2.5]" />
                  <span>ENTRAR COMO GESTOR (ACESSO COMPLETO)</span>
                  <ArrowRight className="w-4 h-4 stroke-[3]" />
                </button>

                <p className="mt-2 text-center text-[10px] text-amber-200/90 font-medium">
                  Acesso total: Painel da frota, aprovação de abastecimentos, cadastro de motoristas e relatórios completos.
                </p>
              </div>

              {/* Login com Google */}
              <div>
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Ou acesse com sua conta Google
                </span>
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                  className="w-full py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2.5 transition shadow-lg shadow-white/5 cursor-pointer disabled:opacity-50"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>{isLoading ? 'Entrando com Google...' : 'Entrar com a Conta Google'}</span>
                </button>
              </div>

              {/* Separador */}
              <div className="relative my-4 text-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-800" />
                </div>
                <span className="relative bg-slate-900 px-3 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                  Ou acesse com e-mail e senha
                </span>
              </div>

              {/* Seletor de Empresa com Opção de Cadastrar Nova */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Sua Empresa ou Filial
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowCreateCompanyModal(true)}
                    className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition cursor-pointer"
                  >
                    <PlusCircle className="w-3 h-3" />
                    <span>Cadastrar Nova Empresa</span>
                  </button>
                </div>

                <div className="relative">
                  <Building2 className="absolute left-3.5 top-3.5 w-4 h-4 text-amber-400 pointer-events-none" />
                  <select
                    value={currentCompany?.id || ''}
                    onChange={handleCompanySelectChange}
                    className="w-full bg-slate-950 border border-slate-700 hover:border-slate-600 rounded-xl py-2.5 pl-10 pr-4 text-xs font-semibold text-white focus:outline-none focus:border-amber-500 transition cursor-pointer"
                  >
                    {companies.map((comp) => (
                      <option key={comp.id} value={comp.id}>
                        {comp.name} ({comp.cnpj})
                      </option>
                    ))}
                    <option value="__NEW_COMPANY__" className="text-amber-400 font-bold bg-slate-900">
                      + Cadastrar Nova Empresa / Operação...
                    </option>
                  </select>
                </div>
                <p className="mt-1 text-[10px] text-slate-500 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>Seus dados ficam 100% seguros e separados apenas para sua empresa.</span>
                </p>
              </div>

              {/* Formulário de Login Tradicional */}
              <form onSubmit={handleManualLogin} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    E-mail Profissional
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="ex: gestor@translog.com.br"
                      required
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Senha / PIN de Acesso
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                    <input
                      type="password"
                      value={loginPin}
                      onChange={(e) => setLoginPin(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 active:scale-[0.99] text-slate-950 font-black text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition cursor-pointer disabled:opacity-50 mt-2"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Validando Credenciais...</span>
                    </div>
                  ) : (
                    <>
                      <span>Entrar no FrotaFácil</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Link para criar novo cadastro */}
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('register');
                    setLocalError(null);
                  }}
                  className="text-xs text-slate-400 hover:text-amber-300 transition cursor-pointer"
                >
                  Não possui acesso? <strong className="text-amber-400 underline">Criar Novo Registro</strong>
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: NOVO REGISTRO COM VALIDAÇÃO DE DADOS VERÍDICOS    */}
          {/* ======================================================== */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4 text-xs">
              <div className="pb-1 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-amber-400" />
                  <span>Cadastro de Novo Usuário</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Preencha seus dados reais para criar sua conta. Validamos na hora para garantir a sua segurança.
                </p>
              </div>

              {/* CAMPO 1: NOME COMPLETO COM VALIDAÇÃO */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    NOME COMPLETO: *
                  </label>
                  {regName.trim() && (
                    <span
                      className={`text-[10px] font-bold flex items-center gap-1 ${
                        nameValidation.isValid ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {nameValidation.isValid ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Nome Válido</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3 h-3" />
                          <span>Inválido</span>
                        </>
                      )}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={regName}
                    onChange={(e) => {
                      setRegName(e.target.value);
                      setLocalError(null);
                    }}
                    placeholder="Ex: Carlos Eduardo de Oliveira Santos"
                    required
                    className={`w-full bg-slate-950 border rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-600 focus:outline-none transition ${
                      regName.trim()
                        ? nameValidation.isValid
                          ? 'border-emerald-500/60 focus:border-emerald-500'
                          : 'border-rose-500/60 focus:border-rose-500'
                        : 'border-slate-700 focus:border-amber-500'
                    }`}
                  />
                </div>
                {regName.trim() && !nameValidation.isValid && (
                  <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1">
                    <span>⚠️ {nameValidation.error}</span>
                  </p>
                )}
              </div>

              {/* CAMPO 2: EMAIL COM VALIDAÇÃO VERÍDICA */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    EMAIL: *
                  </label>
                  {regEmail.trim() && (
                    <span
                      className={`text-[10px] font-bold flex items-center gap-1 ${
                        emailValidation.isValid ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {emailValidation.isValid ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" />
                          <span>E-mail Válido</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3 h-3" />
                          <span>Inválido</span>
                        </>
                      )}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => {
                      setRegEmail(e.target.value);
                      setLocalError(null);
                    }}
                    placeholder="Ex: carlos.santos@translog.com.br"
                    required
                    className={`w-full bg-slate-950 border rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-600 focus:outline-none transition ${
                      regEmail.trim()
                        ? emailValidation.isValid
                          ? 'border-emerald-500/60 focus:border-emerald-500'
                          : 'border-rose-500/60 focus:border-rose-500'
                        : 'border-slate-700 focus:border-amber-500'
                    }`}
                  />
                </div>
                {regEmail.trim() && !emailValidation.isValid && (
                  <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1">
                    <span>⚠️ {emailValidation.error}</span>
                  </p>
                )}
              </div>

              {/* CAMPO 3: CELULAR / WHATSAPP COM VALIDAÇÃO VERÍDICA (ANATEL/DDD) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    CELULAR/WHATSAPP: *
                  </label>
                  {regPhone.replace(/\D/g, '').length >= 10 && (
                    <span
                      className={`text-[10px] font-bold flex items-center gap-1 ${
                        phoneValidation.isValid ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {phoneValidation.isValid ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" />
                          <span>DDD/Celular Válido</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3 h-3" />
                          <span>Inválido</span>
                        </>
                      )}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="tel"
                    value={regPhone}
                    onChange={(e) => {
                      setRegPhone(formatBrazilianPhone(e.target.value));
                      setLocalError(null);
                    }}
                    placeholder="(11) 98765-4321"
                    maxLength={15}
                    required
                    className={`w-full bg-slate-950 border rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-600 focus:outline-none font-mono transition ${
                      regPhone.replace(/\D/g, '').length >= 10
                        ? phoneValidation.isValid
                          ? 'border-emerald-500/60 focus:border-emerald-500'
                          : 'border-rose-500/60 focus:border-rose-500'
                        : 'border-slate-700 focus:border-amber-500'
                    }`}
                  />
                </div>
                {regPhone.trim() && !phoneValidation.isValid && (
                  <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1">
                    <span>⚠️ {phoneValidation.error}</span>
                  </p>
                )}
              </div>

              {/* CAMPO 4: EMPRESA COM OPÇÃO DE CADASTRAR NOVA */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    EMPRESA: *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowCreateCompanyModal(true)}
                    className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition cursor-pointer"
                  >
                    <PlusCircle className="w-3 h-3" />
                    <span>+ Cadastrar Nova Empresa</span>
                  </button>
                </div>
                <div className="relative">
                  <Building2 className="absolute left-3.5 top-3 w-4 h-4 text-amber-400 pointer-events-none" />
                  <select
                    value={regCompanyId}
                    onChange={(e) => {
                      if (e.target.value === '__NEW_COMPANY__') {
                        setShowCreateCompanyModal(true);
                      } else {
                        setRegCompanyId(e.target.value);
                      }
                    }}
                    required
                    className="w-full bg-slate-950 border border-slate-700 hover:border-slate-600 rounded-xl py-2.5 pl-10 pr-4 text-xs font-semibold text-white focus:outline-none focus:border-amber-500 transition cursor-pointer"
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.cnpj})
                      </option>
                    ))}
                    <option value="__NEW_COMPANY__" className="text-amber-400 font-bold bg-slate-900">
                      + Cadastrar Nova Empresa / Operação...
                    </option>
                  </select>
                </div>
              </div>

              {/* CARGO & SENHA */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Perfil Corporativo
                  </label>
                  <select
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-3 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="administrativo">Administrativo / Gestor de Frota</option>
                    <option value="motorista">Motorista Operacional</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Criar Senha de Acesso *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                    <input
                      type="password"
                      value={regPin}
                      onChange={(e) => setRegPin(e.target.value)}
                      placeholder="Mínimo 6 dígitos"
                      minLength={4}
                      required
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Botão de Envio de Novo Registro */}
              <button
                type="submit"
                disabled={!isRegistrationFormValid || isRegistering}
                className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 active:scale-[0.99] text-slate-950 font-black text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isRegistering ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Validando e Registrando...</span>
                  </div>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Concluir Novo Registro e Acessar</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Destaques de Segurança e Facilidades */}
        <div className="grid grid-cols-3 gap-3 text-center text-xs text-slate-400">
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
            <div className="font-semibold text-slate-300">Dados Protegidos</div>
            <div className="text-[10px] text-slate-500">Cada empresa tem sua base exclusiva</div>
          </div>
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-3">
            <CheckCircle2 className="w-4 h-4 text-amber-400 mx-auto mb-1" />
            <div className="font-semibold text-slate-300">Inteligência Artificial</div>
            <div className="text-[10px] text-slate-500">Lê notas e comprovantes em segundos</div>
          </div>
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-3">
            <CheckCircle2 className="w-4 h-4 text-blue-400 mx-auto mb-1" />
            <div className="font-semibold text-slate-300">Conferência Segura</div>
            <div className="text-[10px] text-slate-500">Compara o comprovante com o painel</div>
          </div>
        </div>
      </div>

      {/* Modal de Cadastro de Nova Empresa */}
      <CreateCompanyModal
        isOpen={showCreateCompanyModal}
        onClose={() => setShowCreateCompanyModal(false)}
        onSuccess={handleCompanyCreatedSuccess}
      />
    </div>
  );
};
