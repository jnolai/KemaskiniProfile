import { 
  collection, 
  doc, 
  setDoc, 
  getDoc,
  getDocs, 
  deleteDoc, 
  onSnapshot, 
  writeBatch,
  query,
  where,
  orderBy,
  limit
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { CustomerAccount, ProfileUpdateAuditLog, GoogleSheetsConfig } from '../types';
import { getMalaysiaDateTime, getMalaysiaDateTimeFull } from '../utils/dateHelper';

const ACCOUNTS_COLLECTION = 'accounts';
const AUDIT_LOGS_COLLECTION = 'audit_logs';
const APP_CONFIG_COLLECTION = 'app_config';

// Track if Cloud Firestore quota has been exceeded to avoid continuous failing retries
let isCloudQuotaExceeded = false;

export function isFirestoreQuotaExceeded(): boolean {
  return isCloudQuotaExceeded;
}

export function setFirestoreQuotaExceeded(val: boolean): void {
  isCloudQuotaExceeded = val;
}

function checkAndMarkQuotaError(err: any): boolean {
  const msg = err?.message || String(err || '');
  const code = err?.code || '';
  if (
    code === 'resource-exhausted' ||
    msg.includes('Quota exceeded') ||
    msg.includes('resource-exhausted') ||
    msg.includes('RESOURCE_EXHAUSTED')
  ) {
    isCloudQuotaExceeded = true;
    return true;
  }
  return false;
}

/**
 * Sanitize document ID for safe Firestore storage
 */
export function sanitizeDocId(id: string): string {
  const cleaned = String(id || '').trim().replace(/[\/\s#?\[\]]/g, '_');
  return cleaned || `acc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Sanitize account object for Firestore (remove undefined values and ensure clean strings)
 */
export function sanitizeAccountForFirestore(account: CustomerAccount): Record<string, any> {
  const noAkaun = String(account.noAkaun || '').trim();
  const nama = String(account.nama || 'Pelanggan').trim();

  const clean: Record<string, any> = {
    id: account.id || noAkaun || sanitizeDocId(nama),
    noAkaun: noAkaun,
    nama: nama,
    kadPengenalan: String(account.kadPengenalan || ''),
    status: account.status || 'Aktif',
    noTel: String(account.noTel || ''),
    email: String(account.email || ''),
    lastUpdated: account.lastUpdated || getMalaysiaDateTime(),
    telahDikemaskini: Boolean(account.telahDikemaskini),
  };

  if (account.kategoriAkaun) clean.kategoriAkaun = String(account.kategoriAkaun);
  if (account.tarikhDaftar) clean.tarikhDaftar = String(account.tarikhDaftar);
  if (account.kemaskiniOleh) clean.kemaskiniOleh = String(account.kemaskiniOleh);
  if (Array.isArray(account.updatedFields)) clean.updatedFields = account.updatedFields;
  if (account.rawRowData && typeof account.rawRowData === 'object') clean.rawRowData = account.rawRowData;
  if (account.rewardStatus) clean.rewardStatus = String(account.rewardStatus);
  if (account.rewardClaimedAt) clean.rewardClaimedAt = String(account.rewardClaimedAt);
  if (account.rewardEligibilityDate) clean.rewardEligibilityDate = String(account.rewardEligibilityDate);
  if (account.rewardCode) clean.rewardCode = String(account.rewardCode);
  if (account.rewardGiftName) clean.rewardGiftName = String(account.rewardGiftName);
  if (typeof account.rewardGiftRemainingStock === 'number') clean.rewardGiftRemainingStock = account.rewardGiftRemainingStock;
  if (typeof account.updateCount === 'number') clean.updateCount = account.updateCount;

  return clean;
}

/**
 * Sanitize audit log object for Firestore
 */
export function sanitizeAuditLogForFirestore(log: ProfileUpdateAuditLog): Record<string, any> {
  const clean: Record<string, any> = {
    id: log.id || `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    noAkaun: String(log.noAkaun || ''),
    nama: String(log.nama || ''),
    oldPhone: String(log.oldPhone || ''),
    newPhone: String(log.newPhone || ''),
    oldEmail: String(log.oldEmail || ''),
    newEmail: String(log.newEmail || ''),
    changedFields: Array.isArray(log.changedFields) ? log.changedFields : [],
    timestamp: log.timestamp || getMalaysiaDateTimeFull(),
    source: log.source || 'Portal Pelanggan',
    isRewardEligible: Boolean(log.isRewardEligible),
    rewardStatus: log.rewardStatus || 'Tidak Berkaitan',
  };

  if (log.rewardCode) clean.rewardCode = String(log.rewardCode);
  if (typeof log.rewardClaimed === 'boolean') clean.rewardClaimed = log.rewardClaimed;
  if (log.rewardClaimedAt) clean.rewardClaimedAt = String(log.rewardClaimedAt);
  if (log.rewardGiftName) clean.rewardGiftName = String(log.rewardGiftName);
  if (typeof log.rewardGiftRemainingStock === 'number') clean.rewardGiftRemainingStock = log.rewardGiftRemainingStock;

  return clean;
}

/**
 * Real-time listener for Customer Accounts across all devices
 */
export function subscribeToAccounts(
  onUpdate: (accounts: CustomerAccount[]) => void,
  onError?: (error: Error) => void
): () => void {
  if (isCloudQuotaExceeded) {
    if (onError) onError(new Error('Firestore quota exceeded. Running in offline/local storage mode.'));
    return () => {};
  }

  try {
    const colRef = collection(db, ACCOUNTS_COLLECTION);
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const list: CustomerAccount[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as CustomerAccount);
        });
        onUpdate(list);
      },
      (err) => {
        const isQuota = checkAndMarkQuotaError(err);
        if (isQuota) {
          console.warn('[Firestore] Kuota cloud Firestore harian dicapai. Sistem beroperasi 100% menggunakan storan tempatan.');
        } else {
          console.warn('[Firestore] Sambungan akaun luar talian:', err.message || err);
        }
        if (onError) onError(err);
      }
    );
    return unsubscribe;
  } catch (err: any) {
    checkAndMarkQuotaError(err);
    if (onError) onError(err);
    return () => {};
  }
}

