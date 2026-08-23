import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, 
  Lock, 
  Edit3, 
  CheckCircle2, 
  Save, 
  Phone, 
  Mail, 
  User, 
  CreditCard, 
  ShieldCheck, 
  Clock, 
  RotateCcw, 
  ArrowLeft, 
  AlertCircle, 
  HelpCircle, 
  Sparkles, 
  FileText, 
  Download, 
  Printer, 
  Database, 
  RefreshCw, 
  ExternalLink, 
  Check, 
  Zap, 
  History,
  Eye,
  EyeOff,
  ShieldAlert,
  Shield
} from 'lucide-react';
import { CustomerAccount } from '../types';
import { generateProfileSummaryPDF } from '../utils/pdfReceiptHelper';
import { useToast } from '../context/ToastContext';
import { 
  searchAccountInGoogleSheetLive, 
  getStoredGoogleSheetsConfig,
  simpanKemaskini,
  cariMaklumatPelanggan,
  CENTRAL_APPS_SCRIPT_API_URL 
} from '../services/googleSheetsService';
import { fetchSingleAccountFromFirestore } from '../services/firebaseService';
import { getSingleAccountFromIDB } from '../utils/idbStorage';
import { 
  buildAccountSearchIndex, 
  fastLookupByAccountNo 
} from '../utils/searchEngine';
import { 
  maskKadPengenalan, 
  maskPhoneNumber, 
  maskEmailAddress, 
  sanitizeAccountNo, 
  sanitizePhone, 
  sanitizeEmail, 
  isValidMalaysianPhone, 
  isValidEmailFormat, 
  securityRateLimiter, 
  logSecurityIncident 
} from '../utils/security';
import { CyberSecurityShieldModal } from './CyberSecurityShieldModal';
import confetti from 'canvas-confetti';

interface CustomerPortalLookupProps {
  accounts: CustomerAccount[];
  onUpdateAccount: (updated: CustomerAccount, changedFields: string[], oldPhone: string, oldEmail: string) => void;
  initialAccountNo?: string | null;
  onClearInitialAccount?: () => void;
  isGoogleSheetsConnected?: boolean;
  googleSheetName?: string;
  googleSheetUrl?: string;
  onSyncFromGoogleSheets?: () => Promise<CustomerAccount[]>;
  onAddFetchedAccount?: (account: CustomerAccount) => void;
}

