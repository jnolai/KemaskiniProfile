import React, { useState, useMemo } from 'react';
import { 
  History, 
  Search, 
  FileSpreadsheet, 
  ArrowRight, 
  Phone, 
  Mail, 
  Clock, 
  ShieldCheck,
  CheckCircle2,
  Filter,
  Gift,
  Award,
  Sparkles,
  Check,
  Tag,
  AlertCircle
} from 'lucide-react';
import { ProfileUpdateAuditLog } from '../types';
import { exportAuditLogsToExcel } from '../utils/excelHelper';
import { useToast } from '../context/ToastContext';

interface AuditLogsViewProps {
  logs: ProfileUpdateAuditLog[];
  onSelectAccount?: (noAkaun: string) => void;
  onClaimReward?: (noAkaun: string) => void;
}

export const AuditLogsView: React.FC<AuditLogsViewProps> = ({ logs, onSelectAccount, onClaimReward }) => {
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('Semua');
  const [rewardFilter, setRewardFilter] = useState('Semua');
  const [rewardClaimSuccessMsg, setRewardClaimSuccessMsg] = useState<string | null>(null);

  // Calculate Reward & Log Statistics
  const stats = useMemo(() => {
    const totalLogs = logs.length;
    // Count unique accounts that became eligible
    const eligibleLogs = logs.filter((l) => l.isRewardEligible);
    const uniqueEligibleAccounts = new Set(eligibleLogs.map((l) => l.noAkaun)).size;
    const claimedLogs = logs.filter((l) => l.rewardClaimed || l.rewardStatus === 'Telah Dituntut');
    const uniqueClaimedAccounts = new Set(claimedLogs.map((l) => l.noAkaun)).size;
    const pendingRewards = Math.max(0, uniqueEligibleAccounts - uniqueClaimedAccounts);

    return {
      totalLogs,
      uniqueEligibleAccounts,
      uniqueClaimedAccounts,
      pendingRewards,
    };
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return logs.filter((log) => {
      const matchSearch =
        !q ||
        log.noAkaun.toLowerCase().includes(q) ||
        log.nama.toLowerCase().includes(q) ||
        log.newPhone.toLowerCase().includes(q) ||
        log.newEmail.toLowerCase().includes(q) ||
        (log.rewardCode && log.rewardCode.toLowerCase().includes(q));

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

  const handleClaim = (noAkaun: string, nama: string) => {
    if (onClaimReward) {
      onClaimReward(noAkaun);
      const msg = `✅ Hadiah penghargaan untuk akaun ${noAkaun} (${nama}) berjaya ditandakan sebagai Telah Diserahkan.`;
      setRewardClaimSuccessMsg(msg);
      showSuccess(
        'Penyerahan Hadiah Disahkan',
        `Hadiah penghargaan untuk akaun ${noAkaun} (${nama}) telah ditandakan sebagai diserah / ditebus.`
      );
      setTimeout(() => setRewardClaimSuccessMsg(null), 4000);
    }
  };

  const handleExportLogs = () => {
    if (logs.length === 0) {
      showWarning('Tiada Log', 'Tiada rekod log transaksi untuk dieksport.');
      return;
    }
    exportAuditLogsToExcel(logs);
    showSuccess('Eksport Log Selesai', `Sebanyak ${logs.length} rekod audit log telah dieksport ke fail Excel (.xlsx).`);
  };

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
              Setiap pelanggan yang berjaya mengemaskini maklumat profil layak menerima hadiah penghargaan (terhad 1 kali sahaja setiap akaun).
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
            <button
              onClick={handleExportLogs}
              disabled={logs.length === 0}
              className="px-4 py-2.5 bg-[#1A1A1A] hover:bg-black disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-2xs transition-colors flex items-center gap-2 border border-stone-800 cursor-pointer disabled:cursor-not-allowed"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Eksport Laporan Hadiah & Log (.xlsx)</span>
            </button>
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
              placeholder="Cari mengikut No Akaun, Nama, Tel, Email, Kod Hadiah..."
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

                      {/* 🎁 REWARD STATUS (Strictly 1x per customer) */}
                      <td className="py-3 px-4 align-top">
                        {log.isRewardEligible ? (
                          <div className="space-y-1.5">
                            {isClaimed ? (
                              <div className="inline-flex flex-col gap-0.5">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-lg font-bold text-[11px]">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                                  <span>Hadiah Telah Diserahkan</span>
                                </span>
                                {log.rewardClaimedAt && (
                                  <span className="text-[10px] text-stone-500 font-mono pl-1">
                                    Diserah: {log.rewardClaimedAt}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 border border-amber-300 text-amber-950 rounded-lg font-bold text-[11px] shadow-2xs">
                                  <Gift className="w-3.5 h-3.5 text-amber-600" />
                                  <span>Layak Hadiah (1x Sahaja)</span>
                                </span>

                                {onClaimReward && (
                                  <button
                                    onClick={() => handleClaim(log.noAkaun, log.nama)}
                                    className="px-2.5 py-1 bg-stone-900 hover:bg-black text-white text-[10px] font-bold rounded-lg transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                                    title="Sahkan penyerahan hadiah penghargaan kepada pelanggan"
                                  >
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    <span>Tanda Hadiah Diberi</span>
                                  </button>
                                )}
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
    </div>
  );
};