/**
 * Real-time listener for Audit Logs across all devices
 */
export function subscribeToAuditLogs(
  onUpdate: (logs: ProfileUpdateAuditLog[]) => void,
  onError?: (error: Error) => void
): () => void {
  if (isCloudQuotaExceeded) {
    if (onError) onError(new Error('Firestore quota exceeded. Running in offline/local storage mode.'));
    return () => {};
  }

  try {
    const colRef = collection(db, AUDIT_LOGS_COLLECTION);
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const list: ProfileUpdateAuditLog[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as ProfileUpdateAuditLog);
        });
        // Sort descending by timestamp in memory for 100% reliable order across all browsers
        list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
        onUpdate(list.slice(0, 500));
      },
      (err) => {
        const isQuota = checkAndMarkQuotaError(err);
        if (isQuota) {
          console.warn('[Firestore] Kuota audit logs dicapai. Mod tempatan aktif.');
        } else {
          console.warn('[Firestore] Sambungan log audit luar talian:', err.message || err);
        }
        if (onError) onError(err);
      }
    );
    return unsubscribe;
  } catch (err: any) {
    checkAndMarkQuotaError(err);
    if (onError) onError(err);
    return () => {};
  }
}

/**
 * Real-time listener for custom Excel columns
 */
export function subscribeToCustomColumns(
  onUpdate: (columns: string[]) => void
): () => void {
  if (isCloudQuotaExceeded) return () => {};

  try {
    const docRef = doc(db, APP_CONFIG_COLLECTION, 'excel_meta');
    return onSnapshot(
      docRef, 
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (Array.isArray(data.customColumns)) {
            onUpdate(data.customColumns);
          }
        }
      },
      (err) => {
        checkAndMarkQuotaError(err);
      }
    );
  } catch (err) {
    checkAndMarkQuotaError(err);
    return () => {};
  }
}

/**
 * Save or update a single customer account in Firestore directly
 */
export async function saveAccountToFirestore(account: CustomerAccount): Promise<boolean> {
  if (isCloudQuotaExceeded) return false;

  try {
    const docId = sanitizeDocId(account.id || account.noAkaun);
    const docRef = doc(db, ACCOUNTS_COLLECTION, docId);
    await setDoc(docRef, sanitizeAccountForFirestore(account), { merge: true });
    return true;
  } catch (err: any) {
    const isQuota = checkAndMarkQuotaError(err);
    if (!isQuota) {
      console.warn('Could not save account to Firestore:', err);
    }
    return false;
  }
}

/**
 * Delete a single customer account from Firestore directly
 */
export async function deleteAccountFromFirestore(accountId: string): Promise<boolean> {
  if (isCloudQuotaExceeded) return false;

  try {
    const docId = sanitizeDocId(accountId);
    const docRef = doc(db, ACCOUNTS_COLLECTION, docId);
    await deleteDoc(docRef);
    return true;
  } catch (err: any) {
    checkAndMarkQuotaError(err);
    return false;
  }
}

