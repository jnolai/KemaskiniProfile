import { CustomerAccount, ProfileUpdateAuditLog, GiftItem, GoogleSheetsConfig } from '../types';

export type SyncMessageType = 
  | 'ACCOUNT_UPDATED'
  | 'ACCOUNTS_BATCH_IMPORTED'
  | 'GIFT_CLAIMED'
  | 'GIFTS_UPDATED'
  | 'AUDIT_LOG_ADDED'
  | 'CONFIG_UPDATED'
  | 'FORCE_SYNC_REQUEST';

export interface SyncMessage {
  type: SyncMessageType;
  timestamp: number;
  originId: string;
  payload?: any;
}

// Generate unique session ID for current tab/window to avoid echo handling
export const SESSION_INSTANCE_ID = `inst_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

let broadcastChannel: BroadcastChannel | null = null;

try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel('ekemaskini_cross_platform_sync');
  }
} catch (e) {
  console.info('[Sync] BroadcastChannel not supported or restricted in this environment.');
}

/**
 * Broadcast an event to all other open tabs/windows on the current device
 */
export function broadcastSyncEvent(type: SyncMessageType, payload?: any): void {
  const message: SyncMessage = {
    type,
    timestamp: Date.now(),
    originId: SESSION_INSTANCE_ID,
    payload,
  };

  // 1. Send via BroadcastChannel
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(message);
    } catch (e) {
      console.warn('[Sync] BroadcastChannel postMessage error:', e);
    }
  }

  // 2. Storage Event fallback for older browsers or if BroadcastChannel is blocked
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('customer_portal_cross_tab_ping', JSON.stringify({
        ...message,
        pingKey: Math.random(),
      }));
    }
  } catch (e) {
    // Storage restricted fallback
  }
}

/**
 * Listen for sync events from other tabs/windows
 */
export function subscribeToCrossTabSync(
  onSyncMessage: (msg: SyncMessage) => void
): () => void {
  // Handler for BroadcastChannel
  const handleBroadcastMessage = (event: MessageEvent<SyncMessage>) => {
    if (event.data && event.data.originId !== SESSION_INSTANCE_ID) {
      onSyncMessage(event.data);
    }
  };

  // Handler for localStorage event fallback
  const handleStorageEvent = (event: StorageEvent) => {
    if (event.key === 'customer_portal_cross_tab_ping' && event.newValue) {
      try {
        const parsed: SyncMessage = JSON.parse(event.newValue);
        if (parsed && parsed.originId !== SESSION_INSTANCE_ID) {
          onSyncMessage(parsed);
        }
      } catch (e) {}
    }
  };

  if (broadcastChannel) {
    broadcastChannel.addEventListener('message', handleBroadcastMessage);
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorageEvent);
  }

  return () => {
    if (broadcastChannel) {
      broadcastChannel.removeEventListener('message', handleBroadcastMessage);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorageEvent);
    }
  };
}
