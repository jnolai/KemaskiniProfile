import React, { useState } from 'react';
import { 
  Trash2, 
  AlertTriangle, 
  X, 
  Crown, 
  Database, 
  Lock, 
  CheckCircle2, 
  Loader2 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ClearDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  accountCount: number;
  auditLogCount: number;
}

export const ClearDataModal: React.FC<ClearDataModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  accountCount,
  auditLogCount,
}) => {
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExecute = async () => {
    if (confirmText.trim().toUpperCase() !== 'PADAM') {
      setErrorMsg('Sila taip perkataan "PADAM" untuk mengesahkan tindakan ini.');
      return;
    }

    setIsDeleting(true);
    setErrorMsg(null);
    try {
      await onConfirm();
      setConfirmText('');
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal mengosongkan pangkalan data. Sila cuba sebentar lagi.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
        {/* Background Click */}
        <div 
          className="fixed inset-0" 
          onClick={() => !isDeleting && onClose()} 
          aria-hidden="true" 
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative bg-white border border-stone-300 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden z-10"
        >
          {/* Header */}
          <div className="bg-red-50/90 border-b border-red-200 p-5 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-2xs shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-red-100 text-red-800 border border-red-300 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider flex items-center gap-1">
                    <Crown className="w-3 h-3 text-amber-600" />
                    Kuasa Khas Super Admin
                  </span>
                </div>
                <h3 className="text-base font-bold text-stone-900 font-serif-heading mt-1">
                  Kosongkan Keseluruhan Pangkalan Data
                </h3>
              </div>
            </div>

            <button
              onClick={onClose}
              disabled={isDeleting}
              className="text-stone-400 hover:text-stone-700 p-1 rounded-lg hover:bg-red-100/50 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content Body */}
          <div className="p-5 space-y-4">
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900 leading-relaxed font-serif">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <strong>Amaran Keselamatan:</strong> Tindakan ini akan memadamkan secara kekal semua rekod akaun pelanggan dan log audit daripada <strong>Pangkalan Data Awan (Cloud Firestore)</strong> serta storan tempatan pelayar. Tindakan ini <u>tidak boleh diundur</u>.
              </div>
            </div>

            {/* Impact summary statistics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-center">
                <span className="text-xs text-stone-500 font-serif block">Rekod Akaun Terlibat</span>
                <span className="text-xl font-bold font-mono text-red-600">
                  {accountCount.toLocaleString()}
                </span>
                <span className="text-[10px] text-stone-400 block mt-0.5">Akaun Pelanggan</span>
              </div>
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-center">
                <span className="text-xs text-stone-500 font-serif block">Log Audit Terlibat</span>
                <span className="text-xl font-bold font-mono text-red-600">
                  {auditLogCount.toLocaleString()}
                </span>
                <span className="text-[10px] text-stone-400 block mt-0.5">Log Transaksi</span>
              </div>
            </div>

            {/* Confirmation input */}
            <div className="space-y-1.5 pt-1">
              <label className="block text-xs font-semibold text-stone-700">
                Sila taip <strong className="text-red-700 font-mono font-bold tracking-wider">PADAM</strong> di bawah untuk mengesahkan pemadaman:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => {
                  setConfirmText(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                disabled={isDeleting}
                placeholder="Taip perkataan PADAM"
                className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-stone-900 uppercase"
                autoFocus
              />
              {errorMsg && (
                <p className="text-xs text-red-600 font-medium">{errorMsg}</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="bg-stone-50 border-t border-stone-200 p-4 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2.5 text-xs font-semibold text-stone-700 bg-white border border-stone-300 rounded-xl hover:bg-stone-100 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleExecute}
              disabled={isDeleting || confirmText.trim().toUpperCase() !== 'PADAM'}
              className="px-5 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:bg-stone-300 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center gap-2 shadow-2xs cursor-pointer"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sedang Mengosongkan Data...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Sahkan & Kosongkan Pangkalan Data</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