/**
 * Save a new audit log entry in Firestore directly
 */
export async function saveAuditLogToFirestore(log: ProfileUpdateAuditLog): Promise<boolean> {
  if (isCloudQuotaExceeded) return false;

  try {
    const docRef = doc(db, AUDIT_LOGS_COLLECTION, log.id);
    await setDoc(docRef, sanitizeAuditLogForFirestore(log));
    return true;
  } catch (err: any) {
    const isQuota = checkAndMarkQuotaError(err);
    if (!isQuota) {
      console.warn('Could not save audit log to Firestore:', err);
    }
    return false;
  }
}

/**
 * Save custom detected columns metadata in Firestore
 */
export async function saveCustomColumnsToFirestore(customColumns: string[]): Promise<void> {
  if (isCloudQuotaExceeded) return;

  try {
    const docRef = doc(db, APP_CONFIG_COLLECTION, 'excel_meta');
    await setDoc(docRef, {
      customColumns,
      lastUpdated: getMalaysiaDateTime(),
    }, { merge: true });
  } catch (err: any) {
    checkAndMarkQuotaError(err);
  }
}

/**
 * Direct fetch custom columns metadata from Firestore
 */
export async function fetchCustomColumnsFromFirestore(): Promise<string[] | null> {
  try {
    const docRef = doc(db, APP_CONFIG_COLLECTION, 'excel_meta');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (Array.isArray(data.customColumns)) {
        return data.customColumns;
      }
    }
    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Helper to pause execution for stream flushing
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Safely commit a Firestore batch with retry on backpressure / resource-exhausted
 */
async function safeCommitBatch(batch: ReturnType<typeof writeBatch>, retries = 2): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await batch.commit();
      return;
    } catch (err: any) {
      const isQuota = checkAndMarkQuotaError(err);
      if (isQuota) {
        return;
      }
      const errMsg = err?.message || String(err);
      const isRateLimited = errMsg.includes('resource-exhausted') || 
                            errMsg.includes('maximum allowed queued writes') ||
                            errMsg.includes('DEADLINE_EXCEEDED') ||
                            errMsg.includes('UNAVAILABLE');
      if (isRateLimited && attempt < retries) {
        await delay(350 * attempt);
      } else {
        throw err;
      }
    }
  }
}

/**
 * Batch import customer accounts into Firestore with high-throughput batching
 * Preserves 100% of all accounts including duplicate account numbers
 */
export async function batchSaveAccountsToFirestore(
  accounts: CustomerAccount[], 
  mode: 'merge' | 'replace' = 'merge',
  onProgress?: (progressPercent: number, savedCount: number, totalCount: number) => void
): Promise<{ success: boolean; count: number; error?: string }> {
  if (isCloudQuotaExceeded) {
    if (onProgress) onProgress(100, accounts.length, accounts.length);
    return { success: false, count: 0, error: 'Firestore quota exceeded' };
  }

  try {
    // If replace mode, first retrieve all existing accounts to delete safely in sequential batches
    if (mode === 'replace') {
      try {
        const colRef = collection(db, ACCOUNTS_COLLECTION);
        const snapshot = await getDocs(colRef);
        
        let currentBatch = writeBatch(db);
        let deleteCount = 0;

        for (const docSnap of snapshot.docs) {
          currentBatch.delete(docSnap.ref);
          deleteCount++;

          if (deleteCount >= 250) {
            await safeCommitBatch(currentBatch);
            await delay(30);
            currentBatch = writeBatch(db);
            deleteCount = 0;
          }
        }

        if (deleteCount > 0) {
          await safeCommitBatch(currentBatch);
          await delay(30);
        }
      } catch (e) {
        checkAndMarkQuotaError(e);
      }
    }

    const totalCount = accounts.length;
    if (totalCount === 0) return { success: true, count: 0 };

    // Batch insert/update with 250 operations per batch
    const BATCH_SIZE = 250;
    let currentBatch = writeBatch(db);
    let opCount = 0;
    let savedCount = 0;

    for (let i = 0; i < accounts.length; i++) {
      if (isCloudQuotaExceeded) break;

      const acc = accounts[i];
      const docId = sanitizeDocId(acc.id || acc.noAkaun || `acc_${i}`);
      
      const docRef = doc(db, ACCOUNTS_COLLECTION, docId);
      currentBatch.set(docRef, sanitizeAccountForFirestore(acc), { merge: true });
      opCount++;

      if (opCount >= BATCH_SIZE) {
        await safeCommitBatch(currentBatch);
        savedCount += opCount;
        opCount = 0;
        
        if (onProgress) {
          const pct = Math.min(100, Math.round((savedCount / totalCount) * 100));
          onProgress(pct, savedCount, totalCount);
        }

        await delay(25);
        currentBatch = writeBatch(db);
      }
    }

    if (opCount > 0 && !isCloudQuotaExceeded) {
      await safeCommitBatch(currentBatch);
      savedCount += opCount;
      if (onProgress) {
        onProgress(100, savedCount, totalCount);
      }
    }

    return { success: true, count: savedCount };
  } catch (err: any) {
    checkAndMarkQuotaError(err);
    return { success: false, count: 0, error: err?.message || String(err) };
  }
}

