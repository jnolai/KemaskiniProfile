import { CustomerAccount, GoogleSheetsConfig, GoogleDriveSheetFile, GoogleSyncHistoryEntry } from '../types';
import { googleOAuthClientId } from '../lib/firebase';
import { 
  isAccountNoColumn, 
  isOwnerNameColumn, 
  isIcColumn, 
  isPhoneColumn, 
  isEmailColumn, 
  isStatusColumn 
} from '../utils/excelHelper';

const STORAGE_GS_CONFIG = 'customer_portal_google_sheets_config_v1';
const STORAGE_GS_TOKEN = 'customer_portal_gs_oauth_token';
const STORAGE_GS_TOKEN_EXPIRY = 'customer_portal_gs_oauth_token_expiry';
const STORAGE_GS_HISTORY = 'customer_portal_gs_sync_history';

// Default standard headers for Google Sheets
export const STANDARD_SHEET_HEADERS = [
  'No Akaun',
  'Nama Pelanggan',
  'No Kad Pengenalan',
  'No Telefon',
  'Alamat Email',
  'Kategori Akaun',
  'Status Akaun',
  'Status Kemaskini',
  'Tarikh Kemaskini Terakhir',
  'Dikemaskini Oleh',
  'Status Hadiah',
  'Kod Hadiah'
];

/**
 * Extract Spreadsheet ID from standard Google Sheets URL or raw ID
 */
export function extractSpreadsheetId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  
  // Direct ID check (typically ~44 alphanumeric chars with hyphens/underscores)
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed) && !trimmed.includes('/')) {
    return trimmed;
  }
  
  // URL pattern: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/...
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/i);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }
  
  return trimmed;
}

/**
 * Get stored Google Sheets config
 */
export function getStoredGoogleSheetsConfig(): GoogleSheetsConfig {
  try {
    const raw = localStorage.getItem(STORAGE_GS_CONFIG);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error reading Google Sheets config:', e);
  }
  
  return {
    spreadsheetId: '',
    spreadsheetName: 'Pangkalan Data Pelanggan',
    sheetName: 'Sheet1',
    spreadsheetUrl: '',
    autoSyncOnUpdate: true,
    isConnected: false,
    authMethod: 'oauth',
  };
}

/**
 * Save Google Sheets config
 */
export function saveGoogleSheetsConfig(config: GoogleSheetsConfig): void {
  try {
    localStorage.setItem(STORAGE_GS_CONFIG, JSON.stringify(config));
  } catch (e) {
    console.error('Error saving Google Sheets config:', e);
  }
}

/**
 * Get OAuth token from local/session storage
 */
export function getStoredOAuthToken(): string | null {
  try {
    const token = sessionStorage.getItem(STORAGE_GS_TOKEN) || localStorage.getItem(STORAGE_GS_TOKEN);
    const expiry = sessionStorage.getItem(STORAGE_GS_TOKEN_EXPIRY) || localStorage.getItem(STORAGE_GS_TOKEN_EXPIRY);
    if (token && expiry) {
      const expTime = parseInt(expiry, 10);
      if (Date.now() < expTime) {
        return token;
      }
    }
    return token || null;
  } catch {
    return null;
  }
}

/**
 * Save OAuth token with expiry
 */
export function saveOAuthToken(token: string, expiresInSeconds: number = 3600, email?: string): void {
  try {
    const expiry = Date.now() + expiresInSeconds * 1000;
    sessionStorage.setItem(STORAGE_GS_TOKEN, token);
    sessionStorage.setItem(STORAGE_GS_TOKEN_EXPIRY, expiry.toString());
    localStorage.setItem(STORAGE_GS_TOKEN, token);
    localStorage.setItem(STORAGE_GS_TOKEN_EXPIRY, expiry.toString());
    if (email) {
      localStorage.setItem('customer_portal_gs_email', email);
    }
  } catch (e) {
    console.warn('Failed to save OAuth token:', e);
  }
}

/**
 * Clear stored OAuth token
 */
