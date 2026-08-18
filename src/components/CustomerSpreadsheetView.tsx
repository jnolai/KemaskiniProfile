import React, { useState, useMemo, useRef } from 'react';
import { 
  FileSpreadsheet, 
  UploadCloud, 
  Download, 
  Lock, 
  Edit3, 
  Check, 
  RefreshCw, 
  Phone, 
  Mail, 
  ShieldCheck,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Zap,
  Trash2,
  Crown
} from 'lucide-react';
import { CustomerAccount } from '../types';
import { exportAccountsToExcel, parseAccountsExcel, downloadExcelTemplate } from '../utils/excelHelper';
import { useToast } from '../context/ToastContext';
import { buildAccountSearchIndex, fastFilterDirectory } from '../utils/searchEngine';
import { ExcelTemplateModal } from './ExcelTemplateModal';

interface CustomerSpreadsheetViewProps {
  accounts: CustomerAccount[];
  onUpdateAccount: (updated: CustomerAccount, changedFields: string[], oldPhone: string, oldEmail: string) => void;
  onImportAccounts: (imported: CustomerAccount[]) => void;
  onClearAllAccounts?: () => void;
  isSuperAdmin?: boolean;
  onRequireSuperAdmin?: () => void;
}

export const CustomerSpreadsheetView: React.FC<CustomerSpreadsheetViewProps> = ({
  accounts,
  onUpdateAccount,
  onImportAccounts,
  onClearAllAccounts,
  isSuperAdmin = false,
  onRequireSuperAdmin,
}) => {
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingKey, setEditingKey] = useState<{ noAkaun: string; field: 'noTel' | 'email' } | null>(null);
  const [tempValue, setTempValue] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'Semua' | 'Dikemaskini' | 'Asal'>('Semua');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(100);

  // Reset page on search or filter change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterMode, pageSize]);

  // Fast search index
  const searchIndex = useMemo(() => {
    return buildAccountSearchIndex(accounts);
  }, [accounts]);

  const stats = useMemo(() => {
    const updated = accounts.filter((a) => a.telahDikemaskini).length;
    const original = accounts.length - updated;
    return { updated, original, total: accounts.length };
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    return fastFilterDirectory(searchIndex, searchQuery, 'Semua', 'Semua', filterMode);
  }, [searchIndex, searchQuery, filterMode]);

  const totalFilteredCount = filteredAccounts.length;
  const totalPages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(totalFilteredCount / pageSize));

  const displayedAccounts = useMemo(() => {
    if (pageSize === -1) return filteredAccounts;
    const startIndex = (currentPage - 1) * pageSize;
    return filteredAccounts.slice(startIndex, startIndex + pageSize);
  }, [filteredAccounts, currentPage, pageSize]);

  const startEdit = (acc: CustomerAccount, field: 'noTel' | 'email') => {
    setEditingKey({ noAkaun: acc.noAkaun, field });
    setTempValue(acc[field]);
  };

  const handleCellBlurOrEnter = (acc: CustomerAccount) => {
    if (!editingKey) return;
    const { field } = editingKey;
    const trimmed = tempValue.trim();

    if (trimmed !== acc[field]) {
      const oldPhone = acc.noTel;
      const oldEmail = acc.email;
      const updated: CustomerAccount = {
        ...acc,
        [field]: trimmed,
        telahDikemaskini: true,
        lastUpdated: new Date().toISOString().replace('T', ' ').slice(0, 16),
        kemaskiniOleh: 'Spreadsheet Editor',
      };
      onUpdateAccount(updated, [field === 'noTel' ? 'No Telefon' : 'Alamat Email'], oldPhone, oldEmail);
      const fieldLabel = field === 'noTel' ? 'No. Telefon' : 'Alamat Email';
      setFeedback(`✨ Akaun ${acc.noAkaun} (${fieldLabel}) berjaya disimpan dan diwarnakan.`);
      showSuccess('Sel Disimpan', `${fieldLabel} bagi akaun ${acc.noAkaun} berjaya dikemaskini.`);
      setTimeout(() => setFeedback(null), 3500);
    }
    setEditingKey(null);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await parseAccountsExcel(file);
      if (result.accounts.length > 0) {
        onImportAccounts(result.accounts);
        setFeedback(`${result.accounts.length} rekod akaun berjaya diimport daripada Excel.`);
        showSuccess('Import Excel Berjaya', `Sebanyak ${result.accounts.length} rekod akaun telah dimasukkan ke pangkalan data helaian.`);
        setTimeout(() => setFeedback(null), 3000);
      } else {
        showError('Fail Kosong', 'Tiada rekod data akaun yang sah dijumpai dalam fail tersebut.');
      }
    } catch {
      showError('Ralat Bacaan Fail', 'Gagal membaca fail Excel. Sila pastikan format fail adalah .xlsx, .xls atau .csv yang sah.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExportClick = () => {
    if (accounts.length === 0) {
      showWarning('Pangkalan Data Kosong', 'Tiada rekod akaun untuk dieksport.');
      return;
    }
    exportAccountsToExcel(accounts, 'xlsx');
    showSuccess('Eksport Berjaya', `Sebanyak ${accounts.length} rekod akaun telah dieksport ke format Excel (.xlsx).`);
  };

  return (
    <div className="space-y-4">
      {/* Banner */}
      <div className="bg-[#FAF9F6] border border-stone-300 rounded-2xl p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-stone-900 text-white text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded tracking-wider">
                Paparan Spreadsheet Helaian
              </span>
              <span className="text-xs text-stone-500 font-serif">
                Penyelarasan Terus Format Google Sheets / Excel
              </span>
            </div>
            <h2 className="text-xl font-serif-heading font-bold text-stone-900">
              Pangkalan Data Helaian Akaun Pelanggan
            </h2>
            <p className="text-xs text-stone-600 mt-1">
              Klik pada sel bertanda <span className="font-semibold text-stone-900">✏️ No. Tel</span> atau <span className="font-semibold text-stone-900">✏️ Email</span> untuk menyunting secara terus. Rekod yang dikemaskini akan <strong className="text-emerald-900 font-bold">diwarnakan hijau zamrud</strong> secara automatik.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportFile}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />
            <button
              onClick={() => setShowTemplateModal(true)}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-950 rounded-xl text-xs font-semibold border border-emerald-300 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="Lihat & muat turun format templat Excel standard"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>Templat Excel</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2 bg-white hover:bg-stone-100 text-stone-800 rounded-xl text-xs font-semibold border border-stone-300 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <UploadCloud className="w-4 h-4 text-stone-600" />
              <span>Import Excel</span>
            </button>
            <button
              onClick={handleExportClick}
              className="px-3.5 py-2 bg-[#1A1A1A] hover:bg-black text-white rounded-xl text-xs font-bold shadow-2xs transition-colors flex items-center gap-1.5 border border-stone-800 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Muat Turun .XLSX</span>
            </button>
            {accounts.length > 0 && onClearAllAccounts && (
              isSuperAdmin ? (
                <button
                  onClick={onClearAllAccounts}
                  className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-xs font-semibold border border-red-200 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  title="Padam semua data akaun & log audit (Akses Khas Super Admin)"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-600" />
                  <span>Kosongkan Data ({accounts.length.toLocaleString()})</span>
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

        {/* Legend and Filter Bar */}
        <div className="mt-4 pt-3 border-t border-stone-200 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* Fast search input */}
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari pantas dalam helaian..."
                className="w-full pl-8 pr-7 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-mono text-stone-900 focus:outline-none focus:border-stone-800 shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 text-xs p-0.5 cursor-pointer"
                  aria-label="Padam carian"
                >
                  ✕
                </button>
              )}
            </div>

            <span className="text-stone-300 hidden md:inline">|</span>

            <span className="text-stone-500 font-mono text-[11px] mr-0.5">Tapis:</span>
            <button
              onClick={() => setFilterMode('Semua')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filterMode === 'Semua'
                  ? 'bg-stone-900 text-white shadow-2xs'
                  : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-300'
              }`}
            >
              Semua ({stats.total})
            </button>
            <button
              onClick={() => setFilterMode('Dikemaskini')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                filterMode === 'Dikemaskini'
                  ? 'bg-emerald-800 text-emerald-50 shadow-2xs border border-emerald-900'
                  : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100 border border-emerald-300'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
              <span>✨ Telah Dikemaskini ({stats.updated})</span>
            </button>
            <button
              onClick={() => setFilterMode('Asal')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                filterMode === 'Asal'
                  ? 'bg-stone-800 text-stone-100 shadow-2xs border border-stone-900'
                  : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-300'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-stone-400"></span>
              <span>⚪ Asal ({stats.original})</span>
            </button>
          </div>

          <div className="flex items-center gap-3 text-[11px] font-mono bg-white px-3 py-1.5 rounded-lg border border-stone-200">
            <span className="font-bold text-stone-800 font-serif">Petunjuk:</span>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-100 border-2 border-emerald-600 shrink-0"></span>
              <span className="text-emerald-900 font-semibold">Hijau: Dikemaskini</span>
            </div>
            <span className="text-stone-300">|</span>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-stone-50 border border-stone-300 shrink-0"></span>
              <span className="text-stone-600">Neutral: Rekod Asal</span>
            </div>
          </div>
        </div>

        {feedback && (
          <div className="mt-3 p-2.5 bg-emerald-100 text-emerald-950 border border-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
            <Check className="w-4 h-4 text-emerald-700" />
            <span>{feedback}</span>
          </div>
        )}
      </div>

      {/* Spreadsheet Grid */}
      <div className="bg-[#FAF9F6] border border-stone-300 rounded-2xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#1A1A1A] text-white border-b border-stone-800 font-serif-heading">
                <th className="py-3 px-3 w-10 text-center text-stone-400 font-mono text-[10px]">#</th>
                <th className="py-3 px-3 font-bold">Status Fail</th>
                <th className="py-3 px-3 font-bold">
                  <div className="flex items-center gap-1">
                    <span>No Akaun</span>
                    <Lock className="w-2.5 h-2.5 text-stone-400" />
                  </div>
                </th>
                <th className="py-3 px-3 font-bold">
                  <div className="flex items-center gap-1">
                    <span>Nama Pelanggan</span>
                    <Lock className="w-2.5 h-2.5 text-stone-400" />
                  </div>
                </th>
                <th className="py-3 px-3 font-bold">
                  <div className="flex items-center gap-1">
                    <span>No. Kad Pengenalan</span>
                    <Lock className="w-2.5 h-2.5 text-stone-400" />
                  </div>
                </th>
                <th className="py-3 px-3 font-bold bg-stone-800 text-white">
                  <div className="flex items-center gap-1">
                    <Edit3 className="w-3 h-3 text-emerald-400" />
                    <span>No. Telefon (Boleh Sunting)</span>
                  </div>
                </th>
                <th className="py-3 px-3 font-bold bg-stone-800 text-white">
                  <div className="flex items-center gap-1">
                    <Edit3 className="w-3 h-3 text-emerald-400" />
                    <span>Email (Boleh Sunting)</span>
                  </div>
                </th>
                <th className="py-3 px-3 font-bold">Status</th>
                <th className="py-3 px-3 font-bold">Kemaskini Terakhir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 bg-white">
              {displayedAccounts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-stone-400 font-serif italic">
                    Tiada akaun untuk padanan tapisan ini.
                  </td>
                </tr>
              ) : (
                displayedAccounts.map((acc, index) => {
                  const isEditingPhone = editingKey?.noAkaun === acc.noAkaun && editingKey?.field === 'noTel';
                  const isEditingEmail = editingKey?.noAkaun === acc.noAkaun && editingKey?.field === 'email';
                  const isUpdated = acc.telahDikemaskini;

                  return (
                    <tr
                      key={`sheet_row_${acc.noAkaun}_${index}`}
                      className={`transition-colors ${
                        isUpdated
                          ? 'bg-emerald-50/60 hover:bg-emerald-100/50 border-l-4 border-l-emerald-600'
                          : 'bg-white hover:bg-[#FAF8F5] border-l-4 border-l-transparent'
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center text-stone-400 text-[10px] bg-stone-50/80 border-r border-stone-200">
                        {index + 1}
                      </td>

                      {/* Status Fail Pill */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {isUpdated ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-[10px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                            <span>✨ Dikemaskini</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-300 text-[10px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-stone-400"></span>
                            <span>Asal</span>
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 font-bold whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded border ${
                          isUpdated
                            ? 'bg-emerald-100/80 text-emerald-950 border-emerald-300'
                            : 'bg-stone-50 text-stone-900 border-stone-200'
                        }`}>
                          {acc.noAkaun}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 font-serif font-bold text-stone-900 whitespace-nowrap">
                        {acc.nama}
                      </td>

                      <td className="py-2.5 px-3 text-stone-600 whitespace-nowrap">
                        {acc.kadPengenalan}
                      </td>

                      {/* Editable Phone Cell */}
                      <td 
                        onClick={() => !isEditingPhone && startEdit(acc, 'noTel')}
                        className={`py-2.5 px-3 cursor-pointer transition-colors border-x border-stone-200 font-bold ${
                          isUpdated
                            ? 'bg-emerald-100/80 hover:bg-emerald-200/80 text-emerald-950'
                            : 'bg-stone-50 hover:bg-stone-100 text-stone-950'
                        }`}
                      >
                        {isEditingPhone ? (
                          <input
                            autoFocus
                            type="text"
                            value={tempValue}
                            onChange={(e) => setTempValue(e.target.value)}
                            onBlur={() => handleCellBlurOrEnter(acc)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCellBlurOrEnter(acc)}
                            className="w-full p-1 bg-white border-2 border-emerald-700 rounded font-mono font-bold text-xs focus:outline-none"
                          />
                        ) : (
                          <div className="flex items-center justify-between group">
                            <span>{acc.noTel || '-'}</span>
                            <Edit3 className="w-3 h-3 text-stone-400 group-hover:text-stone-900 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        )}
                      </td>

                      {/* Editable Email Cell */}
                      <td 
                        onClick={() => !isEditingEmail && startEdit(acc, 'email')}
                        className={`py-2.5 px-3 cursor-pointer transition-colors border-r border-stone-200 font-bold ${
                          isUpdated
                            ? 'bg-emerald-100/80 hover:bg-emerald-200/80 text-emerald-950'
                            : 'bg-stone-50 hover:bg-stone-100 text-stone-950'
                        }`}
                      >
                        {isEditingEmail ? (
                          <input
                            autoFocus
                            type="email"
                            value={tempValue}
                            onChange={(e) => setTempValue(e.target.value)}
                            onBlur={() => handleCellBlurOrEnter(acc)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCellBlurOrEnter(acc)}
                            className="w-full p-1 bg-white border-2 border-emerald-700 rounded font-mono font-bold text-xs focus:outline-none"
                          />
                        ) : (
                          <div className="flex items-center justify-between group">
                            <span className="truncate max-w-[180px]">{acc.email || '-'}</span>
                            <Edit3 className="w-3 h-3 text-stone-400 group-hover:text-stone-900 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="bg-stone-100 text-stone-800 text-[10px] font-semibold px-2 py-0.5 rounded border border-stone-300">
                          {acc.status}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-stone-500 text-[11px] whitespace-nowrap">
                        {acc.lastUpdated}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 📑 Spreadsheet Pagination Footer */}
        {totalFilteredCount > 0 && (
          <div className="bg-[#FAF9F6] border-t border-stone-300 p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-2 text-stone-600 text-[11px]">
              <span>Memaparkan <strong className="text-stone-900 font-bold">{Math.min(totalFilteredCount, (currentPage - 1) * (pageSize === -1 ? totalFilteredCount : pageSize) + 1)}</strong> - <strong className="text-stone-900 font-bold">{pageSize === -1 ? totalFilteredCount : Math.min(totalFilteredCount, currentPage * pageSize)}</strong> daripada <strong className="text-stone-900 font-bold">{totalFilteredCount.toLocaleString()}</strong> rekod</span>
              {searchQuery && (
                <span className="bg-stone-200 text-stone-800 px-1.5 py-0.5 rounded text-[10px]">
                  Carian: "{searchQuery}"
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Page size selector */}
              <div className="flex items-center gap-1.5 text-stone-600">
                <span className="text-[11px]">Saiz:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="bg-white border border-stone-300 rounded-lg px-2 py-1 text-xs font-bold text-stone-900 focus:outline-none focus:border-stone-800 cursor-pointer shadow-2xs"
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

                  <span className="px-2 text-xs font-bold text-stone-800">
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
      {/* Modal Templat Excel */}
      <ExcelTemplateModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        onImportFile={async (file) => {
          try {
            const result = await parseAccountsExcel(file);
            if (result.accounts.length > 0) {
              onImportAccounts(result.accounts);
              showSuccess('Import Excel Berjaya', `Sebanyak ${result.accounts.length} rekod akaun telah dimasukkan.`);
            } else {
              showError('Fail Kosong', 'Tiada rekod data akaun yang sah dijumpai.');
            }
          } catch {
            showError('Ralat Bacaan Fail', 'Gagal memproses fail Excel.');
          }
        }}
      />
    </div>
  );
};
