import React, { useState, useEffect } from 'react';
import { 
  RotateCcw, 
  X, 
  Crown, 
  Database, 
  ShieldCheck, 
  CheckSquare, 
  Square, 
  Users, 
  History, 
  Table2, 
  CheckCircle2, 
  Sparkles, 
  Info,
  RefreshCw,
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export type ResetSectionKey = 'directory' | 'audit_logs' | 'spreadsheet';

export interface ResetDisplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmReset: (selectedSections: ResetSectionKey[]) => void;
  accountCount: number;
  auditLogCount: number;
  onReloadFromCloud?: () => Promise<void>;
  isSuperAdmin?: boolean;
}

export const ResetDisplayModal: React.FC<ResetDisplayModalProps> = ({
  isOpen,
  onClose,
  onConfirmReset,
  accountCount,
  auditLogCount,
  onReloadFromCloud,
  isSuperAdmin = true,
}) => {
  // Selection state for the 3 sections (default all selected for convenience)
  const [selectedSections, setSelectedSections] = useState<Record<ResetSectionKey, boolean>>({
    directory: true,
    audit_logs: true,
    spreadsheet: true,
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [isReloading, setIsReloading] = useState(false);

  // Reset checkboxes when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedSections({
        directory: true,
        audit_logs: true,
        spreadsheet: true,
      });
      setIsProcessing(false);
      setIsReloading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleSection = (key: ResetSectionKey) => {
    setSelectedSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const isAllSelected = selectedSections.directory && selectedSections.audit_logs && selectedSections.spreadsheet;
  const isNoneSelected = !selectedSections.directory && !selectedSections.audit_logs && !selectedSections.spreadsheet;

  const handleToggleAll = () => {
    if (isAllSelected) {
      setSelectedSections({
        directory: false,
        audit_logs: false,
        spreadsheet: false,
      });
    } else {
      setSelectedSections({
        directory: true,
        audit_logs: true,
        spreadsheet: true,
      });
    }
  };

  const handleExecuteReset = () => {
    const chosen = (Object.keys(selectedSections) as ResetSectionKey[]).filter(
      (key) => selectedSections[key]
    );
    if (chosen.length === 0) return;

    setIsProcessing(true);
    setTimeout(() => {
      onConfirmReset(chosen);
      setIsProcessing(false);
      onClose();
    }, 200);
  };

  const handleExecuteReload = async () => {
    if (!onReloadFromCloud) return;
    setIsReloading(true);
    try {
      await onReloadFromCloud();
      onClose();
    } catch (err) {
      console.error('Reload failed:', err);
    } finally {
      setIsReloading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
        {/* Background Overlay */}
        <div 
          className="fixed inset-0" 
          onClick={() => !isProcessing && !isReloading && onClose()} 
          aria-hidden="true" 
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative bg-white border border-stone-300 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden z-10"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-950 via-stone-900 to-purple-900 text-white p-5 flex items-start justify-between gap-3 border-b border-purple-900">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-800 text-amber-300 flex items-center justify-center shadow-md border border-purple-700 shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-amber-400 text-purple-950 font-mono font-bold uppercase px-2 py-0.5 rounded tracking-wider flex items-center gap-1">
                    <Crown className="w-3 h-3 text-purple-950" />
                    Kuasa Khas Super Admin
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold font-serif-heading text-white mt-1">
                  Reset Rekod Dipaparan
                </h3>
              </div>
            </div>

            <button
              onClick={onClose}
              disabled={isProcessing || isReloading}
              className="text-stone-300 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content Body */}
          <div className="p-5 space-y-4 text-xs">
            {/* Safe Notice Banner: Not Deleting Database */}
            <div className="p-3.5 bg-emerald-50/90 border border-emerald-300 rounded-xl flex items-start gap-2.5 text-emerald-950 font-serif">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-emerald-900 flex items-center gap-1.5 font-sans">
                  <span>Pangkalan Data Awan Kekal Selamat</span>
                  <span className="text-[10px] font-mono bg-emerald-200/80 text-emerald-950 px-1.5 py-0.2 rounded">
                    Tidak Dipadam
                  </span>
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  Tindakan ini <strong>hanya menetapkan semula (reset) rekod pada paparan skrin aktif</strong> bagi bahagian yang anda pilih. Data asal di <strong>Pangkalan Data Awan (Firestore) tidak akan dipadam</strong> dan boleh dimuat semula pada bila-bila masa.
                </p>
              </div>
            </div>

            {/* Quick Toggle All Button */}
            <div className="flex items-center justify-between pt-1">
              <span className="font-bold text-stone-800 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-purple-800" />
                <span>Pilih Bahagian Paparan Untuk Direset:</span>
              </span>

              <button
                type="button"
                onClick={handleToggleAll}
                className="text-[11px] font-semibold text-purple-950 hover:text-purple-700 hover:underline cursor-pointer flex items-center gap-1"
              >
                {isAllSelected ? 'Nyahpilih Semua' : 'Pilih Kesemuanya'}
              </button>
            </div>

            {/* Section Checkbox List */}
            <div className="space-y-2">
              {/* Option 1: Direktori Akaun */}
              <div
                onClick={() => toggleSection('directory')}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                  selectedSections.directory
                    ? 'bg-purple-50/80 border-purple-950 ring-1 ring-purple-950/40 shadow-2xs'
                    : 'bg-white border-stone-200 hover:border-stone-400 hover:bg-stone-50/60'
                }`}
              >
                <div className="pt-0.5 text-purple-950">
                  {selectedSections.directory ? (
                    <CheckSquare className="w-4 h-4 text-purple-950" />
                  ) : (
                    <Square className="w-4 h-4 text-stone-400" />
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-stone-900 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-purple-800" />
                      <span>Direktori Akaun</span>
                    </div>
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-200">
                      {accountCount.toLocaleString()} rekod
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500 font-serif mt-0.5">
                    Menetapkan semula senarai akaun dan penapis pada paparan Direktori Pelanggan.
                  </p>
                </div>
              </div>

              {/* Option 2: Log Audit & Hadiah */}
              <div
                onClick={() => toggleSection('audit_logs')}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                  selectedSections.audit_logs
                    ? 'bg-purple-50/80 border-purple-950 ring-1 ring-purple-950/40 shadow-2xs'
                    : 'bg-white border-stone-200 hover:border-stone-400 hover:bg-stone-50/60'
                }`}
              >
                <div className="pt-0.5 text-purple-950">
                  {selectedSections.audit_logs ? (
                    <CheckSquare className="w-4 h-4 text-purple-950" />
                  ) : (
                    <Square className="w-4 h-4 text-stone-400" />
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-stone-900 flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5 text-amber-700" />
                      <span>Log Audit & Rekod Hadiah</span>
                    </div>
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-200">
                      {auditLogCount.toLocaleString()} log
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500 font-serif mt-0.5">
                    Menetapkan semula rekod transaksi kemaskini profil & sejarah hadiah pada paparan log audit.
                  </p>
                </div>
              </div>

              {/* Option 3: Helaian Data (Spreadsheet View) */}
              <div
                onClick={() => toggleSection('spreadsheet')}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                  selectedSections.spreadsheet
                    ? 'bg-purple-50/80 border-purple-950 ring-1 ring-purple-950/40 shadow-2xs'
                    : 'bg-white border-stone-200 hover:border-stone-400 hover:bg-stone-50/60'
                }`}
              >
                <div className="pt-0.5 text-purple-950">
                  {selectedSections.spreadsheet ? (
                    <CheckSquare className="w-4 h-4 text-purple-950" />
                  ) : (
                    <Square className="w-4 h-4 text-stone-400" />
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-stone-900 flex items-center gap-1.5">
                      <Table2 className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Helaian Data (Spreadsheet View)</span>
                    </div>
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-200">
                      {accountCount.toLocaleString()} baris
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500 font-serif mt-0.5">
                    Menetapkan semula paparan grid data interaktif & carian pada Helaian Data.
                  </p>
                </div>
              </div>
            </div>

            {/* Optional Reload button directly in modal if needed */}
            {onReloadFromCloud && (
              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={handleExecuteReload}
                  disabled={isReloading || isProcessing}
                  className="inline-flex items-center gap-1.5 text-xs text-stone-600 hover:text-stone-950 underline underline-offset-2 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isReloading ? 'animate-spin' : ''}`} />
                  <span>Atau muat semula data penuh dari pangkalan data awan sekarang</span>
                </button>
              </div>
            )}
          </div>

          {/* Modal Footer Actions */}
          <div className="bg-stone-50 border-t border-stone-200 p-4 flex items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing || isReloading}
              className="px-4 py-2.5 text-xs font-semibold text-stone-700 bg-white border border-stone-300 rounded-xl hover:bg-stone-100 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Batal
            </button>

            <button
              type="button"
              onClick={handleExecuteReset}
              disabled={isProcessing || isReloading || isNoneSelected}
              className="px-5 py-2.5 text-xs font-bold text-white bg-purple-950 hover:bg-black disabled:bg-stone-300 disabled:cursor-not-allowed rounded-xl transition-all flex items-center gap-2 shadow-md cursor-pointer"
            >
              <RotateCcw className={`w-4 h-4 text-amber-400 ${isProcessing ? 'animate-spin' : ''}`} />
              <span>
                {isProcessing ? 'Menetapkan Semula...' : 'Sahkan & Reset Rekod Dipaparan'}
              </span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