export function clearOAuthToken(): void {
  sessionStorage.removeItem(STORAGE_GS_TOKEN);
  sessionStorage.removeItem(STORAGE_GS_TOKEN_EXPIRY);
  localStorage.removeItem(STORAGE_GS_TOKEN);
  localStorage.removeItem(STORAGE_GS_TOKEN_EXPIRY);
}

/**
 * Get sync history
 */
export function getGoogleSyncHistory(): GoogleSyncHistoryEntry[] {
  try {
    const saved = localStorage.getItem(STORAGE_GS_HISTORY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {}
  return [];
}

/**
 * Add sync history log entry
 */
export function addGoogleSyncLog(
  action: GoogleSyncHistoryEntry['action'],
  status: 'BERJAYA' | 'RALAT',
  message: string,
  rowsCount?: number
): void {
  try {
    const logs = getGoogleSyncHistory();
    const entry: GoogleSyncHistoryEntry = {
      id: `gs-log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      action,
      status,
      message,
      rowsCount
    };
    const updated = [entry, ...logs].slice(0, 50); // Keep last 50
    localStorage.setItem(STORAGE_GS_HISTORY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to add sync log:', e);
  }
}

/**
 * Clear sync history
 */
export function clearGoogleSyncHistory(): void {
  localStorage.removeItem(STORAGE_GS_HISTORY);
}

/**
 * Initialize Google OAuth via Google Identity Services Token Client
 */
export function requestGoogleOAuthToken(
  clientId?: string,
  onSuccess?: (token: string) => void,
  onError?: (err: any) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Check if google accounts client exists
    const google = (window as any).google;
    
    // Default client ID from configured project
    const activeClientId = clientId || (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || googleOAuthClientId || '156465687646-7kchfvdc18ovn7f58fvgg25ivsn0bgn0.apps.googleusercontent.com';
    
    if (google?.accounts?.oauth2) {
      try {
        const tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: activeClientId,
          scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email',
          callback: (response: any) => {
            if (response.error) {
              const err = new Error(response.error_description || response.error);
              if (onError) onError(err);
              reject(err);
              return;
            }
            if (response.access_token) {
              saveOAuthToken(response.access_token, response.expires_in || 3600);
              if (onSuccess) onSuccess(response.access_token);
              resolve(response.access_token);
            }
          },
        });
        
        tokenClient.requestAccessToken({ prompt: 'consent' });
      } catch (err) {
        if (onError) onError(err);
        reject(err);
      }
    } else {
      const err = new Error('Google Identity Services script not yet loaded. Sila tunggu sebentar atau muat semula halaman.');
      if (onError) onError(err);
      reject(err);
    }
  });
}

/**
 * Convert customer accounts to 2D Array for Google Sheets
 */
export function convertAccountsToSheetRows(accounts: CustomerAccount[]): (string | number)[][] {
  const rows: (string | number)[][] = [STANDARD_SHEET_HEADERS];
  
  accounts.forEach((acc) => {
    rows.push([
      acc.noAkaun || '',
      acc.nama || '',
      acc.kadPengenalan || '',
      acc.noTel || '',
      acc.email || '',
      acc.kategoriAkaun || 'Kediaman',
      acc.status || 'Aktif',
      acc.telahDikemaskini ? 'TELAH DIKEMASKINI' : 'REKOD ASAL',
      acc.lastUpdated || '',
      acc.kemaskiniOleh || '',
      acc.rewardStatus || 'Belum Layak',
      acc.rewardCode || ''
    ]);
  });
  
  return rows;
}

/**
 * Parse 2D Array or GViz data from Google Sheet into CustomerAccount[]
 */
export function parseSheetRowsToAccounts(rows: any[][]): {
  accounts: CustomerAccount[];
  detectedHeaders: string[];
  totalRows: number;
} {
  if (!rows || rows.length === 0) {
    return { accounts: [], detectedHeaders: [], totalRows: 0 };
  }

  const rawHeaders = rows[0].map((h: any) => String(h || '').trim());
  const headerMap: Record<string, number> = {};
  rawHeaders.forEach((h: string, idx: number) => {
    headerMap[h.toLowerCase()] = idx;
  });

  // Helper to find column index by match functions
  const findColIndex = (predicate: (colName: string) => boolean): number => {
    for (let i = 0; i < rawHeaders.length; i++) {
      if (predicate(rawHeaders[i])) return i;
    }
    return -1;
  };

  const noAkaunIdx = findColIndex(isAccountNoColumn);
  const namaIdx = findColIndex(isOwnerNameColumn);
  const icIdx = findColIndex(isIcColumn);
  const phoneIdx = findColIndex(isPhoneColumn);
  const emailIdx = findColIndex(isEmailColumn);
  const statusIdx = findColIndex(isStatusColumn);

  // Additional header indexes
  let kategoriIdx = rawHeaders.findIndex(h => /kategori|category|jenis/i.test(h));
  let updatedIdx = rawHeaders.findIndex(h => /tarikh|updated|last/i.test(h));
  let updateFlagIdx = rawHeaders.findIndex(h => /telahdikemaskini|status kemaskini|flag/i.test(h));
  let rewardStatusIdx = rawHeaders.findIndex(h => /status hadiah|reward status|hadiah/i.test(h));
  let rewardCodeIdx = rawHeaders.findIndex(h => /kod hadiah|reward code|voucher/i.test(h));

  const accounts: CustomerAccount[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    // Check if entire row is empty
    const hasData = row.some((cell: any) => cell !== null && cell !== undefined && String(cell).trim() !== '');
    if (!hasData) continue;

    // Extract Account Number (fallback to row index or column 0 if missing)
    let noAkaun = noAkaunIdx >= 0 && row[noAkaunIdx] !== undefined ? String(row[noAkaunIdx]).trim() : '';
    if (!noAkaun && row[0] !== undefined) {
      noAkaun = String(row[0]).trim();
    }
    if (!noAkaun) {
      noAkaun = `ACC-${10000 + r}`;
    }

    // Extract Name
    let nama = namaIdx >= 0 && row[namaIdx] !== undefined ? String(row[namaIdx]).trim() : '';
    if (!nama && row[1] !== undefined && noAkaunIdx !== 1) {
      nama = String(row[1]).trim();
    }
    if (!nama) {
      nama = `Pelanggan ${noAkaun}`;
    }

    // Extract IC
    let ic = icIdx >= 0 && row[icIdx] !== undefined ? String(row[icIdx]).trim() : '';

    // Extract Phone
    let phone = phoneIdx >= 0 && row[phoneIdx] !== undefined ? String(row[phoneIdx]).trim() : '';
    // Clean stringified floats e.g. 60123456789.0
    phone = phone.replace(/\.0$/, '');

    // Extract Email
    let email = emailIdx >= 0 && row[emailIdx] !== undefined ? String(row[emailIdx]).trim() : '';

    // Extract Category
    let kategori = kategoriIdx >= 0 && row[kategoriIdx] !== undefined ? String(row[kategoriIdx]).trim() : 'Kediaman';

    // Extract Status
    let rawStatus = statusIdx >= 0 && row[statusIdx] !== undefined ? String(row[statusIdx]).trim() : 'Aktif';
    let status: CustomerAccount['status'] = 'Aktif';
    if (/tertunggak|overdue|unpaid/i.test(rawStatus)) status = 'Tertunggak';
    else if (/selesai|paid|complete/i.test(rawStatus)) status = 'Selesai';
    else if (/semakan|review|pending/i.test(rawStatus)) status = 'Dalam Semakan';

    // Extract Updated flag & timestamp
    let lastUpdated = updatedIdx >= 0 && row[updatedIdx] ? String(row[updatedIdx]).trim() : new Date().toISOString().replace('T', ' ').slice(0, 16);
    let telahDikemaskini = false;
    if (updateFlagIdx >= 0 && row[updateFlagIdx]) {
      const val = String(row[updateFlagIdx]).toLowerCase();
      telahDikemaskini = val.includes('telah') || val.includes('true') || val.includes('ya') || val.includes('yes') || val.includes('dikemaskini');
    }

    // Reward info
    let rewardStatus: CustomerAccount['rewardStatus'] = 'Belum Layak';
    if (rewardStatusIdx >= 0 && row[rewardStatusIdx]) {
      const val = String(row[rewardStatusIdx]);
      if (/dituntut|claimed/i.test(val)) rewardStatus = 'Telah Dituntut';
      else if (/layak|eligible/i.test(val)) rewardStatus = 'Layak (Belum Dituntut)';
    } else if (telahDikemaskini) {
      rewardStatus = 'Layak (Belum Dituntut)';
    }

    let rewardCode = rewardCodeIdx >= 0 && row[rewardCodeIdx] ? String(row[rewardCodeIdx]).trim() : undefined;

    // Preserve raw key-value mapping for dynamic fields
    const rawRowData: Record<string, any> = {};
    rawHeaders.forEach((header, cIdx) => {
      rawRowData[header] = row[cIdx] !== undefined ? row[cIdx] : '';
    });

    accounts.push({
      noAkaun,
      nama,
      kadPengenalan: ic,
      noTel: phone,
      email,
      kategoriAkaun: kategori,
      status,
      lastUpdated,
      telahDikemaskini,
      rewardStatus,
      rewardCode,
      rawRowData
    });
  }

  return {
    accounts,
    detectedHeaders: rawHeaders,
    totalRows: accounts.length
  };
}

/**
 * Fetch Google Sheet via Google Visualization API (Public / Shared link - NO OAuth required!)
 */
export async function fetchGoogleSheetViaGViz(
  spreadsheetId: string,
  sheetName: string = 'Sheet1'
): Promise<any[][]> {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  if (!cleanId) {
    throw new Error('Sila masukkan Google Sheet ID atau pautan URL yang sah.');
  }

  // Construct Google Visualization API query endpoint
  const url = `https://docs.google.com/spreadsheets/d/${cleanId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    // Try without sheet parameter
    const fallbackUrl = `https://docs.google.com/spreadsheets/d/${cleanId}/gviz/tq?tqx=out:json`;
    const fallbackRes = await fetch(fallbackUrl);
    if (!fallbackRes.ok) {
      throw new Error(`Gagal membaca Google Sheet (Status ${response.status}). Sila pastikan helaian dikongsi (General Access: Anyone with the link can view/edit).`);
    }
    return parseGVizResponse(await fallbackRes.text());
  }

  const text = await response.text();
  return parseGVizResponse(text);
}

/**
 * Parse Google Visualization JSONP wrapper
 */
function parseGVizResponse(text: string): any[][] {
  // Format is: /*O_o*/\ngoogle.visualization.Query.setResponse({...});
  const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]+)\);/);
  if (!jsonMatch || !jsonMatch[1]) {
    throw new Error('Format data Google Visualization tidak sah atau pautan helaian tidak mempunyai kebenaran akses.');
  }

  const data = JSON.parse(jsonMatch[1]);
  if (data.status === 'error') {
    const errorMsg = data.errors?.map((e: any) => e.detailed_message || e.message).join(' ') || 'Ralat GViz';
    throw new Error(`Google Sheets Ralat: ${errorMsg}`);
  }

  const table = data.table;
  if (!table) return [];

  // Extract columns (headers)
  const headers = table.cols.map((col: any) => col.label || col.id || '');
  const rows: any[][] = [headers];

  // Extract rows
  if (table.rows && Array.isArray(table.rows)) {
    table.rows.forEach((r: any) => {
      if (!r.c) return;
      const rowVals = r.c.map((cell: any) => {
        if (!cell) return '';
        if (cell.f !== undefined) return cell.f; // Formatted value
        if (cell.v !== undefined) return cell.v; // Raw value
        return '';
      });
      rows.push(rowVals);
    });
  }

  return rows;
}

