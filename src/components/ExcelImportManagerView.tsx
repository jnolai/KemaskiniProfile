import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  UploadCloud, 
  Download, 
  Search, 
  CheckCircle2, 
  Lock, 
  Edit3, 
  Phone, 
  Mail, 
  Save, 
  AlertCircle, 
  ExternalLink,
  Table,
  Layers,
  FileText,
  Zap,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Activity,
  Trash2,
  Crown,
  Info
} from 'lucide-react';
import { CustomerAccount } from '../types';
import { generateProfileSummaryPDF } from '../utils/pdfReceiptHelper';
import { useToast } from '../context/ToastContext';
import { 
  downloadExcelTemplate, 
  parseAccountsExcel, 
  exportAccountsToExcel,
  isPhoneColumn,
  isEmailColumn,
  isAccountNoColumn,
  isOwnerNameColumn,
  isIcColumn,
  isStatusColumn,
  ParseProgressInfo
} from '../utils/excelHelper';
import { saveCustomColumnsToFirestore, subscribeToCustomColumns } from '../services/firebaseService';
import confetti from 'canvas-confetti';

interface ExcelImportManagerViewProps {
  accounts: CustomerAccount[];
  onImportAccounts: (imported: CustomerAccount[], mode: 'merge' | 'replace') => void;
  onUpdateAccount: (updated: CustomerAccount, changedFields: string[], oldPhone: string, oldEmail: string) => void;
  onNavigateToLookup?: (noAkaun: string) => void;
  onClearAllAccounts?: () => void;
  isSuperAdmin?: boolean;
  onRequireSuperAdmin?: () => void;
}

const DEFAULT_COLUMNS = [
  'No Akaun',
  'Nama Pemilik',
  'No Kad Pengenalan',
  'No Handphone',
  'Emel Pemilik/Wakil',
  'Kategori Akaun',
  'Status'
];

