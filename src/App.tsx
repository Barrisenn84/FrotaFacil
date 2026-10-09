import React, { useState } from 'react';
import { FleetProvider, useFleet } from './context/FleetContext';
import { DriverHome } from './components/DriverHome';
import { DriverVehicleHistory } from './components/DriverVehicleHistory';
import { AdminDashboard } from './components/AdminDashboard';
import { VehicleManagement } from './components/VehicleManagement';
import { DriverManagement } from './components/DriverManagement';
import { VehicleDriverLinksManagement } from './components/VehicleDriverLinksManagement';
import { AuditLogsView } from './components/AuditLogsView';
import { Navbar } from './components/Navbar';
import { LoginScreen } from './components/LoginScreen';
import { Truck } from 'lucide-react';

function MainApp() {
  const { currentUser, logout, isLoading } = useFleet();
  const [currentTab, setCurrentTab] = useState<string>('driver-home');
  const [isMobileFramed, setIsMobileFramed] = useState(false);

  // Initial loading splash for enterprise system boot
  if (isLoading && !currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100 font-['Plus_Jakarta_Sans',sans-serif]">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center shadow-2xl shadow-amber-500/30 animate-pulse mb-5">
          <Truck className="w-9 h-9 text-slate-950 font-bold" />
        </div>
        <div className="text-xl font-black text-white tracking-tight">FrotaFácil • Gestão Inteligente</div>
        <div className="text-xs text-amber-400 font-semibold mt-1.5 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>Carregando o sistema e conectando sua frota...</span>
        </div>
      </div>
    );
  }

  // If user is not logged in, show enterprise multi-tenant login screen
  if (!currentUser) {
    return <LoginScreen />;
  }

  const isMotorista = currentUser.role === 'motorista';

  // Ensure currentTab is compatible with current role
  const effectiveTab = isMotorista
    ? currentTab === 'driver-history'
      ? 'driver-history'
      : 'driver-home'
    : currentTab === 'driver-home' || currentTab === 'driver-history'
    ? 'dashboard'
    : currentTab;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      <Navbar
        currentTab={effectiveTab}
        onSelectTab={setCurrentTab}
        isMobileFramed={isMobileFramed}
        onToggleMobileFramed={() => setIsMobileFramed(!isMobileFramed)}
        onLogout={logout}
      />

      <main className="flex-1 flex flex-col">
        {isMotorista && isMobileFramed ? (
          /* Smartphone container simulator */
          <div className="flex-1 flex items-center justify-center p-3 sm:p-6 bg-slate-950">
            <div className="relative w-full max-w-[420px] h-[850px] bg-slate-900 border-4 border-slate-700 rounded-[48px] shadow-[0_25px_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col">
              {/* Speaker notch */}
              <div className="w-full flex justify-center pt-3 pb-1 bg-slate-900 shrink-0">
                <div className="w-24 h-4 bg-slate-800 rounded-full flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-slate-700/80 mr-3" />
                  <div className="w-10 h-1 bg-slate-700 rounded-full" />
                </div>
              </div>

              {/* Mobile screen content */}
              <div className="flex-1 overflow-y-auto scrollbar-none">
                {effectiveTab === 'driver-history' ? (
                  <DriverVehicleHistory onBack={() => setCurrentTab('driver-home')} />
                ) : (
                  <DriverHome onOpenHistory={() => setCurrentTab('driver-history')} />
                )}
              </div>

              {/* Bottom home bar */}
              <div className="w-full flex justify-center py-2 bg-slate-900 shrink-0">
                <div className="w-32 h-1 bg-slate-700 rounded-full" />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1">
            {/* Driver Views */}
            {isMotorista && (
              <>
                {effectiveTab === 'driver-home' && (
                  <DriverHome onOpenHistory={() => setCurrentTab('driver-history')} />
                )}
                {effectiveTab === 'driver-history' && (
                  <DriverVehicleHistory onBack={() => setCurrentTab('driver-home')} />
                )}
              </>
            )}

            {/* Admin Views */}
            {!isMotorista && (
              <>
                {effectiveTab === 'dashboard' && (
                  <AdminDashboard onNavigateTo={setCurrentTab} />
                )}
                {effectiveTab === 'vehicles' && <VehicleManagement />}
                {effectiveTab === 'drivers' && <DriverManagement />}
                {effectiveTab === 'links' && <VehicleDriverLinksManagement />}
                {effectiveTab === 'audit' && <AuditLogsView />}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <FleetProvider>
      <MainApp />
    </FleetProvider>
  );
}