/**
 * Fetch Google Sheet via Google Sheets API v4 (with OAuth token)
 */
export async function fetchGoogleSheetViaAPI(
  spreadsheetId: string,
  range: string = 'Sheet1!A1:Z5000',
  token?: string
): Promise<{ rows: any[][]; title: string; sheets: string[] }> {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const authToken = token || getStoredOAuthToken();

  if (!authToken) {
    throw new Error('Token OAuth Google tidak dijumpai. Sila log masuk dengan akaun Google terlebih dahulu.');
  }

  // 1. Fetch metadata to get title & sheet names
  const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}?fields=properties.title,sheets.properties.title`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!metaRes.ok) {
    if (metaRes.status === 401 || metaRes.status === 403) {
      clearOAuthToken();
      throw new Error('Sesi kebenaran Google tamat tempoh. Sila sambung semula akaun Google anda.');
    }
    const errJson = await metaRes.json().catch(() => ({}));
    throw new Error(errJson.error?.message || `Gagal mengambil maklumat Google Sheet (${metaRes.status})`);
  }

  const metaData = await metaRes.json();
  const title = metaData.properties?.title || 'Google Sheet';
  const sheets: string[] = (metaData.sheets || []).map((s: any) => s.properties?.title || 'Sheet1');

  // 2. Fetch cell values
  const targetRange = range.includes('!') ? range : `${sheets[0] || 'Sheet1'}!A1:Z5000`;
  const valRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodeURIComponent(targetRange)}`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!valRes.ok) {
    const errJson = await valRes.json().catch(() => ({}));
    throw new Error(errJson.error?.message || `Gagal membaca sel Google Sheet (${valRes.status})`);
  }

  const valData = await valRes.json();
  return {
    rows: valData.values || [],
    title,
    sheets
  };
}

