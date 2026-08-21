import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  RefreshCw, 
  UploadCloud, 
  Download, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  PlusCircle, 
  Trash2, 
  ShieldCheck, 
  Lock, 
  Link2, 
  Layers, 
  History, 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  Check, 
  Sparkles,
  Search,
  Database,
  Unlink,
  Settings,
  TableProperties,
  Copy,
  FolderOpen
} from 'lucide-react';
import { CustomerAccount, GoogleSheetsConfig, GoogleDriveSheetFile, GoogleSyncHistoryEntry } from '../types';
import { useToast } from '../context/ToastContext';
import { 
  getStoredGoogleSheetsConfig, 
  saveGoogleSheetsConfig, 
  getStoredOAuthToken, 
  saveOAuthToken, 
  clearOAuthToken, 
  extractSpreadsheetId, 
  fetchGoogleSheetViaGViz, 
  fetchGoogleSheetViaAPI, 
  pushAccountsToGoogleSheet, 
  createNewGoogleSpreadsheet, 
  listUserGoogleSheets, 
  parseSheetRowsToAccounts,
  getGoogleSyncHistory,
  addGoogleSyncLog,
  clearGoogleSyncHistory,
  requestGoogleOAuthToken,
  STANDARD_SHEET_HEADERS
} from '../services/googleSheetsService';
import confetti from 'canvas-confetti';

interface GoogleSheetsDatabaseViewProps {
  accounts: CustomerAccount[];
  onImportAccounts: (imported: CustomerAccount[], mode: 'merge' | 'replace') => void;
  onUpdateAccount: (updated: CustomerAccount, changedFields: string[], oldPhone: string, oldEmail: string) => void;
  onNavigateToLookup?: (noAkaun: string) => void;
}

