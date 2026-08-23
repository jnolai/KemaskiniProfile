import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  KeyRound, 
  Eye, 
  EyeOff, 
  X, 
  ArrowRight,
  LogOut,
  UserCheck,
  Shield,
  FileSpreadsheet,
  Users,
  History,
  CheckCircle,
  Crown,
  Database,
  Sparkles,
  AlertTriangle,
  ShieldAlert,
  Clock
} from 'lucide-react';
import { motion } from 'motion/react';
import { Logo } from './Logo';
import { useToast } from '../context/ToastContext';
import { ActiveTab, AdminRole } from '../types';
import { 
  securityRateLimiter, 
  logSecurityIncident, 
  sanitizeInput,
  verifyAdminCredentials 
} from '../utils/security';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (role: AdminRole) => void;
  currentAdminPassword?: string;
  currentSuperAdminPassword?: string;
  targetTabName?: string;
  targetTabKey?: ActiveTab;
  isAlreadyAdmin?: boolean;
  isAlreadySuperAdmin?: boolean;
  adminRole?: AdminRole | null;
  onLogout?: () => void;
  onUpdateAdminPassword?: (newPassword: string) => void;
  onUpdateSuperAdminPassword?: (newPassword: string) => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  targetTabName,
  targetTabKey,
  isAlreadyAdmin = false,
  isAlreadySuperAdmin = false,
  adminRole = null,
  onLogout,
}) => {
  const { showSuccess, showError, showInfo, showWarning } = useToast();
  
  // Login form state
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  const isSuperAdminRequiredTab = targetTabKey === 'import_excel';
  const isElevationMode = isAlreadyAdmin && !isAlreadySuperAdmin && isSuperAdminRequiredTab;

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  // Reset states on open/close
  useEffect(() => {
    if (isOpen) {
      setPasswordInput('');
      setLoginError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (lockoutSeconds > 0) {
      showWarning('Akses Disekat Sementara', `Sila tunggu ${lockoutSeconds} saat lagi sebelum mencuba kata laluan semula demi perlindungan siber.`);
      return;
    }

    // Rate Limiter: Max 5 failed attempts per 60 seconds, 60s lockout
    const rateCheck = securityRateLimiter.checkRateLimit('admin_auth_attempt', 5, 60000, 60000);
    if (!rateCheck.allowed) {
      setLockoutSeconds(rateCheck.lockoutSeconds);
      const msg = `⚠️ Percubaan log masuk berulang kali dikesan. Sistem mengaktifkan sekatan keselamatan siber selama ${rateCheck.lockoutSeconds} saat.`;
      setLoginError(msg);
      showError('Sekatan Siber Diaktifkan', msg);
      return;
    }

    const trimmed = sanitizeInput(passwordInput);
    if (!trimmed) {
      setLoginError('Sila masukkan kata laluan.');
      showError('Kata Laluan Diperlukan', 'Sila masukkan kata laluan untuk pengesahan akses.');
      return;
    }

    // Cryptographic Credential Verification via SHA-256 with Salt
    const authResult = verifyAdminCredentials(trimmed);

    if (authResult.valid && authResult.role === 'super_admin') {
      securityRateLimiter.resetKey('admin_auth_attempt');
      setLoginError('');
      setPasswordInput('');
      showSuccess('Log Masuk Super Admin Berjaya', 'Akses penuh Super Admin (Carian & Kemaskini Data Pelanggan) disahkan secara selamat.');
      onSuccess('super_admin');
      return;
    }

    if (authResult.valid && authResult.role === 'admin') {
      if (isSuperAdminRequiredTab) {
        const msg = 'Kata laluan Admin sah, tetapi modul ini memerlukan pengesahan tahap Super Admin.';
        setLoginError(msg);
        showError('Akses Super Admin Diperlukan', msg);
        return;
      }

      securityRateLimiter.resetKey('admin_auth_attempt');
      setLoginError('');
      setPasswordInput('');
      showSuccess('Log Masuk Pentadbir Berjaya', 'Sesi pentadbir telah disahkan. Akses direktori dan log audit dibenarkan.');
      onSuccess('admin');
      return;
    }

    logSecurityIncident({
      type: 'brute_force_attempt',
      severity: 'medium',
      description: `Percubaan kata laluan pentadbir tidak sah (${rateCheck.remaining} baki percubaan sebelum sekatan).`,
      source: 'admin_login_modal',
    });

    const msg = `Kata laluan tidak sah. Baki percubaan selamat: ${rateCheck.remaining}. Sila semak semula.`;
    setLoginError(msg);
    showError('Log Masuk Gagal', msg);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm">
      
      {/* Background Overlay Click to Close */}
      <div 
        className="fixed inset-0" 
        onClick={onClose}
        aria-hidden="true" 
      />

      {/* Main Split-Screen Modal Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-4xl bg-[#FAF9F6] text-stone-900 rounded-3xl shadow-2xl border border-stone-300/80 overflow-hidden z-10 min-h-[540px] flex flex-col md:flex-row"
      >
        
        {/* Close Button Top-Right */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-40 w-9 h-9 rounded-full bg-stone-200/80 hover:bg-stone-300 text-stone-700 hover:text-stone-950 flex items-center justify-center transition-all cursor-pointer backdrop-blur-xs shadow-2xs"
          title="Tutup Modal"
          aria-label="Tutup"
        >
          <X className="w-4 h-4" />
        </button>

        {/* ========================================================================= */}
        {/* LEFT COLUMN: SIGN IN / ELEVATION FORM                                     */}
        {/* ========================================================================= */}
        <div className="w-full md:w-1/2 p-6 sm:p-10 flex flex-col justify-between">
          <div>
            {/* Brand / Logo Header */}
            <div className="mb-6">
              <Logo size="md" className="h-9 sm:h-10 max-w-[240px]" showSubtitle={true} />
            </div>

            {/* Title & Context */}
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-2xl sm:text-3xl font-serif-heading font-bold text-stone-950 tracking-tight">
                  {isAlreadySuperAdmin 
                    ? 'Sesi Super Admin' 
                    : isSuperAdminRequiredTab 
                    ? 'Akses Super Admin' 
                    : isAlreadyAdmin 
                    ? 'Sesi Pentadbir Aktif' 
                    : 'Pengesahan Pentadbir'}
                </h2>
                {isSuperAdminRequiredTab && (
                  <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 border border-purple-300 text-[10px] font-mono font-bold flex items-center gap-1">
                    <Crown className="w-3 h-3 text-purple-700" />
                    Super Admin
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-stone-500 font-sans">
                {isAlreadySuperAdmin 
                  ? 'Akses tahap tertinggi aktif dengan kawalan penuh ke semua modul pangkalan data.'
                  : isSuperAdminRequiredTab 
                  ? 'Modul Carian & Kemaskini Data Pelanggan dihadkan eksklusif kepada Super Admin sahaja.' 
                  : isAlreadyAdmin
                  ? 'Sesi pentadbir biasa anda sedang aktif.'
                  : 'Sila masukkan kata laluan untuk pengesahan akses pentadbir.'}
              </p>
            </div>

            {/* Target Tab Notice if Any */}
            {targetTabName && (
              <div className={`mb-5 p-3.5 rounded-xl border flex items-start gap-2.5 ${
                isSuperAdminRequiredTab
                  ? 'bg-purple-50/80 border-purple-200 text-purple-950'
                  : 'bg-stone-100 border-stone-300 text-stone-700'
              }`}>
                {isSuperAdminRequiredTab ? (
                  <Crown className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
                ) : (
                  <Lock className="w-4 h-4 text-stone-700 shrink-0 mt-0.5" />
                )}
                <div className="text-[11px] font-sans leading-relaxed">
                  Modul <strong>"{targetTabName}"</strong> {isSuperAdminRequiredTab ? 'hanya dibenarkan untuk' : 'memerlukan peranan'} <strong className={isSuperAdminRequiredTab ? 'text-purple-900 font-bold' : ''}>{isSuperAdminRequiredTab ? 'Super Admin' : 'Pentadbir'}</strong>.
                </div>
              </div>
            )}

            {/* Content: If Super Admin is Already Logged In */}
            {isAlreadySuperAdmin ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl shadow-2xs space-y-2.5">
                  <div className="flex items-center gap-2 text-emerald-950">
                    <Crown className="w-5 h-5 text-amber-600" />
                    <span className="text-xs font-bold font-serif-heading uppercase tracking-wider">
                      Status: Super Admin Sah
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Anda memegang kelayakan Super Admin. Anda mempunyai hak penuh untuk mengurus, menyunting perhubungan data pelanggan, dan mengosongkan pangkalan data.
                  </p>
                  <div className="pt-1 flex items-center gap-2 text-[11px] text-emerald-800 font-medium">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Akses Penuh Keseluruhan Sistem Diberikan</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full py-3 px-4 bg-stone-900 hover:bg-black text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer border border-stone-800"
                  >
                    <span>Teruskan ke Modul</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  {onLogout && (
                    <button
                      type="button"
                      onClick={() => {
                        onLogout();
                        onClose();
                      }}
                      className="w-full py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer border border-stone-300"
                    >
                      <LogOut className="w-4 h-4 text-stone-500" />
                      <span>Log Keluar Dari Sesi</span>
                    </button>
                  )}
                </div>
              </div>
            ) : isAlreadyAdmin && !isSuperAdminRequiredTab ? (
              /* Already regular admin and accessing regular admin tab */
              <div className="space-y-4">
                <div className="p-4 bg-white border border-stone-200 rounded-2xl shadow-2xs space-y-2.5">
                  <div className="flex items-center gap-2 text-stone-900">
                    <UserCheck className="w-5 h-5 text-emerald-600" />
                    <span className="text-xs font-bold font-serif-heading uppercase tracking-wider">
                      Status: Pentadbir Biasa (Admin)
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Sesi pentadbir anda aktif bagi pengurusan Direktori Akaun, Helaian Data, dan Log Audit.
                  </p>
                  <div className="p-2.5 bg-purple-50/70 border border-purple-200 rounded-xl flex items-center justify-between text-[11px] text-purple-900">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Crown className="w-3.5 h-3.5 text-purple-600" />
                      Perlu akses Import Excel / Google Sheets?
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        // Switch to elevate form
                        setPasswordInput('');
                        setLoginError('');
                      }}
                      className="underline font-bold hover:text-purple-950 cursor-pointer"
                    >
                      Naik taraf ke Super Admin
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full py-3 px-4 bg-stone-900 hover:bg-black text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer border border-stone-800"
                  >
                    <span>Teruskan ke Modul</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  {onLogout && (
                    <button
                      type="button"
                      onClick={() => {
                        onLogout();
                        onClose();
                      }}
                      className="w-full py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer border border-stone-300"
                    >
                      <LogOut className="w-4 h-4 text-stone-500" />
                      <span>Log Keluar Dari Sesi</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* Login or Upgrade Form */
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                
                {/* Admin Password Input */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-stone-800 font-serif-heading flex items-center gap-1.5">
                      {isSuperAdminRequiredTab ? (
                        <>
                          <Crown className="w-3.5 h-3.5 text-purple-600" />
                          <span>Kata Laluan Super Admin</span>
                        </>
                      ) : (
                        <>
                          <KeyRound className="w-3.5 h-3.5 text-stone-600" />
                          <span>Kata Laluan Pentadbir / Super Admin</span>
                        </>
                      )}
                    </label>
                    {isSuperAdminRequiredTab && (
                      <span className="text-[10px] text-purple-700 font-mono font-medium">
                        Diperlukan untuk {targetTabName || 'Modul Ini'}
                      </span>
                    )}
                  </div>
                  
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={passwordInput}
                      onChange={(e) => {
                        setPasswordInput(e.target.value);
                        setLoginError('');
                      }}
                      autoFocus
                      placeholder={isSuperAdminRequiredTab ? "Masukkan kata laluan Super Admin" : "Masukkan kata laluan"}
                      className="w-full pl-10 pr-10 py-3 bg-white border border-stone-300 rounded-xl text-xs sm:text-sm font-mono text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-stone-900 transition-all shadow-inner"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-700 cursor-pointer"
                      tabIndex={-1}
                      title={showPassword ? 'Sembunyi' : 'Lihat'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {loginError && (
                    <motion.div 
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 mt-2 font-medium flex items-start gap-1.5 leading-relaxed"
                    >
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <span>{loginError}</span>
                    </motion.div>
                  )}
                </div>

                {/* Secure Cryptographic Authentication Notice */}
                <div className="p-3 bg-stone-100/90 border border-stone-200/90 rounded-xl flex items-center justify-between text-[11px] text-stone-600 font-mono">
                  <span className="flex items-center gap-1.5 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Perlindungan Kriptografi SHA-256</span>
                  </span>
                  <span className="text-[10px] text-stone-500 bg-white px-2 py-0.5 rounded border border-stone-200 font-bold">
                    Anti-Brute Force
                  </span>
                </div>

                {/* Submit Action */}
                <button
                  type="submit"
                  disabled={lockoutSeconds > 0}
                  className={`w-full py-3 px-5 text-[#FDFCFB] rounded-xl text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 group mt-3 ${
                    lockoutSeconds > 0
                      ? 'bg-stone-400 text-stone-200 cursor-not-allowed border border-stone-300'
                      : isSuperAdminRequiredTab
                      ? 'bg-purple-900 hover:bg-purple-950 border border-purple-800 cursor-pointer'
                      : 'bg-stone-900 hover:bg-black border border-stone-800 cursor-pointer'
                  }`}
                >
                  {lockoutSeconds > 0 ? (
                    <>
                      <Clock className="w-4 h-4 text-amber-300 animate-spin" />
                      <span>Disekat Sementara ({lockoutSeconds}s)</span>
                    </>
                  ) : (
                    <>
                      <span>
                        {isSuperAdminRequiredTab
                          ? 'Log Masuk Super Admin'
                          : isElevationMode
                          ? 'Tingkatkan ke Super Admin'
                          : 'Log Masuk Pentadbir'}
                      </span>
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Footer Info */}
          <div className="pt-5 border-t border-stone-200/80 mt-5 flex items-center justify-between">
            <span className="text-[11px] text-stone-500 font-mono">
              Hierarki Peranan &bull; Awam / Admin / Super Admin
            </span>
            <span className="text-[11px] text-stone-400 font-mono">
              v3.1.0
            </span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: HERO OVERLAY CARD (Monochrome Dark #121212 Aesthetic)      */}
        {/* ========================================================================= */}
        <div className="w-full md:w-1/2 bg-[#121212] text-white p-6 sm:p-10 flex flex-col justify-between relative overflow-hidden border-t md:border-t-0 md:border-l border-stone-800">
          
          {/* Geometric Grid Texture & Ambient Glow */}
          <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />
          <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-purple-900/30 blur-3xl pointer-events-none" />
          <div className="absolute -left-16 -bottom-16 w-56 h-56 rounded-full bg-stone-800/50 blur-3xl pointer-events-none" />

          {/* Top Security Badge */}
          <div className="relative z-10 flex items-center justify-between">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 backdrop-blur-md">
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] font-mono font-semibold tracking-wider uppercase text-stone-200">
                Matriks Hak Akses Peranan
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-mono text-stone-400">Selamat</span>
            </div>
          </div>

          {/* Middle Information & Role Matrix */}
          <div className="relative z-10 py-5 space-y-4">
            <div>
              <h3 className="text-xl sm:text-2xl font-serif-heading font-bold text-white tracking-tight flex items-center gap-2">
                <span>Kawalan Keselamatan Data</span>
              </h3>
              <p className="text-xs text-stone-300 leading-relaxed font-sans font-normal mt-1">
                Bahagian manipulasi data pukal dan pangkalan data langsung dilindungi dengan peranan berperingkat:
              </p>
            </div>

            {/* Role Breakdown Cards */}
            <div className="space-y-2.5 pt-1">
              {/* Super Admin Tier */}
              <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-500/30 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-200 font-serif-heading flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5 text-amber-400" />
                    Super Admin (Eksklusif)
                  </span>
                  <span className="text-[9px] font-mono bg-purple-900 text-purple-200 px-1.5 py-0.5 rounded border border-purple-400/40">
                    Akses Penuh
                  </span>
                </div>
                <div className="text-[11px] text-stone-300 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <FileSpreadsheet className="w-3 h-3 text-purple-400 shrink-0" />
                    <span><strong>Carian & Kemaskini Data Pelanggan</strong> (Sunting & Selaras)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Crown className="w-3 h-3 text-amber-400 shrink-0" />
                    <span><strong>Kawalan Pangkalan Data</strong> (Kosongkan Data & Urus Pangkalan Data)</span>
                  </div>
                </div>
              </div>

              {/* Regular Admin Tier */}
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-200 font-serif-heading flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-stone-400" />
                    Pentadbir Biasa (Admin)
                  </span>
                  <span className="text-[9px] font-mono bg-stone-800 text-stone-300 px-1.5 py-0.5 rounded border border-stone-700">
                    Pengurusan
                  </span>
                </div>
                <div className="text-[11px] text-stone-400 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3 h-3 text-stone-400 shrink-0" />
                    <span>Direktori Akaun & Penebusan Hadiah</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <History className="w-3 h-3 text-stone-400 shrink-0" />
                    <span>Log Audit & Helaian Data (Paparan/Edisi)</span>
                  </div>
                </div>
              </div>

              {/* Public Portal Tier */}
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between text-[11px] text-stone-400">
                <span className="flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Pengguna Awam (Carian Layan Diri)</span>
                </span>
                <span className="font-mono text-[9px] text-stone-500">Tanpa Kata Laluan</span>
              </div>
            </div>
          </div>

          {/* Bottom Security Note */}
          <div className="relative z-10 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-stone-400 font-mono">
            <span>Enkripsi Sesi Tempatan</span>
            <span>Akses Dilindungi 256-Bit</span>
          </div>

        </div>

      </motion.div>
    </div>
  );
};
