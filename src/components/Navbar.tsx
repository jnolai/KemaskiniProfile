import React from 'react';
import { 
  UserCheck, 
  Users, 
  History, 
  Table2, 
  Smartphone, 
  Monitor, 
  Tablet, 
  ShieldCheck, 
  Shield, 
  HelpCircle, 
  FileSpreadsheet, 
  UploadCloud, 
  Lock, 
  LogOut,
  Database,
  Crown
} from 'lucide-react';
import { ActiveTab, DeviceFrame, AdminRole } from '../types';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  deviceFrame: DeviceFrame;
  setDeviceFrame: (frame: DeviceFrame) => void;
  onOpenGuide: () => void;
  onExportExcel: () => void;
  totalAccounts: number;
  updatedAccountsCount?: number;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  adminRole: AdminRole | null;
  onOpenAdminLogin: (targetTab?: ActiveTab) => void;
  onLogoutAdmin: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  deviceFrame,
  setDeviceFrame,
  onOpenGuide,
  onExportExcel,
  totalAccounts,
  updatedAccountsCount = 0,
  isAdmin,
  isSuperAdmin,
  adminRole,
  onOpenAdminLogin,
  onLogoutAdmin,
}) => {
  const handleTabClick = (tab: ActiveTab) => {
    if (tab === 'lookup') {
      setActiveTab(tab);
    } else if (tab === 'import_excel' || tab === 'google_sheets') {
      // 🔒 Super Admin Exclusive Tabs
      if (isSuperAdmin) {
        setActiveTab(tab);
      } else {
        onOpenAdminLogin(tab);
      }
    } else {
      // 🛡️ Regular Admin Tabs (directory, audit_logs, spreadsheet)
      if (isAdmin) {
        setActiveTab(tab);
      } else {
        onOpenAdminLogin(tab);
      }
    }
  };

  return (
    <header id="main-header" className="bg-[#FAF9F6] border-b border-stone-200/90 sticky top-0 z-30 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
      {/* Top Masthead bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Editorial Masthead */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1A1A1A] flex items-center justify-center text-[#FDFCFB] shadow-xs border border-stone-800">
              <UserCheck className="w-5 h-5 stroke-[1.75]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif-heading font-bold text-[#1A1A1A] text-xl tracking-tight">
                  Portal Profil Pelanggan
                </span>
                <span className="text-[10px] uppercase font-mono tracking-widest bg-stone-100 text-stone-800 border border-stone-300/80 px-2 py-0.5 rounded font-semibold">
                  Layan Diri
                </span>
              </div>
              <p className="text-xs text-stone-500 font-sans hidden sm:block">
                Carian Akaun & Kemaskini Nombor Telefon & Email Pelanggan
              </p>
            </div>
          </div>

          {/* Device Frame Viewport Switcher */}
          <div className="hidden md:flex items-center bg-[#EFECE6] p-1 rounded-xl border border-stone-300/70">
            <button
              id="frame-responsive-btn"
              onClick={() => setDeviceFrame('responsive')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                deviceFrame === 'responsive'
                  ? 'bg-white text-[#1A1A1A] shadow-xs border border-stone-300/80 font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
              title="Paparan Desktop Lebar"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Penuh</span>
            </button>
            <button
              id="frame-tablet-btn"
              onClick={() => setDeviceFrame('tablet')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                deviceFrame === 'tablet'
                  ? 'bg-white text-[#1A1A1A] shadow-xs border border-stone-300/80 font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
              title="Paparan Tablet"
            >
              <Tablet className="w-3.5 h-3.5" />
              <span>Tablet</span>
            </button>
            <button
              id="frame-mobile-btn"
              onClick={() => setDeviceFrame('mobile')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                deviceFrame === 'mobile'
                  ? 'bg-white text-[#1A1A1A] shadow-xs border border-stone-300/80 font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
              title="Paparan Telefon Mudah Alih"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Mudah Alih</span>
            </button>
          </div>

          {/* Action Buttons & Admin Auth State */}
          <div className="flex items-center gap-2">
            <button
              id="guide-btn"
              onClick={onOpenGuide}
              className="p-2 sm:px-3 sm:py-2 text-stone-700 bg-white hover:bg-stone-100 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors border border-stone-300 shadow-xs cursor-pointer"
              title="Panduan Keselamatan & Logik Data"
            >
              <HelpCircle className="w-4 h-4 text-stone-500" />
              <span className="hidden sm:inline">Panduan</span>
            </button>

            {isSuperAdmin ? (
              <div className="flex items-center gap-1.5">
                <button
                  id="super-admin-status-btn"
                  onClick={() => onOpenAdminLogin()}
                  className="px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-950 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-purple-300 shadow-2xs transition-all cursor-pointer"
                  title="Status Sesi Super Admin"
                >
                  <Crown className="w-4 h-4 text-amber-600" />
                  <span className="hidden sm:inline">Super Admin</span>
                </button>

                <button
                  id="export-excel-header-btn"
                  onClick={onExportExcel}
                  disabled={totalAccounts === 0}
                  className="hidden md:flex px-3 py-2 bg-white hover:bg-stone-100 disabled:opacity-50 text-stone-800 rounded-xl text-xs font-semibold items-center gap-1.5 shadow-2xs transition-all border border-stone-300 cursor-pointer"
                  title="Eksport Pangkalan Data"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-stone-600" />
                  <span>Eksport Excel</span>
                </button>

                <button
                  id="logout-admin-btn"
                  onClick={onLogoutAdmin}
                  className="p-2 sm:px-2.5 sm:py-2 bg-stone-100 hover:bg-red-50 hover:text-red-700 text-stone-600 rounded-xl text-xs font-medium flex items-center gap-1 border border-stone-300 transition-colors cursor-pointer"
                  title="Log Keluar Sesi Super Admin"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Keluar</span>
                </button>
              </div>
            ) : isAdmin ? (
              <div className="flex items-center gap-1.5">
                <button
                  id="admin-active-status-btn"
                  onClick={() => onOpenAdminLogin()}
                  className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-emerald-300 shadow-2xs transition-all cursor-pointer"
                  title="Status Sesi Pentadbir (Admin)"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span className="hidden sm:inline">Admin Aktif</span>
                </button>

                <button
                  id="export-excel-header-btn"
                  onClick={onExportExcel}
                  disabled={totalAccounts === 0}
                  className="hidden md:flex px-3 py-2 bg-white hover:bg-stone-100 disabled:opacity-50 text-stone-800 rounded-xl text-xs font-semibold items-center gap-1.5 shadow-2xs transition-all border border-stone-300 cursor-pointer"
                  title="Eksport Pangkalan Data"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-stone-600" />
                  <span>Eksport Excel</span>
                </button>

                <button
                  id="logout-admin-btn"
                  onClick={onLogoutAdmin}
                  className="p-2 sm:px-2.5 sm:py-2 bg-stone-100 hover:bg-red-50 hover:text-red-700 text-stone-600 rounded-xl text-xs font-medium flex items-center gap-1 border border-stone-300 transition-colors cursor-pointer"
                  title="Log Keluar Sesi Admin"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Keluar</span>
                </button>
              </div>
            ) : (
              <button
                id="admin-login-header-btn"
                onClick={() => onOpenAdminLogin()}
                className="px-3.5 py-2 bg-[#1A1A1A] hover:bg-black text-[#FDFCFB] rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all border border-stone-800 cursor-pointer"
              >
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                <span>Log Masuk Admin</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation with Public vs Admin vs Super Admin Distinction */}
        <nav className="flex space-x-1 sm:space-x-2 border-t border-stone-200/80 overflow-x-auto scrollbar-none py-1.5 items-center">
          {/* Public Tab */}
          <button
            id="tab-lookup"
            onClick={() => handleTabClick('lookup')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'lookup'
                ? 'bg-[#1A1A1A] text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span className="font-serif-heading font-semibold">Carian & Kemaskini Profil</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold ${
              activeTab === 'lookup' ? 'bg-stone-800 text-stone-200' : 'bg-stone-200 text-stone-700'
            }`}>
              Awam
            </span>
          </button>

          <div className="h-4 w-px bg-stone-300 mx-1 hidden sm:block" />

          {/* Regular Admin Tabs: Direktori Akaun */}
          <button
            id="tab-directory"
            onClick={() => handleTabClick('directory')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'directory'
                ? 'bg-[#1A1A1A] text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
            }`}
          >
            <Users className="w-4 h-4" />
            <span className="font-serif-heading font-semibold">Direktori Akaun</span>
            <span className="bg-stone-200 text-stone-800 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
              {totalAccounts}
            </span>
            {updatedAccountsCount > 0 && (
              <span className="bg-emerald-700 text-emerald-50 text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full border border-emerald-500">
                ✨ {updatedAccountsCount}
              </span>
            )}
            {!isAdmin && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-mono bg-amber-100 text-amber-900 border border-amber-300/80 px-1.5 py-0.2 rounded font-medium">
                <Lock className="w-2.5 h-2.5" />
                Admin
              </span>
            )}
          </button>

          {/* Regular Admin Tabs: Log Audit */}
          <button
            id="tab-audit-logs"
            onClick={() => handleTabClick('audit_logs')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'audit_logs'
                ? 'bg-[#1A1A1A] text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
            }`}
          >
            <History className="w-4 h-4" />
            <span className="font-serif-heading font-semibold">Log Audit</span>
            {!isAdmin && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-mono bg-amber-100 text-amber-900 border border-amber-300/80 px-1.5 py-0.2 rounded font-medium">
                <Lock className="w-2.5 h-2.5" />
                Admin
              </span>
            )}
          </button>

          {/* Regular Admin Tabs: Helaian Data */}
          <button
            id="tab-spreadsheet"
            onClick={() => handleTabClick('spreadsheet')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'spreadsheet'
                ? 'bg-[#1A1A1A] text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
            }`}
          >
            <Table2 className="w-4 h-4" />
            <span className="font-serif-heading font-semibold">Helaian Data</span>
            {!isAdmin && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-mono bg-amber-100 text-amber-900 border border-amber-300/80 px-1.5 py-0.2 rounded font-medium">
                <Lock className="w-2.5 h-2.5" />
                Admin
              </span>
            )}
          </button>

          <div className="h-4 w-px bg-stone-300 mx-1 hidden sm:block" />

          {/* 🔒 SUPER ADMIN ONLY: Import & Kemaskini Excel */}
          <button
            id="tab-import-excel"
            onClick={() => handleTabClick('import_excel')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'import_excel'
                ? 'bg-purple-950 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-purple-50/60'
            }`}
          >
            <UploadCloud className="w-4 h-4 text-purple-400" />
            <span className="font-serif-heading font-semibold">Import & Kemaskini Excel</span>
            {isSuperAdmin ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-purple-900/70 text-purple-200 border border-purple-400/40 px-1.5 py-0.2 rounded font-bold">
                <Crown className="w-2.5 h-2.5 text-amber-400" />
                Super Admin
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-purple-100 text-purple-950 border border-purple-300 px-1.5 py-0.2 rounded font-bold">
                <Lock className="w-2.5 h-2.5 text-purple-700" />
                Super Admin
              </span>
            )}
          </button>

          {/* 🔒 SUPER ADMIN ONLY: Google Sheets DB */}
          <button
            id="tab-google-sheets"
            onClick={() => handleTabClick('google_sheets')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'google_sheets'
                ? 'bg-purple-950 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-purple-50/60'
            }`}
          >
            <Database className="w-4 h-4 text-emerald-400" />
            <span className="font-serif-heading font-semibold">Google Sheets DB</span>
            <span className="bg-emerald-100 text-emerald-900 text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full border border-emerald-300">
              Live DB
            </span>
            {isSuperAdmin ? (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-mono bg-purple-900/70 text-purple-200 border border-purple-400/40 px-1.5 py-0.2 rounded font-bold">
                <Crown className="w-2.5 h-2.5 text-amber-400" />
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-purple-100 text-purple-950 border border-purple-300 px-1.5 py-0.2 rounded font-bold">
                <Lock className="w-2.5 h-2.5 text-purple-700" />
                Super Admin
              </span>
            )}
          </button>
        </nav>
      </div>
    </header>
  );
};