export const GoogleSheetsDatabaseView: React.FC<GoogleSheetsDatabaseViewProps> = ({
  accounts,
  onImportAccounts,
  onUpdateAccount,
  onNavigateToLookup,
}) => {
  const { showSuccess, showError, showWarning, showInfo } = useToast();

  // Config State
  const [config, setConfig] = useState<GoogleSheetsConfig>(getStoredGoogleSheetsConfig);
  const [spreadsheetInput, setSpreadsheetInput] = useState<string>(config.spreadsheetId || config.spreadsheetUrl || '');
  const [sheetNameInput, setSheetNameInput] = useState<string>(config.sheetName || 'Sheet1');
  const [appsScriptInput, setAppsScriptInput] = useState<string>(config.appsScriptUrl || '');
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(config.autoSyncOnUpdate ?? true);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Authentication & OAuth State
  const [hasOAuthToken, setHasOAuthToken] = useState<boolean>(() => Boolean(getStoredOAuthToken()));
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [userEmail, setUserEmail] = useState<string>(() => localStorage.getItem('customer_portal_gs_email') || '');
  const [driveSheets, setDriveSheets] = useState<GoogleDriveSheetFile[]>([]);
  const [isLoadingDriveFiles, setIsLoadingDriveFiles] = useState<boolean>(false);

  // Sync / Operation loading states
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isCreatingNewSheet, setIsCreatingNewSheet] = useState<boolean>(false);
  const [newSheetTitle, setNewSheetTitle] = useState<string>('Pangkalan Data Pelanggan GlideStock');

  // Preview & Tab State
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'preview' | 'drive_picker' | 'history' | 'setup_guide'>('overview');
  const [sheetPreviewRows, setSheetPreviewRows] = useState<any[][]>([]);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [previewAccounts, setPreviewAccounts] = useState<CustomerAccount[]>([]);
  const [searchPreview, setSearchPreview] = useState<string>('');
  const [syncHistory, setSyncHistory] = useState<GoogleSyncHistoryEntry[]>(getGoogleSyncHistory);

  // Refresh history logs
  const refreshHistory = () => {
    setSyncHistory(getGoogleSyncHistory());
  };

  // Sync config changes to storage
  const updateConfigState = (newConfig: Partial<GoogleSheetsConfig>) => {
    const updated = { ...config, ...newConfig };
    setConfig(updated);
    saveGoogleSheetsConfig(updated);
  };

  // Fetch Drive Files if OAuth is active
  const loadDriveFiles = async () => {
    if (!hasOAuthToken) return;
    setIsLoadingDriveFiles(true);
    try {
      const files = await listUserGoogleSheets();
      setDriveSheets(files);
    } catch (e) {
      console.warn('Could not list drive sheets:', e);
    } finally {
      setIsLoadingDriveFiles(false);
    }
  };

  useEffect(() => {
    if (hasOAuthToken) {
      loadDriveFiles();
    }
  }, [hasOAuthToken]);

  // Handle Google OAuth Sign In
  const handleGoogleSignIn = async () => {
    setIsAuthenticating(true);
    try {
      // Check if google gsi is loaded
      const google = (window as any).google;
      if (!google?.accounts?.oauth2) {
        showInfo('Menyambung Google Identity Services', 'Sila tunggu beberapa saat untuk pemuatan skrip keselamatan Google.');
      }

      const token = await requestGoogleOAuthToken();
      if (token) {
        setHasOAuthToken(true);
        updateConfigState({ isConnected: true, authMethod: 'oauth' });
        showSuccess('Sambungan Google Berjaya', 'Akaun Google anda berjaya disambungkan untuk Google Sheets & Google Drive.');
        addGoogleSyncLog('SAMBUNG_FAIL', 'BERJAYA', 'Akaun Google berjaya disambungkan melalui OAuth 2.0.');
        refreshHistory();
        loadDriveFiles();
      }
    } catch (err: any) {
      console.warn('OAuth sign in error:', err);
      showWarning(
        'Mod Sambungan Pautan Google Sheets',
        'Anda juga boleh menghubungkan Google Sheets dengan mudah melalui pautan/URL helaian yang dikongsi.'
      );
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Handle Disconnect
  const handleDisconnect = () => {
    clearOAuthToken();
    setHasOAuthToken(false);
    updateConfigState({
      isConnected: false,
      spreadsheetId: '',
      spreadsheetUrl: '',
      lastSyncTime: undefined,
    });
    setSpreadsheetInput('');
    setDriveSheets([]);
    showInfo('Sambungan Diputuskan', 'Pangkalan data Google Sheets telah dinyahsambung daripada sistem.');
    addGoogleSyncLog('SAMBUNG_FAIL', 'BERJAYA', 'Sambungan Google Sheets diputuskan oleh pentadbir.');
    refreshHistory();
  };

  // Connect via Sheet ID / URL directly
  const handleConnectSheet = async (customIdOrUrl?: string) => {
    const rawInput = customIdOrUrl || spreadsheetInput;
    const cleanId = extractSpreadsheetId(rawInput);

    if (!cleanId) {
      showError('Input Tidak Sah', 'Sila masukkan pautan URL Google Sheet atau ID helaian yang betul.');
      return;
    }

    setIsSyncing(true);
    try {
      // Test read first
      let rows: any[][] = [];
      let sheetTitle = 'Google Sheet Pelanggan';

      if (hasOAuthToken) {
        try {
          const apiRes = await fetchGoogleSheetViaAPI(cleanId, `${sheetNameInput}!A1:Z100`);
          rows = apiRes.rows;
          sheetTitle = apiRes.title;
        } catch (apiErr) {
          // Fallback to GViz
          rows = await fetchGoogleSheetViaGViz(cleanId, sheetNameInput);
        }
      } else {
        rows = await fetchGoogleSheetViaGViz(cleanId, sheetNameInput);
      }

      const parsed = parseSheetRowsToAccounts(rows);
      
      const newConfig: GoogleSheetsConfig = {
        spreadsheetId: cleanId,
        spreadsheetName: sheetTitle,
        sheetName: sheetNameInput,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${cleanId}/edit`,
        autoSyncOnUpdate: autoSyncEnabled,
        isConnected: true,
        authMethod: appsScriptInput.trim() ? 'apps_script' : (hasOAuthToken ? 'oauth' : 'shared_link'),
        appsScriptUrl: appsScriptInput.trim() || undefined,
        totalSyncedRows: parsed.totalRows,
        lastSyncTime: new Date().toISOString().replace('T', ' ').slice(0, 16),
      };

      setConfig(newConfig);
      saveGoogleSheetsConfig(newConfig);
      setSheetPreviewRows(rows);
      setPreviewHeaders(parsed.detectedHeaders);
      setPreviewAccounts(parsed.accounts);

      showSuccess(
        'Google Sheet Berjaya Dihubungkan!',
        `Pangkalan data dihubungkan ke "${sheetTitle}" dengan ${parsed.totalRows} baris rekod.`
      );
      addGoogleSyncLog('SAMBUNG_FAIL', 'BERJAYA', `Berjaya menyambung ke "${sheetTitle}" (${cleanId}).`, parsed.totalRows);
      refreshHistory();
      setActiveSubTab('overview');
    } catch (err: any) {
      showError(
        'Gagal Menghubungkan Google Sheet',
        err.message || 'Sila pastikan akses fail ditetapkan kepada "Anyone with the link can view/edit" atau log masuk akaun Google.'
      );
      addGoogleSyncLog('SAMBUNG_FAIL', 'RALAT', `Gagal menyambung: ${err.message}`);
      refreshHistory();
    } finally {
      setIsSyncing(false);
    }
  };

  // Pull / Fetch latest data from Google Sheets
  const handlePullData = async (mode: 'merge' | 'replace' = 'merge') => {
    if (!config.spreadsheetId) {
      showWarning('Tiada Helaian Dihubungkan', 'Sila hubungkan Google Sheet terlebih dahulu.');
      return;
    }

    setIsSyncing(true);
    try {
      let rows: any[][] = [];
      if (hasOAuthToken) {
        try {
          const apiRes = await fetchGoogleSheetViaAPI(config.spreadsheetId, `${config.sheetName || 'Sheet1'}!A1:Z5000`);
          rows = apiRes.rows;
        } catch {
          rows = await fetchGoogleSheetViaGViz(config.spreadsheetId, config.sheetName || 'Sheet1');
        }
      } else {
        rows = await fetchGoogleSheetViaGViz(config.spreadsheetId, config.sheetName || 'Sheet1');
      }

      const parsed = parseSheetRowsToAccounts(rows);
      if (parsed.accounts.length === 0) {
        showWarning('Helaian Kosong', 'Tiada rekod data dijumpai dalam helaian tersebut.');
        return;
      }

      // Import to global accounts
      onImportAccounts(parsed.accounts, mode);

      const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
      updateConfigState({
        totalSyncedRows: parsed.accounts.length,
        lastSyncTime: now
      });

      setSheetPreviewRows(rows);
      setPreviewHeaders(parsed.detectedHeaders);
      setPreviewAccounts(parsed.accounts);

      showSuccess(
        'Data Google Sheets Berjaya Ditarik! 📥',
        `Sebanyak ${parsed.accounts.length} rekod akaun pelanggan berjaya diselaraskan ke dalam sistem (${mode === 'replace' ? 'Ganti Penuh' : 'Gabung'}).`
      );
      addGoogleSyncLog('TARIK_DATA', 'BERJAYA', `Menarik ${parsed.accounts.length} rekod dari Google Sheets.`, parsed.accounts.length);
      refreshHistory();

      try {
        confetti({
          particleCount: 40,
          spread: 60,
          origin: { y: 0.7 }
        });
      } catch {}
    } catch (err: any) {
      showError('Ralat Penyelarasan Google Sheets', err.message || 'Gagal menarik data dari Google Sheets.');
      addGoogleSyncLog('TARIK_DATA', 'RALAT', `Gagal menarik data: ${err.message}`);
      refreshHistory();
    } finally {
      setIsSyncing(false);
    }
  };

  // Push / Write all local accounts to Google Sheets
  const handlePushData = async () => {
    if (!config.spreadsheetId) {
      showWarning('Tiada Helaian Dihubungkan', 'Sila hubungkan Google Sheet terlebih dahulu.');
      return;
    }

    if (accounts.length === 0) {
      showWarning('Pangkalan Data Kosong', 'Tiada data akaun dalam sistem untuk dihantar ke Google Sheets.');
      return;
    }

    if (!hasOAuthToken) {
      showWarning(
        'Kebenaran Menulis Google Diperlukan',
        'Untuk menghantar data terus ke Google Sheets, sila log masuk dengan Google OAuth atau gunakan butang Eksport Excel.'
      );
      // Offer Google login
      handleGoogleSignIn();
      return;
    }

    setIsSyncing(true);
    try {
      const res = await pushAccountsToGoogleSheet(
        config.spreadsheetId,
        accounts,
        config.sheetName || 'Sheet1'
      );

      const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
      updateConfigState({
        totalSyncedRows: res.updatedRows,
        lastSyncTime: now
      });

      showSuccess(
        'Data Berjaya Dihantar ke Google Sheets! 🚀',
        `Sebanyak ${res.updatedRows} baris rekod akaun telah dikemaskini dalam Google Sheets anda.`
      );
      addGoogleSyncLog('HANTAR_DATA', 'BERJAYA', `Menghantar ${res.updatedRows} rekod ke Google Sheets.`, res.updatedRows);
      refreshHistory();

      try {
        confetti({
          particleCount: 50,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch {}
    } catch (err: any) {
      showError('Ralat Menulis ke Google Sheets', err.message || 'Gagal menghantar data ke Google Sheets.');
      addGoogleSyncLog('HANTAR_DATA', 'RALAT', `Gagal menghantar data: ${err.message}`);
      refreshHistory();
    } finally {
      setIsSyncing(false);
    }
  };

  // Create brand new Google Sheet in Drive
  const handleCreateNewSheet = async () => {
    if (!hasOAuthToken) {
      showWarning('Log Masuk Diperlukan', 'Sila log masuk dengan akaun Google terlebih dahulu untuk mencipta fail di Google Drive anda.');
      await handleGoogleSignIn();
      return;
    }

    setIsCreatingNewSheet(true);
    try {
      const newSheet = await createNewGoogleSpreadsheet(
        newSheetTitle.trim() || 'Pangkalan Data Pelanggan GlideStock',
        accounts
      );

      const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
      const newConfig: GoogleSheetsConfig = {
        spreadsheetId: newSheet.spreadsheetId,
        spreadsheetName: newSheet.title,
        sheetName: 'Pangkalan_Data_Akaun',
        spreadsheetUrl: newSheet.spreadsheetUrl,
        autoSyncOnUpdate: autoSyncEnabled,
        isConnected: true,
        authMethod: 'oauth',
        totalSyncedRows: accounts.length + 1,
        lastSyncTime: now,
      };

      setConfig(newConfig);
      saveGoogleSheetsConfig(newConfig);
      setSpreadsheetInput(newSheet.spreadsheetId);

      showSuccess(
        'Google Sheet Baru Berjaya Dicipta! ✨',
        `Fail "${newSheet.title}" telah dicipta di Google Drive anda dengan ${accounts.length} rekod akaun.`
      );
      addGoogleSyncLog('CIPTA_HELAIAN', 'BERJAYA', `Mencipta Google Sheet baru "${newSheet.title}".`, accounts.length);
      refreshHistory();
      loadDriveFiles();

      try {
        confetti({
          particleCount: 60,
          spread: 80,
          origin: { y: 0.6 }
        });
      } catch {}
    } catch (err: any) {
      showError('Ralat Mencipta Google Sheet', err.message || 'Gagal mencipta helaian baru di Google Drive.');
      addGoogleSyncLog('CIPTA_HELAIAN', 'RALAT', `Gagal mencipta helaian: ${err.message}`);
      refreshHistory();
    } finally {
      setIsCreatingNewSheet(false);
    }
  };

  // Filter preview accounts
  const filteredPreviewAccounts = useMemo(() => {
    if (!searchPreview.trim()) return previewAccounts.length > 0 ? previewAccounts : accounts;
    const q = searchPreview.toLowerCase();
    const list = previewAccounts.length > 0 ? previewAccounts : accounts;
    return list.filter(a => 
      a.noAkaun.toLowerCase().includes(q) ||
      a.nama.toLowerCase().includes(q) ||
      a.noTel.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      (a.kadPengenalan && a.kadPengenalan.toLowerCase().includes(q))
    );
  }, [searchPreview, previewAccounts, accounts]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Hero Banner & Status Card */}
      <div className="bg-white border border-stone-300 rounded-3xl p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-[#1A1A1A] text-white text-[10px] uppercase font-mono font-bold px-2.5 py-1 rounded tracking-wider flex items-center gap-1.5">
                <Database className="w-3 h-3 text-emerald-400" />
                Pangkalan Data Google Sheets
              </span>
              
              {config.isConnected ? (
                <span className="bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Bersambung ({config.spreadsheetName || 'Helaian Aktif'})
                </span>
              ) : (
                <span className="bg-stone-100 text-stone-600 border border-stone-300 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-stone-400" />
                  Belum Dihubungkan
                </span>
              )}

              {config.autoSyncOnUpdate && (
                <span className="bg-amber-50 text-amber-900 border border-amber-300 text-[11px] font-mono font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-600" />
                  Auto-Sync Aktif
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-serif-heading font-bold text-stone-900 tracking-tight">
              Penyelarasan Pangkalan Data Google Sheets
            </h1>
            <p className="text-xs sm:text-sm text-stone-600 max-w-2xl leading-relaxed">
              Hubungkan helaian Google Sheets secara terus sebagai sumber pangkalan data (database) langsung untuk sistem ini. Kemaskini profil nombor telefon & email pelanggan boleh diselaraskan dua hala secara automatik.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {config.isConnected && config.spreadsheetUrl && (
              <a
                href={config.spreadsheetUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-semibold border border-stone-300 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Buka Google Sheets dalam tab baru"
              >
                <ExternalLink className="w-4 h-4 text-emerald-600" />
                <span className="hidden sm:inline">Buka Google Sheets</span>
              </a>
            )}

            <button
              onClick={() => handlePullData('merge')}
              disabled={!config.isConnected || isSyncing}
              className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 border border-emerald-800 cursor-pointer"
            >
              <ArrowDownToLine className={`w-4 h-4 ${isSyncing ? 'animate-bounce' : ''}`} />
              <span>Tarik Data (Pull)</span>
            </button>

            <button
              onClick={handlePushData}
              disabled={!config.isConnected || isSyncing || accounts.length === 0}
              className="px-4 py-2.5 bg-[#1A1A1A] hover:bg-black disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 border border-stone-800 cursor-pointer"
            >
              <ArrowUpFromLine className={`w-4 h-4 ${isSyncing ? 'animate-bounce' : ''}`} />
              <span>Hantar Data (Push)</span>
            </button>
          </div>
        </div>

        {/* Live Status Bar when connected */}
        {config.isConnected && (
          <div className="mt-5 pt-4 border-t border-stone-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="bg-stone-50 p-3 rounded-xl border border-stone-200">
              <span className="text-stone-500 text-[10px] font-mono uppercase block">Nama Fail Helaian</span>
              <span className="font-bold text-stone-900 font-serif-heading text-sm truncate block mt-0.5">
                {config.spreadsheetName || 'Pangkalan Data Pelanggan'}
              </span>
            </div>

            <div className="bg-stone-50 p-3 rounded-xl border border-stone-200">
              <span className="text-stone-500 text-[10px] font-mono uppercase block">Nama Tab Helaian</span>
              <span className="font-bold text-stone-900 font-mono text-xs block mt-1">
                📑 {config.sheetName || 'Sheet1'}
              </span>
            </div>

            <div className="bg-stone-50 p-3 rounded-xl border border-stone-200">
              <span className="text-stone-500 text-[10px] font-mono uppercase block">Rekod Diselaraskan</span>
              <span className="font-bold text-emerald-800 font-mono text-sm block mt-0.5">
                {accounts.length} Akaun Pelanggan
              </span>
            </div>

            <div className="bg-stone-50 p-3 rounded-xl border border-stone-200">
              <span className="text-stone-500 text-[10px] font-mono uppercase block">Penyelarasan Terakhir</span>
              <span className="font-semibold text-stone-700 font-mono text-[11px] block mt-1">
                🕒 {config.lastSyncTime || 'Baru selesai'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Sub Tab Navigation */}
      <div className="flex border-b border-stone-300 space-x-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveSubTab('overview')}
          className={`px-4 py-2 text-xs sm:text-sm font-serif-heading font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'overview'
              ? 'bg-white text-stone-900 border-t border-x border-stone-300 shadow-2xs -mb-px'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Settings className="w-4 h-4 text-stone-700" />
          <span>Konfigurasi & Sambungan</span>
        </button>

        <button
          onClick={() => {
            setActiveSubTab('preview');
            if (sheetPreviewRows.length === 0 && config.spreadsheetId) {
              handleConnectSheet();
            }
          }}
          className={`px-4 py-2 text-xs sm:text-sm font-serif-heading font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'preview'
              ? 'bg-white text-stone-900 border-t border-x border-stone-300 shadow-2xs -mb-px'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <TableProperties className="w-4 h-4 text-emerald-600" />
          <span>Pratonton Pangkalan Data ({accounts.length})</span>
        </button>

        {hasOAuthToken && (
          <button
            onClick={() => {
              setActiveSubTab('drive_picker');
              loadDriveFiles();
            }}
            className={`px-4 py-2 text-xs sm:text-sm font-serif-heading font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'drive_picker'
                ? 'bg-white text-stone-900 border-t border-x border-stone-300 shadow-2xs -mb-px'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <FolderOpen className="w-4 h-4 text-amber-600" />
            <span>Pilih Fail dari Google Drive</span>
          </button>
        )}

        <button
          onClick={() => {
            setActiveSubTab('history');
            refreshHistory();
          }}
          className={`px-4 py-2 text-xs sm:text-sm font-serif-heading font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'history'
              ? 'bg-white text-stone-900 border-t border-x border-stone-300 shadow-2xs -mb-px'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <History className="w-4 h-4 text-stone-600" />
          <span>Log Penyelarasan ({syncHistory.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('setup_guide')}
          className={`px-4 py-2 text-xs sm:text-sm font-serif-heading font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'setup_guide'
              ? 'bg-white text-stone-900 border-t border-x border-stone-300 shadow-2xs -mb-px'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-600" />
          <span>Panduan Sambungan</span>
        </button>
      </div>

      {/* SUB-TAB 1: Overview & Configuration */}
      {activeSubTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Setup Card */}
          <div className="lg:col-span-7 space-y-6">
            {/* Box 1: Hubungkan Google Sheet Sedia Ada */}
            <div className="bg-white border border-stone-300 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-bold">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-serif-heading font-bold text-base text-stone-900">
                      1. Hubungkan Google Sheet Sedia Ada
                    </h3>
                    <p className="text-xs text-stone-500">
                      Masukkan pautan URL helaian Google Sheets atau ID fail spreadsheet.
                    </p>
                  </div>
                </div>

                {config.isConnected && (
                  <button
                    onClick={handleDisconnect}
                    className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2.5 py-1 rounded-lg font-medium border border-red-200 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                    <span>Putuskan</span>
                  </button>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-800 mb-1.5">
                    Pautan URL Google Sheet / ID Fail
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={spreadsheetInput}
                      onChange={(e) => setSpreadsheetInput(e.target.value)}
                      placeholder="Contoh: https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5.../edit"
                      className="w-full pl-9 pr-4 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm font-mono text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-900 transition-all"
                    />
                    <Link2 className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                  </div>
                  <p className="text-[11px] text-stone-500 mt-1">
                    Pastikan kebenaran perkongsian Google Sheet ditetapkan kepada <strong className="text-stone-800">"Anyone with the link can view/edit"</strong>.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-800 mb-1.5">
                      Nama Tab Helaian (Sheet Name)
                    </label>
                    <input
                      type="text"
                      value={sheetNameInput}
                      onChange={(e) => setSheetNameInput(e.target.value)}
                      placeholder="Contoh: Sheet1 atau Pangkalan_Data"
                      className="w-full px-3.5 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs font-mono text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-900"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={() => handleConnectSheet()}
                      disabled={isSyncing || !spreadsheetInput.trim()}
                      className="w-full px-4 py-2 bg-[#1A1A1A] hover:bg-black disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-2xs transition-all flex items-center justify-center gap-2 border border-stone-800 cursor-pointer h-[38px]"
                    >
                      <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>{config.isConnected ? 'Uji & Sambung Semula' : 'Hubungkan Helaian'}</span>
                    </button>
                  </div>
                </div>

                {/* Optional Apps Script Webhook URL */}
                <div className="pt-2 border-t border-stone-200">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-stone-800">
                      Pautan Webhook Google Apps Script <span className="text-stone-400 font-normal">(Pilihan: 2-Way Sync Universal)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setActiveSubTab('setup_guide')}
                      className="text-[11px] text-indigo-700 hover:text-indigo-900 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      <span>Cara Dapatkan Kod Skrip</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={appsScriptInput}
                      onChange={(e) => {
                        setAppsScriptInput(e.target.value);
                        updateConfigState({ appsScriptUrl: e.target.value.trim() });
                      }}
                      placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
                      className="w-full px-3.5 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs font-mono text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    />
                  </div>
                  <p className="text-[10px] text-stone-500 mt-1">
                    Membolehkan peranti pelanggan di <code className="bg-stone-100 px-1 py-0.5 rounded text-stone-800 font-mono">kemaskiniprofile.pages.dev</code> mengemaskini terus ke Google Sheet tanpa meminta log masuk Google.
                  </p>
                </div>

                {/* Cloud Sync Status Notice */}
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-emerald-900">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-serif-heading font-bold text-emerald-950">
                      ⚡ Sambungan Awan Automatik (Cloud-Synced)
                    </strong>
                    <span className="text-[11px] text-emerald-800 leading-relaxed">
                      Sebaik sahaja helaian Google Sheet ini disambungkan di sini, sambungan ini akan <strong>disegerakkan serta-merta ke Cloud Firestore</strong>. Semua peranti lain dan pelanggan di <em>https://kemaskiniprofile.pages.dev</em> boleh terus menyemak rekod mereka secara langsung!
                    </span>
                  </div>
                </div>

                {/* Auto-Sync on Update Toggle */}
                <div className="bg-stone-50 border border-stone-200/90 rounded-xl p-3.5 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-stone-900 font-serif-heading flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      Penyelarasan Automatik Masa Nyata (Live Auto-Sync)
                    </span>
                    <p className="text-[11px] text-stone-600">
                      Apabila pelanggan mengemaskini nombor telefon atau email di portal, helaian Google Sheet akan dikemaskini serta-merta.
                    </p>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoSyncEnabled}
                      onChange={(e) => {
                        setAutoSyncEnabled(e.target.checked);
                        updateConfigState({ autoSyncOnUpdate: e.target.checked });
                        showSuccess(
                          'Tetapan Dikemaskini',
                          `Auto-sync ke Google Sheets ${e.target.checked ? 'diaktifkan' : 'dimatikan'}.`
                        );
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Box 2: Cipta Google Sheet Baru secara Automatik */}
            <div className="bg-white border border-stone-300 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center font-bold">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif-heading font-bold text-base text-stone-900">
                    2. Cipta Google Sheet Baru di Google Drive
                  </h3>
                  <p className="text-xs text-stone-500">
                    Cipta fail Google Sheets baru dengan susun atur lajur standard dan eksport {accounts.length} akaun sedia ada.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-800 mb-1">
                    Tajuk Fail Google Sheet Baru
                  </label>
                  <input
                    type="text"
                    value={newSheetTitle}
                    onChange={(e) => setNewSheetTitle(e.target.value)}
                    placeholder="Pangkalan Data Pelanggan GlideStock"
                    className="w-full px-3.5 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs font-sans text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-900"
                  />
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2.5">
                  <button
                    onClick={handleCreateNewSheet}
                    disabled={isCreatingNewSheet}
                    className="w-full sm:w-auto px-4 py-2.5 bg-stone-900 hover:bg-black disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <PlusCircle className={`w-4 h-4 ${isCreatingNewSheet ? 'animate-spin' : ''}`} />
                    <span>Cipta & Hubungkan ke Google Drive</span>
                  </button>

                  <button
                    onClick={() => {
                      const csvHeader = STANDARD_SHEET_HEADERS.join('\t');
                      navigator.clipboard.writeText(csvHeader);
                      showSuccess('Disalin!', 'Struktur tajuk lajur standard berjaya disalin ke papan keratan (clipboard).');
                    }}
                    className="w-full sm:w-auto px-3.5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold border border-stone-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin Tajuk Lajur Standard</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Google Account Auth & Quick Sync Actions */}
          <div className="lg:col-span-5 space-y-6">
            {/* Google OAuth Account Card */}
            <div className="bg-white border border-stone-300 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-stone-500">
                  Pengesahan Akaun Google
                </span>
                {hasOAuthToken ? (
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    OAuth 2.0 Aktif
                  </span>
                ) : (
                  <span className="bg-stone-100 text-stone-600 text-[10px] font-medium px-2 py-0.5 rounded-full">
                    Pilihan Tambahan
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <h4 className="font-serif-heading font-bold text-base text-stone-900">
                  Google Workspace & Drive
                </h4>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Log masuk dengan akaun Google untuk membolehkan penciptaan fail langsung di Google Drive, penyenaraian helaian automatik dan kemaskini terus tanpa perlu menetapkan akses umum pada helaian.
                </p>
              </div>

              <div className="pt-2">
                {hasOAuthToken ? (
                  <div className="space-y-3">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="font-medium font-mono text-[11px]">Sesi OAuth Google Tersambung</span>
                      </div>
                      <button
                        onClick={handleDisconnect}
                        className="text-[11px] text-emerald-800 underline hover:text-red-700 cursor-pointer"
                      >
                        Log Keluar
                      </button>
                    </div>

                    <button
                      onClick={() => {
                        setActiveSubTab('drive_picker');
                        loadDriveFiles();
                      }}
                      className="w-full px-3.5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-semibold border border-stone-300 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <FolderOpen className="w-4 h-4 text-amber-600" />
                      <span>Lihat Fail Google Sheets di Drive</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleGoogleSignIn}
                    disabled={isAuthenticating}
                    className="w-full px-4 py-2.5 bg-white hover:bg-stone-50 text-stone-800 rounded-xl text-xs font-bold shadow-2xs border border-stone-300 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>{isAuthenticating ? 'Menyambung...' : 'Sambung dengan Akaun Google'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Sync Control Card */}
            <div className="bg-stone-900 text-stone-100 rounded-2xl p-5 sm:p-6 shadow-md space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h4 className="font-serif-heading font-bold text-base text-white">
                  Tindakan Penyelarasan Pangkalan Data
                </h4>
              </div>

              <p className="text-xs text-stone-300 leading-relaxed">
                Pilih mod penyelarasan untuk memindahkan rekod data di antara sistem dan helaian Google Sheets.
              </p>

              <div className="space-y-2.5 pt-1">
                <button
                  onClick={() => handlePullData('merge')}
                  disabled={!config.isConnected || isSyncing}
                  className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-between cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <ArrowDownToLine className="w-4 h-4" />
                    <span>Tarik & Gabung Data (Pull & Merge)</span>
                  </span>
                  <span className="text-[10px] font-mono opacity-80">Dari Google Sheet</span>
                </button>

                <button
                  onClick={() => handlePullData('replace')}
                  disabled={!config.isConnected || isSyncing}
                  className="w-full px-4 py-2.5 bg-stone-800 hover:bg-stone-700 disabled:opacity-50 text-stone-200 rounded-xl text-xs font-semibold transition-colors flex items-center justify-between cursor-pointer border border-stone-700"
                >
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-amber-400" />
                    <span>Ganti Penuh dengan Data Helaian</span>
                  </span>
                  <span className="text-[10px] font-mono opacity-80">Pangkalan Penuh</span>
                </button>

                <button
                  onClick={handlePushData}
                  disabled={!config.isConnected || isSyncing || accounts.length === 0}
                  className="w-full px-4 py-2.5 bg-white hover:bg-stone-100 disabled:opacity-50 text-stone-900 rounded-xl text-xs font-bold transition-colors flex items-center justify-between cursor-pointer shadow-xs"
                >
                  <span className="flex items-center gap-2">
                    <ArrowUpFromLine className="w-4 h-4 text-emerald-600" />
                    <span>Hantar Semua Data ke Google Sheet</span>
                  </span>
                  <span className="text-[10px] font-mono text-stone-600">{accounts.length} Rekod</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: Live Preview & Search */}
      {activeSubTab === 'preview' && (
        <div className="bg-white border border-stone-300 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-serif-heading font-bold text-lg text-stone-900">
                Pratonton Pangkalan Data Google Sheets
              </h3>
              <p className="text-xs text-stone-500">
                Memaparkan rekod data aktif yang bersambung dengan Google Sheets ({filteredPreviewAccounts.length} rekod).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  value={searchPreview}
                  onChange={(e) => setSearchPreview(e.target.value)}
                  placeholder="Cari akaun, nama, telefon..."
                  className="w-full pl-8 pr-3 py-1.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-sans text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-900"
                />
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
              </div>

              <button
                onClick={() => handlePullData('merge')}
                disabled={!config.isConnected || isSyncing}
                className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl border border-stone-300 transition-colors cursor-pointer"
                title="Muat Semula Pratonton dari Google Sheets"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="border border-stone-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#FAF9F6] border-b border-stone-200 text-stone-700 sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3 font-mono font-bold uppercase text-[10px] tracking-wider text-stone-500">No. Akaun</th>
                    <th className="py-2.5 px-3 font-serif-heading font-bold text-stone-900">Nama Pelanggan</th>
                    <th className="py-2.5 px-3 font-mono text-stone-700">No. Kad Pengenalan</th>
                    <th className="py-2.5 px-3 font-mono text-emerald-900 font-bold bg-emerald-50/50">No. Telefon (Editable)</th>
                    <th className="py-2.5 px-3 font-mono text-emerald-900 font-bold bg-emerald-50/50">Alamat Email (Editable)</th>
                    <th className="py-2.5 px-3 font-mono text-stone-600">Kategori</th>
                    <th className="py-2.5 px-3 font-mono text-stone-600">Status</th>
                    <th className="py-2.5 px-3 font-mono text-stone-600">Kemaskini</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 bg-white">
                  {filteredPreviewAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-stone-500 text-xs">
                        Tiada rekod data dijumpai. Sila hubungkan Google Sheet atau tarik data terlebih dahulu.
                      </td>
                    </tr>
                  ) : (
                    filteredPreviewAccounts.map((acc) => (
                      <tr 
                        key={acc.noAkaun}
                        className={`hover:bg-stone-50/80 transition-colors ${
                          acc.telahDikemaskini ? 'bg-emerald-50/30' : ''
                        }`}
                      >
                        <td className="py-2 px-3 font-mono font-bold text-stone-900">
                          {acc.noAkaun}
                        </td>
                        <td className="py-2 px-3 font-serif-heading font-semibold text-stone-900">
                          {acc.nama}
                        </td>
                        <td className="py-2 px-3 font-mono text-stone-600">
                          {acc.kadPengenalan || '-'}
                        </td>
                        <td className="py-2 px-3 font-mono font-medium text-emerald-950 bg-emerald-50/20">
                          {acc.noTel || <span className="text-stone-400 italic font-sans text-[11px]">Belum diisi</span>}
                        </td>
                        <td className="py-2 px-3 font-mono font-medium text-emerald-950 bg-emerald-50/20">
                          {acc.email || <span className="text-stone-400 italic font-sans text-[11px]">Belum diisi</span>}
                        </td>
                        <td className="py-2 px-3 text-stone-600 font-medium text-[11px]">
                          {acc.kategoriAkaun || 'Kediaman'}
                        </td>
                        <td className="py-2 px-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            acc.status === 'Aktif'
                              ? 'bg-emerald-100 text-emerald-800'
                              : acc.status === 'Tertunggak'
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-stone-100 text-stone-700'
                          }`}>
                            {acc.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono text-[10px] text-stone-500">
                          {acc.telahDikemaskini ? (
                            <span className="text-emerald-700 font-bold flex items-center gap-1">
                              <Check className="w-3 h-3 text-emerald-600" />
                              Dikemaskini
                            </span>
                          ) : (
                            <span>Asal</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: Google Drive Sheet Picker */}
      {activeSubTab === 'drive_picker' && (
        <div className="bg-white border border-stone-300 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-serif-heading font-bold text-lg text-stone-900">
                Pilih Fail Google Sheets daripada Google Drive
              </h3>
              <p className="text-xs text-stone-500">
                Pilih fail spreadsheet daripada akaun Google Drive anda untuk disambungkan terus ke portal ini.
              </p>
            </div>

            <button
              onClick={loadDriveFiles}
              disabled={isLoadingDriveFiles}
              className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-semibold border border-stone-300 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDriveFiles ? 'animate-spin' : ''}`} />
              <span>Muat Semula Drive</span>
            </button>
          </div>

          {isLoadingDriveFiles ? (
            <div className="py-12 text-center text-stone-500 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-stone-400 mb-2" />
              <span>Mengimbas fail Google Sheets di Google Drive anda...</span>
            </div>
          ) : driveSheets.length === 0 ? (
            <div className="py-10 text-center bg-stone-50 rounded-xl border border-stone-200 text-stone-600 text-xs space-y-2">
              <FileSpreadsheet className="w-8 h-8 text-stone-400 mx-auto" />
              <p className="font-semibold text-stone-800">Tiada fail Google Sheets dijumpai di Google Drive.</p>
              <p className="text-[11px] text-stone-500 max-w-md mx-auto">
                Anda boleh mencipta fail Google Sheets baru secara automatik dengan klik butang di bawah.
              </p>
              <button
                onClick={handleCreateNewSheet}
                className="mt-2 px-4 py-2 bg-stone-900 hover:bg-black text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                + Cipta Google Sheet Baru
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {driveSheets.map((file) => {
                const isSelected = config.spreadsheetId === file.id;
                return (
                  <div
                    key={file.id}
                    className={`border rounded-xl p-4 transition-all flex flex-col justify-between space-y-3 ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/40 shadow-xs ring-1 ring-emerald-500'
                        : 'border-stone-200 bg-stone-50/50 hover:bg-white hover:border-stone-300'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                        {isSelected && (
                          <span className="bg-emerald-600 text-white text-[9px] font-mono font-bold px-2 py-0.5 rounded-full">
                            Aktif
                          </span>
                        )}
                      </div>
                      <h4 className="font-serif-heading font-bold text-stone-900 text-sm line-clamp-1">
                        {file.name}
                      </h4>
                      <p className="text-[10px] font-mono text-stone-500 truncate">
                        ID: {file.id}
                      </p>
                      {file.modifiedTime && (
                        <p className="text-[10px] text-stone-400">
                          Diubah: {new Date(file.modifiedTime).toLocaleDateString('ms-MY')}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-stone-200/80">
                      <button
                        onClick={() => handleConnectSheet(file.id)}
                        disabled={isSyncing}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-700 text-white'
                            : 'bg-[#1A1A1A] hover:bg-black text-white'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{isSelected ? 'Tersambung' : 'Pilih Fail Ini'}</span>
                      </button>

                      {file.webViewLink && (
                        <a
                          href={file.webViewLink}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 text-stone-600 hover:text-stone-900 bg-white border border-stone-300 rounded-lg"
                          title="Buka dalam Google Sheets"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 4: Sync History Logs */}
      {activeSubTab === 'history' && (
        <div className="bg-white border border-stone-300 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-serif-heading font-bold text-lg text-stone-900">
                Log Penyelarasan Pangkalan Data Google Sheets
              </h3>
              <p className="text-xs text-stone-500">
                Rekod semua aktiviti penghantaran data, penarikan maklumat dan perubahan sambungan Google Sheets.
              </p>
            </div>

            {syncHistory.length > 0 && (
              <button
                onClick={() => {
                  clearGoogleSyncHistory();
                  refreshHistory();
                  showInfo('Log Dikosongkan', 'Rekod sejarah penyelarasan Google Sheets telah dikosongkan.');
                }}
                className="text-xs text-stone-500 hover:text-red-700 flex items-center gap-1 px-2.5 py-1 rounded-lg border border-stone-200 hover:bg-red-50 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Padam Log</span>
              </button>
            )}
          </div>

          <div className="border border-stone-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto max-h-[450px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#FAF9F6] border-b border-stone-200 text-stone-700 sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3 font-mono font-bold uppercase text-[10px] tracking-wider text-stone-500">Masa</th>
                    <th className="py-2.5 px-3 font-serif-heading font-bold text-stone-900">Tindakan</th>
                    <th className="py-2.5 px-3 font-mono text-stone-700">Status</th>
                    <th className="py-2.5 px-3 font-sans text-stone-700">Keterangan Aktiviti</th>
                    <th className="py-2.5 px-3 font-mono text-stone-700">Bil. Rekod</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 bg-white">
                  {syncHistory.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-stone-500 text-xs">
                        Tiada log aktiviti penyelarasan lagi.
                      </td>
                    </tr>
                  ) : (
                    syncHistory.map((log) => (
                      <tr key={log.id} className="hover:bg-stone-50/80 transition-colors">
                        <td className="py-2 px-3 font-mono text-stone-500 text-[11px] whitespace-nowrap">
                          {log.timestamp}
                        </td>
                        <td className="py-2 px-3 font-semibold font-serif-heading text-stone-900">
                          {log.action === 'TARIK_DATA' && '📥 Tarik Data (Pull)'}
                          {log.action === 'HANTAR_DATA' && '🚀 Hantar Data (Push)'}
                          {log.action === 'AUTO_KEMASKINI' && '⚡ Auto-Sync Kemaskini'}
                          {log.action === 'CIPTA_HELAIAN' && '✨ Cipta Helaian Baru'}
                          {log.action === 'SAMBUNG_FAIL' && '🔗 Sambungan Helaian'}
                        </td>
                        <td className="py-2 px-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            log.status === 'BERJAYA'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-stone-700 font-sans">
                          {log.message}
                        </td>
                        <td className="py-2 px-3 font-mono text-stone-600 font-bold">
                          {log.rowsCount !== undefined ? log.rowsCount : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 5: Step-by-Step Setup Guide */}
      {activeSubTab === 'setup_guide' && (
        <div className="bg-white border border-stone-300 rounded-2xl p-6 shadow-xs space-y-6">
          <div>
            <h3 className="font-serif-heading font-bold text-xl text-stone-900">
              Panduan Menghubungkan Google Sheets sebagai Database
            </h3>
            <p className="text-xs text-stone-600 mt-1">
              Ikuti langkah ringkas di bawah untuk menjadikan helaian Google Sheets anda sebagai pangkalan data langsung sistem ini.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-stone-200 rounded-2xl p-4 bg-stone-50 space-y-2">
              <span className="w-7 h-7 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center font-mono font-bold text-xs">
                1
              </span>
              <h4 className="font-serif-heading font-bold text-stone-900 text-sm">
                Sediakan Google Sheet
              </h4>
              <p className="text-xs text-stone-600 leading-relaxed">
                Buka Google Sheets dan cipta helaian baru atau gunakan fungsi <strong>"Cipta Google Sheet Baru"</strong> di portal ini untuk menyusun tajuk lajur standard secara automatik.
              </p>
            </div>

            <div className="border border-stone-200 rounded-2xl p-4 bg-stone-50 space-y-2">
              <span className="w-7 h-7 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center font-mono font-bold text-xs">
                2
              </span>
              <h4 className="font-serif-heading font-bold text-stone-900 text-sm">
                Tetapkan Akses Perkongsian
              </h4>
              <p className="text-xs text-stone-600 leading-relaxed">
                Di Google Sheet, klik butang <strong>Share (Kongsi)</strong> di penjuru kanan atas. Ubah tetapan General Access kepada <strong>"Anyone with the link can view / edit"</strong>.
              </p>
            </div>

            <div className="border border-stone-200 rounded-2xl p-4 bg-stone-50 space-y-2">
              <span className="w-7 h-7 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center font-mono font-bold text-xs">
                3
              </span>
              <h4 className="font-serif-heading font-bold text-stone-900 text-sm">
                Tampal Pautan & Selaras
              </h4>
              <p className="text-xs text-stone-600 leading-relaxed">
                Tampal pautan URL helaian ke dalam ruangan borang di portal ini dan klik <strong>Hubungkan Helaian</strong>. Semua data akan disegerakkan dua hala dengan lancar.
              </p>
            </div>
          </div>

          <div className="bg-[#FAF9F6] border border-stone-200 rounded-xl p-4 space-y-2 text-xs text-stone-700">
            <h5 className="font-serif-heading font-bold text-stone-900 text-sm">
              Lajur Standard yang Dikenali Secara Automatik:
            </h5>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
              <div className="bg-white p-2 rounded border border-stone-200">1. No Akaun</div>
              <div className="bg-white p-2 rounded border border-stone-200">2. Nama Pelanggan</div>
              <div className="bg-white p-2 rounded border border-stone-200">3. No Kad Pengenalan</div>
              <div className="bg-white p-2 rounded border border-stone-200 font-bold text-emerald-800">4. No Telefon (Kemaskini)</div>
              <div className="bg-white p-2 rounded border border-stone-200 font-bold text-emerald-800">5. Alamat Email (Kemaskini)</div>
              <div className="bg-white p-2 rounded border border-stone-200">6. Kategori Akaun</div>
              <div className="bg-white p-2 rounded border border-stone-200">7. Status Akaun</div>
              <div className="bg-white p-2 rounded border border-stone-200">8. Status Kemaskini</div>
            </div>
          </div>

          {/* Webhook Google Apps Script Snippet (Optional for 100% Free 2-Way Sync on Any Domain) */}
          <div className="bg-indigo-50/50 border border-indigo-200 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <h5 className="font-serif-heading font-bold text-indigo-950 text-sm">
                  Kod Google Apps Script (Untuk 2-Way Sync Universal Tanpa Perlu Log Masuk Google)
                </h5>
              </div>
              <button
                type="button"
                onClick={() => {
                  const scriptCode = `// Google Apps Script Web App for Pangkalan Data Pelanggan\nfunction doGet(e) {\n  var sheetName = (e && e.parameter && e.parameter.sheetName) || 'Sheet1';\n  var ss = SpreadsheetApp.getActiveSpreadsheet();\n  var sheet = ss.getSheetByName(sheetName) || ss.getSheets()[0];\n  var data = sheet.getDataRange().getValues();\n  return ContentService.createTextOutput(JSON.stringify(data))\n    .setMimeType(ContentService.MimeType.JSON);\n}\n\nfunction doPost(e) {\n  try {\n    var req = JSON.parse(e.postData.contents);\n    var sheetName = req.sheetName || 'Sheet1';\n    var ss = SpreadsheetApp.getActiveSpreadsheet();\n    var sheet = ss.getSheetByName(sheetName) || ss.getSheets()[0];\n    var data = sheet.getDataRange().getValues();\n    var acc = req.account;\n    \n    var targetRow = -1;\n    for (var i = 1; i < data.length; i++) {\n      if (String(data[i][0]).trim().toLowerCase() === String(acc.noAkaun).trim().toLowerCase()) {\n        targetRow = i + 1;\n        break;\n      }\n    }\n    \n    if (targetRow > 0) {\n      sheet.getRange(targetRow, 4).setValue(acc.noTel);\n      sheet.getRange(targetRow, 5).setValue(acc.email);\n      sheet.getRange(targetRow, 8).setValue('TELAH DIKEMASKINI');\n      sheet.getRange(targetRow, 9).setValue(new Date().toISOString());\n    } else {\n      sheet.appendRow([acc.noAkaun, acc.nama, acc.kadPengenalan || '', acc.noTel || '', acc.email || '', acc.kategoriAkaun || 'Kediaman', acc.status || 'Aktif', 'TELAH DIKEMASKINI', new Date().toISOString(), 'Portal Pelanggan', acc.rewardStatus || 'Belum Layak', acc.rewardCode || '']);\n    }\n    return ContentService.createTextOutput(JSON.stringify({ success: true }))\n      .setMimeType(ContentService.MimeType.JSON);\n  } catch (err) {\n    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))\n      .setMimeType(ContentService.MimeType.JSON);\n  }\n}`;
                  navigator.clipboard.writeText(scriptCode);
                  setCopiedCode(true);
                  showSuccess('Kod Disalin!', 'Kod Apps Script berjaya disalin ke papan keratan.');
                  setTimeout(() => setCopiedCode(false), 3000);
                }}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'Disalin!' : 'Salin Kod Skrip'}</span>
              </button>
            </div>
            
            <p className="text-xs text-indigo-900 leading-relaxed">
              <strong>Cara Pasang (Hanya 1 Minit):</strong>
              <br />
              1. Di Google Sheet anda, klik menu <strong>Extensions &gt; Apps Script</strong>.
              <br />
              2. Padam kod asal, klik butang <em>"Salin Kod Skrip"</em> di atas dan tampal kod tersebut ke dalam editor.
              <br />
              3. Klik butang <strong>Deploy &gt; New deployment</strong> &gt; Pilih jenis <strong>Web app</strong>.
              <br />
              4. Tetapkan <em>"Execute as: Me"</em> dan <em>"Who has access: Anyone"</em>.
              <br />
              5. Klik <strong>Deploy</strong>, salin Web App URL dan tampal ke dalam ruangan <em>"Pautan Webhook Google Apps Script"</em> di tab Konfigurasi.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
