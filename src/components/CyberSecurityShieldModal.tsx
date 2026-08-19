import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  ShieldAlert, 
  KeyRound, 
  Database, 
  CheckCircle, 
  AlertTriangle, 
  Eye, 
  EyeOff, 
  X, 
  Activity, 
  FileCheck, 
  Cpu, 
  RefreshCw,
  Trash2,
  ExternalLink,
  Flame
} from 'lucide-react';
import { 
  getStoredSecurityIncidents, 
  clearSecurityIncidents, 
  SecurityIncident 
} from '../utils/security';
import { useToast } from '../context/ToastContext';

interface CyberSecurityShieldModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CyberSecurityShieldModal: React.FC<CyberSecurityShieldModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { showSuccess, showInfo } = useToast();
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'pdpa' | 'incidents'>('overview');

  useEffect(() => {
    if (isOpen) {
      setIncidents(getStoredSecurityIncidents());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClearLogs = () => {
    clearSecurityIncidents();
    setIncidents([]);
    showSuccess('Log Keselamatan Dikosongkan', 'Semua rekod insiden siber tempatan telah dipadam.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      
      {/* Background Overlay */}
      <div 
        className="fixed inset-0" 
        onClick={onClose}
        aria-hidden="true" 
      />

      {/* Main Modal Card */}
      <div className="relative z-10 w-full max-w-2xl bg-[#FAF9F6] border border-stone-300 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 sm:p-6 bg-[#1A1A1A] text-white flex items-center justify-between border-b border-stone-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-inner">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif-heading font-bold text-base sm:text-lg text-white">
                  Pusat Keselamatan Siber & Privasi Data
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700 text-[10px] font-mono font-bold">
                  Sistem Dilindungi
                </span>
              </div>
              <p className="text-xs text-stone-400 font-sans">
                Pematuhan Akta Perlindungan Data Peribadi (PDPA) & Pertahanan Siber Berlapis
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-stone-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 sm:px-6 pt-3 bg-white border-b border-stone-200 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`pb-2.5 px-3 text-xs font-bold font-serif-heading transition-all border-b-2 cursor-pointer ${
              activeTab === 'overview'
                ? 'border-stone-900 text-stone-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            Perisai Perlindungan Siber
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pdpa')}
            className={`pb-2.5 px-3 text-xs font-bold font-serif-heading transition-all border-b-2 cursor-pointer ${
              activeTab === 'pdpa'
                ? 'border-stone-900 text-stone-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            Pematuhan Privasi PDPA
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('incidents')}
            className={`pb-2.5 px-3 text-xs font-bold font-serif-heading transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'incidents'
                ? 'border-stone-900 text-stone-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <span>Log Pemantauan Ancaman</span>
            {incidents.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-800 text-[10px] font-mono font-bold">
                {incidents.length}
              </span>
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-3.5">
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <CheckCircle className="w-4 h-4" />
                </div>
                <div className="text-xs">
                  <span className="font-serif-heading font-bold text-emerald-950 block">
                    Semua Protokol Perlindungan Siber Aktif Sepenuhnya
                  </span>
                  <span className="text-emerald-800 font-sans">
                    Sistem menguatkuasakan kawalan akses, penapisan rentetan berniat jahat, dan pengesahan data masa nyata.
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                
                {/* 1. Anti-XSS & Sanitization */}
                <div className="p-4 bg-white border border-stone-200 rounded-2xl shadow-2xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-serif-heading font-bold text-stone-900 flex items-center gap-1.5">
                      <FileCheck className="w-4 h-4 text-emerald-600" />
                      Penapisan XSS & Injection
                    </span>
                    <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                      AKTIF
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-600 font-serif leading-relaxed">
                    Setiap input pengguna (No Akaun, Telefon, Email) ditapis daripada skrip berniat jahat, HTML berbahaya, dan aksara kawalan.
                  </p>
                </div>

                {/* 2. Rate Limiting & Anti-Scraping */}
                <div className="p-4 bg-white border border-stone-200 rounded-2xl shadow-2xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-serif-heading font-bold text-stone-900 flex items-center gap-1.5">
                      <Cpu className="w-4 h-4 text-emerald-600" />
                      Pengehad Kadar (Rate Limiter)
                    </span>
                    <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                      AKTIF
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-600 font-serif leading-relaxed">
                    Mencegah serangan *brute force* dan pengikisan data automatik (*scraping*) dengan mengehadkan kekerapan carian akaun.
                  </p>
                </div>

                {/* 3. Firestore Cloud Rules Validation */}
                <div className="p-4 bg-white border border-stone-200 rounded-2xl shadow-2xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-serif-heading font-bold text-stone-900 flex items-center gap-1.5">
                      <Database className="w-4 h-4 text-emerald-600" />
                      Peraturan Awan Firestore
                    </span>
                    <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                      DIKUATKUASA
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-600 font-serif leading-relaxed">
                    Pangkalan data Firestore mengesahkan had panjang rentetan, jenis data, dan struktur skema sebelum sebarang kemaskini diterima.
                  </p>
                </div>

                {/* 4. RBAC Role Hierarchy */}
                <div className="p-4 bg-white border border-stone-200 rounded-2xl shadow-2xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-serif-heading font-bold text-stone-900 flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-emerald-600" />
                      Hierarki Peranan (RBAC)
                    </span>
                    <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                      BERLAPIS
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-600 font-serif leading-relaxed">
                    Pengasingan ketat antara mod Awam (Kemaskini Tel/Email sahaja), Pentadbir Biasa, dan Super Admin (Excel & Pangkalan Data).
                  </p>
                </div>

              </div>
            </div>
          )}

          {/* TAB 2: PDPA DATA PRIVACY */}
          {activeTab === 'pdpa' && (
            <div className="space-y-3.5 text-xs">
              <div className="p-4 bg-blue-50/80 border border-blue-200 rounded-2xl space-y-2">
                <span className="font-serif-heading font-bold text-blue-950 text-sm block">
                  Pematuhan Akta Perlindungan Data Peribadi 2010 (Akta 709)
                </span>
                <p className="text-blue-900 font-serif leading-relaxed text-[11px]">
                  Maklumat sensitif pelanggan seperti Nombor Kad Pengenalan (MyKad), nombor telefon peribadi, dan alamat emel dilindungi dengan teknik penyamaran (*data masking*) bagi menghalang intipan pihak ketiga yang tidak dibenarkan.
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="p-3 bg-white border border-stone-200 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="font-mono font-bold text-stone-900 block text-[11px]">Penyamaran No. Kad Pengenalan (MyKad)</span>
                    <span className="text-stone-500 font-serif text-[10px]">Format: 880112-••-••43 (Hanya 6 digit awal & 2 digit akhir kelihatan)</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-800 border border-stone-300 font-mono text-[10px] font-bold">
                    Automatik
                  </span>
                </div>

                <div className="p-3 bg-white border border-stone-200 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="font-mono font-bold text-stone-900 block text-[11px]">Integriti Medan Terkunci (Read-Only)</span>
                    <span className="text-stone-500 font-serif text-[10px]">Nama penuh, No. Akaun, dan Kategori Akaun tidak boleh dipinda melalui portal awam</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-800 border border-stone-300 font-mono text-[10px] font-bold">
                    Terkunci
                  </span>
                </div>

                <div className="p-3 bg-white border border-stone-200 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="font-mono font-bold text-stone-900 block text-[11px]">Jejak Audit Digital Sepenuhnya</span>
                    <span className="text-stone-500 font-serif text-[10px]">Setiap pengubahan merekodkan cap masa, data lama dan data baharu untuk akauntabiliti</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 font-mono text-[10px] font-bold">
                    Audit Log
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: INCIDENTS & TELEMETRY */}
          {activeTab === 'incidents' && (
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-stone-600 font-serif text-xs">
                  {incidents.length === 0 
                    ? 'Tiada sebarang insiden atau aktiviti mencurigakan dikesan.' 
                    : `${incidents.length} aktiviti direkodkan oleh enjin pemantauan.`}
                </span>
                {incidents.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearLogs}
                    className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-[10px] font-semibold flex items-center gap-1 border border-stone-300 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3 text-stone-500" />
                    <span>Kosongkan Log</span>
                  </button>
                )}
              </div>

              {incidents.length === 0 ? (
                <div className="p-8 text-center bg-white border border-dashed border-stone-300 rounded-2xl space-y-2">
                  <div className="w-10 h-10 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <span className="font-serif-heading font-bold text-stone-900 block">
                    Semua Keadaan Selamat
                  </span>
                  <p className="text-[11px] text-stone-500 font-serif">
                    Tiada percubaan pencerobohan siber atau sekatan had carian aktif pada masa ini.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {incidents.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 bg-white border border-stone-200 rounded-xl space-y-1 shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-[10px] text-rose-800 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded uppercase">
                          {item.type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] font-mono text-stone-400">
                          {item.timestamp}
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-700 font-sans leading-snug">
                        {item.description}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-100 border-t border-stone-200 flex items-center justify-between text-xs">
          <span className="text-[11px] text-stone-500 font-mono">
            Enjin Perlindungan Siber eKemaskini &bull; Dilindungi Cloud Firestore
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-stone-900 hover:bg-black text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
