import React, { useState, useMemo, useEffect } from 'react';
import { 
  History, 
  Search, 
  FileSpreadsheet, 
  ArrowRight, 
  Clock, 
  CheckCircle2, 
  Gift, 
  Sparkles, 
  Check, 
  Tag, 
  Package, 
  X, 
  AlertCircle,
  Layers,
  ChevronRight,
  Info,
  RotateCcw,
  Crown,
  Lock,
  RefreshCw
} from 'lucide-react';
import { ProfileUpdateAuditLog, GiftItem } from '../types';
import { exportAuditLogsToExcel } from '../utils/excelHelper';
import { useToast } from '../context/ToastContext';
import { 
  getStoredGifts, 
  subscribeToGifts, 
  deductGiftStock, 
  INITIAL_SAMPLE_GIFTS,
  saveGiftsLocally
} from '../services/giftService';
import { GiftClaimModal } from './GiftClaimModal';

interface AuditLogsViewProps {
  logs: ProfileUpdateAuditLog[];
  onSelectAccount?: (noAkaun: string) => void;
  onClaimReward?: (noAkaun: string, giftName?: string, remainingStock?: number) => void;
  onResetDisplay?: () => void;
  isSuperAdmin?: boolean;
  onRequireSuperAdmin?: () => void;
  onReloadFromCloud?: () => void;
  isReloading?: boolean;
}