/**
 * Clear all customer accounts in Firestore safely
 */
export async function clearAllAccountsInFirestore(): Promise<void> {
  if (isCloudQuotaExceeded) return;

  try {
    const colRef = collection(db, ACCOUNTS_COLLECTION);
    const snapshot = await getDocs(colRef);
    if (snapshot.empty) return;
    
    let currentBatch = writeBatch(db);
    let count = 0;

    for (const docSnap of snapshot.docs) {
      currentBatch.delete(docSnap.ref);
      count++;
      if (count >= 200) {
        await safeCommitBatch(currentBatch);
        await delay(40);
        currentBatch = writeBatch(db);
        count = 0;
      }
    }

    if (count > 0) {
      await safeCommitBatch(currentBatch);
    }
  } catch (err) {
    checkAndMarkQuotaError(err);
  }
}

/**
 * Clear all audit logs safely in Firestore
 */
export async function clearAllAuditLogsInFirestore(): Promise<void> {
  if (isCloudQuotaExceeded) return;

  try {
    const colRef = collection(db, AUDIT_LOGS_COLLECTION);
    const snapshot = await getDocs(colRef);
    if (snapshot.empty) return;
    
    let currentBatch = writeBatch(db);
    let count = 0;

    for (const docSnap of snapshot.docs) {
      currentBatch.delete(docSnap.ref);
      count++;
      if (count >= 200) {
        await safeCommitBatch(currentBatch);
        await delay(40);
        currentBatch = writeBatch(db);
        count = 0;
      }
    }

    if (count > 0) {
      await safeCommitBatch(currentBatch);
    }
  } catch (err) {
    checkAndMarkQuotaError(err);
  }
}

/**
 * Direct fetch all customer accounts from Firestore
 */
export async function fetchAccountsFromFirestore(): Promise<CustomerAccount[]> {
  if (isCloudQuotaExceeded) return [];
  try {
    const colRef = collection(db, ACCOUNTS_COLLECTION);
    const snapshot = await getDocs(colRef);
    const list: CustomerAccount[] = [];
    snapshot.forEach((docSnap) => {
      list.push(docSnap.data() as CustomerAccount);
    });
    return list;
  } catch (err: any) {
    checkAndMarkQuotaError(err);
    console.warn('[Firestore] Failed to fetch accounts directly:', err);
    return [];
  }
}

/**
 * Direct search a single account from Firestore by account number, IC, or Phone
 */
export async function fetchSingleAccountFromFirestore(queryTerm: string): Promise<CustomerAccount | null> {
  if (!queryTerm) return null;
  const qClean = queryTerm.trim();
  if (!qClean) return null;

  try {
    // 1. Try direct doc lookup by sanitized ID
    const docId = sanitizeDocId(qClean);
    const docRef = doc(db, ACCOUNTS_COLLECTION, docId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as CustomerAccount;
    }

    const colRef = collection(db, ACCOUNTS_COLLECTION);

    // 2. Try querying by noAkaun exact
    const q1 = query(colRef, where('noAkaun', '==', qClean), limit(1));
    const snap1 = await getDocs(q1);
    if (!snap1.empty) {
      return snap1.docs[0].data() as CustomerAccount;
    }

    // 3. Try uppercase match for noAkaun
    const q2 = query(colRef, where('noAkaun', '==', qClean.toUpperCase()), limit(1));
    const snap2 = await getDocs(q2);
    if (!snap2.empty) {
      return snap2.docs[0].data() as CustomerAccount;
    }

    // 4. Try querying by IC (kadPengenalan)
    const q3 = query(colRef, where('kadPengenalan', '==', qClean), limit(1));
    const snap3 = await getDocs(q3);
    if (!snap3.empty) {
      return snap3.docs[0].data() as CustomerAccount;
    }

    // 5. Try querying by Phone (noTel)
    const q4 = query(colRef, where('noTel', '==', qClean), limit(1));
    const snap4 = await getDocs(q4);
    if (!snap4.empty) {
      return snap4.docs[0].data() as CustomerAccount;
    }

    // 6. Try normalized query (digits only if numeric string)
    const digitsOnly = qClean.replace(/\D/g, '');
    if (digitsOnly && digitsOnly !== qClean && digitsOnly.length >= 4) {
      const qDigits = query(colRef, where('noAkaun', '==', digitsOnly), limit(1));
      const snapDigits = await getDocs(qDigits);
      if (!snapDigits.empty) {
        return snapDigits.docs[0].data() as CustomerAccount;
      }
    }

    return null;
  } catch (err) {
    console.warn('[Firestore] Direct single account lookup error:', err);
    return null;
  }
}

