export interface CustomerAccount {
  noAkaun: string;
  nama: string;
  kadPengenalan: string;
  status: 'Aktif' | 'Tertunggak' | 'Selesai' | 'Dalam Semakan';
  kategoriAkaun?: string; // Kediaman / Komersial / Industri
  noTel: string; // EDITABLE
  email: string; // EDITABLE
  tarikhDaftar?: string;
  lastUpdated: string;
  kemaskiniOleh?: string;
  telahDikemaskini?: boolean; // Highlight flag for updated accounts
  updatedFields?: string[]; // e.g. ['noTel', 'email']
  rawRowData?: Record<string, any>; // Dynamic original fields from uploaded Excel
  
  // Reward & Appreciation Gift Tracking (1x per Customer Account)
  rewardStatus?: 'Belum Layak' | 'Layak (Belum Dituntut)' | 'Telah Dituntut';
  rewardClaimedAt?: string;
  rewardEligibilityDate?: string;
  rewardCode?: string;
  updateCount?: number;
}

export interface ProfileUpdateAuditLog {
  id: string;
  noAkaun: string;
  nama: string;
  oldPhone: string;
  newPhone: string;
  oldEmail: string;
  newEmail: string;
  changedFields: string[];
  timestamp: string;
  source: 'Portal Pelanggan' | 'Pentadbir' | 'Import Excel';
  
  // Reward Tracking
  isRewardEligible: boolean; // True if this was their 1st qualifying update
  rewardStatus: 'Layak Hadiah (Kali Pertama)' | 'Kemaskini Ulangan (Hadiah Sudah Diberi)' | 'Telah Dituntut' | 'Tidak Berkaitan';
  rewardCode?: string;
  rewardClaimed?: boolean;
  rewardClaimedAt?: string;
}

export type ActiveTab = 'lookup' | 'directory' | 'import_excel' | 'audit_logs' | 'spreadsheet' | 'google_sheets';
export type DeviceFrame = 'responsive' | 'mobile' | 'tablet';
export type AdminRole = 'admin' | 'super_admin';

// Google Sheets Database Integration Types
export interface GoogleSheetsConfig {
  spreadsheetId: string;
  spreadsheetName: string;
  sheetName: string;
  spreadsheetUrl: string;
  autoSyncOnUpdate: boolean;
  lastSyncTime?: string;
  totalSyncedRows?: number;
  isConnected: boolean;
  authMethod: 'oauth' | 'shared_link' | 'apps_script';
  userEmail?: string;
  fieldMapping?: {
    noAkaun?: string;
    nama?: string;
    kadPengenalan?: string;
    noTel?: string;
    email?: string;
    kategoriAkaun?: string;
    status?: string;
    lastUpdated?: string;
    rewardStatus?: string;
    rewardCode?: string;
  };
}

export interface GoogleDriveSheetFile {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export interface GoogleSyncHistoryEntry {
  id: string;
  timestamp: string;
  action: 'TARIK_DATA' | 'HANTAR_DATA' | 'AUTO_KEMASKINI' | 'CIPTA_HELAIAN' | 'SAMBUNG_FAIL';
  status: 'BERJAYA' | 'RALAT';
  message: string;
  rowsCount?: number;
}

// Toast Notification Types
export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