/**
 * Write/Over-write all Accounts to Google Sheet via Google Sheets API v4
 */
export async function pushAccountsToGoogleSheet(
  spreadsheetId: string,
  accounts: CustomerAccount[],
  sheetName: string = 'Sheet1',
  token?: string
): Promise<{ updatedCells: number; updatedRows: number }> {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const authToken = token || getStoredOAuthToken();

  if (!authToken) {
    throw new Error('Token OAuth Google tidak dijumpai. Sila sambungkan akaun Google anda.');
  }

  const rows = convertAccountsToSheetRows(accounts);
  const targetRange = `${sheetName}!A1:L${rows.length}`;

  // 1. Clear existing range to prevent dangling leftover rows
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodeURIComponent(`${sheetName}!A1:Z5000`)}:clear`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });

  // 2. Update with new rows
  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodeURIComponent(targetRange)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        range: targetRange,
        majorDimension: 'ROWS',
        values: rows
      })
    }
  );

  if (!updateRes.ok) {
    const errJson = await updateRes.json().catch(() => ({}));
    throw new Error(errJson.error?.message || `Gagal menulis ke Google Sheet (${updateRes.status})`);
  }

  const result = await updateRes.json();
  return {
    updatedCells: result.updatedCells || (rows.length * STANDARD_SHEET_HEADERS.length),
    updatedRows: result.updatedRows || rows.length
  };
}

/**
 * Create a new Google Spreadsheet directly in user's Google Drive with default headers & sample data
 */
export async function createNewGoogleSpreadsheet(
  title: string = 'Pangkalan Data Pelanggan - GlideStock Portal',
  accounts: CustomerAccount[] = [],
  token?: string
): Promise<{ spreadsheetId: string; spreadsheetUrl: string; title: string }> {
  const authToken = token || getStoredOAuthToken();

  if (!authToken) {
    throw new Error('Token OAuth Google tidak dijumpai. Sila sambungkan akaun Google anda terlebih dahulu.');
  }

  const rows = convertAccountsToSheetRows(accounts);

  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        title: title
      },
      sheets: [
        {
          properties: {
            title: 'Pangkalan_Data_Akaun',
            gridProperties: {
              frozenRowCount: 1,
              columnCount: 15
            }
          },
          data: [
            {
              startRow: 0,
              startColumn: 0,
              rowData: rows.map(row => ({
                values: row.map(val => ({
                  userEnteredValue: typeof val === 'number' ? { numberValue: val } : { stringValue: String(val) }
                }))
              }))
            }
          ]
        }
      ]
    })
  });

  if (!createRes.ok) {
    const errJson = await createRes.json().catch(() => ({}));
    throw new Error(errJson.error?.message || `Gagal mencipta Google Sheet baru (${createRes.status})`);
  }

  const data = await createRes.json();
  return {
    spreadsheetId: data.spreadsheetId,
    spreadsheetUrl: data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`,
    title: data.properties?.title || title
  };
}

