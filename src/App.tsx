/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  ActiveTab, 
  DeviceFrame, 
  CustomerAccount, 
  ProfileUpdateAuditLog,
  AdminRole,
  GoogleSheetsConfig
} from './types';
import { initialCustomerAccounts } from './data/sampleAccounts';
import { Navbar } from './components/Navbar';
import { CustomerPortalLookup } from './components/CustomerPortalLookup';
import { AccountDirectoryView } from './components/AccountDirectoryView';
import { AuditLogsView } from './components/AuditLogsView';
import { CustomerSpreadsheetView } from './components/CustomerSpreadsheetView';
import { ExcelImportManagerView } from './components/ExcelImportManagerView';
import { GiftManagementSection } from './components/GiftManagementSection';
import { GoogleSheetsDatabaseView } from './components/GoogleSheetsDatabaseView';
import { BigQueryDatabaseView } from './components/BigQueryDatabaseView';
import { GlideGuideModal } from './components/GlideGuideModal';
import { AdminLoginModal } from './components/AdminLoginModal';
import { ResetDisplayModal, ResetSectionKey } from './components/ResetDisplayModal';
import { exportAccountsToExcel } from './utils/excelHelper';
import { getMalaysiaDateTime, getMalaysiaTime } from './utils/dateHelper';
import { useToast } from './context/ToastContext';
import { Lock, ShieldAlert, ArrowLeft, KeyRound, Cloud, CloudCheck, CloudOff, Database, Crown, Shield, HardDrive } from 'lucide-react';
import { 
  subscribeToAccounts, 
  subscribeToAuditLogs, 
  fetchAccountsFromFirestore,
  fetchAuditLogsFromFirestore,
  saveAccountToFirestore, 
  saveAuditLogToFirestore, 
  batchSaveAccountsToFirestore, 
  clearAllAccountsInFirestore,
  clearAllAuditLogsInFirestore,
  isFirestoreQuotaExceeded,
  subscribeToGoogleSheetsConfig,
  fetchGoogleSheetsConfigFromFirestore
} from './services/firebaseService';
import { 
  saveAccountsToIDB, 
  loadAccountsFromIDB, 
  saveAuditLogsToIDB, 
  loadAuditLogsFromIDB, 
  clearAllIDB 
} from './utils/idbStorage';
import { 
  getStoredGoogleSheetsConfig, 
  saveGoogleSheetsConfig,
  updateSingleCustomerInGoogleSheet, 
  addGoogleSyncLog,
  fetchLiveAccountsFromGoogleSheets,
  muatTurunDataProfile,
  simpanKemaskini,
  CENTRAL_APPS_SCRIPT_API_URL
} from './services/googleSheetsService';
import { purgeLegacyCredentials, hashPassword } from './utils/security';

const STORAGE_ACCOUNTS_KEY = 'customer_portal_accounts_v6';
const STORAGE_AUDIT_LOGS_KEY = 'customer_portal_audit_logs_v6';
const STORAGE_ADMIN_AUTH_KEY = 'customer_portal_admin_authenticated';
const STORAGE_ADMIN_ROLE_KEY = 'customer_portal_admin_role_v6';
const STORAGE_DB_INITIALIZED_KEY = 'customer_portal_db_initialized_v6';

const TAB_LABELS: Record<ActiveTab, string> = {
  lookup: 'Carian & Kemaskini Profil',
  import_excel: 'Carian & Kemaskini Data Pelanggan',
  directory: 'Direktori Akaun',
  audit_logs: 'Log Kemaskini & Audit',
  spreadsheet: 'Pangkalan Data Helaian',
  google_sheets: 'Pangkalan Data Google Sheets',
  bigquery: 'Pangkalan Data Google BigQuery',
  gift_management: 'Pengurusan Hadiah',
};

