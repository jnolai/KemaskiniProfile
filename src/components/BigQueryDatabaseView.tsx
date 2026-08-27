import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Server, 
  Cloud, 
  Key, 
  Copy, 
  Check, 
  Download, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  Layers, 
  ShieldCheck, 
  Sparkles, 
  Lock, 
  ExternalLink, 
  FileCode, 
  Table, 
  Send,
  Search,
  Globe,
  UploadCloud,
  ChevronRight
} from 'lucide-react';
import { BigQueryConfig, CustomerAccount, GiftItem } from '../types';
import { 
  getStoredBigQueryConfig, 
  saveBigQueryConfig, 
  generateBigQueryDDL, 
  generateAppsScriptBigQueryCode, 
  generateCloudflarePagesIndexHtml,
  DEFAULT_BIGQUERY_CONFIG
} from '../services/bigQueryService';
import { useToast } from '../context/ToastContext';
import { getMalaysiaDateTime } from '../utils/dateHelper';

interface BigQueryDatabaseViewProps {
  accounts: CustomerAccount[];
  gifts: GiftItem[];
  isSuperAdmin: boolean;
  onRefreshGifts?: () => void;
}

export const BigQueryDatabaseView: React.FC<BigQueryDatabaseViewProps> = ({
  accounts,
  gifts,
  isSuperAdmin,
}) => {
  const { showSuccess, showError, showInfo, showWarning } = useToast();

  const [config, setConfig] = useState<BigQueryConfig>(getStoredBigQueryConfig);
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'backend_script' | 'sql_ddl' | 'cloudflare_frontend' | 'test_api'>('overview');
  
  // Copying state feedback
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedDDL, setCopiedDDL] = useState(false);
  const [copiedFrontend, setCopiedFrontend] = useState(false);
  const [copiedApiKey, setCopiedApiKey] = useState(false);

  // Live testing state
  const [testSearchQuery, setTestSearchQuery] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  // Syncing state
  const [isSyncingBulk, setIsSyncingBulk] = useState(false);

  useEffect(() => {
    saveBigQueryConfig(config);
  }, [config]);

  const handleCopy = (text: string, type: 'script' | 'ddl' | 'frontend' | 'key') => {
    navigator.clipboard.writeText(text);
    if (type === 'script') {
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2000);
      showSuccess('Kod Apps Script Disalin', 'Keseluruhan kod backend Google Apps Script telah disalin ke papan keratan (clipboard).');
    } else if (type === 'ddl') {
      setCopiedDDL(true);
      setTimeout(() => setCopiedDDL(false), 2000);
      showSuccess('Skrip SQL BigQuery Disalin', 'Arahan SQL DDL telah disalin. Anda boleh laksanakannya di Google BigQuery Console.');
    } else if (type === 'frontend') {
      setCopiedFrontend(true);
      setTimeout(() => setCopiedFrontend(false), 2000);
      showSuccess('Kod Frontend Cloudflare Disalin', 'Kod index.html untuk Cloudflare Pages sedia dimuat naik.');
    } else if (type === 'key') {
      setCopiedApiKey(true);
      setTimeout(() => setCopiedApiKey(false), 2000);
      showSuccess('Kunci API Disalin', 'Kunci rahsia API telah disalin.');
    }
  };

  const handleDownloadFrontendHtml = () => {
    const htmlContent = generateCloudflarePagesIndexHtml(config);
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'index.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSuccess('Fail index.html Dimuat Turun', 'Fail sedia di-deploy ke Cloudflare Pages.');
  };

  const handleTestConnection = async () => {
    if (!config.appsScriptUrl) {
      showWarning('URL API Diperlukan', 'Sila masukkan URL Web App Google Apps Script anda terlebih dahulu.');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const pingUrl = `${config.appsScriptUrl}?action=ping`;
      const res = await fetch(pingUrl);
      const data = await res.json();

      setIsTesting(false);
      setTestResult(data);

      if (data.success) {
        setConfig((prev) => ({
          ...prev,
          isConnected: true,
          lastSyncTime: getMalaysiaDateTime(),
        }));
        showSuccess('Sambungan Berjaya!', 'API Google BigQuery bersedia memproses kueri SQL.');
      } else {
        showError('Sambungan Gagal', data.error || 'Pelayan mengembalikan ralat.');
      }
    } catch (err: any) {
      setIsTesting(false);
      setTestResult({ success: false, error: err.message });
      showError('Ralat Sambungan', 'Tidak dapat menghubungi Web App API. Pastikan URL betul dan di-deploy dengan akses "Anyone".');
    }
  };

  const handleTestSearch = async () => {
    if (!config.appsScriptUrl) {
      showWarning('URL API Diperlukan', 'Sila tetapkan URL Web App terlebih dahulu.');
      return;
    }
    if (!testSearchQuery.trim()) {
      showWarning('Parameter Carian Kosong', 'Sila masukkan nombor akaun untuk diuji.');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const url = `${config.appsScriptUrl}?action=searchAccount&query=${encodeURIComponent(testSearchQuery.trim())}&apiKey=${encodeURIComponent(config.apiKey)}`;
      const res = await fetch(url);
      const data = await res.json();
      setIsTesting(false);
      setTestResult(data);

      if (data.success && data.found) {
        showSuccess('Rekod Dijumpai!', `Maklumat akaun ${data.account?.noAkaun} berjaya ditarik dari BigQuery.`);
      } else {
        showInfo('Carian Selesai', data.message || 'Tiada rekod sepadan ditemui dalam BigQuery.');
      }
    } catch (err: any) {
      setIsTesting(false);
      setTestResult({ success: false, error: err.message });
      showError('Ralat Carian', err.message);
    }
  };

  const handlePushAllToBigQuery = async () => {
    if (!config.appsScriptUrl) {
      showWarning('URL API Diperlukan', 'Sila tetapkan URL Web App Google Apps Script.');
      return;
    }

    if (accounts.length === 0) {
      showWarning('Tiada Rekod', 'Tiada akaun pelanggan untuk dimuat naik.');
      return;
    }

    setIsSyncingBulk(true);
    try {
      const payload = {
        action: 'bulkImportAccounts',
        apiKey: config.apiKey,
        accounts: accounts,
      };

      const res = await fetch(config.appsScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      setIsSyncingBulk(false);

      if (data.success) {
        setConfig((prev) => ({
          ...prev,
          lastSyncTime: getMalaysiaDateTime(),
          totalSyncedRows: accounts.length,
        }));
        showSuccess('Muat Naik Berjaya!', `${accounts.length.toLocaleString()} akaun telah diselaraskan ke Google BigQuery.`);
      } else {
        showError('Gagal Memuat Naik', data.error || 'Ralat semasa memuat naik data pukal.');
      }
    } catch (err: any) {
      setIsSyncingBulk(false);
      showError('Ralat API', err.message);
    }
  };

  const appsScriptCode = generateAppsScriptBigQueryCode(config);
  const sqlDdlScript = generateBigQueryDDL(config);
  const cloudflareHtml = generateCloudflarePagesIndexHtml(config);

  return (
    <div className="space-y-6">
      
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-br from-purple-950 via-stone-900 to-black text-white rounded-2xl p-6 sm:p-8 shadow-md border border-purple-900/60 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 max-w-4xl">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-800/80 text-purple-200 text-xs font-mono font-bold border border-purple-600">
              <Database className="w-3.5 h-3.5 text-purple-300" /> Google BigQuery Database Engine
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-semibold border border-amber-400/40">
              <Globe className="w-3.5 h-3.5 text-amber-400" /> Cloudflare Pages Ready
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-serif-heading font-bold tracking-tight text-white mb-2">
            Pusat Naik Taraf & Integrasi Google BigQuery
          </h1>
          <p className="text-stone-300 text-xs sm:text-sm leading-relaxed">
            Sistem pangkalan data enterprise berprestasi tinggi untuk menggantikan Google Sheets. Dilengkapi kueri SQL masa-nyata, pengesahan keselamatan token API, dan perlindungan PIN keselamatan ketat untuk panel Admin di Cloudflare Pages.
          </p>
        </div>
      </div>

      {/* 2. Sub-Tabs Navigation */}
      <div className="flex space-x-1 sm:space-x-2 border-b border-stone-200 overflow-x-auto scrollbar-none pb-2">
        <button
          onClick={() => setActiveSubTab('overview')}
          className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
            activeSubTab === 'overview'
              ? 'bg-purple-950 text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Konfigurasi & Status</span>
        </button>

        <button
          onClick={() => setActiveSubTab('backend_script')}
          className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
            activeSubTab === 'backend_script'
              ? 'bg-purple-950 text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Server className="w-4 h-4 text-purple-400" />
          <span>1. Backend API (Apps Script)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('sql_ddl')}
          className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
            activeSubTab === 'sql_ddl'
              ? 'bg-purple-950 text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Table className="w-4 h-4 text-amber-400" />
          <span>2. Skrip SQL DDL BigQuery</span>
        </button>

        <button
          onClick={() => setActiveSubTab('cloudflare_frontend')}
          className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
            activeSubTab === 'cloudflare_frontend'
              ? 'bg-purple-950 text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Globe className="w-4 h-4 text-blue-400" />
          <span>3. Frontend Cloudflare Pages</span>
        </button>

        <button
          onClick={() => setActiveSubTab('test_api')}
          className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
            activeSubTab === 'test_api'
              ? 'bg-purple-950 text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>Ujian Kueri API</span>
        </button>
      </div>

      {/* 3. Sub-Tab 1: OVERVIEW & CONFIGURATION */}
      {activeSubTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left / Center: Config Settings */}
          <div className="lg:col-span-2 space-y-6">
            
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-900 flex items-center justify-center">
                    <Database className="w-4 h-4 text-purple-800" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-stone-900">Tetapan Google BigQuery</h3>
                    <p className="text-[11px] text-stone-500">Parameter projek, dataset, dan nama jadual</p>
                  </div>
                </div>
                <span className="text-[11px] font-mono font-bold text-stone-600 bg-stone-100 px-2 py-0.5 rounded">
                  GCP BigQuery
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">GCP Project ID</label>
                  <input 
                    type="text" 
                    value={config.projectId} 
                    onChange={(e) => setConfig({ ...config, projectId: e.target.value })}
                    placeholder="ekemaskini-project-2026"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-mono text-stone-900 outline-none focus:ring-2 focus:ring-purple-600 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">BigQuery Dataset ID</label>
                  <input 
                    type="text" 
                    value={config.datasetId} 
                    onChange={(e) => setConfig({ ...config, datasetId: e.target.value })}
                    placeholder="ekemaskini_db"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-mono text-stone-900 outline-none focus:ring-2 focus:ring-purple-600 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">Jadual Pelanggan</label>
                  <input 
                    type="text" 
                    value={config.customersTable} 
                    onChange={(e) => setConfig({ ...config, customersTable: e.target.value })}
                    placeholder="pelanggan"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-mono text-stone-900 outline-none focus:ring-2 focus:ring-purple-600 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">Jadual Hadiah</label>
                  <input 
                    type="text" 
                    value={config.giftsTable} 
                    onChange={(e) => setConfig({ ...config, giftsTable: e.target.value })}
                    placeholder="hadiah"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-mono text-stone-900 outline-none focus:ring-2 focus:ring-purple-600 focus:bg-white"
                  />
                </div>
              </div>

              {/* Web App URL & API Key */}
              <div className="pt-3 border-t border-stone-100 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1 flex items-center justify-between">
                    <span>Google Apps Script Web App API Endpoint URL *</span>
                    <a 
                      href="https://script.google.com" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-[11px] text-purple-700 hover:underline inline-flex items-center gap-1 font-semibold"
                    >
                      Buka Google Apps Script <ExternalLink className="w-3 h-3" />
                    </a>
                  </label>
                  <input 
                    type="url" 
                    value={config.appsScriptUrl} 
                    onChange={(e) => setConfig({ ...config, appsScriptUrl: e.target.value })}
                    placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl font-mono text-xs text-stone-900 outline-none focus:ring-2 focus:ring-purple-600 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Kunci Rahsia Keselamatan API (API Secret Key / Token)
                  </label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={config.apiKey} 
                      onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                      placeholder="eKemaskini_Secret_Key_2026"
                      className="flex-1 px-3.5 py-2 bg-stone-50 border border-stone-300 rounded-xl font-mono text-xs text-stone-900 outline-none focus:ring-2 focus:ring-purple-600 focus:bg-white"
                    />
                    <button
                      onClick={() => handleCopy(config.apiKey, 'key')}
                      className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-semibold flex items-center gap-1 border border-stone-300 cursor-pointer"
                    >
                      {copiedApiKey ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>Salin Kunci</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
                <button
                  onClick={handleTestConnection}
                  disabled={isTesting || !config.appsScriptUrl}
                  className="px-4 py-2.5 bg-purple-900 hover:bg-purple-950 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                  <span>Uji Sambungan API</span>
                </button>

                <button
                  onClick={handlePushAllToBigQuery}
                  disabled={isSyncingBulk || !config.appsScriptUrl || accounts.length === 0}
                  className="px-4 py-2.5 bg-stone-900 hover:bg-black disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <UploadCloud className={`w-3.5 h-3.5 ${isSyncingBulk ? 'animate-spin' : ''}`} />
                  <span>Muat Naik {accounts.length.toLocaleString()} Rekod Semasa ke BigQuery</span>
                </button>
              </div>

            </div>

          </div>

          {/* Right: Architecture & Security Info */}
          <div className="space-y-4">
            
            <div className="bg-gradient-to-br from-stone-900 to-purple-950 text-white rounded-2xl p-5 shadow-sm space-y-3 border border-stone-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-200">Arkitektur Keselamatan</h4>
              </div>
              <ul className="text-xs text-stone-300 space-y-2 leading-relaxed">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                  <span><strong>BigQuery DML & Parameterized Queries:</strong> Mencegah SQL Injection sepenuhnya.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                  <span><strong>API Bearer Token:</strong> Menolak semua request tanpa token rahsia.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                  <span><strong>PIN Mandatori Setiap Sesi:</strong> Panel Admin tidak menyimpan sessionStorage kekal; wajib masukkan PIN setiap kali muat halaman di Cloudflare Pages.</span>
                </li>
              </ul>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-200 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700">Panduan 3 Langkah Pantas</h4>
              
              <div className="space-y-2.5 text-xs text-stone-600">
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-900 font-bold text-[11px] flex items-center justify-center shrink-0">1</span>
                  <span>Jalankan <strong>Skrip SQL DDL</strong> di Google BigQuery Console untuk membina dataset & jadual.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-900 font-bold text-[11px] flex items-center justify-center shrink-0">2</span>
                  <span>Tampal <strong>Backend Apps Script</strong> ke Google Apps Script dan deploy sebagai Web App.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-900 font-bold text-[11px] flex items-center justify-center shrink-0">3</span>
                  <span>Muat naik fail <strong>index.html</strong> ke Cloudflare Pages.</span>
                </div>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* 4. Sub-Tab 2: BACKEND APPS SCRIPT CODE */}
      {activeSubTab === 'backend_script' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-stone-100">
            <div>
              <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <Server className="w-4 h-4 text-purple-700" /> Kod Lengkap Google Apps Script (Code.gs)
              </h3>
              <p className="text-xs text-stone-500">
                Mengandungi fungsi carian profil, kemaskini SQL, pengurusan stok hadiah, dan pengesahan token API.
              </p>
            </div>

            <button
              onClick={() => handleCopy(appsScriptCode, 'script')}
              className="px-4 py-2 bg-purple-950 hover:bg-black text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              {copiedScript ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copiedScript ? 'Disalin ke Clipboard!' : 'Salin Semua Kod (Code.gs)'}</span>
            </button>
          </div>

          <div className="bg-[#1E1E1E] text-stone-200 rounded-xl p-4 font-mono text-xs overflow-x-auto max-h-[500px] border border-stone-800">
            <pre className="whitespace-pre">{appsScriptCode}</pre>
          </div>
        </div>
      )}

      {/* 5. Sub-Tab 3: SQL DDL SCRIPT */}
      {activeSubTab === 'sql_ddl' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-stone-100">
            <div>
              <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <Table className="w-4 h-4 text-amber-600" /> Skrip SQL Cipta Dataset & Jadual (BigQuery DDL)
              </h3>
              <p className="text-xs text-stone-500">
                Buka BigQuery SQL Workspace di GCP Console, salin dan tekan tombol "RUN".
              </p>
            </div>

            <button
              onClick={() => handleCopy(sqlDdlScript, 'ddl')}
              className="px-4 py-2 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              {copiedDDL ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copiedDDL ? 'Disalin!' : 'Salin Arahan SQL'}</span>
            </button>
          </div>

          <div className="bg-[#1E1E1E] text-stone-200 rounded-xl p-4 font-mono text-xs overflow-x-auto max-h-[500px] border border-stone-800">
            <pre className="whitespace-pre">{sqlDdlScript}</pre>
          </div>
        </div>
      )}

      {/* 6. Sub-Tab 4: CLOUDFLARE PAGES FRONTEND */}
      {activeSubTab === 'cloudflare_frontend' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-stone-100">
            <div>
              <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-600" /> Frontend index.html (Cloudflare Pages)
              </h3>
              <p className="text-xs text-stone-500">
                Lengkap dengan Carian Awam & Panel Admin berkod PIN mandatori (tanpa sessionStorage kekal).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopy(cloudflareHtml, 'frontend')}
                className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded-xl flex items-center gap-1.5 border border-stone-300 cursor-pointer"
              >
                {copiedFrontend ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>Salin Kod</span>
              </button>

              <button
                onClick={handleDownloadFrontendHtml}
                className="px-4 py-2 bg-purple-950 hover:bg-black text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Muat Turun index.html</span>
              </button>
            </div>
          </div>

          <div className="bg-[#1E1E1E] text-stone-200 rounded-xl p-4 font-mono text-xs overflow-x-auto max-h-[500px] border border-stone-800">
            <pre className="whitespace-pre">{cloudflareHtml}</pre>
          </div>
        </div>
      )}

      {/* 7. Sub-Tab 5: TEST API QUERY */}
      {activeSubTab === 'test_api' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200 space-y-5">
          <div>
            <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" /> Ujian Langsung Kueri BigQuery API
            </h3>
            <p className="text-xs text-stone-500">
              Uji panggilan REST API daripada aplikasi ini terus ke Google BigQuery anda.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <input 
              type="text" 
              value={testSearchQuery} 
              onChange={(e) => setTestSearchQuery(e.target.value)}
              placeholder="Masukkan No. Akaun atau IC untuk diuji (cth: ACC-10023)"
              className="flex-1 px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-mono text-stone-900 outline-none focus:ring-2 focus:ring-purple-600 focus:bg-white"
              onkeydown={(e) => { if (e.key === 'Enter') handleTestSearch(); }}
            />
            <button
              onClick={handleTestSearch}
              disabled={isTesting || !config.appsScriptUrl}
              className="px-5 py-2.5 bg-purple-950 hover:bg-black disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span>{isTesting ? 'Mencari...' : 'Kueri BigQuery'}</span>
            </button>
          </div>

          {testResult && (
            <div className="bg-stone-50 rounded-xl p-4 border border-stone-200 space-y-2">
              <span className="text-xs font-bold text-stone-700">Respons BigQuery API:</span>
              <pre className="bg-[#1E1E1E] text-emerald-400 p-3 rounded-lg font-mono text-xs overflow-x-auto">
                {JSON.stringify(testResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
