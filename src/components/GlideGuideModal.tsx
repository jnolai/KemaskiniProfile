import React from 'react';
import { X, ExternalLink, CheckCircle2, Shield, Smartphone, FileSpreadsheet, Lock, Edit3 } from 'lucide-react';

interface GlideGuideModalProps {
  onClose: () => void;
}

export const GlideGuideModal: React.FC<GlideGuideModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        id="glide-guide-modal"
        className="bg-[#FAF9F6] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-stone-300"
      >
        {/* Header */}
        <div className="p-4 bg-[#1A1A1A] text-white flex items-center justify-between border-b border-stone-800">
          <div>
            <h3 className="font-serif-heading font-bold text-base">Panduan Portal Profil & Keselamatan Data</h3>
            <p className="text-xs text-stone-400">Logik Pengasingan Ruangan Terkunci (Read-Only) vs Ruangan Boleh Dikemaskini (Editable)</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs text-stone-700 leading-relaxed bg-white">
          {/* Step 1 */}
          <div className="bg-[#FAF9F6] p-4 rounded-xl border border-stone-300 space-y-2">
            <h4 className="font-serif-heading font-bold text-stone-900 text-sm flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center text-[10px] font-mono">1</span>
              <span>Struktur Lajur Pangkalan Data Akaun Pelanggan & Import Excel</span>
            </h4>
            <p>
              Data pelanggan diselaraskan dengan helaian Excel (.xlsx) dengan susunan lajur rasmi:
            </p>
            <div className="bg-white p-2.5 rounded-lg border border-stone-300 font-mono text-[11px] text-stone-900 overflow-x-auto">
              No Akaun | Nama Pemilik | No Kad Pengenalan | No Handphone (Boleh Sunting) | Emel Pemilik/Wakil (Boleh Sunting) | Kategori Akaun | Status
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-[#FAF9F6] p-4 rounded-xl border border-stone-300 space-y-2">
            <h4 className="font-serif-heading font-bold text-stone-900 text-sm flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center text-[10px] font-mono">2</span>
              <span>Hak Akses & Pengesahan Pentadbir (Role-Based Access)</span>
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
              <div className="bg-white p-3.5 rounded-xl border border-emerald-300 shadow-2xs">
                <span className="font-bold text-emerald-950 flex items-center gap-1.5 mb-1.5 font-serif-heading">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  <span>Pengguna Awam / Pelanggan</span>
                </span>
                <p className="text-[11px] text-stone-600 leading-relaxed">
                  Bebas mengakses bahagian <strong>Carian & Kemaskini Profil</strong> tanpa perlu kata laluan. Hanya boleh mengemaskini <strong>Nombor Telefon</strong> dan <strong>Email</strong> akaun sendiri.
                </p>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-stone-900 shadow-2xs">
                <span className="font-bold text-stone-950 flex items-center gap-1.5 mb-1.5 font-serif-heading">
                  <Shield className="w-4 h-4 text-amber-600" />
                  <span>Pentadbir Sistem (Admin Login)</span>
                </span>
                <p className="text-[11px] text-stone-600 leading-relaxed">
                  Dilindungi kata laluan (lalai: <strong className="font-mono bg-stone-100 px-1 py-0.5 rounded">admin123</strong>). Memberi akses eksklusif kepada <strong>Import Excel</strong>, <strong>Direktori Akaun</strong>, <strong>Helaian Data</strong>, dan <strong>Log Audit</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-[#FAF9F6] p-4 rounded-xl border border-stone-300 space-y-2">
            <h4 className="font-serif-heading font-bold text-stone-900 text-sm flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center text-[10px] font-mono">3</span>
              <span>Penyegerakan Pangkalan Data Masa Nyata (Real-Time Cloud Sync)</span>
            </h4>
            <p>
              Setiap maklumat perhubungan yang dikemaskini oleh pelanggan atau Super Admin diselaraskan secara langsung ke pangkalan data awan serta storan tempatan untuk capaian pantas dan selamat.
            </p>
          </div>

          {/* Step 4 */}
          <div className="bg-[#FAF9F6] p-4 rounded-xl border border-stone-300 space-y-2">
            <h4 className="font-serif-heading font-bold text-stone-900 text-sm flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center text-[10px] font-mono">4</span>
              <span>Jejak Audit Automatik (Audit Log)</span>
            </h4>
            <p>
              Setiap kali pelanggan membuat kemaskini nombor telefon atau email, sistem secara automatik merakamkan rekod tarikh, masa, nilai sebelum dan nilai selepas ke dalam <strong>Log Kemaskini & Audit</strong> yang boleh dieksport ke format Excel.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#FAF9F6] border-t border-stone-300 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-[#1A1A1A] hover:bg-black text-white rounded-xl text-xs font-bold transition-colors border border-stone-800 shadow-2xs"
          >
            Faham & Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