/**
 * List user's Google Sheets files from Google Drive
 */
export async function listUserGoogleSheets(token?: string): Promise<GoogleDriveSheetFile[]> {
  const authToken = token || getStoredOAuthToken();
  if (!authToken) return [];

  try {
    const query = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=modifiedTime desc&pageSize=20&fields=files(id,name,modifiedTime,webViewLink)`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      }
    );

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    return data.files || [];
  } catch (err) {
    console.warn('Failed to list Drive sheets:', err);
    return [];
  }
}

/**
 * Update single customer record directly in Google Sheet
 */
export async function updateSingleCustomerInGoogleSheet(
  spreadsheetId: string,
  updatedAccount: CustomerAccount,
  sheetName: string = 'Sheet1',
  token?: string
): Promise<boolean> {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const authToken = token || getStoredOAuthToken();
  if (!cleanId || !authToken) return false;

  try {
    // 1. Fetch current Sheet values to find matching row index
    const data = await fetchGoogleSheetViaAPI(cleanId, `${sheetName}!A1:L5000`, authToken);
    const rows = data.rows;
    if (!rows || rows.length <= 1) return false;

    const headers = rows[0].map((h: any) => String(h || '').trim());
    const accountColIdx = headers.findIndex(h => isAccountNoColumn(h));
    const targetColIdx = accountColIdx >= 0 ? accountColIdx : 0;

    let targetRowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      const cellVal = rows[i]?.[targetColIdx];
      if (cellVal && String(cellVal).trim().toLowerCase() === updatedAccount.noAkaun.trim().toLowerCase()) {
        targetRowIndex = i + 1; // 1-based index for Google Sheets
        break;
      }
    }

    if (targetRowIndex === -1) {
      // Row not found in sheet, append row to bottom
      const newRow = [
        updatedAccount.noAkaun,
        updatedAccount.nama,
        updatedAccount.kadPengenalan || '',
        updatedAccount.noTel || '',
        updatedAccount.email || '',
        updatedAccount.kategoriAkaun || 'Kediaman',
        updatedAccount.status || 'Aktif',
        updatedAccount.telahDikemaskini ? 'TELAH DIKEMASKINI' : 'REKOD ASAL',
        updatedAccount.lastUpdated || new Date().toISOString().replace('T', ' ').slice(0, 16),
        updatedAccount.kemaskiniOleh || 'Portal Pelanggan',
        updatedAccount.rewardStatus || 'Belum Layak',
        updatedAccount.rewardCode || ''
      ];

      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodeURIComponent(`${sheetName}!A:L`)}:append?valueInputOption=USER_ENTERED`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            range: `${sheetName}!A:L`,
            majorDimension: 'ROWS',
            values: [newRow]
          })
        }
      );
      return true;
    }

    // Row found, update specific row
    const existingRow = rows[targetRowIndex - 1] || [];
    const updatedRow = [...existingRow];
    
    // Find column indexes
    const phoneIdx = headers.findIndex(h => isPhoneColumn(h));
    const emailIdx = headers.findIndex(h => isEmailColumn(h));
    const updatedIdx = headers.findIndex(h => /tarikh|updated|last/i.test(h));
    const flagIdx = headers.findIndex(h => /status kemaskini|flag|telah/i.test(h));
    const rewardIdx = headers.findIndex(h => /status hadiah|hadiah|reward/i.test(h));

    if (phoneIdx >= 0) updatedRow[phoneIdx] = updatedAccount.noTel;
    if (emailIdx >= 0) updatedRow[emailIdx] = updatedAccount.email;
    if (updatedIdx >= 0) updatedRow[updatedIdx] = updatedAccount.lastUpdated;
    if (flagIdx >= 0) updatedRow[flagIdx] = 'TELAH DIKEMASKINI';
    if (rewardIdx >= 0 && updatedAccount.rewardStatus) updatedRow[rewardIdx] = updatedAccount.rewardStatus;

    // Send update request for this specific row
    const rowRange = `${sheetName}!A${targetRowIndex}:L${targetRowIndex}`;
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodeURIComponent(rowRange)}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          range: rowRange,
          majorDimension: 'ROWS',
          values: [updatedRow]
        })
      }
    );

    return true;
  } catch (err) {
    console.warn('Auto-sync single row to Google Sheets failed:', err);
    return false;
  }
}

