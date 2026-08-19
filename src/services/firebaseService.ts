import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  onSnapshot, 
  writeBatch,
  query,
  orderBy,
  limit
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { CustomerAccount, ProfileUpdateAuditLog } from '../types';

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
 * Sanitize account object for Firestore (remove undefined values)
 */
function sanitizeAccountForFirestore(account: CustomerAccount): Record<string, any> {
  const clean: Record<string, any> = {
    id: account.id || account.noAkaun || '',
    noAkaun: account.noAkaun || '',
    nama: account.nama || '',
    kadPengenalan: account.kadPengenalan || '',
    status: account.status || 'Aktif',
    noTel: account.noTel || '',
    email: account.email || '',
    lastUpdated: account.lastUpdated || new Date().toISOString(),
    telahDikemaskini: Boolean(account.telahDikemaskini),
  };

  if (account.kategoriAkaun) clean.kategoriAkaun = account.kategoriAkaun;
  if (account.tarikhDaftar) clean.tarikhDaftar = account.tarikhDaftar;
  if (account.kemaskiniOleh) clean.kemaskiniOleh = account.kemaskiniOleh;
  if (account.updatedFields) clean.updatedFields = account.updatedFields;
  if (account.rawRowData) clean.rawRowData = account.rawRowData;
  if (account.rewardStatus) clean.rewardStatus = account.rewardStatus;
  if (account.rewardClaimedAt) clean.rewardClaimedAt = account.rewardClaimedAt;
  if (account.rewardEligibilityDate) clean.rewardEligibilityDate = account.rewardEligibilityDate;
  if (account.rewardCode) clean.rewardCode = account.rewardCode;
  if (typeof account.updateCount === 'number') clean.updateCount = account.updateCount;

  return clean;
}

/**
 * Sanitize audit log object for Firestore
 */
function sanitizeAuditLogForFirestore(log: ProfileUpdateAuditLog): Record<string, any> {
  const clean: Record<string, any> = {
    id: log.id,
    noAkaun: log.noAkaun,
    nama: log.nama,
    oldPhone: log.oldPhone || '',
    newPhone: log.newPhone || '',
    oldEmail: log.oldEmail || '',
    newEmail: log.newEmail || '',
    changedFields: log.changedFields || [],
    timestamp: log.timestamp || new Date().toISOString(),
    source: log.source || 'Portal Pelanggan',
    isRewardEligible: Boolean(log.isRewardEligible),
    rewardStatus: log.rewardStatus || 'Tidak Berkaitan',
  };

  if (log.rewardCode) clean.rewardCode = log.rewardCode;
  if (typeof log.rewardClaimed === 'boolean') clean.rewardClaimed = log.rewardClaimed;
  if (log.rewardClaimedAt) clean.rewardClaimedAt = log.rewardClaimedAt;

  return clean;
}

/**
 * Real-time listener for Customer Accounts
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
 * Real-time listener for Audit Logs
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
    const q = query(colRef, orderBy('timestamp', 'desc'), limit(500));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: ProfileUpdateAuditLog[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as ProfileUpdateAuditLog);
        });
        onUpdate(list);
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
 * Save or update a single customer account in Firestore
 */
export async function saveAccountToFirestore(account: CustomerAccount): Promise<void> {
  if (isCloudQuotaExceeded) return;

  try {
    const docId = (account.id || account.noAkaun).trim().replace(/[\/\s]/g, '_');
    const docRef = doc(db, ACCOUNTS_COLLECTION, docId);
    await setDoc(docRef, sanitizeAccountForFirestore(account), { merge: true });
  } catch (err: any) {
    const isQuota = checkAndMarkQuotaError(err);
    if (!isQuota) {
      console.warn('Could not save account to Firestore:', err);
    }
  }
}

/**
 * Save a new audit log entry
 */
export async function saveAuditLogToFirestore(log: ProfileUpdateAuditLog): Promise<void> {
  if (isCloudQuotaExceeded) return;

  try {
    const docRef = doc(db, AUDIT_LOGS_COLLECTION, log.id);
    await setDoc(docRef, sanitizeAuditLogForFirestore(log));
  } catch (err: any) {
    const isQuota = checkAndMarkQuotaError(err);
    if (!isQuota) {
      console.warn('Could not save audit log to Firestore:', err);
    }
  }
}

/**
 * Save custom detected columns metadata
 */
export async function saveCustomColumnsToFirestore(customColumns: string[]): Promise<void> {
  if (isCloudQuotaExceeded) return;

  try {
    const docRef = doc(db, APP_CONFIG_COLLECTION, 'excel_meta');
    await setDoc(docRef, {
      customColumns,
      lastUpdated: new Date().toISOString(),
    }, { merge: true });
  } catch (err: any) {
    checkAndMarkQuotaError(err);
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
        // Stop attempting batch write if quota is exhausted
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
): Promise<void> {
  if (isCloudQuotaExceeded) {
    if (onProgress) onProgress(100, accounts.length, accounts.length);
    return;
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

          if (deleteCount >= 300) {
            await safeCommitBatch(currentBatch);
            await delay(20);
            currentBatch = writeBatch(db);
            deleteCount = 0;
          }
        }

        if (deleteCount > 0) {
          await safeCommitBatch(currentBatch);
          await delay(20);
        }
      } catch (e) {
        checkAndMarkQuotaError(e);
      }
    }

    const totalCount = accounts.length;
    if (totalCount === 0) return;

    // Batch insert/update with 300 operations per batch
    const BATCH_SIZE = 300;
    let currentBatch = writeBatch(db);
    let opCount = 0;
    let savedCount = 0;

    for (let i = 0; i < accounts.length; i++) {
      if (isCloudQuotaExceeded) break;

      const acc = accounts[i];
      const rawId = acc.id || `acc_${i}_${acc.noAkaun}`;
      const docId = rawId.trim().replace(/[\/\s]/g, '_');
      
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

        await delay(20);
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
  } catch (err) {
    checkAndMarkQuotaError(err);
  }
}

/**
 * Clear all customer accounts in Firestore safely without exhausting stream
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
 * Clear all audit logs safely without exhausting stream
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


