import React, { useState, useMemo, useRef } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  Plus, 
  UploadCloud, 
  FileSpreadsheet, 
  Lock, 
  Edit3, 
  Phone, 
  Mail, 
  CreditCard, 
  CheckCircle, 
  ExternalLink, 
  Clock, 
  FileText, 
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Zap,
  Trash2,
  Crown,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { CustomerAccount } from '../types';
import { exportAccountsToExcel, parseAccountsExcel, downloadExcelTemplate } from '../utils/excelHelper';
import { generateProfileSummaryPDF } from '../utils/pdfReceiptHelper';
import { useToast } from '../context/ToastContext';
import { buildAccountSearchIndex, fastFilterDirectory } from '../utils/searchEngine';
import { ExcelTemplateModal } from './ExcelTemplateModal';

interface AccountDirectoryViewProps {
  accounts: CustomerAccount[];
  onSelectAccountForLookup: (acc: CustomerAccount) => void;
  onAddAccount: (acc: CustomerAccount) => void;
  onImportAccounts: (accounts: CustomerAccount[]) => void;
  onClearAllAccounts?: () => void;
  onClaimReward?: (noAkaun: string) => void;
  isSuperAdmin?: boolean;
  onRequireSuperAdmin?: () => void;
}

export const AccountDirectoryView: React.FC<AccountDirectoryViewProps> = ({
  accounts,
  onSelectAccountForLookup,
  onAddAccount,
  onImportAccounts,
  onClearAllAccounts,
  onClaimReward,
  isSuperAdmin = false,
  onRequireSuperAdmin,
}) => {
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Semua');
  const [categoryFilter, setCategoryFilter] = useState<string>('Semua');
  const [updateFilter, setUpdateFilter] = useState<'Semua' | 'Dikemaskini' | 'Asal' | 'LayakHadiah' | 'HadiahDitebus'>('Semua');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(100);

  // Reset page when filter or search changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, categoryFilter, updateFilter, pageSize]);

  // New Account modal state
  const [newNoAkaun, setNewNoAkaun] = useState('');
  const [newNama, setNewNama] = useState('');
  const [newIC, setNewIC] = useState('');
  const [newKategori, setNewKategori] = useState('Kediaman');
  const [newNoTel, setNewNoTel] = useState('');
  const [newEmail, setNewEmail] = useState('');

  // ⚡ Fast in-memory search index
  const searchIndex = useMemo(() => {
    return buildAccountSearchIndex(accounts);
  }, [accounts]);

  // Statistics on updated accounts & rewards
  const stats = useMemo(() => {
    const updated = accounts.filter((a) => a.telahDikemaskini).length;
    const original = accounts.length - updated;
    const eligibleReward = accounts.filter((a) => a.rewardStatus === 'Layak (Belum Dituntut)').length;
    const claimedReward = accounts.filter((a) => a.rewardStatus === 'Telah Dituntut').length;
    return { updated, original, total: accounts.length, eligibleReward, claimedReward };
  }, [accounts]);

  // Ultra-fast filter via indexed tokens
  const filteredAccounts = useMemo(() => {
    return fastFilterDirectory(searchIndex, search, statusFilter, categoryFilter, updateFilter);
  }, [searchIndex, search, statusFilter, categoryFilter, updateFilter]);

  // Paginated records for instantaneous 60fps rendering
  const totalFilteredCount = filteredAccounts.length;
  const totalPages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(totalFilteredCount / pageSize));

  const displayedAccounts = useMemo(() => {
    if (pageSize === -1) return filteredAccounts;
    const startIndex = (currentPage - 1) * pageSize;
    return filteredAccounts.slice(startIndex, startIndex + pageSize);
  }, [filteredAccounts, currentPage, pageSize]);

  // Handle Excel Import
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleImportDirectFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImportDirectFile = async (file: File) => {
    try {
      const result = await parseAccountsExcel(file);
      if (result.accounts.length > 0) {
        onImportAccounts(result.accounts);
        showSuccess('Import Excel Berjaya', `Sebanyak ${result.accounts.length} rekod akaun telah dimasukkan ke dalam direktori.`);
      } else {
        showError('Fail Excel Kosong', 'Tiada rekod data akaun yang sah dijumpai dalam fail tersebut.');
      }
    } catch {
      showError('Ralat Bacaan Fail', 'Gagal membaca fail Excel. Sila pastikan format fail adalah .xlsx, .xls atau .csv yang sah.');
    }
  };

  const handleCreateAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNo = newNoAkaun.trim().toUpperCase();
    const cleanNama = newNama.trim();

    if (!cleanNo || !cleanNama) {
      showWarning('Maklumat Tidak Lengkap', 'Sila lengkapkan Nombor Akaun dan Nama Pemilik.');
      return;
    }

    // Check duplicate
    if (accounts.some((a) => a.noAkaun.toUpperCase() === cleanNo)) {
      showError('No. Akaun Telah Wujud', `Akaun dengan nombor "${cleanNo}" telah pun didaftarkan.`);
      return;
    }

    const newAcc: CustomerAccount = {
      noAkaun: cleanNo,
      nama: cleanNama,
      kadPengenalan: newIC.trim(),
      kategoriAkaun: newKategori,
      noTel: newNoTel.trim(),
      email: newEmail.trim(),
      status: 'Aktif',
      tarikhDaftar: new Date().toISOString().slice(0, 10),
      lastUpdated: new Date().toISOString().replace('T', ' ').slice(0, 16),
      kemaskiniOleh: 'Pentadbir Sistem',
    };

    onAddAccount(newAcc);
    showSuccess('Akaun Baru Didaftarkan', `Akaun ${newAcc.noAkaun} (${newAcc.nama}) berjaya didaftarkan ke dalam direktori.`);
    setShowAddModal(false);
    // Reset form
    setNewNoAkaun('');
    setNewNama('');
    setNewIC('');
    setNewNoTel('');
    setNewEmail('');
  };

  const handleClaimRewardClick = (noAkaun: string, nama: string) => {
    if (onClaimReward) {
      onClaimReward(noAkaun);
      showSuccess(
        'Hadiah Berjaya Diberi',
        `Hadiah penghargaan bagi akaun ${noAkaun} (${nama}) telah ditandakan sebagai Telah Dituntut.`
      );
    }
  };

  const handleExportExcel = () => {
    if (accounts.length === 0) {
      showWarning('Pangkalan Data Kosong', 'Tiada rekod data akaun untuk dieksport.');
      return;
    }
    exportAccountsToExcel(accounts, 'xlsx');
    showSuccess('Eksport Direktori Berjaya', `Sebanyak ${accounts.length} rekod akaun telah dimuat turun ke fail Excel (.xlsx).`);
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Actions Bar */}
      <div className="bg-[#FAF9F6] border border-stone-300 rounded-2xl p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-stone-100 text-stone-700 text-[10px] font-mono uppercase px-2 py-0.5 rounded border border-stone-300">
                Pangkalan Data
              </span>
              <span className="text-xs text-stone-500 font-serif">
                Senarai Lengkap {accounts.length} Akaun Berdaftar
              </span>
            </div>
            <h2 className="text-xl font-serif-heading font-bold text-stone-900">
              Direktori Akaun & Status Profil
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportFile}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />
            
            {/* Templat Excel Button */}
            <button
              onClick={() => setShowTemplateModal(true)}
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-950 rounded-xl text-xs font-semibold border border-emerald-300 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="Lihat & muat turun templat Excel (.xlsx / .csv) rasmi dengan lajur standard"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>Templat Excel</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 bg-white hover:bg-stone-100 text-stone-800 rounded-xl text-xs font-semibold border border-stone-300 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <UploadCloud className="w-4 h-4 text-stone-600" />
              <span>Import Excel</span>
            </button>
            <button
              onClick={handleExportExcel}
              disabled={accounts.length === 0}
              className="px-3 py-2 bg-white hover:bg-stone-100 disabled:opacity-50 disabled:cursor-not-allowed text-stone-800 rounded-xl text-xs font-semibold border border-stone-300 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Download className="w-4 h-4 text-stone-600" />
              <span>Eksport Excel</span>
            </button>
            <button
              onClick={() => {
                setNewNoAkaun(`1611${Math.floor(100000000 + Math.random() * 900000000)}`);
                setShowAddModal(true);
              }}
              className="px-4 py-2 bg-[#1A1A1A] hover:bg-black text-white rounded-xl text-xs font-bold shadow-2xs transition-colors flex items-center gap-1.5 border border-stone-800 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Daftar Akaun Baru</span>
            </button>
            {accounts.length > 0 && onClearAllAccounts && (
              isSuperAdmin ? (
                <button
                  onClick={onClearAllAccounts}
                  className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-xs font-semibold border border-red-200 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  title="Padam semua data akaun & log audit (Akses Penuh Super Admin)"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-600" />
                  <span>Kosongkan Data</span>
                  <span className="text-[9px] bg-red-100/90 text-red-800 border border-red-200 px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider flex items-center gap-1">
                    <Crown className="w-2.5 h-2.5 text-amber-600" />
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
                        'Fungsi Kosongkan Data hanya boleh dilaksanakan oleh Super Admin sahaja.'
                      );
                    }
                  }}
                  className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-xl text-xs font-semibold border border-stone-300 transition-colors cursor-pointer flex items-center gap-1.5 opacity-85 shadow-2xs"
                  title="Fungsi Kosongkan Data dikunci — Sila sahkan kata laluan Super Admin"
                >
                  <Lock className="w-3.5 h-3.5 text-stone-500" />
                  <span>Kosongkan Data</span>
                  <Crown className="w-3 h-3 text-amber-500" />
                </button>
              )
            )}
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="mt-4 pt-3 border-t border-stone-200 space-y-3 text-xs">
          {/* Quick Filter Tabs & Visual Legend */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-stone-300 shadow-2xs">
            {/* Status Filter Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-mono text-stone-500 mr-1">Tapis Rekod:</span>
              <button
                onClick={() => setUpdateFilter('Semua')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  updateFilter === 'Semua'
                    ? 'bg-[#1A1A1A] text-white shadow-2xs'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-300'
                }`}
              >
                Semua ({stats.total})
              </button>

              <button
                onClick={() => setUpdateFilter('Dikemaskini')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  updateFilter === 'Dikemaskini'
                    ? 'bg-emerald-800 text-emerald-50 shadow-2xs border border-emerald-900'
                    : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100 border border-emerald-300'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                <span>✨ Dikemaskini ({stats.updated})</span>
              </button>

              <button
                onClick={() => setUpdateFilter('LayakHadiah')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  updateFilter === 'LayakHadiah'
                    ? 'bg-amber-700 text-white shadow-2xs border border-amber-800'
                    : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-300'
                }`}
              >
                <span>🎁 Layak Hadiah ({stats.eligibleReward})</span>
              </button>

              <button
                onClick={() => setUpdateFilter('HadiahDitebus')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  updateFilter === 'HadiahDitebus'
                    ? 'bg-stone-800 text-stone-100 shadow-2xs border border-stone-900'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-300'
                }`}
              >
                <span>✅ Hadiah Diserah ({stats.claimedReward})</span>
              </button>

              <button
                onClick={() => setUpdateFilter('Asal')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  updateFilter === 'Asal'
                    ? 'bg-stone-800 text-stone-100 shadow-2xs border border-stone-900'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-300'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-stone-400"></span>
                <span>⚪ Rekod Asal ({stats.original})</span>
              </button>
            </div>

            {/* Visual Color Legend Explanation */}
            <div className="flex items-center gap-3 text-[11px] font-mono text-stone-600 bg-stone-50 px-3 py-1.5 rounded-lg border border-stone-200 shrink-0">
              <span className="font-bold text-stone-800 font-serif">Petunjuk:</span>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-100 border-2 border-emerald-600 shrink-0"></span>
                <span className="text-emerald-900 font-semibold">Hijau: Dikemaskini</span>
              </div>
              <span className="text-stone-300">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-amber-600 font-bold">🎁</span>
                <span className="text-amber-900 font-semibold">Hadiah 1x Sahaja</span>
              </div>
            </div>
          </div>

          {/* Search Box and Dropdown Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            {/* Search Box (6 cols) */}
            <div className="sm:col-span-6 relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari pantas mengikut No Akaun, Nama, Kad Pengenalan, Telefon..."
                className="w-full pl-9 pr-9 py-2 bg-white border border-stone-300 rounded-xl text-xs font-medium text-stone-900 focus:outline-none focus:border-stone-800 shadow-2xs"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 text-xs p-1 cursor-pointer"
                  aria-label="Padam teks carian"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Status Filter (3 cols) */}
            <div className="sm:col-span-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full p-2 bg-white border border-stone-300 rounded-xl text-xs font-medium text-stone-900 focus:outline-none focus:border-stone-800 shadow-2xs"
              >
                <option value="Semua">Semua Status</option>
                <option value="Aktif">Aktif</option>
                <option value="Tertunggak">Tertunggak</option>
                <option value="Selesai">Selesai</option>
                <option value="Dalam Semakan">Dalam Semakan</option>
              </select>
            </div>

            {/* Category Filter (3 cols) */}
            <div className="sm:col-span-3">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full p-2 bg-white border border-stone-300 rounded-xl text-xs font-medium text-stone-900 focus:outline-none focus:border-stone-800 shadow-2xs"
              >
                <option value="Semua">Semua Kategori</option>
                <option value="Kediaman">Kediaman</option>
                <option value="Komersial">Komersial</option>
                <option value="Perniagaan">Perniagaan</option>
                <option value="Industri">Industri</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Directory Table */}
      <div className="bg-[#FAF9F6] border border-stone-300 rounded-2xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#1A1A1A] text-white border-b border-stone-800 font-serif-heading">
                <th className="py-3 px-4 font-bold">Status Kemaskini</th>
                <th className="py-3 px-4 font-bold">No. Akaun</th>
                <th className="py-3 px-4 font-bold">Nama Pelanggan</th>
                <th className="py-3 px-4 font-bold">No. Kad Pengenalan</th>
                <th className="py-3 px-4 font-bold">
                  <div className="flex items-center gap-1">
                    <span>No. Telefon</span>
                    <span className="text-[10px] bg-stone-800 text-stone-200 px-1 rounded font-mono">Edit</span>
                  </div>
                </th>
                <th className="py-3 px-4 font-bold">
                  <div className="flex items-center gap-1">
                    <span>Email</span>
                    <span className="text-[10px] bg-stone-800 text-stone-200 px-1 rounded font-mono">Edit</span>
                  </div>
                </th>
                <th className="py-3 px-4 font-bold">Status Akaun</th>
                <th className="py-3 px-4 font-bold">Hadiah Penghargaan (1x)</th>
                <th className="py-3 px-4 font-bold text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 bg-white">
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 px-4 text-center">
                    {accounts.length === 0 ? (
                      <div className="max-w-xl mx-auto p-6 bg-[#FAF9F6] border border-stone-300 rounded-2xl shadow-2xs space-y-4">
                        <div className="w-12 h-12 bg-emerald-100 text-emerald-800 rounded-2xl flex items-center justify-center mx-auto border border-emerald-300 shadow-2xs">
                          <FileSpreadsheet className="w-6 h-6 text-emerald-700" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-serif-heading font-bold text-stone-900 text-base">
                            Pangkalan Data Akaun Masih Kosong
                          </h4>
                          <p className="text-xs text-stone-600 font-serif max-w-md mx-auto">
                            Anda boleh memuat turun templat Excel rasmi untuk mengisi maklumat akaun pelanggan anda secara teratur, atau muat naik fail data sedia ada.
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                          <button
                            onClick={() => downloadExcelTemplate('xlsx')}
                            className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer border border-emerald-900"
                          >
                            <Download className="w-4 h-4" />
                            <span>Muat Turun Templat (.xlsx)</span>
                          </button>

                          <button
                            onClick={() => setShowTemplateModal(true)}
                            className="px-3.5 py-2 bg-white hover:bg-stone-100 text-stone-800 rounded-xl text-xs font-semibold border border-stone-300 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                          >
                            <HelpCircle className="w-4 h-4 text-stone-600" />
                            <span>Lihat Panduan & Format Lajur</span>
                          </button>

                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="px-3.5 py-2 bg-white hover:bg-stone-100 text-stone-800 rounded-xl text-xs font-semibold border border-stone-300 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                          >
                            <UploadCloud className="w-4 h-4 text-stone-600" />
                            <span>Import Fail Sedia Ada</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="py-8 space-y-2 text-stone-500 font-serif">
                        <Search className="w-8 h-8 mx-auto text-stone-400" />
                        <p className="font-semibold text-stone-800 text-sm">Tiada Padanan Dijumpai</p>
                        <p className="text-xs">Tiada akaun yang sepadan dengan carian atau tapisan yang dipilih.</p>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                displayedAccounts.map((acc, index) => {
                  const isUpdated = acc.telahDikemaskini;
                  return (
                    <tr
                      key={`acc_dir_${acc.noAkaun}_${index}`}
                      className={`transition-colors ${
                        isUpdated
                          ? 'bg-emerald-50/70 hover:bg-emerald-100/60 border-l-4 border-l-emerald-600'
                          : 'bg-white hover:bg-[#FAF8F5] border-l-4 border-l-transparent'
                      }`}
                    >
                      {/* Status Kemaskini Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isUpdated ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 font-mono font-bold text-[11px] shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                            <span>✨ Dikemaskini</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-stone-100 text-stone-600 border border-stone-300 font-mono text-[11px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-stone-400"></span>
                            <span>Rekod Asal</span>
                          </div>
                        )}
                      </td>

                      {/* No Akaun */}
                      <td className="py-3 px-4 font-mono font-bold whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded border ${
                          isUpdated
                            ? 'bg-emerald-100/80 text-emerald-950 border-emerald-300'
                            : 'bg-stone-100 text-stone-800 border-stone-300'
                        }`}>
                          {acc.noAkaun}
                        </span>
                      </td>

                      {/* Nama */}
                      <td className="py-3 px-4 font-serif-heading font-bold text-stone-950 whitespace-nowrap">
                        {acc.nama}
                      </td>

                      {/* IC (Locked) */}
                      <td className="py-3 px-4 font-mono text-stone-700 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-stone-600">
                          <Lock className="w-3 h-3 text-stone-400" />
                          <span>{acc.kadPengenalan || '-'}</span>
                        </div>
                      </td>

                      {/* No Telefon (Editable - Highlight if updated) */}
                      <td className="py-3 px-4 font-mono font-semibold whitespace-nowrap">
                        {isUpdated ? (
                          <div className="inline-flex items-center gap-1.5 bg-emerald-100/80 text-emerald-950 px-2 py-1 rounded-md border border-emerald-300 font-bold shadow-2xs">
                            <Phone className="w-3.5 h-3.5 text-emerald-700" />
                            <span>{acc.noTel || 'Belum Diisi'}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-stone-900">
                            <Phone className="w-3.5 h-3.5 text-stone-500" />
                            <span>{acc.noTel || 'Belum Diisi'}</span>
                          </div>
                        )}
                      </td>

                      {/* Email (Editable - Highlight if updated) */}
                      <td className="py-3 px-4 font-mono font-semibold whitespace-nowrap">
                        {isUpdated ? (
                          <div className="inline-flex items-center gap-1.5 bg-emerald-100/80 text-emerald-950 px-2 py-1 rounded-md border border-emerald-300 font-bold shadow-2xs">
                            <Mail className="w-3.5 h-3.5 text-emerald-700" />
                            <span className="truncate max-w-[170px]">{acc.email || 'Belum Diisi'}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-stone-900">
                            <Mail className="w-3.5 h-3.5 text-stone-500" />
                            <span className="truncate max-w-[170px]">{acc.email || 'Belum Diisi'}</span>
                          </div>
                        )}
                      </td>

                      {/* Status Akaun */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          acc.status === 'Aktif'
                            ? 'bg-stone-100 text-stone-800 border border-stone-300'
                            : acc.status === 'Tertunggak'
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : 'bg-stone-100 text-stone-700 border border-stone-300'
                        }`}>
                          {acc.status}
                        </span>
                      </td>

                      {/* Status Hadiah (1x) */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {acc.rewardStatus === 'Telah Dituntut' ? (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 font-mono text-[10px] font-bold">
                            <span>✅ Diserah</span>
                          </div>
                        ) : acc.rewardStatus === 'Layak (Belum Dituntut)' ? (
                          <div className="flex items-center gap-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-300 font-bold text-[10px]">
                              <span>🎁 Layak (1x)</span>
                            </span>
                            {onClaimReward && (
                              <button
                                onClick={() => handleClaimRewardClick(acc.noAkaun, acc.nama)}
                                className="px-1.5 py-0.5 bg-stone-900 hover:bg-black text-white rounded text-[10px] font-bold transition-colors cursor-pointer"
                                title="Tandakan hadiah telah diserahkan"
                              >
                                Tanda Diserah
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-stone-400 text-[10px] italic font-serif">Belum Kemaskini</span>
                        )}
                      </td>

                      {/* Tindakan */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => generateProfileSummaryPDF(acc)}
                            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                              isUpdated
                                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                                : 'bg-stone-100 hover:bg-stone-200 text-stone-600 border-stone-300'
                            }`}
                            title="Muat Turun Resit Profil (PDF)"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onSelectAccountForLookup(acc)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1 shadow-2xs border ${
                              isUpdated
                                ? 'bg-emerald-800 hover:bg-emerald-900 text-white border-emerald-900'
                                : 'bg-[#1A1A1A] hover:bg-black text-white border-stone-800'
                            }`}
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Buka Portal</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 📑 Dynamic Pagination Footer */}
        {totalFilteredCount > 0 && (
          <div className="bg-[#FAF9F6] border-t border-stone-300 p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-stone-600 font-mono text-[11px]">
              <span>Memaparkan <strong className="text-stone-900 font-bold">{Math.min(totalFilteredCount, (currentPage - 1) * (pageSize === -1 ? totalFilteredCount : pageSize) + 1)}</strong> - <strong className="text-stone-900 font-bold">{pageSize === -1 ? totalFilteredCount : Math.min(totalFilteredCount, currentPage * pageSize)}</strong> daripada <strong className="text-stone-900 font-bold">{totalFilteredCount.toLocaleString()}</strong> rekod</span>
              {search && (
                <span className="bg-stone-200 text-stone-800 px-1.5 py-0.5 rounded font-mono text-[10px]">
                  Ditapis daripada {accounts.length.toLocaleString()}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Page size selector */}
              <div className="flex items-center gap-1.5 text-stone-600">
                <span className="text-[11px] font-mono">Saiz:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="bg-white border border-stone-300 rounded-lg px-2 py-1 text-xs font-mono font-bold text-stone-900 focus:outline-none focus:border-stone-800 cursor-pointer shadow-2xs"
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={250}>250</option>
                  <option value={500}>500</option>
                  <option value={-1}>Semua</option>
                </select>
              </div>

              {/* Navigation buttons */}
              {pageSize !== -1 && totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="p-1.5 bg-white border border-stone-300 hover:bg-stone-100 disabled:opacity-40 disabled:hover:bg-white rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed shadow-2xs"
                    title="Halaman Pertama"
                  >
                    <ChevronsLeft className="w-3.5 h-3.5 text-stone-700" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 bg-white border border-stone-300 hover:bg-stone-100 disabled:opacity-40 disabled:hover:bg-white rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed shadow-2xs"
                    title="Halaman Sebelumnya"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 text-stone-700" />
                  </button>

                  <span className="px-2 font-mono text-xs font-bold text-stone-800">
                    {currentPage} / {totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 bg-white border border-stone-300 hover:bg-stone-100 disabled:opacity-40 disabled:hover:bg-white rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed shadow-2xs"
                    title="Halaman Seterusnya"
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-stone-700" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="p-1.5 bg-white border border-stone-300 hover:bg-stone-100 disabled:opacity-40 disabled:hover:bg-white rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed shadow-2xs"
                    title="Halaman Terakhir"
                  >
                    <ChevronsRight className="w-3.5 h-3.5 text-stone-700" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add New Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-[#FAF9F6] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-stone-300">
            <div className="p-4 bg-[#1A1A1A] text-white flex items-center justify-between border-b border-stone-800">
              <h3 className="font-serif-heading font-bold text-sm">Daftar Rekod Akaun Pelanggan Baru</h3>
              <button onClick={() => setShowAddModal(false)} className="text-stone-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleCreateAccountSubmit} className="p-5 space-y-3.5 text-xs bg-white">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-stone-800 block mb-1">No. Akaun (Kunci Unik)</label>
                  <input
                    type="text"
                    required
                    value={newNoAkaun}
                    onChange={(e) => setNewNoAkaun(e.target.value)}
                    className="w-full p-2 bg-[#FAF9F6] border border-stone-300 rounded-xl font-mono font-bold text-stone-900"
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-800 block mb-1">Kategori Akaun</label>
                  <select
                    value={newKategori}
                    onChange={(e) => setNewKategori(e.target.value)}
                    className="w-full p-2 bg-[#FAF9F6] border border-stone-300 rounded-xl"
                  >
                    <option value="Kediaman">Kediaman</option>
                    <option value="Komersial">Komersial</option>
                    <option value="Perniagaan">Perniagaan</option>
                    <option value="Industri">Industri</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-stone-800 block mb-1">Nama Penuh</label>
                  <input
                    type="text"
                    required
                    value={newNama}
                    onChange={(e) => setNewNama(e.target.value)}
                    placeholder="Ali bin Abu"
                    className="w-full p-2 bg-[#FAF9F6] border border-stone-300 rounded-xl font-serif-heading"
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-800 block mb-1">No. Kad Pengenalan (IC)</label>
                  <input
                    type="text"
                    value={newIC}
                    onChange={(e) => setNewIC(e.target.value)}
                    placeholder="800101-01-XXXX"
                    className="w-full p-2 bg-[#FAF9F6] border border-stone-300 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-stone-800 block mb-1">Nombor Telefon</label>
                  <input
                    type="tel"
                    value={newNoTel}
                    onChange={(e) => setNewNoTel(e.target.value)}
                    placeholder="012-3456789"
                    className="w-full p-2 bg-[#FAF9F6] border border-stone-300 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-800 block mb-1">Alamat Email</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="ali@email.com"
                    className="w-full p-2 bg-[#FAF9F6] border border-stone-300 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-xl font-semibold border border-stone-300"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1A1A1A] hover:bg-black text-white rounded-xl font-bold border border-stone-800 shadow-2xs"
                >
                  Simpan Rekod Akaun
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Templat Excel Rasmi & Panduan Lajur */}
      <ExcelTemplateModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        onImportFile={handleImportDirectFile}
      />
    </div>
  );
};