/**
 * Fetch live customer accounts directly from connected Google Sheet
 */
export async function fetchLiveAccountsFromGoogleSheets(customConfig?: GoogleSheetsConfig): Promise<{
  success: boolean;
  accounts: CustomerAccount[];
  totalRows: number;
  sheetTitle: string;
  error?: string;
}> {
  const config = customConfig || getStoredGoogleSheetsConfig();
  if (!config.isConnected || !config.spreadsheetId) {
    return { 
      success: false, 
      accounts: [], 
      totalRows: 0, 
      sheetTitle: '', 
      error: 'Pangkalan data Google Sheets belum disambungkan.' 
    };
  }

  const cleanId = extractSpreadsheetId(config.spreadsheetId);
  const token = getStoredOAuthToken();

  try {
    let rows: any[][] = [];
    let title = config.spreadsheetName || 'Pangkalan Data Google Sheets';

    if (token) {
      try {
        const res = await fetchGoogleSheetViaAPI(cleanId, `${config.sheetName || 'Sheet1'}!A1:Z5000`, token);
        rows = res.rows;
        if (res.title) title = res.title;
      } catch (apiErr) {
        console.warn('Google Sheets API token expired/failed, trying GViz fallback:', apiErr);
        rows = await fetchGoogleSheetViaGViz(cleanId, config.sheetName || 'Sheet1');
      }
    } else {
      rows = await fetchGoogleSheetViaGViz(cleanId, config.sheetName || 'Sheet1');
    }

    const parsed = parseSheetRowsToAccounts(rows);
    return {
      success: true,
      accounts: parsed.accounts,
      totalRows: parsed.totalRows,
      sheetTitle: title
    };
  } catch (err: any) {
    console.error('Error fetching live Google Sheet accounts:', err);
    return {
      success: false,
      accounts: [],
      totalRows: 0,
      sheetTitle: config.spreadsheetName || 'Google Sheets',
      error: err.message || 'Gagal membaca data dari Google Sheets.'
    };
  }
}

/**
 * Search account number directly against live Google Sheet database
 */
export async function searchAccountInGoogleSheetLive(
  accountNoQuery: string,
  customConfig?: GoogleSheetsConfig
): Promise<{
  found: boolean;
  account?: CustomerAccount;
  allAccounts: CustomerAccount[];
  sheetTitle: string;
  error?: string;
}> {
  const result = await fetchLiveAccountsFromGoogleSheets(customConfig);
  if (!result.success || !result.accounts.length) {
    return { 
      found: false, 
      allAccounts: [], 
      sheetTitle: result.sheetTitle, 
      error: result.error 
    };
  }

  const q = accountNoQuery.toLowerCase().trim();
  const qAlphaNum = q.replace(/[^a-z0-9]/g, '');

  const match = result.accounts.find((a) => {
    const aNo = a.noAkaun.toLowerCase().trim();
    const aAlphaNum = aNo.replace(/[^a-z0-9]/g, '');
    return aNo === q || aNo.includes(q) || (qAlphaNum.length > 0 && aAlphaNum.includes(qAlphaNum));
  });

  return {
    found: Boolean(match),
    account: match,
    allAccounts: result.accounts,
    sheetTitle: result.sheetTitle
  };
}

