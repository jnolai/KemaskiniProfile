/**
 * Lightweight native IndexedDB storage helper for high-volume customer accounts and audit logs
 * Stores unlimited records locally even when Firestore cloud quota is reached.
 */

const DB_NAME = 'customer_portal_local_idb';
const DB_VERSION = 1;
const STORE_ACCOUNTS = 'accounts_store';
const STORE_LOGS = 'audit_logs_store';

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e: any) => {
      const db = e.target.result as IDBDatabase;
      if (!db.objectStoreNames.contains(STORE_ACCOUNTS)) {
        db.createObjectStore(STORE_ACCOUNTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_LOGS)) {
        db.createObjectStore(STORE_LOGS, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveAccountsToIDB(accounts: any[]): Promise<void> {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ACCOUNTS, 'readwrite');
      const store = tx.objectStore(STORE_ACCOUNTS);
      
      // Clear and rewrite with current accounts list
      store.clear();
      for (let i = 0; i < accounts.length; i++) {
        const item = accounts[i];
        const record = {
          ...item,
          id: item.id || `acc_${i}_${item.noAkaun}`,
        };
        store.put(record);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Could not save accounts to IndexedDB:', err);
  }
}

export async function loadAccountsFromIDB(): Promise<any[]> {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ACCOUNTS, 'readonly');
      const store = tx.objectStore(STORE_ACCOUNTS);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Could not load accounts from IndexedDB:', err);
    return [];
  }
}

export async function saveAuditLogsToIDB(logs: any[]): Promise<void> {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_LOGS, 'readwrite');
      const store = tx.objectStore(STORE_LOGS);
      store.clear();
      for (const log of logs) {
        store.put(log);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Could not save audit logs to IndexedDB:', err);
  }
}

export async function loadAuditLogsFromIDB(): Promise<any[]> {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_LOGS, 'readonly');
      const store = tx.objectStore(STORE_LOGS);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Could not load audit logs from IndexedDB:', err);
    return [];
  }
}

export async function clearAllIDB(): Promise<void> {
  try {
    const db = await openIDB();
    const tx = db.transaction([STORE_ACCOUNTS, STORE_LOGS], 'readwrite');
    tx.objectStore(STORE_ACCOUNTS).clear();
    tx.objectStore(STORE_LOGS).clear();
  } catch (err) {
    console.warn('Could not clear IndexedDB:', err);
  }
}