export default function App() {
  const { showSuccess, showError, showWarning } = useToast();

  // Navigation & View Mode State - Default to 'lookup' (Public Portal)
  const [activeTab, setActiveTab] = useState<ActiveTab>('lookup');
  const [prefilledLookupAccountNo, setPrefilledLookupAccountNo] = useState<string | null>(null);
  const [deviceFrame, setDeviceFrame] = useState<DeviceFrame>('responsive');
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showResetDisplayModal, setShowResetDisplayModal] = useState(false);

  // Admin & Super Admin Role Authentication State
  const [adminRole, setAdminRole] = useState<AdminRole | null>(() => {
    try {
      const savedRole = localStorage.getItem(STORAGE_ADMIN_ROLE_KEY);
      if (savedRole === 'super_admin' || savedRole === 'admin') return savedRole;
      const legacyAuth = localStorage.getItem(STORAGE_ADMIN_AUTH_KEY);
      if (legacyAuth === 'true') return 'admin';
      return null;
    } catch {
      return null;
    }
  });

  const isAdmin = Boolean(adminRole);
  const isSuperAdmin = adminRole === 'super_admin';

  // Purge legacy plaintext test credentials from browser storage on load
  useEffect(() => {
    purgeLegacyCredentials();
  }, []);

  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [pendingAdminTargetTab, setPendingAdminTargetTab] = useState<ActiveTab | undefined>(undefined);
  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(true);

  // Google Sheets Live DB Connection State
  const [gsConfig, setGsConfig] = useState<GoogleSheetsConfig>(() => getStoredGoogleSheetsConfig());

  // Refresh Google Sheets config on tab switches
  useEffect(() => {
    const current = getStoredGoogleSheetsConfig();
    setGsConfig(current);
  }, [activeTab]);

  // Accounts state with LocalStorage - initialized from cache then synced live with Firestore
  const [accounts, setAccounts] = useState<CustomerAccount[]>(() => {
    try {
      const isInitialized = localStorage.getItem(STORAGE_DB_INITIALIZED_KEY) === 'true';
      const saved = localStorage.getItem(STORAGE_ACCOUNTS_KEY);
      if (saved !== null) {
        const parsed: CustomerAccount[] = JSON.parse(saved);
        if (parsed.length > 0) {
          return parsed.map((acc, idx) => ({
            ...acc,
            id: acc.id || `acc_${idx}_${acc.noAkaun || Math.random().toString(36).substring(2, 7)}`,
          }));
        }
      }
      if (isInitialized) {
        return [];
      }
      return initialCustomerAccounts;
    } catch {
      return initialCustomerAccounts;
    }
  });

  // Audit Logs state
  const [auditLogs, setAuditLogs] = useState<ProfileUpdateAuditLog[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_AUDIT_LOGS_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}

    return [];
  });

  // IndexedDB ready flag to prevent premature sync overwriting on initial render
  const isIDBReadyRef = useRef(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);

  // Reload records from Cloud Firestore & Central Database without deleting anything
  const handleReloadFromCloud = async (showToast = true) => {
    setIsSyncingCloud(true);
    try {
      const [cloudAccounts, cloudLogs] = await Promise.all([
        fetchAccountsFromFirestore(),
        fetchAuditLogsFromFirestore(),
      ]);

      let loadedAccountsCount = 0;
      let loadedLogsCount = 0;

      if (cloudAccounts && cloudAccounts.length > 0) {
        setAccounts(cloudAccounts);
        loadedAccountsCount = cloudAccounts.length;
        saveAccountsToIDB(cloudAccounts).catch(() => {});
        try {
          localStorage.setItem(STORAGE_ACCOUNTS_KEY, JSON.stringify(cloudAccounts));
        } catch {}
      }

      if (cloudLogs && cloudLogs.length > 0) {
        setAuditLogs(cloudLogs);
        loadedLogsCount = cloudLogs.length;
        saveAuditLogsToIDB(cloudLogs).catch(() => {});
        try {
          localStorage.setItem(STORAGE_AUDIT_LOGS_KEY, JSON.stringify(cloudLogs));
        } catch {}
      }

      setIsCloudConnected(true);

      if (showToast) {
        showSuccess(
          'Penyegerakan Awan Selesai',
          `Sebanyak ${loadedAccountsCount} akaun dan ${loadedLogsCount} log audit telah disegerakkan dengan pangkalan data awan.`
        );
      }
    } catch (err: any) {
      console.warn('Reload from cloud warning:', err);
      if (showToast) {
        showWarning('Peringatan Muat Semula', 'Pangkalan data awan beroperasi dalam mod storan selamat.');
      }
    } finally {
      setIsSyncingCloud(false);
    }
  };

  // ⚡ Live Firestore Real-Time Subscriptions & Cross-Device Cloud Data Synchronization
  useEffect(() => {
    // 1. Attempt to load from high-capacity IndexedDB on startup
    loadAccountsFromIDB().then((cachedAccounts) => {
      isIDBReadyRef.current = true;
      if (cachedAccounts && cachedAccounts.length > 0) {
        setAccounts((prev) => {
          if (cachedAccounts.length >= prev.length || prev === initialCustomerAccounts) {
            return cachedAccounts;
          }
          return prev;
        });
      }
    }).catch(() => {
      isIDBReadyRef.current = true;
    });

    loadAuditLogsFromIDB().then((cachedLogs) => {
      if (cachedLogs && cachedLogs.length > 0) {
        setAuditLogs(cachedLogs);
      }
    }).catch(() => {});

    // 2. Direct fetch from Cloud Firestore (ensures instant data fetch across any new device/browser)
    fetchAccountsFromFirestore().then((cloudAccounts) => {
      if (cloudAccounts && cloudAccounts.length > 0) {
        setIsCloudConnected(true);
        setAccounts(cloudAccounts);
        saveAccountsToIDB(cloudAccounts).catch(() => {});
        try {
          localStorage.setItem(STORAGE_DB_INITIALIZED_KEY, 'true');
        } catch {}
      }
    }).catch((err) => {
      console.warn('[Firestore] Direct fetch initial warning:', err);
    });

    fetchAuditLogsFromFirestore().then((cloudLogs) => {
      if (cloudLogs && cloudLogs.length > 0) {
        setAuditLogs(cloudLogs);
        saveAuditLogsToIDB(cloudLogs).catch(() => {});
      }
    }).catch(() => {});

    // 2b. Direct fetch Google Sheets Config from Cloud Firestore
    fetchGoogleSheetsConfigFromFirestore().then((cloudConfig) => {
      if (cloudConfig && cloudConfig.isConnected && (cloudConfig.spreadsheetId || cloudConfig.appsScriptUrl)) {
        setGsConfig(cloudConfig);
        saveGoogleSheetsConfig(cloudConfig, true);
      }
    }).catch(() => {});

    // 2c. ⚡ FUNGSI MEMBACA DATA (Pangkalan Data Terpusat Google Apps Script)
    muatTurunDataProfile().then((gsAccounts) => {
      if (gsAccounts && gsAccounts.length > 0) {
        console.log("Data rekod dari Google Sheet berjaya dimuat turun:", gsAccounts.length);
        setAccounts((prev) => {
          if (prev.length === 0 || prev === initialCustomerAccounts) {
            return gsAccounts;
          }
          const map = new Map<string, CustomerAccount>();
          gsAccounts.forEach((a) => map.set(a.noAkaun.toLowerCase(), a));
          prev.forEach((a) => {
            if (!map.has(a.noAkaun.toLowerCase())) {
              map.set(a.noAkaun.toLowerCase(), a);
            }
          });
          return Array.from(map.values());
        });
        saveAccountsToIDB(gsAccounts).catch(() => {});
      }
    }).catch((err) => {
      console.info('[Google Apps Script] Initial muatTurunDataProfile info:', err);
    });

    // 3. Real-time Firestore snapshot listeners
    const unsubscribeAccounts = subscribeToAccounts(
      (firestoreAccounts) => {
        setIsCloudConnected(true);
        if (firestoreAccounts && firestoreAccounts.length > 0) {
          setAccounts(firestoreAccounts);
          saveAccountsToIDB(firestoreAccounts).catch(() => {});
          try {
            localStorage.setItem(STORAGE_DB_INITIALIZED_KEY, 'true');
          } catch {}
        }
      },
      (err) => {
        setIsCloudConnected(false);
      }
    );

    const unsubscribeLogs = subscribeToAuditLogs(
      (firestoreLogs) => {
        setIsCloudConnected(true);
        if (firestoreLogs && firestoreLogs.length > 0) {
          setAuditLogs(firestoreLogs);
          saveAuditLogsToIDB(firestoreLogs).catch(() => {});
        }
      },
      (err) => {
        // Handled silently
      }
    );

    const unsubscribeGsConfig = subscribeToGoogleSheetsConfig(
      (cloudConfig) => {
        if (cloudConfig) {
          setGsConfig(cloudConfig);
          saveGoogleSheetsConfig(cloudConfig, true);
        }
      },
      (err) => {
        // Handled silently
      }
    );

    // 4. Auto re-fetch when user switches tabs or window gains focus (e.g. from Chrome to Edge)
    const handleWindowFocus = () => {
      handleReloadFromCloud(false);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleReloadFromCloud(false);
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      unsubscribeAccounts();
      unsubscribeLogs();
      unsubscribeGsConfig();
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Sync to IndexedDB & LocalStorage as instant local cache (safe bounded for huge datasets)
  useEffect(() => {
    if (!isIDBReadyRef.current) return;
    saveAccountsToIDB(accounts).catch(() => {});
    try {
      if (accounts.length <= 2500) {
        localStorage.setItem(STORAGE_ACCOUNTS_KEY, JSON.stringify(accounts));
      } else {
        // For large datasets, cache the top 2,500 most recently updated accounts in localStorage
        const topSlice = accounts.slice(0, 2500);
        localStorage.setItem(STORAGE_ACCOUNTS_KEY, JSON.stringify(topSlice));
      }
    } catch {
      // Storage quota exceeded fallback
      try {
        const miniSlice = accounts.slice(0, 500);
        localStorage.setItem(STORAGE_ACCOUNTS_KEY, JSON.stringify(miniSlice));
      } catch {}
    }
  }, [accounts]);

  useEffect(() => {
    saveAuditLogsToIDB(auditLogs).catch(() => {});
    try {
      localStorage.setItem(STORAGE_AUDIT_LOGS_KEY, JSON.stringify(auditLogs));
    } catch {}
  }, [auditLogs]);

  useEffect(() => {
    try {
      if (adminRole) {
        localStorage.setItem(STORAGE_ADMIN_ROLE_KEY, adminRole);
        localStorage.setItem(STORAGE_ADMIN_AUTH_KEY, 'true');
      } else {
        localStorage.removeItem(STORAGE_ADMIN_ROLE_KEY);
        localStorage.removeItem(STORAGE_ADMIN_AUTH_KEY);
      }
    } catch {}
  }, [adminRole]);

  const handleUpdateAdminPassword = (newPass: string) => {
    try {
      localStorage.setItem('customer_portal_admin_hash_v2', hashPassword(newPass));
    } catch {}
  };

  const handleUpdateSuperAdminPassword = (newPass: string) => {
    try {
      localStorage.setItem('customer_portal_super_admin_hash_v2', hashPassword(newPass));
    } catch {}
  };

  const handleAdminLoginSuccess = (role: AdminRole) => {
    setAdminRole(role);
    setShowAdminLoginModal(false);
    if (pendingAdminTargetTab) {
      // If target tab is Super Admin only and user logged in as regular admin, route to directory
      if ((pendingAdminTargetTab === 'import_excel' || pendingAdminTargetTab === 'google_sheets' || pendingAdminTargetTab === 'gift_management') && role !== 'super_admin') {
        setActiveTab('directory');
      } else {
        setActiveTab(pendingAdminTargetTab);
      }
      setPendingAdminTargetTab(undefined);
    }
  };

  const handleLogoutAdmin = () => {
    setAdminRole(null);
    try {
      localStorage.removeItem(STORAGE_ADMIN_AUTH_KEY);
      localStorage.removeItem(STORAGE_ADMIN_ROLE_KEY);
    } catch {}
    setActiveTab('lookup');
  };

  const handleOpenAdminLogin = (targetTab?: ActiveTab) => {
    setPendingAdminTargetTab(targetTab);
    setShowAdminLoginModal(true);
  };

  // Handle Account Update (Only Phone & Email allowed, strictly 1-time reward per customer)
  const handleUpdateAccount = (
    updated: CustomerAccount,
    changedFields: string[] = [],
    oldPhone: string = '',
    oldEmail: string = ''
  ) => {
    // Find existing account to check previous reward status
    const existingAccount = accounts.find((a) => a.noAkaun.toLowerCase() === updated.noAkaun.toLowerCase());
    
    // Check if this account already received reward eligibility in previous updates or existing audit logs
    const hadRewardBefore =
      existingAccount?.rewardStatus === 'Layak (Belum Dituntut)' ||
      existingAccount?.rewardStatus === 'Telah Dituntut' ||
      auditLogs.some(
        (l) => l.noAkaun.toLowerCase() === updated.noAkaun.toLowerCase() && l.isRewardEligible
      );

    const isFirstQualifyingUpdate = !hadRewardBefore && changedFields.length > 0;
    const rewardCode =
      existingAccount?.rewardCode ||
      `GIFT-${updated.noAkaun.replace(/[^A-Za-z0-9]/g, '') || Math.floor(100000 + Math.random() * 900000)}`;

    const currentRewardStatus = hadRewardBefore
      ? existingAccount?.rewardStatus || 'Layak (Belum Dituntut)'
      : isFirstQualifyingUpdate
      ? 'Layak (Belum Dituntut)'
      : 'Belum Layak';

    const now = getMalaysiaDateTime();

    const updatedAccountWithFlag: CustomerAccount = {
      ...updated,
      id: updated.id || existingAccount?.id || `acc_${Date.now()}_${updated.noAkaun}`,
      telahDikemaskini: true,
      updatedFields: changedFields.length > 0 ? changedFields : updated.updatedFields,
      rewardStatus: currentRewardStatus,
      rewardCode: rewardCode,
      rewardEligibilityDate: isFirstQualifyingUpdate
        ? now
        : existingAccount?.rewardEligibilityDate || (hadRewardBefore ? existingAccount?.lastUpdated : undefined),
      updateCount: (existingAccount?.updateCount || 0) + (changedFields.length > 0 ? 1 : 0),
    };

    setAccounts((prev) =>
      prev.map((a) => {
        const isTarget = updated.id && a.id ? a.id === updated.id : a.noAkaun === updated.noAkaun;
        return isTarget ? updatedAccountWithFlag : a;
      })
    );

    // ⚡ Real-Time Cloud Save: Firestore
    saveAccountToFirestore(updatedAccountWithFlag).catch((err) => {
      console.warn('Could not sync account update to Firestore immediately:', err);
    });

    // ⚡ Real-Time Google Sheets Auto-Sync (if connected and enabled)
    try {
      const gsConfig = getStoredGoogleSheetsConfig();
      if (gsConfig.isConnected && gsConfig.spreadsheetId && gsConfig.autoSyncOnUpdate) {
        updateSingleCustomerInGoogleSheet(
          gsConfig.spreadsheetId,
          updatedAccountWithFlag,
          gsConfig.sheetName || 'Sheet1'
        ).then((synced) => {
          if (synced) {
            addGoogleSyncLog(
              'AUTO_KEMASKINI',
              'BERJAYA',
              `Auto-sync akaun ${updated.noAkaun} (${changedFields.join(', ') || 'Profil'}) ke Google Sheet.`
            );
          }
        }).catch((e) => {
          console.warn('Google Sheets auto-sync error:', e);
        });
      }
    } catch (e) {
      console.warn('Google Sheets auto-sync check error:', e);
    }

    // Create Audit Log if there were changes
    if (changedFields.length > 0) {
      const newLog: ProfileUpdateAuditLog = {
        id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        noAkaun: updated.noAkaun,
        nama: updated.nama,
        oldPhone: oldPhone || updated.noTel,
        newPhone: updated.noTel,
        oldEmail: oldEmail || updated.email,
        newEmail: updated.email,
        changedFields,
        timestamp: now,
        source: isAdmin ? 'Pentadbir' : 'Portal Pelanggan',
        isRewardEligible: isFirstQualifyingUpdate,
        rewardStatus: isFirstQualifyingUpdate
          ? 'Layak Hadiah (Kali Pertama)'
          : 'Kemaskini Ulangan (Hadiah Sudah Diberi)',
        rewardCode: rewardCode,
        rewardClaimed: existingAccount?.rewardStatus === 'Telah Dituntut',
        rewardClaimedAt: existingAccount?.rewardClaimedAt,
      };
      setAuditLogs((prev) => [newLog, ...prev]);

      // ⚡ Real-Time Cloud Save: Firestore Audit Log
      saveAuditLogToFirestore(newLog).catch((err) => {
        console.warn('Could not sync audit log to Firestore:', err);
      });
    }
  };

  // Handle claiming/dispatching the 1-time reward for a customer
  const handleClaimReward = (noAkaun: string, giftName?: string, remainingStock?: number) => {
    const now = getMalaysiaDateTime();

    const targetAccount = accounts.find((a) => a.noAkaun.toLowerCase() === noAkaun.toLowerCase());
    if (targetAccount) {
      const updatedAcc: CustomerAccount = {
        ...targetAccount,
        rewardStatus: 'Telah Dituntut',
        rewardClaimedAt: now,
        rewardGiftName: giftName || targetAccount.rewardGiftName,
        rewardGiftRemainingStock: typeof remainingStock === 'number' ? remainingStock : targetAccount.rewardGiftRemainingStock,
      };
      saveAccountToFirestore(updatedAcc).catch(console.warn);
    }

    setAccounts((prev) =>
      prev.map((a) => {
        if (a.noAkaun.toLowerCase() === noAkaun.toLowerCase()) {
          return {
            ...a,
            rewardStatus: 'Telah Dituntut',
            rewardClaimedAt: now,
            rewardGiftName: giftName || a.rewardGiftName,
            rewardGiftRemainingStock: typeof remainingStock === 'number' ? remainingStock : a.rewardGiftRemainingStock,
          };
        }
        return a;
      })
    );

    setAuditLogs((prev) =>
      prev.map((l) => {
        if (l.noAkaun.toLowerCase() === noAkaun.toLowerCase()) {
          const updatedLog: ProfileUpdateAuditLog = {
            ...l,
            rewardClaimed: true,
            rewardClaimedAt: now,
            rewardStatus: l.isRewardEligible ? 'Telah Dituntut' : l.rewardStatus,
            rewardGiftName: giftName || l.rewardGiftName,
            rewardGiftRemainingStock: typeof remainingStock === 'number' ? remainingStock : l.rewardGiftRemainingStock,
          };
          saveAuditLogToFirestore(updatedLog).catch(console.warn);
          return updatedLog;
        }
        return l;
      })
    );
  };

  // Handle Adding New Account
  const handleAddAccount = (newAcc: CustomerAccount) => {
    setAccounts((prev) => [newAcc, ...prev]);
    saveAccountToFirestore(newAcc).catch(console.warn);
  };

  // Handle Batch Excel Import with merge or replace modes (Memelihara 100% semua baris & membenarkan No. Akaun berulang)
  const handleImportAccountsWithMode = (imported: CustomerAccount[], mode: 'merge' | 'replace' = 'merge') => {
    isIDBReadyRef.current = true;

    // ⚡ Real-Time Cloud Batch Save to Firestore
    batchSaveAccountsToFirestore(imported, mode).catch((err) => {
      console.warn('Firestore batch import warning:', err);
    });

    if (mode === 'replace') {
      setAccounts(imported);
      saveAccountsToIDB(imported).catch(() => {});
    } else {
      setAccounts((prev) => {
        // In merge mode, preserve all incoming rows; if an exact unique id matches, update, otherwise append
        const idMap = new Map<string, CustomerAccount>();
        prev.forEach((a) => {
          if (a.id) idMap.set(a.id, a);
        });

        const newItems: CustomerAccount[] = [];
        imported.forEach((item) => {
          if (item.id && idMap.has(item.id)) {
            idMap.set(item.id, item);
          } else {
            newItems.push(item);
          }
        });

        const combined = [...Array.from(idMap.values()), ...newItems];
        saveAccountsToIDB(combined).catch(() => {});
        return combined;
      });
    }
  };

  const handleImportAccounts = (imported: CustomerAccount[]) => {
    handleImportAccountsWithMode(imported, 'merge');
  };

  // Request Reset Display Records (Open Modal) - RESTRICTED TO SUPER ADMIN ONLY
  const handleRequestResetDisplay = () => {
    if (!isSuperAdmin) {
      showError('Akses Ditolak', 'Fungsi Reset Rekod Dipaparan hanya boleh dilaksanakan oleh Super Admin sahaja.');
      handleOpenAdminLogin('import_excel');
      return;
    }
    setShowResetDisplayModal(true);
  };

  // Confirm and Execute Selective Display Reset (WITHOUT deleting from Cloud Database)
  const handleConfirmResetDisplay = (selectedSections: ResetSectionKey[]) => {
    if (!isSuperAdmin) {
      showError('Akses Ditolak', 'Fungsi Reset Rekod Dipaparan hanya boleh dilaksanakan oleh Super Admin sahaja.');
      handleOpenAdminLogin('import_excel');
      return;
    }

    if (selectedSections.length === 0) {
      showWarning('Tiada Pilihan', 'Sila pilih sekurang-kurangnya satu bahagian paparan untuk di-reset.');
      return;
    }

    const resetLabels: string[] = [];
    const shouldResetDirectory = selectedSections.includes('directory');
    const shouldResetAudit = selectedSections.includes('audit_logs');
    const shouldResetSpreadsheet = selectedSections.includes('spreadsheet');

    if (shouldResetDirectory || shouldResetSpreadsheet) {
      setAccounts([]);
      try {
        localStorage.setItem(STORAGE_ACCOUNTS_KEY, JSON.stringify([]));
        localStorage.setItem(STORAGE_DB_INITIALIZED_KEY, 'true');
      } catch {}
      if (shouldResetDirectory) resetLabels.push('Direktori Akaun');
      if (shouldResetSpreadsheet) resetLabels.push('Helaian Data');
    }

    if (shouldResetAudit) {
      setAuditLogs([]);
      try {
        localStorage.setItem(STORAGE_AUDIT_LOGS_KEY, JSON.stringify([]));
      } catch {}
      resetLabels.push('Log Audit');
    }

    showSuccess(
      'Reset Rekod Dipaparan Berjaya',
      `Paparan bagi [${resetLabels.join(', ')}] telah berjaya ditetapkan semula. Data pangkalan data awan (Firestore) kekal selamat.`
    );
  };

  // 🔄 Sync latest customer records directly from connected Google Sheet into system state & Firestore
  const handleSyncFromGoogleSheets = async (): Promise<CustomerAccount[]> => {
    const result = await fetchLiveAccountsFromGoogleSheets();
    if (result.success && result.accounts.length > 0) {
      handleImportAccountsWithMode(result.accounts, 'merge');
      const updatedConfig = getStoredGoogleSheetsConfig();
      setGsConfig(updatedConfig);
      return result.accounts;
    }
    return [];
  };

  // 📥 Dynamically save/sync single account found from live Google Sheets search
  const handleAccountFoundFromGoogleSheets = (account: CustomerAccount) => {
    setAccounts((prev) => {
      const exists = prev.some((a) => a.noAkaun.toLowerCase() === account.noAkaun.toLowerCase());
      if (exists) {
        return prev.map((a) => (a.noAkaun.toLowerCase() === account.noAkaun.toLowerCase() ? { ...a, ...account } : a));
      }
      return [account, ...prev];
    });
    saveAccountToFirestore(account).catch(console.warn);
  };

  // Render current tab content with Security Wall for Admin & Super Admin views
  const renderTabContent = () => {
    // Public view is ALWAYS accessible without login
    if (activeTab === 'lookup') {
      return (
        <CustomerPortalLookup
          accounts={accounts}
          onUpdateAccount={handleUpdateAccount}
          initialAccountNo={prefilledLookupAccountNo}
          onClearInitialAccount={() => setPrefilledLookupAccountNo(null)}
          isGoogleSheetsConnected={gsConfig.isConnected && Boolean(gsConfig.spreadsheetId)}
          googleSheetName={gsConfig.spreadsheetName}
          googleSheetUrl={gsConfig.spreadsheetUrl}
          onSyncFromGoogleSheets={handleSyncFromGoogleSheets}
          onAddFetchedAccount={handleAccountFoundFromGoogleSheets}
          isSuperAdmin={isSuperAdmin}
        />
      );
    }

    // 🔒 SUPER ADMIN ONLY TABS: Import & Kemaskini Excel, Google Sheets DB, BigQuery, and Gift Management
    if (activeTab === 'import_excel' || activeTab === 'google_sheets' || activeTab === 'bigquery' || activeTab === 'gift_management') {
      if (!isSuperAdmin) {
        return (
          <div className="max-w-xl mx-auto py-12 px-4">
            <div className="bg-white border border-purple-200 rounded-3xl p-8 shadow-xl text-center space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-purple-100 border border-purple-300 text-purple-900 flex items-center justify-center mx-auto shadow-inner">
                <Crown className="w-8 h-8 text-purple-700" />
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-purple-900 bg-purple-100 border border-purple-300 px-3 py-1 rounded-full inline-flex items-center gap-1.5">
                  <Crown className="w-3 h-3 text-amber-500" />
                  Eksklusif Super Admin
                </span>
                <h2 className="text-xl sm:text-2xl font-bold font-serif-heading text-stone-900">
                  Akses Super Admin Diperlukan
                </h2>
                <p className="text-xs sm:text-sm text-stone-600 max-w-md mx-auto leading-relaxed">
                  Bahagian <strong>{TAB_LABELS[activeTab]}</strong> hanya dibenarkan kepada <strong>Super Admin</strong> sahaja demi keselamatan dan integriti pangkalan data pelanggan.
                </p>
              </div>

              <div className="bg-purple-50/70 border border-purple-200 rounded-2xl p-4 text-xs text-purple-950 text-left space-y-2">
                <div className="flex items-center justify-between font-bold font-serif-heading text-purple-900">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-purple-700" />
                    <span>Status Kebenaran Semasa</span>
                  </div>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-white/80 border border-purple-200">
                    {adminRole === 'admin' ? 'Pentadbir Biasa' : 'Belum Log Masuk'}
                  </span>
                </div>
                <p className="text-[11px] text-purple-800 leading-relaxed">
                  {adminRole === 'admin' 
                    ? 'Anda kini log masuk sebagai Pentadbir Biasa. Sila sahkan kata laluan Super Admin untuk membuka akses pengurusan dan kemaskini data pelanggan.'
                    : 'Sila log masuk dengan akaun Super Admin untuk menguruskan pangkalan data dan carian khas pelanggan.'}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => setActiveTab(isAdmin ? 'directory' : 'lookup')}
                  className="w-full sm:w-auto px-5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>{isAdmin ? 'Ke Direktori Akaun' : 'Kembali ke Portal Awam'}</span>
                </button>

                <button
                  onClick={() => handleOpenAdminLogin(activeTab)}
                  className="w-full sm:w-auto px-6 py-2.5 bg-purple-900 hover:bg-purple-950 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 border border-purple-800 cursor-pointer"
                >
                  <Crown className="w-4 h-4 text-amber-300" />
                  <span>{isAdmin ? 'Naik Taraf ke Super Admin' : 'Log Masuk Super Admin'}</span>
                </button>
              </div>
            </div>
          </div>
        );
      }
    }

    // 🛡️ REGULAR ADMIN TABS: directory, audit_logs, spreadsheet
    if (!isAdmin) {
      return (
        <div className="max-w-xl mx-auto py-12 px-4">
          <div className="bg-white border border-stone-300 rounded-3xl p-8 shadow-xl text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-inner">
              <Lock className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-700 bg-amber-100 border border-amber-300/80 px-2.5 py-1 rounded-full">
                Akses Terhad Pentadbir Sistem
              </span>
              <h2 className="text-xl sm:text-2xl font-bold font-serif-heading text-stone-900">
                Bahagian Dilindungi Kata Laluan
              </h2>
              <p className="text-xs sm:text-sm text-stone-600 max-w-md mx-auto leading-relaxed">
                Pengguna awam/pelanggan hanya boleh mengakses modul <strong>Carian & Kemaskini Profil</strong>. Modul <strong>{TAB_LABELS[activeTab]}</strong> memerlukan pengesahan kata laluan pentadbir sistem.
              </p>
            </div>

            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 text-xs text-stone-600 text-left space-y-2">
              <div className="flex items-center gap-2 text-stone-800 font-bold font-serif-heading">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span>Maklumat Akses Pentadbir</span>
              </div>
              <p className="text-[11px] text-stone-500">
                Sila masukkan kata laluan admin untuk mengurus direktori pelanggan, pangkalan data helaian dan log audit.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setActiveTab('lookup')}
                className="w-full sm:w-auto px-5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali ke Portal Awam</span>
              </button>

              <button
                onClick={() => handleOpenAdminLogin(activeTab)}
                className="w-full sm:w-auto px-6 py-2.5 bg-[#1A1A1A] hover:bg-black text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 border border-stone-800 cursor-pointer"
              >
                <KeyRound className="w-4 h-4 text-amber-400" />
                <span>Log Masuk Admin Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Authenticated Views (Admin & Super Admin)
    switch (activeTab) {
      case 'import_excel':
        return (
          <ExcelImportManagerView
            accounts={accounts}
            onImportAccounts={handleImportAccountsWithMode}
            onUpdateAccount={handleUpdateAccount}
            onNavigateToLookup={(noAkaun) => {
              setPrefilledLookupAccountNo(noAkaun);
              setActiveTab('lookup');
            }}
            onClearAllAccounts={handleRequestResetDisplay}
            isSuperAdmin={isSuperAdmin}
            onRequireSuperAdmin={() => handleOpenAdminLogin('import_excel')}
          />
        );
      case 'directory':
        return (
          <AccountDirectoryView
            accounts={accounts}
            onSelectAccountForLookup={(acc) => {
              setPrefilledLookupAccountNo(acc.noAkaun);
              setActiveTab('lookup');
            }}
            onAddAccount={handleAddAccount}
            onImportAccounts={handleImportAccounts}
            onClearAllAccounts={handleRequestResetDisplay}
            onClaimReward={handleClaimReward}
            isSuperAdmin={isSuperAdmin}
            onRequireSuperAdmin={() => handleOpenAdminLogin('import_excel')}
          />
        );
      case 'audit_logs':
        return (
          <AuditLogsView
            logs={auditLogs}
            onSelectAccount={(noAkaun) => {
              setPrefilledLookupAccountNo(noAkaun);
              setActiveTab('lookup');
            }}
            onClaimReward={handleClaimReward}
            onResetDisplay={handleRequestResetDisplay}
            isSuperAdmin={isSuperAdmin}
            onRequireSuperAdmin={() => handleOpenAdminLogin('import_excel')}
            onReloadFromCloud={() => handleReloadFromCloud(true)}
            isReloading={isSyncingCloud}
          />
        );
      case 'spreadsheet':
        return (
          <CustomerSpreadsheetView
            accounts={accounts}
            onUpdateAccount={handleUpdateAccount}
            onImportAccounts={handleImportAccounts}
            onClearAllAccounts={handleRequestResetDisplay}
            isSuperAdmin={isSuperAdmin}
            onRequireSuperAdmin={() => handleOpenAdminLogin('import_excel')}
          />
        );
      case 'google_sheets':
        return (
          <GoogleSheetsDatabaseView
            accounts={accounts}
            onImportAccounts={handleImportAccountsWithMode}
            onUpdateAccount={handleUpdateAccount}
            onNavigateToLookup={(noAkaun) => {
              setPrefilledLookupAccountNo(noAkaun);
              setActiveTab('lookup');
            }}
          />
        );
      case 'gift_management':
        return (
          <GiftManagementSection />
        );
      case 'bigquery':
        return (
          <BigQueryDatabaseView
            accounts={accounts}
            gifts={[]}
            isSuperAdmin={isSuperAdmin}
          />
        );
      default:
        return null;
    }
  };

  const handleTabChange = (tab: ActiveTab) => {
    if (tab === 'lookup') {
      setPrefilledLookupAccountNo(null);
      setActiveTab(tab);
    } else if (tab === 'import_excel' || tab === 'google_sheets' || tab === 'bigquery' || tab === 'gift_management') {
      if (isSuperAdmin) {
        setActiveTab(tab);
      } else {
        handleOpenAdminLogin(tab);
      }
    } else {
      if (isAdmin) {
        setActiveTab(tab);
      } else {
        handleOpenAdminLogin(tab);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-[#1A1A1A] flex flex-col font-sans selection:bg-[#1A1A1A] selection:text-[#FDFCFB]">
      {/* Top Navbar Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        deviceFrame={deviceFrame}
        setDeviceFrame={setDeviceFrame}
        onOpenGuide={() => setShowGuideModal(true)}
        onExportExcel={() => {
          if (!isAdmin) {
            handleOpenAdminLogin();
            return;
          }
          exportAccountsToExcel(accounts, 'xlsx');
        }}
        totalAccounts={accounts.length}
        isAdmin={isAdmin}
        isSuperAdmin={isSuperAdmin}
        adminRole={adminRole}
        onOpenAdminLogin={handleOpenAdminLogin}
        onLogoutAdmin={handleLogoutAdmin}
        onSyncCloudData={() => handleReloadFromCloud(true)}
        isSyncingCloud={isSyncingCloud}
        isCloudConnected={isCloudConnected}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex justify-center py-5 px-3 sm:px-5 lg:px-8">
        {deviceFrame === 'mobile' ? (
          /* Mobile Phone Container Simulation */
          <div className="w-full max-w-[420px] bg-[#1A1A1A] p-3 rounded-[38px] shadow-2xl border-4 border-[#2A2826] my-auto">
            {/* Speaker notch */}
            <div className="flex justify-center mb-2">
              <div className="w-28 h-4 bg-[#111111] rounded-full flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-stone-800 mr-2" />
                <div className="w-10 h-1 bg-stone-800 rounded-full" />
              </div>
            </div>

            {/* Screen */}
            <div className="bg-[#FAF8F5] rounded-[26px] overflow-hidden min-h-[720px] max-h-[820px] flex flex-col shadow-inner border border-stone-200/60">
              <div className="p-3 bg-white/90 backdrop-blur-xs border-b border-stone-200 flex justify-between items-center text-[10px] font-semibold text-stone-500">
                <span className="font-mono">{getMalaysiaTime()} (MYT)</span>
                <span className="font-mono text-stone-900 tracking-wider uppercase text-[9px] font-bold">eKemaskini</span>
                <span>100% 🔋</span>
              </div>
              <div className="p-3 overflow-y-auto flex-1 space-y-3">
                {renderTabContent()}
              </div>
            </div>
          </div>
        ) : deviceFrame === 'tablet' ? (
          /* Tablet Viewport Container */
          <div className="w-full max-w-[860px] bg-[#1A1A1A] p-4 rounded-[28px] shadow-2xl border-4 border-[#2A2826]">
            <div className="bg-[#FAF8F5] rounded-[18px] overflow-hidden min-h-[700px] p-5 border border-stone-200/60">
              {renderTabContent()}
            </div>
          </div>
        ) : (
          /* Responsive Desktop Layout */
          <div className="w-full max-w-7xl mx-auto">
            {renderTabContent()}
          </div>
        )}
      </main>

      {/* Editorial Footer with Copyright */}
      <footer className="bg-[#FAF9F6] border-t border-stone-200/90 py-5 text-xs text-stone-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Copyright & Organization Brand */}
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 text-stone-700 text-xs">
            <span className="w-2 h-2 rounded-full bg-stone-900" />
            <span className="font-serif-heading font-bold text-stone-950 text-sm">eKemaskini</span>
            <span className="text-stone-300">•</span>
            <div className="flex items-center gap-1.5 font-medium text-stone-700">
              <span>&copy; {new Date().getFullYear()} Hakcipta Terpelihara</span>
              <span className="font-serif-heading font-bold text-stone-900">
                JNol.Ai
              </span>
              <span className="text-stone-400">•</span>
              <span className="font-serif-heading font-bold text-stone-900">
                JKEWDBKL@UMKB
              </span>
            </div>
          </div>

          {/* Auxiliary Links, Cloud Sync & Role Status */}
          <div className="flex flex-wrap items-center justify-center gap-3 text-stone-500 text-xs font-medium">
            {isCloudConnected && !isFirestoreQuotaExceeded() ? (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50/90 border border-emerald-300 text-[11px] font-mono text-emerald-900 shadow-2xs" title="Pangkalan data awan aktif & diselaras secara langsung">
                <CloudCheck className="w-3.5 h-3.5 text-emerald-700" />
                <span>Pangkalan Data Awan: Aktif</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50/90 border border-amber-300 text-[11px] font-mono text-amber-900 shadow-2xs" title="Sistem beroperasi dalam Mod Storan Tempatan (IndexedDB & Cache Pantas) secara lancar">
                <HardDrive className="w-3.5 h-3.5 text-amber-700" />
                <span>Mod Tempatan Pantas</span>
              </div>
            )}

            <span className="text-stone-300">•</span>

            <button 
              onClick={() => setShowGuideModal(true)} 
              className="hover:text-stone-950 underline underline-offset-2 transition-colors cursor-pointer"
            >
              Panduan Keselamatan Rekod
            </button>

            <span className="text-stone-300">•</span>

            {isSuperAdmin ? (
              <div className="flex items-center gap-2">
                <span className="text-purple-900 font-bold flex items-center gap-1 bg-purple-100 px-2 py-0.5 rounded-full border border-purple-300 text-[11px]">
                  <Crown className="w-3 h-3 text-amber-500" /> Sesi Super Admin Aktif
                </span>
                <span className="text-stone-300">•</span>
                <button 
                  onClick={handleRequestResetDisplay} 
                  className="hover:text-purple-900 transition-colors cursor-pointer text-stone-600 font-medium hover:underline"
                  title="Tetapkan semula paparan skrin tanpa memadam pangkalan data awan"
                >
                  Reset Rekod Dipaparan
                </button>
              </div>
            ) : isAdmin ? (
              <div className="flex items-center gap-2">
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  ● Sesi Admin Aktif
                </span>
              </div>
            ) : (
              <button 
                onClick={() => handleOpenAdminLogin()} 
                className="hover:text-stone-900 transition-colors cursor-pointer text-stone-500 flex items-center gap-1"
              >
                <Lock className="w-3 h-3 text-stone-400" />
                <span>Log Masuk Admin Sistem</span>
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Guide Modal */}
      {showGuideModal && (
        <GlideGuideModal onClose={() => setShowGuideModal(false)} />
      )}

      {/* Admin Login Modal */}
      {showAdminLoginModal && (
        <AdminLoginModal
          isOpen={showAdminLoginModal}
          onClose={() => {
            setShowAdminLoginModal(false);
            setPendingAdminTargetTab(undefined);
          }}
          onSuccess={handleAdminLoginSuccess}
          targetTabName={pendingAdminTargetTab ? TAB_LABELS[pendingAdminTargetTab] : undefined}
          targetTabKey={pendingAdminTargetTab}
          isAlreadyAdmin={isAdmin}
          isAlreadySuperAdmin={isSuperAdmin}
          adminRole={adminRole}
          onLogout={handleLogoutAdmin}
        />
      )}

      {/* Super Admin Reset Display Records Modal */}
      <ResetDisplayModal
        isOpen={showResetDisplayModal}
        onClose={() => setShowResetDisplayModal(false)}
        onConfirmReset={handleConfirmResetDisplay}
        accountCount={accounts.length}
        auditLogCount={auditLogs.length}
        onReloadFromCloud={handleReloadFromCloud}
        isSuperAdmin={isSuperAdmin}
      />
    </div>
  );
}