export const ExcelImportManagerView: React.FC<ExcelImportManagerViewProps> = ({
  accounts,
  onImportAccounts,
  onUpdateAccount,
  onNavigateToLookup,
  onClearAllAccounts,
  isSuperAdmin = false,
  onRequireSuperAdmin,
}) => {
  const { showSuccess, showError, showWarning, showInfo } = useToast();

  // File upload state (Langkah 1)
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState<ParseProgressInfo | null>(null);
  const [parseResult, setParseResult] = useState<{
    accounts: CustomerAccount[];
    detectedColumns: string[];
    totalRows: number;
  } | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importFeedback, setImportFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Dynamic columns for Langkah 2 (derived from uploaded file in Langkah 1)
  const [activeColumns, setActiveColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [customColumnsUploaded, setCustomColumnsUploaded] = useState<boolean>(false);

  // Pagination for high-performance viewing of large datasets (up to 100k+ records)
  const [pageSize, setPageSize] = useState<number>(100);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [jumpPageInput, setJumpPageInput] = useState<string>('');

  // Initialize or synchronize activeColumns from existing accounts or Firestore
  useEffect(() => {
    const unsubscribe = subscribeToCustomColumns((cols) => {
      if (cols && cols.length > 0) {
        setActiveColumns(cols);
        setCustomColumnsUploaded(true);
      }
    });

    const accWithRaw = accounts.find((a) => a.rawRowData && Object.keys(a.rawRowData).length > 0);
    if (accWithRaw && accWithRaw.rawRowData && !customColumnsUploaded) {
      const keys = Object.keys(accWithRaw.rawRowData);
      if (keys.length > 0) {
        setActiveColumns(keys);
        setCustomColumnsUploaded(true);
      }
    }

    return () => {
      unsubscribe();
    };
  }, [accounts, customColumnsUploaded]);

  // Identify specific functional column keys
  const phoneColumnKey = useMemo(() => {
    return activeColumns.find((c) => isPhoneColumn(c)) || 'No Handphone';
  }, [activeColumns]);

  const emailColumnKey = useMemo(() => {
    return activeColumns.find((c) => isEmailColumn(c)) || 'Emel Pemilik/Wakil';
  }, [activeColumns]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUpdated, setFilterUpdated] = useState<'Semua' | 'Dikemaskini' | 'Asal'>('Semua');
  const [filterStatus, setFilterStatus] = useState<string>('Semua');

  // Reset pagination when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterUpdated, filterStatus, pageSize]);

  // Quick inline edit state
  const [editingKey, setEditingKey] = useState<{ noAkaun: string; column: string; fieldType: 'phone' | 'email' } | null>(null);
  const [tempCellValue, setTempCellValue] = useState('');
  const [activeEditAccount, setActiveEditAccount] = useState<CustomerAccount | null>(null);
  const [editFormPhone, setEditFormPhone] = useState('');
  const [editFormEmail, setEditFormEmail] = useState('');
  const [cellFeedback, setCellFeedback] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse Excel File on select in Langkah 1 with Real-Time Progress for 100MB files
  const handleFileProcess = async (file: File) => {
    const fileSizeMb = Number((file.size / (1024 * 1024)).toFixed(2));
    setIsParsing(true);
    setImportFeedback(null);
    setSelectedFile(file);
    setParseProgress({
      phase: `Memulakan pembacaan fail (${fileSizeMb} MB)...`,
      percent: 5,
      processedRows: 0,
      totalRows: 0,
      fileSizeMb,
    });

    try {
      const result = await parseAccountsExcel(file, (info) => {
        setParseProgress(info);
      });

      if (result.accounts.length === 0) {
        const errorMsg = 'Fail Excel tidak mengandungi data akaun yang sah. Sila pastikan terdapat ruangan No. Akaun dan Nama.';
        setImportFeedback({
          type: 'error',
          message: errorMsg,
        });
        showError('Ralat Bacaan Fail Excel', errorMsg);
        setParseResult(null);
      } else {
        setParseResult(result);
        const successMsg = `⚡ Berjaya memproses fail "${file.name}" (${fileSizeMb} MB). Dijumpai ${result.accounts.length.toLocaleString()} rekod akaun unik dengan ${result.detectedColumns.length} lajur data.`;
        setImportFeedback({
          type: 'success',
          message: successMsg,
        });
        showInfo(
          'Fail 100MB Dikesan & Diproses!', 
          `Dijumpai ${result.accounts.length.toLocaleString()} rekod dalam fail "${file.name}". Sila klik butang "Sahkan & Selaraskan" untuk menyimpan.`
        );
      }
    } catch {
      const errorMsg = 'Gagal membaca fail Excel. Sila pastikan format fail adalah .xlsx, .xls atau .csv yang sah.';
      setImportFeedback({
        type: 'error',
        message: errorMsg,
      });
      showError('Ralat Format Fail', errorMsg);
      setParseResult(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileProcess(e.target.files[0]);
    }
  };

  // ⚡ Deduplication Statistics against current database
  const deduplicationStats = useMemo(() => {
    if (!parseResult) return null;
    const existingDbSet = new Set(accounts.map((a) => a.noAkaun.trim().toUpperCase()));
    let matchingInDb = 0;
    let newUnique = 0;

    parseResult.accounts.forEach((acc) => {
      const key = acc.noAkaun.trim().toUpperCase();
      if (existingDbSet.has(key)) {
        matchingInDb++;
      } else {
        newUnique++;
      }
    });

    const duplicateCountInFile = (parseResult as any).duplicateCountInFile || 0;
    const rawRowCount = (parseResult as any).rawRowCount || parseResult.accounts.length;

    return {
      totalUnique: parseResult.accounts.length,
      matchingInDb,
      newUnique,
      duplicateCountInFile,
      rawRowCount,
    };
  }, [parseResult, accounts]);

  // Commit Import from Langkah 1 to system and configure Langkah 2 fields
  const handleApplyImport = () => {
    if (!parseResult || parseResult.accounts.length === 0) return;

    const count = parseResult.accounts.length;
    const fileName = selectedFile?.name || 'Excel';
    const matchCount = deduplicationStats?.matchingInDb || 0;
    const newCount = deduplicationStats?.newUnique || count;

    // Apply the imported accounts to parent state
    onImportAccounts(parseResult.accounts, importMode);
    
    // Set dynamic columns in Langkah 2 to match the exact fields uploaded in Langkah 1
    if (parseResult.detectedColumns && parseResult.detectedColumns.length > 0) {
      setActiveColumns(parseResult.detectedColumns);
      setCustomColumnsUploaded(true);
      saveCustomColumnsToFirestore(parseResult.detectedColumns).catch(() => {});
    }

    try {
      confetti({
        particleCount: 50,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#059669', '#10B981', '#1A1A1A']
      });
    } catch {}

    const feedbackMsg = importMode === 'replace'
      ? `🎉 Berjaya memuat naik ${count.toLocaleString()} rekod akaun (Gantian Keseluruhan). Ruangan pada Langkah 2 diselaraskan.`
      : `🎉 Berjaya memproses ${count.toLocaleString()} akaun: ${newCount.toLocaleString()} akaun baharu ditambah & ${matchCount.toLocaleString()} akaun sedia ada (No. Akaun sama) dikemaskini.`;

    setImportFeedback({
      type: 'success',
      message: feedbackMsg,
    });

    showSuccess(
      'Import Data Excel Berjaya!',
      importMode === 'replace'
        ? `Sebanyak ${count.toLocaleString()} rekod akaun dari fail "${fileName}" telah menggantikan keseluruhan data.`
        : `Sebanyak ${count.toLocaleString()} rekod akaun diselaraskan (${newCount.toLocaleString()} baharu, ${matchCount.toLocaleString()} dikemas kini).`
    );

    // Reset staging state
    setSelectedFile(null);
    setParseResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Filtered dataset for searching and updating with O(n) scan without artificial line item limits
  const filteredAccounts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const qDigits = q.replace(/[^0-9]/g, '');

    if (!q && filterUpdated === 'Semua' && filterStatus === 'Semua') {
      return accounts;
    }

    const res: CustomerAccount[] = [];

    for (let i = 0; i < accounts.length; i++) {
      const acc = accounts[i];

      const matchUpdated =
        filterUpdated === 'Semua' ||
        (filterUpdated === 'Dikemaskini' && acc.telahDikemaskini) ||
        (filterUpdated === 'Asal' && !acc.telahDikemaskini);
      if (!matchUpdated) continue;

      const matchStatus = filterStatus === 'Semua' || acc.status === filterStatus;
      if (!matchStatus) continue;

      if (q) {
        let matchSearch =
          acc.noAkaun.toLowerCase().includes(q) ||
          acc.nama.toLowerCase().includes(q) ||
          acc.kadPengenalan.toLowerCase().includes(q) ||
          (qDigits.length > 3 && acc.kadPengenalan.replace(/[^0-9]/g, '').includes(qDigits)) ||
          acc.noTel.toLowerCase().includes(q) ||
          (qDigits.length > 3 && acc.noTel.replace(/[^0-9]/g, '').includes(qDigits)) ||
          acc.email.toLowerCase().includes(q) ||
          (acc.alamatHarta && acc.alamatHarta.toLowerCase().includes(q));

        // Also search across all dynamic rawRowData fields uploaded in Langkah 1
        if (!matchSearch && acc.rawRowData) {
          matchSearch = Object.values(acc.rawRowData).some((val) => {
            if (val === null || val === undefined) return false;
            return String(val).toLowerCase().includes(q);
          });
        }

        if (!matchSearch) continue;
      }

      res.push(acc);
    }

    return res;
  }, [accounts, searchQuery, filterUpdated, filterStatus]);

  // Summary statistics
  const stats = useMemo(() => {
    const total = accounts.length;
    const updated = accounts.filter((a) => a.telahDikemaskini).length;
    const original = total - updated;
    return { total, updated, original };
  }, [accounts]);

  // Paginated dataset calculation for instant 60fps rendering of 100MB imports
  const totalFilteredCount = filteredAccounts.length;
  const totalPages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(totalFilteredCount / pageSize));
  
  const displayedAccounts = useMemo(() => {
    if (pageSize === -1) return filteredAccounts;
    const startIndex = (currentPage - 1) * pageSize;
    return filteredAccounts.slice(startIndex, startIndex + pageSize);
  }, [filteredAccounts, currentPage, pageSize]);

  const handleJumpPage = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(jumpPageInput, 10);
    if (!isNaN(p) && p >= 1 && p <= totalPages) {
      setCurrentPage(p);
      setJumpPageInput('');
    }
  };

  // Helper to extract cell value for any dynamic column
  const getCellValue = (acc: CustomerAccount, colName: string): string => {
    if (isPhoneColumn(colName)) {
      return acc.noTel || (acc.rawRowData ? String(acc.rawRowData[colName] ?? '') : '');
    }
    if (isEmailColumn(colName)) {
      return acc.email || (acc.rawRowData ? String(acc.rawRowData[colName] ?? '') : '');
    }
    if (acc.rawRowData && acc.rawRowData[colName] !== undefined && acc.rawRowData[colName] !== null) {
      return String(acc.rawRowData[colName]);
    }
    if (isAccountNoColumn(colName)) return acc.noAkaun;
    if (isOwnerNameColumn(colName)) return acc.nama;
    if (isIcColumn(colName)) return acc.kadPengenalan;
    if (isStatusColumn(colName)) return acc.status;
    return '';
  };

  // Inline Cell Editing
  const startCellEdit = (acc: CustomerAccount, colName: string, fieldType: 'phone' | 'email') => {
    setEditingKey({ noAkaun: acc.noAkaun, column: colName, fieldType });
    const currentVal = fieldType === 'phone' ? acc.noTel : acc.email;
    setTempCellValue(currentVal || getCellValue(acc, colName));
  };

  const saveCellEdit = (acc: CustomerAccount) => {
    if (!editingKey) return;
    const { fieldType, column } = editingKey;
    const trimmed = tempCellValue.trim();

    const currentValue = fieldType === 'phone' ? acc.noTel : acc.email;

    if (trimmed !== currentValue) {
      const changedFields = [fieldType === 'phone' ? column || 'No Handphone' : column || 'Emel Pemilik/Wakil'];
      const oldPhone = acc.noTel;
      const oldEmail = acc.email;

      // Update both structured fields and dynamic rawRowData
      const updatedRaw = { ...(acc.rawRowData || {}) };
      if (column) {
        updatedRaw[column] = trimmed;
      }

      const updated: CustomerAccount = {
        ...acc,
        noTel: fieldType === 'phone' ? trimmed : acc.noTel,
        email: fieldType === 'email' ? trimmed : acc.email,
        rawRowData: updatedRaw,
        telahDikemaskini: true,
        lastUpdated: new Date().toISOString().replace('T', ' ').slice(0, 16),
        kemaskiniOleh: 'Kemaskini Data Excel',
      };

      onUpdateAccount(updated, changedFields, oldPhone, oldEmail);
      const feedbackText = `✨ Akaun ${acc.noAkaun} (${column}) berjaya disimpan.`;
      setCellFeedback(feedbackText);
      showSuccess('Kemaskini Berjaya', `Maklumat ruangan "${column}" bagi akaun ${acc.noAkaun} telah disimpan.`);
      setTimeout(() => setCellFeedback(null), 3500);
    }
    setEditingKey(null);
  };

  // Detailed Modal Edit for single row
  const openEditModal = (acc: CustomerAccount) => {
    setActiveEditAccount(acc);
    setEditFormPhone(acc.noTel || getCellValue(acc, phoneColumnKey));
    setEditFormEmail(acc.email || getCellValue(acc, emailColumnKey));
  };

  const handleSaveModalForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEditAccount) return;

    const trimmedPhone = editFormPhone.trim();
    const trimmedEmail = editFormEmail.trim();

    const changedFields: string[] = [];
    if (trimmedPhone !== activeEditAccount.noTel) changedFields.push(phoneColumnKey || 'No Handphone');
    if (trimmedEmail !== activeEditAccount.email) changedFields.push(emailColumnKey || 'Emel Pemilik/Wakil');

    if (changedFields.length > 0) {
      const updatedRaw = { ...(activeEditAccount.rawRowData || {}) };
      if (phoneColumnKey) updatedRaw[phoneColumnKey] = trimmedPhone;
      if (emailColumnKey) updatedRaw[emailColumnKey] = trimmedEmail;

      const updated: CustomerAccount = {
        ...activeEditAccount,
        noTel: trimmedPhone,
        email: trimmedEmail,
        rawRowData: updatedRaw,
        telahDikemaskini: true,
        lastUpdated: new Date().toISOString().replace('T', ' ').slice(0, 16),
        kemaskiniOleh: 'Kemaskini Data Excel',
      };

      onUpdateAccount(updated, changedFields, activeEditAccount.noTel, activeEditAccount.email);
      const feedbackText = `✨ Profil ${activeEditAccount.noAkaun} berjaya dikemaskini.`;
      setCellFeedback(feedbackText);
      showSuccess('Kemaskini Profil Berjaya', `Maklumat perhubungan bagi akaun ${activeEditAccount.noAkaun} telah diselaraskan.`);
      setTimeout(() => setCellFeedback(null), 3500);
    }

    setActiveEditAccount(null);
  };

  const handleDownloadTemplateClick = () => {
    downloadExcelTemplate();
    showInfo('Muat Turun Templat Excel', 'Templat fail Excel (.xlsx) dengan struktur lajur piawai telah dimuat turun.');
  };

  const handleExportExcelClick = () => {
    if (accounts.length === 0) {
      showWarning('Pangkalan Data Kosong', 'Tiada rekod data akaun untuk dieksport.');
      return;
    }
    exportAccountsToExcel(accounts, 'xlsx', activeColumns);
    showSuccess('Eksport Data Berjaya', `Sebanyak ${accounts.length} rekod akaun telah dieksport ke format Excel (.xlsx).`);
  };

  return (
    <div className="space-y-6">
      
      {/* 🏛️ 1. Header Banner */}
      <div className="bg-[#FAF9F6] border border-stone-300 rounded-2xl p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="bg-[#1A1A1A] text-white text-[10px] uppercase font-mono font-bold px-2.5 py-0.5 rounded tracking-wider">
                Modul Integrasi Excel Pantas
              </span>
              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-950 text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-emerald-300">
                <Zap className="w-3 h-3 text-emerald-700" />
                Tanpa Had Baris (No Limit) & 100MB+
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-serif-heading font-bold text-stone-950 tracking-tight">
              Ruangan Import & Kemaskini Data Excel
            </h1>
            <p className="text-xs sm:text-sm text-stone-600 max-w-2xl leading-relaxed font-serif">
              Muat naik fail Excel atau CSV tanpa had bilangan baris (<strong className="text-stone-900 font-bold">No Limit</strong>) pada <strong>Langkah 1</strong>. Enjin pemprosesan strim pantas membaca puluhan ribu hingga ratusan ribu rekod dengan kelajuan tinggi. Struktur lajur pada <strong>Langkah 2</strong> diselaraskan secara automatik untuk carian dan kemaskini data perhubungan (<strong className="text-stone-900 font-bold">NO HANDPHONE</strong> & <strong className="text-stone-900 font-bold">EMEL PEMILIK/WAKIL</strong>).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={handleDownloadTemplateClick}
              className="px-3.5 py-2.5 bg-white hover:bg-stone-100 text-stone-800 rounded-xl text-xs font-semibold flex items-center gap-2 border border-stone-300 shadow-2xs transition-all cursor-pointer"
              title="Muat turun format templat lajur Excel standard"
            >
              <Download className="w-4 h-4 text-stone-600" />
              <span>Muat Turun Templat Excel</span>
            </button>

            <button
              onClick={handleExportExcelClick}
              className="px-3.5 py-2.5 bg-[#1A1A1A] hover:bg-black text-white rounded-xl text-xs font-semibold flex items-center gap-2 border border-stone-800 shadow-2xs transition-all cursor-pointer"
              title="Eksport data pangkalan data terkini mengikut lajur semasa ke fail Excel"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Eksport Data Semasa (.xlsx)</span>
            </button>

            {accounts.length > 0 && onClearAllAccounts && (
              isSuperAdmin ? (
                <button
                  onClick={onClearAllAccounts}
                  className="px-3.5 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-xs font-semibold border border-red-200 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
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
                  className="px-3.5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-xl text-xs font-semibold border border-stone-300 transition-colors cursor-pointer flex items-center gap-1.5 opacity-85 shadow-2xs"
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
      </div>

      {/* 📥 2. Excel Upload & Staging Zone (Langkah 1) */}
      <div className="bg-white border border-stone-300 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-stone-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1A1A1A] text-white flex items-center justify-center font-bold text-xs font-mono shadow-2xs">
              1
            </div>
            <div>
              <h2 className="font-serif-heading font-bold text-stone-950 text-sm sm:text-base flex items-center gap-2">
                <span>Langkah 1: Muat Naik Fail Excel Pelanggan</span>
                <span className="text-[10px] font-mono bg-emerald-50 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded-full font-bold">
                  ⚡ Tiada Had Baris (No Limit)
                </span>
              </h2>
              <p className="text-[11px] text-stone-500 font-serif">
                Muat naik fail Excel (.xlsx / .xls / .csv) tanpa had bilangan baris rekod. Sistem akan mengekstrak semua lajur data secara strim & O(1) indexing pantas.
              </p>
            </div>
          </div>

          <span className="text-[11px] font-mono bg-stone-100 text-stone-700 px-2.5 py-1 rounded-full font-bold border border-stone-200 hidden sm:inline-block">
            .xlsx / .xls / .csv (No Limit)
          </span>
        </div>

        {/* Drag & Drop Box */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => !isParsing && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 sm:p-8 text-center transition-all ${
            isParsing 
              ? 'border-emerald-500 bg-emerald-50/40 cursor-wait'
              : dragActive
                ? 'border-stone-900 bg-stone-100 cursor-pointer'
                : 'border-stone-300 hover:border-stone-400 bg-[#FAF9F6] cursor-pointer'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            disabled={isParsing}
            accept=".xlsx, .xls, .csv"
            onChange={handleFileInputChange}
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-white border border-stone-300 flex items-center justify-center text-stone-700 shadow-2xs">
              {isParsing ? (
                <div className="w-7 h-7 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <FileSpreadsheet className="w-7 h-7 text-emerald-600" />
              )}
            </div>

            <div>
              <p className="font-serif-heading font-bold text-stone-900 text-sm sm:text-base">
                {isParsing ? 'Sedang Memproses Fail Excel Tanpa Had Baris...' : 'Klik untuk memilih fail atau seret fail Excel (.xlsx / .csv) ke sini'}
              </p>
              <p className="text-xs text-stone-500 font-serif mt-0.5">
                Kapasiti maksimum tanpa sekatan baris — menyokong ratusan ribu rekod dengan enjin pemprosesan berkelajuan tinggi.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <span className="text-[10px] font-mono bg-emerald-50 text-emerald-900 px-2 py-0.5 rounded border border-emerald-300 font-bold">
                🚀 Tiada Had Baris (No Limit)
              </span>
              <span className="text-[10px] font-mono bg-stone-100 text-stone-700 px-2 py-0.5 rounded border border-stone-300">
                ⚡ Pemprosesan Strim Berkelajuan Tinggi
              </span>
              <span className="text-[10px] font-mono bg-emerald-50 text-emerald-900 px-2 py-0.5 rounded border border-emerald-300 font-bold">
                ✓ No. Akaun Berulang Dikekalkan (Tiada Potongan)
              </span>
              <span className="text-[10px] font-mono bg-stone-100 text-stone-700 px-2 py-0.5 rounded border border-stone-300">
                🛡️ Memori Ringan Dense Mode
              </span>
            </div>
          </div>
        </div>

        {/* ⚡ 100MB Real-Time Live Progress Bar */}
        {isParsing && parseProgress && (
          <div className="p-4 bg-emerald-50/80 border border-emerald-300 rounded-xl space-y-2.5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between text-xs font-mono font-bold text-emerald-950">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-700 animate-pulse" />
                <span>{parseProgress.phase}</span>
              </div>
              <span className="text-sm bg-white px-2.5 py-0.5 rounded-md border border-emerald-300 text-emerald-800">
                {parseProgress.percent}%
              </span>
            </div>

            {/* Progress Bar Container */}
            <div className="w-full bg-white h-2.5 rounded-full overflow-hidden border border-emerald-200">
              <div 
                className="bg-emerald-600 h-full rounded-full transition-all duration-200 ease-out"
                style={{ width: `${parseProgress.percent}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-emerald-800">
              <span>Saiz Fail: <strong>{parseProgress.fileSizeMb} MB</strong></span>
              {parseProgress.totalRows > 0 && (
                <span>
                  Baris Diproses: <strong>{parseProgress.processedRows.toLocaleString()}</strong> / {parseProgress.totalRows.toLocaleString()}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Import Feedback Alert */}
        {importFeedback && (
          <div className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 border ${
            importFeedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-950 border-emerald-300'
              : 'bg-rose-50 text-rose-950 border-rose-300'
          }`}>
            {importFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
            )}
            <span className="font-medium">{importFeedback.message}</span>
          </div>
        )}

        {/* Staging Confirmation Card (when a file has been read in Langkah 1) */}
        {parseResult && (
          <div className="p-4 bg-stone-50 border border-stone-300 rounded-xl space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-stone-200">
              <div className="flex items-center gap-2">
                <Table className="w-4 h-4 text-emerald-600" />
                <span className="font-serif-heading font-bold text-stone-900 text-xs sm:text-sm">
                  Pratonton Fail: {selectedFile?.name}
                </span>
                <span className="text-[10px] font-mono bg-white border border-stone-300 px-2 py-0.5 rounded font-bold text-emerald-800">
                  {parseResult.accounts.length.toLocaleString()} Rekod Baris Sedia Dimasukkan
                </span>
              </div>

              {/* Import Mode Options */}
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-stone-500 text-[11px]">Mod Kemasukan:</span>
                <button
                  type="button"
                  onClick={() => setImportMode('merge')}
                  className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                    importMode === 'merge'
                      ? 'bg-stone-900 text-white'
                      : 'bg-white text-stone-700 border border-stone-300'
                  }`}
                >
                  Tambah & Selaraskan (Merge)
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode('replace')}
                  className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                    importMode === 'replace'
                      ? 'bg-rose-900 text-white'
                      : 'bg-white text-stone-700 border border-stone-300'
                  }`}
                >
                  Ganti Semua (Replace)
                </button>
              </div>
            </div>

            {/* ⚡ Breakdown Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <div className="p-2.5 bg-white border border-stone-200 rounded-lg space-y-0.5">
                <div className="text-[10px] text-stone-500 font-mono">Jumlah Baris Fail Dibaca</div>
                <div className="text-sm font-bold font-mono text-stone-900">
                  {parseResult.accounts.length.toLocaleString()}
                </div>
              </div>
              <div className="p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-lg space-y-0.5">
                <div className="text-[10px] text-emerald-800 font-mono font-semibold">Rekod Dimasukkan (100%)</div>
                <div className="text-sm font-bold font-mono text-emerald-900">
                  {parseResult.accounts.length.toLocaleString()}
                </div>
              </div>
              <div className="p-2.5 bg-stone-100 border border-stone-300 rounded-lg space-y-0.5 col-span-2 sm:col-span-1">
                <div className="text-[10px] text-stone-600 font-mono">Status Nyahduplikasi</div>
                <div className="text-sm font-bold font-mono text-emerald-800 flex items-center gap-1">
                  <span>Dimansuhkan (Semua Kekal)</span>
                </div>
              </div>
            </div>

            {/* Explanatory Rule Callout */}
            <div className="p-2.5 bg-emerald-50/60 border border-emerald-200 rounded-lg flex items-start gap-2 text-[11px] text-emerald-950 font-serif">
              <Info className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <strong>Pemberitahuan:</strong> Fungsi Nyahduplikasi telah <strong>dimansuhkan sepenuhnya</strong>. Semua baris rekod termasuk baris yang mempunyai <strong>No. Akaun berulang</strong> akan disimpan 100% tanpa sebarang pemotongan atau penggabungan.
              </div>
            </div>

            {/* Column Detection Tags */}
            <div className="text-xs">
              <span className="text-[11px] text-stone-600 font-serif block mb-1 font-bold">
                Lajur Dikesan dari Fail Excel (Akan digunakan pada Langkah 2):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {parseResult.detectedColumns.map((col, colIdx) => {
                  const isPhone = isPhoneColumn(col);
                  const isMail = isEmailColumn(col);
                  return (
                    <span
                      key={`detected_col_${col}_${colIdx}`}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 border ${
                        isPhone || isMail
                          ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
                          : 'bg-white text-stone-800 border-stone-300'
                      }`}
                    >
                      {isPhone || isMail ? (
                        <Edit3 className="w-3 h-3 text-emerald-700" />
                      ) : (
                        <Lock className="w-2.5 h-2.5 text-stone-500" />
                      )}
                      <span>{col}</span>
                      {isPhone && <span className="text-[9px] text-emerald-800">(No Tel)</span>}
                      {isMail && <span className="text-[9px] text-emerald-800">(Emel)</span>}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Confirmation Button */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setParseResult(null);
                  setParseProgress(null);
                }}
                className="px-3.5 py-2 bg-white text-stone-700 hover:bg-stone-100 rounded-xl text-xs font-medium border border-stone-300 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleApplyImport}
                className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Sahkan & Selaraskan Langkah 2 Mengikut Fail Ini</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 🔍 3. Data Search & Direct Update Workspace (Langkah 2) */}
      <div className="bg-[#FAF9F6] border border-stone-300 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
        
        {/* Step Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-stone-200">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#1A1A1A] text-white flex items-center justify-center font-bold text-xs font-mono shadow-2xs">
                2
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-serif-heading font-bold text-stone-950 text-base sm:text-lg">
                    Langkah 2: Carian & Kemaskini Data Pelanggan
                  </h2>
                  <span className="bg-stone-900 text-white text-[10px] font-mono px-2 py-0.5 rounded font-bold">
                    {stats.total} Rekod
                  </span>
                </div>
                <p className="text-xs text-stone-600 font-serif mt-0.5">
                  Lajur jadual di bawah mengikut <strong>fail data yang dimuat naik pada Langkah 1</strong>. Sunting ruangan <strong className="text-emerald-900 font-bold">NO HANDPHONE</strong> & <strong className="text-emerald-900 font-bold">EMEL PEMILIK/WAKIL</strong> secara pantas.
                </p>
              </div>
            </div>
          </div>

          {/* Color Legend Badge */}
          <div className="flex items-center gap-2 text-[11px] font-mono bg-white px-3 py-1.5 rounded-xl border border-stone-200 shrink-0">
            <span className="font-bold text-stone-800">Petunjuk Warna:</span>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-emerald-100 border border-emerald-600"></span>
              <span className="text-emerald-950 font-semibold">Hijau: Dikemaskini ({stats.updated})</span>
            </div>
            <span className="text-stone-300">|</span>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-stone-50 border border-stone-300"></span>
              <span className="text-stone-600">Asal ({stats.original})</span>
            </div>
          </div>
        </div>

        {/* Dynamic Column Layout Notification */}
        <div className="bg-white border border-stone-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-stone-600 shrink-0" />
            <span className="font-serif text-stone-700">
              {customColumnsUploaded ? (
                <span>
                  <strong>Field / Lajur Aktif:</strong> Mengikut struktur fail Excel yang dimuat naik ({activeColumns.length} lajur dikesan).
                </span>
              ) : (
                <span>
                  <strong>Field / Lajur Aktif:</strong> Menggunakan susunan lajur piawai sistem ({activeColumns.length} lajur).
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto text-[10px] font-mono">
            <span className="text-stone-400">Ringkasan Field:</span>
            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-950 font-bold border border-emerald-300">
              ✏️ {phoneColumnKey}
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-950 font-bold border border-emerald-300">
              ✏️ {emailColumnKey}
            </span>
            <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-300">
              🔒 {activeColumns.length - 2} Ruangan Terkunci
            </span>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari dalam semua lajur data (No Akaun, Nama, IC, No Tel, Emel, Alamat, dll)..."
              className="w-full pl-10 pr-9 py-2.5 bg-white border border-stone-300 rounded-xl text-xs sm:text-sm font-medium text-stone-900 focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900 shadow-2xs placeholder:text-stone-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 text-xs p-1"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              onClick={() => setFilterUpdated('Semua')}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                filterUpdated === 'Semua'
                  ? 'bg-stone-900 text-white shadow-2xs'
                  : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-300'
              }`}
            >
              Semua ({stats.total})
            </button>

            <button
              onClick={() => setFilterUpdated('Dikemaskini')}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                filterUpdated === 'Dikemaskini'
                  ? 'bg-emerald-800 text-white shadow-2xs border border-emerald-900'
                  : 'bg-emerald-50 text-emerald-950 hover:bg-emerald-100 border border-emerald-300'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>✨ Dikemaskini ({stats.updated})</span>
            </button>

            <button
              onClick={() => setFilterUpdated('Asal')}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                filterUpdated === 'Asal'
                  ? 'bg-stone-800 text-white shadow-2xs'
                  : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-300'
              }`}
            >
              ⚪ Rekod Asal ({stats.original})
            </button>
          </div>
        </div>

        {/* Action / Cell Feedback Alert */}
        {cellFeedback && (
          <div className="p-3 bg-emerald-100 text-emerald-950 border border-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{cellFeedback}</span>
          </div>
        )}

        {/* 🔢 Top Pagination & Rows Control Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-2.5 sm:px-4 rounded-xl border border-stone-200 text-xs font-mono">
          <div className="flex items-center gap-2 text-stone-700">
            <span>Menunjukkan:</span>
            <span className="font-bold text-stone-950">
              {totalFilteredCount === 0 ? 0 : ((currentPage - 1) * (pageSize === -1 ? totalFilteredCount : pageSize) + 1).toLocaleString()}
              {' - '}
              {pageSize === -1 ? totalFilteredCount.toLocaleString() : Math.min(currentPage * pageSize, totalFilteredCount).toLocaleString()}
            </span>
            <span>daripada <strong className="text-stone-950">{totalFilteredCount.toLocaleString()}</strong> rekod</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Page Size Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-stone-500">Baris:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="bg-stone-50 border border-stone-300 rounded-lg px-2 py-1 text-xs font-bold text-stone-900 focus:outline-none"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
                <option value={500}>500</option>
                <option value={1000}>1,000</option>
                <option value={2500}>2,500</option>
                <option value={5000}>5,000</option>
                <option value={-1}>Semua ({totalFilteredCount.toLocaleString()})</option>
              </select>
            </div>

            {/* Pagination Controls */}
            {pageSize !== -1 && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(1)}
                  className="p-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="Halaman Pertama"
                >
                  <ChevronsLeft className="w-3.5 h-3.5 text-stone-700" />
                </button>
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="Halaman Sebelumnya"
                >
                  <ChevronLeft className="w-3.5 h-3.5 text-stone-700" />
                </button>

                <span className="px-2.5 py-1 bg-stone-100 border border-stone-300 rounded-lg text-xs font-bold text-stone-900">
                  {currentPage} / {totalPages}
                </span>

                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="Halaman Seterusnya"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-stone-700" />
                </button>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  className="p-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="Halaman Terakhir"
                >
                  <ChevronsRight className="w-3.5 h-3.5 text-stone-700" />
                </button>

                {/* Jump to page form */}
                <form onSubmit={handleJumpPage} className="flex items-center gap-1 ml-2">
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    placeholder="Lompat"
                    value={jumpPageInput}
                    onChange={(e) => setJumpPageInput(e.target.value)}
                    className="w-14 px-1.5 py-1 bg-stone-50 border border-stone-300 rounded-lg text-center text-xs focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-2 py-1 bg-stone-900 text-white rounded-lg text-[11px] font-bold hover:bg-black cursor-pointer"
                  >
                    Go
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* 📊 Dynamic Spreadsheet / Table Following Steps 1 Uploaded Columns */}
        <div className="bg-white border border-stone-300 rounded-xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#1A1A1A] text-white border-b border-stone-800 font-serif-heading">
                  <th className="py-3 px-3 w-12 text-center text-stone-400 font-mono text-[10px]">#</th>
                  <th className="py-3 px-3 font-bold whitespace-nowrap">Status Rekod</th>

                  {/* 🔄 Dynamic Headers matching exactly the uploaded Excel fields */}
                  {activeColumns.map((colName, colIdx) => {
                    const isPhone = isPhoneColumn(colName);
                    const isMail = isEmailColumn(colName);

                    if (isPhone) {
                      return (
                        <th 
                          key={`active_th_${colName}_${colIdx}`}
                          className="py-3 px-3 font-bold bg-stone-800 text-white border-x border-stone-700 min-w-[170px]"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-300 font-bold uppercase">{colName}</span>
                            </div>
                            <span className="text-[9px] bg-emerald-900/90 text-emerald-200 px-1 rounded">Boleh Sunting</span>
                          </div>
                        </th>
                      );
                    }

                    if (isMail) {
                      return (
                        <th 
                          key={`active_th_${colName}_${colIdx}`}
                          className="py-3 px-3 font-bold bg-stone-800 text-white border-r border-stone-700 min-w-[210px]"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-300 font-bold uppercase">{colName}</span>
                            </div>
                            <span className="text-[9px] bg-emerald-900/90 text-emerald-200 px-1 rounded">Boleh Sunting</span>
                          </div>
                        </th>
                      );
                    }

                    return (
                      <th key={`active_th_${colName}_${colIdx}`} className="py-3 px-3 font-bold whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Lock className="w-3 h-3 text-stone-400" />
                          <span>{colName}</span>
                        </div>
                      </th>
                    );
                  })}

                  <th className="py-3 px-3 font-bold text-center sticky right-0 bg-[#1A1A1A] z-20">Tindakan</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-stone-200 bg-white">
                {displayedAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={activeColumns.length + 3} className="py-10 text-center text-stone-400 font-serif italic">
                      Tiada akaun dijumpai untuk padanan carian ini.
                    </td>
                  </tr>
                ) : (
                  displayedAccounts.map((acc, index) => {
                    const isUpdated = acc.telahDikemaskini;
                    const rowAbsoluteIndex = pageSize === -1 ? index + 1 : (currentPage - 1) * pageSize + index + 1;

                    return (
                      <tr
                        key={`import_row_${acc.noAkaun}_${index}`}
                        className={`transition-colors ${
                          isUpdated
                            ? 'bg-emerald-50/70 hover:bg-emerald-100/60 border-l-4 border-l-emerald-600'
                            : 'bg-white hover:bg-[#FAF8F5] border-l-4 border-l-transparent'
                        }`}
                      >
                        {/* Index */}
                        <td className="py-2.5 px-3 text-center text-stone-400 text-[10px] bg-stone-50/80 border-r border-stone-200">
                          {rowAbsoluteIndex}
                        </td>

                        {/* Status Rekod Badge */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {isUpdated ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-950 border border-emerald-300 font-bold text-[10px]">
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

                        {/* 🔄 Dynamic Columns Content */}
                        {activeColumns.map((colName, colIdx) => {
                          const isPhone = isPhoneColumn(colName);
                          const isMail = isEmailColumn(colName);
                          const cellVal = getCellValue(acc, colName);

                          // Editable Phone Cell
                          if (isPhone) {
                            const isEditing = editingKey?.noAkaun === acc.noAkaun && editingKey?.column === colName;
                            return (
                              <td 
                                key={`cell_${acc.noAkaun}_${colName}_${colIdx}`}
                                onClick={() => !isEditing && startCellEdit(acc, colName, 'phone')}
                                className={`py-2 px-3 cursor-pointer transition-colors border-x border-stone-300 font-bold ${
                                  isUpdated
                                    ? 'bg-emerald-100/90 hover:bg-emerald-200/80 text-emerald-950'
                                    : 'bg-stone-50 hover:bg-stone-100 text-stone-950'
                                }`}
                                title={`Klik untuk menyunting ${colName}`}
                              >
                                {isEditing ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      autoFocus
                                      type="text"
                                      value={tempCellValue}
                                      onChange={(e) => setTempCellValue(e.target.value)}
                                      onBlur={() => saveCellEdit(acc)}
                                      onKeyDown={(e) => e.key === 'Enter' && saveCellEdit(acc)}
                                      className="w-full p-1 bg-white border-2 border-emerald-700 rounded font-mono font-bold text-xs focus:outline-none shadow-2xs"
                                    />
                                    <button
                                      type="button"
                                      onMouseDown={() => saveCellEdit(acc)}
                                      className="p-1 bg-emerald-700 text-white rounded hover:bg-emerald-800 cursor-pointer"
                                    >
                                      <Save className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between group">
                                    <div className="flex items-center gap-1.5 truncate">
                                      <Phone className="w-3 h-3 text-stone-400 group-hover:text-emerald-700 shrink-0" />
                                      <span>{cellVal || 'Belum Diisi'}</span>
                                    </div>
                                    <Edit3 className="w-3 h-3 text-stone-400 group-hover:text-stone-900 ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                  </div>
                                )}
                              </td>
                            );
                          }

                          // Editable Email Cell
                          if (isMail) {
                            const isEditing = editingKey?.noAkaun === acc.noAkaun && editingKey?.column === colName;
                            return (
                              <td 
                                key={`cell_${acc.noAkaun}_${colName}_${colIdx}`}
                                onClick={() => !isEditing && startCellEdit(acc, colName, 'email')}
                                className={`py-2 px-3 cursor-pointer transition-colors border-r border-stone-300 font-bold ${
                                  isUpdated
                                    ? 'bg-emerald-100/90 hover:bg-emerald-200/80 text-emerald-950'
                                    : 'bg-stone-50 hover:bg-stone-100 text-stone-950'
                                }`}
                                title={`Klik untuk menyunting ${colName}`}
                              >
                                {isEditing ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      autoFocus
                                      type="email"
                                      value={tempCellValue}
                                      onChange={(e) => setTempCellValue(e.target.value)}
                                      onBlur={() => saveCellEdit(acc)}
                                      onKeyDown={(e) => e.key === 'Enter' && saveCellEdit(acc)}
                                      className="w-full p-1 bg-white border-2 border-emerald-700 rounded font-mono font-bold text-xs focus:outline-none shadow-2xs"
                                    />
                                    <button
                                      type="button"
                                      onMouseDown={() => saveCellEdit(acc)}
                                      className="p-1 bg-emerald-700 text-white rounded hover:bg-emerald-800 cursor-pointer"
                                    >
                                      <Save className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between group">
                                    <div className="flex items-center gap-1.5 truncate max-w-[200px]">
                                      <Mail className="w-3 h-3 text-stone-400 group-hover:text-emerald-700 shrink-0" />
                                      <span className="truncate">{cellVal || 'Belum Diisi'}</span>
                                    </div>
                                    <Edit3 className="w-3 h-3 text-stone-400 group-hover:text-stone-900 ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                  </div>
                                )}
                              </td>
                            );
                          }

                          // Account Number format
                          if (isAccountNoColumn(colName)) {
                            return (
                              <td key={`cell_${acc.noAkaun}_${colName}_${colIdx}`} className="py-2.5 px-3 font-bold whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded border ${
                                  isUpdated
                                    ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
                                    : 'bg-stone-100 text-stone-900 border-stone-300'
                                }`}>
                                  {cellVal || acc.noAkaun}
                                </span>
                              </td>
                            );
                          }

                          // Status format
                          if (isStatusColumn(colName)) {
                            const st = cellVal || acc.status;
                            return (
                              <td key={`cell_${acc.noAkaun}_${colName}_${colIdx}`} className="py-2.5 px-3 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                  st === 'Aktif'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                    : st === 'Tertunggak'
                                    ? 'bg-rose-50 text-rose-800 border-rose-300'
                                    : 'bg-stone-100 text-stone-700 border-stone-300'
                                }`}>
                                  {st}
                                </span>
                              </td>
                            );
                          }

                          // Other Read-Only columns from Uploaded File
                          return (
                            <td 
                              key={`cell_${acc.noAkaun}_${colName}_${colIdx}`} 
                              className="py-2.5 px-3 text-stone-700 max-w-[220px] truncate"
                              title={cellVal}
                            >
                              {cellVal || '-'}
                            </td>
                          );
                        })}

                        {/* Quick Action Button */}
                        <td className="py-2.5 px-3 whitespace-nowrap text-center sticky right-0 bg-white group-hover:bg-[#FAF8F5]">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => openEditModal(acc)}
                              className="px-2.5 py-1 bg-stone-900 hover:bg-black text-white rounded text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                              title="Buka Borang Kemaskini Pantas"
                            >
                              <Edit3 className="w-3 h-3 text-emerald-400" />
                              <span>Kemaskini</span>
                            </button>

                            <button
                              onClick={() => generateProfileSummaryPDF(acc)}
                              className={`p-1 rounded border transition-colors cursor-pointer ${
                                acc.telahDikemaskini
                                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : 'bg-stone-100 hover:bg-stone-200 text-stone-600 border-stone-300'
                              }`}
                              title="Muat Turun Resit Ringkasan Profil (PDF)"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>

                            {onNavigateToLookup && (
                              <button
                                onClick={() => onNavigateToLookup(acc.noAkaun)}
                                className="p-1 text-stone-500 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded border border-stone-300 cursor-pointer"
                                title="Buka di Portal Pelanggan"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 🔢 Bottom Pagination Bar */}
        {pageSize !== -1 && totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-stone-200 text-xs font-mono">
            <div className="text-stone-600">
              Halaman <strong className="text-stone-900">{currentPage}</strong> daripada <strong className="text-stone-900">{totalPages}</strong> ({totalFilteredCount.toLocaleString()} rekod)
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(1)}
                className="px-2.5 py-1 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer font-bold"
              >
                Pertama
              </button>
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer font-bold flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Sebelumnya</span>
              </button>

              <span className="px-3 py-1 bg-stone-900 text-white rounded-lg font-bold">
                {currentPage}
              </span>

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer font-bold flex items-center gap-1"
              >
                <span>Seterusnya</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="px-2.5 py-1 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer font-bold"
              >
                Terakhir
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 📝 4. Single Row Direct Edit Modal */}
      {activeEditAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[#FAF9F6] border border-stone-400 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-[#1A1A1A] text-white p-5 flex items-center justify-between border-b border-stone-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-serif-heading font-bold text-sm sm:text-base">
                    Kemaskini Maklumat Perhubungan
                  </h3>
                  <span className="font-mono text-xs text-stone-300">
                    Akaun: <strong>{activeEditAccount.noAkaun}</strong> ({activeEditAccount.nama})
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveEditAccount(null)}
                className="text-stone-400 hover:text-white text-lg p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveModalForm} className="p-5 sm:p-6 space-y-4 bg-white">
              
              {/* 🔒 Locked Information Summary from Uploaded Data */}
              <div className="p-3.5 bg-[#FAF9F6] border border-stone-300 rounded-xl text-xs space-y-2 max-h-[160px] overflow-y-auto">
                <div className="flex items-center justify-between text-[11px] pb-1 border-b border-stone-200 sticky top-0 bg-[#FAF9F6]">
                  <span className="font-bold text-stone-800 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-stone-500" />
                    <span>Maklumat Rasmi Fail (Dikunci)</span>
                  </span>
                  <span className="font-mono text-[10px] text-stone-500">Read-Only</span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  {activeColumns
                    .filter((c) => !isPhoneColumn(c) && !isEmailColumn(c))
                    .map((col) => (
                      <div key={col} className="col-span-1">
                        <span className="text-stone-500 block text-[10px] uppercase font-mono">{col}:</span>
                        <span className="font-semibold text-stone-900">
                          {getCellValue(activeEditAccount, col) || '-'}
                        </span>
                      </div>
                    ))}
                </div>

                {/* 🏛️ Pengemaskinian Pemilikan (e-JPPH DBKL) */}
                <div className="pt-2 border-t border-stone-200 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-stone-500 font-serif">
                    Penukaran hak milik rasmi?
                  </span>
                  <a
                    href="https://ejpph.dbkl.gov.my/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1 underline underline-offset-2"
                  >
                    <span>Kemaskini Pemilikan di e-JPPH DBKL</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>

              {/* ✏️ Editable Field 1: NO HANDPHONE */}
              <div>
                <label className="block text-xs font-bold text-stone-900 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-emerald-950 font-serif-heading font-bold">
                    <Phone className="w-3.5 h-3.5 text-emerald-700" />
                    <span>{phoneColumnKey.toUpperCase()} <span className="text-rose-600">*</span></span>
                  </span>
                  <span className="text-[10px] font-mono text-stone-500">cth: 012-3456789</span>
                </label>
                <input
                  type="tel"
                  required
                  value={editFormPhone}
                  onChange={(e) => setEditFormPhone(e.target.value)}
                  placeholder="012-XXXXXXX"
                  className="w-full p-2.5 bg-white border border-stone-300 rounded-xl font-mono font-bold text-xs sm:text-sm text-stone-950 focus:outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 shadow-2xs"
                />
              </div>

              {/* ✏️ Editable Field 2: EMEL PEMILIK/WAKIL */}
              <div>
                <label className="block text-xs font-bold text-stone-900 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-emerald-950 font-serif-heading font-bold">
                    <Mail className="w-3.5 h-3.5 text-emerald-700" />
                    <span>{emailColumnKey.toUpperCase()} <span className="text-rose-600">*</span></span>
                  </span>
                  <span className="text-[10px] font-mono text-stone-500">cth: pemilik@email.com</span>
                </label>
                <input
                  type="email"
                  required
                  value={editFormEmail}
                  onChange={(e) => setEditFormEmail(e.target.value)}
                  placeholder="nama@domain.com"
                  className="w-full p-2.5 bg-white border border-stone-300 rounded-xl font-mono font-bold text-xs sm:text-sm text-stone-950 focus:outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 shadow-2xs"
                />
              </div>

              {/* Modal Footer */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3 border-t border-stone-200 text-xs">
                <button
                  type="button"
                  onClick={() => generateProfileSummaryPDF(activeEditAccount)}
                  className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  title="Jana dan muat turun slip resit PDF untuk rujukan pelanggan"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Muat Turun Resit PDF</span>
                </button>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveEditAccount(null)}
                    className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-medium transition-colors border border-stone-300 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-[#1A1A1A] hover:bg-black text-white rounded-xl font-bold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-4 h-4 text-emerald-400" />
                    <span>Simpan Perubahan</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