export const CustomerPortalLookup: React.FC<CustomerPortalLookupProps> = ({
  accounts,
  onUpdateAccount,
  initialAccountNo,
  onClearInitialAccount,
  isGoogleSheetsConnected = false,
  googleSheetName = '',
  googleSheetUrl = '',
  onSyncFromGoogleSheets,
  onAddFetchedAccount,
}) => {
  const { showSuccess, showError, showWarning, showInfo } = useToast();

  // Search state
  const [searchInput, setSearchInput] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [activeAccountNo, setActiveAccountNo] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<CustomerAccount | null>(null);
  const [isSearchingLiveGoogleSheet, setIsSearchingLiveGoogleSheet] = useState(false);
  const [isSyncingSheets, setIsSyncingSheets] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cybersecurity & PDPA States
  const [searchLockoutSeconds, setSearchLockoutSeconds] = useState(0);
  const [revealFullIC, setRevealFullIC] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);

  // Lockout countdown timer
  useEffect(() => {
    if (searchLockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setSearchLockoutSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [searchLockoutSeconds]);

  // Recent searches cache
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const saved = sessionStorage.getItem('portal_recent_searches');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const addRecentSearch = (accNo: string) => {
    setRecentSearches((prev) => {
      const filtered = prev.filter((item) => item.toUpperCase() !== accNo.toUpperCase());
      const updated = [accNo, ...filtered].slice(0, 4);
      try {
        sessionStorage.setItem('portal_recent_searches', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Editable form fields
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Read config for connected check
  const gsConfig = useMemo(() => getStoredGoogleSheetsConfig(), [isGoogleSheetsConnected]);
  const isSheetActive = isGoogleSheetsConnected || (gsConfig.isConnected && Boolean(gsConfig.spreadsheetId));
  const activeSheetTitle = googleSheetName || gsConfig.spreadsheetName || 'Pangkalan Data Google Sheets';

  // ⚡ High-speed O(1) in-memory search index
  const searchIndex = useMemo(() => {
    return buildAccountSearchIndex(accounts);
  }, [accounts]);

  // If initialAccountNo is passed from another tab (e.g., "Buka Portal" from Directory)
  useEffect(() => {
    if (initialAccountNo) {
      const lookup = fastLookupByAccountNo(searchIndex, initialAccountNo);
      if (lookup.results && lookup.results.length > 0) {
        setSearchInput(initialAccountNo);
        setActiveAccountNo(initialAccountNo);
        if (lookup.results.length === 1) {
          setSelectedAccount(lookup.results[0]);
        } else {
          setSelectedAccount(null);
        }
        setHasSearched(true);
        addRecentSearch(initialAccountNo);
      }
    }
  }, [initialAccountNo, searchIndex]);

  // Execute fast search when user submits or clicks Search
  const searchResults = useMemo(() => {
    if (!hasSearched) return [];
    const q = searchInput.trim();
    if (!q) return [];
    
    const lookup = fastLookupByAccountNo(searchIndex, q);
    return lookup.results;
  }, [searchIndex, searchInput, hasSearched]);

  // If only 1 result is found after searching, auto-select it
  useEffect(() => {
    if (hasSearched && searchResults.length === 1 && !selectedAccount) {
      setActiveAccountNo(searchResults[0].noAkaun);
      setSelectedAccount(searchResults[0]);
    }
  }, [hasSearched, searchResults, selectedAccount]);

  // Active selected account object
  const activeAccount = useMemo(() => {
    if (selectedAccount) return selectedAccount;
    if (!activeAccountNo) return null;
    const list = searchIndex.exactMap.get(activeAccountNo.trim().toLowerCase());
    return list && list.length === 1 ? list[0] : null;
  }, [searchIndex, activeAccountNo, selectedAccount]);

  // Sync form inputs whenever active account changes
  useEffect(() => {
    if (activeAccount) {
      setEditPhone(activeAccount.noTel || '');
      setEditEmail(activeAccount.email || '');
      setSavedSuccess(false);
      setValidationError(null);
    }
  }, [activeAccount?.id || activeAccount?.noAkaun]);

  const selectAccountDirectly = (account: CustomerAccount) => {
    setSearchInput(account.noAkaun);
    setActiveAccountNo(account.noAkaun);
    setSelectedAccount(account);
    setHasSearched(true);
    addRecentSearch(account.noAkaun);
    showInfo('Akaun Dipilih', `Profil bagi No. Akaun "${account.noAkaun}" dimuatkan serta-merta.`);
  };

  const handleSearchSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // Check search rate limiter & lockout
    if (searchLockoutSeconds > 0) {
      showWarning('Carian Disekat Sementara', `Sila tunggu ${searchLockoutSeconds} saat lagi demi perlindungan keselamatan anti-scraping.`);
      return;
    }

    const rateCheck = securityRateLimiter.checkRateLimit('portal_lookup', 10, 30000, 45000);
    if (!rateCheck.allowed) {
      setSearchLockoutSeconds(rateCheck.lockoutSeconds);
      showError(
        'Had Kadar Carian Dicapai', 
        `Penyekatan keselamatan diaktifkan selama ${rateCheck.lockoutSeconds} saat untuk menghalang pengikisan data automatik.`
      );
      return;
    }

    const raw = searchInput.trim();
    const q = sanitizeAccountNo(raw);

    if (!q) {
      showWarning('Sila Masukkan No. Akaun', 'Sila masukkan nombor akaun (contoh: 1611xxxxxxxxx) untuk membuat carian.');
      return;
    }

    // 1. Ultra-fast lookup in O(1) index
    const lookup = fastLookupByAccountNo(searchIndex, q);

    if (lookup.exactMatch) {
      setHasSearched(true);
      setActiveAccountNo(lookup.exactMatch.noAkaun);
      addRecentSearch(lookup.exactMatch.noAkaun);
      showInfo('Carian Berjaya', `Profil untuk No. Akaun "${lookup.exactMatch.noAkaun}" ditemui dan sedia untuk disemak.`);
      return;
    }

    if (lookup.results.length > 0) {
      setHasSearched(true);
      setActiveAccountNo(lookup.results.length === 1 ? lookup.results[0].noAkaun : null);
      if (lookup.results.length === 1) {
        addRecentSearch(lookup.results[0].noAkaun);
      }
      showInfo('Carian Padanan', `${lookup.results.length} rekod dipadankan.`);
      return;
    }

    // 2. Direct Query: Live Search via BigQuery / Google Apps Script API Endpoint
    setIsSearchingLiveGoogleSheet(true);
    try {
      const liveLookup = await cariMaklumatPelanggan(q, gsConfig.appsScriptUrl || CENTRAL_APPS_SCRIPT_API_URL);
      if (liveLookup.status === 'success' && liveLookup.data) {
        const fetchedAcc = liveLookup.data;
        if (onAddFetchedAccount) {
          onAddFetchedAccount(fetchedAcc);
        }
        setHasSearched(true);
        setActiveAccountNo(fetchedAcc.noAkaun);
        setSelectedAccount(fetchedAcc);
        setEditPhone(fetchedAcc.noTel || '');
        setEditEmail(fetchedAcc.email || '');
        addRecentSearch(fetchedAcc.noAkaun);
        showSuccess(
          'Maklumat Pelanggan Ditemui!',
          `Profil bagi No. Akaun ${fetchedAcc.noAkaun} (${fetchedAcc.nama}) berjaya dimuatkan.`
        );
        return;
      } else if (liveLookup.status === 'empty') {
        console.log("No Akaun tidak dijumpai dalam rekod BigQuery/AppsScript.");
      }
    } catch (apiErr) {
      console.warn("Ralat carian endpoint:", apiErr);
    } finally {
      setIsSearchingLiveGoogleSheet(false);
    }

    // 3. High-speed Fallback: Query IndexedDB Storage Directly
    try {
      const idbAccount = await getSingleAccountFromIDB(q);
      if (idbAccount) {
        if (onAddFetchedAccount) {
          onAddFetchedAccount(idbAccount);
        }
        setHasSearched(true);
        setActiveAccountNo(idbAccount.noAkaun);
        setSelectedAccount(idbAccount);
        addRecentSearch(idbAccount.noAkaun);
        showSuccess(
          'Akaun Ditemui dari Pangkalan Data!',
          `Profil bagi No. Akaun ${idbAccount.noAkaun} (${idbAccount.nama}) berjaya ditemui.`
        );
        return;
      }
    } catch (err) {
      console.warn('[IDB] Single lookup warning:', err);
    }

    // 3. Fallback: Query Cloud Firestore directly in real-time
    try {
      const cloudAccount = await fetchSingleAccountFromFirestore(q);
      if (cloudAccount) {
        if (onAddFetchedAccount) {
          onAddFetchedAccount(cloudAccount);
        }
        setHasSearched(true);
        setActiveAccountNo(cloudAccount.noAkaun);
        setSelectedAccount(cloudAccount);
        addRecentSearch(cloudAccount.noAkaun);
        showSuccess(
          'Akaun Ditemui dari Pangkalan Data Awan!',
          `Profil bagi No. Akaun ${cloudAccount.noAkaun} (${cloudAccount.nama}) berjaya dimuatkan daripada Cloud Firestore.`
        );
        return;
      }
    } catch (err) {
      console.warn('[Firestore] Live single search fallback failed:', err);
    }

    // 4. If not found in cloud, and Google Sheets is connected: Query connected Google Sheet LIVE!
    const effectiveIsSheetActive = isSheetActive || (gsConfig.isConnected && Boolean(gsConfig.spreadsheetId || gsConfig.appsScriptUrl));
    if (effectiveIsSheetActive) {
      setIsSearchingLiveGoogleSheet(true);
      try {
        const liveResult = await searchAccountInGoogleSheetLive(q, gsConfig);
        if (liveResult.found && liveResult.account) {
          const fetchedAcc = liveResult.account;
          if (onAddFetchedAccount) {
            onAddFetchedAccount(fetchedAcc);
          }
          setHasSearched(true);
          setActiveAccountNo(fetchedAcc.noAkaun);
          setSelectedAccount(fetchedAcc);
          addRecentSearch(fetchedAcc.noAkaun);
          showSuccess(
            'Akaun Ditemui dari Google Sheets!',
            `Profil bagi No. Akaun ${fetchedAcc.noAkaun} (${fetchedAcc.nama}) berjaya dimuatkan terus daripada pangkalan data Google Sheet "${liveResult.sheetTitle}".`
          );
          return;
        }
      } catch (err) {
        console.warn('Live Google Sheets search error:', err);
      } finally {
        setIsSearchingLiveGoogleSheet(false);
      }
    }

    // 4. Not found anywhere
    setHasSearched(true);
    setActiveAccountNo(null);
    showError(
      'No. Akaun Tidak Dijumpai', 
      isSheetActive
        ? `Tiada rekod dipadankan dengan No. Akaun "${q}" dalam sistem atau pangkalan data Google Sheets "${activeSheetTitle}". Sila semak semula nombor akaun anda.`
        : `Tiada rekod dipadankan dengan No. Akaun "${q}". Sila semak semula nombor akaun anda.`
    );
  };

  const handleSyncSheetsClick = async () => {
    if (!onSyncFromGoogleSheets) return;
    setIsSyncingSheets(true);
    try {
      const synced = await onSyncFromGoogleSheets();
      if (synced && synced.length > 0) {
        showSuccess('Segerak Google Sheets Berjaya', `${synced.length} rekod akaun berjaya diselaraskan daripada Google Sheets.`);
      } else {
        showInfo('Pangkalan Data Google Sheets', 'Data Google Sheets telah disemak dan berada dalam keadaan terkini.');
      }
    } catch (err: any) {
      showError('Gagal Menyegerak', err?.message || 'Ralat ketika membaca Google Sheets.');
    } finally {
      setIsSyncingSheets(false);
    }
  };

  const handleResetSearch = () => {
    setSearchInput('');
    setHasSearched(false);
    setActiveAccountNo(null);
    setSelectedAccount(null);
    setValidationError(null);
    setSavedSuccess(false);
    setRevealFullIC(false);
    if (onClearInitialAccount) {
      onClearInitialAccount();
    }
  };

  // Check if phone or email has been modified
  const isChanged = activeAccount && (
    editPhone.trim() !== (activeAccount.noTel || '').trim() ||
    editEmail.trim() !== (activeAccount.email || '').trim()
  );

  // Save updated profile with cyber sanitization and rate-limiting
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccount) return;

    // Rate limiter on profile update actions
    const rateCheck = securityRateLimiter.checkRateLimit('portal_update', 6, 60000, 60000);
    if (!rateCheck.allowed) {
      const msg = `Sila bertenang. Penyerahan dikawal keselamatan siber (${rateCheck.lockoutSeconds}s cooldown).`;
      setValidationError(msg);
      showError('Had Penyerahan Dicapai', msg);
      return;
    }

    // Sanitize & validate phone
    const cleanedPhone = sanitizePhone(editPhone);
    if (!cleanedPhone || !isValidMalaysianPhone(cleanedPhone)) {
      const msg = 'Sila masukkan nombor telefon Malaysia yang sah (contoh: 012-3456789 atau 011xxxxxxxx).';
      setValidationError(msg);
      showError('Ralat Format Nombor Telefon', msg);
      return;
    }

    // Sanitize & validate email
    const cleanedEmail = sanitizeEmail(editEmail);
    if (!cleanedEmail || !isValidEmailFormat(cleanedEmail)) {
      const msg = 'Sila masukkan alamat email dengan format yang sah (contoh: nama@domain.com).';
      setValidationError(msg);
      showError('Ralat Format Alamat Email', msg);
      return;
    }

    setValidationError(null);
    setIsSaving(true);

    const changedFields: string[] = [];
    if (cleanedPhone !== activeAccount.noTel) changedFields.push('No Telefon');
    if (cleanedEmail !== activeAccount.email) changedFields.push('Alamat Email');

    const isFirstTimeUpdate = !activeAccount.telahDikemaskini;

    setTimeout(() => {
      const updated: CustomerAccount = {
        ...activeAccount,
        noTel: cleanedPhone,
        email: cleanedEmail,
        telahDikemaskini: true,
        lastUpdated: new Date().toISOString().replace('T', ' ').slice(0, 16),
        kemaskiniOleh: 'Pelanggan (Portal)',
      };

      // ⚡ Direct Save to Centralized Google Apps Script Database API
      try {
        const gsConf = getStoredGoogleSheetsConfig();
        const apiUrl = gsConf.appsScriptUrl || CENTRAL_APPS_SCRIPT_API_URL;
        if (apiUrl) {
          simpanKemaskini(updated, apiUrl).then((res) => {
            if (res.success) {
              console.log('[Centralized DB] Successfully synced customer update to Google Sheet via Apps Script:', res);
            }
          }).catch((err) => {
            console.warn('[Centralized DB] Apps Script sync warning:', err);
          });
        }
      } catch (e) {
        console.warn('Centralized DB sync error:', e);
      }

      onUpdateAccount(updated, changedFields, activeAccount.noTel, activeAccount.email);
      setIsSaving(false);
      setSavedSuccess(true);

      // Trigger celebration toast
      showSuccess(
        'Kemaskini Profil Berjaya Disimpan!',
        `Maklumat bagi akaun ${activeAccount.noAkaun} (${activeAccount.nama}) telah dikemaskini.${isSheetActive ? ' 📊 Disegerakkan terus ke Google Sheets.' : ''}${isFirstTimeUpdate ? ' 🎁 Baucar Hadiah Penghargaan 1x anda telah diaktifkan!' : ''}`
      );

      try {
        confetti({
          particleCount: 40,
          spread: 60,
          origin: { y: 0.7 },
          colors: ['#059669', '#10B981', '#1A1A1A', '#34D399']
        });
      } catch {}

      setTimeout(() => setSavedSuccess(false), 4000);
    }, 300);
  };

  const handleResetForm = () => {
    if (activeAccount) {
      setEditPhone(activeAccount.noTel || '');
      setEditEmail(activeAccount.email || '');
      setValidationError(null);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* 🏛️ 1. Header Banner */}
      <div className="bg-[#FAF9F6] border border-stone-300/90 rounded-2xl p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="bg-stone-900 text-white text-[10px] uppercase font-mono font-bold px-2.5 py-0.5 rounded tracking-wider">
                eKemaskini
              </span>
              <span className="text-xs text-stone-500 font-serif italic">
                Portal Rasmi Semakan & Kemaskini Profil Pelanggan
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-serif-heading font-bold text-stone-950 tracking-tight">
              eKemaskini: Carian & Kemaskini Profil
            </h1>
            <p className="text-xs sm:text-sm text-stone-600 max-w-2xl leading-relaxed font-serif">
              Masukkan <strong className="text-stone-900 font-bold">Nombor Akaun</strong> anda untuk mencari dan mengesahkan profil. Demi keselamatan integriti data, 
              anda hanya dibenarkan mengemaskini <strong className="text-stone-900 font-bold">Nombor Telefon</strong> dan <strong className="text-stone-900 font-bold">Alamat Email</strong>.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsSecurityModalOpen(true)}
            className="flex items-center gap-3 bg-white hover:bg-stone-50 border border-stone-300 hover:border-stone-400 p-3 rounded-xl shadow-2xs shrink-0 self-start md:self-center cursor-pointer transition-all group"
            title="Klik untuk membuka Pusat Keselamatan Siber & Pematuhan PDPA"
          >
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center border border-emerald-200 group-hover:bg-emerald-100 transition-colors">
              <ShieldCheck className="w-5 h-5 text-emerald-700" />
            </div>
            <div className="text-left">
              <span className="font-mono font-bold text-stone-900 block text-[11px] flex items-center gap-1">
                <span>Perlindungan Siber & PDPA</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </span>
              <span className="text-emerald-700 text-[10px] font-mono">Status: Terpelihara (Klik)</span>
            </div>
          </button>
        </div>
      </div>

      {/* 📊 LIVE GOOGLE SHEETS CONNECTION BADGE BANNER */}
      {isSheetActive && (
        <div className="bg-emerald-50/90 border border-emerald-300/90 rounded-2xl p-4 sm:p-4.5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-800 text-white flex items-center justify-center shadow-xs shrink-0 border border-emerald-900">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-950 font-serif-heading">
                  Pangkalan Data Google Sheets Aktif
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-emerald-200/90 text-emerald-900 px-2 py-0.5 rounded-full border border-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  Live DB
                </span>
              </div>
              <p className="text-[11px] text-emerald-900 leading-snug">
                Helaian: <strong className="font-semibold">{activeSheetTitle}</strong> • Carian nombor akaun dan kemaskini profil dihubungkan terus secara langsung ke Google Sheets.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            {googleSheetUrl && (
              <a
                href={googleSheetUrl}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1.5 bg-white/80 hover:bg-white text-emerald-950 border border-emerald-300 rounded-lg text-xs font-medium flex items-center gap-1 shadow-2xs transition-colors"
                title="Buka Google Sheet"
              >
                <ExternalLink className="w-3 h-3 text-emerald-700" />
                <span className="hidden sm:inline">Lihat Helaian</span>
              </a>
            )}
            {onSyncFromGoogleSheets && (
              <button
                type="button"
                onClick={handleSyncSheetsClick}
                disabled={isSyncingSheets}
                className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-70"
                title="Muat semula data akaun dari Google Sheets"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSheets ? 'animate-spin' : ''}`} />
                <span>{isSyncingSheets ? 'Menyegerak...' : 'Segerak Data'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 🔍 2. Search Section (Always clean and prominent) */}
      <div className="bg-[#FAF9F6] border border-stone-300 rounded-2xl p-5 sm:p-6 shadow-2xs">
        <form onSubmit={handleSearchSubmit} className="space-y-3">
          <div className="flex items-center justify-between">
            <label htmlFor="customer-portal-search-input" className="font-serif-heading font-bold text-stone-900 text-sm flex items-center gap-2">
              <Search className="w-4 h-4 text-stone-700" />
              <span>Sila Masukkan Nombor Akaun Anda</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full border border-emerald-300 font-bold">
                <Zap className="w-2.5 h-2.5 text-emerald-700 fill-emerald-700" />
                Carian Pantas O(1)
              </span>
            </label>
            {hasSearched && (
              <button
                type="button"
                onClick={handleResetSearch}
                className="text-xs font-semibold text-stone-600 hover:text-stone-950 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Carian Baru</span>
              </button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                ref={inputRef}
                id="inputNoAkaun"
                type="text"
                autoComplete="off"
                disabled={searchLockoutSeconds > 0}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={
                  searchLockoutSeconds > 0 
                    ? `Disekat sementara demi keselamatan anti-scraping (${searchLockoutSeconds}s)` 
                    : isSheetActive 
                    ? "Contoh: 1611xxxxxxxxx (Carian segera dalam sistem / Google Sheets)" 
                    : "Contoh: 1611xxxxxxxxx"
                }
                className="w-full pl-10 pr-9 py-3 bg-white disabled:bg-stone-100 disabled:text-stone-400 border border-stone-300 rounded-xl text-xs sm:text-sm font-medium text-stone-900 focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900 transition-all placeholder:text-stone-400 shadow-2xs"
              />
              {searchInput && searchLockoutSeconds === 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('');
                    inputRef.current?.focus();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 text-xs p-1 cursor-pointer"
                  aria-label="Padam teks"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              id="customer-portal-search-btn"
              type="submit"
              disabled={!searchInput.trim() || isSearchingLiveGoogleSheet || searchLockoutSeconds > 0}
              className="px-6 py-3 bg-[#1A1A1A] hover:bg-black disabled:bg-stone-300 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-2xs flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:cursor-not-allowed"
            >
              {searchLockoutSeconds > 0 ? (
                <>
                  <Clock className="w-4 h-4 text-amber-300 animate-spin" />
                  <span>Disekat ({searchLockoutSeconds}s)</span>
                </>
              ) : isSearchingLiveGoogleSheet ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
                  <span>Mencari Google Sheets...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Cari No. Akaun</span>
                </>
              )}
            </button>
          </div>

          {/* 🕒 Recent Searches Quick Access Pills */}
          {!hasSearched && recentSearches.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] text-stone-500 font-mono flex items-center gap-1">
                <History className="w-3 h-3 text-stone-400" />
                <span>Carian Terkini:</span>
              </span>
              {recentSearches.map((accNo) => (
                <button
                  key={`rec_${accNo}`}
                  type="button"
                  onClick={() => {
                    const lookup = fastLookupByAccountNo(searchIndex, accNo);
                    if (lookup.exactMatch) {
                      selectAccountDirectly(lookup.exactMatch);
                    } else {
                      setSearchInput(accNo);
                    }
                  }}
                  className="px-2.5 py-1 bg-white hover:bg-stone-100 border border-stone-300 hover:border-stone-400 rounded-lg text-xs font-mono font-bold text-stone-800 transition-all shadow-2xs cursor-pointer flex items-center gap-1"
                >
                  <span>{accNo}</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-stone-500 font-serif pt-0.5">
            <p className="italic flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-stone-400 shrink-0" />
              <span>Carian hanya membenarkan Nombor Akaun sahaja bagi menjamin privasi dan keselamatan data pelanggan.</span>
            </p>
            {isSheetActive && (
              <span className="font-mono text-emerald-800 font-medium inline-flex items-center gap-1">
                <Check className="w-3 h-3 text-emerald-600" />
                Carian Google Sheets Langsung Aktif
              </span>
            )}
          </div>
        </form>
      </div>

      {/* 🧭 3. Conditional State Render:
          State A: Not searched yet (Clean state with instructions)
          State B: Searched but 0 found (Empty state)
          State C: Multiple found (Selection list)
          State D: Active account selected (Profile Card & Edit Form)
      */}

      {/* STATE A: Initial Empty / Guidance State before searching */}
      {!hasSearched && (
        <div className="bg-[#FAF9F6] border border-dashed border-stone-300 rounded-2xl p-8 sm:p-12 text-center shadow-2xs space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-white border border-stone-300 flex items-center justify-center text-stone-700 shadow-2xs">
            <Search className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h2 className="text-base sm:text-lg font-serif-heading font-bold text-stone-900">
              Sedia Untuk Menyemak Profil Melalui No. Akaun
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed font-serif">
              Sila gunakan kotak carian di atas untuk memasukkan <strong>No. Akaun</strong> anda. 
              Sistem akan memaparkan profil akaun berkenaan untuk semakan dan kemaskini nombor telefon & email.
            </p>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-2 text-stone-500 text-[11px] font-mono">
            <span className="bg-white border border-stone-200 px-3 py-1.5 rounded-lg font-semibold text-stone-800 shadow-2xs">
              ✓ Carian Menggunakan Nombor Akaun Sahaja
            </span>
            {isSheetActive && (
              <span className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-3 py-1.5 rounded-lg font-semibold shadow-2xs inline-flex items-center gap-1">
                <Database className="w-3 h-3 text-emerald-700" />
                Pangkalan Data Google Sheets
              </span>
            )}
          </div>
        </div>
      )}

      {/* STATE B: Searched but 0 results found */}
      {hasSearched && searchResults.length === 0 && (
        <div className="bg-[#FAF9F6] border border-rose-200 rounded-2xl p-8 text-center shadow-2xs space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-rose-100 text-rose-800 flex items-center justify-center border border-rose-300">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h2 className="text-base font-serif-heading font-bold text-rose-950">
              Tiada Rekod No. Akaun Dijumpai
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed font-serif">
              Tiada rekod dipadankan dengan No. Akaun <strong>"{searchInput}"</strong>. 
              {isSheetActive && ' Sistem telah menyemak pangkalan data Google Sheets dan mendapati tiada rekod yang sepadan.'} Sila semak semula nombor akaun pada bil atau penyata anda.
            </p>
          </div>
          <button
            onClick={handleResetSearch}
            className="px-4 py-2 bg-white hover:bg-stone-100 text-stone-800 text-xs font-semibold rounded-xl border border-stone-300 transition-colors inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Cuba No. Akaun Lain</span>
          </button>
        </div>
      )}

      {/* STATE C: Multiple results found (Allow user to select which account to manage) */}
      {hasSearched && searchResults.length > 1 && !activeAccount && (
        <div className="bg-[#FAF9F6] border border-stone-300 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-200">
            <div>
              <h2 className="text-sm sm:text-base font-serif-heading font-bold text-stone-900">
                Dijumpai {searchResults.length} Padanan Akaun
              </h2>
              <p className="text-xs text-stone-500 font-serif">
                Sila pilih akaun yang ingin disemak atau dikemaskini maklumat perhubungannya.
              </p>
            </div>
            <span className="text-[10px] font-mono bg-white border border-stone-300 px-2.5 py-1 rounded-full text-stone-700 font-bold">
              {searchResults.length} Akaun
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {searchResults.map((acc, index) => {
              const isUpdated = acc.telahDikemaskini;
              return (
                <div
                  key={`search_res_${acc.id || acc.noAkaun}_${index}`}
                  onClick={() => selectAccountDirectly(acc)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer hover:shadow-xs flex flex-col justify-between ${
                    isUpdated
                      ? 'bg-emerald-50/80 border-emerald-300 hover:bg-emerald-100/70 border-l-4 border-l-emerald-600'
                      : 'bg-white border-stone-300 hover:bg-[#FAF8F5] border-l-4 border-l-stone-400'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-mono font-bold text-xs bg-stone-100 text-stone-900 px-2 py-0.5 rounded border border-stone-300">
                        {acc.noAkaun}
                      </span>
                      {isUpdated && (
                        <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded-full">
                          ✨ Dikemaskini
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-serif-heading font-bold text-stone-950 mb-1">
                      {acc.nama}
                    </h3>
                    <p className="text-xs text-stone-600 font-mono mb-2">
                      IC: {acc.kadPengenalan || '-'} | Kat: {acc.kategoriAkaun || 'Kediaman'}
                    </p>
                  </div>

                  <div className="pt-2.5 border-t border-stone-200/80 flex items-center justify-between text-xs">
                    <span className="text-[11px] font-mono text-stone-500">
                      Tel: {acc.noTel || 'Belum Diisi'}
                    </span>
                    <button
                      type="button"
                      className="px-2.5 py-1 bg-stone-900 hover:bg-black text-white rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      Pilih Profil →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* STATE D: Active Account Selected - Display Profile & Edit Form */}
      {activeAccount && (
        <div className="space-y-4">
          
          {/* Navigation Bar when viewing account */}
          <div className="flex items-center justify-between bg-white border border-stone-300 px-4 py-2.5 rounded-xl text-xs shadow-2xs">
            <button
              onClick={() => {
                if (searchResults.length > 1) {
                  setActiveAccountNo(null);
                } else {
                  handleResetSearch();
                }
              }}
              className="text-stone-700 hover:text-black font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{searchResults.length > 1 ? 'Kembali ke Senarai Padanan' : 'Carian Baru'}</span>
            </button>

            <div className="flex items-center gap-2">
              {isSheetActive && (
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded border border-emerald-300">
                  <Database className="w-2.5 h-2.5 text-emerald-700" />
                  Google Sheets DB
                </span>
              )}
              <span className="font-mono text-stone-500 text-[11px]">
                Akaun Dipilih: <strong className="text-stone-900">{activeAccount.noAkaun}</strong>
              </span>
            </div>
          </div>


          <div className="bg-[#FAF9F6] rounded-2xl border border-stone-300 overflow-hidden shadow-2xs">
            
            {/* Account Header */}
            <div className="p-4 sm:p-6 bg-[#1A1A1A] text-white flex flex-wrap items-center justify-between gap-4 border-b border-stone-800">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="bg-white text-stone-950 text-xs font-bold font-mono px-2.5 py-0.5 rounded shadow-2xs">
                    {activeAccount.noAkaun}
                  </span>
                  <span id="kategoriAkaun" className="text-xs text-stone-300 font-mono">
                    {activeAccount.kategoriAkaun || 'Akaun Pelanggan'}
                  </span>
                </div>
                <h2 className="text-lg sm:text-2xl font-serif-heading font-bold text-white">
                  {activeAccount.nama}
                </h2>
              </div>

              <div className="text-left sm:text-right">
                <span className="text-[10px] uppercase text-stone-400 block font-mono">Status Akaun</span>
                <span id="statusAkaun" className="text-xs font-mono font-bold bg-white/10 text-stone-200 border border-white/20 px-3 py-1 rounded inline-block mt-0.5">
                  {activeAccount.status}
                </span>
              </div>
            </div>

            {/* Form Body */}
            <form onSubmit={handleFormSubmit} className="p-5 sm:p-7 space-y-6 bg-white">
              
              {/* 🌟 EMERALD HIGHLIGHT BANNER IF ACCOUNT HAS BEEN UPDATED */}
              {activeAccount.telahDikemaskini && (
                <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-3 text-emerald-950">
                    <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs">
                      ✓
                    </div>
                    <div>
                      <span className="font-serif-heading font-bold text-emerald-950 text-sm block">
                        Rekod Profil Ini Telah Dikemaskini (Warna Hijau Zamrud)
                      </span>
                      <span className="text-[11px] text-emerald-800 font-mono">
                        Nombor telefon & email telah diselaraskan pada {activeAccount.lastUpdated} ({activeAccount.kemaskiniOleh || 'Pelanggan'})
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                    <span id="statusKemaskini" className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 text-[11px] font-mono font-bold whitespace-nowrap">
                      ✨ Status: Dikemaskini
                    </span>
                    <button
                      type="button"
                      onClick={() => generateProfileSummaryPDF(activeAccount)}
                      className="px-3 py-1 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
                      title="Muat turun slip resit rasmi kemaskini profil dalam format PDF"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Muat Turun Resit (PDF)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 🔒 1. SECTION: LOCKED FIELDS (READ-ONLY) */}
              <div className="bg-[#FAF9F6] border border-stone-300 rounded-xl p-4 sm:p-5 space-y-4 shadow-2xs">
                <div className="flex items-center justify-between pb-2.5 border-b border-stone-200">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-stone-700" />
                    <h3 className="text-xs sm:text-sm font-serif-heading font-bold text-stone-900 uppercase tracking-wider">
                      Maklumat Rasmi & Identiti (Terkunci)
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono font-semibold text-stone-600 bg-white border border-stone-300 px-2 py-0.5 rounded">
                    🔒 Read-Only
                  </span>
                </div>

                <p className="text-[11px] text-stone-500 font-serif italic">
                  Ruangan di bawah dipautkan secara terus kepada pangkalan data rasmi dan tidak boleh diubah melalui portal ini.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                  {/* No Akaun */}
                  <div>
                    <span className="text-stone-500 font-mono text-[10px] block mb-1 font-semibold">NO. AKAUN PELANGGAN</span>
                    <div className="p-3 bg-white border border-stone-300 rounded-xl font-mono font-bold text-stone-900 shadow-2xs flex items-center justify-between">
                      <span>{activeAccount.noAkaun}</span>
                      <Lock className="w-3.5 h-3.5 text-stone-400" />
                    </div>
                  </div>

                  {/* Kad Pengenalan with PDPA Masking */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-stone-500 font-mono text-[10px] font-semibold">NO. KAD PENGENALAN (IC)</span>
                      <button
                        type="button"
                        onClick={() => setRevealFullIC(!revealFullIC)}
                        className="text-[10px] text-stone-500 hover:text-stone-900 font-mono flex items-center gap-1 cursor-pointer transition-colors"
                        title={revealFullIC ? 'Sembunyikan format penuh (PDPA Masking)' : 'Papar Nombor Kad Pengenalan Penuh'}
                      >
                        {revealFullIC ? <EyeOff className="w-3 h-3 text-stone-600" /> : <Eye className="w-3 h-3 text-stone-600" />}
                        <span>{revealFullIC ? 'Sembunyi' : 'Papar Penuh'}</span>
                      </button>
                    </div>
                    <div id="noIC" className="p-3 bg-white border border-stone-300 rounded-xl font-mono font-medium text-stone-900 shadow-2xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-3.5 h-3.5 text-stone-400" />
                        <span>
                          {revealFullIC 
                            ? (activeAccount.kadPengenalan || 'Tiada Rekod') 
                            : maskKadPengenalan(activeAccount.kadPengenalan || 'Tiada Rekod')}
                        </span>
                      </div>
                      <span className="text-[9px] font-mono font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        PDPA
                      </span>
                    </div>
                  </div>

                  {/* Nama Penuh */}
                  <div className="sm:col-span-2">
                    <span className="text-stone-500 font-mono text-[10px] block mb-1 font-semibold">NAMA PENUH PEMILIK AKAUN</span>
                    <div id="namaPelanggan" className="p-3 bg-white border border-stone-300 rounded-xl font-serif-heading font-bold text-stone-950 shadow-2xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-stone-400" />
                        <span>{activeAccount.nama}</span>
                      </div>
                      <Lock className="w-3.5 h-3.5 text-stone-400" />
                    </div>
                  </div>
                </div>

                {/* 🏛️ Pengemaskinian Pemilikan (e-JPPH DBKL Hyperlink) */}
                <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-700 text-white flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="font-serif-heading font-bold text-blue-950 block text-xs sm:text-[13px]">
                        Ingin Membuat Pengemaskinian Pemilikan?
                      </span>
                      <p className="text-[11px] text-blue-800 font-serif leading-relaxed">
                        Untuk penukaran atau pengemaskinian nama hak milik pemilikan rasmi, sila buat permohonan melalui portal rasmi <strong>e-JPPH DBKL</strong>.
                      </p>
                    </div>
                  </div>
                  <a
                    id="btn-kemaskini-pemilikan"
                    href="https://ejpph.dbkl.gov.my/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-all shrink-0 cursor-pointer text-center"
                    title="Buka portal rasmi e-JPPH DBKL untuk pengemaskinian pemilikan"
                  >
                    <span>Kemaskini Pemilikan</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* ✏️ 2. SECTION: EDITABLE FIELDS (PHONE & EMAIL ONLY) */}
              <div className={`rounded-xl p-4 sm:p-5 space-y-4 shadow-2xs border-2 ${
                activeAccount.telahDikemaskini
                  ? 'bg-emerald-50/40 border-emerald-600'
                  : 'bg-[#FAF9F6] border-stone-800/80'
              }`}>
                <div className="flex items-center justify-between pb-2.5 border-b border-stone-300">
                  <div className="flex items-center gap-2">
                    <Edit3 className={`w-4 h-4 ${activeAccount.telahDikemaskini ? 'text-emerald-900' : 'text-stone-900'}`} />
                    <h3 className="text-xs sm:text-sm font-serif-heading font-bold text-stone-950 uppercase tracking-wider">
                      Maklumat Perhubungan (Boleh Dikemaskini)
                    </h3>
                  </div>
                  {activeAccount.telahDikemaskini ? (
                    <span className="text-[10px] font-mono font-bold text-emerald-900 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded shadow-2xs">
                      ✨ Telah Diselaraskan
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono font-bold text-stone-950 bg-white border border-stone-400 px-2.5 py-0.5 rounded shadow-2xs">
                      ✏️ Hanya 2 Ruangan Ini Sahaja
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  {/* 1. Nombor Telefon */}
                  <div>
                    <label htmlFor="noTel" className="font-bold text-stone-900 block mb-1.5 flex items-center justify-between">
                      <span>Nombor Telefon <span className="text-rose-600">*</span></span>
                      <span className="text-[10px] font-normal text-stone-500 font-mono">cth: 012-3456789</span>
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="noTel"
                        type="tel"
                        required
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        placeholder="012-XXXXXXX"
                        className="w-full pl-10 pr-3 py-3 bg-white border border-stone-300 rounded-xl text-stone-950 font-mono font-bold text-xs sm:text-sm focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900 shadow-2xs transition-all"
                      />
                    </div>
                  </div>

                  {/* 2. Alamat Email */}
                  <div>
                    <label htmlFor="email" className="font-bold text-stone-900 block mb-1.5 flex items-center justify-between">
                      <span>Alamat Email <span className="text-rose-600">*</span></span>
                      <span className="text-[10px] font-normal text-stone-500 font-mono">cth: nama@gmail.com</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="email"
                        type="email"
                        required
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        placeholder="pelanggan@email.com"
                        className="w-full pl-10 pr-3 py-3 bg-white border border-stone-300 rounded-xl text-stone-950 font-mono font-bold text-xs sm:text-sm focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900 shadow-2xs transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Validation Error Alert */}
              {validationError && (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-700" />
                  <span className="font-medium">{validationError}</span>
                </div>
              )}

              {/* Success Notification Alert with PDF Receipt Download */}
              {savedSuccess && (
                <div className="p-4 sm:p-5 bg-[#1A1A1A] text-white rounded-xl text-xs sm:text-sm font-semibold flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md animate-in fade-in duration-200 border border-stone-800">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                      <span className="block font-bold">
                        Kemaskini Berjaya Disimpan!
                      </span>
                      <span className="text-stone-300 font-normal text-xs font-serif">
                        Nombor telefon dan emel akaun <strong>{activeAccount.noAkaun}</strong> telah dikemaskini dalam pangkalan data.
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      id="download-receipt-pdf-btn"
                      onClick={() => generateProfileSummaryPDF(activeAccount)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-2xs flex items-center justify-center gap-2 transition-all cursor-pointer w-full sm:w-auto border border-emerald-500"
                    >
                      <Download className="w-4 h-4" />
                      <span>Muat Turun Resit PDF</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 🎁 3. SECTION: PROGRAM HADIAH PENGHARGAAN (1X SAHAJA) */}
              {activeAccount.telahDikemaskini && (
                <div className="bg-gradient-to-r from-amber-50/90 to-amber-100/60 border border-amber-300 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white border border-amber-300 flex items-center justify-center text-amber-700 shrink-0 shadow-2xs text-lg">
                      🎁
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-serif-heading font-bold text-stone-950 text-sm">
                          Hadiah Penghargaan Pelanggan
                        </h4>
                        <span className="text-[10px] font-mono bg-amber-200 text-amber-950 font-bold px-2 py-0.5 rounded border border-amber-300">
                          1x Sahaja
                        </span>
                      </div>
                      <p className="text-xs text-stone-700 font-serif mt-0.5">
                        {activeAccount.rewardStatus === 'Telah Dituntut' ? (
                          <span>Status Hadiah: <strong className="text-emerald-800">Telah Dituntut / Diserahkan</strong> ({activeAccount.rewardClaimedAt || 'Direkodkan'})</span>
                        ) : (
                          <span>Tahniah! Anda layak menerima hadiah penghargaan kerana berjaya mengemaskini profil kali pertama.</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white px-3 py-2 rounded-xl border border-amber-300 text-center shrink-0 shadow-2xs">
                    <span className="text-[10px] font-mono text-stone-500 block uppercase font-bold">Kod Baucar Hadiah</span>
                    <span className="font-mono font-bold text-amber-950 text-xs">
                      {activeAccount.rewardCode || `GIFT-${activeAccount.noAkaun}`}
                    </span>
                  </div>
                </div>
              )}

              {/* 📄 4. SECTION: DOKUMEN RESIT RASMI & SLIP PENGESAHAN */}
              {activeAccount.telahDikemaskini && (
                <div className="bg-[#FAF9F6] border border-stone-300 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white border border-stone-300 flex items-center justify-center text-emerald-700 shrink-0 shadow-2xs">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-serif-heading font-bold text-stone-900 text-sm flex items-center gap-2">
                        <span>Resit Rasmi Ringkasan Profil Pelanggan</span>
                        <span className="text-[10px] font-mono bg-emerald-100 text-emerald-900 font-bold px-2 py-0.5 rounded border border-emerald-300">
                          PDF Rasmi
                        </span>
                      </h4>
                      <p className="text-xs text-stone-600 font-serif mt-0.5">
                        Muat turun slip salinan rasmi yang mengandungi maklumat akaun terkunci, perhubungan terkini, dan kod baucar hadiah untuk simpanan pelanggan.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => generateProfileSummaryPDF(activeAccount)}
                    className="px-4 py-2.5 bg-stone-900 hover:bg-black text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-2xs transition-all cursor-pointer shrink-0 border border-stone-800"
                  >
                    <Download className="w-4 h-4 text-emerald-400" />
                    <span>Muat Turun Resit PDF</span>
                  </button>
                </div>
              )}

              {/* Footer Controls */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-stone-200 text-xs">
                <div className="text-stone-500 font-mono text-[11px] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-stone-400" />
                  <span>Kemaskini Terakhir: {activeAccount.lastUpdated} ({activeAccount.kemaskiniOleh || 'Sistem'})</span>
                </div>

                <div className="flex items-center justify-end gap-2.5">
                  {isChanged && (
                    <button
                      type="button"
                      onClick={handleResetForm}
                      className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-medium transition-colors flex items-center gap-1.5 border border-stone-300"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Batal Perubahan</span>
                    </button>
                  )}

                  <button
                    id="submit-profile-update-btn"
                    type="submit"
                    disabled={isSaving}
                    className={`px-6 py-2.5 rounded-xl font-bold shadow-2xs transition-all flex items-center justify-center gap-2 border cursor-pointer ${
                      isChanged
                        ? 'bg-[#1A1A1A] hover:bg-black text-[#FDFCFB] border-stone-800 hover:shadow-md'
                        : 'bg-stone-900 text-white border-stone-800 hover:bg-black'
                    }`}
                  >
                    {isSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Simpan Kemaskini Profil</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* 🛡️ Cyber Security & PDPA Center Modal */}
      <CyberSecurityShieldModal 
        isOpen={isSecurityModalOpen} 
        onClose={() => setIsSecurityModalOpen(false)} 
      />
    </div>
  );
};