/**
 * Direct fetch audit logs from Firestore
 */
export async function fetchAuditLogsFromFirestore(): Promise<ProfileUpdateAuditLog[]> {
  if (isCloudQuotaExceeded) return [];
  try {
    const colRef = collection(db, AUDIT_LOGS_COLLECTION);
    const snapshot = await getDocs(colRef);
    const list: ProfileUpdateAuditLog[] = [];
    snapshot.forEach((docSnap) => {
      list.push(docSnap.data() as ProfileUpdateAuditLog);
    });
    list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
    return list.slice(0, 500);
  } catch (err: any) {
    checkAndMarkQuotaError(err);
    return [];
  }
}

/**
 * Test connectivity to Firestore on application startup
 */
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    const colRef = collection(db, APP_CONFIG_COLLECTION);
    await getDocs(query(colRef, limit(1)));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore offline / check configuration:', error.message);
    } else {
      console.info('Firestore connectivity initialized');
    }
    return false;
  }
}

/**
 * ⚡ Save Google Sheets Configuration to Cloud Firestore so ALL devices can share the connection
 */
export async function saveGoogleSheetsConfigToFirestore(config: GoogleSheetsConfig): Promise<void> {
  try {
    const docRef = doc(db, APP_CONFIG_COLLECTION, 'google_sheets_config');
    const cleanConfig: Record<string, any> = {
      spreadsheetId: config.spreadsheetId || '',
      spreadsheetName: config.spreadsheetName || 'Pangkalan Data Google Sheets',
      sheetName: config.sheetName || 'Sheet1',
      spreadsheetUrl: config.spreadsheetUrl || '',
      autoSyncOnUpdate: Boolean(config.autoSyncOnUpdate),
      isConnected: Boolean(config.isConnected),
      authMethod: config.authMethod || 'shared_link',
      lastSyncTime: config.lastSyncTime || getMalaysiaDateTime(),
      updatedAt: getMalaysiaDateTimeFull(),
    };

    if (config.totalSyncedRows !== undefined) cleanConfig.totalSyncedRows = config.totalSyncedRows;
    if (config.appsScriptUrl) cleanConfig.appsScriptUrl = config.appsScriptUrl;
    if (config.userEmail) cleanConfig.userEmail = config.userEmail;
    if (config.fieldMapping) cleanConfig.fieldMapping = config.fieldMapping;

    await setDoc(docRef, cleanConfig, { merge: true });
  } catch (err) {
    console.warn('[Firestore] Failed to save Google Sheets config to cloud:', err);
  }
}

/**
 * ⚡ Direct fetch Google Sheets Configuration from Cloud Firestore
 */
export async function fetchGoogleSheetsConfigFromFirestore(): Promise<GoogleSheetsConfig | null> {
  try {
    const docRef = doc(db, APP_CONFIG_COLLECTION, 'google_sheets_config');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as GoogleSheetsConfig;
    }
    return null;
  } catch (err) {
    console.warn('[Firestore] Failed to fetch Google Sheets config from cloud:', err);
    return null;
  }
}

/**
 * ⚡ Real-time subscription to Google Sheets Configuration across all connected devices
 */
export function subscribeToGoogleSheetsConfig(
  onUpdate: (config: GoogleSheetsConfig) => void,
  onError?: (error: Error) => void
): () => void {
  try {
    const docRef = doc(db, APP_CONFIG_COLLECTION, 'google_sheets_config');
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const config = docSnap.data() as GoogleSheetsConfig;
          onUpdate(config);
        }
      },
      (err) => {
        if (onError) onError(err);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('[Firestore] Google Sheets config subscription error:', err);
    return () => {};
  }
}