export const AuditLogsView: React.FC<AuditLogsViewProps> = ({ 
  logs, 
  onSelectAccount, 
  onClaimReward,
  onResetDisplay,
  isSuperAdmin = false,
  onRequireSuperAdmin,
  onReloadFromCloud,
  isReloading = false
}) => {
  const { showSuccess, showWarning, showInfo } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('Semua');
  const [rewardFilter, setRewardFilter] = useState('Semua');
  const [rewardClaimSuccessMsg, setRewardClaimSuccessMsg] = useState<string | null>(null);

  // 🎁 Real-time Gift Inventory from Pengurusan Hadiah
  const [giftList, setGiftList] = useState<GiftItem[]>(() => getStoredGifts());
  
  // 🎁 Modal state for choosing Gift when clicking "Tanda Hadiah Diberi"
  const [activeClaimLog, setActiveClaimLog] = useState<ProfileUpdateAuditLog | null>(null);
  const [selectedGiftId, setSelectedGiftId] = useState<string>('');
  const [customGiftName, setCustomGiftName] = useState<string>('');
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);

  // Subscribe to real-time gift inventory changes
  useEffect(() => {
    const unsubscribe = subscribeToGifts((gifts) => {
      setGiftList(gifts);
    });
    return () => unsubscribe();
  }, []);

  // Set default selected gift when modal opens
  useEffect(() => {
    if (activeClaimLog) {
      if (giftList.length > 0) {
        // Pick first gift that has stock, or first gift
        const available = giftList.find((g) => {
          const baki = g.bakiSemasa !== undefined ? Number(g.bakiSemasa) : (Number(g.kuantitiAsal) || Number(g.kuantiti) || 0);
          return baki > 0;
        }) || giftList[0];
        setSelectedGiftId(available ? available.id : 'custom');
      } else {
        setSelectedGiftId('custom');
      }
      setCustomGiftName('');
    }
  }, [activeClaimLog, giftList]);

  // Calculate Reward & Log Statistics
  const stats = useMemo(() => {
    const totalLogs = logs.length;
    // Count unique accounts that became eligible
    const eligibleLogs = logs.filter((l) => l.isRewardEligible);
    const uniqueEligibleAccounts = new Set(eligibleLogs.map((l) => l.noAkaun)).size;
    const claimedLogs = logs.filter((l) => l.rewardClaimed || l.rewardStatus === 'Telah Dituntut');
    const uniqueClaimedAccounts = new Set(claimedLogs.map((l) => l.noAkaun)).size;
    const pendingRewards = Math.max(0, uniqueEligibleAccounts - uniqueClaimedAccounts);

    const totalGiftInventoryStock = giftList.reduce((sum, g) => {
      const initial = Number(g.kuantitiAsal) || Number(g.kuantiti) || 0;
      const baki = g.bakiSemasa !== undefined ? Number(g.bakiSemasa) : initial;
      return sum + baki;
    }, 0);

    return {
      totalLogs,
      uniqueEligibleAccounts,
      uniqueClaimedAccounts,
      pendingRewards,
      totalGiftInventoryStock,
    };
  }, [logs, giftList]);

  const filteredLogs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return logs.filter((log) => {
      const matchSearch =
        !q ||
        log.noAkaun.toLowerCase().includes(q) ||
        log.nama.toLowerCase().includes(q) ||
        log.newPhone.toLowerCase().includes(q) ||
        log.newEmail.toLowerCase().includes(q) ||
        (log.rewardCode && log.rewardCode.toLowerCase().includes(q)) ||
        (log.rewardGiftName && log.rewardGiftName.toLowerCase().includes(q));

      const matchSource = sourceFilter === 'Semua' || log.source === sourceFilter;

      let matchReward = true;
      if (rewardFilter === 'Layak') {
        matchReward = log.isRewardEligible && !log.rewardClaimed && log.rewardStatus !== 'Telah Dituntut';
      } else if (rewardFilter === 'TelahDituntut') {
        matchReward = log.rewardClaimed === true || log.rewardStatus === 'Telah Dituntut';
      } else if (rewardFilter === 'KemaskiniUlangan') {
        matchReward = log.rewardStatus === 'Kemaskini Ulangan (Hadiah Sudah Diberi)';
      }

      return matchSearch && matchSource && matchReward;
    });
  }, [logs, searchQuery, sourceFilter, rewardFilter]);

  // Open the Gift Selection Modal
  const handleOpenClaimModal = (log: ProfileUpdateAuditLog) => {
    setActiveClaimLog(log);
  };

  // Close Modal
  const handleCloseClaimModal = () => {
    setActiveClaimLog(null);
    setSelectedGiftId('');
    setCustomGiftName('');
  };

  // Confirm Claim with chosen Gift
  const handleConfirmClaimWithGift = async (noAkaun: string, giftName: string, remainingStock: number) => {
    if (onClaimReward) {
      onClaimReward(noAkaun, giftName, remainingStock);
    }

    const msg = `✅ Hadiah "${giftName}" berjaya diserahkan kepada akaun ${noAkaun}. Baki stok hadiah ini: ${remainingStock} unit.`;
    setRewardClaimSuccessMsg(msg);
    showSuccess(
      'Penyerahan Hadiah Disahkan & Direkodkan',
      `Jenis Hadiah: "${giftName}" | Baki Stok Semasa: ${remainingStock} unit`
    );

    setTimeout(() => setRewardClaimSuccessMsg(null), 5000);
    handleCloseClaimModal();
  };

  const handleExportLogs = () => {
    if (logs.length === 0) {
      showWarning('Tiada Log', 'Tiada rekod log transaksi untuk dieksport.');
      return;
    }
    exportAuditLogsToExcel(logs);
    showSuccess('Eksport Log Selesai', `Sebanyak ${logs.length} rekod audit log telah dieksport ke fail Excel (.xlsx).`);
  };

  // Find currently selected gift object for modal preview
  const currentSelectedGift = useMemo(() => {
    if (!selectedGiftId || selectedGiftId === 'custom') return null;
    return giftList.find((g) => g.id === selectedGiftId) || null;
  }, [selectedGiftId, giftList]);

  return (
    <div className="space-y-4">
      {/* 1. Header Banner */}
      <div className="bg-[#FAF9F6] border border-stone-300 rounded-2xl p-4 sm:p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-stone-900 text-white text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded tracking-wider">
                Audit & Hadiah Penghargaan
              </span>
              <span className="text-xs text-stone-500 font-serif">
                Rekod Transaksi Kemaskini & Status Hadiah 1x Setiap Pelanggan
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif-heading font-bold text-stone-950">
              Log Kemaskini Profil & Rekod Hadiah Pelanggan
            </h2>
            <p className="text-xs text-stone-600 font-serif mt-1 max-w-2xl">
              Setiap pelanggan yang berjaya mengemaskini maklumat profil layak menerima hadiah penghargaan (terhad 1 kali sahaja setiap akaun). Pilih jenis hadiah daripada bahagian <strong>Pengurusan Hadiah</strong> semasa penyerahan untuk mengemas kini baki stok secara automatik.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto shrink-0">
            {onReloadFromCloud && (
              <button
                onClick={onReloadFromCloud}
                disabled={isReloading}
                className="px-3.5 py-2.5 bg-white hover:bg-stone-100 text-stone-800 rounded-xl text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5 border border-stone-300 cursor-pointer disabled:opacity-50"
                title="Segerakkan rekod log & hadiah terkini daripada pangkalan data awan"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isReloading ? 'animate-spin' : ''}`} />
                <span>{isReloading ? 'Menyegerak...' : 'Segerak Data Awan'}</span>
              </button>
            )}

            <button
              onClick={handleExportLogs}
              disabled={logs.length === 0}
              className="px-4 py-2.5 bg-[#1A1A1A] hover:bg-black disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-2xs transition-colors flex items-center gap-2 border border-stone-800 cursor-pointer disabled:cursor-not-allowed"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Eksport Laporan Hadiah & Log (.xlsx)</span>
            </button>

            {onResetDisplay && (
              isSuperAdmin ? (
                <button
                  onClick={onResetDisplay}
                  className="px-3.5 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-950 rounded-xl text-xs font-semibold border border-purple-300 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  title="Reset rekod pada paparan skrin tanpa memadam pangkalan data awan (Akses Khas Super Admin)"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-purple-900" />
                  <span>Reset Rekod Dipaparan</span>
                  <span className="text-[9px] bg-amber-200 text-purple-950 border border-amber-300 px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider flex items-center gap-1">
                    <Crown className="w-2.5 h-2.5 text-purple-950" />
                    Super Admin
                  </span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (onRequireSuperAdmin) {
                      onRequireSuperAdmin();
                    } else {
                      showWarning(
                        'Akses Super Admin Diperlukan',
                        'Fungsi Reset Rekod Dipaparan hanya boleh dilaksanakan oleh Super Admin sahaja.'
                      );
                    }
                  }}
                  className="px-3.5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-xl text-xs font-semibold border border-stone-300 transition-colors cursor-pointer flex items-center gap-1.5 opacity-85 shadow-2xs"
                  title="Fungsi Reset Rekod Dipaparan dikunci — Sila sahkan kata laluan Super Admin"
                >
                  <Lock className="w-3.5 h-3.5 text-stone-500" />
                  <span>Reset Rekod Dipaparan</span>
                  <Crown className="w-3 h-3 text-amber-500" />
                </button>
              )
            )}
          </div>
        </div>

        {/* 2. KPI Metrics Grid for Rewards & Updates */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5 pt-4 border-t border-stone-200 text-xs">
          <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-2xs">
            <div className="flex items-center justify-between text-stone-500 mb-1">
              <span className="font-serif">Jumlah Log Transaksi</span>
              <History className="w-4 h-4 text-stone-400" />
            </div>
            <div className="text-xl font-mono font-bold text-stone-950">
              {stats.totalLogs}
            </div>
            <div className="text-[10px] text-stone-400 mt-0.5">Keseluruhan perubahan data</div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-emerald-300/80 shadow-2xs">
            <div className="flex items-center justify-between text-emerald-800 mb-1">
              <span className="font-serif font-semibold">Pelanggan Layak Hadiah</span>
              <Gift className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl font-mono font-bold text-emerald-950">
              {stats.uniqueEligibleAccounts} <span className="text-xs font-normal text-emerald-700">Akaun</span>
            </div>
            <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">1x Sahaja Setiap Akaun</div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-amber-300/80 shadow-2xs">
            <div className="flex items-center justify-between text-amber-800 mb-1">
              <span className="font-serif font-semibold">Menunggu Penyerahan</span>
              <Sparkles className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-xl font-mono font-bold text-amber-950">
              {stats.pendingRewards} <span className="text-xs font-normal text-amber-700">Penebusan</span>
            </div>
            <div className="text-[10px] text-amber-600 mt-0.5">Belum dituntut / diserahkan</div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-stone-300 shadow-2xs">
            <div className="flex items-center justify-between text-stone-600 mb-1">
              <span className="font-serif font-semibold">Hadiah Telah Diserah</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl font-mono font-bold text-stone-950">
              {stats.uniqueClaimedAccounts} <span className="text-xs font-normal text-stone-500">Selesai</span>
            </div>
            <div className="text-[10px] text-stone-500 mt-0.5">Telah dituntut oleh pelanggan</div>
          </div>
        </div>

        {/* 🎁 Live Gift Inventory Summary Bar */}
        <div className="mt-4 pt-3 border-t border-stone-200 bg-stone-50/70 p-3 rounded-xl border border-stone-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-stone-900 font-serif-heading">
              <Package className="w-3.5 h-3.5 text-purple-900" />
              <span>Senarai Jenis Hadiah & Baki Stok Semasa (Pengurusan Hadiah):</span>
            </div>
            <span className="text-[11px] font-mono font-bold text-purple-950 bg-purple-100 px-2 py-0.5 rounded-md border border-purple-200">
              Jumlah Baki Stok: {stats.totalGiftInventoryStock} unit
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {giftList.length === 0 ? (
              <div className="flex items-center gap-2 text-stone-500 text-xs">
                <Info className="w-3.5 h-3.5 text-amber-500" />
                <span>Tiada hadiah didaftarkan dalam Pengurusan Hadiah.</span>
                <button
                  type="button"
                  onClick={() => saveGiftsLocally(INITIAL_SAMPLE_GIFTS)}
                  className="text-purple-900 underline font-semibold hover:text-purple-950 cursor-pointer"
                >
                  Muat Hadiah Contoh
                </button>
              </div>
            ) : (
              giftList.map((g) => {
                const initialQty = Number(g.kuantitiAsal) || Number(g.kuantiti) || 0;
                const bakiQty = g.bakiSemasa !== undefined ? Number(g.bakiSemasa) : initialQty;
                const isOutOfStock = bakiQty <= 0;
                const isLowStock = bakiQty > 0 && bakiQty <= 10;

                return (
                  <div
                    key={g.id}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                      isOutOfStock
                        ? 'bg-rose-50 border-rose-200 text-rose-900'
                        : isLowStock
                        ? 'bg-amber-50 border-amber-200 text-amber-950'
                        : 'bg-white border-stone-300 text-stone-900 shadow-2xs'
                    }`}
                  >
                    <Gift className={`w-3 h-3 ${isOutOfStock ? 'text-rose-500' : isLowStock ? 'text-amber-500' : 'text-purple-700'}`} />
                    <span className="font-semibold">{g.namaHadiah}</span>
                    <span
                      className={`font-mono text-[10px] font-bold px-1.5 py-0.2 rounded ${
                        isOutOfStock
                          ? 'bg-rose-200 text-rose-950'
                          : isLowStock
                          ? 'bg-amber-200 text-amber-950'
                          : 'bg-stone-100 text-stone-800'
                      }`}
                    >
                      {isOutOfStock ? 'Habis Stok (0)' : `Baki: ${bakiQty} unit`}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Success Alert Notification */}
        {rewardClaimSuccessMsg && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{rewardClaimSuccessMsg}</span>
          </div>
        )}

        {/* 3. Filter Toolbar */}
        <div className="mt-4 pt-3 border-t border-stone-200 grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari mengikut No Akaun, Nama, Tel, Email, Kod Hadiah, Jenis Hadiah..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-medium text-stone-900 focus:outline-none focus:border-stone-800 shadow-2xs"
            />
          </div>

          <div className="sm:col-span-3">
            <select
              value={rewardFilter}
              onChange={(e) => setRewardFilter(e.target.value)}
              className="w-full p-2 bg-white border border-stone-300 rounded-xl text-xs font-medium text-stone-900 focus:outline-none focus:border-stone-800 shadow-2xs"
            >
              <option value="Semua">Semua Status Hadiah</option>
              <option value="Layak">🎁 Layak Hadiah (Belum Dituntut)</option>
              <option value="TelahDituntut">✅ Hadiah Telah Diserahkan</option>
              <option value="KemaskiniUlangan">🔁 Kemaskini Ulangan</option>
            </select>
          </div>

          <div className="sm:col-span-3">
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="w-full p-2 bg-white border border-stone-300 rounded-xl text-xs font-medium text-stone-900 focus:outline-none focus:border-stone-800 shadow-2xs"
            >
              <option value="Semua">Semua Saluran / Sumber</option>
              <option value="Portal Pelanggan">Portal Pelanggan (Layan Diri)</option>
              <option value="Pentadbir">Pentadbir Sistem</option>
              <option value="Import Excel">Import Excel</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Logs Table Card */}
      <div className="bg-[#FAF9F6] border border-stone-300 rounded-2xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#1A1A1A] text-white border-b border-stone-800 font-serif-heading">
                <th className="py-3.5 px-4 font-bold">Tarikh & Masa</th>
                <th className="py-3.5 px-4 font-bold">No. Akaun & Nama</th>
                <th className="py-3.5 px-4 font-bold">Perubahan No. Telefon</th>
                <th className="py-3.5 px-4 font-bold">Perubahan Alamat Email</th>
                <th className="py-3.5 px-4 font-bold">Status Hadiah Penghargaan (1x Sahaja)</th>
                <th className="py-3.5 px-4 font-bold">Sumber</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 bg-white">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-stone-400 font-serif italic">
                    <div className="max-w-sm mx-auto space-y-2">
                      <Gift className="w-8 h-8 text-stone-300 mx-auto" />
                      <p>Belum ada rekod log kemaskini atau padanan carian untuk dipaparkan.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log, index) => {
                  const phoneChanged = log.oldPhone !== log.newPhone;
                  const emailChanged = log.oldEmail !== log.newEmail;
                  const isClaimed = log.rewardClaimed || log.rewardStatus === 'Telah Dituntut';

                  return (
                    <tr key={`log_${log.id}_${index}`} className="hover:bg-[#FAF8F5] transition-colors">
                      {/* Timestamp */}
                      <td className="py-3 px-4 font-mono text-stone-600 whitespace-nowrap align-top">
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <Clock className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          <span>{log.timestamp}</span>
                        </div>
                      </td>

                      {/* Account No & Customer Name */}
                      <td className="py-3 px-4 whitespace-nowrap align-top">
                        <div className="space-y-1">
                          <button
                            onClick={() => onSelectAccount && onSelectAccount(log.noAkaun)}
                            className="font-mono font-bold text-stone-900 bg-stone-100 hover:bg-stone-200 px-2 py-0.5 rounded border border-stone-300 transition-colors inline-block cursor-pointer"
                            title="Klik untuk buka profil akaun"
                          >
                            {log.noAkaun}
                          </button>
                          <div className="font-serif-heading font-bold text-stone-950 text-xs">
                            {log.nama}
                          </div>
                        </div>
                      </td>

                      {/* Phone changes */}
                      <td className="py-3 px-4 font-mono align-top">
                        {phoneChanged ? (
                          <div className="space-y-1 text-[11px]">
                            <div className="line-through text-stone-400">{log.oldPhone || '(Tiada Rekod)'}</div>
                            <div className="flex items-center gap-1">
                              <ArrowRight className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span className="font-bold text-emerald-950 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-300">
                                {log.newPhone}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-stone-400 text-[11px] italic font-serif">Kekal sama ({log.newPhone})</span>
                        )}
                      </td>

                      {/* Email changes */}
                      <td className="py-3 px-4 font-mono align-top">
                        {emailChanged ? (
                          <div className="space-y-1 text-[11px]">
                            <div className="line-through text-stone-400 truncate max-w-[130px]" title={log.oldEmail}>
                              {log.oldEmail || '(Tiada Rekod)'}
                            </div>
                            <div className="flex items-center gap-1">
                              <ArrowRight className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span className="font-bold text-emerald-950 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-300 truncate max-w-[160px]" title={log.newEmail}>
                                {log.newEmail}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-stone-400 text-[11px] italic font-serif">Kekal sama</span>
                        )}
                      </td>

                      {/* 🎁 REWARD STATUS (Strictly 1x per customer) & GIFT TYPE + REMAINING BALANCE */}
                      <td className="py-3 px-4 align-top">
                        {log.isRewardEligible ? (
                          <div className="space-y-2">
                            {isClaimed ? (
                              <div className="space-y-1.5 bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-200">
                                <div className="flex items-center gap-1 text-emerald-900 font-bold text-[11px]">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                  <span>Hadiah Telah Diserahkan</span>
                                </div>

                                {/* 🎁 Display Chosen Gift Name & Remaining Stock */}
                                <div className="space-y-1 pt-1 border-t border-emerald-200/70 text-[11px]">
                                  <div className="flex items-center gap-1.5 text-stone-900 font-semibold">
                                    <Gift className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                                    <span>Jenis Hadiah:</span>
                                    <span className="text-purple-950 font-bold bg-purple-100 px-1.5 py-0.5 rounded border border-purple-200">
                                      {log.rewardGiftName || 'Hadiah Penghargaan Rasmi'}
                                    </span>
                                  </div>

                                  {typeof log.rewardGiftRemainingStock === 'number' && (
                                    <div className="flex items-center gap-1.5 text-stone-600 text-[10px] font-mono pl-5">
                                      <span>Baki Stok Semasa Diserah:</span>
                                      <span className="font-bold text-stone-900 bg-white px-1.5 py-0.2 rounded border border-stone-300">
                                        {log.rewardGiftRemainingStock} unit
                                      </span>
                                    </div>
                                  )}

                                  {log.rewardClaimedAt && (
                                    <div className="text-[10px] text-stone-500 font-mono pl-5">
                                      Diserah pada: {log.rewardClaimedAt}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 border border-amber-300 text-amber-950 rounded-lg font-bold text-[11px] shadow-2xs">
                                    <Gift className="w-3.5 h-3.5 text-amber-600" />
                                    <span>Layak Hadiah (1x Sahaja)</span>
                                  </span>

                                  {/* 🎁 Click to open Gift Selection Modal */}
                                  {onClaimReward && (
                                    <button
                                      onClick={() => handleOpenClaimModal(log)}
                                      className="px-2.5 py-1 bg-purple-950 hover:bg-black text-white text-[10px] font-bold rounded-lg transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer border border-purple-900 hover:scale-[1.02]"
                                      title="Pilih jenis hadiah daripada inventori untuk diserahkan kepada pelanggan"
                                    >
                                      <Gift className="w-3 h-3 text-amber-400" />
                                      <span>Tanda Hadiah Diberi</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}

                            <div className="text-[10px] font-mono text-stone-500 flex items-center gap-1">
                              <Tag className="w-3 h-3 text-stone-400" />
                              <span>Kod: <strong className="text-stone-800">{log.rewardCode || `GIFT-${log.noAkaun}`}</strong></span>
                            </div>
                          </div>
                        ) : log.rewardStatus === 'Kemaskini Ulangan (Hadiah Sudah Diberi)' ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-stone-100 border border-stone-300 text-stone-700 rounded-md font-medium text-[10px]">
                              <span>🔁 Kemaskini Ulangan</span>
                            </span>
                            <p className="text-[10px] text-stone-500 font-serif leading-tight">
                              (Hadiah telah diberikan pada kemaskini kali pertama)
                            </p>
                          </div>
                        ) : (
                          <span className="text-stone-400 text-[10px] font-serif italic">-</span>
                        )}
                      </td>

                      {/* Source */}
                      <td className="py-3 px-4 whitespace-nowrap align-top">
                        <span className="bg-stone-100 text-stone-800 text-[10px] font-mono font-semibold px-2 py-0.5 rounded border border-stone-300">
                          {log.source}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 🎁 Modal: Pilih Jenis Hadiah Penghargaan */}
      <GiftClaimModal
        isOpen={!!activeClaimLog}
        onClose={handleCloseClaimModal}
        recipient={activeClaimLog ? {
          noAkaun: activeClaimLog.noAkaun,
          nama: activeClaimLog.nama,
          rewardCode: activeClaimLog.rewardCode || `GIFT-${activeClaimLog.noAkaun}`,
          noTel: activeClaimLog.newPhone,
        } : null}
        onConfirmClaim={handleConfirmClaimWithGift}
      />
    </div>
  );
};
