import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  X, 
  Sparkles 
} from 'lucide-react';
import { ToastMessage, ToastType } from '../types';

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

const getToastConfig = (type: ToastType) => {
  switch (type) {
    case 'success':
      return {
        icon: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
        badgeBg: 'bg-emerald-950/80 text-emerald-300 border-emerald-800',
        borderColor: 'border-emerald-500/70',
        accentBar: 'bg-emerald-500',
        label: 'Berjaya',
      };
    case 'error':
      return {
        icon: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />,
        badgeBg: 'bg-rose-950/80 text-rose-300 border-rose-800',
        borderColor: 'border-rose-500/70',
        accentBar: 'bg-rose-500',
        label: 'Ralat',
      };
    case 'warning':
      return {
        icon: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
        badgeBg: 'bg-amber-950/80 text-amber-300 border-amber-800',
        borderColor: 'border-amber-500/70',
        accentBar: 'bg-amber-500',
        label: 'Perhatian',
      };
    case 'info':
    default:
      return {
        icon: <Info className="w-5 h-5 text-sky-400 shrink-0" />,
        badgeBg: 'bg-sky-950/80 text-sky-300 border-sky-800',
        borderColor: 'border-sky-500/70',
        accentBar: 'bg-sky-500',
        label: 'Makluman',
      };
  }
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({
  toast,
  onDismiss,
}) => {
  const { icon, badgeBg, borderColor, accentBar, label } = getToastConfig(toast.type);
  const duration = toast.duration ?? 4500;

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onDismiss(toast.id);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [toast.id, duration, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 15, scale: 0.95 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`relative w-full max-w-sm sm:max-w-md bg-[#18181B] text-white rounded-2xl p-4 shadow-2xl border ${borderColor} overflow-hidden pointer-events-auto backdrop-blur-md`}
      role="alert"
      aria-live="assertive"
    >
      {/* Top Accent Stripe */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${accentBar}`} />

      <div className="flex items-start gap-3.5 pt-1">
        <div className="mt-0.5">{icon}</div>

        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded-full border ${badgeBg}`}>
              {label}
            </span>
            <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight truncate">
              {toast.title}
            </h4>
          </div>

          {toast.message && (
            <p className="text-xs text-stone-300 leading-relaxed font-sans mt-0.5 break-words">
              {toast.message}
            </p>
          )}

          {toast.action && (
            <div className="mt-2.5 pt-2 border-t border-stone-800 flex justify-end">
              <button
                onClick={() => {
                  toast.action?.onClick();
                  onDismiss(toast.id);
                }}
                className="text-xs font-semibold px-3 py-1 bg-white text-stone-900 rounded-lg hover:bg-stone-200 transition-colors cursor-pointer"
              >
                {toast.action.label}
              </button>
            </div>
          )}
        </div>

        {/* Close Button */}
        <button
          onClick={() => onDismiss(toast.id)}
          className="text-stone-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-stone-800/60 cursor-pointer shrink-0"
          aria-label="Tutup notifikasi"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Countdown animation indicator */}
      {duration > 0 && (
        <motion.div
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: duration / 1000, ease: 'linear' }}
          className={`absolute bottom-0 left-0 h-0.5 opacity-40 ${accentBar}`}
        />
      )}
    </motion.div>
  );
};

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  return (
    <div
      aria-label="Notifikasi Sistem"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-[calc(100vw-2.5rem)] pointer-events-none"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
};
