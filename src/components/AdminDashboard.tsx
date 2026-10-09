import React, { useState } from 'react';
import { useFleet } from '../context/FleetContext';
import {
  LayoutDashboard,
  Truck,
  Users,
  FileCheck,
  ShieldCheck,
} from 'lucide-react';
import { OverviewTab } from './admin/OverviewTab';
import { VehiclesTab } from './admin/VehiclesTab';
import { DriversTab } from './admin/DriversTab';
import { RecordsTab } from './admin/RecordsTab';
import { ComplianceTab } from './admin/ComplianceTab';
import { VehicleModal } from './admin/VehicleModal';
import { DriverModal } from './admin/DriverModal';

interface AdminDashboardProps {
  onNavigateTo?: (tab: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigateTo }) => {
  const {
    currentCompany,
    metrics,
    events,
    vehicles,
    drivers,
    createVehicle,
    updateVehicle,
    createDriver,
    updateDriver,
    confirmEvent,
    rejectEvent,
    isLoading,
  } = useFleet();

  const [activeTab, setActiveTab] = useState<'overview' | 'vehicles' | 'drivers' | 'records' | 'compliance'>('overview');
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [isDriverModalOpen, setIsDriverModalOpen] = useState(false);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 text-slate-100 font-['Plus_Jakarta_Sans',sans-serif] space-y-6">
      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1.5 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shrink-0 ${
            activeTab === 'overview'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Visão Geral & Indicadores</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('vehicles')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shrink-0 ${
            activeTab === 'vehicles'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Veículos ({vehicles.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('drivers')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shrink-0 ${
            activeTab === 'drivers'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Motoristas ({drivers.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('records')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shrink-0 ${
            activeTab === 'records'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          <span>Registros & Auditoria</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('compliance')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shrink-0 ${
            activeTab === 'compliance'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Regras & Conformidade</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab
          company={currentCompany}
          metrics={metrics}
          events={events}
          onConfirmEvent={confirmEvent}
          onRejectEvent={rejectEvent}
          onNavigateTo={(tab) => {
            if (['overview', 'vehicles', 'drivers', 'records', 'compliance'].includes(tab)) {
              setActiveTab(tab as any);
            } else if (onNavigateTo) {
              onNavigateTo(tab);
            }
          }}
          onOpenNewVehicle={() => setIsVehicleModalOpen(true)}
          onOpenNewDriver={() => setIsDriverModalOpen(true)}
        />
      )}

      {activeTab === 'vehicles' && (
        <VehiclesTab
          vehicles={vehicles}
          onCreateVehicle={createVehicle}
          onUpdateVehicle={updateVehicle}
        />
      )}

      {activeTab === 'drivers' && (
        <DriversTab
          drivers={drivers}
          onCreateDriver={createDriver}
          onUpdateDriver={updateDriver}
        />
      )}

      {activeTab === 'records' && <RecordsTab events={events} />}

      {activeTab === 'compliance' && (
        <ComplianceTab company={currentCompany} metrics={metrics} />
      )}

      {/* Global Modals */}
      <VehicleModal
        isOpen={isVehicleModalOpen}
        vehicle={null}
        onClose={() => setIsVehicleModalOpen(false)}
        onSave={createVehicle}
      />

      <DriverModal
        isOpen={isDriverModalOpen}
        driver={null}
        onClose={() => setIsDriverModalOpen(false)}
        onSave={createDriver}
      />
    </div>
  );
};
